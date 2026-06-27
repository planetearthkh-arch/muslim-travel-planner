import { cities } from './data.js';
import { generateItinerary } from './planner.js';
import {
  labels,
  languageDirection,
  languages,
  optionLabels,
  prayerLabels,
  regionLabels,
  statusLabels,
  type Language,
} from './i18n.js';
import type { PlannerPreferences, Region, VerificationStatus } from './models.js';

let lang: Language = 'en';
let replan = 0;
let selectedRegion: Region | '' = '';
let prefs: PlannerPreferences = {
  city: 'London',
  startDate: '2026-07-01',
  endDate: '2026-07-01',
  startHour: '09:00',
  endHour: '18:00',
  interests: ['history', 'culture', 'family'],
  groupSize: 4,
  children: true,
  walkingAbility: 'medium',
  transportation: 'public transport',
  budget: 'mid',
  prayerMethod: 'Muslim World League',
  prayerPreference: 'mosque',
  womenPrayerRequired: true,
  wuduRequired: true,
  accessibilityNeeds: '',
  halalPreference: 'strictly labelled',
};

const root = document.querySelector<HTMLDivElement>('#root');
const regionOptions: Region[] = ['Europe', 'Middle East', 'Asia', 'North America', 'Africa', 'Oceania'];
const prayerMethods = ['Muslim World League', 'Egyptian General Authority', 'Umm al-Qura', 'ISNA', 'Turkey Diyanet'] as const;

const esc = (value: string) => value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

const statusBadge = (status: VerificationStatus) => `<span class="badge ${status.toLowerCase()}">${statusLabels[lang][status]}</span>`;

function field(name: keyof PlannerPreferences, value: string, label: string, type = 'text', placeholder = '') {
  return `<label>${label}<input data-field="${String(name)}" type="${type}" value="${esc(value)}" ${placeholder ? `placeholder="${esc(placeholder)}"` : ''} /></label>`;
}

function choiceSelect<T extends string>(name: keyof PlannerPreferences, label: string, options: readonly T[], display: Record<T, string>) {
  const currentValue = String(prefs[name]);
  return `<label>${label}<select data-field="${String(name)}">${options.map((option) => `<option value="${esc(option)}" ${currentValue === option ? 'selected' : ''}>${display[option]}</option>`).join('')}</select></label>`;
}

function languageSelector() {
  return `<label class="lang">${labels[lang].language}<select id="lang">${languages.map((language) => `<option value="${language.code}" ${language.code === lang ? 'selected' : ''}>${language.label}</option>`).join('')}</select></label>`;
}

function render() {
  if (!root) return;
  const copy = labels[lang];
  const dir = languageDirection(lang);
  const visibleCities = selectedRegion ? cities.filter((candidate) => candidate.region === selectedRegion) : cities;
  if (!visibleCities.some((candidate) => candidate.city.toLowerCase() === prefs.city.toLowerCase())) {
    prefs = { ...prefs, city: visibleCities[0]?.city ?? cities[0].city };
  }
  const city = cities.find((candidate) => candidate.city.toLowerCase() === prefs.city.toLowerCase()) ?? cities[0];
  const items = generateItinerary(prefs, replan, lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  root.innerHTML = `
    <main dir="${dir}" class="app">
      <section class="hero">
        ${languageSelector()}
        <p class="eyebrow">${copy.prototype}</p>
        <h1>${copy.title}</h1>
        <p>${copy.subtitle}</p>
        <p class="notice">${copy.sample}</p>
      </section>
      <section class="panel form" aria-label="${copy.formAria}">
        <div class="grid">
          <label>${copy.region}<select data-region="filter"><option value="">${copy.allRegions}</option>${regionOptions.map((region) => `<option value="${region}" ${selectedRegion === region ? 'selected' : ''}>${regionLabels[lang][region]}</option>`).join('')}</select></label>
          <label>${copy.city}<select data-field="city">${visibleCities.map((candidate) => `<option value="${candidate.city}" ${candidate.city === city.city ? 'selected' : ''}>${candidate.city}, ${candidate.country}</option>`).join('')}</select></label>
        </div>
        <label class="compact">${copy.cityAutocomplete}<input data-field="city" list="cities" value="${esc(prefs.city)}" placeholder="${copy.cityPlaceholder}" /></label>
        <datalist id="cities">${visibleCities.map((candidate) => `<option value="${candidate.city}">${candidate.country}</option>`).join('')}</datalist>
        <div class="grid">${field('startDate', prefs.startDate, copy.startDate, 'date')}${field('endDate', prefs.endDate, copy.endDate, 'date')}</div>
        <div class="grid">${field('startHour', prefs.startHour, copy.startHour, 'time')}${field('endHour', prefs.endHour, copy.endHour, 'time')}</div>
        <div class="grid">${field('groupSize', String(prefs.groupSize), copy.groupSize, 'number')}${choiceSelect('budget', copy.budget, ['low', 'mid', 'high'], optionLabels.budget[lang])}</div>
        ${field('interests', prefs.interests.join(', '), copy.interests)}
        <div class="grid">${choiceSelect('walkingAbility', copy.walkingAbility, ['low', 'medium', 'high'], optionLabels.walkingAbility[lang])}${choiceSelect('transportation', copy.transportation, ['walking', 'public transport', 'taxi'], optionLabels.transportation[lang])}</div>
        ${choiceSelect('prayerMethod', copy.prayerMethod, prayerMethods, Object.fromEntries(prayerMethods.map((method) => [method, method])) as Record<(typeof prayerMethods)[number], string>)}
        ${choiceSelect('prayerPreference', copy.prayerPreference, ['mosque', 'quiet prayer space', 'flexible'], optionLabels.prayerPreference[lang])}
        <div class="checks"><label><input data-field="children" type="checkbox" ${prefs.children ? 'checked' : ''}/> ${copy.children}</label><label><input data-field="womenPrayerRequired" type="checkbox" ${prefs.womenPrayerRequired ? 'checked' : ''}/> ${copy.womenPrayerRequired}</label><label><input data-field="wuduRequired" type="checkbox" ${prefs.wuduRequired ? 'checked' : ''}/> ${copy.wuduRequired}</label></div>
        ${field('accessibilityNeeds', prefs.accessibilityNeeds, copy.accessibilityNeeds)}
        ${choiceSelect('halalPreference', copy.halalPreference, ['strictly labelled', 'vegetarian/seafood options', 'flexible'], optionLabels.halalPreference[lang])}
        <button id="plan">${copy.plan}</button>
      </section>
      <section class="panel results" aria-live="polite">
        <div class="result-header"><div><h2>${city.city}, ${city.country}</h2><p>${regionLabels[lang][city.region]} · ${city.timezone}</p><p>${copy.prayerWindowsAre} <strong>${statusLabels[lang].Sample}</strong>: ${Object.entries(city.prayerWindows).map(([name, window]) => `${prayerLabels[lang][name as keyof typeof city.prayerWindows]} ${window}`).join(' · ')}</p><p>${copy.transportEstimatesAre} <strong>${statusLabels[lang].Sample}</strong>: ${copy.walking} ${city.transportEstimates.walking} ${copy.minutesShort} · ${copy.publicTransport} ${city.transportEstimates.publicTransport} ${copy.minutesShort} · ${copy.taxi} ${city.transportEstimates.taxi} ${copy.minutesShort}.</p></div><div class="legend"><strong>${copy.legend}</strong>${statusBadge('Sample')}${statusBadge('Unverified')}${statusBadge('Verified')}</div></div>
        ${items.length ? items.map((item, index) => `<article class="card ${item.kind}"><div class="card-top"><span>${item.time} · ${item.durationMinutes} ${copy.minutesShort}</span>${statusBadge(item.status)}</div><h3>${item.title}</h3><p>${item.details}</p>${item.place?.evidence ? `<p class="evidence">${copy.evidenceNote}: ${item.place.evidence}</p>` : ''}${item.place?.facility ? `<p>${copy.women}: ${statusBadge(item.place.facility.womenPrayerSpace)} ${copy.wudu}: ${statusBadge(item.place.facility.wudu)} ${copy.accessibility}: ${statusBadge(item.place.facility.accessibility)}</p>` : ''}<button class="ghost" data-replan="${index + 1}">${copy.replan}</button></article>`).join('') : `<p>${visibleCities.length ? copy.emptyState : copy.noCities}</p>`}
      </section>
    </main>`;
  bind();
}

function bind() {
  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => {
    lang = (event.target as HTMLSelectElement).value as Language;
    render();
  });
  document.querySelector('#plan')?.addEventListener('click', () => {
    replan = 0;
    render();
  });
  document.querySelector<HTMLSelectElement>('[data-region="filter"]')?.addEventListener('change', (event) => {
    const filter = event.target as HTMLSelectElement;
    selectedRegion = filter.value as Region | '';
    replan = 0;
    render();
  });
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]').forEach((element) => element.addEventListener('change', () => {
    const key = element.dataset.field as keyof PlannerPreferences;
    const value = element instanceof HTMLInputElement && element.type === 'checkbox' ? element.checked : element.value;
    prefs = { ...prefs, [key]: key === 'groupSize' ? Number(value) : key === 'interests' ? String(value).split(',').map((interest) => interest.trim()).filter(Boolean) : value } as PlannerPreferences;
    if (key === 'city') {
      replan = 0;
      render();
    }
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-replan]').forEach((button) => button.addEventListener('click', () => {
    replan = Number(button.dataset.replan);
    render();
  }));
}

render();
