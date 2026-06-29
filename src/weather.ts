import type { Language, labels } from './i18n.js';

export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const WEATHER_CACHE_MS = 20 * 60 * 1000;

// The public Open-Meteo endpoint is for this non-commercial prototype. Keep
// provider URLs/credentials configurable and never commit weather API secrets.
export type WeatherUnits = {
  temperature: 'celsius' | 'fahrenheit';
  wind: 'kmh' | 'mph' | 'ms' | 'knots';
  precipitation: 'mm' | 'inch';
};

export type WeatherPoint = {
  time: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitationProbability: number;
  precipitation: number;
  rain: number;
  showers: number;
  snowfall: number;
  weatherCode: number;
  cloudCover: number;
  visibility: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  uvIndex: number;
  isDay: boolean;
};

export type WeatherDay = {
  date: string;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
  apparentMax: number;
  apparentMin: number;
  sunrise: string;
  sunset: string;
  daylightDuration: number;
  sunshineDuration: number;
  uvIndexMax: number;
  precipitationSum: number;
  rainSum: number;
  showersSum: number;
  snowfallSum: number;
  precipitationProbabilityMax: number;
  windSpeedMax: number;
  windGustsMax: number;
  windDirectionDominant: number;
};

export type WeatherForecast = {
  latitude: number;
  longitude: number;
  timezone: string;
  retrievedAt: string;
  cached: boolean;
  current: WeatherPoint;
  hourly: WeatherPoint[];
  daily: WeatherDay[];
};

type WeatherCopy = typeof labels[Language];

const currentVariables = ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'precipitation', 'rain', 'showers', 'snowfall', 'weather_code', 'cloud_cover', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'is_day'];
const hourlyVariables = ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'precipitation_probability', 'precipitation', 'rain', 'showers', 'snowfall', 'weather_code', 'cloud_cover', 'visibility', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'uv_index', 'is_day'];
const dailyVariables = ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'apparent_temperature_max', 'apparent_temperature_min', 'sunrise', 'sunset', 'daylight_duration', 'sunshine_duration', 'uv_index_max', 'precipitation_sum', 'rain_sum', 'showers_sum', 'snowfall_sum', 'precipitation_probability_max', 'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant'];

export function buildWeatherUrl(latitude: number, longitude: number, units: WeatherUnits, baseUrl = OPEN_METEO_FORECAST_URL) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: currentVariables.join(','),
    hourly: hourlyVariables.join(','),
    daily: dailyVariables.join(','),
    timezone: 'auto',
    forecast_days: '7',
    temperature_unit: units.temperature === 'fahrenheit' ? 'fahrenheit' : 'celsius',
    wind_speed_unit: units.wind === 'mph' ? 'mph' : units.wind === 'ms' ? 'ms' : units.wind === 'knots' ? 'kn' : 'kmh',
    precipitation_unit: units.precipitation === 'inch' ? 'inch' : 'mm',
  });
  return `${baseUrl}?${params.toString()}`;
}

const asNumber = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const asString = (value: unknown) => typeof value === 'string' ? value : '';

function requireArray<T>(value: unknown, name: string): T[] {
  if (!Array.isArray(value)) throw new Error(`Missing ${name}`);
  return value as T[];
}

export function validateWeatherResponse(raw: unknown, retrievedAt = new Date().toISOString()): WeatherForecast {
  if (!raw || typeof raw !== 'object') throw new Error('Malformed weather response');
  const body = raw as Record<string, any>;
  if (!body.current || typeof body.current !== 'object') throw new Error('Missing current data');
  if (!body.hourly || typeof body.hourly !== 'object') throw new Error('Missing hourly data');
  if (!body.daily || typeof body.daily !== 'object') throw new Error('Missing daily data');
  const hourlyTimes = requireArray<string>(body.hourly.time, 'hourly data');
  const dailyTimes = requireArray<string>(body.daily.time, 'daily data');
  if (!hourlyTimes.length) throw new Error('Missing hourly data');
  if (dailyTimes.length < 7) throw new Error('Missing daily data');
  const current = body.current as Record<string, unknown>;
  const currentPoint: WeatherPoint = {
    time: asString(current.time),
    temperature: asNumber(current.temperature_2m),
    apparentTemperature: asNumber(current.apparent_temperature),
    humidity: asNumber(current.relative_humidity_2m),
    precipitationProbability: 0,
    precipitation: asNumber(current.precipitation),
    rain: asNumber(current.rain),
    showers: asNumber(current.showers),
    snowfall: asNumber(current.snowfall),
    weatherCode: asNumber(current.weather_code),
    cloudCover: asNumber(current.cloud_cover),
    visibility: 0,
    windSpeed: asNumber(current.wind_speed_10m),
    windDirection: asNumber(current.wind_direction_10m),
    windGusts: asNumber(current.wind_gusts_10m),
    uvIndex: 0,
    isDay: asNumber(current.is_day) === 1,
  };
  if (!currentPoint.time) throw new Error('Missing current data');

  const hourly = hourlyTimes.map((time, index) => ({
    time,
    temperature: asNumber(body.hourly.temperature_2m?.[index]),
    apparentTemperature: asNumber(body.hourly.apparent_temperature?.[index]),
    humidity: asNumber(body.hourly.relative_humidity_2m?.[index]),
    precipitationProbability: asNumber(body.hourly.precipitation_probability?.[index]),
    precipitation: asNumber(body.hourly.precipitation?.[index]),
    rain: asNumber(body.hourly.rain?.[index]),
    showers: asNumber(body.hourly.showers?.[index]),
    snowfall: asNumber(body.hourly.snowfall?.[index]),
    weatherCode: asNumber(body.hourly.weather_code?.[index]),
    cloudCover: asNumber(body.hourly.cloud_cover?.[index]),
    visibility: asNumber(body.hourly.visibility?.[index]),
    windSpeed: asNumber(body.hourly.wind_speed_10m?.[index]),
    windDirection: asNumber(body.hourly.wind_direction_10m?.[index]),
    windGusts: asNumber(body.hourly.wind_gusts_10m?.[index]),
    uvIndex: asNumber(body.hourly.uv_index?.[index]),
    isDay: asNumber(body.hourly.is_day?.[index]) === 1,
  }));

  const daily = dailyTimes.slice(0, 7).map((date, index) => ({
    date,
    weatherCode: asNumber(body.daily.weather_code?.[index]),
    temperatureMax: asNumber(body.daily.temperature_2m_max?.[index]),
    temperatureMin: asNumber(body.daily.temperature_2m_min?.[index]),
    apparentMax: asNumber(body.daily.apparent_temperature_max?.[index]),
    apparentMin: asNumber(body.daily.apparent_temperature_min?.[index]),
    sunrise: asString(body.daily.sunrise?.[index]),
    sunset: asString(body.daily.sunset?.[index]),
    daylightDuration: asNumber(body.daily.daylight_duration?.[index]),
    sunshineDuration: asNumber(body.daily.sunshine_duration?.[index]),
    uvIndexMax: asNumber(body.daily.uv_index_max?.[index]),
    precipitationSum: asNumber(body.daily.precipitation_sum?.[index]),
    rainSum: asNumber(body.daily.rain_sum?.[index]),
    showersSum: asNumber(body.daily.showers_sum?.[index]),
    snowfallSum: asNumber(body.daily.snowfall_sum?.[index]),
    precipitationProbabilityMax: asNumber(body.daily.precipitation_probability_max?.[index]),
    windSpeedMax: asNumber(body.daily.wind_speed_10m_max?.[index]),
    windGustsMax: asNumber(body.daily.wind_gusts_10m_max?.[index]),
    windDirectionDominant: asNumber(body.daily.wind_direction_10m_dominant?.[index]),
  }));

  return {
    latitude: asNumber(body.latitude),
    longitude: asNumber(body.longitude),
    timezone: asString(body.timezone) || 'auto',
    retrievedAt,
    cached: false,
    current: currentPoint,
    hourly,
    daily,
  };
}

export function weatherCodeInfo(code: number, copy: WeatherCopy) {
  if (code === 0) return { label: copy.weatherClear, icon: 'sun' };
  if (code === 1) return { label: copy.weatherMainlyClear, icon: 'sun-cloud' };
  if (code === 2) return { label: copy.weatherPartlyCloudy, icon: 'part-cloud' };
  if (code === 3) return { label: copy.weatherOvercast, icon: 'cloud' };
  if ([45, 48].includes(code)) return { label: copy.weatherFog, icon: 'fog' };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: copy.weatherDrizzle, icon: 'drizzle' };
  if ([61, 63, 65].includes(code)) return { label: copy.weatherRain, icon: 'rain' };
  if ([66, 67].includes(code)) return { label: copy.weatherFreezingRain, icon: 'freezing-rain' };
  if ([71, 73, 75, 77].includes(code)) return { label: copy.weatherSnow, icon: 'snow' };
  if ([80, 81, 82].includes(code)) return { label: copy.weatherRainShowers, icon: 'showers' };
  if ([85, 86].includes(code)) return { label: copy.weatherSnowShowers, icon: 'snow-showers' };
  if (code === 95) return { label: copy.weatherThunderstorm, icon: 'storm' };
  if ([96, 99].includes(code)) return { label: copy.weatherThunderstormHail, icon: 'hail' };
  return { label: copy.weatherUnknown, icon: 'unknown' };
}

export function formatTemperature(value: number, units: WeatherUnits) {
  return `${Math.round(value)}°${units.temperature === 'fahrenheit' ? 'F' : 'C'}`;
}

export function convertWindFromKmh(value: number, unit: WeatherUnits['wind']) {
  if (unit === 'mph') return value * 0.621371;
  if (unit === 'ms') return value / 3.6;
  if (unit === 'knots') return value * 0.539957;
  return value;
}

export function formatWind(value: number, units: WeatherUnits) {
  const suffix = units.wind === 'mph' ? 'mph' : units.wind === 'ms' ? 'm/s' : units.wind === 'knots' ? 'kn' : 'km/h';
  return `${Math.round(value)} ${suffix}`;
}

export function convertPrecipitationFromMm(value: number, unit: WeatherUnits['precipitation']) {
  return unit === 'inch' ? value / 25.4 : value;
}

export function formatPrecipitation(value: number, units: WeatherUnits) {
  return units.precipitation === 'inch' ? `${value.toFixed(2)} in` : `${value.toFixed(1)} mm`;
}

export function windDirectionLabel(degrees: number) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

export function selectHourlyForecast(hourly: WeatherPoint[], currentTime: string, hours = 24) {
  const start = Date.parse(currentTime);
  const startIndex = hourly.findIndex((point) => Date.parse(point.time) >= start);
  return hourly.slice(Math.max(0, startIndex), Math.max(0, startIndex) + hours);
}

export function hourlyForDay(hourly: WeatherPoint[], date: string) {
  return hourly.filter((point) => point.time.startsWith(date));
}

export function travelWeatherIndicators(forecast: WeatherForecast, copy: WeatherCopy) {
  const today = forecast.daily[0];
  const next24 = selectHourlyForecast(forecast.hourly, forecast.current.time, 24);
  const notices: string[] = [];
  if ((today?.precipitationProbabilityMax ?? 0) >= 60 || next24.some((hour) => hour.precipitationProbability >= 60 || hour.rain > 0)) notices.push(copy.weatherIndicatorRain);
  if ((today?.snowfallSum ?? 0) > 0 || next24.some((hour) => hour.snowfall > 0)) notices.push(copy.weatherIndicatorSnow);
  if ((today?.windGustsMax ?? 0) >= 50 || next24.some((hour) => hour.windGusts >= 50)) notices.push(copy.weatherIndicatorWind);
  if ((today?.uvIndexMax ?? 0) >= 6 || next24.some((hour) => hour.uvIndex >= 6)) notices.push(copy.weatherIndicatorUv);
  if (next24.some((hour) => hour.visibility > 0 && hour.visibility < 3000)) notices.push(copy.weatherIndicatorVisibility);
  if ((today?.temperatureMax ?? forecast.current.temperature) >= 35 || forecast.current.temperature >= 35) notices.push(copy.weatherIndicatorHot);
  if ((today?.temperatureMin ?? forecast.current.temperature) <= 5 || forecast.current.temperature <= 5) notices.push(copy.weatherIndicatorCold);
  if (next24.some((hour) => [95, 96, 99].includes(hour.weatherCode))) notices.push(copy.weatherIndicatorThunderstorm);
  return notices;
}

export function packingSuggestions(forecast: WeatherForecast, copy: WeatherCopy) {
  const indicators = travelWeatherIndicators(forecast, copy);
  const suggestions = new Set<string>();
  if (indicators.includes(copy.weatherIndicatorRain)) suggestions.add(copy.weatherPackUmbrella);
  if (forecast.current.temperature <= 18 || (forecast.daily[0]?.temperatureMin ?? 99) <= 15) suggestions.add(copy.weatherPackJacket);
  if (indicators.includes(copy.weatherIndicatorCold)) suggestions.add(copy.weatherPackCold);
  if (indicators.includes(copy.weatherIndicatorUv) || indicators.includes(copy.weatherIndicatorHot)) suggestions.add(copy.weatherPackSun);
  if (indicators.includes(copy.weatherIndicatorRain) || indicators.includes(copy.weatherIndicatorSnow)) suggestions.add(copy.weatherPackFootwear);
  if (indicators.includes(copy.weatherIndicatorHot)) suggestions.add(copy.weatherPackWater);
  return [...suggestions];
}

export function matchPrayerWeather(prayerTimes: Record<string, string>, hourly: WeatherPoint[]) {
  return Object.entries(prayerTimes).map(([prayer, time]) => {
    const match = /(\d{1,2}):(\d{2})/.exec(time);
    if (!match) return { prayer, time, forecast: undefined };
    const targetMinutes = Number(match[1]) * 60 + Number(match[2]);
    const forecast = hourly.reduce<WeatherPoint | undefined>((closest, point) => {
      const pointDate = new Date(point.time);
      const minutes = pointDate.getHours() * 60 + pointDate.getMinutes();
      if (!closest) return point;
      const closestDate = new Date(closest.time);
      const closestMinutes = closestDate.getHours() * 60 + closestDate.getMinutes();
      return Math.abs(minutes - targetMinutes) < Math.abs(closestMinutes - targetMinutes) ? point : closest;
    }, undefined);
    return { prayer, time, forecast };
  }).filter((item) => item.forecast);
}

