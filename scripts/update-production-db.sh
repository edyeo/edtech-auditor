#!/bin/bash
# Bring a hosted database (Supabase) up to date: 1) migrations, 2) check the tables the app needs,
# 3) the bundled question explanations (dry run first, written only after you confirm).
#
#   bash scripts/update-production-db.sh
#
# Asks for a session-pooler (port 5432) or direct connection URL unless DATABASE_URL_UNPOOLED is set.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL_UNPOOLED:-}" ]; then
  read -rsp "Supabase session-pooler (port 5432) or direct URL: " DATABASE_URL_UNPOOLED
  echo
fi
export DATABASE_URL_UNPOOLED

PORT=$(python3 -c 'import os;from urllib.parse import urlparse;print(urlparse(os.environ["DATABASE_URL_UNPOOLED"]).port or "")')
if [ "$PORT" = "6543" ]; then
  echo "This is the transaction pooler (6543). Use the session pooler (5432) or the direct connection." >&2
  exit 1
fi

PY=.venv/bin/python
echo "== 1. migrations =="
PYTHONPATH=. $PY -m api.db.migrate

echo "== 2. verify =="
PYTHONPATH=. $PY - <<'PY'
import asyncio, asyncpg
from api.db.config import migration_url, split_url

async def main():
    plain, ssl_mode = split_url(migration_url())
    conn = await asyncpg.connect(plain, ssl=ssl_mode)
    try:
        has_marks = await conn.fetchval(
            "SELECT count(*) FROM information_schema.columns "
            "WHERE table_name='question_marks' AND column_name='mark_count'")
        has_ox = await conn.fetchval(
            "SELECT count(*) FROM information_schema.tables WHERE table_name='ox_statement_stats'")
        versions = [r["version"] for r in await conn.fetch("SELECT version FROM schema_migrations ORDER BY version")]
        print("question_marks.mark_count:", "present" if has_marks else "MISSING")
        print("ox_statement_stats table :", "present" if has_ox else "MISSING")
        print("schema_migrations:", ", ".join(versions))
        if not (has_marks and has_ox):
            raise SystemExit("a table or column is still missing - this URL may point at another database than the app uses")
    finally:
        await conn.close()

asyncio.run(main())
PY

echo "== 3. explanations (dry run) =="
PYTHONPATH=. $PY -m api.scripts.sync_explanations
read -rp "Write the explanations to this database? (y/N) " answer
if [ "$answer" = "y" ]; then
  PYTHONPATH=. $PY -m api.scripts.sync_explanations --apply
else
  echo "Explanations were not written."
fi
