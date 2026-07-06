export {};

type AssertModule = {
  default: {
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

const loadNodeModule = new Function('specifier', 'return import(specifier)') as <T>(specifier: string) => Promise<T>;

const { default: assert } = await loadNodeModule<AssertModule>('node:assert/strict');
const { readFileSync } = await loadNodeModule<FsModule>('node:fs');
const { default: test } = await loadNodeModule<TestModule>('node:test');

test('Qibla compass rotates the whole dial', () => {
  const index = readFileSync('index.html', 'utf8');
  const css = readFileSync('src/qibla-compass-cardinals.css', 'utf8');

  assert.ok(index.includes('href="/src/qibla-compass-cardinals.css"'));
  assert.match(css, /\.qibla-compass\s*\{[\s\S]*transform:\s*rotate\(var\(--compass-rotation\)\)/);
  assert.match(css, /\.qibla-compass \.compass-face\s*\{[\s\S]*transform:\s*none/);
  assert.match(css, /\.qibla-compass \.qibla-arrow\s*\{[\s\S]*rotate\(calc\(var\(--qibla-rotation\) - var\(--compass-rotation\)\)\)/);
});
