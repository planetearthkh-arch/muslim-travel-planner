import { distanceKm, ensureLatinDisplayName, formatAddress, getEnglishPlaceName, getOriginalPlaceName, type OsmTags, type OverpassElement } from './prayer-spaces.js';
import { openingState, type OpeningState } from './opening-hours.js';
import { safeExternalUrl } from './urls.js';

export type TaxiServiceType = 'rank' | 'airport' | 'station' | 'bus' | 'office' | 'motorcycle' | 'water' | 'other';
export type TaxiSort = 'distance' | 'name' | 'type' | 'open' | 'contact';
export type TaxiFilters = {
  type: 'all' | TaxiServiceType;
  openNow: boolean;
  phone: boolean;
  website: boolean;
  wheelchairInfo: boolean;
  shelter: boolean;
};

export type TaxiService = {
  id: string;
  name: string;
  originalName: string;
  type: TaxiServiceType;
  latitude: number;
  longitude: number;
  distanceKm: number;
  address: string;
  operator: string;
  phone: string;
  callHref: string;
  website: string;
  openingHours: string;
  openState: OpeningState;
  capacity: string;
  vehicle: string;
  wheelchair: 'yes' | 'limited' | 'no' | 'unknown';
  shelter: 'yes' | 'no' | 'unknown';
  lit: 'yes' | 'no' | 'unknown';
  fee: string;
  sourceUrl: string;
};

const yes = (value: string | undefined) => /^(yes|designated|available|true|1)$/i.test(value ?? '');
const no = (value: string | undefined) => /^(no|false|0)$/i.test(value ?? '');
const officeEvidence = /\b(taxi|cab|minicab|dispatch)\b/i;
const weakOfficeValues = new Set(['office', 'company', 'transport', 'travel_agency']);

function taggedValue(tags: OsmTags, keys: string[]) {
  return keys.map((key) => tags[key]?.trim()).find(Boolean) ?? '';
}

export function isTaxiOffice(tags: OsmTags) {
  if (tags.amenity === 'taxi') return false;
  const shop = tags.shop?.toLowerCase();
  const office = tags.office?.toLowerCase();
  const service = tags.service?.toLowerCase();
  const business = tags.business?.toLowerCase();
  const identity = taggedValue(tags, ['name:en', 'name', 'operator:en', 'operator', 'brand:en', 'brand']);
  const explicitTaxiBusiness = tags['taxi:office'] === 'yes' || tags['taxi:dispatch'] === 'yes' || shop === 'taxi' || office === 'taxi' || service === 'taxi' || business === 'taxi';
  if (explicitTaxiBusiness && identity) return true;
  if ((shop === 'travel_agency' || weakOfficeValues.has(office ?? '')) && officeEvidence.test(identity) && (tags.phone || tags['contact:phone'] || tags.website || tags['contact:website'])) return true;
  return false;
}

export function classifyTaxiService(tags: OsmTags): TaxiServiceType | undefined {
  if (tags.amenity !== 'taxi' && !isTaxiOffice(tags)) return undefined;
  const vehicle = (tags.taxi_vehicle ?? tags.vehicle ?? '').toLowerCase();
  if (/^(motorcycle|motorbike|moped)$/i.test(vehicle)) return 'motorcycle';
  if (/^(motorboat|boat|water_taxi|water-taxi)$/i.test(vehicle) || tags.water_taxi === 'yes') return 'water';
  if (isTaxiOffice(tags)) return 'office';
  if (tags.aeroway || tags.airport) return 'airport';
  if (tags.railway || tags.station === 'railway' || tags.station === 'subway' || tags.station === 'metro') return 'station';
  if (tags.bus === 'yes' || tags.station === 'bus') return 'bus';
  const joined = [tags.location, tags.inside, tags.aeroway, tags.airport, tags.public_transport, tags.railway, tags.station, tags.bus, tags.amenity, tags.description, tags.note]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/airport|aerodrome|terminal/.test(joined)) return 'airport';
  if (/rail|train|subway|metro|station/.test(joined)) return 'station';
  if (/bus|coach/.test(joined)) return 'bus';
  return tags.amenity === 'taxi' ? 'rank' : 'other';
}

export function normalizeTaxiPhone(value: string | undefined) {
  const raw = value?.trim() ?? '';
  if (!raw || /[A-Za-z]/.test(raw)) return '';
  const cleaned = raw.replace(/[().\s-]/g, '');
  if (!/^\+?\d{5,16}$/.test(cleaned)) return '';
  return cleaned;
}

function tagState(tags: OsmTags, keys: string[]): 'yes' | 'no' | 'unknown' {
  const value = taggedValue(tags, keys);
  if (yes(value)) return 'yes';
  if (no(value)) return 'no';
  return 'unknown';
}

function taxiFallback(type: TaxiServiceType | undefined) {
  if (type === 'airport') return 'Airport Taxi Rank';
  if (type === 'station') return 'Station Taxi Rank';
  if (type === 'bus') return 'Bus-Terminal Taxi Rank';
  if (type === 'office') return 'Taxi Office';
  if (type === 'motorcycle') return 'Motorcycle-Taxi Rank';
  if (type === 'water') return 'Water-Taxi Rank';
  return 'Taxi Rank';
}

function taxiName(tags: OsmTags, type: TaxiServiceType) {
  const explicit = taggedValue(tags, ['name:en', 'official_name:en', 'short_name:en', 'alt_name:en', 'int_name', 'operator:en', 'brand:en']);
  const display = ensureLatinDisplayName(explicit || getEnglishPlaceName({ tags, type: undefined }), undefined);
  if (display && !/^Unnamed Quiet Prayer Space$|^Unnamed Mosque$|^Unnamed Prayer Room$/.test(display)) return display;
  return taxiFallback(type);
}

export function normalizeTaxiService(element: OverpassElement, origin: { latitude: number; longitude: number; timezone?: string }): TaxiService | undefined {
  const tags = element.tags ?? {};
  const type = classifyTaxiService(tags);
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (!type || typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;
  const phone = tags.phone ?? tags['contact:phone'] ?? '';
  const call = normalizeTaxiPhone(phone);
  const openingHours = tags.opening_hours ?? '';
  const wheelchair = (tags.wheelchair ?? '').toLowerCase();
  return {
    id: `${element.type}-${element.id}`,
    name: taxiName(tags, type),
    originalName: getOriginalPlaceName(tags),
    type,
    latitude,
    longitude,
    distanceKm: distanceKm(origin.latitude, origin.longitude, latitude, longitude),
    address: formatAddress(tags),
    operator: ensureLatinDisplayName(taggedValue(tags, ['operator:en', 'operator', 'brand:en', 'brand']), undefined),
    phone,
    callHref: call ? `tel:${call}` : '',
    website: safeExternalUrl(tags.website ?? tags['contact:website']),
    openingHours,
    openState: openingState(openingHours, origin.timezone),
    capacity: tags.capacity ?? '',
    vehicle: tags.taxi_vehicle ?? '',
    wheelchair: wheelchair === 'yes' ? 'yes' : wheelchair === 'limited' ? 'limited' : wheelchair === 'no' ? 'no' : 'unknown',
    shelter: tagState(tags, ['shelter', 'covered']),
    lit: tagState(tags, ['lit']),
    fee: tags.fee ?? '',
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  };
}

const typePriority: Record<TaxiServiceType, number> = { airport: 0, station: 1, bus: 2, rank: 3, motorcycle: 4, water: 5, office: 6, other: 7 };

function richerTaxi(a: TaxiService, b: TaxiService) {
  const score = (item: TaxiService) => [item.website, item.phone, item.operator, item.openingHours, item.capacity, item.vehicle].filter(Boolean).length;
  return score(b) > score(a) ? b : a;
}

export function dedupeTaxiServices(items: TaxiService[]) {
  const deduped: TaxiService[] = [];
  for (const item of [...items].sort((a, b) => typePriority[a.type] - typePriority[b.type] || a.distanceKm - b.distanceKm)) {
    const match = deduped.find((existing) => {
      const sameKind = existing.type === item.type || (existing.type !== 'office' && item.type !== 'office');
      const sameIdentity = existing.name.toLowerCase() === item.name.toLowerCase() || (existing.operator && existing.operator.toLowerCase() === item.operator.toLowerCase());
      const close = Math.abs(existing.latitude - item.latitude) < 0.00035 && Math.abs(existing.longitude - item.longitude) < 0.00035;
      return sameKind && sameIdentity && close;
    });
    if (match) deduped[deduped.indexOf(match)] = richerTaxi(match, item);
    else deduped.push(item);
  }
  return deduped;
}

export function filterTaxiServices(items: TaxiService[], filters: TaxiFilters) {
  return items.filter((item) => {
    if (filters.type !== 'all' && item.type !== filters.type) return false;
    if (filters.openNow && item.openState !== 'open') return false;
    if (filters.phone && !item.callHref) return false;
    if (filters.website && !item.website) return false;
    if (filters.wheelchairInfo && item.wheelchair === 'unknown') return false;
    if (filters.shelter && item.shelter !== 'yes') return false;
    return true;
  });
}

export function sortTaxiServices(items: TaxiService[], sort: TaxiSort) {
  return [...items].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'type') return typePriority[a.type] - typePriority[b.type] || a.distanceKm - b.distanceKm;
    if (sort === 'open') return Number(b.openState === 'open') - Number(a.openState === 'open') || a.distanceKm - b.distanceKm;
    if (sort === 'contact') return Number(Boolean(b.callHref || b.website)) - Number(Boolean(a.callHref || a.website)) || a.distanceKm - b.distanceKm;
    return a.distanceKm - b.distanceKm;
  });
}

export function buildTaxiOverpassQuery(latitude: number, longitude: number, radiusKm: number) {
  const radiusMeters = Math.round(Math.min(radiusKm, 50) * 1000);
  const around = `(around:${radiusMeters},${latitude},${longitude})`;
  const selectors = [
    `node["amenity"="taxi"]${around}`,
    `way["amenity"="taxi"]${around}`,
    `relation["amenity"="taxi"]${around}`,
    `node["shop"="taxi"]${around}`,
    `way["shop"="taxi"]${around}`,
    `relation["shop"="taxi"]${around}`,
    `node["office"="taxi"]${around}`,
    `way["office"="taxi"]${around}`,
    `relation["office"="taxi"]${around}`,
    `node["taxi:office"="yes"]${around}`,
    `way["taxi:office"="yes"]${around}`,
    `relation["taxi:office"="yes"]${around}`,
    `node["taxi:dispatch"="yes"]${around}`,
    `way["taxi:dispatch"="yes"]${around}`,
    `relation["taxi:dispatch"="yes"]${around}`,
  ];
  return `[out:json][timeout:25];(${selectors.join(';')};);out center tags;`;
}
