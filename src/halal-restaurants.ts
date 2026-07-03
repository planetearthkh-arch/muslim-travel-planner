import { formatAddress, getEnglishPlaceName, getOriginalPlaceName, optionalLatinDisplayName, type OsmTags, type OverpassElement } from './prayer-spaces.js';
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
const defaultVisibleStatuses: HalalStatus[] = [...reliableStatuses, 'legacy-halal'];
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

const normalizedValue = (value: string | undefined) => (value ?? '').trim().toLowerCase();
const affirmativeHalalValues = new Set(['yes', 'only', 'designated', 'available', 'true', '1']);
const negativeHalalValues = new Set(['no', 'none', 'false', '0']);
const yes = (value: string | undefined) => affirmativeHalalValues.has(normalizedValue(value));
const no = (value: string | undefined) => negativeHalalValues.has(normalizedValue(value));
const invalidCertification = /^(no|none|false|expired|unknown|unverified|not certified)$/i;

export function classifyHalalStatus(tags: OsmTags, includePossible = false): HalalStatus | undefined {
  const dietHalal = normalizedValue(tags['diet:halal']);
  const legacyHalal = normalizedValue(tags.halal);
  if (no(dietHalal) || no(legacyHalal)) return undefined;
  if (dietHalal === 'only') return 'halal-only';
  const certification = tags['halal:certification']?.trim();
  if (certification && !invalidCertification.test(certification)) return 'certification-listed';
  if (affirmativeHalalValues.has(dietHalal)) return 'halal-options';
  if (affirmativeHalalValues.has(legacyHalal)) return 'legacy-halal';
  if (!includePossible) return undefined;
  const explicitText = [tags.description, tags['description:en'], tags.note, tags['source:halal'], tags['diet:halal:source']]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /\bhalal\b/.test(explicitText) ? 'possible-unverified' : undefined;
}

export function classifyFoodPlace(tags: OsmTags): FoodPlaceType | undefined {
  const amenity = normalizedValue(tags.amenity);
  if (amenity === 'restaurant' || amenity === 'fast_food' || amenity === 'cafe' || amenity === 'food_court') return amenity;
  return undefined;
}

export function restaurantDisplayName(tags: OsmTags, type: FoodPlaceType | undefined) {
  const display = optionalLatinDisplayName(getEnglishPlaceName({ tags, type: undefined }));
  return display || fallbackForFoodType(type);
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
    certification: tags['halal:certification']?.trim() ?? '',
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
    if (filters.status === 'reliable' && !defaultVisibleStatuses.includes(restaurant.halalStatus)) return false;
    if (filters.status !== 'reliable' && restaurant.halalStatus !== filters.status) return false;
    if (filters.type !== 'all' && restaurant.type !== filters.type) return false;
    if (filters.cuisine && !restaurant.cuisine.some((cuisine) => cuisine.toLowerCase() === filters.cuisine.toLowerCase())) return false;
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
  const safeRadiusKm = Number.isFinite(radiusKm) ? Math.max(1, Math.min(radiusKm, 50)) : 5;
  const radiusMeters = Math.round(safeRadiusKm * 1000);
  const around = `(around:${radiusMeters},${latitude},${longitude})`;
  const food = '["amenity"~"^(restaurant|fast_food|cafe|food_court)$"]';
  const positive = '^(yes|only|designated|available|true|1)$';
  const structuredSelectors = [
    `nwr${food}["diet:halal"]["diet:halal"~"${positive}",i]${around}`,
    `nwr${food}["halal"]["halal"~"${positive}",i]${around}`,
    `nwr${food}["halal:certification"]["halal:certification"~".+"]${around}`,
    `nwr${food}["source:halal"]["source:halal"~".+"]${around}`,
    `nwr${food}["diet:halal:source"]["diet:halal:source"~".+"]${around}`,
  ];
  const textSelectors = safeRadiusKm <= 1 ? [
    `nwr${food}["description"~"halal",i]${around}`,
    `nwr${food}["description:en"~"halal",i]${around}`,
    `nwr${food}["note"~"halal",i]${around}`,
  ] : [];
  const selectors = [...structuredSelectors, ...textSelectors];
  return `[out:json][timeout:25];(${selectors.join(';')};);out center tags;`;
}

export function hasReliableHalalStatus(status: HalalStatus) {
  return reliableStatuses.includes(status);
}
