import uuid
from datetime import UTC, date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.db.models import Category, OfferKind, OfferSource, RateUnit


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


# ---------------------------------------------------------------- offers

ENDING_SOON_DAYS = 7
OfferStatus = Literal["active", "ending_soon", "expired"]


class _OfferFields(BaseModel):
    user_card_id: int | None = None
    merchant: str = Field(min_length=1, max_length=200)
    kind: OfferKind
    value: float | None = Field(default=None, ge=0)
    max_back: float | None = Field(default=None, ge=0)
    min_spend: float | None = Field(default=None, ge=0)
    code: str | None = Field(default=None, max_length=100)
    expires_at: date | None = None
    category: Category | None = None
    notes: str | None = Field(default=None, max_length=500)
    source: OfferSource = OfferSource.typed
    remind_days: Literal[0, 3, 5, 7] = 0

    @model_validator(mode="after")
    def _value_matches_kind(self):
        if self.kind == OfferKind.percent_back and not (self.value and 0 < self.value <= 100):
            raise ValueError("percent_back needs a value between 0 and 100")
        if self.kind in (OfferKind.amount_off, OfferKind.points) and not self.value:
            raise ValueError(f"{self.kind.value} needs a value above 0")
        if self.kind == OfferKind.code and not (self.code and self.code.strip()):
            raise ValueError("a code offer needs the code")
        return self


class OfferCreate(_OfferFields):
    model_config = ConfigDict(extra="forbid")


class OfferUpdate(BaseModel):
    """Any subset of fields; the merged result is validated as a whole."""

    model_config = ConfigDict(extra="forbid")

    user_card_id: int | None = None
    merchant: str | None = None
    kind: OfferKind | None = None
    value: float | None = None
    max_back: float | None = None
    min_spend: float | None = None
    code: str | None = None
    expires_at: date | None = None
    category: Category | None = None
    notes: str | None = None
    source: OfferSource | None = None
    remind_days: int | None = None


class OfferCard(BaseModel):
    user_card_id: int
    card_id: int
    name: str
    nickname: str | None
    last4: str | None


class OfferOut(BaseModel):
    id: int
    user_card_id: int | None
    card: OfferCard | None
    merchant: str
    kind: OfferKind
    value: float | None
    max_back: float | None
    min_spend: float | None
    code: str | None
    expires_at: date | None
    category: Category | None
    notes: str | None
    source: OfferSource
    remind_days: int
    reminded_at: datetime | None
    created_at: datetime
    status: OfferStatus
    days_left: int | None


class FieldGuess[T](BaseModel):
    value: T | None
    confidence: float = Field(ge=0, le=1)


class OfferDraft(BaseModel):
    """What the photo reader saw. Nothing is saved; the user confirms in the UI."""

    is_offer: bool
    merchant: FieldGuess[str]
    kind: FieldGuess[OfferKind]
    value: FieldGuess[float]
    max_back: FieldGuess[float]
    min_spend: FieldGuess[float]
    expires_at: FieldGuess[date]
    code: FieldGuess[str]
    category: FieldGuess[Category]
    notes: FieldGuess[str]


class PushTokenIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(pattern=r"^Expo(nent)?PushToken\[[A-Za-z0-9_-]{1,190}\]$", max_length=200)
    platform: Literal["ios", "android", "web"] | None = None
