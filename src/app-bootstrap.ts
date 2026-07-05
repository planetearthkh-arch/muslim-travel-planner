import './turkish-halal-copy.js';
import './prayer-search-bootstrap.js';
import { ensureRtlMapSupport } from './map-rtl-bootstrap.js';

async function startApp() {
  const rtlReady = await ensureRtlMapSupport();
  if (!rtlReady) console.error('Arabic map shaping was not available at startup.');

  await import('./main.js');
  await import('./halal-page-bootstrap.js');
  await import('./qibla-copy-bootstrap.js');
}

void startApp();
