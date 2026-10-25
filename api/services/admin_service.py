import os
import secrets

from sqlalchemy.ext.asyncio import AsyncSession

from api.errors import AdminAuthError, AdminDisabledError, InvalidAnswerError, QuestionNotFoundError
from api.models.question import AdminQuestion
from api.repositories.answer_override_repository import AnswerOverrideRepository
from api.repositories.question_repository import QuestionRepository


class AdminService:
    def __init__(self, session: AsyncSession, repository: QuestionRepository | None = None) -> None:
        self._session = session
        self._repository = repository or QuestionRepository()
        self._overrides = AnswerOverrideRepository(session)

    @staticmethod
    def verify_token(token: str | None) -> None:
        expected = os.environ.get("ADMIN_TOKEN")
        if not expected:
            raise AdminDisabledError()
        if token is None or not secrets.compare_digest(token.encode(), expected.encode()):
            raise AdminAuthError()

    async def list_questions(self) -> list[AdminQuestion]:
        overrides = await self._overrides.list_all()
        return [self._merge(question, overrides) for question in self._repository.list_all()]

    async def update_answer(self, question_id: str, answer_indexes: list[int]) -> AdminQuestion:
        question = self._repository.get_by_id(question_id)
        if question is None:
            raise QuestionNotFoundError(question_id)
        unique = sorted(set(answer_indexes))
        if len(unique) != len(answer_indexes) or any(not 0 <= i < len(question.choices) for i in unique):
            raise InvalidAnswerError(question_id)
        async with self._session.begin():
            await self._overrides.upsert(question_id, unique[0], unique[1:])
        return await self._get(question_id)

    async def reset_answer(self, question_id: str) -> AdminQuestion:
        if self._repository.get_by_id(question_id) is None:
            raise QuestionNotFoundError(question_id)
        async with self._session.begin():
            await self._overrides.delete(question_id)
        return await self._get(question_id)

    async def _get(self, question_id: str) -> AdminQuestion:
        question = self._repository.get_by_id(question_id)
        assert question is not None
        overrides = await self._overrides.get_many([question_id])
        return self._merge(question, overrides)

    @staticmethod
    def _merge(question, overrides: dict[str, tuple[int, list[int]]]) -> AdminQuestion:
        data = question.model_dump()
        override = overrides.get(question.id)
        if override:
            data["answer_index"], data["also_correct"] = override
        return AdminQuestion(**data, answer_overridden=override is not None)
