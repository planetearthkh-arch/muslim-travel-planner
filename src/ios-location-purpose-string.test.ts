import assert from 'node:assert/strict';
import test from 'node:test';

const load = (specifier: string) => Function('specifier', 'return import(specifier)')(specifier) as Promise<any>;

async function repoFile(path: string) {
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

const alwaysKey = 'NSLocationAlwaysAndWhenInUseUsageDescription';
const whenInUseKey = 'NSLocationWhenInUseUsageDescription';
const languages = ['en', 'ar', 'id', 'ms', 'tr', 'fr', 'ur'];

function localizedValue(source: string, key: string): string | undefined {
  const marker = `"${key}"`;
  const line = source.split('\n').find((candidate) => candidate.includes(marker));
  if (!line) return undefined;
  return line.match(/=\s*"([^"]+)"\s*;/)?.[1];
}

test('iOS location purpose strings satisfy App Store static validation without enabling background location', async () => {
  const plist = await repoFile('ios/App/App/Info.plist');
  const alwaysValue = plist.match(
    /<key>NSLocationAlwaysAndWhenInUseUsageDescription<\/key>\s*<string>([^<]+)<\/string>/,
  )?.[1];
  const whenInUseValue = plist.match(
    /<key>NSLocationWhenInUseUsageDescription<\/key>\s*<string>([^<]+)<\/string>/,
  )?.[1];

  assert.equal(typeof alwaysValue, 'string');
  assert.equal(typeof whenInUseValue, 'string');
  assert.equal((alwaysValue ?? '').trim().length > 20, true);
  assert.equal(alwaysValue, whenInUseValue);
  assert.equal(plist.includes('<key>UIBackgroundModes</key>'), false);

  for (const language of languages) {
    const strings = await repoFile(`ios/App/App/${language}.lproj/InfoPlist.strings`);
    const localizedAlwaysValue = localizedValue(strings, alwaysKey);
    const localizedWhenInUseValue = localizedValue(strings, whenInUseKey);
    assert.equal(typeof localizedAlwaysValue, 'string');
    assert.equal(typeof localizedWhenInUseValue, 'string');
    assert.equal(localizedAlwaysValue, localizedWhenInUseValue);
    assert.equal((localizedAlwaysValue ?? '').trim().length > 20, true);
  }
});
