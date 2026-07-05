import maplibregl from 'maplibre-gl';

const RTL_PLUGIN_URL = 'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js';
const RTL_FETCH_TIMEOUT_MS = 5000;
let installPromise: Promise<boolean> | undefined;
let pluginObjectUrl = '';

async function fetchRtlPluginObjectUrl() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), RTL_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(RTL_PLUGIN_URL, { cache: 'force-cache', signal: controller.signal });
    if (!response.ok) return '';
    const script = await response.text();
    if (!script.trim()) return '';
    pluginObjectUrl = URL.createObjectURL(new Blob([script], { type: 'text/javascript' }));
    return pluginObjectUrl;
  } catch {
    return '';
  } finally {
    window.clearTimeout(timeout);
  }
}

export function ensureRtlMapSupport(language: string) {
  if (language !== 'ar' && language !== 'ur') return Promise.resolve(false);
  const status = maplibregl.getRTLTextPluginStatus();
  if (status === 'loaded' || status === 'loading') return Promise.resolve(true);
  if (status !== 'unavailable') return Promise.resolve(false);

  installPromise ??= fetchRtlPluginObjectUrl().then(async (pluginUrl) => {
    if (!pluginUrl) return false;
    try {
      await maplibregl.setRTLTextPlugin(pluginUrl, false);
      return true;
    } catch {
      return false;
    }
  });
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

window.addEventListener('pagehide', () => {
  if (pluginObjectUrl) URL.revokeObjectURL(pluginObjectUrl);
}, { once: true });
