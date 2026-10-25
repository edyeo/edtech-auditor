from api.services.llm.base import LLMProvider


class FallbackProvider(LLMProvider):
    """Deterministic local explanation used when no LLM API key is configured.

    Keeps the app usable in demos/dev before an API key is provisioned.
    """

    async def explain(
        self, *, stem: str, choices: list[str], answer_indexes: list[int], selected_index: int
    ) -> str:
        lines = [
            f"{i + 1}. {choice}" + (" (정답)" if i in answer_indexes else "")
            for i, choice in enumerate(choices)
        ]
        verdict = "정답입니다." if selected_index in answer_indexes else "오답입니다."
        return (
            "[LLM 키 미설정 — 임시 설명]\n"
            + "\n".join(lines)
            + f"\n\n선택하신 {selected_index + 1}번은 {verdict} "
            "실제 해설을 보려면 서버에 OPENAI_API_KEY 환경변수를 설정하세요."
        )
