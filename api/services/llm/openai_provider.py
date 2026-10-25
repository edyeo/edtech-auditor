import os

from openai import AsyncOpenAI

from api.services.llm.base import LLMProvider

_SYSTEM_PROMPT = (
    "당신은 정보시스템 감리사 시험 전문 강사입니다. 주어진 보기와 정답, "
    "그리고 사용자가 고른 답을 바탕으로 각 보기가 왜 맞거나 틀렸는지 "
    "한국어로 간결하고 명확하게 설명하세요."
)


class OpenAIProvider(LLMProvider):
    def __init__(self, model: str | None = None) -> None:
        self._client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
        self._model = model or os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    async def explain(
        self, *, stem: str, choices: list[str], answer_indexes: list[int], selected_index: int
    ) -> str:
        numbered = "\n".join(f"{i + 1}. {choice}" for i, choice in enumerate(choices))
        answers = ", ".join(f"{i + 1}번" for i in answer_indexes)
        user_prompt = (
            f"문제:\n{stem}\n\n"
            f"보기:\n{numbered}\n\n"
            f"정답: {answers}\n"
            f"사용자가 선택한 답: {selected_index + 1}번\n\n"
            "각 보기별로 정답/오답 이유를 간단히 설명해줘."
        )
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        return response.choices[0].message.content or ""
