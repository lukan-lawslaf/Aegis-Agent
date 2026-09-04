import { useState, useEffect, useCallback } from 'react';
import { firewallStore } from '@extension/storage';
import { Button } from '@extension/ui';
import { t } from '@extension/i18n';

export const FirewallSettings = () => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [allowList, setAllowList] = useState<string[]>([]);
  const [denyList, setDenyList] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [activeList, setActiveList] = useState<'allow' | 'deny'>('allow');

  const loadFirewallSettings = useCallback(async () => {
    const settings = await firewallStore.getFirewall();
    setIsEnabled(settings.enabled);
    setAllowList(settings.allowList);
    setDenyList(settings.denyList);
  }, []);

  useEffect(() => {
    loadFirewallSettings();
  }, [loadFirewallSettings]);

  const handleToggleFirewall = async () => {
    await firewallStore.updateFirewall({ enabled: !isEnabled });
    await loadFirewallSettings();
  };

  const handleAddUrl = async () => {
    // Remove http:// or https:// prefixes
    const cleanUrl = newUrl.trim().replace(/^https?:\/\//, '');
    if (!cleanUrl) return;

    if (activeList === 'allow') {
      await firewallStore.addToAllowList(cleanUrl);
    } else {
      await firewallStore.addToDenyList(cleanUrl);
    }
    await loadFirewallSettings();
    setNewUrl('');
  };

  const handleRemoveUrl = async (url: string, listType: 'allow' | 'deny') => {
    if (listType === 'allow') {
      await firewallStore.removeFromAllowList(url);
    } else {
      await firewallStore.removeFromDenyList(url);
    }
    await loadFirewallSettings();
  };

  const listTabClass = (isActive: boolean) =>
    `px-4 py-1.5 text-sm font-medium ${
      isActive
        ? 'border-b-2 border-accent text-primary'
        : 'border-b-2 border-transparent text-tertiary hover:text-secondary'
    }`;

  return (
    <section className="space-y-6">
      <div className="frame-outer">
        <div className="frame-inner p-6 text-left">
          <h2 className="mb-4 text-xl font-medium text-primary">{t('options_firewall_header')}</h2>

          <div className="space-y-6">
            {/* Firewall toggle */}
            <div className="my-4 rounded-lg border border-subtle bg-subtle p-4">
              <div className="flex items-center justify-between">
                <label htmlFor="toggle-firewall" className="font-medium text-primary">
                  {t('options_firewall_enableToggle')}
                </label>
                <div className="relative inline-block w-12 select-none">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={handleToggleFirewall}
                    className="sr-only"
                    id="toggle-firewall"
                  />
                  <label
                    htmlFor="toggle-firewall"
                    className={`block h-6 cursor-pointer overflow-hidden rounded-full border border-strong ${
                      isEnabled ? 'bg-ok' : 'bg-elevated'
                    }`}>
                    <span className="sr-only">{t('options_firewall_toggleFirewall_a11y')}</span>
                    <span
                      className={`block size-6 rounded-full bg-surface transition-transform ${
                        isEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Allow / Deny tabs */}
            <div className="flex space-x-4 border-b border-subtle">
              <button
                type="button"
                onClick={() => setActiveList('allow')}
                className={`cursor-pointer ${listTabClass(activeList === 'allow')}`}>
                {t('options_firewall_allowList_header')}
              </button>
              <button
                type="button"
                onClick={() => setActiveList('deny')}
                className={`cursor-pointer ${listTabClass(activeList === 'deny')}`}>
                {t('options_firewall_denyList_header')}
              </button>
            </div>

            {/* Add URL */}
            <div className="mb-4 flex space-x-2">
              <input
                id="url-input"
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddUrl();
                  }
                }}
                placeholder={t('options_firewall_placeholders_domainUrl')}
                className="flex-1 rounded-md border border-subtle bg-subtle px-3 py-2 font-mono text-sm text-primary placeholder:text-tertiary focus:border-accent focus:outline-hidden"
              />
              <Button
                onClick={handleAddUrl}
                className="rounded-md bg-primary px-4 py-2 text-sm text-ink hover:opacity-90">
                {t('options_firewall_btnAdd')}
              </Button>
            </div>

            {/* Domain list — dense hairline rows */}
            <div className="max-h-64 overflow-y-auto">
              {activeList === 'allow' ? (
                allowList.length > 0 ? (
                  <ul className="rounded-lg border border-subtle">
                    {allowList.map((url, idx) => (
                      <li
                        key={url}
                        className={`flex items-center justify-between px-3 py-2 ${
                          idx < allowList.length - 1 ? 'border-b border-subtle' : ''
                        }`}>
                        <span className="font-mono text-sm text-secondary">{url}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveUrl(url, 'allow')}
                          className="cursor-pointer rounded-md border border-subtle px-2 py-1 font-mono text-xs text-tertiary hover:border-danger hover:text-danger">
                          {t('options_firewall_btnRemove')}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center font-mono text-sm text-tertiary">
                    {t('options_firewall_allowList_empty')}
                  </p>
                )
              ) : denyList.length > 0 ? (
                <ul className="rounded-lg border border-subtle">
                  {denyList.map((url, idx) => (
                    <li
                      key={url}
                      className={`flex items-center justify-between px-3 py-2 ${
                        idx < denyList.length - 1 ? 'border-b border-subtle' : ''
                      }`}>
                      <span className="font-mono text-sm text-secondary">{url}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveUrl(url, 'deny')}
                        className="cursor-pointer rounded-md border border-subtle px-2 py-1 font-mono text-xs text-tertiary hover:border-danger hover:text-danger">
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center font-mono text-sm text-tertiary">{t('options_firewall_denyList_empty')}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="frame-outer">
        <div className="frame-inner p-6 text-left">
          <h2 className="mb-4 text-xl font-medium text-primary">{t('options_firewall_howItWorks_header')}</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-left text-sm text-secondary">
            {t('options_firewall_howItWorks')
              .split('\n')
              .map((rule, index) => (
                <li key={index}>{rule}</li>
              ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
