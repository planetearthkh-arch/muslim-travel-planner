export {};

type AssertModule = {
  default: {
    doesNotThrow(callback: () => void, message?: string): void;
    match(actual: string, expected: RegExp, message?: string): void;
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

const shimPaths = [
  'public/muslim-travel-planner/index.html',
  'public/muslim-travel-planner/privacy.html',
  'public/muslim-travel-planner/support.html',
  'public/muslim-travel-planner/icons/icon.svg',
];

test('native iOS bundle includes compatibility paths for GitHub Pages legal links', () => {
  for (const path of shimPaths) {
    assert.doesNotThrow(() => readFileSync(path, 'utf8'), `${path} should be present in the copied public bundle`);
  }
});

test('legal page compatibility shims redirect back to root native pages while keeping query strings', () => {
  const index = readFileSync('public/muslim-travel-planner/index.html', 'utf8');
  const privacy = readFileSync('public/muslim-travel-planner/privacy.html', 'utf8');
  const support = readFileSync('public/muslim-travel-planner/support.html', 'utf8');

  assert.match(index, /window\.location\.replace\('\.\.\/'.*window\.location\.search/s);
  assert.match(privacy, /window\.location\.replace\('\.\.\/privacy\.html'.*window\.location\.search/s);
  assert.match(support, /window\.location\.replace\('\.\.\/support\.html'.*window\.location\.search/s);
});
