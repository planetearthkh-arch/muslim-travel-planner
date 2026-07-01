import type { CityData, ItineraryItem, PlannerPreferences } from './models.js';
import type { Language } from './i18n.js';
import { labels } from './i18n.js';

export type TripExportSnapshot = {
  name: string;
  city: Pick<CityData, 'city' | 'country' | 'timezone' | 'money'>;
  preferences: PlannerPreferences;
  itinerary: ItineraryItem[];
  language: Language;
};

const minutesOfDay = (time: string) => {
  const match = /(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return Number.NaN;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (/\bPM\b/i.test(time) && hour < 12) hour += 12;
  if (/\bAM\b/i.test(time) && hour === 12) hour = 0;
  return hour * 60 + minute;
};

const dateTimeValue = (date: string, minutes: number) => {
  const day = new Date(`${date}T00:00:00`);
  day.setMinutes(minutes);
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  const hh = String(day.getHours()).padStart(2, '0');
  const mm = String(day.getMinutes()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}00`;
};

export function groupedItinerary(items: ItineraryItem[]) {
  const seen = new Set<string>();
  const groups = new Map<string, ItineraryItem[]>();
  items.forEach((item) => {
    const key = `${item.date}-${item.time}-${item.title}`;
    if (seen.has(key)) return;
    seen.add(key);
    groups.set(item.date, [...(groups.get(item.date) ?? []), item]);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayItems]) => [date, dayItems.sort((a, b) => minutesOfDay(a.time) - minutesOfDay(b.time))] as [string, ItineraryItem[]]);
}

export function buildItineraryText(snapshot: TripExportSnapshot) {
  const copy = labels[snapshot.language];
  const dateRange = snapshot.preferences.startDate === snapshot.preferences.endDate ? snapshot.preferences.startDate : `${snapshot.preferences.startDate} - ${snapshot.preferences.endDate}`;
  const currencies = snapshot.city.money.localCurrencies.map((currency) => `${currency.name} (${currency.code}, ${currency.symbol})`).join('; ');
  const lines = [
    snapshot.name,
    `${snapshot.city.city}, ${snapshot.city.country}`,
    `${copy.tripDates}: ${dateRange}`,
    `${copy.tripDays}: ${groupedItinerary(snapshot.itinerary).length}`,
    `${copy.tripGroup}: ${snapshot.preferences.groupSize}`,
    `${copy.localCurrency}: ${currencies}`,
    copy.shareLiveInfoWarning,
    '',
  ];
  groupedItinerary(snapshot.itinerary).forEach(([date, items], dayIndex) => {
    lines.push(`${copy.dayHeading} ${dayIndex + 1} - ${date}`);
    items.forEach((item) => {
      const end = Number.isFinite(minutesOfDay(item.time)) ? dateTimeValue(item.date, minutesOfDay(item.time) + item.durationMinutes).slice(9, 13).replace(/(\d{2})(\d{2})/, '$1:$2') : '';
      lines.push(`- ${item.time}${end ? `-${end}` : ''}: ${item.title}`);
    });
    lines.push('');
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function safeTripFilename(name: string) {
  return `${name.replace(/[\u0000-\u001F\u007F<>:"/\\|?*]+/g, ' ').replace(/\s+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'trip'}.ics`;
}

export function escapeIcs(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function foldIcsLine(line: string) {
  const chunks: string[] = [];
  let current = line;
  while (current.length > 74) {
    chunks.push(current.slice(0, 74));
    current = ` ${current.slice(74)}`;
  }
  chunks.push(current);
  return chunks.join('\r\n');
}

export function buildIcsCalendar(snapshot: TripExportSnapshot) {
  const calendarName = `${snapshot.name} - ${snapshot.city.city}, ${snapshot.city.country}`;
  const events = groupedItinerary(snapshot.itinerary).flatMap(([, items]) => items);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Muslim Travel Planner//Trip Export//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    `X-WR-TIMEZONE:${escapeIcs(snapshot.city.timezone)}`,
  ];
  events.forEach((item, index) => {
    const startMinutes = minutesOfDay(item.time);
    if (!Number.isFinite(startMinutes)) return;
    const endMinutes = startMinutes + Math.max(1, item.durationMinutes);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${escapeIcs(`${snapshot.name}-${item.date}-${index}`.replace(/[^a-z0-9-]+/gi, '-').toLowerCase())}@muslim-travel-planner.local`);
    lines.push(`DTSTART;TZID=${escapeIcs(snapshot.city.timezone)}:${dateTimeValue(item.date, startMinutes)}`);
    lines.push(`DTEND;TZID=${escapeIcs(snapshot.city.timezone)}:${dateTimeValue(item.date, endMinutes)}`);
    lines.push(`SUMMARY:${escapeIcs(item.title)}`);
    lines.push(`DESCRIPTION:${escapeIcs(item.details)}`);
    lines.push(`LOCATION:${escapeIcs(`${snapshot.city.city}, ${snapshot.city.country}`)}`);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n');
}

export function canWebShare(navigatorLike: Pick<Navigator, 'share'> | undefined) {
  return typeof navigatorLike?.share === 'function';
}
