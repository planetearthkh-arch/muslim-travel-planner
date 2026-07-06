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

test('mobile manual destination search fields stay compact instead of inheriting desktop flex height', () => {
  const css = readFileSync('src/mobile-overflow.css', 'utf8');
  const mobileBlock = css.match(/@media \(max-width: 640px\) \{[\s\S]*\n\}/)?.[0] ?? '';

  assert.ok(mobileBlock.includes('.manual-search label'));
  assert.match(mobileBlock, /\.manual-search label,\s*\n\s*\.manual-search button\s*\{[\s\S]*flex:\s*0 1 auto/);
  assert.match(mobileBlock, /\.manual-search input\s*\{[\s\S]*min-height:\s*48px/);
});
