from sqlalchemy.ext.asyncio import AsyncSession

from api.errors import InvalidAnswerError, QuestionNotFoundError
from api.models.ox import OxAnswer, OxCheckResponse, OxStatementPublic
from api.repositories.ox_question_repository import OxQuestionRepository
from api.repositories.question_repository import QuestionRepository
from api.services.question_service import QuestionService


class OxService:
    """Judges statements drawn from the question bank as true/false (O/X)."""

    def __init__(
        self,
        repository: OxQuestionRepository | None = None,
        questions: QuestionService | None = None,
        bank: QuestionRepository | None = None,
    ) -> None:
        self._repository = repository or OxQuestionRepository()
        self._questions = questions or QuestionService()
        self._bank = bank or QuestionRepository()

    def list_statements(self) -> list[OxStatementPublic]:
        statements: list[OxStatementPublic] = []
        for question_id in self._repository.list_ids():
            entry = self._repository.entry(question_id)
            if isinstance(entry, str):
                question = self._bank.get_by_id(question_id)
                assert question is not None, question_id
                statements += [
                    OxStatementPublic(
                        question_id=question_id, statement_index=index, statement=choice, choice_index=index
                    )
                    for index, choice in enumerate(question.choices)
                ]
            elif entry is not None:
                statements += [
                    OxStatementPublic(
                        question_id=question_id,
                        statement_index=index,
                        statement=item.statement,
                        choice_index=item.choice_index,
                    )
                    for index, item in enumerate(entry)
                ]
        return statements

    async def check(
        self, session: AsyncSession | None, *, question_id: str, statement_index: int, answer: OxAnswer
    ) -> OxCheckResponse:
        entry = self._repository.entry(question_id)
        if entry is None:
            raise QuestionNotFoundError(question_id)

        if isinstance(entry, str):
            is_true = await self._derived_verdict(session, question_id, entry, statement_index)
        else:
            if statement_index >= len(entry):
                raise InvalidAnswerError()
            is_true = entry[statement_index].is_true

        return OxCheckResponse(
            question_id=question_id,
            statement_index=statement_index,
            is_true=is_true,
            is_correct=(answer == "O") == is_true,
        )

    async def _derived_verdict(
        self, session: AsyncSession | None, question_id: str, polarity: str, choice_index: int
    ) -> bool:
        question = (await self._questions.resolve(session, [question_id]))[question_id]
        if choice_index >= len(question.choices):
            raise InvalidAnswerError()

        # Uses the resolved key, so an admin answer correction changes the verdict too.
        is_answer_choice = choice_index in {question.answer_index, *question.also_correct}
        return is_answer_choice if polarity == "positive" else not is_answer_choice
