import './turkish-halal-copy.js';
import './prayer-search-bootstrap.js';
import './map-rtl-bootstrap.js';

async function startApp() {
  await import('./main.js');
  await import('./halal-page-bootstrap.js');
  await import('./qibla-copy-bootstrap.js');
}

void startApp();
