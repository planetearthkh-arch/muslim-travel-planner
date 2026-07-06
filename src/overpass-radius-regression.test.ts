export {};

type AssertModule = {
  default: {
    equal(actual: unknown, expected: unknown, message?: string): void;
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
const { safeOverpassRadiusMeters } = await import('./overpass-radius.js');

test('safe Overpass radius rejects invalid radius values before query construction', () => {
  assert.equal(safeOverpassRadiusMeters(Number.NaN, 25, 5), 5000);
  assert.equal(safeOverpassRadiusMeters(0, 25, 5), 5000);
  assert.equal(safeOverpassRadiusMeters(-4, 25, 5), 5000);
  assert.equal(safeOverpassRadiusMeters(99, 25, 5), 25000);
});

test('live Overpass query builders use the safe radius helper', () => {
  const files = [
    'src/public-toilets.ts',
    'src/car-rental.ts',
    'src/public-transport.ts',
    'src/taxi-services.ts',
  ];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.ok(source.includes("import { safeOverpassRadiusMeters } from './overpass-radius.js';"), `${file} should import safeOverpassRadiusMeters`);
    assert.ok(!source.includes('Math.round(Math.min(radiusKm'), `${file} should not build an unsafe radius directly`);
  }
});
