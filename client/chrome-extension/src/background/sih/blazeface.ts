import type * as OrtWebGpu from 'onnxruntime-web/webgpu';
import { getOrt } from './ort-webgpu';

export interface FaceRegion {
  /** Pixel coordinates in the source image. */
  bbox: [number, number, number, number];
  confidence: number;
}

const INPUT_SIZE = 128;
// Calibrated for the small, standalone BlazeFace export used by the demo.
// DOM/PII rules remain conservative; this avoids large low-confidence image masks.
const DEFAULT_THRESHOLD = 0.5;

let sessionPromise: Promise<OrtWebGpu.InferenceSession | null> | null = null;
/** Last underlying cause of a failed session, for user-facing diagnostics. */
let lastSessionError = 'not attempted';

function modelUrl(): string {
  const configured = import.meta.env.VITE_SIH_BLAZEFACE_MODEL_URL as string | undefined;
  if (configured) {
    if (configured.startsWith('/') && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      return chrome.runtime.getURL(configured.slice(1));
    }
    return configured;
  }
  return typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL('models/blazeface.onnx')
    : 'models/blazeface.onnx';
}

async function createSession(): Promise<OrtWebGpu.InferenceSession | null> {
  try {
    const ort = await getOrt();
    // WebGPU EP needs a dynamic import() for its JSEP glue, which is banned
    // in service workers and also poisons the shared WASM init. CPU/wasm only.
    const providers: OrtWebGpu.InferenceSession.ExecutionProviderConfig[] = ['wasm'];

    // WASM asset paths are pinned to the extension's ort/ directory by the loader.
    const session = await ort.InferenceSession.create(modelUrl(), {
      executionProviders: providers,
      graphOptimizationLevel: 'all',
    });
    console.info('[SIH] BlazeFace face-redaction model loaded (providers:', providers.join('+'), ')');
    return session;
  } catch (error) {
    // Fail closed, but never silently: the real cause (CSP, missing model
    // file, WebGPU/WASM init) must be visible in the service worker console.
    lastSessionError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error('[SIH] BlazeFace session unavailable:', lastSessionError);
    // A missing model is a safe, expected state during development. The
    // screenshot remains protected by DOM/PII masking and is not rejected.
    return null;
  }
}

async function getSession(): Promise<OrtWebGpu.InferenceSession | null> {
  sessionPromise ??= createSession().then(session => {
    // Never cache a failure: a transient error (e.g. load raced a reload)
    // must not poison every capture until the worker restarts.
    if (session === null) sessionPromise = null;
    return session;
  });
  return sessionPromise;
}

/** Human-readable trace of the privacy stack, surfaced to the side panel on failure. */
export async function getPrivacyDiagnostics(): Promise<string[]> {
  const lines: string[] = [];
  try {
    const ort = await getOrt();
    lines.push('ort import: ok');
    // WebGPU EP needs a dynamic import() for its JSEP glue, which is banned
    // in service workers and also poisons the shared WASM init. CPU/wasm only.
    const providers: OrtWebGpu.InferenceSession.ExecutionProviderConfig[] = ['wasm'];
    lines.push(`providers: ${providers.join('+')}`);
    const session = await ort.InferenceSession.create(modelUrl(), {
      executionProviders: providers,
      graphOptimizationLevel: 'all',
    });
    lines.push(`session: ok (inputs: ${session.inputNames.join(', ')})`);
    const plane = INPUT_SIZE * INPUT_SIZE;
    const feeds: Record<string, OrtWebGpu.Tensor> = {};
    for (const name of session.inputNames) {
      if (/image|input/i.test(name)) {
        feeds[name] = new ort.Tensor('float32', new Float32Array(plane * 3).fill(0.5), [1, 3, INPUT_SIZE, INPUT_SIZE]);
      } else if (/conf|threshold/i.test(name)) {
        feeds[name] = new ort.Tensor('float32', new Float32Array([DEFAULT_THRESHOLD]), [1]);
      } else if (/max.*det/i.test(name)) {
        feeds[name] = new ort.Tensor('int64', new BigInt64Array([25n]), [1]);
      } else if (/iou/i.test(name)) {
        feeds[name] = new ort.Tensor('float32', new Float32Array([0.3]), [1]);
      }
    }
    await session.run(feeds);
    lines.push('inference: ok (synthetic 128px tile)');
    return lines;
  } catch (error) {
    lines.push(`FAIL: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
    return lines;
  }
}

function outputArray(value: OrtWebGpu.Tensor | undefined): Float32Array | number[] | null {
  if (!value?.data) return null;
  return value.data as Float32Array | number[];
}

/**
 * Parse the common standalone BlazeFace ONNX output convention:
 * boxes [N,4] (x1,y1,x2,y2) and scores [N]. Models that emit extra values
 * are handled by taking the first four box values and first score value.
 */
function parseDetections(
  outputs: Record<string, OrtWebGpu.Tensor>,
  width: number,
  height: number,
): FaceRegion[] {
  const tensors = Object.values(outputs);
  const boxTensor = tensors.find(t => (t.dims.length >= 2 && t.dims[t.dims.length - 1] >= 4));
  const scoreTensor = tensors.find(t => t !== boxTensor && t.data.length >= 1);
  const boxes = outputArray(boxTensor);
  const scores = outputArray(scoreTensor);
  if (!boxes) return [];

  const threshold = Number(import.meta.env.VITE_SIH_BLAZEFACE_THRESHOLD ?? DEFAULT_THRESHOLD);
  const boxStride = boxTensor!.dims[boxTensor!.dims.length - 1];
  // The selectedBoxes export already applies confidence/NMS and may omit a
  // separate score output. In that case each returned row is trusted because
  // the threshold was supplied as an input to the model.
  const count = Math.floor(boxes.length / boxStride);
  const regions: FaceRegion[] = [];

  for (let i = 0; i < count; i += 1) {
    const confidence = scores ? Number(scores[i]) : 1;
    if (!Number.isFinite(confidence) || confidence < threshold) continue;
    const offset = i * boxStride;
    // The Hugging Face standalone BlazeFace export stores detections as
    // [top_y, top_x, bottom_y, bottom_x, landmarks...]. Simpler exports use
    // [x1, y1, x2, y2], so support both layouts.
    const values = boxStride >= 16
      ? [Number(boxes[offset + 1]), Number(boxes[offset]), Number(boxes[offset + 3]), Number(boxes[offset + 2])]
      : [Number(boxes[offset]), Number(boxes[offset + 1]), Number(boxes[offset + 2]), Number(boxes[offset + 3])];
    if (values.some(value => !Number.isFinite(value))) continue;

    // Accept either normalized coordinates or pixel coordinates.
    const normalized = values.every(value => value >= -1 && value <= 1);
    const scaleX = normalized ? width : 1;
    const scaleY = normalized ? height : 1;
    const [x1, y1, x2, y2] = [values[0] * scaleX, values[1] * scaleY, values[2] * scaleX, values[3] * scaleY];
    const left = Math.max(0, Math.min(x1, x2));
    const top = Math.max(0, Math.min(y1, y2));
    const right = Math.min(width, Math.max(x1, x2));
    const bottom = Math.min(height, Math.max(y1, y2));
    if (right - left > 2 && bottom - top > 2) {
      regions.push({ bbox: [left, top, right - left, bottom - top], confidence });
    }
  }
  return regions;
}

function intersectionOverUnion(a: FaceRegion, b: FaceRegion): number {
  const [ax, ay, aw, ah] = a.bbox;
  const [bx, by, bw, bh] = b.bbox;
  const left = Math.max(ax, bx);
  const top = Math.max(ay, by);
  const right = Math.min(ax + aw, bx + bw);
  const bottom = Math.min(ay + ah, by + bh);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = aw * ah + bw * bh - intersection;
  return union > 0 ? intersection / union : 0;
}

function deduplicate(regions: FaceRegion[]): FaceRegion[] {
  return regions
    .sort((a, b) => b.confidence - a.confidence)
    .filter((region, index, all) => all.slice(0, index).every(previous => intersectionOverUnion(region, previous) < 0.35));
}

async function inferTile(
  session: OrtWebGpu.InferenceSession,
  bitmap: ImageBitmap,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
): Promise<FaceRegion[]> {
  const ort = await getOrt();
  const canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const pixels = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
  const plane = INPUT_SIZE * INPUT_SIZE;
  const input = new Float32Array(plane * 3);
  for (let i = 0; i < plane; i += 1) {
    input[i] = pixels[i * 4] / 255;
    input[plane + i] = pixels[i * 4 + 1] / 255;
    input[plane * 2 + i] = pixels[i * 4 + 2] / 255;
  }

  const feeds: Record<string, OrtWebGpu.Tensor> = {};
  for (const name of session.inputNames) {
    if (/image|input/i.test(name)) {
      feeds[name] = new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    } else if (/conf|threshold/i.test(name)) {
      feeds[name] = new ort.Tensor('float32', new Float32Array([Number(import.meta.env.VITE_SIH_BLAZEFACE_THRESHOLD ?? DEFAULT_THRESHOLD)]), [1]);
    } else if (/max.*det/i.test(name)) {
      feeds[name] = new ort.Tensor('int64', new BigInt64Array([25n]), [1]);
    } else if (/iou/i.test(name)) {
      feeds[name] = new ort.Tensor('float32', new Float32Array([0.3]), [1]);
    }
  }
  if (Object.keys(feeds).length !== session.inputNames.length) return [];
  const localRegions = parseDetections(await session.run(feeds), sourceWidth, sourceHeight);
  return localRegions.map(region => ({
    ...region,
    bbox: [region.bbox[0] + sourceX, region.bbox[1] + sourceY, region.bbox[2], region.bbox[3]],
  }));
}

export async function detectFaces(bitmap: ImageBitmap): Promise<FaceRegion[]> {
  const session = await getSession();
  if (!session) return [];
  const tileSize = Math.min(768, Math.max(bitmap.width, bitmap.height));
  const stride = Math.max(256, Math.floor(tileSize * 0.75));
  const regions: FaceRegion[] = [];
  for (let y = 0; y < bitmap.height; y += stride) {
    for (let x = 0; x < bitmap.width; x += stride) {
      const width = Math.min(tileSize, bitmap.width - x);
      const height = Math.min(tileSize, bitmap.height - y);
      regions.push(...(await inferTile(session, bitmap, x, y, width, height)));
      if (x + width >= bitmap.width) break;
    }
    if (y + Math.min(tileSize, bitmap.height - y) >= bitmap.height) break;
  }
  return deduplicate(regions);
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Blur detected faces in-memory before the screenshot is sent to the VLM. */
export async function redactFacesFromBase64(base64: string): Promise<string> {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') {
    throw new Error('SIH image APIs are unavailable; refusing visual egress');
  }
  try {
    // Do not allow a visual payload to leave the browser when the configured
    // face model is unavailable. DOM/text-only tasks can still run, but vision
    // tasks fail closed instead of silently sending unredacted pixels.
    if (!(await getSession())) {
      throw new Error(`SIH face-redaction model is unavailable (${lastSessionError}); refusing visual egress`);
    }
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
    const regions = await detectFaces(bitmap);
    if (regions.length === 0) {
      bitmap.close();
      return base64;
    }

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return base64;
    }
    context.drawImage(bitmap, 0, 0);
    context.filter = 'blur(18px)';
    for (const region of regions) {
      const [x, y, width, height] = region.bbox;
      // Preserve the complete detector box; a modest margin catches the
      // forehead/chin without masking surrounding cards or text.
      const padding = Math.max(width, height) * 0.1;
      context.drawImage(bitmap, Math.max(0, x - padding), Math.max(0, y - padding), width + padding * 2, height + padding * 2, Math.max(0, x - padding), Math.max(0, y - padding), width + padding * 2, height + padding * 2);
    }
    context.filter = 'none';
    const output = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    bitmap.close();
    return await blobToBase64(output);
  } catch (error) {
    throw error instanceof Error ? error : new Error('SIH face-redaction failed');
  }
}
