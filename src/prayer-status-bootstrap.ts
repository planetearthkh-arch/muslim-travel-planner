export {};

function clearDuplicatePrayerStatus() {
  const page = document.querySelector<HTMLElement>('.prayer-app:not(.halal-app)');
  const status = page?.querySelector<HTMLElement>('.prayer-status.idle, .prayer-status.ready');
  if (status && status.textContent?.trim()) status.textContent = '';
}

const root = document.querySelector<HTMLElement>('#root');
if (root) new MutationObserver(clearDuplicatePrayerStatus).observe(root, { childList: true, subtree: true });
window.queueMicrotask(clearDuplicatePrayerStatus);
