from datetime import UTC, datetime

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.tables import question_explanations


class ExplanationRepository:
    """Stored LLM explanations. The service decides transaction boundaries."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, question_id: str, content_hash: str) -> str | None:
        return await self._session.scalar(
            select(question_explanations.c.explanation).where(
                question_explanations.c.question_id == question_id,
                question_explanations.c.content_hash == content_hash,
            )
        )

    async def lock(self, question_id: str, content_hash: str) -> None:
        """Serialize generators of one explanation (held until the transaction ends)."""
        await self._session.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
            {"key": f"explanation:{question_id}:{content_hash}"},
        )

    async def add(self, question_id: str, content_hash: str, explanation: str, provider: str) -> None:
        await self._session.execute(
            insert(question_explanations)
            .values(
                question_id=question_id,
                content_hash=content_hash,
                explanation=explanation,
                provider=provider,
                created_at=datetime.now(UTC),
            )
            .on_conflict_do_nothing(
                index_elements=[question_explanations.c.question_id, question_explanations.c.content_hash]
            )
        )
