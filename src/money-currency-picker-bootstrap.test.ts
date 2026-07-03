import test from 'node:test';
import assert from 'node:assert/strict';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('Money page uses a searchable, contained currency picker instead of an always-visible long list', async () => {
  const source = await repoFile('src/money-currency-picker-bootstrap.ts');
  const loader = await repoFile('src/turkish-halal-copy.ts');

  assert.equal(loader.includes("import './money-currency-picker-bootstrap.js';"), true);
  assert.equal(source.includes("#from-currency, #to-currency"), true);
  assert.equal(source.includes("select.hidden = true"), true);
  assert.equal(source.includes("aria-haspopup', 'dialog'"), true);
  assert.equal(source.includes('currency-picker-search'), true);
  assert.equal(source.includes('currency-picker-list'), true);
  assert.equal(source.includes('max-height: min(55vh, 430px);'), true);
  assert.equal(source.includes('overflow-y: auto;'), true);
  assert.equal(source.includes('overscroll-behavior: contain;'), true);
  assert.equal(source.includes("select.dispatchEvent(new Event('change', { bubbles: true }))"), true);
  assert.equal(source.includes("if (searchLabel) searchLabel.hidden = true"), true);
  assert.equal(source.includes("tr: { search: 'Para birimi ara'"), true);
  assert.equal(source.includes("ar: { search: 'ابحث عن عملة'"), true);
});
