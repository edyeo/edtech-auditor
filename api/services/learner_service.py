from datetime import UTC, datetime
from uuid import UUID, uuid4, uuid5

from sqlalchemy.ext.asyncio import AsyncSession

from api.models.learner import (
    AttemptRequest,
    AttemptResponse,
    MAX_MARK_COUNT,
    LearnerState,
    LocalImportRequest,
    MarkOut,
    MarkRemovedResponse,
    MiniTestItem,
    MiniTestRecord,
    MiniTestSubmitRequest,
    MiniTestSubmitResponse,
    ReviewState,
    StatsOut,
)
from api.repositories.learner_repository import LearnerRepository
from api.repositories.question_repository import QuestionRepository
from api.errors import QuestionNotFoundError
from api.services.question_service import QuestionService

# Wrong answers in a row from which the UI flags a question. Marking does not wait for it: every
# wrong answer adds a marker.
AUTO_MARK_STREAK = 2


class LearnerService:
    """One learner's marks, attempt stats, review states and mini test history.

    Business rules (a marker per wrong answer, streak reset on un-mark) live here, not in SQL triggers.
    Every write is one transaction: `async with session.begin()` wraps the whole operation.
    """

    def __init__(self, session: AsyncSession, questions: QuestionService | None = None) -> None:
        self._session = session
        self._questions = questions or QuestionService()
        self._repo = LearnerRepository(session)
        self._bank = QuestionRepository()

    # ---- reads -------------------------------------------------------------------------------

    async def get_state(self, learner_id: UUID) -> LearnerState:
        return LearnerState(
            auto_mark_streak=AUTO_MARK_STREAK,
            max_mark_count=MAX_MARK_COUNT,
            marks=await self._repo.get_marks(learner_id),
            stats=await self._repo.get_stats(learner_id),
            review=await self._repo.get_review(learner_id),
        )

    async def list_mini_tests(self, learner_id: UUID) -> list[MiniTestRecord]:
        return await self._repo.list_mini_tests(learner_id)

    # ---- marks -------------------------------------------------------------------------------

    async def set_mark_count(self, learner_id: UUID, question_id: str, count: int) -> MarkOut:
        self._require_question(question_id)
        async with self._session.begin():
            return await self._repo.set_mark_count(learner_id, question_id, count)

    async def remove_mark(self, learner_id: UUID, question_id: str) -> MarkRemovedResponse:
        """Un-marking also resets the wrong streak so the question isn't re-marked at once."""
        self._require_question(question_id)
        async with self._session.begin():
            await self._repo.remove_mark(learner_id, question_id)
            stats = await self._repo.reset_streak(learner_id, question_id)
        return MarkRemovedResponse(stats=stats)

    # ---- attempts ----------------------------------------------------------------------------

    async def record_attempt(self, learner_id: UUID, attempt: AttemptRequest) -> AttemptResponse:
        async with self._session.begin():
            check = await self._questions.check_answer(
                self._session, question_id=attempt.question_id, selected_index=attempt.selected_index
            )
            stats, mark = await self._apply_attempt(learner_id, attempt.question_id, check.is_correct)
        return AttemptResponse(check=check, stats=stats, mark=mark, auto_marked=mark is not None)

    async def submit_mini_test(self, learner_id: UUID, request: MiniTestSubmitRequest) -> MiniTestSubmitResponse:
        """Grade every answer, update stats/auto-marks and store the test - all or nothing."""
        pairs = [(answer.question_id, answer.selected_index) for answer in request.answers]
        async with self._session.begin():
            checks = await self._questions.check_answers(self._session, pairs)
            stats: dict[str, StatsOut] = {}
            new_marks: dict[str, MarkOut] = {}
            for check in checks:
                stats[check.question_id], mark = await self._apply_attempt(
                    learner_id, check.question_id, check.is_correct
                )
                if mark is not None:
                    new_marks[check.question_id] = mark
            record = MiniTestRecord(
                id=str(uuid4()),
                taken_at=datetime.now(UTC),
                scope_label=request.scope_label,
                items=[
                    MiniTestItem(
                        question_id=check.question_id,
                        selected_index=check.selected_index,
                        correct_indexes=check.correct_indexes,
                        is_correct=check.is_correct,
                    )
                    for check in checks
                ],
            )
            await self._repo.insert_mini_test(learner_id, record)
            await self._repo.trim_mini_tests(learner_id)
        return MiniTestSubmitResponse(
            record=record, auto_marked_ids=list(new_marks), stats=stats, marks=new_marks
        )

    async def _apply_attempt(
        self, learner_id: UUID, question_id: str, is_correct: bool
    ) -> tuple[StatsOut, MarkOut | None]:
        stats = await self._repo.record_attempt(learner_id, question_id, is_correct)
        mark = None if is_correct else await self._repo.bump_mark(learner_id, question_id, "auto")
        return stats, mark

    # ---- review state ------------------------------------------------------------------------

    async def save_review(self, learner_id: UUID, question_id: str, state: ReviewState) -> None:
        self._require_question(question_id)
        async with self._session.begin():
            await self._repo.upsert_review(learner_id, question_id, state)

    # ---- one-time import of pre-Postgres localStorage data -----------------------------------

    async def import_local(self, learner_id: UUID, data: LocalImportRequest) -> bool:
        """Import only into an empty profile, so it can never overwrite real server data."""
        known = {q.id for q in self._bank.list_all()}
        async with self._session.begin():
            # Without the lock, concurrent imports (e.g. a double page load) all see an empty profile.
            await self._repo.lock_learner(learner_id)
            if await self._repo.has_any_data(learner_id):
                return False
            for question_id, mark in data.marks.items():
                if question_id in known:
                    await self._repo.add_mark(learner_id, question_id, mark.source, mark.marked_at)
            for question_id, stats in data.stats.items():
                if question_id in known:
                    wrong = min(stats.wrong, stats.attempts)
                    await self._repo.import_stats(
                        learner_id,
                        question_id,
                        StatsOut(
                            attempts=stats.attempts,
                            wrong=wrong,
                            streak=min(stats.streak, wrong),
                            last_wrong_at=stats.last_wrong_at,
                        ),
                    )
            for question_id, state in data.review.items():
                if question_id in known:
                    await self._repo.upsert_review(learner_id, question_id, state)
            for index, test in enumerate(data.mini_tests):
                items = [item for item in test.items if item.question_id in known]
                if items:
                    await self._repo.insert_mini_test(
                        learner_id,
                        MiniTestRecord(
                            id=str(uuid5(learner_id, f"legacy-{index}-{test.taken_at.isoformat()}")),
                            taken_at=test.taken_at,
                            scope_label=test.scope_label,
                            items=items,
                        ),
                    )
            await self._repo.trim_mini_tests(learner_id)
        return True

    def _require_question(self, question_id: str) -> None:
        if self._bank.get_by_id(question_id) is None:
            raise QuestionNotFoundError(question_id)
