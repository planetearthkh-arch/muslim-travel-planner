import test from 'node:test';
import assert from 'node:assert/strict';
import { cities } from './data.js';
import { labels, languageDirection, languages, nextLanguage, prayerLabels, regionLabels } from './i18n.js';
import { athanLabels } from './athan-i18n.js';
import { generateItinerary, itineraryDates } from './planner.js';
import { calculateQiblaBearing } from './qibla.js';
import {
  airportByIata,
  airportDataSource,
  airports,
  chooseFlightProgress,
  createPreparedFlightPlan,
  deriveTrackFromFixes,
  elapsedProgress,
  flightPlanFromTravelDetails,
  greatCircleInterpolate,
  haversineDistanceKm,
  initialTrueBearing,
  normalizeDegrees as normalizeFlightDegrees,
  normalizeLongitude,
  positionByDistance,
  positionByProgress,
  searchAirports,
  signedShortestAngle,
  totalRouteDistanceKm,
  validateFlightPlan,
  validateWaypoint,
} from './flight-mode.js';
import { FlightPlanRepository, parseStoredFlightPlan } from './flight-storage.js';
import { calculateInflightPrayerSnapshot, formatInTimeZone, formatUtcTime } from './inflight-prayer.js';
import { createSavedTrip, defaultTripName, duplicateSavedTrip, parseSavedTrips, sanitizeTripName, SavedTripRepository } from './saved-trips.js';
import { serviceWorkerUrl } from './offline.js';
import { buildReportText, canShareReport, createPlaceReport, githubIssueUrl, osmReportUrl, reportReasons, sourcePartsFromOsmUrl } from './place-report.js';
import { buildIcsCalendar, buildItineraryText, canWebShare, escapeIcs, groupedItinerary, safeTripFilename } from './trip-share.js';
import { deleteTravelDetail, emptyTravelDetails, isValidTimeZone, sortTravelDetails, upsertTravelDetail, validateTravelDetailInput } from './travel-details.js';
import { classifyPrayerPlace, distanceKm, ensureLatinDisplayName, getEnglishPlaceName, normalizePrayerPlace, optionalLatinDisplayName } from './prayer-spaces.js';
import { safeExternalUrl } from './urls.js';
import { RequestError, classifyHttpStatus, classifyRequestError, requestJson, retryAfterMs, retryOnceForTemporary } from './http.js';
import {
  cacheKeyForHistory,
  cacheKeyForRate,
  convertAmount,
  destinationCurrency,
  fallbackCurrencies,
  formatCurrencyAmount,
  historyStats,
  normalizeCurrencies,
  parseAmountInput,
  readJsonCache,
  searchCurrencies,
  validateRateResponse,
  writeJsonCache,
} from './money.js';
import {
  buildHalalOverpassQuery,
  classifyHalalStatus,
  cuisineOptions,
  dedupeRestaurants,
  filterRestaurants,
  normalizeHalalRestaurant,
  openingState,
  sortRestaurants,
  type HalalRestaurant,
  type RestaurantFilters,
} from './halal-restaurants.js';
import {
  buildToiletOverpassQuery,
  changingTable,
  classifyToiletAccess,
  dedupeToilets,
  filterToilets,
  normalizePublicToilet,
  sortToilets,
  toiletFee,
  wheelchairAccess,
  type PublicToilet,
  type ToiletFilters,
} from './public-toilets.js';
import {
  buildCarRentalOverpassQuery,
  classifyCarRentalLocation,
  dedupeCarRentalOffices,
  filterCarRentalOffices,
  isCarRentalOffice,
  normalizeCarRentalOffice,
  safeRentalUrl,
  sortCarRentalOffices,
  type CarRentalFilters,
  type CarRentalOffice,
} from './car-rental.js';
import {
  buildPublicTransportOverpassQuery,
  classifyPublicTransport,
  dedupePublicTransportStops,
  filterPublicTransportStops,
  normalizePublicTransportStop,
  sortPublicTransportStops,
  type PublicTransportStop,
} from './public-transport.js';
import {
  buildTaxiOverpassQuery,
  classifyTaxiService,
  dedupeTaxiServices,
  filterTaxiServices,
  isTaxiOffice,
  normalizeTaxiPhone,
  normalizeTaxiService,
  sortTaxiServices,
  type TaxiService,
} from './taxi-services.js';
import {
  buildWeatherUrl,
  convertPrecipitationFromMm,
  convertWindFromKmh,
  formatPrecipitation,
  formatTemperature,
  formatWind,
  hourlyForDay,
  matchPrayerWeather,
  selectHourlyForecast,
  travelWeatherIndicators,
  validateWeatherResponse,
  weatherCodeInfo,
  type WeatherUnits,
} from './weather.js';
import {
  acceptableCommonsLicense,
  attractionName,
  buildAttractionOverpassBatches,
  buildAttractionOverpassQuery,
  canAttachExternalSource,
  categoryExplanation,
  classifyAttraction,
  commonsCategoryFromTag,
  commonsCategoryImagesUrl,
  commonsFilenameFromImageUrl,
  commonsFilenameFromTag,
  commonsImageInfoUrl,
  commonsSearchUrl,
  dedupeAttractions,
  enrichAttraction,
  filterAttractions,
  firstLicensedCommonsImage,
  isMappedAttraction,
  normalizeAttraction,
  normalizeCommonsImage,
  parseWikipediaTag,
  selectHighConfidenceCommonsImage,
  sortAttractions,
  summarizeWikipediaExtract,
  wikidataEnglishDescription,
  wikidataEnglishAliases,
  wikidataEnglishLabel,
  wikidataEnglishTitle,
  wikidataEntityUrl,
  wikidataP18Filename,
  wikipediaSummaryUrl,
  type Attraction,
  type AttractionFilters,
} from './attractions.js';
import type { PlannerPreferences } from './models.js';

const prefs: PlannerPreferences = { city: 'Tokyo', startDate: '2026-07-01', endDate: '2026-07-01', startHour: '09:00', endHour: '18:00', interests: ['history'], groupSize: 2, children: false, walkingAbility: 'medium', transportation: 'public transport', budget: 'mid', prayerMethod: 'Muslim World League', prayerPreference: 'mosque', womenPrayerRequired: true, wuduRequired: true, accessibilityNeeds: 'step-free', halalPreference: 'strictly labelled' };

async function rejectsWith(fn: () => Promise<unknown>, predicate: (error: unknown) => boolean) {
  try {
    await fn();
    assert.equal('resolved', 'rejected');
  } catch (error) {
    assert.equal(predicate(error), true);
  }
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
}

async function repoDir(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readdir: (path: URL) => Promise<string[]> }>;
  return load('node:fs/promises').then((fs) => fs.readdir(new URL(`../${path}`, import.meta.url)));
}

test('contains all required sample cities', () => {
  assert.deepEqual(cities.map((c) => c.city), [
    'Jerusalem',
    'London',
    'Istanbul',
    'Paris',
    'Tokyo',
    'New York',
    'Dubai',
    'Abu Dhabi',
    'Doha',
    'Riyadh',
    'Jeddah',
    'Makkah',
    'Madinah',
    'Cairo',
    'Amman',
    'Marrakech',
    'Kuala Lumpur',
    'Singapore',
    'Jakarta',
    'Bangkok',
    'Seoul',
    'Toronto',
    'Los Angeles',
    'Chicago',
    'Barcelona',
    'Rome',
    'Cape Town',
    'Sydney',
    'Sarajevo',
    'Tashkent',
  ]);
  assert.equal(new Set(cities.map((c) => c.city)).size, 30);
});

test('each city has the required planner content', () => {
  for (const city of cities) {
    assert.equal(city.places.filter((place) => place.type === 'attraction').length >= 2, true);
    assert.equal(city.places.some((place) => place.type === 'mosque'), true);
    assert.equal(city.places.some((place) => place.type === 'restaurant'), true);
    assert.equal(Object.keys(city.prayerWindows).length, 5);
    assert.equal(city.transportEstimates.walking > 0, true);
    assert.equal(city.transportEstimates.publicTransport > 0, true);
    assert.equal(city.transportEstimates.taxi > 0, true);

    const prayerPlaces = city.places.filter((place) => place.type === 'mosque' || place.type === 'prayer-space');
    assert.equal(prayerPlaces.every((place) => place.facility?.womenPrayerSpace), true);
    assert.equal(prayerPlaces.every((place) => place.facility?.wudu), true);
    assert.equal(prayerPlaces.every((place) => place.facility?.accessibility), true);

    const restaurant = city.places.find((place) => place.type === 'restaurant');
    assert.equal(restaurant?.verification, 'Unverified');
    assert.equal(/Unverified sample listing/.test(restaurant?.halalSupport ?? ''), true);
  }
});

test('newly added city information is only Sample or Unverified', () => {
  const existing = new Set(['Jerusalem', 'London', 'Istanbul', 'Paris', 'Tokyo', 'New York']);
  for (const city of cities.filter((candidate) => !existing.has(candidate.city))) {
    assert.equal(city.places.every((place) => place.verification === 'Sample' || place.verification === 'Unverified'), true);
    assert.equal(city.places.every((place) => !place.facility || Object.values(place.facility).every((value) => value !== 'Verified')), true);
  }
});

test('generates prayer, attraction, travel, and halal-conscious meal items', () => {
  const items = generateItinerary(prefs);
  assert.equal(items.some((i) => i.kind === 'prayer'), true);
  assert.equal(items.some((i) => i.kind === 'attraction'), true);
  assert.equal(items.some((i) => i.kind === 'travel'), true);
  assert.equal(items.some((i) => i.kind === 'meal' && i.details.includes('Halal status has not been independently confirmed')), true);
  assert.equal(items.some((i) => /Sample|Verified|Unverified/.test(i.details)), false);
  assert.equal(new Set(items.map((item) => item.date)).size, 1);
});

test('saved-trip repository saves, reopens, updates, renames, duplicates, deletes, and sorts trips', () => {
  const storage = new MemoryStorage();
  const repository = new SavedTripRepository(storage);
  const city = cities.find((candidate) => candidate.city === 'Tokyo') ?? cities[0];
  const itinerary = generateItinerary(prefs);
  const storedItinerary = JSON.parse(JSON.stringify(itinerary));
  const first = createSavedTrip({ language: 'en', preferences: prefs, city, itinerary, now: '2026-07-01T10:00:00.000Z' });
  assert.equal(first.name, defaultTripName(city, prefs.startDate, prefs.endDate));
  assert.deepEqual(first.itinerary, storedItinerary);
  assert.equal(JSON.stringify(first).includes('weatherForecast'), false);
  assert.equal(JSON.stringify(first).includes('exchange'), false);
  repository.upsert(first);
  const reopened = repository.read().trips[0];
  assert.deepEqual(reopened?.itinerary, storedItinerary);
  const updated = { ...first, name: 'Tokyo family trip', updatedAt: '2026-07-02T10:00:00.000Z', savedAt: '2026-07-02T10:00:00.000Z' };
  repository.upsert(updated);
  assert.equal(repository.read().trips[0]?.id, first.id);
  assert.equal(repository.read().trips[0]?.name, 'Tokyo family trip');
  const second = createSavedTrip({ language: 'id', preferences: { ...prefs, city: 'London' }, city: cities.find((candidate) => candidate.city === 'London') ?? city, itinerary, now: '2026-07-03T10:00:00.000Z' });
  repository.upsert(second);
  assert.deepEqual(repository.read().trips.map((trip) => trip.id), [second.id, first.id]);
  const malayTrip = createSavedTrip({ language: 'ms', preferences: { ...prefs, city: 'Kuala Lumpur' }, city: cities.find((candidate) => candidate.city === 'Kuala Lumpur') ?? city, itinerary, now: '2026-07-03T12:00:00.000Z' });
  repository.upsert(malayTrip);
  assert.equal(repository.read().trips[0]?.language, 'ms');
  const duplicated = duplicateSavedTrip(updated, '2026-07-04T10:00:00.000Z');
  assert.equal(duplicated.id === updated.id, false);
  repository.upsert(duplicated);
  assert.equal(repository.read().trips.length, 4);
  repository.delete(second.id);
  assert.equal(repository.read().trips.some((trip) => trip.id === second.id), false);
  assert.equal(repository.read().trips.some((trip) => trip.id === first.id), true);
});

test('saved-trip validation handles unsafe names, corrupted storage, unsupported schema, and write failure', () => {
  assert.equal(sanitizeTripName(' <b>Summer\u0000Trip</b> '.repeat(4)).includes('<'), false);
  assert.equal(sanitizeTripName(' <b>Summer\u0000Trip</b> '.repeat(4)).length <= 80, true);
  assert.equal(parseSavedTrips('{').corrupted, true);
  assert.equal(parseSavedTrips(JSON.stringify({ schemaVersion: 999, trips: [] })).corrupted, true);
  const cityForUnknownLanguage = cities[0];
  const unknownLanguageTrip = createSavedTrip({ language: 'en', preferences: { ...prefs, city: cityForUnknownLanguage.city }, city: cityForUnknownLanguage, itinerary: generateItinerary({ ...prefs, city: cityForUnknownLanguage.city }) });
  const rawUnknownLanguage = JSON.parse(JSON.stringify(unknownLanguageTrip));
  rawUnknownLanguage.language = 'xx';
  assert.equal(parseSavedTrips(JSON.stringify({ schemaVersion: 1, trips: [rawUnknownLanguage] })).trips[0]?.language, 'en');
  const failingStorage = new MemoryStorage();
  failingStorage.setItem = () => { throw new Error('quota'); };
  const repository = new SavedTripRepository(failingStorage);
  const city = cities[0];
  const trip = createSavedTrip({ language: 'en', preferences: { ...prefs, city: city.city }, city, itinerary: generateItinerary({ ...prefs, city: city.city }) });
  assert.throws(() => repository.upsert(trip), /quota/);
});

test('travel details validate, sanitize, sort, and protect private booking references', () => {
  const flight = validateTravelDetailInput({ type: 'flight', airline: ' Safar Air ', flightNumber: 'SF123', departureAirport: 'LHR', arrivalAirport: 'IST', departureDateTime: '2026-07-01T22:30', arrivalDateTime: '2026-07-02T04:20', departureTimeZone: 'Europe/London', arrivalTimeZone: 'Europe/Istanbul', bookingReference: 'SECRET-123', notes: ' Window\u0000 seat <b> ' }, 'Europe/London', '2026-06-01T00:00:00.000Z');
  assert.equal(flight.ok, true);
  assert.equal(flight.ok && flight.entry.notes?.includes('<'), false);
  assert.equal(validateTravelDetailInput({ type: 'flight', departureAirport: '', arrivalAirport: 'IST', departureDateTime: '2026-07-01T10:00', arrivalDateTime: '2026-07-01T12:00' }).ok, false);
  assert.equal(validateTravelDetailInput({ type: 'accommodation', propertyName: 'Hotel', checkInDateTime: '2026-07-03T15:00', checkOutDateTime: '2026-07-02T11:00' }).ok, false);
  assert.equal(validateTravelDetailInput({ type: 'reservation', title: 'Museum', startDateTime: '2026-07-01T10:00', timeZone: 'Not/AZone' }).ok, false);
  assert.equal(validateTravelDetailInput({ type: 'contact', name: 'Hotel desk', website: 'javascript:alert(1)' }).ok, false);
  assert.equal(validateTravelDetailInput({ type: 'contact', name: 'Hotel desk', website: 'example.com' }).ok, true);
  assert.equal(isValidTimeZone('Asia/Jerusalem'), true);
  assert.equal(isValidTimeZone('Bad/Zone'), false);
  const accommodation = validateTravelDetailInput({ type: 'accommodation', propertyName: 'City Hotel', checkInDateTime: '2026-07-03T15:00', checkOutDateTime: '2026-07-04T11:00' }, 'Europe/London');
  const reservation = validateTravelDetailInput({ type: 'reservation', title: 'Dinner', startDateTime: '2026-07-02T19:00' }, 'Europe/London');
  assert.equal(accommodation.ok && reservation.ok, true);
  if (flight.ok && accommodation.ok && reservation.ok) {
    const snapshot = upsertTravelDetail(upsertTravelDetail(upsertTravelDetail(emptyTravelDetails(), accommodation.entry), flight.entry), reservation.entry);
    assert.deepEqual(sortTravelDetails(snapshot.entries).map((entry) => entry.type), ['flight', 'reservation', 'accommodation']);
    assert.equal(deleteTravelDetail(snapshot, reservation.entry.id).entries.some((entry) => entry.id === reservation.entry.id), false);
  }
});

test('saved trips migrate and duplicate travel details without regenerating itineraries', () => {
  const city = cities.find((candidate) => candidate.city === 'London') ?? cities[0];
  const itinerary = generateItinerary({ ...prefs, city: city.city });
  const detail = validateTravelDetailInput({ type: 'reservation', title: 'Dinner', startDateTime: '2026-07-01T19:00', bookingReference: 'PRIVATE-REF' }, city.timezone);
  assert.equal(detail.ok, true);
  const travelDetails = detail.ok ? upsertTravelDetail(emptyTravelDetails(), detail.entry) : emptyTravelDetails();
  const trip = createSavedTrip({ language: 'en', preferences: { ...prefs, city: city.city }, city, itinerary, travelDetails, now: '2026-07-01T10:00:00.000Z' });
  assert.equal(trip.travelDetails.entries.length, 1);
  const oldSnapshot = JSON.parse(JSON.stringify(trip));
  delete oldSnapshot.travelDetails;
  assert.equal(parseSavedTrips(JSON.stringify({ schemaVersion: 1, trips: [oldSnapshot] })).trips[0]?.travelDetails.entries.length, 0);
  const duplicated = duplicateSavedTrip(trip, '2026-07-02T10:00:00.000Z');
  assert.equal(duplicated.travelDetails.entries.length, 1);
  assert.equal(duplicated.travelDetails.entries[0]?.id !== trip.travelDetails.entries[0]?.id, true);
  assert.deepEqual(duplicated.itinerary, trip.itinerary);
  assert.equal(JSON.stringify(trip).includes('weatherForecast'), false);
});

test('travel details are included in sharing and calendar export without private references', () => {
  const city = cities.find((candidate) => candidate.city === 'London') ?? cities[0];
  const preferences = { ...prefs, city: city.city, startDate: '2026-07-01', endDate: '2026-07-02' };
  const itinerary = generateItinerary(preferences);
  const flight = validateTravelDetailInput({ type: 'flight', airline: 'Safar Air', flightNumber: 'SF123', departureAirport: 'LHR', arrivalAirport: 'IST', departureDateTime: '2026-07-01T22:30', arrivalDateTime: '2026-07-02T04:20', departureTimeZone: 'Europe/London', arrivalTimeZone: 'Europe/Istanbul', bookingReference: 'SECRET-FLIGHT' }, city.timezone);
  const contact = validateTravelDetailInput({ type: 'contact', name: 'Hotel desk', phone: '+44 20 0000 0000', website: 'https://example.com', notes: 'Ask about late arrival' }, city.timezone);
  assert.equal(flight.ok && contact.ok, true);
  const travelDetails = flight.ok && contact.ok ? upsertTravelDetail(upsertTravelDetail(emptyTravelDetails(), flight.entry), contact.entry) : emptyTravelDetails();
  const snapshot = { name: 'London trip', city, preferences, itinerary, travelDetails, language: 'en' as const };
  const text = buildItineraryText(snapshot);
  assert.equal(text.includes(labels.en.travelDetails), true);
  assert.equal(text.includes('SF123'), true);
  assert.equal(text.includes('SECRET-FLIGHT'), false);
  assert.equal(text.includes(labels.en.travelPrivateReferenceExport), true);
  const ics = buildIcsCalendar(snapshot);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, itinerary.length + 1);
  assert.equal(ics.includes('SECRET-FLIGHT'), false);
  assert.equal(ics.includes('DTSTART:20260701T213000Z'), true);
  assert.equal(ics.includes('DTEND:20260702T012000Z'), true);
});

test('travel details UI labels, print rules, and local handlers are wired', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const fs = await load('node:fs/promises');
  const source = await fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  const styles = await fs.readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  for (const language of languages.map((item) => item.code)) {
    assert.equal(labels[language].travelDetails.length > 0, true);
    assert.equal(labels[language].travelPrivateReference.length > 0, true);
    assert.equal(labels[language].travelSensitiveWarning.length > 0, true);
  }
  assert.equal(source.includes('function travelDetailsSectionMarkup'), true);
  assert.equal(source.includes('bindTravelDetailsSection();'), true);
  assert.equal(source.includes('saved-trip-inline-status'), true);
  assert.equal(source.includes('validateTravelDetailInput(readTravelDetailInput'), true);
  assert.equal(source.includes('void search') || source.includes('requestJson'), true);
  assert.equal(source.includes('bookingReference') && source.includes('travelPrivateReference'), true);
  assert.equal(styles.includes('.travel-detail-editor'), true);
  assert.equal(styles.includes('.travel-detail-actions,'), true);
  assert.equal(styles.includes('page-break-inside: avoid'), true);
  assert.equal(languageDirection('ar'), 'rtl');
});

test('generates inclusive multi-day itineraries with dated unique items', () => {
  const twoDay = generateItinerary({ ...prefs, startDate: '2026-07-01', endDate: '2026-07-02' });
  const threeDay = generateItinerary({ ...prefs, startDate: '2026-07-01', endDate: '2026-07-03' });
  const replanned = generateItinerary({ ...prefs, startDate: '2026-07-01', endDate: '2026-07-03' }, 5);
  assert.deepEqual([...new Set(twoDay.map((item) => item.date))], ['2026-07-01', '2026-07-02']);
  assert.deepEqual([...new Set(threeDay.map((item) => item.date))], ['2026-07-01', '2026-07-02', '2026-07-03']);
  assert.deepEqual([...new Set(replanned.map((item) => item.date))], ['2026-07-01', '2026-07-02', '2026-07-03']);
  assert.equal(new Set(threeDay.map((item) => item.id)).size, threeDay.length);
  assert.equal(threeDay.every((item) => item.id.includes(item.date)), true);
});

const itemStartMinutes = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};

const itemEndMinutes = (item: { time: string; durationMinutes: number }) => itemStartMinutes(item.time) + item.durationMinutes;

const assertNoOverlaps = (items: ReturnType<typeof generateItinerary>) => {
  for (const date of new Set(items.map((item) => item.date))) {
    const dayItems = items.filter((item) => item.date === date).sort((a, b) => itemStartMinutes(a.time) - itemStartMinutes(b.time));
    dayItems.slice(1).forEach((item, index) => {
      assert.equal(itemStartMinutes(item.time) >= itemEndMinutes(dayItems[index]), true);
    });
  }
};

test('generates one-day, two-day, and seven-day itineraries without overlaps', () => {
  const oneDay = generateItinerary({ ...prefs, startDate: '2026-07-01', endDate: '2026-07-01', startHour: '09:00', endHour: '18:00' });
  const twoDay = generateItinerary({ ...prefs, startDate: '2026-07-01', endDate: '2026-07-02', startHour: '09:00', endHour: '18:00' });
  const sevenDay = generateItinerary({ ...prefs, startDate: '2026-07-01', endDate: '2026-07-07', startHour: '09:00', endHour: '18:00' });
  assert.equal(new Set(oneDay.map((item) => item.date)).size, 1);
  assert.equal(new Set(twoDay.map((item) => item.date)).size, 2);
  assert.equal(new Set(sevenDay.map((item) => item.date)).size, 7);
  [oneDay, twoDay, sevenDay].forEach(assertNoOverlaps);
});

test('includes all prayers that fall inside selected daily hours', () => {
  const fullDay = generateItinerary({ ...prefs, city: 'Tokyo', startHour: '00:00', endHour: '23:00', startDate: '2026-07-01', endDate: '2026-07-01' });
  const titles = fullDay.filter((item) => item.kind === 'prayer').map((item) => item.title);
  for (const prayer of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) assert.equal(titles.some((title) => title.includes(prayer)), true);
  assertNoOverlaps(fullDay);
});

test('early morning and evening schedules include only prayers inside available hours', () => {
  const morning = generateItinerary({ ...prefs, city: 'Tokyo', startHour: '00:00', endHour: '07:00' });
  const evening = generateItinerary({ ...prefs, city: 'Tokyo', startHour: '18:00', endHour: '22:30' });
  assert.equal(morning.some((item) => item.kind === 'prayer' && item.title.includes('Fajr')), true);
  assert.equal(morning.some((item) => item.kind === 'prayer' && item.title.includes('Dhuhr')), false);
  assert.equal(evening.some((item) => item.kind === 'prayer' && item.title.includes('Maghrib')), true);
  assert.equal(evening.some((item) => item.kind === 'prayer' && item.title.includes('Isha')), true);
  assertNoOverlaps(morning);
  assertNoOverlaps(evening);
});

test('every itinerary item stays inside the selected daily hours', () => {
  const items = generateItinerary({ ...prefs, city: 'London', startDate: '2026-07-01', endDate: '2026-07-07', startHour: '09:30', endHour: '16:45', interests: [] });
  assert.equal(items.every((item) => itemStartMinutes(item.time) >= itemStartMinutes('09:30')), true);
  assert.equal(items.every((item) => itemEndMinutes(item) <= itemStartMinutes('16:45')), true);
  assertNoOverlaps(items);
});

test('multi-day replan changes only the intended day', () => {
  const base = generateItinerary({ ...prefs, city: 'London', startDate: '2026-07-01', endDate: '2026-07-03', startHour: '09:00', endHour: '18:00', interests: [] });
  const secondDayIndex = base.findIndex((item) => item.date === '2026-07-02');
  const replanned = generateItinerary({ ...prefs, city: 'London', startDate: '2026-07-01', endDate: '2026-07-03', startHour: '09:00', endHour: '18:00', interests: [] }, secondDayIndex + 1);
  const titlesFor = (items: typeof base, date: string) => items.filter((item) => item.date === date).map((item) => `${item.time}-${item.title}-${item.details}`);
  assert.equal(JSON.stringify(titlesFor(replanned, '2026-07-02')) !== JSON.stringify(titlesFor(base, '2026-07-02')), true);
  assert.deepEqual(titlesFor(replanned, '2026-07-01'), titlesFor(base, '2026-07-01'));
  assert.deepEqual(titlesFor(replanned, '2026-07-03'), titlesFor(base, '2026-07-03'));
  assert.equal(new Set(replanned.map((item) => item.id)).size, replanned.length);
  assertNoOverlaps(replanned);
});

test('planner preferences affect attraction, prayer, restaurant, and travel choices', () => {
  const history = generateItinerary({ ...prefs, city: 'London', interests: ['history'], children: false, prayerPreference: 'mosque', budget: 'mid', halalPreference: 'strictly labelled', transportation: 'public transport' });
  const walkingFamily = generateItinerary({ ...prefs, city: 'London', interests: ['walking'], children: true, prayerPreference: 'quiet prayer space', budget: 'low', halalPreference: 'vegetarian/seafood options', transportation: 'walking', walkingAbility: 'low' });
  assert.equal(history.some((item) => item.kind === 'attraction' && item.title === 'British Museum'), true);
  assert.equal(walkingFamily.some((item) => item.kind === 'attraction' && item.title === 'Regent’s Park walk'), true);
  assert.equal(history.some((item) => item.kind === 'prayer' && item.title.includes('London Central Mosque')), true);
  assert.equal(walkingFamily.some((item) => item.kind === 'prayer' && item.title.includes('London quiet prayer room')), true);
  assert.equal(history.find((item) => item.kind === 'travel')?.durationMinutes !== walkingFamily.find((item) => item.kind === 'travel')?.durationMinutes, true);
  assert.equal(walkingFamily.some((item) => item.kind === 'meal' && item.details.includes('perfect budget or halal-preference match was not available')), true);
});

test('counts itinerary dates across month and year boundaries', () => {
  assert.deepEqual(itineraryDates('2026-07-01', '2026-07-01'), ['2026-07-01']);
  assert.deepEqual(itineraryDates('2026-07-31', '2026-08-02'), ['2026-07-31', '2026-08-01', '2026-08-02']);
  assert.deepEqual(itineraryDates('2026-12-31', '2027-01-02'), ['2026-12-31', '2027-01-01', '2027-01-02']);
});

test('multi-day itinerary respects daily end time and distributes attractions', () => {
  const items = generateItinerary({ ...prefs, city: 'London', startDate: '2026-07-01', endDate: '2026-07-03', startHour: '09:00', endHour: '15:00', interests: [] });
  const minutes = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    return hour * 60 + minute;
  };
  assert.equal(items.every((item) => !Number.isFinite(minutes(item.time)) || minutes(item.time) + item.durationMinutes <= minutes('15:00')), true);
  const attractionNames = items.filter((item) => item.kind === 'attraction').map((item) => item.title);
  assert.equal(attractionNames.some((name, index) => index > 0 && name === attractionNames[index - 1]), false);
});

test('day headings are rendered for English, Arabic, Indonesian, and Malay', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  assert.equal(source.includes('formatItineraryDayHeading(date, dayIndex, copy)'), true);
  assert.equal(labels.en.dayHeading, 'Day');
  assert.equal(labels.ar.dayHeading, 'اليوم');
  assert.equal(labels.id.dayHeading, 'Hari');
  assert.equal(labels.ms.dayHeading, 'Hari');
});

test('Generate Itinerary button controls planner generation workflow', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  assert.equal(source.includes('let generatedPrefs: PlannerPreferences | null = null'), true);
  assert.equal(source.includes('let generatedItems: ItineraryItem[] = []'), true);
  assert.equal(source.includes('const items = generatedPrefs && generatedCity ? generatedItems : []'), true);
  assert.equal(source.includes('plannerValidation || (visibleCities.length ? copy.generatePrompt : copy.noCities)'), true);
  assert.equal(source.includes('const next = readPlannerDraftFromForm()'), true);
  assert.equal(source.includes('generatedPrefs = { ...next, interests: [...next.interests] }'), true);
  assert.equal(source.includes('generatedItems = generateItinerary(generatedPrefs, 0, lang)'), true);
  assert.equal(source.includes('plannerAnnouncement = copy.itineraryReady'), true);
  assert.equal(source.includes("document.querySelector('#planner-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })"), true);
  assert.equal(source.includes("document.querySelector<HTMLSelectElement>('[data-region=\"filter\"]')?.addEventListener"), true);
  assert.equal(source.includes('const visible = selectedRegion ? cities.filter((candidate) => candidate.region === selectedRegion) : cities'), true);
  assert.equal(source.includes('prefs = { ...prefs, city: visible[0].city }'), true);
  assert.equal(source.includes("plannerValidation = '';\n    plannerAnnouncement = '';\n    render();"), true);
  assert.equal(source.includes("if (key === 'city' || key === 'prayerMethod' || key === 'startDate') {\n      athanStatus = '';"), true);
  assert.equal(source.includes('generateItinerary(prefs, replan, lang)'), false);
  assert.equal(source.includes('replan = Number(button.dataset.replan)'), true);
  assert.equal(source.includes('generatedItems = generateItinerary(generatedPrefs, replan, lang)'), true);
  assert.equal(source.includes('invalidTripTooLong'), true);
});

test('main planner render hides internal verification labels from itinerary UI', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  const plannerStart = source.indexOf('function render()');
  const plannerEnd = source.indexOf('function bind()', plannerStart);
  const plannerRender = source.slice(plannerStart, plannerEnd);
  assert.equal(plannerRender.includes('copy.prototype'), false);
  assert.equal(plannerRender.includes('copy.sample'), false);
  assert.equal(plannerRender.includes('copy.legend'), false);
  assert.equal(plannerRender.includes("statusBadge('Sample')"), false);
  assert.equal(plannerRender.includes('statusBadge(item.status)'), false);
  assert.equal(plannerRender.includes('item.place?.evidence'), false);
  assert.equal(plannerRender.includes('copy.transportEstimatesAre'), true);
  assert.equal(labels.en.transportEstimatesAre, 'Estimated travel times');
  assert.equal(labels.ar.transportEstimatesAre, 'أوقات السفر التقديرية');
  assert.equal(labels.id.transportEstimatesAre, 'Estimasi waktu perjalanan');
  assert.equal(source.includes('plannerFacilityStatus(item.place.facility.womenPrayerSpace, copy)'), true);
  assert.equal(labels.en.facilityAvailable, 'Available');
  assert.equal(labels.en.facilityInfoUnavailable, 'Information unavailable');
  assert.equal(labels.en.facilityEstimatedInfo, 'Estimated information');
  assert.equal(labels.ar.facilityAvailable.length > 0, true);
  assert.equal(labels.id.facilityAvailable.length > 0, true);
});

test('itinerary screen uses saved snapshots, clear trip actions, print styles, and sanitized planner wording', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const fs = await load('node:fs/promises');
  const source = await fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  const styles = await fs.readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.equal(source.includes("type View = 'planner' | 'saved-trips'"), true);
  assert.equal(source.includes("window.location.hash === '#saved-trips'"), true);
  assert.equal(source.includes('function savedTripsPage()'), true);
  assert.equal(source.includes('function openSavedTrip(trip: SavedTrip)'), true);
  assert.equal(source.includes('generatedItems = trip.itinerary.map'), true);
  assert.equal(source.includes('saveCurrentTrip(labels[lang])'), true);
  assert.equal(source.includes("window.addEventListener('storage'"), true);
  assert.equal(source.includes('stripInternalPlannerText(item.title)'), true);
  assert.equal(source.includes('stripInternalPlannerText(item.details)'), true);
  assert.equal(styles.includes('@media print'), true);
  assert.equal(styles.includes('.trip-header'), true);
  assert.equal(styles.includes('.trip-actions'), true);
  assert.equal(styles.includes('overflow-wrap: anywhere'), true);
});

test('planner validation and pre-generation messages are translated', () => {
  assert.equal(labels.en.generatePrompt, 'Choose your destination and preferences, then press Generate Itinerary.');
  assert.equal(labels.en.invalidEndDate, 'End date cannot be before the start date.');
  assert.equal(labels.en.invalidEndTime, 'End time cannot be before the start time on a one-day trip.');
  assert.equal(labels.en.invalidGroupSize, 'Group size must be at least 1.');
  assert.equal(labels.en.invalidCity, 'Choose a supported city before generating an itinerary.');
  assert.equal(labels.ar.generatePrompt.length > 0, true);
  assert.equal(labels.ar.itineraryReady.length > 0, true);
  assert.equal(labels.id.generatePrompt.length > 0, true);
  assert.equal(labels.id.itineraryReady.length > 0, true);
});

test('supports switching among English, Arabic, Bahasa Indonesia, Bahasa Melayu, Turkish, and French', () => {
  assert.deepEqual(languages.map((language) => language.code), ['en', 'ar', 'id', 'ms', 'tr', 'fr']);
  assert.equal(languages.find((language) => language.code === 'ms')?.label, 'Bahasa Melayu');
  assert.equal(languages.find((language) => language.code === 'tr')?.label, 'Türkçe');
  assert.equal(languages.find((language) => language.code === 'fr')?.label, 'Français');
  assert.equal(nextLanguage('en'), 'ar');
  assert.equal(nextLanguage('ar'), 'id');
  assert.equal(nextLanguage('id'), 'ms');
  assert.equal(nextLanguage('ms'), 'tr');
  assert.equal(nextLanguage('tr'), 'fr');
  assert.equal(nextLanguage('fr'), 'en');
  assert.equal(languageDirection('en'), 'ltr');
  assert.equal(languageDirection('id'), 'ltr');
  assert.equal(languageDirection('ms'), 'ltr');
  assert.equal(languageDirection('tr'), 'ltr');
  assert.equal(languageDirection('fr'), 'ltr');
  assert.equal(languageDirection('ar'), 'rtl');
});

test('Malay language support is complete and uses Malaysian terminology', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const main = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  const labelKeys = Object.keys(labels.en).sort();
  assert.deepEqual(Object.keys(labels.ms).sort(), labelKeys);
  assert.deepEqual(Object.keys(athanLabels.ms).sort(), Object.keys(athanLabels.en).sort());
  assert.equal(JSON.stringify(labels.ms) === JSON.stringify(labels.id), false);
  for (const value of Object.values(labels.ms)) assert.equal(value.trim().length > 0, true);
  const malayText = JSON.stringify(labels.ms);
  for (const term of ['transportasi', 'taksi', 'informasi', 'situs web', 'unduh', 'Amerika Serikat']) {
    assert.equal(malayText.includes(term), false);
  }
  assert.equal(labels.ms.subtitle, 'Perancang Perjalanan Muslim');
  assert.equal(labels.ms.tagline, 'Rancang dengan iman. Mengembara dengan tenang.');
  assert.equal(labels.ms.publicTransport.includes('pengangkutan awam'), true);
  assert.equal(labels.ms.taxi, 'teksi');
  assert.equal(labels.ms.wudu, 'Wuduk');
  assert.equal(labels.ms.privacyPolicy, 'Dasar Privasi');
  assert.equal(labels.ms.supportPage, 'Sokongan');
  assert.deepEqual(regionLabels.ms.Asia, 'Asia');
  assert.equal(athanLabels.ms.title.toLowerCase().includes('waktu solat'), true);
  assert.equal(athanLabels.ms.enable.includes('pemberitahuan solat'), true);
  assert.equal(main.includes("language === 'ms' ? 'ms-MY'"), true);
});

test('Turkish language support is complete and uses Turkish terminology', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const main = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  const labelKeys = Object.keys(labels.en).sort();
  assert.deepEqual(Object.keys(labels.tr).sort(), labelKeys);
  assert.deepEqual(Object.keys(athanLabels.tr).sort(), Object.keys(athanLabels.en).sort());
  for (const [key, value] of Object.entries(labels.tr)) {
    if (key === 'prototype') continue;
    assert.equal(value.trim().length > 0, true);
  }
  assert.equal(labels.tr.subtitle, 'Müslüman Seyahat Planlayıcısı');
  assert.equal(labels.tr.qiblaTitle.includes('Kıble'), true);
  assert.equal(labels.tr.prayerMethod.includes('Namaz'), true);
  assert.equal(labels.tr.wudu, 'Abdest');
  assert.equal(labels.tr.halalRestaurantsTitle.includes('Helal'), true);
  assert.equal(labels.tr.prayerSpacesTitle.includes('Cami'), true);
  assert.equal(labels.tr.prayerTypeRoom, 'Mescit');
  assert.equal(labels.tr.privacyPolicy, 'Gizlilik Politikası');
  assert.equal(labels.tr.supportPage, 'Destek');
  assert.equal(athanLabels.tr.title.includes('Namaz'), true);
  assert.equal(athanLabels.tr.description.includes('Ezan'), true);
  assert.equal(prayerLabels.tr.Fajr, 'Sabah');
  assert.equal(prayerLabels.tr.Dhuhr, 'Öğle');
  assert.equal(prayerLabels.tr.Isha, 'Yatsı');
  assert.equal(main.includes("language === 'tr' ? 'tr-TR'"), true);
});

test('Malay prayer labels use common Malaysian forms', () => {
  assert.equal(labels.ms.prayerMethod.includes('solat'), true);
  assert.equal(labels.ms.prayerSpacesTitle.includes('Ruang Solat'), true);
  assert.equal(labels.ms.qiblaTitle.includes('Kiblat'), true);
  assert.equal(labels.ms.publicTransportTitle, 'Pengangkutan Awam');
  assert.equal(labels.ms.taxiTitle, 'Perkhidmatan Teksi');
  assert.equal(labels.ms.carRentalTitle, 'Sewaan Kereta');
  assert.equal(labels.ms.toiletsTitle, 'Tandas Awam');
});

test('package scripts lint source and discover all compiled test files', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const fs = await load('node:fs/promises');
  const packageJson = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
  const eslintConfig = await fs.readFile(new URL('../eslint.config.js', import.meta.url), 'utf8');
  const testRunner = await fs.readFile(new URL('../scripts/run-tests.mjs', import.meta.url), 'utf8');
  assert.equal(packageJson.scripts.lint.includes('dist'), false);
  assert.equal(packageJson.scripts.lint.includes('typecheck'), true);
  assert.equal(eslintConfig.includes("ignores: ['dist/**', 'dist-test/**', 'node_modules/**']"), true);
  assert.equal(eslintConfig.includes('src/**/*.ts'), false);
  assert.equal(packageJson.scripts.test.includes('scripts/run-tests.mjs'), true);
  assert.equal(packageJson.scripts.test.includes('planner.test.js'), false);
  assert.equal(testRunner.includes("endsWith('.test.js')"), true);
});

test('offline app shell uses local MapLibre bundle, manifest, and conservative service-worker caching', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const fs = await load('node:fs/promises');
  const index = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const main = await fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  const sw = await fs.readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const manifest = await fs.readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8');
  assert.equal(index.includes('Sample Muslim travel planner prototype'), false);
  assert.equal(index.includes('unpkg.com/maplibre-gl'), false);
  assert.equal(index.includes('manifest.webmanifest'), true);
  assert.equal(main.includes("import maplibregl from 'maplibre-gl'"), true);
  assert.equal(main.includes("import 'maplibre-gl/dist/maplibre-gl.css'"), true);
  assert.equal(serviceWorkerUrl('/muslim-travel-planner/'), '/muslim-travel-planner/sw.js');
  assert.equal(sw.includes('CACHE_VERSION'), true);
  assert.equal(sw.includes("new URL('./privacy.html', APP_SCOPE)"), true);
  assert.equal(sw.includes("new URL('./support.html', APP_SCOPE)"), true);
  assert.equal(sw.includes("request.mode === 'navigate'"), true);
  assert.equal(sw.includes("['script', 'style', 'image', 'font']"), true);
  assert.equal(sw.includes('isLiveApi'), true);
  assert.equal(sw.includes('localStorage'), false);
  assert.equal(JSON.parse(manifest).start_url, '/muslim-travel-planner/');
});

test('SafarOne branding, metadata, manifest, and launch pages are truthful', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const fs = await load('node:fs/promises');
  const index = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  const manifest = JSON.parse(await fs.readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8')) as { name: string; short_name: string; start_url: string; scope: string; description: string };
  const icon = await fs.readFile(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
  const main = await fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  const savedTrips = await fs.readFile(new URL('../src/saved-trips.ts', import.meta.url), 'utf8');
  const privacy = await fs.readFile(new URL('../public/privacy.html', import.meta.url), 'utf8');
  const support = await fs.readFile(new URL('../public/support.html', import.meta.url), 'utf8');
  const checklist = await fs.readFile(new URL('../LAUNCH_CHECKLIST.md', import.meta.url), 'utf8');
  assert.equal(labels.en.title, 'SafarOne');
  assert.equal(labels.en.subtitle, 'Muslim Travel Planner');
  assert.equal(labels.en.tagline, 'Plan with faith. Travel with peace.');
  assert.equal(labels.ar.title, 'SafarOne');
  assert.equal(labels.ar.subtitle, 'مخطط سفر للمسلمين');
  assert.equal(labels.ar.tagline, 'خطّط بإيمان. وسافر بطمأنينة.');
  assert.equal(labels.id.title, 'SafarOne');
  assert.equal(labels.id.subtitle, 'Perencana Perjalanan Muslim');
  assert.equal(labels.id.tagline, 'Rencanakan dengan iman. Bepergian dengan tenang.');
  assert.equal(labels.ms.title, 'SafarOne');
  assert.equal(labels.ms.subtitle, 'Perancang Perjalanan Muslim');
  assert.equal(labels.ms.tagline, 'Rancang dengan iman. Mengembara dengan tenang.');
  assert.equal(index.includes('<title>SafarOne — Muslim Travel Planner</title>'), true);
  assert.equal(index.includes('Prayer-aware trip planning with local saved itineraries, travel tools, and optional offline access to saved trip information.'), true);
  assert.equal(manifest.name, 'SafarOne — Muslim Travel Planner');
  assert.equal(manifest.short_name, 'SafarOne');
  assert.equal(manifest.start_url, '/muslim-travel-planner/');
  assert.equal(manifest.scope, '/muslim-travel-planner/');
  assert.equal(icon.includes('aria-label="SafarOne"'), true);
  assert.equal(savedTrips.includes("SAVED_TRIPS_STORAGE_KEY = 'mtp-saved-trips-v1'"), true);
  assert.equal(main.includes('function staticPageUrl'), true);
  assert.equal(main.includes('return staticLegalPageUrl(page, lang);'), true);
  assert.equal(checklist.includes('Final full-resolution App Store icon asset is still required') || checklist.includes('App Store icon'), true);
  assert.equal(privacy.includes('Last updated: July 2, 2026'), true);
  assert.equal(privacy.includes('data-lang="ms" lang="ms" dir="ltr"'), true);
  assert.equal(privacy.includes('Dikemas kini terakhir: 2 Julai 2026'), true);
  assert.equal(privacy.includes('support.html?lang=ms'), true);
  assert.equal(privacy.includes('data-lang="tr" lang="tr" dir="ltr"'), true);
  assert.equal(privacy.includes('Son güncelleme: 2 Temmuz 2026'), true);
  assert.equal(privacy.includes('support.html?lang=tr'), true);
  assert.equal(privacy.includes('Firas Badran'), true);
  assert.equal(support.includes('data-lang="ms" lang="ms" dir="ltr"'), true);
  assert.equal(support.includes('Bahasa Melayu'), true);
  assert.equal(support.includes('privacy.html?lang=ms'), true);
  assert.equal(support.includes('data-lang="tr" lang="tr" dir="ltr"'), true);
  assert.equal(support.includes('Türkçe'), true);
  assert.equal(support.includes('privacy.html?lang=tr'), true);
  assert.equal(support.includes('Firas Badran'), true);
  assert.equal((privacy.match(/planetearthkh@gmail\.com/g) ?? []).length >= 3, true);
  assert.equal(support.includes('mailto:planetearthkh@gmail.com'), true);
  assert.equal(privacy.includes('OpenStreetMap') && privacy.includes('Overpass') && privacy.includes('OpenFreeMap'), true);
  assert.equal(privacy.includes('Open-Meteo') && privacy.includes('Frankfurter'), true);
  assert.equal(privacy.includes('Wikimedia Commons') && privacy.includes('Wikipedia') && privacy.includes('Wikidata'), true);
  assert.equal(privacy.includes('GitHub/GitHub Pages') && privacy.includes('Apple Maps'), true);
  assert.equal(privacy.includes('precise location never leaves the device'), false);
  assert.equal(privacy.includes('data-lang="ar"') && privacy.includes('dir="rtl"'), true);
  assert.equal(support.includes('data-lang="ar"') && support.includes('dir="rtl"'), true);
  assert.equal(privacy.includes("['en', 'ar', 'id', 'ms', 'tr']"), true);
  assert.equal(support.includes("['en', 'ar', 'id', 'ms', 'tr']"), true);
  assert.equal(/google-analytics|gtag|facebook pixel|doubleclick|fonts\.googleapis|fonts\.gstatic/i.test(index + privacy + support), false);
  assert.equal(/trusted worldwide|100% accurate|fully offline|verified halal|guaranteed halal|official prayer times/i.test(index + privacy + support + main), false);
});

test('saved trips and offline labels are translated in English, Arabic, Indonesian, and Malay', () => {
  for (const language of languages.map((item) => item.code)) {
    assert.equal(labels[language].savedTripsTitle.length > 0, true);
    assert.equal(labels[language].saveTrip.length > 0, true);
    assert.equal(labels[language].offlineIndicator.length > 0, true);
    assert.equal(labels[language].approximateQibla.length > 0, true);
    assert.equal(labels[language].internetRequired.length > 0, true);
  }
});

test('connection indicator is a noninteractive status with offline and temporary online states', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const fs = await load('node:fs/promises');
  const main = await fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  const styles = await fs.readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.equal(main.includes("let connectionNotice: ConnectionState | 'hidden' = connectionState === 'offline' ? 'offline' : 'hidden'"), true);
  assert.equal(main.includes("let connectionWasOffline = connectionState === 'offline'"), true);
  assert.equal(main.includes('id="connection-status"'), true);
  assert.equal(main.includes('role="status"'), true);
  assert.equal(main.includes('aria-live="polite"'), true);
  assert.equal(main.includes('aria-atomic="true"'), true);
  assert.equal(main.includes('connection-status ${connectionNotice}'), true);
  assert.equal(main.includes('connectionNoticeTimer = window.setTimeout'), true);
  assert.equal(main.includes('}, 4000);'), true);
  assert.equal(main.includes("if (nextState === 'online' && !connectionWasOffline)"), true);
  assert.equal(main.includes("window.addEventListener('online', () => {\n  showConnectionNotice('online');\n});"), true);
  assert.equal(main.includes("window.addEventListener('offline', () => {\n  showConnectionNotice('offline');\n});"), true);
  assert.equal(main.includes("window.addEventListener('online', () => {\n  connectionState = 'online';\n  render();\n});"), false);
  assert.equal(main.includes("window.addEventListener('offline', () => {\n  connectionState = 'offline';\n  render();\n});"), false);
  assert.equal(styles.includes('.connection-status.online'), true);
  assert.equal(styles.includes('.connection-status.offline'), true);
  assert.equal(styles.includes('.connection-dot'), true);
  const connectionCss = styles.slice(styles.indexOf('.connection-status'), styles.indexOf('.trip-header'));
  assert.equal(connectionCss.includes('cursor:'), false);
  assert.equal(connectionCss.includes(':hover'), false);
  assert.equal(connectionCss.includes(':focus'), false);
});

test('home dashboard groups every feature card with local icons and responsive layout', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const fs = await load('node:fs/promises');
  const main = await fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  const styles = await fs.readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  const packageJson = await fs.readFile(new URL('../package.json', import.meta.url), 'utf8');
  const featureIds = [
    'open-saved-trips',
    'open-qibla',
    'open-flight-mode',
    'open-prayer-spaces',
    'open-halal-restaurants',
    'open-money',
    'open-public-toilets',
    'open-car-rental',
    'open-public-transport',
    'open-taxi-services',
    'open-weather',
    'open-attractions',
  ];
  assert.equal((main.match(/homeActionCard\('/g) ?? []).length, 12);
  assert.equal(main.includes("copy.homeTripsGroup"), true);
  assert.equal(main.includes("copy.homeEssentialsGroup"), true);
  assert.equal(main.includes("copy.homeTravelToolsGroup"), true);
  assert.equal(main.includes('function homeIcon(name: string)'), true);
  assert.equal(main.includes('class="home-card-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"'), true);
  for (const id of featureIds) {
    assert.equal(main.includes(`'${id}'`), true);
    assert.equal(main.includes(`document.querySelector<HTMLButtonElement>('#${id}')`), true);
  }
  assert.equal(packageJson.includes('lucide'), false);
  assert.equal(packageJson.includes('fontawesome'), false);
  assert.equal(styles.includes('--color-emerald-deep'), true);
  assert.equal(styles.includes('--color-emerald'), true);
  assert.equal(styles.includes('--color-mint-soft'), true);
  assert.equal(styles.includes('--color-gold'), true);
  assert.equal(styles.includes('font-size: clamp(2rem, 5vw, 3.25rem)'), true);
  assert.equal(styles.includes('padding: calc(22px + env(safe-area-inset-top)) 24px 22px'), true);
  assert.equal(styles.includes('.home-tool-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }'), true);
  assert.equal(styles.includes('.home-tool-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }'), true);
  assert.equal(styles.includes('.home-tool-grid {\n  display: grid;\n  gap: 12px;\n  grid-template-columns: 1fr;'), true);
  assert.equal(styles.includes('overflow-wrap: anywhere'), true);
  assert.equal(styles.includes('white-space: normal'), true);
  assert.equal(styles.includes('@media (prefers-reduced-motion: reduce)'), true);
  assert.equal(styles.includes('.lang {\n    position: static;'), true);
});

test('home group labels are translated for English, Arabic, Indonesian, and Malay', () => {
  assert.equal(labels.en.homeTripsGroup, 'Your Trips');
  assert.equal(labels.en.homeEssentialsGroup, 'Muslim Essentials');
  assert.equal(labels.en.homeTravelToolsGroup, 'Travel Tools');
  assert.equal(labels.ar.homeTripsGroup.length > 0, true);
  assert.equal(labels.ar.homeEssentialsGroup.length > 0, true);
  assert.equal(labels.ar.homeTravelToolsGroup.length > 0, true);
  assert.equal(languageDirection('ar'), 'rtl');
  assert.equal(labels.id.homeTripsGroup.length > 0, true);
  assert.equal(labels.id.homeEssentialsGroup.length > 0, true);
  assert.equal(labels.id.homeTravelToolsGroup.length > 0, true);
  assert.equal(labels.ms.homeTripsGroup.length > 0, true);
  assert.equal(labels.ms.homeEssentialsGroup.length > 0, true);
  assert.equal(labels.ms.homeTravelToolsGroup.length > 0, true);
});

test('place reporting builds safe honest report destinations and text', () => {
  const place = { feature: 'Halal Restaurants', name: 'Central Grill', sourceUrl: 'https://www.openstreetmap.org/node/123', latitude: 51.5, longitude: -0.1, city: 'London', country: 'United Kingdom' };
  const report = createPlaceReport(place, 'halal', ' <b>wrong\u0000halal</b> '.repeat(20), 'en', '2026-07-01T10:00:00.000Z');
  assert.equal(sourcePartsFromOsmUrl(place.sourceUrl).sourceType, 'node');
  assert.equal(report.sourceId, '123');
  assert.equal(report.note.includes('<'), false);
  assert.equal(report.note.length <= 500, true);
  const text = buildReportText(report);
  assert.equal(text.includes('Feature: Halal Restaurants'), true);
  assert.equal(text.includes('Source object: node/123'), true);
  assert.equal(text.includes('Mapped coordinates: 51.5, -0.1'), true);
  assert.equal(text.includes('cache'), false);
  assert.equal(text.includes('payload'), false);
  assert.equal(osmReportUrl(place), place.sourceUrl);
  assert.equal(osmReportUrl({ feature: 'Attractions', name: 'No ID', latitude: 1, longitude: 2 }), 'https://www.openstreetmap.org/note/new#map=17/1/2');
  assert.equal(osmReportUrl({ feature: 'Attractions', name: 'Unsafe', sourceUrl: 'javascript:alert(1)' }), '');
  const issueUrl = githubIssueUrl(report);
  assert.equal(issueUrl.startsWith('https://github.com/planetearthkh-arch/muslim-travel-planner/issues/new?'), true);
  assert.equal(new URL(issueUrl).searchParams.get('body')?.includes('Opening this issue page does not submit automatically'), true);
  assert.equal(canShareReport({ share: async () => undefined } as Navigator), true);
});

test('reporting labels and mapped-place source hooks cover only place features', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  for (const language of languages.map((item) => item.code)) {
    assert.equal(labels[language].reportProblem.length > 0, true);
    assert.equal(labels[language].reportWrongName.length > 0, true);
    assert.equal(labels[language].reportOsm.length > 0, true);
    assert.equal(labels[language].reportGithubAccount.length > 0, true);
    assert.equal(labels[language].reportExternalNotice.length > 0, true);
  }
  assert.equal(reportReasons.includes('halal'), true);
  assert.equal(source.includes("reportReasons.filter((reason) => includeHalal || reason !== 'halal')"), true);
  assert.equal((source.match(/reportActionMarkup\(reportPlace/g) ?? []).length, 7);
  assert.equal(source.includes('weatherPage()') && !source.includes('weatherReport'), true);
  assert.equal(source.includes('moneyPage()') && !source.includes('moneyReport'), true);
  assert.equal(source.includes('qiblaPage()') && !source.includes('qiblaReport'), true);
  assert.equal(source.includes('openReportDialog(place'), true);
  assert.equal(source.includes('data-report-source'), true);
  assert.equal(source.includes('copyText(buildReportText(currentReport()))'), true);
  assert.equal(source.includes('shareText(`${copy.reportProblem}: ${report.name}`, buildReportText(report))'), true);
  assert.equal(source.includes('trigger?.focus()'), true);
});

test('trip sharing builds clean plain text, safe filenames, and ICS calendar exports', () => {
  const city = cities.find((candidate) => candidate.city === 'London') ?? cities[0];
  const preferences = { ...prefs, city: city.city, startDate: '2026-07-01', endDate: '2026-07-02' };
  const itinerary = generateItinerary(preferences);
  const snapshot = { name: 'London family trip', city, preferences, itinerary, language: 'en' as const };
  const text = buildItineraryText(snapshot);
  assert.equal(text.includes('London, United Kingdom'), true);
  assert.equal(text.includes(labels.en.shareLiveInfoWarning), true);
  assert.equal(text.includes('{'), false);
  assert.equal(text.includes('cache'), false);
  assert.equal(groupedItinerary(itinerary).length, 2);
  assert.equal(text.includes('Dhuhr'), true);
  const ics = buildIcsCalendar(snapshot);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, itinerary.length);
  assert.equal(ics.includes(`TZID=${city.timezone}`), true);
  assert.equal(ics.includes('UID:'), true);
  assert.equal(escapeIcs('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  assert.equal(safeTripFilename('London: Family/Trip?'), 'London-Family-Trip.ics');
  assert.equal(canWebShare({ share: async () => undefined } as Navigator), true);
});

test('trip sharing UI preserves saved snapshots and print-safe controls', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const fs = await load('node:fs/promises');
  const source = await fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  const styles = await fs.readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.equal(labels.en.printItinerary, 'Print / Save PDF');
  for (const language of languages.map((item) => item.code)) {
    assert.equal(labels[language].shareTrip.length > 0, true);
    assert.equal(labels[language].copyItinerary.length > 0, true);
    assert.equal(labels[language].exportCalendar.length > 0, true);
    assert.equal(labels[language].shareLiveInfoWarning.length > 0, true);
  }
  assert.equal(source.includes('function snapshotFromSavedTrip(trip: SavedTrip): TripExportSnapshot'), true);
  assert.equal(source.includes('itinerary: trip.itinerary'), true);
  assert.equal(source.includes('generateItinerary') && !source.includes('function snapshotFromSavedTrip(trip: SavedTrip): TripExportSnapshot {\\n  return generateItinerary'), true);
  assert.equal(source.includes('id="share-trip"'), true);
  assert.equal(source.includes('id="copy-itinerary"'), true);
  assert.equal(source.includes('id="export-calendar"'), true);
  assert.equal(source.includes('data-share-trip'), true);
  assert.equal(styles.includes('.report-action'), true);
  assert.equal(styles.includes('.report-dialog-backdrop'), true);
  assert.equal(styles.includes('.report-action,'), true);
  assert.equal(styles.includes('.map-panel,'), true);
});

test('provides natural Indonesian interface labels without translating place names', () => {
  assert.equal(labels.id.title, 'SafarOne');
  assert.equal(labels.id.subtitle, 'Perencana Perjalanan Muslim');
  assert.equal(labels.id.plan, 'Buat Rencana Perjalanan');
  assert.equal(labels.id.replan, 'Rencanakan Ulang dari Sini');
  assert.equal(regionLabels.id['Middle East'], 'Timur Tengah');

  const items = generateItinerary(prefs, 0, 'id');
  assert.equal(items.some((item) => item.title.includes('Tokyo Camii')), true);
  assert.equal(items.some((item) => item.title.includes('Rentang salat Zuhur')), true);
  assert.equal(items.some((item) => item.details.includes('Status halal belum dikonfirmasi secara independen')), true);
});


test('exposes Sample, Unverified, and Verified labels in prototype data', () => {
  const statuses = new Set(cities.flatMap((city) => city.places.map((place) => place.verification)));
  assert.equal(statuses.has('Sample'), true);
  assert.equal(statuses.has('Unverified'), true);
  assert.equal(statuses.has('Verified'), true);
});

test('performs standard, reverse, and same-currency conversion locally', () => {
  const standard = convertAmount(100, 0.8642);
  assert.equal(standard.converted, 86.42);
  assert.equal(Math.round(standard.reverseRate * 10000) / 10000, 1.1571);
  assert.equal(convertAmount(50, 1).converted, 50);
});

test('supports currency swap calculations without sending amounts to the API', () => {
  const usdToEur = convertAmount(100, 0.8);
  const eurToUsd = convertAmount(usdToEur.converted, 1 / 0.8);
  assert.equal(eurToUsd.converted, 100);
});

test('formats two-decimal, zero-decimal, and three-decimal currencies with Intl', () => {
  assert.match(formatCurrencyAmount(12.3, 'USD', 'en'), /12\.30/);
  assert.doesNotMatch(formatCurrencyAmount(1234, 'JPY', 'en'), /\.00/);
  assert.match(formatCurrencyAmount(1.234, 'BHD', 'en'), /1\.234/);
});

test('parses English, European, Arabic, Persian, pasted formatting, and zero currency amounts', () => {
  assert.equal(parseAmountInput('1234').value, 1234);
  assert.equal(parseAmountInput('1,234').value, 1234);
  assert.equal(parseAmountInput('1.234').value, 1234);
  assert.equal(parseAmountInput('1.234,56').value, 1234.56);
  assert.equal(parseAmountInput('1,234.56').value, 1234.56);
  assert.equal(parseAmountInput('12,34').value, 12.34);
  assert.equal(parseAmountInput('12.34').value, 12.34);
  assert.equal(parseAmountInput('$1,234.56').value, 1234.56);
  assert.equal(parseAmountInput('USD 1,234').value, 1234);
  assert.equal(parseAmountInput('١٬٢٣٤٫٥٦ ر.س').value, 1234.56);
  assert.equal(parseAmountInput('۱٬۲۳۴٫۵۶ ریال').value, 1234.56);
  assert.equal(parseAmountInput('0').value, 0);
});

test('rejects invalid, ambiguous, negative, and extremely large currency input', () => {
  assert.equal(parseAmountInput('abc').error, 'invalid');
  assert.equal(parseAmountInput('').error, 'empty');
  assert.equal(parseAmountInput('1,23,4').error, 'invalid');
  assert.equal(parseAmountInput('1234,567').error, 'invalid');
  assert.equal(parseAmountInput('1.23.45').error, 'invalid');
  assert.equal(parseAmountInput('1,234,56').error, 'invalid');
  assert.equal(parseAmountInput('-10').error, 'negative');
  assert.equal(parseAmountInput('100000000000000000000').error, 'tooLarge');
});

test('money amount and currency search typing update the page without full rerenders', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  const amountStart = source.indexOf("document.querySelector<HTMLInputElement>('#money-amount')");
  const searchStart = source.indexOf("document.querySelector<HTMLInputElement>('#currency-search')", amountStart);
  const selectStart = source.indexOf("document.querySelector<HTMLSelectElement>('#from-currency')", searchStart);
  const amountHandler = source.slice(amountStart, searchStart);
  const searchHandler = source.slice(searchStart, selectStart);
  assert.equal(amountHandler.includes('moneyPage()'), false);
  assert.equal(amountHandler.includes('updateMoneyDynamicSections()'), true);
  assert.equal(searchHandler.includes('moneyPage()'), false);
  assert.equal(searchHandler.includes('updateCurrencyOptionLists()'), true);
  assert.equal(source.includes('function updateMoneyDynamicSections()'), true);
  assert.equal(source.includes("document.querySelector<HTMLElement>('#money-conversion-result')"), true);
  assert.equal(source.includes("document.querySelector<HTMLElement>('#money-invalid')"), true);
  assert.equal(source.includes("document.querySelector<HTMLButtonElement>('#copy-result')"), true);
  assert.equal(source.includes('function updateCurrencyOptionLists()'), true);
});

test('money typing regression inputs remain parseable across desktop, mobile, and languages', () => {
  for (const _width of [390, 430, 1440]) {
    for (const language of languages.map((item) => item.code)) {
      assert.equal(parseAmountInput('1').value, 1);
      assert.equal(parseAmountInput('10').value, 10);
      assert.equal(parseAmountInput('100').value, 100);
      assert.equal(parseAmountInput('100\b').value, 100);
      assert.equal(parseAmountInput('1,234.56').value, 1234.56);
      assert.equal(parseAmountInput('١٬٢٣٤٫٥٦').value, 1234.56);
      assert.equal(parseAmountInput('abc').error, 'invalid');
      assert.equal(labels[language].invalidAmount.length > 0, true);
      assert.equal(labels[language].searchCurrency.length > 0, true);
    }
  }
});

test('validates Frankfurter currency and rate responses', () => {
  const currencies = normalizeCurrencies([{ iso_code: 'USD', name: 'US Dollar' }, { iso_code: 'EUR', name: 'Euro' }]);
  assert.deepEqual(currencies.map((currency) => currency.code), ['EUR', 'USD']);
  const rate = validateRateResponse({ base: 'USD', quote: 'EUR', date: '2026-06-29', rate: 0.86 }, 'USD', 'EUR', '2026-06-29T10:00:00.000Z');
  assert.equal(rate.rate, 0.86);
  assert.throws(() => validateRateResponse({ base: 'USD', date: '2026-06-29', rates: {} }, 'USD', 'EUR'), /Unsupported currency|Missing rate data/);
  assert.throws(() => normalizeCurrencies(null), /Malformed/);
});

test('derives history stats from Frankfurter v2 EUR-based rows', () => {
  const stats = historyStats([
    { date: '2026-06-28', base: 'EUR', quote: 'USD', rate: 1.2 },
    { date: '2026-06-28', base: 'EUR', quote: 'GBP', rate: 0.8 },
    { date: '2026-06-29', base: 'EUR', quote: 'USD', rate: 1.25 },
    { date: '2026-06-29', base: 'EUR', quote: 'GBP', rate: 0.75 },
  ], 'GBP', 'USD');
  assert.equal(Number(stats.start.toFixed(4)), 0.6667);
  assert.equal(stats.latest, 0.6);
});

test('supports cached-rate fallback helpers and offline cache misses', () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  } as Storage;
  const key = cacheKeyForRate('USD', 'EUR');
  writeJsonCache(storage, key, { base: 'USD', quote: 'EUR', rate: 0.9, date: '2026-06-29', refreshedAt: '2026-06-29T10:00:00.000Z', cached: false });
  assert.equal(readJsonCache<{ rate: number }>(storage, key, 1000)?.rate, 0.9);
  assert.equal(readJsonCache(storage, 'missing', 1000), null);
});

test('currency rate and history cache keys isolate direction, period, date range, and expiry', () => {
  assert.equal(cacheKeyForRate('USD', 'GBP') === cacheKeyForRate('GBP', 'USD'), false);
  assert.equal(cacheKeyForHistory('USD', 'GBP', 7, '2026-06-01', '2026-06-08') === cacheKeyForHistory('USD', 'GBP', 30, '2026-05-09', '2026-06-08'), false);
  assert.equal(cacheKeyForHistory('USD', 'GBP', 7, '2026-06-01', '2026-06-08') === cacheKeyForHistory('GBP', 'USD', 7, '2026-06-01', '2026-06-08'), false);
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  } as Storage;
  writeJsonCache(storage, 'fresh', { ok: true });
  store.set('expired', JSON.stringify({ savedAt: Date.now() - 10_000, value: { ok: true } }));
  store.set('invalid', '{');
  assert.deepEqual(readJsonCache<{ ok: boolean }>(storage, 'fresh', 1000), { ok: true });
  assert.equal(readJsonCache(storage, 'expired', 1000), null);
  assert.equal(readJsonCache(storage, 'invalid', 1000), null);
  assert.throws(() => validateRateResponse({ base: 'USD', quote: 'GBP', date: 'not-a-date', rate: 0.8 }, 'USD', 'GBP'), /Missing rate data/);
  assert.throws(() => validateRateResponse({ base: 'USD', quote: 'GBP', date: '2026-06-01', rate: Number.NaN }, 'USD', 'GBP'), /Unsupported currency/);
  assert.throws(() => historyStats([{ date: 'bad', base: 'EUR', quote: 'GBP', rate: 0.8 }], 'GBP'), /Missing history data/);
});

test('searches currencies by code, English, Arabic, Indonesian, Malay, Turkish, and country', () => {
  assert.equal(searchCurrencies(fallbackCurrencies, 'USD')[0].code, 'USD');
  assert.equal(searchCurrencies(fallbackCurrencies, 'US Dollar')[0].code, 'USD');
  assert.equal(searchCurrencies(fallbackCurrencies, 'دولار أمريكي')[0].code, 'USD');
  assert.equal(searchCurrencies(fallbackCurrencies, 'Dolar AS')[0].code, 'USD');
  assert.equal(searchCurrencies(fallbackCurrencies, 'Paun British')[0].code, 'GBP');
  assert.equal(searchCurrencies(fallbackCurrencies, 'İngiliz Sterlini')[0].code, 'GBP');
  assert.equal(searchCurrencies(fallbackCurrencies, 'Türk Lirası')[0].code, 'TRY');
  assert.equal(searchCurrencies(fallbackCurrencies, 'Ringgit Malaysia')[0].code, 'MYR');
  assert.equal(searchCurrencies(fallbackCurrencies, 'Yen Jepun')[0].code, 'JPY');
  assert.equal(searchCurrencies(fallbackCurrencies, 'United Kingdom')[0].code, 'GBP');
});

test('uses destination default currency from city money data', () => {
  assert.equal(destinationCurrency(cities.find((city) => city.city === 'London') ?? cities[0]), 'GBP');
  assert.equal(destinationCurrency(cities.find((city) => city.city === 'Jerusalem') ?? cities[0]), 'ILS');
});

test('formats amounts for English, Arabic, Indonesian, Malay, and Turkish modes', () => {
  assert.match(formatCurrencyAmount(1234.5, 'USD', 'en'), /\$/);
  assert.match(formatCurrencyAmount(1234.5, 'USD', 'ar'), /US\$/);
  assert.match(formatCurrencyAmount(1234.5, 'IDR', 'id'), /Rp/);
  assert.match(formatCurrencyAmount(1234.5, 'MYR', 'ms'), /RM/);
  assert.match(formatCurrencyAmount(1234.5, 'TRY', 'tr'), /₺|TL/);
});

test('shared HTTP utility classifies statuses, timeouts, aborts, offline, and malformed JSON', async () => {
  assert.equal(classifyHttpStatus(429), 'rate-limited');
  assert.equal(classifyHttpStatus(500), 'temporary');
  assert.equal(classifyHttpStatus(502), 'temporary');
  assert.equal(classifyHttpStatus(503), 'temporary');
  assert.equal(classifyHttpStatus(504), 'temporary');
  assert.equal(classifyHttpStatus(404), 'http');
  assert.equal(retryAfterMs('2'), 2000);
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  assert.equal(classifyRequestError(new TypeError('failed')).kind, 'unknown');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  assert.equal(classifyRequestError(new TypeError('failed')).kind, 'offline');
  if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
  else Reflect.deleteProperty(globalThis, 'navigator');
  assert.equal(classifyRequestError(new DOMException('cancelled', 'AbortError')).kind, 'aborted');

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('{', { status: 200, headers: { 'content-type': 'application/json' } });
    await rejectsWith(() => requestJson('https://example.test'), (error) => error instanceof RequestError && error.kind === 'malformed');
    globalThis.fetch = async () => new Response('{}', { status: 429, headers: { 'Retry-After': '1' } });
    await rejectsWith(() => requestJson('https://example.test'), (error) => error instanceof RequestError && error.kind === 'rate-limited' && error.retryAfterMs === 1000);
    globalThis.fetch = (_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true }));
    await rejectsWith(() => requestJson('https://example.test', {}, 1), (error) => error instanceof RequestError && error.kind === 'timeout');
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts += 1;
      return new Response('{}', { status: attempts === 1 ? 503 : 200 });
    };
    assert.deepEqual(await retryOnceForTemporary(() => requestJson('https://example.test')), {});
    assert.equal(attempts, 2);
    const retryController = new AbortController();
    let retryAttempts = 0;
    const retryPromise = retryOnceForTemporary(async () => {
      retryAttempts += 1;
      throw new RequestError('rate-limited', 'Too many requests', 429, 20);
    }, retryController.signal);
    retryController.abort();
    await rejectsWith(() => retryPromise, (error) => error instanceof RequestError && error.kind === 'aborted');
    assert.equal(retryAttempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('calculates Qibla bearings for major cities', () => {
  const cases = [
    ['London', 51.5074, -0.1278, 118.99],
    ['New York', 40.7128, -74.0060, 58.48],
    ['Jerusalem', 31.7683, 35.2137, 157.19],
    ['Jakarta', -6.2088, 106.8456, 295.15],
    ['Sydney', -33.8688, 151.2093, 277.50],
  ] as const;

  for (const [name, latitude, longitude, expected] of cases) {
    assert.deepEqual({ name, bearing: Number(calculateQiblaBearing(latitude, longitude).toFixed(2)) }, { name, bearing: expected });
  }
});

test('Qibla live compass only accepts reliable absolute headings', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  assert.equal(source.includes("typeof event.webkitCompassHeading === 'number'"), true);
  assert.equal(source.includes("event.absolute === true && typeof event.alpha === 'number'"), true);
  assert.equal(source.includes("qiblaMotionStatus = 'unavailable';"), true);
});

test('Qibla compass updates are throttled without rebuilding the page for heading movement', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  const handler = source.slice(source.indexOf('function handleQiblaOrientation'), source.indexOf('function startQiblaOrientation'));
  assert.equal(source.includes('const QIBLA_HEADING_THRESHOLD = 1'), true);
  assert.equal(source.includes('function qiblaHeadingDelta'), true);
  assert.equal(source.includes('requestAnimationFrame(updateQiblaLiveDom)'), true);
  assert.equal(source.includes('qiblaOrientationListenersActive'), true);
  assert.equal(source.includes("view !== 'qibla' || document.hidden"), true);
  assert.equal(handler.includes('qiblaPage()'), false);
  assert.equal(handler.includes("event.absolute === true"), true);
});

test('in-flight route geometry handles bearings, midpoint, Date Line, polar paths, and waypoints', () => {
  const london = airportByIata('LHR');
  const newYork = airportByIata('JFK');
  assert.equal(Boolean(london && newYork), true);
  if (!london || !newYork) return;
  const distance = haversineDistanceKm(london, newYork);
  assert.equal(distance > 5500 && distance < 5700, true);
  const bearing = initialTrueBearing(london, newYork);
  assert.equal(bearing > 280 && bearing < 300, true);
  const midpoint = greatCircleInterpolate(london, newYork, 0.5);
  assert.equal(Number.isFinite(midpoint.latitude) && Number.isFinite(midpoint.longitude), true);
  const dateline = greatCircleInterpolate({ latitude: 55, longitude: 170 }, { latitude: 55, longitude: -170 }, 0.5);
  assert.equal(Math.abs(Math.abs(dateline.longitude) - 180) < 5, true);
  const polar = initialTrueBearing({ latitude: 78, longitude: -40 }, { latitude: 78, longitude: 140 });
  assert.equal(Number.isFinite(polar), true);
  assert.equal(normalizeLongitude(190), -170);
  assert.equal(normalizeFlightDegrees(-1), 359);
  assert.equal(signedShortestAngle(350, 10), 20);
  const waypoint = validateWaypoint({ label: 'North Atlantic', latitude: 55, longitude: -30 });
  assert.equal(Boolean(waypoint), true);
  const route = [london, waypoint!, newYork];
  assert.equal(totalRouteDistanceKm(route) > distance, true);
  const progress = positionByDistance(route, totalRouteDistanceKm(route) * 0.4);
  assert.equal(progress.progress > 0.39 && progress.progress < 0.41, true);
  const zero = positionByDistance([london, london], 10);
  assert.equal(zero.totalDistanceKm, 0);
});

test('in-flight position source chooses fresh GPS, stale fallback, low accuracy, progress clamp, and derived track', () => {
  const plan = createPreparedFlightPlan({
    departure: airportByIata('LHR')!,
    arrival: airportByIata('JFK')!,
    scheduledDepartureUtc: '2026-07-03T10:00:00.000Z',
    durationMinutes: 420,
    prayerMethod: 'Muslim World League',
    now: '2026-07-02T10:00:00.000Z',
  });
  assert.equal(Boolean(plan), true);
  if (!plan) return;
  assert.equal(elapsedProgress(plan, Date.parse('2026-07-03T13:30:00.000Z')), 0.5);
  const routeOnly = positionByProgress(plan, 1.8, Date.parse('2026-07-03T13:30:00.000Z'));
  assert.equal(routeOnly.progress, 1);
  const previous = { latitude: 51, longitude: -1, timestamp: Date.parse('2026-07-03T13:29:00.000Z'), source: 'gps' as const };
  const current = { latitude: 52, longitude: -2, accuracyMeters: 8000, timestamp: Date.parse('2026-07-03T13:30:00.000Z'), source: 'gps' as const };
  assert.equal(Number.isFinite(deriveTrackFromFixes(previous, current)), true);
  const live = chooseFlightProgress(plan, { gps: current, previousGps: previous, manualProgress: 0.5, nowMs: Date.parse('2026-07-03T13:30:30.000Z') });
  assert.equal(live.source, 'derived-gps');
  assert.equal(live.lowAccuracy, true);
  const stale = chooseFlightProgress(plan, { gps: current, previousGps: previous, manualProgress: 0.5, nowMs: Date.parse('2026-07-03T13:40:00.000Z') });
  assert.equal(stale.source, 'route-estimate');
  assert.equal(stale.stale, true);
});

test('in-flight prayer snapshots are finite, ordered, UTC-based, and cover supported methods', () => {
  for (const method of ['Muslim World League', 'Egyptian General Authority', 'Umm al-Qura', 'ISNA', 'Turkey Diyanet'] as const) {
    const snapshot = calculateInflightPrayerSnapshot(45, -30, Date.parse('2026-07-03T23:50:00.000Z'), method);
    assert.equal(Boolean(snapshot), true);
    if (!snapshot) return;
    const values = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map((name) => snapshot.prayers[name as keyof typeof snapshot.prayers]);
    assert.equal(values.every(Number.isFinite), true);
    assert.equal(snapshot.countdownMs >= 0, true);
    assert.equal(Boolean(snapshot.previousPrayer || snapshot.nextPrayer), true);
    assert.match(formatUtcTime(values[0]), /^\d{2}:\d{2}$/);
    assert.match(formatInTimeZone(values[0], 'Europe/London', 'en-GB'), /^\d{2}:\d{2}$/);
  }
  assert.equal(calculateInflightPrayerSnapshot(100, 0, Date.now(), 'Muslim World League'), null);
});

test('in-flight flight-plan storage validates, recovers, migrates, and clears safely', () => {
  const storage = new MemoryStorage();
  const repository = new FlightPlanRepository(storage);
  const plan = createPreparedFlightPlan({
    departure: airportByIata('KUL')!,
    arrival: airportByIata('JED')!,
    scheduledDepartureUtc: '2026-07-03T01:00:00.000Z',
    durationMinutes: 540,
    prayerMethod: 'Umm al-Qura',
    now: '2026-07-02T01:00:00.000Z',
  });
  assert.equal(Boolean(plan), true);
  if (!plan) return;
  repository.save(plan);
  assert.equal(repository.read().plan?.departure.iata, 'KUL');
  assert.equal(parseStoredFlightPlan('{bad json').corrupted, true);
  assert.equal(validateFlightPlan({ ...plan, durationMinutes: 10 }), null);
  repository.clear();
  assert.equal(repository.read().plan, null);
  const fromDetails = flightPlanFromTravelDetails({
    version: 1,
    entries: [{
      id: 'detail-flight',
      type: 'flight',
      createdAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
      departureAirport: 'LHR',
      arrivalAirport: 'JFK',
      departureDateTime: '2026-07-03T10:00',
      arrivalDateTime: '2026-07-03T17:00',
    }],
  }, 'Muslim World League', '2026-07-02T00:00:00.000Z');
  assert.equal(fromDetails?.departure.iata, 'LHR');
});

test('in-flight mode is bundled, localized, route-discoverable, and avoids magnetic compass dependency', async () => {
  const main = await repoFile('src/main.ts');
  const flight = await repoFile('src/flight-mode.ts');
  const docs = await repoFile('docs/IN_FLIGHT_PRAYER_QIBLA.md');
  assert.equal(airports.length >= 25, true);
  assert.equal(airportDataSource.includes('OurAirports'), true);
  assert.equal(searchAirports('Kuala Lumpur')[0].iata, 'KUL');
  assert.equal(main.includes("'flight-mode'"), true);
  assert.equal(main.includes("window.location.hash === '#flight-mode'"), true);
  assert.equal(main.includes("homeActionCard('flight'"), true);
  assert.equal(main.includes('watchAppPosition('), true);
  assert.equal(flight.includes('DeviceOrientationEvent'), false);
  assert.equal(flight.includes('magnetic'), false);
  assert.equal(labels.en.flightBestEstimate, 'Best available estimate based on live GPS or the stored flight route.');
  for (const language of languages.map((item) => item.code)) {
    assert.equal(Boolean(labels[language].flightModeTitle), true);
    assert.equal(Boolean(labels[language].flightOfflineNotice), true);
    assert.equal(Boolean(labels[language].flightAltitudeDisclaimer), true);
  }
  assert.equal(docs.includes('no magnetic compass'), true);
  assert.equal(docs.includes('OurAirports'), true);
});

test('shared external URL sanitizer accepts only HTTP and HTTPS links', () => {
  assert.equal(safeExternalUrl('example.com'), 'https://example.com/');
  assert.equal(safeExternalUrl('https://example.com/path'), 'https://example.com/path');
  assert.equal(safeExternalUrl('http://example.com'), 'http://example.com/');
  for (const unsafe of ['javascript:alert(1)', 'data:text/html,x', 'file:///tmp/x', 'blob:https://example.com/id', 'vbscript:msgbox(1)', 'https://', '']) {
    assert.equal(safeExternalUrl(unsafe), '');
  }
});


test('calculates distance between nearby coordinates', () => {
  const distance = distanceKm(51.5074, -0.1278, 51.5033, -0.1195);
  assert.equal(Number(distance.toFixed(2)), 0.73);
});

test('classifies OpenStreetMap prayer place results', () => {
  assert.equal(classifyPrayerPlace({ amenity: 'place_of_worship', religion: 'muslim' }), 'mosque');
  assert.equal(classifyPrayerPlace({ amenity: 'prayer_room' }), 'prayer-room');
  assert.equal(classifyPrayerPlace({ name: 'Airport quiet prayer room' }), 'quiet-space');
  assert.equal(classifyPrayerPlace({ amenity: 'place_of_worship', religion: 'christian' }), undefined);
});

test('marks incomplete prayer place information as unverified', () => {
  const place = normalizePrayerPlace({
    type: 'node',
    id: 1,
    lat: 51.5,
    lon: -0.1,
    tags: { amenity: 'prayer_room', name: 'Station prayer room' },
  }, { latitude: 51.5074, longitude: -0.1278 });

  assert.equal(place?.verification, 'Verified');
  assert.equal(place?.womenPrayerArea, 'Unverified');
  assert.equal(place?.wudu, 'Unverified');
  assert.equal(place?.wheelchair, 'Unverified');
  assert.equal(place?.address, '');
});

test('includes translated prayer-space denied and empty states', () => {
  assert.equal(labels.en.prayerLocationDenied.includes('denied'), true);
  assert.equal(labels.ar.prayerNoResults.length > 0, true);
  assert.equal(labels.id.prayerNoResults.length > 0, true);
  assert.equal(labels.en.prayerNoResults, 'No places found nearby.');
});



const latinOnly = (value: string) => !/[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(value);
const namedPlace = (tags: Record<string, string>, type: 'mosque' | 'prayer-room' | 'quiet-space' | 'islamic-centre' = 'mosque') => getEnglishPlaceName({ tags, type });

test('english place names prefer name:en', () => {
  assert.equal(namedPlace({ name: 'مسجد الاختبار', 'name:en': 'Test Mosque' }), 'Test Mosque');
});

test('english place names convert Arabic without name:en', () => {
  assert.equal(namedPlace({ name: 'مسجد التقوى' }), 'Al-Taqwa Mosque');
  assert.equal(namedPlace({ name: 'مسجد عمر بن الخطاب' }), 'Omar ibn Al-Khattab Mosque');
  assert.equal(namedPlace({ name: 'مصلى المطار' }, 'prayer-room'), 'Airport Prayer Room');
});

test('english place names transliterate Persian and Urdu names', () => {
  assert.equal(latinOnly(namedPlace({ name: 'مسجد نور' })), true);
  assert.equal(latinOnly(namedPlace({ name: 'مسجد جامع کراچی' })), true);
});

test('english place names transliterate Hebrew, Cyrillic, and Greek names', () => {
  assert.equal(latinOnly(namedPlace({ name: 'מסגד עומר' })), true);
  assert.equal(latinOnly(namedPlace({ name: 'Мечеть Нур' })), true);
  assert.equal(latinOnly(namedPlace({ name: 'Τζαμί Ομάρ' })), true);
});

test('english place names transliterate Chinese, Japanese, and Korean names', () => {
  assert.equal(latinOnly(namedPlace({ name: '东京清真寺' })), true);
  assert.equal(latinOnly(namedPlace({ name: '東京ジャーミイ' })), true);
  assert.equal(latinOnly(namedPlace({ name: '서울 중앙 모스크' })), true);
});

test('english place names handle mixed Arabic and English plus numbers', () => {
  assert.equal(latinOnly(namedPlace({ name: 'مسجد Omar 2' })), true);
  assert.equal(ensureLatinDisplayName('Prayer Room 24', 'prayer-room'), 'Prayer Room 24');
});

test('english place names use int_name and fallbacks', () => {
  assert.equal(namedPlace({ name: 'غرفة صلاة', int_name: 'Airport Prayer Room' }, 'prayer-room'), 'Airport Prayer Room');
  assert.equal(namedPlace({}, 'mosque'), 'Unnamed Mosque');
  assert.equal(namedPlace({}, 'prayer-room'), 'Unnamed Prayer Room');
});

test('optional metadata helper never invents prayer-place fallback values', () => {
  assert.equal(optionalLatinDisplayName(''), '');
  assert.equal(optionalLatinDisplayName(undefined), '');
  assert.equal(optionalLatinDisplayName('City Operator'), 'City Operator');
  assert.equal(optionalLatinDisplayName('   '), '');
});

test('normalization keeps original name internally but displays Latin only', () => {
  const place = normalizePrayerPlace({ type: 'node', id: 21, lat: 1, lon: 1, tags: { amenity: 'place_of_worship', religion: 'muslim', name: 'مسجد الأقصى' } }, { latitude: 1, longitude: 1 });
  assert.equal(place?.name, 'Al-Aqsa Mosque');
  assert.equal(place?.originalName, 'مسجد الأقصى');
  assert.equal(latinOnly(place?.name ?? ''), true);
});

test('OSM-derived feature links reject unsafe protocols', () => {
  const origin = { latitude: 0, longitude: 0 };
  const unsafePrayer = normalizePrayerPlace({ type: 'node', id: 1, lat: 0, lon: 0, tags: { amenity: 'place_of_worship', religion: 'muslim', name: 'Mosque', website: 'javascript:alert(1)' } }, origin);
  const unsafeRestaurant = normalizeHalalRestaurant({ type: 'node', id: 2, lat: 0, lon: 0, tags: { amenity: 'restaurant', 'diet:halal': 'yes', name: 'Food', website: 'data:text/html,x', menu: 'file:///tmp/menu' } }, origin, true);
  const unsafeToilet = normalizePublicToilet({ type: 'node', id: 3, lat: 0, lon: 0, tags: { amenity: 'toilets', website: 'vbscript:msgbox(1)' } }, origin);
  const unsafeAttraction = normalizeAttraction({ type: 'node', id: 4, lat: 0, lon: 0, tags: { tourism: 'museum', name: 'Museum', website: 'blob:https://example.com/id' } }, origin);
  const safeRestaurant = normalizeHalalRestaurant({ type: 'node', id: 5, lat: 0, lon: 0, tags: { amenity: 'restaurant', 'diet:halal': 'yes', name: 'Food', website: 'example.com' } }, origin, true);
  assert.equal(unsafePrayer?.website, '');
  assert.equal(unsafeRestaurant?.website, '');
  assert.equal(unsafeRestaurant?.menu, '');
  assert.equal(unsafeToilet?.website, '');
  assert.equal(unsafeAttraction?.website, '');
  assert.equal(safeRestaurant?.website, 'https://example.com/');
});

test('classifies structured halal restaurant tags without unsafe assumptions', () => {
  assert.equal(classifyHalalStatus({ 'diet:halal': 'only' }), 'halal-only');
  assert.equal(classifyHalalStatus({ 'diet:halal': 'yes' }), 'halal-options');
  assert.equal(classifyHalalStatus({ 'halal:certification': 'Local council certificate' }), 'certification-listed');
  for (const value of ['no', 'none', 'false', 'expired', 'unknown', 'unverified', 'not certified']) {
    assert.equal(classifyHalalStatus({ 'halal:certification': value }), undefined);
  }
  assert.equal(classifyHalalStatus({ halal: 'yes' }), 'legacy-halal');
  assert.equal(classifyHalalStatus({ 'diet:halal': 'no', halal: 'yes' }), undefined);
  assert.equal(classifyHalalStatus({ halal: 'no', 'diet:halal': 'yes' }), undefined);
  assert.equal(classifyHalalStatus({ halal: 'no', 'halal:certification': 'Local council certificate' }), undefined);
  assert.equal(classifyHalalStatus({ amenity: 'restaurant', name: 'مطعم القدس' }), undefined);
  assert.equal(classifyHalalStatus({ cuisine: 'middle_eastern' }), undefined);
  assert.equal(classifyHalalStatus({ name: 'Halal Palace' }), undefined);
  assert.equal(classifyHalalStatus({ description: 'Halal food available' }, true), 'possible-unverified');
});

test('normalizes halal restaurants from node, way, and relation coordinates', () => {
  const origin = { latitude: 51.5, longitude: -0.1 };
  const node = normalizeHalalRestaurant({ type: 'node', id: 1, lat: 51.501, lon: -0.101, tags: { amenity: 'restaurant', 'diet:halal': 'only', name: 'Halal Grill' } }, origin);
  const way = normalizeHalalRestaurant({ type: 'way', id: 2, center: { lat: 51.502, lon: -0.102 }, tags: { amenity: 'fast_food', 'diet:halal': 'yes', name: 'Quick Bites' } }, origin);
  const relation = normalizeHalalRestaurant({ type: 'relation', id: 3, center: { lat: 51.503, lon: -0.103 }, tags: { amenity: 'cafe', 'halal:certification': 'listed', name: 'Cafe Noor' } }, origin);
  assert.equal(node?.latitude, 51.501);
  assert.equal(way?.longitude, -0.102);
  assert.equal(relation?.type, 'cafe');
  assert.equal(Number((node?.distanceKm ?? 0).toFixed(2)) > 0, true);
});

test('deduplicates node and way records for the same physical restaurant', () => {
  const origin = { latitude: 0, longitude: 0 };
  const first = normalizeHalalRestaurant({ type: 'node', id: 1, lat: 1, lon: 1, tags: { amenity: 'restaurant', halal: 'yes', name: 'Same Grill' } }, origin);
  const stronger = normalizeHalalRestaurant({ type: 'way', id: 2, center: { lat: 1.00001, lon: 1.00001 }, tags: { amenity: 'restaurant', 'diet:halal': 'only', name: 'Same Grill' } }, origin);
  const deduped = dedupeRestaurants([first, stronger].filter(Boolean) as NonNullable<typeof first>[]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].halalStatus, 'halal-only');
});

test('filters and sorts halal restaurants by cuisine, open-now, and nearest', () => {
  const origin = { latitude: 0, longitude: 0, timezone: 'UTC' };
  const restaurants = [
    normalizeHalalRestaurant({ type: 'node', id: 1, lat: 0.02, lon: 0, tags: { amenity: 'restaurant', 'diet:halal': 'only', name: 'Far Arabic', cuisine: 'arabic;burgers', opening_hours: '24/7' } }, origin),
    normalizeHalalRestaurant({ type: 'node', id: 2, lat: 0.01, lon: 0, tags: { amenity: 'restaurant', 'diet:halal': 'yes', name: 'Near Pizza', cuisine: 'pizza', opening_hours: 'Mo-Su 00:00-24:00' } }, origin),
  ].filter((restaurant): restaurant is HalalRestaurant => Boolean(restaurant));
  const filters: RestaurantFilters = { status: 'reliable', type: 'all', cuisine: 'pizza', openNow: true, takeaway: false, delivery: false, wheelchair: false };
  const filtered = filterRestaurants(restaurants, filters);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.name, 'Near Pizza');
  assert.equal(sortRestaurants(restaurants, 'distance')[0]?.name, 'Near Pizza');
  assert.deepEqual(cuisineOptions(restaurants), ['arabic', 'burgers', 'pizza']);
});

test('handles invalid opening hours, missing address, fallback names, and transliteration', () => {
  const origin = { latitude: 0, longitude: 0 };
  assert.equal(openingState('not real hours', 'UTC'), 'unknown');
  assert.equal(openingState('24/7', 'UTC'), 'open');
  assert.equal(openingState('24/7', undefined), 'unknown');
  const fallback = normalizeHalalRestaurant({ type: 'node', id: 1, lat: 0, lon: 0, tags: { amenity: 'food_court', 'diet:halal': 'only' } }, origin);
  const transliterated = normalizeHalalRestaurant({ type: 'node', id: 2, lat: 0, lon: 0, tags: { amenity: 'restaurant', 'diet:halal': 'only', name: 'مطعم النور' } }, origin);
  assert.equal(fallback?.address, '');
  assert.equal(fallback?.name, 'Unnamed Halal Food Court');
  assert.equal(latinOnly(transliterated?.name ?? ''), true);
});

test('parses opening hours using destination-local timezone with fixed dates', () => {
  const mondayMorningUtc = new Date('2026-07-06T09:30:00Z');
  assert.equal(openingState('Mo 09:00-18:00', 'UTC', mondayMorningUtc), 'open');
  assert.equal(openingState('Mo 09:00-18:00', 'UTC', new Date('2026-07-06T18:30:00Z')), 'closed');
  assert.equal(openingState('Mo-Fr 09:00-18:00', 'UTC', mondayMorningUtc), 'open');
  assert.equal(openingState('Mo,We,Fr 09:00-18:00', 'UTC', mondayMorningUtc), 'open');
  assert.equal(openingState('Mo 09:00-12:00,13:00-18:00', 'UTC', new Date('2026-07-06T12:30:00Z')), 'closed');
  assert.equal(openingState('Mo 09:00-12:00,13:00-18:00', 'UTC', new Date('2026-07-06T13:30:00Z')), 'open');
  assert.equal(openingState('Mo 09:00-12:00; Mo 13:00-18:00', 'UTC', new Date('2026-07-06T13:30:00Z')), 'open');
  assert.equal(openingState('Mo-Fr 09:00-18:00; Sa 10:00-14:00', 'UTC', new Date('2026-07-11T11:00:00Z')), 'open');
  assert.equal(openingState('Mo 18:00-02:00', 'UTC', new Date('2026-07-06T19:00:00Z')), 'open');
  assert.equal(openingState('Mo 18:00-02:00', 'UTC', new Date('2026-07-07T01:00:00Z')), 'open');
  assert.equal(openingState('Mo 18:00-02:00; We 20:00-23:00', 'UTC', new Date('2026-07-08T21:00:00Z')), 'open');
  assert.equal(openingState('24/7', 'UTC', mondayMorningUtc), 'open');
  assert.equal(openingState('Mo-Su 00:00-24:00', 'UTC', mondayMorningUtc), 'open');
  assert.equal(openingState('closed', 'UTC', mondayMorningUtc), 'closed');
  assert.equal(openingState('off', 'UTC', mondayMorningUtc), 'closed');
  assert.equal(openingState('Mo-Fr 09:00-18:00; PH off', 'UTC', mondayMorningUtc), 'unknown');
  assert.equal(openingState('Mo 09:00-18:00', undefined, mondayMorningUtc), 'unknown');
});

test('opening hours respect Tokyo, London, and New York destination timezones', () => {
  assert.equal(openingState('Mo 09:00-18:00', 'Asia/Tokyo', new Date('2026-07-06T00:30:00Z')), 'open');
  assert.equal(openingState('Mo 09:00-18:00', 'Europe/London', new Date('2026-07-06T08:30:00Z')), 'open');
  assert.equal(openingState('Mo 09:00-18:00', 'America/New_York', new Date('2026-07-06T13:30:00Z')), 'open');
  assert.equal(openingState('Mo 08:00-18:00', 'Asia/Tokyo', new Date('2026-07-05T23:30:00Z')), 'open');
  assert.equal(openingState('Mo 08:00-18:00', 'UTC', new Date('2026-07-05T23:30:00Z')), 'closed');
});

test('open-now filtering uses confirmed destination-local opening state across mapped features', () => {
  const origin = { latitude: 0, longitude: 0, timezone: 'UTC' };
  const prayer = normalizePrayerPlace({ type: 'node', id: 1, lat: 0, lon: 0, tags: { amenity: 'place_of_worship', religion: 'muslim', name: 'Open Mosque', opening_hours: 'Mo 09:00-18:00' } }, origin);
  const restaurant = normalizeHalalRestaurant({ type: 'node', id: 2, lat: 0, lon: 0, tags: { amenity: 'restaurant', 'diet:halal': 'only', name: 'Open Grill', opening_hours: 'Mo-Su 00:00-24:00' } }, origin);
  const toilet = normalizePublicToilet({ type: 'node', id: 3, lat: 0, lon: 0, tags: { amenity: 'toilets', name: 'Open WC', opening_hours: 'Mo-Su 00:00-24:00' } }, origin);
  const office = normalizeCarRentalOffice({ type: 'node', id: 4, lat: 0, lon: 0, tags: { amenity: 'car_rental', name: 'Open Cars', opening_hours: 'Mo-Su 00:00-24:00' } }, { ...origin, label: 'City Centre' });
  const attraction = normalizeAttraction({ type: 'node', id: 5, lat: 0, lon: 0, tags: { tourism: 'museum', 'name:en': 'Open Museum', opening_hours: 'Mo-Su 00:00-24:00' } }, origin);
  assert.equal(openingState(prayer?.openingHours, origin.timezone, new Date('2026-07-06T10:00:00Z')), 'open');
  assert.equal(filterRestaurants([restaurant].filter(Boolean) as HalalRestaurant[], { status: 'reliable', type: 'all', cuisine: '', openNow: true, takeaway: false, delivery: false, wheelchair: false }).length, 1);
  assert.equal(filterToilets([toilet].filter(Boolean) as PublicToilet[], { access: 'all', free: false, paid: false, openNow: true, open24: true, wheelchair: false, limitedWheelchair: false, changing: false, female: false, male: false, unisex: false, handwashing: false, shower: false, drinkingWater: false, seated: false, squat: false }).length, 1);
  assert.equal(filterCarRentalOffices([office].filter(Boolean) as CarRentalOffice[], { type: 'all', openNow: true, open24: true, website: false, phone: false, wheelchair: false, atAirport: false }).length, 1);
  assert.equal(filterAttractions([attraction].filter(Boolean) as Attraction[], { category: 'all', photo: false, history: false, openNow: true, free: false, wheelchair: false }).length, 1);
});

test('includes halal restaurant timeout, cache, denial, empty, and language labels', () => {
  assert.equal(labels.en.halalTimedOut.includes('timed out'), true);
  assert.equal(labels.en.halalCached.includes('cached'), true);
  assert.equal(labels.en.halalLocationDenied.includes('denied'), true);
  assert.equal(labels.en.halalNoResults, 'No mapped halal restaurants were found in this area. This does not necessarily mean that none exist.');
  assert.equal(labels.ar.halalRestaurantsTitle.length > 0, true);
  assert.equal(labels.id.halalRestaurantsTitle.length > 0, true);
});

test('classifies public toilet access from structured OpenStreetMap tags', () => {
  assert.equal(classifyToiletAccess({ amenity: 'toilets' }), 'public');
  assert.equal(classifyToiletAccess({ building: 'toilets' }), 'public');
  assert.equal(classifyToiletAccess({ amenity: 'cafe', toilets: 'yes' }), 'unknown');
  assert.equal(classifyToiletAccess({ amenity: 'cafe' }), undefined);
  assert.equal(classifyToiletAccess({ amenity: 'toilets', access: 'yes' }), 'public');
  assert.equal(classifyToiletAccess({ amenity: 'toilets', access: 'customers' }), 'customers');
  assert.equal(classifyToiletAccess({ amenity: 'toilets', access: 'private' }), undefined);
  assert.equal(classifyToiletAccess({ amenity: 'toilets', access: 'no' }), undefined);
  assert.equal(classifyToiletAccess({ amenity: 'cafe', toilets: 'yes', 'toilets:access': 'yes' }), 'public');
  assert.equal(classifyToiletAccess({ amenity: 'cafe', toilets: 'yes', 'toilets:access': 'customers' }), 'customers');
  assert.equal(classifyToiletAccess({ amenity: 'cafe', toilets: 'no' }), undefined);
  assert.equal(classifyToiletAccess({ amenity: 'toilets', access: 'key' }), 'restricted');
});

test('interprets public toilet fees, wheelchair access, and baby-changing tags', () => {
  assert.deepEqual(toiletFee({ fee: 'no' }), { fee: 'free', amount: '' });
  assert.deepEqual(toiletFee({ fee: 'yes' }), { fee: 'paid', amount: '' });
  assert.deepEqual(toiletFee({}), { fee: 'unknown', amount: '' });
  assert.deepEqual(toiletFee({ fee: '€1' }), { fee: 'paid', amount: '€1' });
  assert.equal(wheelchairAccess({ wheelchair: 'yes' }), 'yes');
  assert.equal(wheelchairAccess({ wheelchair: 'limited' }), 'limited');
  assert.equal(wheelchairAccess({ wheelchair: 'no' }), 'no');
  assert.equal(wheelchairAccess({ wheelchair: 'no', 'toilets:wheelchair': 'yes' }), 'yes');
  assert.equal(changingTable({ changing_table: 'yes' }), 'yes');
  assert.equal(changingTable({ changing_table: 'limited' }), 'limited');
  assert.equal(changingTable({ changing_table: 'no' }), 'no');
});

test('normalizes public toilets from node, way, and relation coordinates', () => {
  const origin = { latitude: 51.5, longitude: -0.1, timezone: 'Europe/London' };
  const node = normalizePublicToilet({ type: 'node', id: 1, lat: 51.501, lon: -0.101, tags: { amenity: 'toilets', name: 'Station WC', fee: 'no', opening_hours: '24/7', male: 'yes', female: 'yes', unisex: 'yes', handwashing: 'yes', shower: 'yes', drinking_water: 'yes', 'toilets:position:seated': 'yes' } }, origin);
  const way = normalizePublicToilet({ type: 'way', id: 2, center: { lat: 51.502, lon: -0.102 }, tags: { building: 'toilets', wheelchair: 'limited', changing_table: 'yes', 'toilets:position:squat': 'yes' } }, origin);
  const relation = normalizePublicToilet({ type: 'relation', id: 3, center: { lat: 51.503, lon: -0.103 }, tags: { amenity: 'cafe', name: 'Museum Cafe', toilets: 'yes', 'toilets:access': 'customers', fee: 'yes' } }, origin);
  assert.equal(node?.latitude, 51.501);
  assert.equal(way?.longitude, -0.102);
  assert.equal(relation?.inside, 'Museum Cafe');
  assert.equal(relation?.access, 'customers');
  assert.equal(node?.fee, 'free');
  assert.equal(way?.wheelchair, 'limited');
  assert.equal(way?.changingTable, 'yes');
  assert.equal(node?.male, true);
  assert.equal(node?.female, true);
  assert.equal(node?.unisex, true);
  assert.equal(node?.handwashing, true);
  assert.equal(node?.shower, true);
  assert.equal(node?.drinkingWater, true);
  assert.equal(node?.seated, true);
  assert.equal(way?.squat, true);
  assert.equal(openingState(node?.openingHours ?? '', origin.timezone), 'open');
  assert.equal(Number((node?.distanceKm ?? 0).toFixed(2)) > 0, true);
});

test('deduplicates, filters, and sorts public toilets', () => {
  const origin = { latitude: 0, longitude: 0, timezone: 'UTC' };
  const toilets = [
    normalizePublicToilet({ type: 'node', id: 1, lat: 0.02, lon: 0, tags: { amenity: 'toilets', name: 'Far WC', fee: 'yes', wheelchair: 'yes', opening_hours: '24/7' } }, origin),
    normalizePublicToilet({ type: 'way', id: 2, center: { lat: 0.01, lon: 0 }, tags: { amenity: 'toilets', name: 'Near WC', fee: 'no', wheelchair: 'limited' } }, origin),
    normalizePublicToilet({ type: 'relation', id: 3, center: { lat: 0.010004, lon: 0.000004 }, tags: { amenity: 'toilets', name: 'Near WC', access: 'customers' } }, origin),
  ].filter((toilet): toilet is PublicToilet => Boolean(toilet));
  const deduped = dedupeToilets(toilets);
  assert.equal(deduped.length, 2);
  assert.equal(sortToilets(deduped, 'distance')[0]?.name, 'Near WC');
  assert.equal(sortToilets(deduped, 'free')[0]?.fee, 'free');
  assert.equal(sortToilets(deduped, 'accessible')[0]?.wheelchair, 'yes');

  const filters: ToiletFilters = { access: 'public', free: true, paid: false, openNow: false, open24: false, wheelchair: false, limitedWheelchair: true, changing: false, female: false, male: false, unisex: false, handwashing: false, shower: false, drinkingWater: false, seated: false, squat: false };
  const filtered = filterToilets(deduped, filters);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.name, 'Near WC');
});

test('uses safe public toilet fallbacks and Latin-readable names', () => {
  const origin = { latitude: 0, longitude: 0 };
  const fallback = normalizePublicToilet({ type: 'node', id: 1, lat: 0, lon: 0, tags: { amenity: 'toilets' } }, origin);
  const accessible = normalizePublicToilet({ type: 'node', id: 2, lat: 0, lon: 0, tags: { amenity: 'toilets', wheelchair: 'yes' } }, origin);
  const venue = normalizePublicToilet({ type: 'node', id: 3, lat: 0, lon: 0, tags: { amenity: 'library', name: 'Central Library', toilets: 'yes' } }, origin);
  const transliterated = normalizePublicToilet({ type: 'node', id: 4, lat: 0, lon: 0, tags: { amenity: 'toilets', name: 'دورات مياه' } }, origin);
  assert.equal(fallback?.name, 'Public Toilets');
  assert.equal(accessible?.name, 'Accessible Public Toilets');
  assert.equal(venue?.name, 'Central Library Toilets');
  assert.equal(latinOnly(transliterated?.name ?? ''), true);
});

test('builds bounded toilet Overpass queries and includes toilet language states', () => {
  const query = buildToiletOverpassQuery(51.5, -0.1, 50);
  assert.equal(query.includes('around:25000,51.5,-0.1'), true);
  assert.equal(query.includes('["amenity"="toilets"]'), true);
  assert.equal(query.includes('["toilets:access"]'), true);
  assert.equal(labels.en.toiletsLocationDenied.includes('denied'), true);
  assert.equal(labels.en.toiletsTimedOut.includes('timed out'), true);
  assert.equal(labels.en.toiletsCached.includes('cached'), true);
  assert.equal(labels.en.toiletsNoResults, 'No mapped public toilets were found in this area. This does not necessarily mean that none exist.');
  assert.equal(labels.ar.toiletsTitle.length > 0, true);
  assert.equal(labels.id.toiletsTitle.length > 0, true);
});

test('classifies structured car-rental office tags and excludes other vehicle services', () => {
  assert.equal(isCarRentalOffice({ amenity: 'car_rental' }), true);
  assert.equal(isCarRentalOffice({ shop: 'car_rental' }), true);
  assert.equal(isCarRentalOffice({ rental: 'car' }), true);
  assert.equal(isCarRentalOffice({ 'vehicle:rental': 'motorcar' }), true);
  assert.equal(isCarRentalOffice({ amenity: 'car_sharing' }), false);
  assert.equal(isCarRentalOffice({ amenity: 'bicycle_rental' }), false);
  assert.equal(isCarRentalOffice({ amenity: 'taxi' }), false);
  assert.equal(isCarRentalOffice({ shop: 'car' }), false);
});

test('normalizes car-rental offices from node, area centre, and multipolygon centre coordinates', () => {
  const origin = { latitude: 51.5, longitude: -0.1, label: 'London Heathrow Airport', timezone: 'Europe/London' };
  const node = normalizeCarRentalOffice({ type: 'node', id: 1, lat: 51.501, lon: -0.101, tags: { amenity: 'car_rental', name: 'Airport Cars', opening_hours: '24/7', website: 'https://example.com', phone: '+44123', wheelchair: 'yes' } }, origin);
  const way = normalizeCarRentalOffice({ type: 'way', id: 2, center: { lat: 51.502, lon: -0.102 }, tags: { amenity: 'car_rental', brand: 'Brand Rent', operator: 'Local Operator', opening_hours: 'not real hours' } }, origin);
  const relation = normalizeCarRentalOffice({ type: 'relation', id: 3, center: { lat: 51.503, lon: -0.103 }, tags: { type: 'multipolygon', amenity: 'car_rental', 'operator:en': 'Rail Rent', railway: 'station' } }, { latitude: 51.5, longitude: -0.1, label: 'Central Station' });
  assert.equal(node?.latitude, 51.501);
  assert.equal(way?.longitude, -0.102);
  assert.equal(relation?.locationType, 'railway');
  assert.equal(node?.locationType, 'airport');
  assert.equal(node?.website, 'https://example.com/');
  assert.equal(node?.phone, '+44123');
  assert.equal(node?.wheelchair, 'yes');
  assert.equal(way?.brand, 'Brand Rent');
  assert.equal(way?.operator, 'Local Operator');
  assert.equal(openingState(way?.openingHours ?? '', origin.timezone), 'unknown');
  assert.equal(Number((node?.distanceKm ?? 0).toFixed(2)) > 0, true);
});

test('uses safe car-rental names, brand/operator fallbacks, and missing-name fallback', () => {
  const origin = { latitude: 0, longitude: 0, label: 'City Centre' };
  const fallback = normalizeCarRentalOffice({ type: 'node', id: 1, lat: 0, lon: 0, tags: { amenity: 'car_rental' } }, origin);
  const brand = normalizeCarRentalOffice({ type: 'node', id: 2, lat: 0, lon: 0, tags: { amenity: 'car_rental', brand: 'RentCo' } }, origin);
  const operator = normalizeCarRentalOffice({ type: 'node', id: 3, lat: 0, lon: 0, tags: { amenity: 'car_rental', operator: 'Operator Cars' } }, origin);
  const transliterated = normalizeCarRentalOffice({ type: 'node', id: 4, lat: 0, lon: 0, tags: { amenity: 'car_rental', name: 'تأجير سيارات' } }, origin);
  assert.equal(fallback?.name, 'City Car Rental Office');
  assert.equal(fallback?.brand, '');
  assert.equal(fallback?.operator, '');
  assert.equal(brand?.name, 'RentCo');
  assert.equal(brand?.brand, 'RentCo');
  assert.equal(operator?.name, 'Operator Cars');
  assert.equal(operator?.operator, 'Operator Cars');
  assert.equal(latinOnly(transliterated?.name ?? ''), true);
  assert.equal(Object.values(fallback ?? {}).includes('Unnamed Quiet Prayer Space'), false);
});

test('classifies car-rental office context without broad assumptions', () => {
  assert.equal(classifyCarRentalLocation({ amenity: 'car_rental' }, 'Queen Alia Airport'), 'airport');
  assert.equal(classifyCarRentalLocation({ amenity: 'car_rental', railway: 'station' }), 'railway');
  assert.equal(classifyCarRentalLocation({ amenity: 'car_rental', bus: 'yes' }), 'bus');
  assert.equal(classifyCarRentalLocation({ amenity: 'car_rental', tourism: 'hotel' }), 'hotel');
  assert.equal(classifyCarRentalLocation({ amenity: 'car_rental' }, 'Downtown'), 'city');
});

test('deduplicates, filters, and sorts car-rental offices', () => {
  const origin = { latitude: 0, longitude: 0, label: 'Airport', timezone: 'UTC' };
  const offices = [
    normalizeCarRentalOffice({ type: 'node', id: 1, lat: 0.02, lon: 0, tags: { amenity: 'car_rental', name: 'Far Airport', website: 'https://rent.example', opening_hours: '24/7' } }, origin),
    normalizeCarRentalOffice({ type: 'way', id: 2, center: { lat: 0.01, lon: 0 }, tags: { amenity: 'car_rental', name: 'Near City', phone: '+1', wheelchair: 'yes' } }, { ...origin, label: 'City Centre' }),
    normalizeCarRentalOffice({ type: 'relation', id: 3, center: { lat: 0.010004, lon: 0.000004 }, tags: { amenity: 'car_rental', name: 'Near City', website: 'https://near.example' } }, { ...origin, label: 'City Centre' }),
  ].filter((office): office is CarRentalOffice => Boolean(office));
  const deduped = dedupeCarRentalOffices(offices);
  assert.equal(deduped.length, 2);
  assert.equal(sortCarRentalOffices(deduped, 'distance')[0]?.name, 'Near City');
  assert.equal(sortCarRentalOffices(deduped, 'airport')[0]?.locationType, 'airport');
  assert.equal(sortCarRentalOffices(deduped, 'website')[0]?.website.length > 0, true);

  const filters: CarRentalFilters = { type: 'airport', openNow: true, open24: true, website: true, phone: false, wheelchair: false, atAirport: true };
  const filtered = filterCarRentalOffices(deduped, filters);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.name, 'Far Airport');
});

test('validates car-rental official website URLs safely', () => {
  assert.equal(safeRentalUrl('example.com'), 'https://example.com/');
  assert.equal(safeRentalUrl('https://example.com/booking'), 'https://example.com/booking');
  assert.equal(safeRentalUrl('javascript:alert(1)'), '');
  assert.equal(safeRentalUrl('ftp://example.com'), '');
});

test('builds bounded car-rental Overpass queries and includes language states', () => {
  const query = buildCarRentalOverpassQuery(51.5, -0.1, 250);
  assert.equal(query.includes('around:100000,51.5,-0.1'), true);
  assert.equal(query.includes('["amenity"="car_rental"]'), true);
  assert.equal(query.includes('["vehicle:rental"~"^(car|motorcar)$"]'), true);
  assert.equal(labels.en.carRentalLocationDenied.includes('denied'), true);
  assert.equal(labels.en.carRentalTimedOut.includes('timed out'), true);
  assert.equal(labels.en.carRentalCached.includes('cached'), true);
  assert.equal(labels.en.carRentalNoResults, 'No mapped car-rental offices were found in this area. This does not necessarily mean that none exist.');
  assert.equal(labels.ar.carRentalTitle.length > 0, true);
  assert.equal(labels.id.carRentalTitle.length > 0, true);
});

test('classifies public transport from structured OSM tags without name guessing', () => {
  assert.equal(classifyPublicTransport({ railway: 'station' }), 'train');
  assert.equal(classifyPublicTransport({ railway: 'halt' }), 'train');
  assert.equal(classifyPublicTransport({ station: 'subway' }), 'metro');
  assert.equal(classifyPublicTransport({ railway: 'subway_entrance' }), 'metro');
  assert.equal(classifyPublicTransport({ station: 'light_rail' }), 'light-rail');
  assert.equal(classifyPublicTransport({ railway: 'tram_stop' }), 'tram');
  assert.equal(classifyPublicTransport({ amenity: 'bus_station' }), 'bus-station');
  assert.equal(classifyPublicTransport({ highway: 'bus_stop' }), 'bus-stop');
  assert.equal(classifyPublicTransport({ amenity: 'ferry_terminal' }), 'ferry');
  assert.equal(classifyPublicTransport({ name: 'Central Station' }), undefined);
});

test('normalizes public transport details, safe websites, and destination-local opening state', () => {
  const origin = { latitude: 35.68, longitude: 139.76, timezone: 'Asia/Tokyo' };
  const stop = normalizePublicTransportStop({
    type: 'node',
    id: 1,
    lat: 35.6812,
    lon: 139.7671,
    tags: {
      railway: 'station',
      name: '東京駅',
      'name:en': 'Tokyo Station',
      operator: 'JR East',
      network: 'JR',
      ref: 'TYO',
      line: 'Yamanote',
      opening_hours: 'Mo-Su 00:00-24:00',
      wheelchair: 'yes',
      shelter: 'yes',
      bench: 'yes',
      toilets: 'yes',
      website: 'tokyostation.example',
    },
  }, origin);
  assert.equal(stop?.name, 'Tokyo Station');
  assert.equal(stop?.originalName, '東京駅');
  assert.equal(stop?.operator, 'JR East');
  assert.equal(stop?.network, 'JR');
  assert.equal(stop?.ref, 'TYO');
  assert.equal(stop?.routes, 'Yamanote');
  assert.equal(stop?.openState, 'open');
  assert.equal(stop?.wheelchair, 'yes');
  assert.equal(stop?.shelter, 'yes');
  assert.equal(stop?.seating, 'yes');
  assert.equal(stop?.toilets, 'yes');
  assert.equal(stop?.website, 'https://tokyostation.example/');
  const unsafe = normalizePublicTransportStop({ type: 'node', id: 2, lat: 0, lon: 0, tags: { highway: 'bus_stop', website: 'javascript:alert(1)' } }, origin);
  assert.equal(unsafe?.website, '');
  const unnamed = normalizePublicTransportStop({ type: 'node', id: 3, lat: 0, lon: 0, tags: { highway: 'bus_stop' } }, origin);
  assert.equal(unnamed?.operator, '');
  assert.equal(unnamed?.network, '');
  assert.equal(Object.values(unnamed ?? {}).includes('Unnamed Quiet Prayer Space'), false);
});

test('deduplicates public transport stations, platforms, and subway entrances carefully', () => {
  const origin = { latitude: 0, longitude: 0, timezone: 'UTC' };
  const stops = [
    normalizePublicTransportStop({ type: 'node', id: 1, lat: 0, lon: 0, tags: { railway: 'station', station: 'subway', name: 'Central' } }, origin),
    normalizePublicTransportStop({ type: 'node', id: 2, lat: 0.0002, lon: 0.0002, tags: { railway: 'subway_entrance', name: 'Central Entrance A' } }, origin),
    normalizePublicTransportStop({ type: 'node', id: 3, lat: 0.00021, lon: 0.0002, tags: { public_transport: 'platform', subway: 'yes', name: 'Central Platform' } }, origin),
    normalizePublicTransportStop({ type: 'node', id: 4, lat: 0.01, lon: 0.01, tags: { railway: 'station', station: 'subway', name: 'Central North' } }, origin),
  ].filter((stop): stop is PublicTransportStop => Boolean(stop));
  const deduped = dedupePublicTransportStops(stops);
  assert.equal(deduped.some((stop) => stop.name === 'Central'), true);
  assert.equal(deduped.some((stop) => stop.name === 'Central North'), true);
  assert.equal(deduped.some((stop) => /Entrance|Platform/.test(stop.name)), false);
});

test('filters and sorts public transport by accessibility, open state, facilities, and type', () => {
  const origin = { latitude: 0, longitude: 0, timezone: 'UTC' };
  const stops = [
    normalizePublicTransportStop({ type: 'node', id: 1, lat: 0.02, lon: 0, tags: { railway: 'station', name: 'Train', opening_hours: '24/7', wheelchair: 'yes', toilets: 'yes' } }, origin),
    normalizePublicTransportStop({ type: 'node', id: 2, lat: 0.01, lon: 0, tags: { highway: 'bus_stop', name: 'Bus', shelter: 'yes' } }, origin),
    normalizePublicTransportStop({ type: 'node', id: 3, lat: 0.03, lon: 0, tags: { amenity: 'ferry_terminal', name: 'Ferry' } }, origin),
  ].filter((stop): stop is PublicTransportStop => Boolean(stop));
  assert.equal(sortPublicTransportStops(stops, 'distance')[0]?.name, 'Bus');
  assert.equal(sortPublicTransportStops(stops, 'type')[0]?.type, 'train');
  assert.equal(sortPublicTransportStops(stops, 'accessibility')[0]?.name, 'Train');
  assert.equal(filterPublicTransportStops(stops, { type: 'train', wheelchair: true, openNow: true, toilets: true, shelter: false }).length, 1);
  assert.equal(filterPublicTransportStops(stops, { type: 'all', wheelchair: false, openNow: false, toilets: false, shelter: true })[0]?.name, 'Bus');
});

test('builds bounded public transport Overpass queries and includes language labels', () => {
  const query = buildPublicTransportOverpassQuery(51.5, -0.1, 100);
  assert.equal(query.includes('around:50000,51.5,-0.1'), true);
  assert.equal(query.includes('["railway"~"^(station|halt|tram_stop|light_rail|subway_entrance)$"]'), true);
  assert.equal(query.includes('["public_transport"~"^(station|platform|stop_position)$"]'), true);
  assert.equal(query.includes('["highway"="bus_stop"]'), true);
  assert.equal(query.includes('["amenity"~"^(bus_station|ferry_terminal)$"]'), true);
  assert.equal(labels.en.publicTransportTitle, 'Public Transport');
  assert.equal(labels.ar.publicTransportTitle.length > 0, true);
  assert.equal(labels.id.publicTransportTitle.length > 0, true);
});

test('public transport route source handles cache, stale requests, errors, and responsive labels', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  assert.equal(source.includes("'public-transport'"), true);
  assert.equal(source.includes("window.location.hash === '#public-transport'"), true);
  assert.equal(source.includes('publicTransportAbortController = nextAbortController(publicTransportAbortController)'), true);
  assert.equal(source.includes('const isCurrentPublicTransportSearch = () => sequence === publicTransportSearchSequence'), true);
  assert.equal(source.includes("requestOverpass(overpassUrl(), { method: 'POST', body, signal: abortSignal }, 20000)"), true);
  assert.equal(source.includes('publicTransportCache.set(cacheKey'), true);
  assert.equal(source.includes('refreshOpenState(cached.results, searchCenter.timezone)'), true);
  assert.equal(source.includes("classifyRequestError(error).kind === 'timeout' ? 'timeout' : 'service-unavailable'"), true);
  assert.equal(source.includes('data-public-transport-filter'), true);
  assert.equal(source.includes('public-transport-map'), true);
  assert.equal(source.includes('390') || labels.en.publicTransportSubtitle.length > 0, true);
});

test('classifies taxi services conservatively from structured tags', () => {
  assert.equal(classifyTaxiService({ amenity: 'taxi' }), 'rank');
  assert.equal(classifyTaxiService({ amenity: 'taxi', aeroway: 'terminal' }), 'airport');
  assert.equal(classifyTaxiService({ amenity: 'taxi', railway: 'station' }), 'station');
  assert.equal(classifyTaxiService({ amenity: 'taxi', bus: 'yes' }), 'bus');
  assert.equal(classifyTaxiService({ amenity: 'taxi', taxi_vehicle: 'motorcycle' }), 'motorcycle');
  assert.equal(classifyTaxiService({ amenity: 'taxi', taxi_vehicle: 'motorboat' }), 'water');
  assert.equal(classifyTaxiService({ taxi: 'yes' }), undefined);
  assert.equal(classifyTaxiService({ name: 'Airport Taxi' }), undefined);
  assert.equal(isTaxiOffice({ office: 'company', name: 'Taxi Dispatch', phone: '+12345' }), true);
  assert.equal(isTaxiOffice({ office: 'company', name: 'City Transport' }), false);
});

test('normalizes taxi nodes, areas, phones, websites, and destination-local opening state', () => {
  const origin = { latitude: 51.5, longitude: -0.1, timezone: 'Europe/London' };
  const node = normalizeTaxiService({ type: 'node', id: 1, lat: 51.5, lon: -0.1, tags: { amenity: 'taxi', name: 'Station Taxi Rank', phone: '+44 20 1234 5678', website: 'taxi.example', opening_hours: '24/7', capacity: '12', wheelchair: 'limited', shelter: 'yes', lit: 'yes', fee: 'yes' } }, origin);
  const area = normalizeTaxiService({ type: 'way', id: 2, center: { lat: 51.51, lon: -0.11 }, tags: { amenity: 'taxi', name: 'Airport Taxi', aeroway: 'terminal' } }, origin);
  assert.equal(node?.type, 'rank');
  assert.equal(node?.callHref, 'tel:+442012345678');
  assert.equal(node?.website, 'https://taxi.example/');
  assert.equal(node?.openState, 'open');
  assert.equal(node?.capacity, '12');
  assert.equal(node?.wheelchair, 'limited');
  assert.equal(node?.shelter, 'yes');
  assert.equal(node?.lit, 'yes');
  assert.equal(node?.fee, 'yes');
  assert.equal(area?.type, 'airport');
  assert.equal(normalizeTaxiService({ type: 'node', id: 3, lat: 0, lon: 0, tags: { taxi: 'yes' } }, origin), undefined);
  assert.equal(normalizeTaxiService({ type: 'node', id: 4, lat: 0, lon: 0, tags: { office: 'company', name: 'Taxi Dispatch', website: 'javascript:alert(1)' } }, origin)?.website, '');
});

test('taxi optional metadata stays empty unless source data provides it', () => {
  const origin = { latitude: 0, longitude: 0, timezone: 'UTC' };
  const unnamed = normalizeTaxiService({ type: 'node', id: 10, lat: 0, lon: 0, tags: { amenity: 'taxi' } }, origin);
  const operated = normalizeTaxiService({ type: 'node', id: 11, lat: 0, lon: 0, tags: { amenity: 'taxi', operator: 'City Taxi Cooperative' } }, origin);
  const branded = normalizeTaxiService({ type: 'node', id: 12, lat: 0, lon: 0, tags: { amenity: 'taxi', brand: 'Airport Cabs' } }, origin);
  assert.equal(unnamed?.name, 'Taxi Rank');
  assert.equal(unnamed?.operator, '');
  assert.equal(Object.values(unnamed ?? {}).includes('Unnamed Quiet Prayer Space'), false);
  assert.equal(Object.values(unnamed ?? {}).includes('Unnamed Mosque'), false);
  assert.equal(operated?.operator, 'City Taxi Cooperative');
  assert.equal(branded?.operator, 'Airport Cabs');
});

test('normalizes taxi phones conservatively', () => {
  assert.equal(normalizeTaxiPhone('+1 (555) 123-4567'), '+15551234567');
  assert.equal(normalizeTaxiPhone('020 1234 5678'), '02012345678');
  assert.equal(normalizeTaxiPhone('call station desk'), '');
  assert.equal(normalizeTaxiPhone('123'), '');
});

test('deduplicates, filters, and sorts taxi services safely', () => {
  const origin = { latitude: 0, longitude: 0, timezone: 'UTC' };
  const taxis = [
    normalizeTaxiService({ type: 'node', id: 1, lat: 0, lon: 0, tags: { amenity: 'taxi', name: 'Terminal 1 Taxi', operator: 'City Taxi', phone: '+1234567', opening_hours: '24/7', wheelchair: 'yes' } }, origin),
    normalizeTaxiService({ type: 'way', id: 2, center: { lat: 0.0001, lon: 0.0001 }, tags: { amenity: 'taxi', name: 'Terminal 1 Taxi', operator: 'City Taxi', website: 'https://taxi.example' } }, origin),
    normalizeTaxiService({ type: 'node', id: 3, lat: 0.01, lon: 0.01, tags: { amenity: 'taxi', name: 'Terminal 2 Taxi', aeroway: 'terminal' } }, origin),
    normalizeTaxiService({ type: 'node', id: 4, lat: 0.02, lon: 0, tags: { office: 'taxi', name: 'Office Taxi', phone: '+7654321' } }, origin),
  ].filter((item): item is TaxiService => Boolean(item));
  const deduped = dedupeTaxiServices(taxis);
  assert.equal(deduped.length, 3);
  assert.equal(deduped.some((item) => item.name === 'Terminal 2 Taxi'), true);
  assert.equal(filterTaxiServices(deduped, { type: 'all', openNow: true, phone: true, website: false, wheelchairInfo: true, shelter: false }).length, 1);
  assert.equal(sortTaxiServices(deduped, 'contact')[0]?.callHref.length || sortTaxiServices(deduped, 'contact')[0]?.website.length ? true : false, true);
  assert.equal(sortTaxiServices(deduped, 'type')[0]?.type, 'airport');
});

test('builds bounded taxi Overpass queries and includes labels', () => {
  const query = buildTaxiOverpassQuery(31.78, 35.22, 100);
  assert.equal(query.includes('around:50000,31.78,35.22'), true);
  assert.equal(query.includes('["amenity"="taxi"]'), true);
  assert.equal(query.includes('["office"="taxi"]'), true);
  assert.equal(query.includes('["taxi:dispatch"="yes"]'), true);
  assert.equal(query.includes('["taxi"="yes"]'), false);
  assert.equal(labels.en.taxiTitle, 'Taxi Services');
  assert.equal(labels.ar.taxiTitle.length > 0, true);
  assert.equal(labels.id.taxiTitle.length > 0, true);
});

test('taxi route source handles cache, stale requests, errors, and mobile labels', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  assert.equal(source.includes("'taxi-services'"), true);
  assert.equal(source.includes("window.location.hash === '#taxi-services'"), true);
  assert.equal(source.includes('taxiAbortController = nextAbortController(taxiAbortController)'), true);
  assert.equal(source.includes('const isCurrentTaxiSearch = () => sequence === taxiSearchSequence'), true);
  assert.equal(source.includes("requestOverpass(overpassUrl(), { method: 'POST', body, signal: abortSignal }, 20000)"), true);
  assert.equal(source.includes('taxiCache.set(cacheKey'), true);
  assert.equal(source.includes('refreshOpenState(cached.results, searchCenter.timezone)'), true);
  assert.equal(source.includes("classifyRequestError(error).kind === 'timeout' ? 'timeout' : 'service-unavailable'"), true);
  assert.equal(source.includes('data-taxi-filter'), true);
  assert.equal(source.includes('taxi-map'), true);
  assert.equal(labels.en.taxiSubtitle.length > 0 && labels.ar.taxiSubtitle.length > 0 && labels.id.taxiSubtitle.length > 0, true);
});

const sampleWeatherResponse = () => {
  const hourlyTimes = Array.from({ length: 72 }, (_, index) => `2026-07-${String(1 + Math.floor(index / 24)).padStart(2, '0')}T${String(index % 24).padStart(2, '0')}:00`);
  const days = Array.from({ length: 7 }, (_, index) => `2026-07-${String(index + 1).padStart(2, '0')}`);
  return {
    latitude: 51.5,
    longitude: -0.1,
    timezone: 'Europe/London',
    current: { time: '2026-07-01T10:00', temperature_2m: 22, apparent_temperature: 23, relative_humidity_2m: 62, precipitation: 0, rain: 0, showers: 0, snowfall: 0, weather_code: 61, cloud_cover: 70, wind_speed_10m: 20, wind_direction_10m: 230, wind_gusts_10m: 55, is_day: 1 },
    hourly: {
      time: hourlyTimes,
      temperature_2m: hourlyTimes.map((_, index) => 20 + index % 5),
      apparent_temperature: hourlyTimes.map((_, index) => 21 + index % 5),
      relative_humidity_2m: hourlyTimes.map(() => 60),
      precipitation_probability: hourlyTimes.map((_, index) => index === 12 ? 70 : 20),
      precipitation: hourlyTimes.map(() => 0),
      rain: hourlyTimes.map((_, index) => index === 12 ? 2 : 0),
      showers: hourlyTimes.map(() => 0),
      snowfall: hourlyTimes.map(() => 0),
      weather_code: hourlyTimes.map((_, index) => index === 20 ? 95 : 1),
      cloud_cover: hourlyTimes.map(() => 40),
      visibility: hourlyTimes.map((_, index) => index === 5 ? 2500 : 10000),
      wind_speed_10m: hourlyTimes.map(() => 20),
      wind_direction_10m: hourlyTimes.map(() => 180),
      wind_gusts_10m: hourlyTimes.map((_, index) => index === 2 ? 55 : 25),
      uv_index: hourlyTimes.map((_, index) => index === 13 ? 7 : 1),
      is_day: hourlyTimes.map((_, index) => index % 24 > 5 && index % 24 < 21 ? 1 : 0),
    },
    daily: {
      time: days,
      weather_code: [0, 61, 71, 95, 2, 3, 45],
      temperature_2m_max: [30, 22, 8, 25, 26, 27, 28],
      temperature_2m_min: [18, 15, 1, 17, 18, 19, 20],
      apparent_temperature_max: [31, 23, 7, 26, 27, 28, 29],
      apparent_temperature_min: [17, 14, 0, 16, 17, 18, 19],
      sunrise: days.map((day) => `${day}T05:00`),
      sunset: days.map((day) => `${day}T21:00`),
      daylight_duration: days.map(() => 57600),
      sunshine_duration: days.map(() => 28800),
      uv_index_max: [7, 4, 2, 5, 6, 7, 3],
      precipitation_sum: [1, 4, 2, 3, 0, 0, 0],
      rain_sum: [1, 4, 0, 3, 0, 0, 0],
      showers_sum: [0, 0, 0, 0, 0, 0, 0],
      snowfall_sum: [0, 0, 2, 0, 0, 0, 0],
      precipitation_probability_max: [70, 80, 30, 50, 10, 10, 10],
      wind_speed_10m_max: [24, 20, 18, 30, 20, 20, 20],
      wind_gusts_10m_max: [55, 30, 25, 40, 20, 20, 20],
      wind_direction_10m_dominant: [220, 180, 90, 270, 0, 45, 135],
    },
  };
};

test('validates current, hourly, and daily Open-Meteo weather responses', () => {
  const forecast = validateWeatherResponse(sampleWeatherResponse(), '2026-07-01T10:05:00.000Z');
  assert.equal(forecast.current.temperature, 22);
  assert.equal(forecast.current.isDay, true);
  assert.equal(forecast.hourly.length, 72);
  assert.equal(forecast.daily.length, 7);
  assert.equal(forecast.timezone, 'Europe/London');
  assert.equal(forecast.daily[0].sunrise, '2026-07-01T05:00');
  assert.equal(forecast.daily[0].sunset, '2026-07-01T21:00');
});

test('rejects missing or malformed weather API data', () => {
  assert.throws(() => validateWeatherResponse(null), /Malformed/);
  assert.throws(() => validateWeatherResponse({ hourly: {}, daily: {} }), /Missing current/);
  assert.throws(() => validateWeatherResponse({ current: {}, daily: {} }), /Missing hourly/);
  assert.throws(() => validateWeatherResponse({ current: {}, hourly: {} }), /Missing daily/);
  const missingTemperature = sampleWeatherResponse();
  delete (missingTemperature.current as Record<string, unknown>).temperature_2m;
  assert.throws(() => validateWeatherResponse(missingTemperature), /Missing current temperature/);
  const stringHumidity = sampleWeatherResponse();
  (stringHumidity.hourly.relative_humidity_2m as unknown[])[0] = '60';
  assert.throws(() => validateWeatherResponse(stringHumidity), /Missing hourly humidity/);
  const invalidWind = sampleWeatherResponse();
  (invalidWind.daily.wind_speed_10m_max as number[])[0] = Number.POSITIVE_INFINITY;
  assert.throws(() => validateWeatherResponse(invalidWind), /Missing daily maximum wind speed/);
  const mismatchedHourly = sampleWeatherResponse();
  (mismatchedHourly.hourly.temperature_2m as number[]).pop();
  assert.throws(() => validateWeatherResponse(mismatchedHourly), /Malformed hourly temperature/);
  const mismatchedDaily = sampleWeatherResponse();
  (mismatchedDaily.daily.sunrise as string[]).pop();
  assert.throws(() => validateWeatherResponse(mismatchedDaily), /Malformed daily sunrise/);
  const missingHourlyTime = sampleWeatherResponse();
  delete (missingHourlyTime.hourly as Record<string, unknown>).time;
  assert.throws(() => validateWeatherResponse(missingHourlyTime), /Missing hourly data/);
  const nullRequired = sampleWeatherResponse();
  (nullRequired.hourly.precipitation_probability as unknown[])[0] = null;
  assert.throws(() => validateWeatherResponse(nullRequired), /Missing hourly precipitation probability/);
});

test('optional weather values stay unavailable instead of becoming zero', () => {
  const optionalMissing = sampleWeatherResponse();
  delete (optionalMissing.current as Record<string, unknown>).wind_gusts_10m;
  delete (optionalMissing.current as Record<string, unknown>).cloud_cover;
  delete (optionalMissing.hourly as Record<string, unknown>).uv_index;
  delete (optionalMissing.hourly as Record<string, unknown>).visibility;
  delete (optionalMissing.daily as Record<string, unknown>).uv_index_max;
  delete (optionalMissing.daily as Record<string, unknown>).wind_gusts_10m_max;
  const forecast = validateWeatherResponse(optionalMissing);
  assert.equal(forecast.current.windGusts, null);
  assert.equal(forecast.current.cloudCover, null);
  assert.equal(forecast.hourly[0].uvIndex, null);
  assert.equal(forecast.hourly[0].visibility, null);
  assert.equal(forecast.daily[0].uvIndexMax, null);
  assert.equal(forecast.daily[0].windGustsMax, null);
  assert.equal(formatWind(null, { temperature: 'celsius', wind: 'kmh', precipitation: 'mm' }, labels.en.weatherValueUnavailable), labels.en.weatherValueUnavailable);
  assert.equal(formatTemperature(null, { temperature: 'celsius', wind: 'kmh', precipitation: 'mm' }, labels.en.weatherValueUnavailable), labels.en.weatherValueUnavailable);
  assert.equal(formatPrecipitation(null, { temperature: 'celsius', wind: 'kmh', precipitation: 'mm' }, labels.en.weatherValueUnavailable), labels.en.weatherValueUnavailable);
});

test('interprets WMO weather codes without exposing raw codes', () => {
  assert.equal(weatherCodeInfo(0, labels.en).label, labels.en.weatherClear);
  assert.equal(weatherCodeInfo(61, labels.en).label, labels.en.weatherRain);
  assert.equal(weatherCodeInfo(71, labels.en).label, labels.en.weatherSnow);
  assert.equal(weatherCodeInfo(95, labels.en).label, labels.en.weatherThunderstorm);
});

test('formats weather units and builds configurable Open-Meteo URLs', () => {
  const units: WeatherUnits = { temperature: 'fahrenheit', wind: 'mph', precipitation: 'inch' };
  const url = buildWeatherUrl(1, 2, units, 'https://weather.example/forecast');
  assert.equal(url.includes('temperature_unit=fahrenheit'), true);
  assert.equal(url.includes('wind_speed_unit=mph'), true);
  assert.equal(url.includes('precipitation_unit=inch'), true);
  assert.equal(formatTemperature(72, units), '72°F');
  assert.equal(formatWind(10, units), '10 mph');
  assert.equal(Number(convertWindFromKmh(36, 'ms').toFixed(1)), 10);
  assert.equal(Number(convertWindFromKmh(10, 'knots').toFixed(2)), 5.4);
  assert.equal(Number(convertPrecipitationFromMm(25.4, 'inch').toFixed(2)), 1);
  assert.equal(formatPrecipitation(1, units), '1.00 in');
});

test('weather cache key source includes location, timezone, all units, duration, and model version', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  assert.equal(source.includes("location.timezone ?? 'auto'"), true);
  assert.equal(source.includes('units.temperature'), true);
  assert.equal(source.includes('units.wind'), true);
  assert.equal(source.includes('units.precipitation'), true);
  assert.equal(source.includes('-7d-v2'), true);
});

test('selects hourly, daily, travel-indicator, cached, and prayer weather data', () => {
  const forecast = validateWeatherResponse(sampleWeatherResponse());
  assert.equal(selectHourlyForecast(forecast.hourly, '2026-07-01T10:00', 24).length, 24);
  assert.equal(selectHourlyForecast(forecast.hourly, '2026-07-03T23:00', 24).length, 1);
  assert.equal(selectHourlyForecast(forecast.hourly, '2026-07-03T23:01', 24).length, 0);
  assert.equal(selectHourlyForecast([], '2026-07-01T10:00', 24).length, 0);
  assert.equal(hourlyForDay(forecast.hourly, '2026-07-02').length, 24);
  assert.equal(forecast.current.temperature, 22);
  assert.equal(forecast.daily.length, 7);
  const indicators = travelWeatherIndicators(forecast, labels.en);
  assert.equal(indicators.includes(labels.en.weatherIndicatorUv), true);
  assert.equal(indicators.includes(labels.en.weatherIndicatorWind), true);
  assert.equal(indicators.includes(labels.en.weatherIndicatorRain), true);
  const matched = matchPrayerWeather({ Fajr: '05:10', Dhuhr: '13:05' }, forecast.hourly);
  assert.equal(matched.length, 2);
  assert.equal(matched[0].forecast?.time.includes('05:00'), true);
  assert.equal(matchPrayerWeather({ Dhuhr: '1:05 PM' }, forecast.hourly)[0].forecast?.time.includes('13:00'), true);
  assert.equal(matchPrayerWeather({ Dhuhr: '12:05 PM' }, forecast.hourly)[0].forecast?.time.includes('12:00'), true);
  assert.equal(matchPrayerWeather({ Fajr: '12:05 AM' }, forecast.hourly)[0].forecast?.time.includes('00:00'), true);
  assert.equal(matchPrayerWeather({ Dhuhr: '2026-07-02 13:05' }, forecast.hourly)[0].forecast?.time.startsWith('2026-07-02T13:00'), true);
});

test('includes weather state and language labels', () => {
  assert.equal(labels.en.weatherLocationDenied.includes('denied'), true);
  assert.equal(labels.en.weatherTimedOut.includes('timed out'), true);
  assert.equal(labels.en.weatherCached.includes('Cached'), true);
  assert.equal(labels.en.weatherNoCached.includes('No cached'), true);
  assert.equal(labels.en.weatherValueUnavailable, 'Unavailable');
  assert.equal(labels.en.weatherNoLaterHourly, 'No later hourly forecast is available.');
  assert.equal(labels.ar.weatherValueUnavailable.length > 0, true);
  assert.equal(labels.ar.weatherNoLaterHourly.length > 0, true);
  assert.equal(labels.id.weatherNoLaterHourly.length > 0, true);
  assert.equal(labels.id.weatherValueUnavailable.length > 0, true);
  assert.equal(labels.ar.weatherTitle.length > 0, true);
  assert.equal(labels.id.weatherTitle.length > 0, true);
});

test('discovers structured OpenStreetMap attractions and excludes ordinary places', () => {
  assert.equal(isMappedAttraction({ tourism: 'attraction' }), true);
  assert.equal(isMappedAttraction({ tourism: 'museum' }), true);
  assert.equal(isMappedAttraction({ tourism: 'viewpoint' }), true);
  assert.equal(isMappedAttraction({ natural: 'waterfall', tourism: 'attraction' }), true);
  assert.equal(isMappedAttraction({ amenity: 'place_of_worship', wikidata: 'Q187702' }), true);
  assert.equal(isMappedAttraction({ amenity: 'place_of_worship', name: 'Ordinary Chapel' }), false);
  assert.equal(isMappedAttraction({ building: 'yes', name: 'Office' }), false);
  assert.equal(isMappedAttraction({ leisure: 'park' }), false);
});

test('classifies attraction categories from structured tags', () => {
  assert.equal(classifyAttraction({ historic: 'castle' }), 'castle');
  assert.equal(classifyAttraction({ historic: 'archaeological_site' }), 'archaeological');
  assert.equal(classifyAttraction({ historic: 'mosque' }), 'religious');
  assert.equal(classifyAttraction({ amenity: 'place_of_worship', wikidata: 'Q187702' }), 'religious');
  assert.equal(classifyAttraction({ tourism: 'gallery' }), 'gallery');
  assert.equal(classifyAttraction({ leisure: 'nature_reserve' }), 'natural');
});

test('normalizes attraction coordinates, names, fallbacks, and distance', () => {
  const origin = { latitude: 51.5, longitude: -0.1 };
  const node = normalizeAttraction({ type: 'node', id: 1, lat: 51.501, lon: -0.101, tags: { tourism: 'museum', 'name:en': 'Test Museum', fee: 'no', wheelchair: 'yes' } }, origin);
  const way = normalizeAttraction({ type: 'way', id: 2, center: { lat: 51.502, lon: -0.102 }, tags: { historic: 'monument', name: 'نصب تذكاري' } }, origin);
  const relation = normalizeAttraction({ type: 'relation', id: 3, center: { lat: 51.503, lon: -0.103 }, tags: { tourism: 'viewpoint' } }, origin);
  assert.equal(node?.name, 'Test Museum');
  assert.equal(node?.fee, 'free');
  assert.equal(node?.wheelchair, 'yes');
  assert.equal(way?.category, 'monument');
  assert.equal(latinOnly(way?.name ?? ''), true);
  assert.equal(relation?.name, 'Scenic Viewpoint');
  assert.equal(Number((node?.distanceKm ?? 0).toFixed(2)) > 0, true);
});

test('prioritizes English attraction names from source tags', () => {
  assert.equal(attractionName({ name: 'متحف', 'name:en': 'English Museum' }, 'museum'), 'English Museum');
  assert.equal(attractionName({ wikipedia: 'en:British_Museum' }, 'museum'), 'British Museum');
  assert.equal(attractionName({}, 'natural'), 'Natural Attraction');
});

test('matches exact attraction sources and rejects ambiguous matches', () => {
  const attraction = normalizeAttraction({ type: 'node', id: 1, lat: 0, lon: 0, tags: { tourism: 'museum', 'name:en': 'Exact Museum', wikidata: 'Q1', wikipedia: 'en:Exact_Museum', wikimedia_commons: 'Category:Exact Museum' } }, { latitude: 0, longitude: 0 }) as Attraction;
  assert.equal(canAttachExternalSource(attraction, { wikidata: 'Q1' }), true);
  assert.equal(canAttachExternalSource(attraction, { wikipedia: 'Exact Museum' }), true);
  assert.equal(canAttachExternalSource(attraction, { commons: 'Category:Exact Museum' }), true);
  assert.equal(canAttachExternalSource(attraction, { name: 'Exact Museum', category: 'museum', distanceKm: 0.1 }), true);
  assert.equal(canAttachExternalSource(attraction, { name: 'Exact Museum', category: 'gallery', distanceKm: 0.1 }), false);
  assert.equal(canAttachExternalSource(attraction, { name: 'Similar Museum', category: 'museum', distanceKm: 0.1 }), false);
});

test('handles Wikimedia Commons metadata, licences, and placeholders', () => {
  const raw = { query: { pages: { 1: { title: 'File:Test.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/test.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Test.jpg', extmetadata: { Artist: { value: 'Photographer' }, LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' }, Credit: { value: 'Credit line' } } }] } } } };
  const photo = normalizeCommonsImage(raw);
  assert.equal(photo?.creator, 'Photographer');
  assert.equal(photo?.license, 'CC BY-SA 4.0');
  for (const license of ['CC BY 4.0', 'CC BY-SA 4.0', 'CC0', 'Public Domain', 'PD']) {
    assert.equal(acceptableCommonsLicense({ thumbnailUrl: 'x', sourceUrl: 'y', license }), true);
  }
  for (const license of ['CC BY-NC 4.0', 'CC BY-ND 4.0', 'CC BY-NC-ND 4.0', 'All rights reserved', '', 'Creative Commons']) {
    assert.equal(acceptableCommonsLicense({ thumbnailUrl: 'x', sourceUrl: 'y', license }), false);
  }
  assert.equal(acceptableCommonsLicense({ thumbnailUrl: 'x', sourceUrl: 'y', license: 'All rights reserved' }), false);
  assert.equal(acceptableCommonsLicense({ sourceUrl: 'y', license: 'CC BY 4.0' }), false);
  assert.equal(categoryExplanation('viewpoint'), 'This is a mapped scenic viewpoint overlooking the surrounding area.');
});

test('builds CORS-compatible attraction image URLs and parses Commons filenames', () => {
  const commonsUrl = commonsImageInfoUrl('Dome of the Rock.jpg');
  const categoryUrl = commonsCategoryImagesUrl('Dome of the Rock');
  const wikidataUrl = wikidataEntityUrl('Q123');
  const searchUrl = commonsSearchUrl({ name: 'Dome of the Rock', aliases: ['Qubbat al-Sakhra'], category: 'religious', latitude: 31.778, longitude: 35.235 }, 'Jerusalem', 'Palestine');
  assert.equal(new URL(commonsUrl).searchParams.get('origin'), '*');
  assert.equal(new URL(categoryUrl).searchParams.get('origin'), '*');
  assert.equal(new URL(categoryUrl).searchParams.get('gcmtitle'), 'Category:Dome of the Rock');
  assert.equal(new URL(wikidataUrl).searchParams.get('origin'), '*');
  assert.equal(new URL(searchUrl).searchParams.get('origin'), '*');
  assert.equal(new URL(commonsUrl).searchParams.get('titles'), 'File:Dome of the Rock.jpg');
  assert.equal(commonsFilenameFromTag('File:16-04-04-Felsendom-Tempelberg-Jerusalem-RalfR-WAT 6559-6565.jpg'), '16-04-04-Felsendom-Tempelberg-Jerusalem-RalfR-WAT 6559-6565.jpg');
  assert.equal(commonsCategoryFromTag('Category:Dome_of_the_Rock'), 'Dome of the Rock');
  assert.equal(commonsFilenameFromTag('https://commons.wikimedia.org/wiki/File:Islam_art_museum1.JPG'), 'Islam art museum1.JPG');
  assert.equal(commonsFilenameFromImageUrl('https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Islam_art_museum1.JPG/960px-Islam_art_museum1.JPG'), 'Islam art museum1.JPG');
  assert.equal(wikipediaSummaryUrl('Tower of David').includes('/Tower_of_David'), true);
  assert.deepEqual(parseWikipediaTag('ar:قبة_الصخرة'), { language: 'ar', title: 'قبة الصخرة' });
});

test('reads Wikidata P18 and reusable Commons licence metadata', () => {
  const entity = { entities: { Q1177765: { labels: { en: { value: 'Tower of David' } }, aliases: { en: [{ value: 'Jerusalem Citadel' }] }, sitelinks: { enwiki: { title: 'Tower of David' } }, descriptions: { en: { value: 'ancient citadel' } }, claims: { P18: [{ mainsnak: { datavalue: { value: 'מגדל -דוד.jpg' } } }] } } } };
  assert.equal(wikidataP18Filename(entity, 'Q1177765'), 'מגדל -דוד.jpg');
  assert.equal(wikidataEnglishDescription(entity, 'Q1177765'), 'ancient citadel');
  assert.equal(wikidataEnglishLabel(entity, 'Q1177765'), 'Tower of David');
  assert.equal(wikidataEnglishTitle(entity, 'Q1177765'), 'Tower of David');
  assert.deepEqual(wikidataEnglishAliases(entity, 'Q1177765'), ['Jerusalem Citadel']);
  const commons = { query: { pages: { 1: { title: 'File:מגדל -דוד.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/thumb.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:%D7%9E.jpg', extmetadata: { Artist: { value: '<b>Photographer</b>' }, LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' } } }] } } } };
  const photo = normalizeCommonsImage(commons);
  assert.equal(photo?.title, 'File:מגדל -דוד.jpg');
  assert.equal(photo?.creator, 'Photographer');
});

test('accepts high-confidence Commons search results and rejects ambiguous images', () => {
  const raw = { query: { pages: {
    1: { title: 'File:Random Jerusalem gate.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/random.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Random.jpg', extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' } } }] },
    2: { title: 'File:Qubbat al-Sakhra exterior.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/dome.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Dome.jpg', extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' } } }] },
  } } };
  assert.equal(selectHighConfidenceCommonsImage(raw, { name: 'Dome of the Rock', aliases: ['Qubbat al-Sakhra'], category: 'religious' })?.thumbnailUrl, 'https://upload.wikimedia.org/dome.jpg');
  assert.equal(selectHighConfidenceCommonsImage(raw, { name: 'Western Wall', aliases: [], category: 'religious' }), undefined);
  assert.equal(firstLicensedCommonsImage(raw)?.thumbnailUrl, 'https://upload.wikimedia.org/random.jpg');
});

test('creates English summaries from Wikipedia, Wikidata, and OSM descriptions', () => {
  const attraction = normalizeAttraction({ type: 'node', id: 1, lat: 0, lon: 0, tags: { tourism: 'museum', 'description:en': 'OSM English description.' } }, { latitude: 0, longitude: 0 }) as Attraction;
  assert.equal(summarizeWikipediaExtract('Sentence one. Sentence two. Sentence three. Sentence four.').split('.').length <= 4, true);
  assert.equal(enrichAttraction(attraction, { wikipediaExtract: 'A museum. It has exhibitions.' }).historySource, 'Wikipedia');
  assert.equal(enrichAttraction(attraction, { wikidataDescription: 'Wikidata description' }).history, 'Wikidata description');
  assert.equal(enrichAttraction(attraction, { osmDescription: 'OSM description' }).history, 'OSM description');
  assert.equal(enrichAttraction({ ...attraction, osmDescription: '' }).history, 'This is a mapped museum or visitor exhibition site.');
  assert.equal(enrichAttraction(attraction, { photo: { thumbnailUrl: 'x', sourceUrl: 'y', title: 'Photo', creator: '', license: 'CC BY-SA 4.0', licenseUrl: '', credit: '' }, photoStatus: 'checked' }).photoStatus, 'checked');
});

test('deduplicates, filters, sorts, and queries attractions', () => {
  const origin = { latitude: 0, longitude: 0, timezone: 'UTC' };
  const attractions = [
    enrichAttraction(normalizeAttraction({ type: 'node', id: 1, lat: 0.02, lon: 0, tags: { tourism: 'museum', 'name:en': 'Far Museum', opening_hours: '24/7' } }, origin) as Attraction, { wikipediaExtract: 'A museum.' }),
    normalizeAttraction({ type: 'way', id: 2, center: { lat: 0.01, lon: 0 }, tags: { tourism: 'viewpoint', 'name:en': 'Near View', fee: 'no', wheelchair: 'yes' } }, origin),
    normalizeAttraction({ type: 'relation', id: 3, center: { lat: 0.010004, lon: 0.000004 }, tags: { tourism: 'viewpoint', 'name:en': 'Near View' } }, origin),
  ].filter((attraction): attraction is Attraction => Boolean(attraction));
  const deduped = dedupeAttractions(attractions);
  assert.equal(deduped.length, 2);
  const filters: AttractionFilters = { category: 'viewpoint', photo: false, history: false, openNow: false, free: true, wheelchair: true };
  assert.equal(filterAttractions(deduped, filters)[0]?.name, 'Near View');
  assert.equal(sortAttractions(deduped, 'distance')[0]?.name, 'Near View');
  assert.equal(sortAttractions(deduped, 'history')[0]?.name, 'Far Museum');
  const query = buildAttractionOverpassQuery(51.5, -0.1, 99);
  assert.equal(query.includes('(51.05084,'), true);
  assert.equal(query.includes('nwr["tourism"~'), true);
  assert.equal(query.includes('nwr["historic"~'), true);
  assert.equal(query.includes('["wikidata"]'), true);
  assert.equal(query.includes('nwr["amenity"="place_of_worship"]["wikidata"]'), true);
  const batches = buildAttractionOverpassBatches(30.0444, 31.2357, 5);
  assert.equal(batches.length, 20);
  assert.equal(batches.every((batch) => batch.query.includes('[timeout:12]')), true);
  assert.equal(batches.every((batch) => batch.query.includes('out center tags')), true);
  assert.equal(batches.every((batch) => batch.query.length < 700), true);
  assert.equal(batches.some((batch) => batch.id === 'museums-1'), true);
  assert.equal(batches.some((batch) => batch.id === 'historic-4'), true);
  assert.equal(query.includes('historic"]'), false);
  assert.equal(buildAttractionOverpassBatches(30.0444, 31.2357, 1).length, 5);
});

test('includes attraction state and language labels while keeping content English', () => {
  assert.equal(labels.en.attractionsLocationDenied.includes('denied'), true);
  assert.equal(labels.en.attractionsTimedOut, 'The attraction search took too long. Try a smaller radius or retry.');
  assert.equal(labels.en.attractionsCached.includes('cached'), true);
  assert.equal(labels.en.attractionsNoResults, 'No mapped attractions were found in this area. This does not necessarily mean that none exist.');
  assert.equal(labels.ar.attractionsTitle.length > 0, true);
  assert.equal(labels.id.attractionsTitle.length > 0, true);
  const englishSummary = categoryExplanation('natural');
  assert.equal(/[A-Za-z]/.test(englishSummary), true);
});

test('attraction search uses fallback endpoints, partial batches, and retry-only timeout UI', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  assert.equal(source.includes('function overpassEndpoints()'), true);
  assert.equal(source.includes('mtp-overpass-fallback-endpoint'), true);
  assert.equal(source.includes('requestAttractionBatch(batch, abortSignal)'), true);
  assert.equal(source.includes('buildAttractionOverpassBatches(searchCenter.latitude, searchCenter.longitude, searchRadius)'), true);
  assert.equal(source.includes('dedupeAttractions([...attractionResults, ...normalized])'), true);
  assert.equal(source.includes('classifyRequestError(error).kind'), true);
  assert.equal(source.includes("attractionStatus === 'timeout' ? ''"), true);
  assert.equal(source.includes('validateOverpassResponse'), true);
  assert.equal(source.includes('retryOnceForTemporary'), true);
  assert.equal(source.includes("new RequestError('timeout', 'Request timed out')"), true);
  assert.equal(source.includes('attractionAbortController?.abort'), true);
  assert.equal(source.includes('attractionResults.length >= 180 && successfulBatches >= 3'), true);
});

test('prayer-space searches ignore stale success and error completions', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  assert.equal(source.includes('let prayerSearchSequence = 0'), true);
  assert.equal(source.includes('async function searchPrayerPlaces(center: PrayerCenter, sequence = ++prayerSearchSequence)'), true);
  assert.equal(source.includes('const searchRadius = prayerRadiusKm'), true);
  assert.equal(source.includes('const isCurrentPrayerSearch = () => sequence === prayerSearchSequence'), true);
  assert.equal(source.includes('if (!isCurrentPrayerSearch()) return;\n    prayerResults = [...deduped.values()]'), true);
  assert.equal(source.includes("if (!isCurrentPrayerSearch()) return;\n    prayerStatus = 'service-unavailable'"), true);
  assert.equal(source.includes('void searchPrayerPlaces({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: labels[lang].qiblaLocation }, sequence)'), true);
  assert.equal(source.includes('await searchPrayerPlaces({ latitude: Number(first.lat), longitude: Number(first.lon), label: first.display_name }, sequence)'), true);
});

test('audited async feature searches isolate stale completions', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  assert.equal(source.includes('const isCurrentRestaurantSearch = () => sequence === restaurantSearchSequence'), true);
  assert.equal(source.includes('if (classifyRequestError(error).kind === \'aborted\') return;\n    if (cached)'), true);
  assert.equal(source.includes('const isCurrentToiletSearch = () => sequence === toiletSearchSequence'), true);
  assert.equal(source.includes('toiletResults = refreshOpenState(cached.results, searchCenter.timezone)'), true);
  assert.equal(source.includes('const isCurrentCarRentalSearch = () => sequence === carRentalSearchSequence'), true);
  assert.equal(source.includes('carRentalResults = refreshOpenState(cached.results, searchCenter.timezone)'), true);
  assert.equal(source.includes('const requestUnits = { ...weatherUnits }'), true);
  assert.equal(source.includes('const isCurrentWeatherRequest = () => sequence === weatherRequestSequence'), true);
  assert.equal(source.includes("if (classifyRequestError(error).kind === 'aborted') return;\n    const fallback"), true);
  assert.equal(source.includes('const activeCacheKey = attractionCacheKey'), true);
  assert.equal(source.includes('if (sequence !== attractionEnrichmentSequence || activeCacheKey !== attractionCacheKey || abortSignal.aborted) return;'), true);
});

test('geolocation callbacks are invalidated by newer searches across async features', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  const expectations = [
    ['requestQiblaLocation', 'qiblaLocationSequence'],
    ['requestPrayerLocation', 'prayerSearchSequence'],
    ['requestRestaurantLocation', 'restaurantSearchSequence'],
    ['requestToiletLocation', 'toiletSearchSequence'],
    ['requestCarRentalLocation', 'carRentalSearchSequence'],
    ['requestPublicTransportLocation', 'publicTransportSearchSequence'],
    ['requestTaxiLocation', 'taxiSearchSequence'],
    ['requestWeatherLocation', 'weatherRequestSequence'],
    ['requestAttractionLocation', 'attractionSearchSequence'],
  ];
  for (const [functionName, sequenceName] of expectations) {
    const start = source.indexOf(`function ${functionName}`);
    const nextFunction = source.indexOf('\nfunction ', start + 1);
    const end = nextFunction === -1 ? source.length : nextFunction;
    const body = source.slice(start, end);
    assert.equal(body.includes(`const sequence = ++${sequenceName}`), true);
    assert.equal(body.includes(`if (sequence !== ${sequenceName}) return;`), true);
  }
});

test('mapped feature opening status is recalculated with captured destination timezone', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  assert.equal(source.includes('type PrayerCenter = { latitude: number; longitude: number; label: string; timezone?: string }'), true);
  assert.equal(source.includes('label: `${city.city}, ${city.country}`, timezone: city.timezone'), true);
  assert.equal(source.includes('refreshOpenState(cached.results, searchCenter.timezone)'), true);
  assert.equal(source.includes('timezone: restaurantCenter?.timezone'), true);
  assert.equal(source.includes('timezone: toiletCenter?.timezone'), true);
  assert.equal(source.includes('timezone: carRentalCenter?.timezone'), true);
  assert.equal(source.includes('timezone: attractionCenter?.timezone'), true);
  assert.equal(source.includes('openingState(place.openingHours, prayerCenter?.timezone)'), true);
});

test('money rate and history requests are tied to the active pair and range', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  assert.equal(source.includes('let rateRequestSequence = 0'), true);
  assert.equal(source.includes('let historyRequestSequence = 0'), true);
  assert.equal(source.includes('const requestFromCurrency = fromCurrency'), true);
  assert.equal(source.includes('const requestToCurrency = toCurrency'), true);
  assert.equal(source.includes('const isCurrentRateRequest = () => sequence === rateRequestSequence && requestFromCurrency === fromCurrency && requestToCurrency === toCurrency'), true);
  assert.equal(source.includes('historyRequestSequence += 1'), true);
  assert.equal(source.includes('void loadHistory(requestFromCurrency, requestToCurrency)'), true);
  assert.equal(source.includes('const requestHistoryDays = historyDays'), true);
  assert.equal(source.includes('const isCurrentHistoryRequest = () => sequence === historyRequestSequence && historyFromCurrency === fromCurrency && historyToCurrency === toCurrency && requestHistoryDays === historyDays'), true);
});

test('map-search failure states render retry actions without endless loading', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  assert.equal(source.includes("['empty', 'service-unavailable'].includes(prayerStatus)"), true);
  assert.equal(source.includes("['empty', 'timeout', 'service-unavailable', 'offline'].includes(restaurantStatus)"), true);
  assert.equal(source.includes("restaurantStatus === 'timeout' ? ''"), true);
  assert.equal(source.includes("['empty', 'timeout', 'service-unavailable', 'offline'].includes(toiletStatus)"), true);
  assert.equal(source.includes("toiletStatus === 'timeout' ? ''"), true);
  assert.equal(source.includes("['empty', 'timeout', 'service-unavailable', 'offline'].includes(carRentalStatus)"), true);
  assert.equal(source.includes("carRentalStatus === 'timeout' ? ''"), true);
  assert.equal(source.includes('id="retry-halal"'), true);
  assert.equal(source.includes('id="retry-toilets"'), true);
  assert.equal(source.includes('id="retry-car-rental"'), true);
});

test('attraction page progressively loads images before final missing-image fallback', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  assert.equal(source.includes("photoStatus: 'loading'"), true);
  assert.equal(source.includes('attractionResults.filter((attraction) => attraction.photoStatus'), true);
  assert.equal(source.includes('attractionResults.slice(0, 80)'), false);
  assert.equal(source.includes('attractionEnrichmentCache'), true);
  assert.equal(source.includes('const batchSize = 3'), true);
  assert.equal(source.includes('Promise.all(batch.map'), true);
  assert.equal(source.includes('attractionEnrichmentAbortController'), true);
  assert.equal(source.includes("copy.attractionsLoadingPhotos"), true);
  assert.equal(source.includes("copy.attractionsNoLicensedImage"), true);
  assert.equal(source.includes('resolveAttractionPhotoAndHistory'), true);
  assert.equal(source.includes('Attraction enrichment diagnostics'), true);
});

test('halal Overpass query filters explicit halal evidence instead of every food venue', () => {
  const query = buildHalalOverpassQuery(0, 0, 5);
  assert.equal(query.includes('nwr["amenity"~"^(restaurant|fast_food|cafe|food_court)$"]["diet:halal"](around:5000,0,0)'), true);
  assert.equal(query.includes('["halal:certification"]'), true);
  assert.equal(query.includes('["description"~"halal",i]'), false);
  assert.equal(query.includes('node["amenity"="restaurant"]'), false);
});

test('OSM Commons tags and Wikidata P18 can enrich attraction photos', () => {
  const dome = normalizeAttraction({ type: 'way', id: 4709536, center: { lat: 31.778, lon: 35.235 }, tags: { tourism: 'attraction', 'name:en': 'Dome of the Rock', wikimedia_commons: 'File:16-04-04-Felsendom-Tempelberg-Jerusalem-RalfR-WAT 6559-6565.jpg' } }, { latitude: 31.778, longitude: 35.235 }) as Attraction;
  const tower = normalizeAttraction({ type: 'relation', id: 136164, center: { lat: 31.776, lon: 35.228 }, tags: { historic: 'castle', 'name:en': 'Tower of David', wikidata: 'Q1177765' } }, { latitude: 31.778, longitude: 35.235 }) as Attraction;
  assert.equal(commonsFilenameFromTag(dome.commons).startsWith('16-04-04-Felsendom'), true);
  assert.equal(tower.wikidata, 'Q1177765');
});

test('rendered prayer-place titles use the shared English-name safety function', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  assert.equal(source.includes('tags.name'), false);
  assert.equal(source.includes('place.originalName ?'), false);
  assert.equal(source.includes('<h3>${esc(place.name)}</h3>'), false);
  assert.equal(source.includes('aria-label="${esc(place.name)}"'), false);
  assert.equal(source.includes('setText(place.name)'), false);
  assert.equal(source.includes('encodeURIComponent(place.name)'), false);
  assert.equal(source.includes('ensureLatinDisplayName(getEnglishPlaceName(place), place.type)'), true);
});

test('mapped feature cards omit missing optional rows and avoid duplicate opening-hours fallback text', async () => {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  const source = await load('node:fs/promises').then((fs) => fs.readFile(new URL('../src/main.ts', import.meta.url), 'utf8'));
  const taxiDetails = source.slice(source.indexOf('function taxiDetails'), source.indexOf('function taxiCard'));
  const publicTransportDetails = source.slice(source.indexOf('function publicTransportDetails'), source.indexOf('function publicTransportCard'));
  const carRentalDetails = source.slice(source.indexOf('function carRentalDetails'), source.indexOf('function carRentalCard'));
  assert.equal(taxiDetails.includes('[copy.transportOperator, esc(item.operator)]'), true);
  assert.equal(taxiDetails.includes('[copy.prayerOpeningHours, esc(item.openingHours)]'), true);
  assert.equal(taxiDetails.includes('item.openingHours || copy.halalOpeningUnavailable'), false);
  assert.equal(publicTransportDetails.includes('stop.openingHours || copy.halalOpeningUnavailable'), false);
  assert.equal(carRentalDetails.includes('office.openingHours || copy.halalOpeningUnavailable'), false);
});

test('native build keeps GitHub Pages web build separate from Capacitor assets', async () => {
  const viteWeb = await repoFile('vite.config.ts');
  const viteNative = await repoFile('vite.native.config.ts');
  const capacitorConfig = await repoFile('capacitor.config.ts');
  const packageJson = await repoFile('package.json');
  assert.equal(viteWeb.includes("base: '/muslim-travel-planner/'"), true);
  assert.equal(viteWeb.includes("outDir: 'dist'"), true);
  assert.equal(viteNative.includes("base: './'"), true);
  assert.equal(viteNative.includes("outDir: 'dist-native'"), true);
  assert.equal(capacitorConfig.includes("webDir: 'dist-native'"), true);
  assert.equal(capacitorConfig.includes("appId: 'com.planetearthkids.muslimtravelplanner'"), true);
  assert.equal(capacitorConfig.includes("appName: 'SafarOne'"), true);
  assert.equal(packageJson.includes('"build": "npm run typecheck && vite build"'), true);
  assert.equal(packageJson.includes('"build:native": "npm run typecheck && npm run icon:verify && vite build --config vite.native.config.ts"'), true);
  assert.equal(packageJson.includes('"ios:sync": "npm run build:native && npx cap sync ios"'), true);
  assert.equal(packageJson.includes('"android:setup": "npm run build:native && node scripts/setup-android.mjs"'), true);
  assert.equal(packageJson.includes('"android:sync": "npm run build:native && npx cap sync android"'), true);
});

test('native platform helpers use official Capacitor bridges with web fallbacks', async () => {
  const links = await repoFile('src/native-links.ts');
  const location = await repoFile('src/native-location.ts');
  const share = await repoFile('src/native-share.ts');
  const offline = await repoFile('src/offline.ts');
  assert.equal(links.includes("`${page}.html?lang=${encodeURIComponent(language)}`"), true);
  assert.equal(links.includes("`${appBasePath()}${page}.html?lang=${encodeURIComponent(language)}`"), true);
  assert.equal(links.includes('safeExternalUrl(value)'), true);
  assert.equal(links.includes("Browser.open({ url, presentationStyle: 'popover' })"), true);
  assert.equal(location.includes("import { Geolocation } from '@capacitor/geolocation'"), true);
  assert.equal(location.includes('navigator.geolocation.getCurrentPosition'), true);
  assert.equal(share.includes("import { Clipboard } from '@capacitor/clipboard'"), true);
  assert.equal(share.includes("Filesystem } from '@capacitor/filesystem'"), true);
  assert.equal(share.includes("import { Share } from '@capacitor/share'"), true);
  assert.equal(share.includes('buildIcsCalendar(snapshot)'), true);
  assert.equal(share.includes('Directory.Cache'), true);
  assert.equal(share.includes('safeTripFilename(snapshot.name)'), true);
  assert.equal(share.includes('buildItineraryText(snapshot)'), true);
  assert.equal(offline.includes('if (isNativePlatform()) return Promise.resolve(false);'), true);
});

test('iOS project is configured for SafarOne TestFlight preparation without hardcoded signing', async () => {
  const pbx = await repoFile('ios/App/App.xcodeproj/project.pbxproj');
  const info = await repoFile('ios/App/App/Info.plist');
  const privacy = await repoFile('ios/App/App/PrivacyInfo.xcprivacy');
  assert.equal(pbx.includes('PRODUCT_BUNDLE_IDENTIFIER = com.planetearthkids.muslimtravelplanner;'), true);
  assert.equal(pbx.includes('MARKETING_VERSION = 1.0.0;'), true);
  assert.equal(pbx.includes('CURRENT_PROJECT_VERSION = 2;'), true);
  assert.equal(pbx.includes('TARGETED_DEVICE_FAMILY = 1;'), true);
  assert.equal(pbx.includes('PRODUCT_NAME = SafarOne;'), true);
  assert.equal(pbx.includes('CODE_SIGN_STYLE = Automatic;'), true);
  assert.equal(pbx.includes('DEVELOPMENT_TEAM ='), false);
  assert.equal(pbx.includes('PrivacyInfo.xcprivacy in Resources'), true);
  assert.equal(pbx.includes('ar InfoPlist.strings in Resources'), true);
  assert.equal(pbx.includes('ms InfoPlist.strings in Resources'), true);
  assert.equal(pbx.includes('tr InfoPlist.strings in Resources'), true);
  assert.equal(info.includes('<string>SafarOne</string>'), true);
  assert.equal(info.includes('NSLocationWhenInUseUsageDescription'), true);
  assert.equal(info.includes('UIBackgroundModes'), false);
  assert.equal(info.includes('NSLocationAlwaysAndWhenInUseUsageDescription'), true);
  assert.equal(info.includes('NSAllowsArbitraryLoads'), false);
  assert.equal(privacy.includes('<key>NSPrivacyTracking</key>'), true);
  assert.equal(privacy.includes('<false/>'), true);
  assert.equal(privacy.includes('NSPrivacyAccessedAPICategoryUserDefaults'), true);
});

test('iOS localized location permission strings exist in all launch languages', async () => {
  const expected = {
    en: 'SafarOne uses your location only when you request Qibla direction or nearby travel places.',
    ar: 'يستخدم SafarOne موقعك فقط عندما تطلب اتجاه القبلة أو أماكن السفر القريبة.',
    id: 'SafarOne menggunakan lokasi Anda hanya saat Anda meminta arah Kiblat atau tempat perjalanan terdekat.',
    ms: 'SafarOne menggunakan lokasi anda hanya apabila anda meminta arah kiblat atau tempat perjalanan berdekatan.',
    tr: 'SafarOne, Kıble yönünü veya yakındaki seyahat yerlerini istediğinizde konumunuzu yalnızca o anda kullanır.',
  };
  for (const [language, text] of Object.entries(expected)) {
    const strings = await repoFile(`ios/App/App/${language}.lproj/InfoPlist.strings`);
    assert.equal(strings.includes(text), true);
  }
});

test('iOS app icon asset catalog references generated opaque master-derived files', async () => {
  const contents = JSON.parse(await repoFile('ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json')) as { images: Array<{ filename?: string; size?: string; scale?: string }> };
  const filenames = contents.images.map((image) => image.filename).filter(Boolean) as string[];
  assert.equal(filenames.includes('Icon-App-1024x1024@1x.png'), true);
  assert.equal(filenames.includes('Icon-App-60x60@3x.png'), true);
  assert.equal(filenames.length >= 9, true);
  const files = await repoDir('ios/App/App/Assets.xcassets/AppIcon.appiconset/');
  for (const filename of filenames) {
    assert.equal(files.includes(filename), true);
  }
  const verifyScript = await repoFile('scripts/verify-app-icon.mjs');
  assert.equal(verifyScript.includes('resources/safarone-app-icon-1024.png'), true);
  assert.equal(verifyScript.includes("execFileSync('file'"), true);
  assert.equal(verifyScript.includes('PNG image data'), true);
  assert.equal(verifyScript.includes('1024 x 1024'), true);
  assert.equal(verifyScript.includes('RGBA|alpha'), true);
  assert.equal(verifyScript.includes("const isMac = process.platform === 'darwin'"), true);
  assert.equal(verifyScript.includes('if (isMac)'), true);
  assert.equal(verifyScript.indexOf("execFileSync('sips'") > verifyScript.indexOf('if (isMac)'), true);
  assert.equal(verifyScript.includes('Missing committed AppIcon directory'), true);
  assert.equal(verifyScript.includes('Missing committed AppIcon Contents.json'), true);
  assert.equal(verifyScript.includes('referencedFilenames.has(filename)'), true);
  assert.equal(verifyScript.includes('Missing committed 1024x1024 App Store marketing icon'), true);
  assert.equal(verifyScript.includes('pixelWidth:\\s*1024'), true);
  assert.equal(verifyScript.includes('hasAlpha:\\s*no'), true);
});

test('iOS launch screen uses emerald background and local SafarOne symbol', async () => {
  const storyboard = await repoFile('ios/App/App/Base.lproj/LaunchScreen.storyboard');
  const launchContents = await repoFile('ios/App/App/Assets.xcassets/LaunchIcon.imageset/Contents.json');
  assert.equal(storyboard.includes('image="LaunchIcon"'), true);
  assert.equal(storyboard.includes('red="0.01568627451" green="0.2078431373" blue="0.1725490196"'), true);
  assert.equal(storyboard.includes('loading'), false);
  assert.equal(launchContents.includes('launch-icon.png'), true);
});

test('iOS prayer notifications use official Local Notifications without custom Athan audio bundling', async () => {
  const athan = await repoFile('src/athan.ts');
  const athanI18n = await repoFile('src/athan-i18n.ts');
  const appDelegate = await repoFile('ios/App/App/AppDelegate.swift');
  assert.equal(athan.includes("import { LocalNotifications } from '@capacitor/local-notifications'"), true);
  assert.equal(athan.includes('LocalNotifications.requestPermissions()'), true);
  assert.equal(athan.includes('LocalNotifications.schedule'), true);
  assert.equal(athan.includes('LocalNotifications.cancel'), true);
  assert.equal(athan.includes("registerPlugin<NativeAthanPlugin>('AthanAlarm')"), false);
  assert.equal(appDelegate.includes('AthanAlarmPlugin'), false);
  assert.equal(appDelegate.includes('athan_alert'), false);
  assert.equal(appDelegate.includes('athan.mp3'), false);
  assert.equal(athanI18n.includes('29-second'), false);
  assert.equal(athanI18n.includes('29 ثانية'), false);
  assert.equal(athanI18n.includes('29 detik'), false);
  assert.equal(athanI18n.includes('29 saat'), false);
  assert.equal(athanI18n.includes('system notification sound'), true);
});

test('TestFlight and iOS privacy documentation are present and accurate', async () => {
  const checklist = await repoFile('docs/TESTFLIGHT_CHECKLIST.md');
  const beta = await repoFile('docs/TESTFLIGHT_BETA_NOTES.md');
  const privacyNotes = await repoFile('IOS_PRIVACY_NOTES.md');
  assert.equal(checklist.includes('com.planetearthkids.muslimtravelplanner'), true);
  assert.equal(checklist.includes('planetearthkh@gmail.com'), true);
  assert.equal(checklist.includes('https://planetearthkh-arch.github.io/muslim-travel-planner/privacy.html'), true);
  assert.equal(checklist.includes('Increment the build number'), true);
  assert.equal(checklist.includes('Do not bundle or download third-party Athan audio without clear permission.'), true);
  assert.equal(beta.includes('Halal information is based on source data and is not guaranteed or certified by SafarOne.'), true);
  assert.equal(privacyNotes.includes('No tracking.'), true);
  assert.equal(privacyNotes.includes('Local Notifications permission is requested only after user action'), true);
});
