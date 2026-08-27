"""OpenRouter provider — any model on OpenRouter (openai/gpt-4o, deepseek/*, etc.)."""
import json
import os
import time
import urllib.error
import urllib.request

from .base import LLMProvider, LLMResponse, ProviderUnavailable

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


MAX_429_RETRIES = 2  # bounded — was an unbounded time.sleep(15)+recurse loop that
                      # could hang a request indefinitely under sustained rate-limiting


class OpenRouterProvider(LLMProvider):
    name = "openrouter"

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
            "max_tokens": 2048,
            "temperature": temperature,
        }
        if tools:
            body["tools"] = tools
            body["tool_choice"] = "required" if force_tool else "auto"
        if json_mode:
            body["response_format"] = {"type": "json_object"}

        payload = json.dumps(body).encode()
        req = urllib.request.Request(
            OPENROUTER_URL,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "HTTP-Referer": "https://intellisource.kpmg.com",
                "X-Title": "IntelliSource P2P",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                data = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            err_body = e.read().decode()
            if e.code == 429:
                if _retry_count >= MAX_429_RETRIES:
                    # Bounded out — treat as a transient outage so the cascade
                    # escalates to the next tier instead of hanging forever.
                    raise ProviderUnavailable(f"OpenRouter rate-limited after {MAX_429_RETRIES} retries: {err_body}")
                time.sleep(15)
                return self.chat(messages, model, tools, json_mode, temperature, force_tool, _retry_count + 1)
            raise RuntimeError(f"OpenRouter API error {e.code}: {err_body}")
        except (urllib.error.URLError, TimeoutError) as e:
            raise ProviderUnavailable(f"OpenRouter unreachable: {e}")

        choice = data["choices"][0]
        msg = choice["message"]
        finish = choice.get("finish_reason", "stop")
        if finish == "error":
            # OpenRouter embeds the upstream failure here — usually a rate limit
            # or provider hiccup on a free-tier model. Surface it clearly instead
            # of silently returning an empty response (which the orchestrator
            # would otherwise mistake for "done, no more tools needed").
            detail = choice.get("error") or data.get("error") or {"message": "unknown upstream error"}
            raise RuntimeError(f"OpenRouter upstream error on {model}: {detail}")
        tool_calls = []
        for tc in msg.get("tool_calls") or []:
            tool_calls.append({
                "id": tc["id"],
                "name": tc["function"]["name"],
                "arguments": json.loads(tc["function"]["arguments"] or "{}"),
            })
        return LLMResponse(content=msg.get("content"), tool_calls=tool_calls, raw_finish_reason=finish)
