import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWeatherUrl, validateWeatherResponse, type WeatherUnits } from './weather.js';

const units: WeatherUnits = { temperature: 'celsius', wind: 'kmh', precipitation: 'mm' };

function repeat<T>(value: T) {
  return Array.from({ length: 7 }, () => value);
}

function validWeatherResponse() {
  const dailyDates = Array.from({ length: 7 }, (_, index) => `2026-07-${String(6 + index).padStart(2, '0')}`);
  return {
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London',
    current: {
      time: '2026-07-06T12:00',
      temperature_2m: 22,
      apparent_temperature: 21,
      relative_humidity_2m: 50,
      precipitation: 0,
      rain: 0,
      showers: 0,
      snowfall: 0,
      weather_code: 0,
      cloud_cover: 10,
      wind_speed_10m: 12,
      wind_direction_10m: 180,
      wind_gusts_10m: 18,
      is_day: 1,
    },
    hourly: {
      time: ['2026-07-06T12:00'],
      temperature_2m: [22],
      apparent_temperature: [21],
      relative_humidity_2m: [50],
      precipitation_probability: [10],
      precipitation: [0],
      rain: [0],
      showers: [0],
      snowfall: [0],
      weather_code: [0],
      cloud_cover: [10],
      visibility: [10000],
      wind_speed_10m: [12],
      wind_direction_10m: [180],
      wind_gusts_10m: [18],
      uv_index: [4],
      is_day: [1],
    },
    daily: {
      time: dailyDates,
      weather_code: repeat(0),
      temperature_2m_max: repeat(24),
      temperature_2m_min: repeat(16),
      apparent_temperature_max: repeat(23),
      apparent_temperature_min: repeat(15),
      sunrise: dailyDates.map((date) => `${date}T05:00`),
      sunset: dailyDates.map((date) => `${date}T21:00`),
      daylight_duration: repeat(57600),
      sunshine_duration: repeat(36000),
      uv_index_max: repeat(6),
      precipitation_sum: repeat(0),
      rain_sum: repeat(0),
      showers_sum: repeat(0),
      snowfall_sum: repeat(0),
      precipitation_probability_max: repeat(20),
      wind_speed_10m_max: repeat(20),
      wind_gusts_10m_max: repeat(30),
      wind_direction_10m_dominant: repeat(180),
    },
  };
}

test('buildWeatherUrl rejects malformed request coordinates', () => {
  assert.throws(() => buildWeatherUrl(Number.NaN, -0.1278, units), /Invalid weather coordinates/);
  assert.throws(() => buildWeatherUrl(51.5074, Number.POSITIVE_INFINITY, units), /Invalid weather coordinates/);
  assert.throws(() => buildWeatherUrl(95, -0.1278, units), /Invalid weather coordinates/);
  assert.throws(() => buildWeatherUrl(51.5074, 190, units), /Invalid weather coordinates/);
});

test('validateWeatherResponse rejects out-of-range provider coordinates', () => {
  assert.throws(() => validateWeatherResponse({ ...validWeatherResponse(), latitude: 95 }), /Invalid weather coordinates/);
  assert.throws(() => validateWeatherResponse({ ...validWeatherResponse(), longitude: 190 }), /Invalid weather coordinates/);
});

test('weather coordinate hardening keeps valid forecasts usable', () => {
  const url = buildWeatherUrl(51.5074, -0.1278, units, 'https://weather.example.test/forecast');
  assert.match(url, /^https:\/\/weather\.example\.test\/forecast\?/);
  assert.match(url, /latitude=51\.5074/);
  assert.match(url, /longitude=-0\.1278/);

  const forecast = validateWeatherResponse(validWeatherResponse(), '2026-07-06T12:30:00.000Z');
  assert.equal(forecast.latitude, 51.5074);
  assert.equal(forecast.longitude, -0.1278);
  assert.equal(forecast.timezone, 'Europe/London');
  assert.equal(forecast.cached, false);
  assert.equal(forecast.current.temperature, 22);
  assert.equal(forecast.hourly.length, 1);
  assert.equal(forecast.daily.length, 7);
});
