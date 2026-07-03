type PickerCopy = {
  search: string;
  close: string;
  noResults: string;
};

const STYLE_ID = 'money-currency-picker-styles';
const pickerCopy: Record<string, PickerCopy> = {
  en: { search: 'Search currencies', close: 'Close', noResults: 'No currencies found' },
  ar: { search: 'ابحث عن عملة', close: 'إغلاق', noResults: 'لم يتم العثور على عملات' },
  id: { search: 'Cari mata uang', close: 'Tutup', noResults: 'Mata uang tidak ditemukan' },
  ms: { search: 'Cari mata wang', close: 'Tutup', noResults: 'Tiada mata wang ditemui' },
  tr: { search: 'Para birimi ara', close: 'Kapat', noResults: 'Para birimi bulunamadı' },
};

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    body.currency-picker-open {
      overflow: hidden;
    }

    .money-app .currency-picker-trigger {
      width: 100%;
      min-height: 48px;
      text-align: start;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .currency-picker-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: end center;
      padding: 16px;
      background: rgba(15, 23, 42, 0.58);
    }

    .currency-picker {
      box-sizing: border-box;
      width: min(100%, 560px);
      max-height: min(82vh, 680px);
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr) auto;
      gap: 12px;
      padding: 18px;
      border-radius: 22px 22px 14px 14px;
      background: #ffffff;
      color: #0f172a;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.3);
    }

    .currency-picker-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-width: 0;
    }

    .currency-picker-header h2 {
      margin: 0;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .currency-picker-close {
      width: 44px;
      min-width: 44px;
      height: 44px;
      padding: 0;
      font-size: 1.6rem;
      line-height: 1;
    }

    .currency-picker-search-label {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .currency-picker-search {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
    }

    .currency-picker-list {
      min-height: 0;
      max-height: min(55vh, 430px);
      overflow-y: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      display: grid;
      gap: 8px;
      padding-inline-end: 2px;
    }

    .currency-picker-option {
      width: 100%;
      min-width: 0;
      min-height: 48px;
      text-align: start;
      white-space: normal;
      overflow-wrap: anywhere;
      background: #f8fafc;
      color: #0f172a;
      border: 1px solid #cbd5e1;
    }

    .currency-picker-option.selected {
      border-color: #0f766e;
      background: #ccfbf1;
      color: #134e4a;
      font-weight: 700;
    }

    .currency-picker-empty {
      margin: 0;
      text-align: center;
    }

    @media (min-width: 700px) {
      .currency-picker-backdrop {
        place-items: center;
      }

      .currency-picker {
        border-radius: 22px;
      }

      .currency-picker-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `;
  document.head.append(style);
}

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
  document.body.classList.remove('currency-picker-open');
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
    const locale = document.documentElement.lang || 'en';
    const normalized = query.trim().toLocaleLowerCase(locale);
    const options = uniqueOptions(select).filter((option) => {
      const haystack = `${option.value} ${option.textContent ?? ''}`.toLocaleLowerCase(locale);
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
  document.body.classList.add('currency-picker-open');
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
  const searchInput = moneyApp.querySelector<HTMLInputElement>('#currency-search');
  if (searchInput?.value) {
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const searchLabel = searchInput?.closest('label');
  if (searchLabel) searchLabel.hidden = true;
  moneyApp.querySelectorAll<HTMLSelectElement>('#from-currency, #to-currency').forEach(enhanceCurrencySelect);
}

if (typeof document !== 'undefined') {
  installStyles();
  const root = document.querySelector('#root');
  enhanceMoneyPage();
  if (root) new MutationObserver(enhanceMoneyPage).observe(root, { childList: true });
}
