import { useEffect, useState } from 'react';
import { ThinkingOrb } from 'thinking-orbs';
import type { OrbState } from 'thinking-orbs';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * Rotating "thinking" words paired with an orb state. Shuffled once per mount
 * so consecutive mounts start on a different word.
 */
const THINKING_WORDS: { label: string; state: OrbState }[] = [
  { label: 'manifesting', state: 'shaping' },
  { label: 'vibing', state: 'listening' },
  { label: 'RIZZMASTERING', state: 'working' },
  { label: 'AURAMAXING', state: 'composing' },
  { label: 'incanting', state: 'solving' },
  { label: 'divining', state: 'searching' },
  { label: 'plotting', state: 'shaping' },
  { label: 'cooking', state: 'composing' },
  { label: 'lockin in', state: 'working' },
  { label: 'wandering', state: 'searching' },
];

const WORD_INTERVAL_MS = 1700;

interface ThinkingIndicatorProps {
  /** Render at inline-text scale instead of the larger chat scale. */
  compact?: boolean;
}

export function ThinkingIndicator({ compact = false }: ThinkingIndicatorProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(() => Math.floor(Math.random() * THINKING_WORDS.length));

  useEffect(() => {
    if (reducedMotion) return;
    const timer = setInterval(() => {
      setIndex(current => (current + 1) % THINKING_WORDS.length);
    }, WORD_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [reducedMotion]);

  const word = THINKING_WORDS[index];

  return (
    <div
      className="inline-flex items-center rounded-full border border-subtle bg-surface pl-1 pr-3"
      style={{ boxShadow: 'inset 0 0 24px 0 rgba(127,127,127,0.04)' }}
      aria-live="polite">
      {reducedMotion ? (
        <span className="mx-1.5 size-2 animate-pulse rounded-full bg-accent" />
      ) : (
        <span className={compact ? '[&_canvas]:!size-5' : '[&_canvas]:!size-8'}>
          <ThinkingOrb state={word.state} size={compact ? 20 : 64} theme="auto" />
        </span>
      )}
      <span
        className={`font-mono lowercase text-secondary ${compact ? 'text-[11px]' : 'text-[12px]'}`}
        // Keep uppercase gimmick words loud, everything else reads as a status line
        style={word.label === word.label.toUpperCase() ? { textTransform: 'none' } : undefined}>
        {word.label}…
      </span>
    </div>
  );
}

export default ThinkingIndicator;
