"""Database schema. Alembic autogenerates migrations from this module.

Shared catalog tables are read-only to users. Per-user tables carry a `user_id`
(the Supabase auth user id from the verified JWT) and must always be filtered by it.
"""

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# Deterministic constraint names so migrations are stable across databases.
NAMING = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING)


class Category(enum.StrEnum):
    dining = "dining"
    groceries = "groceries"
    travel = "travel"
    gas = "gas"
    online = "online"
    other = "other"


class RateUnit(enum.StrEnum):
    percent = "percent"
    points = "points"
    miles = "miles"


class OfferKind(enum.StrEnum):
    percent_back = "percent_back"
    amount_off = "amount_off"
    points = "points"
    code = "code"


class OfferSource(enum.StrEnum):
    screenshot = "screenshot"
    typed = "typed"
    card_benefit = "card_benefit"


class ValidationStatus(enum.StrEnum):
    pending = "pending"
    passed = "passed"
    flagged = "flagged"
    promoted = "promoted"


class RunStatus(enum.StrEnum):
    running = "running"
    succeeded = "succeeded"
    partial = "partial"
    failed = "failed"


def _enum(e: type[enum.Enum], name: str) -> Enum:
    # Stored as VARCHAR + CHECK constraint: easier to extend than native PG enums.
    return Enum(e, name=name, native_enum=False, create_constraint=True, length=32)


def _now():
    return mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# ---------------------------------------------------------------- shared catalog


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    issuer: Mapped[str] = mapped_column(String(200), index=True)
    name: Mapped[str] = mapped_column(String(300), index=True)
    network: Mapped[str | None] = mapped_column(String(50))
    # Dollars. APRs and the FX fee are percentages (13.9 means 13.9%).
    annual_fee: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    purchase_apr_min: Mapped[Decimal | None] = mapped_column(Numeric(6, 3))
    purchase_apr_max: Mapped[Decimal | None] = mapped_column(Numeric(6, 3))
    fx_fee: Mapped[Decimal | None] = mapped_column(Numeric(6, 3))
    late_fee: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    cash_advance_apr_min: Mapped[Decimal | None] = mapped_column(Numeric(6, 3))
    cash_advance_apr_max: Mapped[Decimal | None] = mapped_column(Numeric(6, 3))
    secured: Mapped[bool | None] = mapped_column(Boolean)
    credit_tiers: Mapped[str | None] = mapped_column(Text)  # TCCP "Targeted Credit Tiers"
    rewards_types: Mapped[str | None] = mapped_column(Text)  # TCCP "Rewards", "; "-separated
    availability: Mapped[str | None] = mapped_column(String(100))  # National / state-only
    website: Mapped[str | None] = mapped_column(Text)  # as reported to CFPB
    product_url: Mapped[str | None] = mapped_column(Text)  # issuer page, used by the scraper
    source: Mapped[str] = mapped_column(String(200))  # e.g. "CFPB TCCP Jul–Dec 2025"
    source_url: Mapped[str | None] = mapped_column(Text)
    as_of: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = _now()

    earn_rates: Mapped[list["CardEarnRate"]] = relationship(
        order_by="CardEarnRate.category", lazy="selectin", viewonly=True
    )

    __table_args__ = (UniqueConstraint("issuer", "name", name="uq_cards_issuer_name"),)


class _EarnRateColumns:
    category: Mapped[Category] = mapped_column(_enum(Category, "category"))
    rate: Mapped[Decimal] = mapped_column(Numeric(6, 3))
    unit: Mapped[RateUnit] = mapped_column(_enum(RateUnit, "rate_unit"))
    annual_cap: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    conditions: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(Text)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class CardEarnRate(_EarnRateColumns, Base):
    __tablename__ = "card_earn_rates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id", ondelete="CASCADE"), index=True)

    __table_args__ = (
        UniqueConstraint("card_id", "category", name="uq_card_earn_rates_card_category"),
    )


class ScrapeRun(Base):
    __tablename__ = "scrape_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    started_at: Mapped[datetime] = _now()
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[RunStatus] = mapped_column(_enum(RunStatus, "run_status"))
    cards_attempted: Mapped[int] = mapped_column(Integer, default=0)
    cards_fetched: Mapped[int] = mapped_column(Integer, default=0)
    cards_blocked: Mapped[int] = mapped_column(Integer, default=0)
    rows_staged: Mapped[int] = mapped_column(Integer, default=0)
    rows_promoted: Mapped[int] = mapped_column(Integer, default=0)
    rows_flagged: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[str | None] = mapped_column(Text)


class CardEarnRateStaging(_EarnRateColumns, Base):
    __tablename__ = "card_earn_rates_staging"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(
        ForeignKey("scrape_runs.id", ondelete="CASCADE"), index=True
    )
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id", ondelete="CASCADE"), index=True)
    # LLM output may omit values; staging allows nulls, validation decides.
    rate: Mapped[Decimal | None] = mapped_column(Numeric(6, 3))
    unit: Mapped[RateUnit | None] = mapped_column(_enum(RateUnit, "rate_unit"))
    validation_status: Mapped[ValidationStatus] = mapped_column(
        _enum(ValidationStatus, "validation_status"), default=ValidationStatus.pending
    )
    validation_notes: Mapped[str | None] = mapped_column(Text)
    # Verbatim quote from the fetched page that backs this rate; validation checks it's there.
    evidence: Mapped[str | None] = mapped_column(Text)


class CardEarnRateHistory(_EarnRateColumns, Base):
    __tablename__ = "card_earn_rates_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id", ondelete="CASCADE"), index=True)
    replaced_by_run_id: Mapped[int | None] = mapped_column(ForeignKey("scrape_runs.id"))
    archived_at: Mapped[datetime] = _now()


# ---------------------------------------------------------------- per user


class Profile(Base):
    __tablename__ = "profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    display_name: Mapped[str | None] = mapped_column(String(200))
    # Copied from the verified token on each /me call; used only for expiry reminders.
    email: Mapped[str | None] = mapped_column(String(320))
    point_value_cents: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("1.0"))
    created_at: Mapped[datetime] = _now()


class UserCard(Base):
    __tablename__ = "user_cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id"))
    # Last 4 digits only. Never store a full card number.
    last4: Mapped[str | None] = mapped_column(String(4))
    nickname: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = _now()

    card: Mapped[Card] = relationship(lazy="joined")


class Offer(Base):
    __tablename__ = "offers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    # Null for plain store coupons that aren't tied to a card.
    user_card_id: Mapped[int | None] = mapped_column(
        ForeignKey("user_cards.id", ondelete="SET NULL")
    )
    merchant: Mapped[str] = mapped_column(String(200))
    category: Mapped[Category | None] = mapped_column(_enum(Category, "category"))
    kind: Mapped[OfferKind] = mapped_column(_enum(OfferKind, "offer_kind"))
    value: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    max_back: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    min_spend: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    code: Mapped[str | None] = mapped_column(String(100))
    expires_at: Mapped[date | None] = mapped_column(Date)
    source: Mapped[OfferSource] = mapped_column(_enum(OfferSource, "offer_source"))
    image_path: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(String(500))  # e.g. "In-store or online, one use"
    remind_days: Mapped[int] = mapped_column(Integer, default=0)  # 0 = off, or 3 / 5 / 7
    reminded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _now()

    user_card: Mapped["UserCard | None"] = relationship(lazy="joined")

    __table_args__ = (Index("ix_offers_reminder_due", "expires_at", "reminded_at"),)


class PushToken(Base):
    """Expo push tokens, one row per device."""

    __tablename__ = "push_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, index=True)
    token: Mapped[str] = mapped_column(String(200), unique=True)
    platform: Mapped[str | None] = mapped_column(String(20))
    created_at: Mapped[datetime] = _now()


USER_TABLES = ("profiles", "user_cards", "offers", "push_tokens")
