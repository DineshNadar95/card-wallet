from datetime import UTC, date, datetime, timedelta
from decimal import Decimal as D

import pytest
from app.db.models import (
    Base,
    Card,
    CardEarnRate,
    CardEarnRateHistory,
    CardEarnRateStaging,
    RunStatus,
    ScrapeRun,
    ValidationStatus,
)
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from scraper.extract import Extraction, ExtractionFailed
from scraper.fetch import FetchResult
from scraper.pipeline import AlreadyRunning, run_scrape
from scraper.targets import Target

NOW = datetime(2026, 10, 11, 6, 0, tzinfo=UTC)
OLD = datetime(2026, 10, 4, 6, 0, tzinfo=UTC)

PAGE_A = "Demo Card A rewards. Earn 3X points on dining. 1X point on all other purchases. " * 3
PAGE_B = (
    "Demo Card B rewards. Earn 6% cash back at supermarkets on up to $6,000 per year. "
    "1% cash back on other purchases. " * 3
)


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, expire_on_commit=False)() as s:
        yield s


def card(db, name):
    c = Card(issuer="Demo Bank", name=name, source="Demo data", as_of=date(2025, 12, 31))
    db.add(c)
    db.commit()
    return c


def target(name, path):
    return Target(issuer="Demo Bank", name=name, url=f"https://demo-bank.test/{path}")


def rate(category, value, unit, evidence, **kw):
    return {
        "category": category,
        "rate": value,
        "unit": unit,
        "annual_cap": kw.get("annual_cap"),
        "conditions": kw.get("conditions"),
        "evidence": evidence,
    }


EX_A = Extraction.model_validate(
    {
        "card_found": True,
        "card_name_on_page": "Demo Card A",
        "rates": [
            rate("dining", 3, "points", "Earn 3X points on dining"),
            rate("other", 1, "points", "1X point on all other purchases"),
        ],
    }
)
EX_B = Extraction.model_validate(
    {
        "card_found": True,
        "card_name_on_page": "Demo Card B",
        "rates": [
            rate(
                "groceries",
                6,
                "percent",
                "Earn 6% cash back at supermarkets on up to $6,000 per year",
                annual_cap=6000,
                conditions="then 1%",
            ),
            rate("other", 1, "percent", "1% cash back on other purchases"),
        ],
    }
)


class FakeFetcher:
    def __init__(self, pages):
        self.pages, self.calls = pages, []

    async def fetch(self, url):
        self.calls.append(url)
        p = self.pages.get(url)
        if isinstance(p, FetchResult):
            return p
        return FetchResult(url, "ok", text=p) if p else FetchResult(url, "error", reason="HTTP 404")


class FakeExtractor:
    def __init__(self, by_card):
        self.by_card = by_card

    async def extract(self, card_name, issuer, url, page_text):
        r = self.by_card[card_name]
        if isinstance(r, Exception):
            raise r
        return r


class FakeNotifier:
    def __init__(self):
        self.sent = []

    def send(self, subject, text):
        self.sent.append((subject, text))


def live(db, card_id):
    return {
        r.category.value: (
            r.rate,
            r.unit.value,
            r.checked_at.replace(tzinfo=UTC) if r.checked_at.tzinfo is None else r.checked_at,
        )
        for r in db.scalars(select(CardEarnRate).where(CardEarnRate.card_id == card_id))
    }


async def run(db, targets, pages, extractions, notifier=None, **kw):
    return await run_scrape(
        db,
        targets,
        FakeFetcher(pages),
        FakeExtractor(extractions),
        now=NOW,
        notifier=notifier or FakeNotifier(),
        **kw,
    )


async def test_happy_path_stages_validates_and_promotes(db):
    a, b = card(db, "Demo Card A"), card(db, "Demo Card B")
    ta, tb = target("Demo Card A", "a"), target("Demo Card B", "b")
    notifier = FakeNotifier()

    report = await run(
        db,
        [ta, tb],
        {ta.url: PAGE_A, tb.url: PAGE_B},
        {"Demo Card A": EX_A, "Demo Card B": EX_B},
        notifier,
    )

    assert report.status == RunStatus.succeeded
    assert {k: v[:2] for k, v in live(db, a.id).items()} == {
        "dining": (D("3"), "points"),
        "other": (D("1"), "points"),
    }
    groceries = db.scalar(
        select(CardEarnRate).where(
            CardEarnRate.card_id == b.id, CardEarnRate.category == "groceries"
        )
    )
    assert groceries.annual_cap == D("6000") and groceries.conditions == "then 1%"
    assert groceries.source_url == tb.url

    run_row = db.get(ScrapeRun, report.run_id)
    assert (
        run_row.cards_attempted,
        run_row.cards_fetched,
        run_row.rows_staged,
        run_row.rows_promoted,
        run_row.rows_flagged,
    ) == (2, 2, 4, 4, 0)
    assert run_row.finished_at is not None
    staged = db.scalars(select(CardEarnRateStaging)).all()
    assert {s.validation_status for s in staged} == {ValidationStatus.promoted}
    assert all(s.evidence for s in staged)
    assert notifier.sent == []  # nothing to review


async def test_flagged_rows_stay_in_staging_and_email_the_owner(db):
    a = card(db, "Demo Card A")
    ta = target("Demo Card A", "a")
    bad = Extraction.model_validate(
        {
            "card_found": True,
            "card_name_on_page": "Demo Card A",
            "rates": [
                rate("dining", 3, "points", "Earn 3X points on dining"),
                rate(
                    "travel", 5, "points", "Earn 5X points on travel"
                ),  # not on the page: hallucinated
            ],
        }
    )
    notifier = FakeNotifier()
    report = await run(db, [ta], {ta.url: PAGE_A}, {"Demo Card A": bad}, notifier)

    assert report.status == RunStatus.partial
    assert set(live(db, a.id)) == {"dining"}  # only the verified row went live
    flagged = db.scalar(select(CardEarnRateStaging).where(CardEarnRateStaging.category == "travel"))
    assert flagged.validation_status == ValidationStatus.flagged
    assert "quote not found on the page" in flagged.validation_notes
    (subject, text) = notifier.sent[0]
    assert "1 flagged" in subject
    assert "Demo Card A" in text and "travel" in text and "quote not found on the page" in text


async def test_changed_rate_moves_old_value_to_history(db):
    a = card(db, "Demo Card A")
    db.add(
        CardEarnRate(
            card_id=a.id,
            category="dining",
            rate=D("2"),
            unit="points",
            source_url="https://demo-bank.test/old",
            checked_at=OLD,
        )
    )
    db.commit()
    ta = target("Demo Card A", "a")
    report = await run(db, [ta], {ta.url: PAGE_A}, {"Demo Card A": EX_A})

    assert live(db, a.id)["dining"][:2] == (D("3"), "points")
    (h,) = db.scalars(select(CardEarnRateHistory)).all()
    assert (h.category.value, h.rate, h.source_url, h.replaced_by_run_id) == (
        "dining",
        D("2"),
        "https://demo-bank.test/old",
        report.run_id,
    )


async def test_unchanged_rate_only_refreshes_checked_at(db):
    a = card(db, "Demo Card A")
    db.add(
        CardEarnRate(
            card_id=a.id,
            category="dining",
            rate=D("3"),
            unit="points",
            source_url="https://demo-bank.test/a",
            checked_at=OLD,
        )
    )
    db.commit()
    ta = target("Demo Card A", "a")
    await run(db, [ta], {ta.url: PAGE_A}, {"Demo Card A": EX_A})
    assert live(db, a.id)["dining"][2] == NOW
    assert db.scalars(select(CardEarnRateHistory)).all() == []


async def test_more_than_double_is_held_back(db):
    a = card(db, "Demo Card A")
    db.add(
        CardEarnRate(
            card_id=a.id,
            category="dining",
            rate=D("1"),
            unit="points",
            source_url="https://demo-bank.test/a",
            checked_at=OLD,
        )
    )
    db.commit()
    ta = target("Demo Card A", "a")
    await run(db, [ta], {ta.url: PAGE_A}, {"Demo Card A": EX_A})
    assert live(db, a.id)["dining"][:2] == (D("1"), "points")  # unchanged until reviewed


async def test_blocked_missing_and_failed_cards_are_reported(db):
    card(db, "Demo Card A"), card(db, "Demo Card B"), card(db, "Demo Card C")
    ta, tb, tc = target("Demo Card A", "a"), target("Demo Card B", "b"), target("Demo Card C", "c")
    td = target("Not In Catalog", "d")
    pages = {
        ta.url: PAGE_A,
        tb.url: FetchResult(tb.url, "blocked", reason="page says 'captcha'"),
        tc.url: PAGE_A,
    }
    notifier = FakeNotifier()
    report = await run(
        db,
        [ta, tb, tc, td],
        pages,
        {"Demo Card A": EX_A, "Demo Card C": ExtractionFailed("Claude API error 529")},
        notifier,
    )

    notes = "\n".join(report.notes)
    assert "Demo Card B: blocked (page says 'captcha')" in notes
    assert "Demo Card C: extraction failed (Claude API error 529)" in notes
    assert "Not In Catalog: not in the catalog" in notes
    r = db.get(ScrapeRun, report.run_id)
    assert r.cards_blocked == 1 and r.cards_fetched == 2
    # Only 1 of 4 cards refreshed: below the safety threshold, nothing goes live.
    assert report.status == RunStatus.failed
    assert db.scalars(select(CardEarnRate)).all() == []
    assert notifier.sent and "failed" in notifier.sent[0][0].lower()


async def test_page_about_another_card_is_rejected(db):
    card(db, "Demo Card A")
    ta = target("Demo Card A", "a")
    wrong = Extraction.model_validate(
        {"card_found": False, "card_name_on_page": "Demo Card Z", "rates": []}
    )
    report = await run(db, [ta], {ta.url: PAGE_A}, {"Demo Card A": wrong})
    assert "Demo Card A: page doesn't describe this card (found 'Demo Card Z')" in report.notes
    assert report.status == RunStatus.failed


async def test_categories_missing_from_page_are_reported_not_deleted(db):
    a = card(db, "Demo Card A")
    db.add(
        CardEarnRate(
            card_id=a.id,
            category="gas",
            rate=D("2"),
            unit="points",
            source_url="https://demo-bank.test/a",
            checked_at=OLD,
        )
    )
    db.commit()
    ta = target("Demo Card A", "a")
    report = await run(db, [ta], {ta.url: PAGE_A}, {"Demo Card A": EX_A})
    assert "Demo Card A: page no longer mentions gas (live value kept)" in report.notes
    assert "gas" in live(db, a.id)


async def test_promotion_failure_leaves_live_data_untouched(db, monkeypatch):
    a = card(db, "Demo Card A")
    db.add(
        CardEarnRate(
            card_id=a.id,
            category="other",
            rate=D("1"),
            unit="points",
            source_url="https://demo-bank.test/a",
            checked_at=OLD,
        )
    )
    db.commit()
    ta = target("Demo Card A", "a")

    from scraper import pipeline

    real = pipeline._promote_row
    calls = {"n": 0}

    def boom(*args, **kw):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("db went away")
        return real(*args, **kw)

    monkeypatch.setattr(pipeline, "_promote_row", boom)
    report = await run(db, [ta], {ta.url: PAGE_A}, {"Demo Card A": EX_A})

    assert report.status == RunStatus.failed
    assert live(db, a.id) == {
        "other": (D("1"), "points", OLD)
    }  # first row's change rolled back too
    assert db.scalars(select(CardEarnRateHistory)).all() == []
    r = db.get(ScrapeRun, report.run_id)
    assert r.status == RunStatus.failed and "db went away" in r.errors


async def test_no_promote_mode_only_stages(db):
    a = card(db, "Demo Card A")
    ta = target("Demo Card A", "a")
    report = await run(db, [ta], {ta.url: PAGE_A}, {"Demo Card A": EX_A}, promote=False)
    assert live(db, a.id) == {}
    assert {s.validation_status for s in db.scalars(select(CardEarnRateStaging))} == {
        ValidationStatus.passed
    }
    assert report.rows_passed == 2


async def test_refuses_to_overlap_a_running_run(db):
    db.add(ScrapeRun(status=RunStatus.running, started_at=NOW - timedelta(hours=1)))
    db.commit()
    with pytest.raises(AlreadyRunning):
        await run(db, [], {}, {})


async def test_stale_running_run_does_not_block(db):
    db.add(ScrapeRun(status=RunStatus.running, started_at=NOW - timedelta(hours=12)))
    db.commit()
    card(db, "Demo Card A")
    ta = target("Demo Card A", "a")
    report = await run(db, [ta], {ta.url: PAGE_A}, {"Demo Card A": EX_A})
    assert report.status == RunStatus.succeeded
