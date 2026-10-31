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


async def test_every_wrong_answer_adds_a_marker(client, learner):
    first = await attempt(client, learner, Q1, 0)
    assert first["stats"]["streak"] == 1
    assert first["auto_marked"] is True and first["mark"]["source"] == "auto" and first["mark"]["count"] == 1

    second = await attempt(client, learner, Q1, 2)
    assert second["mark"]["count"] == 2 and second["mark"]["marked_at"] == first["mark"]["marked_at"]

    state = (await client.get("/api/learner/state", headers=learner)).json()
    assert state["marks"][Q1]["count"] == 2 and state["max_mark_count"] == 5


async def test_markers_stop_at_the_maximum(client, learner):
    for _ in range(7):
        result = await attempt(client, learner, Q1, 0)
    assert result["mark"]["count"] == 5


async def test_correct_answer_adds_no_marker(client, learner):
    result = await attempt(client, learner, Q1, 1)
    assert result["check"]["is_correct"] is True and result["mark"] is None and result["auto_marked"] is False
    assert (await client.get("/api/learner/state", headers=learner)).json()["marks"] == {}


async def test_correct_answer_resets_the_streak(client, learner):
    await attempt(client, learner, Q1, 0)
    ok = await attempt(client, learner, Q1, 1)
    assert ok["check"]["is_correct"] is True and ok["stats"]["streak"] == 0
    again = await attempt(client, learner, Q1, 0)
    assert again["stats"]["streak"] == 1
    assert again["mark"]["count"] == 2  # the earlier wrong answer's marker stays


async def test_removing_the_markers_resets_the_streak_and_starts_over(client, learner):
    await attempt(client, learner, Q1, 0)
    await attempt(client, learner, Q1, 0)  # two markers, streak 2
    removed = await client.delete(f"/api/learner/marks/{Q1}", headers=learner)
    assert removed.json()["stats"]["streak"] == 0
    assert (await client.get("/api/learner/state", headers=learner)).json()["marks"] == {}
    after = await attempt(client, learner, Q1, 0)
    assert after["stats"]["streak"] == 1 and after["mark"]["count"] == 1


async def put_mark(client, learner, question_id, count):
    return await client.put(f"/api/learner/marks/{question_id}", headers=learner, json={"count": count})


async def test_manual_marker_count_is_set_not_added(client, learner):
    a = await put_mark(client, learner, Q2, 3)
    b = await put_mark(client, learner, Q2, 3)
    assert a.json() == b.json() and a.json()["source"] == "manual" and a.json()["count"] == 3
    assert (await put_mark(client, learner, Q2, 1)).json()["count"] == 1  # lowering works too
    assert (await put_mark(client, learner, "nope", 1)).status_code == 404


async def test_manual_marker_count_must_be_within_range(client, learner):
    for bad in (0, 6, -1):
        assert (await put_mark(client, learner, Q2, bad)).status_code == 422
    assert (await client.put(f"/api/learner/marks/{Q2}", headers=learner)).status_code == 422  # body is required


async def test_manual_count_keeps_the_original_source_and_a_wrong_answer_adds_to_it(client, learner):
    await attempt(client, learner, Q1, 0)  # auto-marked, one marker
    set_by_hand = (await put_mark(client, learner, Q1, 4)).json()
    assert set_by_hand["source"] == "auto" and set_by_hand["count"] == 4
    assert (await attempt(client, learner, Q1, 0))["mark"]["count"] == 5


async def test_concurrent_wrong_answers_do_not_lose_markers(client, learner):
    await asyncio.gather(*(attempt(client, learner, Q2, 3) for _ in range(4)))
    assert (await client.get("/api/learner/state", headers=learner)).json()["marks"][Q2]["count"] == 4


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
    assert first["auto_marked_ids"] == [Q1] and first["marks"][Q1]["count"] == 1

    second = (await client.post("/api/learner/mini-tests", headers=learner, json=body)).json()
    assert second["auto_marked_ids"] == [Q1] and second["marks"][Q1]["count"] == 2

    history = (await client.get("/api/learner/mini-tests", headers=learner)).json()
    assert len(history) == 2 and history[0]["id"] == second["record"]["id"]
    state = (await client.get("/api/learner/state", headers=learner)).json()
    assert state["stats"][Q1]["attempts"] == 2 and state["marks"][Q1]["source"] == "auto"
    assert state["marks"][Q1]["count"] == 2


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
    assert state["marks"]["2021-22-09"]["count"] == 1
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
