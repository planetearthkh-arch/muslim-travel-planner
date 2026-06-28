export type PrayerPlaceType = 'mosque' | 'prayer-room' | 'quiet-space';
export type PrayerVerification = 'Verified' | 'Unverified';

export type OsmTags = Record<string, string | undefined>;

export type PrayerPlace = {
  id: string;
  name: string;
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

  const name = tags.name || tags['name:en'] || (type === 'mosque' ? 'Unnamed mosque' : 'Unnamed prayer space');
  const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;
  return {
    id: `${element.type}-${element.id}`,
    name,
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
