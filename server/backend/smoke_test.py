"""Smoke tests for the SIH gateway. Run with the server up:

    python smoke_test.py [base_url]

Checks health, model listing, model pass-through, and a tiny chat completion.
Exits non-zero on the first failure.
"""

from __future__ import annotations

import sys

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"


def check(name: str, ok: bool, detail: str = "") -> None:
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f" — {detail}" if detail else ""))
    if not ok:
        sys.exit(1)


EXPECTED_MODELS = [
    "qwen3-vl:2b",
    "qwen3-vl:4b",
    "qwen3-vl:235b-cloud",
    "qwen3.5:2b",
    "qwen3.5:4b",
    "gemma4:31b-cloud",
]


def main() -> None:
    with httpx.Client(timeout=120) as client:
        health = client.get(f"{BASE}/health")
        check("health 200", health.status_code == 200, str(health.json()))
        check("health reports ollama", "ollama" in health.json())

        models = client.get(f"{BASE}/v1/models")
        ids = [m.get("id") for m in models.json().get("data", [])]
        check("models 200", models.status_code == 200, ", ".join(str(i) for i in ids))

        # The gateway lists pulled models via Ollama (static allow-list only
        # when the daemon is unreachable). Missing tags = not pulled yet.
        present = [m for m in EXPECTED_MODELS if m in ids]
        missing = [m for m in EXPECTED_MODELS if m not in ids]
        check(
            "at least one expected model available",
            bool(present),
            f"present: {present or 'none'}; not pulled yet: {missing or 'none'}",
        )

        default_model = health.json().get("model", "qwen3-vl:4b")
        chat = client.post(
            f"{BASE}/v1/chat/completions",
            json={
                "model": default_model,
                "messages": [{"role": "user", "content": "Reply with exactly: gateway-ok"}],
                "max_tokens": 20,
                "temperature": 0,
            },
        )
        ok = chat.status_code == 200 and chat.json().get("choices")
        text = chat.json().get("choices", [{}])[0].get("message", {}).get("content", "") if ok else chat.text[:200]
        check(f"chat completion {default_model}", bool(ok), str(text)[:120])

        unknown = client.post(
            f"{BASE}/v1/chat/completions",
            json={
                "model": "gpt-4o",
                "messages": [{"role": "user", "content": "hi"}],
                "max_tokens": 10,
            },
        )
        # Unknown model must be remapped to the default, not forwarded raw.
        check("unknown model remapped", unknown.status_code != 404, unknown.text[:120])

    print("all smoke tests passed")


if __name__ == "__main__":
    main()
