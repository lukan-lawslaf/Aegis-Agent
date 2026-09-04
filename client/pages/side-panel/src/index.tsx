import { createRoot } from 'react-dom/client';
import '@src/index.css';

/**
 * The real side panel runs inside a Chrome/Firefox extension and receives the
 * WebExtension APIs from the browser. Vite's local preview is an ordinary web
 * page, so provide a tiny in-memory adapter only when those APIs are absent.
 * This is never used in an installed extension.
 */
function installPreviewExtensionShim() {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) return;

  const values: Record<string, unknown> = {};
  const listeners: Array<(changes: Record<string, chrome.storage.StorageChange>) => void> = [];
  const area = {
    get: async (keys?: string | string[] | Record<string, unknown>) => {
      if (!keys) return { ...values };
      if (typeof keys === 'string') return { [keys]: values[keys] };
      if (Array.isArray(keys)) return Object.fromEntries(keys.map(key => [key, values[key]]));
      return Object.fromEntries(Object.keys(keys).map(key => [key, values[key] ?? keys[key]]));
    },
    set: async (items: Record<string, unknown>) => {
      const changes: Record<string, chrome.storage.StorageChange> = {};
      Object.entries(items).forEach(([key, newValue]) => {
        changes[key] = { oldValue: values[key], newValue };
        values[key] = newValue;
      });
      listeners.forEach(listener => listener(changes));
    },
    remove: async (keys: string | string[]) => {
      (Array.isArray(keys) ? keys : [keys]).forEach(key => delete values[key]);
    },
    clear: async () => Object.keys(values).forEach(key => delete values[key]),
    onChanged: { addListener: (listener: (changes: Record<string, chrome.storage.StorageChange>) => void) => listeners.push(listener), removeListener: () => undefined },
  };

  const port = {
    name: 'preview',
    onMessage: { addListener: () => undefined, removeListener: () => undefined },
    onDisconnect: { addListener: () => undefined, removeListener: () => undefined },
    postMessage: () => undefined,
    disconnect: () => undefined,
  };

  const extensionChrome = {
    storage: { local: area, sync: area, session: area, onChanged: { addListener: (listener: (changes: Record<string, chrome.storage.StorageChange>) => void) => listeners.push(listener), removeListener: () => undefined } },
    runtime: { connect: () => port, sendMessage: async () => undefined, getURL: (path: string) => path, openOptionsPage: () => undefined },
    i18n: { getMessage: (key: string) => key },
    tabs: { query: async () => [], captureVisibleTab: async () => undefined },
  } as unknown as typeof chrome;

  Object.assign(globalThis, { chrome: extensionChrome });
}

async function init() {
  installPreviewExtensionShim();
  const { default: SidePanel } = await import('@src/SidePanel');
  const appContainer = document.querySelector('#app-container');
  if (!appContainer) {
    throw new Error('Can not find #app-container');
  }
  const root = createRoot(appContainer);
  root.render(<SidePanel />);
}

void init();
