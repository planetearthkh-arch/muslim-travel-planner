import { cities } from './data.js';
import { generateItinerary } from './planner.js';
import { calculateQiblaBearing, formatCoordinate, normalizeDegrees } from './qibla.js';
import { buildOverpassQuery, ensureLatinDisplayName, getEnglishPlaceName, isReliablyOpenNow, normalizePrayerPlace, type PrayerPlace, type PrayerPlaceType } from './prayer-spaces.js';
import {
  CURRENCY_CACHE_MS,
  FRANKFURTER_BASE_URL,
  RATE_CACHE_MS,
  cacheKeyForRate,
  convertAmount,
  destinationCurrency,
  fallbackCurrencies,
  formatCurrencyAmount,
  formatPlainNumber,
  historyStats,
  normalizeCurrencies,
  parseAmountInput,
  popularCurrencyCodes,
  readJsonCache,
  searchCurrencies,
  validateRateResponse,
  writeJsonCache,
  type CurrencyInfo,
  type PairRate,
} from './money.js';
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
type View = 'planner' | 'qibla' | 'prayer-spaces' | 'money';
type QiblaLocation = { latitude: number; longitude: number; accuracy?: number };
type QiblaLocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable';
type QiblaMotionStatus = 'idle' | 'active' | 'denied' | 'unavailable';
type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };
type CompassOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

const viewFromHash = (): View => window.location.hash === '#qibla' ? 'qibla' : window.location.hash === '#prayer-spaces' ? 'prayer-spaces' : window.location.hash === '#money' ? 'money' : 'planner';
let view: View = viewFromHash();
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

let currencies: CurrencyInfo[] = fallbackCurrencies;
let currencySearch = '';
let amountInput = '100';
let fromCurrency = localStorage.getItem('mtp-home-currency') ?? 'USD';
let toCurrency = 'GBP';
let rate: PairRate | null = null;
let moneyStatus: 'idle' | 'loadingCurrencies' | 'loadingRate' | 'updated' | 'offline' | 'cached' | 'serviceUnavailable' | 'invalidAmount' | 'noCachedData' | 'copied' = 'idle';
let moneyError = '';
let rateTimer: number | undefined;
let historyDays: 7 | 30 | 90 = 7;
let historySummary: ReturnType<typeof historyStats> | null = null;

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
  getCenter?: () => { lat: number; lng: number };
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
let prayerMap: MapLibreMap | undefined;
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


type PrayerLocationStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'searching' | 'service-unavailable' | 'empty';
type PrayerMode = 'map' | 'list';
type PrayerFilter = 'all' | PrayerPlaceType;
type PrayerSort = 'distance' | 'name' | 'open';
type PrayerCenter = { latitude: number; longitude: number; label: string };

type OverpassResponse = { elements?: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: Record<string, string | undefined> }> };
type NominatimResult = { lat: string; lon: string; display_name: string };

const prayerRadii = [5, 10, 25, 50] as const;
let prayerStatus: PrayerLocationStatus = 'idle';
let prayerMode: PrayerMode = 'map';
let prayerCenter: PrayerCenter | undefined;
let prayerRadiusKm: typeof prayerRadii[number] = 10;
let prayerManualQuery = '';
let prayerResults: PrayerPlace[] = [];
let prayerFilter: PrayerFilter = 'all';
let prayerSort: PrayerSort = 'distance';
let prayerOpenOnly = false;
let prayerWomenOnly = false;
let prayerWuduOnly = false;
let prayerWheelchairOnly = false;
let prayerMapMoved = false;
let prayerError = '';
let prayerSearchTimer: number | undefined;
const prayerCache = new Map<string, { expires: number; results: PrayerPlace[] }>();

function requestJson<T>(url: string, options: RequestInit = {}, milliseconds = 14000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), milliseconds);
  return fetch(url, { ...options, signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<T>;
    })
    .finally(() => window.clearTimeout(timeout));
}

function prayerTypeLabel(type: PrayerPlaceType, copy: typeof labels[Language]) {
  if (type === 'mosque') return copy.prayerTypeMosque;
  if (type === 'prayer-room') return copy.prayerTypeRoom;
  return copy.prayerTypeQuiet;
}

function prayerStatusMessage(copy: typeof labels[Language]) {
  if (prayerStatus === 'requesting') return copy.prayerRequestingLocation;
  if (prayerStatus === 'searching') return copy.prayerSearching;
  if (prayerStatus === 'denied') return copy.prayerLocationDenied;
  if (prayerStatus === 'unavailable') return copy.prayerLocationUnavailable;
  if (prayerStatus === 'service-unavailable') return prayerError || copy.prayerServiceUnavailable;
  if (prayerStatus === 'empty') return copy.prayerNoResults;
  return copy.prayerNotice;
}

function filteredPrayerResults() {
  let results = [...prayerResults];
  if (prayerFilter !== 'all') results = results.filter((place) => place.type === prayerFilter);
  if (prayerOpenOnly) results = results.filter((place) => place.openingHours && isReliablyOpenNow({ opening_hours: place.openingHours }) === true);
  if (prayerWomenOnly) results = results.filter((place) => place.womenPrayerArea === 'Verified');
  if (prayerWuduOnly) results = results.filter((place) => place.wudu === 'Verified');
  if (prayerWheelchairOnly) results = results.filter((place) => place.wheelchair === 'Verified');
  results.sort((a, b) => {
    if (prayerSort === 'name') return a.name.localeCompare(b.name);
    if (prayerSort === 'open') return Number(isReliablyOpenNow({ opening_hours: b.openingHours }) === true) - Number(isReliablyOpenNow({ opening_hours: a.openingHours }) === true) || a.distanceKm - b.distanceKm;
    return a.distanceKm - b.distanceKm;
  });
  return results;
}

function appleMapsUrl(place: PrayerPlace) {
  return `https://maps.apple.com/?daddr=${place.latitude},${place.longitude}&q=${encodeURIComponent(ensureLatinDisplayName(getEnglishPlaceName(place), place.type))}`;
}

function browserDirectionsUrl(place: PrayerPlace) {
  return `https://www.openstreetmap.org/directions?to=${place.latitude},${place.longitude}#map=17/${place.latitude}/${place.longitude}`;
}

function overpassUrl() { return 'https://overpass-api.de/api/interpreter'; }

async function searchPrayerPlaces(center: PrayerCenter) {
  prayerCenter = center;
  prayerMapMoved = false;
  const cacheKey = `${center.latitude.toFixed(4)},${center.longitude.toFixed(4)},${prayerRadiusKm}`;
  const cached = prayerCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    prayerResults = cached.results;
    prayerStatus = prayerResults.length ? 'ready' : 'empty';
    prayerPage();
    return;
  }
  prayerStatus = 'searching';
  prayerError = '';
  prayerPage();
  try {
    const body = buildOverpassQuery(center.latitude, center.longitude, prayerRadiusKm);
    const data = await requestJson<OverpassResponse>(overpassUrl(), { method: 'POST', body }, 18000);
    const deduped = new Map<string, PrayerPlace>();
    for (const element of data.elements ?? []) {
      const place = normalizePrayerPlace(element, center);
      if (place) deduped.set(place.id, place);
    }
    prayerResults = [...deduped.values()].sort((a, b) => a.distanceKm - b.distanceKm);
    prayerCache.set(cacheKey, { expires: Date.now() + 5 * 60 * 1000, results: prayerResults });
    prayerStatus = prayerResults.length ? 'ready' : 'empty';
  } catch (error) {
    console.error(error);
    prayerStatus = 'service-unavailable';
    prayerError = labels[lang].prayerServiceUnavailable;
  }
  prayerPage();
}

function requestPrayerLocation() {
  if (!navigator.geolocation) {
    prayerStatus = 'unavailable';
    prayerPage();
    return;
  }
  prayerStatus = 'requesting';
  prayerPage();
  navigator.geolocation.getCurrentPosition(
    (position) => void searchPrayerPlaces({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: labels[lang].qiblaLocation }),
    (error) => {
      prayerStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      prayerPage();
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

async function searchPrayerDestination() {
  const query = prayerManualQuery.trim();
  if (!query) return;
  prayerStatus = 'searching';
  prayerPage();
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const data = await requestJson<NominatimResult[]>(url, { headers: { Accept: 'application/json' } }, 12000);
    const first = data[0];
    if (!first) {
      prayerStatus = 'empty';
      prayerResults = [];
      prayerPage();
      return;
    }
    await searchPrayerPlaces({ latitude: Number(first.lat), longitude: Number(first.lon), label: first.display_name });
  } catch (error) {
    console.error(error);
    prayerStatus = 'service-unavailable';
    prayerError = labels[lang].prayerServiceUnavailable;
    prayerPage();
  }
}

function debouncedPrayerSearch(center: PrayerCenter) {
  if (prayerSearchTimer) window.clearTimeout(prayerSearchTimer);
  prayerSearchTimer = window.setTimeout(() => void searchPrayerPlaces(center), 450);
}

function initializePrayerMap() {
  prayerMap?.remove();
  prayerMap = undefined;
  const element = document.querySelector<HTMLElement>('#prayer-map');
  if (!element || !prayerCenter || !window.maplibregl) return;
  try {
    element.replaceChildren();
    prayerMap = new window.maplibregl.Map({
      container: element,
      style: openFreeMapStyle,
      center: [prayerCenter.longitude, prayerCenter.latitude],
      zoom: prayerRadiusKm <= 5 ? 12 : prayerRadiusKm <= 10 ? 11 : 9,
      attributionControl: true,
    });
    prayerMap.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), document.documentElement.dir === 'rtl' ? 'top-right' : 'top-left');
    new window.maplibregl.Marker({ color: '#0f766e' }).setLngLat([prayerCenter.longitude, prayerCenter.latitude]).setPopup(new window.maplibregl.Popup({ offset: 18 }).setText(prayerCenter.label)).addTo(prayerMap);
    for (const place of filteredPrayerResults()) {
      const displayName = ensureLatinDisplayName(getEnglishPlaceName(place), place.type);
      new window.maplibregl.Marker({ color: place.type === 'mosque' ? '#0f766e' : '#2563eb' }).setLngLat([place.longitude, place.latitude]).setPopup(new window.maplibregl.Popup({ offset: 18 }).setText(displayName)).addTo(prayerMap);
    }
    prayerMap.on('moveend', () => {
      prayerMapMoved = true;
      const button = document.querySelector<HTMLButtonElement>('#search-this-area');
      if (button) button.hidden = false;
    });
  } catch {
    if (element) element.innerHTML = `<p class="map-fallback">${labels[lang].mapUnavailable}</p>`;
  }
}

function prayerResultCard(place: PrayerPlace, copy: typeof labels[Language]) {
  const verified = (value: string) => value === 'Verified' ? copy.prayerVerified : copy.prayerUnverified;
  const missing = (value: string) => value || copy.prayerUnknown;
  const displayName = ensureLatinDisplayName(getEnglishPlaceName(place), place.type);
  return `<article class="card prayer-place-card" aria-label="${esc(displayName)}">
    <div class="card-top"><span>${place.distanceKm.toFixed(1)} km · ${prayerTypeLabel(place.type, copy)}</span><span class="badge ${place.verification === 'Verified' ? 'verified' : 'unverified'}">${verified(place.verification)}</span></div>
    <h3>${esc(displayName)}</h3>
    <dl class="place-details">
      <div><dt>${copy.prayerAddress}</dt><dd>${esc(missing(place.address))}</dd></div>
      <div><dt>${copy.prayerOpeningHours}</dt><dd>${esc(missing(place.openingHours))}</dd></div>
      <div><dt>${copy.prayerWomen}</dt><dd>${verified(place.womenPrayerArea)}</dd></div>
      <div><dt>${copy.prayerWudu}</dt><dd>${verified(place.wudu)}</dd></div>
      <div><dt>${copy.prayerWheelchair}</dt><dd>${verified(place.wheelchair)}</dd></div>
      <div><dt>${copy.prayerWebsite}</dt><dd>${place.website ? `<a href="${esc(place.website)}" target="_blank" rel="noopener noreferrer">${esc(place.website)}</a>` : copy.prayerUnknown}</dd></div>
      <div><dt>${copy.prayerTelephone}</dt><dd>${esc(missing(place.telephone))}</dd></div>
    </dl>
    <div class="place-actions">
      <a class="map-link" href="${place.sourceUrl}" target="_blank" rel="noopener noreferrer">${copy.prayerViewOnMap}</a>
      <a class="map-link" href="${appleMapsUrl(place)}" target="_blank" rel="noopener noreferrer">${copy.prayerAppleMaps}</a>
      <a class="map-link" href="${browserDirectionsUrl(place)}" target="_blank" rel="noopener noreferrer">${copy.prayerBrowserMap}</a>
    </div>
  </article>`;
}

function prayerPage() {
  if (!root) return;
  cityMap?.remove();
  cityMap = undefined;
  const copy = labels[lang];
  const dir = languageDirection(lang);
  const results = filteredPrayerResults();
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  root.innerHTML = `
    <main dir="${dir}" class="app prayer-app">
      <section class="hero prayer-hero">
        ${languageSelector()}
        <p class="eyebrow">${copy.prayerSpacesOpen}</p>
        <h1>${copy.prayerSpacesTitle}</h1>
        <p>${copy.prayerSpacesSubtitle}</p>
        <button type="button" class="ghost hero-action" id="back-from-prayer">${copy.prayerSpacesBack}</button>
      </section>
      <section class="panel prayer-panel" aria-live="polite">
        <p class="notice prayer-notice">${copy.prayerNotice}</p>
        <div class="prayer-actions">
          <button type="button" id="use-prayer-location">${copy.prayerUseLocation}</button>
          <label>${copy.prayerRadius}<select id="prayer-radius">${prayerRadii.map((radius) => `<option value="${radius}" ${radius === prayerRadiusKm ? 'selected' : ''}>${radius} km</option>`).join('')}</select></label>
          <form id="manual-prayer-search" class="manual-search"><label>${copy.prayerManualSearch}<input id="prayer-manual-query" value="${esc(prayerManualQuery)}" placeholder="${copy.prayerManualPlaceholder}" /></label><button type="submit">${copy.prayerSearch}</button></form>
        </div>
        <p class="prayer-status ${prayerStatus}" role="status">${prayerStatusMessage(copy)}</p>
        <div class="segmented" role="tablist" aria-label="${copy.prayerSpacesTitle}">
          <button type="button" class="${prayerMode === 'map' ? 'active' : 'ghost'}" data-prayer-mode="map">${copy.prayerMapView}</button>
          <button type="button" class="${prayerMode === 'list' ? 'active' : 'ghost'}" data-prayer-mode="list">${copy.prayerListView}</button>
        </div>
        <div class="prayer-filters" aria-label="${copy.prayerSpacesTitle}">
          <select id="prayer-filter"><option value="all">${copy.prayerAllPlaces}</option><option value="mosque" ${prayerFilter === 'mosque' ? 'selected' : ''}>${copy.prayerMosques}</option><option value="prayer-room" ${prayerFilter === 'prayer-room' ? 'selected' : ''}>${copy.prayerRooms}</option><option value="quiet-space" ${prayerFilter === 'quiet-space' ? 'selected' : ''}>${copy.prayerQuietSpaces}</option></select>
          <label class="inline-check"><input type="checkbox" id="filter-open" ${prayerOpenOnly ? 'checked' : ''}/> ${copy.prayerOpenNow}</label>
          <label class="inline-check"><input type="checkbox" id="filter-women" ${prayerWomenOnly ? 'checked' : ''}/> ${copy.prayerWomenArea}</label>
          <label class="inline-check"><input type="checkbox" id="filter-wudu" ${prayerWuduOnly ? 'checked' : ''}/> ${copy.prayerWuduAvailable}</label>
          <label class="inline-check"><input type="checkbox" id="filter-wheelchair" ${prayerWheelchairOnly ? 'checked' : ''}/> ${copy.prayerWheelchairAccessible}</label>
          <label>${copy.prayerSort}<select id="prayer-sort"><option value="distance" ${prayerSort === 'distance' ? 'selected' : ''}>${copy.prayerNearest}</option><option value="name" ${prayerSort === 'name' ? 'selected' : ''}>${copy.prayerName}</option><option value="open" ${prayerSort === 'open' ? 'selected' : ''}>${copy.prayerOpenNowSort}</option></select></label>
        </div>
        <button type="button" id="search-this-area" class="ghost" ${prayerMapMoved ? '' : 'hidden'}>${copy.prayerSearchThisArea}</button>
        ${prayerMode === 'map' ? `<div id="prayer-map" class="city-map prayer-map"><p class="map-fallback">${copy.mapUnavailable}</p></div>` : ''}
        ${prayerStatus === 'empty' ? `<div class="empty-actions"><button type="button" id="retry-prayer" class="ghost">${copy.prayerRetry}</button><button type="button" id="increase-radius">${copy.prayerIncreaseRadius}</button></div>` : ''}
        <div class="place-list">${results.length ? results.map((place) => prayerResultCard(place, copy)).join('') : prayerStatus === 'ready' ? `<p>${copy.prayerNoResults}</p>` : ''}</div>
      </section>
    </main>`;
  bindPrayerPage();
  if (prayerMode === 'map') initializePrayerMap();
}

function bindPrayerPage() {
  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => { lang = (event.target as HTMLSelectElement).value as Language; prayerPage(); });
  document.querySelector<HTMLButtonElement>('#back-from-prayer')?.addEventListener('click', () => { view = 'planner'; prayerMap?.remove(); prayerMap = undefined; if (window.location.hash) history.pushState(null, '', window.location.pathname + window.location.search); render(); });
  document.querySelector<HTMLButtonElement>('#use-prayer-location')?.addEventListener('click', requestPrayerLocation);
  document.querySelector<HTMLSelectElement>('#prayer-radius')?.addEventListener('change', (event) => { prayerRadiusKm = Number((event.target as HTMLSelectElement).value) as typeof prayerRadii[number]; if (prayerCenter) void searchPrayerPlaces(prayerCenter); });
  document.querySelector<HTMLFormElement>('#manual-prayer-search')?.addEventListener('submit', (event) => { event.preventDefault(); prayerManualQuery = document.querySelector<HTMLInputElement>('#prayer-manual-query')?.value ?? ''; void searchPrayerDestination(); });
  document.querySelectorAll<HTMLButtonElement>('[data-prayer-mode]').forEach((button) => button.addEventListener('click', () => { prayerMode = button.dataset.prayerMode as PrayerMode; prayerPage(); }));
  document.querySelector<HTMLSelectElement>('#prayer-filter')?.addEventListener('change', (event) => { prayerFilter = (event.target as HTMLSelectElement).value as PrayerFilter; prayerPage(); });
  document.querySelector<HTMLSelectElement>('#prayer-sort')?.addEventListener('change', (event) => { prayerSort = (event.target as HTMLSelectElement).value as PrayerSort; prayerPage(); });
  document.querySelector<HTMLInputElement>('#filter-open')?.addEventListener('change', (event) => { prayerOpenOnly = (event.target as HTMLInputElement).checked; prayerPage(); });
  document.querySelector<HTMLInputElement>('#filter-women')?.addEventListener('change', (event) => { prayerWomenOnly = (event.target as HTMLInputElement).checked; prayerPage(); });
  document.querySelector<HTMLInputElement>('#filter-wudu')?.addEventListener('change', (event) => { prayerWuduOnly = (event.target as HTMLInputElement).checked; prayerPage(); });
  document.querySelector<HTMLInputElement>('#filter-wheelchair')?.addEventListener('change', (event) => { prayerWheelchairOnly = (event.target as HTMLInputElement).checked; prayerPage(); });
  document.querySelector<HTMLButtonElement>('#retry-prayer')?.addEventListener('click', () => { if (prayerCenter) void searchPrayerPlaces(prayerCenter); else requestPrayerLocation(); });
  document.querySelector<HTMLButtonElement>('#increase-radius')?.addEventListener('click', () => { const next = prayerRadii.find((radius) => radius > prayerRadiusKm); if (next) prayerRadiusKm = next; if (prayerCenter) void searchPrayerPlaces(prayerCenter); });
  document.querySelector<HTMLButtonElement>('#search-this-area')?.addEventListener('click', () => { const center = prayerMap?.getCenter?.(); if (!center) return; debouncedPrayerSearch({ latitude: center.lat, longitude: center.lng, label: labels[lang].prayerSearchThisArea }); });
}

function selectedCity() {
  return cities.find((candidate) => candidate.city.toLowerCase() === prefs.city.toLowerCase()) ?? cities[0];
}

async function loadCurrencies() {
  const cached = readJsonCache<CurrencyInfo[]>(localStorage, 'mtp-currencies', CURRENCY_CACHE_MS);
  if (cached?.length) currencies = cached;
  moneyStatus = cached?.length ? 'idle' : 'loadingCurrencies';
  render();
  try {
    const loaded = normalizeCurrencies(await requestJson<unknown>(`${FRANKFURTER_BASE_URL}/currencies`, { headers: { Accept: 'application/json' } }, 7000));
    if (loaded.length) {
      currencies = loaded;
      writeJsonCache(localStorage, 'mtp-currencies', loaded);
      moneyStatus = 'idle';
      render();
    }
  } catch {
    moneyStatus = cached?.length ? 'cached' : 'serviceUnavailable';
    render();
  }
}

async function loadPairRate(useCache = true) {
  if (fromCurrency === toCurrency) {
    rate = { base: fromCurrency, quote: toCurrency, rate: 1, date: new Date().toISOString().slice(0, 10), refreshedAt: new Date().toISOString(), cached: false };
    moneyStatus = 'updated';
    render();
    return;
  }
  const key = cacheKeyForRate(fromCurrency, toCurrency);
  const cached = readJsonCache<PairRate>(localStorage, key, RATE_CACHE_MS);
  moneyStatus = 'loadingRate';
  moneyError = '';
  render();
  try {
    rate = validateRateResponse(await requestJson<unknown>(`${FRANKFURTER_BASE_URL}/rate/${fromCurrency}/${toCurrency}`, { headers: { Accept: 'application/json' } }, 7000), fromCurrency, toCurrency);
    writeJsonCache(localStorage, key, rate);
    moneyStatus = 'updated';
    void loadHistory();
  } catch (error) {
    const fallback = useCache ? cached : null;
    if (fallback) {
      rate = { ...fallback, cached: true };
      moneyStatus = navigator.onLine ? 'cached' : 'offline';
    } else {
      rate = null;
      moneyStatus = navigator.onLine ? 'serviceUnavailable' : 'noCachedData';
      moneyError = error instanceof Error ? error.message : '';
    }
  }
  render();
}

async function loadHistory() {
  if (fromCurrency === toCurrency) {
    historySummary = null;
    return;
  }
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - historyDays);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  try {
    const body = await requestJson<Array<{ date: string; base: string; quote: string; rate: number }>>(`${FRANKFURTER_BASE_URL}/rates?from=${iso(start)}&to=${iso(end)}`, { headers: { Accept: 'application/json' } }, 7000);
    historySummary = historyStats(body, toCurrency, fromCurrency);
  } catch {
    historySummary = null;
  }
  render();
}

function scheduleRateLoad() {
  window.clearTimeout(rateTimer);
  rateTimer = window.setTimeout(() => void loadPairRate(), 350);
}

function currencyByCode(code: string) {
  return currencies.find((currency) => currency.code === code) ?? fallbackCurrencies.find((currency) => currency.code === code) ?? currencies[0];
}

function currencyOption(currency: CurrencyInfo) {
  return `${currency.flag} ${currency.code} - ${currency.name[lang]} (${currency.symbol})`;
}

function moneyStatusText(copy: typeof labels[Language]) {
  const messages = {
    idle: '',
    loadingCurrencies: copy.loadingCurrencies,
    loadingRate: copy.loadingRate,
    updated: copy.rateUpdated,
    offline: copy.offline,
    cached: copy.cachedRate,
    serviceUnavailable: `${copy.serviceUnavailable}${moneyError ? ` ${moneyError}` : ''}`,
    invalidAmount: copy.invalidAmount,
    noCachedData: copy.noCachedData,
    copied: copy.copied,
  };
  return messages[moneyStatus];
}

function moneyPage() {
  if (!root) return;
  cityMap?.remove();
  cityMap = undefined;
  prayerMap?.remove();
  prayerMap = undefined;
  const copy = labels[lang];
  const dir = languageDirection(lang);
  const city = selectedCity();
  const local = city.money.localCurrencies[0];
  const from = currencyByCode(fromCurrency);
  const to = currencyByCode(toCurrency);
  const parsed = parseAmountInput(amountInput);
  const sameCurrency = fromCurrency === toCurrency;
  const result = parsed.value !== null && rate ? convertAmount(parsed.value, rate.rate) : null;
  const searchable = searchCurrencies(currencies, currencySearch);
  const popularButtons = popularCurrencyCodes.map((code) => `<button class="chip" type="button" data-quick="${code}">${code}</button>`).join('');
  const options = searchable.map((currency) => `<option value="${currency.code}">${currencyOption(currency)}</option>`).join('');
  const summary = historySummary;
  const history = summary ? `<div class="stats">
    <p><strong>${copy.highestRate}</strong><br>${formatPlainNumber(summary.high, lang)}</p>
    <p><strong>${copy.lowestRate}</strong><br>${formatPlainNumber(summary.low, lang)}</p>
    <p><strong>${copy.startRate}</strong><br>${formatPlainNumber(summary.start, lang)}</p>
    <p><strong>${copy.latestRate}</strong><br>${formatPlainNumber(summary.latest, lang)}</p>
    <p><strong>${copy.percentageChange}</strong><br>${formatPlainNumber(summary.changePercent, lang)}%</p>
  </div><div class="spark" aria-hidden="true">${summary.points.map((point) => `<i style="height:${Math.max(8, Math.round((point.rate / summary.high) * 54))}px"></i>`).join('')}</div>` : '';
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  root.innerHTML = `
    <main dir="${dir}" class="app money-app">
      <section class="hero">
        ${languageSelector()}
        <p class="eyebrow">${copy.moneyOpen}</p>
        <h1>${copy.moneyTitle}</h1>
        <p>${copy.moneySubtitle}</p>
        <p class="notice">${copy.rateNotice}</p>
        <button type="button" class="ghost hero-action" id="back-from-money">${copy.moneyBack}</button>
      </section>
      <section class="panel form" aria-label="${copy.moneyTitle}">
        <div class="destination-box">
          <strong>${copy.destination}: ${esc(city.city)}</strong>
          <p>${copy.localCurrency}: ${esc(local.name)} - ${local.code}</p>
          <p>${copy.symbol}: ${esc(local.symbol)}</p>
        </div>
        <label>${copy.amount}<input id="money-amount" inputmode="decimal" value="${esc(amountInput)}" aria-describedby="money-status" /></label>
        <div class="grid">
          <label>${copy.fromCurrency}<select id="from-currency"><option value="${fromCurrency}">${currencyOption(from)}</option>${options}</select></label>
          <label>${copy.toCurrency}<select id="to-currency"><option value="${toCurrency}">${currencyOption(to)}</option>${options}</select></label>
        </div>
        <label>${copy.searchCurrency}<input id="currency-search" value="${esc(currencySearch)}" /></label>
        <div class="chips" aria-label="${copy.popularCurrencies}">${popularButtons}</div>
        <div class="toolbar">
          <button type="button" id="swap-currencies" aria-label="${copy.swapCurrencies}">⇄</button>
          <button type="button" class="ghost" id="clear-money">${copy.clear}</button>
          <button type="button" class="ghost" id="refresh-rate">${copy.refreshRates}</button>
          <button type="button" class="ghost" id="copy-result">${copy.copyResult}</button>
        </div>
        <p id="money-status" class="status" aria-live="polite">${moneyStatusText(copy)}${sameCurrency ? ` ${copy.sameCurrency}` : ''}</p>
        ${parsed.error && parsed.error !== 'empty' ? `<p class="error">${copy.invalidAmount}</p>` : ''}
      </section>
      <section class="panel results" aria-live="polite">
        <article class="card">
          <div class="conversion-result">
            <span>${from.flag} ${from.code} ${from.name[lang]} · ${from.symbol}</span>
            <h2>${result ? `${formatCurrencyAmount(result.amount, fromCurrency, lang)} = ${formatCurrencyAmount(result.converted, toCurrency, lang)}` : copy.loadingRate}</h2>
            <span>${to.flag} ${to.code} ${to.name[lang]} · ${to.symbol}</span>
          </div>
          ${rate ? `<p>${copy.pairRate}: 1 ${fromCurrency} = ${formatPlainNumber(rate.rate, lang)} ${toCurrency}</p><p>${copy.reversePairRate}: 1 ${toCurrency} = ${formatPlainNumber(1 / rate.rate, lang)} ${fromCurrency}</p><p>${copy.rateDate}: ${rate.date}${rate.cached ? ` · ${copy.cachedRate}` : ''}</p><p>${copy.lastRefreshed}: ${new Intl.DateTimeFormat(localeForLanguage(lang), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(rate.refreshedAt))}</p>` : `<p>${copy.noCachedData}</p>`}
          <button class="ghost" id="retry-rate">${copy.retry}</button>
        </article>
        <article class="card">
          <h3>${copy.moneyInfo}</h3>
          <p>${copy.officialCurrency}: ${city.money.localCurrencies.map((item) => `${item.name} - ${item.code} (${item.symbol})`).join(', ')}</p>
          ${city.money.denominations ? `<p>${copy.denominations}: ${esc(city.money.denominations)}</p>` : ''}
          ${city.money.cardsCommonlyAccepted ? `<p>${copy.cardsAccepted}: ${statusBadge(city.money.cardsCommonlyAccepted)}</p>` : ''}
          <p>${copy.paymentWarning}</p>
        </article>
        <article class="card">
          <div class="card-top"><h3>${copy.rateHistory}</h3><select id="history-days"><option value="7" ${historyDays === 7 ? 'selected' : ''}>${copy.sevenDays}</option><option value="30" ${historyDays === 30 ? 'selected' : ''}>${copy.thirtyDays}</option><option value="90" ${historyDays === 90 ? 'selected' : ''}>${copy.ninetyDays}</option></select></div>
          ${history || `<p>${copy.noCachedData}</p>`}
        </article>
      </section>
    </main>`;
  bindMoneyPage();
}

function bindMoneyPage() {
  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => { lang = (event.target as HTMLSelectElement).value as Language; moneyPage(); });
  document.querySelector<HTMLButtonElement>('#back-from-money')?.addEventListener('click', () => { view = 'planner'; if (window.location.hash) history.pushState(null, '', window.location.pathname + window.location.search); render(); });
  document.querySelector<HTMLInputElement>('#money-amount')?.addEventListener('input', (event) => {
    amountInput = (event.target as HTMLInputElement).value;
    const parsed = parseAmountInput(amountInput);
    moneyStatus = parsed.error && parsed.error !== 'empty' ? 'invalidAmount' : moneyStatus;
    moneyPage();
  });
  document.querySelector<HTMLInputElement>('#currency-search')?.addEventListener('input', (event) => {
    currencySearch = (event.target as HTMLInputElement).value;
    moneyPage();
  });
  document.querySelector<HTMLSelectElement>('#from-currency')?.addEventListener('change', (event) => {
    fromCurrency = (event.target as HTMLSelectElement).value;
    localStorage.setItem('mtp-home-currency', fromCurrency);
    scheduleRateLoad();
  });
  document.querySelector<HTMLSelectElement>('#to-currency')?.addEventListener('change', (event) => {
    toCurrency = (event.target as HTMLSelectElement).value;
    scheduleRateLoad();
  });
  document.querySelector<HTMLButtonElement>('#swap-currencies')?.addEventListener('click', () => {
    [fromCurrency, toCurrency] = [toCurrency, fromCurrency];
    localStorage.setItem('mtp-home-currency', fromCurrency);
    void loadPairRate();
  });
  document.querySelector<HTMLButtonElement>('#clear-money')?.addEventListener('click', () => {
    amountInput = '';
    moneyStatus = 'idle';
    moneyPage();
  });
  document.querySelector<HTMLButtonElement>('#refresh-rate')?.addEventListener('click', () => void loadPairRate(false));
  document.querySelector<HTMLButtonElement>('#retry-rate')?.addEventListener('click', () => void loadPairRate());
  document.querySelector<HTMLButtonElement>('#copy-result')?.addEventListener('click', async () => {
    const parsed = parseAmountInput(amountInput);
    if (parsed.value === null || !rate) return;
    const result = convertAmount(parsed.value, rate.rate);
    await navigator.clipboard?.writeText(`${parsed.value} ${fromCurrency} = ${result.converted} ${toCurrency}`);
    moneyStatus = 'copied';
    moneyPage();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-quick]').forEach((button) => button.addEventListener('click', () => {
    toCurrency = button.dataset.quick ?? toCurrency;
    scheduleRateLoad();
  }));
  document.querySelector<HTMLSelectElement>('#history-days')?.addEventListener('change', (event) => {
    historyDays = Number((event.target as HTMLSelectElement).value) as 7 | 30 | 90;
    void loadHistory();
  });
}

function render() {
  if (!root) return;
  if (view === 'qibla') {
    qiblaPage();
    return;
  }
  if (view === 'prayer-spaces') {
    prayerPage();
    return;
  }
  if (view === 'money') {
    moneyPage();
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
      <section class="panel quick-actions">
        <article class="quick-action"><div><h2>${copy.qiblaTitle}</h2><p>${copy.qiblaSubtitle}</p></div><button type="button" id="open-qibla">${copy.qiblaOpen}</button></article>
        <article class="quick-action"><div><h2>${copy.prayerSpacesTitle}</h2><p>${copy.prayerSpacesSubtitle}</p></div><button type="button" id="open-prayer-spaces">${copy.prayerSpacesOpen}</button></article>
        <article class="quick-action"><div><h2>${copy.moneyTitle}</h2><p>${copy.moneySubtitle}</p></div><button type="button" id="open-money">${copy.moneyOpen}</button></article>
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
  document.querySelector<HTMLButtonElement>('#open-prayer-spaces')?.addEventListener('click', () => {
    view = 'prayer-spaces';
    if (window.location.hash !== '#prayer-spaces') window.location.hash = 'prayer-spaces';
    render();
  });
  document.querySelector<HTMLButtonElement>('#open-money')?.addEventListener('click', () => {
    view = 'money';
    toCurrency = destinationCurrency(selectedCity());
    if (window.location.hash !== '#money') window.location.hash = 'money';
    void loadCurrencies();
    void loadPairRate();
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
  view = viewFromHash();
  if (view === 'planner') { stopQiblaOrientation(); prayerMap?.remove(); prayerMap = undefined; }
  if (view === 'money') {
    toCurrency = destinationCurrency(selectedCity());
    void loadCurrencies();
    void loadPairRate();
  }
  render();
});

if (view === 'money') {
  toCurrency = destinationCurrency(selectedCity());
  void loadCurrencies();
  void loadPairRate();
}

render();
