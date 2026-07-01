import type { Language } from './i18n.js';
import { safeExternalUrl } from './urls.js';

export type ReportReason = 'wrong-name' | 'wrong-location' | 'closed' | 'wrong-category' | 'hours' | 'contact' | 'accessibility' | 'halal' | 'other';

export type ReportablePlace = {
  feature: string;
  name: string;
  sourceUrl?: string;
  sourceType?: string;
  sourceId?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
};

export type PlaceReport = ReportablePlace & {
  reason: ReportReason;
  note: string;
  language: Language;
  timestamp: string;
};

export const reportReasons: ReportReason[] = ['wrong-name', 'wrong-location', 'closed', 'wrong-category', 'hours', 'contact', 'accessibility', 'halal', 'other'];
const MAX_NOTE_LENGTH = 500;

export function sanitizeReportNote(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE_LENGTH);
}

export function sourcePartsFromOsmUrl(sourceUrl = '') {
  const match = /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/(\d+)/.exec(sourceUrl);
  return match ? { sourceType: match[1], sourceId: match[2] } : {};
}

export function normalizeReportablePlace(place: ReportablePlace) {
  const fromUrl = sourcePartsFromOsmUrl(place.sourceUrl);
  return {
    ...place,
    name: sanitizeReportNote(place.name).slice(0, 160) || 'Mapped place',
    sourceUrl: safeExternalUrl(place.sourceUrl),
    sourceType: place.sourceType ?? fromUrl.sourceType,
    sourceId: place.sourceId ?? fromUrl.sourceId,
    latitude: Number.isFinite(place.latitude) ? place.latitude : undefined,
    longitude: Number.isFinite(place.longitude) ? place.longitude : undefined,
  };
}

export function createPlaceReport(place: ReportablePlace, reason: ReportReason, note: string, language: Language, now = new Date().toISOString()): PlaceReport {
  return { ...normalizeReportablePlace(place), reason, note: sanitizeReportNote(note), language, timestamp: now };
}

export function buildReportText(report: PlaceReport) {
  const lines = [
    'Muslim Travel Planner place report',
    `Feature: ${report.feature}`,
    `Place: ${report.name}`,
    report.city || report.country ? `Destination: ${[report.city, report.country].filter(Boolean).join(', ')}` : '',
    report.sourceType && report.sourceId ? `Source object: ${report.sourceType}/${report.sourceId}` : '',
    report.sourceUrl ? `Source URL: ${report.sourceUrl}` : '',
    Number.isFinite(report.latitude) && Number.isFinite(report.longitude) ? `Mapped coordinates: ${report.latitude}, ${report.longitude}` : '',
    `Reason: ${report.reason}`,
    report.note ? `Note: ${report.note}` : '',
    `Language: ${report.language}`,
    `Timestamp: ${report.timestamp}`,
  ].filter(Boolean);
  return lines.join('\n');
}

export function osmReportUrl(place: ReportablePlace) {
  const normalized = normalizeReportablePlace(place);
  if (normalized.sourceUrl) return normalized.sourceUrl;
  if (Number.isFinite(normalized.latitude) && Number.isFinite(normalized.longitude)) {
    return safeExternalUrl(`https://www.openstreetmap.org/note/new#map=17/${normalized.latitude}/${normalized.longitude}`);
  }
  return '';
}

export function githubIssueUrl(report: PlaceReport) {
  const title = `Place report: ${report.feature} - ${report.name}`.slice(0, 180);
  const body = `${buildReportText(report)}\n\nOpening this issue page does not submit automatically. A GitHub account may be required.`;
  const url = new URL('https://github.com/planetearthkh-arch/muslim-travel-planner/issues/new');
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  return safeExternalUrl(url.toString());
}

export function canShareReport(navigatorLike: Pick<Navigator, 'share'> | undefined) {
  return typeof navigatorLike?.share === 'function';
}
