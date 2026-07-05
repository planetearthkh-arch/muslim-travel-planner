export {};

const qiblaEnhancementLabels = {
  en: { liveCompass: 'Start Live Compass', fixedBearing: 'Fixed bearing' },
  fr: { liveCompass: 'Démarrer la boussole en direct', fixedBearing: 'Direction fixe' },
  ar: { liveCompass: 'ابدأ البوصلة المباشرة', fixedBearing: 'اتجاه ثابت' },
  ur: { liveCompass: 'براہِ راست قطب نما شروع کریں', fixedBearing: 'مقررہ سمت' },
  id: { liveCompass: 'Mulai Kompas Langsung', fixedBearing: 'Arah tetap' },
  ms: { liveCompass: 'Mulakan Kompas Langsung', fixedBearing: 'Arah tetap' },
  tr: { liveCompass: 'Canlı pusulayı başlat', fixedBearing: 'Sabit yön' },
} as const;

type SupportedLanguage = keyof typeof qiblaEnhancementLabels;
let compassRequested = false;

function currentLanguage(): SupportedLanguage {
  const language = document.documentElement.lang as SupportedLanguage;
  return language in qiblaEnhancementLabels ? language : 'en';
}

function updateQiblaEnhancements() {
  const button = document.querySelector<HTMLButtonElement>('#request-motion');
  if (!button) return;
  const copy = qiblaEnhancementLabels[currentLanguage()];
  if (button.textContent !== copy.liveCompass) button.textContent = copy.liveCompass;
  button.setAttribute('aria-label', copy.liveCompass);

  // Before the user requests sensor access, the valid state is a fixed Qibla bearing,
  // not a compass-unavailable error. Do not replace location loading or error states.
  if (!compassRequested && !button.disabled) {
    const status = document.querySelector<HTMLElement>('#qibla-status');
    const readout = document.querySelector<HTMLElement>('#qibla-motion-readout');
    if (status) status.textContent = copy.fixedBearing;
    if (readout) readout.textContent = copy.fixedBearing;
  }
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest('#request-motion')) compassRequested = true;
  if (target.closest('#request-location')) compassRequested = false;
});

window.addEventListener('hashchange', () => {
  if (window.location.hash === '#qibla') compassRequested = false;
  window.queueMicrotask(updateQiblaEnhancements);
});

const root = document.querySelector<HTMLElement>('#root');
if (root) new MutationObserver(updateQiblaEnhancements).observe(root, { childList: true });
window.queueMicrotask(updateQiblaEnhancements);
