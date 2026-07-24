import { languageDirection, parseLanguage, type Language } from './app-language.js';
import { premiumService, type PremiumState, type PurchaseOutcome } from './premium.js';
import { copyByLanguage, type PreviewKind } from './premium-copy.js';

type PaywallReason = '' | 'locked' | 'plan' | 'places';
type PaywallContext = {
  days?: number;
  stops?: number;
  visible?: number;
  total?: number;
  kind?: PreviewKind;
};

const FREE_DISCOVERY_PREVIEW_LIMIT = 2;
const FREE_PLAN_PREVIEW_LIMIT = 2;
const premiumHashes = new Set(['#saved-trips', '#flight-mode', '#money', '#car-rental', '#public-transport', '#taxi-services']);
const premiumSelectors = [
  '[data-share-trip]', '[data-copy-trip]', '[data-export-trip]', '[data-duplicate-trip]', '[data-premium-preview]',
  '#open-saved-trips', '#save-trip', '#share-trip', '#copy-trip', '#export-trip', '#export-calendar', '#print-itinerary',
  '#open-flight-mode', '#open-money', '#open-car-rental', '#open-public-transport', '#open-taxi-services',
  '[data-attraction-save]',
].join(',');

let premiumState: PremiumState = premiumService.current();
let dialog: HTMLElement | null = null;
let statusMessage = '';
let lastTrigger: HTMLElement | null = null;
let lastPublishedSignature = '';
let contentWasGated = false;
let paywallContext: PaywallContext = {};

function language(): Language {
  try { return parseLanguage(localStorage.getItem('mtp-language')) ?? 'en'; } catch { return 'en'; }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' })[character] ?? character);
}

function interpolate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

function currentCopy() { return copyByLanguage[language()]; }
function displayPrice() { return premiumState.displayPrice || '$3.99'; }

function featureList(items: string[], className: string) {
  const rows = items.map((feature) => `<li><span aria-hidden="true">✓</span><span>${escapeHtml(feature)}</span></li>`).join('');
  return `<ul class="${className}">${rows}</ul>`;
}

function paywallHeading(reason: PaywallReason) {
  const copy = currentCopy();
  if (premiumState.entitled) {
    return {
      title: copy.included,
      subtitle: premiumState.grandfathered ? copy.legacy : copy.purchased,
    };
  }
  if (reason === 'plan' && paywallContext.days && paywallContext.stops) {
    return {
      title: interpolate(copy.planPaywallTitle, { days: paywallContext.days }),
      subtitle: interpolate(copy.planPaywallSubtitle, {
        visible: paywallContext.visible ?? FREE_PLAN_PREVIEW_LIMIT,
        stops: paywallContext.stops,
      }),
    };
  }
  if (reason === 'places' && paywallContext.total && paywallContext.kind) {
    const kind = copy.placeKinds[paywallContext.kind] ?? copy.placeKinds.landmarks;
    return {
      title: interpolate(copy.placesPaywallTitle, { total: paywallContext.total, kind }),
      subtitle: interpolate(copy.placesPaywallSubtitle, {
        visible: paywallContext.visible ?? FREE_DISCOVERY_PREVIEW_LIMIT,
      }),
    };
  }
  return { title: copy.title, subtitle: copy.subtitle };
}

function comparisonMarkup() {
  const copy = currentCopy();
  return `<div class="premium-comparison-wrap">
    <h3>${escapeHtml(copy.comparisonTitle)}</h3>
    <div class="premium-comparison">
      <section class="premium-tier premium-tier-free">
        <div class="premium-tier-heading"><span class="premium-tier-dot" aria-hidden="true"></span><strong>${escapeHtml(copy.freeLabel)}</strong></div>
        ${featureList(copy.freeFeatures, 'premium-tier-list')}
      </section>
      <section class="premium-tier premium-tier-paid">
        <div class="premium-tier-heading"><span class="premium-tier-star" aria-hidden="true">✦</span><strong>${escapeHtml(copy.premiumLabel)}</strong></div>
        ${featureList(copy.premiumFeatures, 'premium-tier-list')}
      </section>
    </div>
  </div>`;
}

function paywallMarkup(reason: PaywallReason = '') {
  const lang = language();
  const copy = copyByLanguage[lang];
  const dir = languageDirection(lang);
  const active = premiumState.entitled;
  const price = escapeHtml(displayPrice());
  const heading = paywallHeading(reason);
  const message = statusMessage || (!active && reason ? copy.lockedFeature : '');
  const benefits = active
    ? `<div class="premium-active-benefits">${featureList(copy.premiumFeatures, 'premium-features')}</div>`
    : comparisonMarkup();
  const actions = active
    ? `<button class="premium-primary premium-primary-centered" type="button" data-premium-close>${escapeHtml(copy.close)}</button>`
    : `<button class="premium-primary" type="button" data-premium-buy ${premiumState.loading || !premiumState.available ? 'disabled' : ''}><span>${escapeHtml(copy.purchase)}</span><strong>${price}</strong></button>
       <button class="premium-restore" type="button" data-premium-restore ${premiumState.loading ? 'disabled' : ''}>${escapeHtml(copy.restore)}</button>`;

  return `<div class="premium-backdrop" data-premium-close></div>
    <section class="premium-sheet" role="dialog" aria-modal="true" aria-labelledby="premium-title" dir="${dir}" tabindex="-1">
      <div class="premium-grabber" aria-hidden="true"></div>
      <button class="premium-close" type="button" data-premium-close aria-label="${escapeHtml(copy.close)}">×</button>
      <div class="premium-mark" aria-hidden="true"><span>✦</span></div>
      <p class="premium-eyebrow">${escapeHtml(copy.eyebrow)}</p>
      <h2 id="premium-title">${escapeHtml(heading.title)}</h2>
      <p class="premium-subtitle">${escapeHtml(heading.subtitle)}</p>
      <div class="premium-price" ${active ? 'hidden' : ''}><strong>${price}</strong><span>${escapeHtml(copy.once)}</span></div>
      <p class="premium-no-subscription" ${active ? 'hidden' : ''}>${escapeHtml(copy.noSubscription)}</p>
      ${benefits}
      <p class="premium-status" role="status" aria-live="polite">${escapeHtml(message)}</p>
      <div class="premium-actions">${actions}</div>
    </section>`;
}

function dataAttributes(values: Record<string, string | number>) {
  return Object.entries(values).map(([key, value]) => ` data-${key}="${escapeHtml(String(value))}"`).join('');
}

function previewCardMarkup(
  title: string,
  body: string,
  button: string,
  reason: 'plan' | 'places',
  detail: string,
  context: Record<string, string | number>,
) {
  return `<section class="premium-preview-card" aria-label="${escapeHtml(title)}">
    <div class="premium-preview-icon" aria-hidden="true">✦</div>
    <div class="premium-preview-copy"><p class="premium-preview-label">SafarMate Premium</p><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p><p class="premium-preview-detail">${escapeHtml(detail)}</p></div>
    <button type="button" data-premium-preview="${reason}"${dataAttributes(context)}><span>${escapeHtml(button)}</span><strong>${escapeHtml(displayPrice())}</strong></button>
  </section>`;
}

function hydratePreviewCards() {
  if (premiumState.entitled) return;
  const copy = currentCopy();
  document.querySelectorAll<HTMLElement>('[data-premium-plan-preview]').forEach((element) => {
    if (element.dataset.premiumHydrated === 'true') return;
    const days = Number(element.dataset.totalDays || 0);
    const stops = Number(element.dataset.totalStops || 0);
    const visible = Number(element.dataset.visibleStops || 0);
    const body = interpolate(copy.planPreviewBody, { days, stops, visible });
    element.innerHTML = previewCardMarkup(copy.planPreviewTitle, body, copy.unlockPlan, 'plan', copy.noSubscription, { days, stops, visible });
    element.dataset.premiumHydrated = 'true';
  });
  document.querySelectorAll<HTMLElement>('[data-premium-results-preview]').forEach((element) => {
    if (element.dataset.premiumHydrated === 'true') return;
    const kind = (element.dataset.kind || 'landmarks') as PreviewKind;
    const total = Number(element.dataset.total || 0);
    const visible = Number(element.dataset.visible || 0);
    const kindLabel = copy.placeKinds[kind] ?? copy.placeKinds.landmarks;
    const title = interpolate(copy.placesPreviewTitle, { kind: kindLabel });
    const body = interpolate(copy.placesPreviewBody, { total, visible });
    element.innerHTML = previewCardMarkup(copy.placesPreviewTitle.includes('{kind}') ? title : copy.placesPreviewTitle, body, copy.unlockPlaces, 'places', copy.noSubscription, { kind, total, visible });
    element.dataset.premiumHydrated = 'true';
  });
}

function removeElements(root: ParentNode, selector: string) {
  root.querySelectorAll<HTMLElement>(selector).forEach((element) => element.remove());
}

function appendPreviewPlaceholder(host: HTMLElement, attributes: Record<string, string | number>) {
  if (host.querySelector(':scope > [data-premium-plan-preview], :scope > [data-premium-results-preview]')) return;
  const element = document.createElement('div');
  Object.entries(attributes).forEach(([key, value]) => { element.dataset[key] = String(value); });
  host.append(element);
}

function gatePlannerPreview() {
  const results = document.querySelector<HTMLElement>('#planner-results');
  if (!results) return;
  const itineraryDays = Array.from(results.querySelectorAll<HTMLElement>('.itinerary-day'));
  const allCards = Array.from(results.querySelectorAll<HTMLElement>('.itinerary-card'));
  if (!itineraryDays.length || !allCards.length || results.querySelector('[data-premium-plan-preview]')) return;

  const totalDays = itineraryDays.length;
  const totalStops = allCards.length;
  itineraryDays.slice(1).forEach((day) => day.remove());
  const firstDay = itineraryDays[0];
  const firstDayCards = Array.from(firstDay.querySelectorAll<HTMLElement>('.itinerary-card'));
  firstDayCards.slice(FREE_PLAN_PREVIEW_LIMIT).forEach((card) => card.remove());
  firstDay.querySelectorAll<HTMLElement>('[data-replan]').forEach((button) => button.remove());

  removeElements(results, '.travel-details-section, .athan-panel, .map-panel');
  const tripActions = results.querySelector<HTMLElement>('.trip-actions');
  tripActions?.querySelectorAll<HTMLElement>(':scope > *').forEach((element) => {
    if (element.id !== 'edit-plan') element.remove();
  });

  appendPreviewPlaceholder(results, {
    premiumPlanPreview: '',
    totalDays,
    totalStops,
    visibleStops: Math.min(FREE_PLAN_PREVIEW_LIMIT, firstDayCards.length),
  });
  contentWasGated = true;
}

function gateDiscoveryPreview(pageMarker: string, cardSelector: string, kind: PreviewKind) {
  const app = document.querySelector<HTMLElement>(pageMarker)?.closest<HTMLElement>('main');
  if (!app || app.querySelector('[data-premium-results-preview]')) return;
  if (kind === 'landmarks' && app.querySelector('#attractions-map')) {
    app.querySelector<HTMLButtonElement>('[data-attraction-view="photos"]')?.click();
    contentWasGated = true;
    return;
  }

  removeElements(app, '.segmented, .prayer-filters, #prayer-map, #halal-map, #attractions-map, .saved-attractions, .attraction-detail');
  removeElements(app, '#search-this-area, #halal-search-this-area, #halal-recentre, #halal-fit-results, #attractions-search-this-area, #attractions-recentre, #attractions-fit-results');
  ['#prayer-radius', '#halal-radius', '#attraction-radius'].forEach((selector) => app.querySelector(selector)?.closest('label')?.remove());

  const cards = Array.from(app.querySelectorAll<HTMLElement>(cardSelector));
  if (!cards.length) {
    contentWasGated = true;
    return;
  }
  cards.slice(FREE_DISCOVERY_PREVIEW_LIMIT).forEach((card) => card.remove());
  cards.slice(0, FREE_DISCOVERY_PREVIEW_LIMIT).forEach((card) => {
    removeElements(card, '[data-attraction-detail], [data-attraction-save], [data-copy-restaurant]');
  });

  const list = cards[0]?.parentElement;
  if (!(list instanceof HTMLElement)) return;
  const holder = document.createElement('div');
  holder.dataset.premiumResultsPreview = '';
  holder.dataset.kind = kind;
  holder.dataset.total = String(cards.length);
  holder.dataset.visible = String(Math.min(FREE_DISCOVERY_PREVIEW_LIMIT, cards.length));
  list.insertAdjacentElement('afterend', holder);
  contentWasGated = true;
}

function applyContentGating() {
  if (premiumState.entitled) return;
  gatePlannerPreview();
  gateDiscoveryPreview('#back-from-prayer', '.prayer-place-card', 'mosques');
  gateDiscoveryPreview('#back-from-halal', '.restaurant-card', 'halal');
  gateDiscoveryPreview('#back-from-attractions', '.attraction-card', 'landmarks');
  hydratePreviewCards();
}

function rerenderCurrentView() {
  window.setTimeout(() => window.dispatchEvent(new Event('hashchange')), 0);
}

function closePaywall() {
  if (!dialog) return;
  dialog.remove();
  dialog = null;
  paywallContext = {};
  document.documentElement.classList.remove('premium-open');
  document.querySelector('#root')?.removeAttribute('inert');
  lastTrigger?.focus({ preventScroll: true });
}

function resetPaywallScroll() {
  const sheet = dialog?.querySelector<HTMLElement>('.premium-sheet');
  if (!sheet) return;
  sheet.scrollTop = 0;
  window.requestAnimationFrame(() => { sheet.scrollTop = 0; });
}

function contextFromTrigger(trigger?: HTMLElement | null): PaywallContext {
  const button = trigger?.closest<HTMLElement>('[data-premium-preview]') ?? trigger;
  if (!button) return {};
  const kindValue = button.dataset.kind;
  const kind = kindValue === 'mosques' || kindValue === 'halal' || kindValue === 'landmarks' ? kindValue : undefined;
  return {
    days: Number(button.dataset.days || 0) || undefined,
    stops: Number(button.dataset.stops || 0) || undefined,
    visible: Number(button.dataset.visible || 0) || undefined,
    total: Number(button.dataset.total || 0) || undefined,
    kind,
  };
}

function renderPaywall(reason: PaywallReason = '') {
  if (!dialog) return;
  dialog.innerHTML = paywallMarkup(reason);
  bindPaywall(reason);
  resetPaywallScroll();
}

function openPaywall(reason: PaywallReason = '', trigger?: HTMLElement | null) {
  lastTrigger = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  paywallContext = contextFromTrigger(trigger);
  statusMessage = '';
  if (dialog) dialog.remove();
  dialog = document.createElement('div');
  dialog.className = 'premium-layer';
  dialog.innerHTML = paywallMarkup(reason);
  document.body.append(dialog);
  document.documentElement.classList.add('premium-open');
  document.querySelector('#root')?.setAttribute('inert', '');
  bindPaywall(reason);
  resetPaywallScroll();
  dialog.querySelector<HTMLElement>('[data-premium-close]')?.focus({ preventScroll: true });
}

function outcomeMessage(outcome: PurchaseOutcome, restored = false) {
  const copy = currentCopy();
  if (outcome === 'purchased') return restored ? copy.restored : copy.purchased;
  if (outcome === 'pending') return copy.pending;
  if (outcome === 'cancelled') return copy.cancelled;
  return premiumState.error ? `${copy.error} ${premiumState.error}` : copy.unavailable;
}

function bindPaywall(reason: PaywallReason) {
  if (!dialog) return;
  dialog.querySelectorAll<HTMLElement>('[data-premium-close]').forEach((element) => element.addEventListener('click', closePaywall));
  dialog.querySelector<HTMLButtonElement>('[data-premium-buy]')?.addEventListener('click', async () => {
    statusMessage = '';
    renderPaywall(reason);
    const result = await premiumService.purchase();
    premiumState = result.state;
    statusMessage = outcomeMessage(result.outcome);
    renderPaywall(reason);
    ensurePremiumEntry();
  });
  dialog.querySelector<HTMLButtonElement>('[data-premium-restore]')?.addEventListener('click', async () => {
    statusMessage = '';
    renderPaywall(reason);
    const result = await premiumService.restore();
    premiumState = result.state;
    statusMessage = outcomeMessage(result.outcome, true);
    renderPaywall(reason);
    ensurePremiumEntry();
  });
}

function ensurePremiumEntry() {
  const root = document.querySelector<HTMLElement>('#root');
  if (!root) return;
  const copy = currentCopy();
  const existing = root.querySelector<HTMLButtonElement>('[data-premium-entry]');
  const label = premiumState.entitled ? `${copy.premium} ✓` : copy.premium;
  if (existing) {
    existing.innerHTML = `<span aria-hidden="true">✦</span><span>${escapeHtml(label)}</span>`;
    existing.classList.toggle('is-active', premiumState.entitled);
    applyContentGating();
    return;
  }
  const host = root.querySelector<HTMLElement>('.hero') ?? root.querySelector<HTMLElement>('main');
  if (!host) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `premium-entry${premiumState.entitled ? ' is-active' : ''}`;
  button.dataset.premiumEntry = 'true';
  button.innerHTML = `<span aria-hidden="true">✦</span><span>${escapeHtml(label)}</span>`;
  button.addEventListener('click', () => openPaywall('', button));
  host.append(button);
  applyContentGating();
}

function actionableTarget(target: HTMLElement) {
  return target.closest<HTMLElement>('a, button, [role="button"]');
}

function targetRequiresPremium(target: HTMLElement): boolean {
  const actionable = actionableTarget(target);
  if (!actionable || actionable.matches('[data-premium-entry], [data-premium-buy], [data-premium-restore], [data-premium-close]')) return false;
  if (actionable.matches(premiumSelectors)) return true;
  const href = actionable instanceof HTMLAnchorElement ? actionable.getAttribute('href') : null;
  if (href && premiumHashes.has(href)) return true;
  const hash = actionable.dataset.view ? `#${actionable.dataset.view}` : '';
  return premiumHashes.has(hash);
}

function reasonForTarget(target: HTMLElement): PaywallReason {
  const preview = actionableTarget(target)?.dataset.premiumPreview;
  if (preview === 'plan') return 'plan';
  if (preview === 'places') return 'places';
  return 'locked';
}

function publishStateToApp() {
  const signature = `${premiumState.entitled}:${premiumState.grandfathered}:${premiumState.loading}:${premiumState.available}:${premiumState.displayPrice ?? ''}`;
  if (signature === lastPublishedSignature) return;
  lastPublishedSignature = signature;
  window.dispatchEvent(new CustomEvent('safarmate-premium-state', { detail: premiumState }));
}

function bindGlobalGating() {
  document.addEventListener('click', (event) => {
    if (premiumState.entitled || !(event.target instanceof HTMLElement) || !targetRequiresPremium(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const actionable = actionableTarget(event.target);
    openPaywall(reasonForTarget(event.target), actionable);
  }, true);
  window.addEventListener('hashchange', () => {
    if (premiumState.entitled || !premiumHashes.has(window.location.hash)) return;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    openPaywall('locked');
  });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && dialog) closePaywall(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void premiumService.refresh(true); });
}

export async function startPremiumExperience() {
  premiumService.subscribe((state) => {
    const unlockedNow = state.entitled && !premiumState.entitled;
    premiumState = state;
    publishStateToApp();
    if (unlockedNow && contentWasGated) {
      contentWasGated = false;
      rerenderCurrentView();
    } else {
      applyContentGating();
    }
    ensurePremiumEntry();
    if (dialog) renderPaywall();
  });
  bindGlobalGating();
  const root = document.querySelector('#root');
  if (root) new MutationObserver(() => {
    ensurePremiumEntry();
    applyContentGating();
  }).observe(root, { childList: true, subtree: false });
  ensurePremiumEntry();
  applyContentGating();
  await premiumService.refresh();
}

void startPremiumExperience();
