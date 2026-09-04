import React from 'react';
import { FiSettings, FiSun, FiMoon, FiShield, FiPlus, FiClock, FiArrowLeft } from 'react-icons/fi';
import { ConnectionIndicator, type ProviderMode } from './ConnectionIndicator';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onNewChat: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenPrivacyPreview: () => void;
  showHistory: boolean;
  onBackToChat: () => void;
  providerMode: ProviderMode;
  onProviderChange: (mode: ProviderMode) => void;
  serverUrl?: string;
  totalRedactionsCount?: number;
  /** Privacy firewall master switch state (live from storage). */
  sanitizeContent?: boolean;
  onToggleSanitization?: (next: boolean) => void;
}

export function Header({
  isDarkMode,
  onToggleTheme,
  onNewChat,
  onOpenHistory,
  onOpenSettings,
  onOpenPrivacyPreview,
  showHistory,
  onBackToChat,
  providerMode,
  onProviderChange,
  serverUrl,
  totalRedactionsCount = 0,
  sanitizeContent = true,
  onToggleSanitization,
}: HeaderProps) {
  const iconButton =
    'relative p-1.5 rounded-md text-tertiary hover:text-secondary hover:bg-elevated transition-colors cursor-pointer';

  return (
    <header className="relative z-20 flex flex-col border-b border-subtle bg-surface px-3 py-2.5">
      {/* Top Bar: Brand, Logo & Action Buttons */}
      <div className="flex items-center justify-between gap-2">
        {showHistory ? (
          <button
            type="button"
            onClick={onBackToChat}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 font-mono text-xs text-secondary hover:bg-elevated hover:text-primary"
            aria-label="Back to Task">
            <FiArrowLeft size={13} />
            <span>cd ..</span>
          </button>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <img
              src="/logo.svg"
              alt="Aegis Logo"
              className="size-6 shrink-0 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/icon-32.png';
              }}
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold tracking-tight text-primary">Aegis Agent</span>
              <span className="truncate font-mono text-[10px] leading-tight text-tertiary">SIH-26171 · v0.1.13</span>
            </div>
          </div>
        )}

        {/* Action icons right */}
        <div className="flex shrink-0 items-center gap-0.5">
          {!showHistory && (
            <>
              {/* Privacy Shield Preview Button */}
              <button
                type="button"
                onClick={onOpenPrivacyPreview}
                title="Inspect privacy firewall & live redactions"
                className={iconButton}
                aria-label="Privacy Shield Preview">
                <FiShield size={15} />
                {totalRedactionsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-ok px-1 font-mono text-[9px] font-semibold text-ink">
                    {totalRedactionsCount > 9 ? '9+' : totalRedactionsCount}
                  </span>
                )}
              </button>

              {/* New Task */}
              <button
                type="button"
                onClick={onNewChat}
                title="New Task"
                className={iconButton}
                aria-label="New Task">
                <FiPlus size={15} />
              </button>

              {/* History */}
              <button
                type="button"
                onClick={onOpenHistory}
                title="Task History"
                className={iconButton}
                aria-label="Task History">
                <FiClock size={14} />
              </button>
            </>
          )}

          {/* Theme toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className={iconButton}
            aria-label="Toggle Theme">
            {isDarkMode ? <FiSun size={14} /> : <FiMoon size={14} />}
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={onOpenSettings}
            title="FastAPI Gateway Settings"
            className={iconButton}
            aria-label="Settings">
            <FiSettings size={14} />
          </button>
        </div>
      </div>

      {/* Sub-bar: Connection Indicator & Protection Status */}
      {!showHistory && (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-subtle pt-2">
          <ConnectionIndicator
            isDarkMode={isDarkMode}
            providerMode={providerMode}
            onProviderChange={onProviderChange}
            serverUrl={serverUrl}
          />
          <div className="flex items-center gap-1.5">
            {/* Firewall master switch — click to toggle sanitization */}
            <button
              type="button"
              onClick={() => onToggleSanitization?.(!sanitizeContent)}
              disabled={!onToggleSanitization}
              className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[11px] transition-colors disabled:cursor-default ${
                sanitizeContent ? 'text-ok hover:bg-ok-soft' : 'bg-warn-soft text-warn hover:opacity-80'
              }`}
              title={
                sanitizeContent
                  ? 'Privacy firewall ON — faces blurred, PII masked before anything leaves this device. Click to turn off (trusted pages only).'
                  : 'Privacy firewall OFF — raw page content goes to the gateway. Click to re-enable.'
              }
              aria-pressed={sanitizeContent}
              aria-label="Toggle privacy firewall">
              <span
                className={`inline-block size-1.5 rounded-full ${sanitizeContent ? 'bg-ok' : 'bg-warn animate-pulse'}`}
              />
              <span>{sanitizeContent ? 'firewall: active' : 'firewall: off'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenPrivacyPreview}
              className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[11px] text-tertiary hover:bg-elevated hover:text-secondary"
              title="Click to inspect perception firewall metrics">
              <span>preview</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;
