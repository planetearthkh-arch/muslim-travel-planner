from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one match in {path}, found {count}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "src/athan.ts",
    """export async function checkAthanPermissions() {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    return AndroidAthan.checkPermissions();
  }
  return { exactAlarmAllowed: true, notificationsAllowed: true };
}
""",
    """export async function checkAthanPermissions() {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    return AndroidAthan.checkPermissions();
  }
  if (Capacitor.isNativePlatform()) {
    try {
      const permissions = await LocalNotifications.checkPermissions();
      return { exactAlarmAllowed: true, notificationsAllowed: permissions.display === 'granted' };
    } catch {
      return { exactAlarmAllowed: true, notificationsAllowed: false };
    }
  }
  return {
    exactAlarmAllowed: false,
    notificationsAllowed: !('Notification' in window) || Notification.permission === 'granted',
  };
}
""",
)

replace_once(
    "src/flight-mode.ts",
    """const GPS_FRESH_MS = 120_000;
const LOW_ACCURACY_METERS = 5000;
""",
    """const GPS_FRESH_MS = 120_000;
const GPS_FUTURE_TOLERANCE_MS = 30_000;
const LOW_ACCURACY_METERS = 5000;
""",
)
replace_once(
    "src/flight-mode.ts",
    """  const stale = nowMs - gps.timestamp > GPS_FRESH_MS;
  const lowAccuracy = typeof gps.accuracyMeters === 'number' && gps.accuracyMeters > LOW_ACCURACY_METERS;
  if (stale) return { ...routeEstimate, source: 'route-estimate' as const, stale: true };
""",
    """  const gpsTimestamp = Number(gps.timestamp);
  const invalidTimestamp = !Number.isFinite(gpsTimestamp) || gpsTimestamp <= 0 || gpsTimestamp > nowMs + GPS_FUTURE_TOLERANCE_MS;
  const stale = invalidTimestamp || nowMs - gpsTimestamp > GPS_FRESH_MS;
  const lowAccuracy = typeof gps.accuracyMeters === 'number' && gps.accuracyMeters > LOW_ACCURACY_METERS;
  if (stale) return { ...routeEstimate, source: 'route-estimate' as const, stale: true };
""",
)

replace_once(
    "src/saved-trips.ts",
    """const datePattern = /^\\d{4}-\\d{2}-\\d{2}$/;
const timePattern = /^\\d{2}:\\d{2}$/;
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
""",
    """const datePattern = /^\\d{4}-\\d{2}-\\d{2}$/;
const timePattern = /^(?:[01]\\d|2[0-3]):[0-5]\\d$/;
const itineraryTimePattern = /^(\\d{1,2}):([0-5]\\d)(?:\\s*(AM|PM))?$/i;
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);

function isValidDate(value: unknown): value is string {
  if (!isString(value) || !datePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime())
    && date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function isValid24HourTime(value: unknown): value is string {
  return isString(value) && timePattern.test(value);
}

function isValidItineraryTime(value: unknown): value is string {
  if (!isString(value)) return false;
  const match = itineraryTimePattern.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  return match[3] ? hour >= 1 && hour <= 12 : hour >= 0 && hour <= 23;
}

function isValidTimestamp(value: unknown): value is string {
  return isString(value) && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}
""",
)
replace_once(
    "src/saved-trips.ts",
    """  return isString(value.city)
    && isString(value.startDate) && datePattern.test(value.startDate)
    && isString(value.endDate) && datePattern.test(value.endDate)
    && isString(value.startHour) && timePattern.test(value.startHour)
    && isString(value.endHour) && timePattern.test(value.endHour)
""",
    """  return isString(value.city)
    && isValidDate(value.startDate)
    && isValidDate(value.endDate)
    && isValid24HourTime(value.startHour)
    && isValid24HourTime(value.endHour)
""",
)
replace_once(
    "src/saved-trips.ts",
    """  return isString(value.id)
    && isString(value.date) && datePattern.test(value.date)
    && isString(value.time) && /^(?:\\d{1,2}:\\d{2}|\\d{1,2}:\\d{2}\\s*(?:AM|PM))$/i.test(value.time)
""",
    """  return isString(value.id)
    && isValidDate(value.date)
    && isValidItineraryTime(value.time)
""",
)
replace_once(
    "src/saved-trips.ts",
    "  if (!isString(value.id) || !isString(value.name) || !isString(value.createdAt) || !isString(value.updatedAt) || !isString(value.savedAt)) return null;\n",
    "  if (!isString(value.id) || !isString(value.name) || !isValidTimestamp(value.createdAt) || !isValidTimestamp(value.updatedAt) || !isValidTimestamp(value.savedAt)) return null;\n",
)
replace_once(
    "src/saved-trips.ts",
    "  if (!isString(value.dateRange.startDate) || !datePattern.test(value.dateRange.startDate) || !isString(value.dateRange.endDate) || !datePattern.test(value.dateRange.endDate)) return null;\n",
    "  if (!isValidDate(value.dateRange.startDate) || !isValidDate(value.dateRange.endDate)) return null;\n",
)
replace_once(
    "src/saved-trips.ts",
    "    const trips = validated.filter((trip): trip is SavedTrip => Boolean(trip)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));\n",
    "    const trips = validated.filter((trip): trip is SavedTrip => Boolean(trip)).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));\n",
)
replace_once(
    "src/saved-trips.ts",
    "    return next.trips.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));\n",
    "    return next.trips.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));\n",
)

replace_once(
    "src/planner.ts",
    """  const selected = scored[0]?.place ?? candidates[0];
  const perfect = (!prefs.womenPrayerRequired || verificationScore(selected?.facility?.womenPrayerSpace) >= 2)
""",
    """  const selected = scored[0]?.place ?? candidates[0];
  if (!selected) return { place: undefined, perfect: false };
  const perfect = (!prefs.womenPrayerRequired || verificationScore(selected.facility?.womenPrayerSpace) >= 2)
""",
)
replace_once(
    "src/planner.ts",
    "    && (!prefs.wuduRequired || verificationScore(selected?.facility?.wudu) >= 2)\n",
    "    && (!prefs.wuduRequired || verificationScore(selected.facility?.wudu) >= 2)\n",
)
replace_once(
    "src/planner.ts",
    "  prayer: { place: Place; perfect: boolean };\n",
    "  prayer: { place?: Place; perfect: boolean };\n",
)
replace_once(
    "src/planner.ts",
    """    const prayerTimes = calculatePrayerDisplay(city, prefs.prayerMethod, date, 'en-GB');
    const prayers = prayerNames
      .map((name) => ({ name, time: prayerTimes[name], minutes: minutesOfDay(prayerTimes[name]), duration: prayer.place.estimatedMinutes }))
      .filter((entry) => Number.isFinite(entry.minutes) && entry.minutes >= startMinutes && entry.minutes + entry.duration <= endMinutes)
      .sort((a, b) => a.minutes - b.minutes);
""",
    """    const prayerTimes = calculatePrayerDisplay(city, prefs.prayerMethod, date, 'en-GB');
    const prayerPlace = prayer.place;
    const prayers = prayerPlace
      ? prayerNames
        .map((name) => ({ name, time: prayerTimes[name], minutes: minutesOfDay(prayerTimes[name]), duration: prayerPlace.estimatedMinutes, place: prayerPlace }))
        .filter((entry) => Number.isFinite(entry.minutes) && entry.minutes >= startMinutes && entry.minutes + entry.duration <= endMinutes)
        .sort((a, b) => a.minutes - b.minutes)
      : [];
""",
)
replace_once("src/planner.ts", "title: copy.prayerTitle(displayNames[entry.name], prayer.place.name),", "title: copy.prayerTitle(displayNames[entry.name], entry.place.name),")
replace_once("src/planner.ts", "notes[prayer.place.facility?.notes ?? '']", "notes[entry.place.facility?.notes ?? '']")
replace_once("src/planner.ts", "place: prayer.place,", "place: entry.place,")
replace_once("src/planner.ts", "status: prayer.place.verification,", "status: entry.place.verification,")

project = Path("ios/App/App.xcodeproj/project.pbxproj")
project_text = project.read_text()
if project_text.count("CURRENT_PROJECT_VERSION = 102;") != 2:
    raise SystemExit("Expected two iOS build 102 entries")
project.write_text(project_text.replace("CURRENT_PROJECT_VERSION = 102;", "CURRENT_PROJECT_VERSION = 103;"))

verify = Path("scripts/verify-ios-version.mjs")
verify_text = verify.read_text()
if verify_text.count("102") != 2:
    raise SystemExit("Unexpected iOS verifier build number occurrences")
verify.write_text(verify_text.replace("102", "103"))

release_test = Path("src/release-audit-fixes.test.ts")
release_text = release_test.read_text()
if release_text.count("102") != 2:
    raise SystemExit("Unexpected release test build number occurrences")
release_test.write_text(release_text.replace("102", "103"))

Path("src/permanent-bug-fixes.test.ts").write_text("""import assert from 'node:assert/strict';
import test from 'node:test';
import { cities } from './data.js';
import { airportByIata, chooseFlightProgress, createPreparedFlightPlan } from './flight-mode.js';
import type { PlannerPreferences } from './models.js';
import { generateItinerary } from './planner.js';
import { createSavedTrip, validateSavedTrip } from './saved-trips.js';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

const prefs: PlannerPreferences = {
  city: 'Tokyo', startDate: '2026-07-01', endDate: '2026-07-01', startHour: '09:00', endHour: '18:00', interests: ['history'], groupSize: 2, children: false, walkingAbility: 'medium', transportation: 'public transport', budget: 'mid', prayerMethod: 'Muslim World League', prayerPreference: 'mosque', womenPrayerRequired: true, wuduRequired: true, accessibilityNeeds: '', halalPreference: 'strictly labelled',
};

test('iOS notification permission state is checked instead of assumed', async () => {
  const athan = await repoFile('src/athan.ts');
  assert.equal(athan.includes('LocalNotifications.checkPermissions()'), true);
  assert.equal(athan.includes("permissions.display === 'granted'"), true);
});

test('invalid and far-future GPS timestamps fall back to route estimates', () => {
  const departure = airportByIata('LHR');
  const arrival = airportByIata('JFK');
  if (!departure || !arrival) throw new Error('Required test airports are unavailable');
  const now = Date.now();
  const plan = createPreparedFlightPlan({ departure, arrival, scheduledDepartureUtc: new Date(now - 60 * 60 * 1000).toISOString(), durationMinutes: 420, prayerMethod: 'Muslim World League' });
  if (!plan) throw new Error('Could not create the test flight plan');
  const invalid = chooseFlightProgress(plan, { nowMs: now, gps: { latitude: departure.latitude, longitude: departure.longitude, timestamp: Number.NaN, source: 'gps' } });
  assert.equal(invalid.source, 'route-estimate');
  assert.equal(invalid.stale, true);
  const future = chooseFlightProgress(plan, { nowMs: now, gps: { latitude: departure.latitude, longitude: departure.longitude, timestamp: now + 60_000, source: 'gps' } });
  assert.equal(future.source, 'route-estimate');
  assert.equal(future.stale, true);
});

test('saved trips reject invalid timestamps, impossible dates, and impossible times', () => {
  const city = cities.find((candidate) => candidate.city === 'Tokyo') ?? cities[0];
  const trip = createSavedTrip({ language: 'en', preferences: prefs, city, itinerary: generateItinerary(prefs), now: '2026-07-01T10:00:00.000Z' });
  assert.equal(validateSavedTrip({ ...trip, savedAt: 'not-a-date' }), null);
  assert.equal(validateSavedTrip({ ...trip, preferences: { ...trip.preferences, startDate: '2026-02-31' }, dateRange: { ...trip.dateRange, startDate: '2026-02-31' } }), null);
  assert.equal(validateSavedTrip({ ...trip, preferences: { ...trip.preferences, startHour: '29:88' } }), null);
});

test('itinerary generation remains usable when a city has no prayer place', () => {
  const city = cities.find((candidate) => candidate.city === 'Tokyo') ?? cities[0];
  const originalPlaces = [...city.places];
  city.places.splice(0, city.places.length, ...originalPlaces.filter((place) => place.type !== 'mosque' && place.type !== 'prayer-space'));
  try {
    const items = generateItinerary({ ...prefs, city: city.city });
    assert.equal(items.some((item) => item.kind === 'prayer'), false);
    assert.equal(items.length > 0, true);
  } finally {
    city.places.splice(0, city.places.length, ...originalPlaces);
  }
});
""")
