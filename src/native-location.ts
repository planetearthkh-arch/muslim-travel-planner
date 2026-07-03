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

function normalizePositionError(reason: unknown): AppPositionError {
  const code = typeof reason === 'object' && reason !== null && 'code' in reason && typeof (reason as { code?: unknown }).code === 'number'
    ? (reason as { code: number }).code
    : 2;
  const message = reason instanceof Error ? reason.message : undefined;
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
