import { Capacitor, registerPlugin } from '@capacitor/core';
import type { WeatherForecast, WeatherUnits } from './weather.js';

interface NativeWeatherRequest {
  latitude: number;
  longitude: number;
  timezone?: string;
  temperatureUnit: WeatherUnits['temperature'];
  windUnit: WeatherUnits['wind'];
  precipitationUnit: WeatherUnits['precipitation'];
}

interface NativeWeatherAttribution {
  serviceName: string;
  legalPageURL: string;
  markURL: string;
}

interface NativeWeatherForecast extends WeatherForecast {
  attribution?: NativeWeatherAttribution;
}

interface SafarMateWeatherPlugin {
  forecast(options: NativeWeatherRequest): Promise<NativeWeatherForecast>;
}

const nativeWeather = registerPlugin<SafarMateWeatherPlugin>('SafarMateWeather');
const openMeteoOrigin = 'https://api.open-meteo.com';
let attribution: NativeWeatherAttribution | undefined;
let installed = false;

export function isNativeWeatherPlatform(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validPoint(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const point = value as Record<string, unknown>;
  return typeof point.time === 'string'
    && finite(point.temperature)
    && finite(point.apparentTemperature)
    && finite(point.humidity)
    && finite(point.weatherCode)
    && finite(point.windSpeed)
    && finite(point.windDirection)
    && typeof point.isDay === 'boolean';
}

function validDay(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const day = value as Record<string, unknown>;
  return typeof day.date === 'string'
    && finite(day.weatherCode)
    && finite(day.temperatureMax)
    && finite(day.temperatureMin)
    && finite(day.apparentMax)
    && finite(day.apparentMin)
    && typeof day.sunrise === 'string'
    && typeof day.sunset === 'string'
    && finite(day.daylightDuration)
    && finite(day.sunshineDuration)
    && finite(day.windSpeedMax)
    && finite(day.windDirectionDominant);
}

export function validateNativeWeatherForecast(value: unknown): NativeWeatherForecast {
  if (!value || typeof value !== 'object') throw new Error('Malformed Apple Weather response');
  const forecast = value as Partial<NativeWeatherForecast>;
  if (!finite(forecast.latitude) || !finite(forecast.longitude)) throw new Error('Malformed Apple Weather coordinates');
  if (typeof forecast.timezone !== 'string' || typeof forecast.retrievedAt !== 'string') throw new Error('Malformed Apple Weather metadata');
  if (!validPoint(forecast.current)) throw new Error('Malformed Apple current weather');
  if (!Array.isArray(forecast.hourly) || forecast.hourly.length < 1 || !forecast.hourly.every(validPoint)) throw new Error('Malformed Apple hourly weather');
  if (!Array.isArray(forecast.daily) || forecast.daily.length < 7 || !forecast.daily.every(validDay)) throw new Error('Malformed Apple daily weather');
  if (forecast.attribution) {
    const details = forecast.attribution as Partial<NativeWeatherAttribution>;
    if (typeof details.serviceName !== 'string' || typeof details.legalPageURL !== 'string' || typeof details.markURL !== 'string') {
      throw new Error('Malformed Apple Weather attribution');
    }
  }
  return forecast as NativeWeatherForecast;
}

export async function requestNativeWeather(
  latitude: number,
  longitude: number,
  timezone: string | undefined,
  units: WeatherUnits,
): Promise<NativeWeatherForecast> {
  if (!isNativeWeatherPlatform()) throw new Error('Apple Weather is available only in the iPhone app');
  const forecast = validateNativeWeatherForecast(await nativeWeather.forecast({
    latitude,
    longitude,
    timezone,
    temperatureUnit: units.temperature,
    windUnit: units.wind,
    precipitationUnit: units.precipitation,
  }));
  attribution = forecast.attribution;
  return forecast;
}

function asNumber(value: string | null, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${name}`);
  return parsed;
}

function unitsFromUrl(url: URL): WeatherUnits {
  const temperature = url.searchParams.get('temperature_unit') === 'fahrenheit' ? 'fahrenheit' : 'celsius';
  const windParameter = url.searchParams.get('wind_speed_unit');
  const wind: WeatherUnits['wind'] = windParameter === 'mph' ? 'mph' : windParameter === 'ms' ? 'ms' : windParameter === 'kn' ? 'knots' : 'kmh';
  const precipitation = url.searchParams.get('precipitation_unit') === 'inch' ? 'inch' : 'mm';
  return { temperature, wind, precipitation };
}

function toOpenMeteoShape(forecast: WeatherForecast) {
  const current = forecast.current;
  return {
    latitude: forecast.latitude,
    longitude: forecast.longitude,
    timezone: forecast.timezone,
    current: {
      time: current.time,
      temperature_2m: current.temperature,
      apparent_temperature: current.apparentTemperature,
      relative_humidity_2m: current.humidity,
      precipitation: current.precipitation,
      rain: current.rain,
      showers: current.showers,
      snowfall: current.snowfall,
      weather_code: current.weatherCode,
      cloud_cover: current.cloudCover,
      wind_speed_10m: current.windSpeed,
      wind_direction_10m: current.windDirection,
      wind_gusts_10m: current.windGusts,
      is_day: current.isDay ? 1 : 0,
    },
    hourly: {
      time: forecast.hourly.map((item) => item.time),
      temperature_2m: forecast.hourly.map((item) => item.temperature),
      apparent_temperature: forecast.hourly.map((item) => item.apparentTemperature),
      relative_humidity_2m: forecast.hourly.map((item) => item.humidity),
      precipitation_probability: forecast.hourly.map((item) => item.precipitationProbability ?? 0),
      precipitation: forecast.hourly.map((item) => item.precipitation),
      rain: forecast.hourly.map((item) => item.rain),
      showers: forecast.hourly.map((item) => item.showers),
      snowfall: forecast.hourly.map((item) => item.snowfall),
      weather_code: forecast.hourly.map((item) => item.weatherCode),
      cloud_cover: forecast.hourly.map((item) => item.cloudCover),
      visibility: forecast.hourly.map((item) => item.visibility),
      wind_speed_10m: forecast.hourly.map((item) => item.windSpeed),
      wind_direction_10m: forecast.hourly.map((item) => item.windDirection),
      wind_gusts_10m: forecast.hourly.map((item) => item.windGusts),
      uv_index: forecast.hourly.map((item) => item.uvIndex),
      is_day: forecast.hourly.map((item) => item.isDay ? 1 : 0),
    },
    daily: {
      time: forecast.daily.map((item) => item.date),
      weather_code: forecast.daily.map((item) => item.weatherCode),
      temperature_2m_max: forecast.daily.map((item) => item.temperatureMax),
      temperature_2m_min: forecast.daily.map((item) => item.temperatureMin),
      apparent_temperature_max: forecast.daily.map((item) => item.apparentMax),
      apparent_temperature_min: forecast.daily.map((item) => item.apparentMin),
      sunrise: forecast.daily.map((item) => item.sunrise),
      sunset: forecast.daily.map((item) => item.sunset),
      daylight_duration: forecast.daily.map((item) => item.daylightDuration),
      sunshine_duration: forecast.daily.map((item) => item.sunshineDuration),
      uv_index_max: forecast.daily.map((item) => item.uvIndexMax),
      precipitation_sum: forecast.daily.map((item) => item.precipitationSum),
      rain_sum: forecast.daily.map((item) => item.rainSum),
      showers_sum: forecast.daily.map((item) => item.showersSum),
      snowfall_sum: forecast.daily.map((item) => item.snowfallSum),
      precipitation_probability_max: forecast.daily.map((item) => item.precipitationProbabilityMax ?? 0),
      wind_speed_10m_max: forecast.daily.map((item) => item.windSpeedMax),
      wind_gusts_10m_max: forecast.daily.map((item) => item.windGustsMax),
      wind_direction_10m_dominant: forecast.daily.map((item) => item.windDirectionDominant),
    },
  };
}

function inputUrl(input: RequestInfo | URL): URL {
  if (input instanceof URL) return input;
  if (typeof input === 'string') return new URL(input, window.location.href);
  return new URL(input.url, window.location.href);
}

function aborted(init?: RequestInit): boolean {
  return Boolean(init?.signal?.aborted);
}

function updateWeatherAttribution() {
  if (!attribution) return;
  const host = document.querySelector<HTMLElement>('.weather-app .map-status');
  if (!host || host.dataset.provider === 'apple-weather') return;
  host.dataset.provider = 'apple-weather';
  host.replaceChildren();
  const link = document.createElement('a');
  link.href = attribution.legalPageURL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', `${attribution.serviceName} legal attribution`);
  const mark = document.createElement('img');
  mark.src = attribution.markURL;
  mark.alt = attribution.serviceName;
  mark.loading = 'lazy';
  mark.style.maxHeight = '24px';
  mark.style.maxWidth = '160px';
  mark.style.verticalAlign = 'middle';
  link.append(mark);
  host.append(link, document.createTextNode(' · Weather data may not be accurate.'));
}

export function installNativeWeatherFetchBridge() {
  if (installed || !isNativeWeatherPlatform()) return;
  installed = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = inputUrl(input);
    if (url.origin !== openMeteoOrigin || url.pathname !== '/v1/forecast') return originalFetch(input, init);
    if (aborted(init)) throw new DOMException('The operation was aborted.', 'AbortError');
    const forecast = await requestNativeWeather(
      asNumber(url.searchParams.get('latitude'), 'weather latitude'),
      asNumber(url.searchParams.get('longitude'), 'weather longitude'),
      url.searchParams.get('timezone') || undefined,
      unitsFromUrl(url),
    );
    if (aborted(init)) throw new DOMException('The operation was aborted.', 'AbortError');
    queueMicrotask(updateWeatherAttribution);
    return new Response(JSON.stringify(toOpenMeteoShape(forecast)), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-SafarMate-Weather-Provider': 'WeatherKit' },
    });
  };
  new MutationObserver(updateWeatherAttribution).observe(document.documentElement, { childList: true, subtree: true });
}
