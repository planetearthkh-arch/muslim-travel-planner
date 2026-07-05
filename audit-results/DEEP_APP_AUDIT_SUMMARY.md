# SafarOne Deep App Audit Summary

Audit branch only. Do not merge before fixes are reviewed.

## Scope

- 153 text/source/configuration files scanned.
- Supported languages checked: English (`en`), Arabic (`ar`), Bahasa Indonesia (`id`), Bahasa Melayu (`ms`), Turkish (`tr`), French (`fr`), and Urdu (`ur`).
- Full typecheck, unit/integration tests, lint, production build, and browser smoke test passed.
- Production dependency audit found 0 known vulnerabilities.

## Language coverage

All seven language dictionaries contain 856 keys. No language is missing a key.

| Language | Missing keys | Empty values | Multi-word values still identical to English | Script warnings |
|---|---:|---:|---:|---:|
| English | 0 | 1 (`prototype`) | 0 | 0 |
| Arabic | 0 | 1 (`prototype`) | 0 | 0 |
| Bahasa Indonesia | 0 | 1 (`prototype`) | 3 | 0 |
| Bahasa Melayu | 0 | 0 | 3 | 0 |
| Turkish | 0 | 1 (`prototype`) | 1 | 0 |
| French | 0 | 1 (`prototype`) | 0 | 0 |
| Urdu | 0 | 1 (`prototype`) | 1 | 1 |

The empty `prototype` value appears intentional because it is empty in the English base dictionary too; it is not treated as a visible UI failure without further evidence.

### Values needing translation review

- Bahasa Indonesia: `halalOnly`, `halalOptions`, `prayerAppleMaps`.
- Bahasa Melayu: `halalOnly`, `halalOptions`, `prayerAppleMaps`.
- Turkish: `prayerAppleMaps`.
- Urdu: `prayerAppleMaps` is Latin-only and matches English.

## App identity and names

The intended visible identity is:

- Brand: `SafarOne`
- English subtitle: `Muslim Travel Planner`

The scan found one `Muslim Trip Planner` occurrence alongside the normal `Muslim Travel Planner` wording. This must be located and corrected so App Store, web, and native naming stay consistent.

Capitalization variants such as `safarone` and `safarOne` also exist. Some may be code identifiers, but user-facing occurrences must be reviewed.

## Confirmed map-label problem

The old global English map-label rewrite still exists in `src/main.ts`:

- `englishMapNameExpression`
- `applyEnglishMapLabels`
- a global `text-field` replacement

A second layer in `src/map-rtl-bootstrap.ts` currently intercepts and blocks that old rewrite by patching MapLibre prototype methods.

This means the current map behavior depends on two conflicting systems:

1. old code attempts to rewrite all map labels;
2. bootstrap code tries to prevent that rewrite and later reload RTL text.

This is fragile and is the strongest confirmed reason the English and Arabic map labels have repeatedly disappeared or changed between builds. The clean repair is to remove the old rewrite from `main.ts`, stop prototype interception, and keep one explicit map-label policy.

The local RTL plugin is present and the RTL bootstrap loads before the main application, so the bundled plugin itself is not missing.

## Native localization

- iOS localization folders found for all seven languages: `en`, `ar`, `id`, `ms`, `tr`, `fr`, `ur`.
- The iOS localized permission files contain the same expected key set.
- No Android language-specific `strings.xml` resource groups were found by the scan. The app UI is web/Capacitor-based, but native Android labels and permission text should still be checked before Android release.

## Other code-review findings

### HTML rendering surfaces

27 uses of `innerHTML`/related HTML insertion were found, mostly in `src/main.ts`. Many values are escaped, and current tests cover several external-data paths, but every surface should be reviewed systematically because one missed escape can create broken markup or injection risk.

### Hardcoded UI candidates

Four candidates were detected:

- Flight time-zone examples: `Europe/London` and `America/New_York`.
- GitHub place-report title: `Place report: ...`.
- A SafarOne ARIA label in a test.

The time-zone examples are likely intentional examples. The place-report title should be localized if users see it.

### Error handling

One empty `catch` was detected inside the third-party bundled RTL plugin, not in first-party app code.

### Dependency security

`npm audit --omit=dev` reported:

- critical: 0
- high: 0
- moderate: 0
- low: 0

## Priority order for fixes

1. Remove the old global map-label rewrite and prototype interception; use one clear label pipeline.
2. Test English and Arabic maps in the same build before uploading another TestFlight build.
3. Correct the single `Muslim Trip Planner` occurrence and review capitalization variants.
4. Translate the listed Indonesian, Malay, Turkish, and Urdu values.
5. Review all 27 HTML insertion surfaces and the user-facing place-report title.
6. Verify native Android app name and permission strings for all supported languages.

## Audit status

No production files were changed by this audit. The audit branch and draft PR are for review only.
