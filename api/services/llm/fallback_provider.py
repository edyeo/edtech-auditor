from api.services.llm.base import LLMProvider


class FallbackProvider(LLMProvider):
    """Deterministic local explanation used when no LLM API key is configured.

    Keeps the app usable in demos/dev before an API key is provisioned. Its text is a placeholder,
    so it is never stored: once a key is set the real explanation is generated on first request.
    """

    name = "fallback"
    persistable = False

    async def explain(self, *, stem: str, choices: list[str], answer_indexes: list[int]) -> str:
        lines = [
            f"{i + 1}. {choice}" + (" (정답)" if i in answer_indexes else "")
            for i, choice in enumerate(choices)
        ]
        answers = ", ".join(f"{i + 1}번" for i in answer_indexes)
        return (
            "[LLM 키 미설정 — 임시 설명]\n"
            + "\n".join(lines)
            + f"\n\n정답은 {answers}입니다. "
            "실제 해설을 보려면 서버에 OPENAI_API_KEY 환경변수를 설정하세요."
        )
