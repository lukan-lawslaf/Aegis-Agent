import React, { useState } from 'react';
import { FiX, FiServer, FiShield, FiCpu, FiCheck, FiAlertCircle, FiExternalLink, FiLayers } from 'react-icons/fi';
import { TbBrandChrome, TbBrandFirefox } from 'react-icons/tb';
import type { ProviderMode } from './ConnectionIndicator';

/** Friendly label → gateway model tag. The UI never shows raw tags. */
export const GATEWAY_MODEL_CHOICES = [
  { label: 'gemma4', value: 'gemma4:31b-cloud' },
  { label: 'qwen3-vl 4b instruct', value: 'qwen3-vl:4b-instruct' },
  { label: 'qwen3-vl 4b', value: 'qwen3-vl:4b' },
  { label: 'qwen3-vl 2b', value: 'qwen3-vl:2b' },
];

export function modelLabel(value: string): string {
  return GATEWAY_MODEL_CHOICES.find(choice => choice.value === value)?.label ?? value;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  serverUrl: string;
  onSaveServerUrl: (url: string) => void;
  /** Currently selected gateway model tag (runtime-switchable). */
  activeModel: string;
  onModelChange: (model: string) => void;
  providerMode?: ProviderMode;
  onProviderChange?: (mode: ProviderMode) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  serverUrl,
  onSaveServerUrl,
  activeModel,
  onModelChange,
}: SettingsModalProps) {
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [pingLatency, setPingLatency] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTestStatus('testing');
    const start = performance.now();
    try {
      const targetUrl = urlInput.replace(/\/v1\/?$/, '') + '/health';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
      }).catch(async () => {
        const fallbackController = new AbortController();
        const fallbackTimeout = setTimeout(() => fallbackController.abort(), 2000);
        return fetch(urlInput.replace(/\/+$/, '') + '/models', {
          method: 'GET',
          signal: fallbackController.signal,
        })
          .catch(() => null)
          .finally(() => clearTimeout(fallbackTimeout));
      });

      clearTimeout(timeoutId);

      const elapsed = Math.round(performance.now() - start);
      if (response && response.ok) {
        setPingLatency(elapsed);
        setTestStatus('success');
        onSaveServerUrl(urlInput);
      } else {
        setTestStatus('failed');
      }
    } catch {
      setTestStatus('failed');
    }
  };

  const handleOpenFullOptions = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
      <div className="frame-outer flex max-h-[92vh] w-full max-w-lg flex-col">
        <div className="frame-inner flex max-h-[92vh] w-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-subtle bg-subtle px-3 py-2">
            <div className="flex items-center gap-2">
              <FiServer size={15} className="text-accent" />
              <div>
                <span className="font-mono text-xs text-primary">gateway settings</span>
                <p className="text-[11px] leading-tight text-tertiary">SIH 26171 · FastAPI endpoint</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md p-1.5 text-tertiary hover:bg-elevated hover:text-primary"
              aria-label="Close settings">
              <FiX size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4 overflow-y-auto p-3">
            {/* Server URL Config */}
            <div className="space-y-1.5">
              <label htmlFor="fastapi-url" className="font-mono block text-[11px] text-secondary">
                fastapi gateway url (lan / localhost)
              </label>
              <div className="flex gap-2">
                <input
                  id="fastapi-url"
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="http://127.0.0.1:8000/v1"
                  className="flex-1 rounded-md border border-subtle bg-subtle px-2.5 py-1.5 font-mono text-xs text-primary placeholder:text-tertiary focus:border-accent focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing'}
                  className="shrink-0 cursor-pointer rounded-md border border-strong px-3 py-1.5 font-mono text-[11px] font-semibold text-secondary hover:border-accent hover:text-accent disabled:opacity-50">
                  {testStatus === 'testing' ? 'testing…' : 'ping'}
                </button>
              </div>
              {testStatus === 'success' && (
                <p className="flex items-center gap-1.5 pt-0.5 font-mono text-[11px] text-ok">
                  <FiCheck size={12} /> gateway responding ({pingLatency}ms latency)
                </p>
              )}
              {testStatus === 'failed' && (
                <p className="flex items-center gap-1.5 pt-0.5 font-mono text-[11px] text-danger">
                  <FiAlertCircle size={12} /> gateway unreachable. check if fastapi backend is running.
                </p>
              )}
            </div>

            {/* Model roles — split brain, runtime switchable executor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-secondary">executor model (applies to next task)</span>
                <span className="font-mono text-[10px] text-tertiary">
                  planner: qwen3-vl 4b instruct · 3m cap
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {GATEWAY_MODEL_CHOICES.map(choice => {
                  const isActive = choice.value === activeModel;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => onModelChange(choice.value)}
                      className={`cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                        isActive
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-subtle text-secondary hover:border-strong hover:text-primary'
                      }`}
                      aria-pressed={isActive}>
                      {choice.label}
                    </button>
                  );
                })}
              </div>
              <p className="font-mono text-[10px] text-tertiary">
                split brain: planner stays local + fast; executor is swappable. qwen3.5 is text-only — avoid for vision
                steps.
              </p>
            </div>

            {/* Architecture Note */}
            <div className="space-y-1.5 rounded-lg border border-subtle p-3">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-primary">
                <FiShield className="text-ok" size={13} /> gateway-mediated architecture
              </span>
              <p className="text-[11px] leading-relaxed text-secondary">
                The browser extension communicates <strong>exclusively</strong> with your local/LAN FastAPI gateway.
                All model orchestration (e.g. Qwen3-VL 2B / 4B running on Ollama, vLLM, or dedicated GPU) is decided
                and executed server-side. No credentials or unmasked DOM items ever cross outside the gateway
                boundary.
              </p>
            </div>

            {/* Single Brain Invariant info */}
            <div className="space-y-1.5 rounded-lg border border-subtle p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-primary">
                  <FiCpu className="text-kw" size={13} /> active executor model
                </span>
                <span className="rounded-md border border-subtle bg-subtle px-2 py-0.5 font-mono text-[10px] text-kw">
                  {modelLabel(activeModel)}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-secondary">
                Single-Brain Architecture: Qwen3-VL is the sole generative vision & planning model. Browser-side
                ViT / BlazeFace operates exclusively for local privacy detection and solid-mask rendering.
              </p>
            </div>

            {/* Multi-Browser Support */}
            <div className="space-y-1.5 rounded-lg border border-subtle p-3">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-primary">
                <FiLayers className="text-fn" size={13} /> cross-browser mv3 compatible
              </span>
              <div className="flex items-center gap-4 pt-1 text-[11px] text-secondary">
                <div className="flex items-center gap-1.5">
                  <TbBrandChrome className="text-const" size={15} />
                  <span>Chrome MV3 (sidePanel)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TbBrandFirefox className="text-warn" size={15} />
                  <span>Firefox MV3 (sidebar_action)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-subtle bg-subtle px-3 py-2">
            <button
              type="button"
              onClick={handleOpenFullOptions}
              className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-secondary hover:text-accent">
              <span>advanced firewall options</span>
              <FiExternalLink size={12} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md bg-primary px-3 py-1.5 font-mono text-[11px] font-semibold text-ink hover:opacity-90">
              done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
