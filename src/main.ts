import { cities } from './data.js';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { generateItinerary } from './planner.js';
import { RequestError, classifyRequestError, requestJson, retryOnceForTemporary } from './http.js';
import { requestHalalWithFailover } from './halal-overpass.js';
import { calculateQiblaBearing, formatCoordinate, normalizeDegrees } from './qibla.js';
import {
  airportByIata,
  airportLabel,
  airports,
  chooseFlightProgress,
  createPreparedFlightPlan,
  elapsedProgress,
  flightPlanFromTravelDetails,
  positionByProgress,
  searchAirports,
  signedShortestAngle,
  validateWaypoint,
  type FlightPosition,
  type PreparedFlightPlan,
} from './flight-mode.js';
import { FlightPlanRepository } from './flight-storage.js';
import { calculateInflightPrayerSnapshot, formatInTimeZone, formatUtcTime } from './inflight-prayer.js';
import { buildOverpassQuery, ensureLatinDisplayName, getEnglishPlaceName, isReliablyOpenNow, normalizePrayerPlace, type PrayerPlace, type PrayerPlaceType } from './prayer-spaces.js';
import { openingState, type OpeningState } from './opening-hours.js';
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
  buildPublicTransportOverpassQuery,
  dedupePublicTransportStops,
  filterPublicTransportStops,
  normalizePublicTransportStop,
  sortPublicTransportStops,
  type PublicTransportFilters,
  type PublicTransportSort,
  type PublicTransportStop,
  type PublicTransportType,
} from './public-transport.js';
import {
  buildTaxiOverpassQuery,
  dedupeTaxiServices,
  filterTaxiServices,
  normalizeTaxiService,
  sortTaxiServices,
  type TaxiFilters,
  type TaxiService,
  type TaxiServiceType,
  type TaxiSort,
} from './taxi-services.js';
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
  cacheKeyForHistory,
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
import type { ItineraryItem, PlannerPreferences, PrayerName, Region, VerificationStatus } from './models.js';
import { createSavedTrip, defaultTripName, duplicateSavedTrip, sanitizeTripName, SavedTripRepository, type SavedTrip } from './saved-trips.js';
import { currentConnectionState, registerAppServiceWorker, type ConnectionState } from './offline.js';
import { buildReportText, createPlaceReport, githubIssueUrl, osmReportUrl, reportReasons, sanitizeReportNote, type ReportReason, type ReportablePlace } from './place-report.js';
import { buildItineraryText, type TripExportSnapshot } from './trip-share.js';
import { isAppGeolocationAvailable, requestCurrentAppPosition, watchAppPosition, type AppPositionWatch } from './native-location.js';
import { copyText, exportTripCalendarFile, shareText } from './native-share.js';
import { bindNativeExternalLinks, staticLegalPageUrl } from './native-links.js';
import { deleteTravelDetail, emptyTravelDetails, sortTravelDetails, upsertTravelDetail, validateTravelDetailInput, validateTravelDetailsSnapshot, type TravelDetailEntry, type TravelDetailInput, type TravelDetailsSnapshot, type TravelDetailType } from './travel-details.js';
import { dateTimeForZone } from './time-zones.js';

(window as unknown as { maplibregl?: typeof maplibregl }).maplibregl = maplibregl;

let lang: Language = 'en';
type View = 'planner' | 'saved-trips' | 'qibla' | 'flight-mode' | 'prayer-spaces' | 'money' | 'halal-restaurants' | 'public-toilets' | 'car-rental' | 'public-transport' | 'taxi-services' | 'weather' | 'attractions';
type QiblaLocation = { latitude: number; longitude: number; accuracy?: number };
type QiblaLocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable';
type QiblaMotionStatus = 'idle' | 'active' | 'denied' | 'unavailable';
type DeviceOrientationEventWithPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };
type CompassOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

const viewFromHash = (): View => window.location.hash === '#saved-trips' ? 'saved-trips' : window.location.hash === '#qibla' ? 'qibla' : window.location.hash === '#flight-mode' ? 'flight-mode' : window.location.hash === '#prayer-spaces' ? 'prayer-spaces' : window.location.hash === '#money' ? 'money' : window.location.hash === '#halal-restaurants' ? 'halal-restaurants' : window.location.hash === '#public-toilets' ? 'public-toilets' : window.location.hash === '#car-rental' ? 'car-rental' : window.location.hash === '#public-transport' ? 'public-transport' : window.location.hash === '#taxi-services' ? 'taxi-services' : window.location.hash === '#weather' ? 'weather' : window.location.hash === '#attractions' ? 'attractions' : 'planner';
let view: View = viewFromHash();
let qiblaLocationStatus: QiblaLocationStatus = 'idle';
let qiblaMotionStatus: QiblaMotionStatus = 'idle';
let qiblaLocation: QiblaLocation | undefined;
let qiblaLocationSequence = 0;
let qiblaHeading: number | undefined;
let qiblaOrientationListenersActive = false;
let qiblaAnimationFrame = 0;
let qiblaLastRenderedHeading: number | undefined;
const QIBLA_HEADING_THRESHOLD = 1;
const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

let replan = 0;
let selectedRegion: Region | '' = '';
let athanEnabled = localStorage.getItem('athanEnabled') === 'true';
let athanStatus = '';
let prefs: PlannerPreferences = {
  city: 'London',
  startDate: todayIso(),
  endDate: todayIso(),
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
let generatedItems: ItineraryItem[] = [];
let currentTravelDetails: TravelDetailsSnapshot = emptyTravelDetails();
let travelDetailEditor: { mode: 'add' | 'edit'; type: TravelDetailType; id?: string; error?: string; triggerId?: string } | null = null;
let openedSavedTripId = '';
let savedTripNameDraft = '';
let savedTrips: SavedTrip[] = [];
let savedTripsCorrupted = false;
let savedTripStatus: 'idle' | 'saved' | 'unsaved' | 'failed' | 'deleted' = 'idle';
let savedTripMessage = '';
let reportStatus = '';
let tripShareStatus = '';
let connectionState: ConnectionState = currentConnectionState();
let connectionNotice: ConnectionState | 'hidden' = connectionState === 'offline' ? 'offline' : 'hidden';
let connectionNoticeTimer: number | undefined;
let connectionWasOffline = connectionState === 'offline';
let plannerValidation = '';
let plannerAnnouncement = '';
const savedTripRepository = new SavedTripRepository(localStorage);
const flightPlanRepository = new FlightPlanRepository(localStorage);
const loadedFlightPlan = flightPlanRepository.read();
let preparedFlightPlan: PreparedFlightPlan | null = loadedFlightPlan.plan;
let flightPlanCorrupted = loadedFlightPlan.corrupted;
let flightEditing = !preparedFlightPlan;
let flightStatus = '';
let flightManualProgress = preparedFlightPlan ? elapsedProgress(preparedFlightPlan) : 0;
let flightGpsEnabled = false;
let flightLocationStatus: 'idle' | 'watching' | 'denied' | 'unavailable' = 'idle';
let flightWatch: AppPositionWatch | undefined;
let flightWatchSequence = 0;
let flightLatestGps: FlightPosition | undefined;
let flightPreviousGps: FlightPosition | undefined;

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

const localeForLanguage = (language: Language) => language === 'ar' ? 'ar' : language === 'id' ? 'id-ID' : language === 'ms' ? 'ms-MY' : language === 'tr' ? 'tr-TR' : 'en-US';

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
let publicTransportMap: MapLibreMap | undefined;
let taxiMap: MapLibreMap | undefined;
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
const addMinutes = (time: string, minutes: number) => {
  const [h, m] = time.split(':').map(Number);
  const date = new Date(2026, 0, 1, h, m + minutes);
  return date.toTimeString().slice(0, 5);
};
const stripInternalPlannerText = (value: string) => value
  .replace(/\bSample\b/gi, 'Suggested')
  .replace(/\bprototype\b/gi, 'planner')
  .replace(/Verified in this mock dataset for prototype status-label testing only;?\s*/gi, '')
  .replace(/Sample facility details;?\s*/gi, 'Facility information may be incomplete; ');

function reportReasonLabel(reason: ReportReason, copy: typeof labels[Language]) {
  return ({
    'wrong-name': copy.reportWrongName,
    'wrong-location': copy.reportWrongLocation,
    closed: copy.reportClosed,
    'wrong-category': copy.reportWrongCategory,
    hours: copy.reportHours,
    contact: copy.reportContact,
    accessibility: copy.reportAccessibility,
    halal: copy.reportHalal,
    other: copy.reportOther,
  })[reason];
}

function reportActionMarkup(place: ReportablePlace, includeHalal = false) {
  const payload = encodeURIComponent(JSON.stringify(place));
  return `<button type="button" class="ghost report-action" data-report-place="${payload}" data-report-halal="${includeHalal ? 'true' : 'false'}">${labels[lang].reportProblem}</button>`;
}

function openReportDialog(place: ReportablePlace, includeHalal = false, trigger?: HTMLElement) {
  reportStatus = '';
  document.querySelector('.report-dialog-backdrop')?.remove();
  const copy = labels[lang];
  const reasons = reportReasons.filter((reason) => includeHalal || reason !== 'halal');
  const backdrop = document.createElement('div');
  backdrop.className = 'report-dialog-backdrop';
  backdrop.innerHTML = `<div class="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title" aria-describedby="report-description" dir="${languageDirection(lang)}">
    <div class="card-top"><h2 id="report-title">${copy.reportProblem}</h2><button type="button" class="ghost" data-report-close>${copy.reportClose}</button></div>
    <p id="report-description">${esc(place.name)} · ${esc(place.feature)}</p>
    <label>${copy.reportWhatWrong}<select id="report-reason">${reasons.map((reason) => `<option value="${reason}">${reportReasonLabel(reason, copy)}</option>`).join('')}</select></label>
    <label>${copy.reportOptionalNote}<textarea id="report-note" maxlength="500"></textarea></label>
    <p class="muted">${copy.reportOsmAccount} ${copy.reportGithubAccount} ${copy.reportExternalNotice}</p>
    <div class="toolbar report-actions">
      <a class="map-link" data-report-source target="_blank" rel="noopener noreferrer">${copy.reportOpenSource}</a>
      <a class="map-link" data-report-osm target="_blank" rel="noopener noreferrer">${copy.reportOsm}</a>
      <a class="map-link" data-report-github target="_blank" rel="noopener noreferrer">${copy.reportAppProblem}</a>
      <button type="button" class="ghost" data-report-copy>${copy.reportCopy}</button>
      <button type="button" class="ghost" data-report-share>${copy.reportShare}</button>
    </div>
    <p class="status" data-report-status role="status" aria-live="polite"></p>
  </div>`;
  document.body.append(backdrop);
  const reasonInput = backdrop.querySelector<HTMLSelectElement>('#report-reason');
  const noteInput = backdrop.querySelector<HTMLTextAreaElement>('#report-note');
  const status = backdrop.querySelector<HTMLElement>('[data-report-status]');
  const close = () => {
    backdrop.remove();
    trigger?.focus();
  };
  const currentReport = () => createPlaceReport(place, (reasonInput?.value as ReportReason) || 'other', sanitizeReportNote(noteInput?.value ?? ''), lang);
  const refreshLinks = () => {
    const report = currentReport();
    const source = backdrop.querySelector<HTMLAnchorElement>('[data-report-source]');
    const osm = backdrop.querySelector<HTMLAnchorElement>('[data-report-osm]');
    const github = backdrop.querySelector<HTMLAnchorElement>('[data-report-github]');
    const osmUrl = osmReportUrl(place);
    const sourceUrl = createPlaceReport(place, report.reason, report.note, lang).sourceUrl;
    if (source) {
      source.href = sourceUrl || '#';
      source.hidden = !sourceUrl;
      source.textContent = copy.reportOpenSource;
    }
    if (osm) {
      osm.href = osmUrl || '#';
      osm.hidden = !osmUrl;
      osm.textContent = copy.reportOsm;
    }
    if (github) github.href = githubIssueUrl(report);
  };
  refreshLinks();
  reasonInput?.addEventListener('change', refreshLinks);
  noteInput?.addEventListener('input', refreshLinks);
  backdrop.querySelectorAll<HTMLElement>('[data-report-close]').forEach((button) => button.addEventListener('click', close));
  backdrop.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  backdrop.querySelector<HTMLButtonElement>('[data-report-copy]')?.addEventListener('click', async () => {
    try {
      await copyText(buildReportText(currentReport()));
      reportStatus = copy.reportCopied;
    } catch {
      reportStatus = copy.reportCopyFailed;
    }
    if (status) status.textContent = reportStatus;
  });
  backdrop.querySelector<HTMLButtonElement>('[data-report-share]')?.addEventListener('click', async () => {
    try {
      const report = currentReport();
      const outcome = await shareText(`${copy.reportProblem}: ${report.name}`, buildReportText(report));
      if (outcome === 'unavailable' && status) status.textContent = copy.sharingUnavailable;
      if (outcome === 'cancelled' && status) status.textContent = copy.shareCancelled;
    } catch {
      if (status) status.textContent = copy.unableToShare;
    }
  });
  backdrop.querySelector<HTMLElement>('#report-reason')?.focus();
}

function bindReportButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-report-place]').forEach((button) => {
    button.addEventListener('click', () => {
      try {
        const place = JSON.parse(decodeURIComponent(button.dataset.reportPlace ?? '')) as ReportablePlace;
        openReportDialog(place, button.dataset.reportHalal === 'true', button);
      } catch {
        reportStatus = labels[lang].reportCopyFailed;
      }
    });
  });
}

function loadSavedTripsFromStorage() {
  try {
    const result = savedTripRepository.read();
    savedTrips = result.trips;
    savedTripsCorrupted = result.corrupted;
  } catch {
    savedTrips = [];
    savedTripsCorrupted = true;
  }
}

loadSavedTripsFromStorage();

function connectionStatusMarkup(copy: typeof labels[Language]) {
  const visible = connectionNotice === 'online' || connectionNotice === 'offline';
  const text = connectionNotice === 'offline' ? copy.offlineIndicator : connectionNotice === 'online' ? copy.onlineIndicator : '';
  return `<div id="connection-status" class="connection-status ${connectionNotice}" role="status" aria-live="polite" aria-atomic="true" ${visible ? '' : 'hidden'}>${visible ? `<span class="connection-dot" aria-hidden="true"></span><span>${text}</span>` : ''}</div>`;
}

function updateConnectionStatusElement() {
  const element = document.querySelector<HTMLDivElement>('#connection-status');
  if (!element) return;
  const copy = labels[lang];
  const visible = connectionNotice === 'online' || connectionNotice === 'offline';
  const text = connectionNotice === 'offline' ? copy.offlineIndicator : connectionNotice === 'online' ? copy.onlineIndicator : '';
  element.className = `connection-status ${connectionNotice}`;
  element.setAttribute('role', 'status');
  element.setAttribute('aria-live', 'polite');
  element.setAttribute('aria-atomic', 'true');
  if (!visible) {
    element.hidden = true;
    element.replaceChildren();
    return;
  }
  element.hidden = false;
  const dot = document.createElement('span');
  dot.className = 'connection-dot';
  dot.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.textContent = text;
  element.replaceChildren(dot, label);
}

function showConnectionNotice(nextState: ConnectionState) {
  connectionState = nextState;
  if (connectionNoticeTimer) window.clearTimeout(connectionNoticeTimer);
  if (nextState === 'online' && !connectionWasOffline) {
    connectionNotice = 'hidden';
    updateConnectionStatusElement();
    return;
  }
  connectionWasOffline = nextState === 'offline';
  connectionNotice = nextState;
  updateConnectionStatusElement();
  if (nextState === 'online') {
    connectionNoticeTimer = window.setTimeout(() => {
      if (connectionNotice !== 'online') return;
      connectionNotice = 'hidden';
      updateConnectionStatusElement();
    }, 4000);
  }
}

function plannerFacilityStatus(status: VerificationStatus, copy: typeof labels[Language]) {
  if (status === 'Verified') return copy.facilityAvailable;
  if (status === 'Unverified') return copy.facilityInfoUnavailable;
  return copy.facilityEstimatedInfo;
}

function homeIcon(name: string) {
  const common = 'class="home-card-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
  const paths: Record<string, string> = {
    saved: '<path d="M7 4h10a2 2 0 0 1 2 2v14l-7-4-7 4V6a2 2 0 0 1 2-2z"/><path d="M9 8h6"/>',
    qibla: '<circle cx="12" cy="12" r="8"/><path d="m15.5 8.5-2.2 5.1-4.8 1.9 2.2-5.1 4.8-1.9z"/>',
    flight: '<path d="M3 16l18-8-8 18-2-8-8-2z"/><path d="M11 18l4-4"/><path d="M6 6h4M8 4v4"/>',
    prayer: '<path d="M4 19h16"/><path d="M6 19V10l6-5 6 5v9"/><path d="M9 19v-5a3 3 0 0 1 6 0v5"/><path d="M12 5V3"/>',
    halal: '<circle cx="12" cy="12" r="7"/><path d="M8 13c1.5 2 5.5 2 7-2"/><path d="M8 8v4"/><path d="M16 8v4"/>',
    money: '<circle cx="8" cy="9" r="4"/><circle cx="15" cy="14" r="4"/><path d="M8 7v4M6.5 9h3M15 12v4M13.5 14h3"/>',
    toilets: '<path d="M7 11v8"/><path d="M17 11v8"/><circle cx="7" cy="6" r="2"/><circle cx="17" cy="6" r="2"/><path d="M4 12h6l-1 7H5l-1-7z"/><path d="M14 12h6l-1 7h-4l-1-7z"/>',
    car: '<path d="M5 16h14"/><path d="M7 16l1.5-5h7L17 16"/><circle cx="8" cy="17" r="1.5"/><circle cx="16" cy="17" r="1.5"/><path d="M8 11h8"/>',
    transport: '<rect x="6" y="4" width="12" height="13" rx="2"/><path d="M8 8h8M8 12h8"/><path d="M9 20l2-3M15 20l-2-3"/>',
    taxi: '<path d="M5 16h14"/><path d="M7 16l1.5-5h7L17 16"/><path d="M10 8h4l1 3H9l1-3z"/><circle cx="8" cy="17" r="1.5"/><circle cx="16" cy="17" r="1.5"/>',
    weather: '<path d="M8 17h8a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.5 3.5 0 0 0 8 17z"/><path d="M17 3v2M21 7h-2M19.5 4.5 18 6"/>',
    attractions: '<path d="M4 20h16"/><path d="M6 18V9l6-4 6 4v9"/><path d="M9 18v-6h6v6"/><path d="M10 9h4"/>',
  };
  return `<svg ${common}>${paths[name] ?? paths.attractions}</svg>`;
}

function homeActionCard(icon: string, title: string, description: string, buttonLabel: string, buttonId: string) {
  return `<article class="quick-action">
    <div class="home-card-top">${homeIcon(icon)}<div><h3>${title}</h3><p>${description}</p></div></div>
    <button type="button" id="${buttonId}">${buttonLabel}</button>
  </article>`;
}

function homeToolGroup(id: string, title: string, cards: string[]) {
  return `<section class="home-tool-group" aria-labelledby="${id}">
    <h2 id="${id}">${title}</h2>
    <div class="home-tool-grid">${cards.join('')}</div>
  </section>`;
}

function staticPageUrl(page: 'privacy' | 'support') {
  return staticLegalPageUrl(page, lang);
}

function appFooterMarkup(copy: typeof labels[Language]) {
  return `<footer class="app-footer">
    <p>${copy.developerCredit}</p>
    <nav aria-label="${copy.supportPage}">
      <a href="${staticPageUrl('privacy')}" target="_blank" rel="noopener noreferrer">${copy.privacyPolicy}</a>
      <a href="${staticPageUrl('support')}" target="_blank" rel="noopener noreferrer">${copy.supportPage}</a>
      <a href="mailto:planetearthkh@gmail.com">${copy.supportEmailLabel}</a>
    </nav>
  </footer>`;
}

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
  publicTransportMap?.remove();
  publicTransportMap = undefined;
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
        <div class="qibla-status ${qiblaLocationStatus}" id="qibla-status">${qiblaStatusMessage(copy)}</div>
        <div class="qibla-compass-wrap">
          <div class="qibla-compass" id="qibla-compass" style="--compass-rotation: ${compassRotation}deg; --qibla-rotation: ${qiblaRotation}deg;">
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
          <div><span>${copy.qibla}</span><strong id="qibla-motion-readout">${qiblaMotionStatus === 'active' ? copy.qiblaLiveCompass : copy.qiblaFixedBearing}</strong></div>
        </div>
      </section>
    </main>`;
  bindQibla();
}

function stopQiblaOrientation() {
  if (!qiblaOrientationListenersActive) return;
  window.removeEventListener('deviceorientation', handleQiblaOrientation);
  window.removeEventListener('deviceorientationabsolute', handleQiblaOrientation);
  qiblaOrientationListenersActive = false;
  if (qiblaAnimationFrame) {
    window.cancelAnimationFrame(qiblaAnimationFrame);
    qiblaAnimationFrame = 0;
  }
}

function qiblaHeadingDelta(a: number, b: number) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function updateQiblaLiveDom() {
  qiblaAnimationFrame = 0;
  if (view !== 'qibla' || document.hidden) return;
  const copy = labels[lang];
  const bearing = qiblaLocation ? calculateQiblaBearing(qiblaLocation.latitude, qiblaLocation.longitude) : 0;
  const compass = document.querySelector<HTMLElement>('#qibla-compass');
  if (compass) {
    compass.style.setProperty('--compass-rotation', `${qiblaHeading ? -qiblaHeading : 0}deg`);
    compass.style.setProperty('--qibla-rotation', `${normalizeDegrees(bearing - (qiblaHeading ?? 0))}deg`);
  }
  const status = document.querySelector<HTMLElement>('#qibla-status');
  if (status) status.textContent = qiblaStatusMessage(copy);
  const readout = document.querySelector<HTMLElement>('#qibla-motion-readout');
  if (readout) readout.textContent = qiblaMotionStatus === 'active' ? copy.qiblaLiveCompass : copy.qiblaFixedBearing;
  qiblaLastRenderedHeading = qiblaHeading;
}

function scheduleQiblaLiveUpdate() {
  if (view !== 'qibla' || document.hidden || qiblaAnimationFrame) return;
  qiblaAnimationFrame = window.requestAnimationFrame(updateQiblaLiveDom);
}

function handleQiblaOrientation(event: CompassOrientationEvent) {
  if (view !== 'qibla' || document.hidden || qiblaMotionStatus === 'denied') return;
  const heading = typeof event.webkitCompassHeading === 'number'
    ? event.webkitCompassHeading
    : event.absolute === true && typeof event.alpha === 'number'
      ? normalizeDegrees(360 - event.alpha)
      : undefined;
  if (typeof heading !== 'number') {
    if (qiblaMotionStatus === 'active' && qiblaHeading !== undefined) return;
    if (qiblaMotionStatus === 'unavailable' && qiblaHeading === undefined) return;
    qiblaHeading = undefined;
    qiblaMotionStatus = 'unavailable';
    scheduleQiblaLiveUpdate();
    return;
  }
  const normalizedHeading = normalizeDegrees(heading);
  const comparisonHeading = qiblaHeading ?? qiblaLastRenderedHeading;
  if (qiblaMotionStatus === 'active' && comparisonHeading !== undefined && qiblaHeadingDelta(normalizedHeading, comparisonHeading) < QIBLA_HEADING_THRESHOLD) return;
  qiblaHeading = normalizedHeading;
  qiblaMotionStatus = 'active';
  scheduleQiblaLiveUpdate();
}

function startQiblaOrientation() {
  if (qiblaOrientationListenersActive) return;
  window.addEventListener('deviceorientation', handleQiblaOrientation);
  window.addEventListener('deviceorientationabsolute', handleQiblaOrientation);
  qiblaOrientationListenersActive = true;
}

async function requestQiblaMotion() {
  if (!('DeviceOrientationEvent' in window)) {
    qiblaMotionStatus = 'unavailable';
    stopQiblaOrientation();
    qiblaPage();
    return;
  }
  const OrientationEvent = window.DeviceOrientationEvent as DeviceOrientationEventWithPermission;
  if (typeof OrientationEvent.requestPermission === 'function') {
    try {
      const permission = await OrientationEvent.requestPermission();
      if (permission !== 'granted') {
        qiblaMotionStatus = 'denied';
        stopQiblaOrientation();
        qiblaPage();
        return;
      }
    } catch {
      qiblaMotionStatus = 'denied';
      stopQiblaOrientation();
      qiblaPage();
      return;
    }
  }
  qiblaMotionStatus = 'unavailable';
  startQiblaOrientation();
  qiblaPage();
}

function requestQiblaLocation() {
  const sequence = ++qiblaLocationSequence;
  if (!isAppGeolocationAvailable()) {
    if (sequence !== qiblaLocationSequence) return;
    qiblaLocationStatus = 'unavailable';
    qiblaPage();
    return;
  }
  qiblaLocationStatus = 'loading';
  qiblaPage();
  requestCurrentAppPosition(
    (position) => {
      if (sequence !== qiblaLocationSequence) return;
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
      if (sequence !== qiblaLocationSequence) return;
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
    qiblaLocationSequence += 1;
    stopQiblaOrientation();
    if (window.location.hash) {
      history.pushState(null, '', window.location.pathname + window.location.search);
    }
    render();
  });
  document.querySelector<HTMLButtonElement>('#request-location')?.addEventListener('click', requestQiblaLocation);
  document.querySelector<HTMLButtonElement>('#request-motion')?.addEventListener('click', () => void requestQiblaMotion());
}

function stopFlightGpsWatch() {
  flightWatchSequence += 1;
  if (flightWatch) {
    void flightWatch.clear();
    flightWatch = undefined;
  }
  flightGpsEnabled = false;
  flightLocationStatus = 'idle';
}

function formatFlightMinutes(minutes: number, copy: typeof labels[Language]) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${hours ? `${hours} ${copy.flightHours}` : ''}${hours && mins ? ' ' : ''}${mins || !hours ? `${mins} ${copy.flightMinutes}` : ''}`;
}

function flightSourceLabel(source: string, copy: typeof labels[Language]) {
  if (source === 'gps') return copy.flightGpsSource;
  if (source === 'derived-gps') return copy.flightDerivedGpsSource;
  if (source === 'route-estimate') return copy.flightRouteSource;
  return copy.flightUnavailableSource;
}

function flightRelativeAngleText(angle: number, copy: typeof labels[Language]) {
  if (!Number.isFinite(angle)) return copy.flightUnavailableSource;
  const absolute = Math.abs(angle);
  if (absolute <= 10) return copy.flightStraightAhead;
  if (absolute >= 170) return copy.flightBehind;
  return `${Math.round(absolute)}° ${angle < 0 ? copy.flightLeft : copy.flightRight}`;
}

function waypointText(plan: PreparedFlightPlan | null) {
  return plan?.waypoints.map((waypoint) => `${waypoint.label}, ${waypoint.latitude.toFixed(4)}, ${waypoint.longitude.toFixed(4)}`).join('\n') ?? '';
}

function flightAirportOptions() {
  return airports.map((airport) => `<option value="${airport.iata}">${esc(airportLabel(airport))}</option>`).join('');
}

function parseWaypointInput(value: string) {
  const waypoints = value.split(/\n+/).map((line, index) => {
    const [label, latitude, longitude] = line.split(',').map((part) => part.trim());
    if (!label && !latitude && !longitude) return null;
    return validateWaypoint({ label, latitude: Number(latitude), longitude: Number(longitude) }, index);
  }).filter((waypoint): waypoint is NonNullable<ReturnType<typeof validateWaypoint>> => Boolean(waypoint));
  const nonEmptyLines = value.split(/\n+/).filter((line) => line.trim());
  return waypoints.length === nonEmptyLines.length ? waypoints : null;
}

function flightPlanFormMarkup(copy: typeof labels[Language]) {
  const plan = preparedFlightPlan;
  const departure = plan?.departure.iata ?? 'LHR';
  const arrival = plan?.arrival.iata ?? 'JFK';
  const scheduled = plan ? plan.scheduledDepartureUtc.slice(0, 16) : new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
  const hours = plan ? Math.floor(plan.durationMinutes / 60) : 7;
  const minutes = plan ? plan.durationMinutes % 60 : 30;
  const altitudeFeet = plan?.cruiseAltitudeMeters ? Math.round(plan.cruiseAltitudeMeters * 3.28084) : '';
  return `<section class="panel flight-panel" aria-labelledby="flight-prepare-heading">
    <div class="card-top"><div><p class="eyebrow">${copy.flightPrepareStage}</p><h2 id="flight-prepare-heading">${copy.flightModeTitle}</h2></div></div>
    <p class="muted">${copy.flightBestEstimate}</p>
    <form id="flight-plan-form" class="flight-form">
      <datalist id="flight-airports">${flightAirportOptions()}</datalist>
      <label>${copy.flightDepartureAirport}<input id="flight-departure" list="flight-airports" value="${esc(departure)}" placeholder="${esc(copy.flightAirportSearchHint)}" autocomplete="off" /></label>
      <label>${copy.flightArrivalAirport}<input id="flight-arrival" list="flight-airports" value="${esc(arrival)}" placeholder="${esc(copy.flightAirportSearchHint)}" autocomplete="off" /></label>
      <div class="grid">
        <label>${copy.flightScheduledDepartureUtc}<input id="flight-departure-time" type="datetime-local" value="${esc(scheduled)}" /></label>
        <label>${copy.flightDuration}<span class="inline-fields"><input id="flight-duration-hours" type="number" min="0" max="24" value="${hours}" aria-label="${copy.flightHours}" /><input id="flight-duration-minutes" type="number" min="0" max="59" value="${minutes}" aria-label="${copy.flightMinutes}" /></span></label>
      </div>
      <div class="grid">
        <label>${copy.flightDepartureTimeZone}<input id="flight-departure-zone" value="${esc(plan?.departureTimeZone ?? '')}" placeholder="Europe/London" /></label>
        <label>${copy.flightArrivalTimeZone}<input id="flight-arrival-zone" value="${esc(plan?.arrivalTimeZone ?? '')}" placeholder="America/New_York" /></label>
      </div>
      <div class="grid">
        <label>${copy.flightCruiseAltitude}<input id="flight-altitude" type="number" min="0" max="60000" value="${altitudeFeet}" /></label>
        <label>${copy.flightAltitudeUnit}<select id="flight-altitude-unit"><option value="ft">${copy.flightFeet}</option><option value="m">${copy.flightMeters}</option></select></label>
      </div>
      ${choiceSelect('prayerMethod', copy.flightMethod, prayerMethods, Object.fromEntries(prayerMethods.map((method) => [method, method])) as Record<(typeof prayerMethods)[number], string>)}
      <label>${copy.flightWaypoints}<textarea id="flight-waypoints" rows="3" placeholder="${esc(copy.flightWaypointHelp)}">${esc(waypointText(plan))}</textarea></label>
      <div class="flight-actions">
        <button type="submit">${copy.flightPrepareButton}</button>
        <button type="button" class="ghost" id="flight-use-travel-details">${copy.flightUseTravelDetails}</button>
      </div>
    </form>
    <p class="muted">${copy.flightRouteDisclaimer}</p>
    <p class="muted">${copy.flightAirportSource}</p>
  </section>`;
}

function flightDiagramMarkup(qiblaBearing: number, track: number | undefined, copy: typeof labels[Language]) {
  const relative = typeof track === 'number' ? signedShortestAngle(track, qiblaBearing) : 0;
  return `<svg class="flight-diagram" viewBox="0 0 220 180" role="img" aria-label="${esc(copy.flightDiagramLabel)}">
    <circle cx="110" cy="90" r="70" class="flight-diagram-ring" />
    <g class="flight-aircraft" transform="rotate(${typeof track === 'number' ? track : 0} 110 90)">
      <path d="M110 28l16 82h-32l16-82z" />
      <path d="M72 102h76l-14 18H86l-14-18z" />
    </g>
    <g class="flight-qibla-vector" transform="rotate(${qiblaBearing} 110 90)">
      <path d="M110 88V18" />
      <path d="M110 18l-9 16h18l-9-16z" />
    </g>
    <text x="110" y="165" text-anchor="middle">${esc(flightRelativeAngleText(relative, copy))}</text>
  </svg>`;
}

function flightDashboardMarkup(copy: typeof labels[Language], plan: PreparedFlightPlan) {
  const now = Date.now();
  const progress = chooseFlightProgress(plan, { gps: flightLatestGps, previousGps: flightPreviousGps, manualProgress: flightManualProgress, nowMs: now });
  const activePosition = progress.position ?? positionByProgress(plan, flightManualProgress, now).position;
  const prayer = activePosition ? calculateInflightPrayerSnapshot(activePosition.latitude, activePosition.longitude, now, plan.prayerMethod) : null;
  const qiblaBearing = activePosition ? calculateQiblaBearing(activePosition.latitude, activePosition.longitude) : Number.NaN;
  const relative = typeof progress.trackDegrees === 'number' ? signedShortestAngle(progress.trackDegrees, qiblaBearing) : Number.NaN;
  const prayerRows = prayer ? prayerOrder.map((name) => `<div><span>${prayerLabels[lang][name]}</span><strong>${formatUtcTime(prayer.prayers[name])} UTC</strong>${plan.departureTimeZone || plan.arrivalTimeZone ? `<small>${formatInTimeZone(prayer.prayers[name], plan.departureTimeZone, localeForLanguage(lang))}${plan.arrivalTimeZone ? ` · ${formatInTimeZone(prayer.prayers[name], plan.arrivalTimeZone, localeForLanguage(lang))}` : ''}</small>` : ''}</div>`).join('') : '';
  return `<section class="panel flight-panel" aria-labelledby="flight-dashboard-heading">
    <div class="card-top"><div><p class="eyebrow">${copy.flightDashboardStage}</p><h2 id="flight-dashboard-heading">${plan.departure.iata} → ${plan.arrival.iata}</h2><p>${esc(plan.departure.name)} → ${esc(plan.arrival.name)}</p></div></div>
    <p class="notice">${copy.flightBestEstimate}</p>
    <div class="flight-actions">
      <button type="button" id="flight-toggle-gps">${flightGpsEnabled ? copy.flightDisableGps : copy.flightEnableGps}</button>
      <button type="button" class="ghost" id="flight-elapsed">${copy.flightUseElapsed}</button>
      <button type="button" class="ghost" id="flight-edit">${copy.flightEdit}</button>
      <button type="button" class="ghost" id="flight-clear">${copy.flightClear}</button>
    </div>
    <label>${copy.flightProgress}<input id="flight-progress" type="range" min="0" max="100" value="${Math.round(progress.progress * 100)}" aria-label="${copy.flightProgressSlider}" /></label>
    <div class="flight-grid">
      <div><span>${copy.flightSource}</span><strong>${flightSourceLabel(progress.source, copy)}</strong></div>
      <div><span>${copy.flightRouteDistance}</span><strong>${Math.round(progress.routeDistanceKm).toLocaleString(localeForLanguage(lang))} km</strong></div>
      <div><span>${copy.flightRemainingDistance}</span><strong>${Math.round(progress.remainingDistanceKm).toLocaleString(localeForLanguage(lang))} km</strong></div>
      <div><span>${copy.flightRemainingTime}</span><strong>${formatFlightMinutes(progress.remainingMinutes, copy)}</strong></div>
      <div><span>${copy.flightCoordinates}</span><strong>${activePosition ? `${activePosition.latitude.toFixed(4)}, ${activePosition.longitude.toFixed(4)}` : copy.flightUnavailableSource}</strong></div>
      <div><span>${copy.flightLastUpdate}</span><strong>${activePosition ? new Intl.DateTimeFormat(localeForLanguage(lang), { timeStyle: 'medium', timeZone: 'UTC' }).format(new Date(activePosition.timestamp)) : copy.flightUnavailableSource}</strong></div>
      <div><span>${copy.flightAccuracy}</span><strong>${activePosition?.accuracyMeters ? `±${Math.round(activePosition.accuracyMeters)} m` : copy.flightRouteSource}</strong></div>
      <div><span>${copy.flightAltitude}</span><strong>${activePosition?.altitudeMeters ? `${Math.round(activePosition.altitudeMeters)} m` : plan.cruiseAltitudeMeters ? `${Math.round(plan.cruiseAltitudeMeters)} m` : copy.flightUnavailableSource}</strong></div>
    </div>
    ${progress.lowAccuracy ? `<p class="warning">${copy.flightLowAccuracy}</p>` : ''}
    ${progress.stale ? `<p class="warning">${copy.flightGpsStale}</p>` : ''}
    <div class="flight-qibla-layout">
      ${flightDiagramMarkup(qiblaBearing, progress.trackDegrees, copy)}
      <div class="flight-grid">
        <div><span>${copy.flightQiblaTrue}</span><strong>${Number.isFinite(qiblaBearing) ? `${qiblaBearing.toFixed(1)}° true` : copy.flightUnavailableSource}</strong></div>
        <div><span>${copy.flightTrack}</span><strong>${typeof progress.trackDegrees === 'number' ? `${progress.trackDegrees.toFixed(1)}° true` : copy.flightUnavailableSource}</strong></div>
        <div><span>${copy.flightRelativeAngle}</span><strong>${flightRelativeAngleText(relative, copy)}</strong></div>
        <div><span>${copy.flightConfidence}</span><strong>${flightSourceLabel(progress.source, copy)}</strong></div>
      </div>
    </div>
    <section class="flight-prayers">
      <h3>${copy.flightUtcPrayerTimes}</h3>
      <div class="flight-grid">${prayerRows}</div>
      <p><strong>${copy.flightCurrentPrayer}:</strong> ${prayer?.currentWindow ? prayerLabels[lang][prayer.currentWindow.name] : copy.flightUnavailableSource}</p>
      <p><strong>${copy.flightPreviousPrayer}:</strong> ${prayer?.previousPrayer ? prayerLabels[lang][prayer.previousPrayer.name] : copy.flightUnavailableSource} · <strong>${copy.flightNextPrayer}:</strong> ${prayer?.nextPrayer ? `${prayerLabels[lang][prayer.nextPrayer.name]} (${formatFlightMinutes(Math.ceil(prayer.countdownMs / 60_000), copy)})` : copy.flightUnavailableSource}</p>
      <p><strong>${copy.flightMethod}:</strong> ${plan.prayerMethod}</p>
    </section>
    <p class="muted">${copy.flightOfflineNotice}</p>
    <p class="muted">${copy.flightSafetyNotice}</p>
    <p class="muted">${copy.flightAltitudeDisclaimer}</p>
  </section>`;
}

function flightModePage() {
  if (!root) return;
  const copy = labels[lang];
  const dir = languageDirection(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  const status = flightPlanCorrupted ? copy.flightStorageRecovered : flightStatus;
  root.innerHTML = `<main dir="${dir}" class="app flight-mode-app">
    <section class="hero qibla-hero">
      ${languageSelector()}
      <p class="eyebrow">${copy.qibla}</p>
      <h1>${copy.flightModeTitle}</h1>
      <p>${copy.flightModeSubtitle}</p>
      <button type="button" class="ghost hero-action" id="flight-back">${copy.flightModeBack}</button>
    </section>
    <p class="sr-only" role="status" aria-live="polite">${esc(status)}</p>
    ${status ? `<p class="notice">${esc(status)}</p>` : ''}
    ${flightEditing || !preparedFlightPlan ? flightPlanFormMarkup(copy) : flightDashboardMarkup(copy, preparedFlightPlan)}
    ${appFooterMarkup(copy)}
  </main>`;
  bindFlightMode();
}

function readFlightFormPlan(copy: typeof labels[Language]): { plan: PreparedFlightPlan } | { error: string } {
  const departure = airportByIata((document.querySelector<HTMLInputElement>('#flight-departure')?.value ?? '').trim());
  const arrival = airportByIata((document.querySelector<HTMLInputElement>('#flight-arrival')?.value ?? '').trim());
  if (!departure || !arrival) return { error: copy.flightPlanInvalid };
  if (departure.iata === arrival.iata) return { error: copy.flightDifferentAirports };
  const hours = Number(document.querySelector<HTMLInputElement>('#flight-duration-hours')?.value ?? 0);
  const minutes = Number(document.querySelector<HTMLInputElement>('#flight-duration-minutes')?.value ?? 0);
  const durationMinutes = Math.round(hours * 60 + minutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 1440) return { error: copy.flightInvalidDuration };
  const waypointInput = document.querySelector<HTMLTextAreaElement>('#flight-waypoints')?.value ?? '';
  const waypoints = parseWaypointInput(waypointInput);
  if (!waypoints) return { error: copy.flightInvalidWaypoint };
  const departureTime = document.querySelector<HTMLInputElement>('#flight-departure-time')?.value ?? '';
  const departureDate = new Date(`${departureTime}:00Z`);
  const scheduledDepartureUtc = departureTime && Number.isFinite(departureDate.getTime()) ? departureDate.toISOString() : '';
  const altitude = Number(document.querySelector<HTMLInputElement>('#flight-altitude')?.value ?? '');
  const unit = document.querySelector<HTMLSelectElement>('#flight-altitude-unit')?.value ?? 'ft';
  const altitudeMeters = Number.isFinite(altitude) && altitude > 0 ? unit === 'ft' ? altitude / 3.28084 : altitude : undefined;
  const plan = createPreparedFlightPlan({
    departure,
    arrival,
    waypoints,
    scheduledDepartureUtc,
    durationMinutes,
    prayerMethod: prefs.prayerMethod,
    cruiseAltitudeMeters: altitudeMeters,
    departureTimeZone: document.querySelector<HTMLInputElement>('#flight-departure-zone')?.value.trim() || undefined,
    arrivalTimeZone: document.querySelector<HTMLInputElement>('#flight-arrival-zone')?.value.trim() || undefined,
  });
  return plan ? { plan } : { error: copy.flightPlanInvalid };
}

async function startFlightGpsWatch() {
  const sequence = ++flightWatchSequence;
  flightGpsEnabled = true;
  flightLocationStatus = 'watching';
  flightStatus = '';
  await flightWatch?.clear();
  flightWatch = await watchAppPosition(
    (position) => {
      if (sequence !== flightWatchSequence || view !== 'flight-mode') return;
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      flightPreviousGps = flightLatestGps;
      flightLatestGps = {
        latitude,
        longitude,
        accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : undefined,
        altitudeMeters: typeof position.coords.altitude === 'number' && Number.isFinite(position.coords.altitude) ? position.coords.altitude : undefined,
        trackDegrees: typeof position.coords.heading === 'number' && Number.isFinite(position.coords.heading) && position.coords.heading >= 0 ? position.coords.heading : undefined,
        timestamp: position.timestamp ?? Date.now(),
        source: 'gps',
      };
      if (preparedFlightPlan) flightManualProgress = chooseFlightProgress(preparedFlightPlan, { gps: flightLatestGps, previousGps: flightPreviousGps, manualProgress: flightManualProgress }).progress;
      flightModePage();
    },
    (error) => {
      if (sequence !== flightWatchSequence || view !== 'flight-mode') return;
      flightGpsEnabled = false;
      flightLocationStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      flightStatus = flightLocationStatus === 'denied' ? labels[lang].flightGpsDenied : labels[lang].flightGpsUnavailable;
      flightModePage();
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 },
  );
}

function bindFlightMode() {
  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => {
    lang = (event.target as HTMLSelectElement).value as Language;
    flightModePage();
  });
  document.querySelector<HTMLButtonElement>('#flight-back')?.addEventListener('click', () => {
    stopFlightGpsWatch();
    view = 'planner';
    if (window.location.hash) history.pushState(null, '', window.location.pathname + window.location.search);
    render();
  });
  document.querySelector<HTMLFormElement>('#flight-plan-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = readFlightFormPlan(labels[lang]);
    if ('error' in result) {
      flightStatus = result.error;
      flightModePage();
      return;
    }
    preparedFlightPlan = flightPlanRepository.save(result.plan);
    flightPlanCorrupted = false;
    flightEditing = false;
    flightManualProgress = elapsedProgress(preparedFlightPlan);
    flightStatus = labels[lang].flightPlanSaved;
    flightModePage();
  });
  document.querySelector<HTMLButtonElement>('#flight-use-travel-details')?.addEventListener('click', () => {
    const plan = flightPlanFromTravelDetails(currentTravelDetails, prefs.prayerMethod);
    if (!plan) {
      flightStatus = labels[lang].flightPlanInvalid;
      flightModePage();
      return;
    }
    preparedFlightPlan = flightPlanRepository.save(plan);
    flightEditing = false;
    flightManualProgress = elapsedProgress(preparedFlightPlan);
    flightStatus = labels[lang].flightPlanSaved;
    flightModePage();
  });
  document.querySelector<HTMLButtonElement>('#flight-toggle-gps')?.addEventListener('click', () => {
    if (flightGpsEnabled) {
      stopFlightGpsWatch();
      flightModePage();
    } else {
      void startFlightGpsWatch();
    }
  });
  document.querySelector<HTMLInputElement>('#flight-progress')?.addEventListener('input', (event) => {
    flightManualProgress = Number((event.target as HTMLInputElement).value) / 100;
    flightModePage();
  });
  document.querySelector<HTMLButtonElement>('#flight-elapsed')?.addEventListener('click', () => {
    if (preparedFlightPlan) flightManualProgress = elapsedProgress(preparedFlightPlan);
    flightModePage();
  });
  document.querySelector<HTMLButtonElement>('#flight-edit')?.addEventListener('click', () => {
    flightEditing = true;
    flightModePage();
  });
  document.querySelector<HTMLButtonElement>('#flight-clear')?.addEventListener('click', () => {
    stopFlightGpsWatch();
    flightPlanRepository.clear();
    preparedFlightPlan = null;
    flightEditing = true;
    flightStatus = labels[lang].flightPlanCleared;
    flightModePage();
  });
  document.querySelectorAll<HTMLInputElement>('#flight-departure, #flight-arrival').forEach((input) => input.addEventListener('input', () => {
    const matches = searchAirports(input.value, 6);
    input.setAttribute('aria-description', matches.map((airport) => airportLabel(airport)).join('; '));
  }));
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (qiblaAnimationFrame) {
      window.cancelAnimationFrame(qiblaAnimationFrame);
      qiblaAnimationFrame = 0;
    }
    return;
  }
  if (view === 'qibla') scheduleQiblaLiveUpdate();
});


type PrayerLocationStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'searching' | 'service-unavailable' | 'empty';
type PrayerMode = 'map' | 'list';
type PrayerFilter = 'all' | PrayerPlaceType;
type PrayerSort = 'distance' | 'name' | 'open';
type PrayerCenter = { latitude: number; longitude: number; label: string; timezone?: string };
type RestaurantStatus = PrayerLocationStatus | 'too-many' | 'cached' | 'offline' | 'timeout';
type RestaurantMode = 'map' | 'list';
type RestaurantSort = 'distance' | 'name' | 'status' | 'open' | 'cuisine';
type ToiletStatus = RestaurantStatus;
type ToiletMode = 'map' | 'list';
type CarRentalStatus = RestaurantStatus;
type CarRentalMode = 'map' | 'list';
type CarRentalSearchKind = 'destination' | 'airport' | 'station';
type PublicTransportStatus = RestaurantStatus;
type PublicTransportMode = 'map' | 'list';
type TaxiStatus = RestaurantStatus;
type TaxiMode = 'map' | 'list';
type WeatherStatus = 'idle' | 'requesting' | 'loading' | 'ready' | 'updated' | 'denied' | 'unavailable' | 'service-unavailable' | 'timeout' | 'invalid' | 'offline' | 'cached' | 'no-cache' | 'unsupported';
type WeatherLocation = { latitude: number; longitude: number; label: string; country?: string; timezone?: string };
type AttractionStatus = RestaurantStatus | 'photos' | 'history';

type OverpassElementResponse = { type: string; id: number; lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: Record<string, string | undefined> };
type OverpassResponse = { elements: OverpassElementResponse[] };
type NominatimResult = { lat: string; lon: string; display_name: string };

const prayerRadii = [1, 3, 5, 10, 25, 50] as const;
const toiletRadii = [0.5, 1, 3, 5, 10, 25] as const;
const carRentalRadii = [3, 5, 10, 25, 50, 100] as const;
const publicTransportRadii = [1, 3, 5, 10, 25, 50] as const;
const taxiRadii = [1, 3, 5, 10, 25, 50] as const;
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
let prayerSearchSequence = 0;
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
let publicTransportStatus: PublicTransportStatus = 'idle';
let publicTransportMode: PublicTransportMode = 'map';
let publicTransportCenter: PrayerCenter | undefined;
let publicTransportRadiusKm: typeof publicTransportRadii[number] = 5;
let publicTransportManualQuery = '';
let publicTransportResults: PublicTransportStop[] = [];
let publicTransportFilters: PublicTransportFilters = { type: 'all', wheelchair: false, openNow: false, toilets: false, shelter: false };
let publicTransportSort: PublicTransportSort = 'distance';
let publicTransportMapMoved = false;
let publicTransportError = '';
let publicTransportSearchTimer: number | undefined;
let publicTransportSearchSequence = 0;
const publicTransportCache = new Map<string, { expires: number; results: PublicTransportStop[] }>();
let taxiStatus: TaxiStatus = 'idle';
let taxiMode: TaxiMode = 'map';
let taxiCenter: PrayerCenter | undefined;
let taxiRadiusKm: typeof taxiRadii[number] = 5;
let taxiManualQuery = '';
let taxiResults: TaxiService[] = [];
let taxiFilters: TaxiFilters = { type: 'all', openNow: false, phone: false, website: false, wheelchairInfo: false, shelter: false };
let taxiSort: TaxiSort = 'distance';
let taxiMapMoved = false;
let taxiError = '';
let taxiSearchTimer: number | undefined;
let taxiSearchSequence = 0;
const taxiCache = new Map<string, { expires: number; results: TaxiService[] }>();
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
let rateRequestSequence = 0;
let historyRequestSequence = 0;
let prayerAbortController: AbortController | undefined;
let restaurantAbortController: AbortController | undefined;
let toiletAbortController: AbortController | undefined;
let carRentalAbortController: AbortController | undefined;
let publicTransportAbortController: AbortController | undefined;
let taxiAbortController: AbortController | undefined;
let weatherAbortController: AbortController | undefined;
let attractionAbortController: AbortController | undefined;
let attractionEnrichmentAbortController: AbortController | undefined;

function nextAbortController(current: AbortController | undefined) {
  current?.abort();
  return new AbortController();
}

function validateOverpassResponse(payload: unknown): OverpassResponse {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { elements?: unknown }).elements)) {
    throw new RequestError('malformed', 'Received invalid service data');
  }
  const elements = (payload as { elements: unknown[] }).elements.filter((element): element is OverpassElementResponse => {
    if (!element || typeof element !== 'object') return false;
    const candidate = element as Partial<OverpassElementResponse>;
    return typeof candidate.type === 'string' && typeof candidate.id === 'number';
  });
  return { elements };
}

async function requestOverpass(url: string, options: RequestInit, milliseconds: number) {
  return validateOverpassResponse(await retryOnceForTemporary(() => requestJson<unknown>(url, options, milliseconds), options.signal ?? undefined));
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

function openingStatusLabel(state: OpeningState, copy: typeof labels[Language]) {
  if (state === 'open') return copy.halalOpen;
  if (state === 'closed') return copy.halalClosed;
  return copy.halalOpeningUnavailable;
}

function refreshOpenState<T extends { openingHours: string; openState: OpeningState }>(items: T[], timeZone: string | undefined) {
  return items.map((item) => ({ ...item, openState: openingState(item.openingHours, timeZone) }));
}

function filteredPrayerResults() {
  let results = [...prayerResults];
  if (prayerFilter !== 'all') results = results.filter((place) => place.type === prayerFilter);
  if (prayerOpenOnly) results = results.filter((place) => place.openingHours && isReliablyOpenNow({ opening_hours: place.openingHours }, prayerCenter?.timezone) === true);
  if (prayerWomenOnly) results = results.filter((place) => place.womenPrayerArea === 'Verified');
  if (prayerWuduOnly) results = results.filter((place) => place.wudu === 'Verified');
  if (prayerWheelchairOnly) results = results.filter((place) => place.wheelchair === 'Verified');
  results.sort((a, b) => {
    if (prayerSort === 'name') return a.name.localeCompare(b.name);
    if (prayerSort === 'open') return Number(isReliablyOpenNow({ opening_hours: b.openingHours }, prayerCenter?.timezone) === true) - Number(isReliablyOpenNow({ opening_hours: a.openingHours }, prayerCenter?.timezone) === true) || a.distanceKm - b.distanceKm;
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

async function searchPrayerPlaces(center: PrayerCenter, sequence = ++prayerSearchSequence) {
  prayerAbortController = nextAbortController(prayerAbortController);
  const abortSignal = prayerAbortController.signal;
  const searchCenter = { ...center };
  const searchRadius = prayerRadiusKm;
  const isCurrentPrayerSearch = () => sequence === prayerSearchSequence;
  prayerCenter = searchCenter;
  prayerMapMoved = false;
  const cacheKey = `${searchCenter.latitude.toFixed(4)},${searchCenter.longitude.toFixed(4)},${searchRadius}`;
  const cached = prayerCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    if (!isCurrentPrayerSearch()) return;
    prayerResults = cached.results;
    prayerStatus = prayerResults.length ? 'ready' : 'empty';
    prayerPage();
    return;
  }
  prayerStatus = 'searching';
  prayerError = '';
  prayerPage();
  try {
    const body = buildOverpassQuery(searchCenter.latitude, searchCenter.longitude, searchRadius);
    const data = await requestOverpass(overpassUrl(), { method: 'POST', body, signal: abortSignal }, 18000);
    if (!isCurrentPrayerSearch()) return;
    const deduped = new Map<string, PrayerPlace>();
    for (const element of data.elements ?? []) {
      const place = normalizePrayerPlace(element, searchCenter);
      if (place) deduped.set(place.id, place);
    }
    if (!isCurrentPrayerSearch()) return;
    prayerResults = [...deduped.values()].sort((a, b) => a.distanceKm - b.distanceKm);
    prayerCache.set(cacheKey, { expires: Date.now() + 5 * 60 * 1000, results: prayerResults });
    prayerStatus = prayerResults.length ? 'ready' : 'empty';
  } catch (error) {
    console.error(error);
    if (!isCurrentPrayerSearch()) return;
    if (classifyRequestError(error).kind === 'aborted') return;
    prayerStatus = 'service-unavailable';
    prayerError = labels[lang].prayerServiceUnavailable;
  }
  if (!isCurrentPrayerSearch()) return;
  prayerPage();
}

function requestPrayerLocation() {
  const sequence = ++prayerSearchSequence;
  if (!isAppGeolocationAvailable()) {
    if (sequence !== prayerSearchSequence) return;
    prayerStatus = 'unavailable';
    prayerPage();
    return;
  }
  prayerStatus = 'requesting';
  prayerPage();
  requestCurrentAppPosition(
    (position) => {
      if (sequence !== prayerSearchSequence) return;
      void searchPrayerPlaces({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: labels[lang].qiblaLocation }, sequence);
    },
    (error) => {
      if (sequence !== prayerSearchSequence) return;
      prayerStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      prayerPage();
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

async function searchPrayerDestination() {
  const query = prayerManualQuery.trim();
  if (!query) return;
  const sequence = ++prayerSearchSequence;
  const isCurrentPrayerSearch = () => sequence === prayerSearchSequence;
  prayerStatus = 'searching';
  prayerPage();
  try {
    const city = cities.find((candidate) => `${candidate.city} ${candidate.country}`.toLowerCase().includes(query.toLowerCase()) || candidate.city.toLowerCase() === query.toLowerCase());
    if (city) {
      await searchPrayerPlaces({ latitude: city.coordinates.lat, longitude: city.coordinates.lng, label: `${city.city}, ${city.country}`, timezone: city.timezone }, sequence);
      return;
    }
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const data = await requestJson<NominatimResult[]>(url, { headers: { Accept: 'application/json' } }, 12000);
    if (!isCurrentPrayerSearch()) return;
    const first = data[0];
    if (!first) {
      if (!isCurrentPrayerSearch()) return;
      prayerStatus = 'empty';
      prayerResults = [];
      prayerPage();
      return;
    }
    await searchPrayerPlaces({ latitude: Number(first.lat), longitude: Number(first.lon), label: first.display_name }, sequence);
  } catch (error) {
    console.error(error);
    if (!isCurrentPrayerSearch()) return;
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
  publicTransportMap?.remove();
  publicTransportMap = undefined;
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
  const openLabel = openingStatusLabel(openingState(place.openingHours, prayerCenter?.timezone), copy);
  const reportPlace: ReportablePlace = { feature: copy.prayerSpacesTitle, name: displayName, sourceUrl: place.sourceUrl, latitude: place.latitude, longitude: place.longitude, city: selectedCity().city, country: selectedCity().country };
  return `<article class="card prayer-place-card" aria-label="${esc(displayName)}">
    <div class="card-top"><span>${place.distanceKm.toFixed(1)} km · ${prayerTypeLabel(place.type, copy)}</span><span class="badge ${place.verification === 'Verified' ? 'verified' : 'unverified'}">${verified(place.verification)}</span></div>
    <h3>${esc(displayName)}</h3>
    <dl class="place-details">
      <div><dt>${copy.prayerAddress}</dt><dd>${esc(missing(place.address))}</dd></div>
      <div><dt>${copy.prayerOpeningHours}</dt><dd>${esc(missing(place.openingHours))}</dd></div>
      <div><dt>${copy.halalOpen}</dt><dd>${openLabel}</dd></div>
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
      ${reportActionMarkup(reportPlace)}
    </div>
  </article>`;
}

function prayerPage() {
  if (!root) return;
  cityMap?.remove();
  cityMap = undefined;
  publicTransportMap?.remove();
  publicTransportMap = undefined;
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
  bindReportButtons();
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
  document.querySelector<HTMLButtonElement>('#search-this-area')?.addEventListener('click', () => { const center = prayerMap?.getCenter?.(); if (!center) return; debouncedPrayerSearch({ latitude: center.lat, longitude: center.lng, label: labels[lang].prayerSearchThisArea, timezone: prayerCenter?.timezone }); });
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
  if (city) return { latitude: city.coordinates.lat, longitude: city.coordinates.lng, label: `${city.city}, ${city.country}`, timezone: city.timezone };
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
  const sequence = ++restaurantSearchSequence;
  restaurantAbortController = nextAbortController(restaurantAbortController);
  const abortSignal = restaurantAbortController.signal;
  const searchCenter = { ...center };
  const searchRadius = restaurantRadiusKm;
  const isCurrentRestaurantSearch = () => sequence === restaurantSearchSequence;
  restaurantCenter = searchCenter;
  restaurantMapMoved = false;
  selectedRestaurantId = '';
  const cacheKey = `${searchCenter.latitude.toFixed(4)},${searchCenter.longitude.toFixed(4)},${searchRadius}`;
  const cached = restaurantCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    if (!isCurrentRestaurantSearch()) return;
    restaurantResults = refreshOpenState(cached.results, searchCenter.timezone);
    restaurantStatus = restaurantResults.length ? 'cached' : 'empty';
    halalRestaurantsPage();
    return;
  }
  restaurantStatus = 'searching';
  restaurantError = '';
  halalRestaurantsPage();
  try {
    const body = buildHalalOverpassQuery(searchCenter.latitude, searchCenter.longitude, searchRadius);
    const requestTimeoutMs = searchRadius <= 1 ? 20000 : 30000;
    const data = await requestHalalWithFailover(
      overpassUrl(),
      requestTimeoutMs,
      async (endpoint, endpointTimeoutMs) => validateOverpassResponse(
        await requestJson<unknown>(
          endpoint,
          { method: 'POST', body, signal: abortSignal },
          endpointTimeoutMs,
        ),
      ),
    );
    if (!isCurrentRestaurantSearch()) return;
    const normalized = (data.elements ?? [])
      .map((element) => normalizeHalalRestaurant(element, searchCenter, true))
      .filter((place): place is HalalRestaurant => Boolean(place));
    if (!isCurrentRestaurantSearch()) return;
    restaurantResults = dedupeRestaurants(normalized).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 350);
    restaurantCache.set(cacheKey, { expires: Date.now() + 5 * 60 * 1000, results: restaurantResults });
    restaurantStatus = normalized.length > 350 ? 'too-many' : restaurantResults.length ? 'ready' : 'empty';
  } catch (error) {
    console.error(error);
    if (!isCurrentRestaurantSearch()) return;
    if (classifyRequestError(error).kind === 'aborted') return;
    if (cached) {
      restaurantResults = refreshOpenState(cached.results, searchCenter.timezone);
      restaurantStatus = navigator.onLine ? 'cached' : 'offline';
    } else {
      restaurantResults = [];
      restaurantStatus = classifyRequestError(error).kind === 'timeout' ? 'timeout' : 'service-unavailable';
      restaurantError = labels[lang].halalServiceUnavailable;
    }
  }
  if (!isCurrentRestaurantSearch()) return;
  halalRestaurantsPage();
}

function requestRestaurantLocation() {
  const sequence = ++restaurantSearchSequence;
  if (!isAppGeolocationAvailable()) {
    if (sequence !== restaurantSearchSequence) return;
    restaurantStatus = 'unavailable';
    halalRestaurantsPage();
    return;
  }
  restaurantStatus = 'requesting';
  halalRestaurantsPage();
  requestCurrentAppPosition(
    (position) => {
      if (sequence !== restaurantSearchSequence) return;
      void searchHalalRestaurants({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: labels[lang].qiblaLocation });
    },
    (error) => {
      if (sequence !== restaurantSearchSequence) return;
      restaurantStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      halalRestaurantsPage();
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

async function searchRestaurantDestination() {
  const query = restaurantManualQuery.trim();
  if (!query) return;
  const sequence = ++restaurantSearchSequence;
  const isCurrentRestaurantSearch = () => sequence === restaurantSearchSequence;
  restaurantStatus = 'searching';
  halalRestaurantsPage();
  try {
    const center = await resolveRestaurantDestination(query);
    if (!isCurrentRestaurantSearch()) return;
    if (!center) {
      restaurantResults = [];
      restaurantStatus = 'empty';
      halalRestaurantsPage();
      return;
    }
    await searchHalalRestaurants(center);
  } catch (error) {
    console.error(error);
    if (!isCurrentRestaurantSearch()) return;
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
  publicTransportMap?.remove();
  publicTransportMap = undefined;
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
    [copy.halalCuisineLabel, esc(place.cuisine.join(', '))],
    [copy.prayerAddress, esc(place.address)],
    [copy.prayerOpeningHours, esc(place.openingHours)],
    [copy.prayerTelephone, esc(place.phone)],
    [copy.prayerWebsite, place.website ? `<a href="${esc(place.website)}" target="_blank" rel="noopener noreferrer">${esc(place.website)}</a>` : ''],
    [copy.halalMenu, place.menu ? `<a href="${esc(place.menu)}" target="_blank" rel="noopener noreferrer">${esc(place.menu)}</a>` : ''],
    [copy.halalPrice, esc(place.price)],
    [copy.halalTakeaway, place.takeaway ? copy.prayerVerified : ''],
    [copy.halalDelivery, place.delivery ? copy.prayerVerified : ''],
    [copy.halalOutdoor, place.outdoorSeating ? copy.prayerVerified : ''],
    [copy.halalWheelchair, place.wheelchair ? copy.prayerVerified : ''],
  ].filter(([, value]) => Boolean(value));
  return rows.length ? `<dl class="place-details">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>` : '';
}

function restaurantCard(restaurant: HalalRestaurant, copy: typeof labels[Language]) {
  const openLabel = openingStatusLabel(restaurant.openState, copy);
  const notice = restaurant.halalStatus === 'certification-listed' ? `${copy.halalCertificationNotice}: ${esc(restaurant.certification)}` : restaurant.halalStatus === 'legacy-halal' ? copy.halalLegacyNotice : restaurant.halalStatus === 'possible-unverified' ? copy.halalPossibleNotice : '';
  const reportPlace: ReportablePlace = { feature: copy.halalRestaurantsTitle, name: restaurant.name, sourceUrl: restaurant.sourceUrl, latitude: restaurant.latitude, longitude: restaurant.longitude, city: selectedCity().city, country: selectedCity().country };
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
      ${reportActionMarkup(reportPlace, true)}
    </div>
  </article>`;
}

function halalRestaurantsPage() {
  if (!root) return;
  cityMap?.remove();
  cityMap = undefined;
  prayerMap?.remove();
  prayerMap = undefined;
  publicTransportMap?.remove();
  publicTransportMap = undefined;
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
  bindReportButtons();
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
  document.querySelector<HTMLButtonElement>('#halal-search-this-area')?.addEventListener('click', () => { const center = restaurantMap?.getCenter?.(); if (!center) return; debouncedRestaurantSearch({ latitude: center.lat, longitude: center.lng, label: labels[lang].halalSearchThisArea, timezone: restaurantCenter?.timezone }); });
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
    await copyText(`${place.name}\n${place.sourceUrl}\n${place.latitude},${place.longitude}`);
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
  const sequence = ++toiletSearchSequence;
  toiletAbortController = nextAbortController(toiletAbortController);
  const abortSignal = toiletAbortController.signal;
  const searchCenter = { ...center };
  const searchRadius = toiletRadiusKm;
  const isCurrentToiletSearch = () => sequence === toiletSearchSequence;
  toiletCenter = searchCenter;
  toiletMapMoved = false;
  const cacheKey = `${searchCenter.latitude.toFixed(4)},${searchCenter.longitude.toFixed(4)},${searchRadius}`;
  const cached = toiletCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    if (!isCurrentToiletSearch()) return;
    toiletResults = refreshOpenState(cached.results, searchCenter.timezone);
    toiletStatus = toiletResults.length ? 'cached' : 'empty';
    publicToiletsPage();
    return;
  }
  toiletStatus = 'searching';
  toiletError = '';
  publicToiletsPage();
  try {
    const data = await requestOverpass(overpassUrl(), { method: 'POST', body: buildToiletOverpassQuery(searchCenter.latitude, searchCenter.longitude, searchRadius), signal: abortSignal }, 20000);
    if (!isCurrentToiletSearch()) return;
    const normalized = (data.elements ?? [])
      .map((element) => normalizePublicToilet(element, searchCenter))
      .filter((toilet): toilet is PublicToilet => Boolean(toilet));
    if (!isCurrentToiletSearch()) return;
    toiletResults = dedupeToilets(normalized).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 350);
    toiletCache.set(cacheKey, { expires: Date.now() + 5 * 60 * 1000, results: toiletResults });
    toiletStatus = normalized.length > 350 ? 'too-many' : toiletResults.length ? 'ready' : 'empty';
  } catch (error) {
    console.error(error);
    if (!isCurrentToiletSearch()) return;
    if (classifyRequestError(error).kind === 'aborted') return;
    if (cached) {
      toiletResults = refreshOpenState(cached.results, searchCenter.timezone);
      toiletStatus = navigator.onLine ? 'cached' : 'offline';
    } else {
      toiletResults = [];
      toiletStatus = classifyRequestError(error).kind === 'timeout' ? 'timeout' : 'service-unavailable';
      toiletError = labels[lang].toiletsServiceUnavailable;
    }
  }
  if (!isCurrentToiletSearch()) return;
  publicToiletsPage();
}

function requestToiletLocation() {
  const sequence = ++toiletSearchSequence;
  if (!isAppGeolocationAvailable()) {
    if (sequence !== toiletSearchSequence) return;
    toiletStatus = 'unavailable';
    publicToiletsPage();
    return;
  }
  toiletStatus = 'requesting';
  publicToiletsPage();
  requestCurrentAppPosition(
    (position) => {
      if (sequence !== toiletSearchSequence) return;
      void searchPublicToilets({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: labels[lang].qiblaLocation });
    },
    (error) => {
      if (sequence !== toiletSearchSequence) return;
      toiletStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      publicToiletsPage();
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

async function searchToiletDestination() {
  const query = toiletManualQuery.trim();
  if (!query) return;
  const sequence = ++toiletSearchSequence;
  const isCurrentToiletSearch = () => sequence === toiletSearchSequence;
  toiletStatus = 'searching';
  publicToiletsPage();
  try {
    const center = await resolveRestaurantDestination(query);
    if (!isCurrentToiletSearch()) return;
    if (!center) {
      toiletResults = [];
      toiletStatus = 'empty';
      publicToiletsPage();
      return;
    }
    await searchPublicToilets(center);
  } catch (error) {
    console.error(error);
    if (!isCurrentToiletSearch()) return;
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
  publicTransportMap?.remove();
  publicTransportMap = undefined;
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
    [copy.toiletsInside, esc(toilet.inside)],
    [copy.prayerAddress, esc(toilet.address)],
    [copy.toiletsFeeUnknown, fee],
    [copy.prayerOpeningHours, esc(toilet.openingHours)],
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
    [copy.toiletsOperator, esc(toilet.operator)],
    [copy.toiletsSupervised, toilet.supervised ? copy.prayerVerified : ''],
    [copy.prayerWebsite, toilet.website ? `<a href="${esc(toilet.website)}" target="_blank" rel="noopener noreferrer">${esc(toilet.website)}</a>` : ''],
    [copy.prayerTelephone, esc(toilet.phone)],
  ].filter(([, value]) => Boolean(value));
  return `<dl class="place-details">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function toiletCard(toilet: PublicToilet, copy: typeof labels[Language]) {
  const openLabel = openingStatusLabel(toilet.openState, copy);
  const reportPlace: ReportablePlace = { feature: copy.toiletsTitle, name: toilet.name, sourceUrl: toilet.sourceUrl, latitude: toilet.latitude, longitude: toilet.longitude, city: selectedCity().city, country: selectedCity().country };
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
      ${reportActionMarkup(reportPlace)}
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
  publicTransportMap?.remove();
  publicTransportMap = undefined;
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
  bindReportButtons();
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
  document.querySelector<HTMLButtonElement>('#toilet-search-this-area')?.addEventListener('click', () => { const center = toiletMap?.getCenter?.(); if (!center) return; debouncedToiletSearch({ latitude: center.lat, longitude: center.lng, label: labels[lang].toiletsSearchThisArea, timezone: toiletCenter?.timezone }); });
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
  const sequence = ++carRentalSearchSequence;
  carRentalAbortController = nextAbortController(carRentalAbortController);
  const abortSignal = carRentalAbortController.signal;
  const searchCenter = { ...center };
  const searchRadius = carRentalRadiusKm;
  const isCurrentCarRentalSearch = () => sequence === carRentalSearchSequence;
  carRentalCenter = searchCenter;
  carRentalMapMoved = false;
  const cacheKey = `${searchCenter.latitude.toFixed(4)},${searchCenter.longitude.toFixed(4)},${searchRadius}`;
  const cached = carRentalCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    if (!isCurrentCarRentalSearch()) return;
    carRentalResults = refreshOpenState(cached.results, searchCenter.timezone);
    carRentalStatus = carRentalResults.length ? 'cached' : 'empty';
    carRentalPage();
    return;
  }
  carRentalStatus = 'searching';
  carRentalError = '';
  carRentalPage();
  try {
    const body = buildCarRentalOverpassQuery(searchCenter.latitude, searchCenter.longitude, searchRadius);
    const data = await requestOverpass(overpassUrl(), { method: 'POST', body, signal: abortSignal }, 20000);
    if (!isCurrentCarRentalSearch()) return;
    const normalized = (data.elements ?? [])
      .map((element) => normalizeCarRentalOffice(element, searchCenter))
      .filter((office): office is CarRentalOffice => Boolean(office));
    if (!isCurrentCarRentalSearch()) return;
    carRentalResults = dedupeCarRentalOffices(normalized).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 350);
    carRentalCache.set(cacheKey, { expires: Date.now() + 5 * 60 * 1000, results: carRentalResults });
    carRentalStatus = normalized.length > 350 ? 'too-many' : carRentalResults.length ? 'ready' : 'empty';
  } catch (error) {
    console.error(error);
    if (!isCurrentCarRentalSearch()) return;
    if (classifyRequestError(error).kind === 'aborted') return;
    if (cached) {
      carRentalResults = refreshOpenState(cached.results, searchCenter.timezone);
      carRentalStatus = navigator.onLine ? 'cached' : 'offline';
    } else {
      carRentalResults = [];
      carRentalStatus = classifyRequestError(error).kind === 'timeout' ? 'timeout' : 'service-unavailable';
      carRentalError = labels[lang].carRentalServiceUnavailable;
    }
  }
  if (!isCurrentCarRentalSearch()) return;
  carRentalPage();
}

function requestCarRentalLocation() {
  const sequence = ++carRentalSearchSequence;
  if (!isAppGeolocationAvailable()) {
    if (sequence !== carRentalSearchSequence) return;
    carRentalStatus = 'unavailable';
    carRentalPage();
    return;
  }
  carRentalStatus = 'requesting';
  carRentalPage();
  requestCurrentAppPosition(
    (position) => {
      if (sequence !== carRentalSearchSequence) return;
      void searchCarRentalOffices({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: labels[lang].qiblaLocation });
    },
    (error) => {
      if (sequence !== carRentalSearchSequence) return;
      carRentalStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      carRentalPage();
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

async function searchCarRentalDestination() {
  const rawQuery = carRentalManualQuery.trim();
  if (!rawQuery) return;
  const sequence = ++carRentalSearchSequence;
  const isCurrentCarRentalSearch = () => sequence === carRentalSearchSequence;
  const suffix = carRentalSearchKind === 'airport' ? ' airport' : carRentalSearchKind === 'station' ? ' station' : '';
  const query = `${rawQuery}${rawQuery.toLowerCase().includes(suffix.trim()) ? '' : suffix}`.trim();
  carRentalStatus = 'searching';
  carRentalPage();
  try {
    const center = await resolveRestaurantDestination(query);
    if (!isCurrentCarRentalSearch()) return;
    if (!center) {
      carRentalResults = [];
      carRentalStatus = 'empty';
      carRentalPage();
      return;
    }
    await searchCarRentalOffices({ ...center, label: carRentalSearchKind === 'airport' ? `${center.label} ${labels[lang].carRentalAirportSearch}` : center.label });
  } catch (error) {
    console.error(error);
    if (!isCurrentCarRentalSearch()) return;
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
  publicTransportMap?.remove();
  publicTransportMap = undefined;
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
    [copy.carRentalBrand, esc(office.brand)],
    [copy.carRentalOperator, esc(office.operator)],
    [copy.carRentalLocationType, carRentalTypeLabel(office.locationType, copy)],
    [copy.carRentalLocationContext, esc(office.locationContext)],
    [copy.prayerAddress, esc(office.address)],
    [copy.prayerOpeningHours, esc(office.openingHours)],
    [copy.prayerTelephone, esc(office.phone)],
    [copy.carRentalEmail, office.email ? `<a href="mailto:${esc(office.email)}">${esc(office.email)}</a>` : ''],
    [copy.prayerWebsite, website],
    [copy.carRentalBookingWebsite, booking],
    [copy.toiletsWheelchair, wheelchair],
    [copy.carRentalBranchRef, esc(office.branchRef)],
  ].filter(([, value]) => Boolean(value));
  return `<dl class="place-details">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function carRentalCard(office: CarRentalOffice, copy: typeof labels[Language]) {
  const openLabel = openingStatusLabel(office.openState, copy);
  const reportPlace: ReportablePlace = { feature: copy.carRentalTitle, name: office.name, sourceUrl: office.sourceUrl, latitude: office.latitude, longitude: office.longitude, city: selectedCity().city, country: selectedCity().country };
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
      ${reportActionMarkup(reportPlace)}
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
  publicTransportMap?.remove();
  publicTransportMap = undefined;
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
  bindReportButtons();
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
  document.querySelector<HTMLButtonElement>('#car-rental-search-this-area')?.addEventListener('click', () => { const center = carRentalMap?.getCenter?.(); if (!center) return; debouncedCarRentalSearch({ latitude: center.lat, longitude: center.lng, label: labels[lang].carRentalSearchThisArea, timezone: carRentalCenter?.timezone }); });
  document.querySelector<HTMLButtonElement>('#car-rental-recentre')?.addEventListener('click', requestCarRentalLocation);
  document.querySelector<HTMLButtonElement>('#car-rental-fit-results')?.addEventListener('click', () => {
    const results = filteredCarRentalResults();
    if (!carRentalMap?.fitBounds || !results.length) return;
    const lngs = results.map((office) => office.longitude);
    const lats = results.map((office) => office.latitude);
    carRentalMap.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 15 });
  });
}

function publicTransportTypeLabel(type: PublicTransportType, copy: typeof labels[Language]) {
  if (type === 'train') return copy.transportTrain;
  if (type === 'metro') return copy.transportMetro;
  if (type === 'light-rail') return copy.transportLightRail;
  if (type === 'tram') return copy.transportTram;
  if (type === 'bus-station') return copy.transportBusStation;
  if (type === 'bus-stop') return copy.transportBusStop;
  if (type === 'ferry') return copy.transportFerry;
  return copy.transportOther;
}

function publicTransportStatusMessage(copy: typeof labels[Language]) {
  if (publicTransportStatus === 'requesting') return copy.publicTransportRequestingLocation;
  if (publicTransportStatus === 'searching') return copy.publicTransportSearching;
  if (publicTransportStatus === 'denied') return copy.publicTransportLocationDenied;
  if (publicTransportStatus === 'unavailable') return copy.publicTransportLocationUnavailable;
  if (publicTransportStatus === 'service-unavailable') return publicTransportError || copy.publicTransportServiceUnavailable;
  if (publicTransportStatus === 'timeout') return copy.publicTransportTimedOut;
  if (publicTransportStatus === 'too-many') return copy.publicTransportTooMany;
  if (publicTransportStatus === 'cached') return copy.publicTransportCached;
  if (publicTransportStatus === 'offline') return copy.publicTransportOffline;
  if (publicTransportStatus === 'empty') return copy.publicTransportNoResults;
  return '';
}

function filteredPublicTransportResults() {
  return sortPublicTransportStops(filterPublicTransportStops(publicTransportResults, publicTransportFilters), publicTransportSort);
}

async function searchPublicTransport(center: PrayerCenter) {
  const sequence = ++publicTransportSearchSequence;
  publicTransportAbortController = nextAbortController(publicTransportAbortController);
  const abortSignal = publicTransportAbortController.signal;
  const searchCenter = { ...center };
  const searchRadius = publicTransportRadiusKm;
  const isCurrentPublicTransportSearch = () => sequence === publicTransportSearchSequence;
  publicTransportCenter = searchCenter;
  publicTransportMapMoved = false;
  const cacheKey = `${searchCenter.latitude.toFixed(4)},${searchCenter.longitude.toFixed(4)},${searchRadius}`;
  const cached = publicTransportCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    if (!isCurrentPublicTransportSearch()) return;
    publicTransportResults = refreshOpenState(cached.results, searchCenter.timezone);
    publicTransportStatus = publicTransportResults.length ? 'cached' : 'empty';
    publicTransportPage();
    return;
  }
  publicTransportStatus = 'searching';
  publicTransportError = '';
  publicTransportPage();
  try {
    const body = buildPublicTransportOverpassQuery(searchCenter.latitude, searchCenter.longitude, searchRadius);
    const data = await requestOverpass(overpassUrl(), { method: 'POST', body, signal: abortSignal }, 20000);
    if (!isCurrentPublicTransportSearch()) return;
    const normalized = (data.elements ?? [])
      .map((element) => normalizePublicTransportStop(element, searchCenter))
      .filter((stop): stop is PublicTransportStop => Boolean(stop));
    if (!isCurrentPublicTransportSearch()) return;
    publicTransportResults = dedupePublicTransportStops(normalized).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 500);
    publicTransportCache.set(cacheKey, { expires: Date.now() + 5 * 60 * 1000, results: publicTransportResults });
    publicTransportStatus = normalized.length > 500 ? 'too-many' : publicTransportResults.length ? 'ready' : 'empty';
  } catch (error) {
    console.error(error);
    if (!isCurrentPublicTransportSearch()) return;
    if (classifyRequestError(error).kind === 'aborted') return;
    if (cached) {
      publicTransportResults = refreshOpenState(cached.results, searchCenter.timezone);
      publicTransportStatus = navigator.onLine ? 'cached' : 'offline';
    } else {
      publicTransportResults = [];
      publicTransportStatus = classifyRequestError(error).kind === 'timeout' ? 'timeout' : 'service-unavailable';
      publicTransportError = labels[lang].publicTransportServiceUnavailable;
    }
  }
  if (!isCurrentPublicTransportSearch()) return;
  publicTransportPage();
}

function requestPublicTransportLocation() {
  const sequence = ++publicTransportSearchSequence;
  if (!isAppGeolocationAvailable()) {
    if (sequence !== publicTransportSearchSequence) return;
    publicTransportStatus = 'unavailable';
    publicTransportPage();
    return;
  }
  publicTransportStatus = 'requesting';
  publicTransportPage();
  requestCurrentAppPosition(
    (position) => {
      if (sequence !== publicTransportSearchSequence) return;
      void searchPublicTransport({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: labels[lang].qiblaLocation });
    },
    (error) => {
      if (sequence !== publicTransportSearchSequence) return;
      publicTransportStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      publicTransportPage();
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

function publicTransportDestinationCenter(city = selectedCity()): PrayerCenter {
  return { latitude: city.coordinates.lat, longitude: city.coordinates.lng, label: `${city.city}, ${city.country}`, timezone: city.timezone };
}

async function searchPublicTransportDestination() {
  const rawQuery = publicTransportManualQuery.trim();
  if (!rawQuery) return;
  const sequence = ++publicTransportSearchSequence;
  const isCurrentPublicTransportSearch = () => sequence === publicTransportSearchSequence;
  publicTransportStatus = 'searching';
  publicTransportPage();
  try {
    const center = await resolveRestaurantDestination(rawQuery);
    if (!isCurrentPublicTransportSearch()) return;
    if (!center) {
      publicTransportResults = [];
      publicTransportStatus = 'empty';
      publicTransportPage();
      return;
    }
    await searchPublicTransport(center);
  } catch (error) {
    console.error(error);
    if (!isCurrentPublicTransportSearch()) return;
    publicTransportStatus = 'service-unavailable';
    publicTransportError = labels[lang].publicTransportServiceUnavailable;
    publicTransportPage();
  }
}

function debouncedPublicTransportSearch(center: PrayerCenter) {
  if (publicTransportSearchTimer) window.clearTimeout(publicTransportSearchTimer);
  publicTransportSearchTimer = window.setTimeout(() => void searchPublicTransport(center), 450);
}

function publicTransportAppleMapsUrl(stop: PublicTransportStop) {
  return `https://maps.apple.com/?daddr=${stop.latitude},${stop.longitude}&q=${encodeURIComponent(stop.name)}`;
}

function publicTransportBrowserDirectionsUrl(stop: PublicTransportStop) {
  return `https://www.openstreetmap.org/directions?to=${stop.latitude},${stop.longitude}#map=17/${stop.latitude}/${stop.longitude}`;
}

function initializePublicTransportMap() {
  publicTransportMap?.remove();
  publicTransportMap = undefined;
  const element = document.querySelector<HTMLElement>('#public-transport-map');
  if (!element || !publicTransportCenter || !window.maplibregl) return;
  try {
    element.replaceChildren();
    publicTransportMap = new window.maplibregl.Map({
      container: element,
      style: openFreeMapStyle,
      center: [publicTransportCenter.longitude, publicTransportCenter.latitude],
      zoom: publicTransportRadiusKm <= 5 ? 12 : publicTransportRadiusKm <= 25 ? 10 : 8,
      attributionControl: true,
    });
    publicTransportMap.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), document.documentElement.dir === 'rtl' ? 'top-right' : 'top-left');
    new window.maplibregl.Marker({ color: '#0f766e' }).setLngLat([publicTransportCenter.longitude, publicTransportCenter.latitude]).setPopup(new window.maplibregl.Popup({ offset: 18 }).setText(publicTransportCenter.label)).addTo(publicTransportMap);
    const colors: Record<PublicTransportType, string> = { train: '#2563eb', metro: '#7c3aed', 'light-rail': '#0891b2', tram: '#0f766e', 'bus-station': '#d97706', 'bus-stop': '#ca8a04', ferry: '#0284c7', other: '#64748b' };
    for (const stop of filteredPublicTransportResults()) {
      new window.maplibregl.Marker({ color: colors[stop.type] }).setLngLat([stop.longitude, stop.latitude]).setPopup(new window.maplibregl.Popup({ offset: 18 }).setText(`${publicTransportTypeLabel(stop.type, labels[lang])} ${stop.name}`)).addTo(publicTransportMap);
    }
    publicTransportMap.on('moveend', () => {
      publicTransportMapMoved = true;
      const button = document.querySelector<HTMLButtonElement>('#public-transport-search-this-area');
      if (button) button.hidden = false;
    });
  } catch {
    if (element) element.innerHTML = `<p class="map-fallback">${labels[lang].mapUnavailable}</p>`;
  }
}

function publicTransportDetails(stop: PublicTransportStop, copy: typeof labels[Language]) {
  const wheelchair = stop.wheelchair === 'yes' ? copy.toiletsWheelchair : stop.wheelchair === 'limited' ? copy.toiletsWheelchairLimited : stop.wheelchair === 'no' ? copy.toiletsWheelchairNo : '';
  const rows = [
    [copy.transportType, publicTransportTypeLabel(stop.type, copy)],
    [copy.prayerAddress, esc(stop.address)],
    [copy.transportOperator, esc(stop.operator)],
    [copy.transportNetwork, esc(stop.network)],
    [copy.transportReference, esc(stop.ref)],
    [copy.transportLines, esc(stop.routes)],
    [copy.prayerOpeningHours, esc(stop.openingHours)],
    [copy.toiletsWheelchair, wheelchair],
    [copy.transportShelter, stop.shelter === 'yes' ? copy.available : stop.shelter === 'no' ? copy.notAvailable : ''],
    [copy.transportSeating, stop.seating === 'yes' ? copy.available : stop.seating === 'no' ? copy.notAvailable : ''],
    [copy.transportToilets, stop.toilets === 'yes' ? copy.available : stop.toilets === 'no' ? copy.notAvailable : ''],
    [copy.prayerTelephone, esc(stop.phone)],
    [copy.prayerWebsite, stop.website ? `<a href="${esc(stop.website)}" target="_blank" rel="noopener noreferrer">${copy.transportOfficialWebsite}</a>` : ''],
  ].filter(([, value]) => Boolean(value));
  return `<dl class="place-details">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function publicTransportCard(stop: PublicTransportStop, copy: typeof labels[Language]) {
  const reportPlace: ReportablePlace = { feature: copy.publicTransportTitle, name: stop.name, sourceUrl: stop.sourceUrl, latitude: stop.latitude, longitude: stop.longitude, city: selectedCity().city, country: selectedCity().country };
  return `<article class="card public-transport-card" aria-label="${esc(stop.name)}">
    <div class="card-top"><span>${stop.distanceKm.toFixed(1)} km · ${publicTransportTypeLabel(stop.type, copy)}</span><span class="badge transport-${stop.type}">${publicTransportTypeLabel(stop.type, copy)}</span></div>
    <h3>${esc(stop.name)}</h3>
    ${stop.originalName && stop.originalName !== stop.name ? `<p>${esc(stop.originalName)}</p>` : ''}
    <p>${openingStatusLabel(stop.openState, copy)}</p>
    ${publicTransportDetails(stop, copy)}
    <div class="place-actions">
      <a class="map-link" href="${stop.sourceUrl}" target="_blank" rel="noopener noreferrer">${copy.prayerViewOnMap}</a>
      <a class="map-link" href="${publicTransportAppleMapsUrl(stop)}" target="_blank" rel="noopener noreferrer">${copy.prayerAppleMaps}</a>
      <a class="map-link" href="${publicTransportBrowserDirectionsUrl(stop)}" target="_blank" rel="noopener noreferrer">${copy.prayerBrowserMap}</a>
      ${stop.website ? `<a class="map-link" href="${esc(stop.website)}" target="_blank" rel="noopener noreferrer">${copy.transportOfficialWebsite}</a>` : ''}
      ${reportActionMarkup(reportPlace)}
    </div>
  </article>`;
}

function publicTransportPage() {
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
  publicTransportMap?.remove();
  publicTransportMap = undefined;
  attractionsMap?.remove();
  attractionsMap = undefined;
  const copy = labels[lang];
  const dir = languageDirection(lang);
  const results = filteredPublicTransportResults();
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  root.innerHTML = `
    <main dir="${dir}" class="app prayer-app public-transport-app">
      <section class="hero prayer-hero">
        ${languageSelector()}
        <p class="eyebrow">${copy.publicTransportOpen}</p>
        <h1>${copy.publicTransportTitle}</h1>
        <p>${copy.publicTransportSubtitle}</p>
        <button type="button" class="ghost hero-action" id="back-from-public-transport">${copy.publicTransportBack}</button>
      </section>
      <section class="panel prayer-panel" aria-live="polite">
        <p class="notice prayer-notice">${copy.publicTransportNotice}</p>
        <p class="notice prayer-notice">${copy.publicTransportLiveNotice}</p>
        <div class="prayer-actions">
          <button type="button" id="use-public-transport-location">${copy.publicTransportUseLocation}</button>
          <button type="button" class="ghost" id="use-public-transport-destination">${copy.publicTransportUseDestination}</button>
          <label>${copy.publicTransportRadius}<select id="public-transport-radius">${publicTransportRadii.map((radius) => `<option value="${radius}" ${radius === publicTransportRadiusKm ? 'selected' : ''}>${radius} km</option>`).join('')}</select></label>
          <form id="manual-public-transport-search" class="manual-search"><label>${copy.publicTransportManualSearch}<input id="public-transport-manual-query" value="${esc(publicTransportManualQuery)}" placeholder="${copy.publicTransportManualPlaceholder}" /></label><button type="submit">${copy.publicTransportSearch}</button></form>
        </div>
        <p class="prayer-status ${publicTransportStatus}" role="status">${publicTransportStatusMessage(copy)}</p>
        <div class="segmented" role="tablist" aria-label="${copy.publicTransportTitle}">
          <button type="button" class="${publicTransportMode === 'map' ? 'active' : 'ghost'}" data-public-transport-mode="map">${copy.publicTransportMapView}</button>
          <button type="button" class="${publicTransportMode === 'list' ? 'active' : 'ghost'}" data-public-transport-mode="list">${copy.publicTransportListView}</button>
        </div>
        <div class="prayer-filters" aria-label="${copy.publicTransportTitle}">
          <select id="public-transport-type-filter"><option value="all">${copy.publicTransportAll}</option>${(['train','metro','light-rail','tram','bus-station','bus-stop','ferry','other'] as PublicTransportType[]).map((type) => `<option value="${type}" ${publicTransportFilters.type === type ? 'selected' : ''}>${publicTransportTypeLabel(type, copy)}</option>`).join('')}</select>
          ${['wheelchair', 'openNow', 'toilets', 'shelter'].map((key) => {
            const label = ({ wheelchair: copy.toiletsWheelchair, openNow: copy.toiletsOpenNow, toilets: copy.transportToiletsAvailable, shelter: copy.transportShelterAvailable } as Record<string, string>)[key];
            return `<label class="inline-check"><input type="checkbox" data-public-transport-filter="${key}" ${publicTransportFilters[key as keyof PublicTransportFilters] ? 'checked' : ''}/> ${label}</label>`;
          }).join('')}
          <label>${copy.publicTransportSort}<select id="public-transport-sort"><option value="distance" ${publicTransportSort === 'distance' ? 'selected' : ''}>${copy.toiletsNearest}</option><option value="name" ${publicTransportSort === 'name' ? 'selected' : ''}>${copy.toiletsSortName}</option><option value="type" ${publicTransportSort === 'type' ? 'selected' : ''}>${copy.transportSortType}</option><option value="open" ${publicTransportSort === 'open' ? 'selected' : ''}>${copy.toiletsSortOpen}</option><option value="accessibility" ${publicTransportSort === 'accessibility' ? 'selected' : ''}>${copy.toiletsSortAccessible}</option></select></label>
        </div>
        <div class="place-actions">
          <button type="button" id="public-transport-search-this-area" class="ghost" ${publicTransportMapMoved ? '' : 'hidden'}>${copy.publicTransportSearchThisArea}</button>
          <button type="button" id="public-transport-recentre" class="ghost">${copy.publicTransportRecentre}</button>
          <button type="button" id="public-transport-fit-results" class="ghost">${copy.publicTransportFitResults}</button>
        </div>
        <div class="legend halal-legend"><strong>${copy.publicTransportLegend}</strong><span class="badge transport-train">${copy.transportTrain}</span><span class="badge transport-metro">${copy.transportMetro}</span><span class="badge transport-tram">${copy.transportTram}</span><span class="badge transport-bus-stop">${copy.transportBusStop}</span><span class="badge transport-ferry">${copy.transportFerry}</span></div>
        ${publicTransportMode === 'map' ? `<div id="public-transport-map" class="city-map prayer-map"><p class="map-fallback">${copy.mapUnavailable}</p></div>` : ''}
        ${(['empty', 'timeout', 'service-unavailable', 'offline'].includes(publicTransportStatus) || !results.length && publicTransportResults.length > 0) ? `<div class="empty-actions"><button type="button" id="retry-public-transport" class="ghost">${copy.publicTransportRetry}</button>${publicTransportStatus === 'timeout' ? '' : `<button type="button" id="increase-public-transport-radius">${copy.publicTransportIncreaseRadius}</button>`}<button type="button" id="another-public-transport-city" class="ghost">${copy.publicTransportSearchAnother}</button></div>` : ''}
        <div class="place-list">${results.length ? results.map((stop) => publicTransportCard(stop, copy)).join('') : publicTransportStatus === 'ready' ? `<p>${copy.publicTransportNoResults}</p>` : ''}</div>
        <p class="map-status">${copy.osmAttribution}</p>
      </section>
    </main>`;
  bindPublicTransportPage();
  if (publicTransportMode === 'map') initializePublicTransportMap();
}

function bindPublicTransportPage() {
  bindReportButtons();
  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => { lang = (event.target as HTMLSelectElement).value as Language; publicTransportPage(); });
  document.querySelector<HTMLButtonElement>('#back-from-public-transport')?.addEventListener('click', () => { view = 'planner'; publicTransportMap?.remove(); publicTransportMap = undefined; if (window.location.hash) history.pushState(null, '', window.location.pathname + window.location.search); render(); });
  document.querySelector<HTMLButtonElement>('#use-public-transport-location')?.addEventListener('click', requestPublicTransportLocation);
  document.querySelector<HTMLButtonElement>('#use-public-transport-destination')?.addEventListener('click', () => void searchPublicTransport(publicTransportDestinationCenter()));
  document.querySelector<HTMLSelectElement>('#public-transport-radius')?.addEventListener('change', (event) => { publicTransportRadiusKm = Number((event.target as HTMLSelectElement).value) as typeof publicTransportRadii[number]; if (publicTransportCenter) void searchPublicTransport(publicTransportCenter); });
  document.querySelector<HTMLFormElement>('#manual-public-transport-search')?.addEventListener('submit', (event) => { event.preventDefault(); publicTransportManualQuery = document.querySelector<HTMLInputElement>('#public-transport-manual-query')?.value ?? ''; void searchPublicTransportDestination(); });
  document.querySelectorAll<HTMLButtonElement>('[data-public-transport-mode]').forEach((button) => button.addEventListener('click', () => { publicTransportMode = button.dataset.publicTransportMode as PublicTransportMode; publicTransportPage(); }));
  document.querySelector<HTMLSelectElement>('#public-transport-type-filter')?.addEventListener('change', (event) => { publicTransportFilters = { ...publicTransportFilters, type: (event.target as HTMLSelectElement).value as PublicTransportFilters['type'] }; publicTransportPage(); });
  document.querySelectorAll<HTMLInputElement>('[data-public-transport-filter]').forEach((input) => input.addEventListener('change', () => { publicTransportFilters = { ...publicTransportFilters, [input.dataset.publicTransportFilter ?? 'openNow']: input.checked }; publicTransportPage(); }));
  document.querySelector<HTMLSelectElement>('#public-transport-sort')?.addEventListener('change', (event) => { publicTransportSort = (event.target as HTMLSelectElement).value as PublicTransportSort; publicTransportPage(); });
  document.querySelector<HTMLButtonElement>('#retry-public-transport')?.addEventListener('click', () => { if (publicTransportCenter) void searchPublicTransport(publicTransportCenter); else requestPublicTransportLocation(); });
  document.querySelector<HTMLButtonElement>('#increase-public-transport-radius')?.addEventListener('click', () => { const next = publicTransportRadii.find((radius) => radius > publicTransportRadiusKm); if (next) publicTransportRadiusKm = next; if (publicTransportCenter) void searchPublicTransport(publicTransportCenter); });
  document.querySelector<HTMLButtonElement>('#another-public-transport-city')?.addEventListener('click', () => document.querySelector<HTMLInputElement>('#public-transport-manual-query')?.focus());
  document.querySelector<HTMLButtonElement>('#public-transport-search-this-area')?.addEventListener('click', () => { const center = publicTransportMap?.getCenter?.(); if (!center) return; debouncedPublicTransportSearch({ latitude: center.lat, longitude: center.lng, label: labels[lang].publicTransportSearchThisArea, timezone: publicTransportCenter?.timezone }); });
  document.querySelector<HTMLButtonElement>('#public-transport-recentre')?.addEventListener('click', requestPublicTransportLocation);
  document.querySelector<HTMLButtonElement>('#public-transport-fit-results')?.addEventListener('click', () => {
    const results = filteredPublicTransportResults();
    if (!publicTransportMap?.fitBounds || !results.length) return;
    const lngs = results.map((stop) => stop.longitude);
    const lats = results.map((stop) => stop.latitude);
    publicTransportMap.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 15 });
  });
}

function taxiTypeLabel(type: TaxiServiceType, copy: typeof labels[Language]) {
  if (type === 'airport') return copy.taxiAirportRank;
  if (type === 'station') return copy.taxiStationRank;
  if (type === 'bus') return copy.taxiBusRank;
  if (type === 'office') return copy.taxiOffice;
  if (type === 'motorcycle') return copy.taxiMotorcycle;
  if (type === 'water') return copy.taxiWater;
  if (type === 'other') return copy.taxiOther;
  return copy.taxiRank;
}

function taxiStatusMessage(copy: typeof labels[Language]) {
  if (taxiStatus === 'requesting') return copy.taxiRequestingLocation;
  if (taxiStatus === 'searching') return copy.taxiSearching;
  if (taxiStatus === 'denied') return copy.taxiLocationDenied;
  if (taxiStatus === 'unavailable') return copy.taxiLocationUnavailable;
  if (taxiStatus === 'service-unavailable') return taxiError || copy.taxiServiceUnavailable;
  if (taxiStatus === 'timeout') return copy.taxiTimedOut;
  if (taxiStatus === 'too-many') return copy.taxiTooMany;
  if (taxiStatus === 'cached') return copy.taxiCached;
  if (taxiStatus === 'offline') return copy.taxiOffline;
  if (taxiStatus === 'empty') return copy.taxiNoResults;
  return '';
}

function filteredTaxiResults() {
  return sortTaxiServices(filterTaxiServices(taxiResults, taxiFilters), taxiSort);
}

function taxiDestinationCenter(city = selectedCity()): PrayerCenter {
  return { latitude: city.coordinates.lat, longitude: city.coordinates.lng, label: `${city.city}, ${city.country}`, timezone: city.timezone };
}

async function searchTaxiServices(center: PrayerCenter) {
  const sequence = ++taxiSearchSequence;
  taxiAbortController = nextAbortController(taxiAbortController);
  const abortSignal = taxiAbortController.signal;
  const searchCenter = { ...center };
  const searchRadius = taxiRadiusKm;
  const isCurrentTaxiSearch = () => sequence === taxiSearchSequence;
  taxiCenter = searchCenter;
  taxiMapMoved = false;
  const cacheKey = `${searchCenter.latitude.toFixed(4)},${searchCenter.longitude.toFixed(4)},${searchRadius}`;
  const cached = taxiCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    if (!isCurrentTaxiSearch()) return;
    taxiResults = refreshOpenState(cached.results, searchCenter.timezone);
    taxiStatus = taxiResults.length ? 'cached' : 'empty';
    taxiPage();
    return;
  }
  taxiStatus = 'searching';
  taxiError = '';
  taxiPage();
  try {
    const body = buildTaxiOverpassQuery(searchCenter.latitude, searchCenter.longitude, searchRadius);
    const data = await requestOverpass(overpassUrl(), { method: 'POST', body, signal: abortSignal }, 20000);
    if (!isCurrentTaxiSearch()) return;
    const normalized = (data.elements ?? [])
      .map((element) => normalizeTaxiService(element, searchCenter))
      .filter((item): item is TaxiService => Boolean(item));
    if (!isCurrentTaxiSearch()) return;
    taxiResults = dedupeTaxiServices(normalized).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 500);
    taxiCache.set(cacheKey, { expires: Date.now() + 5 * 60 * 1000, results: taxiResults });
    taxiStatus = normalized.length > 500 ? 'too-many' : taxiResults.length ? 'ready' : 'empty';
  } catch (error) {
    console.error(error);
    if (!isCurrentTaxiSearch()) return;
    if (classifyRequestError(error).kind === 'aborted') return;
    if (cached) {
      taxiResults = refreshOpenState(cached.results, searchCenter.timezone);
      taxiStatus = navigator.onLine ? 'cached' : 'offline';
    } else {
      taxiResults = [];
      taxiStatus = classifyRequestError(error).kind === 'timeout' ? 'timeout' : 'service-unavailable';
      taxiError = labels[lang].taxiServiceUnavailable;
    }
  }
  if (!isCurrentTaxiSearch()) return;
  taxiPage();
}

function requestTaxiLocation() {
  const sequence = ++taxiSearchSequence;
  if (!isAppGeolocationAvailable()) {
    if (sequence !== taxiSearchSequence) return;
    taxiStatus = 'unavailable';
    taxiPage();
    return;
  }
  taxiStatus = 'requesting';
  taxiPage();
  requestCurrentAppPosition(
    (position) => {
      if (sequence !== taxiSearchSequence) return;
      void searchTaxiServices({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: labels[lang].qiblaLocation });
    },
    (error) => {
      if (sequence !== taxiSearchSequence) return;
      taxiStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      taxiPage();
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

async function searchTaxiDestination() {
  const rawQuery = taxiManualQuery.trim();
  if (!rawQuery) return;
  const sequence = ++taxiSearchSequence;
  const isCurrentTaxiSearch = () => sequence === taxiSearchSequence;
  taxiStatus = 'searching';
  taxiPage();
  try {
    const center = await resolveRestaurantDestination(rawQuery);
    if (!isCurrentTaxiSearch()) return;
    if (!center) {
      taxiResults = [];
      taxiStatus = 'empty';
      taxiPage();
      return;
    }
    await searchTaxiServices(center);
  } catch (error) {
    console.error(error);
    if (!isCurrentTaxiSearch()) return;
    taxiStatus = 'service-unavailable';
    taxiError = labels[lang].taxiServiceUnavailable;
    taxiPage();
  }
}

function debouncedTaxiSearch(center: PrayerCenter) {
  if (taxiSearchTimer) window.clearTimeout(taxiSearchTimer);
  taxiSearchTimer = window.setTimeout(() => void searchTaxiServices(center), 450);
}

function taxiAppleMapsUrl(item: TaxiService) {
  return `https://maps.apple.com/?daddr=${item.latitude},${item.longitude}&q=${encodeURIComponent(item.name)}`;
}

function taxiBrowserDirectionsUrl(item: TaxiService) {
  return `https://www.openstreetmap.org/directions?to=${item.latitude},${item.longitude}#map=17/${item.latitude}/${item.longitude}`;
}

function initializeTaxiMap() {
  taxiMap?.remove();
  taxiMap = undefined;
  const element = document.querySelector<HTMLElement>('#taxi-map');
  if (!element || !taxiCenter || !window.maplibregl) return;
  try {
    element.replaceChildren();
    taxiMap = new window.maplibregl.Map({ container: element, style: openFreeMapStyle, center: [taxiCenter.longitude, taxiCenter.latitude], zoom: taxiRadiusKm <= 5 ? 12 : taxiRadiusKm <= 25 ? 10 : 8, attributionControl: true });
    taxiMap.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), document.documentElement.dir === 'rtl' ? 'top-right' : 'top-left');
    new window.maplibregl.Marker({ color: '#0f766e' }).setLngLat([taxiCenter.longitude, taxiCenter.latitude]).setPopup(new window.maplibregl.Popup({ offset: 18 }).setText(taxiCenter.label)).addTo(taxiMap);
    const colors: Record<TaxiServiceType, string> = { rank: '#d97706', airport: '#7c3aed', station: '#2563eb', bus: '#0891b2', office: '#0f766e', motorcycle: '#ca8a04', water: '#0284c7', other: '#64748b' };
    for (const item of filteredTaxiResults()) new window.maplibregl.Marker({ color: colors[item.type] }).setLngLat([item.longitude, item.latitude]).setPopup(new window.maplibregl.Popup({ offset: 18 }).setText(`${taxiTypeLabel(item.type, labels[lang])} ${item.name}`)).addTo(taxiMap);
    taxiMap.on('moveend', () => {
      taxiMapMoved = true;
      const button = document.querySelector<HTMLButtonElement>('#taxi-search-this-area');
      if (button) button.hidden = false;
    });
  } catch {
    if (element) element.innerHTML = `<p class="map-fallback">${labels[lang].mapUnavailable}</p>`;
  }
}

function taxiDetails(item: TaxiService, copy: typeof labels[Language]) {
  const wheelchair = item.wheelchair === 'yes' ? copy.toiletsWheelchair : item.wheelchair === 'limited' ? copy.toiletsWheelchairLimited : item.wheelchair === 'no' ? copy.toiletsWheelchairNo : '';
  const rows = [
    [copy.taxiType, taxiTypeLabel(item.type, copy)],
    [copy.prayerAddress, esc(item.address)],
    [copy.transportOperator, esc(item.operator)],
    [copy.prayerOpeningHours, esc(item.openingHours)],
    [copy.taxiCapacity, esc(item.capacity)],
    [copy.taxiVehicle, esc(item.vehicle)],
    [copy.toiletsWheelchair, wheelchair],
    [copy.transportShelter, item.shelter === 'yes' ? copy.available : item.shelter === 'no' ? copy.notAvailable : ''],
    [copy.taxiLit, item.lit === 'yes' ? copy.available : item.lit === 'no' ? copy.notAvailable : ''],
    [copy.taxiFee, esc(item.fee)],
    [copy.prayerTelephone, item.callHref ? `<a href="${esc(item.callHref)}">${esc(item.phone)}</a>` : esc(item.phone)],
    [copy.prayerWebsite, item.website ? `<a href="${esc(item.website)}" target="_blank" rel="noopener noreferrer">${copy.transportOfficialWebsite}</a>` : ''],
  ].filter(([, value]) => Boolean(value));
  return `<dl class="place-details">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function taxiCard(item: TaxiService, copy: typeof labels[Language]) {
  const reportPlace: ReportablePlace = { feature: copy.taxiTitle, name: item.name, sourceUrl: item.sourceUrl, latitude: item.latitude, longitude: item.longitude, city: selectedCity().city, country: selectedCity().country };
  return `<article class="card taxi-card" aria-label="${esc(item.name)}">
    <div class="card-top"><span>${item.distanceKm.toFixed(1)} km · ${taxiTypeLabel(item.type, copy)}</span><span class="badge taxi-${item.type}">${taxiTypeLabel(item.type, copy)}</span></div>
    <h3>${esc(item.name)}</h3>
    ${item.originalName && item.originalName !== item.name ? `<p>${esc(item.originalName)}</p>` : ''}
    <p>${openingStatusLabel(item.openState, copy)}</p>
    ${taxiDetails(item, copy)}
    <div class="place-actions">
      <a class="map-link" href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer">${copy.prayerViewOnMap}</a>
      <a class="map-link" href="${taxiAppleMapsUrl(item)}" target="_blank" rel="noopener noreferrer">${copy.prayerAppleMaps}</a>
      <a class="map-link" href="${taxiBrowserDirectionsUrl(item)}" target="_blank" rel="noopener noreferrer">${copy.prayerBrowserMap}</a>
      ${item.website ? `<a class="map-link" href="${esc(item.website)}" target="_blank" rel="noopener noreferrer">${copy.transportOfficialWebsite}</a>` : ''}
      ${item.callHref ? `<a class="map-link" href="${esc(item.callHref)}">${copy.taxiCall}</a>` : ''}
      ${reportActionMarkup(reportPlace)}
    </div>
  </article>`;
}

function taxiPage() {
  if (!root) return;
  cityMap?.remove(); cityMap = undefined;
  prayerMap?.remove(); prayerMap = undefined;
  restaurantMap?.remove(); restaurantMap = undefined;
  toiletMap?.remove(); toiletMap = undefined;
  carRentalMap?.remove(); carRentalMap = undefined;
  publicTransportMap?.remove(); publicTransportMap = undefined;
  taxiMap?.remove(); taxiMap = undefined;
  attractionsMap?.remove(); attractionsMap = undefined;
  const copy = labels[lang];
  const dir = languageDirection(lang);
  const results = filteredTaxiResults();
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  root.innerHTML = `<main dir="${dir}" class="app prayer-app taxi-app">
    <section class="hero prayer-hero">${languageSelector()}<p class="eyebrow">${copy.taxiOpen}</p><h1>${copy.taxiTitle}</h1><p>${copy.taxiSubtitle}</p><button type="button" class="ghost hero-action" id="back-from-taxi">${copy.taxiBack}</button></section>
    <section class="panel prayer-panel" aria-live="polite">
      <p class="notice prayer-notice">${copy.taxiNotice}</p><p class="notice prayer-notice">${copy.taxiLiveNotice}</p>
      <div class="prayer-actions"><button type="button" id="use-taxi-location">${copy.taxiUseLocation}</button><button type="button" class="ghost" id="use-taxi-destination">${copy.taxiUseDestination}</button><label>${copy.taxiRadius}<select id="taxi-radius">${taxiRadii.map((radius) => `<option value="${radius}" ${radius === taxiRadiusKm ? 'selected' : ''}>${radius} km</option>`).join('')}</select></label><form id="manual-taxi-search" class="manual-search"><label>${copy.taxiManualSearch}<input id="taxi-manual-query" value="${esc(taxiManualQuery)}" placeholder="${copy.taxiManualPlaceholder}" /></label><button type="submit">${copy.taxiSearch}</button></form></div>
      <p class="prayer-status ${taxiStatus}" role="status">${taxiStatusMessage(copy)}</p>
      <div class="segmented" role="tablist" aria-label="${copy.taxiTitle}"><button type="button" class="${taxiMode === 'map' ? 'active' : 'ghost'}" data-taxi-mode="map">${copy.taxiMapView}</button><button type="button" class="${taxiMode === 'list' ? 'active' : 'ghost'}" data-taxi-mode="list">${copy.taxiListView}</button></div>
      <div class="prayer-filters" aria-label="${copy.taxiTitle}"><select id="taxi-type-filter"><option value="all">${copy.taxiAll}</option>${(['rank','airport','station','bus','office','motorcycle','water','other'] as TaxiServiceType[]).map((type) => `<option value="${type}" ${taxiFilters.type === type ? 'selected' : ''}>${taxiTypeLabel(type, copy)}</option>`).join('')}</select>${['openNow','phone','website','wheelchairInfo','shelter'].map((key) => { const label = ({ openNow: copy.toiletsOpenNow, phone: copy.taxiPhoneAvailable, website: copy.carRentalWebsiteAvailable, wheelchairInfo: copy.taxiWheelchairInfo, shelter: copy.transportShelterAvailable } as Record<string, string>)[key]; return `<label class="inline-check"><input type="checkbox" data-taxi-filter="${key}" ${taxiFilters[key as keyof TaxiFilters] ? 'checked' : ''}/> ${label}</label>`; }).join('')}<label>${copy.taxiSort}<select id="taxi-sort"><option value="distance" ${taxiSort === 'distance' ? 'selected' : ''}>${copy.toiletsNearest}</option><option value="name" ${taxiSort === 'name' ? 'selected' : ''}>${copy.toiletsSortName}</option><option value="type" ${taxiSort === 'type' ? 'selected' : ''}>${copy.taxiSortType}</option><option value="open" ${taxiSort === 'open' ? 'selected' : ''}>${copy.toiletsSortOpen}</option><option value="contact" ${taxiSort === 'contact' ? 'selected' : ''}>${copy.taxiSortContact}</option></select></label></div>
      <div class="place-actions"><button type="button" id="taxi-search-this-area" class="ghost" ${taxiMapMoved ? '' : 'hidden'}>${copy.taxiSearchThisArea}</button><button type="button" id="taxi-recentre" class="ghost">${copy.taxiRecentre}</button><button type="button" id="taxi-fit-results" class="ghost">${copy.taxiFitResults}</button></div>
      <div class="legend halal-legend"><strong>${copy.taxiLegend}</strong><span class="badge taxi-rank">${copy.taxiRank}</span><span class="badge taxi-airport">${copy.taxiAirportRank}</span><span class="badge taxi-office">${copy.taxiOffice}</span><span class="badge taxi-motorcycle">${copy.taxiMotorcycle}</span><span class="badge taxi-water">${copy.taxiWater}</span></div>
      ${taxiMode === 'map' ? `<div id="taxi-map" class="city-map prayer-map"><p class="map-fallback">${copy.mapUnavailable}</p></div>` : ''}
      ${(['empty', 'timeout', 'service-unavailable', 'offline'].includes(taxiStatus) || !results.length && taxiResults.length > 0) ? `<div class="empty-actions"><button type="button" id="retry-taxi" class="ghost">${copy.taxiRetry}</button>${taxiStatus === 'timeout' ? '' : `<button type="button" id="increase-taxi-radius">${copy.taxiIncreaseRadius}</button>`}<button type="button" id="another-taxi-city" class="ghost">${copy.taxiSearchAnother}</button></div>` : ''}
      <div class="place-list">${results.length ? results.map((item) => taxiCard(item, copy)).join('') : taxiStatus === 'ready' ? `<p>${copy.taxiNoResults}</p>` : ''}</div><p class="map-status">${copy.osmAttribution}</p>
    </section></main>`;
  bindTaxiPage();
  if (taxiMode === 'map') initializeTaxiMap();
}

function bindTaxiPage() {
  bindReportButtons();
  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => { lang = (event.target as HTMLSelectElement).value as Language; taxiPage(); });
  document.querySelector<HTMLButtonElement>('#back-from-taxi')?.addEventListener('click', () => { view = 'planner'; taxiMap?.remove(); taxiMap = undefined; if (window.location.hash) history.pushState(null, '', window.location.pathname + window.location.search); render(); });
  document.querySelector<HTMLButtonElement>('#use-taxi-location')?.addEventListener('click', requestTaxiLocation);
  document.querySelector<HTMLButtonElement>('#use-taxi-destination')?.addEventListener('click', () => void searchTaxiServices(taxiDestinationCenter()));
  document.querySelector<HTMLSelectElement>('#taxi-radius')?.addEventListener('change', (event) => { taxiRadiusKm = Number((event.target as HTMLSelectElement).value) as typeof taxiRadii[number]; if (taxiCenter) void searchTaxiServices(taxiCenter); });
  document.querySelector<HTMLFormElement>('#manual-taxi-search')?.addEventListener('submit', (event) => { event.preventDefault(); taxiManualQuery = document.querySelector<HTMLInputElement>('#taxi-manual-query')?.value ?? ''; void searchTaxiDestination(); });
  document.querySelectorAll<HTMLButtonElement>('[data-taxi-mode]').forEach((button) => button.addEventListener('click', () => { taxiMode = button.dataset.taxiMode as TaxiMode; taxiPage(); }));
  document.querySelector<HTMLSelectElement>('#taxi-type-filter')?.addEventListener('change', (event) => { taxiFilters = { ...taxiFilters, type: (event.target as HTMLSelectElement).value as TaxiFilters['type'] }; taxiPage(); });
  document.querySelectorAll<HTMLInputElement>('[data-taxi-filter]').forEach((input) => input.addEventListener('change', () => { taxiFilters = { ...taxiFilters, [input.dataset.taxiFilter ?? 'openNow']: input.checked }; taxiPage(); }));
  document.querySelector<HTMLSelectElement>('#taxi-sort')?.addEventListener('change', (event) => { taxiSort = (event.target as HTMLSelectElement).value as TaxiSort; taxiPage(); });
  document.querySelector<HTMLButtonElement>('#retry-taxi')?.addEventListener('click', () => { if (taxiCenter) void searchTaxiServices(taxiCenter); else requestTaxiLocation(); });
  document.querySelector<HTMLButtonElement>('#increase-taxi-radius')?.addEventListener('click', () => { const next = taxiRadii.find((radius) => radius > taxiRadiusKm); if (next) taxiRadiusKm = next; if (taxiCenter) void searchTaxiServices(taxiCenter); });
  document.querySelector<HTMLButtonElement>('#another-taxi-city')?.addEventListener('click', () => document.querySelector<HTMLInputElement>('#taxi-manual-query')?.focus());
  document.querySelector<HTMLButtonElement>('#taxi-search-this-area')?.addEventListener('click', () => { const center = taxiMap?.getCenter?.(); if (!center) return; debouncedTaxiSearch({ latitude: center.lat, longitude: center.lng, label: labels[lang].taxiSearchThisArea, timezone: taxiCenter?.timezone }); });
  document.querySelector<HTMLButtonElement>('#taxi-recentre')?.addEventListener('click', requestTaxiLocation);
  document.querySelector<HTMLButtonElement>('#taxi-fit-results')?.addEventListener('click', () => {
    const results = filteredTaxiResults();
    if (!taxiMap?.fitBounds || !results.length) return;
    const lngs = results.map((item) => item.longitude);
    const lats = results.map((item) => item.latitude);
    taxiMap.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 15 });
  });
}

function selectedWeatherCity() {
  const match = weatherLocation ? cities.find((city) => city.city === weatherLocation?.label || `${city.city}, ${city.country}` === weatherLocation?.label) : undefined;
  return match ?? selectedCity();
}

function weatherCacheKey(location: WeatherLocation, units = weatherUnits) {
  return `mtp-weather-${location.latitude.toFixed(3)}-${location.longitude.toFixed(3)}-${location.timezone ?? 'auto'}-${units.temperature}-${units.wind}-${units.precipitation}-7d-v2`;
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
  const sequence = ++weatherRequestSequence;
  weatherAbortController = nextAbortController(weatherAbortController);
  const abortSignal = weatherAbortController.signal;
  const requestLocation = { ...location };
  const requestUnits = { ...weatherUnits };
  const isCurrentWeatherRequest = () => sequence === weatherRequestSequence;
  weatherLocation = requestLocation;
  const cacheKey = weatherCacheKey(requestLocation, requestUnits);
  const cached = readJsonCache<WeatherForecast>(localStorage, cacheKey, WEATHER_CACHE_MS);
  if (cached && !force) {
    if (!isCurrentWeatherRequest()) return;
    weatherForecast = { ...cached, cached: true };
    weatherStatus = 'cached';
    weatherPage();
    return;
  }
  weatherStatus = 'loading';
  weatherError = '';
  weatherPage();
  try {
    const forecast = validateWeatherResponse(await requestJson<unknown>(buildWeatherUrl(requestLocation.latitude, requestLocation.longitude, requestUnits), { headers: { Accept: 'application/json' }, signal: abortSignal }, 9000));
    if (!isCurrentWeatherRequest()) return;
    weatherForecast = forecast;
    weatherSelectedDay = forecast.daily[0]?.date ?? '';
    writeJsonCache(localStorage, cacheKey, forecast);
    weatherStatus = 'updated';
  } catch (error) {
    if (!isCurrentWeatherRequest()) return;
    if (classifyRequestError(error).kind === 'aborted') return;
    const fallback = readJsonCache<WeatherForecast>(localStorage, cacheKey, 7 * 24 * 60 * 60 * 1000);
    if (!isCurrentWeatherRequest()) return;
    if (fallback) {
      weatherForecast = { ...fallback, cached: true };
      weatherStatus = navigator.onLine ? 'cached' : 'offline';
    } else {
      weatherForecast = null;
      const kind = classifyRequestError(error).kind;
      weatherStatus = kind === 'timeout' ? 'timeout' : kind === 'malformed' || error instanceof Error && /Missing|Malformed/.test(error.message) ? 'invalid' : 'service-unavailable';
      weatherError = error instanceof Error ? error.message : '';
    }
  }
  if (!isCurrentWeatherRequest()) return;
  weatherPage();
}

function destinationWeatherLocation(city = selectedCity()): WeatherLocation {
  return { latitude: city.coordinates.lat, longitude: city.coordinates.lng, label: `${city.city}, ${city.country}`, country: city.country, timezone: city.timezone };
}

function requestWeatherLocation() {
  const sequence = ++weatherRequestSequence;
  if (!isAppGeolocationAvailable()) {
    if (sequence !== weatherRequestSequence) return;
    weatherStatus = 'unavailable';
    weatherPage();
    return;
  }
  weatherStatus = 'requesting';
  weatherPage();
  requestCurrentAppPosition(
    (position) => {
      if (sequence !== weatherRequestSequence) return;
      void loadWeather({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: labels[lang].qiblaLocation });
    },
    (error) => {
      if (sequence !== weatherRequestSequence) return;
      weatherStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      weatherPage();
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

async function searchWeatherDestination() {
  const query = weatherManualQuery.trim();
  if (!query) return;
  const sequence = ++weatherRequestSequence;
  const isCurrentWeatherRequest = () => sequence === weatherRequestSequence;
  weatherStatus = 'loading';
  weatherPage();
  try {
    const city = cities.find((candidate) => candidate.city.toLowerCase() === query.toLowerCase());
    if (city) {
      if (!isCurrentWeatherRequest()) return;
      await loadWeather(destinationWeatherLocation(city), true);
      return;
    }
    const center = await resolveRestaurantDestination(query);
    if (!isCurrentWeatherRequest()) return;
    if (!center) {
      weatherStatus = 'unsupported';
      weatherPage();
      return;
    }
    await loadWeather({ latitude: center.latitude, longitude: center.longitude, label: center.label }, true);
  } catch (error) {
    console.error(error);
    if (!isCurrentWeatherRequest()) return;
    weatherStatus = 'service-unavailable';
    weatherError = labels[lang].weatherUnavailable;
    weatherPage();
  }
}

function formatWeatherTime(value: string, options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }) {
  if (!value) return '';
  const timeZone = weatherForecast?.timezone || weatherLocation?.timezone || selectedCity().timezone;
  const date = dateTimeForZone(value, timeZone);
  if (!date) return '';
  return new Intl.DateTimeFormat(localeForLanguage(lang), { ...options, timeZone }).format(date);
}

const formatPercent = (value: number | null, copy: typeof labels[Language]) => value === null ? copy.weatherValueUnavailable : `${value}%`;
const sumAvailable = (...values: Array<number | null>) => values.some((value) => value !== null) ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;

function weatherRows(forecast: WeatherForecast, copy: typeof labels[Language]) {
  const today = forecast.daily[0];
  const condition = weatherCodeInfo(forecast.current.weatherCode, copy);
  const currentWet = sumAvailable(forecast.current.rain, forecast.current.showers, forecast.current.snowfall, forecast.current.precipitation);
  const rainSnow = currentWet === null ? copy.weatherValueUnavailable : formatPrecipitation(currentWet, weatherUnits, copy.weatherValueUnavailable);
  const currentUv = selectHourlyForecast(forecast.hourly, forecast.current.time, 1)[0]?.uvIndex ?? null;
  const firstVisibility = selectHourlyForecast(forecast.hourly, forecast.current.time, 1)[0]?.visibility ?? null;
  const rows = [
    [copy.weatherCondition, `${condition.icon} ${condition.label}`],
    [copy.weatherFeelsLike, formatTemperature(forecast.current.apparentTemperature, weatherUnits, copy.weatherValueUnavailable)],
    [copy.weatherHighLow, today ? `${formatTemperature(today.temperatureMax, weatherUnits, copy.weatherValueUnavailable)} / ${formatTemperature(today.temperatureMin, weatherUnits, copy.weatherValueUnavailable)}` : ''],
    [copy.weatherRainSnow, rainSnow],
    [copy.weatherHumidity, `${forecast.current.humidity}%`],
    [copy.weatherWind, `${formatWind(forecast.current.windSpeed, weatherUnits, copy.weatherValueUnavailable)} ${windDirectionLabel(forecast.current.windDirection)}`],
    [copy.weatherGusts, formatWind(forecast.current.windGusts, weatherUnits, copy.weatherValueUnavailable)],
    [copy.weatherCloud, formatPercent(forecast.current.cloudCover, copy)],
    [copy.weatherUv, currentUv === null ? copy.weatherValueUnavailable : String(currentUv)],
    [copy.weatherVisibility, firstVisibility === null ? copy.weatherValueUnavailable : `${Math.round(firstVisibility / 1000)} km`],
    [copy.weatherSunrise, today?.sunrise ? formatWeatherTime(today.sunrise) : ''],
    [copy.weatherSunset, today?.sunset ? formatWeatherTime(today.sunset) : ''],
    [copy.weatherDayNight, forecast.current.isDay ? copy.weatherDaylight : copy.weatherNight],
    [copy.weatherLastUpdated, formatWeatherTime(forecast.retrievedAt, { dateStyle: 'medium', timeStyle: 'short' })],
  ].filter(([, value]) => Boolean(value));
  return `<dl class="place-details">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function hourlyWeatherList(forecast: WeatherForecast, copy: typeof labels[Language]) {
  const hours = weatherSelectedDay ? hourlyForDay(forecast.hourly, weatherSelectedDay) : selectHourlyForecast(forecast.hourly, forecast.current.time, weatherHours);
  if (!hours.length) return `<p class="status">${copy.weatherNoLaterHourly}</p>`;
  return `<div class="hourly-strip" role="list" aria-label="${copy.weatherHourly}">${hours.slice(0, weatherHours).map((hour, index) => {
    const info = weatherCodeInfo(hour.weatherCode, copy);
    const current = index === 0 && !weatherSelectedDay ? ' current-hour' : '';
    return `<article class="hour-card${current}" role="listitem" aria-label="${info.label}">
      <strong>${formatWeatherTime(hour.time)}</strong><span class="weather-icon" aria-hidden="true">${info.icon}</span><span>${formatTemperature(hour.temperature, weatherUnits, copy.weatherValueUnavailable)}</span><small>${copy.weatherFeelsLike}: ${formatTemperature(hour.apparentTemperature, weatherUnits, copy.weatherValueUnavailable)}</small><small>${formatPercent(hour.precipitationProbability, copy)}</small><small>${formatWind(hour.windSpeed, weatherUnits, copy.weatherValueUnavailable)}</small>${hour.isDay ? `<small>${copy.weatherUv}: ${hour.uvIndex === null ? copy.weatherValueUnavailable : hour.uvIndex}</small>` : ''}
    </article>`;
  }).join('')}</div>`;
}

function dailyWeatherList(forecast: WeatherForecast, copy: typeof labels[Language]) {
  return `<div class="place-list">${forecast.daily.map((day) => {
    const info = weatherCodeInfo(day.weatherCode, copy);
    return `<article class="card weather-day ${weatherSelectedDay === day.date ? 'selected-weather-day' : ''}">
      <div class="card-top"><span>${formatWeatherTime(`${day.date}T12:00`, { weekday: 'short', month: 'short', day: 'numeric' })}</span><span class="badge verified">${info.icon} ${info.label}</span></div>
      <h3>${formatTemperature(day.temperatureMax, weatherUnits, copy.weatherValueUnavailable)} / ${formatTemperature(day.temperatureMin, weatherUnits, copy.weatherValueUnavailable)}</h3>
      <p>${copy.weatherFeelsLike}: ${formatTemperature(day.apparentMax, weatherUnits, copy.weatherValueUnavailable)} / ${formatTemperature(day.apparentMin, weatherUnits, copy.weatherValueUnavailable)} · ${formatPercent(day.precipitationProbabilityMax, copy)}</p>
      <p>${copy.weatherRainSnow}: ${formatPrecipitation(sumAvailable(day.rainSum, day.showersSum, day.snowfallSum), weatherUnits, copy.weatherValueUnavailable)} · ${copy.weatherWind}: ${formatWind(day.windSpeedMax, weatherUnits, copy.weatherValueUnavailable)} · ${copy.weatherGusts}: ${formatWind(day.windGustsMax, weatherUnits, copy.weatherValueUnavailable)} · ${copy.weatherUv}: ${day.uvIndexMax === null ? copy.weatherValueUnavailable : day.uvIndexMax}</p>
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
  const prayerCity = { ...city, coordinates: { lat: forecast.latitude, lng: forecast.longitude }, timezone: forecast.timezone || city.timezone };
  const prayerDate = weatherSelectedDay || forecast.daily[0]?.date || todayIso();
  const prayerTimes = calculatePrayerDisplay(prayerCity, prefs.prayerMethod, prayerDate, localeForLanguage(lang));
  const matches = matchPrayerWeather(prayerTimes, forecast.hourly).filter((item) => item.prayer !== 'Sunrise');
  if (!matches.length) return '';
  return `<section class="destination-box"><h2>${copy.weatherPrayer}</h2><div class="place-list">${matches.map((item) => {
    const point = item.forecast as WeatherPoint;
    const info = weatherCodeInfo(point.weatherCode, copy);
    return `<article class="card"><div class="card-top"><span>${item.prayer} · ${item.time}</span><span class="badge sample">${point.isDay ? copy.weatherDaylight : copy.weatherNight}</span></div><p>${info.icon} ${info.label} · ${formatTemperature(point.temperature, weatherUnits, copy.weatherValueUnavailable)} · ${formatPercent(point.precipitationProbability, copy)} · ${formatWind(point.windSpeed, weatherUnits, copy.weatherValueUnavailable)}</p></article>`;
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
  publicTransportMap?.remove();
  publicTransportMap = undefined;
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
        ${forecast ? `<section class="card weather-current" aria-label="${copy.weatherCurrent}"><div class="card-top"><span>${copy.weatherCurrent}</span><span class="badge ${forecast.cached ? 'unverified' : 'verified'}">${forecast.cached ? copy.weatherCached : copy.weatherUpdated}</span></div><h2>${formatTemperature(forecast.current.temperature, weatherUnits, copy.weatherValueUnavailable)}</h2>${weatherRows(forecast, copy)}</section><section><div class="result-header"><h2>${copy.weatherHourly}</h2><button type="button" class="ghost" id="toggle-weather-hours">${weatherHours === 24 ? copy.weatherExpand48 : copy.weatherShow24}</button></div>${hourlyWeatherList(forecast, copy)}</section><section><h2>${copy.weatherDaily}</h2>${dailyWeatherList(forecast, copy)}</section>${travelWeatherSection(forecast, copy)}${prayerWeatherSection(forecast, copy)}` : `<div class="empty-actions"><button type="button" id="retry-weather" class="ghost">${copy.weatherRetry}</button><button type="button" id="another-weather-city">${copy.weatherSearchAnother}</button></div>`}
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
  return ['timeout', 'rate-limited', 'temporary'].includes(classifyRequestError(error).kind);
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
  return { latitude: city.coordinates.lat, longitude: city.coordinates.lng, label: `${city.city}, ${city.country}`, timezone: city.timezone };
}

async function attractionJson<T>(url: string, stage: string, milliseconds = 7000, signal?: AbortSignal) {
  try {
    return await retryOnceForTemporary(() => requestJson<T>(url, { headers: { Accept: 'application/json' }, signal }, milliseconds), signal);
  } catch (error) {
    recordAttractionDiagnostic(stage, error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}

async function requestAttractionBatch(batch: AttractionQueryBatch, signal?: AbortSignal) {
  let lastError: unknown;
  const endpoints = overpassEndpoints();
  for (const endpoint of endpoints) {
    try {
      return await requestOverpass(endpoint, { ...overpassPostOptions(batch.query), signal }, 9000);
    } catch (error) {
      lastError = error;
      recordAttractionDiagnostic(`Overpass ${batch.label} via ${new URL(endpoint).hostname}`, error);
      if (!isTemporaryOverpassError(error)) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function commonsPhotoFromFilename(filename: string, signal?: AbortSignal) {
  if (!filename) return undefined;
  const data = await attractionJson<unknown>(commonsImageInfoUrl(filename), `Commons imageinfo ${filename}`, 7000, signal);
  return normalizeCommonsImage(data);
}

async function commonsPhotoFromCategory(category: string, attraction: Attraction, extraNames: string[], signal?: AbortSignal) {
  if (!category) return undefined;
  const data = await attractionJson<unknown>(commonsCategoryImagesUrl(category), `Commons category ${category}`, 7000, signal);
  return selectHighConfidenceCommonsImage(data, attraction, extraNames) ?? firstLicensedCommonsImage(data);
}

async function wikipediaAttractionSummary(title: string, language = 'en', signal?: AbortSignal) {
  if (!title) return { wikipediaExtract: '', photo: undefined as AttractionPhoto | undefined, wikidata: '', englishTitle: '' };
  const summary = await attractionJson<{ extract?: string; wikibase_item?: string; lang?: string; title?: string; originalimage?: { source?: string }; thumbnail?: { source?: string } }>(wikipediaSummaryUrlFor(language, title), `Wikipedia summary ${language}:${title}`, 7000, signal);
  const imageUrl = summary.originalimage?.source ?? summary.thumbnail?.source ?? '';
  const filename = commonsFilenameFromImageUrl(imageUrl);
  let photo: AttractionPhoto | undefined;
  if (filename) photo = await commonsPhotoFromFilename(filename, signal);
  const wikipediaExtract = language === 'en' ? summary.extract ?? '' : '';
  return { wikipediaExtract, photo, wikidata: summary.wikibase_item ?? '', englishTitle: language === 'en' ? summary.title ?? title : '' };
}

function attractionEnrichmentKey(attraction: Attraction) {
  return attraction.wikidata || attraction.wikipediaRaw || attraction.commons || attraction.sourceUrl;
}

async function resolveAttractionPhotoAndHistory(attraction: Attraction, cityName: string, signal?: AbortSignal) {
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
      photo = await commonsPhotoFromFilename(commonsFilename, signal);
    } catch {
      photo = undefined;
    }
  }
  if (!photo && commonsCategory) {
    try {
      photo = await commonsPhotoFromCategory(commonsCategory, attraction, extraNames, signal);
    } catch {
      photo = undefined;
    }
  }
  let wikidataId = attraction.wikidata;
  if (!wikidataId && attraction.wikipediaRaw) {
    try {
      const parsed = parseWikipediaTag(attraction.wikipediaRaw);
      const summary = await wikipediaAttractionSummary(parsed.title, parsed.language, signal);
      wikidataId = summary.wikidata;
      if (!photo) photo = summary.photo;
    } catch {
      wikidataId = '';
    }
  }
  if (wikidataId) {
    try {
      const entity = await attractionJson<unknown>(wikidataEntityUrl(wikidataId), `Wikidata entity ${wikidataId}`, 7000, signal);
      wikidataDescription = wikidataEnglishDescription(entity, wikidataId);
      extraNames.push(wikidataEnglishLabel(entity, wikidataId), wikidataEnglishTitle(entity, wikidataId), ...wikidataEnglishAliases(entity, wikidataId));
      const p18 = wikidataP18Filename(entity, wikidataId);
      if (!photo && p18) photo = await commonsPhotoFromFilename(p18, signal);
      if (!wikipediaExtract) {
        const englishTitle = wikidataEnglishTitle(entity, wikidataId);
        if (englishTitle) {
          const summary = await wikipediaAttractionSummary(englishTitle, 'en', signal);
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
      const summary = await wikipediaAttractionSummary(attraction.wikipedia, 'en', signal);
      wikipediaExtract = summary.wikipediaExtract;
      if (!photo) photo = summary.photo;
    } catch {
      wikipediaExtract = '';
    }
  }
  if (!photo) {
    try {
      const countryName = attractionCenter?.label?.split(',').slice(1).join(',').trim() ?? selectedCity().country;
      const search = await attractionJson<unknown>(commonsSearchUrl(attraction, cityName, countryName), `Commons exact-name search ${attraction.name}`, 7000, signal);
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
  attractionEnrichmentAbortController = nextAbortController(attractionEnrichmentAbortController);
  const abortSignal = attractionEnrichmentAbortController.signal;
  const candidates = attractionResults.filter((attraction) => attraction.photoStatus !== 'checked' && attraction.photoStatus !== 'error');
  if (!candidates.length) return;
  const activeCacheKey = attractionCacheKey;
  attractionResults = attractionResults.map((attraction) => candidates.some((candidate) => candidate.id === attraction.id) ? { ...attraction, photoStatus: 'loading' } : attraction);
  attractionStatus = 'photos';
  attractionsPage();
  const cityName = attractionCenter?.label?.split(',')[0] ?? selectedCity().city;
  const batchSize = 3;
  for (let index = 0; index < candidates.length; index += batchSize) {
    if (sequence !== attractionEnrichmentSequence) return;
    const batch = candidates.slice(index, index + batchSize);
    const updates = await Promise.all(batch.map(async (attraction) => {
      try {
        const current = attractionResults.find((candidate) => candidate.id === attraction.id) ?? attraction;
        return await resolveAttractionPhotoAndHistory(current, cityName, abortSignal);
      } catch (error) {
        recordAttractionDiagnostic(`Attraction enrichment ${attraction.name}`, error);
        return { ...attraction, photoStatus: 'error' as const };
      }
    }));
    if (sequence !== attractionEnrichmentSequence || activeCacheKey !== attractionCacheKey || abortSignal.aborted) return;
    const updateMap = new Map(updates.map((attraction) => [attraction.id, attraction]));
    attractionResults = attractionResults.map((candidate) => updateMap.get(candidate.id) ?? candidate);
    if (activeCacheKey) attractionCache.set(activeCacheKey, { expires: Date.now() + 10 * 60 * 1000, results: attractionResults });
    attractionsPage();
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
  if (sequence === attractionEnrichmentSequence && attractionStatus === 'photos') {
    attractionStatus = 'ready';
    attractionsPage();
  }
}

async function searchAttractions(center: PrayerCenter) {
  const sequence = ++attractionSearchSequence;
  attractionAbortController = nextAbortController(attractionAbortController);
  const abortSignal = attractionAbortController.signal;
  const searchCenter = { ...center };
  const searchRadius = attractionRadiusKm;
  const isCurrentAttractionSearch = () => sequence === attractionSearchSequence;
  attractionEnrichmentSequence += 1;
  attractionCenter = searchCenter;
  attractionMapMoved = false;
  const cacheKey = `${searchCenter.latitude.toFixed(4)},${searchCenter.longitude.toFixed(4)},${searchRadius}`;
  attractionCacheKey = cacheKey;
  const cached = attractionCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    if (!isCurrentAttractionSearch()) return;
    attractionResults = refreshOpenState(cached.results, searchCenter.timezone);
    attractionStatus = attractionResults.length ? 'cached' : 'empty';
    attractionsPage();
    if (attractionResults.some((attraction) => attraction.photoStatus !== 'checked' && attraction.photoStatus !== 'error')) {
      void progressiveAttractionEnrichment(++attractionEnrichmentSequence);
    }
    return;
  }
  attractionResults = [];
  attractionStatus = 'searching';
  attractionError = '';
  attractionDiagnostics = [];
  attractionsPage();
  const watchdog = window.setTimeout(() => {
    if (sequence !== attractionSearchSequence || attractionStatus !== 'searching') return;
    attractionAbortController?.abort(new RequestError('timeout', 'Request timed out'));
    attractionStatus = 'timeout';
    attractionError = labels[lang].attractionsTimedOut;
    attractionsPage();
  }, 14000);
  try {
    const batches = buildAttractionOverpassBatches(searchCenter.latitude, searchCenter.longitude, searchRadius);
    let successfulBatches = 0;
    let lastError: unknown;
    for (const batch of batches) {
      if (!isCurrentAttractionSearch()) return;
      if (attractionResults.length >= 180 && successfulBatches >= 3) break;
      try {
        const data = await requestAttractionBatch(batch, abortSignal);
        if (!isCurrentAttractionSearch()) return;
        successfulBatches += 1;
        const normalized = (data.elements ?? [])
          .map((element) => normalizeAttraction(element, searchCenter))
          .filter((attraction): attraction is Attraction => Boolean(attraction))
          .filter((attraction) => attraction.distanceKm <= searchRadius)
          .map((attraction) => enrichAttraction(attraction, { osmDescription: attraction.osmDescription }));
        if (!isCurrentAttractionSearch()) return;
        attractionResults = dedupeAttractions([...attractionResults, ...normalized]).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 250);
        attractionStatus = attractionResults.length ? 'ready' : 'searching';
        attractionCache.set(cacheKey, { expires: Date.now() + 10 * 60 * 1000, results: attractionResults });
        attractionsPage();
      } catch (error) {
        lastError = error;
      }
    }
    if (!isCurrentAttractionSearch()) return;
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
    if (!isCurrentAttractionSearch()) return;
    if (classifyRequestError(error).kind === 'aborted') return;
    if (cached) {
      attractionResults = refreshOpenState(cached.results, searchCenter.timezone);
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
  const sequence = ++attractionSearchSequence;
  attractionEnrichmentSequence += 1;
  if (!isAppGeolocationAvailable()) {
    if (sequence !== attractionSearchSequence) return;
    attractionStatus = 'unavailable';
    attractionsPage();
    return;
  }
  attractionStatus = 'requesting';
  attractionsPage();
  requestCurrentAppPosition(
    (position) => {
      if (sequence !== attractionSearchSequence) return;
      void searchAttractions({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: labels[lang].qiblaLocation });
    },
    (error) => {
      if (sequence !== attractionSearchSequence) return;
      attractionStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable';
      attractionsPage();
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
  );
}

async function searchAttractionDestination() {
  const query = attractionManualQuery.trim();
  if (!query) return;
  const sequence = ++attractionSearchSequence;
  const isCurrentAttractionSearch = () => sequence === attractionSearchSequence;
  attractionEnrichmentSequence += 1;
  const city = cities.find((candidate) => candidate.city.toLowerCase() === query.toLowerCase());
  if (city) {
    if (!isCurrentAttractionSearch()) return;
    await searchAttractions(destinationAttractionCenter(city));
    return;
  }
  attractionStatus = 'searching';
  attractionsPage();
  const center = await resolveRestaurantDestination(query);
  if (!isCurrentAttractionSearch()) return;
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
    [copy.prayerAddress, esc(attraction.address)],
    [copy.prayerOpeningHours, esc(attraction.openingHours)],
    [copy.halalOpen, openingStatusLabel(attraction.openState, copy)],
    [copy.prayerWebsite, attraction.website ? `<a href="${esc(attraction.website)}" target="_blank" rel="noopener noreferrer">${esc(attraction.website)}</a>` : ''],
    [copy.prayerTelephone, esc(attraction.phone)],
    [copy.toiletsWheelchair, attraction.wheelchair === 'yes' ? copy.toiletsWheelchair : attraction.wheelchair === 'limited' ? copy.toiletsWheelchairLimited : ''],
    [copy.attractionsAdmission, attraction.fee === 'free' ? copy.toiletsFree : attraction.fee === 'paid' ? copy.toiletsPaid : ''],
    [copy.attractionsInfoSource, esc(attraction.historySource)],
  ].filter(([, value]) => Boolean(value));
  return `<dl class="place-details">${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function attractionCard(attraction: Attraction, copy: typeof labels[Language]) {
  const reportPlace: ReportablePlace = { feature: copy.attractionsTitle, name: attraction.name, sourceUrl: attraction.sourceUrl, latitude: attraction.latitude, longitude: attraction.longitude, city: selectedCity().city, country: selectedCity().country };
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
      ${reportActionMarkup(reportPlace)}
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
  publicTransportMap?.remove();
  publicTransportMap = undefined;
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
  bindReportButtons();
  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => { lang = (event.target as HTMLSelectElement).value as Language; attractionsPage(); });
  document.querySelector<HTMLButtonElement>('#back-from-attractions')?.addEventListener('click', () => { view = 'planner'; attractionAbortController?.abort(); attractionEnrichmentAbortController?.abort(); attractionsMap?.remove(); attractionsMap = undefined; if (window.location.hash) history.pushState(null, '', window.location.pathname + window.location.search); render(); });
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
  document.querySelector<HTMLButtonElement>('#attractions-search-this-area')?.addEventListener('click', () => { const center = attractionsMap?.getCenter?.(); if (!center) return; debouncedAttractionSearch({ latitude: center.lat, longitude: center.lng, label: labels[lang].toiletsSearchThisArea, timezone: attractionCenter?.timezone }); });
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

function activeSavedTrip() {
  return savedTrips.find((trip) => trip.id === openedSavedTripId);
}

function hasUnsavedTripChanges() {
  const trip = activeSavedTrip();
  if (!trip || !generatedPrefs || !generatedItems.length) return Boolean(generatedPrefs && generatedItems.length && !openedSavedTripId);
  return JSON.stringify(trip.preferences) !== JSON.stringify(generatedPrefs)
    || JSON.stringify(trip.itinerary) !== JSON.stringify(generatedItems)
    || JSON.stringify(trip.travelDetails) !== JSON.stringify(currentTravelDetails)
    || trip.name !== sanitizeTripName(savedTripNameDraft || trip.name);
}

function refreshSavedTrips() {
  loadSavedTripsFromStorage();
  if (openedSavedTripId && !activeSavedTrip()) {
    openedSavedTripId = '';
    savedTripNameDraft = '';
    savedTripStatus = 'deleted';
  }
}

function saveCurrentTrip(copy: typeof labels[Language]) {
  if (!generatedPrefs || !generatedItems.length) return;
  const city = cityForPreferences(generatedPrefs);
  if (!city) {
    savedTripStatus = 'failed';
    savedTripMessage = copy.invalidCity;
    render();
    return;
  }
  const existing = activeSavedTrip();
  const now = new Date().toISOString();
  const name = sanitizeTripName(savedTripNameDraft || existing?.name || defaultTripName(city, generatedPrefs.startDate, generatedPrefs.endDate));
  try {
    const trip = createSavedTrip({ id: existing?.id, name, language: lang, preferences: generatedPrefs, city, itinerary: generatedItems, travelDetails: currentTravelDetails, now });
    const savedTrip = existing ? { ...trip, createdAt: existing.createdAt } : trip;
    savedTrips = savedTripRepository.upsert(savedTrip);
    openedSavedTripId = savedTrip.id;
    savedTripNameDraft = savedTrip.name;
    savedTripStatus = 'saved';
    savedTripMessage = copy.savedLocally;
    plannerAnnouncement = copy.savedLocally;
  } catch {
    savedTripStatus = 'failed';
    savedTripMessage = copy.saveFailed;
  }
  render();
}

function openSavedTrip(trip: SavedTrip) {
  prefs = { ...trip.preferences, interests: [...trip.preferences.interests] };
  generatedPrefs = { ...trip.preferences, interests: [...trip.preferences.interests] };
  generatedItems = trip.itinerary.map((item) => ({ ...item }));
  currentTravelDetails = validateTravelDetailsSnapshot(trip.travelDetails);
  travelDetailEditor = null;
  openedSavedTripId = trip.id;
  savedTripNameDraft = trip.name;
  savedTripStatus = 'saved';
  savedTripMessage = labels[lang].savedLocally;
  selectedRegion = '';
  plannerValidation = '';
  plannerAnnouncement = labels[lang].savedLocally;
  view = 'planner';
  if (window.location.hash) history.pushState(null, '', window.location.pathname + window.location.search);
  render();
}

function savedTripCard(trip: SavedTrip, copy: typeof labels[Language]) {
  const dateRange = trip.dateRange.startDate === trip.dateRange.endDate ? trip.dateRange.startDate : `${trip.dateRange.startDate} - ${trip.dateRange.endDate}`;
  return `<article class="card saved-trip-card">
    <div class="card-top"><h3>${esc(trip.name)}</h3><span>${esc(trip.destination.city)}, ${esc(trip.destination.country)}</span></div>
    <p>${copy.tripDates}: ${esc(dateRange)} · ${copy.tripDays}: ${itineraryDayKeys(trip.dateRange.startDate, trip.dateRange.endDate).length}</p>
    <p>${copy.savedAt}: ${new Intl.DateTimeFormat(localeForLanguage(lang), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(trip.savedAt))}</p>
    <p>${copy.savedLocally}. ${copy.noCloudSync}.</p>
    <div class="toolbar">
      <button type="button" data-open-trip="${esc(trip.id)}">${copy.reopenTrip}</button>
      <button type="button" class="ghost" data-share-trip="${esc(trip.id)}">${copy.shareTrip}</button>
      <button type="button" class="ghost" data-copy-trip="${esc(trip.id)}">${copy.copyItinerary}</button>
      <button type="button" class="ghost" data-export-trip="${esc(trip.id)}">${copy.exportCalendar}</button>
      <button type="button" class="ghost" data-rename-trip="${esc(trip.id)}">${copy.renameTrip}</button>
      <button type="button" class="ghost" data-duplicate-trip="${esc(trip.id)}">${copy.duplicateTrip}</button>
      <button type="button" class="ghost" data-delete-trip="${esc(trip.id)}">${copy.deleteTrip}</button>
    </div>
  </article>`;
}

function savedTripsPage() {
  if (!root) return;
  const copy = labels[lang];
  const dir = languageDirection(lang);
  refreshSavedTrips();
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  root.innerHTML = `<main dir="${dir}" class="app saved-trips-app">
    <section class="hero">
      ${languageSelector()}
      <h1>${copy.savedTripsTitle}</h1>
      <p>${copy.savedTripsSubtitle}</p>
      ${connectionStatusMarkup(copy)}
      <p class="notice">${copy.savedLocally}. ${copy.noCloudSync}.</p>
      <button type="button" class="ghost hero-action" id="back-from-saved-trips">${copy.savedTripsBack}</button>
    </section>
    <section class="panel results" aria-live="polite">
      ${savedTripsCorrupted ? `<p class="error">${copy.storageRecovered}</p>` : ''}
      <p class="status" id="trip-share-status" role="status" aria-live="polite">${esc(tripShareStatus)}</p>
      ${savedTrips.length ? savedTrips.map((trip) => savedTripCard(trip, copy)).join('') : `<p class="notice">${copy.savedTripsEmpty}</p>`}
    </section>
    ${appFooterMarkup(copy)}
  </main>`;
  bindSavedTripsPage();
}

function plannerValidationMessage(planPrefs: PlannerPreferences, copy: typeof labels[Language]) {
  if (!cityForPreferences(planPrefs)) return copy.invalidCity;
  if (!Number.isFinite(planPrefs.groupSize) || planPrefs.groupSize < 1) return copy.invalidGroupSize;
  if (planPrefs.startDate && planPrefs.endDate && planPrefs.endDate < planPrefs.startDate) return copy.invalidEndDate;
  const tripDays = itineraryDayKeys(planPrefs.startDate, planPrefs.endDate).length;
  if (tripDays > 14) return copy.invalidTripTooLong;
  if (planPrefs.startDate && planPrefs.endDate && planPrefs.startDate === planPrefs.endDate && planPrefs.endHour < planPrefs.startHour) return copy.invalidEndTime;
  return '';
}

function itineraryDayKeys(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const dates: string[] = [];
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    dates.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
  }
  return dates;
}

function minutesOfDay(time: string) {
  const match = /(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return Number.NaN;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (/\bPM\b/i.test(time) && hour < 12) hour += 12;
  if (/\bAM\b/i.test(time) && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function formatItineraryDayHeading(date: string, dayIndex: number, copy: typeof labels[Language]) {
  const locale = lang === 'en' ? 'en-GB' : localeForLanguage(lang);
  const formatted = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
  return `${copy.dayHeading} ${dayIndex + 1} — ${formatted}`;
}

function groupItineraryItems(items: ItineraryItem[]) {
  const groups = new Map<string, ItineraryItem[]>();
  items.forEach((item) => groups.set(item.date, [...(groups.get(item.date) ?? []), item]));
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, dayItems]) => [date, dayItems.sort((a, b) => minutesOfDay(a.time) - minutesOfDay(b.time))] as [string, ItineraryItem[]]);
}

function itineraryCard(item: ItineraryItem, index: number, city: (typeof cities)[number], copy: typeof labels[Language]) {
  const endTime = addMinutes(item.time, item.durationMinutes);
  const facility = item.place?.facility ? `<p class="muted">${copy.women}: ${plannerFacilityStatus(item.place.facility.womenPrayerSpace, copy)} · ${copy.wudu}: ${plannerFacilityStatus(item.place.facility.wudu, copy)} · ${copy.accessibility}: ${plannerFacilityStatus(item.place.facility.accessibility, copy)}</p>` : '';
  const map = item.place ? `<a class="map-link" href="${osmSearchUrl(item.place.name, city.city, city.country)}" target="_blank" rel="noopener noreferrer">${copy.findOnMap}</a>` : '';
  return `<article class="card itinerary-card ${item.kind}"><div class="card-top"><span>${esc(item.time)}-${esc(endTime)} · ${item.durationMinutes} ${copy.minutesShort}</span><span>${esc(item.kind)}</span></div><h3>${esc(stripInternalPlannerText(item.title))}</h3><p>${esc(stripInternalPlannerText(item.details))}</p>${facility}<div class="itinerary-actions">${map}<button class="ghost" data-replan="${index + 1}">${copy.replan}</button></div></article>`;
}

function itineraryGroupsMarkup(items: ItineraryItem[], city: (typeof cities)[number], copy: typeof labels[Language]) {
  let itemIndex = 0;
  return groupItineraryItems(items).map(([date, dayItems], dayIndex) => `<section class="itinerary-day"><h3>${formatItineraryDayHeading(date, dayIndex, copy)}</h3>${dayItems.map((item) => itineraryCard(item, itemIndex++, city, copy)).join('')}</section>`).join('');
}

function travelDetailTypeLabel(type: TravelDetailType, copy: typeof labels[Language]) {
  return ({ flight: copy.travelDetailFlight, accommodation: copy.travelDetailAccommodation, reservation: copy.travelDetailReservation, contact: copy.travelDetailContact })[type];
}

function travelDetailTitle(entry: TravelDetailEntry) {
  if (entry.type === 'flight') return [entry.airline, entry.flightNumber, `${entry.departureAirport} → ${entry.arrivalAirport}`].filter(Boolean).join(' ');
  if (entry.type === 'accommodation') return entry.propertyName;
  if (entry.type === 'reservation') return entry.title;
  return entry.name;
}

function travelDetailLines(entry: TravelDetailEntry, copy: typeof labels[Language]) {
  const lines: string[] = [];
  if (entry.type === 'flight') {
    lines.push(`${copy.travelDepartureDateTime}: ${entry.departureDateTime} ${entry.departureTimeZone || ''}`.trim());
    lines.push(`${copy.travelArrivalDateTime}: ${entry.arrivalDateTime} ${entry.arrivalTimeZone || ''}`.trim());
  } else if (entry.type === 'accommodation') {
    lines.push(`${copy.travelCheckIn}: ${entry.checkInDateTime} ${entry.timeZone || ''}`.trim());
    lines.push(`${copy.travelCheckOut}: ${entry.checkOutDateTime} ${entry.timeZone || ''}`.trim());
    if (entry.address) lines.push(`${copy.travelAddress}: ${entry.address}`);
    if (entry.phone) lines.push(`${copy.travelPhone}: ${entry.phone}`);
  } else if (entry.type === 'reservation') {
    lines.push(`${copy.travelStartDateTime}: ${entry.startDateTime} ${entry.timeZone || ''}`.trim());
    if (entry.endDateTime) lines.push(`${copy.travelEndDateTime}: ${entry.endDateTime} ${entry.timeZone || ''}`.trim());
    if (entry.provider) lines.push(`${copy.travelProvider}: ${entry.provider}`);
    if (entry.meetingPoint) lines.push(`${copy.travelMeetingPoint}: ${entry.meetingPoint}`);
    if (entry.phone) lines.push(`${copy.travelPhone}: ${entry.phone}`);
  } else {
    if (entry.role) lines.push(`${copy.travelRole}: ${entry.role}`);
    if (entry.phone) lines.push(`${copy.travelPhone}: ${entry.phone}`);
    if (entry.website) lines.push(`${copy.travelWebsite}: ${entry.website}`);
  }
  if ('notes' in entry && entry.notes) lines.push(`${copy.travelNotes}: ${entry.notes}`);
  if ('bookingReference' in entry && entry.bookingReference) lines.push(copy.travelPrivateReference);
  return lines;
}

function travelDetailCard(entry: TravelDetailEntry, copy: typeof labels[Language]) {
  const website = entry.type === 'contact' && entry.website ? `<a class="map-link" href="${esc(entry.website)}" target="_blank" rel="noopener noreferrer">${copy.travelWebsite}</a>` : '';
  return `<article class="card travel-detail-card">
    <div class="card-top"><span class="badge">${travelDetailTypeLabel(entry.type, copy)}</span><span>${esc(entry.type === 'contact' ? copy.travelStoredOnly : '')}</span></div>
    <h4>${esc(travelDetailTitle(entry))}</h4>
    ${travelDetailLines(entry, copy).map((line) => `<p>${esc(line)}</p>`).join('')}
    <div class="toolbar travel-detail-actions">
      ${website}
      <button type="button" class="ghost" data-edit-travel-detail="${esc(entry.id)}">${copy.travelEdit}</button>
      <button type="button" class="ghost" data-delete-travel-detail="${esc(entry.id)}">${copy.travelDelete}</button>
    </div>
  </article>`;
}

function travelDetailField(name: string, label: string, value = '', type = 'text', required = false) {
  return `<label>${label}<input name="${name}" value="${esc(value)}" type="${type}" ${required ? 'required' : ''}/></label>`;
}

function travelDetailEditorMarkup(copy: typeof labels[Language], destinationTimeZone: string) {
  if (!travelDetailEditor) return '';
  const existing = travelDetailEditor.id ? currentTravelDetails.entries.find((entry) => entry.id === travelDetailEditor?.id) : undefined;
  const type = travelDetailEditor.type;
  const get = (key: string) => existing && key in existing ? String((existing as unknown as Record<string, string>)[key] ?? '') : '';
  const common = `<p class="muted">${copy.travelPrivateReference}</p>${travelDetailField('bookingReference', copy.travelBookingReference, get('bookingReference'))}${travelDetailField('notes', copy.travelNotes, get('notes'))}`;
  const fields = type === 'flight'
    ? `${travelDetailField('airline', copy.travelAirline, get('airline'))}${travelDetailField('flightNumber', copy.travelFlightNumber, get('flightNumber'))}${travelDetailField('departureAirport', copy.travelDepartureAirport, get('departureAirport'), 'text', true)}${travelDetailField('arrivalAirport', copy.travelArrivalAirport, get('arrivalAirport'), 'text', true)}${travelDetailField('departureDateTime', copy.travelDepartureDateTime, get('departureDateTime'), 'datetime-local', true)}${travelDetailField('arrivalDateTime', copy.travelArrivalDateTime, get('arrivalDateTime'), 'datetime-local', true)}${travelDetailField('departureTimeZone', copy.travelDepartureTimeZone, get('departureTimeZone') || destinationTimeZone)}${travelDetailField('arrivalTimeZone', copy.travelArrivalTimeZone, get('arrivalTimeZone') || destinationTimeZone)}${common}`
    : type === 'accommodation'
      ? `${travelDetailField('propertyName', copy.travelPropertyName, get('propertyName'), 'text', true)}${travelDetailField('address', copy.travelAddress, get('address'))}${travelDetailField('checkInDateTime', copy.travelCheckIn, get('checkInDateTime'), 'datetime-local', true)}${travelDetailField('checkOutDateTime', copy.travelCheckOut, get('checkOutDateTime'), 'datetime-local', true)}${travelDetailField('timeZone', copy.travelTimeZone, get('timeZone') || destinationTimeZone)}${travelDetailField('phone', copy.travelPhone, get('phone'))}${common}`
      : type === 'reservation'
        ? `${travelDetailField('title', copy.travelReservationTitle, get('title'), 'text', true)}${travelDetailField('provider', copy.travelProvider, get('provider'))}${travelDetailField('startDateTime', copy.travelStartDateTime, get('startDateTime'), 'datetime-local', true)}${travelDetailField('endDateTime', copy.travelEndDateTime, get('endDateTime'), 'datetime-local')}${travelDetailField('timeZone', copy.travelTimeZone, get('timeZone') || destinationTimeZone)}${travelDetailField('meetingPoint', copy.travelMeetingPoint, get('meetingPoint'))}${travelDetailField('phone', copy.travelPhone, get('phone'))}${common}`
        : `${travelDetailField('name', copy.travelProviderContactName, get('name'), 'text', true)}${travelDetailField('role', copy.travelRole, get('role'))}${travelDetailField('phone', copy.travelPhone, get('phone'))}${travelDetailField('website', copy.travelWebsite, get('website'))}${travelDetailField('notes', copy.travelNotes, get('notes'))}`;
  return `<form id="travel-detail-editor" class="travel-detail-editor card" aria-label="${copy.travelDetails}">
    <div class="card-top"><h4>${travelDetailEditor.mode === 'edit' ? copy.travelEdit : copy.travelAddDetail}: ${travelDetailTypeLabel(type, copy)}</h4><button type="button" class="ghost" id="cancel-travel-detail">${copy.travelCancel}</button></div>
    <input type="hidden" name="type" value="${type}" />
    ${travelDetailEditor.id ? `<input type="hidden" name="id" value="${esc(travelDetailEditor.id)}" />` : ''}
    <div class="grid">${fields}</div>
    ${travelDetailEditor.error ? `<p class="error">${esc(travelDetailEditor.error)}</p>` : ''}
    <div class="toolbar"><button type="submit">${copy.travelSave}</button><button type="button" class="ghost" id="cancel-travel-detail-2">${copy.travelCancel}</button></div>
  </form>`;
}

function travelDetailsSectionMarkup(copy: typeof labels[Language], destinationTimeZone: string) {
  const entries = sortTravelDetails(currentTravelDetails.entries);
  return `<section class="travel-details-section" id="travel-details-section">
    <div class="card travel-details-shell">
      <div class="card-top"><div><p class="eyebrow">${copy.travelOptional}</p><h3>${copy.travelDetails}</h3></div><button type="button" id="add-travel-detail">${copy.travelAddDetail}</button></div>
      <p class="muted">${copy.travelEmptyDescription}</p>
      <p class="muted"><a href="${staticPageUrl('privacy')}" target="_blank" rel="noopener noreferrer">${copy.privacyPolicy}</a> · <a href="${staticPageUrl('support')}" target="_blank" rel="noopener noreferrer">${copy.supportPage}</a></p>
      <ul class="travel-privacy-list">
        <li>${copy.travelStoredOnly}</li>
        <li>${copy.travelStorageNotEncrypted}</li>
        <li>${copy.travelClearingData}</li>
        <li>${copy.travelSensitiveWarning}</li>
      </ul>
      <div class="travel-detail-type-chooser" id="travel-detail-type-chooser" hidden>
        <label>${copy.travelChooseType}<select id="travel-detail-type"><option value="flight">${copy.travelDetailFlight}</option><option value="accommodation">${copy.travelDetailAccommodation}</option><option value="reservation">${copy.travelDetailReservation}</option><option value="contact">${copy.travelDetailContact}</option></select></label>
        <button type="button" class="ghost" id="start-travel-detail">${copy.travelAddDetail}</button>
      </div>
      ${travelDetailEditorMarkup(copy, destinationTimeZone)}
      <p class="status" id="travel-detail-status" role="status" aria-live="polite"></p>
      <div class="travel-detail-list">${entries.length ? entries.map((entry) => travelDetailCard(entry, copy)).join('') : `<p class="notice">${copy.travelNoDetails}</p>`}</div>
    </div>
  </section>`;
}

function tripHeaderMarkup(city: (typeof cities)[number], planPrefs: PlannerPreferences, items: ItineraryItem[], copy: typeof labels[Language]) {
  const days = itineraryDayKeys(planPrefs.startDate, planPrefs.endDate).length;
  const saved = openedSavedTripId && !hasUnsavedTripChanges();
  const unsaved = hasUnsavedTripChanges();
  const name = sanitizeTripName(savedTripNameDraft || defaultTripName(city, planPrefs.startDate, planPrefs.endDate));
  const dateRange = planPrefs.startDate === planPrefs.endDate ? planPrefs.startDate : `${planPrefs.startDate} - ${planPrefs.endDate}`;
  return `<div class="trip-header">
    <div>
      <p class="eyebrow">${copy.tripSummary}</p>
      <h2>${esc(city.city)}, ${esc(city.country)}</h2>
      <p>${copy.tripDates}: ${esc(dateRange)} · ${copy.tripDays}: ${days} · ${copy.tripGroup}: ${planPrefs.groupSize}</p>
      <p>${copy.tripStyle}: ${optionLabels.transportation[lang][planPrefs.transportation]} · ${optionLabels.budget[lang][planPrefs.budget]} · ${city.timezone}</p>
      <p>${copy.approximateQibla}: ${calculateQiblaBearing(city.coordinates.lat, city.coordinates.lng).toFixed(1)}°</p>
      <p class="muted">${copy.savedLocally}. ${copy.noCloudSync}. ${copy.offlineLimitNotice}</p>
      ${savedTripStatus === 'failed' ? `<p class="error" id="saved-trip-inline-status">${esc(savedTripMessage || copy.saveFailed)}</p>` : `<p class="status" id="saved-trip-inline-status">${saved ? copy.savedStatus : unsaved ? copy.unsavedChanges : copy.savedLocally}</p>`}
    </div>
    <div class="trip-actions">
      <label>${copy.tripName}<input id="trip-name" value="${esc(name)}" maxlength="80" /></label>
      <button type="button" id="save-trip">${openedSavedTripId ? copy.saveChanges : copy.saveTrip}</button>
      <button type="button" class="ghost" id="share-trip">${copy.shareTrip}</button>
      <button type="button" class="ghost" id="copy-itinerary">${copy.copyItinerary}</button>
      <button type="button" class="ghost" id="export-calendar">${copy.exportCalendar}</button>
      <button type="button" class="ghost" id="edit-plan">${copy.editPlan}</button>
      <button type="button" class="ghost" id="print-itinerary">${copy.printItinerary}</button>
    </div>
  </div><p class="status" id="trip-share-status" role="status" aria-live="polite">${esc(tripShareStatus)}</p>${items.length ? '' : `<p>${copy.emptyState}</p>`}`;
}

function snapshotFromSavedTrip(trip: SavedTrip): TripExportSnapshot {
  return {
    name: trip.name,
    city: {
      city: trip.destination.city,
      country: trip.destination.country,
      timezone: trip.destination.timezone,
      money: { localCurrencies: trip.essentials.localCurrencies, note: '' },
    },
    preferences: trip.preferences,
    itinerary: trip.itinerary,
    travelDetails: trip.travelDetails,
    language: lang,
  };
}

function currentTripSnapshot(): TripExportSnapshot | null {
  if (!generatedPrefs || !generatedItems.length) return null;
  const city = cityForPreferences(generatedPrefs);
  if (!city) return null;
  return {
    name: sanitizeTripName(savedTripNameDraft || defaultTripName(city, generatedPrefs.startDate, generatedPrefs.endDate)),
    city,
    preferences: generatedPrefs,
    itinerary: generatedItems,
    travelDetails: currentTravelDetails,
    language: lang,
  };
}

function setTripShareStatus(message: string) {
  tripShareStatus = message;
  const element = document.querySelector<HTMLElement>('#trip-share-status');
  if (element) element.textContent = message;
}

async function copyTripItinerary(snapshot: TripExportSnapshot) {
  try {
    await copyText(buildItineraryText(snapshot));
    setTripShareStatus(labels[lang].itineraryCopied);
  } catch {
    setTripShareStatus(labels[lang].reportCopyFailed);
  }
}

async function shareTrip(snapshot: TripExportSnapshot) {
  try {
    const outcome = await shareText(snapshot.name, buildItineraryText(snapshot));
    if (outcome === 'unavailable') setTripShareStatus(labels[lang].sharingUnavailable);
    if (outcome === 'cancelled') setTripShareStatus(labels[lang].shareCancelled);
  } catch {
    setTripShareStatus(labels[lang].unableToShare);
  }
}

async function exportTripCalendar(snapshot: TripExportSnapshot) {
  try {
    await exportTripCalendarFile(snapshot);
    setTripShareStatus(labels[lang].calendarDownloaded);
  } catch {
    setTripShareStatus(labels[lang].unableToShare);
  }
}

function bindTripExportButtons() {
  document.querySelector<HTMLButtonElement>('#share-trip')?.addEventListener('click', () => { const snapshot = currentTripSnapshot(); if (snapshot) void shareTrip(snapshot); });
  document.querySelector<HTMLButtonElement>('#copy-itinerary')?.addEventListener('click', () => { const snapshot = currentTripSnapshot(); if (snapshot) void copyTripItinerary(snapshot); });
  document.querySelector<HTMLButtonElement>('#export-calendar')?.addEventListener('click', () => { const snapshot = currentTripSnapshot(); if (snapshot) void exportTripCalendar(snapshot); });
}

function renderTravelDetailsOnly(focusSelector?: string) {
  if (!generatedPrefs) return;
  const city = cityForPreferences(generatedPrefs);
  const section = document.querySelector<HTMLElement>('#travel-details-section');
  if (!city || !section) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = travelDetailsSectionMarkup(labels[lang], city.timezone);
  const next = wrapper.firstElementChild;
  if (next) section.replaceWith(next);
  bindTravelDetailsSection();
  if (focusSelector) document.querySelector<HTMLElement>(focusSelector)?.focus();
}

function travelDetailErrorMessage(error: string, copy: typeof labels[Language]) {
  if (error === 'date') return copy.travelInvalidDate;
  if (error === 'range') return copy.travelEndAfterStart;
  if (error === 'timezone') return copy.travelInvalidTimeZone;
  if (error === 'website') return copy.travelInvalidWebsite;
  return copy.travelRequiredFields;
}

function readTravelDetailInput(form: HTMLFormElement): TravelDetailInput {
  const data = new FormData(form);
  const input: Record<string, string> = {};
  data.forEach((value, key) => { input[key] = String(value); });
  return input as TravelDetailInput;
}

function markTravelDetailsChanged(message: string) {
  savedTripStatus = openedSavedTripId ? 'unsaved' : savedTripStatus;
  const status = document.querySelector<HTMLElement>('#travel-detail-status');
  if (status) status.textContent = message;
  const savedStatus = document.querySelector<HTMLElement>('#saved-trip-inline-status');
  if (savedStatus && openedSavedTripId) savedStatus.textContent = labels[lang].unsavedChanges;
}

function bindTravelDetailsSection() {
  const copy = labels[lang];
  document.querySelector<HTMLButtonElement>('#add-travel-detail')?.addEventListener('click', () => {
    document.querySelector<HTMLElement>('#travel-detail-type-chooser')?.removeAttribute('hidden');
    document.querySelector<HTMLSelectElement>('#travel-detail-type')?.focus();
  });
  document.querySelector<HTMLButtonElement>('#start-travel-detail')?.addEventListener('click', () => {
    const type = (document.querySelector<HTMLSelectElement>('#travel-detail-type')?.value || 'flight') as TravelDetailType;
    travelDetailEditor = { mode: 'add', type, triggerId: 'add-travel-detail' };
    renderTravelDetailsOnly('#travel-detail-editor input:not([type="hidden"])');
  });
  const closeEditor = () => {
    const target = travelDetailEditor?.triggerId ? `#${travelDetailEditor.triggerId}` : '#add-travel-detail';
    travelDetailEditor = null;
    renderTravelDetailsOnly(target);
  };
  document.querySelector<HTMLButtonElement>('#cancel-travel-detail')?.addEventListener('click', closeEditor);
  document.querySelector<HTMLButtonElement>('#cancel-travel-detail-2')?.addEventListener('click', closeEditor);
  document.querySelector<HTMLFormElement>('#travel-detail-editor')?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeEditor();
  });
  document.querySelector<HTMLFormElement>('#travel-detail-editor')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!generatedPrefs) return;
    const city = cityForPreferences(generatedPrefs);
    const result = validateTravelDetailInput(readTravelDetailInput(event.currentTarget as HTMLFormElement), city?.timezone || 'UTC');
    if (!result.ok) {
      travelDetailEditor = { ...(travelDetailEditor ?? { mode: 'add', type: 'flight' }), error: travelDetailErrorMessage(result.error, copy) };
      renderTravelDetailsOnly('#travel-detail-editor');
      return;
    }
    const wasEdit = travelDetailEditor?.mode === 'edit';
    currentTravelDetails = upsertTravelDetail(currentTravelDetails, result.entry);
    travelDetailEditor = null;
    renderTravelDetailsOnly(`[data-edit-travel-detail="${result.entry.id}"]`);
    markTravelDetailsChanged(wasEdit ? copy.travelDetailUpdated : copy.travelDetailAdded);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-edit-travel-detail]').forEach((button) => button.addEventListener('click', () => {
    const entry = currentTravelDetails.entries.find((candidate) => candidate.id === button.dataset.editTravelDetail);
    if (!entry) return;
    button.id = button.id || `travel-edit-${entry.id}`;
    travelDetailEditor = { mode: 'edit', type: entry.type, id: entry.id, triggerId: button.id };
    renderTravelDetailsOnly('#travel-detail-editor input:not([type="hidden"])');
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-delete-travel-detail]').forEach((button) => button.addEventListener('click', () => {
    const entry = currentTravelDetails.entries.find((candidate) => candidate.id === button.dataset.deleteTravelDetail);
    if (!entry || !window.confirm(`${copy.travelDeleteConfirm} ${travelDetailTitle(entry)}?`)) return;
    currentTravelDetails = deleteTravelDetail(currentTravelDetails, entry.id);
    travelDetailEditor = null;
    renderTravelDetailsOnly('#add-travel-detail');
    markTravelDetailsChanged(copy.travelDetailDeleted);
  }));
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
  const sequence = ++rateRequestSequence;
  const requestFromCurrency = fromCurrency;
  const requestToCurrency = toCurrency;
  const isCurrentRateRequest = () => sequence === rateRequestSequence && requestFromCurrency === fromCurrency && requestToCurrency === toCurrency;
  if (fromCurrency === toCurrency) {
    historyRequestSequence += 1;
    rate = { base: requestFromCurrency, quote: requestToCurrency, rate: 1, date: new Date().toISOString().slice(0, 10), refreshedAt: new Date().toISOString(), cached: false };
    historySummary = null;
    moneyStatus = 'updated';
    render();
    return;
  }
  const key = cacheKeyForRate(requestFromCurrency, requestToCurrency);
  const cachedRaw = readJsonCache<PairRate>(localStorage, key, RATE_CACHE_MS);
  const cached = cachedRaw?.base === requestFromCurrency && cachedRaw.quote === requestToCurrency && typeof cachedRaw.rate === 'number' && Number.isFinite(cachedRaw.rate) && cachedRaw.rate > 0 ? cachedRaw : null;
  moneyStatus = 'loadingRate';
  moneyError = '';
  render();
  try {
    const loaded = validateRateResponse(await requestJson<unknown>(`${FRANKFURTER_BASE_URL}/rate/${requestFromCurrency}/${requestToCurrency}`, { headers: { Accept: 'application/json' } }, 7000), requestFromCurrency, requestToCurrency);
    if (!isCurrentRateRequest()) return;
    rate = loaded;
    writeJsonCache(localStorage, key, rate);
    moneyStatus = 'updated';
    void loadHistory(requestFromCurrency, requestToCurrency);
  } catch (error) {
    if (!isCurrentRateRequest()) return;
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
  if (!isCurrentRateRequest()) return;
  render();
}

async function loadHistory(historyFromCurrency = fromCurrency, historyToCurrency = toCurrency) {
  const sequence = ++historyRequestSequence;
  const requestHistoryDays = historyDays;
  const isCurrentHistoryRequest = () => sequence === historyRequestSequence && historyFromCurrency === fromCurrency && historyToCurrency === toCurrency && requestHistoryDays === historyDays;
  if (historyFromCurrency === historyToCurrency) {
    if (!isCurrentHistoryRequest()) return;
    historySummary = null;
    return;
  }
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - requestHistoryDays);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const startIso = iso(start);
  const endIso = iso(end);
  const cacheKey = cacheKeyForHistory(historyFromCurrency, historyToCurrency, requestHistoryDays, startIso, endIso);
  const cached = readJsonCache<ReturnType<typeof historyStats>>(localStorage, cacheKey, RATE_CACHE_MS);
  if (cached) {
    historySummary = cached;
    render();
  }
  try {
    const body = await requestJson<Array<{ date: string; base: string; quote: string; rate: number }>>(`${FRANKFURTER_BASE_URL}/rates?from=${startIso}&to=${endIso}&base=${historyFromCurrency}&quotes=${historyToCurrency}`, { headers: { Accept: 'application/json' } }, 7000);
    if (!isCurrentHistoryRequest()) return;
    historySummary = historyStats(body, historyToCurrency, historyFromCurrency);
    writeJsonCache(localStorage, cacheKey, historySummary);
  } catch {
    if (!isCurrentHistoryRequest()) return;
    historySummary = cached ?? null;
  }
  if (!isCurrentHistoryRequest()) return;
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

function moneyConversionMarkup(copy: typeof labels[Language]) {
  const from = currencyByCode(fromCurrency);
  const to = currencyByCode(toCurrency);
  const parsed = parseAmountInput(amountInput, lang);
  const result = parsed.value !== null && rate ? convertAmount(parsed.value, rate.rate) : null;
  return `
    <span>${from.flag} ${from.code} ${from.name[lang]} · ${from.symbol}</span>
    <h2 id="money-conversion-heading">${result ? `${formatCurrencyAmount(result.amount, fromCurrency, lang)} = ${formatCurrencyAmount(result.converted, toCurrency, lang)}` : copy.loadingRate}</h2>
    <span>${to.flag} ${to.code} ${to.name[lang]} · ${to.symbol}</span>`;
}

function currencySelectOptions() {
  const searchable = searchCurrencies(currencies, currencySearch);
  const fromOptions = searchable.filter((currency) => currency.code !== fromCurrency).map((currency) => `<option value="${currency.code}">${currencyOption(currency)}</option>`).join('');
  const toOptions = searchable.filter((currency) => currency.code !== toCurrency).map((currency) => `<option value="${currency.code}">${currencyOption(currency)}</option>`).join('');
  return { from: `<option value="${fromCurrency}">${currencyOption(currencyByCode(fromCurrency))}</option>${fromOptions}`, to: `<option value="${toCurrency}">${currencyOption(currencyByCode(toCurrency))}</option>${toOptions}` };
}

function updateMoneyDynamicSections() {
  const copy = labels[lang];
  const parsed = parseAmountInput(amountInput, lang);
  if (parsed.error && parsed.error !== 'empty') {
    moneyStatus = 'invalidAmount';
  } else if (moneyStatus === 'invalidAmount' || moneyStatus === 'copied') {
    moneyStatus = rate ? 'updated' : 'idle';
  }
  const status = document.querySelector<HTMLElement>('#money-status');
  if (status) status.textContent = `${moneyStatusText(copy)}${fromCurrency === toCurrency ? ` ${copy.sameCurrency}` : ''}`;
  const invalid = document.querySelector<HTMLElement>('#money-invalid');
  if (invalid) invalid.hidden = !(parsed.error && parsed.error !== 'empty');
  const conversion = document.querySelector<HTMLElement>('#money-conversion-result');
  if (conversion) conversion.innerHTML = moneyConversionMarkup(copy);
  const copyButton = document.querySelector<HTMLButtonElement>('#copy-result');
  if (copyButton) copyButton.disabled = parsed.value === null || !rate;
}

function updateCurrencyOptionLists() {
  const { from, to } = currencySelectOptions();
  const fromSelect = document.querySelector<HTMLSelectElement>('#from-currency');
  if (fromSelect) {
    fromSelect.innerHTML = from;
    fromSelect.value = fromCurrency;
  }
  const toSelect = document.querySelector<HTMLSelectElement>('#to-currency');
  if (toSelect) {
    toSelect.innerHTML = to;
    toSelect.value = toCurrency;
  }
}

function moneyPage() {
  if (!root) return;
  cityMap?.remove();
  cityMap = undefined;
  prayerMap?.remove();
  prayerMap = undefined;
  publicTransportMap?.remove();
  publicTransportMap = undefined;
  const copy = labels[lang];
  const dir = languageDirection(lang);
  const city = selectedCity();
  const local = city.money.localCurrencies[0];
  const parsed = parseAmountInput(amountInput, lang);
  const sameCurrency = fromCurrency === toCurrency;
  const popularButtons = popularCurrencyCodes.map((code) => `<button class="chip" type="button" data-quick="${code}">${code}</button>`).join('');
  const options = currencySelectOptions();
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
          <label>${copy.fromCurrency}<select id="from-currency">${options.from}</select></label>
          <label>${copy.toCurrency}<select id="to-currency">${options.to}</select></label>
        </div>
        <label>${copy.searchCurrency}<input id="currency-search" value="${esc(currencySearch)}" /></label>
        <div class="chips" aria-label="${copy.popularCurrencies}">${popularButtons}</div>
        <div class="toolbar">
          <button type="button" id="swap-currencies" aria-label="${copy.swapCurrencies}">⇄</button>
          <button type="button" class="ghost" id="clear-money">${copy.clear}</button>
          <button type="button" class="ghost" id="refresh-rate">${copy.refreshRates}</button>
          <button type="button" class="ghost" id="copy-result" ${parsed.value === null || !rate ? 'disabled' : ''}>${copy.copyResult}</button>
        </div>
        <p id="money-status" class="status" aria-live="polite">${moneyStatusText(copy)}${sameCurrency ? ` ${copy.sameCurrency}` : ''}</p>
        <p id="money-invalid" class="error" ${parsed.error && parsed.error !== 'empty' ? '' : 'hidden'}>${copy.invalidAmount}</p>
      </section>
      <section class="panel results" aria-live="polite">
        <article class="card">
          <div class="conversion-result" id="money-conversion-result">${moneyConversionMarkup(copy)}</div>
          ${rate ? `<p>${copy.pairRate}: 1 ${fromCurrency} = ${formatPlainNumber(rate.rate, lang)} ${toCurrency}</p><p>${copy.reversePairRate}: 1 ${toCurrency} = ${formatPlainNumber(1 / rate.rate, lang)} ${fromCurrency}</p><p>${copy.rateDate}: ${rate.date}${rate.cached ? ` · ${copy.cachedRate}` : ''}</p><p>${copy.lastRefreshed}: ${new Intl.DateTimeFormat(localeForLanguage(lang), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(rate.refreshedAt))}</p>` : `<p>${copy.noCachedData}</p>`}
          <button class="ghost" id="retry-rate">${copy.retry}</button>
        </article>
        <article class="card">
          <h3>${copy.moneyInfo}</h3>
          <p>${copy.officialCurrency}: ${city.money.localCurrencies.map((item) => `${item.name} - ${item.code} (${item.symbol})`).join(', ')}</p>
          ${city.money.denominations ? `<p>${copy.denominations}: ${esc(city.money.denominations)}</p>` : ''}
          ${city.money.cardsCommonlyAccepted ? `<p>${copy.cardsAccepted}: ${plannerFacilityStatus(city.money.cardsCommonlyAccepted, copy)}</p>` : ''}
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
    updateMoneyDynamicSections();
  });
  document.querySelector<HTMLInputElement>('#currency-search')?.addEventListener('input', (event) => {
    currencySearch = (event.target as HTMLInputElement).value;
    updateCurrencyOptionLists();
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
    const parsed = parseAmountInput(amountInput, lang);
    if (parsed.value === null || !rate) return;
    const result = convertAmount(parsed.value, rate.rate);
    await copyText(`${parsed.value} ${fromCurrency} = ${result.converted} ${toCurrency}`);
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

function bindSavedTripsPage() {
  document.querySelector<HTMLSelectElement>('#lang')?.addEventListener('change', (event) => { lang = (event.target as HTMLSelectElement).value as Language; savedTripsPage(); });
  document.querySelector<HTMLButtonElement>('#back-from-saved-trips')?.addEventListener('click', () => { view = 'planner'; if (window.location.hash) history.pushState(null, '', window.location.pathname + window.location.search); render(); });
  document.querySelectorAll<HTMLButtonElement>('[data-open-trip]').forEach((button) => button.addEventListener('click', () => {
    const trip = savedTrips.find((candidate) => candidate.id === button.dataset.openTrip);
    if (trip) openSavedTrip(trip);
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-share-trip]').forEach((button) => button.addEventListener('click', () => {
    const trip = savedTrips.find((candidate) => candidate.id === button.dataset.shareTrip);
    if (trip) void shareTrip(snapshotFromSavedTrip(trip));
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-copy-trip]').forEach((button) => button.addEventListener('click', () => {
    const trip = savedTrips.find((candidate) => candidate.id === button.dataset.copyTrip);
    if (trip) void copyTripItinerary(snapshotFromSavedTrip(trip));
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-export-trip]').forEach((button) => button.addEventListener('click', () => {
    const trip = savedTrips.find((candidate) => candidate.id === button.dataset.exportTrip);
    if (trip) void exportTripCalendar(snapshotFromSavedTrip(trip));
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-rename-trip]').forEach((button) => button.addEventListener('click', () => {
    const trip = savedTrips.find((candidate) => candidate.id === button.dataset.renameTrip);
    if (!trip) return;
    const nextName = sanitizeTripName(window.prompt(labels[lang].tripName, trip.name) ?? trip.name);
    if (!nextName || nextName === trip.name) return;
    try {
      savedTrips = savedTripRepository.upsert({ ...trip, name: nextName, updatedAt: new Date().toISOString() });
      savedTripsPage();
    } catch {
      savedTripStatus = 'failed';
      savedTripMessage = labels[lang].saveFailed;
      savedTripsPage();
    }
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-duplicate-trip]').forEach((button) => button.addEventListener('click', () => {
    const trip = savedTrips.find((candidate) => candidate.id === button.dataset.duplicateTrip);
    if (!trip) return;
    try {
      savedTrips = savedTripRepository.upsert(duplicateSavedTrip(trip));
      savedTripsPage();
    } catch {
      savedTripStatus = 'failed';
      savedTripMessage = labels[lang].saveFailed;
      savedTripsPage();
    }
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-delete-trip]').forEach((button) => button.addEventListener('click', () => {
    const trip = savedTrips.find((candidate) => candidate.id === button.dataset.deleteTrip);
    if (!trip || !window.confirm(`${labels[lang].deleteTripConfirm}: ${trip.name}?`)) return;
    try {
      savedTrips = savedTripRepository.delete(trip.id);
      if (openedSavedTripId === trip.id) {
        openedSavedTripId = '';
        savedTripNameDraft = '';
        savedTripStatus = 'deleted';
      }
      savedTripsPage();
    } catch {
      savedTripStatus = 'failed';
      savedTripMessage = labels[lang].saveFailed;
      savedTripsPage();
    }
  }));
}

function render() {
  if (!root) return;
  if (view === 'qibla') {
    qiblaPage();
    return;
  }
  stopQiblaOrientation();
  if (view !== 'flight-mode') stopFlightGpsWatch();
  if (view === 'flight-mode') {
    flightModePage();
    return;
  }
  if (view === 'saved-trips') {
    savedTripsPage();
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
  if (view === 'public-transport') {
    publicTransportPage();
    return;
  }
  if (view === 'taxi-services') {
    taxiPage();
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
  const items = generatedPrefs && generatedCity ? generatedItems : [];
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  root.innerHTML = `
    <main dir="${dir}" class="app">
      <section class="hero">
        ${languageSelector()}
        <h1>${copy.title}</h1>
        <p class="hero-subtitle">${copy.subtitle}</p>
        <p>${copy.tagline}</p>
        ${connectionStatusMarkup(copy)}
      </section>
      <section class="quick-actions" aria-label="${copy.homeTravelToolsGroup}">
        ${homeToolGroup('home-trips-heading', copy.homeTripsGroup, [
          homeActionCard('saved', copy.savedTripsTitle, copy.savedTripsSubtitle, copy.savedTripsOpen, 'open-saved-trips'),
        ])}
        ${homeToolGroup('home-essentials-heading', copy.homeEssentialsGroup, [
          homeActionCard('qibla', copy.qiblaTitle, copy.qiblaSubtitle, copy.qiblaOpen, 'open-qibla'),
          homeActionCard('flight', copy.flightModeTitle, copy.flightModeSubtitle, copy.flightModeOpen, 'open-flight-mode'),
          homeActionCard('prayer', copy.prayerSpacesTitle, copy.prayerSpacesSubtitle, copy.prayerSpacesOpen, 'open-prayer-spaces'),
          homeActionCard('halal', copy.halalRestaurantsTitle, copy.halalRestaurantsSubtitle, copy.halalRestaurantsOpen, 'open-halal-restaurants'),
        ])}
        ${homeToolGroup('home-travel-tools-heading', copy.homeTravelToolsGroup, [
          homeActionCard('money', copy.moneyTitle, copy.moneySubtitle, copy.moneyOpen, 'open-money'),
          homeActionCard('toilets', copy.toiletsTitle, copy.toiletsSubtitle, copy.toiletsOpen, 'open-public-toilets'),
          homeActionCard('car', copy.carRentalTitle, copy.carRentalSubtitle, copy.carRentalOpen, 'open-car-rental'),
          homeActionCard('transport', copy.publicTransportTitle, copy.publicTransportSubtitle, copy.publicTransportOpen, 'open-public-transport'),
          homeActionCard('taxi', copy.taxiTitle, copy.taxiSubtitle, copy.taxiOpen, 'open-taxi-services'),
          homeActionCard('weather', copy.weatherTitle, copy.weatherSubtitle, copy.weatherOpen, 'open-weather'),
          homeActionCard('attractions', copy.attractionsTitle, copy.attractionsSubtitle, copy.attractionsOpen, 'open-attractions'),
        ])}
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
          ${tripHeaderMarkup(generatedCity, generatedPrefs, items, copy)}
          ${travelDetailsSectionMarkup(copy, generatedCity.timezone)}
          <div class="result-header"><div><p>${regionLabels[lang][generatedCity.region]} · ${generatedCity.timezone}</p><p>${copy.transportEstimatesAre}: ${copy.walking} ${generatedCity.transportEstimates.walking} ${copy.minutesShort} · ${copy.publicTransport} ${generatedCity.transportEstimates.publicTransport} ${copy.minutesShort} · ${copy.taxi} ${generatedCity.transportEstimates.taxi} ${copy.minutesShort}.</p></div></div>
          ${athanSection(generatedCity, generatedPrefs)}
          ${mapSection(generatedCity, copy)}
          ${items.length ? itineraryGroupsMarkup(items, generatedCity, copy) : `<p>${copy.emptyState}</p>`}
        ` : `<p class="${plannerValidation ? 'error' : 'notice'}">${esc(plannerValidation || (visibleCities.length ? copy.generatePrompt : copy.noCities))}</p>`}
      </section>
      ${appFooterMarkup(copy)}
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
  document.querySelector<HTMLButtonElement>('#open-saved-trips')?.addEventListener('click', () => {
    view = 'saved-trips';
    if (window.location.hash !== '#saved-trips') window.location.hash = 'saved-trips';
    render();
  });
  document.querySelector<HTMLButtonElement>('#open-qibla')?.addEventListener('click', () => {
    view = 'qibla';
    if (window.location.hash !== '#qibla') window.location.hash = 'qibla';
    render();
  });
  document.querySelector<HTMLButtonElement>('#open-flight-mode')?.addEventListener('click', () => {
    view = 'flight-mode';
    if (window.location.hash !== '#flight-mode') window.location.hash = 'flight-mode';
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
  document.querySelector<HTMLButtonElement>('#open-public-transport')?.addEventListener('click', () => {
    view = 'public-transport';
    if (window.location.hash !== '#public-transport') window.location.hash = 'public-transport';
    void searchPublicTransport(publicTransportDestinationCenter());
    render();
  });
  document.querySelector<HTMLButtonElement>('#open-taxi-services')?.addEventListener('click', () => {
    view = 'taxi-services';
    if (window.location.hash !== '#taxi-services') window.location.hash = 'taxi-services';
    void searchTaxiServices(taxiDestinationCenter());
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
    generatedItems = generateItinerary(generatedPrefs, 0, lang);
    currentTravelDetails = emptyTravelDetails();
    travelDetailEditor = null;
    openedSavedTripId = '';
    savedTripNameDraft = '';
    savedTripStatus = 'unsaved';
    savedTripMessage = '';
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
      const result = await enableAthanAlarms(alarms, lang);
      athanEnabled = result.scheduled > 0 && result.permissions.notificationsAllowed;
      localStorage.setItem('athanEnabled', String(athanEnabled));
      athanStatus = athanEnabled ? `${copy.scheduled}: ${result.scheduled}` : copy.failed;
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
  document.querySelector<HTMLButtonElement>('#test-athan')?.addEventListener('click', () => void playTestAthan(lang).catch((error) => {
    console.error(error);
    athanStatus = athanLabels[lang].failed;
    render();
  }));
  document.querySelector<HTMLButtonElement>('#stop-athan')?.addEventListener('click', () => void stopAthan());
  bindTripExportButtons();
  bindTravelDetailsSection();
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
    if (generatedPrefs) savedTripStatus = 'unsaved';
    if (key === 'city' || key === 'prayerMethod' || key === 'startDate') {
      athanStatus = '';
      render();
    }
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-replan]').forEach((button) => button.addEventListener('click', () => {
    replan = Number(button.dataset.replan);
    if (generatedPrefs) generatedItems = generateItinerary(generatedPrefs, replan, lang);
    savedTripStatus = openedSavedTripId ? 'unsaved' : savedTripStatus;
    plannerAnnouncement = '';
    render();
  }));
  document.querySelector<HTMLInputElement>('#trip-name')?.addEventListener('input', (event) => {
    savedTripNameDraft = (event.target as HTMLInputElement).value;
    savedTripStatus = openedSavedTripId ? 'unsaved' : savedTripStatus;
  });
  document.querySelector<HTMLButtonElement>('#save-trip')?.addEventListener('click', () => saveCurrentTrip(labels[lang]));
  document.querySelector<HTMLButtonElement>('#edit-plan')?.addEventListener('click', () => document.querySelector<HTMLElement>('.form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  document.querySelector<HTMLButtonElement>('#print-itinerary')?.addEventListener('click', () => window.print());
  bindNativeExternalLinks(document);
}

window.addEventListener('hashchange', () => {
  view = viewFromHash();
  if (view === 'planner') { stopQiblaOrientation(); prayerMap?.remove(); prayerMap = undefined; restaurantMap?.remove(); restaurantMap = undefined; publicTransportMap?.remove(); publicTransportMap = undefined; taxiMap?.remove(); taxiMap = undefined; }
  if (view === 'money') {
    toCurrency = destinationCurrency(selectedCity());
    void loadCurrencies();
    void loadPairRate();
  }
  if (view === 'public-transport' && !publicTransportCenter) void searchPublicTransport(publicTransportDestinationCenter());
  if (view === 'taxi-services' && !taxiCenter) void searchTaxiServices(taxiDestinationCenter());
  render();
});

window.addEventListener('online', () => {
  showConnectionNotice('online');
});

window.addEventListener('offline', () => {
  showConnectionNotice('offline');
});

window.addEventListener('storage', (event) => {
  if (event.key !== 'mtp-saved-trips-v1') return;
  const hadUnsavedEdits = hasUnsavedTripChanges();
  refreshSavedTrips();
  if (view === 'saved-trips' || !hadUnsavedEdits) render();
});

if (view === 'money') {
  toCurrency = destinationCurrency(selectedCity());
  void loadCurrencies();
  void loadPairRate();
}
if (view === 'public-transport') void searchPublicTransport(publicTransportDestinationCenter());
if (view === 'taxi-services') void searchTaxiServices(taxiDestinationCenter());

render();
void registerAppServiceWorker();
