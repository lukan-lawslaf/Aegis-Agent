# SIH-OLLAMA — Server Side (Laptop B)

FastAPI gateway + Ollama for the SIH 26171 Aegis-Agent extension.
**Read `client_context.md` first** — it is the full client/server contract.

## Quick start (Windows PowerShell)

```powershell
# 1. Ollama daemon (install from https://ollama.com if missing)
ollama serve   # or start the Ollama app

# 2. Pull the models you want to test (see table below)
ollama pull qwen3-vl:4b
ollama pull qwen3-vl:2b
ollama pull qwen3.5:4b
ollama pull qwen3.5:2b
ollama signin
ollama pull qwen3-vl:235b-cloud   # Ollama-cloud test model
ollama pull gemma4:31b-cloud      # Ollama-cloud test model

# 3. Gateway
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item ..\.env.example .env
uvicorn app:app --host 0.0.0.0 --port 8000
```

## Verify

```powershell
# same laptop
python backend/smoke_test.py

# from the client laptop (replace IP)
curl http://<THIS-LAPTOP-IP>:8000/health
```

If the client laptop cannot reach it: allow port 8000 through Windows Firewall
(Settings → Network & Internet → Advanced security → Inbound rule, TCP 8000),
and make sure both laptops are on the same hotspot/LAN.

## Connect the extension (client laptop)

In the **nanobrowser repo root** create/edit `.env`:

```text
VITE_SIH_FASTAPI_URL=http://<server-laptop-ip>:8000/v1
VITE_SIH_QWEN_MODEL=qwen3-vl:4b
```

Then `pnpm build`, reload the unpacked extension from `dist/`.

## Model matrix

| Tag | Role | Runtime |
|---|---|---|
| `qwen3-vl:2b` | primary (low latency) | local |
| `qwen3-vl:4b` | primary (default) | local |
| `qwen3.5:2b` | test | local |
| `qwen3.5:4b` | test | local |
| `qwen3-vl:235b-cloud` | test (quality reference) | Ollama cloud |
| `gemma4:31b-cloud` | test | Ollama cloud |

Cloud models require `ollama signin` on this laptop and bill through the signed-in
account. The final demo stays on the 2b/4b local models — the test matrix exists
to pick the best performer with recorded evidence.

## Switching models

Two ways, both client-side:

1. **Allow-list (default)**: gateway honors any model id in `QWEN_ALLOWED_MODELS`
   (`.env`). On the client laptop set `VITE_SIH_QWEN_MODEL=<tag>`, rebuild, reload.
2. **Plug-and-play**: set `ALLOW_ANY_MODEL=true` in `.env` and restart the gateway —
   any tag the client requests is forwarded as-is, so you can A/B tags without
   touching the server again. Keep it `false` when you want a strict list.

Add or remove tags in `QWEN_ALLOWED_MODELS` any time; it is plain env config,
no code change. Note: non-VL models (e.g. `qwen3.5:2b/4b` without the `-vl`
suffix) cannot read the sanitized screenshots the extension sends — they work
for text-only steps but will fail vision steps. Keep that in mind when scoring.

## Repo layout

```text
backend/
  app.py          # FastAPI gateway (OpenAI-compatible proxy to Ollama)
  requirements.txt
  smoke_test.py   # health/models/chat smoke checks
client_context.md # full client↔server contract (read this first)
.env.example
```

## Rules for anyone (human or AI) editing this repo

- Never log message content, images, or credentials — metadata only.
- Keep the client-facing API byte-compatible: `/health`, `/v1/models`,
  `/v1/chat/completions` (streaming + multimodal + response_format).
- Model allow-list lives in `QWEN_ALLOWED_MODELS` (`.env`); unknown ids remap
  to `QWEN_MODEL`, never 404.
- Provider selection stays server-side (`QWEN_BACKEND=ollama|openai`).
