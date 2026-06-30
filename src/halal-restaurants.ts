import { ensureLatinDisplayName, formatAddress, getEnglishPlaceName, getOriginalPlaceName, type OsmTags, type OverpassElement } from './prayer-spaces.js';
import { distanceKm } from './prayer-spaces.js';
import { openingState, type OpeningState } from './opening-hours.js';
import { safeExternalUrl } from './urls.js';

export type FoodPlaceType = 'restaurant' | 'fast_food' | 'cafe' | 'food_court';
export type HalalStatus = 'halal-only' | 'halal-options' | 'certification-listed' | 'legacy-halal' | 'possible-unverified';
export type RestaurantOpenState = OpeningState;

export type HalalRestaurant = {
  id: string;
  name: string;
  originalName: string;
  type: FoodPlaceType;
  halalStatus: HalalStatus;
  certification: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  cuisine: string[];
  address: string;
  openingHours: string;
  openState: RestaurantOpenState;
  phone: string;
  website: string;
  menu: string;
  price: string;
  takeaway: boolean;
  delivery: boolean;
  outdoorSeating: boolean;
  wheelchair: boolean;
  sourceUrl: string;
};

export type RestaurantFilters = {
  status: 'reliable' | HalalStatus;
  type: 'all' | FoodPlaceType;
  cuisine: string;
  openNow: boolean;
  takeaway: boolean;
  delivery: boolean;
  wheelchair: boolean;
};

const reliableStatuses: HalalStatus[] = ['halal-only', 'halal-options', 'certification-listed'];
const statusWeight: Record<HalalStatus, number> = {
  'halal-only': 0,
  'certification-listed': 1,
  'halal-options': 2,
  'legacy-halal': 3,
  'possible-unverified': 4,
};

const fallbackForFoodType = (type: FoodPlaceType | undefined) => {
  if (type === 'cafe') return 'Unnamed Halal Cafe';
  if (type === 'fast_food') return 'Unnamed Halal Fast-Food Restaurant';
  if (type === 'food_court') return 'Unnamed Halal Food Court';
  return 'Unnamed Halal Restaurant';
};

const yes = (value: string | undefined) => /^(yes|only|designated|available|true|1)$/i.test(value ?? '');
const no = (value: string | undefined) => /^(no|none|false|0)$/i.test(value ?? '');
const invalidCertification = /^(no|none|false|expired|unknown|unverified|not certified)$/i;

export function classifyHalalStatus(tags: OsmTags, includePossible = false): HalalStatus | undefined {
  if (no(tags['diet:halal']) || no(tags.halal)) return undefined;
  if (tags['diet:halal']?.toLowerCase() === 'only') return 'halal-only';
  const certification = tags['halal:certification']?.trim();
  if (certification && !invalidCertification.test(certification)) return 'certification-listed';
  if (tags['diet:halal']?.toLowerCase() === 'yes') return 'halal-options';
  if (tags.halal?.toLowerCase() === 'only' || tags.halal?.toLowerCase() === 'yes') return 'legacy-halal';
  if (!includePossible) return undefined;
  const explicitText = [tags.description, tags['description:en'], tags.note, tags['source:halal'], tags['diet:halal:source']]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /\bhalal\b/.test(explicitText) ? 'possible-unverified' : undefined;
}

export function classifyFoodPlace(tags: OsmTags): FoodPlaceType | undefined {
  const amenity = tags.amenity?.toLowerCase();
  if (amenity === 'restaurant' || amenity === 'fast_food' || amenity === 'cafe' || amenity === 'food_court') return amenity;
  return undefined;
}

export function restaurantDisplayName(tags: OsmTags, type: FoodPlaceType | undefined) {
  const name = getEnglishPlaceName({ tags, type: undefined });
  const display = ensureLatinDisplayName(name, undefined);
  if (!display || /^Unnamed Quiet Prayer Space$|^Unnamed Mosque$|^Unnamed Prayer Room$/.test(display)) return fallbackForFoodType(type);
  return display;
}

function parseCuisine(value: string | undefined) {
  return (value ?? '').split(';').map((item) => item.trim()).filter(Boolean);
}

function tagBoolean(tags: OsmTags, key: string) {
  return yes(tags[key]);
}

export { openingState };

export function normalizeHalalRestaurant(element: OverpassElement, origin: { latitude: number; longitude: number; timezone?: string }, includePossible = false): HalalRestaurant | undefined {
  const tags = element.tags ?? {};
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  const type = classifyFoodPlace(tags);
  const halalStatus = classifyHalalStatus(tags, includePossible);
  if (!type || !halalStatus || typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;
  const openingHours = tags.opening_hours ?? '';
  return {
    id: `${element.type}-${element.id}`,
    name: restaurantDisplayName(tags, type),
    originalName: getOriginalPlaceName(tags),
    type,
    halalStatus,
    certification: tags['halal:certification'] ?? '',
    latitude,
    longitude,
    distanceKm: distanceKm(origin.latitude, origin.longitude, latitude, longitude),
    cuisine: parseCuisine(tags.cuisine),
    address: formatAddress(tags),
    openingHours,
    openState: openingState(openingHours, origin.timezone),
    phone: tags.phone ?? tags.contact_phone ?? tags['contact:phone'] ?? '',
    website: safeExternalUrl(tags.website ?? tags.contact_website ?? tags['contact:website']),
    menu: safeExternalUrl(tags.menu ?? tags['contact:menu']),
    price: tags.price ?? tags['price:level'] ?? '',
    takeaway: tagBoolean(tags, 'takeaway'),
    delivery: tagBoolean(tags, 'delivery'),
    outdoorSeating: tagBoolean(tags, 'outdoor_seating'),
    wheelchair: tagBoolean(tags, 'wheelchair'),
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  };
}

export function dedupeRestaurants(restaurants: HalalRestaurant[]) {
  const deduped = new Map<string, HalalRestaurant>();
  for (const restaurant of restaurants) {
    const key = `${restaurant.name.toLowerCase()}-${restaurant.latitude.toFixed(4)}-${restaurant.longitude.toFixed(4)}`;
    const current = deduped.get(key);
    if (!current || statusWeight[restaurant.halalStatus] < statusWeight[current.halalStatus]) deduped.set(key, restaurant);
  }
  return [...deduped.values()];
}

export function filterRestaurants(restaurants: HalalRestaurant[], filters: RestaurantFilters) {
  return restaurants.filter((restaurant) => {
    if (filters.status === 'reliable' && !reliableStatuses.includes(restaurant.halalStatus)) return false;
    if (filters.status !== 'reliable' && restaurant.halalStatus !== filters.status) return false;
    if (filters.type !== 'all' && restaurant.type !== filters.type) return false;
    if (filters.cuisine && !restaurant.cuisine.includes(filters.cuisine)) return false;
    if (filters.openNow && restaurant.openState !== 'open') return false;
    if (filters.takeaway && !restaurant.takeaway) return false;
    if (filters.delivery && !restaurant.delivery) return false;
    if (filters.wheelchair && !restaurant.wheelchair) return false;
    return true;
  });
}

export function sortRestaurants(restaurants: HalalRestaurant[], sort: 'distance' | 'name' | 'status' | 'open' | 'cuisine') {
  return [...restaurants].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'status') return statusWeight[a.halalStatus] - statusWeight[b.halalStatus] || a.distanceKm - b.distanceKm;
    if (sort === 'open') return Number(b.openState === 'open') - Number(a.openState === 'open') || a.distanceKm - b.distanceKm;
    if (sort === 'cuisine') return (a.cuisine[0] ?? '').localeCompare(b.cuisine[0] ?? '') || a.distanceKm - b.distanceKm;
    return a.distanceKm - b.distanceKm;
  });
}

export function cuisineOptions(restaurants: HalalRestaurant[]) {
  return [...new Set(restaurants.flatMap((restaurant) => restaurant.cuisine))].sort((a, b) => a.localeCompare(b));
}

export function buildHalalOverpassQuery(latitude: number, longitude: number, radiusKm: number) {
  const radiusMeters = Math.round(Math.min(radiusKm, 50) * 1000);
  const around = `(around:${radiusMeters},${latitude},${longitude})`;
  const food = '["amenity"~"^(restaurant|fast_food|cafe|food_court)$"]';
  const halalEvidence = [
    '["diet:halal"]',
    '["halal"]',
    '["halal:certification"]',
    '["source:halal"]',
    '["diet:halal:source"]',
    '["description"~"halal",i]',
    '["description:en"~"halal",i]',
    '["note"~"halal",i]',
  ];
  const foodSelectors = halalEvidence.flatMap((evidence) => [
    `node${food}${evidence}${around}`,
    `way${food}${evidence}${around}`,
    `relation${food}${evidence}${around}`,
  ]);
  return `[out:json][timeout:25];(${foodSelectors.join(';')};);out center tags;`;
}

export function hasReliableHalalStatus(status: HalalStatus) {
  return reliableStatuses.includes(status);
}
