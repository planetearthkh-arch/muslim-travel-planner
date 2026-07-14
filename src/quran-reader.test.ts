import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeQuranGlossary, normalizeQuranVoiceInput, parseQuranVoiceCommand } from './quran-reader.js';

test('normalizes Arabic voice input', () => {
  assert.equal(normalizeQuranVoiceInput('الصفحةُ التَّالية!'), 'الصفحه التاليه');
});

test('recognizes Arabic and English page commands', () => {
  assert.equal(parseQuranVoiceCommand('الصفحة التالية'), 'next');
  assert.equal(parseQuranVoiceCommand('اقلب الصفحة'), 'next');
  assert.equal(parseQuranVoiceCommand('next page'), 'next');
  assert.equal(parseQuranVoiceCommand('الصفحة السابقة'), 'previous');
  assert.equal(parseQuranVoiceCommand('go back'), 'previous');
  assert.equal(parseQuranVoiceCommand('أوقف الاستماع'), 'stop');
  assert.equal(parseQuranVoiceCommand('كلام غير معروف'), 'unknown');
});

test('shows the meaning of a repeated word only once', () => {
  const entries = dedupeQuranGlossary([
    { word: 'يؤمنون', meaning: 'يصدقون.' },
    { word: 'يُؤْمِنُونَ', meaning: 'يصدقون بما أنزل الله.' },
    { word: 'ينفقون', meaning: 'يخرجون من أموالهم.' },
  ]);

  assert.deepEqual(entries, [
    { word: 'يؤمنون', meaning: 'يصدقون.' },
    { word: 'ينفقون', meaning: 'يخرجون من أموالهم.' },
  ]);
});
