from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one match in {path}, found {count}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "src/prayer-spaces.ts",
    """const hasAffirmingValue = (value: string | undefined) => !!value && /^(yes|designated|available|separate|female|true|1)$/i.test(value);
const hasMuslimSignal = (tags: OsmTags) => tags.religion === 'muslim' || tags.denomination === 'sunni' || tags.denomination === 'shia' || tags.muslim === 'yes';
""",
    """const hasAffirmingValue = (value: string | undefined) => !!value && /^(yes|designated|available|separate|female|true|1)$/i.test(value);
const hasMuslimSignal = (tags: OsmTags) => tags.religion === 'muslim' || tags.denomination === 'sunni' || tags.denomination === 'shia' || tags.muslim === 'yes';

const AL_AQSA_COMPOUND_BOUNDS = {
  south: 31.7758,
  north: 31.7809,
  west: 35.2325,
  east: 35.2375,
};

const alAqsaSubstructureNamePattern = /^(?:the\\s+)?(?:dome|qubbat|qubba)\\b|^قبة(?:\\s|$)/iu;

function prayerPlaceSearchableNames(tags: OsmTags) {
  return [
    tags['name:en'],
    tags.name,
    tags.official_name,
    tags.short_name,
    tags.alt_name,
    tags.loc_name,
  ].filter((value): value is string => Boolean(value)).map((value) => value.trim());
}

export function isAlAqsaCompoundSubstructure(tags: OsmTags, latitude: number, longitude: number) {
  const insideCompound = latitude >= AL_AQSA_COMPOUND_BOUNDS.south
    && latitude <= AL_AQSA_COMPOUND_BOUNDS.north
    && longitude >= AL_AQSA_COMPOUND_BOUNDS.west
    && longitude <= AL_AQSA_COMPOUND_BOUNDS.east;
  if (!insideCompound) return false;
  return prayerPlaceSearchableNames(tags).some((name) => alAqsaSubstructureNamePattern.test(name));
}
""",
)

replace_once(
    "src/prayer-spaces.ts",
    """  const type = classifyPrayerPlace(tags);
  if (!type || typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;

  const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;
""",
    """  const type = classifyPrayerPlace(tags);
  if (!type || typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;
  if (isAlAqsaCompoundSubstructure(tags, latitude, longitude)) return undefined;

  const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;
""",
)

Path("src/jerusalem-prayer-list.test.ts").write_text("""import assert from 'node:assert/strict';
import test from 'node:test';
import { isAlAqsaCompoundSubstructure, normalizePrayerPlace, type OverpassElement } from './prayer-spaces.js';

const origin = { latitude: 31.778, longitude: 35.235 };

function mosque(id: number, name: string, lat: number, lon: number): OverpassElement {
  return {
    type: 'node',
    id,
    lat,
    lon,
    tags: {
      amenity: 'place_of_worship',
      religion: 'muslim',
      name,
      'name:en': name,
    },
  };
}

test('dome-named substructures inside the Al-Aqsa compound are excluded', () => {
  const dome = mosque(1, 'Dome of the Chain', 31.7782, 35.2351);
  assert.equal(isAlAqsaCompoundSubstructure(dome.tags ?? {}, dome.lat ?? 0, dome.lon ?? 0), true);
  assert.equal(normalizePrayerPlace(dome, origin), undefined);
});

test('Arabic and transliterated dome names inside the compound are excluded', () => {
  const arabic = mosque(2, 'قبة الصخرة', 31.7780, 35.2354);
  const transliterated = mosque(3, 'Qubbat al-Silsila', 31.7783, 35.2350);
  assert.equal(normalizePrayerPlace(arabic, origin), undefined);
  assert.equal(normalizePrayerPlace(transliterated, origin), undefined);
});

test('Al-Aqsa Mosque itself remains in the prayer-place list', () => {
  const alAqsa = mosque(4, 'Al-Aqsa Mosque', 31.7769, 35.2353);
  const normalized = normalizePrayerPlace(alAqsa, origin);
  assert.equal(normalized?.name, 'Al-Aqsa Mosque');
  assert.equal(normalized?.type, 'mosque');
});

test('dome-named mosques outside the Al-Aqsa compound are not globally hidden', () => {
  const elsewhere = mosque(5, 'Dome Mosque', 31.90, 35.30);
  assert.equal(isAlAqsaCompoundSubstructure(elsewhere.tags ?? {}, elsewhere.lat ?? 0, elsewhere.lon ?? 0), false);
  assert.equal(normalizePrayerPlace(elsewhere, origin)?.name, 'Dome Mosque');
});
""")

project = Path("ios/App/App.xcodeproj/project.pbxproj")
project_text = project.read_text()
if project_text.count("CURRENT_PROJECT_VERSION = 103;") != 2:
    raise SystemExit("Expected two iOS build 103 entries")
project.write_text(project_text.replace("CURRENT_PROJECT_VERSION = 103;", "CURRENT_PROJECT_VERSION = 104;"))

verify = Path("scripts/verify-ios-version.mjs")
verify_text = verify.read_text()
if verify_text.count("103") != 2:
    raise SystemExit(f"Unexpected iOS verifier build references: {verify_text.count('103')}")
verify.write_text(verify_text.replace("103", "104"))

for test_path in [Path("src/release-audit-fixes.test.ts"), Path("src/deep-audit-fixes.test.ts")]:
    text = test_path.read_text()
    if "CURRENT_PROJECT_VERSION = 103;" not in text:
        raise SystemExit(f"Missing build 103 assertion in {test_path}")
    test_path.write_text(text.replace("CURRENT_PROJECT_VERSION = 103;", "CURRENT_PROJECT_VERSION = 104;"))
