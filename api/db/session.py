from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from api.db.config import database_url, split_url
from api.errors import DatabaseNotConfiguredError


@lru_cache
def _sessionmaker() -> async_sessionmaker[AsyncSession]:
    url = database_url()
    if not url:
        raise DatabaseNotConfiguredError()
    plain, ssl_mode = split_url(url)
    connect_args: dict = {
        # Serverless + pgbouncer-style poolers (Neon, Supabase): prepared statements don't survive
        # transaction pooling, so don't cache them.
        "statement_cache_size": 0,
    }
    if ssl_mode:
        connect_args["ssl"] = ssl_mode
    # NullPool: a serverless instance can be frozen between requests, so pooled connections would
    # go stale. The provider's pooler (pgbouncer) does the real pooling.
    engine = create_async_engine(
        plain.replace("postgresql://", "postgresql+asyncpg://", 1),
        poolclass=NullPool,
        connect_args=connect_args,
    )
    return async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """Request-scoped session. Services open their own transactions (`async with session.begin()`)."""
    async with _sessionmaker()() as session:
        yield session


async def get_optional_session() -> AsyncIterator[AsyncSession | None]:
    """Like `get_session`, but yields None when no database is configured (public read endpoints)."""
    if not database_url():
        yield None
        return
    async with _sessionmaker()() as session:
        yield session
