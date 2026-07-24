import assert from 'node:assert/strict';
import test from 'node:test';
import { validateNativeWeatherAttribution } from './native-weather.js';

const load = (specifier: string) => Function('specifier', 'return import(specifier)')(specifier) as Promise<any>;

async function repoFile(path: string) {
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

const validAttribution = {
  serviceName: 'Apple Weather',
  legalPageURL: 'https://weatherkit.apple.com/legal-attribution.html',
  lightMarkURL: 'https://weatherkit.apple.com/assets/combined-mark-light.png',
  darkMarkURL: 'https://weatherkit.apple.com/assets/combined-mark-dark.png',
};

test('Apple Weather attribution accepts only complete secure provider metadata', () => {
  assert.deepEqual(validateNativeWeatherAttribution(validAttribution), validAttribution);
  assert.throws(
    () => validateNativeWeatherAttribution({ ...validAttribution, legalPageURL: 'http://weatherkit.apple.com/legal-attribution.html' }),
    /Malformed Apple Weather attribution/,
  );
  assert.throws(
    () => validateNativeWeatherAttribution({ ...validAttribution, lightMarkURL: '' }),
    /Malformed Apple Weather attribution/,
  );
});

test('iOS WeatherKit bridge exposes official marks and the UI renders a dedicated legal attribution card', async () => {
  const [swift, nativeWeather, main, styles, project, plist] = await Promise.all([
    repoFile('ios/App/App/AppDelegate.swift'),
    repoFile('src/native-weather.ts'),
    repoFile('src/main.ts'),
    repoFile('src/styles.css'),
    repoFile('ios/App/App.xcodeproj/project.pbxproj'),
    repoFile('ios/App/App/Info.plist'),
  ]);

  assert.equal(swift.includes('combinedMarkLightURL'), true);
  assert.equal(swift.includes('combinedMarkDarkURL'), true);
  assert.equal(swift.includes('legalPageURL'), true);
  assert.equal(nativeWeather.includes('Weather data sources and legal attribution'), true);
  assert.equal(nativeWeather.includes('WEATHERKIT_SAFETY_NOTICE'), true);
  assert.equal(main.includes('data-weather-attribution'), true);
  assert.equal(styles.includes('.weather-attribution-mark'), true);

  const buildVersions = [...project.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((match) => Number(match[1]));
  assert.deepEqual(buildVersions, [159, 159]);
  assert.equal(plist.includes('<string>$(CURRENT_PROJECT_VERSION)</string>'), true);
});

test('iOS release preparation upgrades to build 160 and rejects stale copied web assets', async () => {
  const [configure, verifier, packageJson, workflow] = await Promise.all([
    repoFile('scripts/configure-ios-1-1.mjs'),
    repoFile('scripts/verify-ios-web-assets.sh'),
    repoFile('package.json'),
    repoFile('.github/workflows/ci.yml'),
  ]);

  assert.equal(configure.includes('CURRENT_PROJECT_VERSION = 160;'), true);
  assert.equal(configure.includes('Verify Native Web Assets'), true);
  assert.equal(configure.includes('requires iOS build 160'), true);
  assert.equal(verifier.includes('data-weather-attribution'), true);
  assert.equal(verifier.includes('Weather data sources and legal attribution'), true);
  assert.equal(verifier.includes('X-SafarMate-Weather-Provider'), true);
  assert.equal(packageJson.includes('ios:web-assets-verify'), true);
  assert.equal(packageJson.includes('npx cap sync ios && npm run ios:web-assets-verify'), true);
  assert.equal(workflow.includes('SafarMate_1.1_BUILD_160_COMPLETE.zip'), true);
});
