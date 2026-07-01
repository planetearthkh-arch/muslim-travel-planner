import { distanceKm, ensureLatinDisplayName, formatAddress, getEnglishPlaceName, getOriginalPlaceName, optionalLatinDisplayName, type OsmTags, type OverpassElement } from './prayer-spaces.js';
import { isAlwaysOpen, openingState, type OpeningState } from './opening-hours.js';
import { safeExternalUrl } from './urls.js';

export type ToiletAccess = 'public' | 'customers' | 'restricted' | 'unknown';
export type ToiletFee = 'free' | 'paid' | 'unknown';
export type WheelchairAccess = 'yes' | 'limited' | 'no' | 'unknown';
export type ToiletKind = 'standalone' | 'venue' | 'customers' | 'accessible' | 'portable' | 'unknown';

export type PublicToilet = {
  id: string;
  name: string;
  originalName: string;
  kind: ToiletKind;
  access: ToiletAccess;
  accessNote: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  address: string;
  inside: string;
  fee: ToiletFee;
  feeAmount: string;
  openingHours: string;
  openState: OpeningState;
  wheelchair: WheelchairAccess;
  changingTable: 'yes' | 'limited' | 'no' | 'unknown';
  changingLocation: string;
  male: boolean;
  female: boolean;
  unisex: boolean;
  handwashing: boolean;
  soap: boolean;
  toiletPaper: boolean;
  hotWater: boolean;
  shower: boolean;
  drinkingWater: boolean;
  seated: boolean;
  squat: boolean;
  urinal: boolean;
  operator: string;
  supervised: boolean;
  website: string;
  phone: string;
  sourceUrl: string;
};

export type ToiletFilters = {
  access: 'all' | ToiletAccess;
  free: boolean;
  paid: boolean;
  openNow: boolean;
  open24: boolean;
  wheelchair: boolean;
  limitedWheelchair: boolean;
  changing: boolean;
  female: boolean;
  male: boolean;
  unisex: boolean;
  handwashing: boolean;
  shower: boolean;
  drinkingWater: boolean;
  seated: boolean;
  squat: boolean;
};

export type ToiletSort = 'distance' | 'name' | 'access' | 'free' | 'open' | 'accessible';

const restrictive = /^(private|no|staff|employees|residents)$/i;
const yes = (value: string | undefined) => /^(yes|permissive|public|designated|available|true|1)$/i.test(value ?? '');

export function classifyToiletAccess(tags: OsmTags): ToiletAccess | undefined {
  if (restrictive.test(tags.access ?? '') || restrictive.test(tags['toilets:access'] ?? '') || tags.toilets === 'no') return undefined;
  const explicit = (tags['toilets:access'] ?? tags.access ?? '').toLowerCase();
  if (explicit === 'yes' || explicit === 'permissive') return 'public';
  if (['destination', 'key', 'centralkey', 'permit'].includes(explicit)) return 'restricted';
  if (explicit === 'customers' || /purchase|ticket|key|code|permission|visitors/.test([tags.access, tags['toilets:access'], tags.description, tags.note].filter(Boolean).join(' ').toLowerCase())) return 'customers';
  if (tags.amenity === 'toilets' || tags.building === 'toilets') return tags.access ? 'restricted' : 'public';
  if (tags.toilets === 'yes') return tags['toilets:access'] ? 'restricted' : 'unknown';
  if (tags['toilets:access']) return 'unknown';
  return undefined;
}

export function classifyToiletKind(tags: OsmTags, access: ToiletAccess): ToiletKind {
  if (tags.portable === 'yes' || tags.toilets === 'portable') return 'portable';
  if (access === 'customers') return 'customers';
  if ((tags.wheelchair === 'yes' || tags['toilets:wheelchair'] === 'yes')) return 'accessible';
  if (tags.amenity === 'toilets' || tags.building === 'toilets') return 'standalone';
  if (tags.toilets === 'yes' || tags['toilets:access']) return 'venue';
  return 'unknown';
}

export function toiletFee(tags: OsmTags): { fee: ToiletFee; amount: string } {
  const value = tags.fee?.trim();
  if (!value) return { fee: 'unknown', amount: '' };
  if (value === 'no') return { fee: 'free', amount: '' };
  if (value === 'yes') return { fee: 'paid', amount: '' };
  return { fee: 'paid', amount: value };
}

export function wheelchairAccess(tags: OsmTags): WheelchairAccess {
  const value = (tags['toilets:wheelchair'] ?? tags.wheelchair ?? '').toLowerCase();
  if (value === 'yes') return 'yes';
  if (value === 'limited') return 'limited';
  if (value === 'no') return 'no';
  return 'unknown';
}

export function changingTable(tags: OsmTags): PublicToilet['changingTable'] {
  const value = (tags.changing_table ?? '').toLowerCase();
  if (value === 'yes') return 'yes';
  if (value === 'limited') return 'limited';
  if (value === 'no') return 'no';
  return 'unknown';
}

function boolTag(tags: OsmTags, keys: string[]) {
  return keys.some((key) => yes(tags[key]));
}

function toiletName(tags: OsmTags, kind: ToiletKind) {
  const host = getEnglishPlaceName({ tags, type: undefined });
  const display = ensureLatinDisplayName(host, undefined);
  const unnamed = /^Unnamed Quiet Prayer Space$|^Unnamed Mosque$|^Unnamed Prayer Room$/.test(display);
  if (!unnamed && display) return tags.amenity === 'toilets' || tags.building === 'toilets' ? display : `${display} Toilets`;
  if (kind === 'accessible') return 'Accessible Public Toilets';
  if (kind === 'venue') return 'Toilets Inside Venue';
  if (kind === 'customers') return 'Customers-Only Toilets';
  if (kind === 'unknown') return 'Toilet - Access Unknown';
  return 'Public Toilets';
}

function hostVenueName(tags: OsmTags) {
  return optionalLatinDisplayName(tags['name:en'] ?? tags['official_name:en'] ?? tags['alt_name:en'] ?? tags.int_name ?? tags.name ?? tags.official_name ?? tags.alt_name);
}

export function normalizePublicToilet(element: OverpassElement, origin: { latitude: number; longitude: number; timezone?: string }): PublicToilet | undefined {
  const tags = element.tags ?? {};
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  const access = classifyToiletAccess(tags);
  if (!access || typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;
  const feeData = toiletFee(tags);
  const kind = classifyToiletKind(tags, access);
  const openingHours = tags.opening_hours ?? '';
  return {
    id: `${element.type}-${element.id}`,
    name: toiletName(tags, kind),
    originalName: getOriginalPlaceName(tags),
    kind,
    access,
    accessNote: tags['toilets:access'] ?? tags.access ?? tags.note ?? '',
    latitude,
    longitude,
    distanceKm: distanceKm(origin.latitude, origin.longitude, latitude, longitude),
    address: formatAddress(tags),
    inside: tags.amenity === 'toilets' || tags.building === 'toilets' ? '' : hostVenueName(tags),
    fee: feeData.fee,
    feeAmount: feeData.amount,
    openingHours,
    openState: openingState(openingHours, origin.timezone),
    wheelchair: wheelchairAccess(tags),
    changingTable: changingTable(tags),
    changingLocation: tags['changing_table:location'] ?? '',
    male: boolTag(tags, ['male', 'toilets:male']),
    female: boolTag(tags, ['female', 'toilets:female']),
    unisex: boolTag(tags, ['unisex', 'toilets:unisex']),
    handwashing: boolTag(tags, ['handwashing', 'toilets:handwashing']),
    soap: boolTag(tags, ['soap', 'toilets:soap']),
    toiletPaper: boolTag(tags, ['toilet_paper', 'toilets:paper_supplied']),
    hotWater: boolTag(tags, ['hot_water']),
    shower: boolTag(tags, ['shower']),
    drinkingWater: boolTag(tags, ['drinking_water']),
    seated: boolTag(tags, ['toilets:seated', 'toilets:position:seated']),
    squat: boolTag(tags, ['toilets:squat', 'toilets:position:squat']),
    urinal: boolTag(tags, ['urinal', 'toilets:urinal']),
    operator: tags.operator ?? '',
    supervised: boolTag(tags, ['supervised', 'staffed']),
    website: safeExternalUrl(tags.website ?? tags.contact_website ?? tags['contact:website']),
    phone: tags.phone ?? tags.contact_phone ?? tags['contact:phone'] ?? '',
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  };
}

export function dedupeToilets(toilets: PublicToilet[]) {
  const deduped = new Map<string, PublicToilet>();
  for (const toilet of toilets) {
    const key = `${toilet.name.toLowerCase()}-${toilet.latitude.toFixed(5)}-${toilet.longitude.toFixed(5)}`;
    const current = deduped.get(key);
    if (!current || (current.access === 'unknown' && toilet.access !== 'unknown')) deduped.set(key, toilet);
  }
  return [...deduped.values()];
}

export function filterToilets(toilets: PublicToilet[], filters: ToiletFilters) {
  return toilets.filter((toilet) => {
    if (filters.access !== 'all' && toilet.access !== filters.access) return false;
    if (filters.free && toilet.fee !== 'free') return false;
    if (filters.paid && toilet.fee !== 'paid') return false;
    if (filters.openNow && toilet.openState !== 'open') return false;
    if (filters.open24 && !isAlwaysOpen(toilet.openingHours)) return false;
    if (filters.wheelchair && toilet.wheelchair !== 'yes') return false;
    if (filters.limitedWheelchair && toilet.wheelchair !== 'limited') return false;
    if (filters.changing && toilet.changingTable !== 'yes') return false;
    if (filters.female && !toilet.female) return false;
    if (filters.male && !toilet.male) return false;
    if (filters.unisex && !toilet.unisex) return false;
    if (filters.handwashing && !toilet.handwashing) return false;
    if (filters.shower && !toilet.shower) return false;
    if (filters.drinkingWater && !toilet.drinkingWater) return false;
    if (filters.seated && !toilet.seated) return false;
    if (filters.squat && !toilet.squat) return false;
    return true;
  });
}

const accessWeight: Record<ToiletAccess, number> = { public: 0, customers: 1, restricted: 2, unknown: 3 };

export function sortToilets(toilets: PublicToilet[], sort: ToiletSort) {
  return [...toilets].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'access') return accessWeight[a.access] - accessWeight[b.access] || a.distanceKm - b.distanceKm;
    if (sort === 'free') return Number(b.fee === 'free') - Number(a.fee === 'free') || a.distanceKm - b.distanceKm;
    if (sort === 'open') return Number(b.openState === 'open') - Number(a.openState === 'open') || a.distanceKm - b.distanceKm;
    if (sort === 'accessible') return Number(b.wheelchair === 'yes') - Number(a.wheelchair === 'yes') || a.distanceKm - b.distanceKm;
    return a.distanceKm - b.distanceKm;
  });
}

export function buildToiletOverpassQuery(latitude: number, longitude: number, radiusKm: number) {
  const radiusMeters = Math.round(Math.min(radiusKm, 25) * 1000);
  const around = `(around:${radiusMeters},${latitude},${longitude})`;
  const selectors = [
    `node["amenity"="toilets"]${around}`,
    `way["amenity"="toilets"]${around}`,
    `relation["amenity"="toilets"]${around}`,
    `node["building"="toilets"]${around}`,
    `way["building"="toilets"]${around}`,
    `relation["building"="toilets"]${around}`,
    `node["toilets"="yes"]${around}`,
    `way["toilets"="yes"]${around}`,
    `relation["toilets"="yes"]${around}`,
    `node["toilets:access"]${around}`,
    `way["toilets:access"]${around}`,
    `relation["toilets:access"]${around}`,
  ];
  return `[out:json][timeout:25];(${selectors.join(';')};);out center tags;`;
}
