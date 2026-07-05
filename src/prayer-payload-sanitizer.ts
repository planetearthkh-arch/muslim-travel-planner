import type { OverpassElement, OsmTags } from './prayer-spaces.js';

export type SanitizedPrayerPayload = { elements: OverpassElement[] };

const AL_AQSA_COMPOUND_BOUNDS = {
  south: 31.7758,
  north: 31.7809,
  west: 35.2325,
  east: 35.2375,
};

const exactAlAqsaNamePattern = /^(?:the\s+)?(?:al[-\s]?aqsa(?:\s+(?:mosque|masjid))?|masjid\s+(?:al[-\s]?)?aqsa|المسجد\s+الأقصى|المسجد\s+الاقصى|مسجد\s+الأقصى|مسجد\s+الاقصى|الأقصى|الاقصى)$/iu;
const alAqsaCompoundPattern = /^(?:al[-\s]?aqsa\s+compound|الحرم\s+الشريف|הר\s+הבית)$/iu;
const nonPrayerFacilityNamePattern = /\b(?:clinic|hospital|medical|healthcare|health\s+(?:centre|center)|pharmacy|doctors?|school|college|university|kindergarten|academy|library|museum|office|bank|hotel|hostel|restaurant|cafe|shop|market)\b|عيادة|مستشفى|مستوصف|صيدلية|مدرسة|جامعة|كلية|روضة|أكاديمية|اكاديمية|مكتبة|متحف|مكتب|بنك|فندق|مطعم|مقهى|متجر|سوق/iu;

function coordinates(element: OverpassElement) {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  return typeof latitude === 'number' && typeof longitude === 'number' ? { latitude, longitude } : undefined;
}

function names(tags: OsmTags) {
  return [
    tags['name:en'],
    tags['official_name:en'],
    tags['name:ar'],
    tags['official_name:ar'],
    tags.name,
    tags.official_name,
    tags.short_name,
    tags.alt_name,
  ].filter((value): value is string => Boolean(value)).map((value) => value.trim());
}

function hasMuslimSignal(tags: OsmTags) {
  return tags.religion === 'muslim' || tags.denomination === 'sunni' || tags.denomination === 'shia' || tags.muslim === 'yes';
}

function hasExplicitPrayerTags(tags: OsmTags) {
  const amenity = tags.amenity?.toLowerCase();
  const room = tags.room?.toLowerCase();
  return (amenity === 'place_of_worship' && hasMuslimSignal(tags))
    || (amenity === 'community_centre' && hasMuslimSignal(tags))
    || amenity === 'prayer_room'
    || room === 'prayer'
    || tags.prayer_room === 'yes';
}

function isInsideAlAqsaCompound(element: OverpassElement) {
  const point = coordinates(element);
  if (!point) return false;
  return point.latitude >= AL_AQSA_COMPOUND_BOUNDS.south
    && point.latitude <= AL_AQSA_COMPOUND_BOUNDS.north
    && point.longitude >= AL_AQSA_COMPOUND_BOUNDS.west
    && point.longitude <= AL_AQSA_COMPOUND_BOUNDS.east;
}

function isAlAqsaParent(element: OverpassElement) {
  if (!isInsideAlAqsaCompound(element)) return false;
  const tags = element.tags ?? {};
  const amenity = tags.amenity?.toLowerCase();
  if (amenity && amenity !== 'place_of_worship') return false;
  const searchableNames = names(tags);
  if (searchableNames.some((name) => nonPrayerFacilityNamePattern.test(name))) return false;
  return searchableNames.some((name) => exactAlAqsaNamePattern.test(name) || alAqsaCompoundPattern.test(name));
}

function normalizedAlAqsaElement(element: OverpassElement): OverpassElement {
  const tags = element.tags ?? {};
  return {
    ...element,
    tags: {
      ...tags,
      amenity: 'place_of_worship',
      religion: 'muslim',
      name: 'Al-Aqsa Mosque',
      'name:en': 'Al-Aqsa Mosque',
      'name:ar': 'المسجد الأقصى',
    },
  };
}

export function sanitizePrayerElement(element: OverpassElement): OverpassElement | undefined {
  const tags = element.tags ?? {};
  const searchableNames = names(tags);
  if (!hasExplicitPrayerTags(tags) && searchableNames.some((name) => nonPrayerFacilityNamePattern.test(name))) return undefined;
  if (hasExplicitPrayerTags(tags)) return element;
  if (isAlAqsaParent(element)) return normalizedAlAqsaElement(element);
  return undefined;
}

export function isAllowedPrayerElement(element: OverpassElement) {
  return Boolean(sanitizePrayerElement(element));
}

export function sanitizePrayerPayload(value: unknown): SanitizedPrayerPayload | undefined {
  if (!value || typeof value !== 'object' || !Array.isArray((value as SanitizedPrayerPayload).elements)) return undefined;
  const elements = (value as SanitizedPrayerPayload).elements.flatMap((element) => {
    if (!element || typeof element !== 'object' || typeof element.type !== 'string' || typeof element.id !== 'number') return [];
    const sanitized = sanitizePrayerElement(element);
    return sanitized ? [sanitized] : [];
  });
  return { elements };
}
