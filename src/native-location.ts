import { Geolocation } from '@capacitor/geolocation';
import { isNativePlatform } from './platform.js';

export type AppPosition = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number | null;
    heading?: number | null;
  };
  timestamp?: number;
};

export type AppPositionError = {
  code: number;
  message?: string;
  PERMISSION_DENIED: number;
};

const nativePermissionDeniedCodes = new Set(['OS-PLUG-GLOC-0003', 'OS-PLUG-GLOC-0008']);
const nativeTimeoutCodes = new Set(['OS-PLUG-GLOC-0010']);

export function normalizePositionError(reason: unknown): AppPositionError {
  const details = typeof reason === 'object' && reason !== null ? reason as { code?: unknown; message?: unknown } : undefined;
  const rawCode = details?.code;
  let code = 2;
  if (typeof rawCode === 'number') code = rawCode;
  if (typeof rawCode === 'string' && nativePermissionDeniedCodes.has(rawCode)) code = 1;
  if (typeof rawCode === 'string' && nativeTimeoutCodes.has(rawCode)) code = 3;
  const message = reason instanceof Error
    ? reason.message
    : typeof details?.message === 'string'
      ? details.message
      : undefined;
  return { code, message, PERMISSION_DENIED: 1 };
}

export function getCurrentAppPosition(options?: PositionOptions): Promise<AppPosition> {
  if (!isNativePlatform()) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation unavailable'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
          },
          timestamp: position.timestamp,
        }),
        reject,
        options,
      );
    });
  }

  return Geolocation.getCurrentPosition({
    enableHighAccuracy: options?.enableHighAccuracy,
    timeout: options?.timeout,
    maximumAge: options?.maximumAge,
  }).then((position) => ({
    coords: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      heading: position.coords.heading,
    },
    timestamp: position.timestamp,
  }));
}

export function isAppGeolocationAvailable() {
  return isNativePlatform() || Boolean(navigator.geolocation);
}

export function requestCurrentAppPosition(
  success: (position: AppPosition) => void,
  error?: (error: AppPositionError) => void,
  options?: PositionOptions,
) {
  void getCurrentAppPosition(options).then(success).catch((reason) => {
    error?.(normalizePositionError(reason));
  });
}

export type AppPositionWatch = {
  clear: () => void | Promise<void>;
};

export async function watchAppPosition(
  success: (position: AppPosition) => void,
  error?: (error: AppPositionError) => void,
  options?: PositionOptions,
): Promise<AppPositionWatch> {
  if (!isNativePlatform()) {
    if (!navigator.geolocation) {
      error?.({ code: 2, message: 'Geolocation unavailable', PERMISSION_DENIED: 1 });
      return { clear: () => undefined };
    }
    const id = navigator.geolocation.watchPosition(
      (position) => success({
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          heading: position.coords.heading,
        },
        timestamp: position.timestamp,
      }),
      (reason) => error?.(normalizePositionError(reason)),
      options,
    );
    return { clear: () => navigator.geolocation.clearWatch(id) };
  }

  const id = await Geolocation.watchPosition({
    enableHighAccuracy: options?.enableHighAccuracy,
    timeout: options?.timeout,
    maximumAge: options?.maximumAge,
  }, (position, reason) => {
    if (reason) {
      error?.(normalizePositionError(reason));
      return;
    }
    if (!position) return;
    success({
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        heading: position.coords.heading,
      },
      timestamp: position.timestamp,
    });
  });
  return { clear: () => Geolocation.clearWatch({ id }) };
}
