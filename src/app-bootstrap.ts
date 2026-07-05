import './turkish-halal-copy.js';
import './prayer-search-bootstrap.js';
import { registerRtlMapSupport } from './map-rtl-bootstrap.js';

registerRtlMapSupport();

async function startApp() {
  await import('./main.js');
  await import('./halal-page-bootstrap.js');
  await import('./qibla-copy-bootstrap.js');
}

startApp().catch((error: unknown) => {
  console.error('Application startup failed.', error);
});
