export {};

type AssertModule = {
  default: {
    equal(actual: unknown, expected: unknown, message?: string): void;
    match(actual: string, expected: RegExp, message?: string): void;
    ok(value: unknown, message?: string): void;
  };
};

type FsModule = {
  readFileSync(path: string, encoding: 'utf8'): string;
};

type TestModule = {
  default(name: string, callback: () => void | Promise<void>): void;
};

const loadNodeModule = new Function('specifier', 'return import(specifier)') as <T>(
  specifier: string,
) => Promise<T>;

const { default: assert } = await loadNodeModule<AssertModule>('node:assert/strict');
const { readFileSync } = await loadNodeModule<FsModule>('node:fs');
const { default: test } = await loadNodeModule<TestModule>('node:test');

test('Qibla cardinal labels are anchored inside the dial and rotate together', () => {
  const index = readFileSync('index.html', 'utf8');
  const css = readFileSync('src/qibla-compass-cardinals.css', 'utf8');
  const cardinalBlocks = [...css.matchAll(/\.qibla-cardinal\.(north|east|south|west)\s*\{([\s\S]*?)\}/g)];

  assert.ok(index.includes('href="/src/qibla-compass-cardinals.css"'), 'Qibla compass cardinal stylesheet should be loaded after the base compass styles');
  assert.equal(cardinalBlocks.length, 4, 'all four cardinal directions should have explicit positions');
  assert.match(css, /--qibla-cardinal-orbit:\s*78px/);
  assert.match(css, /\.qibla-cardinal\s*\{[\s\S]*transform:\s*rotate\(var\(--compass-rotation\)\)/);
  assert.match(css, /\.qibla-cardinal\.north[\s\S]*top:\s*calc\(50% - var\(--qibla-cardinal-orbit\) - var\(--qibla-cardinal-half\)\)/);
  assert.match(css, /\.qibla-cardinal\.west[\s\S]*left:\s*calc\(50% - var\(--qibla-cardinal-orbit\) - var\(--qibla-cardinal-half\)\)/);
});
