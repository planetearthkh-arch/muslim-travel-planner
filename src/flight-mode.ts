import type { PrayerMethod } from './models.js';
import type { FlightDetail, TravelDetailsSnapshot } from './travel-details.js';
import { zonedDateTimeToUtc } from './time-zones.js';

export const FLIGHT_PLAN_SCHEMA_VERSION = 1;
export const FLIGHT_ESTIMATE_WORDING = 'Best available estimate based on live GPS or the stored flight route.';

export type FlightAirport = {
  iata: string;
  ident: string;
  name: string;
  municipality: string;
  country: string;
  latitude: number;
  longitude: number;
  elevationFeet?: number;
};

export type FlightWaypoint = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

export type PreparedFlightPlan = {
  schemaVersion: number;
  id: string;
  createdAt: string;
  updatedAt: string;
  departure: FlightAirport;
  arrival: FlightAirport;
  waypoints: FlightWaypoint[];
  scheduledDepartureUtc: string;
  durationMinutes: number;
  prayerMethod: PrayerMethod;
  cruiseAltitudeMeters?: number;
  departureTimeZone?: string;
  arrivalTimeZone?: string;
};

export type FlightPositionSource = 'gps' | 'derived-gps' | 'route-estimate' | 'unavailable';

export type FlightPosition = {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  accuracyMeters?: number;
  timestamp: number;
  trackDegrees?: number;
  source: FlightPositionSource;
};

export type FlightProgressState = {
  position?: FlightPosition;
  source: FlightPositionSource;
  progress: number;
  distanceKm: number;
  routeDistanceKm: number;
  remainingDistanceKm: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  trackDegrees?: number;
  lowAccuracy: boolean;
  stale: boolean;
};

export type RoutePoint = { latitude: number; longitude: number; label?: string };

const toRadians = (degrees: number) => degrees * Math.PI / 180;
const toDegrees = (radians: number) => radians * 180 / Math.PI;
const EARTH_RADIUS_KM = 6371.0088;
const GPS_FRESH_MS = 120_000;
const GPS_FUTURE_TOLERANCE_MS = 30_000;
const LOW_ACCURACY_METERS = 5000;

export const airportDataSource = 'Bundled compact airport index derived from public-domain OurAirports data; fields reduced for offline SafarMate flight preparation.';

export const airports: FlightAirport[] = [
  { iata: 'JFK', ident: 'KJFK', name: 'John F Kennedy International Airport', municipality: 'New York', country: 'United States', latitude: 40.639801, longitude: -73.7789, elevationFeet: 13 },
  { iata: 'LGA', ident: 'KLGA', name: 'LaGuardia Airport', municipality: 'New York', country: 'United States', latitude: 40.777199, longitude: -73.872597, elevationFeet: 21 },
  { iata: 'EWR', ident: 'KEWR', name: 'Newark Liberty International Airport', municipality: 'Newark', country: 'United States', latitude: 40.692501, longitude: -74.168701, elevationFeet: 18 },
  { iata: 'LHR', ident: 'EGLL', name: 'London Heathrow Airport', municipality: 'London', country: 'United Kingdom', latitude: 51.4706, longitude: -0.461941, elevationFeet: 83 },
  { iata: 'LGW', ident: 'EGKK', name: 'London Gatwick Airport', municipality: 'London', country: 'United Kingdom', latitude: 51.148102, longitude: -0.190278, elevationFeet: 202 },
  { iata: 'CDG', ident: 'LFPG', name: 'Paris Charles de Gaulle Airport', municipality: 'Paris', country: 'France', latitude: 49.012798, longitude: 2.55, elevationFeet: 392 },
  { iata: 'ORY', ident: 'LFPO', name: 'Paris Orly Airport', municipality: 'Paris', country: 'France', latitude: 48.723333, longitude: 2.379444, elevationFeet: 291 },
  { iata: 'IST', ident: 'LTFM', name: 'Istanbul Airport', municipality: 'Istanbul', country: 'Türkiye', latitude: 41.275333, longitude: 28.751944, elevationFeet: 325 },
  { iata: 'SAW', ident: 'LTFJ', name: 'Istanbul Sabiha Gokcen International Airport', municipality: 'Istanbul', country: 'Türkiye', latitude: 40.898602, longitude: 29.3092, elevationFeet: 312 },
  { iata: 'DXB', ident: 'OMDB', name: 'Dubai International Airport', municipality: 'Dubai', country: 'United Arab Emirates', latitude: 25.252799, longitude: 55.364399, elevationFeet: 62 },
  { iata: 'AUH', ident: 'OMAA', name: 'Zayed International Airport', municipality: 'Abu Dhabi', country: 'United Arab Emirates', latitude: 24.433001, longitude: 54.6511, elevationFeet: 88 },
  { iata: 'DOH', ident: 'OTHH', name: 'Hamad International Airport', municipality: 'Doha', country: 'Qatar', latitude: 25.273056, longitude: 51.608056, elevationFeet: 13 },
  { iata: 'JED', ident: 'OEJN', name: 'King Abdulaziz International Airport', municipality: 'Jeddah', country: 'Saudi Arabia', latitude: 21.6796, longitude: 39.156502, elevationFeet: 48 },
  { iata: 'RUH', ident: 'OERK', name: 'King Khaled International Airport', municipality: 'Riyadh', country: 'Saudi Arabia', latitude: 24.9576, longitude: 46.698799, elevationFeet: 2049 },
  { iata: 'CAI', ident: 'HECA', name: 'Cairo International Airport', municipality: 'Cairo', country: 'Egypt', latitude: 30.121901, longitude: 31.4056, elevationFeet: 382 },
  { iata: 'AMM', ident: 'OJAI', name: 'Queen Alia International Airport', municipality: 'Amman', country: 'Jordan', latitude: 31.722601, longitude: 35.993198, elevationFeet: 2395 },
  { iata: 'TLV', ident: 'LLBG', name: 'Ben Gurion International Airport', municipality: 'Tel Aviv', country: 'Israel', latitude: 32.011398, longitude: 34.8867, elevationFeet: 135 },
  { iata: 'KUL', ident: 'WMKK', name: 'Kuala Lumpur International Airport', municipality: 'Kuala Lumpur', country: 'Malaysia', latitude: 2.74558, longitude: 101.709999, elevationFeet: 69 },
  { iata: 'SIN', ident: 'WSSS', name: 'Singapore Changi Airport', municipality: 'Singapore', country: 'Singapore', latitude: 1.35019, longitude: 103.994003, elevationFeet: 22 },
  { iata: 'CGK', ident: 'WIII', name: 'Soekarno Hatta International Airport', municipality: 'Jakarta', country: 'Indonesia', latitude: -6.12557, longitude: 106.655998, elevationFeet: 34 },
  { iata: 'HND', ident: 'RJTT', name: 'Tokyo Haneda Airport', municipality: 'Tokyo', country: 'Japan', latitude: 35.552299, longitude: 139.779999, elevationFeet: 35 },
  { iata: 'NRT', ident: 'RJAA', name: 'Narita International Airport', municipality: 'Tokyo', country: 'Japan', latitude: 35.764702, longitude: 140.386002, elevationFeet: 141 },
  { iata: 'ICN', ident: 'RKSI', name: 'Incheon International Airport', municipality: 'Seoul', country: 'South Korea', latitude: 37.469101, longitude: 126.450996, elevationFeet: 23 },
  { iata: 'SYD', ident: 'YSSY', name: 'Sydney Kingsford Smith Airport', municipality: 'Sydney', country: 'Australia', latitude: -33.946098, longitude: 151.177002, elevationFeet: 21 },
  { iata: 'CPT', ident: 'FACT', name: 'Cape Town International Airport', municipality: 'Cape Town', country: 'South Africa', latitude: -33.964802, longitude: 18.6017, elevationFeet: 151 },
  { iata: 'CMN', ident: 'GMMN', name: 'Mohammed V International Airport', municipality: 'Casablanca', country: 'Morocco', latitude: 33.3675, longitude: -7.58997, elevationFeet: 656 },
  { iata: 'BCN', ident: 'LEBL', name: 'Barcelona El Prat Airport', municipality: 'Barcelona', country: 'Spain', latitude: 41.2971, longitude: 2.07846, elevationFeet: 12 },
  { iata: 'FCO', ident: 'LIRF', name: 'Rome Fiumicino Airport', municipality: 'Rome', country: 'Italy', latitude: 41.804501, longitude: 12.2508, elevationFeet: 15 },
  { iata: 'SJJ', ident: 'LQSA', name: 'Sarajevo International Airport', municipality: 'Sarajevo', country: 'Bosnia and Herzegovina', latitude: 43.8246, longitude: 18.331499, elevationFeet: 1708 },
  { iata: 'TAS', ident: 'UTTT', name: 'Tashkent International Airport', municipality: 'Tashkent', country: 'Uzbekistan', latitude: 41.2579, longitude: 69.281197, elevationFeet: 1417 },
];

export function normalizeLongitude(longitude: number) {
  if (!Number.isFinite(longitude)) return Number.NaN;
  const normalized = ((longitude + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -180) ? 180 : normalized;
}

export function normalizeDegrees(degrees: number) {
  if (!Number.isFinite(degrees)) return Number.NaN;
  return ((degrees % 360) + 360) % 360;
}

export function signedShortestAngle(fromDegrees: number, toDegreesValue: number) {
  if (!Number.isFinite(fromDegrees) || !Number.isFinite(toDegreesValue)) return Number.NaN;
  return ((toDegreesValue - fromDegrees + 540) % 360) - 180;
}

export function validCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function haversineDistanceKm(a: RoutePoint, b: RoutePoint) {
  if (!validCoordinate(a.latitude, a.longitude) || !validCoordinate(b.latitude, b.longitude)) return Number.NaN;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(normalizeLongitude(b.longitude - a.longitude));
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function initialTrueBearing(a: RoutePoint, b: RoutePoint) {
  if (!validCoordinate(a.latitude, a.longitude) || !validCoordinate(b.latitude, b.longitude)) return Number.NaN;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLon = toRadians(normalizeLongitude(b.longitude - a.longitude));
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return normalizeDegrees(toDegrees(Math.atan2(y, x)));
}

export function greatCircleInterpolate(a: RoutePoint, b: RoutePoint, fraction: number): RoutePoint {
  if (!validCoordinate(a.latitude, a.longitude) || !validCoordinate(b.latitude, b.longitude)) return { latitude: Number.NaN, longitude: Number.NaN };
  const clamped = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  const distance = haversineDistanceKm(a, b) / EARTH_RADIUS_KM;
  if (!Number.isFinite(distance) || distance < 1e-12) return { latitude: a.latitude, longitude: normalizeLongitude(a.longitude), label: a.label };
  const sinDistance = Math.sin(distance);
  if (Math.abs(sinDistance) < 1e-12) return { latitude: a.latitude, longitude: normalizeLongitude(a.longitude), label: a.label };
  const lat1 = toRadians(a.latitude);
  const lon1 = toRadians(a.longitude);
  const lat2 = toRadians(b.latitude);
  const lon2 = toRadians(b.longitude);
  const weightA = Math.sin((1 - clamped) * distance) / sinDistance;
  const weightB = Math.sin(clamped * distance) / sinDistance;
  const x = weightA * Math.cos(lat1) * Math.cos(lon1) + weightB * Math.cos(lat2) * Math.cos(lon2);
  const y = weightA * Math.cos(lat1) * Math.sin(lon1) + weightB * Math.cos(lat2) * Math.sin(lon2);
  const z = weightA * Math.sin(lat1) + weightB * Math.sin(lat2);
  return { latitude: toDegrees(Math.atan2(z, Math.sqrt(x * x + y * y))), longitude: normalizeLongitude(toDegrees(Math.atan2(y, x))) };
}

export function routePoints(plan: PreparedFlightPlan): RoutePoint[] {
  return [
    { latitude: plan.departure.latitude, longitude: plan.departure.longitude, label: plan.departure.iata },
    ...plan.waypoints.map((waypoint) => ({ latitude: waypoint.latitude, longitude: waypoint.longitude, label: waypoint.label })),
    { latitude: plan.arrival.latitude, longitude: plan.arrival.longitude, label: plan.arrival.iata },
  ];
}

export function routeSegments(points: RoutePoint[]) {
  const segments: Array<{ from: RoutePoint; to: RoutePoint; distanceKm: number }> = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const distance = haversineDistanceKm(points[index], points[index + 1]);
    if (Number.isFinite(distance) && distance > 0.001) segments.push({ from: points[index], to: points[index + 1], distanceKm: distance });
  }
  return segments;
}

export function totalRouteDistanceKm(points: RoutePoint[]) {
  return routeSegments(points).reduce((sum, segment) => sum + segment.distanceKm, 0);
}

export function positionByDistance(points: RoutePoint[], distanceKm: number) {
  const segments = routeSegments(points);
  const total = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  if (!segments.length) return { point: points[0], trackDegrees: Number.NaN, progress: 0, totalDistanceKm: 0 };
  const target = Math.min(total, Math.max(0, Number.isFinite(distanceKm) ? distanceKm : 0));
  let traversed = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const isLast = index === segments.length - 1;
    if (target < traversed + segment.distanceKm || isLast) {
      const fraction = segment.distanceKm ? Math.min(1, Math.max(0, (target - traversed) / segment.distanceKm)) : 0;
      const point = greatCircleInterpolate(segment.from, segment.to, fraction);
      const trackDegrees = fraction >= 1 - 1e-9
        ? initialTrueBearing(segment.from, segment.to)
        : initialTrueBearing(point, segment.to);
      return { point, trackDegrees, progress: total ? target / total : 0, totalDistanceKm: total };
    }
    traversed += segment.distanceKm;
  }
  const last = segments[segments.length - 1];
  return { point: last.to, trackDegrees: initialTrueBearing(last.from, last.to), progress: 1, totalDistanceKm: total };
}

function closestFractionOnGreatCircle(segment: { from: RoutePoint; to: RoutePoint; distanceKm: number }, position: RoutePoint) {
  const samples = Math.max(32, Math.min(256, Math.ceil(segment.distanceKm / 80)));
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= samples; index += 1) {
    const fraction = index / samples;
    const candidate = greatCircleInterpolate(segment.from, segment.to, fraction);
    const distance = haversineDistanceKm(candidate, position);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  let low = Math.max(0, (bestIndex - 1) / samples);
  let high = Math.min(1, (bestIndex + 1) / samples);
  for (let iteration = 0; iteration < 28; iteration += 1) {
    const first = low + (high - low) / 3;
    const second = high - (high - low) / 3;
    const firstDistance = haversineDistanceKm(greatCircleInterpolate(segment.from, segment.to, first), position);
    const secondDistance = haversineDistanceKm(greatCircleInterpolate(segment.from, segment.to, second), position);
    if (firstDistance <= secondDistance) high = second;
    else low = first;
  }
  return Math.min(1, Math.max(0, (low + high) / 2));
}

export function projectPositionOntoRoute(points: RoutePoint[], position: RoutePoint) {
  if (!validCoordinate(position.latitude, position.longitude)) return null;
  const segments = routeSegments(points);
  const totalDistanceKm = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  if (!segments.length || totalDistanceKm <= 0) return null;

  let traversed = 0;
  let best: { progress: number; distanceKm: number; crossTrackDistanceKm: number; trackDegrees: number } | null = null;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const fraction = closestFractionOnGreatCircle(segment, position);
    const projected = greatCircleInterpolate(segment.from, segment.to, fraction);
    const crossTrackDistanceKm = haversineDistanceKm(projected, position);
    const distanceKm = traversed + segment.distanceKm * fraction;
    const nextSegment = segments[index + 1];
    const trackDegrees = fraction >= 1 - 1e-8
      ? nextSegment
        ? initialTrueBearing(nextSegment.from, nextSegment.to)
        : initialTrueBearing(segment.from, segment.to)
      : initialTrueBearing(projected, segment.to);
    if (!best || crossTrackDistanceKm < best.crossTrackDistanceKm) {
      best = {
        progress: Math.min(1, Math.max(0, distanceKm / totalDistanceKm)),
        distanceKm,
        crossTrackDistanceKm,
        trackDegrees,
      };
    }
    traversed += segment.distanceKm;
  }

  return best ? { ...best, totalDistanceKm } : null;
}

export function elapsedProgress(plan: PreparedFlightPlan, nowMs = Date.now()) {
  const start = Date.parse(plan.scheduledDepartureUtc);
  if (!Number.isFinite(start) || plan.durationMinutes <= 0) return 0;
  return Math.min(1, Math.max(0, (nowMs - start) / (plan.durationMinutes * 60_000)));
}

export function positionByProgress(plan: PreparedFlightPlan, progress: number, nowMs = Date.now()): FlightProgressState {
  const points = routePoints(plan);
  const total = totalRouteDistanceKm(points);
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const route = positionByDistance(points, total * clamped);
  const elapsedMinutes = Math.max(0, Math.round(clamped * plan.durationMinutes));
  const remainingMinutes = Math.max(0, plan.durationMinutes - elapsedMinutes);
  const scheduledStart = Date.parse(plan.scheduledDepartureUtc);
  const positionTimestamp = Number.isFinite(scheduledStart)
    ? scheduledStart + clamped * plan.durationMinutes * 60_000
    : nowMs;
  return {
    position: {
      latitude: route.point.latitude,
      longitude: route.point.longitude,
      timestamp: positionTimestamp,
      trackDegrees: route.trackDegrees,
      source: 'route-estimate',
    },
    source: 'route-estimate',
    progress: clamped,
    distanceKm: total * clamped,
    routeDistanceKm: total,
    remainingDistanceKm: Math.max(0, total * (1 - clamped)),
    elapsedMinutes,
    remainingMinutes,
    trackDegrees: route.trackDegrees,
    lowAccuracy: false,
    stale: false,
  };
}

export function deriveTrackFromFixes(previous: FlightPosition | undefined, current: FlightPosition) {
  if (typeof current.trackDegrees === 'number' && Number.isFinite(current.trackDegrees)) return normalizeDegrees(current.trackDegrees);
  if (!previous) return undefined;
  const distance = haversineDistanceKm(previous, current);
  if (!Number.isFinite(distance) || distance < 0.05) return undefined;
  const bearing = initialTrueBearing(previous, current);
  return Number.isFinite(bearing) ? bearing : undefined;
}

export function chooseFlightProgress(plan: PreparedFlightPlan, options: { gps?: FlightPosition; previousGps?: FlightPosition; manualProgress?: number; nowMs?: number }) {
  const nowMs = options.nowMs ?? Date.now();
  const routeEstimate = positionByProgress(plan, options.manualProgress ?? elapsedProgress(plan, nowMs), nowMs);
  const gps = options.gps;
  if (!gps || !validCoordinate(gps.latitude, gps.longitude)) return routeEstimate;
  const scheduledStart = Date.parse(plan.scheduledDepartureUtc);
  const scheduledEnd = scheduledStart + plan.durationMinutes * 60_000;
  const flightWindowPadding = 2 * 60 * 60 * 1000;
  if (Number.isFinite(scheduledStart) && (nowMs < scheduledStart - flightWindowPadding || nowMs > scheduledEnd + flightWindowPadding)) return routeEstimate;
  const gpsTimestamp = Number(gps.timestamp);
  const invalidTimestamp = !Number.isFinite(gpsTimestamp) || gpsTimestamp <= 0 || gpsTimestamp > nowMs + GPS_FUTURE_TOLERANCE_MS;
  const stale = invalidTimestamp || nowMs - gpsTimestamp > GPS_FRESH_MS;
  const lowAccuracy = typeof gps.accuracyMeters === 'number' && gps.accuracyMeters > LOW_ACCURACY_METERS;
  if (stale) return { ...routeEstimate, source: 'route-estimate' as const, stale: true };
  const projection = projectPositionOntoRoute(routePoints(plan), gps);
  const maximumCrossTrackKm = Math.max(100, routeEstimate.routeDistanceKm * 0.15);
  if (!projection || projection.crossTrackDistanceKm > maximumCrossTrackKm) {
    return { ...routeEstimate, lowAccuracy: true };
  }
  const progress = projection.progress;
  const routeDistance = projection.totalDistanceKm;
  const track = deriveTrackFromFixes(options.previousGps, gps) ?? projection?.trackDegrees ?? routeEstimate.trackDegrees;
  return {
    position: { ...gps, trackDegrees: track, source: typeof gps.trackDegrees === 'number' ? 'gps' : 'derived-gps' },
    source: typeof gps.trackDegrees === 'number' ? 'gps' as const : 'derived-gps' as const,
    progress,
    distanceKm: routeDistance * progress,
    routeDistanceKm: routeDistance,
    remainingDistanceKm: routeDistance * (1 - progress),
    elapsedMinutes: Math.round(progress * plan.durationMinutes),
    remainingMinutes: Math.max(0, plan.durationMinutes - Math.round(progress * plan.durationMinutes)),
    trackDegrees: track,
    lowAccuracy,
    stale: false,
  };
}

export function searchAirports(query: string, limit = 12) {
  const cleaned = query.trim().toLowerCase();
  if (!cleaned) return airports.slice(0, limit);
  return airports
    .map((airport) => {
      const haystack = `${airport.iata} ${airport.ident} ${airport.name} ${airport.municipality} ${airport.country}`.toLowerCase();
      const score = airport.iata.toLowerCase() === cleaned ? 0 : airport.iata.toLowerCase().startsWith(cleaned) ? 1 : haystack.includes(cleaned) ? 2 : 9;
      return { airport, score };
    })
    .filter((item) => item.score < 9)
    .sort((a, b) => a.score - b.score || a.airport.iata.localeCompare(b.airport.iata))
    .slice(0, limit)
    .map((item) => item.airport);
}

export function airportLabel(airport: FlightAirport) {
  return `${airport.iata} · ${airport.name} · ${airport.municipality}, ${airport.country}`;
}

export function airportByIata(value: string) {
  return airports.find((airport) => airport.iata.toLowerCase() === value.trim().toLowerCase());
}

function isValidTimeZone(value = '') {
  if (!value) return true;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(new Date('2026-01-01T00:00:00Z'));
    return true;
  } catch {
    return false;
  }
}

export function validateWaypoint(input: Partial<FlightWaypoint>, index = 0): FlightWaypoint | null {
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (!validCoordinate(latitude, longitude)) return null;
  return {
    id: String(input.id || `waypoint-${index + 1}`).replace(/[^a-z0-9-]/gi, '-').slice(0, 40) || `waypoint-${index + 1}`,
    label: String(input.label || `Waypoint ${index + 1}`).replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || `Waypoint ${index + 1}`,
    latitude,
    longitude,
  };
}

export function validateFlightPlan(value: unknown): PreparedFlightPlan | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== FLIGHT_PLAN_SCHEMA_VERSION) return null;
  const departure = record.departure as FlightAirport | undefined;
  const arrival = record.arrival as FlightAirport | undefined;
  if (!departure || !arrival || departure.iata === arrival.iata || !validCoordinate(departure.latitude, departure.longitude) || !validCoordinate(arrival.latitude, arrival.longitude)) return null;
  const durationMinutes = Number(record.durationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 24 * 60) return null;
  const scheduledDepartureUtc = String(record.scheduledDepartureUtc ?? '');
  if (!Number.isFinite(Date.parse(scheduledDepartureUtc))) return null;
  const departureTimeZone = String(record.departureTimeZone ?? '');
  const arrivalTimeZone = String(record.arrivalTimeZone ?? '');
  if (!isValidTimeZone(departureTimeZone) || !isValidTimeZone(arrivalTimeZone)) return null;
  const altitude = record.cruiseAltitudeMeters === undefined || record.cruiseAltitudeMeters === '' ? undefined : Number(record.cruiseAltitudeMeters);
  if (altitude !== undefined && (!Number.isFinite(altitude) || altitude < 0 || altitude > 20_000)) return null;
  const waypoints = Array.isArray(record.waypoints) ? record.waypoints.map((waypoint, index) => validateWaypoint(waypoint as Partial<FlightWaypoint>, index)).filter((waypoint): waypoint is FlightWaypoint => Boolean(waypoint)) : [];
  const prayerMethod = ['Muslim World League', 'Egyptian General Authority', 'Umm al-Qura', 'ISNA', 'Turkey Diyanet', 'Muslim World League (Hanafi Asr)', 'Egyptian General Authority (Hanafi Asr)', 'Umm al-Qura (Hanafi Asr)', 'ISNA (Hanafi Asr)', 'Turkey Diyanet (Hanafi Asr)'].includes(String(record.prayerMethod)) ? record.prayerMethod as PrayerMethod : 'Muslim World League';
  return {
    schemaVersion: FLIGHT_PLAN_SCHEMA_VERSION,
    id: String(record.id || `flight-${Date.now().toString(36)}`),
    createdAt: String(record.createdAt || new Date().toISOString()),
    updatedAt: String(record.updatedAt || new Date().toISOString()),
    departure,
    arrival,
    waypoints,
    scheduledDepartureUtc,
    durationMinutes,
    prayerMethod,
    cruiseAltitudeMeters: altitude,
    departureTimeZone: departureTimeZone || undefined,
    arrivalTimeZone: arrivalTimeZone || undefined,
  };
}

export function createPreparedFlightPlan(input: {
  departure: FlightAirport;
  arrival: FlightAirport;
  waypoints?: FlightWaypoint[];
  scheduledDepartureUtc: string;
  durationMinutes: number;
  prayerMethod: PrayerMethod;
  cruiseAltitudeMeters?: number;
  departureTimeZone?: string;
  arrivalTimeZone?: string;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  return validateFlightPlan({
    schemaVersion: FLIGHT_PLAN_SCHEMA_VERSION,
    id: `flight-${Date.parse(now).toString(36)}-${input.departure.iata.toLowerCase()}-${input.arrival.iata.toLowerCase()}`,
    createdAt: now,
    updatedAt: now,
    ...input,
  });
}

export function flightPlanFromTravelDetails(snapshot: TravelDetailsSnapshot, prayerMethod: PrayerMethod, now = new Date().toISOString()) {
  const flight = snapshot.entries.find((entry): entry is FlightDetail => entry.type === 'flight' && Boolean(airportByIata(entry.departureAirport)) && Boolean(airportByIata(entry.arrivalAirport)));
  if (!flight) return null;
  const departure = airportByIata(flight.departureAirport);
  const arrival = airportByIata(flight.arrivalAirport);
  if (!departure || !arrival) return null;
  const start = zonedDateTimeToUtc(flight.departureDateTime, flight.departureTimeZone || 'UTC');
  const end = zonedDateTimeToUtc(flight.arrivalDateTime, flight.arrivalTimeZone || 'UTC');
  if (!start || !end) return null;
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  return createPreparedFlightPlan({
    departure,
    arrival,
    scheduledDepartureUtc: start.toISOString(),
    durationMinutes,
    prayerMethod,
    departureTimeZone: flight.departureTimeZone,
    arrivalTimeZone: flight.arrivalTimeZone,
    now,
  });
}

