import { parseLanguage, type Language } from './app-language.js';
import { premiumService } from './premium.js';

type MapPreviewCopy = {
  badge: string;
  title: string;
  body: string;
  action: string;
};

const copyByLanguage: Record<Language, MapPreviewCopy> = {
  en: { badge: 'Free Preview', title: 'Preview map', body: 'See the two free preview locations here. Unlock every result, the full interactive map and directions.', action: 'Unlock map & directions' },
  ar: { badge: 'معاينة مجانية', title: 'معاينة الخريطة', body: 'شاهد موقعي المعاينة المجانيين هنا. افتح جميع النتائج والخريطة التفاعلية الكاملة والاتجاهات.', action: 'فتح الخريطة والاتجاهات' },
  id: { badge: 'Pratinjau Gratis', title: 'Pratinjau peta', body: 'Lihat dua lokasi pratinjau gratis di sini. Buka semua hasil, peta interaktif lengkap, dan petunjuk arah.', action: 'Buka peta & petunjuk' },
  ms: { badge: 'Pratonton Percuma', title: 'Pratonton peta', body: 'Lihat dua lokasi pratonton percuma di sini. Buka semua hasil, peta interaktif penuh dan arah.', action: 'Buka peta & arah' },
  tr: { badge: 'Ücretsiz Önizleme', title: 'Harita önizlemesi', body: 'İki ücretsiz önizleme konumunu burada görün. Tüm sonuçları, tam etkileşimli haritayı ve yol tariflerini açın.', action: 'Harita ve yolları aç' },
  fr: { badge: 'Aperçu gratuit', title: 'Aperçu de la carte', body: 'Consultez ici les deux lieux gratuits. Débloquez tous les résultats, la carte interactive complète et les itinéraires.', action: 'Débloquer carte et itinéraires' },
  ur: { badge: 'مفت پیش نظارہ', title: 'نقشے کا پیش نظارہ', body: 'دو مفت پیش نظارہ مقامات یہاں دیکھیں۔ تمام نتائج، مکمل انٹرایکٹو نقشہ اور راستے کھولیں۔', action: 'نقشہ اور راستے کھولیں' },
};

const protectedMapSelector = '#prayer-map, #halal-map, #attractions-map';
const protectedDiscoveryControlsSelector = '.segmented, .prayer-filters';
const protectedRadiusSelector = '#prayer-radius, #halal-radius, #attraction-radius';
const attractionViewSelector = '[data-attraction-view]';
const mapLinkSelector = [
  '.prayer-place-card .map-link[href*="openstreetmap.org"]',
  '.prayer-place-card .map-link[href*="maps.apple.com"]',
  '.restaurant-card .map-link[href*="openstreetmap.org"]',
  '.restaurant-card .map-link[href*="maps.apple.com"]',
  '.attraction-card .map-link[href*="openstreetmap.org"]',
  '.attraction-card .map-link[href*="maps.apple.com"]',
].join(',');

let entitled = premiumService.current().entitled;
let scheduled = false;
let observer: MutationObserver | null = null;
let attractionUserSelectedNonMap = false;
const originalRemove = Element.prototype.remove;

function currentCopy() {
  let language: Language = 'en';
  try { language = parseLanguage(localStorage.getItem('mtp-language')) ?? 'en'; } catch { /* use English */ }
  return copyByLanguage[language];
}

function openPremiumFrom(context: Element) {
  const main = context.closest('main');
  const personalized = main?.querySelector<HTMLButtonElement>('[data-premium-results-preview] [data-premium-preview="places"]');
  const premiumEntry = document.querySelector<HTMLButtonElement>('[data-premium-entry]');
  (personalized ?? premiumEntry)?.click();
}

function markerLimit(map: HTMLElement) {
  return map.matches('#attractions-map') ? 2 : 3;
}

function limitMarkers(map: HTMLElement) {
  const apply = () => {
    const limit = entitled ? Number.POSITIVE_INFINITY : markerLimit(map);
    const markers = Array.from(map.querySelectorAll<HTMLElement>('.maplibregl-marker'));
    markers.forEach((marker, index) => { marker.hidden = index >= limit; });
  };
  apply();
  if (map.dataset.premiumMarkerObserver === 'true') return;
  map.dataset.premiumMarkerObserver = 'true';
  new MutationObserver(apply).observe(map, { childList: true, subtree: true });
}

function decorateMap(map: HTMLElement) {
  if (entitled || map.dataset.premiumPreviewFixed === 'true') return;
  map.dataset.premiumPreviewFixed = 'true';
  limitMarkers(map);

  const shell = document.createElement('section');
  shell.className = 'premium-map-preview-fix';
  shell.setAttribute('aria-label', currentCopy().title);
  map.before(shell);
  shell.append(map);
  map.classList.add('premium-map-preview-fix-surface');

  const copy = currentCopy();
  const overlay = document.createElement('div');
  overlay.className = 'premium-map-preview-fix-overlay';
  overlay.innerHTML = `<div><span>${copy.badge}</span><strong>${copy.title}</strong><p>${copy.body}</p></div><button type="button"><span>✦</span>${copy.action}</button>`;
  overlay.querySelector('button')?.addEventListener('click', () => openPremiumFrom(shell));
  shell.append(overlay);
}

function replaceExternalMapLinks() {
  const cards = new Set<HTMLElement>();
  document.querySelectorAll<HTMLAnchorElement>(mapLinkSelector).forEach((link) => {
    const card = link.closest<HTMLElement>('.prayer-place-card, .restaurant-card, .attraction-card');
    if (card) cards.add(card);
    link.remove();
  });

  cards.forEach((card) => {
    const actions = card.querySelector<HTMLElement>('.place-actions');
    if (!actions || actions.querySelector('[data-premium-map-preview-action]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost premium-map-preview-fix-action';
    button.dataset.premiumMapPreviewAction = 'true';
    button.innerHTML = `<span aria-hidden="true">✦</span><span>${currentCopy().action}</span>`;
    button.addEventListener('click', () => openPremiumFrom(card));
    actions.prepend(button);
  });
}

function hideAttractionMapControls() {
  document.querySelectorAll<HTMLElement>('#attractions-search-this-area, #attractions-recentre, #attractions-fit-results').forEach((control) => {
    control.hidden = true;
    control.setAttribute('aria-hidden', 'true');
  });
}

function ensureAttractionMapPreview() {
  if (entitled) return;
  const app = document.querySelector<HTMLElement>('#back-from-attractions')?.closest<HTMLElement>('main');
  if (!app) {
    attractionUserSelectedNonMap = false;
    return;
  }
  if (app.querySelector('#attractions-map') || attractionUserSelectedNonMap) return;
  app.querySelector<HTMLButtonElement>('[data-attraction-view="map"]')?.click();
}

function applyPreviewFix() {
  scheduled = false;
  if (entitled) return;
  ensureAttractionMapPreview();
  document.querySelectorAll<HTMLElement>(protectedMapSelector).forEach(decorateMap);
  hideAttractionMapControls();
  replaceExternalMapLinks();
}

function schedulePreviewFix() {
  if (scheduled || entitled) return;
  scheduled = true;
  window.requestAnimationFrame(applyPreviewFix);
}

function restorePremiumExperience() {
  document.querySelectorAll<HTMLElement>('.premium-map-preview-fix').forEach((shell) => {
    const map = shell.querySelector<HTMLElement>(protectedMapSelector);
    if (map) {
      map.classList.remove('premium-map-preview-fix-surface');
      map.removeAttribute('data-premium-preview-fixed');
      map.querySelectorAll<HTMLElement>('.maplibregl-marker').forEach((marker) => { marker.hidden = false; });
      shell.before(map);
    }
    originalRemove.call(shell);
  });
  document.querySelectorAll<HTMLElement>('[data-premium-map-preview-action]').forEach((button) => originalRemove.call(button));
}

function isProtectedDiscoveryControl(element: HTMLElement) {
  if (element.matches(protectedDiscoveryControlsSelector)) return true;
  return element.matches('label') && Boolean(element.querySelector(protectedRadiusSelector));
}

function protectEmbeddedPreviewMaps() {
  const guardedRemove = function guardedRemove(this: Element) {
    if (!entitled && this instanceof HTMLElement && (this.matches(protectedMapSelector) || isProtectedDiscoveryControl(this))) {
      if (this.matches(protectedMapSelector)) decorateMap(this);
      return;
    }
    originalRemove.call(this);
  };
  Element.prototype.remove = guardedRemove;
}

protectEmbeddedPreviewMaps();
document.addEventListener('click', (event) => {
  if (entitled || !(event.target instanceof Element)) return;

  const attractionView = event.target.closest<HTMLButtonElement>(attractionViewSelector);
  if (attractionView) {
    const nextView = attractionView.dataset.attractionView;
    if (event.isTrusted) attractionUserSelectedNonMap = nextView !== 'map';
    if (!event.isTrusted && nextView === 'photos' && document.querySelector('#attractions-map')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
  }

  const mapLink = event.target.closest<HTMLAnchorElement>(mapLinkSelector);
  if (!mapLink) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openPremiumFrom(mapLink);
}, true);
observer = new MutationObserver(() => {
  ensureAttractionMapPreview();
  schedulePreviewFix();
});
observer.observe(document.documentElement, { childList: true, subtree: true });
ensureAttractionMapPreview();
schedulePreviewFix();

window.addEventListener('safarmate-premium-state', (event) => {
  const detail = (event as CustomEvent<{ entitled?: boolean }>).detail;
  const nextEntitled = detail?.entitled === true;
  if (nextEntitled === entitled) return;
  entitled = nextEntitled;
  if (entitled) {
    Element.prototype.remove = originalRemove;
    observer?.disconnect();
    observer = null;
    restorePremiumExperience();
  } else {
    protectEmbeddedPreviewMaps();
    if (!observer) {
      observer = new MutationObserver(() => {
        ensureAttractionMapPreview();
        schedulePreviewFix();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    ensureAttractionMapPreview();
    schedulePreviewFix();
  }
});
