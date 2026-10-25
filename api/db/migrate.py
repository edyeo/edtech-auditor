"""Apply api/db/migrations/*.sql in order.

    python -m api.db.migrate

Run it once per deploy (docker compose runs it before the API starts; on Vercel run it from CI or
your machine with the production DATABASE_URL). Applied versions are recorded in
`schema_migrations`; an advisory lock keeps concurrent runs from racing.
"""
import asyncio
from pathlib import Path

import asyncpg

from api.db.config import migration_url, split_url

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"
_LOCK_KEY = 7_426_001  # arbitrary app-wide constant for pg_advisory_lock


async def migrate() -> list[str]:
    url = migration_url()
    if not url:
        raise SystemExit("DATABASE_URL (or POSTGRES_URL) is not set")
    plain, ssl_mode = split_url(url)
    conn = await asyncpg.connect(plain, ssl=ssl_mode)
    applied_now: list[str] = []
    try:
        await conn.execute("SELECT pg_advisory_lock($1)", _LOCK_KEY)
        await conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations ("
            "version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
        )
        done = {row["version"] for row in await conn.fetch("SELECT version FROM schema_migrations")}
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if path.stem in done:
                continue
            async with conn.transaction():
                await conn.execute(path.read_text(encoding="utf-8"))
                await conn.execute("INSERT INTO schema_migrations (version) VALUES ($1)", path.stem)
            applied_now.append(path.stem)
    finally:
        await conn.execute("SELECT pg_advisory_unlock($1)", _LOCK_KEY)
        await conn.close()
    return applied_now


if __name__ == "__main__":
    applied = asyncio.run(migrate())
    print(f"applied: {', '.join(applied)}" if applied else "schema is up to date")
