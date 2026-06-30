export type OpeningState = 'open' | 'closed' | 'unknown';

const dayOrder = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
type DayCode = typeof dayOrder[number];
const dayIndex = new Map<DayCode, number>(dayOrder.map((day, index) => [day, index]));
const dayPattern = /^(Mo|Tu|We|Th|Fr|Sa|Su)$/;

type LocalDateTime = {
  day: DayCode;
  previousDay: DayCode;
  minutes: number;
};

function localDateTime(now: Date, timeZone: string): LocalDateTime | undefined {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const weekday = parts.find((part) => part.type === 'weekday')?.value.slice(0, 2) as DayCode | undefined;
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value);
    if (!weekday || !dayIndex.has(weekday) || !Number.isFinite(hour) || !Number.isFinite(minute)) return undefined;
    const previousDay = dayOrder[(dayIndex.get(weekday) ?? 0) + 6 > 6 ? (dayIndex.get(weekday) ?? 0) - 1 : (dayIndex.get(weekday) ?? 0) + 6];
    return { day: weekday, previousDay, minutes: hour * 60 + minute };
  } catch {
    return undefined;
  }
}

function parseDayExpression(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return [...dayOrder];
  if (!/^(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*(?:,|-)\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))*$/u.test(trimmed)) return undefined;
  const days = new Set<DayCode>();
  for (const part of trimmed.split(',')) {
    const token = part.trim();
    if (!token) return undefined;
    if (token.includes('-')) {
      const [start, end] = token.split('-').map((item) => item.trim()) as [DayCode, DayCode];
      if (!dayPattern.test(start) || !dayPattern.test(end)) return undefined;
      const startIndex = dayIndex.get(start) ?? 0;
      const endIndex = dayIndex.get(end) ?? 0;
      for (let offset = 0; offset < 7; offset += 1) {
        const current = dayOrder[(startIndex + offset) % 7];
        days.add(current);
        if ((startIndex + offset) % 7 === endIndex) break;
      }
    } else {
      if (!dayPattern.test(token)) return undefined;
      days.add(token as DayCode);
    }
  }
  return [...days];
}

function parseTime(value: string, isEnd: boolean) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return undefined;
  if (hour === 24 && minute === 0 && isEnd) return 24 * 60;
  if (hour < 0 || hour > 23) return undefined;
  return hour * 60 + minute;
}

function parseRule(rule: string) {
  const trimmed = rule.trim();
  if (!trimmed) return undefined;
  const firstTime = trimmed.search(/\d{1,2}:\d{2}/);
  if (firstTime < 0) return undefined;
  const days = parseDayExpression(trimmed.slice(0, firstTime));
  if (!days) return undefined;
  const periods = trimmed.slice(firstTime).split(',').map((part) => {
    const [rawStart, rawEnd] = part.trim().split('-');
    if (!rawStart || !rawEnd) return undefined;
    const start = parseTime(rawStart, false);
    const end = parseTime(rawEnd, true);
    if (typeof start !== 'number' || typeof end !== 'number' || start === end) return undefined;
    return { start, end };
  });
  if (periods.some((period) => !period)) return undefined;
  return { days, periods: periods as Array<{ start: number; end: number }> };
}

function periodState(days: DayCode[], period: { start: number; end: number }, local: LocalDateTime) {
  const crossesMidnight = period.end < period.start;
  if (days.includes(local.day) && !crossesMidnight && local.minutes >= period.start && local.minutes < period.end) return 'open';
  if (days.includes(local.day) && crossesMidnight && local.minutes >= period.start) return 'open';
  if (crossesMidnight && days.includes(local.previousDay) && local.minutes < period.end) return 'open';
  return 'closed';
}

export function openingState(openingHours: string | undefined, timeZone: string | undefined, now = new Date()): OpeningState {
  const value = openingHours?.trim();
  if (!value || !timeZone) return 'unknown';
  const compact = value.replace(/\s+/g, ' ');
  const local = localDateTime(now, timeZone);
  if (!local) return 'unknown';
  if (/^24\/7$/i.test(compact)) return 'open';
  if (/^(off|closed)$/i.test(compact)) return 'closed';
  if (/\bPH\b|SH|sunrise|sunset|\bweek\b|\bmonth\b|\bseason\b|\bApr\b|\bMay\b|\bJun\b|\bJul\b|\bAug\b|\bSep\b|\bOct\b|\bNov\b|\bDec\b|\bJan\b|\bFeb\b|\bMar\b/i.test(compact)) return 'unknown';
  if (/^Mo-Su\s+00:00-24:00$/i.test(compact)) return 'open';
  const rules = compact.split(';').map(parseRule);
  if (!rules.length || rules.some((rule) => !rule)) return 'unknown';
  for (const rule of rules) {
    if (!rule) return 'unknown';
    for (const period of rule.periods) {
      if (periodState(rule.days, period, local) === 'open') return 'open';
    }
  }
  return 'closed';
}

export function isAlwaysOpen(openingHours: string | undefined) {
  const value = openingHours?.trim().replace(/\s+/g, ' ');
  return !!value && (/^24\/7$/i.test(value) || /^Mo-Su\s+00:00-24:00$/i.test(value));
}

export function withOpeningState<T extends { openingHours: string; openState: OpeningState }>(item: T, timeZone: string | undefined, now = new Date()): T {
  return { ...item, openState: openingState(item.openingHours, timeZone, now) };
}
