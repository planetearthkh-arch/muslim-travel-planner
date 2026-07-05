import assert from 'node:assert/strict';
import test from 'node:test';
import { labels, languages, languageDirection, localeForLanguage } from './app-language.js';
import './turkish-halal-copy.js';

// Release guard: every supported language must remain complete and professionally named.
const expectedIdentity = {
  en: ['SafarOne', 'Muslim Travel Planner'],
  ar: ['SafarOne', 'مخطط سفر للمسلمين'],
  id: ['SafarOne', 'Perencana Perjalanan Muslim'],
  ms: ['SafarOne', 'Perancang Perjalanan Muslim'],
  tr: ['SafarOne', 'Müslüman Seyahat Planlayıcısı'],
  fr: ['SafarOne', 'Planificateur de voyage musulman'],
  ur: ['SafarOne', 'مسلمان سفری منصوبہ ساز'],
} as const;

test('all supported languages have the same complete label key set and correct identity', () => {
  const englishKeys = Object.keys(labels.en).sort();
  assert.deepEqual(languages.map((item) => item.code), ['en', 'ar', 'id', 'ms', 'tr', 'fr', 'ur']);
  for (const { code } of languages) {
    assert.deepEqual(Object.keys(labels[code]).sort(), englishKeys);
    assert.equal(labels[code].title, expectedIdentity[code][0]);
    assert.equal(labels[code].subtitle, expectedIdentity[code][1]);
    for (const [key, value] of Object.entries(labels[code])) {
      if (key === 'prototype') continue;
      assert.equal(value.trim().length > 0, true);
    }
  }
  assert.equal(languageDirection('ar'), 'rtl');
  assert.equal(languageDirection('ur'), 'rtl');
  assert.equal(localeForLanguage('ms'), 'ms-MY');
  assert.equal(localeForLanguage('ur'), 'ur-PK');
});

test('Indonesian and Malay halal labels are translated naturally', () => {
  assert.equal(labels.id.halalOnly, 'Hanya halal');
  assert.equal(labels.id.halalOptions, 'Pilihan halal');
  assert.equal(labels.ms.halalOnly, 'Halal sahaja');
  assert.equal(labels.ms.halalOptions, 'Pilihan halal');
  assert.equal(labels.ms.prayerWheelchair, 'Akses kerusi roda');
});

test('Malay release copy contains no known Indonesian placeholder vocabulary', () => {
  const banned = /\b(kota|izin|layanan|pencarian|ditemukan|menampilkan|tampaknya|mobil|resmi|tercantum|persyaratan|pengemudi|asuransi|kebijakan|kehabisan waktu|perbesar|urutkan|marker|terkonfirmasi|filter|kecocokan|lisensi|gambar|riwayat|favorit|kapasitas|visibilitas|zona)\b/i;
  for (const value of Object.values(labels.ms)) assert.equal(banned.test(value), false);
});

test('Turkish runtime corrections replace generated placeholder travel-tool copy', () => {
  const copy = labels.tr;
  for (const key of Object.keys(copy).filter((key) => /^(carRental|publicTransport|taxi|attractions|toilets)/.test(key))) {
    assert.equal(/\b(öğe|alt başlık)\b/i.test(copy[key]), false);
  }
  assert.equal(copy.carRentalTitle, 'Araç Kiralama');
  assert.equal(copy.publicTransportTitle, 'Toplu Taşıma');
  assert.equal(copy.taxiTitle, 'Taksi Hizmetleri');
  assert.equal(copy.attractionsTitle, 'Gezilecek Yerler');
  assert.equal(copy.toiletsTitle, 'Umumi Tuvaletler');
});

test('Apple Maps remains a product name rather than an untranslated UI defect', () => {
  assert.equal(labels.en.prayerAppleMaps, 'Apple Maps');
  assert.equal(labels.id.prayerAppleMaps, 'Apple Maps');
  assert.equal(labels.ms.prayerAppleMaps, 'Apple Maps');
  assert.equal(labels.tr.prayerAppleMaps, 'Apple Maps');
  assert.equal(labels.ur.prayerAppleMaps, 'Apple Maps');
});
