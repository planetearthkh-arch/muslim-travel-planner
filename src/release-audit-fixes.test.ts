import assert from 'node:assert/strict';
import test from 'node:test';
import { airportByIata, chooseFlightProgress, createPreparedFlightPlan } from './flight-mode.js';
import { isPersistentStorageAvailable } from './safe-storage.js';

const load = (specifier: string) => Function('specifier', 'return import(specifier)')(specifier) as Promise<any>;
async function repoFile(path: string) {
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

test('future-flight GPS fixes do not replace the scheduled route estimate', () => {
  const departure = airportByIata('LHR');
  const arrival = airportByIata('JFK');
  if (!departure || !arrival) throw new Error('Required test airports are unavailable');
  const start = Date.now() + 24 * 60 * 60 * 1000;
  const plan = createPreparedFlightPlan({ departure, arrival, waypoints: [], scheduledDepartureUtc: new Date(start).toISOString(), durationMinutes: 420, prayerMethod: 'Muslim World League' });
  if (!plan) throw new Error('Could not create the test flight plan');
  const progress = chooseFlightProgress(plan, { nowMs: Date.now(), gps: { latitude: departure.latitude, longitude: departure.longitude, timestamp: Date.now(), source: 'gps' } });
  assert.equal(progress.source, 'route-estimate');
  assert.equal(progress.position?.timestamp, start);
});

test('release hardening remains wired into source and native configuration', async () => {
  const [project, verify, main, athan, safeStorage, serviceWorker, plugin, service] = await Promise.all([
    repoFile('ios/App/App.xcodeproj/project.pbxproj'),
    repoFile('scripts/verify-ios-version.mjs'),
    repoFile('src/main.ts'),
    repoFile('src/athan.ts'),
    repoFile('src/safe-storage.ts'),
    repoFile('public/sw.js'),
    repoFile('mobile/android/java/AthanAlarmPlugin.java'),
    repoFile('mobile/android/java/AthanPlaybackService.java'),
  ]);
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 102;/g) ?? []).length, 2);
  assert.equal(verify.includes('version < 102'), true);
  assert.equal(main.includes('scheduleFlightClock()'), true);
  assert.equal(main.includes("flightProgressMode: 'elapsed' | 'manual'"), true);
  assert.equal(main.includes("App.addListener('appStateChange'"), true);
  assert.equal(main.includes('generatedItems = generateItinerary(generatedPrefs, replan, lang)'), true);
  assert.equal(main.includes('required'), true);
  assert.equal(main.includes('SavedAttractionSnapshot'), true);
  assert.equal(main.includes('itineraryKindLabels'), true);
  assert.equal(athan.includes('.slice(0, 60)'), false);
  assert.equal(athan.includes('requested: future.length'), true);
  assert.equal(safeStorage.includes('isPersistentStorageAvailable'), true);
  assert.equal(serviceWorker.includes("endsWith('/privacy.html')"), true);
  assert.equal(plugin.includes('MAX_AUDIO_BYTES'), true);
  assert.equal(plugin.includes('checkPermissions(PluginCall call)'), true);
  assert.equal(plugin.includes('validateAudioUrl'), true);
  assert.equal(plugin.includes('PendingIntent.FLAG_NO_CREATE'), true);
  assert.equal(service.includes('localized("stop", language)'), true);
});

test('temporary storage is identified as non-persistent outside a browser', () => {
  assert.equal(isPersistentStorageAvailable(), false);
});
