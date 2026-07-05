import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const outputUrl = new URL('../src/generated/jerusalem-prayer-snapshot.ts', import.meta.url);
const outputPath = fileURLToPath(outputUrl);
const endpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const center = { latitude: 31.7783, longitude: 35.2354 };
const radiusKm = 25;
const around = `(around:${radiusKm * 1000},${center.latitude},${center.longitude})`;
const selectors = [
  `node["amenity"="place_of_worship"]["religion"="muslim"]${around}`,
  `way["amenity"="place_of_worship"]["religion"="muslim"]${around}`,
  `relation["amenity"="place_of_worship"]["religion"="muslim"]${around}`,
  `node["amenity"="community_centre"]["religion"="muslim"]${around}`,
  `way["amenity"="community_centre"]["religion"="muslim"]${around}`,
  `relation["amenity"="community_centre"]["religion"="muslim"]${around}`,
  `node["amenity"="prayer_room"]${around}`,
  `way["amenity"="prayer_room"]${around}`,
  `relation["amenity"="prayer_room"]${around}`,
  `node["room"="prayer"]${around}`,
  `way["room"="prayer"]${around}`,
  `relation["room"="prayer"]${around}`,
  `node["prayer_room"="yes"]${around}`,
  `way["prayer_room"="yes"]${around}`,
  `relation["prayer_room"="yes"]${around}`,
];
const aqsaPattern = 'Al[- ]?Aqsa|Masjid[ -]?Al[- ]?Aqsa|Masjid[ -]?Aqsa|الأقصى|الاقصى';
for (const key of ['name', 'name:en', 'name:ar', 'official_name', 'official_name:en', 'official_name:ar']) {
  selectors.push(`node["${key}"~"${aqsaPattern}",i]${around}`);
  selectors.push(`way["${key}"~"${aqsaPattern}",i]${around}`);
  selectors.push(`relation["${key}"~"${aqsaPattern}",i]${around}`);
}
const query = `[out:json][timeout:25];(${selectors.join(';')};);out center tags;`;

const allowedTags = new Set([
  'amenity', 'religion', 'denomination', 'muslim', 'room', 'prayer_room',
  'name', 'name:en', 'name:ar', 'official_name', 'official_name:en', 'official_name:ar',
  'short_name', 'short_name:en', 'alt_name', 'alt_name:en', 'alt_name:ar', 'loc_name', 'int_name',
  'addr:housenumber', 'addr:street', 'addr:suburb', 'addr:city', 'addr:postcode', 'addr:country',
  'opening_hours', 'female', 'women', 'prayer:female', 'prayer_room:female', 'female:prayer_room',
  'wudu', 'ablution', 'toilets:wudu', 'washing:feet', 'wheelchair',
  'website', 'contact_website', 'contact:website', 'phone', 'contact_phone', 'contact:phone',
]);

function cleanElement(value) {
  if (!value || typeof value !== 'object' || typeof value.type !== 'string' || typeof value.id !== 'number') return undefined;
  const tags = {};
  if (value.tags && typeof value.tags === 'object') {
    for (const [key, tagValue] of Object.entries(value.tags)) {
      if (allowedTags.has(key) && typeof tagValue === 'string') tags[key] = tagValue;
    }
  }
  const element = { type: value.type, id: value.id };
  if (typeof value.lat === 'number') element.lat = value.lat;
  if (typeof value.lon === 'number') element.lon = value.lon;
  if (value.center && typeof value.center.lat === 'number' && typeof value.center.lon === 'number') {
    element.center = { lat: value.center.lat, lon: value.center.lon };
  }
  element.tags = tags;
  return element;
}

async function fetchSnapshot(endpoint) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.elements)) throw new Error('Invalid Overpass response');
    const unique = new Map();
    for (const raw of payload.elements) {
      const element = cleanElement(raw);
      if (element) unique.set(`${element.type}/${element.id}`, element);
    }
    const elements = [...unique.values()];
    if (elements.length < 5) throw new Error(`Only ${elements.length} usable prayer places returned`);
    return elements;
  } finally {
    clearTimeout(timeout);
  }
}

function moduleSource(elements) {
  const snapshot = {
    generatedAt: new Date().toISOString(),
    center,
    radiusKm,
    elements,
  };
  return `import type { PrayerSearchSnapshot } from '../prayer-search-fallback.js';\n\nexport const JERUSALEM_PRAYER_SNAPSHOT: PrayerSearchSnapshot = ${JSON.stringify(snapshot, null, 2)};\n`;
}

async function hasUsableCommittedSnapshot() {
  try {
    const source = await readFile(outputPath, 'utf8');
    const hasTimestamp = /(generatedAt|"generatedAt")\s*:\s*['"][^'"]+['"]/.test(source);
    const emptyElements = /(elements|"elements")\s*:\s*\[\s*\]/.test(source);
    const recordCount = (source.match(/"type"\s*:\s*"(node|way|relation)"/g) ?? []).length;
    return hasTimestamp && !emptyElements && recordCount >= 5;
  } catch {
    return false;
  }
}

let elements;
for (const endpoint of endpoints) {
  try {
    elements = await fetchSnapshot(endpoint);
    console.log(`Prayer snapshot: ${elements.length} records from ${new URL(endpoint).hostname}`);
    break;
  } catch (error) {
    console.warn(`Prayer snapshot provider failed: ${new URL(endpoint).hostname} (${error instanceof Error ? error.message : String(error)})`);
  }
}

if (elements) {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, moduleSource(elements), 'utf8');
} else if (await hasUsableCommittedSnapshot()) {
  console.warn('Prayer snapshot refresh failed; preserving the usable committed snapshot.');
} else {
  throw new Error('Refusing to ship an empty Jerusalem prayer snapshot.');
}
