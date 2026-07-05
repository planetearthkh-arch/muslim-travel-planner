import maplibregl from 'maplibre-gl';

const RTL_PLUGIN_URL = new URL('./vendor/mapbox-gl-rtl-text.js', document.baseURI).toString();
const RTL_LOAD_TIMEOUT_MS = 10_000;
const LEGACY_MAP_NAME_EXPRESSION = [
  'coalesce',
  ['get', 'name:en'],
  ['get', 'name_en'],
  ['get', 'name:latin'],
  ['get', 'name'],
  ['get', 'ref'],
] as const;
const LEGACY_MAP_NAME_EXPRESSION_JSON = JSON.stringify(LEGACY_MAP_NAME_EXPRESSION);

let installPromise: Promise<boolean> | undefined;
const liveMaps = new Set<maplibregl.Map>();
const trackedMaps = new WeakSet<maplibregl.Map>();
const originalSetStyle = maplibregl.Map.prototype.setStyle;
const originalSetLayoutProperty = maplibregl.Map.prototype.setLayoutProperty;
const originalRemove = maplibregl.Map.prototype.remove;

export function isLegacyMapLabelRewrite(property: string, value: unknown) {
  return property === 'text-field'
    && Array.isArray(value)
    && JSON.stringify(value) === LEGACY_MAP_NAME_EXPRESSION_JSON;
}

function activeLanguage() {
  try {
    return localStorage.getItem('mtp-language') ?? document.documentElement.lang ?? 'en';
  } catch {
    return document.documentElement.lang ?? 'en';
  }
}

function relayoutMapText(map: maplibregl.Map) {
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
      if (textField === undefined || textField === null) continue;
      originalSetLayoutProperty.call(map, layer.id, 'text-field', textField);
    } catch {
      // Icon-only and special symbol layers do not need text relayout.
    }
  }
}

function refreshLiveMaps() {
  for (const map of liveMaps) relayoutMapText(map);
}

function waitForRtlPlugin() {
  return new Promise<boolean>((resolve) => {
    const started = Date.now();
    const check = () => {
      const status = maplibregl.getRTLTextPluginStatus();
      if (status === 'loaded') {
        refreshLiveMaps();
        resolve(true);
        return;
      }
      if (status === 'error' || Date.now() - started >= RTL_LOAD_TIMEOUT_MS) {
        resolve(false);
        return;
      }
      window.setTimeout(check, 50);
    };
    check();
  });
}

export function ensureRtlMapSupport(language: string): Promise<boolean> {
  if (language !== 'ar' && language !== 'ur') return Promise.resolve(false);

  const status = maplibregl.getRTLTextPluginStatus();
  if (status === 'loaded') {
    refreshLiveMaps();
    return Promise.resolve(true);
  }
  if (status === 'loading') return installPromise ?? waitForRtlPlugin();
  if (status !== 'unavailable') return Promise.resolve(false);

  installPromise ??= maplibregl.setRTLTextPlugin(RTL_PLUGIN_URL, false)
    .then(() => {
      refreshLiveMaps();
      return true;
    })
    .catch((error: unknown) => {
      console.error('Bundled RTL map plugin failed to load.', error);
      return false;
    });
  return installPromise;
}

function trackMap(map: maplibregl.Map) {
  if (trackedMaps.has(map)) return;
  trackedMaps.add(map);
  liveMaps.add(map);
  map.on('style.load', () => {
    const language = activeLanguage();
    if (language !== 'ar' && language !== 'ur') return;
    void ensureRtlMapSupport(language).then((ready) => {
      if (ready) relayoutMapText(map);
    });
  });
}

const globalState = globalThis as typeof globalThis & { __safarOneMapLabelPolicyInstalled?: boolean };

if (!globalState.__safarOneMapLabelPolicyInstalled) {
  globalState.__safarOneMapLabelPolicyInstalled = true;

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
    if (isLegacyMapLabelRewrite(property, value)) return this;
    return originalSetLayoutProperty.call(this, layerId, property, value, ...rest);
  } as typeof originalSetLayoutProperty;

  maplibregl.Map.prototype.remove = function (
    this: maplibregl.Map,
    ...args: Parameters<typeof originalRemove>
  ): ReturnType<typeof originalRemove> {
    liveMaps.delete(this);
    return originalRemove.apply(this, args);
  } as typeof originalRemove;

  void ensureRtlMapSupport(activeLanguage());
  new MutationObserver(() => {
    void ensureRtlMapSupport(activeLanguage());
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });
}
