from typing import Literal

from pydantic import BaseModel, Field

OxAnswer = Literal["O", "X"]


class OxAuthoredStatement(BaseModel):
    """A hand-written statement whose truth is fixed from the exam's answer key."""

    statement: str
    is_true: bool
    choice_index: int | None = None
    """The answer choice this statement restates, if it maps one-to-one onto a choice."""


class OxStatementPublic(BaseModel):
    """One O/X item as shown to the learner; the verdict stays on the server."""

    question_id: str
    statement_index: int
    statement: str
    choice_index: int | None
    """Choice to highlight in the full question; `None` when the statement covers a 가/나/다 item or a blank."""


class OxCheckRequest(BaseModel):
    question_id: str
    statement_index: int = Field(ge=0)
    answer: OxAnswer


class OxCheckResponse(BaseModel):
    question_id: str
    statement_index: int
    is_true: bool
    """Whether the statement is true (O) given the current answer key."""
    is_correct: bool
    """Whether the learner's O/X answer matches `is_true`."""
