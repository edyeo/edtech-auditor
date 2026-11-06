import json
import re
from pathlib import Path

from api.repositories.question_repository import QuestionRepository
from api.scripts.sync_explanations import DATA_PATH, load_rows
from api.services.explain_service import content_hash

_bank = {question.id: question for question in QuestionRepository().list_all()}
_entries = json.loads(Path(DATA_PATH).read_text(encoding="utf-8"))


def test_every_explanation_was_written_for_the_current_question():
    """If a question's text or answer key changes, its explanation must be rewritten (and re-exported)."""
    assert len(_entries) >= 580
    for question_id, entry in _entries.items():
        assert question_id in _bank, question_id
        assert content_hash(_bank[question_id]) == entry["content_hash"], question_id


def test_explanations_state_the_answer_the_question_is_keyed_to():
    for question_id, entry in _entries.items():
        stated = re.match(r"정답: (\d+)", entry["explanation"])
        assert stated, question_id
        assert int(stated.group(1)) == _bank[question_id].answer_index + 1, question_id


def test_no_explanation_carries_review_notes():
    for question_id, entry in _entries.items():
        assert not any(note in entry["explanation"] for note in ("출제 키 기준", "검증 필요", "검증 전까지")), question_id


def test_load_rows_skips_questions_with_an_admin_answer_correction():
    question_id = next(iter(_entries))
    rows, skipped = load_rows({question_id})
    assert question_id in skipped and all(row[0] != question_id for row in rows)
    assert len(rows) + len(skipped) == len(_entries)
