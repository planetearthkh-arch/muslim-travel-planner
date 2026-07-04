import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  CalculationMethod,
  Coordinates,
  HighLatitudeRule,
  PrayerTimes,
} from 'adhan';
import type { CityData, PrayerMethod, PrayerName } from './models.js';
import type { Language } from './app-language.js';
import { AndroidAthan } from './android-athan.js';

export interface PrayerAlarm {
  id: number;
  prayer: PrayerName;
  city: string;
  timestamp: number;
  formattedTime: string;
}

const ATHAN_AUDIO_URL = 'https://media.assabile.com/assabile/adhan_3435370/8c052a5edec1.mp3';
const prayerOrder: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const NATIVE_PRAYER_NOTIFICATION_MIN = 200_000_000;
const NATIVE_PRAYER_NOTIFICATION_MAX = 299_999_999;
const NATIVE_TEST_NOTIFICATION_ID = 199_900_001;
const NATIVE_DEFAULT_SOUND = 'default';
let browserTimers: number[] = [];
let browserAudio: HTMLAudioElement | undefined;

type NotificationCopy = { prayer: Record<PrayerName, string>; title: string; testTitle: string; testBody: string };
const notificationCopy: Record<string, NotificationCopy> = {
  en: { prayer: { Fajr: 'Fajr', Dhuhr: 'Dhuhr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Isha' }, title: 'prayer', testTitle: 'SafarOne prayer notification', testBody: 'Prayer notification sound' },
  ar: { prayer: { Fajr: 'الفجر', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' }, title: 'صلاة', testTitle: 'إشعار الصلاة من SafarOne', testBody: 'صوت إشعار الصلاة' },
  ur: { prayer: { Fajr: 'فجر', Dhuhr: 'ظہر', Asr: 'عصر', Maghrib: 'مغرب', Isha: 'عشاء' }, title: 'نماز', testTitle: 'SafarOne نماز کی اطلاع', testBody: 'نماز کی اطلاع کی آواز' },
  id: { prayer: { Fajr: 'Subuh', Dhuhr: 'Zuhur', Asr: 'Asar', Maghrib: 'Magrib', Isha: 'Isya' }, title: 'salat', testTitle: 'Notifikasi salat SafarOne', testBody: 'Suara notifikasi salat' },
  ms: { prayer: { Fajr: 'Subuh', Dhuhr: 'Zuhur', Asr: 'Asar', Maghrib: 'Maghrib', Isha: 'Isyak' }, title: 'solat', testTitle: 'Pemberitahuan solat SafarOne', testBody: 'Bunyi pemberitahuan solat' },
  tr: { prayer: { Fajr: 'Sabah', Dhuhr: 'Öğle', Asr: 'İkindi', Maghrib: 'Akşam', Isha: 'Yatsı' }, title: 'namazı', testTitle: 'SafarOne namaz bildirimi', testBody: 'Namaz bildirimi sesi' },
  fr: { prayer: { Fajr: 'Fajr', Dhuhr: 'Dhuhr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Isha' }, title: 'prière', testTitle: 'Notification de prière SafarOne', testBody: 'Son de notification de prière' },
};

function copyFor(language: Language | string) {
  return notificationCopy[language] ?? notificationCopy.en;
}

function methodParameters(method: PrayerMethod) {
  switch (method) {
    case 'Egyptian General Authority':
      return CalculationMethod.Egyptian();
    case 'Umm al-Qura':
      return CalculationMethod.UmmAlQura();
    case 'ISNA':
      return CalculationMethod.NorthAmerica();
    case 'Turkey Diyanet':
      return CalculationMethod.Turkey();
    case 'Muslim World League':
    default:
      return CalculationMethod.MuslimWorldLeague();
  }
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

export function formatPrayerTime(timestamp: number, timezone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(timestamp));
}

export function calculatePrayerAlarms(
  city: CityData,
  method: PrayerMethod,
  startDate: string,
  locale: string,
  days = 7,
) {
  const coordinates = new Coordinates(city.coordinates.lat, city.coordinates.lng);
  const start = parseIsoDate(startDate);
  const now = Date.now();
  const alarms: PrayerAlarm[] = [];

  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + dayOffset);
    const parameters = methodParameters(method);
    parameters.highLatitudeRule = HighLatitudeRule.recommended(coordinates);
    const times = new PrayerTimes(coordinates, date, parameters);
    const values: Record<PrayerName, Date> = {
      Fajr: times.fajr,
      Dhuhr: times.dhuhr,
      Asr: times.asr,
      Maghrib: times.maghrib,
      Isha: times.isha,
    };

    prayerOrder.forEach((prayer, prayerIndex) => {
      const timestamp = values[prayer].getTime();
      if (!Number.isFinite(timestamp) || timestamp <= now) return;
      alarms.push({
        id: Number(`${dateKey(date)}${prayerIndex + 1}`),
        prayer,
        city: `${city.city}, ${city.country}`,
        timestamp,
        formattedTime: formatPrayerTime(timestamp, city.timezone, locale),
      });
    });
  }

  return alarms;
}

export function calculatePrayerDisplay(
  city: CityData,
  method: PrayerMethod,
  dateValue: string,
  locale: string,
) {
  const coordinates = new Coordinates(city.coordinates.lat, city.coordinates.lng);
  const parameters = methodParameters(method);
  parameters.highLatitudeRule = HighLatitudeRule.recommended(coordinates);
  const times = new PrayerTimes(coordinates, parseIsoDate(dateValue), parameters);
  return {
    Fajr: formatPrayerTime(times.fajr.getTime(), city.timezone, locale),
    Sunrise: formatPrayerTime(times.sunrise.getTime(), city.timezone, locale),
    Dhuhr: formatPrayerTime(times.dhuhr.getTime(), city.timezone, locale),
    Asr: formatPrayerTime(times.asr.getTime(), city.timezone, locale),
    Maghrib: formatPrayerTime(times.maghrib.getTime(), city.timezone, locale),
    Isha: formatPrayerTime(times.isha.getTime(), city.timezone, locale),
  };
}

async function showBrowserAlert(alarm: PrayerAlarm, language: Language) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const copy = copyFor(language);
    new Notification(`${copy.prayer[alarm.prayer]} ${copy.title}`, {
      body: `${alarm.city} · ${alarm.formattedTime}`,
      icon: './icons/icon.svg',
    });
  }
  await playTestAthan(language);
}

function scheduleBrowserFallback(alarms: PrayerAlarm[], language: Language) {
  browserTimers.forEach((timer) => window.clearTimeout(timer));
  browserTimers = [];
  const maximumDelay = 2_147_000_000;
  alarms.forEach((alarm) => {
    const delay = alarm.timestamp - Date.now();
    if (delay <= 0 || delay > maximumDelay) return;
    browserTimers.push(window.setTimeout(() => void showBrowserAlert(alarm, language), delay));
  });
}

function nativeNotificationId(alarm: PrayerAlarm) {
  return NATIVE_PRAYER_NOTIFICATION_MIN + (alarm.id % (NATIVE_PRAYER_NOTIFICATION_MAX - NATIVE_PRAYER_NOTIFICATION_MIN));
}

function isSafarOneNotificationId(id: number) {
  return id === NATIVE_TEST_NOTIFICATION_ID || (id >= NATIVE_PRAYER_NOTIFICATION_MIN && id <= NATIVE_PRAYER_NOTIFICATION_MAX);
}

async function cancelNativePrayerNotifications() {
  const pending = await LocalNotifications.getPending();
  const notifications = pending.notifications
    .filter((notification) => isSafarOneNotificationId(notification.id))
    .map((notification) => ({ id: notification.id }));
  if (notifications.length) await LocalNotifications.cancel({ notifications });
}

export async function enableAthanAlarms(alarms: PrayerAlarm[], language: Language = 'en') {
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
        prayer: `${copy.prayer[alarm.prayer]} ${copy.title}`,
        city: `${alarm.city} · ${alarm.formattedTime}`,
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
    const exactAlarmAllowed = true;
    const now = Date.now();
    const copy = copyFor(language);
    const notifications = alarms
      .filter((alarm) => alarm.timestamp > now + 1000)
      .slice(0, 60)
      .map((alarm) => ({
        id: nativeNotificationId(alarm),
        title: `${copy.prayer[alarm.prayer]} ${copy.title}`,
        body: `${alarm.city} · ${alarm.formattedTime}`,
        sound: NATIVE_DEFAULT_SOUND,
        schedule: { at: new Date(alarm.timestamp), allowWhileIdle: exactAlarmAllowed },
        extra: { safarOne: true, prayer: alarm.prayer, city: alarm.city },
      }));
    if (notifications.length) await LocalNotifications.schedule({ notifications });
    return {
      mode: 'native' as const,
      scheduled: notifications.length,
      permissions: { exactAlarmAllowed, notificationsAllowed: true },
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

export async function disableAthanAlarms() {
  browserTimers.forEach((timer) => window.clearTimeout(timer));
  browserTimers = [];
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    await AndroidAthan.cancelAll();
  } else if (Capacitor.isNativePlatform()) {
    await cancelNativePrayerNotifications();
  }
}

export async function playTestAthan(language: Language = 'en') {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    await AndroidAthan.prepare({ audioUrl: ATHAN_AUDIO_URL });
    await AndroidAthan.test();
    return;
  }
  if (Capacitor.isNativePlatform()) {
    const permissions = await LocalNotifications.requestPermissions();
    if (permissions.display !== 'granted') return;
    const exactAlarmAllowed = true;
    const copy = copyFor(language);
    await LocalNotifications.schedule({
      notifications: [{
        id: NATIVE_TEST_NOTIFICATION_ID,
        title: copy.testTitle,
        body: copy.testBody,
        sound: NATIVE_DEFAULT_SOUND,
        schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: exactAlarmAllowed },
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

export const isNativeAthanAvailable = () => Capacitor.isNativePlatform();
