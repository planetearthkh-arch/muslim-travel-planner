export {};

const toolStatusSelector = [
  '.prayer-app .prayer-status.idle',
  '.prayer-app .prayer-status.ready',
  '.halal-app .prayer-status.idle',
  '.halal-app .prayer-status.ready',
].join(', ');

function collapseEmptyToolStatuses() {
  document.querySelectorAll<HTMLElement>(toolStatusSelector).forEach((status) => {
    if (!status.classList.contains('prayer-status')) return;

    const isEmpty = !(status.textContent?.trim());
    status.hidden = isEmpty;
    status.setAttribute('aria-hidden', String(isEmpty));
  });
}

const root = document.querySelector<HTMLElement>('#root');
if (root) new MutationObserver(collapseEmptyToolStatuses).observe(root, { childList: true, subtree: true });
window.queueMicrotask(collapseEmptyToolStatuses);
