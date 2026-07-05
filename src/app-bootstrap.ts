import './turkish-halal-copy.js';
import './prayer-search-bootstrap.js';
import { installRtlMapSupport } from './map-rtl-bootstrap.js';

// MapLibre must know how to shape bidirectional text before the first map is
// constructed. The plugin is local, so this does not depend on a CDN or the
// selected interface language.
await installRtlMapSupport();

await import('./main.js');
await import('./halal-page-bootstrap.js');
await import('./qibla-copy-bootstrap.js');
