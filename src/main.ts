import { cities } from './data.js';
import { generateItinerary } from './planner.js';
import { calculateQiblaBearing, formatCoordinate, normalizeDegrees } from './qibla.js';
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
import { athanLabels } from './athan-i18n.js';
import {
  calculatePrayerAlarms,
  calculatePrayerDisplay,
  disableAthanAlarms,
  enableAthanAlarms,
  isNativeAthanAvailable,
  playTestAthan,
  stopAthan,
} from './athan.js';
import type { PlannerPreferences, PrayerName, Region, VerificationStatus } from './models.js';

let lang: Language = 'en';
type View = 'planner' | 'qibla';
type QiblaLocation = { latitude: number; longitude: number; accuracy?: number };
type QiblaLocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable';
type QiblaMotionStatus = 'idle' | 'active' | 'denied' | 'unavailable';
type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };
type CompassOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

let view: View = window.location.hash === '#qibla' ? 'qibla' : 'planner';
let qiblaLocationStatus: QiblaLocationStatus = 'idle';
let qiblaMotionStatus: QiblaMotionStatus = 'idle';
let qiblaLocation: QiblaLocation | undefined;
let qiblaHeading: number | undefined;
let replan = 0;
let selectedRegion: Region | '' = '';
let athanEnabled = localStorage.getItem('athanEnabled') === 'true';
let athanStatus = '';
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
const prayerOrder: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const localeForLanguage = (language: Language) => language === 'ar' ? 'ar' : language === 'id' ? 'id-ID' : 'en-US';

type MapLibreStyleLayer = { id: string; type?: string };
type MapLibreMap = {
  remove: () => void;
  on: (event: string, handler: () => void) => MapLibreMap;
  getStyle: () => { layers?: MapLibreStyleLayer[] };
  getLayoutProperty: (layerId: string, property: string) => unknown;
  setLayoutProperty: (layerId: string, property: string, value: unknown) => void;
  addControl: (control: unknown, position?: string) => MapLibreMap;
  resize: () => void;
};
type MapLibrePopup = { setText: (text: string) => MapLibrePopup };
type MapLibreMarker = {
  setLngLat: (center: [number, number]) => MapLibreMarker;
  setPopup: (popup: MapLibrePopup) => MapLibreMarker;
  addTo: (map: MapLibreMap) => MapLibreMarker;
};
type MapLibreGlobal = {
  Map: new (options: {
    container: HTMLElement;
    style: string;
    center: [number, number];
    zoom: number;
    attributionControl?: boolean;
  }) => MapLibreMap;
  Popup: new (options?: { offset?: number }) => MapLibrePopup;
  Marker: new (options?: { color?: string }) => MapLibreMarker;
  NavigationControl: new (options?: { showCompass?: boolean }) => unknown;
};

declare global { interface Window { maplibregl?: MapLibreGlobal } }

let cityMap: MapLibreMap | undefined;
const openFreeMapStyle = 'https://tiles.openfreemap.org/styles/bright';
const osmSearchUrl = (placeName: string, cityName: string, countryName: string) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${placeName}, ${cityName}, ${countryName}`)}`;
const englishMapNameExpression = [
  'coalesce',
  ['get', 'name:en'],
  ['get', 'name_en'],
  ['get', 'name:latin'],
  ['get', 'name'],
  ['get', 'ref'],
];

const esc = (value: string) => value.replace(/[&<>\"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' })[character] ?? character);
const statusBadge = (status: VerificationStatus) => `<span class="badge ${status.toLowerCase()}">${statusLabels[lang][status]}</span>`;

function field(name: keyof PlannerPreferences, value: string, label: string, type = 'text', placeholder = '') {
  return `<label>${label}<input data-field="${String(name)}" type="${type}" value="${esc(value)}" ${placeholder ? `placeholder="${esc(placeholder)}"` : ''} /></label>`;
}

function choiceSelect<T extends string>(name: keyof PlannerPreferences, label: string, options: readonly T[], display: Record<T, string>) {
  const currentValue = String(prefs[name]);
  return `<label>${label}<select data-field="${String(name)}">${options.map((option) => `<option value="${esc(option)}" ${currentValue === option ? 'selected' : ''}>${display[option]}</option>`).join('')}</select></label>`;
}

function mapSection(city: (typeof cities)[number], copy: typeof labels[Language]) {
  const { lat, lng } = city.coordinates;
  return `<section class="panel map-panel" aria-label="${copy.cityStreetMap}">
    <div class="map-heading">
      <div><h2>${copy.cityStreetMap}</h2><p>${city.city}, ${city.country}</p></div>
      <button type="button" class="button-link" id="toggle-map-size">${copy.openFullMap}</button>
    </div>
    <div id="city-map" class="city-map" data-lat="${lat}" data-lng="${lng}" data-title="${esc(`${city.city}, ${city.country}`)}">
      <p class="map-fallback">${copy.mapUnavailable}</p>
    </div>
    <p id="map-status" class="map-status" role="status" aria-live="polite"></p>
  </section>`;
}

function athanSection(city: (typeof cities)[number]) {
  const copy = athanLabels[lang];
  const locale = localeForLanguage(lang);
  const times = calculatePrayerDisplay(city, prefs.prayerMethod, prefs.startDate, locale);
  const prayerRows = prayerOrder.map((prayer) => `<div class="prayer-time"><strong>${prayerLabels[lang][prayer]}</strong><span>${times[prayer]}</span></div>`).join('');
  const deviceNotice = isNativeAthanAvailable() ? copy.androidNotice : copy.browserNotice;
  return `<section class="panel athan-panel" aria-label="${copy.title}">
    <div class="athan-heading">
      <div><h2>${copy.title}</h2><p>${copy.description}</p></div>
      <span class="athan-state ${athanEnabled ? 'enabled' : ''}">${athanEnabled ? '●' : '○'}</span>
    </div>
    <h3>${copy.calculated}</h3>
    <div class="prayer-times">
      ${prayerRows}
      <div class="prayer-time sunrise"><strong>${copy.sunrise}</strong><span>${times.Sunrise}</span></div>
    </div>
    <div class="athan-actions">
      <button id="enable-athan">${athanEnabled ? copy.reschedule : copy.enable}</button>
      <button id="disable-athan" class="ghost">${copy.disable}</button>
      <button id="test-athan" class="ghost">${copy.test}</button>
      <button id="stop-athan" class="ghost">${copy.stop}</button>
    </div>
    <p class="athan-device-note">${deviceNotice}</p>
    <p class="athan-permission-note">${copy.permissionNote}</p>
    <p id="athan-status" class="athan-status" role="status" aria-live="polite">${esc(athanStatus)}</p>
  </section>`;
}

function showMapFallback(element: HTMLElement, status: HTMLElement, message: string) {
  element.innerHTML = `<p class="map-fallback">${esc(message)}</p>`;
  status.textContent = message;
}

function applyEnglishMapLabels(map: MapLibreMap) {
  const layers = map.getStyle().layers ?? [];
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue;
    try {
      const textField = map.getLayoutProperty(layer.id, 'text-field');
      if (typeof textField === 'undefined' || !JSON.stringify(textField).includes('name')) continue;
      map.setLayoutProperty(layer.id, 'text-field', englishMapNameExpression);
    } catch {
      // Some symbol layers contain icons or special text expressions and should remain unchanged.
    }
  }
}

function initializeMap(copy: typeof labels[Language]) {
  cityMap?.remove();
  cityMap = undefined;
  const element = document.querySelector<HTMLElement>('#city-map');
  const status = document.querySelector<HTMLElement>('#map-status');
  if (!element || !status) return;
  const lat = Number(element.dataset.lat);
  const lng = Number(element.dataset.lng);
  const title = element.dataset.title ?? '';
  const maplibre = window.maplibregl;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !maplibre) {
    showMapFallback(element, status, copy.mapUnavailable);
    return;
  }
  try {
    element.replaceChildren();
    status.textContent = '';
    cityMap = new maplibre.Map({
      container: element,
      style: openFreeMapStyle,
      center: [lng, lat],
      zoom: 13,
      attributionControl: true,
    });
    cityMap.addControl(
      new maplibre.NavigationControl({ showCompass: false }),
      document.documentElement.dir === 'rtl' ? 'top-right' : 'top-left',
    );
    new maplibre.Marker({ color: '#0f766e' })
      .setLngLat([lng, lat])
      .setPopup(new maplibre.Popup({ offset: 22 }).setText(title))
      .addTo(cityMap);
    cityMap.on('load', () => {
      if (!cityMap) return;
      applyEnglishMapLabels(cityMap);
      window.requestAnimationFrame(() => cityMap?.resize());
    });
  } catch {
    cityMap?.remove();
    cityMap = undefined;
    showMapFallback(element, status, copy.mapUnavailable);
  }
}

function languageSelector() {
  return `<label class="lang">${labels[lang].language}<select id="lang">${languages.map((language) => `<option value="${language.code}" ${language.code === lang ? 'selected' : ''}>${language.label}</option>`).join('')}</select></label>`;
}


function qiblaStatusMessage(copy: typeof labels[Language]) {
  if (qiblaLocationStatus === 'loading') return copy.qiblaLoadingLocation;
  if (qiblaLocationStatus === 'denied') return copy.qiblaLocationDenied;
  if (qiblaLocationStatus === 'unavailable') return copy.qiblaLocationUnavailable;
  if (qiblaMotionStatus === 'active') return copy.qiblaLiveCompass;
  if (qiblaMotionStatus === 'denied') return copy.qiblaMotionDenied;
  if (qiblaMotionStatus === 'unavailable') return copy.qiblaMotionUnavailable;
  return copy.qiblaFixedBearing;
}

function qiblaPage() {
  if (!root) return;
  const copy = labels[lang];
  const dir = languageDirection(lang);
  const bearing = qiblaLocation ? calculateQiblaBearing(qiblaLocation.latitude, qiblaLocation.longitude) : 0;
  const qiblaRotation = normalizeDegrees(bearing - (qiblaHeading ?? 0));
  const compassRotation = qiblaHeading ? -qiblaHeading : 0;
  const locationText = qiblaLocation
    ? `${formatCoordinate(qiblaLocation.latitude, copy.qiblaNorth, copy.qiblaSouth)} · ${formatCoordinate(qiblaLocation.longitude, copy.qiblaEast, copy.qiblaWest)}`
    : copy.qiblaLocationUnavailable;
  const bearingText = qiblaLocation ? `${bearing.toFixed(1)}°` : '--°';
  const canShowCompass = qiblaLocationStatus === 'ready';
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  root.innerHTML = `
    <main dir="${dir}" class="app qibla-app">
      <section class="hero qibla-hero">
        ${languageSelector()}
        <p class="eyebrow">${copy.qibla}</p>
        <h1>${copy.qiblaTitle}</h1>
        <p>${copy.qiblaSubtitle}</p>
        <button type="button" class="ghost hero-action" id="back-to-planner">${copy.qiblaBack}</button>
      </section>
      <section class="panel qibla-panel" aria-live="polite">
        <div class="qibla-toolbar">
          <button type="button" id="request-location">${qiblaLocationStatus === 'denied' || qiblaLocationStatus === 'unavailable' ? copy.qiblaRetry : copy.qiblaRequestLocation}</button>
          <button type="button" class="ghost" id="request-motion" ${canShowCompass ? '' : 'disabled'}>${copy.qiblaRequestMotion}</button>
        </div>
        <div class="qibla-status ${qiblaLocationStatus}">${qiblaStatusMessage(copy)}</div>
        <div class="qibla-compass-wrap">
          <div class="qibla-compass" style="--compass-rotation: ${compassRotation}deg; --qibla-rotation: ${qiblaRotation}deg;">
            <span class="qibla-cardinal north">${copy.qiblaNorth}</span>
            <span class="qibla-cardinal east">${copy.qiblaEast}</span>
            <span class="qibla-cardinal south">${copy.qiblaSouth}</span>
            <span class="qibla-cardinal west">${copy.qiblaWest}</span>
            <div class="compass-face"></div>
            <div class="qibla-arrow"><span>${copy.qiblaKaaba}</span></div>
          </div>
        </div>
        <div class="qibla-readouts">
          <div><span>${copy.qiblaBearing}</span><strong>${bearingText}</strong><small>${copy.qiblaDegrees}</small></div>
          <div><span>${copy.qiblaLocation}</span><strong>${locationText}</strong>${qiblaLocation?.accuracy ? `<small>±${Math.round(qiblaLocation.accuracy)} m</small>` : ''}</div>
          <div><span>${copy.qibla}</span><strong>${qiblaMotionStatus === 'active' ? copy.qiblaLiveCompass : copy.qiblaFixedBearing}</strong></div>
        </div>
      </section>
    </main>`;
  bindQibla();
}

function stopQiblaOrientation() {
  window.removeEventListener('deviceorientation', handleQiblaOrientation);
  window.removeEventListener('deviceorientationabsolute', handleQiblaOrientation);
}

function handleQiblaOrientation(event: CompassOrientationEvent) {
  const heading = typeof event.webkitCompassHeading === 'number'
    ? event.webkitCompassHeading
    : typeof event.alpha === 'number'
      ? normalizeDegrees(360 - event.alpha)
      : undefined;
  if (typeof heading !== 'number') return;
  qiblaHeading = heading;
  qiblaMotionStatus = 'active';
  qiblaPage();
}

function startQiblaOrientation() {
  stopQiblaOrientation();
  window.addEventListener('deviceorientation', handleQiblaOrientation);
  window.addEventListener('deviceorientationabsolute', handleQiblaOrientation);
}

async function requestQiblaMotion() {
  if (!('DeviceOrientationEvent' in window)) {
    qiblaMotionStatus = 'unavailable';
    qiblaPage();
    return;
  }
  const OrientationEvent = window.DeviceOrientationEvent as DeviceOrientationEventWithPermission;
  if (typeof OrientationEvent.requestPermission === 'function') {
    try {
      const permission = await OrientationEvent.requestPermission();
      if (permission !== 'granted') {
        qiblaMotionStatus = 'denied';
        qiblaPage();
        return;
      }
    } catch {
      qiblaMotionStatus = 'denied';
      qiblaPage();
      return;
    }
  }
  qiblaMotionStatus = 'unavailable';
  startQiblaOrientation();
  qiblaPage();
}

function requestQiblaLocation() {
  if (!navigator.geolocation) {
    qiblaLocationStatus = 'unavailable';
    qiblaPage();
    return;
  }
  qiblaLocationStatus = 'loading';
  qiblaPage();
  navigator.geolocation.getCurrentPosition(
    (position) => {
      qiblaLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      qiblaLocationStatus = 'ready';
      qiblaMotionStatus = qiblaMotionStatus === 'idle' ? 'unavailable' : qiblaMotionStatus;
      qiblaPage();
    },
    (error) => {
      qiblaLocationStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      qiblaPage();
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

function bindQibla() {
  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => {
    lang = (event.target as HTMLSelectElement).value as Language;
    qiblaPage();
  });
  document.querySelector<HTMLButtonElement>('#back-to-planner')?.addEventListener('click', () => {
    view = 'planner';
    stopQiblaOrientation();
    if (window.location.hash) {
      history.pushState(null, '', window.location.pathname + window.location.search);
    }
    render();
  });
  document.querySelector<HTMLButtonElement>('#request-location')?.addEventListener('click', requestQiblaLocation);
  document.querySelector<HTMLButtonElement>('#request-motion')?.addEventListener('click', () => void requestQiblaMotion());
}

function selectedCity() {
  return cities.find((candidate) => candidate.city.toLowerCase() === prefs.city.toLowerCase()) ?? cities[0];
}

function render() {
  if (!root) return;
  if (view === 'qibla') {
    qiblaPage();
    return;
  }
  document.body.classList.remove('map-expanded');
  const copy = labels[lang];
  const dir = languageDirection(lang);
  const visibleCities = selectedRegion ? cities.filter((candidate) => candidate.region === selectedRegion) : cities;
  if (!visibleCities.some((candidate) => candidate.city.toLowerCase() === prefs.city.toLowerCase())) {
    prefs = { ...prefs, city: visibleCities[0]?.city ?? cities[0].city };
  }
  const city = selectedCity();
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
      <section class="panel qibla-entry">
        <div><h2>${copy.qiblaTitle}</h2><p>${copy.qiblaSubtitle}</p></div>
        <button type="button" id="open-qibla">${copy.qiblaOpen}</button>
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
        <div class="result-header"><div><h2>${city.city}, ${city.country}</h2><p>${regionLabels[lang][city.region]} · ${city.timezone}</p><p>${copy.transportEstimatesAre} <strong>${statusLabels[lang].Sample}</strong>: ${copy.walking} ${city.transportEstimates.walking} ${copy.minutesShort} · ${copy.publicTransport} ${city.transportEstimates.publicTransport} ${copy.minutesShort} · ${copy.taxi} ${city.transportEstimates.taxi} ${copy.minutesShort}.</p></div><div class="legend"><strong>${copy.legend}</strong>${statusBadge('Sample')}${statusBadge('Unverified')}${statusBadge('Verified')}</div></div>
        ${athanSection(city)}
        ${mapSection(city, copy)}
        ${items.length ? items.map((item, index) => `<article class="card ${item.kind}"><div class="card-top"><span>${item.time} · ${item.durationMinutes} ${copy.minutesShort}</span>${statusBadge(item.status)}</div><h3>${item.title}</h3><p>${item.details}</p>${item.place?.evidence ? `<p class="evidence">${copy.evidenceNote}: ${item.place.evidence}</p>` : ''}${item.place?.facility ? `<p>${copy.women}: ${statusBadge(item.place.facility.womenPrayerSpace)} ${copy.wudu}: ${statusBadge(item.place.facility.wudu)} ${copy.accessibility}: ${statusBadge(item.place.facility.accessibility)}</p>` : ''}${item.place ? `<p><a class="map-link" href="${osmSearchUrl(item.place.name, city.city, city.country)}" target="_blank" rel="noopener noreferrer">${copy.findOnMap}</a></p>` : ''}<button class="ghost" data-replan="${index + 1}">${copy.replan}</button></article>`).join('') : `<p>${visibleCities.length ? copy.emptyState : copy.noCities}</p>`}
      </section>
    </main>`;
  bind();
  initializeMap(copy);
}

function bind() {
  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => {
    lang = (event.target as HTMLSelectElement).value as Language;
    athanStatus = '';
    render();
  });
  document.querySelector<HTMLButtonElement>('#open-qibla')?.addEventListener('click', () => {
    view = 'qibla';
    if (window.location.hash !== '#qibla') window.location.hash = 'qibla';
    render();
  });
  document.querySelector('#plan')?.addEventListener('click', () => {
    replan = 0;
    render();
  });
  document.querySelector<HTMLButtonElement>('#enable-athan')?.addEventListener('click', async () => {
    const copy = athanLabels[lang];
    athanStatus = copy.preparing;
    render();
    try {
      const city = selectedCity();
      const alarms = calculatePrayerAlarms(city, prefs.prayerMethod, prefs.startDate, localeForLanguage(lang), 7);
      if (!alarms.length) {
        athanStatus = copy.noFuture;
        render();
        return;
      }
      const result = await enableAthanAlarms(alarms);
      athanEnabled = true;
      localStorage.setItem('athanEnabled', 'true');
      athanStatus = `${copy.scheduled}: ${result.scheduled}`;
    } catch (error) {
      console.error(error);
      athanStatus = copy.failed;
    }
    render();
  });
  document.querySelector<HTMLButtonElement>('#disable-athan')?.addEventListener('click', async () => {
    await disableAthanAlarms();
    athanEnabled = false;
    localStorage.setItem('athanEnabled', 'false');
    athanStatus = athanLabels[lang].disabled;
    render();
  });
  document.querySelector<HTMLButtonElement>('#test-athan')?.addEventListener('click', () => void playTestAthan().catch((error) => {
    console.error(error);
    athanStatus = athanLabels[lang].failed;
    render();
  }));
  document.querySelector<HTMLButtonElement>('#stop-athan')?.addEventListener('click', () => void stopAthan());
  document.querySelector<HTMLButtonElement>('#toggle-map-size')?.addEventListener('click', () => {
    const panel = document.querySelector<HTMLElement>('.map-panel');
    if (!panel) return;
    const expanded = panel.classList.toggle('map-panel--expanded');
    document.body.classList.toggle('map-expanded', expanded);
    window.setTimeout(() => cityMap?.resize(), 0);
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
    if (key === 'city' || key === 'prayerMethod' || key === 'startDate') {
      replan = 0;
      athanStatus = '';
      render();
    }
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-replan]').forEach((button) => button.addEventListener('click', () => {
    replan = Number(button.dataset.replan);
    render();
  }));
}

window.addEventListener('hashchange', () => {
  view = window.location.hash === '#qibla' ? 'qibla' : 'planner';
  if (view === 'planner') stopQiblaOrientation();
  render();
});

render();
