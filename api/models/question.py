from pydantic import BaseModel, Field


class Question(BaseModel):
    """Full question record, including the answer — never sent to the client as-is."""

    id: str
    year: int
    round: int
    number: int
    subject: str = "감리"
    stem: str = ""
    choices: list[str]
    answer_index: int = Field(ge=0)
    also_correct: list[int] = Field(default_factory=list)
    """Extra accepted choices for questions the exam board ruled as multiple-answer (복수정답)."""
    image_url: str | None = None
    """Cropped page image for questions whose figures/tables can't be expressed as text."""
    source: str | None = None
    """Where this item came from (e.g. the official exam PDF URL). No answer leak — safe to expose."""


class QuestionPublic(BaseModel):
    """Question payload sent to the client. Omits answer_index so the correct
    choice can't be read off the network response."""

    id: str
    year: int
    round: int
    number: int
    subject: str
    stem: str = ""
    choices: list[str]
    image_url: str | None = None
    source: str | None = None


class AnswerCheckRequest(BaseModel):
    question_id: str
    selected_index: int = Field(ge=0)


class AnswerCheckResponse(BaseModel):
    question_id: str
    selected_index: int
    correct_index: int
    correct_indexes: list[int]
    is_correct: bool


class AdminQuestion(Question):
    """Full question record for the admin screen, flagged when its answer was edited by hand."""

    answer_overridden: bool = False


class AnswerUpdateRequest(BaseModel):
    answer_indexes: list[int] = Field(min_length=1, max_length=4)
    """Correct choices (0-based). Several entries mean a multiple-answer (복수정답) question."""
