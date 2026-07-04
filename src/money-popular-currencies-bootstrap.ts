export {};

function removeOuterCurrencyList() {
  const moneyApp = document.querySelector<HTMLElement>('.money-app');
  if (!moneyApp) return;

  const popularCurrencies = moneyApp.querySelector<HTMLElement>('.chips');
  if (popularCurrencies?.querySelector('[data-quick]')) popularCurrencies.remove();

  const oldSearch = moneyApp.querySelector<HTMLInputElement>('#currency-search');
  oldSearch?.closest('label')?.remove();
}

if (typeof document !== 'undefined') {
  const root = document.querySelector('#root');
  removeOuterCurrencyList();
  if (root) new MutationObserver(removeOuterCurrencyList).observe(root, { childList: true });
}
