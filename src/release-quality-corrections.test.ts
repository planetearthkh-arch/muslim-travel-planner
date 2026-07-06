import assert from 'node:assert/strict';
import test from 'node:test';
import { labels, languages } from './app-language.js';

const englishAppleMapsLabel = labels.en.prayerAppleMaps;

test('all release languages have a non-empty release label', () => {
  for (const language of languages) {
    assert.equal(typeof labels[language.code].prototype, 'string');
    assert.notEqual(labels[language.code].prototype.trim(), '', `${language.code} prototype label should not be empty`);
  }
});

test('localized Apple Maps actions are natural instructions outside English and French', () => {
  for (const language of ['id', 'ms', 'tr', 'ur'] as const) {
    assert.notEqual(labels[language].prayerAppleMaps, englishAppleMapsLabel, `${language} should not silently inherit the English action label`);
    assert.equal(labels[language].prayerAppleMaps.includes('Apple Maps'), true);
  }
});

test('release quality corrections preserve approved app identity', () => {
  assert.equal(labels.en.title, 'SafarOne');
  assert.equal(labels.en.subtitle, 'Muslim Travel Planner');
  assert.equal(labels.ar.title, 'SafarOne');
  assert.equal(labels.id.title, 'SafarOne');
  assert.equal(labels.ms.title, 'SafarOne');
  assert.equal(labels.tr.title, 'SafarOne');
  assert.equal(labels.fr.title, 'SafarOne');
  assert.equal(labels.ur.title, 'SafarOne');
});
