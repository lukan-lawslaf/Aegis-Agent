import { useState, useEffect } from 'react';
import { type GeneralSettingsConfig, generalSettingsStore, DEFAULT_GENERAL_SETTINGS } from '@extension/storage';
import { t } from '@extension/i18n';

const toggleClass =
  "peer h-6 w-11 rounded-full bg-border-strong after:absolute after:left-[2px] after:top-[2px] after:size-5 after:rounded-full after:border after:border-strong after:bg-surface after:transition-all after:content-[''] peer-checked:bg-accent peer-checked:after:translate-x-full peer-checked:after:border-surface peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent";

const numberInputClass =
  'w-20 rounded-md border border-subtle bg-subtle px-3 py-2 font-mono text-primary focus:border-accent focus:outline-hidden';

export const GeneralSettings = () => {
  const [settings, setSettings] = useState<GeneralSettingsConfig>(DEFAULT_GENERAL_SETTINGS);

  useEffect(() => {
    // Load initial settings
    generalSettingsStore.getSettings().then(setSettings);
  }, []);

  const updateSetting = async <K extends keyof GeneralSettingsConfig>(key: K, value: GeneralSettingsConfig[K]) => {
    // Optimistically update the local state for responsiveness
    setSettings(prevSettings => ({ ...prevSettings, [key]: value }));

    // Call the store to update the setting
    await generalSettingsStore.updateSettings({ [key]: value } as Partial<GeneralSettingsConfig>);

    // After the store update (which might have side effects, e.g., useVision affecting displayHighlights),
    // fetch the latest settings from the store and update the local state again to ensure UI consistency.
    const latestSettings = await generalSettingsStore.getSettings();
    setSettings(latestSettings);
  };

  const settingRow = (
    id: string,
    title: string,
    description: string,
    control: React.ReactNode,
  ) => (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-primary">{title}</h3>
        <p className="text-[13px] text-secondary">{description}</p>
      </div>
      {control}
    </div>
  );

  return (
    <section className="space-y-6">
      <div className="frame-outer">
        <div className="frame-inner p-6 text-left">
          <h2 className="mb-2 text-left text-xl font-medium text-primary">{t('options_general_header')}</h2>

          <div className="divide-y divide-[var(--c-border-subtle)]">
            {settingRow(
              'maxSteps',
              t('options_general_maxSteps'),
              t('options_general_maxSteps_desc'),
              <input
                id="maxSteps"
                type="number"
                min={1}
                max={50}
                value={settings.maxSteps}
                onChange={(e) => updateSetting('maxSteps', Number.parseInt(e.target.value, 10))}
                className={numberInputClass}
              />,
            )}

            {settingRow(
              'maxActionsPerStep',
              t('options_general_maxActions'),
              t('options_general_maxActions_desc'),
              <input
                id="maxActionsPerStep"
                type="number"
                min={1}
                max={50}
                value={settings.maxActionsPerStep}
                onChange={(e) => updateSetting('maxActionsPerStep', Number.parseInt(e.target.value, 10))}
                className={numberInputClass}
              />,
            )}

            {settingRow(
              'maxFailures',
              t('options_general_maxFailures'),
              t('options_general_maxFailures_desc'),
              <input
                id="maxFailures"
                type="number"
                min={1}
                max={10}
                value={settings.maxFailures}
                onChange={(e) => updateSetting('maxFailures', Number.parseInt(e.target.value, 10))}
                className={numberInputClass}
              />,
            )}

            {settingRow(
              'useVision',
              t('options_general_enableVision'),
              t('options_general_enableVision_desc'),
              <div className="relative inline-flex cursor-pointer items-center">
                <input
                  id="useVision"
                  type="checkbox"
                  checked={settings.useVision}
                  onChange={(e) => updateSetting('useVision', e.target.checked)}
                  className="peer sr-only"
                />
                <label htmlFor="useVision" className={toggleClass}>
                  <span className="sr-only">{t('options_general_enableVision')}</span>
                </label>
              </div>,
            )}

            {settingRow(
              'displayHighlights',
              t('options_general_displayHighlights'),
              t('options_general_displayHighlights_desc'),
              <div className="relative inline-flex cursor-pointer items-center">
                <input
                  id="displayHighlights"
                  type="checkbox"
                  checked={settings.displayHighlights}
                  onChange={(e) => updateSetting('displayHighlights', e.target.checked)}
                  className="peer sr-only"
                />
                <label htmlFor="displayHighlights" className={toggleClass}>
                  <span className="sr-only">{t('options_general_displayHighlights')}</span>
                </label>
              </div>,
            )}

            {settingRow(
              'planningInterval',
              t('options_general_planningInterval'),
              t('options_general_planningInterval_desc'),
              <input
                id="planningInterval"
                type="number"
                min={1}
                max={20}
                value={settings.planningInterval}
                onChange={(e) => updateSetting('planningInterval', Number.parseInt(e.target.value, 10))}
                className={numberInputClass}
              />,
            )}

            {settingRow(
              'minWaitPageLoad',
              t('options_general_minWaitPageLoad'),
              t('options_general_minWaitPageLoad_desc'),
              <input
                id="minWaitPageLoad"
                type="number"
                min={250}
                max={5000}
                step={50}
                value={settings.minWaitPageLoad}
                onChange={(e) => updateSetting('minWaitPageLoad', Number.parseInt(e.target.value, 10))}
                className={numberInputClass}
              />,
            )}

            {settingRow(
              'replayHistoricalTasks',
              t('options_general_replayHistoricalTasks'),
              t('options_general_replayHistoricalTasks_desc'),
              <div className="relative inline-flex cursor-pointer items-center">
                <input
                  id="replayHistoricalTasks"
                  type="checkbox"
                  checked={settings.replayHistoricalTasks}
                  onChange={(e) => updateSetting('replayHistoricalTasks', e.target.checked)}
                  className="peer sr-only"
                />
                <label htmlFor="replayHistoricalTasks" className={toggleClass}>
                  <span className="sr-only">{t('options_general_replayHistoricalTasks')}</span>
                </label>
              </div>,
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
