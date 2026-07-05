import { transliterate } from 'transliteration';
import { openingState } from './opening-hours.js';
import { safeExternalUrl } from './urls.js';

export type PrayerPlaceType = 'mosque' | 'prayer-room' | 'quiet-space' | 'islamic-centre';
export type PrayerVerification = 'Verified' | 'Unverified';

export type OsmTags = Record<string, string | undefined>;
export type PlaceNameInput = { name?: string; type?: PrayerPlaceType; tags?: OsmTags };

export type PrayerPlace = {
  id: string;
  name: string;
  originalName: string;
  type: PrayerPlaceType;
  latitude: number;
  longitude: number;
  distanceKm: number;
  address: string;
  openingHours: string;
  womenPrayerArea: PrayerVerification;
  wudu: PrayerVerification;
  wheelchair: PrayerVerification;
  website: string;
  telephone: string;
  verification: PrayerVerification;
  sourceUrl: string;
};

export type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: OsmTags;
};

const toRadians = (degrees: number) => degrees * Math.PI / 180;

export function distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const unsupportedScriptPattern = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const latinDisplayPattern = /^[\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}\p{Mark}\p{Symbol}]+$/u;

const arabicPhraseMap: Array<[RegExp, string]> = [
  [/مسجد\s+الأقصى|مسجد\s+الاقصى|المسجد\s+الأقصى|المسجد\s+الاقصى/u, 'Al-Aqsa Mosque'],
  [/مسجد\s+عمر\s+بن\s+الخطاب/u, 'Omar ibn Al-Khattab Mosque'],
  [/مسجد\s+الشيخ\s+جراح|الشيخ\s+جراح/u, 'Al-Sheikh Jarrah Mosque'],
  [/مسجد\s+الفاروق|الفاروق/u, 'Al-Farouq Mosque'],
  [/مسجد\s+الأبرار|مسجد\s+الابرار|الأبرار|الابرار/u, 'Al-Abrar Mosque'],
  [/مسجد\s+صلاح\s+الدين|صلاح\s+الدين/u, 'Salah al-Din Mosque'],
  [/مسجد\s+عثمان(?:\s+بن\s+عفان)?|عثمان\s+بن\s+عفان/u, 'Othman ibn Affan Mosque'],
  [/مسجد\s+النهيان|النهيان/u, 'Al-Nahyan Mosque'],
  [/سعيد\s+وسعيد|سعد\s+وسعيد/u, "Said wa Su'ayd Mosque"],
  [/المصلى\s+المرواني|المرواني/u, 'Al-Marwani Prayer Hall'],
  [/عرش\s+سليمان/u, 'Throne of Solomon'],
  [/مسجد\s+التقوى/u, 'Al-Taqwa Mosque'],
  [/مسجد\s+النور/u, 'Al-Noor Mosque'],
  [/مصلى\s+المطار/u, 'Airport Prayer Room'],
  [/غرفة\s+صلاة|غرفة\s+الصلاة/u, 'Prayer Room'],
  [/مركز\s+إسلامي|مركز\s+اسلامي/u, 'Islamic Centre'],
];

const canonicalLatinNameMap: Array<[RegExp, string]> = [
  [/\b(?:al[-\s]*)?aqsa\b/i, 'Al-Aqsa Mosque'],
  [/\b(?:al[-\s]*)?sheikh\s+(?:jarrah|sarah)\b/i, 'Al-Sheikh Jarrah Mosque'],
  [/\b(?:said|saeed)\s+(?:wa|and)\s+su['’]?(?:ayd|aid|eed)\b/i, "Said wa Su'ayd Mosque"],
  [/\b(?:al[-\s]*)?far(?:ouq|ooq|uq)\b/i, 'Al-Farouq Mosque'],
  [/\b(?:al[-\s]*)?abrar\b/i, 'Al-Abrar Mosque'],
  [/\bsalah\s+(?:(?:al|el)[-\s]*)?d(?:i|ee)n\b/i, 'Salah al-Din Mosque'],
  [/\b(?:othman|uthman|osman)(?:\s+(?:ibn|bin)\s+affan)?\b/i, 'Othman ibn Affan Mosque'],
  [/\b(?:al[-\s]*)?(?:nahyan|nhayyan|nahayyan|nehayan)\b/i, 'Al-Nahyan Mosque'],
  [/\b(?:al[-\s]*)?marwani\b/i, 'Al-Marwani Prayer Hall'],
  [/\b(?:throne\s+of\s+solomon|solomon'?s\s+throne)\b/i, 'Throne of Solomon'],
];

const facilityWordMap: Array<[RegExp, string]> = [
  [/\bمسجد\b|\bمسجد/u, 'Mosque'],
  [/\bجامع\b|\bجامع/u, 'Grand Mosque'],
  [/\bمصلى\b|\bمصلّى/u, 'Prayer Room'],
  [/\bغرفة\s+صلاة\b|\bغرفة\s+الصلاة\b/u, 'Prayer Room'],
  [/\bمركز\s+إسلامي\b|\bمركز\s+اسلامي\b/u, 'Islamic Centre'],
  [/\bالمطار\b/u, 'Airport'],
  [/\bмечеть\b/iu, 'Mosque'],
  [/\bмолельная\b|\bмолитвенная\s+комната\b/iu, 'Prayer Room'],
  [/\bτζαμί\b/iu, 'Mosque'],
  [/清真寺/g, 'Mosque'],
  [/礼拝室|祈祷室/g, 'Prayer Room'],
  [/기도실/g, 'Prayer Room'],
];

const fallbackForType = (type: PrayerPlaceType | undefined) => {
  if (type === 'mosque') return 'Unnamed Mosque';
  if (type === 'prayer-room') return 'Unnamed Prayer Room';
  if (type === 'islamic-centre') return 'Unnamed Islamic Centre';
  return 'Unnamed Quiet Prayer Space';
};

const generatedPrayerFallbackPattern = /^Unnamed (?:Quiet Prayer Space|Mosque|Prayer Room|Islamic Centre)$/;
const genericPrayerNamePattern = /^(?:the\s+)?(?:al[-\s]*)?(?:masjid|mosque|jami|grand mosque|prayer room|مسجد|جامع|مصلى)$/iu;
const nonMuslimPlacePattern = /\b(?:church|chapel|cathedral|monastery|convent|synagogue)\b|كنيسة|دير|כנסייה|בית\s+כנסת/iu;
const mosqueWordPattern = /\b(?:mosque|masjid|jami)\b|مسجد|جامع/iu;
const suspiciousPunctuationPattern = /[~^`{}\[\]\\|]/;
const ignoredLatinWords = new Set(['mosque', 'masjid', 'jami', 'grand', 'prayer', 'room', 'hall', 'islamic', 'centre', 'center', 'the']);

const hasAffirmingValue = (value: string | undefined) => !!value && /^(yes|designated|available|separate|female|true|1)$/i.test(value);
const hasMuslimSignal = (tags: OsmTags) => tags.religion === 'muslim' || tags.denomination === 'sunni' || tags.denomination === 'shia' || tags.muslim === 'yes';

const AL_AQSA_COMPOUND_BOUNDS = {
  south: 31.7758,
  north: 31.7809,
  west: 35.2325,
  east: 35.2375,
};

const JERUSALEM_BOUNDS = {
  south: 31.70,
  north: 31.85,
  west: 35.15,
  east: 35.30,
};

function insideBounds(latitude: number, longitude: number, bounds: typeof JERUSALEM_BOUNDS) {
  return latitude >= bounds.south && latitude <= bounds.north && longitude >= bounds.west && longitude <= bounds.east;
}

function prayerPlaceSearchableNames(tags: OsmTags) {
  return [
    tags['name:en'],
    tags['official_name:en'],
    tags['short_name:en'],
    tags['alt_name:en'],
    tags.name,
    tags.official_name,
    tags.short_name,
    tags.alt_name,
    tags.loc_name,
  ].filter((value): value is string => Boolean(value)).map((value) => value.trim());
}

function canonicalLatinName(value: string) {
  for (const [pattern, replacement] of canonicalLatinNameMap) {
    if (pattern.test(value)) return replacement;
  }
  return '';
}

function looksLikeBrokenLatinName(value: string) {
  if (suspiciousPunctuationPattern.test(value)) return true;
  const words = value.match(/[A-Za-z]+/g) ?? [];
  const significant = words.filter((word) => word.length >= 4 && !ignoredLatinWords.has(word.toLowerCase()));
  return significant.length > 0 && significant.every((word) => !/[aeiou]/i.test(word));
}

function isClearlyNonMuslimNamed(tags: OsmTags) {
  return prayerPlaceSearchableNames(tags).some((name) => nonMuslimPlacePattern.test(name) && !mosqueWordPattern.test(name));
}

function isMainAlAqsaName(tags: OsmTags) {
  return prayerPlaceSearchableNames(tags).some((name) => /\bal[-\s]?aqsa\b|المسجد\s+الأقصى|المسجد\s+الاقصى|مسجد\s+الأقصى|مسجد\s+الاقصى/iu.test(name));
}

export function isAlAqsaCompoundSubstructure(tags: OsmTags, latitude: number, longitude: number) {
  return insideBounds(latitude, longitude, AL_AQSA_COMPOUND_BOUNDS) && !isMainAlAqsaName(tags);
}

function cleanLatinName(value: string) {
  return value
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/([(])\s+/g, '$1')
    .trim();
}

function titleCaseLatin(value: string) {
  return cleanLatinName(value).replace(/[\p{Script=Latin}\p{Number}][\p{Script=Latin}\p{Number}'-]*/gu, (word) => {
    if (/^(ibn|bin|al|and|of|wa)$/i.test(word)) return word.toLowerCase();
    if (/^[A-Z]{2,}$/.test(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).replace(/\bAl-/g, 'Al-');
}

function translateFacilityWords(value: string) {
  return facilityWordMap.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), value);
}

function transliterateOriginalName(value: string, type: PrayerPlaceType | undefined) {
  const trimmed = value.trim();
  const phrase = arabicPhraseMap.find(([pattern]) => pattern.test(trimmed));
  if (phrase) return phrase[1];
  const withEnglishFacilities = translateFacilityWords(trimmed);
  const transliterated = transliterate(withEnglishFacilities);
  const titled = titleCaseLatin(transliterated)
    .replace(/\bMsl\b/gi, 'Mosque')
    .replace(/\bMsjd\b/gi, 'Mosque')
    .replace(/\bMsly\b/gi, 'Prayer Room')
    .replace(/\bAlnwr\b/gi, 'Al-Noor')
    .replace(/\bAltqwy\b/gi, 'Al-Taqwa')
    .replace(/\bMrkz Islmy\b/gi, 'Islamic Centre');
  const canonical = canonicalLatinName(titled);
  if (canonical) return canonical;
  if (/\bMosque\b/i.test(titled) || /\bPrayer Room\b/i.test(titled) || /\bIslamic Centre\b/i.test(titled)) return titled;
  if (type === 'mosque') return `${titled} Mosque`;
  return titled;
}

export function ensureLatinDisplayName(name: string | undefined, placeType: PrayerPlaceType | undefined) {
  const cleaned = cleanLatinName(name ?? '');
  if (!cleaned) return fallbackForType(placeType);
  const canonical = canonicalLatinName(cleaned);
  if (canonical) return canonical;
  if (!unsupportedScriptPattern.test(cleaned) && latinDisplayPattern.test(cleaned) && !looksLikeBrokenLatinName(cleaned)) return cleaned;
  const converted = cleanLatinName(transliterateOriginalName(cleaned, placeType));
  const convertedCanonical = canonicalLatinName(converted);
  if (convertedCanonical) return convertedCanonical;
  if (converted && !unsupportedScriptPattern.test(converted) && latinDisplayPattern.test(converted) && !looksLikeBrokenLatinName(converted)) return converted;
  return fallbackForType(placeType);
}

export function optionalLatinDisplayName(value: string | undefined) {
  const cleaned = cleanLatinName(value ?? '');
  if (!cleaned) return '';
  const display = ensureLatinDisplayName(cleaned, undefined);
  return generatedPrayerFallbackPattern.test(display) ? '' : display;
}

export function getEnglishPlaceName(place: PlaceNameInput) {
  const tags = place.tags ?? {};
  const type = place.type;
  const candidates = [
    tags['name:en'],
    tags['official_name:en'],
    tags['short_name:en'],
    tags['alt_name:en'],
    tags.int_name,
    tags['loc_name:en'],
    tags['brand:en'],
    tags['operator:en'],
    place.name,
    tags.name,
    tags.official_name,
    tags.short_name,
    tags.alt_name,
    tags.loc_name,
    tags.brand,
    tags.operator,
  ];
  for (const candidate of candidates) {
    const display = ensureLatinDisplayName(candidate, type);
    if (display !== fallbackForType(type)) return display;
  }
  return fallbackForType(type);
}

export function getOriginalPlaceName(tags: OsmTags) {
  return tags.name ?? tags.official_name ?? tags.short_name ?? tags.alt_name ?? tags.loc_name ?? '';
}

export function classifyPrayerPlace(tags: OsmTags): PrayerPlaceType | undefined {
  const amenity = tags.amenity?.toLowerCase();
  const room = tags.room?.toLowerCase();
  const searchableName = [
    tags['name:en'],
    tags.name,
    tags.official_name,
    tags.short_name,
    tags.alt_name,
    tags.loc_name,
    tags.description,
  ].filter(Boolean).join(' ').toLowerCase();

  if (amenity === 'place_of_worship' && hasMuslimSignal(tags)) return 'mosque';
  if (amenity === 'community_centre' && hasMuslimSignal(tags)) return 'islamic-centre';
  if (amenity === 'prayer_room' || room === 'prayer' || tags.prayer_room === 'yes') return 'prayer-room';
  if (/prayer room|quiet prayer|multi[- ]faith|reflection room|muslim prayer/.test(searchableName)) return 'quiet-space';
  return undefined;
}

export function formatAddress(tags: OsmTags) {
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'],
    tags['addr:city'],
    tags['addr:postcode'],
    tags['addr:country'],
  ].filter(Boolean);
  return parts.join(', ');
}

export function osmVerification(tags: OsmTags, placeType: PrayerPlaceType): PrayerVerification {
  if (placeType === 'mosque' && tags.amenity === 'place_of_worship' && hasMuslimSignal(tags)) return 'Verified';
  if ((placeType === 'prayer-room' || placeType === 'quiet-space') && (tags.amenity === 'prayer_room' || tags.room === 'prayer' || tags.prayer_room === 'yes')) return 'Verified';
  if (placeType === 'islamic-centre' && tags.amenity === 'community_centre' && hasMuslimSignal(tags)) return 'Verified';
  return 'Unverified';
}

export function facilityStatus(tags: OsmTags, keys: string[]): PrayerVerification {
  return keys.some((key) => hasAffirmingValue(tags[key])) ? 'Verified' : 'Unverified';
}

export function isReliablyOpenNow(tags: OsmTags, timeZone: string | undefined, now = new Date()) {
  return openingState(tags.opening_hours, timeZone, now) === 'open';
}

function prayerIdentity(name: string, type: PrayerPlaceType, latitude: number, longitude: number, element: OverpassElement) {
  if (!insideBounds(latitude, longitude, JERUSALEM_BOUNDS) || generatedPrayerFallbackPattern.test(name)) {
    return `${element.type}-${element.id}`;
  }
  const normalizedName = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:mosque|masjid|jami|grand|prayer|room|hall|islamic|centre|center|the|al|el)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalizedName) return `${element.type}-${element.id}`;
  const gridLatitude = Math.round(latitude * 500);
  const gridLongitude = Math.round(longitude * 500);
  return `jerusalem-${type}-${normalizedName}-${gridLatitude}-${gridLongitude}`;
}

export function normalizePrayerPlace(element: OverpassElement, origin: { latitude: number; longitude: number }): PrayerPlace | undefined {
  const tags = element.tags ?? {};
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  const type = classifyPrayerPlace(tags);
  if (!type || typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;
  if (isAlAqsaCompoundSubstructure(tags, latitude, longitude)) return undefined;

  const name = getEnglishPlaceName({ tags, type });
  if (insideBounds(latitude, longitude, JERUSALEM_BOUNDS)) {
    if (isClearlyNonMuslimNamed(tags)) return undefined;
    if (generatedPrayerFallbackPattern.test(name) || genericPrayerNamePattern.test(name) || looksLikeBrokenLatinName(name)) return undefined;
  }

  const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;
  return {
    id: prayerIdentity(name, type, latitude, longitude, element),
    name,
    originalName: getOriginalPlaceName(tags),
    type,
    latitude,
    longitude,
    distanceKm: distanceKm(origin.latitude, origin.longitude, latitude, longitude),
    address: formatAddress(tags),
    openingHours: tags.opening_hours ?? '',
    womenPrayerArea: facilityStatus(tags, ['female', 'women', 'prayer:female', 'prayer_room:female', 'female:prayer_room']),
    wudu: facilityStatus(tags, ['wudu', 'ablution', 'toilets:wudu', 'washing:feet']),
    wheelchair: facilityStatus(tags, ['wheelchair']),
    website: safeExternalUrl(tags.website ?? tags.contact_website ?? tags['contact:website']),
    telephone: tags.phone ?? tags.contact_phone ?? tags['contact:phone'] ?? '',
    verification: osmVerification(tags, type),
    sourceUrl,
  };
}

export function buildOverpassQuery(latitude: number, longitude: number, radiusKm: number) {
  const radiusMeters = Math.round(radiusKm * 1000);
  const around = `(around:${radiusMeters},${latitude},${longitude})`;
  const selectors = [
    `node["amenity"="place_of_worship"]["religion"="muslim"]${around}`,
    `way["amenity"="place_of_worship"]["religion"="muslim"]${around}`,
    `relation["amenity"="place_of_worship"]["religion"="muslim"]${around}`,
    `node["amenity"="community_centre"]["religion"="muslim"]${around}`,
    `way["amenity"="community_centre"]["religion"="muslim"]${around}`,
    `relation["amenity"="community_centre"]["religion"="muslim"]${around}`,
    `node["amenity"="prayer_room"]${around}`,
    `way["amenity"="prayer_room"]${around}`,
    `relation["amenity"="prayer_room"]${around}`,
    `node["room"="prayer"]${around}`,
    `way["room"="prayer"]${around}`,
    `relation["room"="prayer"]${around}`,
    `node["prayer_room"="yes"]${around}`,
    `way["prayer_room"="yes"]${around}`,
    `relation["prayer_room"="yes"]${around}`,
  ];
  return `[out:json][timeout:25];(${selectors.join(';')};);out center tags;`;
}
