import { Browser } from '@capacitor/browser';
import { isNativePlatform, appBasePath } from './platform.js';
import { safeExternalUrl } from './urls.js';

export function staticLegalPageUrl(page: 'privacy' | 'support', language: string) {
  return isNativePlatform()
    ? `${page}.html?lang=${encodeURIComponent(language)}`
    : `${appBasePath()}${page}.html?lang=${encodeURIComponent(language)}`;
}

export async function openSafeExternalUrl(value: string) {
  const url = safeExternalUrl(value);
  if (!url) return false;
  if (isNativePlatform()) {
    await Browser.open({ url, presentationStyle: 'popover' });
    return true;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function bindNativeExternalLinks(root: ParentNode = document) {
  if (!isNativePlatform()) return;
  root.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      const href = anchor.getAttribute('href') ?? '';
      if (/^https?:\/\//i.test(href)) {
        event.preventDefault();
        void openSafeExternalUrl(href);
        return;
      }
      if (/^(?:privacy|support)\.html(?:\?|$)/i.test(href)) {
        event.preventDefault();
        window.location.assign(href);
      }
    });
  });
}

