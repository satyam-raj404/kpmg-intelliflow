"""Model cascade config — role -> provider:model, env-driven, with escalation.

Each role has a cheap default and an escalation target. The orchestrator calls
`resolve(role)` to get an ordered list of (provider, model) to try — first
entry first; on ProviderUnavailable or a parse failure it tries the next.

Model strings are "provider:model_id", e.g. "ollama:llama3.2",
"openrouter:openai/gpt-4o" or "gemini:google/gemini-2.5-flash". This keeps the harness
provider-agnostic — swap any tier to any OpenRouter model, Gemini, or Ollama,
via env vars alone.
"""
import os
from dataclasses import dataclass

from .providers.base import LLMProvider
from .providers.ollama import OllamaProvider
from .providers.openai_compat import OpenAICompatProvider

_PROVIDERS: dict[str, LLMProvider] = {
    "ollama": OllamaProvider(),
    "openrouter": OpenAICompatProvider(
        "openrouter", "https://openrouter.ai/api/v1/chat/completions", "OPENROUTER_API_KEY",
        extra_headers={"HTTP-Referer": "https://intellisource.kpmg.com", "X-Title": "IntelliSource P2P"},
    ),
    # Gemini on Vertex AI (express-mode "AQ." API key, GCP project below) via Vertex's
    # OpenAI-compatible endpoint; the key goes in x-goog-api-key, not a Bearer token.
    # Model ids carry the publisher prefix, e.g. "gemini:google/gemini-2.5-flash".
    # Thinking tokens count against max_tokens, hence the larger cap and low effort.
    "gemini": OpenAICompatProvider(
        "gemini",
        f"https://aiplatform.googleapis.com/v1/projects/{os.environ.get('GEMINI_PROJECT', '243936589471')}"
        "/locations/global/endpoints/openapi/chat/completions",
        "GEMINI_API_KEY", key_header="x-goog-api-key",
        extra_body={"reasoning_effort": "low"}, max_tokens=8192,
    ),
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
