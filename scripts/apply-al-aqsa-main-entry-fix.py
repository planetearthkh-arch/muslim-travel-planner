from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match in {path}, found {count}: {old!r}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "src/prayer-spaces.ts",
    """const hasAffirmingValue = (value: string | undefined) => !!value && /^(yes|designated|available|separate|female|true|1)$/i.test(value);
const hasMuslimSignal = (tags: OsmTags) => tags.religion === 'muslim' || tags.denomination === 'sunni' || tags.denomination === 'shia' || tags.muslim === 'yes';
""",
    """const hasAffirmingValue = (value: string | undefined) => !!value && /^(yes|designated|available|separate|female|true|1)$/i.test(value);
const hasMuslimSignal = (tags: OsmTags) => tags.religion === 'muslim' || tags.denomination === 'sunni' || tags.denomination === 'shia' || tags.muslim === 'yes';
const alAqsaMainNamePattern = /\\bal[-\\s]?aqsa\\b|\\bmasjid\\s+(?:al[-\\s]?)?aqsa\\b|المسجد\\s+الأقصى|المسجد\\s+الاقصى|مسجد\\s+الأقصى|مسجد\\s+الاقصى/iu;
""",
)

replace_once(
    "src/prayer-spaces.ts",
    """function isMainAlAqsaName(tags: OsmTags) {
  return prayerPlaceSearchableNames(tags).some((name) => /\\bal[-\\s]?aqsa\\b|المسجد\\s+الأقصى|المسجد\\s+الاقصى|مسجد\\s+الأقصى|مسجد\\s+الاقصى/iu.test(name));
}
""",
    """function isMainAlAqsaName(tags: OsmTags) {
  return prayerPlaceSearchableNames(tags).some((name) => alAqsaMainNamePattern.test(name));
}
""",
)

replace_once(
    "src/prayer-spaces.ts",
    """  const searchableName = [
    tags['name:en'],
    tags.name,
    tags.official_name,
    tags.short_name,
    tags.alt_name,
    tags.loc_name,
    tags.description,
  ].filter(Boolean).join(' ').toLowerCase();

  if (amenity === 'place_of_worship' && hasMuslimSignal(tags)) return 'mosque';
""",
    """  const searchableName = [
    tags['name:en'],
    tags.name,
    tags.official_name,
    tags.short_name,
    tags.alt_name,
    tags.loc_name,
    tags.description,
  ].filter(Boolean).join(' ').toLowerCase();

  if (isMainAlAqsaName(tags)) return 'mosque';
  if (amenity === 'place_of_worship' && hasMuslimSignal(tags)) return 'mosque';
""",
)

replace_once(
    "src/prayer-spaces.ts",
    """  const radiusMeters = Math.round(radiusKm * 1000);
  const around = `(around:${radiusMeters},${latitude},${longitude})`;
  const selectors = [
""",
    """  const radiusMeters = Math.round(radiusKm * 1000);
  const around = `(around:${radiusMeters},${latitude},${longitude})`;
  const alAqsaOverpassNamePattern = 'Al[- ]?Aqsa|Masjid[ -]?(?:al[- ]?)?Aqsa|الأقصى|الاقصى';
  const selectors = [
""",
)

replace_once(
    "src/prayer-spaces.ts",
    """    `relation[\"prayer_room\"=\"yes\"]${around}`,
  ];
""",
    """    `relation[\"prayer_room\"=\"yes\"]${around}`,
    `node[\"name\"~\"${alAqsaOverpassNamePattern}\",i]${around}`,
    `way[\"name\"~\"${alAqsaOverpassNamePattern}\",i]${around}`,
    `relation[\"name\"~\"${alAqsaOverpassNamePattern}\",i]${around}`,
    `node[\"name:en\"~\"${alAqsaOverpassNamePattern}\",i]${around}`,
    `way[\"name:en\"~\"${alAqsaOverpassNamePattern}\",i]${around}`,
    `relation[\"name:en\"~\"${alAqsaOverpassNamePattern}\",i]${around}`,
    `node[\"name:ar\"~\"${alAqsaOverpassNamePattern}\",i]${around}`,
    `way[\"name:ar\"~\"${alAqsaOverpassNamePattern}\",i]${around}`,
    `relation[\"name:ar\"~\"${alAqsaOverpassNamePattern}\",i]${around}`,
  ];
""",
)

path = Path("src/prayer-spaces-jerusalem.test.ts")
text = path.read_text()
text = text.replace(
    "import { isAlAqsaCompoundSubstructure, normalizePrayerPlace, type OverpassElement } from './prayer-spaces.js';",
    "import { buildOverpassQuery, classifyPrayerPlace, isAlAqsaCompoundSubstructure, normalizePrayerPlace, type OverpassElement } from './prayer-spaces.js';",
)
text += """

test('Al-Aqsa is accepted even when the OSM parent object lacks amenity and religion tags', () => {
  const parent: OverpassElement = {
    type: 'relation',
    id: 999,
    center: { lat: 31.7780, lon: 35.2354 },
    tags: { name: 'Al-Aqsa Mosque', 'name:ar': 'المسجد الأقصى' },
  };
  assert.equal(classifyPrayerPlace(parent.tags ?? {}), 'mosque');
  assert.equal(normalizePrayerPlace(parent, origin)?.name, 'Al-Aqsa Mosque');
});

test('the Overpass query explicitly requests Al-Aqsa parent objects by multilingual name', () => {
  const query = buildOverpassQuery(origin.latitude, origin.longitude, 5);
  assert.equal(query.includes('["name"~'), true);
  assert.equal(query.includes('["name:en"~'), true);
  assert.equal(query.includes('["name:ar"~'), true);
  assert.equal(query.includes('Aqsa'), true);
  assert.equal(query.includes('الأقصى'), true);
});
"""
path.write_text(text)
