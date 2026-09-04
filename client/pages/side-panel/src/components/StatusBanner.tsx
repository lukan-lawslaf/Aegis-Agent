import React from 'react';
import { FiCheckCircle, FiAlertCircle, FiServer, FiSlash } from 'react-icons/fi';
import { ThinkingIndicator } from './ThinkingIndicator';

export type StatusBannerType =
  | 'empty'
  | 'loading'
  | 'server_unavailable'
  | 'validator_rejected'
  | 'scan_failed'
  | 'completed';

interface StatusBannerProps {
  type: StatusBannerType;
  title?: string;
  message?: string;
  isDarkMode?: boolean;
  onRetry?: () => void;
}

export function StatusBanner({ type, title, message, onRetry }: StatusBannerProps) {
  if (type === 'empty') {
    // Empty state is handled by the hero layout in SidePanel; nothing here.
    return null;
  }

  if (type === 'loading') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-subtle bg-surface p-2.5">
        <ThinkingIndicator />
        <div className="min-w-0 flex-1">
          <span className="font-mono text-[11px] block text-primary">{title || 'processing…'}</span>
          <p className="truncate text-[11px] leading-snug text-secondary">
            {message || 'evaluating sanitized observation on local gateway'}
          </p>
        </div>
      </div>
    );
  }

  if (type === 'server_unavailable') {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-danger bg-surface p-3">
        <FiServer className="mt-0.5 shrink-0 text-danger" size={15} />
        <div className="min-w-0 flex-1">
          <span className="font-mono block text-[11px] text-danger">{title || 'gateway offline'}</span>
          <p className="mt-1 text-[11px] leading-snug text-secondary">
            {message || 'Could not connect to FastAPI gateway at 127.0.0.1:8000. Ensure your local server is running.'}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 cursor-pointer rounded-md border border-strong px-2.5 py-1 font-mono text-[11px] text-secondary hover:border-danger hover:text-danger">
              retry connection
            </button>
          )}
        </div>
      </div>
    );
  }

  if (type === 'validator_rejected') {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-warn bg-surface p-3">
        <FiSlash className="mt-0.5 shrink-0 text-warn" size={15} />
        <div className="min-w-0 flex-1">
          <span className="font-mono block text-[11px] text-warn">{title || 'action blocked by validator'}</span>
          <p className="mt-1 text-[11px] leading-snug text-secondary">
            {message || 'Proposed DOM action failed client-side safety validation against target origin policy.'}
          </p>
        </div>
      </div>
    );
  }

  if (type === 'scan_failed') {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-danger bg-surface p-3">
        <FiAlertCircle className="mt-0.5 shrink-0 text-danger" size={15} />
        <div className="min-w-0 flex-1">
          <span className="font-mono block text-[11px] text-danger">{title || 'privacy pipeline fallback'}</span>
          <p className="mt-1 text-[11px] leading-snug text-secondary">
            {message || 'Perception filter used solid masks to ensure zero context egress.'}
          </p>
        </div>
      </div>
    );
  }

  if (type === 'completed') {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-ok bg-surface p-2.5">
        <FiCheckCircle className="shrink-0 text-ok" size={15} />
        <div className="min-w-0 flex-1">
          <span className="font-mono block text-[11px] text-ok">{title || 'task complete'}</span>
          <p className="text-[11px] leading-snug text-secondary">
            {message || 'All safe browser actions executed with privacy verification.'}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

export default StatusBanner;
