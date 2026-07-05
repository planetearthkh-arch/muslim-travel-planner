import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const outDir = path.join(root, 'audit-output');
await fs.mkdir(outDir, { recursive: true });

const excludedDirs = new Set(['.git', 'node_modules', 'dist', 'dist-test', 'dist-audit', 'build', 'Pods', 'DerivedData', 'audit-output']);
const textExtensions = new Set(['.ts', '.js', '.mjs', '.json', '.html', '.css', '.xml', '.plist', '.strings', '.md', '.yml', '.yaml', '.pbxproj', '.xcconfig', '.gradle', '.properties', '.webmanifest']);

async function walk(dir) {
  const result = [];
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return result; }
  for (const entry of entries) {
    if (excludedDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(full));
    else if (textExtensions.has(path.extname(entry.name)) || entry.name.endsWith('.webmanifest')) result.push(full);
  }
  return result;
}

const files = await walk(root);
const texts = new Map();
for (const file of files) {
  try { texts.set(path.relative(root, file), await fs.readFile(file, 'utf8')); } catch { /* unreadable */ }
}

const findings = [];
const add = (severity, category, title, evidence = [], recommendation = '') => findings.push({ severity, category, title, evidence, recommendation });
const linesFor = (text, regex, limit = 30) => text.split(/\r?\n/).flatMap((line, index) => {
  regex.lastIndex = 0;
  return regex.test(line) ? [{ line: index + 1, text: line.trim().slice(0, 240) }] : [];
}).slice(0, limit);
const locations = (regex, options = {}) => {
  const { excludeTests = false, excludeVendor = true, limit = 80 } = options;
  const result = [];
  for (const [file, text] of texts) {
    if (excludeTests && /(?:\.test\.|\/tests?\/)/.test(file)) continue;
    if (excludeVendor && /(?:vendor|package-lock\.json)/.test(file)) continue;
    for (const hit of linesFor(text, regex, limit)) {
      result.push({ file, ...hit });
      if (result.length >= limit) return result;
    }
  }
  return result;
};
const readJson = async (file) => {
  try { return JSON.parse(await fs.readFile(path.join(root, file), 'utf8')); } catch { return null; }
};
const hasFile = async (file) => texts.has(file) || await fs.access(path.join(root, file)).then(() => true).catch(() => false);
const severityRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

// Release/version hygiene.
const packageJson = await readJson('package.json');
const project = texts.get('ios/App/App.xcodeproj/project.pbxproj') ?? '';
const buildNumbers = [...project.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((match) => Number(match[1]));
const marketingVersions = [...project.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((match) => match[1]);
if (buildNumbers.length !== 2 || new Set(buildNumbers).size !== 1) add('high', 'release', 'iOS Debug and Release build numbers do not match', [{ buildNumbers }], 'Keep one committed build number in both configurations.');
if (project.includes('DEVELOPMENT_TEAM =')) add('high', 'release', 'Personal Apple development team is committed', locations(/DEVELOPMENT_TEAM\s*=/), 'Keep signing-team selection local to Xcode.');
if (packageJson?.version && marketingVersions[0] && packageJson.version !== marketingVersions[0]) add('low', 'release', 'package.json version differs from the App Store marketing version', [{ packageVersion: packageJson.version, marketingVersions }], 'Document the distinction or synchronize release metadata.');

// Source health and maintainability.
const todo = locations(/\b(?:TODO|FIXME|HACK|XXX)\b/i, { excludeTests: false });
if (todo.length) add('low', 'maintainability', `${todo.length} maintenance markers remain`, todo, 'Triage each marker before release.');
const emptyCatch = locations(/catch\s*(?:\([^)]*\))?\s*\{\s*\}/, { excludeTests: true });
if (emptyCatch.length) add('medium', 'reliability', `${emptyCatch.length} empty catch blocks can hide failures`, emptyCatch, 'Log, classify, or expose recoverable failures.');
const suppressions = locations(/@ts-ignore|@ts-expect-error|eslint-disable|\bas any\b/, { excludeTests: false });
if (suppressions.length) add('low', 'type-safety', `${suppressions.length} type/lint suppressions need review`, suppressions, 'Replace suppressions with narrow types where practical.');
const runtimeConsole = locations(/console\.(?:log|warn|error)\s*\(/, { excludeTests: true });
if (runtimeConsole.length) add('low', 'observability', `${runtimeConsole.length} runtime console calls remain`, runtimeConsole, 'Ensure messages contain no personal data and are intentional in production.');
for (const [file, text] of texts) {
  if (!file.startsWith('src/') || /\.test\./.test(file) || !file.endsWith('.ts')) continue;
  const lineCount = text.split(/\r?\n/).length;
  if (lineCount > 2000) add('high', 'maintainability', `${file} is extremely large (${lineCount} lines)`, [{ file, lineCount }], 'Split by feature to reduce regression risk and improve targeted testing.');
  else if (lineCount > 800) add('medium', 'maintainability', `${file} is large (${lineCount} lines)`, [{ file, lineCount }], 'Split into cohesive feature modules.');
}

// Security and HTML safety.
const secretPatterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ['GitHub token', /\bgh[pousr]_[0-9A-Za-z]{30,}\b/],
  ['generic secret assignment', /\b(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*['\"][^'\"]{12,}['\"]/i],
];
for (const [name, regex] of secretPatterns) {
  const hits = locations(regex, { excludeTests: false, excludeVendor: true, limit: 20 });
  if (hits.length) add('critical', 'security', `Possible ${name} committed`, hits.map(({ file, line }) => ({ file, line })), 'Rotate exposed credentials and remove them from history after confirming the match.');
}
const dynamicHtml = locations(/(?:innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML\s*\()/, { excludeTests: true, limit: 150 });
if (dynamicHtml.length) add('medium', 'security', `${dynamicHtml.length} dynamic HTML-rendering surfaces require taint review`, dynamicHtml, 'Use textContent/DOM APIs or prove all interpolated values are escaped.');
const runtimeEval = locations(/\beval\s*\(|new\s+Function\s*\(/, { excludeTests: true });
if (runtimeEval.length) add('high', 'security', 'Runtime dynamic code execution found', runtimeEval, 'Remove eval/new Function from production code.');
const insecureUrls = locations(/http:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org|schemas\.android\.com)/i, { excludeTests: false, limit: 50 });
if (insecureUrls.length) add('high', 'security', 'Non-HTTPS external URLs found', insecureUrls, 'Use HTTPS or document why cleartext transport is unavoidable.');
const blankTargets = locations(/target=['\"]_blank['\"](?![^>]*rel=['\"][^'\"]*noopener)/i, { excludeTests: true });
if (blankTargets.length) add('medium', 'security', 'External links open new tabs without noopener', blankTargets, 'Add rel="noopener noreferrer".');
const unsafeWindowOpen = locations(/window\.open\s*\(/, { excludeTests: true });
if (unsafeWindowOpen.length) add('medium', 'security', 'window.open call sites require URL allow-list review', unsafeWindowOpen, 'Route external URLs through safeExternalUrl and noopener behavior.');
const indexHtml = texts.get('index.html') ?? '';
if (!/Content-Security-Policy/i.test(indexHtml)) add('high', 'security', 'No Content Security Policy found in index.html', [], 'Add a restrictive CSP compatible with Capacitor and MapLibre.');
else if (/unsafe-eval/i.test(indexHtml)) add('medium', 'security', 'CSP permits unsafe-eval', locations(/unsafe-eval/i), 'Remove unsafe-eval unless a verified dependency requires it.');

// Network reliability and privacy inventory.
const rawFetches = locations(/\bfetch\s*\(/, { excludeTests: true, limit: 150 });
const weakFetches = [];
for (const hit of rawFetches) {
  const text = texts.get(hit.file) ?? '';
  const allLines = text.split(/\r?\n/);
  const context = allLines.slice(Math.max(0, hit.line - 12), hit.line + 12).join('\n');
  if (!/AbortController|signal\s*:|requestJson|retryOnceForTemporary|timeout/i.test(context)) weakFetches.push(hit);
}
if (weakFetches.length) add('medium', 'network', `${weakFetches.length} fetch call sites show no nearby timeout or cancellation`, weakFetches, 'Use the shared request wrapper or AbortController.');
const hostnames = new Set();
for (const [, text] of texts) {
  for (const match of text.matchAll(/https:\/\/([A-Za-z0-9.-]+)/g)) hostnames.add(match[1].toLowerCase());
}
const trackingTerms = locations(/firebase|analytics|amplitude|mixpanel|segment|facebook|appsflyer|adjust|advertisingIdentifier|idfa|trackingTransparency/i, { excludeTests: false });
if (trackingTerms.length) add('high', 'privacy', 'Analytics, advertising, or tracking-related code requires disclosure review', trackingTerms, 'Verify App Privacy answers, consent, and ATT requirements.');

// Permissions and native security.
const plist = texts.get('ios/App/App/Info.plist') ?? '';
const androidManifest = texts.get('mobile/android/AndroidManifest.xml') ?? texts.get('android/app/src/main/AndroidManifest.xml') ?? '';
const iosPermissionKeys = [...plist.matchAll(/<key>(NS[^<]*UsageDescription)<\/key>/g)].map((match) => match[1]);
const androidPermissions = [...androidManifest.matchAll(/<uses-permission[^>]+android:name=['\"]([^'\"]+)/g)].map((match) => match[1]);
const dangerousAndroid = androidPermissions.filter((value) => /CAMERA|RECORD_AUDIO|READ_CONTACTS|WRITE_CONTACTS|ACCESS_BACKGROUND_LOCATION|READ_SMS|CALL_PHONE/.test(value));
if (dangerousAndroid.length) add('high', 'permissions', 'Sensitive Android permissions require feature justification', dangerousAndroid.map((permission) => ({ permission })), 'Remove permissions not essential to a visible feature.');
if (/NSLocationAlways|NSLocationAlwaysAndWhenInUse/.test(plist)) add('high', 'permissions', 'iOS background/always location usage description is present', locations(/NSLocationAlways/), 'Use When In Use unless background location is essential.');
if (/NSCameraUsageDescription|NSMicrophoneUsageDescription|NSContactsUsageDescription/.test(plist)) add('medium', 'permissions', 'iOS requests camera, microphone, or contacts access', locations(/NS(?:Camera|Microphone|Contacts)UsageDescription/), 'Confirm every requested permission maps to an active feature.');
if (/NSAllowsArbitraryLoads\s*<\/key>\s*<true\/>/s.test(plist)) add('high', 'security', 'iOS App Transport Security allows arbitrary loads', [], 'Use narrow exceptions instead.');
if (/android:usesCleartextTraffic=['\"]true['\"]/.test(androidManifest)) add('high', 'security', 'Android permits cleartext traffic', [], 'Disable cleartext traffic for release.');
if (/android:allowBackup=['\"]true['\"]/.test(androidManifest) || !/android:allowBackup=/.test(androidManifest)) add('medium', 'privacy', 'Android backup behavior is not explicitly restricted', [], 'Review whether saved trips and travel details should be included in device/cloud backups.');
if (!await hasFile('ios/App/App/PrivacyInfo.xcprivacy')) add('medium', 'privacy', 'No app-level iOS privacy manifest found', [], 'Confirm all app and SDK required-reason APIs are covered by merged privacy manifests.');

// Localization quality.
try {
  const moduleUrl = pathToFileURL(path.join(root, 'dist-audit', 'app-language.js')).href;
  const languageModule = await import(moduleUrl);
  const { labels, languages, languageDirection, localeForLanguage } = languageModule;
  const codes = languages.map((item) => item.code);
  const expectedCodes = ['en', 'ar', 'id', 'ms', 'tr', 'fr', 'ur'];
  if (JSON.stringify(codes) !== JSON.stringify(expectedCodes)) add('high', 'localization', 'Supported language list differs from the expected seven languages', [{ codes, expectedCodes }], 'Review release language scope.');
  const englishKeys = Object.keys(labels.en).sort();
  const allowedIdentical = /^(Apple Maps|SafarOne|GPS|PDF|URL|OpenStreetMap|Wikipedia|GitHub|km|km\/h|m\/s)$/i;
  for (const code of codes) {
    const dict = labels[code] ?? {};
    const keys = Object.keys(dict).sort();
    const missing = englishKeys.filter((key) => !(key in dict));
    const extra = keys.filter((key) => !(key in labels.en));
    const empty = keys.filter((key) => key !== 'prototype' && (!String(dict[key] ?? '').trim()));
    if (missing.length || extra.length || empty.length) add('high', 'localization', `${code} dictionary is incomplete`, [{ code, missing, extra, empty }], 'Keep exact key parity and non-empty visible labels.');
    if (code !== 'en') {
      const identical = englishKeys.filter((key) => {
        const value = String(dict[key] ?? '');
        return value === labels.en[key] && value.split(/\s+/).length >= 2 && value.length >= 8 && !allowedIdentical.test(value);
      });
      if (identical.length) add('medium', 'localization', `${code} has ${identical.length} multi-word values identical to English`, [{ code, keys: identical.slice(0, 80) }], 'Confirm product names; translate unintended fallbacks.');
    }
    if (['ar', 'ur'].includes(code)) {
      const latinOnly = englishKeys.filter((key) => {
        const value = String(dict[key] ?? '');
        return value.length >= 5 && /[A-Za-z]/.test(value) && !/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(value) && !allowedIdentical.test(value);
      });
      if (latinOnly.length) add('medium', 'localization', `${code} has Latin-only visible values`, [{ code, keys: latinOnly.slice(0, 80) }], 'Translate or document product-name exceptions.');
    }
    if (typeof languageDirection === 'function' && ['ar', 'ur'].includes(code) && languageDirection(code) !== 'rtl') add('high', 'localization', `${code} is not configured RTL`);
    if (typeof localeForLanguage === 'function' && !localeForLanguage(code)) add('medium', 'localization', `${code} has no locale mapping`);
  }
} catch (error) {
  add('high', 'localization', 'Resolved language dictionaries could not be imported', [{ error: String(error) }], 'Fix compilation/import before release.');
}

const expectedIosLocales = ['en', 'ar', 'id', 'ms', 'tr', 'fr', 'ur'];
for (const locale of expectedIosLocales) {
  if (!await hasFile(`ios/App/App/${locale}.lproj/InfoPlist.strings`)) add('high', 'localization', `Missing iOS InfoPlist localization for ${locale}`);
}
const expectedAndroidLocales = ['values', 'values-ar', 'values-in', 'values-ms', 'values-tr', 'values-fr', 'values-ur'];
for (const folder of expectedAndroidLocales) {
  if (!await hasFile(`mobile/android/res/${folder}/strings.xml`)) add('high', 'localization', `Missing Android native strings for ${folder}`);
}

// Map and RTL architecture.
const main = texts.get('src/main.ts') ?? '';
const mapStyle = texts.get('src/map-style.ts') ?? '';
const rtlBootstrap = texts.get('src/map-rtl-bootstrap.ts') ?? '';
const mapConstructors = (main.match(/new\s+(?:window\.)?maplibregl\.Map\s*\(/g) ?? []).length;
const localizedMapStyles = (main.match(/style:\s*mapStyle/g) ?? []).length;
if (mapConstructors && localizedMapStyles !== mapConstructors) add('high', 'maps', 'Not every MapLibre map uses the shared localized style', [{ mapConstructors, localizedMapStyles }], 'Route every map through mapStyleForLanguage.');
if (/englishMapNameExpression|applyEnglishMapLabels|Map\.prototype\.setLayoutProperty/.test(main + rtlBootstrap)) add('high', 'maps', 'Legacy global map-label mutation still exists', locations(/englishMapNameExpression|applyEnglishMapLabels|Map\.prototype\.setLayoutProperty/), 'Keep one explicit style-localization pipeline.');
if (!mapStyle.includes('name:ar') && !mapStyle.includes('name:${language}')) add('high', 'maps', 'Arabic/local-language map field selection is missing');
if (!rtlBootstrap.includes('URL.createObjectURL')) add('medium', 'maps', 'RTL plugin is not converted to a worker-compatible blob URL', [], 'Verify Capacitor worker loading on a physical iPhone.');
if (!await hasFile('public/vendor/openfreemap-bright.json')) add('high', 'maps', 'Bundled map style is missing');
if (!await hasFile('public/vendor/mapbox-gl-rtl-text.js')) add('high', 'maps', 'Bundled RTL shaping plugin is missing');

// Accessibility static checks.
if (!/<html[^>]+lang=/i.test(indexHtml)) add('high', 'accessibility', 'Root HTML has no language attribute');
const imagesWithoutAlt = locations(/<img\b(?![^>]*\balt=)[^>]*>/i, { excludeTests: true });
if (imagesWithoutAlt.length) add('medium', 'accessibility', 'Images without alt text found', imagesWithoutAlt, 'Use meaningful alt text or alt="" for decorative images.');
const unlabeledInputs = locations(/<(?:input|select|textarea)\b(?![^>]*(?:aria-label|aria-labelledby|id=))[^>]*>/i, { excludeTests: true });
if (unlabeledInputs.length) add('medium', 'accessibility', 'Form controls may lack an accessible name', unlabeledInputs, 'Associate labels or ARIA names.');
const dialogHits = locations(/role=['\"]dialog['\"]/i, { excludeTests: true });
for (const hit of dialogHits) {
  const line = (texts.get(hit.file) ?? '').split(/\r?\n/)[hit.line - 1] ?? '';
  if (!/aria-modal|aria-labelledby/.test(line)) add('medium', 'accessibility', 'Dialog may lack modal/name semantics', [hit], 'Add aria-modal and an accessible title.');
}
if (!/prefers-reduced-motion/.test([...texts.values()].join('\n'))) add('low', 'accessibility', 'No reduced-motion CSS handling detected', [], 'Respect prefers-reduced-motion for map/UI animation.');

// Offline/PWA checks.
const sw = texts.get('public/sw.js') ?? '';
const shellEntries = [...sw.matchAll(/new URL\(['\"]\.\/([^'\"]+)/g)].map((match) => `public/${match[1]}`);
for (const file of shellEntries) if (!await hasFile(file)) add('high', 'offline', `Service-worker shell references missing file: ${file}`);
if (!/caches\.keys/.test(sw)) add('medium', 'offline', 'Service worker does not clean old caches');
if (!/request\.mode === ['\"]navigate['\"]/.test(sw)) add('medium', 'offline', 'No navigation fallback detected in service worker');
if (!await hasFile('public/privacy.html') || !await hasFile('public/support.html')) add('high', 'release', 'Privacy or support page is missing');

// Test coverage heuristics.
const sourceModules = [...texts.keys()].filter((file) => file.startsWith('src/') && file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.d.ts'));
const testFiles = [...texts.keys()].filter((file) => file.startsWith('src/') && file.endsWith('.test.ts'));
const testText = testFiles.map((file) => texts.get(file) ?? '').join('\n');
const likelyUntested = sourceModules.filter((file) => {
  const base = path.basename(file, '.ts');
  if (['main', 'models'].includes(base)) return false;
  return !testText.includes(`./${base}.js`) && !testFiles.some((test) => path.basename(test).startsWith(base));
});
if (likelyUntested.length) add('low', 'testing', `${likelyUntested.length} source modules have no obvious direct test import`, likelyUntested.map((file) => ({ file })).slice(0, 100), 'Add targeted tests for high-risk modules; this is a heuristic.');

// Dependency audit snapshots.
for (const [file, label] of [['audit-output/npm-audit-production.json', 'production'], ['audit-output/npm-audit-full.json', 'full']]) {
  const audit = await readJson(file);
  const vulnerabilities = audit?.metadata?.vulnerabilities;
  if (!vulnerabilities) continue;
  if ((vulnerabilities.critical ?? 0) > 0 || (vulnerabilities.high ?? 0) > 0) add('critical', 'dependencies', `${label} dependency audit has critical/high vulnerabilities`, [{ vulnerabilities }], 'Upgrade or replace affected packages before release.');
  else if ((vulnerabilities.moderate ?? 0) > 0) add('medium', 'dependencies', `${label} dependency audit has moderate vulnerabilities`, [{ vulnerabilities }], 'Assess exploitability and update promptly.');
}
const outdated = await readJson('audit-output/npm-outdated.json');
if (outdated && Object.keys(outdated).length) add('low', 'dependencies', `${Object.keys(outdated).length} direct dependencies have newer versions`, Object.entries(outdated).map(([name, value]) => ({ name, ...value })).slice(0, 80), 'Upgrade in isolated PRs with native regression testing.');

// Summaries.
const counts = findings.reduce((acc, finding) => { acc[finding.severity] = (acc[finding.severity] ?? 0) + 1; return acc; }, {});
const report = {
  generatedAt: new Date().toISOString(),
  repository: 'planetearthkh-arch/muslim-travel-planner',
  scannedFiles: texts.size,
  sourceModules: sourceModules.length,
  testFiles: testFiles.length,
  mapConstructors,
  iosPermissionKeys,
  androidPermissions,
  externalHosts: [...hostnames].sort(),
  counts,
  findings: findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.category.localeCompare(b.category)),
};

const md = [];
md.push('# SafarOne Deep Professional Audit');
md.push('');
md.push(`Generated: ${report.generatedAt}`);
md.push(`Scanned files: ${report.scannedFiles}`);
md.push(`Source modules: ${report.sourceModules}`);
md.push(`Test files: ${report.testFiles}`);
md.push(`Map instances: ${report.mapConstructors}`);
md.push('');
md.push('## Severity summary');
md.push('');
for (const level of ['critical', 'high', 'medium', 'low', 'info']) md.push(`- ${level}: ${counts[level] ?? 0}`);
md.push('');
md.push('## Findings');
md.push('');
if (!report.findings.length) md.push('No automated findings. Physical-device and human UX testing are still required.');
for (const finding of report.findings) {
  md.push(`### ${finding.severity.toUpperCase()} — ${finding.category}: ${finding.title}`);
  md.push('');
  if (finding.recommendation) md.push(`Recommendation: ${finding.recommendation}`);
  if (finding.evidence?.length) {
    md.push('');
    md.push('Evidence:');
    for (const item of finding.evidence.slice(0, 40)) md.push(`- \`${JSON.stringify(item).replaceAll('`', '\\`')}\``);
    if (finding.evidence.length > 40) md.push(`- … ${finding.evidence.length - 40} more item(s) in JSON report`);
  }
  md.push('');
}
md.push('## Permissions inventory');
md.push('');
md.push(`- iOS usage-description keys: ${iosPermissionKeys.join(', ') || 'none'}`);
md.push(`- Android permissions: ${androidPermissions.join(', ') || 'none'}`);
md.push('');
md.push('## External hosts found in source/configuration');
md.push('');
for (const host of report.externalHosts) md.push(`- ${host}`);

await fs.writeFile(path.join(outDir, 'deep-professional-audit.json'), JSON.stringify(report, null, 2));
await fs.writeFile(path.join(outDir, 'deep-professional-audit.md'), md.join('\n'));
console.log(md.slice(0, 120).join('\n'));
