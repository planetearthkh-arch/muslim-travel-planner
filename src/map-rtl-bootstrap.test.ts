import assert from 'node:assert/strict';
import test from 'node:test';
import { LATIN_MAP_NAME_EXPRESSION, containsRawMapName } from './map-rtl-bootstrap.js';

async function repoFile(path: string) {
  const load = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{ readFile: (path: URL, encoding: string) => Promise<string> }>;
  return load('node:fs/promises').then((fs) => fs.readFile(new URL('../' + path, import.meta.url), 'utf8'));
}

test('Latin map policy detects only the unsafe raw name getter', () => {
  assert.equal(containsRawMapName(['get', 'name']), true);
  assert.equal(containsRawMapName(['coalesce', ['get', 'name:en'], ['get', 'name']]), true);
  assert.equal(containsRawMapName(['get', 'name:en']), false);
  assert.equal(containsRawMapName(['get', 'name:latin']), false);
  assert.equal(containsRawMapName('name'), false);
});

test('map label replacement contains only English, Latin, international and reference fields', () => {
  const serialized = JSON.stringify(LATIN_MAP_NAME_EXPRESSION);
  for (const field of ['name:en', 'name_en', 'name:latin', 'int_name', 'official_name:en', 'short_name:en', 'ref']) {
    assert.equal(serialized.includes(field), true);
  }
  assert.equal(containsRawMapName(LATIN_MAP_NAME_EXPRESSION), false);
});

test('label policy loads before main and no longer downloads an RTL plugin', async () => {
  const html = await repoFile('index.html');
  const policy = await repoFile('src/map-rtl-bootstrap.ts');
  const worker = await repoFile('public/sw.js');

  assert.equal(html.indexOf('/src/map-rtl-bootstrap.ts') < html.indexOf('/src/main.ts'), true);
  assert.equal(policy.includes('setRTLTextPlugin'), false);
  assert.equal(policy.includes('fetch('), false);
  assert.equal(policy.includes('unpkg.com'), false);
  assert.match(worker, /mtp-app-shell-v17/);
});

test('prayer search sanitizes live, cached, and bundled results', async () => {
  const bootstrap = await repoFile('src/prayer-search-bootstrap.ts');
  assert.match(bootstrap, /sanitizePrayerPayload/);
  assert.match(bootstrap, /live-sanitized/);
  assert.match(bootstrap, /sanitizedFallback/);
});
