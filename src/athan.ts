import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  CalculationMethod,
  Coordinates,
  HighLatitudeRule,
  PrayerTimes,
} from 'adhan';
import type { CityData, PrayerMethod, PrayerName } from './models.js';

export interface PrayerAlarm {
  id: number;
  prayer: PrayerName;
  city: string;
  timestamp: number;
  formattedTime: string;
}

interface NativeAthanPlugin {
  prepare(options: { audioUrl: string }): Promise<{ ready: boolean }>;
  requestPermissions(): Promise<{ exactAlarmAllowed: boolean; notificationsAllowed: boolean }>;
  schedule(options: { alarms: Array<Omit<PrayerAlarm, 'formattedTime'>> }): Promise<{ scheduled: number }>;
  cancelAll(): Promise<void>;
  stop(): Promise<void>;
  test(): Promise<void>;
}

const NativeAthan = registerPlugin<NativeAthanPlugin>('AthanAlarm');
const ATHAN_AUDIO_URL = 'https://media.assabile.com/assabile/adhan_3435370/8c052a5edec1.mp3';
const prayerOrder: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
let browserTimers: number[] = [];
let browserAudio: HTMLAudioElement | undefined;

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

async function showBrowserAlert(alarm: PrayerAlarm) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`${alarm.prayer} prayer`, {
      body: `${alarm.city} · ${alarm.formattedTime}`,
      icon: './icon-192.png',
    });
  }
  await playTestAthan();
}

function scheduleBrowserFallback(alarms: PrayerAlarm[]) {
  browserTimers.forEach((timer) => window.clearTimeout(timer));
  browserTimers = [];
  const maximumDelay = 2_147_000_000;
  alarms.forEach((alarm) => {
    const delay = alarm.timestamp - Date.now();
    if (delay <= 0 || delay > maximumDelay) return;
    browserTimers.push(window.setTimeout(() => void showBrowserAlert(alarm), delay));
  });
}

export async function enableAthanAlarms(alarms: PrayerAlarm[]) {
  if (Capacitor.isNativePlatform()) {
    await NativeAthan.prepare({ audioUrl: ATHAN_AUDIO_URL });
    const permissions = await NativeAthan.requestPermissions();
    const result = await NativeAthan.schedule({
      alarms: alarms.map(({ id, prayer, city, timestamp }) => ({ id, prayer, city, timestamp })),
    });
    return { mode: 'native' as const, scheduled: result.scheduled, permissions };
  }

  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  scheduleBrowserFallback(alarms);
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
  if (Capacitor.isNativePlatform()) await NativeAthan.cancelAll();
}

export async function playTestAthan() {
  if (Capacitor.isNativePlatform()) {
    await NativeAthan.prepare({ audioUrl: ATHAN_AUDIO_URL });
    await NativeAthan.test();
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
  if (Capacitor.isNativePlatform()) await NativeAthan.stop();
}

export const isNativeAthanAvailable = () => Capacitor.isNativePlatform();
