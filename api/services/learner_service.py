from datetime import UTC, datetime
from uuid import UUID, uuid4, uuid5

from sqlalchemy.ext.asyncio import AsyncSession

from api.models.learner import (
    AttemptRequest,
    AttemptResponse,
    MAX_MARK_COUNT,
    LearnerState,
    IMAGE_TYPES,
    LocalImportRequest,
    MAX_IMAGE_BYTES,
    MAX_IMAGE_BYTES_PER_LEARNER,
    MAX_IMAGES_PER_TERM,
    MAX_VOCABULARY_TERMS,
    MarkOut,
    MarkRemovedResponse,
    MiniTestItem,
    MiniTestRecord,
    MiniTestSubmitRequest,
    MiniTestSubmitResponse,
    ReviewState,
    StatsOut,
    VocabularyImageOut,
    VocabularyTermOut,
    term_key,
)
from api.repositories.learner_repository import LearnerRepository
from api.repositories.ox_question_repository import OxQuestionRepository
from api.repositories.question_repository import QuestionRepository
from api.errors import (
    InvalidAnswerError,
    QuestionNotFoundError,
    VocabularyFullError,
    VocabularyImageInvalidError,
    VocabularyImageLimitError,
    VocabularyImageNotFoundError,
    VocabularyImageTooLargeError,
    VocabularyTermNotFoundError,
)
from api.services.question_service import QuestionService

# Wrong answers in a row from which the UI flags a question. Marking does not wait for it: every
# wrong answer adds a marker.
AUTO_MARK_STREAK = 2


def _looks_like(content_type: str, data: bytes) -> bool:
    """The bytes must start like the claimed picture format, so a file cannot pass as an image by its header alone."""
    if content_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    return data[:4] == b"RIFF" and data[8:12] == b"WEBP"


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
        self._ox = OxQuestionRepository()

    # ---- reads -------------------------------------------------------------------------------

    async def get_state(self, learner_id: UUID) -> LearnerState:
        return LearnerState(
            auto_mark_streak=AUTO_MARK_STREAK,
            max_mark_count=MAX_MARK_COUNT,
            marks=await self._repo.get_marks(learner_id),
            stats=await self._repo.get_stats(learner_id),
            review=await self._repo.get_review(learner_id),
            ox_stats=await self._repo.get_ox_stats(learner_id),
            ox_marks=await self._repo.get_ox_marks(learner_id),
            vocabulary=await self._repo.get_vocabulary(learner_id),
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

    async def set_ox_mark_count(
        self, learner_id: UUID, question_id: str, statement_index: int, count: int
    ) -> MarkOut:
        self._require_statement(question_id, statement_index)
        async with self._session.begin():
            return await self._repo.set_ox_mark_count(learner_id, question_id, statement_index, count)

    async def remove_ox_mark(self, learner_id: UUID, question_id: str, statement_index: int) -> None:
        self._require_statement(question_id, statement_index)
        async with self._session.begin():
            await self._repo.remove_ox_mark(learner_id, question_id, statement_index)

    # ---- vocabulary --------------------------------------------------------------------------

    async def add_term(
        self, learner_id: UUID, term: str, source_question_id: str | None, section: str | None = None
    ) -> VocabularyTermOut:
        """Save a word; saving one that is already there changes nothing."""
        if source_question_id is not None and self._bank.get_by_id(source_question_id) is None:
            source_question_id = None  # a stale or unknown source must not block saving the word
        async with self._session.begin():
            # Without the lock, concurrent saves could each see room for one more word.
            await self._repo.lock_learner(learner_id)
            existing = await self._repo.get_vocabulary(learner_id)
            if term_key(term) not in existing and len(existing) >= MAX_VOCABULARY_TERMS:
                raise VocabularyFullError()
            return await self._repo.add_term(learner_id, term, source_question_id, section or None)

    async def update_term(
        self, learner_id: UUID, term: str, memo: str | None, studied: bool | None, section: str | None = None
    ) -> VocabularyTermOut:
        async with self._session.begin():
            updated = await self._repo.update_term(learner_id, term, memo, studied, section)
        if updated is None:
            raise VocabularyTermNotFoundError()
        return updated

    async def remove_term(self, learner_id: UUID, term: str) -> None:
        async with self._session.begin():
            await self._repo.remove_term(learner_id, term)

    async def add_image(self, learner_id: UUID, term: str, content_type: str, data: bytes) -> VocabularyImageOut:
        """Attach a picture to a saved word, within the size, per-note and per-learner limits."""
        if content_type not in IMAGE_TYPES or not _looks_like(content_type, data):
            raise VocabularyImageInvalidError()
        if len(data) > MAX_IMAGE_BYTES:
            raise VocabularyImageTooLargeError()
        async with self._session.begin():
            # Without the lock, concurrent uploads could each pass the limit checks.
            await self._repo.lock_learner(learner_id)
            if not await self._repo.has_term(learner_id, term):
                raise VocabularyTermNotFoundError()
            on_note, total = await self._repo.count_images(learner_id, term)
            if on_note >= MAX_IMAGES_PER_TERM or total + len(data) > MAX_IMAGE_BYTES_PER_LEARNER:
                raise VocabularyImageLimitError()
            return await self._repo.add_image(learner_id, term, content_type, data)

    async def get_image(self, learner_id: UUID, image_id: UUID) -> tuple[str, bytes]:
        async with self._session.begin():
            image = await self._repo.get_image(learner_id, image_id)
        if image is None:
            raise VocabularyImageNotFoundError()
        return image

    async def remove_image(self, learner_id: UUID, image_id: UUID) -> None:
        async with self._session.begin():
            if not await self._repo.remove_image(learner_id, image_id):
                raise VocabularyImageNotFoundError()

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

    def _require_statement(self, question_id: str, statement_index: int) -> None:
        """The statement must exist in the O/X set (a bare polarity plays every choice of the question)."""
        entry = self._ox.entry(question_id)
        question = self._bank.get_by_id(question_id)
        if entry is None or question is None:
            raise QuestionNotFoundError(question_id)
        statement_count = len(question.choices) if isinstance(entry, str) else len(entry)
        if statement_index >= statement_count:
            raise InvalidAnswerError()

    def _require_question(self, question_id: str) -> None:
        if self._bank.get_by_id(question_id) is None:
            raise QuestionNotFoundError(question_id)
