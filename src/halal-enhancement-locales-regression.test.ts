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

test('Halal page enhancement copy covers every supported app language', () => {
  const languageSource = readFileSync('src/app-language.ts', 'utf8');
  const halalSource = readFileSync('src/halal-page-bootstrap.ts', 'utf8');
  const languages = [...languageSource.matchAll(/(?:code:\s*)?'([a-z]{2})'/g)]
    .map((match) => match[1])
    .filter((value, index, list) => list.indexOf(value) === index && ['en', 'ar', 'ur', 'id', 'ms', 'tr', 'fr'].includes(value));

  for (const language of languages) {
    assert.ok(new RegExp(`\\n\\s*${language}:\\s*\\{`).test(halalSource), `missing halal enhancement copy for ${language}`);
  }
});
