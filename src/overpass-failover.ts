import { RequestError, classifyRequestError } from './http.js';
import { availableServiceEndpoints, recordServiceFailure, recordServiceSuccess, uniqueServiceEndpoints } from './provider-health.js';

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
] as const;

export function overpassEndpoints(primary?: string | null) {
  return uniqueServiceEndpoints([primary?.trim(), ...OVERPASS_ENDPOINTS]);
}

export function overpassEndpointTimeout(totalMilliseconds: number, endpointCount: number) {
  const safeCount = Math.max(1, endpointCount);
  return Math.max(15_000, Math.ceil(totalMilliseconds / safeCount));
}

export function overpassFormBody(query: string) {
  return `data=${encodeURIComponent(query)}`;
}

export function overpassRequestHeaders() {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
  } as const;
}

export async function requestOverpassWithFailover<T>(
  primary: string | null | undefined,
  totalMilliseconds: number,
  operation: (endpoint: string, timeoutMilliseconds: number) => Promise<T>,
): Promise<T> {
  const endpoints = availableServiceEndpoints(overpassEndpoints(primary));
  const timeoutMilliseconds = overpassEndpointTimeout(totalMilliseconds, endpoints.length);
  let lastError: RequestError | undefined;

  for (const endpoint of endpoints) {
    try {
      const result = await operation(endpoint, timeoutMilliseconds);
      recordServiceSuccess(endpoint);
      return result;
    } catch (error) {
      const classified = classifyRequestError(error);

      // Another endpoint cannot solve cancellation, no internet, or an invalid query.
      if (
        classified.kind === 'aborted' ||
        classified.kind === 'offline' ||
        classified.kind === 'http'
      ) {
        throw classified;
      }

      recordServiceFailure(endpoint, classified.kind, classified.retryAfterMs);
      lastError = classified;
    }
  }

  throw lastError ?? new RequestError(
    'temporary',
    'Map data services are unavailable',
  );
}
