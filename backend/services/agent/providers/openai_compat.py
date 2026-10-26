"""OpenAI-compatible chat provider — OpenRouter, Gemini (Developer API) or any
other endpoint that speaks /chat/completions. One class, one instance per
backend, registered in config.py."""
import json
import os
import time
import urllib.error
import urllib.request

from .base import LLMProvider, LLMResponse, ProviderUnavailable


# Upstream codes worth failing over to the next cascade tier rather than erroring out.
_TRANSIENT_CODES = {408, 429, 500, 502, 503, 504}
_TRANSIENT_HINTS = ("overloaded", "temporarily", "timeout", "timed out",
                     "rate limit", "rate-limited", "try again", "capacity", "unavailable")


def _looks_transient(detail: str) -> bool:
    d = (detail or "").lower()
    return any(h in d for h in _TRANSIENT_HINTS)


MAX_429_RETRIES = 2  # bounded — was an unbounded time.sleep(15)+recurse loop that
                      # could hang a request indefinitely under sustained rate-limiting


class OpenAICompatProvider(LLMProvider):
    def __init__(self, name: str, url: str, api_key_env: str,
                 extra_headers: dict | None = None, extra_body: dict | None = None,
                 max_tokens: int = 2048, key_header: str | None = None):
        self.name = name
        self.url = url
        self.api_key_env = api_key_env
        self.extra_headers = extra_headers or {}
        self.extra_body = extra_body or {}
        self.max_tokens = max_tokens
        self.key_header = key_header  # None -> "Authorization: Bearer <key>"

    def chat(
        self,
        messages: list[dict],
        model: str,
        tools: list[dict] | None = None,
        json_mode: bool = False,
        temperature: float = 0.1,
        force_tool: bool = False,
        _retry_count: int = 0,
    ) -> LLMResponse:
        body: dict = {
            "model": model,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": temperature,
            **self.extra_body,
        }
        if tools:
            body["tools"] = tools
            body["tool_choice"] = "required" if force_tool else "auto"
        if json_mode:
            body["response_format"] = {"type": "json_object"}

        api_key = os.environ.get(self.api_key_env, "")
        if not api_key:
            # Unavailable (not a hard error) so a configured fallback tier still gets its turn.
            raise ProviderUnavailable(f"{self.name}: {self.api_key_env} is not set — add it to .env")

        req = urllib.request.Request(
            self.url,
            data=json.dumps(body).encode(),
            headers={
                "Content-Type": "application/json",
                **({self.key_header: api_key} if self.key_header else {"Authorization": f"Bearer {api_key}"}),
                **self.extra_headers,
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                data = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            err_body = e.read().decode(errors="replace")
            if e.code == 429:
                if _retry_count >= MAX_429_RETRIES:
                    # Bounded out — treat as a transient outage so the cascade
                    # escalates to the next tier instead of hanging forever.
                    raise ProviderUnavailable(f"{self.name} rate-limited after {MAX_429_RETRIES} retries: {err_body}")
                time.sleep(15)
                return self.chat(messages, model, tools, json_mode, temperature, force_tool, _retry_count + 1)
            if e.code in _TRANSIENT_CODES:  # 5xx / 408 — e.g. Gemini "model is overloaded"
                raise ProviderUnavailable(f"{self.name} {e.code} on {model}: {err_body}")
            raise RuntimeError(f"{self.name} API error {e.code}: {err_body}")
        except (urllib.error.URLError, TimeoutError) as e:
            raise ProviderUnavailable(f"{self.name} unreachable: {e}")

        return self._parse(data, model)

    def _parse(self, data: dict, model: str) -> LLMResponse:
        # OpenRouter returns HTTP 200 with a top-level "error" object (and NO
        # "choices") when the UPSTREAM provider fails — e.g. {"error":{"code":503,
        # "message":"Upstream error from Nvidia: Service temporarily overloaded"}}.
        # The HTTPError branch never fires for these, so without this check the
        # next line raises a bare KeyError: 'choices'. Transient upstream/rate-limit
        # failures must raise ProviderUnavailable so the cascade escalates.
        if "choices" not in data:
            err = data.get("error") or {}
            code = err.get("code")
            detail = err.get("message") or json.dumps(data)[:300]
            if code in _TRANSIENT_CODES or _looks_transient(detail):
                raise ProviderUnavailable(f"{self.name} upstream unavailable on {model} ({code}): {detail}")
            raise RuntimeError(f"{self.name} error on {model} ({code}): {detail}")

        choice = data["choices"][0]
        msg = choice["message"]
        finish = choice.get("finish_reason", "stop")
        if finish == "error":
            # Upstream failure embedded in the choice — usually a rate limit or
            # provider hiccup. Surface it instead of returning an empty response
            # (which the orchestrator would mistake for "done, no more tools").
            detail = choice.get("error") or data.get("error") or {"message": "unknown upstream error"}
            text = detail.get("message", "") if isinstance(detail, dict) else str(detail)
            if _looks_transient(text) or (isinstance(detail, dict) and detail.get("code") in _TRANSIENT_CODES):
                raise ProviderUnavailable(f"{self.name} upstream error on {model}: {detail}")
            raise RuntimeError(f"{self.name} upstream error on {model}: {detail}")

        tool_calls = []
        for i, tc in enumerate(msg.get("tool_calls") or []):
            call = {
                # Gemini can return an empty id; tool results are paired back by id.
                "id": tc.get("id") or f"call_{i}",
                "name": tc["function"]["name"],
                "arguments": json.loads(tc["function"]["arguments"] or "{}"),
            }
            # Gemini 3 thought_signature rides in extra_content and must be echoed
            # back on the assistant tool_calls message or the next call 400s.
            if tc.get("extra_content"):
                call["extra_content"] = tc["extra_content"]
            tool_calls.append(call)
        return LLMResponse(content=msg.get("content"), tool_calls=tool_calls, raw_finish_reason=finish)
