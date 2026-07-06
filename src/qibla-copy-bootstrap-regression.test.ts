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

test('refreshing Qibla location does not reset an active live compass request', () => {
  const source = readFileSync('src/qibla-copy-bootstrap.ts', 'utf8');

  assert.ok(source.includes("target.closest('#request-motion')) compassRequested = true"));
  assert.ok(!source.includes("target.closest('#request-location')) compassRequested = false"));
});
