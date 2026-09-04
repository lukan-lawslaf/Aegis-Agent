import React, { useState } from 'react';
import { FiChevronDown, FiChevronUp, FiEye } from 'react-icons/fi';
import { TbShieldCheck, TbShieldLock } from 'react-icons/tb';

export interface PrivacyMetrics {
  facesDetected: number;
  sensitiveFieldsMasked: number;
  piiItemsRemoved: number;
  regionsRedacted: number;
  statusState: 'protected' | 'scanning' | 'alert';
  isLive: boolean;
}

interface PrivacyStatusCardProps {
  metrics: PrivacyMetrics;
  onOpenPrivacyPreview: () => void;
  isDarkMode?: boolean;
}

export function PrivacyStatusCard({ metrics, onOpenPrivacyPreview }: PrivacyStatusCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusConfig = {
    protected: {
      label: 'privacy firewall · active',
      sublabel: 'faces, credentials & PII redacted before egress',
      color: 'text-ok',
      icon: TbShieldCheck,
    },
    scanning: {
      label: 'scanning page state',
      sublabel: 'BlazeFace + PII filters running locally…',
      color: 'text-warn',
      icon: TbShieldLock,
    },
    alert: {
      label: 'sanitization verification',
      sublabel: 'checking DOM and visual bounding boxes',
      color: 'text-danger',
      icon: TbShieldCheck,
    },
  };

  const activeStatus = statusConfig[metrics.statusState] || statusConfig.protected;
  const StatusIcon = activeStatus.icon;

  const totalRedactions =
    metrics.facesDetected + metrics.sensitiveFieldsMasked + metrics.piiItemsRemoved + metrics.regionsRedacted;

  const rows = [
    { key: 'faces', label: 'faces', detector: 'blazeface', value: metrics.facesDetected },
    { key: 'fields', label: 'fields', detector: 'dom', value: metrics.sensitiveFieldsMasked },
    { key: 'pii', label: 'pii', detector: 'pattern+ner', value: metrics.piiItemsRemoved },
    { key: 'regions', label: 'regions', detector: 'vision', value: metrics.regionsRedacted },
  ];

  return (
    <div className="frame-outer">
      <div className="frame-inner">
        {/* Banner row */}
        <div className="flex items-center justify-between gap-2 p-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <StatusIcon size={16} className={`shrink-0 ${activeStatus.color}`} />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-primary">{activeStatus.label}</span>
                <span className="font-mono text-[10px] text-tertiary">
                  {totalRedactions > 0 ? `${totalRedactions} redacted` : 'on-device'}
                </span>
              </div>
              <p className="truncate text-[11px] leading-tight text-secondary">{activeStatus.sublabel}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onOpenPrivacyPreview}
              className="flex cursor-pointer items-center gap-1 rounded-md border border-subtle px-2 py-1 font-mono text-[11px] text-secondary hover:border-strong hover:text-primary"
              aria-label="View sanitized viewport preview">
              <FiEye size={12} />
              <span>preview</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Collapse metric details' : 'Expand metric details'}
              className="cursor-pointer rounded-md p-1 text-tertiary hover:bg-elevated hover:text-secondary"
              aria-label="Toggle metrics">
              {isExpanded ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
            </button>
          </div>
        </div>

        {/* Dense manifest-style metric rows */}
        {isExpanded && (
          <div className="border-t border-subtle">
            <div className="grid grid-cols-4 border-b border-subtle bg-subtle px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-tertiary">
              <span>layer</span>
              <span>detector</span>
              <span className="text-right">count</span>
              <span />
            </div>
            {rows.map((row, idx) => (
              <div
                key={row.key}
                className={`grid grid-cols-4 items-center px-2.5 py-1.5 font-mono text-xs ${
                  idx < rows.length - 1 ? 'border-b border-subtle' : ''
                }`}>
                <span className="text-secondary">{row.label}</span>
                <span className="text-tertiary text-[11px]">{row.detector}</span>
                <span className="text-right text-primary">{row.value}</span>
                <span className="text-right text-[10px] text-tertiary">{row.value > 0 ? 'masked' : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PrivacyStatusCard;
