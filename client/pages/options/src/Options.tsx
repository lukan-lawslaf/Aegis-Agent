import { useState, useEffect } from 'react';
import '@src/Options.css';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { FiSettings, FiCpu, FiShield, FiTrendingUp, FiInfo, FiSun, FiMoon } from 'react-icons/fi';
import { TbBrandChrome, TbBrandFirefox } from 'react-icons/tb';
import { GeneralSettings } from './components/GeneralSettings';
import { ModelSettings } from './components/ModelSettings';
import { FirewallSettings } from './components/FirewallSettings';
import { AnalyticsSettings } from './components/AnalyticsSettings';

type TabTypes = 'general' | 'models' | 'firewall' | 'analytics' | 'about';

const TABS: { id: TabTypes; icon: React.ComponentType<{ className?: string; size?: number }>; label: string }[] = [
  { id: 'models', icon: FiCpu, label: 'Gateway & Qwen3-VL' },
  { id: 'firewall', icon: FiShield, label: 'Privacy Firewall' },
  { id: 'general', icon: FiSettings, label: 'Execution & Safety' },
  { id: 'analytics', icon: FiTrendingUp, label: 'Audit Analytics' },
  { id: 'about', icon: FiInfo, label: 'About Aegis-Agent' },
];

const Options = () => {
  const [activeTab, setActiveTab] = useState<TabTypes>('models');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeMediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };

    darkModeMediaQuery.addEventListener('change', handleChange);
    return () => darkModeMediaQuery.removeEventListener('change', handleChange);
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettings />;
      case 'models':
        return <ModelSettings isDarkMode={isDarkMode} />;
      case 'firewall':
        return <FirewallSettings />;
      case 'analytics':
        return <AnalyticsSettings isDarkMode={isDarkMode} />;
      case 'about':
        return (
          <section className="space-y-4">
            <div className="frame-outer">
              <div className="frame-inner p-6 text-left">
                <div className="mb-4 flex items-center gap-3 border-b border-subtle pb-4">
                  <img src="/logo.svg" alt="Aegis-Agent Logo" className="size-9 shrink-0 object-contain" />
                  <div>
                    <h2 className="text-lg font-medium tracking-tight text-primary">Aegis-Agent</h2>
                    <p className="font-mono text-[11px] text-tertiary">
                      Smart India Hackathon 2026 — Problem Statement 26171
                    </p>
                  </div>
                </div>

                <div className="space-y-3 text-[13px] leading-relaxed text-secondary">
                  <p>
                    <strong className="text-primary">Core Architecture:</strong> Aegis-Agent is an on-device visual
                    perception firewall and browser assistant designed to observe webpages locally, redact faces with
                    BlazeFace, strip PII and sensitive form elements before egress, and transmit only sanitized context
                    to a central Qwen3-VL model via FastAPI.
                  </p>
                  <p>
                    <strong className="text-primary">Single-Brain Invariant:</strong> Qwen3-VL (2B or 4B) is the sole
                    generative planner and reasoner. No raw DOM, raw screenshots, or unmasked credentials ever leave
                    this device over the LAN or Internet.
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 border-t border-subtle pt-4">
                  <div className="rounded-lg border border-subtle bg-subtle p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <TbBrandChrome className="text-const" size={16} />
                      <span className="text-xs font-medium text-primary">Chrome / Chromium MV3</span>
                    </div>
                    <p className="text-[11px] text-secondary">
                      Runs as a native Side Panel (`sidePanel` API) with background service worker.
                    </p>
                  </div>

                  <div className="rounded-lg border border-subtle bg-subtle p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <TbBrandFirefox className="text-warn" size={16} />
                      <span className="text-xs font-medium text-primary">Mozilla Firefox MV3</span>
                    </div>
                    <p className="text-[11px] text-secondary">
                      Runs as a native Sidebar (`sidebar_action` API) with event scripts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex min-h-screen bg-ink ${isDarkMode ? 'dark' : ''}`}>
      {/* Vertical Navigation Bar */}
      <nav className="flex w-64 shrink-0 flex-col justify-between border-r border-subtle bg-surface p-4">
        <div>
          {/* Logo & Header */}
          <div className="mb-6 flex items-center gap-2.5 px-2">
            <img src="/logo.svg" alt="Aegis Logo" className="size-7 shrink-0 object-contain" />
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-primary">Aegis-Agent</h1>
              <span className="font-mono text-[10px] text-tertiary">gateway suite</span>
            </div>
          </div>

          {/* Navigation Links */}
          <ul className="space-y-0.5">
            {TABS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium ${
                      isActive
                        ? 'border-l-2 border-accent bg-accent-soft text-primary'
                        : 'border-l-2 border-transparent text-secondary hover:bg-subtle hover:text-primary'
                    }`}>
                    <Icon size={14} className={isActive ? 'text-accent' : 'text-tertiary'} />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer info & Theme Toggle */}
        <div className="flex items-center justify-between border-t border-subtle px-2 pt-4">
          <span className="font-mono text-[10px] text-tertiary">SIH-26171 · v0.1.13</span>
          <button
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            title="Toggle theme"
            className="cursor-pointer rounded-md p-1.5 text-tertiary hover:bg-elevated hover:text-secondary">
            {isDarkMode ? <FiSun size={14} /> : <FiMoon size={14} />}
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl">{renderTabContent()}</div>
      </main>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <div>Loading...</div>), <div>Error Occurred</div>);
