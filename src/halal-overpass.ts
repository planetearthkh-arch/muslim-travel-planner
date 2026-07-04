import { RequestError, classifyRequestError } from './http.js';
import { availableServiceEndpoints, recordServiceFailure, recordServiceSuccess, uniqueServiceEndpoints } from './provider-health.js';

export const HALAL_OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
] as const;

export function halalOverpassEndpoints(primary?: string | null) {
  const candidates = [primary?.trim(), ...HALAL_OVERPASS_ENDPOINTS];
  return uniqueServiceEndpoints(candidates);
}

export function halalEndpointTimeout(totalMilliseconds: number, endpointCount: number) {
  const safeCount = Math.max(1, endpointCount);
  return Math.max(15_000, Math.ceil(totalMilliseconds / safeCount));
}

export async function requestHalalWithFailover<T>(
  primary: string | null | undefined,
  totalMilliseconds: number,
  operation: (endpoint: string, timeoutMilliseconds: number) => Promise<T>,
): Promise<T> {
  const endpoints = availableServiceEndpoints(halalOverpassEndpoints(primary));
  const timeoutMilliseconds = halalEndpointTimeout(
    totalMilliseconds,
    endpoints.length,
  );

  let lastError: RequestError | undefined;

  for (const endpoint of endpoints) {
    try {
      const result = await operation(endpoint, timeoutMilliseconds);
      recordServiceSuccess(endpoint);
      return result;
    } catch (error) {
      const classified = classifyRequestError(error);

      // Another endpoint cannot solve cancellation, no internet, or a bad query.
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
