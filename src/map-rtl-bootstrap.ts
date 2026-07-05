import maplibregl from 'maplibre-gl';

const RTL_PLUGIN_URL = 'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js';

export const LATIN_MAP_NAME_EXPRESSION = [
  'coalesce',
  ['get', 'name:en'],
  ['get', 'name_en'],
  ['get', 'name:latin'],
  ['get', 'int_name'],
  ['get', 'official_name:en'],
  ['get', 'short_name:en'],
  ['get', 'ref'],
] as const;

const unshapedNameFields = new Set([
  'name',
  'name:ar',
  'name_ar',
  'name:fa',
  'name_fa',
  'name:he',
  'name_he',
  'name:ur',
  'name_ur',
]);

export function containsUnshapedMapName(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  if (value[0] === 'get' && typeof value[1] === 'string' && unshapedNameFields.has(value[1])) return true;
  return value.some(containsUnshapedMapName);
}

let latinFallbackActive = false;
let installPromise: Promise<boolean> | undefined;
const liveMaps = new Set<maplibregl.Map>();
const trackedMaps = new WeakSet<maplibregl.Map>();
const originalSetStyle = maplibregl.Map.prototype.setStyle;
const originalSetLayoutProperty = maplibregl.Map.prototype.setLayoutProperty;
const originalRemove = maplibregl.Map.prototype.remove;

function applyLatinFallback(map: maplibregl.Map) {
  let layers: ReturnType<maplibregl.Map['getStyle']>['layers'];
  try {
    layers = map.getStyle().layers;
  } catch {
    return;
  }

  for (const layer of layers ?? []) {
    if (layer.type !== 'symbol') continue;
    try {
      const textField = map.getLayoutProperty(layer.id, 'text-field');
      if (!containsUnshapedMapName(textField)) continue;
      originalSetLayoutProperty.call(map, layer.id, 'text-field', LATIN_MAP_NAME_EXPRESSION);
    } catch {
      // Icon-only and special symbol layers do not need a text fallback.
    }
  }
}

function trackMap(map: maplibregl.Map) {
  if (trackedMaps.has(map)) return;
  trackedMaps.add(map);
  liveMaps.add(map);
  map.on('style.load', () => {
    if (latinFallbackActive) applyLatinFallback(map);
  });
}

function activateLatinFallback() {
  if (latinFallbackActive) return;
  latinFallbackActive = true;
  for (const map of liveMaps) applyLatinFallback(map);
}

export function ensureRtlMapSupport() {
  const status = maplibregl.getRTLTextPluginStatus();
  if (status === 'loaded' || status === 'loading') return Promise.resolve(true);
  if (status !== 'unavailable') {
    activateLatinFallback();
    return Promise.resolve(false);
  }

  installPromise ??= maplibregl.setRTLTextPlugin(RTL_PLUGIN_URL, true)
    .then(() => true)
    .catch(() => {
      activateLatinFallback();
      return false;
    });
  return installPromise;
}

const globalState = globalThis as typeof globalThis & { __safarOneMapTextPolicyInstalled?: boolean };

if (!globalState.__safarOneMapTextPolicyInstalled) {
  globalState.__safarOneMapTextPolicyInstalled = true;

  maplibregl.Map.prototype.setStyle = function (
    this: maplibregl.Map,
    ...args: Parameters<typeof originalSetStyle>
  ): ReturnType<typeof originalSetStyle> {
    const result = originalSetStyle.apply(this, args);
    trackMap(this);
    return result;
  } as typeof originalSetStyle;

  maplibregl.Map.prototype.setLayoutProperty = function (
    this: maplibregl.Map,
    ...args: Parameters<typeof originalSetLayoutProperty>
  ): ReturnType<typeof originalSetLayoutProperty> {
    const [layerId, property, value, ...rest] = args;
    const safeValue = latinFallbackActive && property === 'text-field' && containsUnshapedMapName(value)
      ? LATIN_MAP_NAME_EXPRESSION
      : value;
    return originalSetLayoutProperty.call(this, layerId, property, safeValue, ...rest);
  } as typeof originalSetLayoutProperty;

  maplibregl.Map.prototype.remove = function (
    this: maplibregl.Map,
    ...args: Parameters<typeof originalRemove>
  ): ReturnType<typeof originalRemove> {
    liveMaps.delete(this);
    return originalRemove.apply(this, args);
  } as typeof originalRemove;

  void ensureRtlMapSupport();
}
