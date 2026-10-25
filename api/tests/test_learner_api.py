import asyncio
import uuid

# 2021-22-01: choices 21.9 / 23.3 / 23.8 / 26.4 -> correct is index 1.
Q1, Q2, Q94 = "2021-22-01", "2021-22-02", "2021-22-94"  # Q94 is multiple-answer (indexes 1 and 2)


async def attempt(client, learner, question_id, selected):
    r = await client.post(
        "/api/learner/attempts", headers=learner, json={"question_id": question_id, "selected_index": selected}
    )
    assert r.status_code == 200, r.text
    return r.json()


async def test_learner_id_is_required(client):
    assert (await client.get("/api/learner/state")).status_code == 400
    assert (await client.get("/api/learner/state", headers={"X-Learner-Id": "nope"})).status_code == 400


async def test_two_wrong_answers_in_a_row_auto_mark(client, learner):
    first = await attempt(client, learner, Q1, 0)
    assert first["stats"]["streak"] == 1 and first["auto_marked"] is False

    second = await attempt(client, learner, Q1, 2)
    assert second["stats"]["streak"] == 2
    assert second["auto_marked"] is True and second["mark"]["source"] == "auto"

    third = await attempt(client, learner, Q1, 3)  # already marked: no second auto-mark
    assert third["auto_marked"] is False


async def test_correct_answer_resets_the_streak(client, learner):
    await attempt(client, learner, Q1, 0)
    ok = await attempt(client, learner, Q1, 1)
    assert ok["check"]["is_correct"] is True and ok["stats"]["streak"] == 0
    again = await attempt(client, learner, Q1, 0)
    assert again["stats"]["streak"] == 1 and again["auto_marked"] is False


async def test_unmarking_resets_the_streak_so_it_is_not_remarked_at_once(client, learner):
    await attempt(client, learner, Q1, 0)
    await attempt(client, learner, Q1, 0)  # auto-marked, streak 2
    removed = await client.delete(f"/api/learner/marks/{Q1}", headers=learner)
    assert removed.json()["stats"]["streak"] == 0
    after = await attempt(client, learner, Q1, 0)
    assert after["stats"]["streak"] == 1 and after["auto_marked"] is False


async def test_manual_mark_is_idempotent(client, learner):
    a = await client.put(f"/api/learner/marks/{Q2}", headers=learner)
    b = await client.put(f"/api/learner/marks/{Q2}", headers=learner)
    assert a.json() == b.json() and a.json()["source"] == "manual"
    assert (await client.put("/api/learner/marks/nope", headers=learner)).status_code == 404


async def test_mini_test_grades_records_and_auto_marks(client, learner):
    body = {
        "scope_label": "전체 · 3문항",
        "answers": [
            {"question_id": Q1, "selected_index": 0},
            {"question_id": Q2, "selected_index": 0},
            {"question_id": Q94, "selected_index": 2},
        ],
    }
    first = (await client.post("/api/learner/mini-tests", headers=learner, json=body)).json()
    assert [i["is_correct"] for i in first["record"]["items"]] == [False, True, True]
    assert first["auto_marked_ids"] == []

    second = (await client.post("/api/learner/mini-tests", headers=learner, json=body)).json()
    assert second["auto_marked_ids"] == [Q1]  # wrong twice in a row

    history = (await client.get("/api/learner/mini-tests", headers=learner)).json()
    assert len(history) == 2 and history[0]["id"] == second["record"]["id"]
    state = (await client.get("/api/learner/state", headers=learner)).json()
    assert state["stats"][Q1]["attempts"] == 2 and state["marks"][Q1]["source"] == "auto"


async def test_concurrent_attempts_do_not_lose_updates(client, learner):
    await asyncio.gather(*(attempt(client, learner, Q2, 3) for _ in range(15)))
    stats = (await client.get("/api/learner/state", headers=learner)).json()["stats"][Q2]
    assert (stats["attempts"], stats["wrong"], stats["streak"]) == (15, 15, 15)


LEGACY = {
    "marks": {"2021-22-09": {"marked_at": "2026-01-01T00:00:00Z", "source": "manual"}, "ghost": {"marked_at": "2026-01-01T00:00:00Z"}},
    "stats": {"2021-22-09": {"attempts": 2, "wrong": 5, "streak": 9}},
    "mini_tests": [
        {
            "id": "legacy-0",
            "taken_at": "2026-01-01T00:00:00Z",
            "scope_label": "legacy",
            "items": [{"question_id": "2021-22-09", "selected_index": 1, "correct_indexes": [1], "is_correct": True}],
        }
    ],
}


async def test_import_fills_only_an_empty_profile_and_clamps_bad_data(client, learner):
    assert (await client.post("/api/learner/import", headers=learner, json=LEGACY)).json() == {"imported": True}
    state = (await client.get("/api/learner/state", headers=learner)).json()
    assert list(state["marks"]) == ["2021-22-09"]  # unknown question skipped
    assert state["stats"]["2021-22-09"] == {"attempts": 2, "wrong": 2, "streak": 2, "last_wrong_at": None}
    assert (await client.post("/api/learner/import", headers=learner, json=LEGACY)).json() == {"imported": False}


async def test_concurrent_imports_do_not_duplicate_history(client, learner):
    """Regression: React StrictMode fires the bootstrap twice; both imports saw an empty profile."""
    results = await asyncio.gather(*(client.post("/api/learner/import", headers=learner, json=LEGACY) for _ in range(4)))
    assert sorted(r.json()["imported"] for r in results) == [False, False, False, True]
    history = (await client.get("/api/learner/mini-tests", headers=learner)).json()
    assert len(history) == 1


async def test_review_state_round_trip(client, learner):
    state = {"box_level": 3, "due_at": "2026-11-01", "last_confidence": "high", "last_correct": True, "attempts": 2, "overconfident_miss": False}
    assert (await client.put(f"/api/learner/review/{Q1}", headers=learner, json=state)).status_code == 204
    assert (await client.get("/api/learner/state", headers=learner)).json()["review"][Q1] == state
    assert (await client.put(f"/api/learner/review/{Q1}", headers=learner, json={**state, "box_level": 9})).status_code == 422


async def test_admin_override_changes_grading_and_can_be_reverted(client, admin):
    assert (await client.get("/api/admin/questions")).status_code == 401
    updated = await client.put(f"/api/admin/questions/{Q1}/answer", headers=admin, json={"answer_indexes": [0, 3]})
    assert updated.json()["answer_overridden"] is True and updated.json()["also_correct"] == [3]
    assert (await client.post("/api/questions/check", json={"question_id": Q1, "selected_index": 3})).json()["is_correct"] is True
    assert (await client.put(f"/api/admin/questions/{Q1}/answer", headers=admin, json={"answer_indexes": [9]})).status_code == 422
    reverted = await client.delete(f"/api/admin/questions/{Q1}/answer", headers=admin)
    assert reverted.json()["answer_overridden"] is False
    assert (await client.post("/api/questions/check", json={"question_id": Q1, "selected_index": 1})).json()["is_correct"] is True
