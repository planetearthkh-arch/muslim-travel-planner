export {};

type AssertModule = {
  default: {
    ok(value: unknown, message?: string): void;
    equal(actual: unknown, expected: unknown, message?: string): void;
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

test('Qibla fixed-bearing helper reuses rendered app copy instead of owning duplicate translations', () => {
  const source = readFileSync('src/qibla-copy-bootstrap.ts', 'utf8');

  assert.ok(source.includes("document.querySelector<HTMLElement>('#qibla-motion-readout')"));
  assert.ok(source.includes('status.textContent = fixedBearingText'));
  assert.equal(source.includes('qiblaEnhancementLabels'), false);
  assert.equal(source.includes('button.textContent'), false);
  assert.equal(source.includes('aria-label'), false);
  assert.equal(source.includes('Démarrer la boussole en direct'), false);
  assert.equal(source.includes('Start Live Compass'), false);
});
