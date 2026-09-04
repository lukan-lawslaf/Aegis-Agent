# SIH Aegis Agent

SIH Aegis Agent is a privacy-preserving lightweight browser agent for Smart India Hackathon problem statement **26171**.

It runs as a browser extension on the user's computer. The extension observes the current page locally, removes sensitive information, and sends only a sanitized page description to a FastAPI gateway. The gateway runs the single reasoning model: **Qwen3-VL 2B/4B**.

## Current architecture

```text
Chrome / Firefox extension
        |
        v
Local DOM + privacy filtering
        |
        v
Sanitized context -> FastAPI gateway -> Qwen3-VL
        ^                                      |
        |                                      v
        +------- validated browser action ---+
```

The extension does not store cloud API keys and does not call OpenRouter or other model providers directly. The FastAPI server can choose between local Ollama and an OpenAI-compatible API without changing the extension.

## Privacy features currently included

- Password and credential field masking
- Email, phone-number and payment-number masking
- Sanitization of page text before model prompts
- Screenshot masking before visual context leaves the browser
- Local BlazeFace face detection through ONNX Runtime Web (WebGPU/WASM)
- Analytics disabled by default
- Fail-closed text egress guard primitives

OCR, richer redaction manifests and the complete cross-browser action validator are planned next. A compatible `blazeface.onnx` file must be supplied locally; the detector never sends images to the server.

## Repository layout

- `chrome-extension/` — browser extension source
- `chrome-extension/src/background/sih/privacy.ts` — privacy pipeline primitives
- `chrome-extension/src/background/sih/gateway.ts` — FastAPI/Qwen model client
- `SIH_CLIENT.md` — client implementation notes
- `../project_context.md` — shared project context for the whole team

This repository is a working adaptation of the open-source [Nanobrowser](https://github.com/nanobrowser/nanobrowser) extension. Its Apache-2.0 license and attribution are preserved. Nanobrowser supplies the initial extension shell and browser-agent infrastructure; the SIH privacy and model-boundary changes are maintained here.

## Local configuration

Copy `.env.sih.example` to `.env` and set the FastAPI address:

```env
VITE_SIH_FASTAPI_URL=http://127.0.0.1:8000/v1
VITE_SIH_QWEN_MODEL=qwen3-vl:4b
```

The gateway must expose an OpenAI-compatible `/chat/completions` endpoint.

## Build and test

Requirements: Node.js 22+ and pnpm 9+.

```bash
pnpm install
pnpm build
```

Load the generated `dist` folder as an unpacked extension in Chrome. The Firefox build uses `__FIREFOX__=true` and can be loaded temporarily from `about:debugging`.

Run the privacy tests:

```bash
pnpm -F chrome-extension test -- privacy.test.ts
```

## Development direction

1. Complete DOM/action validation and confirmation gates.
2. Add local BlazeFace/MediaPipe or face-api.js detection.
3. Add OCR fallback for canvas and image-only text.
4. Implement the FastAPI server with Ollama and API provider adapters.
5. Finish Firefox's shared DOM action executor.
6. Run Chrome and Firefox privacy/security fixture suites.

## License

SIH Aegis Agent is distributed under the Apache License 2.0. See [`LICENSE`](LICENSE). See [`SIH_CLIENT.md`](SIH_CLIENT.md) for adaptation details and inherited-project attribution.
