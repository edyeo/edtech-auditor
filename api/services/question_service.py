from sqlalchemy.ext.asyncio import AsyncSession

from api.errors import QuestionNotFoundError
from api.models.question import AnswerCheckResponse, Question, QuestionPublic
from api.repositories.question_repository import QuestionRepository
from api.services.answer_resolver import AnswerResolver


class QuestionService:
    def __init__(self, repository: QuestionRepository | None = None) -> None:
        self._repository = repository or QuestionRepository()

    def list_questions(self) -> list[QuestionPublic]:
        return [
            QuestionPublic(**question.model_dump(exclude={"answer_index", "also_correct"}))
            for question in self._repository.list_all()
        ]

    async def resolve(self, session: AsyncSession | None, question_ids: list[str]) -> dict[str, Question]:
        """Questions with admin corrections applied; unknown ids fail the whole call."""
        questions = []
        for question_id in dict.fromkeys(question_ids):
            question = self._repository.get_by_id(question_id)
            if question is None:
                raise QuestionNotFoundError(question_id)
            questions.append(question)
        return {q.id: q for q in await AnswerResolver(session).apply(questions)}

    async def check_answers(
        self, session: AsyncSession | None, answers: list[tuple[str, int]]
    ) -> list[AnswerCheckResponse]:
        resolved = await self.resolve(session, [question_id for question_id, _ in answers])
        results = []
        for question_id, selected_index in answers:
            question = resolved[question_id]
            correct_indexes = [question.answer_index, *question.also_correct]
            results.append(
                AnswerCheckResponse(
                    question_id=question.id,
                    selected_index=selected_index,
                    correct_index=question.answer_index,
                    correct_indexes=correct_indexes,
                    is_correct=selected_index in correct_indexes,
                )
            )
        return results

    async def check_answer(
        self, session: AsyncSession | None, *, question_id: str, selected_index: int
    ) -> AnswerCheckResponse:
        return (await self.check_answers(session, [(question_id, selected_index)]))[0]
