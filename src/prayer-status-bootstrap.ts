export {};

const idleStatuses = '.prayer-status.idle, .prayer-status.ready';
const toolPanels = '.prayer-app, .halal-app';

function collapseEmptyToolStatuses() {
  document.querySelectorAll<HTMLElement>(`${toolPanels} ${idleStatuses}`).forEach((status) => {
    const message = status.textContent?.trim() ?? '';
    if (message && status.closest('.prayer-app:not(.halal-app)')) {
      status.textContent = '';
    }

    const isEmpty = !(status.textContent?.trim());
    status.hidden = isEmpty;
    status.setAttribute('aria-hidden', String(isEmpty));
  });
}

const root = document.querySelector<HTMLElement>('#root');
if (root) new MutationObserver(collapseEmptyToolStatuses).observe(root, { childList: true, subtree: true });
window.queueMicrotask(collapseEmptyToolStatuses);
