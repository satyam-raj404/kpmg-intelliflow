"""Model cascade config — role -> provider:model, env-driven, with escalation.

Each role has a cheap default and an escalation target. The orchestrator calls
`resolve(role)` to get an ordered list of (provider, model) to try — first
entry first; on ProviderUnavailable or a parse failure it tries the next.

Model strings are "provider:model_id", e.g. "ollama:llama3.2" or
"openrouter:openai/gpt-4o". This keeps the harness provider-agnostic — swap
any tier to any OpenRouter model, or to Ollama, via env vars alone.
"""
import os
from dataclasses import dataclass

from .providers.base import LLMProvider
from .providers.ollama import OllamaProvider
from .providers.openrouter import OpenRouterProvider

_PROVIDERS: dict[str, LLMProvider] = {
    "ollama": OllamaProvider(),
    "openrouter": OpenRouterProvider(),
}


@dataclass
class ModelRef:
    provider: str
    model: str

    @classmethod
    def parse(cls, spec: str) -> "ModelRef":
        provider, _, model = spec.partition(":")
        if not model:
            raise ValueError(f"Model spec must be 'provider:model', got {spec!r}")
        return cls(provider, model)

    def get_provider(self) -> LLMProvider:
        try:
            return _PROVIDERS[self.provider]
        except KeyError:
            raise ValueError(f"Unknown provider {self.provider!r}. Known: {list(_PROVIDERS)}")


# Role -> (cheap default env var, escalation env var, hardcoded fallback default)
_ROLE_DEFAULTS: dict[str, tuple[str, str]] = {
    "planner":     ("HARNESS_PLANNER_MODEL",     "openrouter:openai/gpt-4o"),
    "sql":         ("HARNESS_SQL_MODEL",         "openrouter:openai/gpt-4o"),
    "narrator":    ("HARNESS_NARRATOR_MODEL",    "openrouter:openai/gpt-4o"),
    "hard_reason": ("HARNESS_HARD_REASON_MODEL", "openrouter:openai/gpt-4o"),
}


def resolve(role: str) -> list[ModelRef]:
    """Ordered cascade for a role: [cheap_default, escalation_fallback].
    If the cheap default IS the escalation model (no Ollama configured), returns just one.
    """
    if role not in _ROLE_DEFAULTS:
        raise ValueError(f"Unknown role {role!r}. Known: {list(_ROLE_DEFAULTS)}")
    env_var, hardcoded_fallback = _ROLE_DEFAULTS[role]
    cheap = os.environ.get(env_var, hardcoded_fallback)
    escalation = os.environ.get("HARNESS_HARD_REASON_MODEL", hardcoded_fallback)

    chain = [ModelRef.parse(cheap)]
    if escalation != cheap:
        chain.append(ModelRef.parse(escalation))
    return chain


if __name__ == "__main__":
    for role in _ROLE_DEFAULTS:
        chain = resolve(role)
        print(role, "->", [f"{m.provider}:{m.model}" for m in chain])
    assert resolve("planner")[0].provider in _PROVIDERS
    print("config OK")
