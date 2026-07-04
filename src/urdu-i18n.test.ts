import test from 'node:test';
import assert from 'node:assert/strict';
import { labels, languageDirection, languages, localeForLanguage } from './app-language.js';

test('Urdu is a first-class RTL app language', () => {
  assert.equal(languages.some((language) => language.code === 'ur'), true);
  assert.equal(languageDirection('ur'), 'rtl');
  assert.equal(languageDirection('ar'), 'rtl');
  assert.equal(languageDirection('fr'), 'ltr');
  assert.equal(localeForLanguage('ur'), 'ur-PK');
  assert.equal(localeForLanguage('fr'), 'fr-FR');
  assert.equal(labels.ur.qiblaRequestMotion, 'براہِ راست قطب نما شروع کریں');
});
