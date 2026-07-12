import type { CityData, ItineraryItem, PlannerPreferences } from './models.js';
import { labels, type Language } from './app-language.js';
import { travelDetailEndDate, travelDetailPrimaryDate, travelDetailTimeZone, type TravelDetailEntry, type TravelDetailsSnapshot } from './travel-details.js';
import { addMinutesToLocalDateTime, formatUtcForIcs, zonedDateTimeToUtc } from './time-zones.js';

export type TripExportSnapshot = {
  name: string;
  city: Pick<CityData, 'city' | 'country' | 'timezone' | 'money'>;
  preferences: PlannerPreferences;
  itinerary: ItineraryItem[];
  travelDetails?: TravelDetailsSnapshot;
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
  const local = addMinutesToLocalDateTime(date + 'T00:00', minutes);
  return local ? local.replace(/[-:]/g, '') + '00' : '';
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
    'SafarMate — Muslim Travel Planner',
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
  const details = snapshot.travelDetails?.entries ?? [];
  if (details.length) {
    lines.push(copy.travelDetails);
    details.forEach((entry) => lines.push(`- ${travelDetailExportSummary(entry, copy)}`));
    lines.push(copy.travelPrivateReferenceExport);
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function safeTripFilename(name: string) {
  return `${name.replace(/[\u0000-\u001F\u007F<>:"/\\|?*]+/g, ' ').replace(/\s+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'trip'}.ics`;
}

export function escapeIcs(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function foldIcsLine(line: string) {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let current = '';
  let limit = 75;
  for (const character of line) {
    const next = current + character;
    if (encoder.encode(next).length > limit && current) {
      chunks.push(current);
      current = ' ' + character;
      limit = 75;
    } else {
      current = next;
    }
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
    'PRODID:-//SafarMate//Trip Export//EN',
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
  (snapshot.travelDetails?.entries ?? []).forEach((entry, index) => {
    if (entry.type === 'contact') return;
    const start = travelDetailPrimaryDate(entry);
    const end = travelDetailEndDate(entry);
    if (!start || !end) return;
    const tz = travelDetailTimeZone(entry, snapshot.city.timezone);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${escapeIcs(`travel-${snapshot.name}-${entry.type}-${index}`.replace(/[^a-z0-9-]+/gi, '-').toLowerCase())}@muslim-travel-planner.local`);
    if (entry.type === 'flight') {
      const startUtc = zonedDateTimeToUtc(entry.departureDateTime, entry.departureTimeZone || 'UTC');
      const endUtc = zonedDateTimeToUtc(entry.arrivalDateTime, entry.arrivalTimeZone || 'UTC');
      if (!startUtc || !endUtc) {
        lines.pop();
        lines.pop();
        return;
      }
      lines.push(`DTSTART:${formatUtcForIcs(startUtc)}`);
      lines.push(`DTEND:${formatUtcForIcs(endUtc)}`);
    } else {
      lines.push(`DTSTART;TZID=${escapeIcs(tz)}:${localDateTimeToIcs(start)}`);
      lines.push(`DTEND;TZID=${escapeIcs(tz)}:${localDateTimeToIcs(end)}`);
    }
    lines.push(`SUMMARY:${escapeIcs(travelDetailTitle(entry))}`);
    lines.push(`DESCRIPTION:${escapeIcs(travelDetailExportSummary(entry, labels[snapshot.language]))}`);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n');
}

function localDateTimeToIcs(value: string) {
  return `${value.replace(/[-:]/g, '')}00`;
}

function travelDetailTitle(entry: TravelDetailEntry) {
  if (entry.type === 'flight') return [entry.flightNumber, `${entry.departureAirport} to ${entry.arrivalAirport}`].filter(Boolean).join(' - ');
  if (entry.type === 'accommodation') return entry.propertyName;
  if (entry.type === 'reservation') return entry.title;
  return entry.name;
}

function travelDetailExportSummary(entry: TravelDetailEntry, copy: typeof labels[Language]) {
  if (entry.type === 'flight') return [copy.travelDetailFlight, entry.airline, entry.flightNumber, `${entry.departureAirport} -> ${entry.arrivalAirport}`, `${entry.departureDateTime} - ${entry.arrivalDateTime}`, entry.notes].filter(Boolean).join(' · ');
  if (entry.type === 'accommodation') return [copy.travelDetailAccommodation, entry.propertyName, `${entry.checkInDateTime} - ${entry.checkOutDateTime}`, entry.address, entry.phone, entry.notes].filter(Boolean).join(' · ');
  if (entry.type === 'reservation') return [copy.travelDetailReservation, entry.title, entry.provider, entry.startDateTime, entry.endDateTime, entry.meetingPoint, entry.phone, entry.notes].filter(Boolean).join(' · ');
  return [copy.travelDetailContact, entry.name, entry.role, entry.phone, entry.website, entry.notes].filter(Boolean).join(' · ');
}

export function canWebShare(navigatorLike: Pick<Navigator, 'share'> | undefined) {
  return typeof navigatorLike?.share === 'function';
}
