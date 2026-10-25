"""Integration tests run against a throwaway Postgres database created from the dev server.

Requires the compose `db` service (published on 127.0.0.1:5432) and POSTGRES_PASSWORD in .env.
"""
import os
import uuid
from pathlib import Path

import asyncpg
import httpx
import pytest
import pytest_asyncio

TEST_DB = "edtech_test"
ADMIN_TOKEN = "test-admin-token"


def _password() -> str:
    for line in (Path(__file__).resolve().parents[2] / ".env").read_text().splitlines():
        if line.startswith("POSTGRES_PASSWORD="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("POSTGRES_PASSWORD not found in .env")


@pytest_asyncio.fixture(scope="session", autouse=True)
async def database():
    base = f"postgresql://edtech:{_password()}@127.0.0.1:5432"
    admin = await asyncpg.connect(f"{base}/postgres")
    await admin.execute(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)")
    await admin.execute(f"CREATE DATABASE {TEST_DB}")
    os.environ["DATABASE_URL"] = f"{base}/{TEST_DB}"
    os.environ["ADMIN_TOKEN"] = ADMIN_TOKEN

    from api.db.migrate import migrate

    await migrate()
    yield
    await admin.execute(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)")
    await admin.close()


@pytest_asyncio.fixture
async def client(database):
    from api.index import app

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
def learner() -> dict[str, str]:
    """A fresh anonymous learner per test, so tests never see each other's data."""
    return {"X-Learner-Id": str(uuid.uuid4())}


@pytest.fixture
def admin() -> dict[str, str]:
    return {"X-Admin-Token": ADMIN_TOKEN}
