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

interface SafarMateWeatherPlugin {
  forecast(options: NativeWeatherRequest): Promise<WeatherForecast>;
}

const nativeWeather = registerPlugin<SafarMateWeatherPlugin>('SafarMateWeather');

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

export function validateNativeWeatherForecast(value: unknown): WeatherForecast {
  if (!value || typeof value !== 'object') throw new Error('Malformed Apple Weather response');
  const forecast = value as Partial<WeatherForecast>;
  if (!finite(forecast.latitude) || !finite(forecast.longitude)) throw new Error('Malformed Apple Weather coordinates');
  if (typeof forecast.timezone !== 'string' || typeof forecast.retrievedAt !== 'string') throw new Error('Malformed Apple Weather metadata');
  if (!validPoint(forecast.current)) throw new Error('Malformed Apple current weather');
  if (!Array.isArray(forecast.hourly) || forecast.hourly.length < 1 || !forecast.hourly.every(validPoint)) throw new Error('Malformed Apple hourly weather');
  if (!Array.isArray(forecast.daily) || forecast.daily.length < 7 || !forecast.daily.every(validDay)) throw new Error('Malformed Apple daily weather');
  return forecast as WeatherForecast;
}

export async function requestNativeWeather(
  latitude: number,
  longitude: number,
  timezone: string | undefined,
  units: WeatherUnits,
): Promise<WeatherForecast> {
  if (!isNativeWeatherPlatform()) throw new Error('Apple Weather is available only in the iPhone app');
  return validateNativeWeatherForecast(await nativeWeather.forecast({
    latitude,
    longitude,
    timezone,
    temperatureUnit: units.temperature,
    windUnit: units.wind,
    precipitationUnit: units.precipitation,
  }));
}
