# SIH 26171 client extension

This directory is an Apache-2.0 Nanobrowser-derived client adaptation. The SIH
changes enforce a single model boundary: the extension sends sanitized context
to FastAPI, and FastAPI owns local Ollama versus OpenAI-compatible provider
selection. No provider API key belongs in the extension.

## Local configuration

Copy `.env.sih.example` to `.env` at the repository root and set
`VITE_SIH_FASTAPI_URL` to the friend's gateway address. For a local smoke test,
use `http://127.0.0.1:8000/v1`. The server must expose an OpenAI-compatible
`/chat/completions` endpoint under that prefix.

The default model label is `qwen3-vl:4b`; the server may map it to the 2B
variant, Ollama, or an OpenAI-compatible cloud model. The browser code does not
select providers or store provider credentials.

## Build and load

From this directory, install dependencies with pnpm and run `pnpm build`. Load
the generated `dist` directory through Chrome's `chrome://extensions` →
Developer mode → Load unpacked. For the Firefox build, run the build with
`__FIREFOX__=true`, then load it temporarily from `about:debugging`.

## Privacy boundary

`src/background/sih/privacy.ts` contains dependency-free PII classification,
text sanitization and the native screenshot fallback. `Page.takeScreenshot()`
adds DOM-first masks before encoding screenshots. Prompt text is sanitized before
it is passed to the single FastAPI-backed chat model. Analytics is disabled by
default for SIH builds.

This is the first vertical slice. OCR/face-model adapters and a richer redaction
manifest are deliberately isolated behind the same privacy module so they can be
added without creating a second reasoning model or a second network path.

## Local BlazeFace

The extension includes an ONNX Runtime Web BlazeFace adapter in
`chrome-extension/src/background/sih/blazeface.ts`. It prefers WebGPU and falls
back to WASM. Put a compatible standalone BlazeFace ONNX model at
`chrome-extension/public/models/blazeface.onnx`, or set
`VITE_SIH_BLAZEFACE_MODEL_URL` to a local extension URL. Face boxes are detected
in memory and blurred before the screenshot is passed to Qwen3-VL. The model
and face pixels are never sent to FastAPI. If the model file is absent, the
existing DOM/PII masks still run, but visual egress fails closed until the
model is available.

## Verification

Run the privacy unit tests with:

```text
pnpm -F chrome-extension test -- privacy.test.ts
```

The upstream checkout currently has unrelated type-check failures in its Llama
helper and manifest-parser type import; do not treat those as SIH privacy test
failures.
