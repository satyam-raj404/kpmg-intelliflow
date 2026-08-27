"""LLMProvider interface — every model backend (OpenRouter, Ollama, ...) implements this."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class LLMResponse:
    content: str | None
    tool_calls: list[dict] = field(default_factory=list)  # [{id, name, arguments}]
    raw_finish_reason: str = "stop"


class LLMProvider(ABC):
    name: str

    @abstractmethod
    def chat(
        self,
        messages: list[dict],
        model: str,
        tools: list[dict] | None = None,
        json_mode: bool = False,
        temperature: float = 0.1,
        force_tool: bool = False,
    ) -> LLMResponse:
        """One completion call. Must not raise on provider-side rate limits without retry."""
        ...


class ProviderUnavailable(Exception):
    """Raised when a provider can't be reached (connection refused, timeout) —
    the cascade catches this and escalates to the next role tier."""
