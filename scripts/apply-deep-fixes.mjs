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

let money = await read('src/money.ts');
money = replaceOnce(money, `import type { Language } from './app-language.js';`, `import { localeForLanguage, type Language } from './app-language.js';`, 'money language import');
money = replaceRegex(money, /const localeFor = \(language: Language\) => \([^\n]+\)\[language\];\n\n/, '', 'remove money locale helper');
money = replaceOnce(money, `  const id = known?.id ?? en;`, `  const ur = known?.ar ?? en;
  const id = known?.id ?? en;`, 'money Urdu name');
money = replaceOnce(money, `    name: { en, ar, id, ms, tr, fr },`, `    name: { en, ar, ur, id, ms, tr, fr },`, 'money language map');
money = replaceOnce(money, `    search: [upper, en, ar, id, ms, tr, fr, ...countries, ...(known?.aliases ?? [])].map((value) => value.toLowerCase()),`, `    search: [upper, en, ar, ur, id, ms, tr, fr, ...countries, ...(known?.aliases ?? [])].map((value) => value.toLowerCase()),`, 'money Urdu search');
money = money.replaceAll('localeFor(language)', 'localeForLanguage(language)');
await write('src/money.ts', money);

let flight = await read('src/flight-mode.ts');
flight = replaceRegex(flight, /export function projectPositionOntoRoute\([\s\S]*?\n}\n\nexport function elapsedProgress/, `export function projectPositionOntoRoute(points: RoutePoint[], position: RoutePoint) {
  if (!validCoordinate(position.latitude, position.longitude)) return null;
  const segments = routeSegments(points);
  const totalDistanceKm = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  if (!segments.length || totalDistanceKm <= 0) return null;
  let traversed = 0;
  let best: { progress: number; distanceKm: number; crossTrackDistanceKm: number; trackDegrees: number } | null = null;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const meanLatitude = toRadians((segment.from.latitude + segment.to.latitude + position.latitude) / 3);
    const xy = (point: RoutePoint) => ({
      x: toRadians(normalizeLongitude(point.longitude - segment.from.longitude)) * Math.cos(meanLatitude) * EARTH_RADIUS_KM,
      y: toRadians(point.latitude - segment.from.latitude) * EARTH_RADIUS_KM,
    });
    const end = xy(segment.to);
    const current = xy(position);
    const denominator = end.x * end.x + end.y * end.y;
    const fraction = denominator > 0 ? Math.min(1, Math.max(0, (current.x * end.x + current.y * end.y) / denominator)) : 0;
    const projected = greatCircleInterpolate(segment.from, segment.to, fraction);
    const crossTrackDistanceKm = haversineDistanceKm(projected, position);
    const distanceKm = traversed + segment.distanceKm * fraction;
    const segmentTrack = fraction >= 1 - 1e-9
      ? initialTrueBearing(segment.from, segment.to)
      : initialTrueBearing(projected, segment.to);
    if (!best || crossTrackDistanceKm < best.crossTrackDistanceKm) {
      best = {
        progress: Math.min(1, Math.max(0, distanceKm / totalDistanceKm)),
        distanceKm,
        crossTrackDistanceKm,
        trackDegrees: index < segments.length - 1 && fraction >= 1 - 1e-9
          ? initialTrueBearing(segments[index + 1].from, segments[index + 1].to)
          : segmentTrack,
      };
    }
    traversed += segment.distanceKm;
  }

  if (!best) return null;
  return {
    progress: best.progress,
    distanceKm: best.distanceKm,
    crossTrackDistanceKm: best.crossTrackDistanceKm,
    trackDegrees: best.trackDegrees,
    totalDistanceKm,
  };
}

export function elapsedProgress`, 'rewrite route projection loop');
await write('src/flight-mode.ts', flight);

await write('src/deep-audit-fixes.test.ts', `import test from 'node:test';
import assert from 'node:assert/strict';
import { airportByIata, chooseFlightProgress, createPreparedFlightPlan, positionByDistance, positionByProgress, totalRouteDistanceKm } from './flight-mode.js';
import { createSavedTrip, validateSavedTrip } from './saved-trips.js';
import { getSafeStorage } from './safe-storage.js';
import { cities } from './data.js';

async function repoFile(relative: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(\`../\${relative}\`, import.meta.url), 'utf8'));
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

test('native and UI safeguards remain wired', async () => {
  const [main, athan, manifest, project, index] = await Promise.all([
    repoFile('src/main.ts'),
    repoFile('src/athan.ts'),
    repoFile('mobile/android/AndroidManifest.xml'),
    repoFile('ios/App/App.xcodeproj/project.pbxproj'),
    repoFile('index.html'),
  ]);
  assert.match(main, /generatedItems = generateItinerary\(generatedPrefs, replan, lang\)/);
  assert.match(main, /const alarmPrefs = generatedPrefs \?\? prefs/);
  assert.match(main, /language: trip\.language/);
  assert.match(athan, /AndroidAthan\.schedule/);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(project, /CURRENT_PROJECT_VERSION = 100;/);
  assert.match(project, /ur InfoPlist\.strings/);
  assert.equal(index.includes('urdu-runtime.ts'), false);
});
`);

await rm('deep-fix-typecheck.log', { force: true });
console.log('Applied second-stage type fixes.');
