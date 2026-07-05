# SafarOne Deep Professional Audit V2 — Curated Findings

Audit-only branch. Do not merge.

## Scope and successful checks

The audit covered the web application, all seven languages, MapLibre/RTL handling, offline behavior, permissions, privacy, security, accessibility, dependencies, Android native code, and iOS native configuration.

Successful checks:

- TypeScript typecheck
- Production web build
- 263 unit/integration tests
- ESLint
- Browser startup smoke test
- Full and production-only npm security audits
- Android lint
- Android unit-test task
- Android debug and release builds
- Xcode property-list validation
- Xcode static analyzer
- iOS simulator release verification
- Unsigned iOS device archive

No known npm vulnerabilities were reported. Xcode static analysis found no app-code defects. Android lint reported 0 errors and 18 warnings.

## Confirmed high-priority issues

### 1. Android BootReceiver does not validate the received action

The Android manifest exports `BootReceiver` for `BOOT_COMPLETED`, `TIME_SET`, and `TIMEZONE_CHANGED`, but `onReceive` immediately reschedules stored alarms without checking `intent.getAction()`.

Risk: another actor can send an explicit or malformed intent to the exported receiver and trigger unnecessary alarm-rescheduling work.

Required correction:

- Allow-list the three expected system actions in `onReceive`.
- Return immediately for null or unexpected actions.
- Re-evaluate whether the receiver needs to remain exported for every supported Android version.
- Add native tests for allowed and rejected actions.

### 2. Android native behavior has almost no real unit coverage

The Android unit-test task runs only the generated `ExampleUnitTest.addition_isCorrect` test.

Important native components without direct unit coverage include:

- `AthanAlarmPlugin`
- `BootReceiver`
- `AthanReceiver`
- `StopAthanReceiver`
- `AthanPlaybackService`
- alarm persistence and rescheduling
- download host/content/size validation
- cancellation and exact-alarm behavior

This is a major regression risk because these features operate outside the TypeScript test suite.

### 3. `src/main.ts` and `src/i18n.ts` are too large

- `src/main.ts`: approximately 5,491 lines
- `src/i18n.ts`: approximately 4,395 lines

The generated Jerusalem snapshot is also large, but it is generated data rather than handwritten application logic.

Risk: unrelated features share one change surface, reviews are difficult, and regressions are harder to isolate.

Recommended structure:

- one module per travel tool/page
- shared map controller
- shared search/request controller
- one language file per locale or feature group
- feature-level integration tests

## Confirmed medium-priority issues

### 4. Locale-sensitive MIME parsing in Android audio download validation

`AthanAlarmPlugin` calls `contentType.toLowerCase()` without a locale when validating downloaded audio.

Risk: locale-sensitive case conversion, particularly under Turkish locale, can produce incorrect comparisons.

Correction: use `toLowerCase(Locale.ROOT)` once and compare the normalized value.

### 5. Android 12+ backup/device-transfer policy is incomplete

The manifest sets `android:allowBackup="false"` and `android:fullBackupContent="false"`, but Android lint reports that `android:dataExtractionRules` is missing for Android 12 and later.

Risk: cloud-backup and device-to-device transfer policy is not explicitly defined for modern Android versions.

Correction: add an XML data-extraction policy that explicitly excludes saved trips, travel details, alarm configuration, and other app-private state as intended.

### 6. Important browser/native integration modules have weak runtime coverage

Overall test coverage is strong:

- lines: 96.36%
- branches: 78.77%
- functions: 90.42%

However, several mobile/UI modules have very low executable coverage:

- `money-currency-picker-bootstrap`: 7.45% lines, 0% functions
- `money-popular-currencies-bootstrap`: 11.76% lines, 0% functions
- `native-location`: 23.81% lines, 20% functions
- `offline`: 35.29% lines, 33.33% functions
- `weather-layout-bootstrap`: 2.42% lines

The existing source-inspection tests verify code presence, but they do not fully exercise user interaction, permission denial, WebView lifecycle, or service-worker behavior.

### 7. Main JavaScript delivery is large

Largest production files:

- main application JavaScript: approximately 1.74 MB uncompressed
- secondary JavaScript bundle: approximately 381 KB uncompressed
- RTL plugin: approximately 148 KB

Risk: slower web download, parse/startup cost, and additional WebView memory use.

Correction: lazy-load maps, weather, attractions, flight mode, money tools, and large datasets by route/feature.

### 8. External URL validation allows unencrypted HTTP links

`safeExternalUrl` permits both `http:` and `https:` URLs. Source-provided place websites could therefore open over unencrypted HTTP.

Correction: prefer HTTPS-only external navigation. Allow HTTP only through narrowly documented exceptions when a trusted source genuinely has no HTTPS endpoint.

### 9. Dynamic HTML rendering remains a review-sensitive area

Seventeen `innerHTML`-style rendering surfaces remain. Existing escaping and HTML-safety tests reduce risk, and this audit did not prove an exploitable injection.

Risk: the app consumes names and metadata from external map/API sources; one future unescaped interpolation could create malformed or unsafe markup.

Correction:

- continue replacing dynamic markup with DOM/text APIs
- centralize escaping
- add hostile-input tests for every external-data card and dialog

## Confirmed lower-priority issues

### 10. Android launcher and splash resources need modernization

Android lint found:

- missing monochrome adaptive-icon layers for themed icons
- inconsistent density-independent splash sizes
- duplicate splash images across configurations
- a bitmap in the densityless drawable directory
- five unused Android resources

These are primarily visual/build-quality issues rather than crash defects.

### 11. Obsolete Android SDK checks and resource folder

The plugin checks Android versions that are already guaranteed by the app minimum SDK, and `drawable-v24` is unnecessary when minSdk is 24.

Correction: simplify the checks and merge the resources into the normal drawable folder.

### 12. Dependency maintenance is pending

No known vulnerabilities were found, but nine direct dependencies have newer versions, including several Capacitor packages. Upgrades should be isolated and tested because they affect native bridges.

The Capacitor Filesystem dependency also emits a deprecation warning concerning `downloadFile`; verify whether any future app code uses that API.

### 13. Release metadata versions differ

- package version: `0.2.0`
- App Store marketing version: `1.0.0`

This does not break the app, but release metadata should be documented or synchronized to prevent confusion in automation and support.

### 14. Runtime error logging should be centralized

Several production catch paths call `console.error(error)` directly.

Risk: inconsistent diagnostics and possible exposure of provider error details in device logs.

Correction: use one redacted logger with release-safe messages and optional local-development detail.

### 15. A few TypeScript response paths use `as any`

The attractions/Wikipedia integration contains narrow `as any` casts.

Risk: upstream schema changes can bypass compile-time checking.

Correction: define response interfaces and validate unknown JSON before use.

## Findings manually rejected as false positives

The automated scanner initially reported several issues that manual review disproved:

- No analytics or advertising SDK was found; the scanner matched words in privacy documentation and ordinary variable names.
- The app-level iOS privacy manifest exists and was included during the iOS build.
- New-tab navigation already uses `noopener,noreferrer`, and native links go through Capacitor Browser.
- The reported map-instance/style count mismatch was a scanner-regex limitation; existing regression tests verify the shared map-style pipeline.
- Most reported unlabeled form controls are wrapped in explicit labels.
- Standard Apple plist DTD URLs and localhost test URLs are not production cleartext-network defects.

## Map and Arabic status

Static architecture, map regression tests, browser startup, iOS verification, and iOS archive all passed. No remaining legacy global map-label rewrite was detected.

This does not prove the visual result inside a physical iPhone WebView. The following must still be tested in the same installed build:

1. English labels visible on every map-based page.
2. Arabic letters connected and ordered correctly.
3. Urdu labels connected and ordered correctly.
4. Switch English → Arabic → English without reinstallation.
5. Map labels after app background/foreground.
6. Map labels after offline launch and reconnection.
7. All eight map pages, not only the city map.

## iOS result

- Info.plist validation passed.
- App privacy manifest exists.
- Xcode static analysis passed.
- Simulator release verification passed.
- Unsigned device archive passed.
- The only repeated warning was that AppIntents metadata extraction was skipped because the app does not use AppIntents; this is benign.

No confirmed iOS-native blocker was found by automated analysis.

## Recommended repair order

1. Validate Android BootReceiver actions and add native tests.
2. Fix Android locale-safe MIME parsing.
3. Add Android 12+ data-extraction rules.
4. Add native Android tests for alarm, receiver, service, and download behavior.
5. Add real browser/WebView interaction tests for location, offline behavior, currency picker, and weather layout.
6. Restrict external links to HTTPS where possible.
7. Continue eliminating external-data `innerHTML` rendering.
8. Split `main.ts` and `i18n.ts` into feature modules.
9. Add feature-based code splitting to reduce startup bundles.
10. Modernize Android icons/splash assets and remove obsolete resources.
11. Upgrade Capacitor packages in separate tested pull requests.

## Audit limitation

No automated audit can prove that every possible bug is absent. Network-provider outages, device sensors, notification delivery, background execution, map font rendering, accessibility with VoiceOver/TalkBack, and different device sizes require physical-device testing.