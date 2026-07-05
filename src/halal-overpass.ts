import {
  OVERPASS_ENDPOINTS,
  overpassEndpointTimeout,
  overpassEndpoints,
  requestOverpassWithFailover,
} from './overpass-failover.js';

export const HALAL_OVERPASS_ENDPOINTS = OVERPASS_ENDPOINTS;
export const halalOverpassEndpoints = overpassEndpoints;
export const halalEndpointTimeout = overpassEndpointTimeout;
export const requestHalalWithFailover = requestOverpassWithFailover;
