import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

async function read(path) {
  return readFile(path, 'utf8');
}

async function write(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function edit(path, transform) {
  const before = await read(path);
  const after = transform(before);
  if (after === before) throw new Error(`No changes made to ${path}`);
  await write(path, after);
}

function exact(source, search, replacement, label = search.slice(0, 80)) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`Expected one match for ${label}; found ${count}`);
  return source.replace(search, replacement);
}

function all(source, search, replacement, minimum, label = search.slice(0, 80)) {
  const count = source.split(search).length - 1;
  if (count < minimum) throw new Error(`Expected at least ${minimum} matches for ${label}; found ${count}`);
  return source.split(search).join(replacement);
}

function regex(source, pattern, replacement, label) {
  const matches = source.match(pattern);
  if (!matches) throw new Error(`Missing regex match for ${label}`);
  return source.replace(pattern, replacement);
}

const hanafiSuffix = ' (Hanafi Asr)';
const baseMethods = ['Muslim World League', 'Egyptian General Authority', 'Umm al-Qura', 'ISNA', 'Turkey Diyanet'];
const allMethods = [...baseMethods, ...baseMethods.map((method) => `${method}${hanafiSuffix}`)];
const prayerMethodUnion = allMethods.map((method) => `'${method}'`).join(' | ');
const prayerMethodArray = allMethods.map((method) => `'${method}'`).join(', ');

await edit('ios/App/App.xcodeproj/project.pbxproj', (source) => {
  const count = source.split('CURRENT_PROJECT_VERSION = 100;').length - 1;
  if (count !== 2) throw new Error(`Expected two iOS build-number entries; found ${count}`);
  return source.split('CURRENT_PROJECT_VERSION = 100;').join('CURRENT_PROJECT_VERSION = 101;');
});

await edit('scripts/verify-ios-version.mjs', (source) => source
  .replace('version < 100', 'version < 101')
  .replace('must be at least 100', 'must be at least 101'));

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
let persistentStorageAvailable = false;

export function getSafeStorage(): Storage {
  if (typeof window === 'undefined') {
    persistentStorageAvailable = false;
    return fallbackStorage ??= new MemoryStorage();
  }
  try {
    const storage = window.localStorage;
    const probe = '__safarone_storage_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    persistentStorageAvailable = true;
    return storage;
  } catch {
    persistentStorageAvailable = false;
    return fallbackStorage ??= new MemoryStorage();
  }
}

export function isPersistentStorageAvailable() {
  getSafeStorage();
  return persistentStorageAvailable;
}
`);

await edit('src/models.ts', (source) => exact(
  source,
  "export type PrayerMethod = 'Muslim World League' | 'Egyptian General Authority' | 'Umm al-Qura' | 'ISNA' | 'Turkey Diyanet';",
  `export type PrayerMethod = ${prayerMethodUnion};`,
  'PrayerMethod union',
));

await edit('src/athan.ts', (source) => {
  source = exact(source, '  HighLatitudeRule,\n  PrayerTimes,', '  HighLatitudeRule,\n  Madhab,\n  PrayerTimes,', 'adhan Madhab import');
  source = exact(source, "const NATIVE_DEFAULT_SOUND = 'default';", "const NATIVE_DEFAULT_SOUND = 'default';\nconst MAX_IOS_PENDING_NOTIFICATIONS = 64;", 'native notification limit');
  source = regex(source, /function methodParameters\(method: PrayerMethod\) \{[\s\S]*?\n\}\n\nfunction parseIsoDate/, `function methodParameters(method: PrayerMethod) {
  const hanafi = method.endsWith('${hanafiSuffix}');
  const baseMethod = method.replace('${hanafiSuffix}', '') as PrayerMethod;
  const parameters = (() => {
    switch (baseMethod) {
      case 'Egyptian General Authority': return CalculationMethod.Egyptian();
      case 'Umm al-Qura': return CalculationMethod.UmmAlQura();
      case 'ISNA': return CalculationMethod.NorthAmerica();
      case 'Turkey Diyanet': return CalculationMethod.Turkey();
      case 'Muslim World League':
      default: return CalculationMethod.MuslimWorldLeague();
    }
  })();
  parameters.madhab = hanafi ? Madhab.Hanafi : Madhab.Shafi;
  return parameters;
}

function parseIsoDate`, 'athan method parameters');

  const androidOld = `  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    const permissions = await LocalNotifications.requestPermissions();
    if (permissions.display !== 'granted') {
      return {
        mode: 'native' as const,
        scheduled: 0,
        permissions: { exactAlarmAllowed: false, notificationsAllowed: false },
      };
    }
    let audioReady = false;
    try {
      audioReady = (await AndroidAthan.prepare({ audioUrl: ATHAN_AUDIO_URL })).ready;
    } catch {
      audioReady = false;
    }
    const alarmPermissions = await AndroidAthan.requestPermissions();
    const copy = copyFor(language);
    const now = Date.now();
    const payload = alarms
      .filter((alarm) => alarm.timestamp > now + 1000)
      .slice(0, 60)
      .map((alarm) => ({
        id: nativeNotificationId(alarm),
        timestamp: alarm.timestamp,
        prayer: \`${'${copy.prayer[alarm.prayer]}'} ${'${copy.title}'}\`,
        city: \`${'${alarm.city}'} · ${'${alarm.formattedTime}'}\`,
        audioReady,
      }));
    const result = payload.length ? await AndroidAthan.schedule({ alarms: payload }) : { scheduled: 0 };
    const exactAlarmAllowed = alarmPermissions.exactAlarmAllowed;
    return {
      mode: 'native' as const,
      scheduled: result.scheduled,
      permissions: { exactAlarmAllowed, notificationsAllowed: true },
    };
  }
`;
  const androidNew = `  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    const permissions = await LocalNotifications.requestPermissions();
    const now = Date.now();
    const future = alarms.filter((alarm) => alarm.timestamp > now + 1000);
    if (permissions.display !== 'granted') {
      return {
        mode: 'native' as const,
        scheduled: 0,
        requested: future.length,
        permissions: { exactAlarmAllowed: false, notificationsAllowed: false },
      };
    }
    let audioReady = false;
    try {
      audioReady = (await AndroidAthan.prepare({ audioUrl: ATHAN_AUDIO_URL })).ready;
    } catch {
      audioReady = false;
    }
    const alarmPermissions = await AndroidAthan.requestPermissions();
    if (!alarmPermissions.exactAlarmAllowed) {
      return {
        mode: 'native' as const,
        scheduled: 0,
        requested: future.length,
        permissions: { exactAlarmAllowed: false, notificationsAllowed: true },
      };
    }
    const copy = copyFor(language);
    const payload = future.map((alarm) => ({
      id: nativeNotificationId(alarm),
      timestamp: alarm.timestamp,
      prayer: \`${'${copy.prayer[alarm.prayer]}'} ${'${copy.title}'}\`,
      city: \`${'${alarm.city}'} · ${'${alarm.formattedTime}'}\`,
      language,
      audioReady,
    }));
    const result = payload.length ? await AndroidAthan.schedule({ alarms: payload }) : { scheduled: 0 };
    return {
      mode: 'native' as const,
      scheduled: result.scheduled,
      requested: future.length,
      permissions: { exactAlarmAllowed: true, notificationsAllowed: true },
    };
  }
`;
  source = exact(source, androidOld, androidNew, 'Android prayer scheduling block');

  source = exact(source,
    `    const notifications = alarms
      .filter((alarm) => alarm.timestamp > now + 1000)
      .slice(0, 60)
      .map((alarm) => ({`,
    `    const future = alarms.filter((alarm) => alarm.timestamp > now + 1000);
    const notifications = future
      .slice(0, MAX_IOS_PENDING_NOTIFICATIONS)
      .map((alarm) => ({`,
    'iOS prayer notification cap');
  source = exact(source,
    `      scheduled: notifications.length,
      permissions: { exactAlarmAllowed, notificationsAllowed: true },`,
    `      scheduled: notifications.length,
      requested: future.length,
      permissions: { exactAlarmAllowed, notificationsAllowed: true },`,
    'iOS requested count');
  source = exact(source,
    `    scheduled: browserTimers.length,
    permissions: {`,
    `    scheduled: browserTimers.length,
    requested: alarms.filter((alarm) => alarm.timestamp > Date.now()).length,
    permissions: {`,
    'browser requested count');
  source = exact(source, '    await AndroidAthan.test();', '    await AndroidAthan.test({ language });', 'localized Android test');
  return source;
});

await edit('src/android-athan.ts', (source) => source
  .replace('  audioReady?: boolean;\n', '  audioReady?: boolean;\n  language?: string;\n')
  .replace('  test(): Promise<void>;\n', '  test(options: { language: string }): Promise<void>;\n'));

await edit('src/inflight-prayer.ts', (source) => {
  source = exact(source, '  HighLatitudeRule,\n  PrayerTimes,', '  HighLatitudeRule,\n  Madhab,\n  PrayerTimes,', 'inflight Madhab import');
  return regex(source, /function methodParameters\(method: PrayerMethod\) \{[\s\S]*?\n\}\n\nfunction prayerTimesForDate/, `function methodParameters(method: PrayerMethod) {
  const hanafi = method.endsWith('${hanafiSuffix}');
  const baseMethod = method.replace('${hanafiSuffix}', '') as PrayerMethod;
  const parameters = (() => {
    switch (baseMethod) {
      case 'Egyptian General Authority': return CalculationMethod.Egyptian();
      case 'Umm al-Qura': return CalculationMethod.UmmAlQura();
      case 'ISNA': return CalculationMethod.NorthAmerica();
      case 'Turkey Diyanet': return CalculationMethod.Turkey();
      case 'Muslim World League':
      default: return CalculationMethod.MuslimWorldLeague();
    }
  })();
  parameters.madhab = hanafi ? Madhab.Hanafi : Madhab.Shafi;
  return parameters;
}

function prayerTimesForDate`, 'inflight method parameters');
});

await edit('src/flight-mode.ts', (source) => {
  source = exact(source,
    "  const gps = options.gps;\n  if (!gps || !validCoordinate(gps.latitude, gps.longitude)) return routeEstimate;",
    `  const gps = options.gps;
  if (!gps || !validCoordinate(gps.latitude, gps.longitude)) return routeEstimate;
  const scheduledStart = Date.parse(plan.scheduledDepartureUtc);
  const scheduledEnd = scheduledStart + plan.durationMinutes * 60_000;
  const flightWindowPadding = 2 * 60 * 60 * 1000;
  if (Number.isFinite(scheduledStart) && (nowMs < scheduledStart - flightWindowPadding || nowMs > scheduledEnd + flightWindowPadding)) return routeEstimate;`,
    'flight GPS schedule guard');
  source = exact(source,
    "  const prayerMethod = ['Muslim World League', 'Egyptian General Authority', 'Umm al-Qura', 'ISNA', 'Turkey Diyanet'].includes(String(record.prayerMethod)) ? record.prayerMethod as PrayerMethod : 'Muslim World League';",
    `  const prayerMethod = [${prayerMethodArray}].includes(String(record.prayerMethod)) ? record.prayerMethod as PrayerMethod : 'Muslim World League';`,
    'flight prayer method validation');
  return source;
});

await edit('src/saved-trips.ts', (source) => exact(
  source,
  "const prayerMethods = new Set(['Muslim World League', 'Egyptian General Authority', 'Umm al-Qura', 'ISNA', 'Turkey Diyanet']);",
  `const prayerMethods = new Set([${prayerMethodArray}]);`,
  'saved-trip prayer method validation',
));

await edit('src/main.ts', (source) => {
  source = exact(source,
    "import type { ItineraryItem, PlannerPreferences, PrayerName, Region, VerificationStatus } from './models.js';",
    "import type { ItineraryItem, PlannerPreferences, PrayerMethod, PrayerName, Region, VerificationStatus } from './models.js';",
    'main PrayerMethod import');
  source = exact(source,
    "import { getSafeStorage } from './safe-storage.js';",
    "import { getSafeStorage, isPersistentStorageAvailable } from './safe-storage.js';",
    'persistent storage import');
  source = exact(source,
    `function setAppLanguage(value: unknown) {
  const parsed = parseLanguage(value);
  if (!parsed) return false;
  lang = parsed;
  appStorage.setItem('mtp-language', lang);
  return true;
}`,
    `function setAppLanguage(value: unknown) {
  const parsed = parseLanguage(value);
  if (!parsed) return false;
  const changed = parsed !== lang;
  lang = parsed;
  appStorage.setItem('mtp-language', lang);
  if (changed && generatedPrefs) {
    generatedItems = generateItinerary(generatedPrefs, replan, lang);
    if (openedSavedTripId) savedTripStatus = 'unsaved';
    athanStatus = '';
  }
  return true;
}`,
    'central language handling');
  source = exact(source,
    "const prayerMethods = ['Muslim World League', 'Egyptian General Authority', 'Umm al-Qura', 'ISNA', 'Turkey Diyanet'] as const;\nconst prayerOrder: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];",
    `const prayerMethods = [${prayerMethodArray}] as const;
const prayerOrder: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const temporaryStorageNotice: Record<Language, string> = {
  en: 'Temporary session storage is in use. Saved information will be lost when the app or page closes.',
  ar: 'يُستخدم تخزين مؤقت لهذه الجلسة. ستفقد المعلومات المحفوظة عند إغلاق التطبيق أو الصفحة.',
  ur: 'عارضی سیشن اسٹوریج استعمال ہو رہی ہے۔ ایپ یا صفحہ بند ہونے پر محفوظ معلومات ختم ہو جائیں گی۔',
  id: 'Penyimpanan sesi sementara sedang digunakan. Data tersimpan akan hilang saat aplikasi atau halaman ditutup.',
  ms: 'Storan sesi sementara sedang digunakan. Maklumat yang disimpan akan hilang apabila aplikasi atau halaman ditutup.',
  tr: 'Geçici oturum depolaması kullanılıyor. Uygulama veya sayfa kapatılınca kaydedilen bilgiler silinir.',
  fr: 'Le stockage temporaire de session est utilisé. Les informations enregistrées seront perdues à la fermeture de l’application ou de la page.',
};

const itineraryKindLabels: Record<Language, Record<ItineraryItem['kind'], string>> = {
  en: { travel: 'Travel', attraction: 'Attraction', prayer: 'Prayer', meal: 'Meal', 'free-time': 'Free time' },
  ar: { travel: 'انتقال', attraction: 'معلم', prayer: 'صلاة', meal: 'وجبة', 'free-time': 'وقت حر' },
  ur: { travel: 'سفر', attraction: 'سیاحتی مقام', prayer: 'نماز', meal: 'کھانا', 'free-time': 'فارغ وقت' },
  id: { travel: 'Perjalanan', attraction: 'Atraksi', prayer: 'Salat', meal: 'Makan', 'free-time': 'Waktu bebas' },
  ms: { travel: 'Perjalanan', attraction: 'Tarikan', prayer: 'Solat', meal: 'Makan', 'free-time': 'Masa lapang' },
  tr: { travel: 'Ulaşım', attraction: 'Gezi noktası', prayer: 'Namaz', meal: 'Yemek', 'free-time': 'Serbest zaman' },
  fr: { travel: 'Trajet', attraction: 'Attraction', prayer: 'Prière', meal: 'Repas', 'free-time': 'Temps libre' },
};

const prayerMethodBaseLabels: Record<Language, Record<string, string>> = {
  en: { 'Muslim World League': 'Muslim World League', 'Egyptian General Authority': 'Egyptian General Authority', 'Umm al-Qura': 'Umm al-Qura', ISNA: 'ISNA', 'Turkey Diyanet': 'Turkey Diyanet' },
  ar: { 'Muslim World League': 'رابطة العالم الإسلامي', 'Egyptian General Authority': 'الهيئة المصرية العامة للمساحة', 'Umm al-Qura': 'أم القرى', ISNA: 'الجمعية الإسلامية لأمريكا الشمالية', 'Turkey Diyanet': 'رئاسة الشؤون الدينية التركية' },
  ur: { 'Muslim World League': 'مسلم ورلڈ لیگ', 'Egyptian General Authority': 'مصری جنرل اتھارٹی', 'Umm al-Qura': 'ام القریٰ', ISNA: 'اسلامک سوسائٹی آف نارتھ امریکہ', 'Turkey Diyanet': 'ترکی دیانت' },
  id: { 'Muslim World League': 'Liga Muslim Dunia', 'Egyptian General Authority': 'Otoritas Umum Mesir', 'Umm al-Qura': 'Umm al-Qura', ISNA: 'ISNA', 'Turkey Diyanet': 'Diyanet Turki' },
  ms: { 'Muslim World League': 'Liga Muslim Sedunia', 'Egyptian General Authority': 'Pihak Berkuasa Am Mesir', 'Umm al-Qura': 'Umm al-Qura', ISNA: 'ISNA', 'Turkey Diyanet': 'Diyanet Turki' },
  tr: { 'Muslim World League': 'Dünya İslam Birliği', 'Egyptian General Authority': 'Mısır Genel Otoritesi', 'Umm al-Qura': 'Ümmül Kura', ISNA: 'ISNA', 'Turkey Diyanet': 'Türkiye Diyanet' },
  fr: { 'Muslim World League': 'Ligue islamique mondiale', 'Egyptian General Authority': 'Autorité générale égyptienne', 'Umm al-Qura': 'Umm al-Qura', ISNA: 'ISNA', 'Turkey Diyanet': 'Diyanet de Turquie' },
};

const hanafiLabels: Record<Language, string> = { en: 'Hanafi Asr', ar: 'عصر حنفي', ur: 'حنفی عصر', id: 'Asar Hanafi', ms: 'Asar Hanafi', tr: 'Hanefi İkindi', fr: 'Asr hanafite' };
function prayerMethodLabel(method: PrayerMethod, language: Language) {
  const hanafi = method.endsWith('${hanafiSuffix}');
  const base = method.replace('${hanafiSuffix}', '');
  return \`${'${prayerMethodBaseLabels[language][base] ?? base}'}${'${hanafi ? ` — ${hanafiLabels[language]}` : ``}'}\`;
}
function prayerMethodOptions(language: Language) {
  return Object.fromEntries(prayerMethods.map((method) => [method, prayerMethodLabel(method, language)])) as Record<(typeof prayerMethods)[number], string>;
}`,
    'localized prayer-method and kind labels');

  source = exact(source,
    `let flightLatestGps: FlightPosition | undefined;
let flightPreviousGps: FlightPosition | undefined;`,
    `let flightLatestGps: FlightPosition | undefined;
let flightPreviousGps: FlightPosition | undefined;
let flightClockTimer: number | undefined;`,
    'flight clock state');

  source = exact(source,
    `function stopFlightGpsWatch() {
  flightWatchSequence += 1;`,
    `function stopFlightClock() {
  if (flightClockTimer) window.clearTimeout(flightClockTimer);
  flightClockTimer = undefined;
}

function scheduleFlightClock() {
  stopFlightClock();
  if (view !== 'flight-mode' || !preparedFlightPlan || flightEditing || flightGpsEnabled || document.hidden) return;
  flightClockTimer = window.setTimeout(() => {
    if (view !== 'flight-mode' || !preparedFlightPlan || flightEditing || flightGpsEnabled) return;
    flightManualProgress = elapsedProgress(preparedFlightPlan);
    flightModePage();
  }, 30_000);
}

function stopFlightGpsWatch() {
  flightWatchSequence += 1;`,
    'flight clock functions');

  source = exact(source,
    `function flightModePage() {
  if (!root) return;`,
    `function flightModePage() {
  stopFlightClock();
  if (!root) return;`,
    'flight page clock reset');
  source = regex(source, /function flightModePage\(\) \{[\s\S]*?\n  bindFlightMode\(\);\n\}/, (block) => block.replace('  bindFlightMode();\n}', '  bindFlightMode();\n  scheduleFlightClock();\n}'), 'flight page clock scheduling');

  source = exact(source,
    `  if (document.hidden) {
    if (qiblaAnimationFrame) {`,
    `  if (document.hidden) {
    stopFlightClock();
    if (qiblaAnimationFrame) {`,
    'visibility flight clock stop');
  source = exact(source,
    `  if (view === 'qibla') scheduleQiblaLiveUpdate();
});`,
    `  if (view === 'qibla') scheduleQiblaLiveUpdate();
  if (view === 'flight-mode') scheduleFlightClock();
});`,
    'visibility flight clock resume');

  source = exact(source,
    `type PrayerCenter = { latitude: number; longitude: number; label: string; timezone?: string };`,
    `type PrayerCenter = { latitude: number; longitude: number; label: string; timezone?: string; city?: string; country?: string };`,
    'prayer center metadata');
  source = exact(source,
    `type NominatimResult = { lat: string; lon: string; display_name: string };`,
    `type NominatimResult = { lat: string; lon: string; display_name: string; address?: { city?: string; town?: string; village?: string; municipality?: string; county?: string; state?: string; country?: string } };`,
    'Nominatim address details');
  source = exact(source,
    `function reportCenterDetails(center: PrayerCenter | undefined) {
  const parts = (center?.label ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  return {
    city: parts[0] || selectedCity().city,
    country: parts.slice(1).join(', ') || selectedCity().country,
  };
}`,
    `function reportCenterDetails(center: PrayerCenter | undefined) {
  const parts = (center?.label ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  return {
    city: center?.city || parts.at(-2) || selectedCity().city,
    country: center?.country || parts.at(-1) || selectedCity().country,
  };
}`,
    'report center extraction');
  source = exact(source,
    `  const url = \`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=en&q=${'${encodeURIComponent(trimmed)}'}\`;`,
    `  const url = \`https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&accept-language=en&q=${'${encodeURIComponent(trimmed)}'}\`;`,
    'Nominatim addressdetails');
  source = exact(source,
    `  const center = first && Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude, label: first.display_name, timezone: await resolveTimeZoneForCoordinates(latitude, longitude) }
    : undefined;`,
    `  const center = first && Number.isFinite(latitude) && Number.isFinite(longitude)
    ? {
      latitude,
      longitude,
      label: first.display_name,
      city: first.address?.city || first.address?.town || first.address?.village || first.address?.municipality || first.address?.county || first.address?.state,
      country: first.address?.country,
      timezone: await resolveTimeZoneForCoordinates(latitude, longitude),
    }
    : undefined;`,
    'resolved destination metadata');

  source = exact(source,
    `function field(name: keyof PlannerPreferences, value: string, label: string, type = 'text', placeholder = '') {
  return \`<label>${'${label}'}<input data-field="${'${String(name)}'}" type="${'${type}'}" value="${'${esc(value)}'}" ${'${placeholder ? `placeholder="${esc(placeholder)}"` : ``}'} /></label>\`;
}`,
    `function field(name: keyof PlannerPreferences, value: string, label: string, type = 'text', placeholder = '') {
  const required = ['date', 'time', 'number'].includes(type) ? 'required' : '';
  return \`<label>${'${label}'}<input data-field="${'${String(name)}'}" type="${'${type}'}" value="${'${esc(value)}'}" ${'${required}'} ${'${placeholder ? `placeholder="${esc(placeholder)}"` : ``}'} /></label>\`;
}`,
    'required planner fields');

  source = exact(source,
    `function appFooterMarkup(copy: typeof labels[Language]) {
  return \`<footer class="app-footer">
    <p>${'${copy.developerCredit}'}</p>`,
    `function appFooterMarkup(copy: typeof labels[Language]) {
  return \`<footer class="app-footer">
    ${'${isPersistentStorageAvailable() ? `` : `<p class="warning" role="status">${esc(temporaryStorageNotice[lang])}</p>`}'}
    <p>${'${copy.developerCredit}'}</p>`,
    'temporary storage footer warning');

  source = exact(source,
    `<span>${'${esc(item.kind)}'}</span>`,
    `<span>${'${esc(itineraryKindLabels[lang][item.kind])}'}</span>`,
    'localized itinerary kind');
  source = all(source,
    `Object.fromEntries(prayerMethods.map((method) => [method, method])) as Record<(typeof prayerMethods)[number], string>`,
    `prayerMethodOptions(lang)`,
    1,
    'localized prayer method options');
  source = exact(source,
    `>${'${esc(method)}'}</option>`,
    `>${'${esc(prayerMethodLabel(method, lang))}'}</option>`,
    'localized flight prayer method option');
  source = exact(source,
    `<p><strong>${'${copy.flightMethod}'}:</strong> ${'${plan.prayerMethod}'}</p>`,
    `<p><strong>${'${copy.flightMethod}'}:</strong> ${'${esc(prayerMethodLabel(plan.prayerMethod, lang))}'}</p>`,
    'localized flight prayer method display');

  source = exact(source,
    `function plannerValidationMessage(planPrefs: PlannerPreferences, copy: typeof labels[Language]) {
  if (!cityForPreferences(planPrefs)) return copy.invalidCity;
  if (!Number.isFinite(planPrefs.groupSize) || planPrefs.groupSize < 1) return copy.invalidGroupSize;
  if (planPrefs.startDate && planPrefs.endDate && planPrefs.endDate < planPrefs.startDate) return copy.invalidEndDate;`,
    `function plannerValidationMessage(planPrefs: PlannerPreferences, copy: typeof labels[Language]) {
  const validDate = (value: string) => /^\\d{4}-\\d{2}-\\d{2}$/.test(value) && Number.isFinite(new Date(\`${'${value}'}T00:00:00\`).getTime());
  const validTime = (value: string) => /^(?:[01]\\d|2[0-3]):[0-5]\\d$/.test(value);
  if (!cityForPreferences(planPrefs)) return copy.invalidCity;
  if (!validDate(planPrefs.startDate) || !validDate(planPrefs.endDate)) return copy.invalidEndDate;
  if (!validTime(planPrefs.startHour) || !validTime(planPrefs.endHour)) return copy.invalidEndTime;
  if (!Number.isFinite(planPrefs.groupSize) || planPrefs.groupSize < 1) return copy.invalidGroupSize;
  if (planPrefs.endDate < planPrefs.startDate) return copy.invalidEndDate;`,
    'strict planner validation');

  source = exact(source,
    `      athanEnabled = result.scheduled > 0 && result.permissions.notificationsAllowed;
      appStorage.setItem('athanEnabled', String(athanEnabled));
      athanStatus = athanEnabled ? \`${'${copy.scheduled}'}: ${'${result.scheduled}'}\` : copy.failed;`,
    `      athanEnabled = result.scheduled > 0 && result.permissions.notificationsAllowed;
      appStorage.setItem('athanEnabled', String(athanEnabled));
      athanStatus = athanEnabled
        ? \`${'${copy.scheduled}'}: ${'${result.scheduled}'}/${'${result.requested}'}\`
        : !result.permissions.exactAlarmAllowed && result.permissions.notificationsAllowed ? copy.permissionNote : copy.failed;`,
    'honest prayer scheduling status');

  source = exact(source,
    `    savedTripStatus = 'saved';
    savedTripMessage = copy.savedLocally;
    plannerAnnouncement = copy.savedLocally;`,
    `    const persistent = isPersistentStorageAvailable();
    savedTripStatus = persistent ? 'saved' : 'unsaved';
    savedTripMessage = persistent ? copy.savedLocally : temporaryStorageNotice[lang];
    plannerAnnouncement = savedTripMessage;`,
    'temporary storage save status');
  source = exact(source,
    `${'${savedTripStatus === `failed` ? `<p class="error" id="saved-trip-inline-status">${esc(savedTripMessage || copy.saveFailed)}</p>` : `<p class="status" id="saved-trip-inline-status">${saved ? copy.savedStatus : unsaved ? copy.unsavedChanges : copy.savedLocally}</p>`}'}`,
    `${'${!isPersistentStorageAvailable() ? `<p class="warning" id="saved-trip-inline-status">${esc(temporaryStorageNotice[lang])}</p>` : savedTripStatus === `failed` ? `<p class="error" id="saved-trip-inline-status">${esc(savedTripMessage || copy.saveFailed)}</p>` : `<p class="status" id="saved-trip-inline-status">${saved ? copy.savedStatus : unsaved ? copy.unsavedChanges : copy.savedLocally}</p>`}'}`,
    'trip header storage warning');
  source = exact(source,
    `<p class="notice">${'${copy.savedLocally}'}. ${'${copy.noCloudSync}'}.</p>`,
    `<p class="notice">${'${isPersistentStorageAvailable() ? `${copy.savedLocally}. ${copy.noCloudSync}.` : esc(temporaryStorageNotice[lang])}'}</p>`,
    'saved trips storage warning');

  const oldSavedAttractions = `const SAVED_ATTRACTIONS_KEY = 'mtp-saved-attractions-v1';
function readSavedAttractionIds() {
  try {
    const value = JSON.parse(appStorage.getItem(SAVED_ATTRACTIONS_KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set<string>();
  }
}
let savedAttractionIds = readSavedAttractionIds();
function persistSavedAttractionIds() {
  appStorage.setItem(SAVED_ATTRACTIONS_KEY, JSON.stringify([...savedAttractionIds]));
}`;
  const newSavedAttractions = `const SAVED_ATTRACTIONS_KEY = 'mtp-saved-attractions-v2';
type SavedAttractionSnapshot = Pick<Attraction, 'id' | 'name' | 'originalName' | 'category' | 'latitude' | 'longitude' | 'address' | 'sourceUrl' | 'readMoreUrl'> & { city: string; country: string; savedAt: string };
function readSavedAttractions() {
  try {
    const value = JSON.parse(appStorage.getItem(SAVED_ATTRACTIONS_KEY) ?? '[]') as unknown;
    if (!Array.isArray(value)) return new Map<string, SavedAttractionSnapshot>();
    const valid = value.filter((item): item is SavedAttractionSnapshot => Boolean(item && typeof item === 'object' && typeof (item as SavedAttractionSnapshot).id === 'string' && typeof (item as SavedAttractionSnapshot).name === 'string'));
    return new Map(valid.map((item) => [item.id, item]));
  } catch {
    return new Map<string, SavedAttractionSnapshot>();
  }
}
let savedAttractions = readSavedAttractions();
function persistSavedAttractions() {
  appStorage.setItem(SAVED_ATTRACTIONS_KEY, JSON.stringify([...savedAttractions.values()]));
}
function savedAttractionSnapshot(attraction: Attraction): SavedAttractionSnapshot {
  const location = reportCenterDetails(attractionCenter);
  return { id: attraction.id, name: attraction.name, originalName: attraction.originalName, category: attraction.category, latitude: attraction.latitude, longitude: attraction.longitude, address: attraction.address, sourceUrl: attraction.sourceUrl, readMoreUrl: attraction.readMoreUrl, city: location.city, country: location.country, savedAt: new Date().toISOString() };
}
function savedAttractionsMarkup(copy: typeof labels[Language]) {
  const items = [...savedAttractions.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  if (!items.length) return '';
  return \`<section class="saved-attractions"><h3>${'${copy.attractionsSaved}'}</h3><div class="place-list">${'${items.map((item) => `<article class="card"><div class="card-top"><span>${esc(attractionCategoryLabel(item.category, copy))}</span><span>${esc(item.city)}, ${esc(item.country)}</span></div><h4>${esc(item.name)}</h4>${item.address ? `<p>${esc(item.address)}</p>` : ``}<div class="place-actions"><button type="button" class="ghost" data-attraction-save="${esc(item.id)}" aria-pressed="true">${copy.attractionsSaved}</button><a class="map-link" href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${copy.prayerViewOnMap}</a>${item.readMoreUrl ? `<a class="map-link" href="${esc(item.readMoreUrl)}" target="_blank" rel="noopener noreferrer">${copy.attractionsReadMore}</a>` : ``}</div></article>`).join(``)}'}</div></section>\`;
}`;
  source = exact(source, oldSavedAttractions, newSavedAttractions, 'saved attraction snapshots');
  source = all(source, 'savedAttractionIds.has(', 'savedAttractions.has(', 2, 'saved attraction membership');
  source = exact(source, '${selectedAttractionDetail(copy)}', '${savedAttractionsMarkup(copy)}\n      ${selectedAttractionDetail(copy)}', 'saved attractions section');
  source = exact(source,
    `  document.querySelectorAll<HTMLButtonElement>('[data-attraction-save]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.attractionSave;
    if (!id) return;
    if (savedAttractionIds.has(id)) savedAttractionIds.delete(id);
    else savedAttractionIds.add(id);
    persistSavedAttractionIds();
    button.setAttribute('aria-pressed', String(savedAttractionIds.has(id)));
    button.textContent = savedAttractionIds.has(id) ? labels[lang].attractionsSaved : labels[lang].attractionsSave;
  }));`,
    `  document.querySelectorAll<HTMLButtonElement>('[data-attraction-save]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.attractionSave;
    if (!id) return;
    if (savedAttractions.has(id)) savedAttractions.delete(id);
    else {
      const attraction = attractionResults.find((candidate) => candidate.id === id);
      if (!attraction) return;
      savedAttractions.set(id, savedAttractionSnapshot(attraction));
    }
    persistSavedAttractions();
    attractionsPage();
  }));`,
    'saved attraction toggle');

  source = exact(source,
    `  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => {
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
  });`,
    `  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => {
    if (!setAppLanguage((event.target as HTMLSelectElement).value)) return;
    render();
  });`,
    'main language handler');

  source = exact(source,
    `  if (view !== 'flight-mode') stopFlightGpsWatch();`,
    `  if (view !== 'flight-mode') {
    stopFlightGpsWatch();
    stopFlightClock();
  }`,
    'render flight cleanup');
  return source;
});

await edit('mobile/android/java/AthanAlarmPlugin.java', (source) => {
  source = exact(source, 'import java.io.FileOutputStream;\nimport java.io.InputStream;', 'import java.io.FileInputStream;\nimport java.io.FileOutputStream;\nimport java.io.InputStream;', 'Java file input import');
  source = exact(source,
    '    private static final int NOTIFICATION_PERMISSION_REQUEST = 8841;\n    private final ExecutorService executor = Executors.newSingleThreadExecutor();',
    '    private static final int NOTIFICATION_PERMISSION_REQUEST = 8841;\n    private static final long MIN_AUDIO_BYTES = 50_000L;\n    private static final long MAX_AUDIO_BYTES = 8_000_000L;\n    private final ExecutorService executor = Executors.newSingleThreadExecutor();',
    'Athan audio limits');
  source = exact(source,
    `                File destination = new File(getContext().getFilesDir(), "athan.mp3");
                if (!destination.exists() || destination.length() < 50_000) {
                    File temporary = new File(getContext().getCacheDir(), "athan-download.tmp");
                    download(audioUrl, temporary);
                    if (destination.exists() && !destination.delete()) {
                        throw new IllegalStateException("Could not replace the Athan audio file.");
                    }
                    if (!temporary.renameTo(destination)) {
                        copyFile(temporary, destination);
                        temporary.delete();
                    }
                }
                preferences(getContext()).edit().putString(KEY_AUDIO_PATH, destination.getAbsolutePath()).apply();`,
    `                File destination = new File(getContext().getFilesDir(), "athan.mp3");
                if (!isValidAudioFile(destination)) {
                    File temporary = new File(getContext().getCacheDir(), "athan-download.tmp");
                    if (temporary.exists()) temporary.delete();
                    try {
                        download(audioUrl, temporary);
                        if (!isValidAudioFile(temporary)) throw new IllegalStateException("Downloaded Athan audio is invalid.");
                        if (destination.exists() && !destination.delete()) throw new IllegalStateException("Could not replace the Athan audio file.");
                        if (!temporary.renameTo(destination)) copyFile(temporary, destination);
                    } finally {
                        if (temporary.exists()) temporary.delete();
                    }
                }
                preferences(getContext()).edit().putString(KEY_AUDIO_PATH, destination.getAbsolutePath()).apply();`,
    'validated Athan preparation');
  source = exact(source,
    `                String city = alarm.optString("city", "");
                boolean audioReady = alarm.optBoolean("audioReady", false);
                scheduleOne(getContext(), id, timestamp, prayer, city, audioReady);`,
    `                String city = alarm.optString("city", "");
                String language = alarm.optString("language", "en");
                boolean audioReady = alarm.optBoolean("audioReady", false);
                scheduleOne(getContext(), id, timestamp, prayer, city, language, audioReady);`,
    'alarm language scheduling');
  source = regex(source, /    @PluginMethod\n    public void pending\(PluginCall call\) \{[\s\S]*?\n    \}\n\n    @PluginMethod\n    public void cancelAll/, `    @PluginMethod
    public void pending(PluginCall call) {
        int scheduled = 0;
        try {
            String encoded = preferences(getContext()).getString(KEY_ALARMS, "[]");
            JSONArray alarms = new JSONArray(encoded);
            JSONArray active = new JSONArray();
            long now = System.currentTimeMillis();
            for (int index = 0; index < alarms.length(); index += 1) {
                JSONObject alarm = alarms.getJSONObject(index);
                int id = alarm.optInt("id", index + 1);
                if (alarm.optLong("timestamp", 0L) <= now) continue;
                Intent intent = new Intent(getContext(), AthanReceiver.class);
                PendingIntent pendingIntent = PendingIntent.getBroadcast(getContext(), id, intent, PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
                if (pendingIntent == null) continue;
                active.put(alarm);
                scheduled += 1;
            }
            preferences(getContext()).edit().putString(KEY_ALARMS, active.toString()).apply();
        } catch (Exception ignored) {}
        call.resolve(new JSObject().put("scheduled", scheduled));
    }

    @PluginMethod
    public void cancelAll`, 'verified pending alarms');
  source = exact(source,
    `        Intent intent = new Intent(getContext(), AthanPlaybackService.class);
        intent.putExtra("prayer", "Test Athan");
        intent.putExtra("city", "Muslim Travel Planner");`,
    `        Intent intent = new Intent(getContext(), AthanPlaybackService.class);
        intent.putExtra("prayer", "Test Athan");
        intent.putExtra("city", "SafarOne");
        intent.putExtra("language", call.getString("language", "en"));`,
    'localized test language');
  source = exact(source,
    `                    alarm.optString("city", ""),
                    alarm.optBoolean("audioReady", false)`,
    `                    alarm.optString("city", ""),
                    alarm.optString("language", "en"),
                    alarm.optBoolean("audioReady", false)`,
    'rescheduled alarm language');
  source = exact(source,
    `    private static void scheduleOne(Context context, int id, long timestamp, String prayer, String city, boolean audioReady) {`,
    `    private static void scheduleOne(Context context, int id, long timestamp, String prayer, String city, String language, boolean audioReady) {`,
    'scheduleOne language signature');
  source = exact(source,
    `        intent.putExtra("city", city);
        intent.putExtra("audioReady", audioReady);`,
    `        intent.putExtra("city", city);
        intent.putExtra("language", language);
        intent.putExtra("audioReady", audioReady);`,
    'schedule intent language');
  source = regex(source, /    private static void download\(String address, File destination\) throws Exception \{[\s\S]*?\n    \}\n\n    private static void copyFile/, `    private static void download(String address, File destination) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(30_000);
        connection.setInstanceFollowRedirects(true);
        connection.connect();
        int responseCode = connection.getResponseCode();
        if (responseCode < 200 || responseCode >= 300) {
            connection.disconnect();
            throw new IllegalStateException("Audio download returned HTTP " + responseCode);
        }
        String contentType = connection.getContentType();
        if (contentType != null && !contentType.toLowerCase().startsWith("audio/") && !contentType.toLowerCase().contains("octet-stream")) {
            connection.disconnect();
            throw new IllegalStateException("Audio download returned an unexpected content type.");
        }
        long contentLength = connection.getContentLengthLong();
        if (contentLength > MAX_AUDIO_BYTES) {
            connection.disconnect();
            throw new IllegalStateException("Athan audio file is too large.");
        }
        long total = 0L;
        try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(destination)) {
            byte[] buffer = new byte[16_384];
            int length;
            while ((length = input.read(buffer)) >= 0) {
                total += length;
                if (total > MAX_AUDIO_BYTES) throw new IllegalStateException("Athan audio file exceeded the size limit.");
                output.write(buffer, 0, length);
            }
        } finally {
            connection.disconnect();
        }
        if (total < MIN_AUDIO_BYTES) throw new IllegalStateException("Athan audio file is incomplete.");
    }

    private static boolean isValidAudioFile(File file) {
        if (!file.exists() || file.length() < MIN_AUDIO_BYTES || file.length() > MAX_AUDIO_BYTES) return false;
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] header = new byte[3];
            if (input.read(header) < 2) return false;
            boolean id3 = header[0] == 'I' && header[1] == 'D' && header[2] == '3';
            boolean frameSync = (header[0] & 0xFF) == 0xFF && (header[1] & 0xE0) == 0xE0;
            return id3 || frameSync;
        } catch (Exception ignored) {
            return false;
        }
    }

    private static void copyFile`, 'hardened audio download');
  return source;
});

await edit('mobile/android/java/AthanReceiver.java', (source) => exact(
  source,
  `        serviceIntent.putExtra("city", intent.getStringExtra("city"));
        serviceIntent.putExtra("audioReady", intent.getBooleanExtra("audioReady", false));`,
  `        serviceIntent.putExtra("city", intent.getStringExtra("city"));
        serviceIntent.putExtra("language", intent.getStringExtra("language"));
        serviceIntent.putExtra("audioReady", intent.getBooleanExtra("audioReady", false));`,
  'receiver language forwarding',
));

await edit('mobile/android/java/AthanPlaybackService.java', (source) => {
  source = exact(source, 'import java.io.File;\n', 'import java.io.File;\nimport java.util.Locale;\n', 'service Locale import');
  source = exact(source,
    `    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }`,
    `    public void onCreate() {
        super.onCreate();
    }`,
    'defer channel localization');
  source = exact(source,
    `        if (prayer == null || prayer.isEmpty()) prayer = "Prayer";
        if (city == null) city = "";

        boolean audioReady = intent != null && intent.getBooleanExtra("audioReady", true);
        startForeground(NOTIFICATION_ID, buildNotification(prayer, city));
        startPlayback(prayer, city, audioReady);`,
    `        if (prayer == null || prayer.isEmpty()) prayer = "Prayer";
        if (city == null) city = "";
        String language = intent == null ? Locale.getDefault().getLanguage() : intent.getStringExtra("language");
        if (language == null || language.isEmpty()) language = Locale.getDefault().getLanguage();

        boolean audioReady = intent != null && intent.getBooleanExtra("audioReady", true);
        createNotificationChannel(language);
        startForeground(NOTIFICATION_ID, buildNotification(prayer, city, language));
        startPlayback(prayer, city, language, audioReady);`,
    'localized service startup');
  source = exact(source, '    private Notification buildNotification(String prayer, String city) {', '    private Notification buildNotification(String prayer, String city, String language) {', 'localized notification signature');
  source = exact(source,
    `        String body = city.isEmpty() ? "The Athan is playing." : city;`,
    `        String body = city.isEmpty() ? localized("playing", language) : city;`,
    'localized notification body');
  source = exact(source,
    `.addAction(android.R.drawable.ic_media_pause, "Stop Athan", stopPendingIntent)`,
    `.addAction(android.R.drawable.ic_media_pause, localized("stop", language), stopPendingIntent)`,
    'localized stop action');
  source = exact(source, '    private void startPlayback(String prayer, String city, boolean audioReady) {', '    private void startPlayback(String prayer, String city, String language, boolean audioReady) {', 'localized playback signature');
  source = exact(source,
    `.setContentText(city.isEmpty() ? "Prayer time" : city)`,
    `.setContentText(city.isEmpty() ? localized("prayerTime", language) : city)`,
    'localized fallback text');
  source = exact(source, '    private void createNotificationChannel() {', '    private void createNotificationChannel(String language) {', 'localized channel signature');
  source = exact(source,
    `            "Athan alarms",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Prayer-time Athan playback");`,
    `            localized("athanChannel", language),
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(localized("athanDescription", language));`,
    'localized Athan channel');
  source = exact(source,
    `            "Prayer notifications",
            NotificationManager.IMPORTANCE_HIGH
        );
        fallback.setDescription("Prayer-time notification fallback");`,
    `            localized("prayerChannel", language),
            NotificationManager.IMPORTANCE_HIGH
        );
        fallback.setDescription(localized("prayerDescription", language));`,
    'localized fallback channel');
  source = exact(source,
    `    private void stopPlayer() {`,
    `    private String localized(String key, String language) {
        String lang = language == null ? "en" : language.toLowerCase(Locale.ROOT);
        if (lang.startsWith("ar")) {
            if (key.equals("stop")) return "إيقاف الأذان";
            if (key.equals("playing")) return "يتم تشغيل الأذان.";
            if (key.equals("prayerTime")) return "حان وقت الصلاة";
            if (key.equals("athanChannel")) return "تنبيهات الأذان";
            if (key.equals("athanDescription")) return "تشغيل الأذان في وقت الصلاة";
            if (key.equals("prayerChannel")) return "إشعارات الصلاة";
            if (key.equals("prayerDescription")) return "إشعار احتياطي لوقت الصلاة";
        }
        if (lang.startsWith("ur")) {
            if (key.equals("stop")) return "اذان بند کریں";
            if (key.equals("playing")) return "اذان چل رہی ہے۔";
            if (key.equals("prayerTime")) return "نماز کا وقت";
            if (key.equals("athanChannel")) return "اذان کے الارم";
            if (key.equals("athanDescription")) return "نماز کے وقت اذان";
            if (key.equals("prayerChannel")) return "نماز کی اطلاعات";
            if (key.equals("prayerDescription")) return "نماز کے وقت متبادل اطلاع";
        }
        if (lang.startsWith("fr")) {
            if (key.equals("stop")) return "Arrêter l’adhan";
            if (key.equals("playing")) return "L’adhan est en cours.";
            if (key.equals("prayerTime")) return "Heure de la prière";
            if (key.equals("athanChannel")) return "Alarmes d’adhan";
            if (key.equals("athanDescription")) return "Lecture de l’adhan à l’heure de la prière";
            if (key.equals("prayerChannel")) return "Notifications de prière";
            if (key.equals("prayerDescription")) return "Notification de secours pour la prière";
        }
        if (lang.startsWith("id")) {
            if (key.equals("stop")) return "Hentikan azan";
            if (key.equals("playing")) return "Azan sedang diputar.";
            if (key.equals("prayerTime")) return "Waktu salat";
            if (key.equals("athanChannel")) return "Alarm azan";
            if (key.equals("athanDescription")) return "Pemutaran azan pada waktu salat";
            if (key.equals("prayerChannel")) return "Notifikasi salat";
            if (key.equals("prayerDescription")) return "Notifikasi cadangan waktu salat";
        }
        if (lang.startsWith("ms")) {
            if (key.equals("stop")) return "Hentikan azan";
            if (key.equals("playing")) return "Azan sedang dimainkan.";
            if (key.equals("prayerTime")) return "Waktu solat";
            if (key.equals("athanChannel")) return "Penggera azan";
            if (key.equals("athanDescription")) return "Main balik azan pada waktu solat";
            if (key.equals("prayerChannel")) return "Pemberitahuan solat";
            if (key.equals("prayerDescription")) return "Pemberitahuan sandaran waktu solat";
        }
        if (lang.startsWith("tr")) {
            if (key.equals("stop")) return "Ezanı durdur";
            if (key.equals("playing")) return "Ezan çalıyor.";
            if (key.equals("prayerTime")) return "Namaz vakti";
            if (key.equals("athanChannel")) return "Ezan alarmları";
            if (key.equals("athanDescription")) return "Namaz vaktinde ezan çalma";
            if (key.equals("prayerChannel")) return "Namaz bildirimleri";
            if (key.equals("prayerDescription")) return "Namaz vakti yedek bildirimi";
        }
        if (key.equals("stop")) return "Stop Athan";
        if (key.equals("playing")) return "The Athan is playing.";
        if (key.equals("prayerTime")) return "Prayer time";
        if (key.equals("athanChannel")) return "Athan alarms";
        if (key.equals("athanDescription")) return "Prayer-time Athan playback";
        if (key.equals("prayerChannel")) return "Prayer notifications";
        return "Prayer-time notification fallback";
    }

    private void stopPlayer() {`,
    'Android notification translations');
  return source;
});

await edit('public/sw.js', (source) => {
  source = exact(source, "const CACHE_VERSION = 'mtp-app-shell-v13';", "const CACHE_VERSION = 'mtp-app-shell-v14';", 'service worker cache version');
  return exact(source,
    `    }).catch(async () => (await caches.match(request)) ?? (await caches.match(APP_HOME)) ?? Response.error()));`,
    `    }).catch(async () => {
      const requestUrl = new URL(request.url);
      const legalPage = requestUrl.pathname.endsWith('/privacy.html') ? new URL('./privacy.html', APP_SCOPE).toString()
        : requestUrl.pathname.endsWith('/support.html') ? new URL('./support.html', APP_SCOPE).toString()
          : '';
      return (await caches.match(request)) ?? (legalPage ? await caches.match(legalPage) : undefined) ?? (await caches.match(APP_HOME)) ?? Response.error();
    }));`,
    'offline legal page query fallback');
});

for (const path of ['public/privacy.html', 'public/support.html']) {
  await edit(path, (source) => {
    source = source
      .replaceAll('July 2, 2026', 'July 4, 2026')
      .replaceAll('2 يوليو 2026', '4 يوليو 2026')
      .replaceAll('2 Juli 2026', '4 Juli 2026')
      .replaceAll('2 Temmuz 2026', '4 Temmuz 2026');
    source = exact(source,
      `      select.addEventListener('change', () => setLanguage(select.value));`,
      `      function rewriteNativeLinks() {
        if (/^https?:$/.test(location.protocol)) return;
        document.querySelectorAll('a[href^="/muslim-travel-planner/"]').forEach((anchor) => {
          const href = anchor.getAttribute('href') || '';
          const relative = href.slice('/muslim-travel-planner/'.length);
          anchor.setAttribute('href', relative ? './' + relative : './index.html');
          anchor.removeAttribute('target');
        });
      }
      rewriteNativeLinks();
      select.addEventListener('change', () => setLanguage(select.value));`,
      `${path} native links`);
    if (path.endsWith('privacy.html')) {
      source = exact(source,
        `      rewriteNativeLinks();
      select.addEventListener('change', () => setLanguage(select.value));`,
        `      const audioDisclosure = {
        en: 'On Android, SafarOne may download an Athan audio file from the disclosed remote media provider after you enable or test Athan playback. The file is size-limited, format-checked, and stored locally.',
        ar: 'على أندرويد قد ينزّل SafarOne ملف أذان من مزود الوسائط البعيد المعلن بعد تفعيل الأذان أو اختباره. يخضع الملف لحد للحجم وفحص للصيغة ويُحفظ محليًا.',
        ur: 'Android پر اذان فعال یا آزماتے وقت SafarOne ظاہر کردہ بیرونی میڈیا فراہم کنندہ سے اذان کی آڈیو ڈاؤن لوڈ کر سکتا ہے۔ فائل کے حجم اور فارمیٹ کی جانچ ہوتی ہے اور اسے مقامی طور پر محفوظ کیا جاتا ہے۔',
        id: 'Di Android, SafarOne dapat mengunduh berkas Azan dari penyedia media jarak jauh yang disebutkan setelah Anda mengaktifkan atau menguji pemutaran Azan. Ukuran dan format berkas diperiksa lalu disimpan secara lokal.',
        ms: 'Pada Android, SafarOne boleh memuat turun fail azan daripada penyedia media jauh yang dinyatakan selepas anda mengaktifkan atau menguji azan. Saiz dan format fail diperiksa dan fail disimpan secara setempat.',
        tr: 'Android’de SafarOne, ezanı etkinleştirdiğinizde veya test ettiğinizde açıklanan uzak medya sağlayıcısından bir ezan ses dosyası indirebilir. Dosya boyut ve biçim açısından denetlenir ve yerel olarak saklanır.',
        fr: 'Sur Android, SafarOne peut télécharger un fichier audio d’adhan depuis le fournisseur multimédia distant indiqué après l’activation ou le test. Sa taille et son format sont contrôlés, puis il est stocké localement.',
      };
      document.querySelectorAll('[data-lang]').forEach((article) => {
        const section = article.querySelector('section:nth-of-type(4)');
        const language = article.getAttribute('data-lang') || 'en';
        if (section && !section.querySelector('[data-audio-disclosure]')) {
          const paragraph = document.createElement('p');
          paragraph.dataset.audioDisclosure = 'true';
          paragraph.textContent = audioDisclosure[language] || audioDisclosure.en;
          section.append(paragraph);
        }
      });
      rewriteNativeLinks();
      select.addEventListener('change', () => setLanguage(select.value));`,
        'privacy audio disclosure');
    }
    return source;
  });
}

await edit('package.json', (source) => exact(source,
  `    "ios:verify": "npm run ios:sync && xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build",`,
  `    "ios:verify": "npm run ios:sync && xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build",\n    "ios:archive-verify": "xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath build/SafarOne.xcarchive CODE_SIGNING_ALLOWED=NO archive",`,
  'iOS archive verification script'));

await edit('.github/workflows/ci.yml', (source) => source
  .replace('./gradlew assembleDebug --stacktrace', './gradlew assembleDebug assembleRelease --stacktrace')
  .replace('      - run: npm run ios:verify\n', '      - run: npm run ios:verify\n      - run: npm run ios:archive-verify\n'));

await write('src/release-audit-fixes.test.ts', `import assert from 'node:assert/strict';
import test from 'node:test';
import { airportByIata, chooseFlightProgress, createPreparedFlightPlan } from './flight-mode.js';
import { isPersistentStorageAvailable } from './safe-storage.js';

const load = (specifier: string) => Function('specifier', 'return import(specifier)')(specifier) as Promise<any>;
async function repoFile(path: string) {
  return load('node:fs/promises').then((fs) => fs.readFile(new URL(\`../${'${path}'}\`, import.meta.url), 'utf8'));
}

test('future-flight GPS fixes do not replace the scheduled route estimate', () => {
  const departure = airportByIata('LHR');
  const arrival = airportByIata('JFK');
  assert.ok(departure && arrival);
  const start = Date.now() + 24 * 60 * 60 * 1000;
  const plan = createPreparedFlightPlan({ departure, arrival, waypoints: [], scheduledDepartureUtc: new Date(start).toISOString(), durationMinutes: 420, prayerMethod: 'Muslim World League' });
  assert.ok(plan);
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
  assert.equal((project.match(/CURRENT_PROJECT_VERSION = 101;/g) ?? []).length, 2);
  assert.equal(verify.includes('version < 101'), true);
  assert.equal(main.includes('scheduleFlightClock()'), true);
  assert.equal(main.includes('generatedItems = generateItinerary(generatedPrefs, replan, lang)'), true);
  assert.equal(main.includes('required'), true);
  assert.equal(main.includes('SavedAttractionSnapshot'), true);
  assert.equal(main.includes('itineraryKindLabels'), true);
  assert.equal(athan.includes('.slice(0, 60)'), false);
  assert.equal(athan.includes('requested: future.length'), true);
  assert.equal(safeStorage.includes('isPersistentStorageAvailable'), true);
  assert.equal(serviceWorker.includes("endsWith('/privacy.html')"), true);
  assert.equal(plugin.includes('MAX_AUDIO_BYTES'), true);
  assert.equal(plugin.includes('PendingIntent.FLAG_NO_CREATE'), true);
  assert.equal(service.includes('localized("stop", language)'), true);
});

test('temporary storage is identified as non-persistent outside a browser', () => {
  assert.equal(isPersistentStorageAvailable(), false);
});
`);

console.log('Applied all release-audit fixes.');
