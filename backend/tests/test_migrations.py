from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect

from app.db.models import Base

BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture
def alembic_cfg(tmp_path):
    url = f"sqlite:///{tmp_path / 'test.db'}"
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    return cfg, url


def test_upgrade_creates_all_tables_and_downgrade_removes_them(alembic_cfg):
    cfg, url = alembic_cfg
    command.upgrade(cfg, "head")
    engine = create_engine(url)
    assert set(Base.metadata.tables) <= set(inspect(engine).get_table_names())

    command.downgrade(cfg, "base")
    assert inspect(engine).get_table_names() == ["alembic_version"]


def test_models_match_migrations(alembic_cfg):
    cfg, url = alembic_cfg
    command.upgrade(cfg, "head")
    with create_engine(url).connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    assert diff == [], f"Models changed without a migration: {diff}"
