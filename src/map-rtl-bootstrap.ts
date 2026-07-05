import maplibregl from 'maplibre-gl';

const RTL_PLUGIN_URL = new URL('./mapbox-gl-rtl-text.js', document.baseURI).toString();
let installPromise: Promise<boolean> | undefined;

/**
 * Load MapLibre's RTL shaping engine from the app bundle.
 * This must finish before any map is created because map tiles can contain
 * Arabic or Hebrew labels regardless of the selected interface language.
 */
export function installRtlMapSupport() {
  const status = maplibregl.getRTLTextPluginStatus();
  if (status === 'loaded') return Promise.resolve(true);
  if (status === 'loading') return installPromise ?? Promise.resolve(false);
  if (status !== 'unavailable') return Promise.resolve(false);

  installPromise ??= maplibregl.setRTLTextPlugin(RTL_PLUGIN_URL, false)
    .then(() => true)
    .catch((error: unknown) => {
      console.error('Failed to load bundled RTL map support.', error);
      return false;
    });
  return installPromise;
}
