import type { OverpassElement, OsmTags } from './prayer-spaces.js';

export type SanitizedPrayerPayload = { elements: OverpassElement[] };

const AL_AQSA_COMPOUND_BOUNDS = {
  south: 31.7758,
  north: 31.7809,
  west: 35.2325,
  east: 35.2375,
};

const exactAlAqsaNamePattern = /^(?:the\s+)?(?:al[-\s]?aqsa(?:\s+(?:mosque|masjid))?|masjid\s+(?:al[-\s]?)?aqsa|المسجد\s+الأقصى|المسجد\s+الاقصى|مسجد\s+الأقصى|مسجد\s+الاقصى|الأقصى|الاقصى)$/iu;
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

function isExactAlAqsaParent(element: OverpassElement) {
  const point = coordinates(element);
  if (!point) return false;
  if (point.latitude < AL_AQSA_COMPOUND_BOUNDS.south || point.latitude > AL_AQSA_COMPOUND_BOUNDS.north) return false;
  if (point.longitude < AL_AQSA_COMPOUND_BOUNDS.west || point.longitude > AL_AQSA_COMPOUND_BOUNDS.east) return false;

  const tags = element.tags ?? {};
  const amenity = tags.amenity?.toLowerCase();
  if (amenity && amenity !== 'place_of_worship') return false;
  const searchableNames = names(tags);
  if (searchableNames.some((name) => nonPrayerFacilityNamePattern.test(name))) return false;
  return searchableNames.some((name) => exactAlAqsaNamePattern.test(name));
}

export function isAllowedPrayerElement(element: OverpassElement) {
  const tags = element.tags ?? {};
  return hasExplicitPrayerTags(tags) || isExactAlAqsaParent(element);
}

export function sanitizePrayerPayload(value: unknown): SanitizedPrayerPayload | undefined {
  if (!value || typeof value !== 'object' || !Array.isArray((value as SanitizedPrayerPayload).elements)) return undefined;
  const elements = (value as SanitizedPrayerPayload).elements.filter((element) => {
    return Boolean(element && typeof element === 'object' && typeof element.type === 'string' && typeof element.id === 'number' && isAllowedPrayerElement(element));
  });
  return { elements };
}
