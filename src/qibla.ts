export const KAABA = {
  latitude: 21.4225,
  longitude: 39.8262,
} as const;

const toRadians = (degrees: number) => degrees * Math.PI / 180;
const toDegrees = (radians: number) => radians * 180 / Math.PI;

function isValidLatitude(latitude: number) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
}

function isValidLongitude(longitude: number) {
  return Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

export function hasValidCoordinates(latitude: number, longitude: number) {
  return isValidLatitude(latitude) && isValidLongitude(longitude);
}

export function normalizeDegrees(degrees: number) {
  if (!Number.isFinite(degrees)) return 0;
  return ((degrees % 360) + 360) % 360;
}

export function calculateQiblaBearing(latitude: number, longitude: number) {
  if (!hasValidCoordinates(latitude, longitude)) return 0;

  const lat1 = toRadians(latitude);
  const lat2 = toRadians(KAABA.latitude);
  const deltaLongitude = toRadians(KAABA.longitude - longitude);
  const y = Math.sin(deltaLongitude) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLongitude);

  return normalizeDegrees(toDegrees(Math.atan2(y, x)));
}

export function formatCoordinate(value: number, positive: string, negative: string) {
  if (!Number.isFinite(value)) return '--°';
  const direction = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(4)}° ${direction}`;
}
