export type PrayerPlaceType = 'mosque' | 'prayer-room' | 'quiet-space';
export type PrayerVerification = 'Verified' | 'Unverified';

export type OsmTags = Record<string, string | undefined>;

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


const latinPattern = /[A-Za-z]/;
const nonLatinPattern = /[^\u0000-\u007f]/;

const arabicWordMap: Record<string, string> = {
  'مسجد': 'Mosque',
  'جامع': 'Mosque',
  'مصلى': 'Prayer Room',
  'مصلّى': 'Prayer Room',
  'غرفة': 'Room',
  'صلاة': 'Prayer',
  'الصلاة': 'Prayer',
  'المطار': 'Airport',
  'الاقصى': 'Al-Aqsa',
  'الأقصى': 'Al-Aqsa',
  'القدس': 'Al-Quds',
  'عمر': 'Omar',
  'النور': 'Al-Nour',
  'نور': 'Nour',
};

const arabicCharMap: Record<string, string> = {
  ا: 'a', أ: 'a', إ: 'i', آ: 'aa', ب: 'b', ت: 't', ث: 'th', ج: 'j', ح: 'h', خ: 'kh', د: 'd', ذ: 'dh', ر: 'r', ز: 'z', س: 's', ش: 'sh', ص: 's', ض: 'd', ط: 't', ظ: 'z', ع: '', غ: 'gh', ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', و: 'w', ي: 'y', ى: 'a', ة: 'a', ء: '', ئ: 'i', ؤ: 'u', لا: 'la',
};

const cyrillicCharMap: Record<string, string> = {
  А: 'A', а: 'a', Б: 'B', б: 'b', В: 'V', в: 'v', Г: 'G', г: 'g', Д: 'D', д: 'd', Е: 'E', е: 'e', Ё: 'Yo', ё: 'yo', Ж: 'Zh', ж: 'zh', З: 'Z', з: 'z', И: 'I', и: 'i', Й: 'Y', й: 'y', К: 'K', к: 'k', Л: 'L', л: 'l', М: 'M', м: 'm', Н: 'N', н: 'n', О: 'O', о: 'o', П: 'P', п: 'p', Р: 'R', р: 'r', С: 'S', с: 's', Т: 'T', т: 't', У: 'U', у: 'u', Ф: 'F', ф: 'f', Х: 'Kh', х: 'kh', Ц: 'Ts', ц: 'ts', Ч: 'Ch', ч: 'ch', Ш: 'Sh', ш: 'sh', Щ: 'Shch', щ: 'shch', Ы: 'Y', ы: 'y', Э: 'E', э: 'e', Ю: 'Yu', ю: 'yu', Я: 'Ya', я: 'ya', Ь: '', ь: '', Ъ: '', ъ: '',
};

function titleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function transliterateCharacters(value: string) {
  return [...value].map((character) => arabicCharMap[character] ?? cyrillicCharMap[character] ?? character).join('').replace(/\s+/g, ' ').trim();
}

function englishFromArabicName(value: string) {
  const normalized = value.replace(/[\u064b-\u065f]/g, '').trim();
  if (normalized === 'غرفة صلاة' || normalized === 'غرفة الصلاة') return 'Prayer Room';
  const words = normalized.split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  if (words[0] === 'مسجد' || words[0] === 'جامع') {
    const rest = words.slice(1).map((word) => arabicWordMap[word] ?? titleCase(transliterateCharacters(word))).join(' ').trim();
    return rest ? `${rest} Mosque` : 'Unnamed Mosque';
  }
  if (words[0] === 'مصلى' || words[0] === 'مصلّى') {
    const rest = words.slice(1).map((word) => arabicWordMap[word] ?? titleCase(transliterateCharacters(word))).join(' ').trim();
    return rest ? `${rest} Prayer Room` : 'Unnamed Prayer Space';
  }
  const mapped = words.map((word) => arabicWordMap[word] ?? titleCase(transliterateCharacters(word))).join(' ').replace(/Room Prayer/g, 'Prayer Room');
  return mapped;
}

function englishReadableName(tags: OsmTags, type: PrayerPlaceType) {
  const preferred = tags['name:en'] ?? tags['official_name:en'] ?? tags.int_name ?? tags['alt_name:en'];
  const original = tags.name ?? tags.official_name ?? tags.alt_name ?? '';
  if (preferred?.trim()) return { name: preferred.trim(), originalName: original.trim() };
  if (original.trim()) {
    const trimmed = original.trim();
    if (!nonLatinPattern.test(trimmed) || latinPattern.test(trimmed)) return { name: trimmed, originalName: '' };
    const name = /[\u0600-\u06ff]/.test(trimmed) ? englishFromArabicName(trimmed) : titleCase(transliterateCharacters(trimmed));
    return { name: name || (type === 'mosque' ? 'Unnamed Mosque' : 'Unnamed Prayer Space'), originalName: trimmed };
  }
  return { name: type === 'mosque' ? 'Unnamed Mosque' : 'Unnamed Prayer Space', originalName: '' };
}

const hasAffirmingValue = (value: string | undefined) => !!value && /^(yes|designated|available|separate|female|true|1)$/i.test(value);
const hasMuslimSignal = (tags: OsmTags) => tags.religion === 'muslim' || tags.denomination === 'sunni' || tags.denomination === 'shia' || tags['muslim'] === 'yes';

export function classifyPrayerPlace(tags: OsmTags): PrayerPlaceType | undefined {
  const amenity = tags.amenity?.toLowerCase();
  const room = tags.room?.toLowerCase();
  const name = `${tags.name ?? ''} ${tags.description ?? ''}`.toLowerCase();

  if (amenity === 'place_of_worship' && hasMuslimSignal(tags)) return 'mosque';
  if (amenity === 'prayer_room' || room === 'prayer' || tags.prayer_room === 'yes') return 'prayer-room';
  if (/prayer room|quiet prayer|multi[- ]faith|reflection room|muslim prayer/.test(name)) return 'quiet-space';
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
  return 'Unverified';
}

export function facilityStatus(tags: OsmTags, keys: string[]): PrayerVerification {
  return keys.some((key) => hasAffirmingValue(tags[key])) ? 'Verified' : 'Unverified';
}

export function isReliablyOpenNow(tags: OsmTags, now = new Date()) {
  const value = tags.opening_hours?.trim();
  if (!value) return undefined;
  if (value === '24/7') return true;
  if (/off|closed/i.test(value)) return false;
  if (/^Mo-Su\s+00:00-24:00$/i.test(value)) return true;
  void now;
  return undefined;
}

export function normalizePrayerPlace(element: OverpassElement, origin: { latitude: number; longitude: number }): PrayerPlace | undefined {
  const tags = element.tags ?? {};
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  const type = classifyPrayerPlace(tags);
  if (!type || typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;

  const displayName = englishReadableName(tags, type);
  const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;
  return {
    id: `${element.type}-${element.id}`,
    name: displayName.name,
    originalName: displayName.originalName,
    type,
    latitude,
    longitude,
    distanceKm: distanceKm(origin.latitude, origin.longitude, latitude, longitude),
    address: formatAddress(tags),
    openingHours: tags.opening_hours ?? '',
    womenPrayerArea: facilityStatus(tags, ['female', 'women', 'prayer:female', 'prayer_room:female', 'female:prayer_room']),
    wudu: facilityStatus(tags, ['wudu', 'ablution', 'toilets:wudu', 'washing:feet']),
    wheelchair: facilityStatus(tags, ['wheelchair']),
    website: tags.website ?? tags.contact_website ?? tags['contact:website'] ?? '',
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
