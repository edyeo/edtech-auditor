from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from api.models.question import AnswerCheckResponse

MarkSource = Literal["manual", "auto"]
Confidence = Literal["low", "medium", "high"]

MAX_MARK_COUNT = 5
"""Most markers one question can carry; also the CHECK on question_marks.mark_count."""


class MarkOut(BaseModel):
    marked_at: datetime
    source: MarkSource
    """How the question first got marked; later markers (either kind) keep it."""
    count: int = Field(ge=1, le=MAX_MARK_COUNT)
    """Markers on the question: +1 per wrong answer, adjustable by hand."""


class SetMarkRequest(BaseModel):
    count: int = Field(ge=1, le=MAX_MARK_COUNT)


MAX_VOCABULARY_TERMS = 500
MAX_TERM_LENGTH = 100
MAX_MEMO_LENGTH = 20000
MAX_SECTION_LENGTH = 30
MAX_IMAGES_PER_TERM = 3
MAX_IMAGE_BYTES = 400_000
MAX_IMAGE_BYTES_PER_LEARNER = 20_000_000
IMAGE_TYPES = ("image/png", "image/jpeg", "image/webp")


def term_key(term: str) -> str:
    """The identity of a term: case and runs of spaces do not matter."""
    return term.lower()


class VocabularyImageOut(BaseModel):
    id: str
    content_type: str
    size: int


class VocabularyTermOut(BaseModel):
    term: str
    memo: str
    """The note, written in Markdown."""
    studied: bool
    active: bool
    """Switched off words are kept but not highlighted; saving the word again switches it on."""
    source_question_id: str | None
    """The question the term was first selected in."""
    section: str | None
    """Subject the note belongs to (감리, 사업관리, 보안 ...), set when it was saved; None for older notes."""
    images: list[VocabularyImageOut]
    created_at: datetime
    updated_at: datetime


class _TermRequest(BaseModel):
    term: str

    @field_validator("term")
    @classmethod
    def _normalize(cls, value: str) -> str:
        value = " ".join(value.split())
        if not 1 <= len(value) <= MAX_TERM_LENGTH:
            raise ValueError(f"term must be 1-{MAX_TERM_LENGTH} characters")
        return value


class AddVocabularyRequest(_TermRequest):
    source_question_id: str | None = Field(default=None, max_length=50)
    section: str | None = Field(default=None, max_length=MAX_SECTION_LENGTH)


class UpdateVocabularyRequest(_TermRequest):
    memo: str | None = Field(default=None, max_length=MAX_MEMO_LENGTH)
    studied: bool | None = None
    active: bool | None = None
    section: str | None = Field(default=None, max_length=MAX_SECTION_LENGTH)
    """Change the section; an empty string clears it."""


class StatsOut(BaseModel):
    attempts: int
    wrong: int
    streak: int
    last_wrong_at: datetime | None = None


class OxStatsOut(BaseModel):
    attempts: int
    wrong: int
    last_attempt_at: datetime


class ReviewState(BaseModel):
    """Leitner box state, computed client-side (see computeNextReview) and stored as-is."""

    box_level: int = Field(ge=0, le=5)
    due_at: date
    last_confidence: Confidence
    last_correct: bool
    attempts: int = Field(ge=0)
    overconfident_miss: bool


class MiniTestItem(BaseModel):
    question_id: str
    selected_index: int = Field(ge=0, le=3)
    correct_indexes: list[int]
    is_correct: bool


class MiniTestRecord(BaseModel):
    id: str
    taken_at: datetime
    scope_label: str
    items: list[MiniTestItem]


class LearnerState(BaseModel):
    auto_mark_streak: int
    """Wrong streak from which the UI flags a question; marking itself happens on every wrong answer."""
    max_mark_count: int
    marks: dict[str, MarkOut]
    stats: dict[str, StatsOut]
    review: dict[str, ReviewState]
    ox_stats: dict[str, OxStatsOut]
    """O/X answer counts per statement, keyed "question_id#statement_index" (the key the O/X page uses)."""
    ox_marks: dict[str, MarkOut]
    """Markers on single O/X statements, same key as `ox_stats`; separate from the question's `marks`."""
    vocabulary: dict[str, VocabularyTermOut]
    """Saved words keyed by their lower-cased term."""
    choice_marks: dict[str, MarkOut]
    """Markers on single answer choices, keyed "question_id#choice_index"; separate from `marks` and `ox_marks`."""


class MarkRemovedResponse(BaseModel):
    stats: StatsOut | None = None
    """Stats after the wrong-answer streak was reset (None if the question was never attempted)."""


class AttemptRequest(BaseModel):
    question_id: str
    selected_index: int = Field(ge=0, le=3)


class AttemptResponse(BaseModel):
    check: AnswerCheckResponse
    stats: StatsOut
    mark: MarkOut | None = None
    auto_marked: bool = False


class MiniTestSubmitRequest(BaseModel):
    scope_label: str = Field(min_length=1, max_length=200)
    answers: list[AttemptRequest] = Field(min_length=1, max_length=100)


class MiniTestSubmitResponse(BaseModel):
    record: MiniTestRecord
    auto_marked_ids: list[str]
    stats: dict[str, StatsOut]
    marks: dict[str, MarkOut]


class ImportedMark(BaseModel):
    marked_at: datetime
    source: MarkSource = "manual"


class ImportedStats(BaseModel):
    attempts: int = Field(ge=0)
    wrong: int = Field(ge=0)
    streak: int = Field(default=0, ge=0)
    last_wrong_at: datetime | None = None


class ImportedMiniTest(BaseModel):
    id: str
    taken_at: datetime
    scope_label: str = Field(min_length=1, max_length=200)
    items: list[MiniTestItem] = Field(max_length=100)


class LocalImportRequest(BaseModel):
    """Pre-Postgres browser data (localStorage), uploaded once so nothing is lost."""

    marks: dict[str, ImportedMark] = Field(default_factory=dict, max_length=1000)
    stats: dict[str, ImportedStats] = Field(default_factory=dict, max_length=1000)
    review: dict[str, ReviewState] = Field(default_factory=dict, max_length=1000)
    mini_tests: list[ImportedMiniTest] = Field(default_factory=list, max_length=100)


class LocalImportResponse(BaseModel):
    imported: bool
