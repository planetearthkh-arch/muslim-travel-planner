import { cities } from './data.js';
import { generateItinerary } from './planner.js';
import { calculateQiblaBearing, formatCoordinate, normalizeDegrees } from './qibla.js';
import { buildOverpassQuery, ensureLatinDisplayName, getEnglishPlaceName, isReliablyOpenNow, normalizePrayerPlace, type PrayerPlace, type PrayerPlaceType } from './prayer-spaces.js';
import {
  buildHalalOverpassQuery,
  cuisineOptions,
  dedupeRestaurants,
  filterRestaurants,
  normalizeHalalRestaurant,
  sortRestaurants,
  type FoodPlaceType,
  type HalalRestaurant,
  type HalalStatus,
  type RestaurantFilters,
} from './halal-restaurants.js';
import {
  buildToiletOverpassQuery,
  dedupeToilets,
  filterToilets,
  normalizePublicToilet,
  sortToilets,
  type PublicToilet,
  type ToiletAccess,
  type ToiletFilters,
  type ToiletSort,
} from './public-toilets.js';
import {
  buildCarRentalOverpassQuery,
  dedupeCarRentalOffices,
  filterCarRentalOffices,
  normalizeCarRentalOffice,
  sortCarRentalOffices,
  type CarRentalFilters,
  type CarRentalLocationType,
  type CarRentalOffice,
  type CarRentalSort,
} from './car-rental.js';
import {
  OPEN_METEO_FORECAST_URL,
  WEATHER_CACHE_MS,
  buildWeatherUrl,
  formatPrecipitation,
  formatTemperature,
  formatWind,
  hourlyForDay,
  matchPrayerWeather,
  packingSuggestions,
  selectHourlyForecast,
  travelWeatherIndicators,
  validateWeatherResponse,
  weatherCodeInfo,
  windDirectionLabel,
  type WeatherForecast,
  type WeatherPoint,
  type WeatherUnits,
} from './weather.js';
import {
  buildAttractionOverpassBatches,
  categoryExplanation,
  commonsCategoryFromTag,
  commonsCategoryImagesUrl,
  commonsFilenameFromImageUrl,
  commonsFilenameFromTag,
  commonsImageInfoUrl,
  commonsSearchUrl,
  dedupeAttractions,
  enrichAttraction,
  filterAttractions,
  firstLicensedCommonsImage,
  normalizeAttraction,
  normalizeCommonsImage,
  parseWikipediaTag,
  selectHighConfidenceCommonsImage,
  sortAttractions,
  wikidataEnglishDescription,
  wikidataEnglishAliases,
  wikidataEnglishLabel,
  wikidataEnglishTitle,
  wikidataEntityUrl,
  wikidataP18Filename,
  wikipediaSummaryUrlFor,
  type Attraction,
  type AttractionQueryBatch,
  type AttractionPhoto,
  type AttractionCategory,
  type AttractionFilters,
  type AttractionSort,
  type AttractionView,
} from './attractions.js';
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
type View = 'planner' | 'qibla' | 'prayer-spaces' | 'money' | 'halal-restaurants' | 'public-toilets' | 'car-rental' | 'weather' | 'attractions';
type QiblaLocation = { latitude: number; longitude: number; accuracy?: number };
type QiblaLocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable';
type QiblaMotionStatus = 'idle' | 'active' | 'denied' | 'unavailable';
type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };
type CompassOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

const viewFromHash = (): View => window.location.hash === '#qibla' ? 'qibla' : window.location.hash === '#prayer-spaces' ? 'prayer-spaces' : window.location.hash === '#money' ? 'money' : window.location.hash === '#halal-restaurants' ? 'halal-restaurants' : window.location.hash === '#public-toilets' ? 'public-toilets' : window.location.hash === '#car-rental' ? 'car-rental' : window.location.hash === '#weather' ? 'weather' : window.location.hash === '#attractions' ? 'attractions' : 'planner';
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
let generatedPrefs: PlannerPreferences | null = null;
let plannerValidation = '';
let plannerAnnouncement = '';

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
  fitBounds?: (bounds: [[number, number], [number, number]], options?: { padding?: number; maxZoom?: number }) => void;
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
let restaurantMap: MapLibreMap | undefined;
let toiletMap: MapLibreMap | undefined;
let carRentalMap: MapLibreMap | undefined;
let attractionsMap: MapLibreMap | undefined;
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

function athanSection(city: (typeof cities)[number], planPrefs: PlannerPreferences = prefs) {
  const copy = athanLabels[lang];
  const locale = localeForLanguage(lang);
  const times = calculatePrayerDisplay(city, planPrefs.prayerMethod, planPrefs.startDate, locale);
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
type RestaurantStatus = PrayerLocationStatus | 'too-many' | 'cached' | 'offline' | 'timeout';
type RestaurantMode = 'map' | 'list';
type RestaurantSort = 'distance' | 'name' | 'status' | 'open' | 'cuisine';
type ToiletStatus = RestaurantStatus;
type ToiletMode = 'map' | 'list';
type CarRentalStatus = RestaurantStatus;
type CarRentalMode = 'map' | 'list';
type CarRentalSearchKind = 'destination' | 'airport' | 'station';
type WeatherStatus = 'idle' | 'requesting' | 'loading' | 'ready' | 'updated' | 'denied' | 'unavailable' | 'service-unavailable' | 'timeout' | 'invalid' | 'offline' | 'cached' | 'no-cache' | 'unsupported';
type WeatherLocation = { latitude: number; longitude: number; label: string; country?: string; timezone?: string };
type AttractionStatus = RestaurantStatus | 'photos' | 'history';

type OverpassResponse = { elements?: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: Record<string, string | undefined> }> };
type NominatimResult = { lat: string; lon: string; display_name: string };

const prayerRadii = [1, 3, 5, 10, 25, 50] as const;
const toiletRadii = [0.5, 1, 3, 5, 10, 25] as const;
const carRentalRadii = [3, 5, 10, 25, 50, 100] as const;
const attractionRadii = [1, 3, 5, 10, 25, 50] as const;
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
let restaurantStatus: RestaurantStatus = 'idle';
let restaurantMode: RestaurantMode = 'map';
let restaurantCenter: PrayerCenter | undefined;
let restaurantRadiusKm: typeof prayerRadii[number] = 5;
let restaurantManualQuery = '';
let restaurantResults: HalalRestaurant[] = [];
let restaurantFilters: RestaurantFilters = { status: 'reliable', type: 'all', cuisine: '', openNow: false, takeaway: false, delivery: false, wheelchair: false };
let restaurantSort: RestaurantSort = 'distance';
let restaurantMapMoved = false;
let restaurantError = '';
let restaurantSearchTimer: number | undefined;
let restaurantSearchSequence = 0;
let selectedRestaurantId = '';
const restaurantCache = new Map<string, { expires: number; results: HalalRestaurant[] }>();
const destinationCache = new Map<string, { expires: number; center?: PrayerCenter }>();
let toiletStatus: ToiletStatus = 'idle';
let toiletMode: ToiletMode = 'map';
let toiletCenter: PrayerCenter | undefined;
let toiletRadiusKm: typeof toiletRadii[number] = 1;
let toiletManualQuery = '';
let toiletResults: PublicToilet[] = [];
let toiletFilters: ToiletFilters = { access: 'all', free: false, paid: false, openNow: false, open24: false, wheelchair: false, limitedWheelchair: false, changing: false, female: false, male: false, unisex: false, handwashing: false, shower: false, drinkingWater: false, seated: false, squat: false };
let toiletSort: ToiletSort = 'distance';
let toiletMapMoved = false;
let toiletError = '';
let toiletSearchTimer: number | undefined;
let toiletSearchSequence = 0;
const toiletCache = new Map<string, { expires: number; results: PublicToilet[] }>();
let carRentalStatus: CarRentalStatus = 'idle';
let carRentalMode: CarRentalMode = 'map';
let carRentalCenter: PrayerCenter | undefined;
let carRentalRadiusKm: typeof carRentalRadii[number] = 10;
let carRentalManualQuery = '';
let carRentalSearchKind: CarRentalSearchKind = 'destination';
let carRentalResults: CarRentalOffice[] = [];
let carRentalFilters: CarRentalFilters = { type: 'all', openNow: false, open24: false, website: false, phone: false, wheelchair: false, atAirport: false };
let carRentalSort: CarRentalSort = 'distance';
let carRentalMapMoved = false;
let carRentalError = '';
let carRentalSearchTimer: number | undefined;
let carRentalSearchSequence = 0;
const carRentalCache = new Map<string, { expires: number; results: CarRentalOffice[] }>();
let weatherStatus: WeatherStatus = 'idle';
let weatherLocation: WeatherLocation | undefined;
let weatherManualQuery = '';
let weatherForecast: WeatherForecast | null = null;
let weatherError = '';
let weatherHours = 24;
let weatherSelectedDay = '';
let weatherRequestSequence = 0;
let weatherUnits: WeatherUnits = {
  temperature: (localStorage.getItem('mtp-weather-temp') as WeatherUnits['temperature']) || 'celsius',
  wind: (localStorage.getItem('mtp-weather-wind') as WeatherUnits['wind']) || 'kmh',
  precipitation: (localStorage.getItem('mtp-weather-precip') as WeatherUnits['precipitation']) || 'mm',
};
let attractionStatus: AttractionStatus = 'idle';
let attractionView: AttractionView = 'photos';
let attractionCenter: PrayerCenter | undefined;
let attractionRadiusKm: typeof attractionRadii[number] = 5;
let attractionManualQuery = '';
let attractionResults: Attraction[] = [];
let attractionFilters: AttractionFilters = { category: 'all', photo: false, history: false, openNow: false, free: false, wheelchair: false };
let attractionSort: AttractionSort = 'distance';
let attractionMapMoved = false;
let attractionError = '';
let attractionSearchTimer: number | undefined;
let attractionSearchSequence = 0;
let attractionEnrichmentSequence = 0;
let selectedAttractionId = '';
let attractionDiagnostics: string[] = [];
const attractionCache = new Map<string, { expires: number; results: Attraction[] }>();
const attractionEnrichmentCache = new Map<string, { expires: number; result: Attraction }>();
let attractionCacheKey = '';

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

function overpassUrl() { return localStorage.getItem('mtp-overpass-endpoint') ?? 'https://overpass-api.de/api/interpreter'; }

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
        ${['empty', 'service-unavailable'].includes(prayerStatus) ? `<div class="empty-actions"><button type="button" id="retry-prayer" class="ghost">${copy.prayerRetry}</button><button type="button" id="increase-radius">${copy.prayerIncreaseRadius}</button></div>` : ''}
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

function halalStatusLabel(status: HalalStatus, copy: typeof labels[Language]) {
  if (status === 'halal-only') return copy.halalOnly;
  if (status === 'halal-options') return copy.halalOptions;
  if (status === 'certification-listed') return copy.halalCertificationListed;
  if (status === 'legacy-halal') return copy.halalLegacy;
  return copy.halalPossible;
}

function foodTypeLabel(type: FoodPlaceType, copy: typeof labels[Language]) {
  if (type === 'fast_food') return copy.halalFastFood;
  if (type === 'cafe') return copy.halalCafe;
  if (type === 'food_court') return copy.halalFoodCourt;
  return copy.halalRestaurant;
}

function restaurantStatusMessage(copy: typeof labels[Language]) {
  if (restaurantStatus === 'requesting') return copy.halalRequestingLocation;
  if (restaurantStatus === 'searching') return copy.halalSearching;
  if (restaurantStatus === 'denied') return copy.halalLocationDenied;
  if (restaurantStatus === 'unavailable') return copy.halalLocationUnavailable;
  if (restaurantStatus === 'service-unavailable') return restaurantError || copy.halalServiceUnavailable;
  if (restaurantStatus === 'timeout') return copy.halalTimedOut;
  if (restaurantStatus === 'too-many') return copy.halalTooMany;
  if (restaurantStatus === 'cached') return copy.halalCached;
  if (restaurantStatus === 'offline') return copy.halalOffline;
  if (restaurantStatus === 'empty') return copy.halalNoResults;
  return '';
}

function restaurantAppleMapsUrl(restaurant: HalalRestaurant) {
  return `https://maps.apple.com/?daddr=${restaurant.latitude},${restaurant.longitude}&q=${encodeURIComponent(restaurant.name)}`;
}

function restaurantBrowserDirectionsUrl(restaurant: HalalRestaurant) {
  return `https://www.openstreetmap.org/directions?to=${restaurant.latitude},${restaurant.longitude}#map=17/${restaurant.latitude}/${restaurant.longitude}`;
}

function filteredRestaurantResults() {
  return sortRestaurants(filterRestaurants(restaurantResults, restaurantFilters), restaurantSort);
}

async function resolveRestaurantDestination(query: string): Promise<PrayerCenter | undefined> {
  const trimmed = query.trim();
  if (!trimmed) return undefined;
  const city = cities.find((candidate) => `${candidate.city} ${candidate.country}`.toLowerCase().includes(trimmed.toLowerCase()) || candidate.city.toLowerCase() === trimmed.toLowerCase());
  if (city) return { latitude: city.coordinates.lat, longitude: city.coordinates.lng, label: `${city.city}, ${city.country}` };
  const cached = destinationCache.get(trimmed.toLowerCase());
  if (cached && cached.expires > Date.now()) return cached.center;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=en&q=${encodeURIComponent(trimmed)}`;
  const data = await requestJson<NominatimResult[]>(url, { headers: { Accept: 'application/json' } }, 12000);
  const first = data[0];
  const center = first ? { latitude: Number(first.lat), longitude: Number(first.lon), label: first.display_name } : undefined;
  destinationCache.set(trimmed.toLowerCase(), { expires: Date.now() + 15 * 60 * 1000, center });
  return center;
}

async function searchHalalRestaurants(center: PrayerCenter) {
  restaurantCenter = center;
  restaurantMapMoved = false;
  selectedRestaurantId = '';
  const cacheKey = `${center.latitude.toFixed(4)},${center.longitude.toFixed(4)},${restaurantRadiusKm}`;
  const cached = restaurantCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    restaurantResults = cached.results;
    restaurantStatus = restaurantResults.length ? 'cached' : 'empty';
    halalRestaurantsPage();
    return;
  }
  const sequence = ++restaurantSearchSequence;
  restaurantStatus = 'searching';
  restaurantError = '';
  halalRestaurantsPage();
  try {
    const body = buildHalalOverpassQuery(center.latitude, center.longitude, restaurantRadiusKm);
    const data = await requestJson<OverpassResponse>(overpassUrl(), { method: 'POST', body }, 20000);
    if (sequence !== restaurantSearchSequence) return;
    const normalized = (data.elements ?? [])
      .map((element) => normalizeHalalRestaurant(element, center, true))
      .filter((place): place is HalalRestaurant => Boolean(place));
    restaurantResults = dedupeRestaurants(normalized).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 350);
    restaurantCache.set(cacheKey, { expires: Date.now() + 5 * 60 * 1000, results: restaurantResults });
    restaurantStatus = normalized.length > 350 ? 'too-many' : restaurantResults.length ? 'ready' : 'empty';
  } catch (error) {
    console.error(error);
    if (cached) {
      restaurantResults = cached.results;
      restaurantStatus = navigator.onLine ? 'cached' : 'offline';
    } else {
      restaurantResults = [];
      restaurantStatus = error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'service-unavailable';
      restaurantError = labels[lang].halalServiceUnavailable;
    }
  }
  halalRestaurantsPage();
}

function requestRestaurantLocation() {
  if (!navigator.geolocation) {
    restaurantStatus = 'unavailable';
    halalRestaurantsPage();
    return;
  }
  restaurantStatus = 'requesting';
  halalRestaurantsPage();
  navigator.geolocation.getCurrentPosition(
    (position) => void searchHalalRestaurants({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: labels[lang].qiblaLocation }),
    (error) => {
      restaurantStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      halalRestaurantsPage();
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

async function searchRestaurantDestination() {
  const query = restaurantManualQuery.trim();
  if (!query) return;
  restaurantStatus = 'searching';
  halalRestaurantsPage();
  try {
    const center = await resolveRestaurantDestination(query);
    if (!center) {
      restaurantResults = [];
      restaurantStatus = 'empty';
      halalRestaurantsPage();
      return;
    }
    await searchHalalRestaurants(center);
  } catch (error) {
    console.error(error);
    restaurantStatus = 'service-unavailable';
    restaurantError = labels[lang].halalServiceUnavailable;
    halalRestaurantsPage();
  }
}

function debouncedRestaurantSearch(center: PrayerCenter) {
  if (restaurantSearchTimer) window.clearTimeout(restaurantSearchTimer);
  restaurantSearchTimer = window.setTimeout(() => void searchHalalRestaurants(center), 450);
}

function initializeRestaurantMap() {
  restaurantMap?.remove();
  restaurantMap = undefined;
  const element = document.querySelector<HTMLElement>('#halal-map');
  if (!element || !restaurantCenter || !window.maplibregl) return;
  try {
    element.replaceChildren();
    restaurantMap = new window.maplibregl.Map({
      container: element,
      style: openFreeMapStyle,
      center: [restaurantCenter.longitude, restaurantCenter.latitude],
      zoom: restaurantRadiusKm <= 3 ? 13 : restaurantRadiusKm <= 10 ? 11 : 9,
      attributionControl: true,
    });
    restaurantMap.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), document.documentElement.dir === 'rtl' ? 'top-right' : 'top-left');
    new window.maplibregl.Marker({ color: '#0f766e' }).setLngLat([restaurantCenter.longitude, restaurantCenter.latitude]).setPopup(new window.maplibregl.Popup({ offset: 18 }).setText(restaurantCenter.label)).addTo(restaurantMap);
    const colors: Record<HalalStatus, string> = { 'halal-only': '#15803d', 'halal-options': '#2563eb', 'certification-listed': '#7c3aed', 'legacy-halal': '#d97706', 'possible-unverified': '#64748b' };
    const groups = new Map<string, HalalRestaurant[]>();
    for (const place of filteredRestaurantResults()) {
      const key = `${place.latitude.toFixed(5)},${place.longitude.toFixed(5)}`;
      groups.set(key, [...(groups.get(key) ?? []), place]);
    }
    for (const group of groups.values()) {
      const place = group[0];
      const label = group.length > 1 ? `${group.length} places near ${place.name}` : place.name;
      new window.maplibregl.Marker({ color: colors[place.halalStatus] })
        .setLngLat([place.longitude, place.latitude])
        .setPopup(new window.maplibregl.Popup({ offset: 18 }).setText(label))
        .addTo(restaurantMap);
    }
    restaurantMap.on('moveend', () => {
      restaurantMapMoved = true;
      const button = document.querySelector<HTMLButtonElement>('#halal-search-this-area');
      if (button) button.hidden = false;
    });
  } catch {
    if (element) element.innerHTML = `<p class="map-fallback">${labels[lang].mapUnavailable}</p>`;
  }
}

function restaurantDetails(place: HalalRestaurant, copy: typeof labels[Language]) {
  const rows = [
    [copy.halalCuisineLabel, place.cuisine.join(', ')],
    [copy.prayerAddress, place.address],
    [copy.prayerOpeningHours, place.openingHours || copy.halalOpeningUnavailable],
    [copy.prayerTelephone, place.phone],
    [copy.prayerWebsite, place.website ? `<a href="${esc(place.website)}" target="_blank" rel="noopener noreferrer">${esc(place.website)}</a>` : ''],
    [copy.halalMenu, place.menu ? `<a href="${esc(place.menu)}" target="_blank" rel="noopener noreferrer">${esc(place.menu)}</a>` : ''],
    [copy.halalPrice, place.price],
    [copy.halalTakeaway, place.takeaway ? copy.prayerVerified : ''],
    [copy.halalDelivery, place.delivery ? copy.prayerVerified : ''],
    [copy.halalOutdoor, place.outdoorSeating ? copy.prayerVerified : ''],
    [copy.halalWheelchair, place.wheelchair ? copy.prayerVerified : ''],
  ].filter(([, value]) => Boolean(value));
  return rows.length ? `<dl class="place-details">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>` : '';
}

function restaurantCard(restaurant: HalalRestaurant, copy: typeof labels[Language]) {
  const openLabel = restaurant.openState === 'open' ? copy.halalOpen : restaurant.openState === 'closed' ? copy.halalClosed : copy.halalOpeningUnavailable;
  const notice = restaurant.halalStatus === 'certification-listed' ? `${copy.halalCertificationNotice}: ${esc(restaurant.certification)}` : restaurant.halalStatus === 'legacy-halal' ? copy.halalLegacyNotice : restaurant.halalStatus === 'possible-unverified' ? copy.halalPossibleNotice : '';
  return `<article class="card restaurant-card ${selectedRestaurantId === restaurant.id ? 'selected' : ''}" aria-label="${esc(restaurant.name)}">
    <div class="card-top"><span>${restaurant.distanceKm.toFixed(1)} km · ${foodTypeLabel(restaurant.type, copy)}</span><span class="badge halal-${restaurant.halalStatus}">${halalStatusLabel(restaurant.halalStatus, copy)}</span></div>
    <h3>${esc(restaurant.name)}</h3>
    <p>${openLabel}</p>
    ${notice ? `<p class="evidence">${notice}</p>` : ''}
    ${restaurantDetails(restaurant, copy)}
    <div class="place-actions">
      <a class="map-link" href="${restaurant.sourceUrl}" target="_blank" rel="noopener noreferrer">${copy.prayerViewOnMap}</a>
      <a class="map-link" href="${restaurantAppleMapsUrl(restaurant)}" target="_blank" rel="noopener noreferrer">${copy.prayerAppleMaps}</a>
      <a class="map-link" href="${restaurantBrowserDirectionsUrl(restaurant)}" target="_blank" rel="noopener noreferrer">${copy.prayerBrowserMap}</a>
      <button type="button" class="ghost" data-copy-restaurant="${restaurant.id}">${copy.halalCopyDetails}</button>
    </div>
    <p><a class="map-link" href="${restaurant.sourceUrl}" target="_blank" rel="noopener noreferrer">${copy.halalInfoIssue}</a></p>
  </article>`;
}

function halalRestaurantsPage() {
  if (!root) return;
  cityMap?.remove();
  cityMap = undefined;
  prayerMap?.remove();
  prayerMap = undefined;
  const copy = labels[lang];
  const dir = languageDirection(lang);
  const results = filteredRestaurantResults();
  const cuisines = cuisineOptions(restaurantResults);
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  root.innerHTML = `
    <main dir="${dir}" class="app prayer-app halal-app">
      <section class="hero prayer-hero">
        ${languageSelector()}
        <p class="eyebrow">${copy.halalRestaurantsOpen}</p>
        <h1>${copy.halalRestaurantsTitle}</h1>
        <p>${copy.halalRestaurantsSubtitle}</p>
        <button type="button" class="ghost hero-action" id="back-from-halal">${copy.halalRestaurantsBack}</button>
      </section>
      <section class="panel prayer-panel" aria-live="polite">
        <p class="notice prayer-notice">${copy.halalNotice}</p>
        <p class="notice prayer-notice">${copy.halalMeaningNotice}</p>
        <div class="prayer-actions">
          <button type="button" id="use-halal-location">${copy.halalUseLocation}</button>
          <label>${copy.halalRadius}<select id="halal-radius">${prayerRadii.map((radius) => `<option value="${radius}" ${radius === restaurantRadiusKm ? 'selected' : ''}>${radius} km</option>`).join('')}</select></label>
          <form id="manual-halal-search" class="manual-search"><label>${copy.halalManualSearch}<input id="halal-manual-query" value="${esc(restaurantManualQuery)}" placeholder="${copy.halalManualPlaceholder}" /></label><button type="submit">${copy.halalSearch}</button></form>
        </div>
        <p class="prayer-status ${restaurantStatus}" role="status">${restaurantStatusMessage(copy)}</p>
        <div class="segmented" role="tablist" aria-label="${copy.halalRestaurantsTitle}">
          <button type="button" class="${restaurantMode === 'map' ? 'active' : 'ghost'}" data-halal-mode="map">${copy.halalMapView}</button>
          <button type="button" class="${restaurantMode === 'list' ? 'active' : 'ghost'}" data-halal-mode="list">${copy.halalListView}</button>
        </div>
        <div class="prayer-filters" aria-label="${copy.halalRestaurantsTitle}">
          <select id="halal-status-filter"><option value="reliable">${copy.halalAllReliable}</option><option value="halal-only" ${restaurantFilters.status === 'halal-only' ? 'selected' : ''}>${copy.halalOnly}</option><option value="halal-options" ${restaurantFilters.status === 'halal-options' ? 'selected' : ''}>${copy.halalOptions}</option><option value="certification-listed" ${restaurantFilters.status === 'certification-listed' ? 'selected' : ''}>${copy.halalCertificationListed}</option><option value="legacy-halal" ${restaurantFilters.status === 'legacy-halal' ? 'selected' : ''}>${copy.halalLegacy}</option><option value="possible-unverified" ${restaurantFilters.status === 'possible-unverified' ? 'selected' : ''}>${copy.halalPossible}</option></select>
          <select id="halal-type-filter"><option value="all">${copy.prayerAllPlaces}</option><option value="restaurant" ${restaurantFilters.type === 'restaurant' ? 'selected' : ''}>${copy.halalRestaurant}</option><option value="fast_food" ${restaurantFilters.type === 'fast_food' ? 'selected' : ''}>${copy.halalFastFood}</option><option value="cafe" ${restaurantFilters.type === 'cafe' ? 'selected' : ''}>${copy.halalCafe}</option><option value="food_court" ${restaurantFilters.type === 'food_court' ? 'selected' : ''}>${copy.halalFoodCourt}</option></select>
          <label>${copy.halalCuisine}<select id="halal-cuisine-filter"><option value="">${copy.halalAllCuisines}</option>${cuisines.map((cuisine) => `<option value="${esc(cuisine)}" ${restaurantFilters.cuisine === cuisine ? 'selected' : ''}>${esc(cuisine)}</option>`).join('')}</select></label>
          <label class="inline-check"><input type="checkbox" id="halal-open" ${restaurantFilters.openNow ? 'checked' : ''}/> ${copy.halalOpenNow}</label>
          <label class="inline-check"><input type="checkbox" id="halal-takeaway" ${restaurantFilters.takeaway ? 'checked' : ''}/> ${copy.halalTakeaway}</label>
          <label class="inline-check"><input type="checkbox" id="halal-delivery" ${restaurantFilters.delivery ? 'checked' : ''}/> ${copy.halalDelivery}</label>
          <label class="inline-check"><input type="checkbox" id="halal-wheelchair" ${restaurantFilters.wheelchair ? 'checked' : ''}/> ${copy.halalWheelchair}</label>
          <label>${copy.halalSort}<select id="halal-sort"><option value="distance" ${restaurantSort === 'distance' ? 'selected' : ''}>${copy.halalNearest}</option><option value="name" ${restaurantSort === 'name' ? 'selected' : ''}>${copy.halalSortName}</option><option value="status" ${restaurantSort === 'status' ? 'selected' : ''}>${copy.halalSortStatus}</option><option value="open" ${restaurantSort === 'open' ? 'selected' : ''}>${copy.halalSortOpen}</option><option value="cuisine" ${restaurantSort === 'cuisine' ? 'selected' : ''}>${copy.halalSortCuisine}</option></select></label>
        </div>
        <div class="place-actions">
          <button type="button" id="halal-search-this-area" class="ghost" ${restaurantMapMoved ? '' : 'hidden'}>${copy.halalSearchThisArea}</button>
          <button type="button" id="halal-recentre" class="ghost">${copy.halalRecentre}</button>
          <button type="button" id="halal-fit-results" class="ghost">${copy.halalFitResults}</button>
        </div>
        <div class="legend halal-legend"><strong>${copy.halalLegend}</strong><span class="badge halal-halal-only">${copy.halalOnly}</span><span class="badge halal-halal-options">${copy.halalOptions}</span><span class="badge halal-certification-listed">${copy.halalCertificationListed}</span><span class="badge halal-legacy-halal">${copy.halalLegacy}</span><span class="badge halal-possible-unverified">${copy.halalPossible}</span></div>
        ${restaurantMode === 'map' ? `<div id="halal-map" class="city-map prayer-map"><p class="map-fallback">${copy.mapUnavailable}</p></div>` : ''}
        ${(['empty', 'timeout', 'service-unavailable', 'offline'].includes(restaurantStatus) || !results.length && restaurantResults.length > 0) ? `<div class="empty-actions"><button type="button" id="retry-halal" class="ghost">${copy.halalRetry}</button>${restaurantStatus === 'timeout' ? '' : `<button type="button" id="increase-halal-radius">${copy.halalIncreaseRadius}</button>`}<button type="button" id="another-halal-city" class="ghost">${copy.halalSearchAnotherCity}</button></div>` : ''}
        <div class="place-list">${results.length ? results.map((place) => restaurantCard(place, copy)).join('') : restaurantStatus === 'ready' ? `<p>${copy.halalNoReliable}</p>` : ''}</div>
        <p class="map-status">${copy.osmAttribution}</p>
      </section>
    </main>`;
  bindHalalRestaurantsPage();
  if (restaurantMode === 'map') initializeRestaurantMap();
}

function bindHalalRestaurantsPage() {
  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => { lang = (event.target as HTMLSelectElement).value as Language; halalRestaurantsPage(); });
  document.querySelector<HTMLButtonElement>('#back-from-halal')?.addEventListener('click', () => { view = 'planner'; restaurantMap?.remove(); restaurantMap = undefined; if (window.location.hash) history.pushState(null, '', window.location.pathname + window.location.search); render(); });
  document.querySelector<HTMLButtonElement>('#use-halal-location')?.addEventListener('click', requestRestaurantLocation);
  document.querySelector<HTMLSelectElement>('#halal-radius')?.addEventListener('change', (event) => { restaurantRadiusKm = Number((event.target as HTMLSelectElement).value) as typeof prayerRadii[number]; if (restaurantCenter) void searchHalalRestaurants(restaurantCenter); });
  document.querySelector<HTMLFormElement>('#manual-halal-search')?.addEventListener('submit', (event) => { event.preventDefault(); restaurantManualQuery = document.querySelector<HTMLInputElement>('#halal-manual-query')?.value ?? ''; void searchRestaurantDestination(); });
  document.querySelectorAll<HTMLButtonElement>('[data-halal-mode]').forEach((button) => button.addEventListener('click', () => { restaurantMode = button.dataset.halalMode as RestaurantMode; halalRestaurantsPage(); }));
  document.querySelector<HTMLSelectElement>('#halal-status-filter')?.addEventListener('change', (event) => { restaurantFilters = { ...restaurantFilters, status: (event.target as HTMLSelectElement).value as RestaurantFilters['status'] }; halalRestaurantsPage(); });
  document.querySelector<HTMLSelectElement>('#halal-type-filter')?.addEventListener('change', (event) => { restaurantFilters = { ...restaurantFilters, type: (event.target as HTMLSelectElement).value as RestaurantFilters['type'] }; halalRestaurantsPage(); });
  document.querySelector<HTMLSelectElement>('#halal-cuisine-filter')?.addEventListener('change', (event) => { restaurantFilters = { ...restaurantFilters, cuisine: (event.target as HTMLSelectElement).value }; halalRestaurantsPage(); });
  document.querySelector<HTMLInputElement>('#halal-open')?.addEventListener('change', (event) => { restaurantFilters = { ...restaurantFilters, openNow: (event.target as HTMLInputElement).checked }; halalRestaurantsPage(); });
  document.querySelector<HTMLInputElement>('#halal-takeaway')?.addEventListener('change', (event) => { restaurantFilters = { ...restaurantFilters, takeaway: (event.target as HTMLInputElement).checked }; halalRestaurantsPage(); });
  document.querySelector<HTMLInputElement>('#halal-delivery')?.addEventListener('change', (event) => { restaurantFilters = { ...restaurantFilters, delivery: (event.target as HTMLInputElement).checked }; halalRestaurantsPage(); });
  document.querySelector<HTMLInputElement>('#halal-wheelchair')?.addEventListener('change', (event) => { restaurantFilters = { ...restaurantFilters, wheelchair: (event.target as HTMLInputElement).checked }; halalRestaurantsPage(); });
  document.querySelector<HTMLSelectElement>('#halal-sort')?.addEventListener('change', (event) => { restaurantSort = (event.target as HTMLSelectElement).value as RestaurantSort; halalRestaurantsPage(); });
  document.querySelector<HTMLButtonElement>('#retry-halal')?.addEventListener('click', () => { if (restaurantCenter) void searchHalalRestaurants(restaurantCenter); else requestRestaurantLocation(); });
  document.querySelector<HTMLButtonElement>('#increase-halal-radius')?.addEventListener('click', () => { const next = prayerRadii.find((radius) => radius > restaurantRadiusKm); if (next) restaurantRadiusKm = next; if (restaurantCenter) void searchHalalRestaurants(restaurantCenter); });
  document.querySelector<HTMLButtonElement>('#another-halal-city')?.addEventListener('click', () => document.querySelector<HTMLInputElement>('#halal-manual-query')?.focus());
  document.querySelector<HTMLButtonElement>('#halal-search-this-area')?.addEventListener('click', () => { const center = restaurantMap?.getCenter?.(); if (!center) return; debouncedRestaurantSearch({ latitude: center.lat, longitude: center.lng, label: labels[lang].halalSearchThisArea }); });
  document.querySelector<HTMLButtonElement>('#halal-recentre')?.addEventListener('click', requestRestaurantLocation);
  document.querySelector<HTMLButtonElement>('#halal-fit-results')?.addEventListener('click', () => {
    const results = filteredRestaurantResults();
    if (!restaurantMap?.fitBounds || !results.length) return;
    const lngs = results.map((place) => place.longitude);
    const lats = results.map((place) => place.latitude);
    restaurantMap.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 15 });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-copy-restaurant]').forEach((button) => button.addEventListener('click', async () => {
    const place = restaurantResults.find((candidate) => candidate.id === button.dataset.copyRestaurant);
    if (!place) return;
    await navigator.clipboard?.writeText(`${place.name}\n${place.sourceUrl}\n${place.latitude},${place.longitude}`);
    restaurantStatus = 'ready';
    button.textContent = labels[lang].halalCopiedDetails;
  }));
}

function toiletAccessLabel(access: ToiletAccess, copy: typeof labels[Language]) {
  if (access === 'public') return copy.toiletsPublicAccess;
  if (access === 'customers') return copy.toiletsCustomersOnly;
  if (access === 'restricted') return copy.toiletsRestricted;
  return copy.toiletsAccessUnknown;
}

function toiletKindLabel(toilet: PublicToilet, copy: typeof labels[Language]) {
  if (toilet.kind === 'accessible') return copy.toiletsWheelchair;
  if (toilet.kind === 'customers') return copy.toiletsCustomersOnly;
  if (toilet.kind === 'portable') return copy.toiletsPortable;
  if (toilet.kind === 'venue') return copy.toiletsVenue;
  if (toilet.kind === 'unknown') return copy.toiletsAccessUnknown;
  return copy.toiletsStandalone;
}

function toiletStatusMessage(copy: typeof labels[Language]) {
  if (toiletStatus === 'requesting') return copy.toiletsRequestingLocation;
  if (toiletStatus === 'searching') return copy.toiletsSearching;
  if (toiletStatus === 'denied') return copy.toiletsLocationDenied;
  if (toiletStatus === 'unavailable') return copy.toiletsLocationUnavailable;
  if (toiletStatus === 'service-unavailable') return toiletError || copy.toiletsServiceUnavailable;
  if (toiletStatus === 'timeout') return copy.toiletsTimedOut;
  if (toiletStatus === 'too-many') return copy.toiletsTooMany;
  if (toiletStatus === 'cached') return copy.toiletsCached;
  if (toiletStatus === 'offline') return copy.toiletsOffline;
  if (toiletStatus === 'empty') return copy.toiletsNoResults;
  return '';
}

function filteredToiletResults() {
  return sortToilets(filterToilets(toiletResults, toiletFilters), toiletSort);
}

async function searchPublicToilets(center: PrayerCenter) {
  toiletCenter = center;
  toiletMapMoved = false;
  const cacheKey = `${center.latitude.toFixed(4)},${center.longitude.toFixed(4)},${toiletRadiusKm}`;
  const cached = toiletCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    toiletResults = cached.results;
    toiletStatus = toiletResults.length ? 'cached' : 'empty';
    publicToiletsPage();
    return;
  }
  const sequence = ++toiletSearchSequence;
  toiletStatus = 'searching';
  toiletError = '';
  publicToiletsPage();
  try {
    const data = await requestJson<OverpassResponse>(overpassUrl(), { method: 'POST', body: buildToiletOverpassQuery(center.latitude, center.longitude, toiletRadiusKm) }, 20000);
    if (sequence !== toiletSearchSequence) return;
    const normalized = (data.elements ?? [])
      .map((element) => normalizePublicToilet(element, center))
      .filter((toilet): toilet is PublicToilet => Boolean(toilet));
    toiletResults = dedupeToilets(normalized).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 350);
    toiletCache.set(cacheKey, { expires: Date.now() + 5 * 60 * 1000, results: toiletResults });
    toiletStatus = normalized.length > 350 ? 'too-many' : toiletResults.length ? 'ready' : 'empty';
  } catch (error) {
    console.error(error);
    if (cached) {
      toiletResults = cached.results;
      toiletStatus = navigator.onLine ? 'cached' : 'offline';
    } else {
      toiletResults = [];
      toiletStatus = error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'service-unavailable';
      toiletError = labels[lang].toiletsServiceUnavailable;
    }
  }
  publicToiletsPage();
}

function requestToiletLocation() {
  if (!navigator.geolocation) {
    toiletStatus = 'unavailable';
    publicToiletsPage();
    return;
  }
  toiletStatus = 'requesting';
  publicToiletsPage();
  navigator.geolocation.getCurrentPosition(
    (position) => void searchPublicToilets({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: labels[lang].qiblaLocation }),
    (error) => {
      toiletStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      publicToiletsPage();
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

async function searchToiletDestination() {
  const query = toiletManualQuery.trim();
  if (!query) return;
  toiletStatus = 'searching';
  publicToiletsPage();
  try {
    const center = await resolveRestaurantDestination(query);
    if (!center) {
      toiletResults = [];
      toiletStatus = 'empty';
      publicToiletsPage();
      return;
    }
    await searchPublicToilets(center);
  } catch (error) {
    console.error(error);
    toiletStatus = 'service-unavailable';
    toiletError = labels[lang].toiletsServiceUnavailable;
    publicToiletsPage();
  }
}

function debouncedToiletSearch(center: PrayerCenter) {
  if (toiletSearchTimer) window.clearTimeout(toiletSearchTimer);
  toiletSearchTimer = window.setTimeout(() => void searchPublicToilets(center), 450);
}

function toiletAppleMapsUrl(toilet: PublicToilet) {
  return `https://maps.apple.com/?daddr=${toilet.latitude},${toilet.longitude}&q=${encodeURIComponent(toilet.name)}`;
}

function toiletBrowserDirectionsUrl(toilet: PublicToilet) {
  return `https://www.openstreetmap.org/directions?to=${toilet.latitude},${toilet.longitude}#map=17/${toilet.latitude}/${toilet.longitude}`;
}

function initializeToiletMap() {
  toiletMap?.remove();
  toiletMap = undefined;
  const element = document.querySelector<HTMLElement>('#toilet-map');
  if (!element || !toiletCenter || !window.maplibregl) return;
  try {
    element.replaceChildren();
    toiletMap = new window.maplibregl.Map({
      container: element,
      style: openFreeMapStyle,
      center: [toiletCenter.longitude, toiletCenter.latitude],
      zoom: toiletRadiusKm <= 1 ? 14 : toiletRadiusKm <= 5 ? 12 : 10,
      attributionControl: true,
    });
    toiletMap.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), document.documentElement.dir === 'rtl' ? 'top-right' : 'top-left');
    new window.maplibregl.Marker({ color: '#0f766e' }).setLngLat([toiletCenter.longitude, toiletCenter.latitude]).setPopup(new window.maplibregl.Popup({ offset: 18 }).setText(toiletCenter.label)).addTo(toiletMap);
    const colors: Record<ToiletAccess, string> = { public: '#15803d', customers: '#2563eb', restricted: '#d97706', unknown: '#64748b' };
    for (const toilet of filteredToiletResults()) {
      const icon = toilet.wheelchair === 'yes' ? ' ♿' : toilet.fee === 'paid' ? ' $' : ' WC';
      new window.maplibregl.Marker({ color: colors[toilet.access] }).setLngLat([toilet.longitude, toilet.latitude]).setPopup(new window.maplibregl.Popup({ offset: 18 }).setText(`${toilet.name}${icon}`)).addTo(toiletMap);
    }
    toiletMap.on('moveend', () => {
      toiletMapMoved = true;
      const button = document.querySelector<HTMLButtonElement>('#toilet-search-this-area');
      if (button) button.hidden = false;
    });
  } catch {
    if (element) element.innerHTML = `<p class="map-fallback">${labels[lang].mapUnavailable}</p>`;
  }
}

function toiletDetails(toilet: PublicToilet, copy: typeof labels[Language]) {
  const fee = toilet.fee === 'free' ? copy.toiletsFree : toilet.fee === 'paid' ? `${copy.toiletsPaid}${toilet.feeAmount ? `: ${esc(toilet.feeAmount)}` : ''}` : copy.toiletsFeeUnknown;
  const wheelchair = toilet.wheelchair === 'yes' ? copy.toiletsWheelchair : toilet.wheelchair === 'limited' ? copy.toiletsWheelchairLimited : toilet.wheelchair === 'no' ? copy.toiletsWheelchairNo : copy.toiletsWheelchairUnknown;
  const rows = [
    [copy.toiletsInside, toilet.inside],
    [copy.prayerAddress, toilet.address],
    [copy.toiletsFeeUnknown, fee],
    [copy.prayerOpeningHours, toilet.openingHours || copy.halalOpeningUnavailable],
    [copy.toiletsWheelchair, wheelchair],
    [copy.toiletsChanging, toilet.changingTable === 'yes' ? `${copy.toiletsChanging}${toilet.changingLocation ? `: ${esc(toilet.changingLocation)}` : ''}` : toilet.changingTable === 'limited' ? copy.toiletsWheelchairLimited : ''],
    [copy.toiletsFemale, toilet.female ? copy.prayerVerified : ''],
    [copy.toiletsMale, toilet.male ? copy.prayerVerified : ''],
    [copy.toiletsUnisex, toilet.unisex ? copy.prayerVerified : ''],
    [copy.toiletsHandwashing, toilet.handwashing ? copy.prayerVerified : ''],
    [copy.toiletsSoap, toilet.soap ? copy.prayerVerified : ''],
    [copy.toiletsPaper, toilet.toiletPaper ? copy.prayerVerified : ''],
    [copy.toiletsHotWater, toilet.hotWater ? copy.prayerVerified : ''],
    [copy.toiletsShower, toilet.shower ? copy.prayerVerified : ''],
    [copy.toiletsDrinkingWater, toilet.drinkingWater ? copy.prayerVerified : ''],
    [copy.toiletsSeated, toilet.seated ? copy.prayerVerified : ''],
    [copy.toiletsSquat, toilet.squat ? copy.prayerVerified : ''],
    [copy.toiletsUrinal, toilet.urinal ? copy.prayerVerified : ''],
    [copy.toiletsOperator, toilet.operator],
    [copy.toiletsSupervised, toilet.supervised ? copy.prayerVerified : ''],
    [copy.prayerWebsite, toilet.website ? `<a href="${esc(toilet.website)}" target="_blank" rel="noopener noreferrer">${esc(toilet.website)}</a>` : ''],
    [copy.prayerTelephone, toilet.phone],
  ].filter(([, value]) => Boolean(value));
  return `<dl class="place-details">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function toiletCard(toilet: PublicToilet, copy: typeof labels[Language]) {
  const openLabel = toilet.openState === 'open' ? copy.halalOpen : toilet.openState === 'closed' ? copy.halalClosed : copy.halalOpeningUnavailable;
  return `<article class="card toilet-card" aria-label="${esc(toilet.name)}">
    <div class="card-top"><span>${toilet.distanceKm.toFixed(1)} km · ${toiletKindLabel(toilet, copy)}</span><span class="badge toilet-${toilet.access}">${toiletAccessLabel(toilet.access, copy)}</span></div>
    <h3>${esc(toilet.name)}</h3>
    <p>${openLabel}</p>
    ${toilet.access === 'unknown' ? `<p class="evidence">${copy.toiletsAccessNotice}</p>` : ''}
    ${toiletDetails(toilet, copy)}
    <div class="place-actions">
      <a class="map-link" href="${toilet.sourceUrl}" target="_blank" rel="noopener noreferrer">${copy.prayerViewOnMap}</a>
      <a class="map-link" href="${toiletAppleMapsUrl(toilet)}" target="_blank" rel="noopener noreferrer">${copy.prayerAppleMaps}</a>
      <a class="map-link" href="${toiletBrowserDirectionsUrl(toilet)}" target="_blank" rel="noopener noreferrer">${copy.prayerBrowserMap}</a>
    </div>
  </article>`;
}

function publicToiletsPage() {
  if (!root) return;
  cityMap?.remove();
  cityMap = undefined;
  prayerMap?.remove();
  prayerMap = undefined;
  restaurantMap?.remove();
  restaurantMap = undefined;
  const copy = labels[lang];
  const dir = languageDirection(lang);
  const results = filteredToiletResults();
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  root.innerHTML = `
    <main dir="${dir}" class="app prayer-app toilet-app">
      <section class="hero prayer-hero">
        ${languageSelector()}
        <p class="eyebrow">${copy.toiletsOpen}</p>
        <h1>${copy.toiletsTitle}</h1>
        <p>${copy.toiletsSubtitle}</p>
        <button type="button" class="ghost hero-action" id="back-from-toilets">${copy.toiletsBack}</button>
      </section>
      <section class="panel prayer-panel" aria-live="polite">
        <p class="notice prayer-notice">${copy.toiletsNotice}</p>
        <p class="notice prayer-notice">${copy.toiletsAccessNotice}</p>
        <div class="prayer-actions">
          <button type="button" id="use-toilet-location">${copy.toiletsUseLocation}</button>
          <label>${copy.toiletsRadius}<select id="toilet-radius">${toiletRadii.map((radius) => `<option value="${radius}" ${radius === toiletRadiusKm ? 'selected' : ''}>${radius < 1 ? '500 m' : `${radius} km`}</option>`).join('')}</select></label>
          <form id="manual-toilet-search" class="manual-search"><label>${copy.toiletsManualSearch}<input id="toilet-manual-query" value="${esc(toiletManualQuery)}" placeholder="${copy.toiletsManualPlaceholder}" /></label><button type="submit">${copy.toiletsSearch}</button></form>
        </div>
        <p class="prayer-status ${toiletStatus}" role="status">${toiletStatusMessage(copy)}</p>
        <div class="segmented" role="tablist" aria-label="${copy.toiletsTitle}">
          <button type="button" class="${toiletMode === 'map' ? 'active' : 'ghost'}" data-toilet-mode="map">${copy.toiletsMapView}</button>
          <button type="button" class="${toiletMode === 'list' ? 'active' : 'ghost'}" data-toilet-mode="list">${copy.toiletsListView}</button>
        </div>
        <div class="prayer-filters" aria-label="${copy.toiletsTitle}">
          <select id="toilet-access-filter"><option value="all">${copy.toiletsAllResults}</option><option value="public" ${toiletFilters.access === 'public' ? 'selected' : ''}>${copy.toiletsPublicAccess}</option><option value="customers" ${toiletFilters.access === 'customers' ? 'selected' : ''}>${copy.toiletsCustomersOnly}</option><option value="unknown" ${toiletFilters.access === 'unknown' ? 'selected' : ''}>${copy.toiletsAccessUnknown}</option></select>
          ${['free', 'paid', 'openNow', 'open24', 'wheelchair', 'limitedWheelchair', 'changing', 'female', 'male', 'unisex', 'handwashing', 'shower', 'drinkingWater', 'seated', 'squat'].map((key) => {
            const label = ({ free: copy.toiletsFree, paid: copy.toiletsPaid, openNow: copy.toiletsOpenNow, open24: copy.toiletsOpen24, wheelchair: copy.toiletsWheelchair, limitedWheelchair: copy.toiletsWheelchairLimited, changing: copy.toiletsChanging, female: copy.toiletsFemale, male: copy.toiletsMale, unisex: copy.toiletsUnisex, handwashing: copy.toiletsHandwashing, shower: copy.toiletsShower, drinkingWater: copy.toiletsDrinkingWater, seated: copy.toiletsSeated, squat: copy.toiletsSquat } as Record<string, string>)[key];
            return `<label class="inline-check"><input type="checkbox" data-toilet-filter="${key}" ${toiletFilters[key as keyof ToiletFilters] ? 'checked' : ''}/> ${label}</label>`;
          }).join('')}
          <label>${copy.toiletsSort}<select id="toilet-sort"><option value="distance" ${toiletSort === 'distance' ? 'selected' : ''}>${copy.toiletsNearest}</option><option value="name" ${toiletSort === 'name' ? 'selected' : ''}>${copy.toiletsSortName}</option><option value="access" ${toiletSort === 'access' ? 'selected' : ''}>${copy.toiletsSortAccess}</option><option value="free" ${toiletSort === 'free' ? 'selected' : ''}>${copy.toiletsSortFree}</option><option value="open" ${toiletSort === 'open' ? 'selected' : ''}>${copy.toiletsSortOpen}</option><option value="accessible" ${toiletSort === 'accessible' ? 'selected' : ''}>${copy.toiletsSortAccessible}</option></select></label>
        </div>
        <div class="place-actions">
          <button type="button" id="toilet-search-this-area" class="ghost" ${toiletMapMoved ? '' : 'hidden'}>${copy.toiletsSearchThisArea}</button>
          <button type="button" id="toilet-recentre" class="ghost">${copy.toiletsRecentre}</button>
          <button type="button" id="toilet-fit-results" class="ghost">${copy.toiletsFitResults}</button>
        </div>
        <div class="legend halal-legend"><strong>${copy.toiletsLegend}</strong><span class="badge toilet-public">WC ${copy.toiletsPublicAccess}</span><span class="badge toilet-customers">WC ${copy.toiletsCustomersOnly}</span><span class="badge toilet-unknown">WC ${copy.toiletsAccessUnknown}</span><span class="badge toilet-restricted">WC ${copy.toiletsRestricted}</span><span class="badge verified">♿ ${copy.toiletsWheelchair}</span></div>
        ${toiletMode === 'map' ? `<div id="toilet-map" class="city-map prayer-map"><p class="map-fallback">${copy.mapUnavailable}</p></div>` : ''}
        ${(['empty', 'timeout', 'service-unavailable', 'offline'].includes(toiletStatus) || !results.length && toiletResults.length > 0) ? `<div class="empty-actions"><button type="button" id="retry-toilets" class="ghost">${copy.toiletsRetry}</button>${toiletStatus === 'timeout' ? '' : `<button type="button" id="increase-toilet-radius">${copy.toiletsIncreaseRadius}</button>`}<button type="button" id="another-toilet-city" class="ghost">${copy.toiletsSearchAnotherCity}</button></div>` : ''}
        <div class="place-list">${results.length ? results.map((toilet) => toiletCard(toilet, copy)).join('') : toiletStatus === 'ready' ? `<p>${copy.toiletsNoPublic}</p>` : ''}</div>
        <p class="map-status">${copy.osmAttribution}</p>
      </section>
    </main>`;
  bindPublicToiletsPage();
  if (toiletMode === 'map') initializeToiletMap();
}

function bindPublicToiletsPage() {
  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => { lang = (event.target as HTMLSelectElement).value as Language; publicToiletsPage(); });
  document.querySelector<HTMLButtonElement>('#back-from-toilets')?.addEventListener('click', () => { view = 'planner'; toiletMap?.remove(); toiletMap = undefined; if (window.location.hash) history.pushState(null, '', window.location.pathname + window.location.search); render(); });
  document.querySelector<HTMLButtonElement>('#use-toilet-location')?.addEventListener('click', requestToiletLocation);
  document.querySelector<HTMLSelectElement>('#toilet-radius')?.addEventListener('change', (event) => { toiletRadiusKm = Number((event.target as HTMLSelectElement).value) as typeof toiletRadii[number]; if (toiletCenter) void searchPublicToilets(toiletCenter); });
  document.querySelector<HTMLFormElement>('#manual-toilet-search')?.addEventListener('submit', (event) => { event.preventDefault(); toiletManualQuery = document.querySelector<HTMLInputElement>('#toilet-manual-query')?.value ?? ''; void searchToiletDestination(); });
  document.querySelectorAll<HTMLButtonElement>('[data-toilet-mode]').forEach((button) => button.addEventListener('click', () => { toiletMode = button.dataset.toiletMode as ToiletMode; publicToiletsPage(); }));
  document.querySelector<HTMLSelectElement>('#toilet-access-filter')?.addEventListener('change', (event) => { toiletFilters = { ...toiletFilters, access: (event.target as HTMLSelectElement).value as ToiletFilters['access'] }; publicToiletsPage(); });
  document.querySelectorAll<HTMLInputElement>('[data-toilet-filter]').forEach((input) => input.addEventListener('change', () => { toiletFilters = { ...toiletFilters, [input.dataset.toiletFilter ?? 'free']: input.checked }; publicToiletsPage(); }));
  document.querySelector<HTMLSelectElement>('#toilet-sort')?.addEventListener('change', (event) => { toiletSort = (event.target as HTMLSelectElement).value as ToiletSort; publicToiletsPage(); });
  document.querySelector<HTMLButtonElement>('#retry-toilets')?.addEventListener('click', () => { if (toiletCenter) void searchPublicToilets(toiletCenter); else requestToiletLocation(); });
  document.querySelector<HTMLButtonElement>('#increase-toilet-radius')?.addEventListener('click', () => { const next = toiletRadii.find((radius) => radius > toiletRadiusKm); if (next) toiletRadiusKm = next; if (toiletCenter) void searchPublicToilets(toiletCenter); });
  document.querySelector<HTMLButtonElement>('#another-toilet-city')?.addEventListener('click', () => document.querySelector<HTMLInputElement>('#toilet-manual-query')?.focus());
  document.querySelector<HTMLButtonElement>('#toilet-search-this-area')?.addEventListener('click', () => { const center = toiletMap?.getCenter?.(); if (!center) return; debouncedToiletSearch({ latitude: center.lat, longitude: center.lng, label: labels[lang].toiletsSearchThisArea }); });
  document.querySelector<HTMLButtonElement>('#toilet-recentre')?.addEventListener('click', requestToiletLocation);
  document.querySelector<HTMLButtonElement>('#toilet-fit-results')?.addEventListener('click', () => {
    const results = filteredToiletResults();
    if (!toiletMap?.fitBounds || !results.length) return;
    const lngs = results.map((toilet) => toilet.longitude);
    const lats = results.map((toilet) => toilet.latitude);
    toiletMap.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 15 });
  });
}

function carRentalTypeLabel(type: CarRentalLocationType, copy: typeof labels[Language]) {
  if (type === 'airport') return copy.carRentalAirportOffice;
  if (type === 'city') return copy.carRentalCityOffice;
  if (type === 'railway') return copy.carRentalRailwayOffice;
  if (type === 'bus') return copy.carRentalBusOffice;
  if (type === 'hotel') return copy.carRentalHotelDesk;
  if (type === 'independent') return copy.carRentalIndependentOffice;
  return copy.carRentalUnknownOffice;
}

function carRentalStatusMessage(copy: typeof labels[Language]) {
  if (carRentalStatus === 'requesting') return copy.carRentalRequestingLocation;
  if (carRentalStatus === 'searching') return copy.carRentalSearching;
  if (carRentalStatus === 'denied') return copy.carRentalLocationDenied;
  if (carRentalStatus === 'unavailable') return copy.carRentalLocationUnavailable;
  if (carRentalStatus === 'service-unavailable') return carRentalError || copy.carRentalServiceUnavailable;
  if (carRentalStatus === 'timeout') return copy.carRentalTimedOut;
  if (carRentalStatus === 'too-many') return copy.carRentalTooMany;
  if (carRentalStatus === 'cached') return copy.carRentalCached;
  if (carRentalStatus === 'offline') return copy.carRentalOffline;
  if (carRentalStatus === 'empty') return copy.carRentalNoResults;
  return '';
}

function filteredCarRentalResults() {
  return sortCarRentalOffices(filterCarRentalOffices(carRentalResults, carRentalFilters), carRentalSort);
}

async function searchCarRentalOffices(center: PrayerCenter) {
  carRentalCenter = center;
  carRentalMapMoved = false;
  const cacheKey = `${center.latitude.toFixed(4)},${center.longitude.toFixed(4)},${carRentalRadiusKm}`;
  const cached = carRentalCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    carRentalResults = cached.results;
    carRentalStatus = carRentalResults.length ? 'cached' : 'empty';
    carRentalPage();
    return;
  }
  const sequence = ++carRentalSearchSequence;
  carRentalStatus = 'searching';
  carRentalError = '';
  carRentalPage();
  try {
    const body = buildCarRentalOverpassQuery(center.latitude, center.longitude, carRentalRadiusKm);
    const data = await requestJson<OverpassResponse>(overpassUrl(), { method: 'POST', body }, 20000);
    if (sequence !== carRentalSearchSequence) return;
    const normalized = (data.elements ?? [])
      .map((element) => normalizeCarRentalOffice(element, center))
      .filter((office): office is CarRentalOffice => Boolean(office));
    carRentalResults = dedupeCarRentalOffices(normalized).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 350);
    carRentalCache.set(cacheKey, { expires: Date.now() + 5 * 60 * 1000, results: carRentalResults });
    carRentalStatus = normalized.length > 350 ? 'too-many' : carRentalResults.length ? 'ready' : 'empty';
  } catch (error) {
    console.error(error);
    if (cached) {
      carRentalResults = cached.results;
      carRentalStatus = navigator.onLine ? 'cached' : 'offline';
    } else {
      carRentalResults = [];
      carRentalStatus = error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'service-unavailable';
      carRentalError = labels[lang].carRentalServiceUnavailable;
    }
  }
  carRentalPage();
}

function requestCarRentalLocation() {
  if (!navigator.geolocation) {
    carRentalStatus = 'unavailable';
    carRentalPage();
    return;
  }
  carRentalStatus = 'requesting';
  carRentalPage();
  navigator.geolocation.getCurrentPosition(
    (position) => void searchCarRentalOffices({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: labels[lang].qiblaLocation }),
    (error) => {
      carRentalStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      carRentalPage();
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

async function searchCarRentalDestination() {
  const rawQuery = carRentalManualQuery.trim();
  if (!rawQuery) return;
  const suffix = carRentalSearchKind === 'airport' ? ' airport' : carRentalSearchKind === 'station' ? ' station' : '';
  const query = `${rawQuery}${rawQuery.toLowerCase().includes(suffix.trim()) ? '' : suffix}`.trim();
  carRentalStatus = 'searching';
  carRentalPage();
  try {
    const center = await resolveRestaurantDestination(query);
    if (!center) {
      carRentalResults = [];
      carRentalStatus = 'empty';
      carRentalPage();
      return;
    }
    await searchCarRentalOffices({ ...center, label: carRentalSearchKind === 'airport' ? `${center.label} ${labels[lang].carRentalAirportSearch}` : center.label });
  } catch (error) {
    console.error(error);
    carRentalStatus = 'service-unavailable';
    carRentalError = labels[lang].carRentalServiceUnavailable;
    carRentalPage();
  }
}

function debouncedCarRentalSearch(center: PrayerCenter) {
  if (carRentalSearchTimer) window.clearTimeout(carRentalSearchTimer);
  carRentalSearchTimer = window.setTimeout(() => void searchCarRentalOffices(center), 450);
}

function carRentalAppleMapsUrl(office: CarRentalOffice) {
  return `https://maps.apple.com/?daddr=${office.latitude},${office.longitude}&q=${encodeURIComponent(office.name)}`;
}

function carRentalBrowserDirectionsUrl(office: CarRentalOffice) {
  return `https://www.openstreetmap.org/directions?to=${office.latitude},${office.longitude}#map=17/${office.latitude}/${office.longitude}`;
}

function initializeCarRentalMap() {
  carRentalMap?.remove();
  carRentalMap = undefined;
  const element = document.querySelector<HTMLElement>('#car-rental-map');
  if (!element || !carRentalCenter || !window.maplibregl) return;
  try {
    element.replaceChildren();
    carRentalMap = new window.maplibregl.Map({
      container: element,
      style: openFreeMapStyle,
      center: [carRentalCenter.longitude, carRentalCenter.latitude],
      zoom: carRentalRadiusKm <= 5 ? 12 : carRentalRadiusKm <= 25 ? 10 : 8,
      attributionControl: true,
    });
    carRentalMap.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), document.documentElement.dir === 'rtl' ? 'top-right' : 'top-left');
    new window.maplibregl.Marker({ color: '#0f766e' }).setLngLat([carRentalCenter.longitude, carRentalCenter.latitude]).setPopup(new window.maplibregl.Popup({ offset: 18 }).setText(carRentalCenter.label)).addTo(carRentalMap);
    const colors: Record<CarRentalLocationType, string> = { airport: '#7c3aed', city: '#0f766e', railway: '#2563eb', bus: '#0891b2', hotel: '#d97706', independent: '#15803d', unknown: '#64748b' };
    const icons: Record<CarRentalLocationType, string> = { airport: 'AIR', city: 'CITY', railway: 'RAIL', bus: 'BUS', hotel: 'HOTEL', independent: 'CAR', unknown: 'CAR' };
    for (const office of filteredCarRentalResults()) {
      new window.maplibregl.Marker({ color: colors[office.locationType] }).setLngLat([office.longitude, office.latitude]).setPopup(new window.maplibregl.Popup({ offset: 18 }).setText(`${icons[office.locationType]} ${office.name}`)).addTo(carRentalMap);
    }
    carRentalMap.on('moveend', () => {
      carRentalMapMoved = true;
      const button = document.querySelector<HTMLButtonElement>('#car-rental-search-this-area');
      if (button) button.hidden = false;
    });
  } catch {
    if (element) element.innerHTML = `<p class="map-fallback">${labels[lang].mapUnavailable}</p>`;
  }
}

function carRentalDetails(office: CarRentalOffice, copy: typeof labels[Language]) {
  const wheelchair = office.wheelchair === 'yes' ? copy.toiletsWheelchair : office.wheelchair === 'limited' ? copy.toiletsWheelchairLimited : office.wheelchair === 'no' ? copy.toiletsWheelchairNo : '';
  const website = office.website ? `<a href="${esc(office.website)}" target="_blank" rel="noopener noreferrer">${copy.carRentalOfficialWebsiteListed}</a>` : '';
  const booking = office.bookingUrl ? `<a href="${esc(office.bookingUrl)}" target="_blank" rel="noopener noreferrer">${copy.carRentalOfficialBookingListed}</a>` : '';
  const rows = [
    [copy.carRentalBrand, office.brand],
    [copy.carRentalOperator, office.operator],
    [copy.carRentalLocationType, carRentalTypeLabel(office.locationType, copy)],
    [copy.carRentalLocationContext, office.locationContext],
    [copy.prayerAddress, office.address],
    [copy.prayerOpeningHours, office.openingHours || copy.halalOpeningUnavailable],
    [copy.prayerTelephone, office.phone],
    [copy.carRentalEmail, office.email ? `<a href="mailto:${esc(office.email)}">${esc(office.email)}</a>` : ''],
    [copy.prayerWebsite, website],
    [copy.carRentalBookingWebsite, booking],
    [copy.toiletsWheelchair, wheelchair],
    [copy.carRentalBranchRef, office.branchRef],
  ].filter(([, value]) => Boolean(value));
  return `<dl class="place-details">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function carRentalCard(office: CarRentalOffice, copy: typeof labels[Language]) {
  const openLabel = office.openState === 'open' ? copy.halalOpen : office.openState === 'closed' ? copy.halalClosed : copy.halalOpeningUnavailable;
  return `<article class="card car-rental-card" aria-label="${esc(office.name)}">
    <div class="card-top"><span>${office.distanceKm.toFixed(1)} km · ${carRentalTypeLabel(office.locationType, copy)}</span><span class="badge car-${office.locationType}">${office.locationType === 'airport' ? 'AIR' : 'CAR'} ${carRentalTypeLabel(office.locationType, copy)}</span></div>
    <h3>${esc(office.name)}</h3>
    <p>${openLabel}</p>
    ${carRentalDetails(office, copy)}
    <div class="place-actions">
      <a class="map-link" href="${office.sourceUrl}" target="_blank" rel="noopener noreferrer">${copy.prayerViewOnMap}</a>
      <a class="map-link" href="${carRentalAppleMapsUrl(office)}" target="_blank" rel="noopener noreferrer">${copy.prayerAppleMaps}</a>
      <a class="map-link" href="${carRentalBrowserDirectionsUrl(office)}" target="_blank" rel="noopener noreferrer">${copy.prayerBrowserMap}</a>
      ${office.website ? `<a class="map-link" href="${esc(office.website)}" target="_blank" rel="noopener noreferrer">${copy.carRentalOpenOfficialWebsite}</a>` : ''}
      ${office.phone ? `<a class="map-link" href="tel:${esc(office.phone)}">${copy.carRentalCallOffice}</a>` : ''}
    </div>
  </article>`;
}

function carRentalChecklist(copy: typeof labels[Language]) {
  return `<div class="destination-box"><h2>${copy.carRentalChecklistTitle}</h2><p>${copy.carRentalChecklistIntro}</p><ul class="compact-list">
    <li>${copy.carRentalCheckAge}</li><li>${copy.carRentalCheckLicence}</li><li>${copy.carRentalCheckPermit}</li><li>${copy.carRentalCheckDeposit}</li><li>${copy.carRentalCheckInsurance}</li><li>${copy.carRentalCheckFuel}</li><li>${copy.carRentalCheckMileage}</li><li>${copy.carRentalCheckDriver}</li><li>${copy.carRentalCheckBorder}</li><li>${copy.carRentalCheckCancel}</li><li>${copy.carRentalCheckTimes}</li><li>${copy.carRentalCheckLate}</li>
  </ul></div>`;
}

function carRentalPage() {
  if (!root) return;
  cityMap?.remove();
  cityMap = undefined;
  prayerMap?.remove();
  prayerMap = undefined;
  restaurantMap?.remove();
  restaurantMap = undefined;
  toiletMap?.remove();
  toiletMap = undefined;
  const copy = labels[lang];
  const dir = languageDirection(lang);
  const results = filteredCarRentalResults();
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  root.innerHTML = `
    <main dir="${dir}" class="app prayer-app car-rental-app">
      <section class="hero prayer-hero">
        ${languageSelector()}
        <p class="eyebrow">${copy.carRentalOpen}</p>
        <h1>${copy.carRentalTitle}</h1>
        <p>${copy.carRentalSubtitle}</p>
        <button type="button" class="ghost hero-action" id="back-from-car-rental">${copy.carRentalBack}</button>
      </section>
      <section class="panel prayer-panel" aria-live="polite">
        <p class="notice prayer-notice">${copy.carRentalNotice}</p>
        <p class="notice prayer-notice">${copy.carRentalAvailabilityNotice}</p>
        <p class="notice prayer-notice">${copy.carRentalLiveNotice}</p>
        <div class="prayer-actions">
          <button type="button" id="use-car-rental-location">${copy.carRentalUseLocation}</button>
          <label>${copy.carRentalRadius}<select id="car-rental-radius">${carRentalRadii.map((radius) => `<option value="${radius}" ${radius === carRentalRadiusKm ? 'selected' : ''}>${radius} km</option>`).join('')}</select></label>
          <form id="manual-car-rental-search" class="manual-search"><label>${copy.carRentalManualSearch}<input id="car-rental-manual-query" value="${esc(carRentalManualQuery)}" placeholder="${copy.carRentalManualPlaceholder}" /></label><label>${copy.carRentalSearchNear}<select id="car-rental-search-kind"><option value="destination" ${carRentalSearchKind === 'destination' ? 'selected' : ''}>${copy.carRentalDestinationSearch}</option><option value="airport" ${carRentalSearchKind === 'airport' ? 'selected' : ''}>${copy.carRentalAirportSearch}</option><option value="station" ${carRentalSearchKind === 'station' ? 'selected' : ''}>${copy.carRentalStationSearch}</option></select></label><button type="submit">${copy.carRentalSearch}</button></form>
        </div>
        <p class="prayer-status ${carRentalStatus}" role="status">${carRentalStatusMessage(copy)}</p>
        <div class="segmented" role="tablist" aria-label="${copy.carRentalTitle}">
          <button type="button" class="${carRentalMode === 'map' ? 'active' : 'ghost'}" data-car-rental-mode="map">${copy.carRentalMapView}</button>
          <button type="button" class="${carRentalMode === 'list' ? 'active' : 'ghost'}" data-car-rental-mode="list">${copy.carRentalListView}</button>
        </div>
        <div class="prayer-filters" aria-label="${copy.carRentalTitle}">
          <select id="car-rental-type-filter"><option value="all">${copy.carRentalAllOffices}</option><option value="airport" ${carRentalFilters.type === 'airport' ? 'selected' : ''}>${copy.carRentalAirportOffice}</option><option value="city" ${carRentalFilters.type === 'city' ? 'selected' : ''}>${copy.carRentalCityOffice}</option><option value="railway" ${carRentalFilters.type === 'railway' ? 'selected' : ''}>${copy.carRentalRailwayOffice}</option><option value="bus" ${carRentalFilters.type === 'bus' ? 'selected' : ''}>${copy.carRentalBusOffice}</option><option value="hotel" ${carRentalFilters.type === 'hotel' ? 'selected' : ''}>${copy.carRentalHotelDesk}</option><option value="independent" ${carRentalFilters.type === 'independent' ? 'selected' : ''}>${copy.carRentalIndependentOffice}</option></select>
          ${['atAirport', 'openNow', 'open24', 'website', 'phone', 'wheelchair'].map((key) => {
            const label = ({ atAirport: copy.carRentalAtAirport, openNow: copy.toiletsOpenNow, open24: copy.toiletsOpen24, website: copy.carRentalWebsiteAvailable, phone: copy.carRentalPhoneAvailable, wheelchair: copy.toiletsWheelchair } as Record<string, string>)[key];
            return `<label class="inline-check"><input type="checkbox" data-car-rental-filter="${key}" ${carRentalFilters[key as keyof CarRentalFilters] ? 'checked' : ''}/> ${label}</label>`;
          }).join('')}
          <label>${copy.carRentalSort}<select id="car-rental-sort"><option value="distance" ${carRentalSort === 'distance' ? 'selected' : ''}>${copy.toiletsNearest}</option><option value="name" ${carRentalSort === 'name' ? 'selected' : ''}>${copy.toiletsSortName}</option><option value="open" ${carRentalSort === 'open' ? 'selected' : ''}>${copy.toiletsSortOpen}</option><option value="airport" ${carRentalSort === 'airport' ? 'selected' : ''}>${copy.carRentalSortAirport}</option><option value="website" ${carRentalSort === 'website' ? 'selected' : ''}>${copy.carRentalSortWebsite}</option></select></label>
        </div>
        <div class="place-actions">
          <button type="button" id="car-rental-search-this-area" class="ghost" ${carRentalMapMoved ? '' : 'hidden'}>${copy.carRentalSearchThisArea}</button>
          <button type="button" id="car-rental-recentre" class="ghost">${copy.carRentalRecentre}</button>
          <button type="button" id="car-rental-fit-results" class="ghost">${copy.carRentalFitResults}</button>
        </div>
        <div class="legend halal-legend"><strong>${copy.carRentalLegend}</strong><span class="badge car-airport">AIR ${copy.carRentalAirportOffice}</span><span class="badge car-city">CAR ${copy.carRentalCityOffice}</span><span class="badge car-railway">RAIL ${copy.carRentalRailwayOffice}</span><span class="badge car-bus">BUS ${copy.carRentalBusOffice}</span><span class="badge car-hotel">HOTEL ${copy.carRentalHotelDesk}</span><span class="badge car-independent">CAR ${copy.carRentalIndependentOffice}</span></div>
        ${carRentalMode === 'map' ? `<div id="car-rental-map" class="city-map prayer-map"><p class="map-fallback">${copy.mapUnavailable}</p></div>` : ''}
        ${(['empty', 'timeout', 'service-unavailable', 'offline'].includes(carRentalStatus) || !results.length && carRentalResults.length > 0) ? `<div class="empty-actions"><button type="button" id="retry-car-rental" class="ghost">${copy.carRentalRetry}</button>${carRentalStatus === 'timeout' ? '' : `<button type="button" id="increase-car-rental-radius">${copy.carRentalIncreaseRadius}</button>`}<button type="button" id="another-car-rental-city" class="ghost">${copy.carRentalSearchAnother}</button></div>` : ''}
        <div class="place-list">${results.length ? results.map((office) => carRentalCard(office, copy)).join('') : carRentalStatus === 'ready' ? `<p>${copy.carRentalNoResults}</p>` : ''}</div>
        ${carRentalChecklist(copy)}
        <p class="map-status">${copy.osmAttribution}</p>
      </section>
    </main>`;
  bindCarRentalPage();
  if (carRentalMode === 'map') initializeCarRentalMap();
}

function bindCarRentalPage() {
  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => { lang = (event.target as HTMLSelectElement).value as Language; carRentalPage(); });
  document.querySelector<HTMLButtonElement>('#back-from-car-rental')?.addEventListener('click', () => { view = 'planner'; carRentalMap?.remove(); carRentalMap = undefined; if (window.location.hash) history.pushState(null, '', window.location.pathname + window.location.search); render(); });
  document.querySelector<HTMLButtonElement>('#use-car-rental-location')?.addEventListener('click', requestCarRentalLocation);
  document.querySelector<HTMLSelectElement>('#car-rental-radius')?.addEventListener('change', (event) => { carRentalRadiusKm = Number((event.target as HTMLSelectElement).value) as typeof carRentalRadii[number]; if (carRentalCenter) void searchCarRentalOffices(carRentalCenter); });
  document.querySelector<HTMLSelectElement>('#car-rental-search-kind')?.addEventListener('change', (event) => { carRentalSearchKind = (event.target as HTMLSelectElement).value as CarRentalSearchKind; });
  document.querySelector<HTMLFormElement>('#manual-car-rental-search')?.addEventListener('submit', (event) => { event.preventDefault(); carRentalManualQuery = document.querySelector<HTMLInputElement>('#car-rental-manual-query')?.value ?? ''; void searchCarRentalDestination(); });
  document.querySelectorAll<HTMLButtonElement>('[data-car-rental-mode]').forEach((button) => button.addEventListener('click', () => { carRentalMode = button.dataset.carRentalMode as CarRentalMode; carRentalPage(); }));
  document.querySelector<HTMLSelectElement>('#car-rental-type-filter')?.addEventListener('change', (event) => { carRentalFilters = { ...carRentalFilters, type: (event.target as HTMLSelectElement).value as CarRentalFilters['type'] }; carRentalPage(); });
  document.querySelectorAll<HTMLInputElement>('[data-car-rental-filter]').forEach((input) => input.addEventListener('change', () => { carRentalFilters = { ...carRentalFilters, [input.dataset.carRentalFilter ?? 'openNow']: input.checked }; carRentalPage(); }));
  document.querySelector<HTMLSelectElement>('#car-rental-sort')?.addEventListener('change', (event) => { carRentalSort = (event.target as HTMLSelectElement).value as CarRentalSort; carRentalPage(); });
  document.querySelector<HTMLButtonElement>('#retry-car-rental')?.addEventListener('click', () => { if (carRentalCenter) void searchCarRentalOffices(carRentalCenter); else requestCarRentalLocation(); });
  document.querySelector<HTMLButtonElement>('#increase-car-rental-radius')?.addEventListener('click', () => { const next = carRentalRadii.find((radius) => radius > carRentalRadiusKm); if (next) carRentalRadiusKm = next; if (carRentalCenter) void searchCarRentalOffices(carRentalCenter); });
  document.querySelector<HTMLButtonElement>('#another-car-rental-city')?.addEventListener('click', () => document.querySelector<HTMLInputElement>('#car-rental-manual-query')?.focus());
  document.querySelector<HTMLButtonElement>('#car-rental-search-this-area')?.addEventListener('click', () => { const center = carRentalMap?.getCenter?.(); if (!center) return; debouncedCarRentalSearch({ latitude: center.lat, longitude: center.lng, label: labels[lang].carRentalSearchThisArea }); });
  document.querySelector<HTMLButtonElement>('#car-rental-recentre')?.addEventListener('click', requestCarRentalLocation);
  document.querySelector<HTMLButtonElement>('#car-rental-fit-results')?.addEventListener('click', () => {
    const results = filteredCarRentalResults();
    if (!carRentalMap?.fitBounds || !results.length) return;
    const lngs = results.map((office) => office.longitude);
    const lats = results.map((office) => office.latitude);
    carRentalMap.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 15 });
  });
}

function selectedWeatherCity() {
  const match = weatherLocation ? cities.find((city) => city.city === weatherLocation?.label || `${city.city}, ${city.country}` === weatherLocation?.label) : undefined;
  return match ?? selectedCity();
}

function weatherCacheKey(location: WeatherLocation) {
  return `mtp-weather-${location.latitude.toFixed(3)}-${location.longitude.toFixed(3)}-${weatherUnits.temperature}-${weatherUnits.wind}-${weatherUnits.precipitation}`;
}

function weatherStatusMessage(copy: typeof labels[Language]) {
  if (weatherStatus === 'requesting') return copy.weatherRequestingLocation;
  if (weatherStatus === 'loading') return copy.weatherLoading;
  if (weatherStatus === 'updated') return copy.weatherUpdated;
  if (weatherStatus === 'denied') return copy.weatherLocationDenied;
  if (weatherStatus === 'unavailable') return copy.weatherLocationUnavailable;
  if (weatherStatus === 'service-unavailable') return weatherError || copy.weatherUnavailable;
  if (weatherStatus === 'timeout') return copy.weatherTimedOut;
  if (weatherStatus === 'invalid') return copy.weatherInvalid;
  if (weatherStatus === 'offline') return copy.weatherOffline;
  if (weatherStatus === 'cached') return copy.weatherCached;
  if (weatherStatus === 'no-cache') return copy.weatherNoCached;
  if (weatherStatus === 'unsupported') return copy.weatherUnsupported;
  return '';
}

async function loadWeather(location: WeatherLocation, force = false) {
  weatherLocation = location;
  const cacheKey = weatherCacheKey(location);
  const cached = readJsonCache<WeatherForecast>(localStorage, cacheKey, WEATHER_CACHE_MS);
  if (cached && !force) {
    weatherForecast = { ...cached, cached: true };
    weatherStatus = 'cached';
    weatherPage();
    return;
  }
  const sequence = ++weatherRequestSequence;
  weatherStatus = 'loading';
  weatherError = '';
  weatherPage();
  try {
    const forecast = validateWeatherResponse(await requestJson<unknown>(buildWeatherUrl(location.latitude, location.longitude, weatherUnits), { headers: { Accept: 'application/json' } }, 9000));
    if (sequence !== weatherRequestSequence) return;
    weatherForecast = forecast;
    weatherSelectedDay = forecast.daily[0]?.date ?? '';
    writeJsonCache(localStorage, cacheKey, forecast);
    weatherStatus = 'updated';
  } catch (error) {
    const fallback = readJsonCache<WeatherForecast>(localStorage, cacheKey, 7 * 24 * 60 * 60 * 1000);
    if (fallback) {
      weatherForecast = { ...fallback, cached: true };
      weatherStatus = navigator.onLine ? 'cached' : 'offline';
    } else {
      weatherForecast = null;
      weatherStatus = error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : error instanceof Error && /Missing|Malformed/.test(error.message) ? 'invalid' : 'service-unavailable';
      weatherError = error instanceof Error ? error.message : '';
    }
  }
  weatherPage();
}

function destinationWeatherLocation(city = selectedCity()): WeatherLocation {
  return { latitude: city.coordinates.lat, longitude: city.coordinates.lng, label: `${city.city}, ${city.country}`, country: city.country, timezone: city.timezone };
}

function requestWeatherLocation() {
  if (!navigator.geolocation) {
    weatherStatus = 'unavailable';
    weatherPage();
    return;
  }
  weatherStatus = 'requesting';
  weatherPage();
  navigator.geolocation.getCurrentPosition(
    (position) => void loadWeather({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: labels[lang].qiblaLocation }),
    (error) => {
      weatherStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      weatherPage();
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

async function searchWeatherDestination() {
  const query = weatherManualQuery.trim();
  if (!query) return;
  weatherStatus = 'loading';
  weatherPage();
  try {
    const city = cities.find((candidate) => candidate.city.toLowerCase() === query.toLowerCase());
    if (city) {
      await loadWeather(destinationWeatherLocation(city), true);
      return;
    }
    const center = await resolveRestaurantDestination(query);
    if (!center) {
      weatherStatus = 'unsupported';
      weatherPage();
      return;
    }
    await loadWeather({ latitude: center.latitude, longitude: center.longitude, label: center.label }, true);
  } catch (error) {
    console.error(error);
    weatherStatus = 'service-unavailable';
    weatherError = labels[lang].weatherUnavailable;
    weatherPage();
  }
}

function formatWeatherTime(value: string, options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }) {
  if (!value) return '';
  return new Intl.DateTimeFormat(localeForLanguage(lang), options).format(new Date(value));
}

function weatherRows(forecast: WeatherForecast, copy: typeof labels[Language]) {
  const today = forecast.daily[0];
  const condition = weatherCodeInfo(forecast.current.weatherCode, copy);
  const rainSnow = forecast.current.snowfall > 0 ? formatPrecipitation(forecast.current.snowfall, weatherUnits) : forecast.current.rain > 0 || forecast.current.precipitation > 0 ? formatPrecipitation(forecast.current.rain || forecast.current.precipitation, weatherUnits) : '0';
  const rows = [
    [copy.weatherCondition, `${condition.icon} ${condition.label}`],
    [copy.weatherFeelsLike, formatTemperature(forecast.current.apparentTemperature, weatherUnits)],
    [copy.weatherHighLow, today ? `${formatTemperature(today.temperatureMax, weatherUnits)} / ${formatTemperature(today.temperatureMin, weatherUnits)}` : ''],
    [copy.weatherRainSnow, rainSnow],
    [copy.weatherHumidity, `${forecast.current.humidity}%`],
    [copy.weatherWind, `${formatWind(forecast.current.windSpeed, weatherUnits)} ${windDirectionLabel(forecast.current.windDirection)}`],
    [copy.weatherGusts, formatWind(forecast.current.windGusts, weatherUnits)],
    [copy.weatherCloud, `${forecast.current.cloudCover}%`],
    [copy.weatherUv, String(selectHourlyForecast(forecast.hourly, forecast.current.time, 1)[0]?.uvIndex ?? '')],
    [copy.weatherVisibility, forecast.hourly[0]?.visibility ? `${Math.round(forecast.hourly[0].visibility / 1000)} km` : ''],
    [copy.weatherSunrise, today?.sunrise ? formatWeatherTime(today.sunrise) : ''],
    [copy.weatherSunset, today?.sunset ? formatWeatherTime(today.sunset) : ''],
    [copy.weatherDayNight, forecast.current.isDay ? copy.weatherDaylight : copy.weatherNight],
    [copy.weatherLastUpdated, formatWeatherTime(forecast.retrievedAt, { dateStyle: 'medium', timeStyle: 'short' })],
  ].filter(([, value]) => Boolean(value));
  return `<dl class="place-details">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function hourlyWeatherList(forecast: WeatherForecast, copy: typeof labels[Language]) {
  const hours = weatherSelectedDay ? hourlyForDay(forecast.hourly, weatherSelectedDay) : selectHourlyForecast(forecast.hourly, forecast.current.time, weatherHours);
  return `<div class="hourly-strip" role="list" aria-label="${copy.weatherHourly}">${hours.slice(0, weatherHours).map((hour, index) => {
    const info = weatherCodeInfo(hour.weatherCode, copy);
    const current = index === 0 && !weatherSelectedDay ? ' current-hour' : '';
    return `<article class="hour-card${current}" role="listitem" aria-label="${info.label}">
      <strong>${formatWeatherTime(hour.time)}</strong><span class="weather-icon" aria-hidden="true">${info.icon}</span><span>${formatTemperature(hour.temperature, weatherUnits)}</span><small>${copy.weatherFeelsLike}: ${formatTemperature(hour.apparentTemperature, weatherUnits)}</small><small>${hour.precipitationProbability}%</small><small>${formatWind(hour.windSpeed, weatherUnits)}</small>${hour.isDay ? `<small>${copy.weatherUv}: ${hour.uvIndex}</small>` : ''}
    </article>`;
  }).join('')}</div>`;
}

function dailyWeatherList(forecast: WeatherForecast, copy: typeof labels[Language]) {
  return `<div class="place-list">${forecast.daily.map((day) => {
    const info = weatherCodeInfo(day.weatherCode, copy);
    return `<article class="card weather-day ${weatherSelectedDay === day.date ? 'selected-weather-day' : ''}">
      <div class="card-top"><span>${formatWeatherTime(`${day.date}T12:00`, { weekday: 'short', month: 'short', day: 'numeric' })}</span><span class="badge verified">${info.icon} ${info.label}</span></div>
      <h3>${formatTemperature(day.temperatureMax, weatherUnits)} / ${formatTemperature(day.temperatureMin, weatherUnits)}</h3>
      <p>${copy.weatherFeelsLike}: ${formatTemperature(day.apparentMax, weatherUnits)} / ${formatTemperature(day.apparentMin, weatherUnits)} · ${day.precipitationProbabilityMax}%</p>
      <p>${copy.weatherRainSnow}: ${formatPrecipitation(day.rainSum + day.showersSum + day.snowfallSum, weatherUnits)} · ${copy.weatherWind}: ${formatWind(day.windSpeedMax, weatherUnits)} · ${copy.weatherGusts}: ${formatWind(day.windGustsMax, weatherUnits)} · ${copy.weatherUv}: ${day.uvIndexMax}</p>
      <p>${copy.weatherSunrise}: ${formatWeatherTime(day.sunrise)} · ${copy.weatherSunset}: ${formatWeatherTime(day.sunset)}</p>
      <button type="button" class="ghost" data-weather-day="${day.date}">${copy.weatherHourly}</button>
    </article>`;
  }).join('')}</div>`;
}

function travelWeatherSection(forecast: WeatherForecast, copy: typeof labels[Language]) {
  const indicators = travelWeatherIndicators(forecast, copy);
  const suggestions = packingSuggestions(forecast, copy);
  return `<div class="destination-box"><h2>${copy.weatherTravel}</h2><p>${copy.weatherTravelNotice}</p><div class="chips">${indicators.length ? indicators.map((item) => `<span class="chip">${item}</span>`).join('') : `<span class="chip">${copy.weatherCondition}: ${weatherCodeInfo(forecast.current.weatherCode, copy).label}</span>`}</div><h3>${copy.weatherPacking}</h3><ul class="compact-list">${suggestions.map((item) => `<li>${item}</li>`).join('')}</ul></div>`;
}

function prayerWeatherSection(forecast: WeatherForecast, copy: typeof labels[Language]) {
  const city = selectedWeatherCity();
  const prayerTimes = calculatePrayerDisplay(city, prefs.prayerMethod, prefs.startDate, localeForLanguage(lang));
  const matches = matchPrayerWeather(prayerTimes, forecast.hourly).filter((item) => item.prayer !== 'Sunrise');
  if (!matches.length) return '';
  return `<section class="destination-box"><h2>${copy.weatherPrayer}</h2><div class="place-list">${matches.map((item) => {
    const point = item.forecast as WeatherPoint;
    const info = weatherCodeInfo(point.weatherCode, copy);
    return `<article class="card"><div class="card-top"><span>${item.prayer} · ${item.time}</span><span class="badge sample">${point.isDay ? copy.weatherDaylight : copy.weatherNight}</span></div><p>${info.icon} ${info.label} · ${formatTemperature(point.temperature, weatherUnits)} · ${point.precipitationProbability}% · ${formatWind(point.windSpeed, weatherUnits)}</p></article>`;
  }).join('')}</div></section>`;
}

function weatherPage() {
  if (!root) return;
  cityMap?.remove();
  cityMap = undefined;
  prayerMap?.remove();
  prayerMap = undefined;
  restaurantMap?.remove();
  restaurantMap = undefined;
  toiletMap?.remove();
  toiletMap = undefined;
  carRentalMap?.remove();
  carRentalMap = undefined;
  const copy = labels[lang];
  const dir = languageDirection(lang);
  const forecast = weatherForecast;
  const location = weatherLocation ?? destinationWeatherLocation();
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  root.innerHTML = `
    <main dir="${dir}" class="app prayer-app weather-app">
      <section class="hero prayer-hero">
        ${languageSelector()}
        <p class="eyebrow">${copy.weatherOpen}</p>
        <h1>${copy.weatherTitle}</h1>
        <p>${copy.weatherSubtitle}</p>
        <button type="button" class="ghost hero-action" id="back-from-weather">${copy.weatherBack}</button>
      </section>
      <section class="panel prayer-panel" aria-live="polite">
        <p class="notice prayer-notice">${copy.weatherNotice}</p>
        <div class="prayer-actions">
          <button type="button" id="use-weather-location">${copy.weatherUseLocation}</button>
          <button type="button" id="use-weather-destination" class="ghost">${copy.weatherUseDestination}</button>
          <button type="button" id="refresh-weather" class="ghost">${copy.weatherRefresh}</button>
          <form id="manual-weather-search" class="manual-search"><label>${copy.weatherManualSearch}<input id="weather-manual-query" list="weather-cities" value="${esc(weatherManualQuery)}" placeholder="${copy.weatherManualPlaceholder}" /></label><button type="submit">${copy.weatherSearch}</button></form>
        </div>
        <datalist id="weather-cities">${cities.map((city) => `<option value="${city.city}">${city.country}</option>`).join('')}</datalist>
        <div class="chips" aria-label="${copy.weatherRecentDestinations}">${[selectedCity(), ...cities.filter((city) => city.city !== selectedCity().city).slice(0, 5)].map((city) => `<button type="button" class="chip" data-weather-city="${esc(city.city)}">${city.city}</button>`).join('')}</div>
        <div class="prayer-filters">
          <label>${copy.weatherTempUnit}<select id="weather-temp-unit"><option value="celsius" ${weatherUnits.temperature === 'celsius' ? 'selected' : ''}>${copy.weatherCelsius}</option><option value="fahrenheit" ${weatherUnits.temperature === 'fahrenheit' ? 'selected' : ''}>${copy.weatherFahrenheit}</option></select></label>
          <label>${copy.weatherWindUnit}<select id="weather-wind-unit"><option value="kmh" ${weatherUnits.wind === 'kmh' ? 'selected' : ''}>${copy.weatherKmh}</option><option value="mph" ${weatherUnits.wind === 'mph' ? 'selected' : ''}>${copy.weatherMph}</option><option value="ms" ${weatherUnits.wind === 'ms' ? 'selected' : ''}>${copy.weatherMs}</option><option value="knots" ${weatherUnits.wind === 'knots' ? 'selected' : ''}>${copy.weatherKnots}</option></select></label>
          <label>${copy.weatherPrecipUnit}<select id="weather-precip-unit"><option value="mm" ${weatherUnits.precipitation === 'mm' ? 'selected' : ''}>${copy.weatherMm}</option><option value="inch" ${weatherUnits.precipitation === 'inch' ? 'selected' : ''}>${copy.weatherInch}</option></select></label>
        </div>
        <p class="prayer-status ${weatherStatus}" role="status">${weatherStatusMessage(copy)}</p>
        <div class="destination-box"><h2>${esc(location.label)}</h2><p>${copy.weatherLocalTime}: ${forecast ? formatWeatherTime(forecast.current.time, { dateStyle: 'medium', timeStyle: 'short' }) : ''}</p><p>${copy.weatherTimezone}: ${forecast?.timezone ?? location.timezone ?? ''}</p><p>${copy.weatherCoordinates}: ${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}</p></div>
        ${forecast ? `<section class="card weather-current" aria-label="${copy.weatherCurrent}"><div class="card-top"><span>${copy.weatherCurrent}</span><span class="badge ${forecast.cached ? 'unverified' : 'verified'}">${forecast.cached ? copy.weatherCached : copy.weatherUpdated}</span></div><h2>${formatTemperature(forecast.current.temperature, weatherUnits)}</h2>${weatherRows(forecast, copy)}</section><section><div class="result-header"><h2>${copy.weatherHourly}</h2><button type="button" class="ghost" id="toggle-weather-hours">${weatherHours === 24 ? copy.weatherExpand48 : copy.weatherShow24}</button></div>${hourlyWeatherList(forecast, copy)}</section><section><h2>${copy.weatherDaily}</h2>${dailyWeatherList(forecast, copy)}</section>${travelWeatherSection(forecast, copy)}${prayerWeatherSection(forecast, copy)}` : `<div class="empty-actions"><button type="button" id="retry-weather" class="ghost">${copy.weatherRetry}</button><button type="button" id="another-weather-city">${copy.weatherSearchAnother}</button></div>`}
        <p class="map-status"><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">${copy.weatherAttribution}</a> · <a href="${OPEN_METEO_FORECAST_URL}" target="_blank" rel="noopener noreferrer">Open-Meteo API</a></p>
      </section>
    </main>`;
  bindWeatherPage();
}

function bindWeatherPage() {
  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => { lang = (event.target as HTMLSelectElement).value as Language; weatherPage(); });
  document.querySelector<HTMLButtonElement>('#back-from-weather')?.addEventListener('click', () => { view = 'planner'; if (window.location.hash) history.pushState(null, '', window.location.pathname + window.location.search); render(); });
  document.querySelector<HTMLButtonElement>('#use-weather-location')?.addEventListener('click', requestWeatherLocation);
  document.querySelector<HTMLButtonElement>('#use-weather-destination')?.addEventListener('click', () => void loadWeather(destinationWeatherLocation(), true));
  document.querySelector<HTMLButtonElement>('#refresh-weather')?.addEventListener('click', () => { if (weatherLocation) void loadWeather(weatherLocation, true); else void loadWeather(destinationWeatherLocation(), true); });
  document.querySelector<HTMLButtonElement>('#retry-weather')?.addEventListener('click', () => { if (weatherLocation) void loadWeather(weatherLocation, true); else void loadWeather(destinationWeatherLocation(), true); });
  document.querySelector<HTMLButtonElement>('#another-weather-city')?.addEventListener('click', () => document.querySelector<HTMLInputElement>('#weather-manual-query')?.focus());
  document.querySelector<HTMLFormElement>('#manual-weather-search')?.addEventListener('submit', (event) => { event.preventDefault(); weatherManualQuery = document.querySelector<HTMLInputElement>('#weather-manual-query')?.value ?? ''; void searchWeatherDestination(); });
  document.querySelector<HTMLButtonElement>('#toggle-weather-hours')?.addEventListener('click', () => { weatherHours = weatherHours === 24 ? 48 : 24; weatherSelectedDay = ''; weatherPage(); });
  document.querySelectorAll<HTMLButtonElement>('[data-weather-day]').forEach((button) => button.addEventListener('click', () => { weatherSelectedDay = button.dataset.weatherDay ?? ''; weatherHours = 24; weatherPage(); }));
  document.querySelectorAll<HTMLButtonElement>('[data-weather-city]').forEach((button) => button.addEventListener('click', () => { const city = cities.find((candidate) => candidate.city === button.dataset.weatherCity); if (city) void loadWeather(destinationWeatherLocation(city), true); }));
  document.querySelector<HTMLSelectElement>('#weather-temp-unit')?.addEventListener('change', (event) => { weatherUnits = { ...weatherUnits, temperature: (event.target as HTMLSelectElement).value as WeatherUnits['temperature'] }; localStorage.setItem('mtp-weather-temp', weatherUnits.temperature); if (weatherLocation) void loadWeather(weatherLocation, true); });
  document.querySelector<HTMLSelectElement>('#weather-wind-unit')?.addEventListener('change', (event) => { weatherUnits = { ...weatherUnits, wind: (event.target as HTMLSelectElement).value as WeatherUnits['wind'] }; localStorage.setItem('mtp-weather-wind', weatherUnits.wind); if (weatherLocation) void loadWeather(weatherLocation, true); });
  document.querySelector<HTMLSelectElement>('#weather-precip-unit')?.addEventListener('change', (event) => { weatherUnits = { ...weatherUnits, precipitation: (event.target as HTMLSelectElement).value as WeatherUnits['precipitation'] }; localStorage.setItem('mtp-weather-precip', weatherUnits.precipitation); if (weatherLocation) void loadWeather(weatherLocation, true); });
}

function attractionCategoryLabel(category: AttractionCategory, copy: typeof labels[Language]) {
  const values: Record<AttractionCategory, string> = {
    historic: copy.attractionsHistoric,
    museum: copy.attractionsMuseum,
    gallery: copy.attractionsGallery,
    monument: copy.attractionsMonument,
    archaeological: copy.attractionsArchaeological,
    castle: copy.attractionsCastle,
    religious: copy.attractionsReligious,
    viewpoint: copy.attractionsViewpoint,
    natural: copy.attractionsNatural,
    park: copy.attractionsPark,
    zoo: copy.attractionsZoo,
    theme: copy.attractionsTheme,
    artwork: copy.attractionsArtwork,
    cultural: copy.attractionsCultural,
    other: copy.attractionsOther,
  };
  return values[category];
}

function attractionStatusMessage(copy: typeof labels[Language]) {
  if (attractionStatus === 'requesting') return copy.attractionsRequestingLocation;
  if (attractionStatus === 'searching') return copy.attractionsSearching;
  if (attractionStatus === 'photos') return copy.attractionsLoadingPhotos;
  if (attractionStatus === 'history') return copy.attractionsLoadingHistory;
  if (attractionStatus === 'denied') return copy.attractionsLocationDenied;
  if (attractionStatus === 'unavailable') return copy.attractionsLocationUnavailable;
  if (attractionStatus === 'service-unavailable') return attractionError || copy.attractionsServiceUnavailable;
  if (attractionStatus === 'timeout') return copy.attractionsTimedOut;
  if (attractionStatus === 'offline') return copy.attractionsOffline;
  if (attractionStatus === 'cached') return copy.attractionsCached;
  if (attractionStatus === 'empty') return copy.attractionsNoResults;
  return '';
}

function overpassPostOptions(query: string): RequestInit {
  return {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ data: query }),
  };
}

function overpassEndpoints() {
  const configured = localStorage.getItem('mtp-overpass-endpoint');
  const fallback = localStorage.getItem('mtp-overpass-fallback-endpoint') ?? 'https://overpass.kumi.systems/api/interpreter';
  return [...new Set([configured || overpassUrl(), fallback].filter(Boolean))];
}

function isTemporaryOverpassError(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return error instanceof Error && /HTTP (406|408|429|500|502|503|504)/.test(error.message);
}

function recordAttractionDiagnostic(stage: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  attractionDiagnostics = [`${stage}: ${message}`, ...attractionDiagnostics].slice(0, 6);
  if (isLocalDevelopment()) console.warn(`[attractions] ${stage}`, error);
}

function isLocalDevelopment() {
  return ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
}

function filteredAttractionResults() {
  return sortAttractions(filterAttractions(attractionResults, attractionFilters), attractionSort);
}

function destinationAttractionCenter(city = selectedCity()): PrayerCenter {
  return { latitude: city.coordinates.lat, longitude: city.coordinates.lng, label: `${city.city}, ${city.country}` };
}

async function attractionJson<T>(url: string, stage: string, milliseconds = 7000) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), milliseconds);
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json() as T;
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || !/HTTP (429|500|502|503|504)/.test(error.message) || attempt === 1) break;
      await new Promise((resolve) => window.setTimeout(resolve, 900));
    } finally {
      window.clearTimeout(timeout);
    }
  }
  recordAttractionDiagnostic(stage, lastError);
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function requestAttractionBatch(batch: AttractionQueryBatch) {
  let lastError: unknown;
  const endpoints = overpassEndpoints();
  for (const endpoint of endpoints) {
    try {
      return await requestJson<OverpassResponse>(endpoint, overpassPostOptions(batch.query), 9000);
    } catch (error) {
      lastError = error;
      recordAttractionDiagnostic(`Overpass ${batch.label} via ${new URL(endpoint).hostname}`, error);
      if (!isTemporaryOverpassError(error)) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function commonsPhotoFromFilename(filename: string) {
  if (!filename) return undefined;
  const data = await attractionJson<unknown>(commonsImageInfoUrl(filename), `Commons imageinfo ${filename}`);
  return normalizeCommonsImage(data);
}

async function commonsPhotoFromCategory(category: string, attraction: Attraction, extraNames: string[]) {
  if (!category) return undefined;
  const data = await attractionJson<unknown>(commonsCategoryImagesUrl(category), `Commons category ${category}`);
  return selectHighConfidenceCommonsImage(data, attraction, extraNames) ?? firstLicensedCommonsImage(data);
}

async function wikipediaAttractionSummary(title: string, language = 'en') {
  if (!title) return { wikipediaExtract: '', photo: undefined as AttractionPhoto | undefined, wikidata: '', englishTitle: '' };
  const summary = await attractionJson<{ extract?: string; wikibase_item?: string; lang?: string; title?: string; originalimage?: { source?: string }; thumbnail?: { source?: string } }>(wikipediaSummaryUrlFor(language, title), `Wikipedia summary ${language}:${title}`);
  const imageUrl = summary.originalimage?.source ?? summary.thumbnail?.source ?? '';
  const filename = commonsFilenameFromImageUrl(imageUrl);
  let photo: AttractionPhoto | undefined;
  if (filename) photo = await commonsPhotoFromFilename(filename);
  const wikipediaExtract = language === 'en' ? summary.extract ?? '' : '';
  return { wikipediaExtract, photo, wikidata: summary.wikibase_item ?? '', englishTitle: language === 'en' ? summary.title ?? title : '' };
}

function attractionEnrichmentKey(attraction: Attraction) {
  return attraction.wikidata || attraction.wikipediaRaw || attraction.commons || attraction.sourceUrl;
}

async function resolveAttractionPhotoAndHistory(attraction: Attraction, cityName: string) {
  const cacheKey = attractionEnrichmentKey(attraction);
  const cached = attractionEnrichmentCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return { ...cached.result, distanceKm: attraction.distanceKm };
  let photo: AttractionPhoto | undefined;
  let wikipediaExtract = '';
  let wikidataDescription = '';
  const extraNames = [...attraction.aliases];
  const commonsFilename = commonsFilenameFromTag(attraction.commons);
  const commonsCategory = commonsCategoryFromTag(attraction.commons);
  if (commonsFilename) {
    try {
      photo = await commonsPhotoFromFilename(commonsFilename);
    } catch {
      photo = undefined;
    }
  }
  if (!photo && commonsCategory) {
    try {
      photo = await commonsPhotoFromCategory(commonsCategory, attraction, extraNames);
    } catch {
      photo = undefined;
    }
  }
  let wikidataId = attraction.wikidata;
  if (!wikidataId && attraction.wikipediaRaw) {
    try {
      const parsed = parseWikipediaTag(attraction.wikipediaRaw);
      const summary = await wikipediaAttractionSummary(parsed.title, parsed.language);
      wikidataId = summary.wikidata;
      if (!photo) photo = summary.photo;
    } catch {
      wikidataId = '';
    }
  }
  if (wikidataId) {
    try {
      const entity = await attractionJson<unknown>(wikidataEntityUrl(wikidataId), `Wikidata entity ${wikidataId}`);
      wikidataDescription = wikidataEnglishDescription(entity, wikidataId);
      extraNames.push(wikidataEnglishLabel(entity, wikidataId), wikidataEnglishTitle(entity, wikidataId), ...wikidataEnglishAliases(entity, wikidataId));
      const p18 = wikidataP18Filename(entity, wikidataId);
      if (!photo && p18) photo = await commonsPhotoFromFilename(p18);
      if (!wikipediaExtract) {
        const englishTitle = wikidataEnglishTitle(entity, wikidataId);
        if (englishTitle) {
          const summary = await wikipediaAttractionSummary(englishTitle, 'en');
          wikipediaExtract = summary.wikipediaExtract;
          if (!photo) photo = summary.photo;
        }
      }
    } catch {
      wikidataDescription = '';
    }
  }
  if (attraction.wikipedia) {
    try {
      const summary = await wikipediaAttractionSummary(attraction.wikipedia, 'en');
      wikipediaExtract = summary.wikipediaExtract;
      if (!photo) photo = summary.photo;
    } catch {
      wikipediaExtract = '';
    }
  }
  if (!photo) {
    try {
      const countryName = attractionCenter?.label?.split(',').slice(1).join(',').trim() ?? selectedCity().country;
      const search = await attractionJson<unknown>(commonsSearchUrl(attraction, cityName, countryName), `Commons exact-name search ${attraction.name}`);
      photo = selectHighConfidenceCommonsImage(search, attraction, extraNames);
    } catch {
      photo = undefined;
    }
  }
  const result = enrichAttraction(attraction, { wikipediaExtract, wikidataDescription, osmDescription: attraction.osmDescription, photo, photoStatus: 'checked' });
  attractionEnrichmentCache.set(cacheKey, { expires: Date.now() + 24 * 60 * 60 * 1000, result });
  return result;
}

async function progressiveAttractionEnrichment(sequence: number) {
  const candidates = attractionResults.filter((attraction) => attraction.photoStatus !== 'checked' && attraction.photoStatus !== 'error');
  if (!candidates.length) return;
  attractionResults = attractionResults.map((attraction) => candidates.some((candidate) => candidate.id === attraction.id) ? { ...attraction, photoStatus: 'loading' } : attraction);
  attractionStatus = 'photos';
  attractionsPage();
  const cityName = attractionCenter?.label?.split(',')[0] ?? selectedCity().city;
  for (const attraction of candidates) {
    if (sequence !== attractionEnrichmentSequence) return;
    try {
      const current = attractionResults.find((candidate) => candidate.id === attraction.id) ?? attraction;
      const updated = await resolveAttractionPhotoAndHistory(current, cityName);
      attractionResults = attractionResults.map((candidate) => candidate.id === attraction.id ? updated : candidate);
      if (attractionCacheKey) attractionCache.set(attractionCacheKey, { expires: Date.now() + 10 * 60 * 1000, results: attractionResults });
      attractionsPage();
    } catch (error) {
      recordAttractionDiagnostic(`Attraction enrichment ${attraction.name}`, error);
      attractionResults = attractionResults.map((candidate) => candidate.id === attraction.id ? { ...candidate, photoStatus: 'error' } : candidate);
      if (attractionCacheKey) attractionCache.set(attractionCacheKey, { expires: Date.now() + 10 * 60 * 1000, results: attractionResults });
      attractionsPage();
    }
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
  if (sequence === attractionEnrichmentSequence && attractionStatus === 'photos') {
    attractionStatus = 'ready';
    attractionsPage();
  }
}

async function searchAttractions(center: PrayerCenter) {
  attractionCenter = center;
  attractionMapMoved = false;
  const cacheKey = `${center.latitude.toFixed(4)},${center.longitude.toFixed(4)},${attractionRadiusKm}`;
  attractionCacheKey = cacheKey;
  const cached = attractionCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    attractionResults = cached.results;
    attractionStatus = attractionResults.length ? 'cached' : 'empty';
    attractionsPage();
    if (attractionResults.some((attraction) => attraction.photoStatus !== 'checked' && attraction.photoStatus !== 'error')) {
      void progressiveAttractionEnrichment(++attractionEnrichmentSequence);
    }
    return;
  }
  const sequence = ++attractionSearchSequence;
  attractionResults = [];
  attractionStatus = 'searching';
  attractionError = '';
  attractionDiagnostics = [];
  attractionsPage();
  const watchdog = window.setTimeout(() => {
    if (sequence !== attractionSearchSequence || attractionStatus !== 'searching') return;
    attractionStatus = 'timeout';
    attractionError = labels[lang].attractionsTimedOut;
    attractionsPage();
  }, 14000);
  try {
    const batches = buildAttractionOverpassBatches(center.latitude, center.longitude, attractionRadiusKm);
    let successfulBatches = 0;
    let lastError: unknown;
    for (const batch of batches) {
      if (sequence !== attractionSearchSequence) return;
      try {
        const data = await requestAttractionBatch(batch);
        if (sequence !== attractionSearchSequence) return;
        successfulBatches += 1;
        const normalized = (data.elements ?? [])
          .map((element) => normalizeAttraction(element, center))
          .filter((attraction): attraction is Attraction => Boolean(attraction))
          .filter((attraction) => attraction.distanceKm <= attractionRadiusKm)
          .map((attraction) => enrichAttraction(attraction, { osmDescription: attraction.osmDescription }));
        attractionResults = dedupeAttractions([...attractionResults, ...normalized]).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 250);
        attractionStatus = attractionResults.length ? 'ready' : 'searching';
        attractionCache.set(cacheKey, { expires: Date.now() + 10 * 60 * 1000, results: attractionResults });
        attractionsPage();
      } catch (error) {
        lastError = error;
      }
    }
    if (sequence !== attractionSearchSequence) return;
    if (attractionResults.length) {
      attractionStatus = 'ready';
      attractionCache.set(cacheKey, { expires: Date.now() + 10 * 60 * 1000, results: attractionResults });
      attractionsPage();
      void progressiveAttractionEnrichment(++attractionEnrichmentSequence);
      return;
    }
    if (!successfulBatches) throw lastError instanceof Error ? lastError : new Error('Attraction search failed');
    attractionStatus = 'empty';
    attractionsPage();
    return;
  } catch (error) {
    console.error(error);
    if (sequence !== attractionSearchSequence) return;
    if (cached) {
      attractionResults = cached.results;
      attractionStatus = navigator.onLine ? 'cached' : 'offline';
    } else {
      attractionResults = [];
      attractionStatus = isTemporaryOverpassError(error) ? 'timeout' : 'service-unavailable';
      attractionError = isTemporaryOverpassError(error) ? labels[lang].attractionsTimedOut : labels[lang].attractionsServiceUnavailable;
    }
  } finally {
    window.clearTimeout(watchdog);
  }
  attractionsPage();
}

function requestAttractionLocation() {
  if (!navigator.geolocation) {
    attractionStatus = 'unavailable';
    attractionsPage();
    return;
  }
  attractionStatus = 'requesting';
  attractionsPage();
  navigator.geolocation.getCurrentPosition(
    (position) => void searchAttractions({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: labels[lang].qiblaLocation }),
    (error) => {
      attractionStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      attractionsPage();
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

async function searchAttractionDestination() {
  const query = attractionManualQuery.trim();
  if (!query) return;
  const city = cities.find((candidate) => candidate.city.toLowerCase() === query.toLowerCase());
  if (city) {
    await searchAttractions(destinationAttractionCenter(city));
    return;
  }
  attractionStatus = 'searching';
  attractionsPage();
  const center = await resolveRestaurantDestination(query);
  if (center) await searchAttractions(center);
  else {
    attractionResults = [];
    attractionStatus = 'empty';
    attractionsPage();
  }
}

function debouncedAttractionSearch(center: PrayerCenter) {
  if (attractionSearchTimer) window.clearTimeout(attractionSearchTimer);
  attractionSearchTimer = window.setTimeout(() => void searchAttractions(center), 450);
}

function attractionAppleMapsUrl(attraction: Attraction) {
  return `https://maps.apple.com/?daddr=${attraction.latitude},${attraction.longitude}&q=${encodeURIComponent(attraction.name)}`;
}

function attractionBrowserDirectionsUrl(attraction: Attraction) {
  return `https://www.openstreetmap.org/directions?to=${attraction.latitude},${attraction.longitude}#map=17/${attraction.latitude}/${attraction.longitude}`;
}

function initializeAttractionsMap() {
  attractionsMap?.remove();
  attractionsMap = undefined;
  const element = document.querySelector<HTMLElement>('#attractions-map');
  if (!element || !attractionCenter || !window.maplibregl) return;
  try {
    element.replaceChildren();
    attractionsMap = new window.maplibregl.Map({
      container: element,
      style: openFreeMapStyle,
      center: [attractionCenter.longitude, attractionCenter.latitude],
      zoom: attractionRadiusKm <= 3 ? 13 : attractionRadiusKm <= 10 ? 11 : 9,
      attributionControl: true,
    });
    attractionsMap.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), document.documentElement.dir === 'rtl' ? 'top-right' : 'top-left');
    for (const attraction of filteredAttractionResults()) {
      const info = `${attractionCategoryLabel(attraction.category, labels[lang])}: ${attraction.name}`;
      new window.maplibregl.Marker({ color: attraction.id === selectedAttractionId ? '#7c3aed' : '#0f766e' }).setLngLat([attraction.longitude, attraction.latitude]).setPopup(new window.maplibregl.Popup({ offset: 18 }).setText(`${info}. ${attraction.history || categoryExplanation(attraction.category)}`)).addTo(attractionsMap);
    }
    attractionsMap.on('moveend', () => {
      attractionMapMoved = true;
      const button = document.querySelector<HTMLButtonElement>('#attractions-search-this-area');
      if (button) button.hidden = false;
    });
  } catch {
    element.innerHTML = `<p class="map-fallback">${labels[lang].mapUnavailable}</p>`;
  }
}

function attractionPhoto(attraction: Attraction, copy: typeof labels[Language], large = false) {
  if (!attraction.photo) {
    const loading = attraction.photoStatus !== 'checked' && attraction.photoStatus !== 'error';
    const message = loading ? copy.attractionsLoadingPhotos : copy.attractionsNoLicensedImage;
    return `<div class="attraction-placeholder ${large ? 'large' : ''} ${loading ? 'loading' : ''}" role="img" aria-label="${message}">${attractionCategoryLabel(attraction.category, copy)}<small>${message}</small></div>`;
  }
  return `<figure class="attraction-photo ${large ? 'large' : ''}"><img src="${esc(attraction.photo.thumbnailUrl)}" alt="${esc(`Licensed photo of ${attraction.name}`)}" loading="lazy" /><figcaption><a href="${esc(attraction.photo.sourceUrl)}" target="_blank" rel="noopener noreferrer">Photo: ${esc(attraction.photo.creator || attraction.photo.title)}</a> · ${esc(attraction.photo.license)} · Wikimedia Commons</figcaption></figure>`;
}

function attractionDetailsRows(attraction: Attraction, copy: typeof labels[Language]) {
  const rows = [
    [copy.attractionsCategory, attractionCategoryLabel(attraction.category, copy)],
    [copy.prayerAddress, attraction.address],
    [copy.prayerOpeningHours, attraction.openingHours || copy.halalOpeningUnavailable],
    [copy.halalOpen, attraction.openState === 'open' ? copy.halalOpen : attraction.openState === 'closed' ? copy.halalClosed : ''],
    [copy.prayerWebsite, attraction.website ? `<a href="${esc(attraction.website)}" target="_blank" rel="noopener noreferrer">${esc(attraction.website)}</a>` : ''],
    [copy.prayerTelephone, attraction.phone],
    [copy.toiletsWheelchair, attraction.wheelchair === 'yes' ? copy.toiletsWheelchair : attraction.wheelchair === 'limited' ? copy.toiletsWheelchairLimited : ''],
    [copy.attractionsAdmission, attraction.fee === 'free' ? copy.toiletsFree : attraction.fee === 'paid' ? copy.toiletsPaid : ''],
    [copy.attractionsInfoSource, attraction.historySource],
  ].filter(([, value]) => Boolean(value));
  return `<dl class="place-details">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function attractionCard(attraction: Attraction, copy: typeof labels[Language]) {
  return `<article class="card attraction-card" aria-label="${esc(attraction.name)}">
    ${attractionPhoto(attraction, copy)}
    <div class="card-top"><span>${attraction.distanceKm.toFixed(1)} km</span><span class="badge attraction-${attraction.category}">${attractionCategoryLabel(attraction.category, copy)}</span></div>
    <h3>${esc(attraction.name)}</h3>
    <p class="attraction-history">${esc(attraction.history || categoryExplanation(attraction.category))}</p>
    ${attractionDetailsRows(attraction, copy)}
    <div class="place-actions">
      <button type="button" class="ghost" data-attraction-detail="${attraction.id}">${copy.attractionsDetails}</button>
      <button type="button" class="ghost" data-attraction-save="${attraction.id}">${copy.attractionsSave}</button>
      ${attraction.readMoreUrl ? `<a class="map-link" href="${esc(attraction.readMoreUrl)}" target="_blank" rel="noopener noreferrer">${copy.attractionsReadMore}</a>` : ''}
      <a class="map-link" href="${attraction.sourceUrl}" target="_blank" rel="noopener noreferrer">${copy.prayerViewOnMap}</a>
      <a class="map-link" href="${attractionAppleMapsUrl(attraction)}" target="_blank" rel="noopener noreferrer">${copy.prayerAppleMaps}</a>
      <a class="map-link" href="${attractionBrowserDirectionsUrl(attraction)}" target="_blank" rel="noopener noreferrer">${copy.prayerBrowserMap}</a>
    </div>
  </article>`;
}

function selectedAttractionDetail(copy: typeof labels[Language]) {
  const attraction = attractionResults.find((item) => item.id === selectedAttractionId);
  if (!attraction) return '';
  return `<section class="panel attraction-detail"><button type="button" class="ghost" id="close-attraction-detail">${copy.attractionsClose}</button>${attractionPhoto(attraction, copy, true)}<h2>${esc(attraction.name)}</h2><p>${esc(attraction.history || categoryExplanation(attraction.category))}</p>${attractionDetailsRows(attraction, copy)}<div class="place-actions"><a class="map-link" href="#prayer-spaces">${copy.prayerSpacesTitle}</a><a class="map-link" href="#halal-restaurants">${copy.halalRestaurantsTitle}</a><a class="map-link" href="#public-toilets">${copy.toiletsTitle}</a><a class="map-link" href="#weather">${copy.weatherTitle}</a></div></section>`;
}

function attractionsPage() {
  if (!root) return;
  cityMap?.remove();
  cityMap = undefined;
  prayerMap?.remove();
  prayerMap = undefined;
  restaurantMap?.remove();
  restaurantMap = undefined;
  toiletMap?.remove();
  toiletMap = undefined;
  carRentalMap?.remove();
  carRentalMap = undefined;
  const copy = labels[lang];
  const dir = languageDirection(lang);
  const results = filteredAttractionResults();
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  root.innerHTML = `<main dir="${dir}" class="app prayer-app attractions-app">
    <section class="hero prayer-hero">${languageSelector()}<p class="eyebrow">${copy.attractionsOpen}</p><h1>${copy.attractionsTitle}</h1><p>${copy.attractionsSubtitle}</p><button type="button" class="ghost hero-action" id="back-from-attractions">${copy.attractionsBack}</button></section>
    <section class="panel prayer-panel" aria-live="polite">
      <p class="notice prayer-notice">${copy.attractionsNotice}</p><p class="notice prayer-notice">${copy.attractionsPhotoNotice}</p>
      <div class="prayer-actions"><button type="button" id="use-attraction-location">${copy.attractionsUseLocation}</button><button type="button" id="use-attraction-destination" class="ghost">${copy.attractionsUseDestination}</button><label>${copy.toiletsRadius}<select id="attraction-radius">${attractionRadii.map((radius) => `<option value="${radius}" ${radius === attractionRadiusKm ? 'selected' : ''}>${radius} km</option>`).join('')}</select></label><form id="manual-attraction-search" class="manual-search"><label>${copy.attractionsManualSearch}<input id="attraction-manual-query" list="attraction-cities" value="${esc(attractionManualQuery)}" placeholder="${copy.weatherManualPlaceholder}" /></label><button type="submit">${copy.attractionsSearch}</button></form></div>
      <datalist id="attraction-cities">${cities.map((city) => `<option value="${city.city}">${city.country}</option>`).join('')}</datalist>
      <p class="prayer-status ${attractionStatus}" role="status">${attractionStatusMessage(copy)}</p>
      <div class="segmented" role="tablist" aria-label="${copy.attractionsTitle}"><button type="button" class="${attractionView === 'photos' ? 'active' : 'ghost'}" data-attraction-view="photos">${copy.attractionsPhotoView}</button><button type="button" class="${attractionView === 'list' ? 'active' : 'ghost'}" data-attraction-view="list">${copy.attractionsListView}</button><button type="button" class="${attractionView === 'map' ? 'active' : 'ghost'}" data-attraction-view="map">${copy.attractionsMapView}</button></div>
      <div class="prayer-filters"><select id="attraction-category-filter"><option value="all">${copy.attractionsAll}</option>${(['historic','museum','gallery','monument','archaeological','castle','religious','viewpoint','natural','park','zoo','theme','artwork','cultural','other'] as AttractionCategory[]).map((category) => `<option value="${category}" ${attractionFilters.category === category ? 'selected' : ''}>${attractionCategoryLabel(category, copy)}</option>`).join('')}</select>${['photo','history','openNow','free','wheelchair'].map((key) => { const label = ({ photo: copy.attractionsPhotoAvailable, history: copy.attractionsHistoryAvailable, openNow: copy.toiletsOpenNow, free: copy.toiletsFree, wheelchair: copy.toiletsWheelchair } as Record<string, string>)[key]; return `<label class="inline-check"><input type="checkbox" data-attraction-filter="${key}" ${attractionFilters[key as keyof AttractionFilters] ? 'checked' : ''}/> ${label}</label>`; }).join('')}<label>${copy.carRentalSort}<select id="attraction-sort"><option value="distance" ${attractionSort === 'distance' ? 'selected' : ''}>${copy.toiletsNearest}</option><option value="name" ${attractionSort === 'name' ? 'selected' : ''}>${copy.toiletsSortName}</option><option value="category" ${attractionSort === 'category' ? 'selected' : ''}>${copy.attractionsSortCategory}</option><option value="photo" ${attractionSort === 'photo' ? 'selected' : ''}>${copy.attractionsSortPhoto}</option><option value="history" ${attractionSort === 'history' ? 'selected' : ''}>${copy.attractionsSortHistory}</option><option value="open" ${attractionSort === 'open' ? 'selected' : ''}>${copy.toiletsSortOpen}</option><option value="complete" ${attractionSort === 'complete' ? 'selected' : ''}>${copy.attractionsSortComplete}</option></select></label></div>
      <div class="place-actions"><button type="button" id="attractions-search-this-area" class="ghost" ${attractionMapMoved ? '' : 'hidden'}>${copy.toiletsSearchThisArea}</button><button type="button" id="attractions-recentre" class="ghost">${copy.toiletsRecentre}</button><button type="button" id="attractions-fit-results" class="ghost">${copy.toiletsFitResults}</button></div>
      ${selectedAttractionDetail(copy)}
      ${attractionView === 'map' ? `<div id="attractions-map" class="city-map prayer-map"><p class="map-fallback">${copy.mapUnavailable}</p></div>` : `<div class="${attractionView === 'photos' ? 'attraction-grid' : 'place-list'}">${results.length ? results.map((attraction) => attractionCard(attraction, copy)).join('') : attractionStatus === 'ready' ? `<p>${copy.attractionsNoResults}</p>` : ''}</div>`}
      ${(['empty', 'timeout', 'service-unavailable', 'offline', 'cached'].includes(attractionStatus) || !results.length && attractionResults.length > 0) ? `<div class="empty-actions"><button type="button" id="retry-attractions" class="ghost">${copy.weatherRetry}</button>${attractionStatus === 'timeout' ? '' : `<button type="button" id="increase-attraction-radius">${copy.toiletsIncreaseRadius}</button>`}<button type="button" id="another-attraction-city" class="ghost">${copy.attractionsSearchAnother}</button></div>` : ''}
      ${isLocalDevelopment() && attractionDiagnostics.length ? `<details class="dev-diagnostics"><summary>Attraction enrichment diagnostics</summary><ul>${attractionDiagnostics.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></details>` : ''}
      <p class="map-status">${copy.osmAttribution} · Wikimedia Commons · Wikipedia · Wikidata</p>
    </section>
  </main>`;
  bindAttractionsPage();
  if (attractionView === 'map') initializeAttractionsMap();
}

function bindAttractionsPage() {
  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => { lang = (event.target as HTMLSelectElement).value as Language; attractionsPage(); });
  document.querySelector<HTMLButtonElement>('#back-from-attractions')?.addEventListener('click', () => { view = 'planner'; attractionsMap?.remove(); attractionsMap = undefined; if (window.location.hash) history.pushState(null, '', window.location.pathname + window.location.search); render(); });
  document.querySelector<HTMLButtonElement>('#use-attraction-location')?.addEventListener('click', requestAttractionLocation);
  document.querySelector<HTMLButtonElement>('#use-attraction-destination')?.addEventListener('click', () => void searchAttractions(destinationAttractionCenter()));
  document.querySelector<HTMLSelectElement>('#attraction-radius')?.addEventListener('change', (event) => { attractionRadiusKm = Number((event.target as HTMLSelectElement).value) as typeof attractionRadii[number]; if (attractionCenter) void searchAttractions(attractionCenter); });
  document.querySelector<HTMLFormElement>('#manual-attraction-search')?.addEventListener('submit', (event) => { event.preventDefault(); attractionManualQuery = document.querySelector<HTMLInputElement>('#attraction-manual-query')?.value ?? ''; void searchAttractionDestination(); });
  document.querySelectorAll<HTMLButtonElement>('[data-attraction-view]').forEach((button) => button.addEventListener('click', () => { attractionView = button.dataset.attractionView as AttractionView; attractionsPage(); }));
  document.querySelector<HTMLSelectElement>('#attraction-category-filter')?.addEventListener('change', (event) => { attractionFilters = { ...attractionFilters, category: (event.target as HTMLSelectElement).value as AttractionFilters['category'] }; attractionsPage(); });
  document.querySelectorAll<HTMLInputElement>('[data-attraction-filter]').forEach((input) => input.addEventListener('change', () => { attractionFilters = { ...attractionFilters, [input.dataset.attractionFilter ?? 'photo']: input.checked }; attractionsPage(); }));
  document.querySelector<HTMLSelectElement>('#attraction-sort')?.addEventListener('change', (event) => { attractionSort = (event.target as HTMLSelectElement).value as AttractionSort; attractionsPage(); });
  document.querySelectorAll<HTMLButtonElement>('[data-attraction-detail]').forEach((button) => button.addEventListener('click', () => { selectedAttractionId = button.dataset.attractionDetail ?? ''; attractionsPage(); }));
  document.querySelector<HTMLButtonElement>('#close-attraction-detail')?.addEventListener('click', () => { selectedAttractionId = ''; attractionsPage(); });
  document.querySelectorAll<HTMLButtonElement>('[data-attraction-save]').forEach((button) => button.addEventListener('click', () => { button.textContent = labels[lang].attractionsSaved; }));
  document.querySelector<HTMLButtonElement>('#retry-attractions')?.addEventListener('click', () => { if (attractionCenter) void searchAttractions(attractionCenter); else void searchAttractions(destinationAttractionCenter()); });
  document.querySelector<HTMLButtonElement>('#increase-attraction-radius')?.addEventListener('click', () => { const next = attractionRadii.find((radius) => radius > attractionRadiusKm); if (next) attractionRadiusKm = next; if (attractionCenter) void searchAttractions(attractionCenter); });
  document.querySelector<HTMLButtonElement>('#another-attraction-city')?.addEventListener('click', () => document.querySelector<HTMLInputElement>('#attraction-manual-query')?.focus());
  document.querySelector<HTMLButtonElement>('#attractions-search-this-area')?.addEventListener('click', () => { const center = attractionsMap?.getCenter?.(); if (!center) return; debouncedAttractionSearch({ latitude: center.lat, longitude: center.lng, label: labels[lang].toiletsSearchThisArea }); });
  document.querySelector<HTMLButtonElement>('#attractions-recentre')?.addEventListener('click', requestAttractionLocation);
  document.querySelector<HTMLButtonElement>('#attractions-fit-results')?.addEventListener('click', () => {
    const results = filteredAttractionResults();
    if (!attractionsMap?.fitBounds || !results.length) return;
    const lngs = results.map((attraction) => attraction.longitude);
    const lats = results.map((attraction) => attraction.latitude);
    attractionsMap.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 15 });
  });
}

function selectedCity() {
  return cities.find((candidate) => candidate.city.toLowerCase() === prefs.city.toLowerCase()) ?? cities[0];
}

function cityForPreferences(planPrefs: PlannerPreferences) {
  return cities.find((candidate) => candidate.city.toLowerCase() === planPrefs.city.toLowerCase());
}

function plannerValidationMessage(planPrefs: PlannerPreferences, copy: typeof labels[Language]) {
  if (!cityForPreferences(planPrefs)) return copy.invalidCity;
  if (!Number.isFinite(planPrefs.groupSize) || planPrefs.groupSize < 1) return copy.invalidGroupSize;
  if (planPrefs.startDate && planPrefs.endDate && planPrefs.endDate < planPrefs.startDate) return copy.invalidEndDate;
  if (planPrefs.startDate && planPrefs.endDate && planPrefs.startDate === planPrefs.endDate && planPrefs.endHour < planPrefs.startHour) return copy.invalidEndTime;
  return '';
}

function readPlannerDraftFromForm() {
  let next = { ...prefs };
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]').forEach((element) => {
    const key = element.dataset.field as keyof PlannerPreferences;
    const value = element instanceof HTMLInputElement && element.type === 'checkbox' ? element.checked : element.value;
    next = { ...next, [key]: key === 'groupSize' ? Number(value) : key === 'interests' ? String(value).split(',').map((interest) => interest.trim()).filter(Boolean) : value } as PlannerPreferences;
  });
  prefs = next;
  return next;
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
  if (view === 'halal-restaurants') {
    halalRestaurantsPage();
    return;
  }
  if (view === 'public-toilets') {
    publicToiletsPage();
    return;
  }
  if (view === 'car-rental') {
    carRentalPage();
    return;
  }
  if (view === 'weather') {
    weatherPage();
    return;
  }
  if (view === 'attractions') {
    attractionsPage();
    return;
  }
  document.body.classList.remove('map-expanded');
  const copy = labels[lang];
  const dir = languageDirection(lang);
  const visibleCities = selectedRegion ? cities.filter((candidate) => candidate.region === selectedRegion) : cities;
  const draftCity = cityForPreferences(prefs) ?? cities[0];
  const selectedFormCity = visibleCities.find((candidate) => candidate.city.toLowerCase() === prefs.city.toLowerCase()) ?? visibleCities[0] ?? draftCity;
  const generatedCity = generatedPrefs ? cityForPreferences(generatedPrefs) : undefined;
  const items = generatedPrefs && generatedCity ? generateItinerary(generatedPrefs, replan, lang) : [];
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
        <article class="quick-action"><div><h2>${copy.halalRestaurantsTitle}</h2><p>${copy.halalRestaurantsSubtitle}</p></div><button type="button" id="open-halal-restaurants">${copy.halalRestaurantsOpen}</button></article>
        <article class="quick-action"><div><h2>${copy.toiletsTitle}</h2><p>${copy.toiletsSubtitle}</p></div><button type="button" id="open-public-toilets">${copy.toiletsOpen}</button></article>
        <article class="quick-action"><div><h2>${copy.carRentalTitle}</h2><p>${copy.carRentalSubtitle}</p></div><button type="button" id="open-car-rental">${copy.carRentalOpen}</button></article>
        <article class="quick-action"><div><h2>${copy.weatherTitle}</h2><p>${copy.weatherSubtitle}</p></div><button type="button" id="open-weather">${copy.weatherOpen}</button></article>
        <article class="quick-action"><div><h2>${copy.attractionsTitle}</h2><p>${copy.attractionsSubtitle}</p></div><button type="button" id="open-attractions">${copy.attractionsOpen}</button></article>
      </section>
      <section class="panel form" aria-label="${copy.formAria}">
        <div class="grid">
          <label>${copy.region}<select data-region="filter"><option value="">${copy.allRegions}</option>${regionOptions.map((region) => `<option value="${region}" ${selectedRegion === region ? 'selected' : ''}>${regionLabels[lang][region]}</option>`).join('')}</select></label>
          <label>${copy.city}<select data-field="city">${visibleCities.map((candidate) => `<option value="${candidate.city}" ${candidate.city === selectedFormCity.city ? 'selected' : ''}>${candidate.city}, ${candidate.country}</option>`).join('')}</select></label>
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
      <section class="panel results" id="planner-results" aria-live="polite">
        <p class="sr-only" role="status">${esc(plannerAnnouncement)}</p>
        ${generatedPrefs && generatedCity ? `
          <div class="result-header"><div><h2>${generatedCity.city}, ${generatedCity.country}</h2><p>${regionLabels[lang][generatedCity.region]} · ${generatedCity.timezone}</p><p>${copy.transportEstimatesAre} <strong>${statusLabels[lang].Sample}</strong>: ${copy.walking} ${generatedCity.transportEstimates.walking} ${copy.minutesShort} · ${copy.publicTransport} ${generatedCity.transportEstimates.publicTransport} ${copy.minutesShort} · ${copy.taxi} ${generatedCity.transportEstimates.taxi} ${copy.minutesShort}.</p></div><div class="legend"><strong>${copy.legend}</strong>${statusBadge('Sample')}${statusBadge('Unverified')}${statusBadge('Verified')}</div></div>
          ${athanSection(generatedCity, generatedPrefs)}
          ${mapSection(generatedCity, copy)}
          ${items.length ? items.map((item, index) => `<article class="card ${item.kind}"><div class="card-top"><span>${item.time} · ${item.durationMinutes} ${copy.minutesShort}</span>${statusBadge(item.status)}</div><h3>${item.title}</h3><p>${item.details}</p>${item.place?.evidence ? `<p class="evidence">${copy.evidenceNote}: ${item.place.evidence}</p>` : ''}${item.place?.facility ? `<p>${copy.women}: ${statusBadge(item.place.facility.womenPrayerSpace)} ${copy.wudu}: ${statusBadge(item.place.facility.wudu)} ${copy.accessibility}: ${statusBadge(item.place.facility.accessibility)}</p>` : ''}${item.place ? `<p><a class="map-link" href="${osmSearchUrl(item.place.name, generatedCity.city, generatedCity.country)}" target="_blank" rel="noopener noreferrer">${copy.findOnMap}</a></p>` : ''}<button class="ghost" data-replan="${index + 1}">${copy.replan}</button></article>`).join('') : `<p>${copy.emptyState}</p>`}
        ` : `<p class="${plannerValidation ? 'error' : 'notice'}">${esc(plannerValidation || (visibleCities.length ? copy.generatePrompt : copy.noCities))}</p>`}
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
  document.querySelector<HTMLButtonElement>('#open-halal-restaurants')?.addEventListener('click', () => {
    view = 'halal-restaurants';
    if (window.location.hash !== '#halal-restaurants') window.location.hash = 'halal-restaurants';
    render();
  });
  document.querySelector<HTMLButtonElement>('#open-public-toilets')?.addEventListener('click', () => {
    view = 'public-toilets';
    if (window.location.hash !== '#public-toilets') window.location.hash = 'public-toilets';
    render();
  });
  document.querySelector<HTMLButtonElement>('#open-car-rental')?.addEventListener('click', () => {
    view = 'car-rental';
    if (window.location.hash !== '#car-rental') window.location.hash = 'car-rental';
    render();
  });
  document.querySelector<HTMLButtonElement>('#open-weather')?.addEventListener('click', () => {
    view = 'weather';
    if (window.location.hash !== '#weather') window.location.hash = 'weather';
    void loadWeather(destinationWeatherLocation());
    render();
  });
  document.querySelector<HTMLButtonElement>('#open-attractions')?.addEventListener('click', () => {
    view = 'attractions';
    if (window.location.hash !== '#attractions') window.location.hash = 'attractions';
    void searchAttractions(destinationAttractionCenter());
    render();
  });
  document.querySelector('#plan')?.addEventListener('click', () => {
    const copy = labels[lang];
    const next = readPlannerDraftFromForm();
    plannerValidation = plannerValidationMessage(next, copy);
    plannerAnnouncement = '';
    if (plannerValidation) {
      render();
      document.querySelector('#planner-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    generatedPrefs = { ...next, interests: [...next.interests] };
    replan = 0;
    plannerAnnouncement = copy.itineraryReady;
    render();
    document.querySelector('#planner-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    const visible = selectedRegion ? cities.filter((candidate) => candidate.region === selectedRegion) : cities;
    if (visible.length && !visible.some((candidate) => candidate.city.toLowerCase() === prefs.city.toLowerCase())) {
      prefs = { ...prefs, city: visible[0].city };
    }
    plannerValidation = '';
    plannerAnnouncement = '';
    render();
  });
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]').forEach((element) => element.addEventListener('change', () => {
    const key = element.dataset.field as keyof PlannerPreferences;
    const value = element instanceof HTMLInputElement && element.type === 'checkbox' ? element.checked : element.value;
    prefs = { ...prefs, [key]: key === 'groupSize' ? Number(value) : key === 'interests' ? String(value).split(',').map((interest) => interest.trim()).filter(Boolean) : value } as PlannerPreferences;
    plannerValidation = '';
    plannerAnnouncement = '';
    if (key === 'city' || key === 'prayerMethod' || key === 'startDate') {
      athanStatus = '';
      render();
    }
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-replan]').forEach((button) => button.addEventListener('click', () => {
    replan = Number(button.dataset.replan);
    plannerAnnouncement = '';
    render();
  }));
}

window.addEventListener('hashchange', () => {
  view = viewFromHash();
  if (view === 'planner') { stopQiblaOrientation(); prayerMap?.remove(); prayerMap = undefined; restaurantMap?.remove(); restaurantMap = undefined; }
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
