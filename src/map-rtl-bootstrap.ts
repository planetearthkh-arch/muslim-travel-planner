import maplibregl from 'maplibre-gl';

const RTL_PLUGIN_ASSET_URL = new URL('./vendor/mapbox-gl-rtl-text.js', document.baseURI).toString();
const RTL_LOAD_TIMEOUT_MS = 5_000;
const RTL_LANGUAGES = new Set(['ar', 'ur']);
let installPromise: Promise<boolean> | undefined;
let pluginObjectUrl = '';

async function fetchBundledPluginObjectUrl() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), RTL_LOAD_TIMEOUT_MS);
  try {
    const response = await fetch(RTL_PLUGIN_ASSET_URL, { cache: 'force-cache', signal: controller.signal });
    if (!response.ok) return '';
    const source = await response.text();
    if (source.length < 50_000 || !source.includes('registerRTLTextPlugin')) return '';
    pluginObjectUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    return pluginObjectUrl;
  } catch {
    return '';
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Register the bundled RTL shaper only when the selected map language needs it.
 * The plugin source is converted to a blob URL so MapLibre's worker can import
 * it inside an iOS Capacitor WebView without depending on a native app URL.
 */
export function ensureRtlMapSupport(language: string): Promise<boolean> {
  if (!RTL_LANGUAGES.has(language)) return Promise.resolve(true);

  const status = maplibregl.getRTLTextPluginStatus();
  if (status === 'loaded') return Promise.resolve(true);
  if (status === 'loading') return installPromise ?? Promise.resolve(false);
  if (status !== 'unavailable') return Promise.resolve(false);

  installPromise ??= fetchBundledPluginObjectUrl().then(async (pluginUrl) => {
    if (!pluginUrl) return false;
    try {
      await maplibregl.setRTLTextPlugin(pluginUrl, false);
      return true;
    } catch (error) {
      console.error('Bundled RTL map plugin failed to load.', error);
      return false;
    }
  });
  return installPromise;
}

window.addEventListener('pagehide', () => {
  if (pluginObjectUrl) URL.revokeObjectURL(pluginObjectUrl);
}, { once: true });
