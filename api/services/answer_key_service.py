from sqlalchemy.ext.asyncio import AsyncSession

from api.models.question import AnswerKeyResponse
from api.repositories.question_repository import QuestionRepository
from api.services.ox_service import OxService
from api.services.question_service import QuestionService


class AnswerKeyService:
    """Every correct answer and O/X verdict in one payload, so the browser can grade without asking each time."""

    def __init__(self) -> None:
        self._bank = QuestionRepository()
        self._questions = QuestionService(self._bank)
        self._ox = OxService(questions=self._questions)

    async def build(self, session: AsyncSession | None) -> AnswerKeyResponse:
        resolved = await self._questions.resolve(session, [q.id for q in self._bank.list_all()])
        return AnswerKeyResponse(
            questions={q.id: [q.answer_index, *q.also_correct] for q in resolved.values()},
            ox=await self._ox.all_verdicts(session),
        )
