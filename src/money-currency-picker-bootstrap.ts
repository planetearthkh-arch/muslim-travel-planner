type PickerCopy = {
  search: string;
  close: string;
  noResults: string;
};

const pickerCopy: Record<string, PickerCopy> = {
  en: { search: 'Search currencies', close: 'Close', noResults: 'No currencies found' },
  ar: { search: 'ابحث عن عملة', close: 'إغلاق', noResults: 'لم يتم العثور على عملات' },
  id: { search: 'Cari mata uang', close: 'Tutup', noResults: 'Mata uang tidak ditemukan' },
  ms: { search: 'Cari mata wang', close: 'Tutup', noResults: 'Tiada mata wang ditemui' },
  tr: { search: 'Para birimi ara', close: 'Kapat', noResults: 'Para birimi bulunamadı' },
};

function currentCopy() {
  return pickerCopy[document.documentElement.lang] ?? pickerCopy.en;
}

function optionLabel(select: HTMLSelectElement) {
  const selected = select.selectedOptions[0];
  return selected?.textContent?.trim() || select.value;
}

function uniqueOptions(select: HTMLSelectElement) {
  const seen = new Set<string>();
  return Array.from(select.options).filter((option) => {
    if (!option.value || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function closePicker(backdrop: HTMLElement, trigger: HTMLButtonElement) {
  backdrop.remove();
  trigger.focus();
}

function openPicker(select: HTMLSelectElement, trigger: HTMLButtonElement, title: string) {
  document.querySelector('.currency-picker-backdrop')?.remove();
  const copy = currentCopy();
  const backdrop = document.createElement('div');
  backdrop.className = 'currency-picker-backdrop';
  backdrop.innerHTML = `
    <section class="currency-picker" role="dialog" aria-modal="true" aria-labelledby="currency-picker-title">
      <div class="currency-picker-header">
        <h2 id="currency-picker-title"></h2>
        <button type="button" class="ghost currency-picker-close" aria-label="${copy.close}">×</button>
      </div>
      <label class="currency-picker-search-label">
        <span>${copy.search}</span>
        <input class="currency-picker-search" type="search" autocomplete="off" inputmode="search" placeholder="${copy.search}" />
      </label>
      <div class="currency-picker-list" role="listbox" aria-label="${title}"></div>
      <p class="currency-picker-empty" hidden>${copy.noResults}</p>
    </section>`;

  const heading = backdrop.querySelector<HTMLElement>('#currency-picker-title');
  const search = backdrop.querySelector<HTMLInputElement>('.currency-picker-search');
  const list = backdrop.querySelector<HTMLElement>('.currency-picker-list');
  const empty = backdrop.querySelector<HTMLElement>('.currency-picker-empty');
  if (!heading || !search || !list || !empty) return;
  heading.textContent = title;

  const renderOptions = (query = '') => {
    const normalized = query.trim().toLocaleLowerCase(document.documentElement.lang || 'en');
    const options = uniqueOptions(select).filter((option) => {
      const haystack = `${option.value} ${option.textContent ?? ''}`.toLocaleLowerCase(document.documentElement.lang || 'en');
      return !normalized || haystack.includes(normalized);
    });
    list.replaceChildren();
    for (const option of options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `currency-picker-option${option.value === select.value ? ' selected' : ''}`;
      button.dataset.currencyCode = option.value;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', option.value === select.value ? 'true' : 'false');
      button.textContent = option.textContent?.trim() || option.value;
      button.addEventListener('click', () => {
        select.value = option.value;
        trigger.textContent = option.textContent?.trim() || option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        closePicker(backdrop, trigger);
      });
      list.append(button);
    }
    empty.hidden = options.length > 0;
  };

  search.addEventListener('input', () => renderOptions(search.value));
  backdrop.querySelector<HTMLButtonElement>('.currency-picker-close')?.addEventListener('click', () => closePicker(backdrop, trigger));
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closePicker(backdrop, trigger);
  });
  backdrop.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePicker(backdrop, trigger);
  });

  document.body.append(backdrop);
  renderOptions();
  search.focus();
}

function enhanceCurrencySelect(select: HTMLSelectElement) {
  if (select.dataset.currencyPickerEnhanced === 'true') return;
  select.dataset.currencyPickerEnhanced = 'true';
  const label = select.closest('label');
  const title = label?.childNodes[0]?.textContent?.trim() || select.getAttribute('aria-label') || currentCopy().search;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'currency-picker-trigger';
  button.textContent = optionLabel(select);
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-label', title);
  select.hidden = true;
  select.insertAdjacentElement('afterend', button);
  button.addEventListener('click', () => openPicker(select, button, title));
}

function enhanceMoneyPage() {
  const moneyApp = document.querySelector<HTMLElement>('.money-app');
  if (!moneyApp) return;
  const searchLabel = moneyApp.querySelector<HTMLInputElement>('#currency-search')?.closest('label');
  if (searchLabel) searchLabel.hidden = true;
  moneyApp.querySelectorAll<HTMLSelectElement>('#from-currency, #to-currency').forEach(enhanceCurrencySelect);
}

if (typeof document !== 'undefined') {
  const root = document.querySelector('#root');
  enhanceMoneyPage();
  if (root) new MutationObserver(enhanceMoneyPage).observe(root, { childList: true });
}
