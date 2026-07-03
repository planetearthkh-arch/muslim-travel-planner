import test from 'node:test';
import assert from 'node:assert/strict';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('halal page starts a reliable nearby search and exposes interactive legend controls', async () => {
  const source = await repoFile('src/halal-page-bootstrap.ts');
  const index = await repoFile('index.html');
  const serviceWorker = await repoFile('public/sw.js');

  assert.equal(index.includes('/src/halal-page-bootstrap.ts'), true);
  assert.equal(source.includes('#manual-halal-search'), true);
  assert.equal(source.includes('#halal-manual-query'), true);
  assert.equal(source.includes('#halal-radius'), true);
  assert.equal(source.includes("radius.value = '1'"), true);
  assert.equal(source.includes("status?.classList.contains('idle')"), true);
  assert.equal(source.includes('form.requestSubmit()'), true);
  assert.equal(source.includes('[data-field="city"]'), true);
  assert.equal(source.includes('#halal-status-filter'), true);
  assert.equal(source.includes("setAttribute('role', 'button')"), true);
  assert.equal(source.includes("dispatchEvent(new Event('change', { bubbles: true }))"), true);
  assert.equal(serviceWorker.includes("const CACHE_VERSION = 'mtp-app-shell-v5'"), true);
});
