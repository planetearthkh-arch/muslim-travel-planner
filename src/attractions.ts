import { distanceKm, ensureLatinDisplayName, formatAddress, getEnglishPlaceName, getOriginalPlaceName, type OsmTags, type OverpassElement } from './prayer-spaces.js';
import { openingState, type RestaurantOpenState } from './halal-restaurants.js';
import { safeExternalUrl } from './urls.js';

export type AttractionCategory = 'historic' | 'museum' | 'gallery' | 'monument' | 'archaeological' | 'castle' | 'religious' | 'viewpoint' | 'natural' | 'park' | 'zoo' | 'theme' | 'artwork' | 'cultural' | 'other';
export type AttractionView = 'photos' | 'list' | 'map';
export type AttractionSort = 'distance' | 'name' | 'category' | 'photo' | 'history' | 'open' | 'complete';
export type AttractionQueryBatch = {
  id: string;
  label: string;
  query: string;
};
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

export type AttractionPhotoStatus = 'idle' | 'loading' | 'checked' | 'error';

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
  wikipediaRaw: string;
  wikidata: string;
  commons: string;
  aliases: string[];
  osmDescription: string;
  history: string;
  historySource: string;
  readMoreUrl: string;
  photo?: AttractionPhoto;
  photoStatus: AttractionPhotoStatus;
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
  if (tags.amenity === 'place_of_worship' && (tags.wikipedia || tags['wikipedia:en'] || tags.wikidata)) return true;
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
  if (tags.amenity === 'place_of_worship') return 'religious';
  if (tags.historic) return 'historic';
  if (tags.natural === 'peak' || tags.natural === 'waterfall' || tags.leisure === 'nature_reserve' || tags.boundary === 'protected_area') return 'natural';
  if (tags.leisure === 'park') return 'park';
  if (tags.tourism === 'attraction') return 'cultural';
  return 'other';
}

function wikipediaTitle(tags: OsmTags) {
  const value = tags['wikipedia:en'] ?? (tags.wikipedia?.startsWith('en:') ? tags.wikipedia : '') ?? '';
  const title = value.includes(':') ? value.split(':').slice(1).join(':') : value;
  return title.replace(/_/g, ' ').trim();
}

export function parseWikipediaTag(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { language: '', title: '' };
  const parts = trimmed.split(':');
  if (parts.length > 1 && /^[a-z][a-z-]{1,12}$/i.test(parts[0])) {
    return { language: parts[0].toLowerCase(), title: parts.slice(1).join(':').replace(/_/g, ' ').trim() };
  }
  return { language: 'en', title: trimmed.replace(/_/g, ' ').trim() };
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

function attractionAliases(tags: OsmTags) {
  return [
    tags['name:en'],
    tags.official_name,
    tags['official_name:en'],
    tags.short_name,
    tags['short_name:en'],
    tags.alt_name,
    tags['alt_name:en'],
    tags.int_name,
    tags.old_name,
    tags['old_name:en'],
  ].filter((value): value is string => Boolean(value));
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
  const rawWikipedia = tags['wikipedia:en'] ?? tags.wikipedia ?? '';
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
    website: safeExternalUrl(tags.website ?? tags['contact:website']),
    phone: tags.phone ?? tags['contact:phone'] ?? '',
    wheelchair: wheelchair(tags),
    fee: fee(tags),
    wikipedia: wikiTitle,
    wikipediaRaw: rawWikipedia,
    wikidata: tags.wikidata ?? '',
    commons: tags.wikimedia_commons ?? '',
    aliases: [...new Set(attractionAliases(tags).map((alias) => ensureLatinDisplayName(alias, undefined)).filter(Boolean))],
    osmDescription: tags['description:en'] ?? '',
    history: '',
    historySource: '',
    readMoreUrl: wikiTitle ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, '_'))}` : '',
    photoStatus: 'idle',
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
  if (!metadata.thumbnailUrl || !metadata.sourceUrl || !license) return false;
  if (/\b(?:nc|nd)\b/.test(license) || license.includes('all rights reserved')) return false;
  return /^cc\s*by(?:\b|-)/.test(license) || /^cc\s*by-sa(?:\b|-)/.test(license) || /\bcc0\b/.test(license) || license.includes('public domain') || /\bpd\b/.test(license);
}

export function commonsFilenameFromTag(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withoutUrl = trimmed.includes('/wiki/') ? trimmed.split('/wiki/').pop() ?? trimmed : trimmed;
  const decoded = decodeURIComponent(withoutUrl.replace(/_/g, ' '));
  if (/^file:/i.test(decoded)) return decoded.replace(/^file:/i, '').trim();
  return '';
}

export function commonsCategoryFromTag(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withoutUrl = trimmed.includes('/wiki/') ? trimmed.split('/wiki/').pop() ?? trimmed : trimmed;
  const decoded = decodeURIComponent(withoutUrl.replace(/_/g, ' '));
  if (/^category:/i.test(decoded)) return decoded.replace(/^category:/i, '').trim();
  return '';
}

export function commonsFilenameFromImageUrl(value: string) {
  try {
    const url = new URL(value);
    if (!/wikimedia\.org$/.test(url.hostname) && !url.hostname.endsWith('.wikimedia.org')) return '';
    const file = url.pathname.split('/').filter(Boolean).pop() ?? '';
    return decodeURIComponent(file).replace(/_/g, ' ').replace(/^\d+px-/, '');
  } catch {
    return '';
  }
}

export function commonsImageInfoUrl(filename: string, thumbnailWidth = 720) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: String(thumbnailWidth),
    titles: `File:${filename}`,
  });
  return `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
}

export function wikidataEntityUrl(wikidataId: string) {
  const params = new URLSearchParams({
    action: 'wbgetentities',
    ids: wikidataId,
    props: 'claims|descriptions|labels|aliases|sitelinks',
    languages: 'en',
    format: 'json',
    origin: '*',
  });
  return `https://www.wikidata.org/w/api.php?${params.toString()}`;
}

export function wikipediaSummaryUrl(title: string) {
  return wikipediaSummaryUrlFor('en', title);
}

export function wikipediaSummaryUrlFor(language: string, title: string) {
  const safeLanguage = /^[a-z][a-z-]{1,12}$/i.test(language) ? language.toLowerCase() : 'en';
  return `https://${safeLanguage}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

export function commonsCategoryImagesUrl(category: string, thumbnailWidth = 720) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'categorymembers',
    gcmtitle: `Category:${category}`,
    gcmtype: 'file',
    gcmlimit: '20',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: String(thumbnailWidth),
  });
  return `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
}

export function commonsSearchUrl(attraction: Pick<Attraction, 'name' | 'category' | 'aliases' | 'latitude' | 'longitude'>, cityName: string, countryName = '') {
  const bestName = [attraction.name, ...attraction.aliases].find((name) => normalizeSearchText(name).length >= 4) ?? attraction.name;
  const search = `"${bestName}" ${cityName} ${countryName} ${attraction.category}`.trim();
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: '5',
    gsrsearch: search,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '720',
  });
  return `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
}

export function wikidataP18Filename(raw: any, wikidataId: string) {
  const entity = raw?.entities?.[wikidataId];
  return entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value ?? '';
}

export function wikidataEnglishDescription(raw: any, wikidataId: string) {
  return raw?.entities?.[wikidataId]?.descriptions?.en?.value ?? '';
}

export function wikidataEnglishTitle(raw: any, wikidataId: string) {
  return raw?.entities?.[wikidataId]?.sitelinks?.enwiki?.title ?? '';
}

export function wikidataEnglishLabel(raw: any, wikidataId: string) {
  return raw?.entities?.[wikidataId]?.labels?.en?.value ?? '';
}

export function wikidataEnglishAliases(raw: any, wikidataId: string) {
  return (raw?.entities?.[wikidataId]?.aliases?.en ?? []).map((alias: { value?: string }) => alias.value).filter(Boolean) as string[];
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

export function firstLicensedCommonsImage(raw: any): AttractionPhoto | undefined {
  const pages = raw?.query?.pages ? Object.values(raw.query.pages) as any[] : [];
  return pages.map((page) => normalizeCommonsImage(page)).find(Boolean);
}

export function normalizeSearchText(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/^file:/, '').replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function selectHighConfidenceCommonsImage(raw: any, attraction: Pick<Attraction, 'name' | 'aliases' | 'category'>, extraNames: string[] = []) {
  const pages = raw?.query?.pages ? Object.values(raw.query.pages) as any[] : [];
  const names = [attraction.name, ...attraction.aliases, ...extraNames].map(normalizeSearchText).filter((name) => name.length >= 4);
  const allTokens = new Set(names.flatMap((name) => name.split(' ').filter((token) => token.length >= 4)));
  if (!names.length && !allTokens.size) return undefined;
  return pages
    .map((page) => {
      const title = normalizeSearchText(page.title ?? '');
      const exactName = names.some((name) => title.includes(name) || name.includes(title));
      const tokenMatches = [...allTokens].filter((token) => title.includes(token)).length;
      return { page, photo: normalizeCommonsImage(page), score: Number(exactName) * 4 + tokenMatches };
    })
    .filter(({ photo, score }) => photo && score >= 2)
    .sort((a, b) => b.score - a.score)[0]?.photo;
}

export function enrichAttraction(attraction: Attraction, source: { wikipediaExtract?: string; wikidataDescription?: string; osmDescription?: string; commonsImage?: any; photo?: AttractionPhoto; photoStatus?: AttractionPhotoStatus } = {}) {
  const photo = source.commonsImage ? normalizeCommonsImage(source.commonsImage) : attraction.photo;
  const history = source.wikipediaExtract ? summarizeWikipediaExtract(source.wikipediaExtract) : source.wikidataDescription || source.osmDescription || attraction.osmDescription || categoryExplanation(attraction.category);
  const historySource = source.wikipediaExtract ? 'Wikipedia' : source.wikidataDescription ? 'Wikidata' : (source.osmDescription || attraction.osmDescription) ? 'OpenStreetMap' : 'OpenStreetMap tags';
  return { ...attraction, photo: source.photo ?? photo, photoStatus: source.photoStatus ?? (source.photo || photo ? 'checked' : attraction.photoStatus), history, historySource };
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
  return buildAttractionOverpassBatches(latitude, longitude, radiusKm).map((batch) => batch.query).join('\n');
}

export function buildAttractionOverpassBatches(latitude: number, longitude: number, radiusKm: number): AttractionQueryBatch[] {
  const radiusMeters = Math.round(Math.min(radiusKm, 50) * 1000);
  const boxes = searchBoxes(latitude, longitude, radiusMeters / 1000);
  const batch = (id: string, label: string, selectors: string[]): AttractionQueryBatch => ({
    id,
    label,
    query: `[out:json][timeout:12];(${selectors.join(';')};);out center tags;`,
  });
  return boxes.length > 1
    ? boxes.flatMap((box, index) => categoryBatches([box]).map((item) => batch(`${item.id}-${index + 1}`, `${item.label} ${index + 1}`, item.selectors)))
    : categoryBatches(boxes).map((item) => batch(item.id, item.label, item.selectors));

  function categoryBatches(activeBoxes: string[]) {
    const forBoxes = (patterns: string[]) => activeBoxes.flatMap((box) => patterns.map((pattern) => `${pattern}${box}`));
    return [
      { id: 'visitor', label: 'Visitor attractions', selectors: forBoxes([`nwr["tourism"~"^(attraction|viewpoint|artwork)$"]`]) },
      { id: 'museums', label: 'Museums and galleries', selectors: forBoxes([`nwr["tourism"~"^(museum|gallery|zoo|aquarium|theme_park)$"]`]) },
      { id: 'historic', label: 'Historic attractions', selectors: forBoxes([
        `nwr["historic"~"^(monument|memorial|castle|archaeological_site|ruins|fort|city_gate|manor|palace)$"]`,
        `nwr["historic"~"^(church|mosque|synagogue)$"]["wikipedia"]`,
        `nwr["historic"~"^(church|mosque|synagogue)$"]["wikidata"]`,
      ]) },
      { id: 'religious', label: 'Religious heritage', selectors: forBoxes([
        `nwr["amenity"="place_of_worship"]["wikipedia"]`,
        `nwr["amenity"="place_of_worship"]["wikidata"]`,
      ]) },
      { id: 'natural', label: 'Natural attractions', selectors: forBoxes([
        `nwr["leisure"="nature_reserve"]`,
        `nwr["leisure"="park"]["tourism"="attraction"]`,
        `nwr["boundary"="protected_area"]["tourism"="attraction"]`,
        `nwr["natural"~"^(peak|waterfall)$"]["tourism"="attraction"]`,
      ]) },
    ];
  }
}

function searchBoxes(latitude: number, longitude: number, radiusKm: number) {
  const latitudeDelta = radiusKm / 111.32;
  const longitudeDelta = radiusKm / (111.32 * Math.max(0.2, Math.cos(latitude * Math.PI / 180)));
  const sections = radiusKm >= 5 ? 2 : 1;
  const boxes: string[] = [];
  for (let row = 0; row < sections; row += 1) {
    const south = latitude - latitudeDelta + (row * 2 * latitudeDelta) / sections;
    const north = latitude - latitudeDelta + ((row + 1) * 2 * latitudeDelta) / sections;
    for (let col = 0; col < sections; col += 1) {
      const west = longitude - longitudeDelta + (col * 2 * longitudeDelta) / sections;
      const east = longitude - longitudeDelta + ((col + 1) * 2 * longitudeDelta) / sections;
      boxes.push(`(${south.toFixed(5)},${west.toFixed(5)},${north.toFixed(5)},${east.toFixed(5)})`);
    }
  }
  return boxes;
}
