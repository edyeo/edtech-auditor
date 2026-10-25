import asyncio

import pytest

from api.services import explain_service
from api.services.llm.base import LLMProvider
from api.services.llm.fallback_provider import FallbackProvider


class CountingProvider(LLMProvider):
    name = "test:counting"

    def __init__(self, delay: float = 0.0, fail_first: bool = False) -> None:
        self.calls: list[list[int]] = []
        self._delay = delay
        self._fail_first = fail_first

    async def explain(self, *, stem: str, choices: list[str], answer_indexes: list[int]) -> str:
        self.calls.append(answer_indexes)
        await asyncio.sleep(self._delay)
        if self._fail_first and len(self.calls) == 1:
            raise RuntimeError("vendor down")
        return f"explanation #{len(self.calls)} for answers {answer_indexes}"


@pytest.fixture
def use_provider(monkeypatch):
    def install(provider: LLMProvider) -> LLMProvider:
        monkeypatch.setattr(explain_service, "_resolve_provider", lambda: provider)
        return provider

    return install


async def explain(client, question_id):
    return await client.post("/api/explain", json={"question_id": question_id})


async def test_second_request_reuses_the_stored_explanation(client, use_provider):
    provider = use_provider(CountingProvider())
    first = await explain(client, "2021-22-03")
    second = await explain(client, "2021-22-03")
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert len(provider.calls) == 1


async def test_concurrent_requests_call_the_provider_once(client, use_provider):
    provider = use_provider(CountingProvider(delay=0.3))
    responses = await asyncio.gather(*(explain(client, "2021-22-04") for _ in range(8)))
    assert {r.json()["explanation"] for r in responses} == {"explanation #1 for answers [%d]" % provider.calls[0][0]}
    assert len(provider.calls) == 1


async def test_other_questions_are_explained_separately(client, use_provider):
    provider = use_provider(CountingProvider())
    await explain(client, "2021-22-05")
    await explain(client, "2021-22-06")
    assert len(provider.calls) == 2


async def test_placeholder_text_is_never_stored(client, use_provider):
    use_provider(FallbackProvider())
    placeholder = await explain(client, "2021-22-07")
    assert "임시 설명" in placeholder.json()["explanation"]

    real = use_provider(CountingProvider())
    assert "임시 설명" not in (await explain(client, "2021-22-07")).json()["explanation"]
    assert len(real.calls) == 1


async def test_provider_failure_returns_502_and_is_retried_later(client, use_provider):
    provider = use_provider(CountingProvider(fail_first=True))
    assert (await explain(client, "2021-22-09")).status_code == 502
    retry = await explain(client, "2021-22-09")
    assert retry.status_code == 200 and len(provider.calls) == 2
    assert (await explain(client, "2021-22-09")).json() == retry.json()
    assert len(provider.calls) == 2  # the failure stored nothing; the success is now cached


async def test_corrected_answer_key_gets_a_fresh_explanation(client, use_provider, admin):
    q = "2021-22-10"
    provider = use_provider(CountingProvider())
    before = (await explain(client, q)).json()["explanation"]
    original = provider.calls[0][0]
    other = (original + 1) % 4

    await client.put(f"/api/admin/questions/{q}/answer", headers=admin, json={"answer_indexes": [other]})
    try:
        after = (await explain(client, q)).json()["explanation"]
        assert after != before and provider.calls[-1] == [other]
        assert (await explain(client, q)).json()["explanation"] == after  # the new key is cached too
        assert len(provider.calls) == 2
    finally:
        await client.delete(f"/api/admin/questions/{q}/answer", headers=admin)
    assert (await explain(client, q)).json()["explanation"] == before  # reverted key still has its text
    assert len(provider.calls) == 2


async def test_unknown_question_is_404(client, use_provider):
    provider = use_provider(CountingProvider())
    assert (await explain(client, "nope")).status_code == 404
    assert provider.calls == []
