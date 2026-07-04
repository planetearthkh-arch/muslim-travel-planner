import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const file = (relative) => path.join(root, relative);
const read = (relative) => readFile(file(relative), 'utf8');
const write = async (relative, content) => {
  await mkdir(path.dirname(file(relative)), { recursive: true });
  await writeFile(file(relative), content);
};

function replaceOnce(content, search, replacement, label) {
  if (!content.includes(search)) throw new Error(`Missing patch target: ${label}`);
  return content.replace(search, replacement);
}

function replaceRegex(content, expression, replacement, label) {
  if (!expression.test(content)) throw new Error(`Missing regex patch target: ${label}`);
  expression.lastIndex = 0;
  return content.replace(expression, replacement);
}

await write('src/app-language.ts', `import {
  labels as coreLabels,
  languages as coreLanguages,
  optionLabels as coreOptionLabels,
  prayerLabels as corePrayerLabels,
  regionLabels as coreRegionLabels,
  statusLabels as coreStatusLabels,
  type Language as CoreLanguage,
} from './i18n.js';
import { urduExtraLabelsA } from './urdu-labels-extra-a.js';
import { urduExtraLabelsC } from './urdu-labels-extra-c.js';
import { urduFlightLabels } from './urdu-labels-flight.js';
import { urduLabels } from './urdu-labels.js';
import { urduTransportLabelsA } from './urdu-labels-transport-a.js';
import { urduTransportLabelsB } from './urdu-labels-transport-b.js';
import { urduTransportLabelsC } from './urdu-labels-transport-c.js';
import type { PrayerName, Region, VerificationStatus } from './models.js';

export type Language = CoreLanguage | 'ur';

export const languages: Array<{ code: Language; label: string }> = [
  ...coreLanguages,
  { code: 'ur', label: 'اردو' },
];

export const languageDirection = (language: Language) => language === 'ar' || language === 'ur' ? 'rtl' : 'ltr';

export const localeForLanguage = (language: Language) => ({
  en: 'en-US',
  ar: 'ar',
  ur: 'ur-PK',
  id: 'id-ID',
  ms: 'ms-MY',
  tr: 'tr-TR',
  fr: 'fr-FR',
} satisfies Record<Language, string>)[language];

export function parseLanguage(value: unknown): Language | null {
  return languages.some((language) => language.code === value) ? value as Language : null;
}

export const labels = {
  ...coreLabels,
  ur: {
    ...coreLabels.en,
    ...urduLabels,
    ...urduFlightLabels,
    ...urduTransportLabelsA,
    ...urduTransportLabelsB,
    ...urduTransportLabelsC,
    ...urduExtraLabelsA,
    ...urduExtraLabelsC,
  },
} satisfies Record<Language, Record<string, string>>;

export const regionLabels = {
  ...coreRegionLabels,
  ur: {
    Europe: 'یورپ',
    'Middle East': 'مشرقِ وسطیٰ',
    Asia: 'ایشیا',
    'North America': 'شمالی امریکہ',
    Africa: 'افریقہ',
    Oceania: 'اوشیانا',
  },
} satisfies Record<Language, Record<Region, string>>;

export const statusLabels = {
  ...coreStatusLabels,
  ur: { Sample: 'نمونہ', Unverified: 'غیر تصدیق شدہ', Verified: 'تصدیق شدہ' },
} satisfies Record<Language, Record<VerificationStatus, string>>;

export const prayerLabels = {
  ...corePrayerLabels,
  ur: { Fajr: 'فجر', Dhuhr: 'ظہر', Asr: 'عصر', Maghrib: 'مغرب', Isha: 'عشاء' },
} satisfies Record<Language, Record<PrayerName, string>>;

export const optionLabels = {
  budget: {
    ...coreOptionLabels.budget,
    ur: { low: 'کم', mid: 'درمیانہ', high: 'زیادہ' },
  },
  walkingAbility: {
    ...coreOptionLabels.walkingAbility,
    ur: { low: 'کم', medium: 'درمیانہ', high: 'زیادہ' },
  },
  transportation: {
    ...coreOptionLabels.transportation,
    ur: { walking: 'پیدل', 'public transport': 'عوامی ٹرانسپورٹ', taxi: 'ٹیکسی' },
  },
  prayerPreference: {
    ...coreOptionLabels.prayerPreference,
    ur: { mosque: 'مسجد', 'quiet prayer space': 'پُرسکون نماز کی جگہ', flexible: 'لچکدار' },
  },
  halalPreference: {
    ...coreOptionLabels.halalPreference,
    ur: { 'strictly labelled': 'واضح طور پر حلال درج', 'vegetarian/seafood options': 'سبزی یا سمندری غذا کے اختیارات', flexible: 'لچکدار' },
  },
};
`);

await write('src/app-athan-i18n.ts', `import { athanLabels as coreAthanLabels } from './athan-i18n.js';
import type { Language } from './app-language.js';

export const athanLabels = {
  ...coreAthanLabels,
  ur: {
    title: 'نماز کے اوقات اور یاد دہانیاں',
    calculated: 'حساب شدہ نماز کے اوقات',
    sunrise: 'طلوعِ آفتاب',
    description: 'موبائل ایپ بند ہونے کے باوجود نماز کی اطلاعات مقرر کر سکتی ہے۔ آئی فون نظام کی اطلاع کی آواز استعمال کرتا ہے۔ براؤزر میں اذان صرف اس وقت چلتی ہے جب یہ صفحہ کھلا رہے۔',
    browserNotice: 'براؤزر پیش نظارہ: اذان اس وقت تک چلتی ہے جب یہ صفحہ کھلا رہے۔ ایپ بند ہونے پر نماز کی اطلاعات کے لیے موبائل ایپ نصب کریں۔',
    androidNotice: 'اس آلے پر پس منظر میں مکمل اذان دستیاب ہے۔',
    enable: 'نماز کی اطلاعات فعال کریں',
    reschedule: 'نماز کی اطلاعات اپ ڈیٹ کریں',
    disable: 'اطلاعات بند کریں',
    test: 'اطلاع آزمائیں',
    stop: 'آزمائشی آواز بند کریں',
    preparing: 'نماز کی اطلاعات تیار ہو رہی ہیں…',
    scheduled: 'نماز کی اطلاعات مقرر ہو گئیں',
    disabled: 'نماز کی اطلاعات بند کر دی گئیں۔',
    failed: 'نماز کی اطلاعات ترتیب نہیں دی جا سکیں۔ اطلاع کی اجازت چیک کریں۔',
    noFuture: 'منتخب تاریخوں کے لیے آئندہ نماز کا وقت نہیں ملا۔',
    permissionNote: 'اطلاعات اور آوازوں کی اجازت دیں تاکہ نماز کی یاد دہانی وقت پر پہنچے۔',
  },
} satisfies Record<Language, Record<string, string>>;
`);

await write('src/safe-storage.ts', `class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(String(key)) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(String(key)); }
  setItem(key: string, value: string) { this.values.set(String(key), String(value)); }
}

let fallbackStorage: Storage | undefined;

export function getSafeStorage(): Storage {
  if (typeof window === 'undefined') return fallbackStorage ??= new MemoryStorage();
  try {
    const storage = window.localStorage;
    const probe = '__safarone_storage_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return fallbackStorage ??= new MemoryStorage();
  }
}
`);

await write('src/android-athan.ts', `import { registerPlugin } from '@capacitor/core';

export type AndroidAthanAlarm = {
  id: number;
  timestamp: number;
  prayer: string;
  city: string;
};

type AndroidAthanPlugin = {
  prepare(options: { audioUrl: string }): Promise<{ ready: boolean }>;
  schedule(options: { alarms: AndroidAthanAlarm[] }): Promise<{ scheduled: number }>;
  cancelAll(): Promise<void>;
  test(): Promise<void>;
  stop(): Promise<void>;
};

export const AndroidAthan = registerPlugin<AndroidAthanPlugin>('AthanAlarm');
`);

let index = await read('index.html');
index = replaceOnce(index, '    <script type="module" src="/src/urdu-runtime.ts"></script>\n', '', 'remove Urdu runtime bootstrap');
await write('index.html', index);
await rm(file('src/urdu-runtime.ts'), { force: true });

let main = await read('src/main.ts');
main = replaceOnce(main, `import {
  labels,
  languageDirection,
  languages,
  optionLabels,
  prayerLabels,
  regionLabels,
  type Language,
} from './i18n.js';
import { athanLabels } from './athan-i18n.js';`, `import {
  labels,
  languageDirection,
  languages,
  localeForLanguage,
  optionLabels,
  parseLanguage,
  prayerLabels,
  regionLabels,
  type Language,
} from './app-language.js';
import { athanLabels } from './app-athan-i18n.js';`, 'main app-language imports');
main = replaceOnce(main, `import { dateTimeForZone } from './time-zones.js';`, `import { dateTimeForZone } from './time-zones.js';
import { getSafeStorage } from './safe-storage.js';`, 'safe storage import');
main = replaceOnce(main, `let lang: Language = 'en';`, `const appStorage = getSafeStorage();
let lang: Language = parseLanguage(appStorage.getItem('mtp-language')) ?? 'en';`, 'safe startup language');
main = main.replaceAll('localStorage.', 'appStorage.');
main = main.replaceAll('new SavedTripRepository(localStorage)', 'new SavedTripRepository(appStorage)');
main = main.replaceAll('new FlightPlanRepository(localStorage)', 'new FlightPlanRepository(appStorage)');
main = replaceRegex(main, /const localeForLanguage = \(language: Language\) =>[^;]+;\n/, '', 'remove legacy locale mapper');
main = replaceOnce(main, `  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => {
    lang = (event.target as HTMLSelectElement).value as Language;
    athanStatus = '';
    render();
  });`, `  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => {
    const nextLanguage = parseLanguage((event.target as HTMLSelectElement).value);
    if (!nextLanguage || nextLanguage === lang) return;
    lang = nextLanguage;
    appStorage.setItem('mtp-language', lang);
    athanStatus = '';
    if (generatedPrefs) {
      generatedItems = generateItinerary(generatedPrefs, replan, lang);
      if (openedSavedTripId) savedTripStatus = 'unsaved';
    }
    render();
  });`, 'regenerate itinerary on language switch');
main = replaceOnce(main, `      const city = selectedCity();
      const alarms = calculatePrayerAlarms(city, prefs.prayerMethod, prefs.startDate, localeForLanguage(lang), 7);`, `      const alarmPrefs = generatedPrefs ?? prefs;
      const city = cityForPreferences(alarmPrefs) ?? selectedCity();
      const alarms = calculatePrayerAlarms(city, alarmPrefs.prayerMethod, alarmPrefs.startDate, localeForLanguage(lang), 7);`, 'schedule alarms from displayed trip');
main = replaceRegex(main, /(function snapshotFromSavedTrip\(trip: SavedTrip\): TripExportSnapshot \{[\s\S]*?travelDetails: trip\.travelDetails,\n\s*)language: lang,/, '$1language: trip.language,', 'saved trip export language');
await write('src/main.ts', main);

let planner = await read('src/planner.ts');
planner = replaceOnce(planner, `import { optionLabels, type Language } from './i18n.js';`, `import { localeForLanguage, optionLabels, type Language } from './app-language.js';`, 'planner language import');
planner = replaceOnce(planner, `const prayerTimes = calculatePrayerDisplay(city, prefs.prayerMethod, date, languageCode === 'ur' ? 'ur-PK' : 'en-GB');`, `const prayerTimes = calculatePrayerDisplay(city, prefs.prayerMethod, date, localeForLanguage(language));`, 'planner locale');
await write('src/planner.ts', planner);

for (const relative of ['src/money.ts', 'src/place-report.ts', 'src/saved-trips.ts']) {
  let content = await read(relative);
  content = content.replace(`import type { Language } from './i18n.js';`, `import type { Language } from './app-language.js';`);
  await write(relative, content);
}
let tripShare = await read('src/trip-share.ts');
tripShare = replaceOnce(tripShare, `import type { Language } from './i18n.js';
import { labels } from './i18n.js';`, `import { labels, type Language } from './app-language.js';`, 'trip share app language');
await write('src/trip-share.ts', tripShare);

let athan = await read('src/athan.ts');
athan = replaceOnce(athan, `import type { Language } from './i18n.js';`, `import type { Language } from './app-language.js';
import { AndroidAthan } from './android-athan.js';`, 'athan app language and Android plugin');
athan = replaceRegex(athan, /export async function enableAthanAlarms\([\s\S]*?\n}\n\nexport async function disableAthanAlarms/, `export async function enableAthanAlarms(alarms: PrayerAlarm[], language: Language = 'en') {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    const permissions = await LocalNotifications.requestPermissions();
    if (permissions.display !== 'granted') {
      return {
        mode: 'native' as const,
        scheduled: 0,
        permissions: { exactAlarmAllowed: false, notificationsAllowed: false },
      };
    }
    await AndroidAthan.prepare({ audioUrl: ATHAN_AUDIO_URL });
    const copy = copyFor(language);
    const now = Date.now();
    const payload = alarms
      .filter((alarm) => alarm.timestamp > now + 1000)
      .slice(0, 60)
      .map((alarm) => ({
        id: nativeNotificationId(alarm),
        timestamp: alarm.timestamp,
        prayer: \`${'${copy.prayer[alarm.prayer]} ${copy.title}'}\`,
        city: \`${'${alarm.city} · ${alarm.formattedTime}'}\`,
      }));
    const result = payload.length ? await AndroidAthan.schedule({ alarms: payload }) : { scheduled: 0 };
    let exactAlarmAllowed = false;
    try {
      exactAlarmAllowed = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
    } catch {
      exactAlarmAllowed = false;
    }
    return {
      mode: 'native' as const,
      scheduled: result.scheduled,
      permissions: { exactAlarmAllowed, notificationsAllowed: true },
    };
  }

  if (Capacitor.isNativePlatform()) {
    const permissions = await LocalNotifications.requestPermissions();
    if (permissions.display !== 'granted') {
      return {
        mode: 'native' as const,
        scheduled: 0,
        permissions: { exactAlarmAllowed: false, notificationsAllowed: false },
      };
    }
    await cancelNativePrayerNotifications();
    const now = Date.now();
    const copy = copyFor(language);
    const notifications = alarms
      .filter((alarm) => alarm.timestamp > now + 1000)
      .slice(0, 60)
      .map((alarm) => ({
        id: nativeNotificationId(alarm),
        title: \`${'${copy.prayer[alarm.prayer]} ${copy.title}'}\`,
        body: \`${'${alarm.city} · ${alarm.formattedTime}'}\`,
        sound: NATIVE_DEFAULT_SOUND,
        schedule: { at: new Date(alarm.timestamp) },
        extra: { safarOne: true, prayer: alarm.prayer, city: alarm.city },
      }));
    if (notifications.length) await LocalNotifications.schedule({ notifications });
    return {
      mode: 'native' as const,
      scheduled: notifications.length,
      permissions: { exactAlarmAllowed: true, notificationsAllowed: true },
    };
  }

  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  scheduleBrowserFallback(alarms, language);
  return {
    mode: 'browser' as const,
    scheduled: browserTimers.length,
    permissions: {
      exactAlarmAllowed: false,
      notificationsAllowed: !('Notification' in window) || Notification.permission === 'granted',
    },
  };
}

export async function disableAthanAlarms`, 'replace native Athan scheduling');
athan = replaceOnce(athan, `export async function disableAthanAlarms() {
  browserTimers.forEach((timer) => window.clearTimeout(timer));
  browserTimers = [];
  if (Capacitor.isNativePlatform()) await cancelNativePrayerNotifications();
}`, `export async function disableAthanAlarms() {
  browserTimers.forEach((timer) => window.clearTimeout(timer));
  browserTimers = [];
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    await AndroidAthan.cancelAll();
  } else if (Capacitor.isNativePlatform()) {
    await cancelNativePrayerNotifications();
  }
}`, 'disable Android Athan');
athan = replaceRegex(athan, /export async function playTestAthan\([\s\S]*?\n}\n\nexport async function stopAthan\(\) \{[\s\S]*?\n}\n/, `export async function playTestAthan(language: Language = 'en') {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    await AndroidAthan.prepare({ audioUrl: ATHAN_AUDIO_URL });
    await AndroidAthan.test();
    return;
  }
  if (Capacitor.isNativePlatform()) {
    const permissions = await LocalNotifications.requestPermissions();
    if (permissions.display !== 'granted') return;
    const copy = copyFor(language);
    await LocalNotifications.schedule({
      notifications: [{
        id: NATIVE_TEST_NOTIFICATION_ID,
        title: copy.testTitle,
        body: copy.testBody,
        sound: NATIVE_DEFAULT_SOUND,
        schedule: { at: new Date(Date.now() + 1000) },
        extra: { safarOne: true, test: true },
      }],
    });
    return;
  }
  browserAudio?.pause();
  browserAudio = new Audio(ATHAN_AUDIO_URL);
  browserAudio.preload = 'auto';
  await browserAudio.play();
}

export async function stopAthan() {
  browserAudio?.pause();
  browserAudio = undefined;
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    await AndroidAthan.stop();
  } else if (Capacitor.isNativePlatform()) {
    await LocalNotifications.cancel({ notifications: [{ id: NATIVE_TEST_NOTIFICATION_ID }] });
  }
}
`, 'Android Athan test and stop');
await write('src/athan.ts', athan);

let flight = await read('src/flight-mode.ts');
flight = replaceRegex(flight, /export function positionByDistance\([\s\S]*?\n}\n\nexport function elapsedProgress/, `export function positionByDistance(points: RoutePoint[], distanceKm: number) {
  const segments = routeSegments(points);
  const total = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  if (!segments.length) return { point: points[0], trackDegrees: Number.NaN, progress: 0, totalDistanceKm: 0 };
  const target = Math.min(total, Math.max(0, Number.isFinite(distanceKm) ? distanceKm : 0));
  let traversed = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const isLast = index === segments.length - 1;
    if (target < traversed + segment.distanceKm || isLast) {
      const fraction = segment.distanceKm ? Math.min(1, Math.max(0, (target - traversed) / segment.distanceKm)) : 0;
      const point = greatCircleInterpolate(segment.from, segment.to, fraction);
      const trackDegrees = fraction >= 1 - 1e-9
        ? initialTrueBearing(segment.from, segment.to)
        : initialTrueBearing(point, segment.to);
      return { point, trackDegrees, progress: total ? target / total : 0, totalDistanceKm: total };
    }
    traversed += segment.distanceKm;
  }
  const last = segments[segments.length - 1];
  return { point: last.to, trackDegrees: initialTrueBearing(last.from, last.to), progress: 1, totalDistanceKm: total };
}

export function projectPositionOntoRoute(points: RoutePoint[], position: RoutePoint) {
  if (!validCoordinate(position.latitude, position.longitude)) return null;
  const segments = routeSegments(points);
  const totalDistanceKm = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  if (!segments.length || totalDistanceKm <= 0) return null;
  let traversed = 0;
  let best: { progress: number; distanceKm: number; crossTrackDistanceKm: number; trackDegrees: number } | null = null;

  segments.forEach((segment, index) => {
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
    const trackDegrees = fraction >= 1 - 1e-9
      ? initialTrueBearing(segment.from, segment.to)
      : initialTrueBearing(projected, segment.to);
    if (!best || crossTrackDistanceKm < best.crossTrackDistanceKm) {
      best = {
        progress: Math.min(1, Math.max(0, distanceKm / totalDistanceKm)),
        distanceKm,
        crossTrackDistanceKm,
        trackDegrees: index < segments.length - 1 && fraction >= 1 - 1e-9
          ? initialTrueBearing(segments[index + 1].from, segments[index + 1].to)
          : trackDegrees,
      };
    }
    traversed += segment.distanceKm;
  });

  return best ? { ...best, totalDistanceKm } : null;
}

export function elapsedProgress`, 'flight route position and projection');
flight = replaceRegex(flight, /export function chooseFlightProgress\([\s\S]*?\n}\n\nexport function searchAirports/, `export function chooseFlightProgress(plan: PreparedFlightPlan, options: { gps?: FlightPosition; previousGps?: FlightPosition; manualProgress?: number; nowMs?: number }) {
  const nowMs = options.nowMs ?? Date.now();
  const routeEstimate = positionByProgress(plan, options.manualProgress ?? elapsedProgress(plan, nowMs), nowMs);
  const gps = options.gps;
  if (!gps || !validCoordinate(gps.latitude, gps.longitude)) return routeEstimate;
  const stale = nowMs - gps.timestamp > GPS_FRESH_MS;
  const lowAccuracy = typeof gps.accuracyMeters === 'number' && gps.accuracyMeters > LOW_ACCURACY_METERS;
  if (stale) return { ...routeEstimate, source: 'route-estimate' as const, stale: true };
  const projection = projectPositionOntoRoute(routePoints(plan), gps);
  const progress = projection?.progress ?? routeEstimate.progress;
  const routeDistance = projection?.totalDistanceKm ?? routeEstimate.routeDistanceKm;
  const track = deriveTrackFromFixes(options.previousGps, gps) ?? projection?.trackDegrees ?? routeEstimate.trackDegrees;
  return {
    position: { ...gps, trackDegrees: track, source: typeof gps.trackDegrees === 'number' ? 'gps' : 'derived-gps' },
    source: typeof gps.trackDegrees === 'number' ? 'gps' as const : 'derived-gps' as const,
    progress,
    distanceKm: routeDistance * progress,
    routeDistanceKm: routeDistance,
    remainingDistanceKm: routeDistance * (1 - progress),
    elapsedMinutes: Math.round(progress * plan.durationMinutes),
    remainingMinutes: Math.max(0, plan.durationMinutes - Math.round(progress * plan.durationMinutes)),
    trackDegrees: track,
    lowAccuracy,
    stale: false,
  };
}

export function searchAirports`, 'GPS-derived flight progress');
await write('src/flight-mode.ts', flight);

let saved = await read('src/saved-trips.ts');
saved = replaceOnce(saved, `import type { CityData, ItineraryItem, PlannerPreferences } from './models.js';`, `import type { CityData, ItineraryItem, Place, PlannerPreferences, VerificationStatus } from './models.js';`, 'saved trip validation imports');
const validators = `
const verificationStatuses = new Set<VerificationStatus>(['Sample', 'Unverified', 'Verified']);
const prayerMethods = new Set(['Muslim World League', 'Egyptian General Authority', 'Umm al-Qura', 'ISNA', 'Turkey Diyanet']);
const datePattern = /^\\d{4}-\\d{2}-\\d{2}$/;
const timePattern = /^\\d{2}:\\d{2}$/;
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);

function isVerificationStatus(value: unknown): value is VerificationStatus {
  return verificationStatuses.has(value as VerificationStatus);
}

function isPlace(value: unknown): value is Place {
  if (!isRecord(value)) return false;
  if (!isString(value.id) || !isString(value.name) || !isString(value.area) || !isString(value.description)) return false;
  if (!['attraction', 'mosque', 'prayer-space', 'restaurant'].includes(String(value.type))) return false;
  if (!isFiniteNumber(value.estimatedMinutes) || value.estimatedMinutes < 0 || !isStringArray(value.interests)) return false;
  if (typeof value.familyFriendly !== 'boolean' || typeof value.indoor !== 'boolean' || !isVerificationStatus(value.verification)) return false;
  if (value.budgetLevel !== undefined && !['low', 'mid', 'high'].includes(String(value.budgetLevel))) return false;
  if (value.facility !== undefined) {
    if (!isRecord(value.facility)) return false;
    if (!isVerificationStatus(value.facility.womenPrayerSpace) || !isVerificationStatus(value.facility.wudu) || !isVerificationStatus(value.facility.accessibility) || !isString(value.facility.notes)) return false;
  }
  return [value.halalSupport, value.evidence].every((entry) => entry === undefined || isString(entry));
}

function isPlannerPreferences(value: unknown): value is PlannerPreferences {
  if (!isRecord(value)) return false;
  return isString(value.city)
    && isString(value.startDate) && datePattern.test(value.startDate)
    && isString(value.endDate) && datePattern.test(value.endDate)
    && isString(value.startHour) && timePattern.test(value.startHour)
    && isString(value.endHour) && timePattern.test(value.endHour)
    && isStringArray(value.interests)
    && isFiniteNumber(value.groupSize) && value.groupSize >= 1
    && typeof value.children === 'boolean'
    && ['low', 'medium', 'high'].includes(String(value.walkingAbility))
    && ['walking', 'public transport', 'taxi'].includes(String(value.transportation))
    && ['low', 'mid', 'high'].includes(String(value.budget))
    && prayerMethods.has(String(value.prayerMethod))
    && ['mosque', 'quiet prayer space', 'flexible'].includes(String(value.prayerPreference))
    && typeof value.womenPrayerRequired === 'boolean'
    && typeof value.wuduRequired === 'boolean'
    && isString(value.accessibilityNeeds)
    && ['strictly labelled', 'vegetarian/seafood options', 'flexible'].includes(String(value.halalPreference));
}

function isItineraryItem(value: unknown): value is ItineraryItem {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && isString(value.date) && datePattern.test(value.date)
    && isString(value.time) && /^(?:\\d{1,2}:\\d{2}|\\d{1,2}:\\d{2}\\s*(?:AM|PM))$/i.test(value.time)
    && isString(value.title)
    && ['travel', 'attraction', 'prayer', 'meal', 'free-time'].includes(String(value.kind))
    && isFiniteNumber(value.durationMinutes) && value.durationMinutes >= 0
    && isString(value.details)
    && isVerificationStatus(value.status)
    && (value.place === undefined || isPlace(value.place));
}

function isLocalCurrency(value: unknown) {
  return isRecord(value) && isString(value.code) && isString(value.symbol) && isString(value.name);
}
`;
saved = replaceOnce(saved, `const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);\n`, `const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);\n${validators}`, 'insert saved-trip validators');
saved = replaceRegex(saved, /export function validateSavedTrip\([\s\S]*?\n}\n\nexport function parseSavedTrips/, `export function validateSavedTrip(value: unknown): SavedTrip | null {
  if (!isRecord(value) || value.schemaVersion !== SAVED_TRIP_SCHEMA_VERSION) return null;
  if (!isString(value.id) || !isString(value.name) || !isString(value.createdAt) || !isString(value.updatedAt) || !isString(value.savedAt)) return null;
  const language = ['en', 'ar', 'ur', 'id', 'ms', 'tr', 'fr'].includes(String(value.language)) ? value.language as Language : 'en';
  if (!isPlannerPreferences(value.preferences) || !isRecord(value.destination) || !Array.isArray(value.itinerary) || !value.itinerary.every(isItineraryItem) || !isRecord(value.dateRange) || !isRecord(value.essentials)) return null;
  const destination = value.destination;
  if (!isString(destination.city) || !isString(destination.country) || !isString(destination.timezone) || !isRecord(destination.coordinates)) return null;
  if (!isFiniteNumber(destination.coordinates.lat) || destination.coordinates.lat < -90 || destination.coordinates.lat > 90 || !isFiniteNumber(destination.coordinates.lng) || destination.coordinates.lng < -180 || destination.coordinates.lng > 180) return null;
  if (!isString(value.dateRange.startDate) || !datePattern.test(value.dateRange.startDate) || !isString(value.dateRange.endDate) || !datePattern.test(value.dateRange.endDate)) return null;
  if (value.dateRange.startDate !== value.preferences.startDate || value.dateRange.endDate !== value.preferences.endDate) return null;
  if (!Array.isArray(value.essentials.localCurrencies) || !value.essentials.localCurrencies.every(isLocalCurrency) || !isFiniteNumber(value.essentials.qiblaBearingFromCityCenter)) return null;
  if (!isRecord(value.essentials.preferenceSummary)) return null;
  const summary = value.essentials.preferenceSummary;
  if (!isFiniteNumber(summary.groupSize) || !['low', 'mid', 'high'].includes(String(summary.budget)) || !['walking', 'public transport', 'taxi'].includes(String(summary.transportation)) || !prayerMethods.has(String(summary.prayerMethod)) || !['strictly labelled', 'vegetarian/seafood options', 'flexible'].includes(String(summary.halalPreference))) return null;
  return {
    ...(value as SavedTrip),
    name: sanitizeTripName(value.name) || 'Saved trip',
    language,
    preferences: value.preferences,
    itinerary: value.itinerary,
    travelDetails: validateTravelDetailsSnapshot(value.travelDetails),
  };
}

export function parseSavedTrips`, 'deep saved-trip validation');
await write('src/saved-trips.ts', saved);

let manifest = await read('mobile/android/AndroidManifest.xml');
manifest = replaceOnce(manifest, `        android:allowBackup="true"`, `        android:allowBackup="false"
        android:fullBackupContent="false"`, 'disable Android backup');
await write('mobile/android/AndroidManifest.xml', manifest);

let playback = await read('mobile/android/java/AthanPlaybackService.java');
playback = replaceOnce(playback, `.setContentTitle(prayer + " prayer")`, `.setContentTitle(prayer)`, 'localized Android Athan title');
await write('mobile/android/java/AthanPlaybackService.java', playback);

await write('ios/App/App/ur.lproj/InfoPlist.strings', `"NSLocationWhenInUseUsageDescription" = "SafarOne آپ کا مقام صرف اس وقت استعمال کرتا ہے جب آپ قبلہ کی سمت یا قریبی سفری مقامات طلب کرتے ہیں۔";
"NSLocationAlwaysAndWhenInUseUsageDescription" = "SafarOne آپ کا مقام صرف اس وقت استعمال کرتا ہے جب آپ قبلہ کی سمت یا قریبی سفری مقامات طلب کرتے ہیں۔";
`);

let project = await read('ios/App/App.xcodeproj/project.pbxproj');
project = project.replaceAll('CURRENT_PROJECT_VERSION = 2;', 'CURRENT_PROJECT_VERSION = 100;');
project = replaceOnce(project, `\t\tB00100072D2D000000000001 /* fr InfoPlist.strings in Resources */ = {isa = PBXBuildFile; fileRef = B00100152D2D000000000001 /* fr InfoPlist.strings */; };`, `\t\tB00100072D2D000000000001 /* fr InfoPlist.strings in Resources */ = {isa = PBXBuildFile; fileRef = B00100152D2D000000000001 /* fr InfoPlist.strings */; };
\t\tB00100082D2D000000000001 /* ur InfoPlist.strings in Resources */ = {isa = PBXBuildFile; fileRef = B00100162D2D000000000001 /* ur InfoPlist.strings */; };`, 'Urdu iOS build resource');
project = replaceOnce(project, `\t\tB00100152D2D000000000001 /* fr InfoPlist.strings */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "fr InfoPlist.strings"; path = fr.lproj/InfoPlist.strings; sourceTree = "<group>"; };`, `\t\tB00100152D2D000000000001 /* fr InfoPlist.strings */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "fr InfoPlist.strings"; path = fr.lproj/InfoPlist.strings; sourceTree = "<group>"; };
\t\tB00100162D2D000000000001 /* ur InfoPlist.strings */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "ur InfoPlist.strings"; path = ur.lproj/InfoPlist.strings; sourceTree = "<group>"; };`, 'Urdu iOS file reference');
project = replaceOnce(project, `\t\t\t\tB00100152D2D000000000001 /* fr InfoPlist.strings */,`, `\t\t\t\tB00100152D2D000000000001 /* fr InfoPlist.strings */,
\t\t\t\tB00100162D2D000000000001 /* ur InfoPlist.strings */,`, 'Urdu iOS app group');
project = replaceOnce(project, `\t\t\t\tfr,\n\t\t\t\tBase,`, `\t\t\t\tfr,
\t\t\t\tur,
\t\t\t\tBase,`, 'Urdu known region');
project = replaceOnce(project, `\t\t\t\tB00100072D2D000000000001 /* fr InfoPlist.strings in Resources */,`, `\t\t\t\tB00100072D2D000000000001 /* fr InfoPlist.strings in Resources */,
\t\t\t\tB00100082D2D000000000001 /* ur InfoPlist.strings in Resources */,`, 'Urdu resource phase');
await write('ios/App/App.xcodeproj/project.pbxproj', project);

await write('scripts/verify-ios-version.mjs', `import { readFile } from 'node:fs/promises';

const project = await readFile(new URL('../ios/App/App.xcodeproj/project.pbxproj', import.meta.url), 'utf8');
const versions = [...project.matchAll(/CURRENT_PROJECT_VERSION = (\\d+);/g)].map((match) => Number(match[1]));
if (versions.length < 2 || versions.some((version) => !Number.isInteger(version) || version < 100) || new Set(versions).size !== 1) {
  console.error('iOS build numbers must match and must be at least 100.', versions);
  process.exit(1);
}
console.log('Verified iOS build number:', versions[0]);
`);

let pkg = JSON.parse(await read('package.json'));
pkg.scripts['ios:version-verify'] = 'node scripts/verify-ios-version.mjs';
pkg.scripts['ios:sync'] = 'npm run ios:version-verify && npm run build:native && npx cap sync ios';
await write('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

let serviceWorker = await read('public/sw.js');
serviceWorker = serviceWorker.replace(`const CACHE_VERSION = 'mtp-app-shell-v14';`, `const CACHE_VERSION = 'mtp-app-shell-v15';`);
await write('public/sw.js', serviceWorker);

await write('src/urdu-i18n.test.ts', `import test from 'node:test';
import assert from 'node:assert/strict';
import { labels, languageDirection, languages, localeForLanguage } from './app-language.js';

test('Urdu is a first-class RTL app language', () => {
  assert.equal(languages.some((language) => language.code === 'ur'), true);
  assert.equal(languageDirection('ur'), 'rtl');
  assert.equal(languageDirection('ar'), 'rtl');
  assert.equal(languageDirection('fr'), 'ltr');
  assert.equal(localeForLanguage('ur'), 'ur-PK');
  assert.equal(localeForLanguage('fr'), 'fr-FR');
  assert.equal(labels.ur.qiblaRequestMotion, 'براہِ راست قطب نما شروع کریں');
});
`);

await write('src/deep-audit-fixes.test.ts', `import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { airportByIata, chooseFlightProgress, createPreparedFlightPlan, positionByDistance, positionByProgress, totalRouteDistanceKm } from './flight-mode.js';
import { createSavedTrip, validateSavedTrip } from './saved-trips.js';
import { getSafeStorage } from './safe-storage.js';
import { cities } from './data.js';

const repoFile = (relative: string) => readFile(new URL(\`../\${relative}\`, import.meta.url), 'utf8');

test('route bearings remain valid at exact waypoints and arrival', () => {
  const points = [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 10 },
    { latitude: 10, longitude: 20 },
  ];
  const firstLeg = totalRouteDistanceKm(points.slice(0, 2));
  const atWaypoint = positionByDistance(points, firstLeg);
  const atArrival = positionByDistance(points, totalRouteDistanceKm(points));
  assert.ok(atWaypoint.trackDegrees > 20 && atWaypoint.trackDegrees < 70);
  assert.ok(atArrival.trackDegrees > 20 && atArrival.trackDegrees < 70);
});

test('fresh GPS position determines flight progress instead of the manual slider', () => {
  const departure = airportByIata('LHR');
  const arrival = airportByIata('JFK');
  assert.ok(departure && arrival);
  const plan = createPreparedFlightPlan({
    departure,
    arrival,
    scheduledDepartureUtc: '2026-07-04T10:00:00.000Z',
    durationMinutes: 420,
    prayerMethod: 'Muslim World League',
    now: '2026-07-04T09:00:00.000Z',
  });
  assert.ok(plan);
  const routePosition = positionByProgress(plan, 0.65, Date.parse('2026-07-04T14:00:00.000Z')).position;
  assert.ok(routePosition);
  const result = chooseFlightProgress(plan, {
    manualProgress: 0.1,
    nowMs: Date.parse('2026-07-04T14:00:00.000Z'),
    gps: { ...routePosition, timestamp: Date.parse('2026-07-04T14:00:00.000Z'), source: 'gps', accuracyMeters: 20 },
  });
  assert.ok(Math.abs(result.progress - 0.65) < 0.03);
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
  assert.ok(validateSavedTrip(valid));
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

console.log('Applied all deep-audit fixes.');
