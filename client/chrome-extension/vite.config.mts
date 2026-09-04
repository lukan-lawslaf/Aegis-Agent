import { resolve } from 'node:path';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { defineConfig, type PluginOption, loadEnv } from "vite";
import libAssetsPlugin from '@laynezh/vite-plugin-lib-assets';
import makeManifestPlugin from './utils/plugins/make-manifest-plugin';
import { watchPublicPlugin, watchRebuildPlugin } from '@extension/hmr';
import { isDev, isProduction, watchOption } from '@extension/vite-config';

const rootDir = resolve(__dirname);
const srcDir = resolve(rootDir, 'src');

const outDir = resolve(rootDir, '..', 'dist');

// onnxruntime-web is loaded at runtime (see src/background/sih/ort-webgpu.ts)
// instead of being bundled into the service worker. Its runtime files are
// copied to dist/ort/ so the worker can import them from the extension URL.
const ORT_DIST_FILES = [
  // UMD build — loaded by the classic service worker via importScripts().
  'ort.webgpu.min.js',
  'ort.webgpu.bundle.min.mjs',
  // The runtime dynamically loads whichever variant matches the selected
  // execution provider — ship them all so the wasm/webgpu fallbacks resolve.
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jspi.mjs',
  'ort-wasm-simd-threaded.jspi.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
];

function copyOrtRuntimePlugin(): PluginOption {
  return {
    name: 'copy-ort-runtime',
    closeBundle: async () => {
      const ortPkg = resolve(rootDir, 'node_modules', 'onnxruntime-web', 'dist');
      if (!existsSync(ortPkg)) return;
      const dest = resolve(outDir, 'ort');
      await mkdir(dest, { recursive: true });
      await Promise.all(
        ORT_DIST_FILES.map(file =>
          existsSync(resolve(ortPkg, file)) ? copyFile(resolve(ortPkg, file), resolve(dest, file)) : undefined,
        ),
      );

      // Classic-worker variant of the ESM bundle: dynamic import() is banned
      // in service workers, so the bundle (whose wasm glue is already inlined)
      // is rewritten into a plain script — import.meta.url becomes a runtime
      // global the loader sets before importScripts(), and the export
      // statement becomes a globalThis.ort assignment.
      const bundlePath = resolve(ortPkg, 'ort.webgpu.bundle.min.mjs');
      if (existsSync(bundlePath)) {
        let source = await readFile(bundlePath, 'utf8');
        const exportMatch = source.match(/export\{([^}]*)\};/);
        if (exportMatch) {
          const members = exportMatch[1]
            .split(',')
            .map(pair => pair.trim().split(/\s+as\s+/))
            .filter(parts => parts.length === 2)
            .map(([local, exported]) => `${exported}: ${local}`)
            .join(', ');
          source =
            source.slice(0, exportMatch.index) +
            `globalThis.ort = { ${members} };` +
            source.slice(exportMatch.index + exportMatch[0].length);
        }
        source = source.replaceAll('import.meta.url', 'globalThis.__SIH_ORT_URL__');
        await writeFile(resolve(dest, 'ort.webgpu.bundle.classic.js'), source);

        // Embed the same runtime directly in the service worker bundle so it
        // never depends on a runtime script load (importScripts can fail on
        // file/MIME quirks). The prologue pins the sibling-wasm base URL the
        // source uses instead of import.meta.url.
        const prologue =
          'globalThis.__SIH_ORT_URL__ = chrome.runtime.getURL("ort/ort.webgpu.bundle.min.mjs");\n';
        const backgroundPath = resolve(outDir, 'background.iife.js');
        if (existsSync(backgroundPath)) {
          const background = await readFile(backgroundPath, 'utf8');
          if (!background.includes('__SIH_ORT_URL__')) {
            await writeFile(backgroundPath, `${background}\n/* --- inlined onnxruntime-web (classic) --- */\n${prologue}${source}\n`);
          }
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load environment variables from the parent directory
  const env = loadEnv(mode, resolve(rootDir, '..'), 'VITE_');
  
  return {
  resolve: {
    alias: {
      '@root': rootDir,
      '@src': srcDir,
      '@assets': resolve(srcDir, 'assets'),
    },
    conditions: ['browser', 'module', 'import', 'default'],
    mainFields: ['browser', 'module', 'main']
  },
  server: {
    // Restrict CORS to only allow localhost
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true
    },
    host: 'localhost',
    sourcemapIgnoreList: false,
  },
  plugins: [
    libAssetsPlugin({
      outputPath: outDir,
    }) as PluginOption,
    copyOrtRuntimePlugin(),
    watchPublicPlugin(),
    makeManifestPlugin({ outDir }),
    isDev && watchRebuildPlugin({ reload: true, id: 'chrome-extension-hmr' }),
  ],
  publicDir: resolve(rootDir, 'public'),
  build: {
    lib: {
      formats: ['iife'],
      entry: resolve(__dirname, 'src/background/index.ts'),
      name: 'BackgroundScript',
      fileName: 'background',
    },
    outDir,
    emptyOutDir: false,
    sourcemap: isDev,
    minify: isProduction,
    reportCompressedSize: isProduction,
    watch: watchOption,
    rollupOptions: {
      external: [
        'chrome',
        // 'chromium-bidi/lib/cjs/bidiMapper/BidiMapper.js'
      ],
    },
  },

  define: {
    'import.meta.env.DEV': isDev,
    'import.meta.env.VITE_POSTHOG_API_KEY': JSON.stringify(env.VITE_POSTHOG_API_KEY || process.env.VITE_POSTHOG_API_KEY || ''),
  },

  envDir: '../',
  envPrefix: 'VITE_',
  };
});
