import puppeteer from 'puppeteer-core';
import crypto from 'node:crypto';

// Unpacked extension ID = first 32 hex chars of SHA-256 of the absolute path,
// mapped 0-f -> a-p.
const dist = 'C:\Users\Nakul\OneDrive\Documents\SIH\nanobrowser\dist';
const hash = crypto.createHash('sha256').update(dist).digest('hex');
const id = hash.slice(0, 32).split('').map(c => String.fromCharCode(97 + parseInt(c, 16))).join('');
console.log('extension id:', id);

const browser = await puppeteer.launch({
  executablePath: 'C:/Users/Nakul/.cache/puppeteer/chrome/win64-147.0.7727.56/chrome-win64/chrome.exe',
  headless: true,
  args: [
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
    '--no-sandbox',
  ],
});

try {
  // Opening an extension page wakes the service worker.
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${id}/side-panel/index.html`, { waitUntil: 'load', timeout: 15000 }).catch(e => console.log('goto:', e.message));

  const swTarget = await browser.waitForTarget(t => t.type() === 'service_worker', { timeout: 20000 });
  console.log('SW target up:', swTarget.url());
  const client = await swTarget.createCDPSession();
  await client.send('Runtime.enable');

  const logs = [];
  client.on('Runtime.consoleAPICalled', e => {
    logs.push(`[console.${e.type}] ` + e.args.map(a => a.value ?? a.description ?? '').join(' '));
  });
  client.on('Runtime.exceptionThrown', e => {
    logs.push('[exception] ' + e.exceptionDetails.text + ' ' + (e.exceptionDetails.exception?.description ?? ''));
  });

  const evalResult = await client.send('Runtime.evaluate', {
    expression: `(async () => {
      try {
        const ort = await import(chrome.runtime.getURL('ort/ort.webgpu.bundle.min.mjs'));
        ort.env.wasm.wasmPaths = chrome.runtime.getURL('ort/');
        ort.env.wasm.numThreads = 1;
        const session = await ort.InferenceSession.create(chrome.runtime.getURL('models/blazeface.onnx'), {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        });
        return 'DIAG-OK inputs=' + session.inputNames.join(',');
      } catch (e) {
        return 'DIAG-FAIL ' + (e && e.message);
      }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('EVAL:', evalResult.result.value ?? JSON.stringify(evalResult.result).slice(0, 500));

  await new Promise(r => setTimeout(r, 1500));
  logs.slice(0, 15).forEach(l => console.log(l));
} finally {
  await browser.close();
}
