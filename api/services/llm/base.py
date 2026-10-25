from abc import ABC, abstractmethod


class LLMProvider(ABC):
    """Pluggable explanation backend. Add new vendors by implementing this interface."""

    @abstractmethod
    async def explain(
        self, *, stem: str, choices: list[str], answer_indexes: list[int], selected_index: int
    ) -> str:
        """Return a Korean-language explanation of why `answer_indexes` are correct."""
