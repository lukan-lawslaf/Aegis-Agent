# SIH 26171 — Client Handoff & Server Requirements

> Status: **Client side complete and verified** (Laptop A). This document is the
> contract for the server side (Laptop B). Read it fully before writing server code.

---

## 1. Problem statement

**SIH 2026, Problem 26171 — On-device Visual Perception for Light-weight Browser Agents (ISRO / Smart Automation).**

A browser extension that locally understands and sanitizes the visible page
(faces, passwords, PII) before sending **only anonymized context** to an
on-premise/LAN reasoning server, then safely executes the returned browser action.

Evaluation weights: visual-context accuracy 25%, PII detection 20%, redaction
precision 20%, client resource utilization 20%, end-to-end latency 15%.

## 2. Architecture

```text
Laptop A (client, done)                       Laptop B (server, this repo)
┌──────────────────────────────────┐          ┌─────────────────────────────┐
│ Chrome MV3 extension (Aegis-Agent)│         │ FastAPI gateway (:8000)     │
│  side panel UI (React)            │  HTTP   │  ├─ /health                 │
│  background service worker        │────────>│  ├─ /v1/models              │
│   ├─ Planner/Navigator/Validator  │ OpenAI- │  └─ /v1/chat/completions    │
│   │   (all one model, prompt roles)│ compat │        │                    │
│   ├─ privacy firewall             │         │        v                    │
│   │   ├─ DOM PII masks (pre-shot) │         │  Ollama daemon (:11434)     │
│   │   ├─ BlazeFace onnxruntime-web│         │   ├─ qwen3-vl:2b  (local)   │
│   │   │   face detect + 18px blur │         │   ├─ qwen3-vl:4b  (local)   │
│   │   └─ sanitizeText for text    │         │   └─ qwen3-vl:235b-cloud    │
│   └─ puppeteer/CDP action exec    │         │      (Ollama cloud, test)   │
└──────────────────────────────────┘          └─────────────────────────────┘
```

**Single-brain invariant:** Qwen3-VL is the ONLY generative/planning model.
Planner / Navigator / Validator are prompt+tool roles of the same model, not
separate models. Browser-side CV (BlazeFace) is a narrow privacy utility.

**Privacy invariant:** no raw screenshot, raw DOM dump, form value, PII text, or
credential ever leaves Laptop A. The LAN is a network boundary; sanitization
happens before it. The server must treat `[REDACTED_EMAIL]`,
`[REDACTED_PHONE]`, `[REDACTED_PAYMENT]` markers as normal text.

## 3. What is done on the client (Laptop A)

Extension: `nanobrowser` monorepo, builds to `dist/`, loaded unpacked in Chrome.

**Privacy pipeline (fully working, E2E-tested in a real Chrome service worker):**

- **Text egress**: every string sent to the model passes `sanitizeText()`
  (email → `[REDACTED_EMAIL]`, phone → `[REDACTED_PHONE]`, card → `[REDACTED_PAYMENT]`)
- **Vision egress** (every screenshot, in order):
  1. DOM-first masks injected into the page before pixels are encoded —
     password/credential/secret inputs, payment fields, and leaf elements whose
     rendered text matches email/phone patterns get solid black boxes
  2. `chrome.tabs.captureVisibleTab` (with quota backoff) or puppeteer CDP screenshot
  3. **BlazeFace** face detection via onnxruntime-web running inside the service
     worker (wasm backend, single-threaded) → detected faces blurred 18px
  4. Fails CLOSED: if the face model is unavailable, visual egress is refused
- **OR runtime embedding** (the hard-won part): dynamic `import()` is banned in
  Chrome service workers, and a 28MB-wasm-inlined bundle gets the worker killed.
  Solution: classic service worker + ORT webgpu-bundle rewritten to a classic
  script and **appended directly into `background.iife.js`** at build time;
  wasm binaries fetched lazily from `dist/ort/`. Manifest CSP includes
  `'wasm-unsafe-eval'`.
- **Model file**: `dist/models/blazeface.onnx` (536KB), inputs
  `image, conf_threshold, max_detections, iou_threshold`
- **Preview**: the side panel's "capture active tab" routes through the
  background worker and the same sanitization pipeline — the preview image is
  what the model would see

**Agent system:** Planner → Navigator (DOM actions via puppeteer/CDP through
`chrome.debugger`) → Validator loop, all calling one OpenAI-compatible endpoint
via LangChain `ChatOpenAI`.

**Client-side knobs the server must know about:**
- Gateway URL: `VITE_SIH_FASTAPI_URL` env at BUILD time (default `http://127.0.0.1:8000/v1`).
  For LAN: set `http://<laptop-B-LAN-IP>:8000/v1`, rebuild (`pnpm build`), reload extension.
- Model name: `VITE_SIH_QWEN_MODEL` env at BUILD time (default `qwen3-vl:4b`).
  The model id in each request is what the gateway should honor.
- Request headers: `X-SIH-Protocol-Version: 1.0` (informational), `Authorization: Bearer sih-gateway` (dummy).
- Params LangChain sends: `temperature: 0.1`, `max_tokens: 4096`, and for
  structured steps a JSON-schema `response_format` / tool calls — the gateway
  must pass these through to Ollama unchanged.

## 4. Server contract (what Laptop B must implement)

This repo implements it. Keep these exact routes:

| Route | Method | Notes |
|---|---|---|
| `/health` | GET | JSON, 200. Must not require auth. Extension settings ping it. |
| `/v1/models` | GET | OpenAI-style list. Should include `qwen3-vl:2b`, `qwen3-vl:4b`, `qwen3-vl:235b-cloud`. |
| `/v1/chat/completions` | POST | Full OpenAI chat format. Must support: multimodal messages (base64 image parts), `stream: true` (SSE), `response_format` JSON schema, tool calls. |

Rules:
1. **Honor the requested model** when it is in the allow-list (so 2b/4b/235b-cloud
   can be switched client-side); remap anything else to the default. Never 404 on model id.
2. **CORS `*`** (extension pages + service worker fetch).
3. **Bind `0.0.0.0`** for the LAN demo, with a Windows firewall rule for port 8000.
4. **Never log message content or images** — the sanitized payload is still
   user-adjacent data; logs carry metadata only (model, status, latency).
5. Provider selection stays server-side: `QWEN_BACKEND=ollama` (default) or
   `openai` (any OpenAI-compatible server, e.g. vLLM) — client API never changes.
6. `qwen3-vl:235b-cloud` runs through Ollama's cloud (requires `ollama signin` on
   the server laptop). It is a TEST model for quality comparison only — the demo
   story remains 2b/4b local.

## 5. Models

| Tag | Role | Notes |
|---|---|---|
| `qwen3-vl:2b` | primary (low latency) | local |
| `qwen3-vl:4b` | primary (default) | local |
| `qwen3.5:2b` | test | local; text-only — cannot read sanitized screenshots |
| `qwen3.5:4b` | test | local; text-only — cannot read sanitized screenshots |
| `qwen3-vl:235b-cloud` | test (quality reference) | Ollama cloud; needs `ollama signin` |
| `gemma4:31b-cloud` | test | Ollama cloud; needs `ollama signin` |

The gateway's `QWEN_ALLOWED_MODELS` env is the source of truth for which tags
the client may switch to; `ALLOW_ANY_MODEL=true` forwards any tag (plug-and-play).
The final demo stays on 2b/4b local — the test matrix picks the winner with
recorded latency/accuracy evidence.

## 6. Demo test plan (both laptops)

1. Server laptop: Ollama up, models pulled, gateway on `0.0.0.0:8000`, `python backend/smoke_test.py` green.
2. Client laptop: extension rebuilt with `VITE_SIH_FASTAPI_URL=http://<server-ip>:8000/v1`, reloaded.
3. Side panel → settings → ping gateway → "gateway responding".
4. Open a page with faces + a login form → Privacy Preview → capture: faces blurred, inputs blacked.
5. Run a task (e.g. "find the contact email on this page"): observe plan → act → validate loop,
   model sees only redacted context, actions execute locally.
6. Compare quality: same task with 2b vs 4b vs 235b-cloud (client env `VITE_SIH_QWEN_MODEL`, rebuild, reload).

## 7. Known client-side notes

- Extension **only** in Chrome/Edge (MV3, sidePanel API).
- The panel's settings URL field is a ping-test only; the real endpoint is the build-time env var.
- Vision tasks fail closed when the face model cannot load — that is by design.
- Unit tests: `pnpm -F chrome-extension test` (17 passing).
