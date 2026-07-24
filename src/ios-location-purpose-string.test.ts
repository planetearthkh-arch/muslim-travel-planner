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
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.match(new RegExp(`"${escapedKey}"\\s*=\\s*"([^"]+)"\\s*;`))?.[1];
}

test('iOS location purpose strings satisfy App Store static validation without enabling background location', async () => {
  const plist = await repoFile('ios/App/App/Info.plist');
  const alwaysMatch = plist.match(
    /<key>NSLocationAlwaysAndWhenInUseUsageDescription<\/key>\s*<string>([^<]+)<\/string>/,
  );
  const whenInUseMatch = plist.match(
    /<key>NSLocationWhenInUseUsageDescription<\/key>\s*<string>([^<]+)<\/string>/,
  );

  assert.ok(alwaysMatch, `${alwaysKey} must be a real Info.plist key, not a comment`);
  assert.ok(whenInUseMatch, `${whenInUseKey} must be present in Info.plist`);
  assert.equal(alwaysMatch[1].trim().length > 20, true);
  assert.equal(alwaysMatch[1], whenInUseMatch[1]);
  assert.equal(plist.includes('<key>UIBackgroundModes</key>'), false);

  for (const language of languages) {
    const strings = await repoFile(`ios/App/App/${language}.lproj/InfoPlist.strings`);
    const alwaysValue = localizedValue(strings, alwaysKey);
    const whenInUseValue = localizedValue(strings, whenInUseKey);
    assert.equal(typeof alwaysValue, 'string', `${language} must localize ${alwaysKey}`);
    assert.equal(typeof whenInUseValue, 'string', `${language} must localize ${whenInUseKey}`);
    assert.equal(alwaysValue, whenInUseValue);
    assert.equal((alwaysValue ?? '').trim().length > 20, true);
  }
});
