export {};

type AssertModule = {
  default: {
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

const requiredUsageDescriptions = [
  'NSLocationWhenInUseUsageDescription',
  'NSLocationAlwaysAndWhenInUseUsageDescription',
  'NSMotionUsageDescription',
];

test('iOS Info.plist contains required App Store privacy purpose strings', () => {
  const plist = readFileSync('ios/App/App/Info.plist', 'utf8');

  for (const key of requiredUsageDescriptions) {
    assert.match(
      plist,
      new RegExp(`<key>${key}</key>\\s*<string>[^<]+</string>`),
      `${key} should have a non-empty purpose string`,
    );
  }
});
