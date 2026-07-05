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
    "  let result = titleCaseLatin(value)\n",
    "  let result = cleanLatinName(value)\n",
)

replace_once(
    "src/prayer-spaces.ts",
    """  } else if (type === 'prayer-room' || type === 'quiet-space') {
    if (/^Prayer Room\\s+(.+)$/i.test(result)) result = result.replace(/^Prayer Room\\s+(.+)$/i, '$1 Prayer Room');
  } else if (type === 'islamic-centre') {
    if (/^Islamic Centre\\s+(.+)$/i.test(result)) result = result.replace(/^Islamic Centre\\s+(.+)$/i, '$1 Islamic Centre');
  }
""",
    """  }
""",
)

replace_once(
    "src/prayer-spaces.ts",
    """  let name = getEnglishPlaceName({ tags, type });
  if (genericPrayerNamePattern.test(name) || looksLikeBrokenLatinName(name)) name = fallbackForType(type);

  const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;
""",
    """  const name = getEnglishPlaceName({ tags, type });
  const hasSourceName = prayerPlaceSearchableNames(tags).length > 0;
  if (hasSourceName && generatedPrayerFallbackPattern.test(name)) return undefined;
  if (genericPrayerNamePattern.test(name) || looksLikeBrokenLatinName(name)) return undefined;

  const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;
""",
)

replace_once(
    "src/prayer-spaces-global.test.ts",
    """test('broken Latin names are replaced globally instead of being displayed', () => {
  for (const [index, name] of ['lshyj Mosque', 'lhstf~ Mosque', 'vkhvd', 'tvbh'].entries()) {
    const normalized = normalizePrayerPlace(place(index + 1, { name, 'name:en': name }), origin);
    assert.equal(normalized?.name, 'Unnamed Mosque');
  }
});

test('generic facility-only names become neutral fallbacks globally', () => {
  const normalized = normalizePrayerPlace(place(10, { name: 'Masjid', 'name:en': 'Masjid' }), origin);
  assert.equal(normalized?.name, 'Unnamed Mosque');
});
""",
    """test('broken Latin names are removed globally instead of being displayed', () => {
  for (const [index, name] of ['lshyj Mosque', 'lhstf~ Mosque', 'vkhvd', 'tvbh'].entries()) {
    const normalized = normalizePrayerPlace(place(index + 1, { name, 'name:en': name }), origin);
    assert.equal(normalized, undefined);
  }
});

test('generic facility-only names are removed globally', () => {
  const normalized = normalizePrayerPlace(place(10, { name: 'Masjid', 'name:en': 'Masjid' }), origin);
  assert.equal(normalized, undefined);
});
""",
)
