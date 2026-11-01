import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

from api.models.ox import OxAuthoredStatement

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "ox_questions.json"
EXPLANATIONS_PATH = Path(__file__).resolve().parent.parent / "data" / "ox_explanations.json"

Polarity = Literal["positive", "negative"]
"""positive: the stem asks for the correct statement, so the answer choice is true.
negative: the stem asks for the incorrect statement, so the answer choice is false."""

OxEntry = Polarity | list[OxAuthoredStatement]
"""A polarity means every choice is played as it is written; a list holds hand-written statements."""


@lru_cache
def _load() -> dict[str, OxEntry]:
    raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    return {
        question_id: value if isinstance(value, str) else [OxAuthoredStatement.model_validate(item) for item in value]
        for question_id, value in raw.items()
    }


@lru_cache
def _load_explanations() -> dict[str, list[str]]:
    """Per question, one explanation per statement, in the same order as the statements."""
    return json.loads(EXPLANATIONS_PATH.read_text(encoding="utf-8"))


class OxQuestionRepository:
    """Questions of the audit (감리) part that can be played as O/X statements.

    Choices that are bare terms, numbers or letter combinations cannot be judged on their own, so those
    questions carry statements written from the stem and choices.
    """

    def list_ids(self) -> list[str]:
        return list(_load())

    def entry(self, question_id: str) -> OxEntry | None:
        return _load().get(question_id)

    def explanation(self, question_id: str, statement_index: int) -> str | None:
        explanations = _load_explanations().get(question_id, [])
        return explanations[statement_index] if 0 <= statement_index < len(explanations) else None
