import { useState, useEffect, useRef } from 'react';
import { FiCheckCircle, FiAlertCircle, FiChevronDown, FiRefreshCw } from 'react-icons/fi';
import { TbShieldCheck } from 'react-icons/tb';

export type ProviderMode = 'fastapi' | 'ollama' | 'openai_compat';
export type ConnectionStatus = 'connected' | 'checking' | 'disconnected';

interface ConnectionIndicatorProps {
  isDarkMode?: boolean;
  providerMode?: ProviderMode;
  onProviderChange?: (mode: ProviderMode) => void;
  serverUrl?: string;
}

export function ConnectionIndicator({
  serverUrl = 'http://127.0.0.1:8000/v1',
}: ConnectionIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const checkConnection = async () => {
    setStatus('checking');
    const start = performance.now();
    try {
      const targetUrl = serverUrl.replace(/\/v1\/?$/, '') + '/health';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
      }).catch(async () => {
        const fallbackController = new AbortController();
        const fallbackTimeout = setTimeout(() => fallbackController.abort(), 2000);
        return fetch(serverUrl.replace(/\/+$/, '') + '/models', {
          method: 'GET',
          signal: fallbackController.signal,
        })
          .catch(() => null)
          .finally(() => clearTimeout(fallbackTimeout));
      });

      clearTimeout(timeoutId);

      const elapsed = Math.round(performance.now() - start);
      if (response && response.ok) {
        setLatency(elapsed);
        setStatus('connected');
      } else {
        setLatency(null);
        setStatus('disconnected');
      }
    } catch {
      setLatency(null);
      setStatus('disconnected');
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl]);

  const statusDot =
    status === 'connected' ? 'bg-ok' : status === 'checking' ? 'bg-warn animate-pulse' : 'bg-danger';
  const statusLabel =
    status === 'connected' ? 'gateway: up' : status === 'checking' ? 'gateway: …' : 'gateway: down';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-secondary hover:text-primary"
        aria-label="Connection Status"
        title={`FastAPI Gateway: ${
          status === 'connected' ? 'Connected' : status === 'checking' ? 'Checking' : 'Disconnected (Offline)'
        }`}>
        <span className={`inline-block size-1.5 rounded-full ${statusDot}`} />
        <span>{statusLabel}</span>
        <FiChevronDown size={11} className={`text-tertiary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="frame-outer absolute left-0 z-50 mt-2 w-72">
          <div className="frame-inner p-2.5">
            <div className="mb-2 flex items-center justify-between border-b border-subtle pb-2">
              <div className="flex items-center gap-1.5">
                <TbShieldCheck className="text-ok" size={14} />
                <span className="font-mono text-[11px] text-primary">gateway health</span>
              </div>
              <button
                type="button"
                onClick={checkConnection}
                title="Ping Gateway"
                className="cursor-pointer rounded-md p-1 text-tertiary hover:text-accent">
                <FiRefreshCw size={11} className={status === 'checking' ? 'animate-spin text-accent' : ''} />
              </button>
            </div>

            <div
              className={`mb-2 rounded-md border p-2 font-mono text-[11px] ${
                status === 'connected'
                  ? 'border-ok bg-ok-soft text-ok'
                  : status === 'checking'
                    ? 'border-warn bg-warn-soft text-warn'
                    : 'border-danger bg-danger-soft text-danger'
              }`}>
              <div className="flex items-center gap-1.5">
                {status === 'connected' ? (
                  <FiCheckCircle size={12} />
                ) : status === 'checking' ? (
                  <FiRefreshCw size={12} className="animate-spin" />
                ) : (
                  <FiAlertCircle size={12} />
                )}
                <span>
                  {status === 'connected'
                    ? 'gateway active & ready'
                    : status === 'checking'
                      ? 'testing gateway path…'
                      : 'gateway unreachable'}
                </span>
              </div>
              <p className="mt-1 leading-snug text-secondary">
                {status === 'connected'
                  ? `connected · ${latency ?? 0}ms roundtrip latency`
                  : status === 'checking'
                    ? 'pinging endpoint at 127.0.0.1:8000…'
                    : 'ensure the FastAPI service is running locally on port 8000.'}
              </p>
            </div>

            {/* Architecture note */}
            <div className="mb-2 rounded-md border border-subtle p-2 text-[11px] leading-relaxed text-secondary">
              <span className="font-mono block text-primary">privacy egress guard</span>
              Only sanitized visual context and DOM abstractions cross into the local gateway endpoint.
            </div>

            <div className="flex items-center justify-between border-t border-subtle pt-2 font-mono text-[10px] text-tertiary">
              <span className="max-w-[180px] truncate" title={serverUrl}>
                {serverUrl}
              </span>
              {latency !== null && <span className="text-ok">{latency}ms</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConnectionIndicator;
