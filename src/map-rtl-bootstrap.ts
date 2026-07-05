import maplibregl from 'maplibre-gl';

const RTL_PLUGIN_URL = 'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js';
let installPromise: Promise<boolean> | undefined;

export function ensureRtlMapSupport(language: string) {
  if (language !== 'ar' && language !== 'ur') return Promise.resolve(false);
  const status = maplibregl.getRTLTextPluginStatus();
  if (status === 'loaded' || status === 'loading') return Promise.resolve(true);
  if (status !== 'unavailable') return Promise.resolve(false);

  installPromise ??= maplibregl.setRTLTextPlugin(RTL_PLUGIN_URL, true)
    .then(() => true)
    .catch(() => false);
  return installPromise;
}

function activeLanguage() {
  try {
    return localStorage.getItem('mtp-language') ?? document.documentElement.lang ?? 'en';
  } catch {
    return document.documentElement.lang ?? 'en';
  }
}

void ensureRtlMapSupport(activeLanguage());

new MutationObserver(() => {
  void ensureRtlMapSupport(activeLanguage());
}).observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });
