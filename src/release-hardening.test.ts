import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAmountInput } from './money.js';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL('../' + path, import.meta.url), 'utf8'));
}

test('money parsing respects locale decimal separators', () => {
  assert.equal(parseAmountInput('0.125', 'en').value, 0.125);
  assert.equal(parseAmountInput('0,125', 'tr').value, 0.125);
  assert.equal(parseAmountInput('1,250', 'en').value, 1250);
  assert.equal(parseAmountInput('1.250', 'tr').value, 1250);
  assert.equal(parseAmountInput('USD 12', 'en').value, 12);
});

test('external map fields are escaped before insertion', async () => {
  const main = await repoFile('src/main.ts');
  for (const expression of ['esc(place.address)', 'esc(toilet.address)', 'esc(office.address)', 'esc(stop.address)', 'esc(item.address)', 'esc(attraction.address)']) {
    assert.equal(main.includes(expression), true);
  }
});

test('service worker deletes only SafarOne caches', async () => {
  const worker = await repoFile('public/sw.js');
  assert.match(worker, /key\.startsWith\(CACHE_PREFIX\)/);
  assert.match(worker, /mtp-app-shell-v13/);
});

test('a restrictive content security policy is present', async () => {
  const html = await repoFile('index.html');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /object-src 'none'/);
});
