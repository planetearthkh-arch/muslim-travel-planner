import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`);

function replaceOnce(path, search, replacement, label) {
  const source = read(path);
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one ${label}, found ${count}`);
  write(path, source.replace(search, replacement));
}

function replaceRange(path, startMarker, endMarker, replacement) {
  const source = read(path);
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`${path}: replacement range not found`);
  write(path, source.slice(0, start) + replacement + source.slice(end));
}

const parser = `export function parseAmountInput(raw: string, language?: Language): { value: number | null; error?: 'empty' | 'negative' | 'invalid' | 'tooLarge' } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, error: 'empty' };
  if (/(?:^|\\s)[-−]|[-−]\\s*\\d/.test(trimmed)) return { value: null, error: 'negative' };

  const normalizedText = trimmed
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/٬/g, ',')
    .replace(/٫/g, '.')
    .replace(/[\\u0000-\\u001f\\u007f]/g, '');
  const numericToken = normalizedText.match(/[+]?\\d[\\d.,' \\u00a0\\u202f]*/)?.[0] ?? '';
  const normalized = numericToken.replace(/[ '’\\u00a0\\u202f]/g, '').replace(/^\\+/, '');
  if (!normalized || !/^[0-9][0-9.,]*$/.test(normalized)) return { value: null, error: 'invalid' };

  const grouped = (value: string, separator: string) => {
    const groups = value.split(separator);
    return /^[0-9]{1,3}$/.test(groups[0] || '') && groups.length > 1 && groups.slice(1).every((group) => /^[0-9]{3}$/.test(group));
  };

  let numeric = normalized;
  const hasDot = normalized.includes('.');
  const hasComma = normalized.includes(',');
  if (hasDot && hasComma) {
    const decimal = normalized.lastIndexOf('.') > normalized.lastIndexOf(',') ? '.' : ',';
    const group = decimal === '.' ? ',' : '.';
    const decimalIndex = normalized.lastIndexOf(decimal);
    const integer = normalized.slice(0, decimalIndex);
    const fraction = normalized.slice(decimalIndex + 1);
    if (!/^\\d+$/.test(fraction) || fraction.length > 12 || integer.includes(decimal) || !grouped(integer, group)) return { value: null, error: 'invalid' };
    numeric = integer.replaceAll(group, '') + '.' + fraction;
  } else if (hasDot || hasComma) {
    const separator = hasDot ? '.' : ',';
    const occurrences = normalized.split(separator).length - 1;
    if (occurrences > 1) {
      if (!grouped(normalized, separator)) return { value: null, error: 'invalid' };
      numeric = normalized.replaceAll(separator, '');
    } else {
      const [integer, fraction = ''] = normalized.split(separator);
      if (!/^\\d+$/.test(integer) || !/^\\d+$/.test(fraction)) return { value: null, error: 'invalid' };
      if (fraction.length === 3 && integer !== '0') {
        if (integer.length > 3) return { value: null, error: 'invalid' };
        if (language) {
          const parts = new Intl.NumberFormat(localeFor(language)).formatToParts(12345.6);
          const localeDecimal = parts.find((part) => part.type === 'decimal')?.value || '.';
          const localeGroup = parts.find((part) => part.type === 'group')?.value || ',';
          numeric = separator === localeGroup ? integer + fraction : separator === localeDecimal ? integer + '.' + fraction : integer + '.' + fraction;
        } else numeric = integer + fraction;
      } else numeric = integer + '.' + fraction;
    }
  }
  if (!/^\\d+(?:\\.\\d+)?$/.test(numeric)) return { value: null, error: 'invalid' };
  const value = Number(numeric);
  if (!Number.isFinite(value)) return { value: null, error: 'invalid' };
  if (value > 1_000_000_000_000_000) return { value: null, error: 'tooLarge' };
  return { value };
}`;
replaceRange('src/money.ts', 'export const parseAmountInput =', '\n\nexport const convertAmount', parser);

write('src/provider-health.ts', `import type { RequestFailureKind } from './http.js';
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
`);
write('src/provider-health.test.ts', `import assert from 'node:assert/strict';
import test from 'node:test';
import { availableServiceEndpoints, normalizeServiceEndpoint, recordServiceFailure, recordServiceSuccess, resetServiceHealthForTests, uniqueServiceEndpoints } from './provider-health.js';
test('normalizes and deduplicates safe HTTPS provider endpoints', () => {
  assert.equal(normalizeServiceEndpoint(' https://example.com/api '), 'https://example.com/api');
  assert.equal(normalizeServiceEndpoint('http://example.com'), '');
  assert.deepEqual(uniqueServiceEndpoints(['https://example.com/api', 'https://example.com/api', 'bad']), ['https://example.com/api']);
});
test('temporarily deprioritizes providers after repeated transient failures', () => {
  resetServiceHealthForTests(); const a = 'https://a.example/api'; const b = 'https://b.example/api';
  recordServiceFailure(a, 'timeout', 0, 1000); assert.deepEqual(availableServiceEndpoints([a, b], 1001), [b, a]);
  recordServiceFailure(a, 'timeout', 0, 1002); assert.deepEqual(availableServiceEndpoints([a, b], 1003), [b]);
  assert.deepEqual(availableServiceEndpoints([a, b], 31003), [b, a]);
});
test('rate limits block immediately and success resets health', () => {
  resetServiceHealthForTests(); const a = 'https://a.example/api'; const b = 'https://b.example/api';
  recordServiceFailure(a, 'rate-limited', 120000, 10000); assert.deepEqual(availableServiceEndpoints([a, b], 10001), [b]);
  recordServiceSuccess(a); assert.deepEqual(availableServiceEndpoints([a, b], 10002), [a, b]);
});
`);

replaceOnce('src/halal-overpass.ts', "import { RequestError, classifyRequestError } from './http.js';", "import { RequestError, classifyRequestError } from './http.js';\nimport { availableServiceEndpoints, recordServiceFailure, recordServiceSuccess, uniqueServiceEndpoints } from './provider-health.js';", 'halal provider import');
replaceOnce('src/halal-overpass.ts', "  return [...new Set(\n    candidates.filter((value): value is string => Boolean(value)),\n  )];", '  return uniqueServiceEndpoints(candidates);', 'halal endpoint dedupe');
replaceOnce('src/halal-overpass.ts', '  const endpoints = halalOverpassEndpoints(primary);', '  const endpoints = availableServiceEndpoints(halalOverpassEndpoints(primary));', 'halal endpoint health');
replaceOnce('src/halal-overpass.ts', '      return await operation(endpoint, timeoutMilliseconds);', '      const result = await operation(endpoint, timeoutMilliseconds);\n      recordServiceSuccess(endpoint);\n      return result;', 'halal success recording');
replaceOnce('src/halal-overpass.ts', '      lastError = classified;', '      recordServiceFailure(endpoint, classified.kind, classified.retryAfterMs);\n      lastError = classified;', 'halal failure recording');

replaceOnce('src/main.ts', "import { RequestError, classifyRequestError, requestJson, retryOnceForTemporary } from './http.js';", "import { RequestError, classifyRequestError, requestJson, retryOnceForTemporary } from './http.js';\nimport { availableServiceEndpoints, recordServiceFailure, recordServiceSuccess } from './provider-health.js';", 'main provider import');
replaceOnce('src/main.ts', "  return [...new Set([configured || overpassUrl(), fallback].filter(Boolean))];", '  return availableServiceEndpoints([configured || overpassUrl(), fallback]);', 'attraction endpoint health');
replaceOnce('src/main.ts', '      return await requestOverpass(endpoint, { ...overpassPostOptions(batch.query), signal }, 9000);', '      const result = await requestOverpass(endpoint, { ...overpassPostOptions(batch.query), signal }, 9000);\n      recordServiceSuccess(endpoint);\n      return result;', 'attraction success recording');
replaceOnce('src/main.ts', '      lastError = error;\n      recordAttractionDiagnostic', '      lastError = error;\n      const classified = classifyRequestError(error);\n      recordServiceFailure(endpoint, classified.kind, classified.retryAfterMs);\n      recordAttractionDiagnostic', 'attraction failure recording');

replaceOnce('src/planner.test.ts', "assert.equal(taxiDetails.includes('[copy.transportOperator, item.operator]'), true);", "assert.equal(taxiDetails.includes('[copy.transportOperator, esc(item.operator)]'), true);", 'escaped taxi operator assertion');
replaceOnce('src/planner.test.ts', "assert.equal(taxiDetails.includes('[copy.prayerOpeningHours, item.openingHours]'), true);", "assert.equal(taxiDetails.includes('[copy.prayerOpeningHours, esc(item.openingHours)]'), true);", 'escaped taxi hours assertion');
replaceOnce('src/release-hardening.test.ts', "assert.equal(parseAmountInput('USD 12', 'en').error, 'invalid');", "assert.equal(parseAmountInput('USD 12', 'en').value, 12);", 'currency-label parsing assertion');

write('.github/workflows/ci.yml', `name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
      - run: npm test
      - run: npm run lint
  android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 21 }
      - run: npm ci
      - run: npm run android:setup
      - run: ./gradlew assembleDebug
        working-directory: android
`);

for (const path of [
  '.github/workflows/apply-release-hardening.yml', '.github/workflows/export-workspace.yml', '.github/workflows/finalize-release-hardening.yml',
  '.github/workflows/fix-validation-errors.yml', '.github/workflows/validate-hardening.yml', '.github/workflows/apply-final-release-fixes.yml',
  'scripts/apply-release-hardening-phase2.mjs', 'scripts/apply-release-hardening.mjs', 'scripts/finalize-hardening-prep.sh',
  'scripts/fix-validation-errors.mjs', 'scripts/apply-final-release-fixes.mjs', 'scripts/final-hardening-ready.txt',
  'scripts/final-files', 'scripts/final-hardening-patch.part00', 'scripts/final-hardening-patch.part01', 'scripts/final-hardening-patch.part02',
  'scripts/final-hardening-patch.part03', 'scripts/final-hardening-patch.part04', 'export-trigger.txt', 'hardening-run.log',
  'hardening-trigger-phase2.txt', 'hardening-trigger.txt', 'validation-run.log', 'validation-trigger.txt', 'finalizer-typecheck.log', 'temp/noop.txt'
]) if (existsSync(path)) rmSync(path, { recursive: true, force: true });

console.log('Final release fixes applied and temporary tooling removed.');
