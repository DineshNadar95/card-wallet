import uuid
from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import CurrentUser, get_current_user
from app.db.models import Base
from app.db.session import get_db
from app.main import app


@pytest.fixture
def db() -> Iterator[Session]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, expire_on_commit=False)() as session:
        yield session


@pytest.fixture
def client(db) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db
    yield TestClient(app)
    app.dependency_overrides.clear()


USER_A = CurrentUser(id=uuid.UUID("00000000-0000-0000-0000-00000000000a"), email="a@example.test")
USER_B = CurrentUser(id=uuid.UUID("00000000-0000-0000-0000-00000000000b"), email="b@example.test")


@pytest.fixture
def login(client) -> Callable[[CurrentUser], TestClient]:
    """Act as a user without real tokens. Token verification has its own tests."""

    def _login(user: CurrentUser) -> TestClient:
        app.dependency_overrides[get_current_user] = lambda: user
        return client

    return _login
