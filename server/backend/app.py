"""SIH 26171 — local OpenAI-compatible gateway for the Aegis-Agent extension.

The browser extension talks to this service only. It exposes the
OpenAI-compatible surface the extension's LangChain client expects and
forwards to a local Ollama daemon (or any OpenAI-compatible server).

Client-facing API (what the extension requires):
  GET  /health                -> { status, backend, model }         (settings ping)
  GET  /v1/models             -> OpenAI-style model list
  POST /v1/chat/completions   -> OpenAI-style chat completion (streaming supported)

Privacy invariant: the extension sends only sanitized payloads. This gateway
never logs message content, image data, or credentials.
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

load_dotenv()

BACKEND = os.getenv("QWEN_BACKEND", "ollama").lower()
DEFAULT_MODEL = os.getenv("QWEN_MODEL", "qwen3-vl:4b")
# The client may request any of these; anything else falls back to DEFAULT_MODEL.
# Primary demo models: qwen3-vl 2b/4b (local). Test matrix: qwen3.5 2b/4b,
# qwen3-vl:235b-cloud and gemma4:31b-cloud (Ollama-cloud, need `ollama signin`).
# Edit QWEN_ALLOWED_MODELS in .env to add/remove — no code change needed.
ALLOWED_MODELS = {
    model.strip()
    for model in os.getenv(
        "QWEN_ALLOWED_MODELS",
        "qwen3-vl:2b,qwen3-vl:4b,qwen3-vl:235b-cloud,qwen3.5:2b,qwen3.5:4b,gemma4:31b-cloud",
    ).split(",")
    if model.strip()
}
# True plug-and-play: forward ANY client-requested model id to the backend
# (LAN demo convenience; keep false if you want a strict allow-list).
ALLOW_ANY_MODEL = os.getenv("ALLOW_ANY_MODEL", "false").lower() in ("1", "true", "yes")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
QWEN_BASE_URL = os.getenv("QWEN_BASE_URL", "http://127.0.0.1:8001/v1").rstrip("/")
QWEN_API_KEY = os.getenv("QWEN_API_KEY", "local")
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")]

SHORT_TIMEOUT = 5.0  # health/models probes
CHAT_TIMEOUT = None  # model inference can be slow; no cap while streaming


app = FastAPI(title="SIH Local Qwen Gateway", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def resolve_model(requested: Any) -> str:
    """Trust the client's model when allowed, else use the default."""
    if isinstance(requested, str):
        candidate = requested.strip()
        if candidate and (ALLOW_ANY_MODEL or candidate in ALLOWED_MODELS):
            return candidate
    return DEFAULT_MODEL


@app.get("/health")
async def health() -> dict[str, Any]:
    """Return configuration and Ollama reachability without exposing credentials."""
    result: dict[str, Any] = {
        "status": "ok",
        "backend": BACKEND,
        "model": DEFAULT_MODEL,
        "allowed_models": sorted(ALLOWED_MODELS),
    }
    if BACKEND == "ollama":
        try:
            async with httpx.AsyncClient(timeout=SHORT_TIMEOUT) as client:
                probe = await client.get(f"{OLLAMA_BASE_URL}/api/version")
            result["ollama"] = probe.json() if probe.status_code < 400 else {"error": str(probe.status_code)}
        except httpx.HTTPError as exc:
            # Gateway is up, but the model daemon is not — say so explicitly.
            result["status"] = "degraded"
            result["ollama"] = {"error": f"unreachable: {exc}"}
    return result


@app.get("/v1/models")
async def models() -> dict[str, Any]:
    if BACKEND == "ollama":
        try:
            async with httpx.AsyncClient(timeout=SHORT_TIMEOUT) as client:
                response = await client.get(f"{OLLAMA_BASE_URL}/v1/models")
            if response.status_code < 400:
                return response.json()
        except httpx.HTTPError:
            pass  # fall through to the static allow-list
        return {
            "object": "list",
            "data": [{"id": m, "object": "model", "owned_by": "ollama"} for m in sorted(ALLOWED_MODELS)],
        }
    return await forward("GET", "/models")


@app.api_route("/v1/chat/completions", methods=["POST"])
async def chat_completions(request: Request) -> Response:
    payload = await request.json()
    if not isinstance(payload, dict) or not isinstance(payload.get("messages"), list):
        raise HTTPException(status_code=400, detail="Request must include a messages array")
    payload["model"] = resolve_model(payload.get("model"))

    if BACKEND == "ollama":
        return await ollama_chat(payload)
    return await forward("POST", "/chat/completions", payload)


async def ollama_chat(payload: dict[str, Any]) -> Response:
    # Ollama's OpenAI-compatible route preserves messages (including image
    # content parts) and supports streaming and response_format passthrough.
    target = f"{OLLAMA_BASE_URL}/v1/chat/completions"
    try:
        client = httpx.AsyncClient(timeout=CHAT_TIMEOUT)
        upstream = await client.send(
            client.build_request("POST", target, json=payload, headers={"content-type": "application/json"}),
            stream=bool(payload.get("stream")),
        )
    except httpx.HTTPError as exc:
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"Could not reach Ollama: {exc}") from exc

    if upstream.status_code >= 400:
        body = await upstream.aread()
        await upstream.aclose()
        await client.aclose()
        return Response(content=body, status_code=upstream.status_code, media_type="application/json")

    if payload.get("stream"):

        async def body():
            try:
                async for chunk in upstream.aiter_bytes():
                    yield chunk
            finally:
                await upstream.aclose()
                await client.aclose()

        return StreamingResponse(body(), status_code=upstream.status_code, media_type="text/event-stream")

    body = await upstream.aread()
    await upstream.aclose()
    await client.aclose()
    return Response(content=body, status_code=upstream.status_code, media_type="application/json")


async def forward(method: str, path: str, payload: dict[str, Any] | None = None) -> Response | dict[str, Any]:
    headers = {"Authorization": f"Bearer {QWEN_API_KEY}"}
    try:
        async with httpx.AsyncClient(timeout=CHAT_TIMEOUT) as client:
            response = await client.request(method, f"{QWEN_BASE_URL}{path}", json=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Could not reach Qwen server: {exc}") from exc
    if response.status_code >= 400:
        return Response(content=response.content, status_code=response.status_code, media_type="application/json")
    if method == "GET":
        return response.json()
    return Response(content=response.content, status_code=response.status_code, media_type="application/json")
