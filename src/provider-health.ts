import type { RequestFailureKind } from './http.js';
type ProviderHealth = { failures: number; blockedUntil: number };
const health = new Map<string, ProviderHealth>();
const transient = new Set<RequestFailureKind>(['timeout', 'rate-limited', 'temporary', 'malformed', 'unknown']);
const baseCooldown = 30_000;
const maxCooldown = 300_000;
export function normalizeServiceEndpoint(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate) return '';
  try { const url = new URL(candidate); return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : ''; } catch { return ''; }
}
export function uniqueServiceEndpoints(values: Array<string | null | undefined>) { return [...new Set(values.map(normalizeServiceEndpoint).filter(Boolean))]; }
export function availableServiceEndpoints(values: Array<string | null | undefined>, now = Date.now()) {
  const endpoints = uniqueServiceEndpoints(values);
  const available = endpoints.filter((endpoint) => (health.get(endpoint)?.blockedUntil ?? 0) <= now);
  if (available.length) return available.sort((a, b) => (health.get(a)?.failures ?? 0) - (health.get(b)?.failures ?? 0) || endpoints.indexOf(a) - endpoints.indexOf(b));
  return endpoints.sort((a, b) => (health.get(a)?.blockedUntil ?? 0) - (health.get(b)?.blockedUntil ?? 0)).slice(0, 1);
}
export function recordServiceSuccess(endpoint: string) { const normalized = normalizeServiceEndpoint(endpoint); if (normalized) health.delete(normalized); }
export function recordServiceFailure(endpoint: string, kind: RequestFailureKind, retryAfterMs = 0, now = Date.now()) {
  const normalized = normalizeServiceEndpoint(endpoint); if (!normalized || !transient.has(kind)) return;
  const previous = health.get(normalized) ?? { failures: 0, blockedUntil: 0 };
  const failures = previous.failures + 1;
  const shouldBlock = kind === 'rate-limited' || failures >= 2;
  const cooldown = shouldBlock ? Math.max(retryAfterMs, Math.min(maxCooldown, baseCooldown * 2 ** Math.max(0, failures - 2))) : 0;
  health.set(normalized, { failures, blockedUntil: cooldown ? now + cooldown : 0 });
}
export function resetServiceHealthForTests() { health.clear(); }
