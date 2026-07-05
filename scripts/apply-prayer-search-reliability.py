from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match in {path}, found {count}: {old!r}")
    file.write_text(text.replace(old, new, 1))


# Prayer-place query portability and duplicate merging.
replace_once(
    "src/prayer-spaces.ts",
    """function queryCanReachAlAqsa(latitude: number, longitude: number, radiusKm: number) {
  return distanceKm(latitude, longitude, AL_AQSA_CENTER.latitude, AL_AQSA_CENTER.longitude) <= radiusKm + 1.5;
}

export function buildOverpassQuery(latitude: number, longitude: number, radiusKm: number) {
""",
    """function prayerPlaceRichness(place: PrayerPlace) {
  return Number(place.verification === 'Verified') * 8
    + Number(!generatedPrayerFallbackPattern.test(place.name)) * 8
    + Number(Boolean(place.address)) * 3
    + Number(Boolean(place.openingHours)) * 2
    + Number(Boolean(place.website)) * 2
    + Number(Boolean(place.telephone)) * 2
    + Number(place.womenPrayerArea === 'Verified')
    + Number(place.wudu === 'Verified')
    + Number(place.wheelchair === 'Verified');
}

function mergePrayerPlaces(first: PrayerPlace, second: PrayerPlace) {
  const preferred = prayerPlaceRichness(second) > prayerPlaceRichness(first) ? second : first;
  const other = preferred === first ? second : first;
  const verified = (a: PrayerVerification, b: PrayerVerification): PrayerVerification => a === 'Verified' || b === 'Verified' ? 'Verified' : 'Unverified';
  return {
    ...preferred,
    id: first.id,
    distanceKm: Math.min(first.distanceKm, second.distanceKm),
    address: preferred.address || other.address,
    openingHours: preferred.openingHours || other.openingHours,
    website: preferred.website || other.website,
    telephone: preferred.telephone || other.telephone,
    verification: verified(first.verification, second.verification),
    womenPrayerArea: verified(first.womenPrayerArea, second.womenPrayerArea),
    wudu: verified(first.wudu, second.wudu),
    wheelchair: verified(first.wheelchair, second.wheelchair),
  };
}

export function dedupePrayerPlaces(places: PrayerPlace[]) {
  const deduped: PrayerPlace[] = [];
  for (const place of [...places].sort((a, b) => a.distanceKm - b.distanceKm)) {
    const fallback = generatedPrayerFallbackPattern.test(place.name);
    const identity = fallback ? '' : normalizedPrayerIdentityName(place.name);
    const duplicateIndex = deduped.findIndex((candidate) => {
      if (candidate.id === place.id) return true;
      if (!identity || generatedPrayerFallbackPattern.test(candidate.name)) return false;
      return candidate.type === place.type
        && normalizedPrayerIdentityName(candidate.name) === identity
        && distanceKm(candidate.latitude, candidate.longitude, place.latitude, place.longitude) <= 0.3;
    });
    if (duplicateIndex < 0) deduped.push(place);
    else deduped[duplicateIndex] = mergePrayerPlaces(deduped[duplicateIndex], place);
  }
  return deduped;
}

function queryCanReachAlAqsa(latitude: number, longitude: number, radiusKm: number) {
  return distanceKm(latitude, longitude, AL_AQSA_CENTER.latitude, AL_AQSA_CENTER.longitude) <= radiusKm + 1.5;
}

export function isPortableOverpassQuery(query: string) {
  return !/(?:\\(\\?:|\\(\\?=|\\(\\?!|\\(\\?<|\\\\[1-9])/.test(query);
}

export function buildOverpassQuery(latitude: number, longitude: number, radiusKm: number) {
""",
)

replace_once(
    "src/prayer-spaces.ts",
    """    const namePattern = 'Al[- ]?Aqsa|Masjid[ -]?(?:al[- ]?)?Aqsa|الأقصى|الاقصى';
""",
    """    const namePattern = 'Al[- ]?Aqsa|Masjid[ -]?Al[- ]?Aqsa|Masjid[ -]?Aqsa|الأقصى|الاقصى';
""",
)

replace_once(
    "src/prayer-spaces.ts",
    """  return `[out:json][timeout:25];(${selectors.join(';')};);out center tags;`;
}
""",
    """  const query = `[out:json][timeout:25];(${selectors.join(';')};);out center tags;`;
  if (!isPortableOverpassQuery(query)) throw new Error('Generated an unsupported Overpass regular expression');
  return query;
}
""",
)

# Add regression coverage for portable queries and robust duplicate merging.
replace_once(
    "src/prayer-spaces-global.test.ts",
    """import { normalizePrayerPlace, type OverpassElement, type OsmTags } from './prayer-spaces.js';
""",
    """import { buildOverpassQuery, dedupePrayerPlaces, isPortableOverpassQuery, normalizePrayerPlace, type OverpassElement, type OsmTags } from './prayer-spaces.js';
""",
)

Path("src/prayer-spaces-global.test.ts").write_text(
    Path("src/prayer-spaces-global.test.ts").read_text()
    + """

test('Jerusalem Overpass query uses portable regular-expression syntax', () => {
  const query = buildOverpassQuery(31.778, 35.235, 10);
  assert.equal(isPortableOverpassQuery(query), true);
  assert.equal(query.includes('(?:'), false);
  assert.equal(query.includes('Masjid[ -]?Al[- ]?Aqsa'), true);
});

test('duplicate wording variants merge even when coordinate grid cells differ', () => {
  const first = normalizePrayerPlace(place(90, { name: 'Mosque of Omar', 'name:en': 'Mosque of Omar', phone: '+1' }, 51.50060, -0.10060, 'node'), origin);
  const second = normalizePrayerPlace(place(91, { name: 'Omar Mosque', 'name:en': 'Omar Mosque', website: 'https://example.com' }, 51.50120, -0.10120, 'way'), origin);
  if (!first || !second) throw new Error('Expected both duplicate records to normalize');
  const deduped = dedupePrayerPlaces([first, second]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].telephone, '+1');
  assert.equal(deduped[0].website, 'https://example.com/');
});
"""
)

# Main app: shared endpoint failover, form-encoded Overpass requests, geocoder fallback, and stale-cache recovery.
replace_once(
    "src/main.ts",
    """import { requestHalalWithFailover } from './halal-overpass.js';
""",
    """import { requestHalalWithFailover } from './halal-overpass.js';
import { geocodeDestinationWithFailover } from './destination-geocoding.js';
import { overpassFormBody, overpassRequestHeaders, requestOverpassWithFailover } from './overpass-failover.js';
""",
)

replace_once(
    "src/main.ts",
    """import { buildOverpassQuery, ensureLatinDisplayName, getEnglishPlaceName, isReliablyOpenNow, normalizePrayerPlace, type PrayerPlace, type PrayerPlaceType } from './prayer-spaces.js';
""",
    """import { buildOverpassQuery, dedupePrayerPlaces, ensureLatinDisplayName, getEnglishPlaceName, isReliablyOpenNow, normalizePrayerPlace, type PrayerPlace, type PrayerPlaceType } from './prayer-spaces.js';
""",
)

replace_once(
    "src/main.ts",
    """type NominatimResult = { lat: string; lon: string; display_name: string; address?: { city?: string; town?: string; village?: string; municipality?: string; county?: string; state?: string; country?: string } };

""",
    """,
)

replace_once(
    "src/main.ts",
    """    const body = buildOverpassQuery(searchCenter.latitude, searchCenter.longitude, searchRadius);
    const data = await requestOverpass(overpassUrl(), { method: 'POST', body, signal: abortSignal }, 18000);
    if (!isCurrentPrayerSearch()) return;
    const deduped = new Map<string, PrayerPlace>();
    for (const element of data.elements ?? []) {
      const place = normalizePrayerPlace(element, searchCenter);
      if (place) deduped.set(place.id, place);
    }
    if (!isCurrentPrayerSearch()) return;
    prayerResults = [...deduped.values()].sort((a, b) => a.distanceKm - b.distanceKm);
""",
    """    const body = buildOverpassQuery(searchCenter.latitude, searchCenter.longitude, searchRadius);
    const data = await requestOverpassWithFailover(
      overpassUrl(),
      45_000,
      async (endpoint, endpointTimeoutMs) => validateOverpassResponse(
        await requestJson<unknown>(
          endpoint,
          {
            method: 'POST',
            body: overpassFormBody(body),
            headers: overpassRequestHeaders(),
            signal: abortSignal,
          },
          endpointTimeoutMs,
        ),
      ),
    );
    if (!isCurrentPrayerSearch()) return;
    const normalized = (data.elements ?? [])
      .map((element) => normalizePrayerPlace(element, searchCenter))
      .filter((place): place is PrayerPlace => Boolean(place));
    if (!isCurrentPrayerSearch()) return;
    prayerResults = dedupePrayerPlaces(normalized).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 350);
""",
)

replace_once(
    "src/main.ts",
    """    if (classifyRequestError(error).kind === 'aborted') return;
    prayerStatus = 'service-unavailable';
    prayerError = labels[lang].prayerServiceUnavailable;
""",
    """    if (classifyRequestError(error).kind === 'aborted') return;
    if (cached?.results.length) {
      prayerResults = cached.results;
      prayerStatus = 'ready';
      prayerError = '';
    } else {
      prayerResults = [];
      prayerStatus = 'service-unavailable';
      prayerError = labels[lang].prayerServiceUnavailable;
    }
""",
)

replace_once(
    "src/main.ts",
    """  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&accept-language=en&q=${encodeURIComponent(trimmed)}`;
  const data = await requestJson<NominatimResult[]>(url, { headers: { Accept: 'application/json' } }, 12000);
  const first = data[0];
  const latitude = first ? Number(first.lat) : Number.NaN;
  const longitude = first ? Number(first.lon) : Number.NaN;
  const center = first && Number.isFinite(latitude) && Number.isFinite(longitude)
    ? {
      latitude,
      longitude,
      label: first.display_name,
      city: first.address?.city || first.address?.town || first.address?.village || first.address?.municipality || first.address?.county || first.address?.state,
      country: first.address?.country,
      timezone: await resolveTimeZoneForCoordinates(latitude, longitude),
    }
    : undefined;
""",
    """  const geocoded = await geocodeDestinationWithFailover(
    trimmed,
    (url, timeoutMilliseconds) => requestJson<unknown>(url, { headers: { Accept: 'application/json' } }, timeoutMilliseconds),
  );
  const center = geocoded
    ? {
      ...geocoded,
      timezone: geocoded.timezone ?? await resolveTimeZoneForCoordinates(geocoded.latitude, geocoded.longitude),
    }
    : undefined;
""",
)
