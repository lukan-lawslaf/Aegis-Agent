# SIH 2026 — Problem 26171 Project Context

> **Status:** Client side (extension) implemented and E2E-verified on Laptop A.
> Server side (FastAPI gateway + Ollama) lives in `github.com/lukan-lawslaf/SIH-OLLAMA`
> and is being brought up on Laptop B. This file remains the stable cross-tool context.
>
> **Last updated:** 2026-09-04 (IST)

## 0. Current implementation status

- **Client (Laptop A, done):** Chrome MV3 extension (nanobrowser-derived) in
  `Documents/SIH/nanobrowser`, builds to `dist/`. Privacy firewall fully working:
  DOM PII masks pre-capture, BlazeFace (onnxruntime-web, wasm) face detection +
  18px blur running inside the service worker, `sanitizeText()` for text egress,
  fail-closed on missing face model, sanitized Privacy Preview. Full details and
  the server contract are in `ollama-setup/client_context.md` (also in the
  SIH-OLLAMA repo).
- **Server (Laptop B, in progress):** `github.com/lukan-lawslaf/SIH-OLLAMA` —
  FastAPI OpenAI-compatible gateway (`/health`, `/v1/models`, `/v1/chat/completions`
  with streaming + multimodal + structured output) over a local Ollama daemon.
- **Model test matrix (plug-and-play):** primary demo models `qwen3-vl:2b` and
  `qwen3-vl:4b` (local); test models `qwen3.5:2b`, `qwen3.5:4b` (local, text-only —
  cannot read sanitized screenshots), `qwen3-vl:235b-cloud` and `gemma4:31b-cloud`
  (Ollama cloud, need `ollama signin`). The gateway allow-list is env-driven
  (`QWEN_ALLOWED_MODELS`, plus `ALLOW_ANY_MODEL=true` passthrough mode) so any tag
  can be A/B-tested client-side by rebuilding with `VITE_SIH_QWEN_MODEL=<tag>`.
  The final demo must stay on a local 2b/4b model; pick from recorded
  latency/accuracy evidence.

## 1. Project identity

- **Event:** Smart India Hackathon 2026
- **Problem ID:** 26171
- **Title:** *On-device Visual Perception for Light-weight Browser Agents*
- **Organisation / theme:** ISRO / Smart Automation
- **One-line product:** A browser extension that locally understands and sanitizes the visible page before sending only anonymized context to an on-premise/LAN reasoning server, then safely executes the returned browser action.

The core innovation is **a privacy firewall in front of a browser vision agent**, not merely using a particular VLM.

## 2. Official problem requirements (source of truth)

The deliverable must be a working browser extension plus server and demonstrate:

1. **Local vision processing:** a browser-side ViT *or equivalent computer-vision model* evaluates current screen state (WebGPU/WASM/ONNX Runtime Web/Transformers.js are suggested routes).
2. **Privacy filter before every network request:** dynamically detect and redact sensitive content—e.g. faces, passwords, PII. The server must understand that the supplied context contains redactions.
3. **Server integration:** a central LLM/VLM processes sanitized context and returns data or browser actions such as click/scroll; the browser executes them.
4. **A complete assisted task:** show the agent observing, acting, re-observing and completing a workflow.

Evaluation weights:

| Metric | Weight |
|---|---:|
| Visual-context accuracy | 25% |
| Sensitive/PII detection precision and recall | 20% |
| Redaction precision | 20% |
| Client resource utilization | 20% |
| End-to-end latency | 15% |

**Architecture implication:** DOM-only privacy plus a server VLM is insufficiently aligned. The extension needs an explicit local visual-perception component, while the server VLM remains the heavy planner/reasoner.

## 3. Team direction and intended deployment

The intended two-machine demo is retained:

```text
Laptop A: Chrome/Edge extension (eyes, privacy firewall, hands)
    └── direct LAN / Ethernet / hotspot → FastAPI gateway
Laptop B: FastAPI + Qwen3-VL runtime (brain)
                         ├─ local Ollama (default/offline mode)
                         └─ approved cloud API (second SIH demo mode)
```

Target server model is **Qwen3-VL 2B or 4B** depending on measured hardware/latency. FastAPI must expose one stable provider-neutral interface and support two backends:

1. **Local mode:** Ollama (or another compatible local runtime) on the second laptop; no internet model call.
2. **SIH API-compatibility mode:** a cloud-hosted, OpenAI-compatible API endpoint (for example OpenRouter) used only with sanitized context. This is a planned SIH demonstration track, not merely a fallback. The team can evaluate a free endpoint/model such as Inkling where available, but must re-check availability, multimodal support, limits and terms immediately before the event.

**Model test matrix (added 2026-09-04):** alongside the 2B/4B primary pair, the
gateway allow-lists test models for comparison: `qwen3.5:2b`, `qwen3.5:4b` (local,
text-only — no image understanding, so they fail vision steps), and the
Ollama-cloud models `qwen3-vl:235b-cloud` and `gemma4:31b-cloud` (require
`ollama signin`, bill through the account, test-only). All are plug-and-play:
switch by setting `VITE_SIH_QWEN_MODEL` client-side and rebuilding. The winner
for the final demo is chosen from recorded latency/accuracy/VRAM evidence and
must be a local 2B/4B model per the single-brain + offline-demo constraints.

The extension talks only to FastAPI; provider selection and credentials stay server-side. This makes the demo switchable without changing the browser privacy pipeline or action protocol.

**Single-brain invariant:** Qwen3-VL is the only generative/planning/reasoning model in this project. There is no separate Planner model, Navigator model, or speech-to-text model. Planner and navigator are prompt/tool roles performed by the same Qwen3-VL instance. Any browser-side CV model is a narrow privacy/perception utility (for example face boxes), not another agent or “brain.” Speech input, if added later, should use the browser/OS speech API or remain out of the MVP.

No raw browser screen, DOM dump, form value, PII text, or user credential may be sent from the extension. A LAN is still a network boundary; sanitization must happen before that boundary. In cloud demonstration mode, FastAPI may forward only the already-sanitized payload to the selected API provider; it must never forward the original context.

## 4. Target architecture

```text
User task
  ↓
Extension side panel + MV3 service worker
  ↓
Visible-tab capture + local DOM/accessibility extraction
  ↓
LOCAL PERCEPTION AND PRIVACY FIREWALL (must run before egress)
  ├─ DOM-sensitive-field detector (password, token, payment/identity fields)
  ├─ local face detector (BlazeFace/MediaPipe or face-api.js)
  ├─ local text/PII detector (DOM text first; OCR fallback for canvas/images)
  ├─ narrow local visual utility (face/region detection; no planning)
  ├─ coordinate mapper and mask/blur renderer
  └─ egress guard: accepts only sanitized payloads
  ↓
Sanitized screenshot/crops + minimal structured UI map + redaction manifest
  ↓  LAN only (extension → FastAPI)
FastAPI policy gateway → provider adapter → Qwen3-VL 2B/4B
                              ├─ Ollama/local runtime
                              └─ OpenAI-compatible cloud API (optional SIH demo)
  ↓
Strict structured action proposal (not JavaScript)
  ↓
LOCAL action validator → Chrome CDP/content-script executor
  ↓
Observe changed state and repeat until complete or user confirmation is required
```

### 4.1 Data contract (design rule)

The extension sends a versioned payload resembling:

```json
{
  "protocol_version": "1.0",
  "sanitized_viewport": "<encoded image or local reference>",
  "ui_map": [{"ref": "e12", "role": "button", "label": "Send", "bbox": [0, 0, 0, 0]}],
  "redactions": [{"bbox": [0, 0, 0, 0], "kind": "password", "method": "solid-mask"}],
  "task_state": {"step": 2, "allowed_origins": ["demo.example"]}
}
```

The server receives neither original pixels nor sensitive values. The redaction manifest tells it that a region is intentionally unavailable without leaking its contents.

The server returns a narrow schema such as:

```json
{"action":"click","target_ref":"e12","reason":"visible Send button"}
```

Allowed verbs for the MVP: `click`, `type`, `scroll`, `wait`, `request_user_confirmation`, `done`. The client resolves refs against the *current* DOM/layout and rejects stale or invalid proposals. It must not execute model-supplied arbitrary JavaScript.

## 5. Privacy, safety, and scoring strategy

### Privacy detection must be layered

| Layer | Primary coverage | Why it exists |
|---|---|---|
| DOM semantics | password fields, form controls, `autocomplete`, labels, input types | Fast, precise, nearly free |
| Pattern and NER checks | email, phone, IDs, addresses/names in visible DOM text | Increases PII coverage beyond passwords |
| Local vision | faces and non-DOM visual regions | Meets the visual-perception requirement |
| OCR fallback | text rendered into canvas/image/PDF/video frame | Covers PII the DOM cannot expose |
| Conservative policy | uncertain sensitive region | Mask it; optimize recall before cosmetic fidelity |

**Important:** PII detection is not optional for the final prototype. It directly represents 40% of evaluation when paired with redaction precision.

### Non-negotiable controls

- Redact prior to capture payload serialization, not merely in the UI preview.
- Remove all direct cloud-provider configuration from the extension. One audited FastAPI endpoint is the only AI egress path; its provider adapter may target Ollama or an approved OpenAI-compatible cloud endpoint.
- In cloud mode, log provider/model, request size, and timing—but never prompts containing raw sensitive data, API keys, or unsanitized images.
- Keep a local audit record containing region types and hashes/metadata, **never raw secrets**.
- Require user confirmation for irreversible or high-impact actions (send/post/purchase/delete/upload/submit sensitive form).
- Block or require explicit re-authorization for banking, health, identity, crypto, and government-login origins.
- Treat page text as untrusted data: it must not change the agent's system policy or unlock tools.
- Provide a panic-stop control and a clear “what will be sent” preview for the demo.

### How to demonstrate compliance to judges

For each test, show side-by-side: original local screen → detected regions → sanitized payload preview → action trace. Record per-stage timing and report PII detection/redaction precision and recall on a labelled test set.

## 6. Browser-agent repository research (2026-08-28)

Research objective: find a lightweight, credible, open-source foundation whose **extension architecture** can be adapted to the FastAPI/Qwen3-VL privacy boundary. Star counts are a point-in-time signal, not a security audit.

| Repository | Evidence / license / maturity | Useful parts | Decision |
|---|---|---|---|
| [Nanobrowser](https://github.com/nanobrowser/nanobrowser) | Apache-2.0; ~13.7k stars; active Chrome/Edge MV3 extension; supports Ollama and custom OpenAI-compatible providers | Extension layout, side panel, typed agent loop, validation boundary, provider abstraction | **Recommended architecture reference.** Its three-role model configuration is **not** our design. Reuse only extension/agent-loop ideas; replace its provider/egress boundary with the privacy gateway and make Qwen3-VL the sole model. |
| [Browser Use](https://github.com/browser-use/browser-use) | MIT; ~95.9k stars; mature Python automation ecosystem | Agent-loop ideas, state/action abstractions, structured tools, benchmark patterns | **Architecture reference only.** It is server/Python/automation-framework shaped rather than a browser-extension privacy firewall. Do not make it the MVP base. |
| [Browser Agent (lusipad)](https://github.com/lusipad/browser-agent) | MIT; very new (~1 star), but exactly MV3 + OpenAI-compatible endpoint | Set-of-marks, same-origin iframe/shadow-DOM handling, local per-site authorization, planner/validator, tests/bench structure | **Read selectively.** Good current design reference; insufficient maturity for a foundation. |
| [BrowserBee](https://github.com/parsaghaffari/browserbee) | Apache-2.0; ~977 stars; maintainer explicitly stopped work in Oct 2025 | In-browser agent/tool boundary, local Ollama support, user confirmations, lessons on compact context | **Do not base on it.** Read its design lessons only; its maintenance status is a risk. |
| [WebBrain](https://github.com/webbrain-one/webbrain) | ~955 stars; current releases GPL-3.0-or-later (earlier releases MIT); Chrome + Firefox; supports llama.cpp/Ollama/vLLM | Cross-browser packaging and local endpoint configuration | **Avoid as a fork** unless the team deliberately accepts GPL obligations. Consider only for Firefox ideas later. |
| [Navy Browser Agent](https://github.com/zrnge/navybrowser) | MIT; very new (~1 star) | Very small MV3 service-worker architecture and a clean diagram of panel → agent → CDP executor → LLM client | **Do not adopt.** Too immature; some capabilities (arbitrary scripts/CAPTCHA handling) conflict with the safer SIH action model. |
| [Taylor-Bayouth Browser Agent](https://github.com/Taylor-Bayouth/browser-agent) | Research/reference project; not selected as a code dependency | Compact rendered “agent map,” targeted crops instead of full screenshot loops, no-change polling | **Borrow the perception principle, not code** until licence/platform support are verified. |

### Chosen direction

Use **Nanobrowser as the primary source base or architecture reference**, because it is the strongest combination of community maturity, permissive licence, extension-native design, and custom/local provider support. Do not copy its model configuration: the SIH build has one Qwen3-VL brain behind FastAPI, with deterministic/local privacy utilities around it.

For the MVP, Qwen3-VL receives the sanitized observation, selects the next typed action, and is called again after the browser state changes. “Planner” and “navigator” are documentation labels for stages in this single-model loop—not separate models. This minimizes model loading, coordination overhead, and latency.

## 7. Adaptation map for the selected foundation

| Existing agent concern | SIH adaptation |
|---|---|
| Model provider chooser / direct provider fetch | Replace with one `SanitizedContextClient` that can call only the team FastAPI endpoint over LAN. |
| Raw screenshot / DOM observation | Route through `PerceptionPrivacyPipeline`; it emits sanitized image, compact UI refs and a redaction manifest only. |
| Generic free-form tool invocation | Use an allow-listed JSON action protocol; no arbitrary JavaScript from the model. |
| Model-only validation | Add deterministic extension-side validation against current DOM, page visibility, consent state and domain policy. |
| Full screenshot each turn | Use compact DOM/AX map by default; send a sanitized screenshot or targeted sanitized crop only when visual evidence is necessary. |
| Cloud settings/UI | Remove/disable for the SIH build and verify egress with a network test. |

## 8. Decision log

| Decision | Status | Rationale |
|---|---|---|
| Browser target | Chrome + Firefox first; Edge/Opera compatibility checks | Chrome/Edge/Opera share most Chromium APIs, while Firefox needs a separate MV3 background/UI manifest path and must pass the same privacy/action tests. |
| Server placement | A second machine on direct LAN | Keeps heavy Qwen3-VL off the extension laptop; the gateway supports both planned SIH demonstrations. |
| Provider compatibility | Ollama + OpenAI-compatible API | Same FastAPI contract powers the local Ollama demo and the cloud/API-compatibility demo. |
| Server model | Qwen3-VL 2B or 4B | Select by measured accuracy/VRAM/latency, not ideology; provider changes must not change the brain model role. |
| Local perception | Required | Directly aligns to the official local ViT/equivalent requirement. Exact model awaits feasibility benchmark. |
| Browser-agent base | Nanobrowser, adapted | Apache-2.0 and mature extension-native architecture; its multi-model configuration is not adopted. |
| Brain model | One Qwen3-VL 2B/4B instance | Same model handles visual interpretation, planning and action selection; no Planner/Navigator/STT models. |
| Control mechanism | Strict JSON + local validator | Prevents unsafe model-authored scripts/actions. |
| PII layer | Required, multi-layer | Needed for scoring and real privacy claims. |

## 9. Future implementation order (not authorization to build now)

1. Read the selected repository's licence, security policy and architecture; make a minimal fork/branch decision.
2. Define payload/action JSON schemas and an egress-denial test before adding models.
3. Add DOM redaction and coordinate mapping; test with password, email, phone and identity-form fixtures.
4. Add face detection and only the narrow local visual utilities needed for privacy/SIH evidence; benchmark CPU/GPU/WASM paths. Do not add a second agent brain.
5. Add OCR/PII fallback only for non-DOM regions and on demand to control resource use.
6. Connect a single FastAPI endpoint to Qwen3-VL through a provider adapter (Ollama first, then OpenAI-compatible API) and enforce structured action output.
7. Implement action validation, confirmations, audit trace and panic stop.
8. Benchmark accuracy, PII recall/precision, redaction precision, client RAM/CPU/GPU, and end-to-end latency.
9. Build the judge demo around a safe mock email/form environment before any real Gmail or high-risk site.

## 10. Multi-AI handoff notes

This file is the stable cross-tool context. Keep it current when an architectural decision changes; do not let temporary chat instructions override it.

| Tool / agent | Appropriate work |
|---|---|
| Claude Code | Complex architecture changes, difficult integrations, security/egress review |
| Codex | Medium-sized modules, tests, research updates, documentation, integration work |
| Antigravity | Small isolated boilerplate/UI/low-risk tasks after interfaces are fixed |
| Hermes-agent | Reproduction, trace analysis and debugging of a well-scoped failing behaviour |

Every handoff should state: current git branch/commit, files changed, command(s) run, measured result, remaining blocker, and whether any raw data could have crossed the privacy boundary.

## 11. Open decisions to resolve with evidence

- Exact narrow local visual utility: select after a browser benchmark on the demo laptop. It must support privacy/perception evidence without becoming a second planner or reasoning model.
- PII NER/OCR model and language support: choose against the final test fixtures and device budget.
- Qwen3-VL 2B vs 4B, quantization, and serving runtime: choose from recorded latency/accuracy/VRAM results.
- Cloud-demo provider/model: verify current OpenRouter (or alternative OpenAI-compatible provider) availability, Inkling/free-model multimodal support, rate limits, retention policy, and structured-output behaviour. The API demo is required, but keep a tested paid/organizational endpoint fallback if the free route changes.
- Whether to fork Nanobrowser or reimplement a smaller extension from its architecture: decide after a short code/licence review and a dependency-weight audit. Nanobrowser's Planner/Navigator/Speech model configuration is explicitly out of scope.
- Demo site and ground-truth evaluation set: use a controllable, consent-safe fixture application first.

## 12. Research sources

- [Official SIH 26171 statement](C:/Users/Nakul/Downloads/sih-problem-statement-26171.md) (local copy supplied by the team)
- [Nanobrowser repository](https://github.com/nanobrowser/nanobrowser)
- [Browser Use repository](https://github.com/browser-use/browser-use)
- [Browser Agent (lusipad) repository](https://github.com/lusipad/browser-agent)
- [BrowserBee repository and maintenance notice](https://github.com/parsaghaffari/browserbee)
- [WebBrain repository and licence information](https://github.com/webbrain-one/webbrain)
- [Navy Browser Agent repository](https://github.com/zrnge/navybrowser)
- [Rendered-map Browser Agent reference](https://github.com/Taylor-Bayouth/browser-agent)

## 13. Cross-browser extension plan (Chrome + Firefox first)

The project should use the **WebExtensions API** with one shared TypeScript/JavaScript codebase and browser-specific manifest/build output. Chrome, Edge and Opera are Chromium-family targets; Firefox implements the same general WebExtensions model but has important differences. “Bing” is not a separate browser extension target—the relevant Microsoft product is **Microsoft Edge** and its Edge Add-ons store.

### Recommended source layout

```text
extension/
  src/
    background.ts          # shared event/message logic
    content.ts             # DOM scanner, redaction and action resolver
    ui/                    # shared panel/options HTML/CSS/TS
    browser-api.ts         # one wrapper around browser.* APIs
  manifests/
    chrome.json            # MV3 + sidePanel/service_worker
    firefox.json           # MV3 + sidebar_action/background scripts
  build/                   # generated chrome/ and firefox/ packages
```

Use `browser.*` with promises in application code and include Mozilla's `webextension-polyfill` for compatibility with older Chrome versions. Keep all browser-specific calls behind `browser-api.ts`; never scatter `chrome.*` checks throughout privacy or agent logic.

### The main Chrome/Firefox differences to design for

| Area | Chrome / Edge / Opera | Firefox | Project rule |
|---|---|---|---|
| Background runtime | MV3 `background.service_worker` | Firefox MV3 does not support `service_worker`; use `background.scripts`/event page | Generate browser-specific manifests. Keep the same background logic, but test lifecycle/restart behaviour separately. |
| Extension API namespace | `chrome.*` historically; modern Chrome supports `browser.*` in newer versions | `browser.*` preferred; `chrome.*` compatibility exists | Use `browser.*` + polyfill. |
| Main agent UI | Chrome `sidePanel` API | Firefox `sidebar_action` (different manifest/UI integration) | Share the panel UI; use an adapter and a Firefox sidebar manifest. A popup/options page is the fallback. |
| Automation | `scripting`, tabs, content scripts; CDP/debugger is Chromium-specific | Content-script/action APIs; do not depend on Chrome CDP | Make DOM-ref actions the common path. Treat CDP as an optional Chrome accelerator, never as the only executor. |
| Extension resource URLs/IDs | `chrome-extension://...` and generally stable IDs | `moz-extension://...` with instance-specific UUIDs unless a Gecko ID is declared | Always call `runtime.getURL()`; do not hard-code extension origins. |
| Rendering/inference | WebGPU/WASM support varies by browser/version | WebGPU/WASM support and performance differ | Feature-detect WebGPU; keep an ONNX/WASM fallback and record benchmark results per browser. |

The official Mozilla guidance notes that a cross-browser MV3 build may include both `background.service_worker` and `background.scripts`: Chrome uses the service worker while Firefox uses scripts. Verify the exact browser versions in CI because support changes over time.

### Local testing does not require store publication

| Browser | Free SIH test path | Important limitation |
|---|---|---|
| Chrome | `chrome://extensions` → Developer mode → **Load unpacked** | This is ideal for the demo laptop. Chrome's one-time Web Store developer registration fee is only needed to publish, not to run a local unpacked build. Windows/macOS self-hosted packed distribution is restricted, but that does not affect unpacked developer testing. |
| Firefox | `about:debugging` → This Firefox → **Load Temporary Add-on** (or `web-ext run`) | Temporary add-on is removed when Firefox restarts. Release/Beta Firefox normally requires Mozilla signing; this is separate from temporary development testing. |
| Edge (Microsoft) | `edge://extensions` → Developer mode → **Load unpacked** | No store listing is required for the SIH demo. Microsoft says Edge Add-ons developer registration has no registration fee if publishing later. |
| Opera | Opera's extensions page → Developer mode → load unpacked Chromium package | Use this only as an additional compatibility check; do not make Opera a required SIH target unless tested. Store/account rules should be rechecked before publication. |

Therefore, **do not publish any store listing for SIH**. Ship a reproducible ZIP/source bundle and a short setup script; judges can load the unpacked build in Chrome and the temporary add-on in Firefox. Store publication can be considered after the prototype is stable.

### Cross-browser acceptance tests

- Load the generated Chrome package in Chrome and Edge, and the Firefox package in Firefox; validate manifest errors before functional tests.
- Exercise the same fixtures for password, email, phone, face and canvas/image PII redaction.
- Verify that no raw payload is sent in either browser by pointing FastAPI at an egress-capture test endpoint.
- Run the same observe → sanitize → Qwen → validate → action loop on Chromium and Firefox.
- Test extension restart, page reload, iframe/shadow-DOM handling, WebGPU unavailable fallback, and permission denial.
- Keep Chrome-only CDP code behind a feature flag; Firefox must pass using the common DOM/content-script executor.

### Official browser-development references

- [Chrome for Developers: Extensions getting started](https://developer.chrome.com/docs/extensions/get-started)
- [Chrome distribution and unpacked extensions](https://developer.chrome.com/docs/extensions/how-to/distribute)
- [Chrome Web Store developer registration](https://developer.chrome.com/docs/webstore/register)
- [MDN: Build a cross-browser extension](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Build_a_cross_browser_extension)
- [Firefox temporary installation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)
- [Firefox distribution/signing](https://extensionworkshop.com/documentation/publish/)
- [Microsoft Edge local sideloading](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/getting-started/extension-sideloading)
- [Microsoft Edge developer account fees](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/create-dev-account)
