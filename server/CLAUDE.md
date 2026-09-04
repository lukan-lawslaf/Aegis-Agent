# CLAUDE.md — SIH-OLLAMA (server laptop)

Guidance for AI coding assistants working in this repository.

## What this is

The server half of SIH 26171 Problem Statement 26171 (Aegis-Agent): a FastAPI
gateway that gives the browser extension (built on the client laptop) an
OpenAI-compatible API over a local Ollama daemon running Qwen3-VL.

`client_context.md` is the authoritative client↔server contract — read it
before changing any route or behavior.

## Commands

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --reload   # dev
python smoke_test.py                                    # health/models/chat checks
```

Python 3.11+. Windows PowerShell is the primary environment.

## Non-negotiables

1. **Privacy**: never log message content, base64 images, or credentials.
   The extension already sanitized payloads, but they are still user-adjacent.
   Logs: model id, status code, latency, token counts only.
2. **API stability**: the extension is built on another laptop and only talks
   to `/health`, `/v1/models`, `/v1/chat/completions`. Never break these;
   additive changes only.
3. **Single-brain invariant**: Qwen3-VL is the only reasoning model. Planner /
   Navigator / Validator are prompt roles of the same model, not separate
   services. Do not add another LLM.
4. **Model allow-list**: `QWEN_ALLOWED_MODELS` env (default
   `qwen3-vl:2b,qwen3-vl:4b,qwen3-vl:235b-cloud,qwen3.5:2b,qwen3.5:4b,gemma4:31b-cloud`).
   Client-requested model ids in the list are honored; anything else silently
   remaps to `QWEN_MODEL`. `ALLOW_ANY_MODEL=true` forwards any tag (plug-and-play
   test mode). Cloud (`*-cloud`) models bill through the signed-in Ollama account;
   do not make them the default. The final demo uses 2b/4b local.
5. **Provider neutrality**: `QWEN_BACKEND=ollama|openai` switches the upstream
   without changing the client-facing API. Ollama is the default/offline mode.

## Gotchas

- LangChain on the client sends `temperature 0.1`, `max_tokens 4096`, JSON-schema
  `response_format`, tool calls, and multimodal messages (base64 image parts).
  All must pass through to Ollama unchanged — the gateway is a transparent proxy,
  not a validator.
- Ollama's OpenAI-compatible endpoint is `http://127.0.0.1:11434/v1/...`.
- Bind `0.0.0.0` for the two-laptop LAN demo; remember the Windows firewall rule
  (TCP 8000 in).
- Streaming responses use SSE — keep the `stream: true` passthrough path intact.
- Cloud (`*-cloud`) models bill through the signed-in Ollama account; do not
  make them the default.

## Style

- Small, focused patches; no reformatting of untouched code.
- Type hints with `from __future__ import annotations` style already in use.
- Comments explain *why* (privacy, spec limits), not *what*.
