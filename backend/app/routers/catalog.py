from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.db.models import Card
from app.db.session import get_db
from app.schemas import CardDetail, CatalogPage

router = APIRouter(prefix="/catalog", tags=["catalog"])

Db = Annotated[Session, Depends(get_db)]

# TCCP "Rewards" values are free text like "Cashback rewards; Travel-related rewards".
REWARD_MATCH = {"cashback": "%cashback%", "travel": "%travel%"}
# TCCP "Targeted Credit Tiers" wording for the top tier.
TIER_MATCH = {"excellent": "%720 or greater%"}


def _like(term: str) -> str:
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


@router.get("/cards", response_model=CatalogPage)
def list_catalog_cards(
    db: Db,
    q: str | None = None,
    no_annual_fee: bool = False,
    no_fx_fee: bool = False,
    rewards: Literal["cashback", "travel"] | None = None,
    credit_tier: Literal["excellent"] | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CatalogPage:
    where = []
    for word in (q or "").split():
        pattern = _like(word)
        where.append(
            or_(Card.name.ilike(pattern, escape="\\"), Card.issuer.ilike(pattern, escape="\\"))
        )
    if no_annual_fee:
        where.append(Card.annual_fee == 0)
    if no_fx_fee:
        where.append(Card.fx_fee == 0)
    if rewards:
        where.append(Card.rewards_types.ilike(REWARD_MATCH[rewards]))
    if credit_tier:
        where.append(Card.credit_tiers.ilike(TIER_MATCH[credit_tier]))

    cond = and_(*where) if where else None
    base = select(Card) if cond is None else select(Card).where(cond)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    items = db.scalars(base.order_by(Card.name, Card.issuer).limit(limit).offset(offset)).all()
    return CatalogPage(items=items, total=total)  # type: ignore[arg-type]


@router.get("/cards/{card_id}", response_model=CardDetail)
def get_catalog_card(card_id: int, db: Db) -> Card:
    card = db.get(Card, card_id)
    if card is None:
        raise HTTPException(404, "Card not found")
    return card
