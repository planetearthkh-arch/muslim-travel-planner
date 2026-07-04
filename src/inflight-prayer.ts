import {
  CalculationMethod,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PrayerTimes,
} from 'adhan';
import type { PrayerMethod, PrayerName } from './models.js';
import { validCoordinate } from './flight-mode.js';

export type InflightPrayerSnapshot = {
  position: { latitude: number; longitude: number };
  method: PrayerMethod;
  currentTimestamp: number;
  previousPrayer?: { name: PrayerName; timestamp: number };
  currentWindow?: { name: PrayerName; start: number; end: number };
  nextPrayer?: { name: PrayerName; timestamp: number };
  countdownMs: number;
  prayers: Record<PrayerName | 'Sunrise', number>;
};

const prayerOrder: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function methodParameters(method: PrayerMethod) {
  const hanafi = method.endsWith(' (Hanafi Asr)');
  const baseMethod = method.replace(' (Hanafi Asr)', '') as PrayerMethod;
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

function prayerTimesForDate(coordinates: Coordinates, date: Date, method: PrayerMethod) {
  const parameters = methodParameters(method);
  parameters.highLatitudeRule = HighLatitudeRule.recommended(coordinates);
  const times = new PrayerTimes(coordinates, date, parameters);
  return {
    Fajr: times.fajr.getTime(),
    Sunrise: times.sunrise.getTime(),
    Dhuhr: times.dhuhr.getTime(),
    Asr: times.asr.getTime(),
    Maghrib: times.maghrib.getTime(),
    Isha: times.isha.getTime(),
  };
}

function utcDateAtOffset(timestamp: number, offsetDays: number) {
  const date = new Date(timestamp);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + offsetDays, 12, 0, 0));
}

export function calculateInflightPrayerSnapshot(latitude: number, longitude: number, timestamp: number, method: PrayerMethod): InflightPrayerSnapshot | null {
  if (!validCoordinate(latitude, longitude) || !Number.isFinite(timestamp)) return null;
  const coordinates = new Coordinates(latitude, longitude);
  const adjacent = [-1, 0, 1].flatMap((offset) => {
    const values = prayerTimesForDate(coordinates, utcDateAtOffset(timestamp, offset), method);
    return prayerOrder.map((name) => ({ name, timestamp: values[name] })).filter((entry) => Number.isFinite(entry.timestamp));
  }).sort((a, b) => a.timestamp - b.timestamp);
  const prayers = prayerTimesForDate(coordinates, utcDateAtOffset(timestamp, 0), method);
  const previous = [...adjacent].reverse().find((entry) => entry.timestamp <= timestamp);
  const next = adjacent.find((entry) => entry.timestamp > timestamp);
  const nextAfterPrevious = previous ? adjacent.find((entry) => entry.timestamp > previous.timestamp) : undefined;
  const currentWindow = previous && nextAfterPrevious && timestamp >= previous.timestamp && timestamp < nextAfterPrevious.timestamp
    ? { name: previous.name, start: previous.timestamp, end: nextAfterPrevious.timestamp }
    : undefined;
  return {
    position: { latitude, longitude },
    method,
    currentTimestamp: timestamp,
    previousPrayer: previous,
    currentWindow,
    nextPrayer: next,
    countdownMs: next ? Math.max(0, next.timestamp - timestamp) : 0,
    prayers,
  };
}

export function formatUtcTime(timestamp: number) {
  if (!Number.isFinite(timestamp)) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

export function formatInTimeZone(timestamp: number, timeZone?: string, locale = 'en-GB') {
  if (!Number.isFinite(timestamp) || !timeZone) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(timestamp));
  } catch {
    return '';
  }
}

