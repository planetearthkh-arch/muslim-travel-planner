import './turkish-halal-copy.js';
import './prayer-search-bootstrap.js';
import './ios-safe-area.css';

async function startApp() {
  await import('./main.js');
  await import('./halal-page-bootstrap.js');
  await import('./qibla-copy-bootstrap.js');
  await import('./prayer-status-bootstrap.js');
}

void startApp();
