import { cities } from './data.js';
import { generateItinerary } from './planner.js';
import type { PlannerPreferences, VerificationStatus } from './models.js';

const labels = {
  en: {
    title: 'Muslim Travel Planner',
    subtitle: 'Sample worldwide, prayer-aware itineraries — no precise location collected.',
    city: 'City',
    plan: 'Generate itinerary',
    replan: 'Replan From Here',
    sample: 'Sample data only. Verify prayer times, mosque facilities, opening hours, and halal claims before travel.',
    legend: 'Information labels',
  },
  ar: {
    title: 'مخطط سفر للمسلمين',
    subtitle: 'مسارات سفر تجريبية تراعي الصلاة — لا نجمع الموقع الدقيق.',
    city: 'المدينة',
    plan: 'إنشاء الخطة',
    replan: 'إعادة التخطيط من هنا',
    sample: 'بيانات تجريبية فقط. تحقق من أوقات الصلاة والمرافق وساعات العمل ومعلومات الحلال قبل السفر.',
    legend: 'تصنيفات المعلومات',
  },
};

let lang: 'en' | 'ar' = 'en';
let replan = 0;
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
const esc = (value: string) => value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
const statusBadge = (status: VerificationStatus) => `<span class="badge ${status.toLowerCase()}">${status}</span>`;

function field(name: keyof PlannerPreferences, value: string, label: string, type = 'text') {
  return `<label>${label}<input data-field="${String(name)}" type="${type}" value="${esc(value)}" /></label>`;
}

function select(name: keyof PlannerPreferences, label: string, options: string[]) {
  return `<label>${label}<select data-field="${String(name)}">${options.map((option) => `<option ${prefs[name] === option ? 'selected' : ''}>${option}</option>`).join('')}</select></label>`;
}

function render() {
  if (!root) return;
  const copy = labels[lang];
  const city = cities.find((candidate) => candidate.city.toLowerCase() === prefs.city.toLowerCase()) ?? cities[0];
  const items = generateItinerary(prefs, replan);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  root.innerHTML = `
    <main dir="${document.documentElement.dir}" class="app">
      <section class="hero">
        <button id="lang" class="lang">${lang === 'en' ? 'العربية' : 'English'}</button>
        <p class="eyebrow">Prototype v1 · privacy-first · no paid APIs</p>
        <h1>${copy.title}</h1>
        <p>${copy.subtitle}</p>
        <p class="notice">${copy.sample}</p>
      </section>
      <section class="panel form" aria-label="Planner preferences">
        <label>${copy.city}<input data-field="city" list="cities" value="${esc(prefs.city)}" placeholder="Any city" /></label>
        <datalist id="cities">${cities.map((candidate) => `<option value="${candidate.city}">${candidate.country}</option>`).join('')}</datalist>
        <div class="grid">${field('startDate', prefs.startDate, 'Start date', 'date')}${field('endDate', prefs.endDate, 'End date', 'date')}</div>
        <div class="grid">${field('startHour', prefs.startHour, 'Available from', 'time')}${field('endHour', prefs.endHour, 'Until', 'time')}</div>
        <div class="grid">${field('groupSize', String(prefs.groupSize), 'Group size', 'number')}${select('budget', 'Budget', ['low', 'mid', 'high'])}</div>
        ${field('interests', prefs.interests.join(', '), 'Interests')}
        <div class="grid">${select('walkingAbility', 'Walking ability', ['low', 'medium', 'high'])}${select('transportation', 'Transportation', ['walking', 'public transport', 'taxi'])}</div>
        ${select('prayerMethod', 'Prayer calculation method', ['Muslim World League', 'Egyptian General Authority', 'Umm al-Qura', 'ISNA', 'Turkey Diyanet'])}
        ${select('prayerPreference', 'Prayer preference', ['mosque', 'quiet prayer space', 'flexible'])}
        <div class="checks"><label><input data-field="children" type="checkbox" ${prefs.children ? 'checked' : ''}/> Children</label><label><input data-field="womenPrayerRequired" type="checkbox" ${prefs.womenPrayerRequired ? 'checked' : ''}/> Women’s prayer space required</label><label><input data-field="wuduRequired" type="checkbox" ${prefs.wuduRequired ? 'checked' : ''}/> Wudu required</label></div>
        ${field('accessibilityNeeds', prefs.accessibilityNeeds, 'Accessibility needs')}
        ${select('halalPreference', 'Halal-food preference', ['strictly labelled', 'vegetarian/seafood options', 'flexible'])}
        <button id="plan">${copy.plan}</button>
      </section>
      <section class="panel results" aria-live="polite">
        <div class="result-header"><div><h2>${city.city}, ${city.country}</h2><p>Prayer windows are <strong>Sample</strong>: ${Object.entries(city.prayerWindows).map(([name, window]) => `${name} ${window}`).join(' · ')}</p></div><div class="legend"><strong>${copy.legend}</strong>${statusBadge('Sample')}${statusBadge('Unverified')}${statusBadge('Verified')}</div></div>
        ${items.map((item, index) => `<article class="card ${item.kind}"><div class="card-top"><span>${item.time} · ${item.durationMinutes} min</span>${statusBadge(item.status)}</div><h3>${item.title}</h3><p>${item.details}</p>${item.place?.evidence ? `<p class="evidence">Evidence note: ${item.place.evidence}</p>` : ''}${item.place?.facility ? `<p>Women: ${statusBadge(item.place.facility.womenPrayerSpace)} Wudu: ${statusBadge(item.place.facility.wudu)} Accessibility: ${statusBadge(item.place.facility.accessibility)}</p>` : ''}<button class="ghost" data-replan="${index + 1}">${copy.replan}</button></article>`).join('')}
      </section>
    </main>`;
  bind();
}

function bind() {
  document.querySelector('#lang')?.addEventListener('click', () => {
    lang = lang === 'en' ? 'ar' : 'en';
    render();
  });
  document.querySelector('#plan')?.addEventListener('click', () => {
    replan = 0;
    render();
  });
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]').forEach((element) => element.addEventListener('change', () => {
    const key = element.dataset.field as keyof PlannerPreferences;
    const value = element instanceof HTMLInputElement && element.type === 'checkbox' ? element.checked : element.value;
    prefs = { ...prefs, [key]: key === 'groupSize' ? Number(value) : key === 'interests' ? String(value).split(',').map((interest) => interest.trim()).filter(Boolean) : value } as PlannerPreferences;
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-replan]').forEach((button) => button.addEventListener('click', () => {
    replan = Number(button.dataset.replan);
    render();
  }));
}

render();
