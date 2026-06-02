from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
import sqlalchemy as sa
from alembic import context
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.db import Base
from app import models

config = context.config

database_url = os.getenv("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

INITIAL_REVISION = "0001_init"
INITIAL_TABLES = {
    "users",
    "transcripts",
    "speaker_labels",
    "transcript_lines",
    "vocabulary_entries",
    "exclude_entries",
    "audit_log",
}


def stamp_existing_initial_sqlite_schema(connection) -> None:
    url = config.get_main_option("sqlalchemy.url")
    if not url.startswith("sqlite"):
        return
    tables = set(sa.inspect(connection).get_table_names())
    if not INITIAL_TABLES.issubset(tables):
        return
    if "alembic_version" not in tables:
        connection.execute(sa.text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
    existing_revision = connection.execute(sa.text("SELECT version_num FROM alembic_version LIMIT 1")).scalar()
    if not existing_revision:
        connection.execute(sa.text("INSERT INTO alembic_version (version_num) VALUES (:revision)"), {"revision": INITIAL_REVISION})


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            stamp_existing_initial_sqlite_schema(connection)
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
