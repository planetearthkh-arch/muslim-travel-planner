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

test('status bootstrap is loaded after the main app renders', () => {
  const bootstrap = readFileSync('src/app-bootstrap.ts', 'utf8');
  const helper = readFileSync('src/prayer-status-bootstrap.ts', 'utf8');

  assert.ok(bootstrap.includes("await import('./prayer-status-bootstrap.js');"));
  assert.ok(helper.includes(".prayer-app:not(.halal-app)"));
  assert.ok(helper.includes(".prayer-status.idle, .prayer-status.ready"));
});
