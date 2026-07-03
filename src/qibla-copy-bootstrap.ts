const liveCompassLabels = {
  en: 'Start Live Compass',
  ar: 'ابدأ البوصلة المباشرة',
  id: 'Mulai Kompas Langsung',
  ms: 'Mulakan Kompas Langsung',
} as const;

type SupportedLanguage = keyof typeof liveCompassLabels;

function currentLanguage(): SupportedLanguage {
  const language = document.documentElement.lang as SupportedLanguage;
  return language in liveCompassLabels ? language : 'en';
}

function updateLiveCompassButton() {
  const button = document.querySelector<HTMLButtonElement>('#request-motion');
  if (!button) return;
  const label = liveCompassLabels[currentLanguage()];
  if (button.textContent !== label) button.textContent = label;
  button.setAttribute('aria-label', label);
}

new MutationObserver(updateLiveCompassButton).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['lang'],
  childList: true,
  subtree: true,
});

window.queueMicrotask(updateLiveCompassButton);
