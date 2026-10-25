from sqlalchemy.ext.asyncio import AsyncSession

from api.models.question import Question
from api.repositories.answer_override_repository import AnswerOverrideRepository


class AnswerResolver:
    """Overlays admin answer corrections (Postgres) on the imported questions.

    With no session (database not configured) the imported answers are used as-is, so the public
    quiz keeps working without a database.
    """

    def __init__(self, session: AsyncSession | None) -> None:
        self._session = session

    async def apply(self, questions: list[Question]) -> list[Question]:
        if self._session is None or not questions:
            return questions
        overrides = await AnswerOverrideRepository(self._session).get_many(q.id for q in questions)
        return [
            q.model_copy(update={"answer_index": overrides[q.id][0], "also_correct": overrides[q.id][1]})
            if q.id in overrides
            else q
            for q in questions
        ]
