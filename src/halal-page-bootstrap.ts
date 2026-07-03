export {};

const HALAL_DESTINATION_KEY = 'safarone-halal-destination';
let autoSearchStarted = false;

const halalEnhancementCopy = {
  en: {
    filterBy: 'Filter by',
    status: 'halal status',
    cuisine: 'Cuisine choices appear after restaurant results load.',
  },
  ar: {
    filterBy: 'تصفية حسب',
    status: 'حالة الحلال',
    cuisine: 'تظهر خيارات المطبخ بعد تحميل نتائج المطاعم.',
  },
  id: {
    filterBy: 'Saring berdasarkan',
    status: 'status halal',
    cuisine: 'Pilihan masakan muncul setelah hasil restoran dimuat.',
  },
  ms: {
    filterBy: 'Tapis mengikut',
    status: 'status halal',
    cuisine: 'Pilihan masakan muncul selepas hasil restoran dimuatkan.',
  },
  tr: {
    filterBy: 'Şuna göre filtrele:',
    status: 'helal durumu',
    cuisine: 'Mutfak seçenekleri restoran sonuçları yüklendikten sonra görünür.',
  },
} as const;

type SupportedLanguage = keyof typeof halalEnhancementCopy;

function currentLanguage(): SupportedLanguage {
  const language = document.documentElement.lang as SupportedLanguage;
  return language in halalEnhancementCopy ? language : 'en';
}

function readStoredDestination() {
  try {
    return window.sessionStorage.getItem(HALAL_DESTINATION_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeDestination(value: string) {
  const destination = value.trim();
  if (!destination) return;
  try {
    window.sessionStorage.setItem(HALAL_DESTINATION_KEY, destination);
  } catch {
    // The page still works when storage is blocked.
  }
}

function rememberPlannerDestination() {
  const field = document.querySelector<HTMLInputElement | HTMLSelectElement>('[data-field="city"]');
  if (field?.value) storeDestination(field.value);
}

function submitForm(form: HTMLFormElement) {
  if (typeof form.requestSubmit === 'function') {
    form.requestSubmit();
    return;
  }
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function startInitialHalalSearch() {
  if (window.location.hash !== '#halal-restaurants' || autoSearchStarted) return;
  const status = document.querySelector<HTMLElement>('.halal-app .prayer-status');
  const form = document.querySelector<HTMLFormElement>('#manual-halal-search');
  const input = document.querySelector<HTMLInputElement>('#halal-manual-query');
  const radius = document.querySelector<HTMLSelectElement>('#halal-radius');
  if (!status?.classList.contains('idle') || !form || !input) return;

  // A 1 km first search is fast and dependable even in dense city centres. Users can
  // expand the radius after seeing nearby results.
  if (radius && radius.value !== '1') {
    radius.value = '1';
    radius.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const destination = readStoredDestination() || 'London';
  input.value = destination;
  autoSearchStarted = true;
  submitForm(form);
}

function legendStatus(element: HTMLElement) {
  if (element.classList.contains('halal-halal-only')) return 'halal-only';
  if (element.classList.contains('halal-halal-options')) return 'halal-options';
  if (element.classList.contains('halal-certification-listed')) return 'certification-listed';
  if (element.classList.contains('halal-legacy-halal')) return 'legacy-halal';
  if (element.classList.contains('halal-possible-unverified')) return 'possible-unverified';
  return '';
}

function updateLegendPressed(select: HTMLSelectElement) {
  document.querySelectorAll<HTMLElement>('.halal-legend .badge').forEach((badge) => {
    const status = legendStatus(badge);
    if (status) badge.setAttribute('aria-pressed', String(select.value === status));
  });
}

function makeLegendInteractive() {
  const select = document.querySelector<HTMLSelectElement>('#halal-status-filter');
  if (!select) return;
  const copy = halalEnhancementCopy[currentLanguage()];

  document.querySelectorAll<HTMLElement>('.halal-legend .badge').forEach((badge) => {
    const status = legendStatus(badge);
    if (!status) return;

    badge.setAttribute('aria-pressed', String(select.value === status));
    badge.setAttribute('title', `${copy.filterBy} ${badge.textContent?.trim() || copy.status}`);
    if (badge.dataset.halalEnhanced === 'true') return;

    const activate = () => {
      select.value = status;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      updateLegendPressed(select);
    };

    badge.dataset.halalEnhanced = 'true';
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.style.cursor = 'pointer';
    badge.addEventListener('click', activate);
    badge.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      activate();
    });
  });
}

function clarifyCuisineSelector() {
  const select = document.querySelector<HTMLSelectElement>('#halal-cuisine-filter');
  if (!select) return;
  if (select.options.length <= 1) {
    select.title = halalEnhancementCopy[currentLanguage()].cuisine;
  } else {
    select.removeAttribute('title');
  }
}

function enhanceHalalPage() {
  rememberPlannerDestination();
  makeLegendInteractive();
  clarifyCuisineSelector();
  startInitialHalalSearch();
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element) || !target.closest('#open-halal-restaurants')) return;
  rememberPlannerDestination();
  autoSearchStarted = false;
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  if (target.matches('[data-field="city"]')) storeDestination(target.value);
  if (target.matches('#halal-status-filter')) updateLegendPressed(target as HTMLSelectElement);
});

window.addEventListener('hashchange', () => {
  if (window.location.hash === '#halal-restaurants') autoSearchStarted = false;
  window.queueMicrotask(enhanceHalalPage);
});

const root = document.querySelector<HTMLElement>('#root');
if (root) new MutationObserver(enhanceHalalPage).observe(root, { childList: true });
window.queueMicrotask(enhanceHalalPage);
