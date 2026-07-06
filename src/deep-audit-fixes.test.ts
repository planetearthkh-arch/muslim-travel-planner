import test from 'node:test';
import assert from 'node:assert/strict';
import { airportByIata, chooseFlightProgress, createPreparedFlightPlan, positionByDistance, positionByProgress, totalRouteDistanceKm } from './flight-mode.js';
import { createSavedTrip, validateSavedTrip } from './saved-trips.js';
import { getSafeStorage } from './safe-storage.js';
import { cities } from './data.js';
import { safeExternalUrl } from './urls.js';

// Regression coverage for the full deep-audit repair set.
async function repoFile(relative: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${relative}`, import.meta.url), 'utf8'));
}

test('route bearings remain valid at exact waypoints and arrival', () => {
  const points = [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 10 },
    { latitude: 10, longitude: 20 },
  ];
  const firstLeg = totalRouteDistanceKm(points.slice(0, 2));
  const atWaypoint = positionByDistance(points, firstLeg);
  const atArrival = positionByDistance(points, totalRouteDistanceKm(points));
  assert.equal(atWaypoint.trackDegrees > 20 && atWaypoint.trackDegrees < 70, true);
  assert.equal(atArrival.trackDegrees > 20 && atArrival.trackDegrees < 70, true);
});

test('fresh GPS position determines flight progress instead of the manual slider', () => {
  const departure = airportByIata('LHR');
  const arrival = airportByIata('JFK');
  if (!departure || !arrival) throw new Error('Required airports are missing');
  const plan = createPreparedFlightPlan({
    departure,
    arrival,
    scheduledDepartureUtc: '2026-07-04T10:00:00.000Z',
    durationMinutes: 420,
    prayerMethod: 'Muslim World League',
    now: '2026-07-04T09:00:00.000Z',
  });
  if (!plan) throw new Error('Could not create flight plan');
  const routePosition = positionByProgress(plan, 0.65, Date.parse('2026-07-04T14:00:00.000Z')).position;
  if (!routePosition) throw new Error('Could not create route position');
  const result = chooseFlightProgress(plan, {
    manualProgress: 0.1,
    nowMs: Date.parse('2026-07-04T14:00:00.000Z'),
    gps: { ...routePosition, timestamp: Date.parse('2026-07-04T14:00:00.000Z'), source: 'gps', accuracyMeters: 20 },
  });
  assert.equal(Math.abs(result.progress - 0.65) < 0.03, true);
});

test('saved trips reject malformed nested itinerary data', () => {
  const city = cities[0];
  const preferences = {
    city: city.city,
    startDate: '2026-07-04',
    endDate: '2026-07-04',
    startHour: '09:00',
    endHour: '18:00',
    interests: ['history'],
    groupSize: 2,
    children: false,
    walkingAbility: 'medium' as const,
    transportation: 'public transport' as const,
    budget: 'mid' as const,
    prayerMethod: 'Muslim World League' as const,
    prayerPreference: 'mosque' as const,
    womenPrayerRequired: false,
    wuduRequired: false,
    accessibilityNeeds: '',
    halalPreference: 'strictly labelled' as const,
  };
  const valid = createSavedTrip({ language: 'en', preferences, city, itinerary: [] });
  assert.equal(Boolean(validateSavedTrip(valid)), true);
  const malformed = structuredClone(valid) as unknown as { itinerary: unknown[] };
  malformed.itinerary = [{ id: 'bad', durationMinutes: 'wrong' }];
  assert.equal(validateSavedTrip(malformed), null);
});

test('safe storage falls back outside a browser', () => {
  const storage = getSafeStorage();
  storage.setItem('key', 'value');
  assert.equal(storage.getItem('key'), 'value');
});

test('external URL sanitizer is HTTPS-only', () => {
  assert.equal(safeExternalUrl('example.com/path'), 'https://example.com/path');
  assert.equal(safeExternalUrl('https://example.com/path'), 'https://example.com/path');
  assert.equal(safeExternalUrl('http://example.com/path'), '');
  assert.equal(safeExternalUrl('ftp://example.com/path'), '');
  assert.equal(safeExternalUrl('mailto:test@example.com'), '');
});

test('native and UI safeguards remain wired', async () => {
  const [main, athan, manifest, project, index] = await Promise.all([
    repoFile('src/main.ts'),
    repoFile('src/athan.ts'),
    repoFile('mobile/android/AndroidManifest.xml'),
    repoFile('ios/App/App.xcodeproj/project.pbxproj'),
    repoFile('index.html'),
  ]);
  const buildVersions = [...project.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((match) => Number(match[1]));
  assert.equal(main.includes('generatedItems = generateItinerary(generatedPrefs, replan, lang);'), true);
  assert.equal(main.includes('const alarmPrefs = generatedPrefs ?? prefs;'), true);
  assert.equal(main.includes('language: trip.language'), true);
  assert.equal(athan.includes('AndroidAthan.schedule'), true);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:fullBackupContent="@xml\/backup_rules"/);
  assert.match(manifest, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
  assert.equal(buildVersions.length, 2);
  assert.equal(new Set(buildVersions).size, 1);
  assert.equal(buildVersions[0] >= 119, true);
  assert.match(project, /ur InfoPlist.strings/);
  assert.equal(index.includes('urdu-runtime.ts'), false);
});

test('Android receiver and audio policy fixes stay wired into the native template', async () => {
  const [bootReceiver, audioPolicy, alarmPlugin, setup, backupRules, extractionRules] = await Promise.all([
    repoFile('mobile/android/java/BootReceiver.java'),
    repoFile('mobile/android/java/AthanAudioPolicy.java'),
    repoFile('mobile/android/java/AthanAlarmPlugin.java'),
    repoFile('scripts/setup-android.mjs'),
    repoFile('mobile/android/res/xml/backup_rules.xml'),
    repoFile('mobile/android/res/xml/data_extraction_rules.xml'),
  ]);
  assert.equal(bootReceiver.includes('isSupportedAction(Intent intent)'), true);
  assert.equal(bootReceiver.includes('isSupportedAction(String action)'), true);
  assert.equal(bootReceiver.includes('if (!isSupportedAction(intent)) return;'), true);
  assert.equal(bootReceiver.includes('Intent.ACTION_BOOT_COMPLETED'), true);
  assert.equal(bootReceiver.includes('Intent.ACTION_TIME_CHANGED'), true);
  assert.equal(bootReceiver.includes('Intent.ACTION_TIMEZONE_CHANGED'), true);
  assert.equal(audioPolicy.includes('toLowerCase(Locale.ROOT)'), true);
  assert.equal(audioPolicy.includes('isTrustedAudioUrl'), true);
  assert.equal(audioPolicy.includes('isSupportedAudioContentType'), true);
  assert.equal(alarmPlugin.includes('AthanAudioPolicy.isTrustedAudioUrl'), true);
  assert.equal(alarmPlugin.includes('AthanAudioPolicy.isSupportedAudioContentType'), true);
  assert.equal(alarmPlugin.includes('contentType.toLowerCase()'), false);
  assert.equal(backupRules.includes('athan_alarm_preferences.xml'), true);
  assert.equal(extractionRules.includes('<cloud-backup>'), true);
  assert.equal(extractionRules.includes('<device-transfer>'), true);
  assert.equal(setup.includes("join(androidDir, 'app', 'src', 'test'"), true);
});

test('Android native unit-test templates cover the receiver and audio policy', async () => {
  const [bootTest, audioTest] = await Promise.all([
    repoFile('mobile/android/test/BootReceiverTest.java'),
    repoFile('mobile/android/test/AthanAudioPolicyTest.java'),
  ]);
  assert.equal(bootTest.includes('acceptsOnlyExpectedSystemActions'), true);
  assert.equal(bootTest.includes('com.example.UNEXPECTED'), true);
  assert.equal(audioTest.includes('contentTypeChecksAreLocaleSafe'), true);
  assert.equal(audioTest.includes('new Locale("tr", "TR")'), true);
  assert.equal(audioTest.includes('acceptsOnlyTrustedHttpsAssabileUrls'), true);
});
