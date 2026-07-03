const STYLE_ID = 'weather-layout-guard';

if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .weather-app,
    .weather-app .prayer-panel,
    .weather-app .prayer-panel > *,
    .weather-app section,
    .weather-app .destination-box,
    .weather-app .hourly-strip,
    .weather-app .place-list,
    .weather-app .card {
      min-width: 0;
      max-width: 100%;
    }

    .weather-app {
      overflow-x: clip;
    }

    .weather-app .manual-search,
    .weather-app .prayer-actions,
    .weather-app .prayer-filters,
    .weather-app .result-header {
      min-width: 0;
      max-width: 100%;
    }

    .weather-app input,
    .weather-app select,
    .weather-app button {
      min-width: 0;
      max-width: 100%;
    }

    .weather-app h1,
    .weather-app h2,
    .weather-app h3,
    .weather-app p,
    .weather-app dt,
    .weather-app dd,
    .weather-app a,
    .weather-app button,
    .weather-app .chip {
      overflow-wrap: anywhere;
      word-break: normal;
    }

    .weather-app .hourly-strip {
      width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      overscroll-behavior-inline: contain;
      -webkit-overflow-scrolling: touch;
    }

    .weather-app .hour-card {
      min-width: 0;
      max-width: 160px;
    }
  `;
  document.head.append(style);
}
