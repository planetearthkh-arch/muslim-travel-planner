import { isNativePlatform } from './platform.js';

export type ConnectionState = 'online' | 'offline';

export function serviceWorkerUrl(base = import.meta.env.BASE_URL) {
  return `${base.replace(/\/?$/, '/')}sw.js`;
}

export function registerAppServiceWorker() {
  if (isNativePlatform()) return Promise.resolve(false);
  if (!('serviceWorker' in navigator)) return Promise.resolve(false);
  return navigator.serviceWorker.register(serviceWorkerUrl()).then(() => true).catch((error) => {
    console.warn('Service worker registration failed', error);
    return false;
  });
}

export function currentConnectionState(): ConnectionState {
  return navigator.onLine === false ? 'offline' : 'online';
}
