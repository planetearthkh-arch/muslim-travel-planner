import test from 'node:test';
import assert from 'node:assert/strict';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('Weather and Money layouts prevent page-wide horizontal overflow', async () => {
  const source = await repoFile('src/weather-layout-bootstrap.ts');
  const loader = await repoFile('src/turkish-halal-copy.ts');

  assert.equal(loader.includes("import './weather-layout-bootstrap.js';"), true);
  assert.equal(source.includes("style.id = STYLE_ID"), true);
  assert.equal(source.includes('.weather-app .prayer-panel > *'), true);
  assert.equal(source.includes('.money-app .panel > *'), true);
  assert.equal(source.includes('.money-app .conversion-result'), true);
  assert.equal(source.includes('.money-app .stats'), true);
  assert.equal(source.includes('.money-app .spark'), true);
  assert.equal(source.includes('grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));'), true);
  assert.equal(source.includes('min-width: 0;'), true);
  assert.equal(source.includes('max-width: 100%;'), true);
  assert.equal(source.includes('overflow-x: clip;'), true);
  assert.equal(source.includes('.weather-app .hourly-strip'), true);
  assert.equal(source.includes('overflow-x: auto;'), true);
  assert.equal(source.includes('overscroll-behavior-inline: contain;'), true);
  assert.equal(source.includes('-webkit-overflow-scrolling: touch;'), true);
});
