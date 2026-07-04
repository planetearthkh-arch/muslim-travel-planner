import test from 'node:test';
import assert from 'node:assert/strict';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('Money page removes the outer long currency chip list', async () => {
  const source = await repoFile('src/money-popular-currencies-bootstrap.ts');
  const loader = await repoFile('src/turkish-halal-copy.ts');

  assert.equal(loader.includes("import './money-popular-currencies-bootstrap.js';"), true);
  assert.equal(source.includes("querySelector<HTMLElement>('.chips')"), true);
  assert.equal(source.includes("querySelector('[data-quick]')"), true);
  assert.equal(source.includes('popularCurrencies.remove()'), true);
  assert.equal(source.includes("querySelector<HTMLInputElement>('#currency-search')"), true);
  assert.equal(source.includes("closest('label')?.remove()"), true);
  assert.equal(source.includes("observe(root, { childList: true })"), true);
});
