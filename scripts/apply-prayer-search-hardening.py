from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match in {path}, found {count}")
    file.write_text(text.replace(old, new, 1))


replace_once(
    "src/prayer-spaces.ts",
    "const namePattern = 'Al[- ]?Aqsa|Masjid[ -]?(?:al[- ]?)?Aqsa|الأقصى|الاقصى';",
    "const namePattern = 'Al[- ]?Aqsa|Masjid[ -]?Al[- ]?Aqsa|Masjid[ -]?Aqsa|الأقصى|الاقصى';",
)

replace_once(
    "src/main.ts",
    "function overpassUrl() { return appStorage.getItem('mtp-overpass-endpoint') ?? 'https://overpass-api.de/api/interpreter'; }",
    """const defaultOverpassEndpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
];

function overpassUrls() {
  const configured = appStorage.getItem('mtp-overpass-endpoint');
  return [...new Set([configured, ...defaultOverpassEndpoints].filter((value): value is string => Boolean(value)))];
}

async function requestPrayerOverpass(body: string, signal: AbortSignal) {
  let lastError: unknown;
  for (const url of overpassUrls()) {
    try {
      return await requestOverpass(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body,
        signal,
      }, 18000);
    } catch (error) {
      if (classifyRequestError(error).kind === 'aborted') throw error;
      lastError = error;
    }
  }
  throw lastError ?? new RequestError('network', 'All map data services are unavailable');
}""",
)

replace_once(
    "src/main.ts",
    "const data = await requestOverpass(overpassUrl(), { method: 'POST', body, signal: abortSignal }, 18000);",
    "const data = await requestPrayerOverpass(body, abortSignal);",
)

path = Path("src/prayer-spaces-jerusalem.test.ts")
text = path.read_text()
needle = """  assert.equal(jerusalemQuery.includes('[\"name:ar\"~'), true);
  assert.equal(jerusalemQuery.includes('Aqsa'), true);
  assert.equal(londonQuery.includes('[\"name:ar\"~'), false);
});
"""
replacement = """  assert.equal(jerusalemQuery.includes('[\"name:ar\"~'), true);
  assert.equal(jerusalemQuery.includes('Aqsa'), true);
  assert.equal(jerusalemQuery.includes('(?:'), false);
  assert.equal(londonQuery.includes('[\"name:ar\"~'), false);
});
"""
if text.count(needle) != 1:
    raise SystemExit('Expected one Jerusalem query assertion block')
path.write_text(text.replace(needle, replacement, 1))
