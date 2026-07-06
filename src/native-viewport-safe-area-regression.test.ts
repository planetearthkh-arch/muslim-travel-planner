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

test('native viewport enables safe-area insets without an overlay stylesheet', () => {
  const index = readFileSync('index.html', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');
  const bootstrap = readFileSync('src/app-bootstrap.ts', 'utf8');

  assert.ok(index.includes('viewport-fit=cover'));
  assert.ok(styles.includes('env(safe-area-inset-top)'));
  assert.ok(!bootstrap.includes('ios-safe-area.css'));
});
