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

const AL_AQSA_BOUNDS = { south: 31.7758, north: 31.7809, west: 35.2325, east: 35.2375 };
const AL_AQSA_CENTER = { latitude: 31.7783, longitude: 35.2354 };
const alAqsaName = /\bal[-\s]?aqsa\b|\bmasjid\s+(?:al[-\s]?)?aqsa\b|المسجد\s+الأقصى|المسجد\s+الاقصى|مسجد\s+الأقصى|مسجد\s+الاقصى/iu;
const nonMuslimName = /\b(?:church|chapel|cathedral|monastery|convent|synagogue|temple)\b|كنيسة|دير|معبد|כנסייה|בית\s+כנסת/iu;
const mosqueWord = /\b(?:mosque|masjid|jami)\b|مسجد|جامع/iu;
const genericName = /^(?:the\s+)?(?:al[-\s]*)?(?:masjid|mosque|jami|grand mosque|prayer room|prayer hall|islamic centre|islamic center|مسجد|جامع|مصلى)$/iu;
const unsupportedScript = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const suspiciousPunctuation = /[~^`{}\[\]\\|]/;

const fallbackName = (type: PrayerPlaceType | undefined) => type === 'mosque'
  ? 'Unnamed Mosque'
  : type === 'prayer-room'
    ? 'Unnamed Prayer Room'
    : type === 'islamic-centre'
      ? 'Unnamed Islamic Centre'
      : 'Unnamed Quiet Prayer Space';

const fallbackPattern = /^Unnamed (?:Mosque|Prayer Room|Islamic Centre|Quiet Prayer Space)$/;
const toRadians = (value: number) => value * Math.PI / 180;

export function distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sourceNames(tags: OsmTags) {
  return [
    tags['name:en'], tags['official_name:en'], tags['short_name:en'], tags['alt_name:en'],
    tags['name:ar'], tags['official_name:ar'], tags['alt_name:ar'],
    tags.name, tags.official_name, tags.short_name, tags.alt_name, tags.loc_name,
  ].filter((value): value is string => Boolean(value)).map((value) => value.trim());
}

function clean(value: string) {
  return value.replace(/_/g, ' ').replace(/\s+/g, ' ').replace(/\s+([,.;:)])/g, '$1').trim();
}

function canonicalName(value: string) {
  const name = clean(value);
  const pairs: Array<[RegExp, string]> = [
    [/^(?:al[-\s]*)?aqsa(?:\s+(?:mosque|masjid))?$/i, 'Al-Aqsa Mosque'],
    [/^(?:al[-\s]*)?sheikh\s+(?:jarrah|sarah)(?:\s+(?:mosque|masjid))?$/i, 'Al-Sheikh Jarrah Mosque'],
    [/^(?:said|saeed)\s+(?:wa|and)\s+su['’]?(?:ayd|aid|eed)(?:\s+(?:mosque|masjid))?$/i, "Said wa Su'ayd Mosque"],
    [/^(?:al[-\s]*)?far(?:ouq|ooq|uq)(?:\s+(?:mosque|masjid))?$/i, 'Al-Farouq Mosque'],
    [/^(?:al[-\s]*)?abrar(?:\s+(?:mosque|masjid))?$/i, 'Al-Abrar Mosque'],
    [/^salah\s+(?:(?:al|el)[-\s]*)?d(?:i|ee)n(?:\s+(?:mosque|masjid))?$/i, 'Salah al-Din Mosque'],
    [/^(?:othman|uthman|osman)(?:\s+(?:ibn|bin)\s+affan)?(?:\s+(?:mosque|masjid))?$/i, 'Othman ibn Affan Mosque'],
    [/^(?:al[-\s]*)?(?:nahyan|nhayyan|nahayyan|nehayan)(?:\s+(?:mosque|masjid))?$/i, 'Al-Nahyan Mosque'],
    [/^(?:masjid\s+)?(?:al[-\s]*)?noor(?:\s+(?:mosque|masjid))?$/i, 'Al-Noor Mosque'],
    [/^(?:masjid\s+)?(?:al[-\s]*)?taqwa(?:\s+(?:mosque|masjid))?$/i, 'Al-Taqwa Mosque'],
  ];
  return pairs.find(([pattern]) => pattern.test(name))?.[1] ?? '';
}

function looksBroken(value: string) {
  if (suspiciousPunctuation.test(value)) return true;
  const words = value.match(/[A-Za-z]+/g) ?? [];
  const ignored = new Set(['mosque', 'masjid', 'jami', 'grand', 'prayer', 'room', 'hall', 'islamic', 'centre', 'center', 'the', 'of']);
  const meaningful = words.filter((word) => word.length >= 4 && !ignored.has(word.toLowerCase()));
  return meaningful.length > 0 && meaningful.every((word) => !/[aeiou]/i.test(word));
}

function standardizeLatin(value: string, type: PrayerPlaceType | undefined) {
  let result = clean(value)
    .replace(/\bMoschee\b/gi, 'Mosque')
    .replace(/\bMezquita\b/gi, 'Mosque')
    .replace(/\bMosquée\b/gi, 'Mosque')
    .replace(/\bIslamic Center\b/gi, 'Islamic Centre')
    .replace(/\bPrayer Hall\b/gi, 'Prayer Room');

  const canonical = canonicalName(result);
  if (canonical) return canonical;

  if (type === 'mosque') {
    const malformedOf = result.match(/^of\s+(.+?)\s+(?:mosque|masjid)$/i);
    if (malformedOf) result = `Mosque of ${malformedOf[1]}`;
    const masjidOf = result.match(/^masjid\s+of\s+(.+)$/i);
    if (masjidOf) result = `Mosque of ${masjidOf[1]}`;
    else if (/^masjid\s+/i.test(result)) result = `${result.replace(/^masjid\s+/i, '')} Mosque`;
    if (/\s+masjid$/i.test(result)) result = `${result.replace(/\s+masjid$/i, '')} Mosque`;
    const mosqueOf = result.match(/^mosque\s+of\s+(.+)$/i);
    if (mosqueOf) result = `Mosque of ${mosqueOf[1]}`;
    else if (/^mosque\s+/i.test(result)) result = `${result.replace(/^mosque\s+/i, '')} Mosque`;
    if (!/\bMosque\b/i.test(result)) result = `${result} Mosque`;
    result = result.replace(/(?:\s+Mosque){2,}$/i, ' Mosque');
  }
  return clean(result);
}

function transliterated(value: string, type: PrayerPlaceType | undefined) {
  const direct: Array<[RegExp, string]> = [
    [/مسجد\s+الأقصى|مسجد\s+الاقصى|المسجد\s+الأقصى|المسجد\s+الاقصى/u, 'Al-Aqsa Mosque'],
    [/مسجد\s+عمر\s+بن\s+الخطاب/u, 'Omar ibn Al-Khattab Mosque'],
    [/مسجد\s+الشيخ\s+جراح|الشيخ\s+جراح/u, 'Al-Sheikh Jarrah Mosque'],
    [/مسجد\s+الفاروق|الفاروق/u, 'Al-Farouq Mosque'],
    [/مسجد\s+الأبرار|مسجد\s+الابرار|الأبرار|الابرار/u, 'Al-Abrar Mosque'],
    [/مسجد\s+صلاح\s+الدين|صلاح\s+الدين/u, 'Salah al-Din Mosque'],
    [/مسجد\s+عثمان(?:\s+بن\s+عفان)?|عثمان\s+بن\s+عفان/u, 'Othman ibn Affan Mosque'],
    [/مسجد\s+النهيان|النهيان/u, 'Al-Nahyan Mosque'],
    [/مسجد\s+التقوى/u, 'Al-Taqwa Mosque'],
    [/مسجد\s+النور/u, 'Al-Noor Mosque'],
  ];
  const known = direct.find(([pattern]) => pattern.test(value));
  if (known) return known[1];
  return standardizeLatin(transliterate(value), type);
}

export function ensureLatinDisplayName(name: string | undefined, type: PrayerPlaceType | undefined) {
  const value = clean(name ?? '');
  if (!value || genericName.test(value)) return fallbackName(type);
  const canonical = canonicalName(value);
  if (canonical) return canonical;
  if (!unsupportedScript.test(value)) return looksBroken(value) ? fallbackName(type) : standardizeLatin(value, type);
  const converted = clean(transliterated(value, type));
  return !converted || looksBroken(converted) || unsupportedScript.test(converted) ? fallbackName(type) : converted;
}

export function optionalLatinDisplayName(value: string | undefined) {
  const display = ensureLatinDisplayName(value, undefined);
  return fallbackPattern.test(display) ? '' : display;
}

export function getEnglishPlaceName(place: PlaceNameInput) {
  const tags = place.tags ?? {};
  const candidates = [
    tags['name:en'], tags['official_name:en'], tags['short_name:en'], tags['alt_name:en'], tags.int_name,
    tags['loc_name:en'], tags['brand:en'], tags['operator:en'], tags['name:ar'], tags['official_name:ar'],
    tags['alt_name:ar'], place.name, tags.name, tags.official_name, tags.short_name, tags.alt_name, tags.loc_name,
    tags.brand, tags.operator,
  ];
  for (const candidate of candidates) {
    const display = ensureLatinDisplayName(candidate, place.type);
    if (!fallbackPattern.test(display)) return display;
  }
  return fallbackName(place.type);
}

export function getOriginalPlaceName(tags: OsmTags) {
  return tags.name ?? tags.official_name ?? tags.short_name ?? tags.alt_name ?? tags.loc_name ?? '';
}

function hasMuslimSignal(tags: OsmTags) {
  return tags.religion === 'muslim' || tags.denomination === 'sunni' || tags.denomination === 'shia' || tags.muslim === 'yes';
}

export function classifyPrayerPlace(tags: OsmTags): PrayerPlaceType | undefined {
  const amenity = tags.amenity?.toLowerCase();
  const room = tags.room?.toLowerCase();
  const searchable = [tags['name:en'], tags.name, tags.official_name, tags.short_name, tags.alt_name, tags.loc_name, tags.description].filter(Boolean).join(' ').toLowerCase();
  if (sourceNames(tags).some((name) => alAqsaName.test(name))) return 'mosque';
  if (amenity === 'place_of_worship' && hasMuslimSignal(tags)) return 'mosque';
  if (amenity === 'community_centre' && hasMuslimSignal(tags)) return 'islamic-centre';
  if (amenity === 'prayer_room' || room === 'prayer' || tags.prayer_room === 'yes') return 'prayer-room';
  if (/prayer room|quiet prayer|multi[- ]faith|reflection room|muslim prayer/.test(searchable)) return 'quiet-space';
  return undefined;
}

export function isAlAqsaCompoundSubstructure(tags: OsmTags, latitude: number, longitude: number) {
  const inside = latitude >= AL_AQSA_BOUNDS.south && latitude <= AL_AQSA_BOUNDS.north && longitude >= AL_AQSA_BOUNDS.west && longitude <= AL_AQSA_BOUNDS.east;
  return inside && !sourceNames(tags).some((name) => alAqsaName.test(name));
}

export function formatAddress(tags: OsmTags) {
  return [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city'], tags['addr:postcode'], tags['addr:country']].filter(Boolean).join(', ');
}

export function osmVerification(tags: OsmTags, type: PrayerPlaceType): PrayerVerification {
  if (type === 'mosque' && tags.amenity === 'place_of_worship' && hasMuslimSignal(tags)) return 'Verified';
  if ((type === 'prayer-room' || type === 'quiet-space') && (tags.amenity === 'prayer_room' || tags.room === 'prayer' || tags.prayer_room === 'yes')) return 'Verified';
  if (type === 'islamic-centre' && tags.amenity === 'community_centre' && hasMuslimSignal(tags)) return 'Verified';
  return 'Unverified';
}

export function facilityStatus(tags: OsmTags, keys: string[]): PrayerVerification {
  return keys.some((key) => /^(yes|designated|available|separate|female|true|1)$/i.test(tags[key] ?? '')) ? 'Verified' : 'Unverified';
}

export function isReliablyOpenNow(tags: OsmTags, timeZone: string | undefined, now = new Date()) {
  return openingState(tags.opening_hours, timeZone, now) === 'open';
}

function identityName(name: string) {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(?:mosque|masjid|jami|grand|prayer|room|hall|islamic|centre|center|the|al|el|of)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function normalizePrayerPlace(element: OverpassElement, origin: { latitude: number; longitude: number }): PrayerPlace | undefined {
  const tags = element.tags ?? {};
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  const type = classifyPrayerPlace(tags);
  if (!type || typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;
  if (isAlAqsaCompoundSubstructure(tags, latitude, longitude)) return undefined;
  if (sourceNames(tags).some((name) => nonMuslimName.test(name) && !mosqueWord.test(name))) return undefined;
  const name = getEnglishPlaceName({ tags, type });
  const identity = identityName(name);
  const id = fallbackPattern.test(name) || !identity
    ? `${element.type}-${element.id}`
    : `prayer-${type}-${identity}-${Math.round(latitude * 750)}-${Math.round(longitude * 750)}`;
  return {
    id,
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
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  };
}

function queryCanReachAlAqsa(latitude: number, longitude: number, radiusKm: number) {
  return distanceKm(latitude, longitude, AL_AQSA_CENTER.latitude, AL_AQSA_CENTER.longitude) <= radiusKm + 1.5;
}

export function buildOverpassQuery(latitude: number, longitude: number, radiusKm: number) {
  const around = `(around:${Math.round(radiusKm * 1000)},${latitude},${longitude})`;
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
  if (queryCanReachAlAqsa(latitude, longitude, radiusKm)) {
    const pattern = 'Al[- ]?Aqsa|Masjid[ -]?Al[- ]?Aqsa|Masjid[ -]?Aqsa|الأقصى|الاقصى';
    for (const key of ['name', 'name:en', 'name:ar', 'official_name', 'official_name:en', 'official_name:ar']) {
      selectors.push(`node["${key}"~"${pattern}",i]${around}`);
      selectors.push(`way["${key}"~"${pattern}",i]${around}`);
      selectors.push(`relation["${key}"~"${pattern}",i]${around}`);
    }
  }
  return `[out:json][timeout:25];(${selectors.join(';')};);out center tags;`;
}
