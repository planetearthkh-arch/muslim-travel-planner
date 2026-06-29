import { distanceKm, ensureLatinDisplayName, formatAddress, getEnglishPlaceName, getOriginalPlaceName, type OsmTags, type OverpassElement } from './prayer-spaces.js';
import { openingState, type RestaurantOpenState } from './halal-restaurants.js';

export type CarRentalLocationType = 'airport' | 'city' | 'railway' | 'bus' | 'hotel' | 'independent' | 'unknown';
export type CarRentalSort = 'distance' | 'name' | 'open' | 'airport' | 'website';
export type CarRentalFilters = {
  type: 'all' | CarRentalLocationType;
  openNow: boolean;
  open24: boolean;
  website: boolean;
  phone: boolean;
  wheelchair: boolean;
  atAirport: boolean;
};

export type CarRentalOffice = {
  id: string;
  name: string;
  originalName: string;
  brand: string;
  operator: string;
  locationType: CarRentalLocationType;
  locationContext: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  address: string;
  openingHours: string;
  openState: RestaurantOpenState;
  phone: string;
  email: string;
  website: string;
  bookingUrl: string;
  wheelchair: 'yes' | 'limited' | 'no' | 'unknown';
  branchRef: string;
  sourceUrl: string;
};

const excludedAmenities = new Set(['car_sharing', 'car_pooling', 'bicycle_rental', 'taxi', 'driving_school', 'parking']);
const excludedShops = new Set(['car', 'car_repair', 'bicycle', 'motorcycle', 'scooter']);

export function isCarRentalOffice(tags: OsmTags) {
  if (excludedAmenities.has(tags.amenity ?? '') || excludedShops.has(tags.shop ?? '')) return false;
  if (tags.amenity === 'car_rental') return true;
  if (tags.shop === 'car_rental') return true;
  if (/^(car|motorcar)$/i.test(tags.rental ?? '')) return true;
  if (/^(car|motorcar)$/i.test(tags['vehicle:rental'] ?? '')) return true;
  return false;
}

export function safeRentalUrl(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return '';
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

export function carRentalWheelchair(tags: OsmTags): CarRentalOffice['wheelchair'] {
  const value = (tags.wheelchair ?? '').toLowerCase();
  if (value === 'yes') return 'yes';
  if (value === 'limited') return 'limited';
  if (value === 'no') return 'no';
  return 'unknown';
}

function englishTag(tags: OsmTags, keys: string[]) {
  return keys.map((key) => tags[key]?.trim()).find(Boolean) ?? '';
}

export function classifyCarRentalLocation(tags: OsmTags, originLabel = ''): CarRentalLocationType {
  if (tags.aeroway || tags.airport) return 'airport';
  if (tags.railway || tags.station === 'railway') return 'railway';
  if (tags.bus || tags.station === 'bus') return 'bus';
  if (tags.tourism === 'hotel') return 'hotel';
  const joined = [
    originLabel,
    tags.location,
    tags.inside,
    tags.airport,
    tags.aeroway,
    tags.public_transport,
    tags.railway,
    tags.bus,
    tags.station,
    tags.amenity,
    tags.tourism,
    tags.name,
    tags.description,
    tags.note,
  ].filter(Boolean).join(' ').toLowerCase();
  if (/airport|terminal|aerodrome/.test(joined)) return 'airport';
  if (/rail|train|station/.test(joined)) return 'railway';
  if (/bus|coach/.test(joined)) return 'bus';
  if (/hotel|resort|venue|mall|shopping/.test(joined)) return 'hotel';
  if (/city|downtown|centre|center/.test(joined)) return 'city';
  if (tags.operator || tags.brand || tags.name) return 'independent';
  return 'unknown';
}

function rentalName(tags: OsmTags, locationType: CarRentalLocationType) {
  const explicit = englishTag(tags, ['name:en', 'official_name:en', 'brand:en', 'operator:en', 'short_name:en', 'alt_name:en', 'int_name']);
  const base = explicit || tags.brand || tags.operator || getEnglishPlaceName({ tags, type: undefined });
  const display = ensureLatinDisplayName(base, undefined);
  const unnamed = /^Unnamed Quiet Prayer Space$|^Unnamed Mosque$|^Unnamed Prayer Room$/.test(display);
  if (display && !unnamed) return display;
  if (locationType === 'airport') return 'Airport Car Rental Office';
  if (locationType === 'city') return 'City Car Rental Office';
  if (locationType === 'independent') return 'Independent Car Rental Office';
  return 'Car Rental Office';
}

export function normalizeCarRentalOffice(element: OverpassElement, origin: { latitude: number; longitude: number; label?: string }): CarRentalOffice | undefined {
  const tags = element.tags ?? {};
  if (!isCarRentalOffice(tags)) return undefined;
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;
  const locationType = classifyCarRentalLocation(tags, origin.label);
  const openingHours = tags.opening_hours ?? '';
  const website = safeRentalUrl(tags.website ?? tags['contact:website']);
  const bookingUrl = safeRentalUrl(tags.booking ?? tags.reservation ?? tags['contact:booking'] ?? tags['operator:website']);
  return {
    id: `${element.type}-${element.id}`,
    name: rentalName(tags, locationType),
    originalName: getOriginalPlaceName(tags),
    brand: ensureLatinDisplayName(tags['brand:en'] ?? tags.brand ?? '', undefined),
    operator: ensureLatinDisplayName(tags['operator:en'] ?? tags.operator ?? '', undefined),
    locationType,
    locationContext: ensureLatinDisplayName(englishTag(tags, ['airport:name', 'station:name', 'addr:place', 'inside']) || origin.label || '', undefined),
    latitude,
    longitude,
    distanceKm: distanceKm(origin.latitude, origin.longitude, latitude, longitude),
    address: formatAddress(tags),
    openingHours,
    openState: openingState(openingHours),
    phone: tags.phone ?? tags['contact:phone'] ?? '',
    email: tags.email ?? tags['contact:email'] ?? '',
    website,
    bookingUrl,
    wheelchair: carRentalWheelchair(tags),
    branchRef: tags.ref ?? tags.branch ?? tags['branch:ref'] ?? '',
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  };
}

export function dedupeCarRentalOffices(offices: CarRentalOffice[]) {
  const deduped = new Map<string, CarRentalOffice>();
  for (const office of offices) {
    const identity = `${office.name.toLowerCase()}-${office.latitude.toFixed(5)}-${office.longitude.toFixed(5)}`;
    const current = deduped.get(identity);
    if (!current || (!current.website && office.website)) deduped.set(identity, office);
  }
  return [...deduped.values()];
}

export function filterCarRentalOffices(offices: CarRentalOffice[], filters: CarRentalFilters) {
  return offices.filter((office) => {
    if (filters.type !== 'all' && office.locationType !== filters.type) return false;
    if (filters.atAirport && office.locationType !== 'airport') return false;
    if (filters.openNow && office.openState !== 'open') return false;
    if (filters.open24 && office.openingHours !== '24/7') return false;
    if (filters.website && !office.website && !office.bookingUrl) return false;
    if (filters.phone && !office.phone) return false;
    if (filters.wheelchair && office.wheelchair !== 'yes') return false;
    return true;
  });
}

const typeWeight: Record<CarRentalLocationType, number> = { airport: 0, railway: 1, bus: 2, city: 3, hotel: 4, independent: 5, unknown: 6 };

export function sortCarRentalOffices(offices: CarRentalOffice[], sort: CarRentalSort) {
  return [...offices].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'open') return Number(b.openState === 'open') - Number(a.openState === 'open') || a.distanceKm - b.distanceKm;
    if (sort === 'airport') return Number(b.locationType === 'airport') - Number(a.locationType === 'airport') || typeWeight[a.locationType] - typeWeight[b.locationType] || a.distanceKm - b.distanceKm;
    if (sort === 'website') return Number(Boolean(b.website || b.bookingUrl)) - Number(Boolean(a.website || a.bookingUrl)) || a.distanceKm - b.distanceKm;
    return a.distanceKm - b.distanceKm;
  });
}

export function buildCarRentalOverpassQuery(latitude: number, longitude: number, radiusKm: number) {
  const radiusMeters = Math.round(Math.min(radiusKm, 100) * 1000);
  const around = `(around:${radiusMeters},${latitude},${longitude})`;
  const selectors = [
    `node["amenity"="car_rental"]${around}`,
    `way["amenity"="car_rental"]${around}`,
    `relation["amenity"="car_rental"]["type"="multipolygon"]${around}`,
    `node["shop"="car_rental"]${around}`,
    `way["shop"="car_rental"]${around}`,
    `relation["shop"="car_rental"]["type"="multipolygon"]${around}`,
    `node["rental"~"^(car|motorcar)$"]${around}`,
    `way["rental"~"^(car|motorcar)$"]${around}`,
    `relation["rental"~"^(car|motorcar)$"]["type"="multipolygon"]${around}`,
    `node["vehicle:rental"~"^(car|motorcar)$"]${around}`,
    `way["vehicle:rental"~"^(car|motorcar)$"]${around}`,
    `relation["vehicle:rental"~"^(car|motorcar)$"]["type"="multipolygon"]${around}`,
  ];
  return `[out:json][timeout:25];(${selectors.join(';')};);out center tags;`;
}
