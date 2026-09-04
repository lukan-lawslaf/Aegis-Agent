import { describe, expect, it } from 'vitest';
import { assertSanitizedText, collectDomRedactions, sanitizeText } from './privacy';

describe('SIH privacy primitives', () => {
  it('redacts common PII from model-bound text', () => {
    expect(sanitizeText('Contact alice@example.com or +91 98765 43210')).toBe(
      'Contact [REDACTED_EMAIL] or [REDACTED_PHONE]',
    );
  });

  it('classifies credential and payment fields with viewport boxes', () => {
    const regions = collectDomRedactions([
      { tagName: 'INPUT', type: 'password', name: 'password', bbox: [10, 20, 100, 30] },
      { tagName: 'INPUT', autocomplete: 'cc-number', bbox: [10, 60, 100, 30] },
    ]);

    expect(regions).toHaveLength(2);
    expect(regions.map(region => region.kind)).toEqual(['password', 'payment']);
    expect(regions.every(region => region.method === 'solid-mask')).toBe(true);
  });

  it('fails closed for unsanitized text', () => {
    expect(() => assertSanitizedText('email: alice@example.com')).toThrow('egress guard');
    expect(() => assertSanitizedText('safe UI label')).not.toThrow();
  });
});

