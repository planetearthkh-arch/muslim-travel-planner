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

const rtlNameFields = new Set([
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

export function containsRtlMapName(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  if (value[0] === 'get' && typeof value[1] === 'string' && rtlNameFields.has(value[1])) return true;
  return value.some(containsRtlMapName);
}

let latinFallbackActive = false;
let installPromise: Promise<boolean> | undefined;
const liveMaps = new Set<maplibregl.Map>();
const trackedMaps = new WeakSet<maplibregl.Map>();
const originalSetStyle = maplibregl.Map.prototype.setStyle;
const originalSetLayoutProperty = maplibregl.Map.prototype.setLayoutProperty;
const originalRemove = maplibregl.Map.prototype.remove;

function symbolLayers(map: maplibregl.Map) {
  try {
    return map.getStyle().layers?.filter((layer) => layer.type === 'symbol') ?? [];
  } catch {
    return [];
  }
}

function applyLatinFallback(map: maplibregl.Map) {
  for (const layer of symbolLayers(map)) {
    try {
      const textField = map.getLayoutProperty(layer.id, 'text-field');
      if (!containsRtlMapName(textField)) continue;
      originalSetLayoutProperty.call(map, layer.id, 'text-field', LATIN_MAP_NAME_EXPRESSION);
    } catch {
      // Icon-only and special symbol layers do not need a text fallback.
    }
  }
}

function relayoutRtlText(map: maplibregl.Map) {
  for (const layer of symbolLayers(map)) {
    try {
      const textField = map.getLayoutProperty(layer.id, 'text-field');
      if (!containsRtlMapName(textField)) continue;
      // Re-applying the expression forces MapLibre to rebuild the symbol buckets
      // after the RTL plugin is fully loaded, including in iOS WKWebView.
      originalSetLayoutProperty.call(map, layer.id, 'text-field', textField);
    } catch {
      // Ignore icon-only and special symbol layers.
    }
  }
}

function refreshLiveMapsAfterPluginLoad() {
  for (const map of liveMaps) relayoutRtlText(map);
}

function trackMap(map: maplibregl.Map) {
  if (trackedMaps.has(map)) return;
  trackedMaps.add(map);
  liveMaps.add(map);
  map.on('style.load', () => {
    if (latinFallbackActive) {
      applyLatinFallback(map);
      return;
    }
    if (maplibregl.getRTLTextPluginStatus() === 'loaded') relayoutRtlText(map);
  });
}

function activateLatinFallback() {
  if (latinFallbackActive) return;
  latinFallbackActive = true;
  for (const map of liveMaps) applyLatinFallback(map);
}

function waitForExistingPluginLoad() {
  return new Promise<boolean>((resolve) => {
    const started = Date.now();
    const check = () => {
      const status = maplibregl.getRTLTextPluginStatus();
      if (status === 'loaded') {
        refreshLiveMapsAfterPluginLoad();
        resolve(true);
        return;
      }
      if (status === 'error' || Date.now() - started > 10000) {
        activateLatinFallback();
        resolve(false);
        return;
      }
      window.setTimeout(check, 50);
    };
    check();
  });
}

export function ensureRtlMapSupport() {
  const status = maplibregl.getRTLTextPluginStatus();
  if (status === 'loaded') return Promise.resolve(true);
  if (status === 'loading') return installPromise ?? waitForExistingPluginLoad();
  if (status !== 'unavailable') {
    activateLatinFallback();
    return Promise.resolve(false);
  }

  // Load eagerly. Lazy loading was unreliable in iOS WKWebView and allowed
  // Arabic labels to render before shaping was ready.
  installPromise ??= maplibregl.setRTLTextPlugin(RTL_PLUGIN_URL, false)
    .then(() => {
      refreshLiveMapsAfterPluginLoad();
      return true;
    })
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
    const safeValue = latinFallbackActive && property === 'text-field' && containsRtlMapName(value)
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
