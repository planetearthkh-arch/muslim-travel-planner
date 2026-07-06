import { distanceKm, ensureLatinDisplayName, formatAddress, getEnglishPlaceName, getOriginalPlaceName, optionalLatinDisplayName, type OsmTags, type OverpassElement } from './prayer-spaces.js';
import { openingState, type OpeningState } from './opening-hours.js';
import { safeExternalUrl } from './urls.js';

export type PublicTransportType = 'train' | 'metro' | 'light-rail' | 'tram' | 'bus-station' | 'bus-stop' | 'ferry' | 'other';
export type PublicTransportSort = 'distance' | 'name' | 'type' | 'open' | 'accessibility';
export type PublicTransportFilters = {
  type: 'all' | PublicTransportType;
  wheelchair: boolean;
  openNow: boolean;
  toilets: boolean;
  shelter: boolean;
};

export type PublicTransportStop = {
  id: string;
  name: string;
  originalName: string;
  type: PublicTransportType;
  latitude: number;
  longitude: number;
  distanceKm: number;
  address: string;
  operator: string;
  network: string;
  ref: string;
  routes: string;
  openingHours: string;
  openState: OpeningState;
  wheelchair: 'yes' | 'limited' | 'no' | 'unknown';
  shelter: 'yes' | 'no' | 'unknown';
  seating: 'yes' | 'no' | 'unknown';
  toilets: 'yes' | 'no' | 'unknown';
  website: string;
  phone: string;
  sourceUrl: string;
};

const yes = (value: string | undefined) => /^(yes|designated|available|true|1)$/i.test(value ?? '');
const no = (value: string | undefined) => /^(no|false|0)$/i.test(value ?? '');

function isValidPublicTransportCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

export function classifyPublicTransport(tags: OsmTags): PublicTransportType | undefined {
  const railway = tags.railway?.toLowerCase();
  const station = tags.station?.toLowerCase();
  const publicTransport = tags.public_transport?.toLowerCase();
  const amenity = tags.amenity?.toLowerCase();
  const highway = tags.highway?.toLowerCase();
  const route = tags.route?.toLowerCase();
  const train = tags.train?.toLowerCase();
  const subway = tags.subway?.toLowerCase();
  const lightRail = tags.light_rail?.toLowerCase();
  const tram = tags.tram?.toLowerCase();
  const bus = tags.bus?.toLowerCase();
  const ferry = tags.ferry?.toLowerCase();

  if (amenity === 'ferry_terminal' || route === 'ferry' || ferry === 'yes') return 'ferry';
  if (amenity === 'bus_station') return 'bus-station';
  if (highway === 'bus_stop') return 'bus-stop';
  if (railway === 'tram_stop' || tram === 'yes') return 'tram';
  if (railway === 'subway_entrance' || station === 'subway' || subway === 'yes') return 'metro';
  if (station === 'light_rail' || railway === 'light_rail' || lightRail === 'yes') return 'light-rail';
  if ((railway === 'station' || railway === 'halt') && station === 'subway') return 'metro';
  if ((railway === 'station' || railway === 'halt') && station === 'light_rail') return 'light-rail';
  if (railway === 'station' || railway === 'halt' || train === 'yes') return 'train';
  if (publicTransport === 'station' || publicTransport === 'platform' || publicTransport === 'stop_position') {
    if (bus === 'yes') return 'bus-stop';
    if (tram === 'yes') return 'tram';
    if (subway === 'yes') return 'metro';
    if (lightRail === 'yes') return 'light-rail';
    if (ferry === 'yes') return 'ferry';
    if (train === 'yes') return 'train';
    return 'other';
  }
  return undefined;
}

function taggedValue(tags: OsmTags, keys: string[]) {
  return keys.map((key) => tags[key]?.trim()).find(Boolean) ?? '';
}

function publicTransportFallback(type: PublicTransportType | undefined) {
  if (type === 'train') return 'Train Station';
  if (type === 'metro') return 'Metro Station';
  if (type === 'light-rail') return 'Light-Rail Station';
  if (type === 'tram') return 'Tram Stop';
  if (type === 'bus-station') return 'Bus Station';
  if (type === 'bus-stop') return 'Bus Stop';
  if (type === 'ferry') return 'Ferry Terminal';
  return 'Public Transport Stop';
}

function publicTransportName(tags: OsmTags, type: PublicTransportType) {
  const explicit = taggedValue(tags, ['name:en', 'official_name:en', 'short_name:en', 'alt_name:en', 'int_name']);
  const display = ensureLatinDisplayName(explicit || getEnglishPlaceName({ tags, type: undefined }), undefined);
  if (display && !/^Unnamed Quiet Prayer Space$|^Unnamed Mosque$|^Unnamed Prayer Room$/.test(display)) return display;
  return publicTransportFallback(type);
}

function tagState(tags: OsmTags, keys: string[]): 'yes' | 'no' | 'unknown' {
  const value = taggedValue(tags, keys);
  if (yes(value)) return 'yes';
  if (no(value)) return 'no';
  return 'unknown';
}

export function publicTransportWheelchair(tags: OsmTags): PublicTransportStop['wheelchair'] {
  const value = (tags.wheelchair ?? '').toLowerCase();
  if (value === 'yes') return 'yes';
  if (value === 'limited') return 'limited';
  if (value === 'no') return 'no';
  return 'unknown';
}

export function normalizePublicTransportStop(element: OverpassElement, origin: { latitude: number; longitude: number; timezone?: string }): PublicTransportStop | undefined {
  const tags = element.tags ?? {};
  const type = classifyPublicTransport(tags);
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (!type || typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;
  if (!isValidPublicTransportCoordinate(latitude, longitude) || !isValidPublicTransportCoordinate(origin.latitude, origin.longitude)) return undefined;
  const openingHours = tags.opening_hours ?? '';
  const routes = taggedValue(tags, ['line', 'lines', 'route_ref', 'routes', 'bus_routes', 'train_routes']);
  return {
    id: `${element.type}-${element.id}`,
    name: publicTransportName(tags, type),
    originalName: getOriginalPlaceName(tags),
    type,
    latitude,
    longitude,
    distanceKm: distanceKm(origin.latitude, origin.longitude, latitude, longitude),
    address: formatAddress(tags),
    operator: optionalLatinDisplayName(taggedValue(tags, ['operator:en', 'operator'])),
    network: optionalLatinDisplayName(taggedValue(tags, ['network:en', 'network'])),
    ref: taggedValue(tags, ['ref', 'station:ref', 'uic_ref', 'iata', 'local_ref']),
    routes,
    openingHours,
    openState: openingState(openingHours, origin.timezone),
    wheelchair: publicTransportWheelchair(tags),
    shelter: tagState(tags, ['shelter', 'covered']),
    seating: tagState(tags, ['bench', 'seating']),
    toilets: tagState(tags, ['toilets']),
    website: safeExternalUrl(tags.website ?? tags['contact:website']),
    phone: tags.phone ?? tags['contact:phone'] ?? '',
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  };
}

const typePriority: Record<PublicTransportType, number> = { train: 0, metro: 1, 'light-rail': 2, tram: 3, 'bus-station': 4, ferry: 5, 'bus-stop': 6, other: 7 };
const typeWeight: Record<PublicTransportType, number> = { train: 0, metro: 1, 'light-rail': 2, tram: 3, 'bus-station': 4, 'bus-stop': 5, ferry: 6, other: 7 };

function closeEnough(a: PublicTransportStop, b: PublicTransportStop, decimals: number) {
  return a.latitude.toFixed(decimals) === b.latitude.toFixed(decimals) && a.longitude.toFixed(decimals) === b.longitude.toFixed(decimals);
}

function hasDistinctIdentifier(stop: PublicTransportStop) {
  return Boolean(stop.ref || stop.routes || !/^Train Station$|^Metro Station$|^Bus Stop$|^Public Transport Stop$/.test(stop.name));
}

function betterTransportRecord(a: PublicTransportStop, b: PublicTransportStop) {
  const aScore = typePriority[a.type] * 10 - Number(Boolean(a.ref)) - Number(Boolean(a.website)) - Number(Boolean(a.network));
  const bScore = typePriority[b.type] * 10 - Number(Boolean(b.ref)) - Number(Boolean(b.website)) - Number(Boolean(b.network));
  return aScore <= bScore ? a : b;
}

export function dedupePublicTransportStops(stops: PublicTransportStop[]) {
  const sorted = [...stops].sort((a, b) => typePriority[a.type] - typePriority[b.type] || a.distanceKm - b.distanceKm);
  const deduped: PublicTransportStop[] = [];
  for (const stop of sorted) {
    const sameNamed = deduped.find((existing) => existing.name.toLowerCase() === stop.name.toLowerCase() && closeEnough(existing, stop, 4));
    if (sameNamed) {
      const replacement = betterTransportRecord(sameNamed, stop);
      deduped[deduped.indexOf(sameNamed)] = replacement;
      continue;
    }
    const parentStation = deduped.find((existing) => ['train', 'metro', 'light-rail', 'bus-station', 'ferry'].includes(existing.type) && existing.type === stop.type && closeEnough(existing, stop, 3));
    if (parentStation && (!hasDistinctIdentifier(stop) || /entrance|platform|stop/i.test(stop.name))) continue;
    deduped.push(stop);
  }
  return deduped;
}

export function filterPublicTransportStops(stops: PublicTransportStop[], filters: PublicTransportFilters) {
  return stops.filter((stop) => {
    if (filters.type !== 'all' && stop.type !== filters.type) return false;
    if (filters.wheelchair && stop.wheelchair !== 'yes') return false;
    if (filters.openNow && stop.openState !== 'open') return false;
    if (filters.toilets && stop.toilets !== 'yes') return false;
    if (filters.shelter && stop.shelter !== 'yes') return false;
    return true;
  });
}

export function sortPublicTransportStops(stops: PublicTransportStop[], sort: PublicTransportSort) {
  return [...stops].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'type') return typeWeight[a.type] - typeWeight[b.type] || a.distanceKm - b.distanceKm;
    if (sort === 'open') return Number(b.openState === 'open') - Number(a.openState === 'open') || a.distanceKm - b.distanceKm;
    if (sort === 'accessibility') return Number(b.wheelchair === 'yes') - Number(a.wheelchair === 'yes') || a.distanceKm - b.distanceKm;
    return a.distanceKm - b.distanceKm;
  });
}

export function buildPublicTransportOverpassQuery(latitude: number, longitude: number, radiusKm: number) {
  const radiusMeters = Math.round(Math.min(radiusKm, 50) * 1000);
  const around = `(around:${radiusMeters},${latitude},${longitude})`;
  const selectors = [
    '["railway"~"^(station|halt|tram_stop|light_rail|subway_entrance)$"]',
    '["station"~"^(subway|light_rail)$"]',
    '["public_transport"~"^(station|platform|stop_position)$"]',
    '["highway"="bus_stop"]',
    '["amenity"~"^(bus_station|ferry_terminal)$"]',
  ].flatMap((selector) => [`node${selector}${around}`, `way${selector}${around}`, `relation${selector}${around}`]);
  return `[out:json][timeout:25];(${selectors.join(';')};);out center tags;`;
}
