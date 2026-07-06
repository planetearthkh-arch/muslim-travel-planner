export {};

type AssertModule = {
  default: {
    match(actual: string, expected: RegExp, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
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

test('mobile overflow guard is loaded after the main stylesheet', () => {
  const index = readFileSync('index.html', 'utf8');
  const stylesIndex = index.indexOf('href="/src/styles.css"');
  const overflowIndex = index.indexOf('href="/src/mobile-overflow.css"');
  assert.notEqual(stylesIndex, -1);
  assert.notEqual(overflowIndex, -1);
  assert.ok(overflowIndex > stylesIndex, 'mobile overflow guard should load after base styles');
});

test('mobile overflow guard prevents long localized labels from widening the viewport', () => {
  const css = readFileSync('src/mobile-overflow.css', 'utf8');
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /max-width:\s*100vw/);
  assert.match(css, /white-space:\s*normal/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /min-width:\s*0/);
  assert.ok(css.includes('html,\nbody'), 'page roots should be clamped');
  assert.ok(css.includes('.manual-search'), 'manual-search action rows should be protected');
  assert.ok(css.includes('.qibla-toolbar'), 'toolbar action rows should be protected');
});
