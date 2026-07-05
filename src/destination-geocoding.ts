import { RequestError, classifyRequestError } from './http.js';

export type GeocodedDestination = {
  latitude: number;
  longitude: number;
  label: string;
  city?: string;
  country?: string;
  timezone?: string;
};

export type GeocodingRequest = (url: string, timeoutMilliseconds: number) => Promise<unknown>;

export const NOMINATIM_SEARCH_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
export const OPEN_METEO_GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';

function finiteCoordinate(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function parseNominatim(payload: unknown): GeocodedDestination | undefined {
  if (!Array.isArray(payload)) throw new RequestError('malformed', 'Received invalid geocoding data');
  const first = payload[0];
  if (!first || typeof first !== 'object') return undefined;
  const item = first as {
    lat?: unknown;
    lon?: unknown;
    display_name?: unknown;
    address?: Record<string, unknown>;
  };
  const latitude = finiteCoordinate(item.lat);
  const longitude = finiteCoordinate(item.lon);
  if (latitude === undefined || longitude === undefined) return undefined;
  const address = item.address ?? {};
  const city = [address.city, address.town, address.village, address.municipality, address.county, address.state]
    .find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  const country = typeof address.country === 'string' ? address.country : undefined;
  const label = typeof item.display_name === 'string' && item.display_name.trim()
    ? item.display_name.trim()
    : [city, country].filter(Boolean).join(', ');
  return { latitude, longitude, label: label || `${latitude}, ${longitude}`, city, country };
}

function parseOpenMeteo(payload: unknown): GeocodedDestination | undefined {
  if (!payload || typeof payload !== 'object') throw new RequestError('malformed', 'Received invalid geocoding data');
  const results = (payload as { results?: unknown }).results;
  if (results === undefined) return undefined;
  if (!Array.isArray(results)) throw new RequestError('malformed', 'Received invalid geocoding data');
  const first = results[0];
  if (!first || typeof first !== 'object') return undefined;
  const item = first as Record<string, unknown>;
  const latitude = finiteCoordinate(item.latitude);
  const longitude = finiteCoordinate(item.longitude);
  if (latitude === undefined || longitude === undefined) return undefined;
  const city = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : undefined;
  const country = typeof item.country === 'string' && item.country.trim() ? item.country.trim() : undefined;
  const admin1 = typeof item.admin1 === 'string' && item.admin1.trim() ? item.admin1.trim() : undefined;
  const timezone = typeof item.timezone === 'string' && item.timezone.trim() ? item.timezone.trim() : undefined;
  const label = [city, admin1, country].filter((value, index, values) => Boolean(value) && values.indexOf(value) === index).join(', ');
  return { latitude, longitude, label: label || `${latitude}, ${longitude}`, city, country, timezone };
}

function nominatimUrl(query: string) {
  return `${NOMINATIM_SEARCH_ENDPOINT}?format=json&limit=1&addressdetails=1&accept-language=en&q=${encodeURIComponent(query)}`;
}

function openMeteoUrl(query: string) {
  return `${OPEN_METEO_GEOCODING_ENDPOINT}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
}

export async function geocodeDestinationWithFailover(
  query: string,
  request: GeocodingRequest,
): Promise<GeocodedDestination | undefined> {
  const trimmed = query.trim();
  if (!trimmed) return undefined;

  let lastError: RequestError | undefined;
  const providers: Array<{ url: string; parse: (payload: unknown) => GeocodedDestination | undefined }> = [
    { url: nominatimUrl(trimmed), parse: parseNominatim },
    { url: openMeteoUrl(trimmed), parse: parseOpenMeteo },
  ];

  for (const provider of providers) {
    try {
      const result = provider.parse(await request(provider.url, 12_000));
      if (result) return result;
    } catch (error) {
      const classified = classifyRequestError(error);
      if (classified.kind === 'aborted' || classified.kind === 'offline') throw classified;
      lastError = classified;
    }
  }

  if (lastError) throw lastError;
  return undefined;
}
