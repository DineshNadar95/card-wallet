"""Daily expiry reminders (Render cron).

Finds offers whose reminder day has come (expires_at - remind_days <= today <= expires_at)
and that haven't been reminded yet. "<=" rather than "==" so a skipped run catches up.
Each user gets one email and one push listing their offers; `reminded_at` is set only once
something was delivered, and committed per user so a crash mid-run never double-sends.

Usage (from backend/):
    uv run python -m app.jobs.reminders            # send
    uv run python -m app.jobs.reminders --dry-run  # list what would be sent
"""

import argparse
import logging
import smtplib
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from email.message import EmailMessage
from typing import Protocol

import httpx2
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import Offer, OfferKind, Profile, PushToken

log = logging.getLogger("reminders")

MAX_REMIND_DAYS = 7
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


# ------------------------------------------------------------------ channels


@dataclass
class PushResult:
    delivered: int
    invalid_tokens: set[str] = field(default_factory=set)


class EmailSender(Protocol):
    def send(self, to: str, subject: str, text: str) -> None: ...


class PushSender(Protocol):
    def send(self, tokens: list[str], title: str, body: str) -> PushResult: ...


class SmtpEmail:
    def __init__(self, host: str, port: int, user: str, password: str, sender: str):
        self.host, self.port, self.user, self.password, self.sender = (
            host,
            port,
            user,
            password,
            sender,
        )

    def send(self, to: str, subject: str, text: str) -> None:
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = self.sender, to, subject
        msg.set_content(text)
        with smtplib.SMTP(self.host, self.port, timeout=30) as smtp:
            smtp.starttls()
            if self.user:
                smtp.login(self.user, self.password)
            smtp.send_message(msg)


class ExpoPush:
    def __init__(self, access_token: str = ""):
        self.headers = {"Accept": "application/json"}
        if access_token:
            self.headers["Authorization"] = f"Bearer {access_token}"

    def send(self, tokens: list[str], title: str, body: str) -> PushResult:
        messages = [{"to": t, "title": title, "body": body, "sound": "default"} for t in tokens]
        res = httpx2.post(EXPO_PUSH_URL, json=messages, headers=self.headers, timeout=30)
        res.raise_for_status()
        tickets = res.json().get("data", [])
        result = PushResult(delivered=0)
        for token, ticket in zip(tokens, tickets, strict=False):
            if ticket.get("status") == "ok":
                result.delivered += 1
            elif ticket.get("details", {}).get("error") == "DeviceNotRegistered":
                result.invalid_tokens.add(token)
            else:
                log.warning("push ticket error: %s", ticket.get("message"))
        return result


def channels_from_settings() -> tuple[EmailSender | None, PushSender]:
    s = get_settings()
    email = (
        SmtpEmail(s.smtp_host, s.smtp_port, s.smtp_user, s.smtp_password, s.email_from)
        if s.smtp_host and s.email_from
        else None
    )
    return email, ExpoPush(s.expo_access_token)


# ------------------------------------------------------------------ wording


def _num(v) -> str:
    f = float(v)
    return str(int(f)) if f.is_integer() else f"{f:.2f}"


def value_text(o: Offer) -> str:
    match o.kind:
        case OfferKind.percent_back:
            return f"{_num(o.value)}% back"
        case OfferKind.amount_off:
            return f"${_num(o.value)} off"
        case OfferKind.points:
            return f"{_num(o.value)}x points"
        case _:
            return f"code {o.code}" if o.code else "coupon"


def ends_text(days: int) -> str:
    return "ends today" if days == 0 else "ends tomorrow" if days == 1 else f"ends in {days} days"


def offer_line(o: Offer, today: date) -> str:
    parts = [o.merchant, value_text(o), ends_text((o.expires_at - today).days)]
    if o.user_card is not None:
        uc = o.user_card
        card = uc.nickname or uc.card.name
        parts.append(f"use {card}" + (f" •••• {uc.last4}" if uc.last4 else ""))
    return " · ".join(parts)


# ------------------------------------------------------------------ job


@dataclass
class RunStats:
    offers_due: int = 0
    offers_reminded: int = 0
    users_notified: int = 0
    users_without_channel: int = 0
    failures: int = 0


def due_offers(db: Session, today: date) -> list[Offer]:
    q = (
        select(Offer)
        .where(
            Offer.remind_days > 0,
            Offer.reminded_at.is_(None),
            Offer.expires_at.is_not(None),
            Offer.expires_at >= today,
            Offer.expires_at <= today + timedelta(days=MAX_REMIND_DAYS),
        )
        .order_by(Offer.user_id, Offer.expires_at, Offer.id)
        # Two overlapping runs never pick up the same rows (Postgres; ignored on SQLite).
        .with_for_update(skip_locked=True, of=Offer)
    )
    return [o for o in db.scalars(q).unique() if (o.expires_at - today).days <= o.remind_days]


def run_reminders(
    db: Session,
    today: date,
    *,
    email: EmailSender | None,
    push: PushSender | None,
    dry_run: bool = False,
) -> RunStats:
    stats = RunStats()
    by_user: dict[uuid.UUID, list[Offer]] = defaultdict(list)
    for o in due_offers(db, today):
        by_user[o.user_id].append(o)
    stats.offers_due = sum(len(v) for v in by_user.values())

    for user_id, offers in by_user.items():
        lines = [offer_line(o, today) for o in offers]
        if dry_run:
            log.info("[dry run] %s: %s", user_id, " | ".join(lines))
            continue

        profile = db.get(Profile, user_id)
        address = profile.email if profile else None
        tokens = list(db.scalars(select(PushToken.token).where(PushToken.user_id == user_id)))
        if not (email and address) and not (push and tokens):
            stats.users_without_channel += 1
            continue

        delivered = False
        if email and address:
            try:
                email.send(address, _subject(offers), _email_body(lines))
                delivered = True
            except Exception:
                log.exception("reminder email failed for %s", user_id)
        if push and tokens:
            try:
                first = offers[0]
                title = f"{first.merchant}: {value_text(first)}"
                body = ends_text((first.expires_at - today).days).capitalize()
                if len(offers) > 1:
                    body += f" · and {len(offers) - 1} more ending soon"
                result = push.send(tokens, title, body)
                delivered = delivered or result.delivered > 0
                if result.invalid_tokens:
                    db.execute(delete(PushToken).where(PushToken.token.in_(result.invalid_tokens)))
            except Exception:
                log.exception("reminder push failed for %s", user_id)

        if delivered:
            now = datetime.now(UTC)
            for o in offers:
                o.reminded_at = now
            stats.offers_reminded += len(offers)
            stats.users_notified += 1
        else:
            stats.failures += 1  # left unmarked; tomorrow's run retries
        db.commit()  # per user: progress survives a later failure

    if dry_run:
        db.rollback()
    return stats


def _subject(offers: list[Offer]) -> str:
    if len(offers) == 1:
        return f"{offers[0].merchant} offer ends soon"
    return f"{len(offers)} offers ending soon"


def _email_body(lines: list[str]) -> str:
    url = get_settings().web_app_url.rstrip("/")
    items = "\n".join(f"• {line}" for line in lines)
    return (
        f"These offers and coupons in your Card Wallet end soon:\n\n{items}\n\n"
        f"See them all: {url}/app/offers\n\n"
        "You're getting this because you turned on a reminder for these offers."
    )


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    from app.db.session import get_engine

    email, push = channels_from_settings()
    if email is None:
        log.warning("SMTP not configured: email reminders are off")
    with Session(get_engine()) as db:
        stats = run_reminders(db, date.today(), email=email, push=push, dry_run=args.dry_run)
    log.info("reminders: %s", stats)


if __name__ == "__main__":
    main()
