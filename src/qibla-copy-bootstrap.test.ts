import test from 'node:test';
import assert from 'node:assert/strict';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('Qibla compass button uses clearer live-compass wording in every supported language', async () => {
  const source = await repoFile('src/qibla-copy-bootstrap.ts');
  const index = await repoFile('index.html');
  const serviceWorker = await repoFile('public/sw.js');

  assert.equal(index.includes('/src/qibla-copy-bootstrap.ts'), true);
  assert.equal(source.includes("en: 'Start Live Compass'"), true);
  assert.equal(source.includes("ar: 'ابدأ البوصلة المباشرة'"), true);
  assert.equal(source.includes("id: 'Mulai Kompas Langsung'"), true);
  assert.equal(source.includes("ms: 'Mulakan Kompas Langsung'"), true);
  assert.equal(source.includes("'#request-motion'"), true);
  assert.equal(source.includes("setAttribute('aria-label', label)"), true);
  assert.equal(serviceWorker.includes("const CACHE_VERSION = 'mtp-app-shell-v5'"), true);
});
