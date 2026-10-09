"""Fake catalog data for tests. Never real card terms (CLAUDE.md rule 1)."""

from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.db.models import Card, CardEarnRate, Category, RateUnit


def make_card(db: Session, name: str = "Demo Card A", **kw) -> Card:
    values = {
        "issuer": "Demo Bank",
        "name": name,
        "network": "Visa",
        "annual_fee": Decimal("0"),
        "purchase_apr_min": Decimal("19.9"),
        "purchase_apr_max": Decimal("28.9"),
        "fx_fee": Decimal("0"),
        "late_fee": Decimal("40"),
        "rewards_types": "Cashback rewards",
        "credit_tiers": "Credit score of 720 or greater",
        "secured": False,
        "availability": "National",
        "source": "CFPB TCCP Jul–Dec 2025",
        "source_url": "https://example.test/tccp.xlsx",
        "as_of": date(2025, 12, 31),
    }
    values.update(kw)
    card = Card(**values)
    db.add(card)
    db.commit()
    return card


def add_rate(db: Session, card: Card, category: Category, rate: str, unit: RateUnit) -> None:
    db.add(
        CardEarnRate(
            card_id=card.id,
            category=category,
            rate=Decimal(rate),
            unit=unit,
            source_url="https://demo-bank.test/cards/a",
            checked_at=datetime(2026, 10, 4, tzinfo=UTC),
        )
    )
    db.commit()
