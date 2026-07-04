import test from 'node:test';
import assert from 'node:assert/strict';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('Qibla enhancement uses clear copy and keeps fixed bearing before compass permission', async () => {
  const source = await repoFile('src/qibla-copy-bootstrap.ts');
  const index = await repoFile('index.html');
  const serviceWorker = await repoFile('public/sw.js');

  assert.equal(index.includes('/src/qibla-copy-bootstrap.ts'), true);
  assert.equal(source.includes("liveCompass: 'Start Live Compass'"), true);
  assert.equal(source.includes("liveCompass: 'ابدأ البوصلة المباشرة'"), true);
  assert.equal(source.includes("tr: { liveCompass: 'Canlı pusulayı başlat', fixedBearing: 'Sabit yön' }"), true);
  assert.equal(source.includes("let compassRequested = false"), true);
  assert.equal(source.includes('!compassRequested && !button.disabled'), true);
  assert.equal(source.includes('status.textContent = copy.fixedBearing'), true);
  assert.equal(source.includes("target.closest('#request-motion')"), true);
  assert.equal(source.includes("observe(root, { childList: true })"), true);
  assert.equal(source.includes('subtree: true'), false);
  assert.equal(serviceWorker.includes("const CACHE_VERSION = 'mtp-app-shell-v13'"), true);
});
