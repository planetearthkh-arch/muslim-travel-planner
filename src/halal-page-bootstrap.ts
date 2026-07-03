const HALAL_DESTINATION_KEY = 'safarone-halal-destination';
let autoSearchStarted = false;

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

function startInitialHalalSearch() {
  if (window.location.hash !== '#halal-restaurants' || autoSearchStarted) return;
  const status = document.querySelector<HTMLElement>('.halal-app .prayer-status');
  const form = document.querySelector<HTMLFormElement>('#manual-halal-search');
  const input = document.querySelector<HTMLInputElement>('#halal-manual-query');
  if (!status?.classList.contains('idle') || !form || !input) return;

  const destination = readStoredDestination() || 'London';
  input.value = destination;
  autoSearchStarted = true;
  form.requestSubmit();
}

function legendStatus(element: HTMLElement) {
  if (element.classList.contains('halal-halal-only')) return 'halal-only';
  if (element.classList.contains('halal-halal-options')) return 'halal-options';
  if (element.classList.contains('halal-certification-listed')) return 'certification-listed';
  if (element.classList.contains('halal-legacy-halal')) return 'legacy-halal';
  if (element.classList.contains('halal-possible-unverified')) return 'possible-unverified';
  return '';
}

function makeLegendInteractive() {
  const select = document.querySelector<HTMLSelectElement>('#halal-status-filter');
  if (!select) return;

  document.querySelectorAll<HTMLElement>('.halal-legend .badge').forEach((badge) => {
    if (badge.dataset.halalEnhanced === 'true') return;
    const status = legendStatus(badge);
    if (!status) return;

    const activate = () => {
      select.value = status;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };

    badge.dataset.halalEnhanced = 'true';
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.setAttribute('aria-pressed', String(select.value === status));
    badge.setAttribute('title', `Filter by ${badge.textContent?.trim() ?? 'halal status'}`);
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
    select.title = 'Cuisine choices appear after restaurant results load.';
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
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
    if (target.matches('[data-field="city"]')) storeDestination(target.value);
  }
});

window.addEventListener('hashchange', () => {
  if (window.location.hash === '#halal-restaurants') autoSearchStarted = false;
  window.queueMicrotask(enhanceHalalPage);
});

new MutationObserver(enhanceHalalPage).observe(document.documentElement, { childList: true, subtree: true });
window.queueMicrotask(enhanceHalalPage);
