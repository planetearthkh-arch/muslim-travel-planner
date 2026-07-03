import { RequestError, classifyRequestError } from './http.js';

export const HALAL_OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
] as const;

export function halalOverpassEndpoints(primary?: string | null) {
  const candidates = [primary?.trim(), ...HALAL_OVERPASS_ENDPOINTS];
  return [...new Set(
    candidates.filter((value): value is string => Boolean(value)),
  )];
}

export function halalEndpointTimeout(totalMilliseconds: number, endpointCount: number) {
  const safeCount = Math.max(1, endpointCount);
  return Math.max(8_000, Math.floor(totalMilliseconds / safeCount));
}

export async function requestHalalWithFailover<T>(
  primary: string | null | undefined,
  totalMilliseconds: number,
  operation: (endpoint: string, timeoutMilliseconds: number) => Promise<T>,
): Promise<T> {
  const endpoints = halalOverpassEndpoints(primary);
  const timeoutMilliseconds = halalEndpointTimeout(
    totalMilliseconds,
    endpoints.length,
  );

  let lastError: RequestError | undefined;

  for (const endpoint of endpoints) {
    try {
      return await operation(endpoint, timeoutMilliseconds);
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

      lastError = classified;
    }
  }

  throw lastError ?? new RequestError(
    'temporary',
    'Map data services are unavailable',
  );
}
