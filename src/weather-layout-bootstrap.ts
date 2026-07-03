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
    .weather-app .card,
    .money-app,
    .money-app .hero,
    .money-app .panel,
    .money-app .panel > *,
    .money-app section,
    .money-app form,
    .money-app .destination-box,
    .money-app .conversion-result,
    .money-app .toolbar,
    .money-app .stats,
    .money-app .chips,
    .money-app .spark,
    .money-app .grid {
      min-width: 0;
      max-width: 100%;
    }

    .weather-app,
    .money-app {
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
    .weather-app button,
    .money-app input,
    .money-app select,
    .money-app button {
      min-width: 0;
      max-width: 100%;
    }

    .money-app .grid {
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
    }

    .money-app input,
    .money-app select,
    .money-app button {
      width: 100%;
    }

    .money-app .toolbar,
    .money-app .stats,
    .money-app .chips {
      width: 100%;
      flex-wrap: wrap;
    }

    .money-app .toolbar > *,
    .money-app .stats > *,
    .money-app .chips > * {
      min-width: 0;
      max-width: 100%;
    }

    .money-app .stats p {
      flex: 1 1 140px;
      min-width: 0;
    }

    .weather-app h1,
    .weather-app h2,
    .weather-app h3,
    .weather-app p,
    .weather-app dt,
    .weather-app dd,
    .weather-app a,
    .weather-app button,
    .weather-app .chip,
    .money-app h1,
    .money-app h2,
    .money-app h3,
    .money-app p,
    .money-app label,
    .money-app option,
    .money-app button,
    .money-app .chip {
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

    .money-app .spark {
      width: 100%;
      overflow: hidden;
    }
  `;
  document.head.append(style);
}
