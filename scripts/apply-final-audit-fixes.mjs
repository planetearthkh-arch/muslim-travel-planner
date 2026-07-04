import { readFile, writeFile, rm } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');
const write = (path, content) => writeFile(path, content);

function replaceOnce(content, search, replacement, label) {
  if (!content.includes(search)) throw new Error(`Missing patch target: ${label}`);
  return content.replace(search, replacement);
}

function replaceRegex(content, expression, replacement, label) {
  if (!expression.test(content)) throw new Error(`Missing regex patch target: ${label}`);
  expression.lastIndex = 0;
  return content.replace(expression, replacement);
}

let planner = await read('src/planner.ts');
planner = replaceOnce(planner, `import { localeForLanguage, optionLabels, type Language } from './app-language.js';`, `import { optionLabels, type Language } from './app-language.js';`, 'planner stable-time import');
planner = replaceOnce(planner, `const prayerTimes = calculatePrayerDisplay(city, prefs.prayerMethod, date, localeForLanguage(language));`, `const prayerTimes = calculatePrayerDisplay(city, prefs.prayerMethod, date, 'en-GB');`, 'planner stable prayer time format');
await write('src/planner.ts', planner);

let flight = await read('src/flight-mode.ts');
flight = replaceRegex(flight, /export function projectPositionOntoRoute\([\s\S]*?\n}\n\nexport function elapsedProgress/, `function closestFractionOnGreatCircle(segment: { from: RoutePoint; to: RoutePoint; distanceKm: number }, position: RoutePoint) {
  const samples = Math.max(32, Math.min(256, Math.ceil(segment.distanceKm / 80)));
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= samples; index += 1) {
    const fraction = index / samples;
    const candidate = greatCircleInterpolate(segment.from, segment.to, fraction);
    const distance = haversineDistanceKm(candidate, position);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  let low = Math.max(0, (bestIndex - 1) / samples);
  let high = Math.min(1, (bestIndex + 1) / samples);
  for (let iteration = 0; iteration < 28; iteration += 1) {
    const first = low + (high - low) / 3;
    const second = high - (high - low) / 3;
    const firstDistance = haversineDistanceKm(greatCircleInterpolate(segment.from, segment.to, first), position);
    const secondDistance = haversineDistanceKm(greatCircleInterpolate(segment.from, segment.to, second), position);
    if (firstDistance <= secondDistance) high = second;
    else low = first;
  }
  return Math.min(1, Math.max(0, (low + high) / 2));
}

export function projectPositionOntoRoute(points: RoutePoint[], position: RoutePoint) {
  if (!validCoordinate(position.latitude, position.longitude)) return null;
  const segments = routeSegments(points);
  const totalDistanceKm = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  if (!segments.length || totalDistanceKm <= 0) return null;

  let traversed = 0;
  let best: { progress: number; distanceKm: number; crossTrackDistanceKm: number; trackDegrees: number } | null = null;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const fraction = closestFractionOnGreatCircle(segment, position);
    const projected = greatCircleInterpolate(segment.from, segment.to, fraction);
    const crossTrackDistanceKm = haversineDistanceKm(projected, position);
    const distanceKm = traversed + segment.distanceKm * fraction;
    const nextSegment = segments[index + 1];
    const trackDegrees = fraction >= 1 - 1e-8
      ? nextSegment
        ? initialTrueBearing(nextSegment.from, nextSegment.to)
        : initialTrueBearing(segment.from, segment.to)
      : initialTrueBearing(projected, segment.to);
    if (!best || crossTrackDistanceKm < best.crossTrackDistanceKm) {
      best = {
        progress: Math.min(1, Math.max(0, distanceKm / totalDistanceKm)),
        distanceKm,
        crossTrackDistanceKm,
        trackDegrees,
      };
    }
    traversed += segment.distanceKm;
  }

  return best ? { ...best, totalDistanceKm } : null;
}

export function elapsedProgress`, 'great-circle GPS route projection');
await write('src/flight-mode.ts', flight);

let deepTests = await read('src/deep-audit-fixes.test.ts');
deepTests = replaceOnce(deepTests, `  assert.match(main, /generatedItems = generateItinerary(generatedPrefs, replan, lang)/);
  assert.match(main, /const alarmPrefs = generatedPrefs ?? prefs/);
  assert.match(main, /language: trip.language/);
  assert.match(athan, /AndroidAthan.schedule/);`, `  assert.equal(main.includes('generatedItems = generateItinerary(generatedPrefs, replan, lang);'), true);
  assert.equal(main.includes('const alarmPrefs = generatedPrefs ?? prefs;'), true);
  assert.equal(main.includes('language: trip.language'), true);
  assert.equal(athan.includes('AndroidAthan.schedule'), true);`, 'deep audit source assertions');
await write('src/deep-audit-fixes.test.ts', deepTests);

let plannerTests = await read('src/planner.test.ts');
plannerTests = replaceOnce(plannerTests, `import { labels, languageDirection, languages, nextLanguage, prayerLabels, regionLabels } from './i18n.js';`, `import { labels, languageDirection, languages, nextLanguage, prayerLabels, regionLabels } from './i18n.js';
import { localeForLanguage } from './app-language.js';`, 'planner locale test import');
plannerTests = replaceOnce(plannerTests, `  assert.equal(main.includes("language === 'ms' ? 'ms-MY'"), true);`, `  assert.equal(main.includes('localeForLanguage'), true);
  assert.equal(localeForLanguage('ms'), 'ms-MY');`, 'Malay locale test');
plannerTests = replaceOnce(plannerTests, `  assert.equal(main.includes("language === 'tr' ? 'tr-TR'"), true);`, `  assert.equal(main.includes('localeForLanguage'), true);
  assert.equal(localeForLanguage('tr'), 'tr-TR');`, 'Turkish locale test');
plannerTests = replaceOnce(plannerTests, `  assert.equal(pbx.includes('CURRENT_PROJECT_VERSION = 2;'), true);`, `  const buildVersions = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = (\\d+);/g)].map((match) => Number(match[1]));
  assert.equal(buildVersions.length >= 2, true);
  assert.equal(new Set(buildVersions).size, 1);
  assert.equal(buildVersions.every((version) => version >= 100), true);`, 'iOS build number test');
plannerTests = replaceOnce(plannerTests, `    tr: 'SafarOne, Kıble yönünü veya yakındaki seyahat yerlerini istediğinizde konumunuzu yalnızca o anda kullanır.',`, `    tr: 'SafarOne, Kıble yönünü veya yakındaki seyahat yerlerini istediğinizde konumunuzu yalnızca o anda kullanır.',
    ur: 'SafarOne آپ کا مقام صرف اس وقت استعمال کرتا ہے جب آپ قبلہ کی سمت یا قریبی سفری مقامات طلب کرتے ہیں۔',`, 'Urdu iOS permission test');
await write('src/planner.test.ts', plannerTests);

let athan = await read('src/athan.ts');
athan = replaceOnce(athan, `    await cancelNativePrayerNotifications();
    const now = Date.now();`, `    await cancelNativePrayerNotifications();
    const exactAlarmAllowed = true;
    const now = Date.now();`, 'iOS exact-alarm state');
athan = replaceOnce(athan, `        schedule: { at: new Date(alarm.timestamp) },`, `        schedule: { at: new Date(alarm.timestamp), allowWhileIdle: exactAlarmAllowed },`, 'iOS scheduled prayer exact state');
athan = replaceOnce(athan, `      permissions: { exactAlarmAllowed: true, notificationsAllowed: true },`, `      permissions: { exactAlarmAllowed, notificationsAllowed: true },`, 'iOS exact permission result');
athan = replaceOnce(athan, `    if (permissions.display !== 'granted') return;
    const copy = copyFor(language);`, `    if (permissions.display !== 'granted') return;
    const exactAlarmAllowed = true;
    const copy = copyFor(language);`, 'iOS test exact state');
athan = replaceOnce(athan, `        schedule: { at: new Date(Date.now() + 1000) },`, `        schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: exactAlarmAllowed },`, 'iOS test exact schedule');
await write('src/athan.ts', athan);

const packageJson = JSON.parse(await read('package.json'));
packageJson.scripts['preios:sync'] = 'npm run ios:version-verify';
packageJson.scripts['ios:sync'] = 'npm run build:native && npx cap sync ios';
await write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

const cleanCi = `name: CI

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
      - run: npm test
      - run: npm run lint
      - run: npm run test:browser-smoke

  android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 21
      - uses: gradle/actions/setup-gradle@v4
      - run: npm ci
      - run: npm run android:setup
      - run: ./gradlew assembleDebug --stacktrace
        working-directory: android

  ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run ios:verify
`;
await write('.github/workflows/ci.yml', cleanCi);

for (const path of [
  '.github/workflows/capture-test-failure.yml',
  '.github/workflows/summarize-test-log.yml',
  'scripts/summarize-test-log.mjs',
  'failure-summary.txt',
  'test-failure.log',
]) {
  await rm(path, { force: true });
}
await rm('scripts/apply-final-audit-fixes.mjs', { force: true });
console.log('Applied final audit fixes and removed temporary diagnostics.');
