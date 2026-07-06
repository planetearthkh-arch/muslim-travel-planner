import assert from 'node:assert/strict';
import test from 'node:test';

const releaseLanguages = ['en', 'ar', 'id', 'ms', 'tr', 'fr', 'ur'] as const;

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{
    readFile: (path: URL, encoding: string) => Promise<string>;
  }>;
  const fs = await load('node:fs/promises');
  return fs.readFile(new URL('../' + path, import.meta.url), 'utf8');
}

test('release quality corrections provide non-empty release labels for every supported language', async () => {
  const corrections = await repoFile('src/release-quality-corrections.ts');

  for (const language of releaseLanguages) {
    assert.match(
      corrections,
      new RegExp(`${language}:\\s*\\{[\\s\\S]*?prototype:\\s*'[^']+'`),
      `${language} should have a non-empty release label`,
    );
  }
  assert.equal(corrections.includes("prototype: ''"), false);
});

test('localized Apple Maps actions do not silently inherit English in added languages', async () => {
  const corrections = await repoFile('src/release-quality-corrections.ts');

  assert.match(corrections, /id:\s*\{[\s\S]*?prayerAppleMaps:\s*'Buka di Apple Maps'/);
  assert.match(corrections, /ms:\s*\{[\s\S]*?prayerAppleMaps:\s*'Buka dalam Apple Maps'/);
  assert.match(corrections, /tr:\s*\{[\s\S]*?prayerAppleMaps:\s*'Apple Haritalar’da aç'/);
  assert.match(corrections, /ur:\s*\{[\s\S]*?prayerAppleMaps:\s*'Apple Maps میں کھولیں'/);
});

test('release quality corrections are applied without changing approved app identity', async () => {
  const appLanguage = await repoFile('src/app-language.ts');

  assert.equal(appLanguage.includes("import { releaseQualityLabelCorrections } from './release-quality-corrections.js';"), true);
  for (const language of releaseLanguages) {
    assert.equal(appLanguage.includes(`...releaseQualityLabelCorrections.${language}`), true);
  }
  assert.equal(appLanguage.includes("title: 'SafarOne'"), false);
});
