/**
 * Access to the onnxruntime-web runtime inside the classic service worker.
 *
 * onnxruntime-web cannot be bundled through vite (its ~28MB wasm binary gets
 * inlined and Chrome refuses to register the worker), dynamic import() is
 * banned on ServiceWorkerGlobalScope, and importScripts of a separate file
 * proved fragile across environments. The vite build therefore appends the
 * classic rewrite of ort.webgpu.bundle.min.mjs (wasm glue inlined, wasm
 * binary fetched at runtime) directly to background.iife.js, exposing the
 * namespace as `globalThis.ort` with `globalThis.__SIH_ORT_URL__` already
 * pointing at `dist/ort/` for sibling wasm resolution.
 */
// eslint-disable-next-line import/namespace -- type-only import; the package ships types at its root
import type * as OrtWebGpu from 'onnxruntime-web';

let ortNamespace: typeof OrtWebGpu | null = null;

export function getOrt(): Promise<typeof OrtWebGpu> {
  if (!ortNamespace) {
    const ort = (globalThis as unknown as { ort?: typeof OrtWebGpu }).ort;
    if (!ort) {
      throw new Error('SIH ORT runtime not embedded in the service worker bundle');
    }
    // Service workers cannot spawn Web Workers; keep the WASM backend
    // single-threaded so the fallback path never touches worker APIs.
    // wasmPaths must stay unset: an explicit path makes ORT dynamically
    // import() the external glue module, which is banned in service workers.
    ort.env.wasm.numThreads = 1;
    ortNamespace = ort;
  }
  return Promise.resolve(ortNamespace);
}
