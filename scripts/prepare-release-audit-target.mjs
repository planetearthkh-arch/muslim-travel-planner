import { readFile, writeFile } from 'node:fs/promises';

const mainPath = 'src/main.ts';
let mainSource = await readFile(mainPath, 'utf8');
const replacements = [
  [": ''} /></label>`;", ": ``} /></label>`;", 'planner field placeholder expression'],
  ["savedTripStatus === 'failed'", "savedTripStatus === `failed`", 'trip status comparison'],
];
for (const [oldText, newText, label] of replacements) {
  if (!mainSource.includes(oldText)) throw new Error(`Could not find ${label}`);
  mainSource = mainSource.replace(oldText, newText);
}
await writeFile(mainPath, mainSource);

for (const [path, oldText, newText, label] of [
  ['src/app-hardening.test.ts', "const CACHE_VERSION = 'mtp-app-shell-v13'", "const CACHE_VERSION = 'mtp-app-shell-v14'", 'service-worker test version'],
  ['src/deep-audit-fixes.test.ts', 'CURRENT_PROJECT_VERSION = 100;', 'CURRENT_PROJECT_VERSION = 101;', 'iOS test build number'],
  ['src/release-hardening.test.ts', 'mtp-app-shell-v13', 'mtp-app-shell-v14', 'release hardening cache version'],
]) {
  let source = await readFile(path, 'utf8');
  if (!source.includes(oldText)) throw new Error(`Could not find ${label}`);
  source = source.replace(oldText, newText);
  await writeFile(path, source);
}

const generatorPath = 'scripts/apply-release-audit-fixes.mjs';
let generator = await readFile(generatorPath, 'utf8');
const toggleStartMarker = "  source = exact(source,\n    `  document.querySelectorAll<HTMLButtonElement>('[data-attraction-save]')";
const toggleEndMarker = "    'saved attraction toggle');";
const toggleStart = generator.indexOf(toggleStartMarker);
const toggleEnd = generator.indexOf(toggleEndMarker, toggleStart);
if (toggleStart < 0 || toggleEnd < 0) throw new Error('Could not find saved attraction toggle generator block');
const toggleBlockEnd = toggleEnd + toggleEndMarker.length;
const toggleBlock = generator.slice(toggleStart, toggleBlockEnd);
if (!toggleBlock.includes('savedAttractionIds.has(')) throw new Error('Saved attraction toggle block is already patched unexpectedly');
const patchedToggleBlock = toggleBlock.replaceAll('savedAttractionIds.has(', 'savedAttractions.has(');
generator = generator.slice(0, toggleStart) + patchedToggleBlock + generator.slice(toggleBlockEnd);

const oldTest = `  const departure = airportByIata('LHR');
  const arrival = airportByIata('JFK');
  assert.ok(departure && arrival);
  const start = Date.now() + 24 * 60 * 60 * 1000;
  const plan = createPreparedFlightPlan({ departure, arrival, waypoints: [], scheduledDepartureUtc: new Date(start).toISOString(), durationMinutes: 420, prayerMethod: 'Muslim World League' });
  assert.ok(plan);
  const progress = chooseFlightProgress(plan, { nowMs: Date.now(), gps: { latitude: departure.latitude, longitude: departure.longitude, timestamp: Date.now(), source: 'gps' } });`;
const newTest = `  const departure = airportByIata('LHR');
  const arrival = airportByIata('JFK');
  if (!departure || !arrival) throw new Error('Required test airports are unavailable');
  const start = Date.now() + 24 * 60 * 60 * 1000;
  const plan = createPreparedFlightPlan({ departure, arrival, waypoints: [], scheduledDepartureUtc: new Date(start).toISOString(), durationMinutes: 420, prayerMethod: 'Muslim World League' });
  if (!plan) throw new Error('Could not create the test flight plan');
  const progress = chooseFlightProgress(plan, { nowMs: Date.now(), gps: { latitude: departure.latitude, longitude: departure.longitude, timestamp: Date.now(), source: 'gps' } });`;
if (!generator.includes(oldTest)) throw new Error('Could not find release-audit flight test block');
generator = generator.replace(oldTest, newTest);
await writeFile(generatorPath, generator);
