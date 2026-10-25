from collections.abc import Iterable
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.tables import answer_overrides


class AnswerOverrideRepository:
    """Admin corrections to the imported answer key. The imported JSON stays pristine."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_many(self, question_ids: Iterable[str]) -> dict[str, tuple[int, list[int]]]:
        ids = list(question_ids)
        if not ids:
            return {}
        rows = await self._session.execute(
            select(answer_overrides.c.question_id, answer_overrides.c.answer_index, answer_overrides.c.also_correct)
            .where(answer_overrides.c.question_id.in_(ids))
        )
        return {r.question_id: (r.answer_index, list(r.also_correct)) for r in rows}

    async def list_all(self) -> dict[str, tuple[int, list[int]]]:
        rows = await self._session.execute(
            select(answer_overrides.c.question_id, answer_overrides.c.answer_index, answer_overrides.c.also_correct)
        )
        return {r.question_id: (r.answer_index, list(r.also_correct)) for r in rows}

    async def upsert(self, question_id: str, answer_index: int, also_correct: list[int]) -> None:
        values = {
            "question_id": question_id,
            "answer_index": answer_index,
            "also_correct": also_correct,
            "updated_at": datetime.now(UTC),
        }
        await self._session.execute(
            insert(answer_overrides)
            .values(**values)
            .on_conflict_do_update(
                index_elements=[answer_overrides.c.question_id],
                set_={k: v for k, v in values.items() if k != "question_id"},
            )
        )

    async def delete(self, question_id: str) -> None:
        await self._session.execute(delete(answer_overrides).where(answer_overrides.c.question_id == question_id))
