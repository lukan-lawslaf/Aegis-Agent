import React from 'react';
import { FiAlertTriangle, FiCheck, FiX, FiGlobe, FiTarget, FiZap, FiShield } from 'react-icons/fi';

export interface ActionApprovalRequest {
  actionType: 'click' | 'type' | 'submit' | 'navigate' | 'download' | 'payment' | 'delete';
  targetElement: string;
  domain: string;
  reason: string;
  isIrreversible?: boolean;
}

interface ActionConfirmationProps {
  request: ActionApprovalRequest | null;
  onConfirm: () => void;
  onCancel: () => void;
  isDarkMode?: boolean;
}

export function ActionConfirmation({ request, onConfirm, onCancel }: ActionConfirmationProps) {
  if (!request) return null;

  const isHighRisk =
    request.isIrreversible ||
    request.actionType === 'submit' ||
    request.actionType === 'payment' ||
    request.actionType === 'delete';

  return (
    <div className="my-1">
      <div className={`frame-outer ${isHighRisk ? 'border-warn' : ''}`}>
        <div className="frame-inner">
          {/* Header */}
          <div className={`flex items-center gap-2.5 border-b border-subtle bg-subtle px-3 py-2`}>
            {isHighRisk ? (
              <FiAlertTriangle size={15} className="shrink-0 text-warn" />
            ) : (
              <FiShield size={15} className="shrink-0 text-ok" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-primary">action authorization required</span>
                {isHighRisk && (
                  <span className="font-mono text-[10px] uppercase text-warn">irreversible</span>
                )}
              </div>
              <p className="text-[11px] leading-tight text-tertiary">
                Aegis safety policy requires explicit user confirmation
              </p>
            </div>
          </div>

          {/* Action details as a manifest block */}
          <div className="space-y-1.5 p-3 font-mono text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-tertiary">
                <FiZap size={11} /> action
              </span>
              <span className="rounded-md border border-subtle bg-subtle px-2 py-0.5 uppercase text-accent">
                {request.actionType}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-tertiary">
                <FiGlobe size={11} /> domain
              </span>
              <span className="truncate text-secondary" title={request.domain}>
                {request.domain}
              </span>
            </div>

            <div className="flex items-start justify-between gap-2">
              <span className="flex shrink-0 items-center gap-1.5 text-tertiary">
                <FiTarget size={11} /> target
              </span>
              <code className="max-w-[200px] truncate" title={request.targetElement}>
                {request.targetElement}
              </code>
            </div>

            <div className="border-t border-subtle pt-2">
              <span className="block text-tertiary">rationale</span>
              <p className="mt-1 text-secondary">&ldquo;{request.reason}&rdquo;</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 border-t border-subtle px-3 py-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-strong px-3 py-1.5 font-mono text-[11px] font-semibold text-secondary hover:border-danger hover:text-danger"
              aria-label="Reject and cancel action">
              <FiX size={12} />
              <span>reject</span>
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-[11px] font-semibold text-ink hover:opacity-90"
              aria-label="Approve and execute action">
              <FiCheck size={12} />
              <span>approve</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ActionConfirmation;
