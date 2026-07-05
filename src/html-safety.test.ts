import assert from 'node:assert/strict';
import test from 'node:test';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('external currency data is rendered through text nodes or escaped markup', async () => {
  const source = await repoFile('src/main.ts');
  assert.equal(source.includes('new Option(currencyOptionText(currency), currency.code)'), true);
  assert.equal(source.includes('select.replaceChildren(...options.map'), true);
  assert.equal(source.includes('currencySelectOptions()'), false);
  assert.equal(source.includes('esc(`${from.flag} ${from.code} ${from.name[lang]} · ${from.symbol}`)'), true);
  assert.equal(source.includes('esc(`${to.flag} ${to.code} ${to.name[lang]} · ${to.symbol}`)'), true);
});

test('map fallback and currency picker dynamic copy avoid HTML interpolation', async () => {
  const main = await repoFile('src/main.ts');
  const picker = await repoFile('src/money-currency-picker-bootstrap.ts');
  assert.equal(main.includes('element.replaceChildren(paragraph)'), true);
  assert.equal(picker.includes("close.setAttribute('aria-label', copy.close)"), true);
  assert.equal(picker.includes('searchCopy.textContent = copy.search'), true);
  assert.equal(picker.includes('empty.textContent = copy.noResults'), true);
  assert.equal(picker.includes('aria-label="${copy.close}"'), false);
});
