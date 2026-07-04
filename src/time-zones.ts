export type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const localPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const absolutePattern = /(?:Z|[+-]\d{2}:?\d{2})$/i;

export function parseLocalDateTime(value: string): LocalDateTimeParts | null {
  const match = localPattern.exec(value.trim());
  if (!match) return null;
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
  const probe = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
  if (probe.getUTCFullYear() !== parts.year || probe.getUTCMonth() !== parts.month - 1 || probe.getUTCDate() !== parts.day || probe.getUTCHours() !== parts.hour || probe.getUTCMinutes() !== parts.minute || probe.getUTCSeconds() !== parts.second) return null;
  return parts;
}

export function isValidTimeZone(timeZone: string) {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function partsAt(timestamp: number, timeZone: string): LocalDateTimeParts | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(timestamp));
    const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    const result = { year: number('year'), month: number('month'), day: number('day'), hour: number('hour'), minute: number('minute'), second: number('second') };
    return Object.values(result).every(Number.isFinite) ? result : null;
  } catch {
    return null;
  }
}

const sameParts = (a: LocalDateTimeParts, b: LocalDateTimeParts) => a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.minute === b.minute && a.second === b.second;

export function zonedDateTimeToUtc(value: string, timeZone: string): Date | null {
  const desired = parseLocalDateTime(value);
  if (!desired || !isValidTimeZone(timeZone)) return null;
  const naive = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, desired.second);
  let estimate = naive;
  const candidates = new Set<number>();
  for (let index = 0; index < 5; index += 1) {
    const observed = partsAt(estimate, timeZone);
    if (!observed) return null;
    const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute, observed.second);
    estimate += naive - observedAsUtc;
    candidates.add(estimate);
    candidates.add(estimate - 60 * 60 * 1000);
    candidates.add(estimate + 60 * 60 * 1000);
  }
  const valid = [...candidates].filter((timestamp) => {
    const observed = partsAt(timestamp, timeZone);
    return Boolean(observed && sameParts(observed, desired));
  }).sort((a, b) => a - b);
  return valid.length ? new Date(valid[0]) : null;
}

export function dateTimeForZone(value: string, timeZone: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (absolutePattern.test(trimmed)) {
    const date = new Date(trimmed);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return zonedDateTimeToUtc(trimmed, timeZone);
}

export function addMinutesToLocalDateTime(value: string, minutes: number) {
  const parts = parseLocalDateTime(value);
  if (!parts || !Number.isFinite(minutes)) return '';
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute + minutes, parts.second));
  const pad = (number: number) => String(number).padStart(2, '0');
  return String(date.getUTCFullYear()) + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate()) + 'T' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes());
}

export function formatUtcForIcs(date: Date) {
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
