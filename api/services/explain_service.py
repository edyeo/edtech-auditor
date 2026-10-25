import os
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncSession

from api.repositories.question_repository import QuestionRepository
from api.services.llm.base import LLMProvider
from api.services.llm.fallback_provider import FallbackProvider
from api.services.question_service import QuestionService

# Maps LLM_PROVIDER env value -> (required key env var, import path).
# Add a new entry here when integrating another vendor (e.g. Anthropic).
_PROVIDERS: dict[str, tuple[str, str]] = {
    "openai": ("OPENAI_API_KEY", "api.services.llm.openai_provider:OpenAIProvider"),
    # TODO(oma-deferred): add "anthropic": ("ANTHROPIC_API_KEY", "api.services.llm.anthropic_provider:AnthropicProvider")
}


@lru_cache
def _resolve_provider() -> LLMProvider:
    provider_name = os.environ.get("LLM_PROVIDER", "openai")
    config = _PROVIDERS.get(provider_name)
    if config is None or not os.environ.get(config[0]):
        return FallbackProvider()

    module_path, class_name = config[1].split(":")
    module = __import__(module_path, fromlist=[class_name])
    provider_cls = getattr(module, class_name)
    return provider_cls()  # type: ignore[no-any-return]


class ExplainService:
    def __init__(self, repository: QuestionRepository | None = None) -> None:
        self._questions = QuestionService(repository)

    async def explain(self, session: AsyncSession | None, *, question_id: str, selected_index: int) -> str:
        question = (await self._questions.resolve(session, [question_id]))[question_id]
        provider = _resolve_provider()
        return await provider.explain(
            stem=question.stem,
            choices=question.choices,
            answer_indexes=[question.answer_index, *question.also_correct],
            selected_index=selected_index,
        )
