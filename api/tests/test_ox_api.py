import asyncio
import json
from pathlib import Path

import pytest

from api.repositories.ox_question_repository import OxQuestionRepository
from api.repositories.question_repository import QuestionRepository
from api.tests.conftest import access_token

EXPLANATIONS_PATH = Path(__file__).resolve().parent.parent / "data" / "ox_explanations.json"

_ox = OxQuestionRepository()
_bank = QuestionRepository()

# The O/X set covers the audit and project-management part (one subject in the data) and security.
O_X_SUBJECTS = {"감리 및 사업관리", "보안"}


def _derived_ids(polarity: str) -> list[str]:
    return [qid for qid in _ox.list_ids() if _ox.entry(qid) == polarity]


def _authored_ids() -> list[str]:
    return [qid for qid in _ox.list_ids() if isinstance(_ox.entry(qid), list)]


def _default_verdicts(question_id: str) -> list[bool]:
    """Truth value of every statement of a question with the bundled answer keys."""
    entry = _ox.entry(question_id)
    if isinstance(entry, list):
        return [item.is_true for item in entry]
    question = _bank.get_by_id(question_id)
    keys = {question.answer_index, *question.also_correct}
    return [(index in keys) == (entry == "positive") for index in range(len(question.choices))]


async def verdict(client, question_id: str, statement_index: int, answer: str = "O") -> dict:
    response = await client.post(
        "/api/ox/check", json={"question_id": question_id, "statement_index": statement_index, "answer": answer}
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_only_audit_project_management_and_security_questions_are_included():
    ids = _ox.list_ids()
    assert ids
    for question_id in ids:
        question = _bank.get_by_id(question_id)
        assert question is not None, question_id
        assert question.subject in O_X_SUBJECTS, f"{question_id} is not in a subject the O/X set covers"
    assert {_bank.get_by_id(question_id).subject for question_id in ids} == O_X_SUBJECTS


def test_statements_are_listed_in_the_exams_question_order():
    keys = [(_bank.get_by_id(question_id).year, _bank.get_by_id(question_id).number) for question_id in _ox.list_ids()]
    assert keys == sorted(keys)


def test_derived_questions_have_four_statement_choices():
    for question_id in _derived_ids("positive") + _derived_ids("negative"):
        question = _bank.get_by_id(question_id)
        assert question.image_url is None, question_id
        assert len(question.choices) == 4, question_id
        assert all(len(choice) >= 14 for choice in question.choices), question_id


def test_authored_statements_point_at_real_choices():
    for question_id in _authored_ids():
        question = _bank.get_by_id(question_id)
        for item in _ox.entry(question_id):
            assert len(item.statement) >= 15, question_id
            assert item.choice_index is None or 0 <= item.choice_index < len(question.choices), question_id


async def test_list_returns_every_statement_without_the_verdict(client):
    response = await client.get("/api/ox/statements")
    assert response.status_code == 200
    statements = response.json()

    expected = sum(
        len(_bank.get_by_id(qid).choices) if isinstance(_ox.entry(qid), str) else len(_ox.entry(qid))
        for qid in _ox.list_ids()
    )
    assert len(statements) == expected
    assert {s["question_id"] for s in statements} == set(_ox.list_ids())
    for item in statements:
        assert set(item) == {"question_id", "statement_index", "statement", "choice_index"}


async def test_derived_statement_text_is_the_choice(client):
    question_id = _derived_ids("negative")[0]
    statements = [s for s in (await client.get("/api/ox/statements")).json() if s["question_id"] == question_id]
    question = _bank.get_by_id(question_id)
    assert [s["statement"] for s in statements] == question.choices
    assert [s["choice_index"] for s in statements] == [0, 1, 2, 3]


async def test_positive_question_marks_only_the_answer_choice_true(client):
    question_id = _derived_ids("positive")[0]
    answer_index = _bank.get_by_id(question_id).answer_index
    for index in range(4):
        result = await verdict(client, question_id, index)
        assert result["is_true"] is (index == answer_index)


async def test_negative_question_marks_only_the_answer_choice_false(client):
    question_id = _derived_ids("negative")[0]
    answer_index = _bank.get_by_id(question_id).answer_index
    for index in range(4):
        result = await verdict(client, question_id, index)
        assert result["is_true"] is (index != answer_index)


async def test_authored_statement_uses_its_stored_verdict(client):
    for question_id in _authored_ids():
        for index, item in enumerate(_ox.entry(question_id)):
            assert (await verdict(client, question_id, index))["is_true"] is item.is_true


async def test_is_correct_compares_the_learner_answer_with_the_verdict(client):
    question_id = _derived_ids("negative")[0]
    answer_index = _bank.get_by_id(question_id).answer_index  # the false statement
    assert (await verdict(client, question_id, answer_index, "X"))["is_correct"] is True
    assert (await verdict(client, question_id, answer_index, "O"))["is_correct"] is False
    other = (answer_index + 1) % 4  # a true statement
    assert (await verdict(client, question_id, other, "O"))["is_correct"] is True
    assert (await verdict(client, question_id, other, "X"))["is_correct"] is False


async def test_question_outside_the_ox_set_is_not_found(client):
    outside = next(q.id for q in _bank.list_all() if _ox.entry(q.id) is None)
    response = await client.post("/api/ox/check", json={"question_id": outside, "statement_index": 0, "answer": "O"})
    assert response.status_code == 404


async def test_software_engineering_question_is_not_in_the_set(client):
    # 2021 number 26 is the first software engineering question.
    assert _bank.get_by_id("2021-22-26").subject == "소프트웨어 공학"
    assert _ox.entry("2021-22-26") is None
    response = await client.post("/api/ox/check", json={"question_id": "2021-22-26", "statement_index": 0, "answer": "O"})
    assert response.status_code == 404


async def test_derived_index_beyond_the_choices_is_rejected(client):
    response = await client.post(
        "/api/ox/check", json={"question_id": _derived_ids("positive")[0], "statement_index": 4, "answer": "O"}
    )
    assert response.status_code == 422


async def test_authored_index_beyond_the_statements_is_rejected(client):
    question_id = _authored_ids()[0]
    response = await client.post(
        "/api/ox/check",
        json={"question_id": question_id, "statement_index": len(_ox.entry(question_id)), "answer": "O"},
    )
    assert response.status_code == 422


@pytest.mark.parametrize("answer", ["", "o", "YES", None])
async def test_answer_must_be_O_or_X(client, answer):
    response = await client.post(
        "/api/ox/check", json={"question_id": _derived_ids("positive")[0], "statement_index": 0, "answer": answer}
    )
    assert response.status_code == 422


async def test_admin_answer_correction_changes_a_derived_verdict(client, admin):
    question_id = _derived_ids("positive")[0]
    original = _bank.get_by_id(question_id).answer_index
    corrected = (original + 1) % 4
    assert (await verdict(client, question_id, original))["is_true"] is True

    put = await client.put(
        f"/api/admin/questions/{question_id}/answer", json={"answer_indexes": [corrected]}, headers=admin
    )
    assert put.status_code == 200, put.text
    try:
        assert (await verdict(client, question_id, original))["is_true"] is False
        assert (await verdict(client, question_id, corrected))["is_true"] is True
    finally:
        await client.delete(f"/api/admin/questions/{question_id}/answer", headers=admin)


def test_every_statement_has_an_explanation_that_agrees_with_its_verdict():
    explanations = json.loads(EXPLANATIONS_PATH.read_text(encoding="utf-8"))
    assert set(explanations) == set(_ox.list_ids())
    for question_id in _ox.list_ids():
        verdicts = _default_verdicts(question_id)
        assert len(explanations[question_id]) == len(verdicts), question_id
        for index, (text, is_true) in enumerate(zip(explanations[question_id], verdicts)):
            expected = "옳은 설명(O)입니다. " if is_true else "옳지 않은 설명(X)입니다. "
            assert text.startswith(expected), (question_id, index, text[:30])
            assert len(text) > len(expected) + 10, (question_id, index)


async def test_statement_explanation_is_served_on_demand(client):
    question_id = _derived_ids("negative")[0]
    answer_index = _bank.get_by_id(question_id).answer_index
    response = await client.get(f"/api/ox/explanations/{question_id}/{answer_index}")
    assert response.status_code == 200
    body = response.json()
    assert body["question_id"] == question_id and body["statement_index"] == answer_index
    assert body["explanation"].startswith("옳지 않은 설명(X)입니다.")  # the answer choice of a negative stem


async def test_explanation_of_an_authored_statement(client):
    question_id = _authored_ids()[0]
    response = await client.get(f"/api/ox/explanations/{question_id}/0")
    assert response.status_code == 200 and response.json()["explanation"]


async def test_explanation_for_unknown_question_or_index(client):
    assert (await client.get("/api/ox/explanations/2021-22-26/0")).status_code == 404  # software engineering
    question_id = _derived_ids("positive")[0]
    assert (await client.get(f"/api/ox/explanations/{question_id}/4")).status_code == 422
    assert (await client.get(f"/api/ox/explanations/{question_id}/-1")).status_code == 422


# ---- answer counts per statement (signed-in learners) ---------------------------------------------


def _account() -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token()}"}


async def answer_as(client, headers, question_id, statement_index, answer):
    response = await client.post(
        "/api/ox/check",
        headers=headers,
        json={"question_id": question_id, "statement_index": statement_index, "answer": answer},
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_an_answer_without_a_token_is_graded_but_not_counted(client):
    result = await verdict(client, _derived_ids("positive")[0], 0)
    assert result["stats"] is None


async def test_each_answer_of_a_signed_in_learner_is_counted(client):
    me = _account()
    question_id = _derived_ids("negative")[0]
    wrong_choice = _bank.get_by_id(question_id).answer_index  # the false statement

    first = await answer_as(client, me, question_id, wrong_choice, "O")  # wrong: it is false
    assert first["is_correct"] is False and first["stats"]["attempts"] == 1 and first["stats"]["wrong"] == 1

    second = await answer_as(client, me, question_id, wrong_choice, "X")  # right
    assert second["is_correct"] is True
    assert (second["stats"]["attempts"], second["stats"]["wrong"]) == (2, 1)

    state = (await client.get("/api/learner/state", headers=me)).json()
    key = f"{question_id}#{wrong_choice}"
    assert (state["ox_stats"][key]["attempts"], state["ox_stats"][key]["wrong"]) == (2, 1)
    assert list(state["ox_stats"]) == [key]  # only the statement that was answered


async def test_counts_belong_to_the_account(client):
    question_id = _authored_ids()[0]
    await answer_as(client, _account(), question_id, 0, "O")
    stranger = _account()
    assert (await client.get("/api/learner/state", headers=stranger)).json()["ox_stats"] == {}


async def test_an_invalid_statement_is_not_counted(client):
    me = _account()
    question_id = _authored_ids()[0]
    bad = await client.post(
        "/api/ox/check",
        headers=me,
        json={"question_id": question_id, "statement_index": len(_ox.entry(question_id)), "answer": "O"},
    )
    assert bad.status_code == 422
    assert (await client.get("/api/learner/state", headers=me)).json()["ox_stats"] == {}


async def test_a_bad_token_is_refused_instead_of_being_treated_as_anonymous(client):
    response = await client.post(
        "/api/ox/check",
        headers={"Authorization": "Bearer nope"},
        json={"question_id": _derived_ids("positive")[0], "statement_index": 0, "answer": "O"},
    )
    assert response.status_code == 401


async def test_simultaneous_answers_do_not_lose_counts(client):
    me = _account()
    question_id = _authored_ids()[0]
    await asyncio.gather(*(answer_as(client, me, question_id, 0, "O") for _ in range(8)))
    stats = (await client.get("/api/learner/state", headers=me)).json()["ox_stats"][f"{question_id}#0"]
    assert stats["attempts"] == 8
