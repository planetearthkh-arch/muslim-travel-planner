import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.cwd());
const reportDir = path.join(root, 'audit-output');
await fs.mkdir(reportDir, { recursive: true });

const TEXT_EXTENSIONS = new Set([
  '.ts', '.js', '.mjs', '.json', '.html', '.xml', '.plist', '.strings', '.md', '.yml', '.yaml', '.css', '.webmanifest', '.xcconfig', '.pbxproj',
]);
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'dist', 'dist-test', 'dist-audit', 'build', 'Pods', 'DerivedData']);

async function walk(dir) {
  const out = [];
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (TEXT_EXTENSIONS.has(path.extname(entry.name)) || entry.name.endsWith('.webmanifest')) out.push(full);
  }
  return out;
}

const files = await walk(root);
const texts = new Map();
for (const file of files) {
  try {
    texts.set(path.relative(root, file), await fs.readFile(file, 'utf8'));
  } catch {
    // Ignore unreadable files.
  }
}

const appLanguageUrl = pathToFileURL(path.join(root, 'dist-audit', 'app-language.js')).href;
const languageModule = await import(appLanguageUrl);
const { labels, languages, languageDirection, localeForLanguage } = languageModule;
const languageCodes = languages.map((item) => item.code);
const english = labels.en;
const englishKeys = Object.keys(english).sort();

const expectedLanguageLabels = {
  en: 'English', ar: 'العربية', id: 'Bahasa Indonesia', ms: 'Bahasa Melayu', tr: 'Türkçe', fr: 'Français', ur: 'اردو',
};
const expectedLocales = {
  en: 'en-US', ar: 'ar', id: 'id-ID', ms: 'ms-MY', tr: 'tr-TR', fr: 'fr-FR', ur: 'ur-PK',
};

const allowIdenticalKeys = new Set([
  'title', 'supportEmailLabel', 'qiblaNorth', 'qiblaEast', 'qiblaSouth', 'qiblaWest',
]);
const allowIdenticalPatterns = [
  /^https?:\/\//i,
  /^[A-Z]{2,5}$/,
  /^\d+(?:[.,]\d+)?$/,
  /planetearthkh@gmail\.com/i,
];
const containsLetters = (value) => /\p{L}/u.test(value);
const wordCount = (value) => String(value).trim().split(/\s+/u).filter(Boolean).length;
const isAllowedIdentical = (key, value) => allowIdenticalKeys.has(key) || allowIdenticalPatterns.some((pattern) => pattern.test(value));
const hasArabicScript = (value) => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/u.test(value);
const hasLatinLetters = (value) => /[A-Za-z]/.test(value);

const localization = {};
for (const code of languageCodes) {
  const dict = labels[code] ?? {};
  const keys = Object.keys(dict).sort();
  const missing = englishKeys.filter((key) => !(key in dict));
  const extra = keys.filter((key) => !(key in english));
  const empty = keys.filter((key) => typeof dict[key] !== 'string' || dict[key].trim() === '');
  const identicalLong = code === 'en' ? [] : englishKeys.filter((key) => {
    const value = dict[key];
    return value === english[key]
      && containsLetters(value)
      && wordCount(value) >= 2
      && value.length >= 8
      && !isAllowedIdentical(key, value);
  });
  const identicalAll = code === 'en' ? [] : englishKeys.filter((key) => {
    const value = dict[key];
    return value === english[key] && containsLetters(value) && !isAllowedIdentical(key, value);
  });
  const scriptWarnings = ['ar', 'ur'].includes(code)
    ? englishKeys.filter((key) => {
        const value = dict[key];
        if (isAllowedIdentical(key, value)) return false;
        return value.length >= 5 && hasLatinLetters(value) && !hasArabicScript(value);
      })
    : [];

  localization[code] = {
    languageLabel: languages.find((item) => item.code === code)?.label,
    expectedLanguageLabel: expectedLanguageLabels[code],
    direction: languageDirection(code),
    locale: localeForLanguage(code),
    expectedLocale: expectedLocales[code],
    keyCount: keys.length,
    missing,
    extra,
    empty,
    identicalLong,
    identicalAll,
    scriptWarnings,
    identity: {
      title: dict.title,
      subtitle: dict.subtitle,
      tagline: dict.tagline,
    },
  };
}

const scans = {
  todoMarkers: [],
  emptyCatches: [],
  consoleCalls: [],
  htmlInjection: [],
  hardcodedUiCandidates: [],
  appNameOccurrences: [],
  mapLabelOccurrences: [],
  languageStorageOccurrences: [],
};

function addMatches(target, rel, text, regex, label) {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    regex.lastIndex = 0;
    if (regex.test(line)) target.push({ file: rel, line: index + 1, label, text: line.trim().slice(0, 260) });
  });
}

for (const [rel, text] of texts) {
  addMatches(scans.todoMarkers, rel, text, /\b(?:TODO|FIXME|HACK|XXX)\b/i, 'maintenance marker');
  addMatches(scans.emptyCatches, rel, text, /catch\s*(?:\([^)]*\))?\s*\{\s*\}/, 'empty catch');
  addMatches(scans.consoleCalls, rel, text, /console\.(?:error|warn|log)\s*\(/, 'console call');
  addMatches(scans.htmlInjection, rel, text, /(?:innerHTML\s*=|insertAdjacentHTML\s*\(|outerHTML\s*=)/, 'HTML injection surface');
  addMatches(scans.hardcodedUiCandidates, rel, text, /(?:textContent|placeholder|aria-label|title)\s*=\s*['"`][A-Za-z][^'"`]{2,}/, 'hardcoded UI candidate');
  addMatches(scans.appNameOccurrences, rel, text, /SafarOne|Muslim\s+(?:Travel|Trip)\s+Planner|muslim-travel-planner/gi, 'app name');
  addMatches(scans.mapLabelOccurrences, rel, text, /maplibre|text-field|setLayoutProperty|name:en|name:ar|RTLText|rtl-text|LEGACY_MAP_NAME_EXPRESSION|englishMapNameExpression|applyEnglishMapLabels/gi, 'map label logic');
  addMatches(scans.languageStorageOccurrences, rel, text, /mtp-language|documentElement\.(?:lang|dir)|languageDirection|localeForLanguage/gi, 'language state');
}

const nameVariants = new Map();
for (const item of scans.appNameOccurrences) {
  const matches = item.text.match(/SafarOne|Muslim\s+(?:Travel|Trip)\s+Planner|muslim-travel-planner/gi) ?? [];
  for (const value of matches) {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!nameVariants.has(normalized)) nameVariants.set(normalized, []);
    nameVariants.get(normalized).push({ file: item.file, line: item.line });
  }
}

const nativeLocalization = { ios: {}, android: {} };
for (const [rel, text] of texts) {
  const iosMatch = rel.match(/^ios\/App\/App\/([^/]+)\.lproj\/InfoPlist\.strings$/);
  if (iosMatch) {
    const entries = {};
    for (const match of text.matchAll(/^\s*"([^"]+)"\s*=\s*"([^"]*)"\s*;/gm)) entries[match[1]] = match[2];
    nativeLocalization.ios[iosMatch[1]] = entries;
  }
  const androidMatch = rel.match(/^android\/app\/src\/main\/res\/(values(?:-[^/]+)?)\/strings\.xml$/);
  if (androidMatch) {
    const entries = {};
    for (const match of text.matchAll(/<string\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/string>/g)) entries[match[1]] = match[2].replace(/<[^>]+>/g, '').trim();
    nativeLocalization.android[androidMatch[1]] = entries;
  }
}

const expectedIosLocales = ['en', 'ar', 'id', 'ms', 'tr', 'fr', 'ur'];
const missingIosLocales = expectedIosLocales.filter((code) => !nativeLocalization.ios[code]);
const iosKeys = Object.fromEntries(Object.entries(nativeLocalization.ios).map(([code, entries]) => [code, Object.keys(entries).sort()]));
const iosReferenceKeys = iosKeys.en ?? [];
const iosMissingKeys = Object.fromEntries(Object.entries(iosKeys).map(([code, keys]) => [code, iosReferenceKeys.filter((key) => !keys.includes(key))]));

const mapFiles = [...new Set(scans.mapLabelOccurrences.map((item) => item.file))].sort();
const mapArchitecture = {
  files: mapFiles,
  legacyExpressionPresent: [...texts.values()].some((text) => text.includes('LEGACY_MAP_NAME_EXPRESSION')),
  oldEnglishExpressionPresent: [...texts.values()].some((text) => text.includes('englishMapNameExpression')),
  oldApplyFunctionPresent: [...texts.values()].some((text) => text.includes('applyEnglishMapLabels')),
  textFieldMutationPresent: [...texts.values()].some((text) => /setLayoutProperty[\s\S]{0,180}text-field/.test(text)),
  localRtlPluginPresent: texts.has('public/vendor/mapbox-gl-rtl-text.js'),
  rtlBootstrapImportedBeforeMain: (texts.get('src/app-bootstrap.ts') ?? '').indexOf("map-rtl-bootstrap") >= 0
    && (texts.get('src/app-bootstrap.ts') ?? '').indexOf("map-rtl-bootstrap") < (texts.get('src/app-bootstrap.ts') ?? '').indexOf("main.js"),
};

const confirmedFindings = [];
const reviewFindings = [];

for (const [code, result] of Object.entries(localization)) {
  if (result.missing.length) confirmedFindings.push({ severity: 'high', area: 'localization', message: `${code} is missing ${result.missing.length} English keys`, details: result.missing });
  if (result.empty.length) confirmedFindings.push({ severity: 'high', area: 'localization', message: `${code} has ${result.empty.length} empty values`, details: result.empty });
  if (result.identicalLong.length) reviewFindings.push({ severity: result.identicalLong.length > 20 ? 'high' : 'medium', area: 'localization', message: `${code} has ${result.identicalLong.length} multi-word values identical to English`, details: result.identicalLong });
  if (result.scriptWarnings.length) reviewFindings.push({ severity: 'high', area: 'localization', message: `${code} has ${result.scriptWarnings.length} Latin-only values that may be untranslated`, details: result.scriptWarnings });
  if (result.languageLabel !== result.expectedLanguageLabel) confirmedFindings.push({ severity: 'medium', area: 'language name', message: `${code} language label differs from expected`, details: { actual: result.languageLabel, expected: result.expectedLanguageLabel } });
  if (result.locale !== result.expectedLocale) confirmedFindings.push({ severity: 'medium', area: 'locale', message: `${code} locale differs from expected`, details: { actual: result.locale, expected: result.expectedLocale } });
}

if (missingIosLocales.length) confirmedFindings.push({ severity: 'high', area: 'iOS localization', message: 'Missing iOS localization folders', details: missingIosLocales });
for (const [code, missing] of Object.entries(iosMissingKeys)) {
  if (missing.length) confirmedFindings.push({ severity: 'high', area: 'iOS localization', message: `${code} InfoPlist.strings is missing keys`, details: missing });
}
if (mapArchitecture.oldEnglishExpressionPresent || mapArchitecture.oldApplyFunctionPresent) {
  confirmedFindings.push({ severity: 'high', area: 'map labels', message: 'Legacy global English map-label rewrite still exists in source', details: mapArchitecture });
}
if (mapArchitecture.legacyExpressionPresent && mapArchitecture.textFieldMutationPresent) {
  reviewFindings.push({ severity: 'high', area: 'map labels', message: 'Map labels depend on prototype interception of text-field mutation; this is fragile across MapLibre updates and style reload timing', details: mapArchitecture });
}
if (!mapArchitecture.localRtlPluginPresent) confirmedFindings.push({ severity: 'high', area: 'map labels', message: 'Bundled RTL plugin is missing', details: mapArchitecture });
if (!mapArchitecture.rtlBootstrapImportedBeforeMain) confirmedFindings.push({ severity: 'high', area: 'map labels', message: 'RTL bootstrap is not imported before main app code', details: mapArchitecture });

const suspiciousNameVariants = [...nameVariants.keys()].filter((name) => /Muslim\s+Trip\s+Planner/i.test(name));
if (suspiciousNameVariants.length) reviewFindings.push({ severity: 'medium', area: 'app naming', message: 'Both “Muslim Travel Planner” and “Muslim Trip Planner” variants exist', details: Object.fromEntries(nameVariants) });

if (scans.todoMarkers.length) reviewFindings.push({ severity: 'low', area: 'maintenance', message: `${scans.todoMarkers.length} TODO/FIXME/HACK markers found`, details: scans.todoMarkers });
if (scans.emptyCatches.length) reviewFindings.push({ severity: 'medium', area: 'error handling', message: `${scans.emptyCatches.length} empty catch blocks found`, details: scans.emptyCatches });
if (scans.htmlInjection.length) reviewFindings.push({ severity: 'medium', area: 'HTML safety', message: `${scans.htmlInjection.length} HTML injection surfaces require manual escaping review`, details: scans.htmlInjection });
if (scans.hardcodedUiCandidates.length) reviewFindings.push({ severity: 'medium', area: 'localization', message: `${scans.hardcodedUiCandidates.length} hardcoded UI string candidates found`, details: scans.hardcodedUiCandidates });

const report = {
  generatedAt: new Date().toISOString(),
  repository: 'planetearthkh-arch/muslim-travel-planner',
  languages: languageCodes,
  fileCount: texts.size,
  localization,
  nativeLocalization,
  nativeSummary: { missingIosLocales, iosMissingKeys },
  nameVariants: Object.fromEntries(nameVariants),
  mapArchitecture,
  scans,
  confirmedFindings,
  reviewFindings,
};

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
const sortedConfirmed = [...confirmedFindings].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
const sortedReview = [...reviewFindings].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

const md = [];
md.push('# SafarOne Deep App Audit');
md.push('');
md.push(`Generated: ${report.generatedAt}`);
md.push(`Scanned text files: ${report.fileCount}`);
md.push(`Supported languages: ${languageCodes.join(', ')}`);
md.push('');
md.push('## Language coverage');
md.push('');
md.push('| Language | Keys | Missing | Empty | Multi-word English matches | Script warnings | Title | Subtitle |');
md.push('|---|---:|---:|---:|---:|---:|---|---|');
for (const code of languageCodes) {
  const item = localization[code];
  md.push(`| ${code} | ${item.keyCount} | ${item.missing.length} | ${item.empty.length} | ${item.identicalLong.length} | ${item.scriptWarnings.length} | ${String(item.identity.title ?? '').replaceAll('|', '\\|')} | ${String(item.identity.subtitle ?? '').replaceAll('|', '\\|')} |`);
}
md.push('');
md.push('## Confirmed findings');
md.push('');
if (!sortedConfirmed.length) md.push('- None detected by the automated checks.');
for (const finding of sortedConfirmed) {
  md.push(`- **${finding.severity.toUpperCase()} — ${finding.area}:** ${finding.message}`);
  md.push(`  - Details: \`${JSON.stringify(finding.details).slice(0, 4000)}\``);
}
md.push('');
md.push('## Findings requiring manual review');
md.push('');
if (!sortedReview.length) md.push('- None detected by the automated checks.');
for (const finding of sortedReview) {
  md.push(`- **${finding.severity.toUpperCase()} — ${finding.area}:** ${finding.message}`);
  md.push(`  - Details: \`${JSON.stringify(finding.details).slice(0, 4000)}\``);
}
md.push('');
md.push('## App-name variants');
md.push('');
for (const [name, locations] of nameVariants) md.push(`- **${name}** — ${locations.length} occurrence(s)`);
md.push('');
md.push('## Map-label architecture');
md.push('');
md.push('```json');
md.push(JSON.stringify(mapArchitecture, null, 2));
md.push('```');
md.push('');
md.push('## Native localization');
md.push('');
md.push(`- iOS locales found: ${Object.keys(nativeLocalization.ios).sort().join(', ') || 'none'}`);
md.push(`- Android resource groups found: ${Object.keys(nativeLocalization.android).sort().join(', ') || 'none'}`);
md.push('');
md.push('## Raw scan counts');
md.push('');
for (const [key, value] of Object.entries(scans)) md.push(`- ${key}: ${value.length}`);

await fs.writeFile(path.join(reportDir, 'deep-app-audit.json'), JSON.stringify(report, null, 2));
await fs.writeFile(path.join(reportDir, 'deep-app-audit.md'), md.join('\n'));

console.log(md.slice(0, 80).join('\n'));
console.log(`\nFull report written to ${reportDir}`);
