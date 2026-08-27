"""Ollama provider — local models (llama3.2, deepseek-r1, qwen2.5, ...).

No API key, no egress — the whole point of the cascade's cheap tier. JSON-mode
and tool-calling are both supported by Ollama's /api/chat for tool-capable
models; small models are far more reliable when constrained this way than
free-form.
"""
import json
import os
import urllib.error
import urllib.request

from .base import LLMProvider, LLMResponse, ProviderUnavailable

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")


class OllamaProvider(LLMProvider):
    name = "ollama"

    def chat(
        self,
        messages: list[dict],
        model: str,
        tools: list[dict] | None = None,
        json_mode: bool = False,
        temperature: float = 0.1,
        force_tool: bool = False,
    ) -> LLMResponse:
        body: dict = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if tools:
            body["tools"] = tools
        if json_mode:
            body["format"] = "json"

        payload = json.dumps(body).encode()
        req = urllib.request.Request(
            f"{OLLAMA_BASE_URL}/api/chat",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"Ollama error {e.code}: {e.read().decode()}")
        except (urllib.error.URLError, ConnectionRefusedError, TimeoutError) as e:
            raise ProviderUnavailable(f"Ollama unreachable at {OLLAMA_BASE_URL}: {e}")

        msg = data.get("message", {})
        tool_calls = []
        for i, tc in enumerate(msg.get("tool_calls") or []):
            fn = tc.get("function", {})
            args = fn.get("arguments", {})
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except json.JSONDecodeError:
                    args = {}
            tool_calls.append({"id": f"ollama_tc_{i}", "name": fn.get("name", ""), "arguments": args})

        finish = "tool_calls" if tool_calls else "stop"
        return LLMResponse(content=msg.get("content"), tool_calls=tool_calls, raw_finish_reason=finish)
