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

test('refreshing Qibla location does not reset an active live compass request', () => {
  const source = readFileSync('src/qibla-copy-bootstrap.ts', 'utf8');

  assert.ok(source.includes("target.closest('#request-motion')) compassRequested = true"));
  assert.ok(!source.includes("target.closest('#request-location')) compassRequested = false"));
});

test('Qibla copy helper reuses rendered app copy instead of duplicating translations', () => {
  const source = readFileSync('src/qibla-copy-bootstrap.ts', 'utf8');

  assert.equal(source.includes('qiblaEnhancementLabels'), false);
  assert.equal(source.includes('button.textContent'), false);
  assert.equal(source.includes('aria-label'), false);
  assert.equal(source.includes('fixedBearingText'), true);
  assert.equal(source.includes('qibla-motion-readout'), true);
  assert.equal(source.includes('Démarrer la boussole en direct'), false);
  assert.equal(source.includes('Start Live Compass'), false);
});
