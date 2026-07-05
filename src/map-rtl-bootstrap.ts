import maplibregl from 'maplibre-gl';

const RTL_PLUGIN_URL = 'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js';
const globalState = globalThis as typeof globalThis & { __safarOneRtlMapPluginInstalled?: boolean };

if (!globalState.__safarOneRtlMapPluginInstalled) {
  globalState.__safarOneRtlMapPluginInstalled = true;
  if (maplibregl.getRTLTextPluginStatus() === 'unavailable') {
    maplibregl.setRTLTextPlugin(RTL_PLUGIN_URL, true);
  }
}
