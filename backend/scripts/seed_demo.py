"""Seed a local database with fake cards, a fake wallet and a few offers for manual testing.

Fake data only ("Demo Card A".."D" from "Demo Bank"); never real card terms (CLAUDE.md rule 1).
The wallet belongs to the local test user from scripts/dev_session.py.

Usage (from backend/):
    DATABASE_URL=sqlite:///local.db uv run alembic upgrade head
    DATABASE_URL=sqlite:///local.db uv run python scripts/seed_demo.py
"""

import sys
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal as D
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import delete, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db.models import Card, CardEarnRate, Offer, Profile, PushToken, UserCard  # noqa: E402
from app.db.session import get_engine  # noqa: E402

DEV_USER = uuid.UUID("00000000-0000-0000-0000-00000000d3e0")
CHECKED = datetime(2026, 10, 4, tzinfo=UTC)
SOURCE_URL = "https://demo-bank.test/cards"

# name -> [(category, rate, unit, annual_cap, conditions)]
CARDS = {
    "Demo Card A": [
        ("dining", "4", "points", None, None),
        ("travel", "3", "points", None, None),
        ("other", "1", "points", None, None),
    ],
    "Demo Card B": [
        ("groceries", "6", "percent", D("6000"), None),
        ("online", "5", "percent", None, "Rotating category; activate each quarter"),
        ("other", "1", "percent", None, None),
    ],
    "Demo Card C": [("travel", "5", "miles", None, None), ("other", "2", "miles", None, None)],
    "Demo Card D": [("gas", "3", "percent", None, None), ("other", "1.5", "percent", None, None)],
}


def main() -> None:
    today = date.today()
    with Session(get_engine()) as db:
        for table in (Offer, PushToken, UserCard):
            db.execute(delete(table).where(table.user_id == DEV_USER))
        wallet: dict[str, UserCard] = {}
        for i, (name, rates) in enumerate(CARDS.items()):
            card = db.scalar(select(Card).where(Card.issuer == "Demo Bank", Card.name == name))
            if card is None:
                card = Card(
                    issuer="Demo Bank",
                    name=name,
                    network="Visa" if i % 2 == 0 else "Mastercard",
                    annual_fee=D("95") if i == 0 else D("0"),
                    fx_fee=D("0") if i % 2 == 0 else D("3"),
                    purchase_apr_min=D("20.24"),
                    purchase_apr_max=D("28.24"),
                    late_fee=D("40"),
                    rewards_types="Cashback rewards; Travel-related rewards",
                    credit_tiers="Credit score of 720 or greater",
                    secured=False,
                    availability="National",
                    source="Demo data (not real)",
                    source_url=SOURCE_URL,
                    as_of=date(2025, 12, 31),
                )
                db.add(card)
                db.flush()
                for cat, rate, unit, cap, cond in rates:
                    db.add(
                        CardEarnRate(
                            card_id=card.id,
                            category=cat,
                            rate=D(rate),
                            unit=unit,
                            annual_cap=cap,
                            conditions=cond,
                            source_url=SOURCE_URL,
                            checked_at=CHECKED,
                        )
                    )
            uc = UserCard(user_id=DEV_USER, card_id=card.id, last4=f"{1234 + i * 1111}"[-4:])
            db.add(uc)
            db.flush()
            wallet[name] = uc

        offers = [
            dict(user_card_id=wallet["Demo Card A"].id, merchant="Demo Bistro", category="dining",
                 kind="percent_back", value=D("10"), max_back=D("15"), min_spend=D("50"),
                 expires_at=today + timedelta(days=3), notes="Spend $50+, up to $15 back",
                 source="screenshot", remind_days=3),
            dict(user_card_id=None, merchant="Demo Phone Co.", kind="amount_off", value=D("100"),
                 code="UPG100", expires_at=today + timedelta(days=4), notes="Upgrade coupon",
                 source="screenshot", remind_days=3),
            dict(user_card_id=None, merchant="Demo Clothing", kind="percent_back", value=D("25"),
                 expires_at=today + timedelta(days=40), notes="In-store or online, one use",
                 source="typed", remind_days=0),
            dict(user_card_id=wallet["Demo Card A"].id, merchant="Dining credit", category="dining",
                 kind="amount_off", value=D("10"), notes="Resets monthly", source="card_benefit",
                 remind_days=0),
            dict(user_card_id=wallet["Demo Card D"].id, merchant="Demo Hardware",
                 kind="amount_off", value=D("15"), expires_at=today - timedelta(days=2),
                 source="typed", remind_days=0),
        ]  # fmt: skip
        for o in offers:
            db.add(Offer(user_id=DEV_USER, **o))
        if db.get(Profile, DEV_USER) is None:
            db.add(Profile(user_id=DEV_USER, email="dev@example.test", point_value_cents=D("1.0")))
        db.commit()
    print(f"seeded {len(CARDS)} demo cards, {len(offers)} offers for user {DEV_USER}")


if __name__ == "__main__":
    main()
