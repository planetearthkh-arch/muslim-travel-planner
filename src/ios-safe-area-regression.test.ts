export {};

type AssertModule = {
  default: {
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

test('iOS safe area guard is loaded and protects the top status bar area', () => {
  const bootstrap = readFileSync('src/app-bootstrap.ts', 'utf8');
  const css = readFileSync('src/ios-safe-area.css', 'utf8');

  assert.ok(bootstrap.includes("import './ios-safe-area.css';"));
  assert.ok(css.includes('body::before'));
  assert.ok(css.includes('position: fixed'));
  assert.ok(css.includes('safe-area-inset-top'));
  assert.ok(css.includes('pointer-events: none'));
});
