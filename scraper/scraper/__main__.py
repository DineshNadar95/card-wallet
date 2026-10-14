"""Weekly rewards refresh (Render cron, Sundays).

Usage (from scraper/):
    uv run python -m scraper                      # all targets, promote passing rows
    uv run python -m scraper --only "Sapphire"    # just matching cards
    uv run python -m scraper --no-promote         # stage + validate only, live data untouched
    uv run python -m scraper --fetch-only         # check pages are reachable; no Claude, no DB
"""

import argparse
import asyncio
import logging
import sys
from datetime import UTC, datetime

import anthropic
from app.config import get_settings as get_backend_settings
from app.db.models import RunStatus
from app.db.session import get_engine
from app.jobs.reminders import SmtpEmail
from sqlalchemy.orm import Session

from scraper.config import get_scraper_settings
from scraper.extract import ClaudeExtractor
from scraper.fetch import PoliteFetcher
from scraper.pipeline import run_scrape
from scraper.review import ClaudeReviewer
from scraper.targets import load_targets

log = logging.getLogger("scraper")


class OwnerEmail:
    def __init__(self, smtp: SmtpEmail, to: str):
        self.smtp, self.to = smtp, to

    def send(self, subject: str, text: str) -> None:
        self.smtp.send(self.to, subject, text)


def _notifier():
    s, b = get_scraper_settings(), get_backend_settings()
    if not (s.owner_email and b.smtp_host and b.email_from):
        log.warning("OWNER_EMAIL/SMTP not configured: flagged rows will only be logged")
        return None
    return OwnerEmail(
        SmtpEmail(b.smtp_host, b.smtp_port, b.smtp_user, b.smtp_password, b.email_from),
        s.owner_email,
    )


async def _fetch_only(targets, fetcher) -> int:
    bad = 0
    for t in targets:
        r = await fetcher.fetch(t.url)
        size = f"{len(r.text):,} chars" if r.text else ""
        print(f"{r.status:8} {t.name:40} {size or r.reason}  ({r.http_status})")
        bad += r.status != "ok"
    return 1 if bad else 0


async def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--only", help="only targets whose name contains this text")
    ap.add_argument("--no-promote", action="store_true")
    ap.add_argument("--fetch-only", action="store_true")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

    s = get_scraper_settings()
    if not s.owner_email:
        log.error("Set OWNER_EMAIL: it's the contact address in the bot's user agent")
        return 2
    targets = load_targets()
    if args.only:
        targets = [t for t in targets if args.only.lower() in t.name.lower()]

    fetcher = PoliteFetcher(contact=s.owner_email, min_delay=s.scraper_min_delay)
    await fetcher.start()
    try:
        if args.fetch_only:
            return await _fetch_only(targets, fetcher)
        if not s.anthropic_api_key:
            log.error("Set ANTHROPIC_API_KEY to extract rates")
            return 2
        client = anthropic.AsyncAnthropic(api_key=s.anthropic_api_key)
        extractor = ClaudeExtractor(client, s.scraper_extract_model)
        reviewer = ClaudeReviewer(client, s.scraper_verify_model, s.scraper_tiebreak_model)
        log.info(
            "models: extract=%s verify=%s tie-break=%s",
            s.scraper_extract_model,
            s.scraper_verify_model,
            s.scraper_tiebreak_model,
        )
        with Session(get_engine()) as db:
            report = await run_scrape(
                db,
                targets,
                fetcher,
                extractor,
                now=datetime.now(UTC),
                notifier=_notifier(),
                promote=not args.no_promote,
                reviewer=reviewer,
            )
    finally:
        await fetcher.close()

    log.info(
        "run %s: %s, %d promoted, %d flagged",
        report.run_id,
        report.status.value,
        report.rows_promoted,
        len(report.flagged),
    )
    for card, category, rate, ok, quote in report.staged:
        log.info(
            "staged %s | %s | %s | %s | quote: %r",
            "passed " if ok else "FLAGGED",
            card,
            category,
            rate,
            quote,
        )
    for n in report.notes:
        log.info("note: %s", n)
    return 1 if report.status == RunStatus.failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
