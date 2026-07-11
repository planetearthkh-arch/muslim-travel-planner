import test from 'node:test';
import assert from 'node:assert/strict';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('iOS declares location purpose strings and portrait-only phone orientation', async () => {
  const plist = await repoFile('ios/App/App/Info.plist');
  assert.equal(plist.includes('<key>NSLocationWhenInUseUsageDescription</key>'), true);
  assert.equal(plist.includes('<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>'), true);
  assert.match(plist, /<key>UISupportedInterfaceOrientations<\/key>\s*<array>\s*<string>UIInterfaceOrientationPortrait<\/string>\s*<\/array>/);

  for (const language of ['en', 'ar', 'id', 'ms', 'tr', 'fr', 'ur']) {
    const localized = await repoFile(`ios/App/App/${language}.lproj/InfoPlist.strings`);
    assert.equal(localized.includes('NSLocationWhenInUseUsageDescription'), true);
    assert.equal(localized.includes('NSLocationAlwaysAndWhenInUseUsageDescription'), true);
  }
});

test('iOS launch screen uses the committed transparent multi-scale logo', async () => {
  const storyboard = await repoFile('ios/App/App/Base.lproj/LaunchScreen.storyboard');
  const contents = await repoFile('ios/App/App/Assets.xcassets/LaunchLogo.imageset/Contents.json');
  assert.equal(storyboard.includes('image="LaunchLogo"'), true);
  assert.equal(storyboard.includes('image="LaunchIcon"'), false);
  for (const filename of ['LaunchLogo_1x.png', 'LaunchLogo_2x.png', 'LaunchLogo_3x.png']) {
    assert.equal(contents.includes(filename), true);
  }
});

test('offline navigation caches each page separately', async () => {
  const source = await repoFile('public/sw.js');
  assert.equal(source.includes("const CACHE_VERSION = 'mtp-app-shell-v17'"), true);
  assert.equal(source.includes('./vendor/mapbox-gl-rtl-text.js'), true);
  assert.equal(source.includes('cache.put(request, copy)'), true);
  assert.equal(source.includes('cache.put(APP_HOME, copy)'), false);
  assert.equal(source.includes('caches.match(request)'), true);
});

test('native mobile networking and prayer notifications are configured', async () => {
  const labels = await repoFile('src/athan-i18n.ts');
  const implementation = await repoFile('src/athan.ts');
  const config = await repoFile('capacitor.config.ts');

  assert.equal(labels.includes("enable: 'Enable prayer notifications'"), true);
  assert.equal(labels.includes("test: 'Test notification'"), true);
  assert.equal(labels.includes("enable: 'Enable Athan alarms'"), false);
  assert.equal(labels.includes('iPhone uses the system notification sound'), true);
  assert.equal(implementation.includes("const NATIVE_DEFAULT_SOUND = 'default'"), true);
  assert.equal((implementation.match(/sound: NATIVE_DEFAULT_SOUND/g) ?? []).length, 2);
  assert.equal(config.includes('CapacitorHttp'), true);
  assert.match(config, /CapacitorHttp:\s*\{\s*enabled:\s*true/);
  assert.equal(config.includes("presentationOptions: ['sound', 'banner', 'list']"), true);
});

test('attractions release UI hides diagnostics in native runtime and avoids map reinitialization during enrichment', async () => {
  const source = await repoFile('src/main.ts');

  assert.equal(source.includes('function isNativeRuntime()'), true);
  assert.equal(source.includes("return !isNativeRuntime() && ['localhost', '127.0.0.1', ''].includes(window.location.hostname);"), true);
  assert.equal(source.includes('isLocalDevelopment() && attractionDiagnostics.length'), true);
  assert.equal(source.includes('function renderAttractionsProgress()'), true);
  assert.equal(source.includes("if (attractionView === 'map' && attractionsMap)"), true);
  assert.equal((source.match(/renderAttractionsProgress\(\);/g) ?? []).length, 4);
});

test('weather local time uses live city clock instead of forecast timestamp', async () => {
  const source = await repoFile('src/main.ts');

  assert.equal(source.includes('function formatCurrentWeatherLocalTime(location: WeatherLocation, forecast: WeatherForecast | null)'), true);
  assert.equal(source.includes('${copy.weatherLocalTime}: ${formatCurrentWeatherLocalTime(location, forecast)}'), true);
  assert.equal(source.includes('${copy.weatherLocalTime}: ${forecast ? formatWeatherTime(forecast.current.time'), false);
});

test('attractions uses stable visible results and no blocking timeout UI', async () => {
  const source = await repoFile('src/main.ts');

  assert.equal(source.includes('function visibleAttractionResults()'), true);
  assert.equal(source.includes('const results = visibleAttractionResults();'), true);
  assert.equal(source.includes('for (const attraction of results)'), true);
  assert.equal(source.includes('fitBounds('), true);
  assert.equal(source.includes('attraction-map-fallback-list'), true);

  assert.equal(source.includes('Attraction search still running'), true);
  assert.equal(source.includes("attractionAbortController?.abort(new RequestError('timeout'"), false);
  assert.equal(source.includes("attractionStatus = 'timeout';"), false);
  assert.equal(source.includes('attractionsTimedOut'), false);
});
