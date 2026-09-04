import fs from 'node:fs';
import deepmerge from 'deepmerge';

const packageJson = JSON.parse(fs.readFileSync('../package.json', 'utf8'));

const isFirefox = process.env.__FIREFOX__ === 'true';
const isOpera = process.env.__OPERA__ === 'true';

/**
 * If you want to disable the sidePanel, you can delete withSidePanel function and remove the sidePanel HoC on the manifest declaration.
 *
 * ```js
 * const manifest = { // remove `withSidePanel()`
 * ```
 */
function withSidePanel(manifest) {
  // Firefox does not support sidePanel
  if (isFirefox) {
    return manifest;
  }
  return deepmerge(manifest, {
    side_panel: {
      default_path: 'side-panel/index.html',
    },
    permissions: ['sidePanel'],
  });
}

/**
 * Adds Opera sidebar support using the sidebar_action API.
 * This is compatible with Chrome extensions and won't break Chrome Web Store validation.
 */
function withOperaSidebar(manifest) {
  // Only add Opera sidebar_action if building specifically for Opera
  if (isFirefox || !isOpera) {
    return manifest;
  }

  return deepmerge(manifest, {
    sidebar_action: {
      default_panel: 'side-panel/index.html',
      default_title: 'Aegis-Agent',
      default_icon: 'icon-32.png',
    },
  });
}

function withFirefoxRuntime(manifest) {
  if (!isFirefox) return manifest;
  return deepmerge(manifest, {
    // Firefox MV3 uses an event/background script rather than Chrome's
    // service_worker entry. The bundled file is shared with Chrome.
    background: {
      scripts: ['background.iife.js'],
    },
    sidebar_action: {
      default_panel: 'side-panel/index.html',
      default_title: 'SIH Privacy Agent',
      open_at_install: false,
    },
    browser_specific_settings: {
      gecko: {
        id: 'sih-privacy-agent@example.local',
        strict_min_version: '109.0',
      },
    },
  });
}

/**
 * After changing, please reload the extension at `chrome://extensions`
 * @type {chrome.runtime.ManifestV3}
 */
const manifest = withFirefoxRuntime(withOperaSidebar(
  withSidePanel({
    manifest_version: 3,
    default_locale: 'en',
    /**
     * if you want to support multiple languages, you can use the following reference
     * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization
     */
    name: '__MSG_app_metadata_name__',
    version: packageJson.version,
    description: '__MSG_app_metadata_description__',
    host_permissions: ['<all_urls>'],
    permissions: ['storage', 'scripting', 'tabs', 'activeTab', 'debugger', 'unlimitedStorage', 'webNavigation'],
    // onnxruntime-web compiles WebAssembly inside the service worker; the
    // default MV3 CSP blocks wasm compilation, which kills the local
    // BlazeFace privacy model before any pixel can be redacted.
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    options_page: 'options/index.html',
    background: {
      service_worker: 'background.iife.js',
      // Classic worker on purpose: dynamic import() is disallowed on
      // ServiceWorkerGlobalScope, so the ORT runtime is pulled in with
      // importScripts() (see src/background/sih/ort-webgpu.ts).
    },
    action: {
      default_icon: 'icon-32.png',
      default_title: 'Aegis-Agent',
    },
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
    content_scripts: [
      {
        matches: ['http://*/*', 'https://*/*', '<all_urls>'],
        all_frames: true,
        js: ['content/index.iife.js'],
      },
    ],
    web_accessible_resources: [
      {
        resources: [
          '*.js',
          '*.css',
          '*.svg',
          'icon-16.png',
          'icon-48.png',
          'icon-128.png',
          'icon-32.png',
          'permission/index.html',
          'permission/permission.js',
        ],
        matches: ['*://*/*'],
      },
    ],
  }),
));

export default manifest;
