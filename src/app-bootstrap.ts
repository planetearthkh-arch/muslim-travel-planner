import './turkish-halal-copy.js';
import './prayer-search-bootstrap.js';

async function startApp() {
  await import('./main.js');
  await import('./halal-page-bootstrap.js');
  await import('./qibla-copy-bootstrap.js');
  await import('./prayer-status-bootstrap.js');
  const { isPremiumPlatform } = await import('./premium.js');
  if (isPremiumPlatform()) await import('./premium-bootstrap.js');
}

void startApp();
