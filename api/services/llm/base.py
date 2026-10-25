from abc import ABC, abstractmethod


class LLMProvider(ABC):
    """Pluggable explanation backend. Add new vendors by implementing this interface."""

    name: str = "unknown"
    """Recorded next to stored explanations (vendor and model)."""

    persistable: bool = True
    """False for placeholder output that must never be stored as the question's real explanation."""

    @abstractmethod
    async def explain(self, *, stem: str, choices: list[str], answer_indexes: list[int]) -> str:
        """Return a Korean-language explanation of why `answer_indexes` are correct and the rest are not."""
