import { isNativeWeatherPlatform } from './native-weather.js';

const weatherSafetyNotice = 'YOUR USE OF THIS REAL TIME WEATHER GUIDANCE APPLICATION OR WEBSITE IS AT YOUR SOLE RISK. WEATHER DATA MAY NOT BE ACCURATE.';

function ensureWeatherKitNotice() {
  if (!isNativeWeatherPlatform()) return;
  const host = document.querySelector<HTMLElement>('.weather-app .map-status[data-provider="apple-weather"]');
  if (!host || host.dataset.safetyNotice === 'complete') return;
  const existingText = host.textContent ?? '';
  if (existingText.includes('Weather data may not be accurate.')) {
    for (const node of [...host.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.includes('Weather data may not be accurate.')) node.remove();
    }
  }
  host.append(document.createTextNode(` · ${weatherSafetyNotice}`));
  host.dataset.safetyNotice = 'complete';
}

export function installWeatherKitNotice() {
  if (!isNativeWeatherPlatform()) return;
  ensureWeatherKitNotice();
  new MutationObserver(ensureWeatherKitNotice).observe(document.documentElement, { childList: true, subtree: true });
}
