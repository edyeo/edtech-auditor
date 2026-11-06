"""Load api/data/question_explanations.json into the question_explanations table.

    python -m api.scripts.sync_explanations            # dry run: only counts
    python -m api.scripts.sync_explanations --apply    # write

Connects with DATABASE_URL_UNPOOLED (or DATABASE_URL): a direct or session-pooler URL, never the
transaction pooler. Safe to run again: rows are upserted by (question_id, content_hash).
"""
import argparse
import asyncio
import json
from pathlib import Path

import asyncpg

from api.db.config import migration_url, split_url
from api.repositories.question_repository import QuestionRepository
from api.services.explain_service import content_hash

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "question_explanations.json"
PROVIDER = "claude-manual"

UPSERT = """
INSERT INTO question_explanations (question_id, content_hash, explanation, provider, created_at)
VALUES ($1, $2, $3, $4, now())
ON CONFLICT (question_id, content_hash)
DO UPDATE SET explanation = EXCLUDED.explanation, provider = EXCLUDED.provider, created_at = now()
"""


def load_rows(overridden: set[str]) -> tuple[list[tuple[str, str, str, str]], list[str]]:
    """(rows to write, ids skipped). A row is skipped when the question's content changed since the
    explanation was written, or an admin answer correction means /api/explain would never read it."""
    bank = {question.id: question for question in QuestionRepository().list_all()}
    rows, skipped = [], []
    for question_id, entry in json.loads(DATA_PATH.read_text(encoding="utf-8")).items():
        question = bank.get(question_id)
        if question is None or question_id in overridden or content_hash(question) != entry["content_hash"]:
            skipped.append(question_id)
            continue
        rows.append((question_id, entry["content_hash"], entry["explanation"], PROVIDER))
    return rows, skipped


async def main(apply: bool) -> None:
    url = migration_url()
    if not url:
        raise SystemExit("DATABASE_URL_UNPOOLED (or DATABASE_URL) is not set")
    plain, ssl_mode = split_url(url)
    conn = await asyncpg.connect(plain, ssl=ssl_mode)
    try:
        overridden = {row["question_id"] for row in await conn.fetch("SELECT question_id FROM answer_overrides")}
        existing = {
            (row["question_id"], row["content_hash"])
            for row in await conn.fetch("SELECT question_id, content_hash FROM question_explanations")
        }
        rows, skipped = load_rows(overridden)
        updates = sum((question_id, digest) in existing for question_id, digest, *_ in rows)
        print(f"explanations in file: {len(rows) + len(skipped)} | skipped: {len(skipped)} {skipped[:10]}")
        print(f"would insert {len(rows) - updates}, update {updates}")
        if not apply:
            print("dry run: nothing written (use --apply)")
            return
        async with conn.transaction():
            await conn.executemany(UPSERT, rows)
        total = await conn.fetchval("SELECT count(*) FROM question_explanations WHERE provider = $1", PROVIDER)
        print(f"applied {len(rows)} rows; rows with provider={PROVIDER} in the database: {total}")
    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--apply", action="store_true")
    asyncio.run(main(parser.parse_args().apply))
