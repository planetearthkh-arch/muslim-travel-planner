import maplibregl from 'maplibre-gl';

const RTL_PLUGIN_URL = new URL('./mapbox-gl-rtl-text.js', document.baseURI).toString();
let registrationStarted = false;

export function registerRtlMapSupport() {
  const status = maplibregl.getRTLTextPluginStatus();
  if (status === 'loaded' || status === 'loading') return true;
  if (status !== 'unavailable' || registrationStarted) return false;

  registrationStarted = true;
  try {
    void maplibregl.setRTLTextPlugin(RTL_PLUGIN_URL, true).catch((error: unknown) => {
      console.error('Bundled RTL map plugin failed to load.', error);
    });
    return true;
  } catch (error) {
    console.error('Bundled RTL map plugin failed to register.', error);
    return false;
  }
}
