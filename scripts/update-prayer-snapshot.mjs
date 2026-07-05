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
const aqsaBox = '(31.7758,35.2325,31.7809,35.2375)';
const aqsaPattern = 'Al[- ]?Aqsa|Masjid[ -]?Al[- ]?Aqsa|Masjid[ -]?Aqsa|الأقصى|الاقصى';

const batches = [
  {
    name: 'mosques',
    required: true,
    selectors: [`nwr["amenity"="place_of_worship"]["religion"="muslim"]${around}`],
  },
  {
    name: 'islamic-centres',
    required: false,
    selectors: [`nwr["amenity"="community_centre"]["religion"="muslim"]${around}`],
  },
  {
    name: 'prayer-room-amenities',
    required: false,
    selectors: [`nwr["amenity"="prayer_room"]${around}`],
  },
  {
    name: 'prayer-room-rooms',
    required: false,
    selectors: [`nwr["room"="prayer"]${around}`],
  },
  {
    name: 'prayer-room-flags',
    required: false,
    selectors: [`nwr["prayer_room"="yes"]${around}`],
  },
  {
    name: 'al-aqsa-parent',
    required: false,
    selectors: ['name', 'name:en', 'name:ar', 'official_name', 'official_name:en', 'official_name:ar']
      .map((key) => `nwr["${key}"~"${aqsaPattern}",i]${aqsaBox}`),
  },
];

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

function batchQuery(selectors) {
  return `[out:json][timeout:25];(${selectors.join(';')};);out center tags;`;
}

async function requestBatch(endpoint, selectors) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: `data=${encodeURIComponent(batchQuery(selectors))}`,
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
    return [...unique.values()];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBatch(batch) {
  let lastError;
  for (const endpoint of endpoints) {
    try {
      const elements = await requestBatch(endpoint, batch.selectors);
      console.log(`Prayer snapshot ${batch.name}: ${elements.length} records from ${new URL(endpoint).hostname}`);
      return elements;
    } catch (error) {
      lastError = error;
      console.warn(`Prayer snapshot ${batch.name} provider failed: ${new URL(endpoint).hostname} (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  if (batch.required) throw lastError ?? new Error(`No provider returned ${batch.name}`);
  console.warn(`Prayer snapshot optional batch skipped: ${batch.name}`);
  return [];
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

try {
  const unique = new Map();
  for (const batch of batches) {
    for (const element of await fetchBatch(batch)) unique.set(`${element.type}/${element.id}`, element);
  }
  const elements = [...unique.values()];
  if (elements.length < 5) throw new Error(`Only ${elements.length} usable prayer places collected`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, moduleSource(elements), 'utf8');
  console.log(`Prayer snapshot complete: ${elements.length} unique records.`);
} catch (error) {
  if (await hasUsableCommittedSnapshot()) {
    console.warn(`Prayer snapshot refresh failed; preserving the usable committed snapshot (${error instanceof Error ? error.message : String(error)}).`);
  } else {
    throw new Error(`Refusing to ship an empty Jerusalem prayer snapshot: ${error instanceof Error ? error.message : String(error)}`);
  }
}
