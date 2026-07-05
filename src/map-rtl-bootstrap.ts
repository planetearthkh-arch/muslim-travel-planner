import maplibregl from 'maplibre-gl';

const RTL_PLUGIN_URL = new URL('./vendor/mapbox-gl-rtl-text.js', document.baseURI).toString();
const RTL_LOAD_TIMEOUT_MS = 10_000;
let installPromise: Promise<boolean> | undefined;

function waitForRtlPlugin() {
  return new Promise<boolean>((resolve) => {
    const started = Date.now();
    const check = () => {
      const status = maplibregl.getRTLTextPluginStatus();
      if (status === 'loaded') {
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

export function ensureRtlMapSupport(): Promise<boolean> {
  const status = maplibregl.getRTLTextPluginStatus();
  if (status === 'loaded') return Promise.resolve(true);
  if (status === 'loading') return installPromise ?? waitForRtlPlugin();
  if (status !== 'unavailable') return Promise.resolve(false);

  installPromise ??= maplibregl.setRTLTextPlugin(RTL_PLUGIN_URL, false)
    .then(() => true)
    .catch((error: unknown) => {
      console.error('Bundled RTL map plugin failed to load.', error);
      return false;
    });
  return installPromise;
}
