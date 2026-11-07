import asyncio
import uuid

from api.repositories.ox_question_repository import OxQuestionRepository
from api.tests.conftest import access_token

# 2021-22-01: choices 21.9 / 23.3 / 23.8 / 26.4 -> correct is index 1.
Q1, Q2, Q94 = "2021-22-01", "2021-22-02", "2021-22-94"  # Q94 is multiple-answer (indexes 1 and 2)


OX_QUESTION = OxQuestionRepository().list_ids()[0]


async def put_ox_mark(client, learner, question_id, statement_index, count):
    return await client.put(
        f"/api/learner/ox-marks/{question_id}/{statement_index}", headers=learner, json={"count": count}
    )


async def attempt(client, learner, question_id, selected):
    r = await client.post(
        "/api/learner/attempts", headers=learner, json={"question_id": question_id, "selected_index": selected}
    )
    assert r.status_code == 200, r.text
    return r.json()


async def test_sign_in_is_required(client):
    assert (await client.get("/api/learner/state")).status_code == 401
    assert (await client.get("/api/learner/state", headers={"Authorization": "Bearer nope"})).status_code == 401
    legacy_header = {"X-Learner-Id": str(uuid.uuid4())}  # the pre-account identity no longer works
    assert (await client.get("/api/learner/state", headers=legacy_header)).status_code == 401


async def test_each_account_sees_only_its_own_data(client):
    alice = {"Authorization": f"Bearer {access_token()}"}
    bob = {"Authorization": f"Bearer {access_token()}"}
    assert (await client.put(f"/api/learner/marks/{Q1}", headers=alice, json={"count": 2})).status_code == 200
    assert (await client.get("/api/learner/state", headers=alice)).json()["marks"][Q1]["count"] == 2
    assert (await client.get("/api/learner/state", headers=bob)).json()["marks"] == {}


async def test_the_same_account_keeps_its_data_across_tokens(client):
    user = uuid.uuid4()
    first = {"Authorization": f"Bearer {access_token(user)}"}
    await client.put(f"/api/learner/marks/{Q1}", headers=first, json={"count": 3})
    later = {"Authorization": f"Bearer {access_token(user)}"}  # e.g. after a token refresh or on another device
    assert (await client.get("/api/learner/state", headers=later)).json()["marks"][Q1]["count"] == 3


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


async def test_statement_markers_are_separate_from_the_question_markers(client, learner):
    key = f"{OX_QUESTION}#1"
    assert (await put_ox_mark(client, learner, OX_QUESTION, 1, 3)).json()["count"] == 3
    assert (await put_ox_mark(client, learner, OX_QUESTION, 1, 2)).json()["count"] == 2  # set, not added
    await client.put(f"/api/learner/marks/{OX_QUESTION}", headers=learner, json={"count": 5})

    state = (await client.get("/api/learner/state", headers=learner)).json()
    assert state["ox_marks"][key]["count"] == 2 and list(state["ox_marks"]) == [key]
    assert state["marks"][OX_QUESTION]["count"] == 5  # the question keeps its own markers

    assert (await client.delete(f"/api/learner/ox-marks/{OX_QUESTION}/1", headers=learner)).status_code == 204
    state = (await client.get("/api/learner/state", headers=learner)).json()
    assert state["ox_marks"] == {} and state["marks"][OX_QUESTION]["count"] == 5


async def test_statement_markers_belong_to_one_account(client):
    alice = {"Authorization": f"Bearer {access_token()}"}
    bob = {"Authorization": f"Bearer {access_token()}"}
    await put_ox_mark(client, alice, OX_QUESTION, 0, 1)
    assert (await client.get("/api/learner/state", headers=bob)).json()["ox_marks"] == {}


async def test_statement_marker_input_is_validated(client, learner):
    for bad in (0, 6, -1):
        assert (await put_ox_mark(client, learner, OX_QUESTION, 0, bad)).status_code == 422
    assert (await put_ox_mark(client, learner, OX_QUESTION, 99, 1)).status_code == 422  # no such statement
    assert (await put_ox_mark(client, learner, OX_QUESTION, -1, 1)).status_code == 422
    assert (await put_ox_mark(client, learner, "nope", 0, 1)).status_code == 404
    assert (await put_ox_mark(client, learner, "2021-22-26", 0, 1)).status_code == 404  # not an O/X question
    assert (await client.put(f"/api/learner/ox-marks/{OX_QUESTION}/0", headers=learner)).status_code == 422
    assert (await client.put(f"/api/learner/ox-marks/{OX_QUESTION}/0", json={"count": 1})).status_code == 401


async def add_term(client, learner, term, source=Q1):
    return await client.post("/api/learner/vocabulary", headers=learner, json={"term": term, "source_question_id": source})


async def test_vocabulary_term_is_saved_with_its_source_and_listed_in_the_state(client, learner):
    saved = (await add_term(client, learner, "  요구정의단계   감리 ")).json()
    assert saved["term"] == "요구정의단계 감리" and saved["memo"] == "" and saved["studied"] is False
    assert saved["source_question_id"] == Q1

    state = (await client.get("/api/learner/state", headers=learner)).json()
    assert state["vocabulary"]["요구정의단계 감리"]["term"] == "요구정의단계 감리"


async def test_saving_a_term_again_keeps_the_memo_and_ignores_the_case(client, learner):
    await add_term(client, learner, "Critical Path")
    await client.patch("/api/learner/vocabulary", headers=learner, json={"term": "Critical Path", "memo": "가장 긴 경로"})
    again = (await add_term(client, learner, "critical  path", Q2)).json()
    assert again["term"] == "Critical Path" and again["memo"] == "가장 긴 경로" and again["source_question_id"] == Q1
    assert len((await client.get("/api/learner/state", headers=learner)).json()["vocabulary"]) == 1


async def test_memo_and_studied_are_changed_independently(client, learner):
    await add_term(client, learner, "주경로")
    memo = await client.patch("/api/learner/vocabulary", headers=learner, json={"term": "주경로", "memo": "메모"})
    assert memo.json()["memo"] == "메모" and memo.json()["studied"] is False
    studied = await client.patch("/api/learner/vocabulary", headers=learner, json={"term": "주경로", "studied": True})
    assert studied.json()["memo"] == "메모" and studied.json()["studied"] is True
    cleared = await client.patch("/api/learner/vocabulary", headers=learner, json={"term": "주경로", "memo": ""})
    assert cleared.json()["memo"] == "" and cleared.json()["studied"] is True


async def test_a_term_can_be_removed_and_each_account_has_its_own_words(client, learner):
    await add_term(client, learner, "주경로")
    other = {"Authorization": f"Bearer {access_token()}"}
    assert (await client.get("/api/learner/state", headers=other)).json()["vocabulary"] == {}
    assert (await client.delete("/api/learner/vocabulary", headers=other, params={"term": "주경로"})).status_code == 204
    assert len((await client.get("/api/learner/state", headers=learner)).json()["vocabulary"]) == 1
    assert (await client.delete("/api/learner/vocabulary", headers=learner, params={"term": "주경로"})).status_code == 204
    assert (await client.get("/api/learner/state", headers=learner)).json()["vocabulary"] == {}


async def test_vocabulary_input_is_validated(client, learner):
    for bad in ("", "   ", "x" * 101):
        assert (await add_term(client, learner, bad)).status_code == 422
    assert (await client.patch("/api/learner/vocabulary", headers=learner, json={"term": "없는 단어"})).status_code == 404
    await add_term(client, learner, "주경로")
    too_long = {"term": "주경로", "memo": "m" * 20001}
    assert (await client.patch("/api/learner/vocabulary", headers=learner, json=too_long)).status_code == 422
    assert (await client.post("/api/learner/vocabulary", json={"term": "a"})).status_code == 401


async def test_an_unknown_source_question_does_not_block_saving(client, learner):
    saved = await add_term(client, learner, "주경로", source="nope")
    assert saved.status_code == 200 and saved.json()["source_question_id"] is None


async def test_vocabulary_is_limited_per_account(client, learner):
    from api.models.learner import MAX_VOCABULARY_TERMS

    for start in range(0, MAX_VOCABULARY_TERMS, 25):  # in batches, so the connection pool is not flooded
        batch = await asyncio.gather(*(add_term(client, learner, f"term-{i}") for i in range(start, start + 25)))
        assert {r.status_code for r in batch} == {200}, [r.text for r in batch if r.status_code != 200][:1]
    assert (await add_term(client, learner, "one-too-many")).status_code == 409
    assert (await add_term(client, learner, "TERM-0")).status_code == 200  # an existing word is not "one more"


# ---- vocabulary notes: section, long Markdown memo and images ---------------------------------------

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 64
WEBP = b"RIFF\x24\x00\x00\x00WEBP" + b"0" * 64


async def upload(client, learner, term, data=PNG, content_type="image/png"):
    return await client.post(
        "/api/learner/vocabulary/images", headers={**learner, "Content-Type": content_type}, params={"term": term}, content=data
    )


async def test_a_note_keeps_its_section_and_a_long_markdown_memo(client, learner):
    saved = await client.post("/api/learner/vocabulary", headers=learner, json={"term": "주경로", "section": "사업관리"})
    assert saved.json()["section"] == "사업관리" and saved.json()["source_question_id"] is None

    memo = "# 주경로\n\n- 가장 긴 경로\n" + "x" * 15000
    changed = await client.patch("/api/learner/vocabulary", headers=learner, json={"term": "주경로", "memo": memo})
    assert changed.json()["memo"] == memo and changed.json()["section"] == "사업관리"
    moved = await client.patch("/api/learner/vocabulary", headers=learner, json={"term": "주경로", "section": "보안"})
    assert moved.json()["section"] == "보안"
    cleared = await client.patch("/api/learner/vocabulary", headers=learner, json={"term": "주경로", "section": ""})
    assert cleared.json()["section"] is None
    too_long = await client.patch("/api/learner/vocabulary", headers=learner, json={"term": "주경로", "memo": "m" * 20001})
    assert too_long.status_code == 422


async def test_an_image_is_stored_listed_and_served_back_to_its_owner_only(client, learner):
    await add_term(client, learner, "주경로")
    stored = await upload(client, learner, "주경로")
    assert stored.status_code == 200, stored.text
    image = stored.json()
    assert image["content_type"] == "image/png" and image["size"] == len(PNG)

    state = (await client.get("/api/learner/state", headers=learner)).json()
    assert state["vocabulary"]["주경로"]["images"] == [image]  # metadata only, never the bytes

    served = await client.get(f"/api/learner/vocabulary/images/{image['id']}", headers=learner)
    assert served.status_code == 200 and served.content == PNG
    assert served.headers["content-type"] == "image/png" and served.headers["x-content-type-options"] == "nosniff"

    other = {"Authorization": f"Bearer {access_token()}"}
    assert (await client.get(f"/api/learner/vocabulary/images/{image['id']}", headers=other)).status_code == 404
    assert (await client.delete(f"/api/learner/vocabulary/images/{image['id']}", headers=other)).status_code == 404
    assert (await client.get(f"/api/learner/vocabulary/images/{image['id']}")).status_code == 401


async def test_an_image_can_be_removed_and_goes_with_its_note(client, learner):
    await add_term(client, learner, "주경로")
    first = (await upload(client, learner, "주경로")).json()
    second = (await upload(client, learner, "주경로", JPEG, "image/jpeg")).json()
    assert (await client.delete(f"/api/learner/vocabulary/images/{first['id']}", headers=learner)).status_code == 204
    state = (await client.get("/api/learner/state", headers=learner)).json()
    assert [i["id"] for i in state["vocabulary"]["주경로"]["images"]] == [second["id"]]

    await client.delete("/api/learner/vocabulary", headers=learner, params={"term": "주경로"})
    assert (await client.get(f"/api/learner/vocabulary/images/{second['id']}", headers=learner)).status_code == 404


async def test_image_uploads_are_checked(client, learner):
    await add_term(client, learner, "주경로")
    assert (await upload(client, learner, "주경로", WEBP, "image/webp")).status_code == 200
    assert (await upload(client, learner, "주경로", b"GIF89a" + b"0" * 64, "image/gif")).status_code == 415
    assert (await upload(client, learner, "주경로", b"not a png at all" * 4, "image/png")).status_code == 415  # header lies
    assert (await upload(client, learner, "주경로", PNG + b"0" * 400_000)).status_code == 413
    assert (await upload(client, learner, "없는 단어")).status_code == 404
    assert (await client.post("/api/learner/vocabulary/images", params={"term": "주경로"}, content=PNG)).status_code == 401


async def test_a_note_holds_at_most_three_images(client, learner):
    await add_term(client, learner, "주경로")
    for _ in range(3):
        assert (await upload(client, learner, "주경로")).status_code == 200
    assert (await upload(client, learner, "주경로")).status_code == 409
    await add_term(client, learner, "다른 단어")
    assert (await upload(client, learner, "다른 단어")).status_code == 200  # the limit is per note


# ---- markers on single answer choices ---------------------------------------------------------------


async def put_choice_mark(client, learner, question_id, choice_index, count):
    return await client.put(
        f"/api/learner/choice-marks/{question_id}/{choice_index}", headers=learner, json={"count": count}
    )


async def test_choice_markers_are_separate_from_question_and_statement_markers(client, learner):
    assert (await put_choice_mark(client, learner, Q1, 2, 3)).json()["count"] == 3
    assert (await put_choice_mark(client, learner, Q1, 2, 1)).json()["count"] == 1  # set, not added
    await client.put(f"/api/learner/marks/{Q1}", headers=learner, json={"count": 4})

    state = (await client.get("/api/learner/state", headers=learner)).json()
    assert state["choice_marks"][f"{Q1}#2"]["count"] == 1 and list(state["choice_marks"]) == [f"{Q1}#2"]
    assert state["marks"][Q1]["count"] == 4 and state["ox_marks"] == {}

    assert (await client.delete(f"/api/learner/choice-marks/{Q1}/2", headers=learner)).status_code == 204
    state = (await client.get("/api/learner/state", headers=learner)).json()
    assert state["choice_marks"] == {} and state["marks"][Q1]["count"] == 4


async def test_choice_markers_belong_to_one_account(client):
    alice = {"Authorization": f"Bearer {access_token()}"}
    bob = {"Authorization": f"Bearer {access_token()}"}
    await put_choice_mark(client, alice, Q1, 0, 2)
    assert (await client.get("/api/learner/state", headers=bob)).json()["choice_marks"] == {}


async def test_choice_marker_input_is_validated(client, learner):
    for bad in (0, 6, -1):
        assert (await put_choice_mark(client, learner, Q1, 0, bad)).status_code == 422
    assert (await put_choice_mark(client, learner, Q1, 4, 1)).status_code == 422  # a question has four choices
    assert (await put_choice_mark(client, learner, Q1, -1, 1)).status_code == 422
    assert (await put_choice_mark(client, learner, "nope", 0, 1)).status_code == 404
    assert (await client.put(f"/api/learner/choice-marks/{Q1}/0", json={"count": 1})).status_code == 401


async def test_a_word_can_be_switched_off_and_saving_it_again_switches_it_on(client, learner):
    saved = (await add_term(client, learner, "주경로")).json()
    assert saved["active"] is True
    await client.patch("/api/learner/vocabulary", headers=learner, json={"term": "주경로", "memo": "가장 긴 경로"})
    await upload(client, learner, "주경로")

    off = (await client.patch("/api/learner/vocabulary", headers=learner, json={"term": "주경로", "active": False})).json()
    assert off["active"] is False and off["memo"] == "가장 긴 경로" and len(off["images"]) == 1  # kept, not deleted
    state = (await client.get("/api/learner/state", headers=learner)).json()
    assert state["vocabulary"]["주경로"]["active"] is False

    again = (await add_term(client, learner, "주경로", Q2)).json()  # saved again from another question
    assert again["active"] is True and again["memo"] == "가장 긴 경로" and again["source_question_id"] == Q1
    assert len(again["images"]) == 1


async def test_saving_an_active_word_again_changes_nothing(client, learner):
    first = (await add_term(client, learner, "주경로")).json()
    second = (await add_term(client, learner, "주경로")).json()
    assert second["active"] is True and second["updated_at"] == first["updated_at"]
