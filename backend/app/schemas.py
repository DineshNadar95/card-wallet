import uuid
from datetime import UTC, date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db.models import Category, RateUnit


class _Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class EarnRateOut(_Out):
    category: Category
    rate: float
    unit: RateUnit
    annual_cap: float | None
    conditions: str | None
    source_url: str
    checked_at: datetime

    @field_validator("checked_at")
    @classmethod
    def _utc(cls, v: datetime) -> datetime:
        return v if v.tzinfo else v.replace(tzinfo=UTC)  # stored as UTC


class CardSummary(_Out):
    id: int
    issuer: str
    name: str
    network: str | None
    annual_fee: float | None
    fx_fee: float | None
    purchase_apr_min: float | None
    purchase_apr_max: float | None
    rewards_types: str | None
    credit_tiers: str | None
    secured: bool | None
    source: str
    as_of: date
    earn_rates: list[EarnRateOut]


class CardDetail(CardSummary):
    late_fee: float | None
    cash_advance_apr_min: float | None
    cash_advance_apr_max: float | None
    availability: str | None
    website: str | None
    source_url: str | None


class CatalogPage(BaseModel):
    items: list[CardSummary]
    total: int


class Profile(_Out):
    user_id: uuid.UUID
    email: str | None = None
    display_name: str | None
    point_value_cents: float


class UserCardCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")  # never accept user_id or anything else

    card_id: int
    # Last 4 digits only. Full card numbers are never accepted or stored.
    last4: str | None = Field(default=None, pattern=r"^\d{4}$")
    nickname: str | None = Field(default=None, max_length=100)


class UserCardOut(_Out):
    id: int
    card_id: int
    last4: str | None
    nickname: str | None
    created_at: datetime
    card: CardSummary


class UserCardDetail(UserCardOut):
    card: CardDetail


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, max_length=200)
    # Cents one point or mile is worth. An assumption the user owns; shown wherever it's used.
    point_value_cents: float | None = Field(default=None, gt=0, le=10)


class OfferBrief(_Out):
    id: int
    merchant: str
    kind: str
    value: float | None
    code: str | None
    expires_at: date | None


class PickOut(BaseModel):
    user_card_id: int
    card_id: int
    name: str
    issuer: str
    last4: str | None
    nickname: str | None
    rate: EarnRateOut | None
    effective_cents: float | None
    matched_category: bool
    reason: str
    offers: list[OfferBrief]


class Recommendation(BaseModel):
    category: Category
    merchant: str | None
    point_value_cents: float
    picks: list[PickOut]
