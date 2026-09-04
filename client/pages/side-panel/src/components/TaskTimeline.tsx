import React from 'react';
import { FiAlertTriangle } from 'react-icons/fi';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

export type TimelinePhaseKey =
  | 'observe'
  | 'protect'
  | 'transmit'
  | 'plan'
  | 'confirm'
  | 'execute'
  | 'complete';

export interface TimelineStep {
  key: TimelinePhaseKey;
  label: string;
  sublabel: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  timestamp?: number;
  error?: string;
}

interface TaskTimelineProps {
  steps: TimelineStep[];
  currentStepIndex: number;
  isDarkMode?: boolean;
  isCompact?: boolean;
  onToggleCompact?: () => void;
}

const statusGlyph: Record<TimelineStep['status'], { text: string; className: string }> = {
  pending: { text: '·', className: 'text-tertiary' },
  running: { text: '>', className: 'text-accent' },
  success: { text: '✓', className: 'text-ok' },
  failed: { text: '✗', className: 'text-danger' },
};

export function TaskTimeline({ steps, isCompact = false, onToggleCompact }: TaskTimelineProps) {
  const formatTime = (ts?: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="frame-outer">
      <div className="frame-inner">
        {/* Terminal window chrome: filename tab + language label */}
        <div className="flex items-center gap-2 border-b border-subtle bg-subtle px-3 py-1.5">
          <span className="font-mono text-[11px] text-secondary">pipeline.log</span>
          <span className="ml-auto font-mono text-[10px] text-tertiary">aegis/trace</span>
          {onToggleCompact && (
            <button
              type="button"
              onClick={onToggleCompact}
              className="cursor-pointer font-mono text-[10px] text-tertiary hover:text-secondary">
              {isCompact ? 'expand' : 'compact'}
            </button>
          )}
        </div>

        {/* Steps as log lines */}
        <div className="px-3 py-2">
          {steps.map((step, idx) => {
            const glyph = statusGlyph[step.status];
            const isRunning = step.status === 'running';

            return (
              <div
                key={step.key}
                className={`flex items-start gap-2 py-1 font-mono text-xs ${
                  idx < steps.length - 1 ? '' : ''
                } ${isRunning ? 'bg-accent-soft' : ''}`}>
                {isRunning ? (
                  <AiOutlineLoading3Quarters size={11} className="mt-1 shrink-0 animate-spin text-accent" />
                ) : (
                  <span className={`w-3 shrink-0 text-center ${glyph.className}`}>{glyph.text}</span>
                )}
                <span className="w-5 shrink-0 text-tertiary text-[10px]">{`${String(idx + 1).padStart(2, '0')}`}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate ${
                        step.status === 'failed'
                          ? 'text-danger'
                          : isRunning
                            ? 'text-primary'
                            : step.status === 'pending'
                              ? 'text-tertiary'
                              : 'text-secondary'
                      }`}>
                      {step.label}
                    </span>
                    {step.timestamp && (
                      <span className="shrink-0 text-[10px] text-tertiary">{formatTime(step.timestamp)}</span>
                    )}
                  </div>
                  {!isCompact && (
                    <p className="truncate text-[11px] leading-snug text-tertiary">
                      {step.error ? (
                        <span className="inline-flex items-center gap-1 text-danger">
                          <FiAlertTriangle size={10} />
                          {step.error}
                        </span>
                      ) : (
                        step.sublabel
                      )}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default TaskTimeline;
