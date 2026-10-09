"""One scrape run: fetch -> extract -> stage -> validate -> promote, recorded in scrape_runs.

- Staging rows are committed card by card, so a run's evidence survives a later crash.
- Promotion of passing rows happens in ONE transaction at the end. Any error rolls it back, so
  a failed run never leaves live data half-updated.
- If fewer than half the cards refresh (sites changed, API down, wrong key), nothing is
  promoted at all: a systemic problem shouldn't trickle partial data into live rates.
- Flagged rows stay in staging and the owner gets an email to review them.
"""

import logging
import math
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Protocol

from app.db.models import (
    Card,
    CardEarnRate,
    CardEarnRateHistory,
    CardEarnRateStaging,
    RunStatus,
    ScrapeRun,
    ValidationStatus,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from scraper.extract import ExtractionFailed, Extractor, to_candidates
from scraper.fetch import Fetcher
from scraper.targets import Target
from scraper.validate import Current, missing_categories, validate

log = logging.getLogger(__name__)

MIN_SUCCESS_RATIO = 0.5
STALE_RUN = timedelta(hours=6)


class Notifier(Protocol):
    def send(self, subject: str, text: str) -> None: ...


class AlreadyRunning(Exception):
    pass


@dataclass
class FlaggedRow:
    card: str
    category: str
    rate: str
    notes: str
    evidence: str | None
    url: str


@dataclass
class RunReport:
    run_id: int
    status: RunStatus = RunStatus.running
    notes: list[str] = field(default_factory=list)
    flagged: list[FlaggedRow] = field(default_factory=list)
    cards_ok: int = 0
    rows_passed: int = 0
    rows_promoted: int = 0


def _current(db: Session, card_id: int) -> dict[str, Current]:
    rows = db.scalars(select(CardEarnRate).where(CardEarnRate.card_id == card_id))
    return {r.category.value: Current(rate=r.rate, unit=r.unit.value) for r in rows}


def _promote_row(db: Session, s: CardEarnRateStaging, run_id: int, now: datetime) -> bool:
    """Apply one passing staged row to live data. Returns True if the live value changed."""
    live = db.scalar(
        select(CardEarnRate).where(
            CardEarnRate.card_id == s.card_id, CardEarnRate.category == s.category
        )
    )
    values = {
        "rate": s.rate,
        "unit": s.unit,
        "annual_cap": s.annual_cap,
        "conditions": s.conditions,
    }
    if live is None:
        db.add(
            CardEarnRate(
                card_id=s.card_id,
                category=s.category,
                source_url=s.source_url,
                checked_at=s.checked_at,
                **values,
            )
        )
        changed = True
    else:
        changed = any(getattr(live, k) != v for k, v in values.items())
        if changed:
            db.add(
                CardEarnRateHistory(
                    card_id=live.card_id,
                    category=live.category,
                    rate=live.rate,
                    unit=live.unit,
                    annual_cap=live.annual_cap,
                    conditions=live.conditions,
                    source_url=live.source_url,
                    checked_at=live.checked_at,
                    replaced_by_run_id=run_id,
                    archived_at=now,
                )
            )
            for k, v in values.items():
                setattr(live, k, v)
        live.source_url = s.source_url
        live.checked_at = s.checked_at
    s.validation_status = ValidationStatus.promoted
    return changed


async def _process_card(
    db: Session,
    run: ScrapeRun,
    report: RunReport,
    t: Target,
    fetcher: Fetcher,
    extractor: Extractor,
    now: datetime,
) -> None:
    card = db.scalar(select(Card).where(Card.issuer == t.issuer, Card.name == t.name))
    if card is None:
        report.notes.append(f"{t.name}: not in the catalog (check issuer/name in targets.yaml)")
        return

    page = await fetcher.fetch(t.url)
    if page.status == "blocked":
        run.cards_blocked += 1
        report.notes.append(f"{t.name}: blocked ({page.reason}); skipped")
        return
    if page.status != "ok" or not page.text:
        report.notes.append(f"{t.name}: fetch failed ({page.reason})")
        return
    run.cards_fetched += 1

    try:
        extraction = await extractor.extract(t.name, t.issuer, t.url, page.text)
    except ExtractionFailed as e:
        report.notes.append(f"{t.name}: extraction failed ({e})")
        return
    if not extraction.card_found:
        found = extraction.card_name_on_page or "nothing"
        report.notes.append(f"{t.name}: page doesn't describe this card (found '{found}')")
        return

    candidates = to_candidates(extraction)
    current = _current(db, card.id)
    for verdict in validate(candidates, current, page.text):
        c = verdict.candidate
        db.add(
            CardEarnRateStaging(
                run_id=run.id,
                card_id=card.id,
                category=c.category,
                rate=c.rate,
                unit=c.unit,
                annual_cap=c.annual_cap,
                conditions=c.conditions,
                evidence=c.evidence,
                source_url=t.url,
                checked_at=now,
                validation_status=ValidationStatus.passed
                if verdict.ok
                else ValidationStatus.flagged,
                validation_notes="; ".join(verdict.notes) or None,
            )
        )
        run.rows_staged += 1
        if verdict.ok:
            report.rows_passed += 1
        else:
            run.rows_flagged += 1
            report.flagged.append(
                FlaggedRow(
                    t.name,
                    c.category,
                    f"{c.rate} {c.unit}",
                    "; ".join(verdict.notes),
                    c.evidence,
                    t.url,
                )
            )
    for cat in missing_categories(candidates, current):
        report.notes.append(f"{t.name}: page no longer mentions {cat} (live value kept)")
    report.cards_ok += 1


async def run_scrape(
    db: Session,
    targets: Sequence[Target],
    fetcher: Fetcher,
    extractor: Extractor,
    *,
    now: datetime,
    notifier: Notifier | None,
    promote: bool = True,
) -> RunReport:
    running = db.scalar(
        select(ScrapeRun).where(
            ScrapeRun.status == RunStatus.running, ScrapeRun.started_at > now - STALE_RUN
        )
    )
    if running is not None:
        raise AlreadyRunning(
            f"scrape run {running.id} started at {running.started_at} is still running"
        )

    run = ScrapeRun(
        status=RunStatus.running,
        started_at=now,
        cards_attempted=len(targets),
        cards_fetched=0,
        cards_blocked=0,
        rows_staged=0,
        rows_promoted=0,
        rows_flagged=0,
    )
    db.add(run)
    db.commit()
    report = RunReport(run_id=run.id)

    try:
        for t in targets:
            await _process_card(db, run, report, t, fetcher, extractor, now)
            db.commit()

        needed = max(1, math.ceil(len(targets) * MIN_SUCCESS_RATIO))
        if report.cards_ok < needed:
            report.status = RunStatus.failed
            report.notes.append(
                f"only {report.cards_ok} of {len(targets)} cards refreshed; nothing was promoted"
            )
        elif promote:
            staged = db.scalars(
                select(CardEarnRateStaging).where(
                    CardEarnRateStaging.run_id == run.id,
                    CardEarnRateStaging.validation_status == ValidationStatus.passed,
                )
            ).all()
            for s in staged:
                _promote_row(db, s, run.id, now)
            run.rows_promoted = len(staged)
            report.rows_promoted = len(staged)
            db.commit()  # the single promotion transaction
    except Exception as e:
        db.rollback()  # whatever promotion had started is undone
        log.exception("scrape run %s failed", run.id)
        run = db.get(ScrapeRun, report.run_id)
        report.status = RunStatus.failed
        report.notes.append(f"run failed: {type(e).__name__}: {e}")

    if report.status != RunStatus.failed:
        clean = not report.flagged and not report.notes
        report.status = RunStatus.succeeded if clean else RunStatus.partial

    run.status = report.status
    run.finished_at = datetime.now(now.tzinfo)
    run.errors = "\n".join(report.notes) or None
    db.commit()

    if notifier and (report.flagged or report.status != RunStatus.succeeded):
        try:
            notifier.send(*_owner_email(report))
        except Exception:
            log.exception("owner notification failed")
    return report


def _owner_email(r: RunReport) -> tuple[str, str]:
    if r.status == RunStatus.failed:
        subject = f"Rewards scrape run {r.run_id} failed"
    else:
        subject = f"Rewards scrape run {r.run_id}: {len(r.flagged)} flagged for review"
    lines = [
        f"Run {r.run_id}: {r.status.value}. {r.cards_ok} cards refreshed, "
        f"{r.rows_promoted} rates promoted, {len(r.flagged)} flagged.",
        "",
    ]
    if r.flagged:
        lines.append("Flagged (left in card_earn_rates_staging, not live):")
        for f in r.flagged:
            lines.append(f"- {f.card} / {f.category}: {f.rate} - {f.notes}")
            lines.append(f"  quote: {f.evidence!r}")
            lines.append(f"  page: {f.url}")
        lines.append("")
    if r.notes:
        lines.append("Notes:")
        lines.extend(f"- {n}" for n in r.notes)
    return subject, "\n".join(lines)
