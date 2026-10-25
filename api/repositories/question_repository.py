import json
from functools import lru_cache
from pathlib import Path

from api.models.question import Question

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "questions.json"


@lru_cache
def _load_questions() -> tuple[Question, ...]:
    raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    return tuple(Question.model_validate(item) for item in raw)


class QuestionRepository:
    """Reads the imported question bank from the bundled JSON file (read-only).

    Admin answer corrections live in Postgres and are merged on top by `AnswerResolver`.
    """

    def list_all(self) -> list[Question]:
        return list(_load_questions())

    def get_by_id(self, question_id: str) -> Question | None:
        return next((q for q in _load_questions() if q.id == question_id), None)
