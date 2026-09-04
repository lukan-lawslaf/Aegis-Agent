import React, { useState } from 'react';
import { FiX, FiShield, FiLock, FiUserX, FiMail, FiPhone, FiCreditCard, FiCheck, FiInfo, FiCamera } from 'react-icons/fi';
import { TbShieldCheck, TbEyeOff } from 'react-icons/tb';

interface RedactionItem {
  id: string;
  kind: 'face' | 'password' | 'email' | 'phone' | 'payment';
  method: 'solid-mask' | 'blur';
  bboxDescription: string;
  source: 'dom' | 'pattern' | 'vision';
}

interface PrivacyPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  sanitizedImageBase64?: string | null;
  onCaptureCurrentTab?: () => Promise<void>;
  isCapturing?: boolean;
}

export function PrivacyPreviewModal({
  isOpen,
  onClose,
  sanitizedImageBase64 = null,
  onCaptureCurrentTab,
  isCapturing = false,
}: PrivacyPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'manifest'>('preview');

  if (!isOpen) return null;

  const sampleManifest: RedactionItem[] = [
    { id: 'r1', kind: 'face', method: 'solid-mask', bboxDescription: 'x: 240, y: 110, w: 180, h: 180', source: 'vision' },
    { id: 'r2', kind: 'password', method: 'solid-mask', bboxDescription: 'input[name="password"] [320, 410, 240, 42]', source: 'dom' },
    { id: 'r3', kind: 'email', method: 'blur', bboxDescription: 'regex: [REDACTED_EMAIL]', source: 'pattern' },
    { id: 'r4', kind: 'phone', method: 'blur', bboxDescription: 'regex: [REDACTED_PHONE]', source: 'pattern' },
    { id: 'r5', kind: 'payment', method: 'solid-mask', bboxDescription: 'input[autocomplete="cc-number"]', source: 'dom' },
  ];

  const kindIcons = {
    face: FiUserX,
    password: FiLock,
    email: FiMail,
    phone: FiPhone,
    payment: FiCreditCard,
  };

  const kindLabels = {
    face: 'biometric face',
    password: 'password / credential',
    email: 'email address',
    phone: 'phone number',
    payment: 'payment / card data',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
      <div className="frame-outer flex max-h-[92vh] w-full max-w-lg flex-col">
        <div className="frame-inner flex max-h-[92vh] w-full flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-subtle bg-subtle px-3 py-2">
            <div className="flex items-center gap-2">
              <TbShieldCheck size={16} className="text-ok" />
              <div>
                <span className="font-mono text-xs text-primary">privacy perception firewall</span>
                <p className="text-[11px] leading-tight text-tertiary">on-device visual perception & sanitize guard</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md p-1.5 text-tertiary hover:bg-elevated hover:text-primary"
              aria-label="Close modal">
              <FiX size={16} />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-1 border-b border-subtle bg-subtle px-3 pt-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`cursor-pointer border-b-2 pb-1.5 font-mono text-[11px] ${
                activeTab === 'preview'
                  ? 'border-accent text-primary'
                  : 'border-transparent text-tertiary hover:text-secondary'
              }`}>
              viewport
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manifest')}
              className={`cursor-pointer border-b-2 pb-1.5 font-mono text-[11px] ${
                activeTab === 'manifest'
                  ? 'border-accent text-primary'
                  : 'border-transparent text-tertiary hover:text-secondary'
              }`}>
              manifest ({sampleManifest.length})
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {activeTab === 'preview' ? (
              <div className="space-y-3">
                {/* Privacy Guarantee Explainer */}
                <div className="flex items-start gap-2.5 rounded-lg border border-ok bg-ok-soft p-2.5 text-[11px] leading-relaxed text-secondary">
                  <FiShield className="mt-0.5 shrink-0 text-ok" size={14} />
                  <div>
                    <span className="font-mono block text-primary">zero-context-egress guarantee</span>
                    Raw DOM structures, unsanitized screenshot pixels, and form credentials never leave this
                    device. All sensitive areas are masked locally before transmission to Qwen3-VL.
                  </div>
                </div>

                {/* Viewport / Live Capture Card — terminal window frame */}
                <div className="frame-outer">
                  <div className="frame-inner">
                    <div className="flex items-center gap-2 border-b border-subtle bg-subtle px-3 py-1.5">
                      <span className="font-mono text-[11px] text-secondary">viewport.sanitized</span>
                      <span className="ml-auto font-mono text-[10px] text-tertiary">local-only</span>
                    </div>

                    {sanitizedImageBase64 ? (
                      <img
                        src={`data:image/jpeg;base64,${sanitizedImageBase64}`}
                        alt="Sanitized tab viewport"
                        className="h-auto w-full object-contain"
                      />
                    ) : (
                      <div className="relative flex min-h-[220px] flex-col items-center justify-center bg-ink p-3">
                        {/* Simulated Webpage with Solid Mask Overlays */}
                        <div className="w-full space-y-2 rounded-lg border border-subtle bg-surface p-3 text-left font-mono text-[11px]">
                          <div className="h-3 w-1/3 rounded bg-subtle" />
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-2/3 items-center rounded border border-subtle bg-subtle px-2">
                              <span className="text-tertiary">contact: </span>
                              <span className="ml-1.5 rounded border border-strong bg-elevated px-1.5 py-0.5 text-accent">
                                [REDACTED_EMAIL]
                              </span>
                            </div>
                          </div>
                          <div className="flex h-7 w-1/3 items-center justify-center rounded border border-ok bg-elevated text-ok">
                            [BLOCKED_PHONE]
                          </div>
                          <div className="relative flex h-20 w-full items-center justify-center overflow-hidden rounded border border-subtle bg-subtle">
                            <span className="text-tertiary">webpage visual canvas</span>
                            <div className="absolute top-1.5 right-3 flex size-14 flex-col items-center justify-center rounded border border-danger bg-surface p-1 text-center">
                              <TbEyeOff className="text-danger text-sm" />
                              <span className="mt-0.5 text-[8px] uppercase text-danger">face mask</span>
                            </div>
                          </div>
                          <div className="flex h-8 w-full items-center justify-center rounded border border-warn bg-warn-soft text-[10px] text-warn">
                            [SOLID MASK: PASSWORD / SENSITIVE FIELD]
                          </div>
                        </div>
                        <span className="mt-2 font-mono text-[10px] text-tertiary">
                          (simulated local viewport sanitization)
                        </span>
                      </div>
                    )}

                    {/* Capture Action Bar */}
                    {onCaptureCurrentTab && (
                      <div className="flex justify-end border-t border-subtle p-2">
                        <button
                          type="button"
                          onClick={onCaptureCurrentTab}
                          disabled={isCapturing}
                          className="flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-[11px] font-semibold text-ink hover:opacity-90 disabled:opacity-50">
                          <FiCamera size={12} className={isCapturing ? 'animate-spin' : ''} />
                          <span>{isCapturing ? 'sanitizing…' : 'capture active tab'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-primary">active redaction categories</span>
                  <span className="flex items-center gap-1 font-mono text-[11px] text-ok">
                    <FiCheck size={12} /> 100% on-device
                  </span>
                </div>

                <div className="frame-outer">
                  <div className="frame-inner">
                    {/* Manifest table header */}
                    <div className="grid grid-cols-12 gap-2 border-b border-subtle bg-subtle px-3 py-1.5 font-mono text-[10px] uppercase text-tertiary">
                      <span className="col-span-4">kind</span>
                      <span className="col-span-3">method</span>
                      <span className="col-span-3">source</span>
                      <span className="col-span-2 text-right">bbox</span>
                    </div>
                    {sampleManifest.map((item, idx) => {
                      const Icon = kindIcons[item.kind] || FiLock;
                      return (
                        <div
                          key={item.id}
                          className={`grid grid-cols-12 items-center gap-2 px-3 py-2 font-mono text-[11px] hover:bg-subtle ${
                            idx < sampleManifest.length - 1 ? 'border-b border-subtle' : ''
                          }`}>
                          <span className="col-span-4 flex items-center gap-1.5 text-primary">
                            <Icon size={12} className="text-tertiary" />
                            {kindLabels[item.kind]}
                          </span>
                          <span className="col-span-3 text-secondary">{item.method}</span>
                          <span className="col-span-3 text-tertiary">{item.source}</span>
                          <span className="col-span-2 truncate text-right text-tertiary" title={item.bboxDescription}>
                            {item.bboxDescription.split(']')[0]}]
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-subtle bg-subtle px-3 py-2">
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-tertiary">
              <FiInfo size={12} />
              <span>target model: qwen3-vl 2b/4b</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md border border-strong px-3 py-1.5 font-mono text-[11px] font-semibold text-secondary hover:border-accent hover:text-accent">
              close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPreviewModal;
