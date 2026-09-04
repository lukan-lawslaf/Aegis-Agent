/**
 * SIH 26171 privacy primitives.
 *
 * These functions are deliberately dependency-free so they can run in the
 * extension background context and be unit-tested without a browser. They are
 * the first layer of the privacy firewall; image-model/OCR adapters can add
 * regions to the same manifest later.
 */

import { redactFacesFromBase64 } from './blazeface';

export type RedactionKind = 'password' | 'email' | 'phone' | 'payment' | 'pii' | 'credential';

export interface RedactionRegion {
  kind: RedactionKind;
  method: 'solid-mask' | 'blur';
  /** viewport coordinates in CSS pixels */
  bbox: [number, number, number, number];
  source: 'dom' | 'pattern' | 'vision' | 'ocr';
  confidence?: number;
}

export interface SanitizedDomField {
  tagName?: string;
  type?: string;
  name?: string;
  id?: string;
  autocomplete?: string;
  ariaLabel?: string;
  value?: string;
  text?: string;
  bbox?: [number, number, number, number];
}

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(?<!\d)(?:\+?\d[\d .()\-]{7,}\d)(?!\d)/g;
const CARD = /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g;
const SECRET_NAME = /(pass(word)?|secret|token|api[-_ ]?key|auth|credential|otp|cvv|pin)/i;

function matches(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0;
  const result = pattern.test(value);
  pattern.lastIndex = 0;
  return result;
}

/** Replace detected PII in model-bound text without retaining the value. */
export function sanitizeText(input: string): string {
  return input
    .replace(EMAIL, '[REDACTED_EMAIL]')
    .replace(CARD, '[REDACTED_PAYMENT]')
    .replace(PHONE, '[REDACTED_PHONE]');
}

function bboxOf(field: SanitizedDomField): [number, number, number, number] | null {
  const bbox = field.bbox;
  if (!bbox || bbox.length !== 4 || bbox.some(value => !Number.isFinite(value) || value < 0)) return null;
  if (bbox[2] <= 0 || bbox[3] <= 0) return null;
  return bbox;
}

/** Classify DOM fields before any screenshot or text leaves the device. */
export function collectDomRedactions(fields: SanitizedDomField[]): RedactionRegion[] {
  const regions: RedactionRegion[] = [];

  for (const field of fields) {
    const descriptor = [
      field.type,
      field.name,
      field.id,
      field.autocomplete,
      field.ariaLabel,
      field.tagName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const isPassword = field.type?.toLowerCase() === 'password' || SECRET_NAME.test(descriptor);
    const isPayment = /(card|credit|debit|iban|routing|account[-_ ]?number|cc[-_ ]?(number|exp|csc|cvv))/i.test(descriptor);
    const value = field.value ?? field.text ?? '';
    const kind: RedactionKind | null = isPassword
      ? 'password'
      : isPayment || matches(CARD, value)
        ? 'payment'
        : matches(EMAIL, value)
          ? 'email'
          : matches(PHONE, value)
            ? 'phone'
            : null;

    const bbox = bboxOf(field);
    if (kind && bbox) {
      regions.push({
        kind,
        method: kind === 'password' || kind === 'payment' ? 'solid-mask' : 'blur',
        bbox,
        source: 'dom',
        confidence: 1,
      });
    }
  }

  return regions;
}

/** Fail closed if a caller attempts to send an obviously unsanitized payload. */
export function assertSanitizedText(input: string): void {
  if (matches(EMAIL, input) || matches(CARD, input) || matches(PHONE, input)) {
    throw new Error('SIH egress guard rejected text containing possible PII');
  }
}

/** Chrome allows at most 2 captureVisibleTab calls per second; back off on quota. */
async function captureVisibleTabWithBackoff(): Promise<string> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  try {
    return await chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 80 });
  } catch (error) {
    if (error instanceof Error && /MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND/.test(error.message)) {
      await delay(650);
      return await chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 80 });
    }
    throw error;
  }
}

/** Capture a viewport with DOM-first masks when Puppeteer/CDP is unavailable. */
export async function captureSanitizedVisibleTab(tabId: number): Promise<{ image: string; domMasks: number }> {
  const target = { tabId };
  const result = await chrome.scripting.executeScript({
    target,
    func: () => {
      const selector = [
        'input[type="password"]',
        'input[autocomplete*="password" i]',
        'input[autocomplete*="cc-" i]',
        'input[name*="password" i]',
        'input[name*="token" i]',
        'input[name*="secret" i]',
        'input[name*="api_key" i]',
        'input[id*="password" i]',
        'input[id*="token" i]',
        'textarea[name*="secret" i]',
      ].join(',');
      let count = 0;
      const addMask = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const mask = document.createElement('div');
        mask.dataset.sihRedaction = 'capture';
        Object.assign(mask.style, {
          position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`,
          width: `${rect.width}px`, height: `${rect.height}px`,
          zIndex: '2147483647', background: '#000', pointerEvents: 'none',
        });
        document.documentElement.appendChild(mask);
        count += 1;
      };
      document.querySelectorAll<HTMLElement>(selector).forEach(addMask);
      const pii = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?<!\d)(?:\+?\d[\d .()\-]{7,}\d)(?!\d))/i;
      document.querySelectorAll<HTMLElement>('body *').forEach(element => {
        if (element.children.length === 0 && pii.test(element.innerText || '')) addMask(element);
      });
      return count;
    },
  });

  try {
    const captured = await captureVisibleTabWithBackoff();
    const base64 = captured.replace(/^data:image\/[^;]+;base64,/, '');
    const image = await redactFacesFromBase64(base64);
    return { image, domMasks: result[0]?.result ?? 0 };
  } finally {
    await chrome.scripting.executeScript({
      target,
      func: () => document.querySelectorAll('[data-sih-redaction="capture"]').forEach(node => node.remove()),
    });
    void result;
  }
}
