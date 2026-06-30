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
  precipitationProbability: number | null;
  precipitation: number | null;
  rain: number | null;
  showers: number | null;
  snowfall: number | null;
  weatherCode: number;
  cloudCover: number | null;
  visibility: number | null;
  windSpeed: number;
  windDirection: number;
  windGusts: number | null;
  uvIndex: number | null;
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
  uvIndexMax: number | null;
  precipitationSum: number | null;
  rainSum: number | null;
  showersSum: number | null;
  snowfallSum: number | null;
  precipitationProbabilityMax: number | null;
  windSpeedMax: number;
  windGustsMax: number | null;
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

const optionalNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const asString = (value: unknown) => typeof value === 'string' ? value : '';

function requiredNumber(value: unknown, name: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Missing ${name}`);
  return value;
}

function requireArray<T>(value: unknown, name: string): T[] {
  if (!Array.isArray(value)) throw new Error(`Missing ${name}`);
  return value as T[];
}

function requireAlignedArray<T>(value: unknown, length: number, name: string): T[] {
  const array = requireArray<T>(value, name);
  if (array.length !== length) throw new Error(`Malformed ${name}`);
  return array;
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
  const hourlyTemperature = requireAlignedArray<unknown>(body.hourly.temperature_2m, hourlyTimes.length, 'hourly temperature');
  const hourlyApparent = requireAlignedArray<unknown>(body.hourly.apparent_temperature, hourlyTimes.length, 'hourly apparent temperature');
  const hourlyHumidity = requireAlignedArray<unknown>(body.hourly.relative_humidity_2m, hourlyTimes.length, 'hourly humidity');
  const hourlyPrecipitationProbability = requireAlignedArray<unknown>(body.hourly.precipitation_probability, hourlyTimes.length, 'hourly precipitation probability');
  const hourlyWeatherCode = requireAlignedArray<unknown>(body.hourly.weather_code, hourlyTimes.length, 'hourly weather code');
  const hourlyWindSpeed = requireAlignedArray<unknown>(body.hourly.wind_speed_10m, hourlyTimes.length, 'hourly wind speed');
  const hourlyWindDirection = requireAlignedArray<unknown>(body.hourly.wind_direction_10m, hourlyTimes.length, 'hourly wind direction');
  const hourlyDayNight = requireAlignedArray<unknown>(body.hourly.is_day, hourlyTimes.length, 'hourly day/night');
  const dailyWeatherCode = requireAlignedArray<unknown>(body.daily.weather_code, dailyTimes.length, 'daily weather code');
  const dailyTemperatureMax = requireAlignedArray<unknown>(body.daily.temperature_2m_max, dailyTimes.length, 'daily maximum temperature');
  const dailyTemperatureMin = requireAlignedArray<unknown>(body.daily.temperature_2m_min, dailyTimes.length, 'daily minimum temperature');
  const dailyApparentMax = requireAlignedArray<unknown>(body.daily.apparent_temperature_max, dailyTimes.length, 'daily maximum apparent temperature');
  const dailyApparentMin = requireAlignedArray<unknown>(body.daily.apparent_temperature_min, dailyTimes.length, 'daily minimum apparent temperature');
  const dailySunrise = requireAlignedArray<unknown>(body.daily.sunrise, dailyTimes.length, 'daily sunrise');
  const dailySunset = requireAlignedArray<unknown>(body.daily.sunset, dailyTimes.length, 'daily sunset');
  const dailyDaylight = requireAlignedArray<unknown>(body.daily.daylight_duration, dailyTimes.length, 'daily daylight duration');
  const dailySunshine = requireAlignedArray<unknown>(body.daily.sunshine_duration, dailyTimes.length, 'daily sunshine duration');
  const dailyPrecipitationProbability = requireAlignedArray<unknown>(body.daily.precipitation_probability_max, dailyTimes.length, 'daily precipitation probability');
  const dailyWindSpeed = requireAlignedArray<unknown>(body.daily.wind_speed_10m_max, dailyTimes.length, 'daily maximum wind speed');
  const dailyWindDirection = requireAlignedArray<unknown>(body.daily.wind_direction_10m_dominant, dailyTimes.length, 'daily wind direction');
  const current = body.current as Record<string, unknown>;
  const currentPoint: WeatherPoint = {
    time: asString(current.time),
    temperature: requiredNumber(current.temperature_2m, 'current temperature'),
    apparentTemperature: requiredNumber(current.apparent_temperature, 'current apparent temperature'),
    humidity: requiredNumber(current.relative_humidity_2m, 'current humidity'),
    precipitationProbability: null,
    precipitation: optionalNumber(current.precipitation),
    rain: optionalNumber(current.rain),
    showers: optionalNumber(current.showers),
    snowfall: optionalNumber(current.snowfall),
    weatherCode: requiredNumber(current.weather_code, 'current weather code'),
    cloudCover: optionalNumber(current.cloud_cover),
    visibility: null,
    windSpeed: requiredNumber(current.wind_speed_10m, 'current wind speed'),
    windDirection: requiredNumber(current.wind_direction_10m, 'current wind direction'),
    windGusts: optionalNumber(current.wind_gusts_10m),
    uvIndex: null,
    isDay: requiredNumber(current.is_day, 'current day/night') === 1,
  };
  if (!currentPoint.time) throw new Error('Missing current data');

  const hourly = hourlyTimes.map((time, index) => ({
    time,
    temperature: requiredNumber(hourlyTemperature[index], 'hourly temperature'),
    apparentTemperature: requiredNumber(hourlyApparent[index], 'hourly apparent temperature'),
    humidity: requiredNumber(hourlyHumidity[index], 'hourly humidity'),
    precipitationProbability: requiredNumber(hourlyPrecipitationProbability[index], 'hourly precipitation probability'),
    precipitation: optionalNumber(body.hourly.precipitation?.[index]),
    rain: optionalNumber(body.hourly.rain?.[index]),
    showers: optionalNumber(body.hourly.showers?.[index]),
    snowfall: optionalNumber(body.hourly.snowfall?.[index]),
    weatherCode: requiredNumber(hourlyWeatherCode[index], 'hourly weather code'),
    cloudCover: optionalNumber(body.hourly.cloud_cover?.[index]),
    visibility: optionalNumber(body.hourly.visibility?.[index]),
    windSpeed: requiredNumber(hourlyWindSpeed[index], 'hourly wind speed'),
    windDirection: requiredNumber(hourlyWindDirection[index], 'hourly wind direction'),
    windGusts: optionalNumber(body.hourly.wind_gusts_10m?.[index]),
    uvIndex: optionalNumber(body.hourly.uv_index?.[index]),
    isDay: requiredNumber(hourlyDayNight[index], 'hourly day/night') === 1,
  }));

  const daily = dailyTimes.slice(0, 7).map((date, index) => ({
    date,
    weatherCode: requiredNumber(dailyWeatherCode[index], 'daily weather code'),
    temperatureMax: requiredNumber(dailyTemperatureMax[index], 'daily maximum temperature'),
    temperatureMin: requiredNumber(dailyTemperatureMin[index], 'daily minimum temperature'),
    apparentMax: requiredNumber(dailyApparentMax[index], 'daily maximum apparent temperature'),
    apparentMin: requiredNumber(dailyApparentMin[index], 'daily minimum apparent temperature'),
    sunrise: asString(dailySunrise[index]),
    sunset: asString(dailySunset[index]),
    daylightDuration: requiredNumber(dailyDaylight[index], 'daily daylight duration'),
    sunshineDuration: requiredNumber(dailySunshine[index], 'daily sunshine duration'),
    uvIndexMax: optionalNumber(body.daily.uv_index_max?.[index]),
    precipitationSum: optionalNumber(body.daily.precipitation_sum?.[index]),
    rainSum: optionalNumber(body.daily.rain_sum?.[index]),
    showersSum: optionalNumber(body.daily.showers_sum?.[index]),
    snowfallSum: optionalNumber(body.daily.snowfall_sum?.[index]),
    precipitationProbabilityMax: requiredNumber(dailyPrecipitationProbability[index], 'daily precipitation probability'),
    windSpeedMax: requiredNumber(dailyWindSpeed[index], 'daily maximum wind speed'),
    windGustsMax: optionalNumber(body.daily.wind_gusts_10m_max?.[index]),
    windDirectionDominant: requiredNumber(dailyWindDirection[index], 'daily wind direction'),
  }));
  if (daily.some((day) => !day.sunrise || !day.sunset)) throw new Error('Missing daily sunrise or sunset');

  return {
    latitude: requiredNumber(body.latitude, 'latitude'),
    longitude: requiredNumber(body.longitude, 'longitude'),
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

export function formatTemperature(value: number | null, units: WeatherUnits, unavailable = 'Unavailable') {
  if (value === null) return unavailable;
  return `${Math.round(value)}°${units.temperature === 'fahrenheit' ? 'F' : 'C'}`;
}

export function convertWindFromKmh(value: number, unit: WeatherUnits['wind']) {
  if (unit === 'mph') return value * 0.621371;
  if (unit === 'ms') return value / 3.6;
  if (unit === 'knots') return value * 0.539957;
  return value;
}

export function formatWind(value: number | null, units: WeatherUnits, unavailable = 'Unavailable') {
  if (value === null) return unavailable;
  const suffix = units.wind === 'mph' ? 'mph' : units.wind === 'ms' ? 'm/s' : units.wind === 'knots' ? 'kn' : 'km/h';
  return `${Math.round(value)} ${suffix}`;
}

export function convertPrecipitationFromMm(value: number, unit: WeatherUnits['precipitation']) {
  return unit === 'inch' ? value / 25.4 : value;
}

export function formatPrecipitation(value: number | null, units: WeatherUnits, unavailable = 'Unavailable') {
  if (value === null) return unavailable;
  return units.precipitation === 'inch' ? `${value.toFixed(2)} in` : `${value.toFixed(1)} mm`;
}

export function windDirectionLabel(degrees: number) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

export function selectHourlyForecast(hourly: WeatherPoint[], currentTime: string, hours = 24) {
  const start = Date.parse(currentTime);
  if (!hourly.length || !Number.isFinite(start)) return [];
  const startIndex = hourly.findIndex((point) => Date.parse(point.time) >= start);
  if (startIndex < 0) return [];
  return hourly.slice(startIndex, startIndex + hours);
}

export function hourlyForDay(hourly: WeatherPoint[], date: string) {
  return hourly.filter((point) => point.time.startsWith(date));
}

export function travelWeatherIndicators(forecast: WeatherForecast, copy: WeatherCopy) {
  const today = forecast.daily[0];
  const next24 = selectHourlyForecast(forecast.hourly, forecast.current.time, 24);
  const notices: string[] = [];
  if ((today?.precipitationProbabilityMax ?? -Infinity) >= 60 || next24.some((hour) => (hour.precipitationProbability ?? -Infinity) >= 60 || (hour.rain ?? 0) > 0)) notices.push(copy.weatherIndicatorRain);
  if ((today?.snowfallSum ?? 0) > 0 || next24.some((hour) => (hour.snowfall ?? 0) > 0)) notices.push(copy.weatherIndicatorSnow);
  if ((today?.windGustsMax ?? -Infinity) >= 50 || next24.some((hour) => (hour.windGusts ?? -Infinity) >= 50)) notices.push(copy.weatherIndicatorWind);
  if ((today?.uvIndexMax ?? -Infinity) >= 6 || next24.some((hour) => (hour.uvIndex ?? -Infinity) >= 6)) notices.push(copy.weatherIndicatorUv);
  if (next24.some((hour) => hour.visibility !== null && hour.visibility > 0 && hour.visibility < 3000)) notices.push(copy.weatherIndicatorVisibility);
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
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (/\bPM\b/i.test(time) && hour < 12) hour += 12;
    if (/\bAM\b/i.test(time) && hour === 12) hour = 0;
    const targetMinutes = hour * 60 + minute;
    const dateMatch = /(\d{4}-\d{2}-\d{2})/.exec(time);
    const sameDateHourly = dateMatch ? hourly.filter((point) => point.time.startsWith(dateMatch[1])) : hourly;
    const forecast = sameDateHourly.reduce<WeatherPoint | undefined>((closest, point) => {
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
