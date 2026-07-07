export {};

let compassRequested = false;

function updateQiblaFixedBearingStatus() {
  const motionButton = document.querySelector<HTMLButtonElement>('#request-motion');
  if (!motionButton || motionButton.disabled || compassRequested) return;

  const status = document.querySelector<HTMLElement>('#qibla-status');
  const readout = document.querySelector<HTMLElement>('#qibla-motion-readout');
  const fixedBearingText = readout?.textContent?.trim();
  if (!status || !fixedBearingText) return;

  status.textContent = fixedBearingText;
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest('#request-motion')) compassRequested = true;
});

window.addEventListener('hashchange', () => {
  if (window.location.hash === '#qibla') compassRequested = false;
  window.queueMicrotask(updateQiblaFixedBearingStatus);
});

const root = document.querySelector<HTMLElement>('#root');
if (root) new MutationObserver(updateQiblaFixedBearingStatus).observe(root, { childList: true });
window.queueMicrotask(updateQiblaFixedBearingStatus);
