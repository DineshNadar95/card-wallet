"""Per-user routes. Every query filters by `user.id` from the verified token, never the request."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import User
from app.db.models import Card, Profile, UserCard
from app.db.session import get_db
from app.schemas import Profile as ProfileOut
from app.schemas import UserCardCreate, UserCardDetail, UserCardOut

router = APIRouter(prefix="/me", tags=["me"])

Db = Annotated[Session, Depends(get_db)]


def _own_card(db: Session, user: User, user_card_id: int) -> UserCard:
    uc = db.scalar(select(UserCard).where(UserCard.id == user_card_id, UserCard.user_id == user.id))
    if uc is None:  # also for other users' cards: don't reveal that the id exists
        raise HTTPException(404, "Card not in your wallet")
    return uc


@router.get("", response_model=ProfileOut)
def get_me(user: User, db: Db) -> ProfileOut:
    profile = db.get(Profile, user.id)
    if profile is None:
        profile = Profile(user_id=user.id)
        db.add(profile)
        db.commit()
    return ProfileOut.model_validate(profile).model_copy(update={"email": user.email})


@router.get("/cards", response_model=list[UserCardOut])
def list_my_cards(user: User, db: Db) -> list[UserCard]:
    return list(
        db.scalars(
            select(UserCard).where(UserCard.user_id == user.id).order_by(UserCard.id)
        ).unique()
    )


@router.get("/cards/{user_card_id}", response_model=UserCardDetail)
def get_my_card(user_card_id: int, user: User, db: Db) -> UserCard:
    return _own_card(db, user, user_card_id)


@router.post("/cards", response_model=UserCardOut, status_code=status.HTTP_201_CREATED)
def add_my_card(body: UserCardCreate, user: User, db: Db) -> UserCard:
    if db.get(Card, body.card_id) is None:
        raise HTTPException(404, "Card not found in catalog")
    uc = UserCard(user_id=user.id, **body.model_dump())
    db.add(uc)
    db.commit()
    db.refresh(uc)
    return uc


@router.delete("/cards/{user_card_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_my_card(user_card_id: int, user: User, db: Db) -> Response:
    db.delete(_own_card(db, user, user_card_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
