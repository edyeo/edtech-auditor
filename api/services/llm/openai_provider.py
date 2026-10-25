import os

from openai import AsyncOpenAI

from api.errors import ExplanationUnavailableError
from api.services.llm.base import LLMProvider

_SYSTEM_PROMPT = (
    "당신은 정보시스템 감리사 시험 전문 강사입니다. 주어진 문제, 보기, 정답을 바탕으로 "
    "정답이 왜 맞는지, 나머지 보기는 왜 틀렸는지 한국어로 간결하고 명확하게 설명하세요. "
    "특정 수험생의 선택과 무관하게 모든 학습자가 재사용할 수 있는 해설이어야 합니다."
)


class OpenAIProvider(LLMProvider):
    def __init__(self, model: str | None = None) -> None:
        self._client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"], timeout=45.0, max_retries=1)
        self._model = model or os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        self.name = f"openai:{self._model}"

    async def explain(self, *, stem: str, choices: list[str], answer_indexes: list[int]) -> str:
        numbered = "\n".join(f"{i + 1}. {choice}" for i, choice in enumerate(choices))
        answers = ", ".join(f"{i + 1}번" for i in answer_indexes)
        user_prompt = (
            f"문제:\n{stem}\n\n"
            f"보기:\n{numbered}\n\n"
            f"정답: {answers}\n\n"
            "정답의 근거와 각 오답 보기가 틀린 이유를 보기 번호별로 간단히 설명해줘."
        )
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        content = (response.choices[0].message.content or "").strip()
        if not content:
            raise ExplanationUnavailableError()
        return content
