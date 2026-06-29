import { distanceKm, ensureLatinDisplayName, formatAddress, getEnglishPlaceName, getOriginalPlaceName, type OsmTags, type OverpassElement } from './prayer-spaces.js';
import { openingState, type RestaurantOpenState } from './halal-restaurants.js';

export type AttractionCategory = 'historic' | 'museum' | 'gallery' | 'monument' | 'archaeological' | 'castle' | 'religious' | 'viewpoint' | 'natural' | 'park' | 'zoo' | 'theme' | 'artwork' | 'cultural' | 'other';
export type AttractionView = 'photos' | 'list' | 'map';
export type AttractionSort = 'distance' | 'name' | 'category' | 'photo' | 'history' | 'open' | 'complete';
export type AttractionFilters = {
  category: 'all' | AttractionCategory;
  photo: boolean;
  history: boolean;
  openNow: boolean;
  free: boolean;
  wheelchair: boolean;
};

export type AttractionPhoto = {
  thumbnailUrl: string;
  sourceUrl: string;
  title: string;
  creator: string;
  license: string;
  licenseUrl: string;
  credit: string;
};

export type Attraction = {
  id: string;
  name: string;
  originalName: string;
  category: AttractionCategory;
  latitude: number;
  longitude: number;
  distanceKm: number;
  address: string;
  openingHours: string;
  openState: RestaurantOpenState;
  website: string;
  phone: string;
  wheelchair: 'yes' | 'limited' | 'no' | 'unknown';
  fee: 'free' | 'paid' | 'unknown';
  wikipedia: string;
  wikidata: string;
  commons: string;
  osmDescription: string;
  history: string;
  historySource: string;
  readMoreUrl: string;
  photo?: AttractionPhoto;
  sourceUrl: string;
};

const tourismAttractions = new Set(['attraction', 'museum', 'gallery', 'viewpoint', 'zoo', 'aquarium', 'theme_park', 'artwork']);
const historicAttractions = new Set(['monument', 'memorial', 'castle', 'archaeological_site', 'ruins', 'fort', 'city_gate', 'manor', 'church', 'mosque', 'synagogue', 'palace']);

export function isMappedAttraction(tags: OsmTags) {
  if (tourismAttractions.has(tags.tourism ?? '')) return true;
  if (tags.historic && (historicAttractions.has(tags.historic) || tags.tourism === 'attraction')) return true;
  if (tags.leisure === 'nature_reserve') return true;
  if (tags.leisure === 'park' && (tags.tourism === 'attraction' || tags.historic || tags.wikipedia || tags.wikidata)) return true;
  if (tags.boundary === 'protected_area' && (tags.tourism === 'attraction' || tags.protect_class || tags.wikipedia || tags.wikidata)) return true;
  if ((tags.natural === 'peak' || tags.natural === 'waterfall') && (tags.tourism === 'attraction' || tags.wikipedia || tags.wikidata)) return true;
  return false;
}

export function classifyAttraction(tags: OsmTags): AttractionCategory {
  if (tags.tourism === 'museum') return 'museum';
  if (tags.tourism === 'gallery') return 'gallery';
  if (tags.tourism === 'viewpoint') return 'viewpoint';
  if (tags.tourism === 'zoo' || tags.tourism === 'aquarium') return 'zoo';
  if (tags.tourism === 'theme_park') return 'theme';
  if (tags.tourism === 'artwork') return 'artwork';
  if (['monument', 'memorial'].includes(tags.historic ?? '')) return 'monument';
  if (['archaeological_site', 'ruins'].includes(tags.historic ?? '')) return 'archaeological';
  if (['castle', 'fort', 'manor', 'palace', 'city_gate'].includes(tags.historic ?? '')) return 'castle';
  if (['church', 'mosque', 'synagogue'].includes(tags.historic ?? '')) return 'religious';
  if (tags.historic) return 'historic';
  if (tags.natural === 'peak' || tags.natural === 'waterfall' || tags.leisure === 'nature_reserve' || tags.boundary === 'protected_area') return 'natural';
  if (tags.leisure === 'park') return 'park';
  if (tags.tourism === 'attraction') return 'cultural';
  return 'other';
}

function wikipediaTitle(tags: OsmTags) {
  const value = tags['wikipedia:en'] ?? tags.wikipedia ?? '';
  const title = value.includes(':') ? value.split(':').slice(1).join(':') : value;
  return title.replace(/_/g, ' ').trim();
}

function fallbackName(category: AttractionCategory) {
  if (category === 'historic') return 'Historic Attraction';
  if (category === 'museum') return 'Museum';
  if (category === 'viewpoint') return 'Scenic Viewpoint';
  if (category === 'archaeological') return 'Archaeological Site';
  if (category === 'monument') return 'Monument';
  if (category === 'natural') return 'Natural Attraction';
  if (category === 'cultural') return 'Cultural Attraction';
  return 'Mapped Attraction';
}

export function attractionName(tags: OsmTags, category: AttractionCategory) {
  const explicit = tags['name:en'] ?? tags['official_name:en'] ?? tags['short_name:en'] ?? tags['alt_name:en'] ?? tags.int_name ?? wikipediaTitle(tags);
  const candidate = explicit || getEnglishPlaceName({ tags, type: undefined });
  const display = ensureLatinDisplayName(candidate, undefined);
  const unnamed = /^Unnamed Quiet Prayer Space$|^Unnamed Mosque$|^Unnamed Prayer Room$/.test(display);
  return display && !unnamed ? display : fallbackName(category);
}

function fee(tags: OsmTags): Attraction['fee'] {
  if (tags.fee === 'no') return 'free';
  if (tags.fee === 'yes' || tags.charge) return 'paid';
  return 'unknown';
}

function wheelchair(tags: OsmTags): Attraction['wheelchair'] {
  if (tags.wheelchair === 'yes') return 'yes';
  if (tags.wheelchair === 'limited') return 'limited';
  if (tags.wheelchair === 'no') return 'no';
  return 'unknown';
}

export function normalizeAttraction(element: OverpassElement, origin: { latitude: number; longitude: number }): Attraction | undefined {
  const tags = element.tags ?? {};
  if (!isMappedAttraction(tags)) return undefined;
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;
  const category = classifyAttraction(tags);
  const name = attractionName(tags, category);
  const openingHours = tags.opening_hours ?? '';
  const wikiTitle = wikipediaTitle(tags);
  return {
    id: `${element.type}-${element.id}`,
    name,
    originalName: getOriginalPlaceName(tags),
    category,
    latitude,
    longitude,
    distanceKm: distanceKm(origin.latitude, origin.longitude, latitude, longitude),
    address: formatAddress(tags),
    openingHours,
    openState: openingState(openingHours),
    website: tags.website ?? tags['contact:website'] ?? '',
    phone: tags.phone ?? tags['contact:phone'] ?? '',
    wheelchair: wheelchair(tags),
    fee: fee(tags),
    wikipedia: wikiTitle,
    wikidata: tags.wikidata ?? '',
    commons: tags.wikimedia_commons ?? '',
    osmDescription: tags['description:en'] ?? '',
    history: '',
    historySource: '',
    readMoreUrl: wikiTitle ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, '_'))}` : '',
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  };
}

export function dedupeAttractions(attractions: Attraction[]) {
  const deduped = new Map<string, Attraction>();
  for (const attraction of attractions) {
    const key = `${attraction.name.toLowerCase()}-${attraction.latitude.toFixed(5)}-${attraction.longitude.toFixed(5)}`;
    const current = deduped.get(key);
    if (!current || completeness(attraction) > completeness(current)) deduped.set(key, attraction);
  }
  return [...deduped.values()];
}

export function categoryExplanation(category: AttractionCategory) {
  if (category === 'viewpoint') return 'This is a mapped scenic viewpoint overlooking the surrounding area.';
  if (category === 'museum') return 'This is a mapped museum or visitor exhibition site.';
  if (category === 'gallery') return 'This is a mapped art gallery or exhibition attraction.';
  if (category === 'natural') return 'This is a mapped natural attraction identified for visitors.';
  if (category === 'archaeological') return 'This is a mapped archaeological attraction.';
  if (category === 'monument') return 'This is a mapped monument or memorial.';
  if (category === 'religious') return 'This is a mapped religious heritage attraction.';
  if (category === 'park') return 'This is a mapped park or garden identified as a visitor attraction.';
  if (category === 'artwork') return 'This is a mapped public artwork.';
  return 'This is a mapped visitor attraction from open map data.';
}

export function canAttachExternalSource(attraction: Attraction, candidate: { wikipedia?: string; wikidata?: string; commons?: string; name?: string; category?: AttractionCategory; distanceKm?: number }) {
  if (candidate.wikipedia && attraction.wikipedia && candidate.wikipedia === attraction.wikipedia) return true;
  if (candidate.wikidata && attraction.wikidata && candidate.wikidata === attraction.wikidata) return true;
  if (candidate.commons && attraction.commons && candidate.commons === attraction.commons) return true;
  if (candidate.name && candidate.category === attraction.category && (candidate.distanceKm ?? 99) <= 0.25 && candidate.name.toLowerCase() === attraction.name.toLowerCase()) return true;
  return false;
}

export function summarizeWikipediaExtract(extract: string) {
  return extract
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(' ')
    .slice(0, 500)
    .trim();
}

export function acceptableCommonsLicense(metadata: { license?: string; licenseUrl?: string; thumbnailUrl?: string; sourceUrl?: string }) {
  const license = (metadata.license ?? '').toLowerCase();
  return Boolean(metadata.thumbnailUrl && metadata.sourceUrl && (license.includes('cc') || license.includes('public domain') || license.includes('pd')));
}

export function normalizeCommonsImage(raw: any): AttractionPhoto | undefined {
  const page = raw?.query?.pages ? Object.values(raw.query.pages)[0] as any : raw;
  const ext = page?.imageinfo?.[0] ?? page;
  const photo = {
    thumbnailUrl: ext.thumburl ?? ext.thumbnailUrl ?? '',
    sourceUrl: ext.descriptionurl ?? ext.sourceUrl ?? '',
    title: page?.title ?? ext.title ?? '',
    creator: ext.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '') ?? ext.creator ?? '',
    license: ext.extmetadata?.LicenseShortName?.value ?? ext.license ?? '',
    licenseUrl: ext.extmetadata?.LicenseUrl?.value ?? ext.licenseUrl ?? '',
    credit: ext.extmetadata?.Credit?.value?.replace(/<[^>]+>/g, '') ?? ext.credit ?? '',
  };
  return acceptableCommonsLicense(photo) ? photo : undefined;
}

export function enrichAttraction(attraction: Attraction, source: { wikipediaExtract?: string; wikidataDescription?: string; osmDescription?: string; commonsImage?: any } = {}) {
  const photo = source.commonsImage ? normalizeCommonsImage(source.commonsImage) : attraction.photo;
  const history = source.wikipediaExtract ? summarizeWikipediaExtract(source.wikipediaExtract) : source.wikidataDescription || source.osmDescription || attraction.osmDescription || categoryExplanation(attraction.category);
  const historySource = source.wikipediaExtract ? 'Wikipedia' : source.wikidataDescription ? 'Wikidata' : (source.osmDescription || attraction.osmDescription) ? 'OpenStreetMap' : 'OpenStreetMap tags';
  return { ...attraction, photo, history, historySource };
}

function completeness(attraction: Attraction) {
  return Number(Boolean(attraction.photo)) + Number(Boolean(attraction.history)) + Number(Boolean(attraction.website)) + Number(Boolean(attraction.openingHours)) + Number(attraction.wheelchair !== 'unknown') + Number(attraction.fee !== 'unknown');
}

export function filterAttractions(attractions: Attraction[], filters: AttractionFilters) {
  return attractions.filter((attraction) => {
    if (filters.category !== 'all' && attraction.category !== filters.category) return false;
    if (filters.photo && !attraction.photo) return false;
    if (filters.history && !attraction.history) return false;
    if (filters.openNow && attraction.openState !== 'open') return false;
    if (filters.free && attraction.fee !== 'free') return false;
    if (filters.wheelchair && attraction.wheelchair !== 'yes') return false;
    return true;
  });
}

export function sortAttractions(attractions: Attraction[], sort: AttractionSort) {
  return [...attractions].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'category') return a.category.localeCompare(b.category) || a.distanceKm - b.distanceKm;
    if (sort === 'photo') return Number(Boolean(b.photo)) - Number(Boolean(a.photo)) || a.distanceKm - b.distanceKm;
    if (sort === 'history') return Number(Boolean(b.history)) - Number(Boolean(a.history)) || a.distanceKm - b.distanceKm;
    if (sort === 'open') return Number(b.openState === 'open') - Number(a.openState === 'open') || a.distanceKm - b.distanceKm;
    if (sort === 'complete') return completeness(b) - completeness(a) || a.distanceKm - b.distanceKm;
    return a.distanceKm - b.distanceKm;
  });
}

export function buildAttractionOverpassQuery(latitude: number, longitude: number, radiusKm: number) {
  const radiusMeters = Math.round(Math.min(radiusKm, 50) * 1000);
  const around = `(around:${radiusMeters},${latitude},${longitude})`;
  const selectors = [
    `node["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park|artwork)$"]${around}`,
    `way["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park|artwork)$"]${around}`,
    `relation["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|aquarium|theme_park|artwork)$"]${around}`,
    `node["historic"]${around}`,
    `way["historic"]${around}`,
    `relation["historic"]${around}`,
    `node["leisure"="nature_reserve"]${around}`,
    `way["leisure"="nature_reserve"]${around}`,
    `relation["leisure"="nature_reserve"]${around}`,
    `node["leisure"="park"]["tourism"="attraction"]${around}`,
    `way["leisure"="park"]["tourism"="attraction"]${around}`,
    `relation["leisure"="park"]["tourism"="attraction"]${around}`,
    `node["boundary"="protected_area"]${around}`,
    `way["boundary"="protected_area"]${around}`,
    `relation["boundary"="protected_area"]${around}`,
    `node["natural"~"^(peak|waterfall)$"]["tourism"="attraction"]${around}`,
    `way["natural"~"^(peak|waterfall)$"]["tourism"="attraction"]${around}`,
    `relation["natural"~"^(peak|waterfall)$"]["tourism"="attraction"]${around}`,
  ];
  return `[out:json][timeout:25];(${selectors.join(';')};);out center tags;`;
}

