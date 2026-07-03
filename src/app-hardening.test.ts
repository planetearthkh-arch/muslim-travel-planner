import test from 'node:test';
import assert from 'node:assert/strict';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('iOS location permission text and portrait-only phone orientation are committed', async () => {
  const plist = await repoFile('ios/App/App/Info.plist');
  assert.equal(plist.includes('<key>NSLocationWhenInUseUsageDescription</key>'), true);
  assert.equal(plist.includes('<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>'), true);
  assert.match(plist, /<key>UISupportedInterfaceOrientations<\/key>\s*<array>\s*<string>UIInterfaceOrientationPortrait<\/string>\s*<\/array>/);

  for (const language of ['en', 'ar', 'id', 'ms', 'tr']) {
    const localized = await repoFile(`ios/App/App/${language}.lproj/InfoPlist.strings`);
    assert.equal(localized.includes('NSLocationWhenInUseUsageDescription'), true);
    assert.equal(localized.includes('NSLocationAlwaysAndWhenInUseUsageDescription'), true);
  }
});

test('offline navigation caches each page separately', async () => {
  const source = await repoFile('public/sw.js');
  assert.equal(source.includes("const CACHE_VERSION = 'mtp-app-shell-v9'"), true);
  assert.equal(source.includes('cache.put(request, copy)'), true);
  assert.equal(source.includes('cache.put(APP_HOME, copy)'), false);
  assert.equal(source.includes('caches.match(request)'), true);
});

test('native prayer notifications are audible and accurately described', async () => {
  const labels = await repoFile('src/athan-i18n.ts');
  const implementation = await repoFile('src/athan.ts');
  const config = await repoFile('capacitor.config.ts');

  assert.equal(labels.includes("enable: 'Enable prayer notifications'"), true);
  assert.equal(labels.includes("test: 'Test notification'"), true);
  assert.equal(labels.includes("enable: 'Enable Athan alarms'"), false);
  assert.equal(labels.includes('iPhone uses the system notification sound'), true);
  assert.equal(implementation.includes("const NATIVE_DEFAULT_SOUND = 'default'"), true);
  assert.equal((implementation.match(/sound: NATIVE_DEFAULT_SOUND/g) ?? []).length, 2);
  assert.equal(config.includes("presentationOptions: ['sound', 'banner', 'list']"), true);
});
