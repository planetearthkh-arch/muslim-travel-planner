# Quality Audit

Baseline audited: local `main` after `4b1cbf8 Fix cross-category fallback data contamination`.

## Confirmed Defects

| ID | Severity | Category | File and function | Exact evidence | User-visible consequence | Reproduction steps | Fix status | Test covering the fix |
|---|---|---|---|---|---|---|---|---|
| QA-001 | P1 | Trust | `src/taxi-services.ts` `normalizeTaxiService`; similar optional metadata paths in `src/public-transport.ts`, `src/car-rental.ts`, `src/public-toilets.ts` | Optional metadata used `ensureLatinDisplayName(..., undefined)`, which falls back to prayer labels such as `Unnamed Quiet Prayer Space` when input is empty or unsupported. | Taxi cards could show `Operator: Unnamed Quiet Prayer Space`; unrelated feature fallback labels could leak into optional metadata. | Normalize a Taxi OSM element with `amenity=taxi` and no `operator`/`brand`; render details. | Fixed. Added `optionalLatinDisplayName` for optional metadata and migrated Taxi, Public Transport, Car Rental, and Public Toilets optional fields. | `optional metadata helper never invents prayer-place fallback values`; `taxi optional metadata stays empty unless source data provides it`; Public Transport and Car Rental fallback assertions; `mapped feature cards omit missing optional rows...` |
| QA-002 | P1 | Reliability | `src/main.ts` `requestRestaurantLocation`, `requestToiletLocation`, `requestCarRentalLocation`, `requestPublicTransportLocation`, `requestTaxiLocation`, `requestWeatherLocation`, `requestAttractionLocation`; Qibla location path | These geolocation callbacks started without a captured request token, while manual searches and destination searches mutate the same feature state. | A late location success or permission error could replace a newer manual destination result or status. | Start “Use my location”, immediately submit another city search, then let the old geolocation callback resolve. | Fixed. Each geolocation request captures and checks the relevant sequence before success/error work. Qibla location callbacks are also invalidated when leaving the Qibla page. | `geolocation callbacks are invalidated by newer searches across async features`; existing stale-search tests |
| QA-003 | P1 | Reliability | `src/http.ts` `classifyRequestError` | Every `TypeError` was classified as `offline`; fetch/CORS/programming failures can also be TypeError. | Users could be told they were offline when the app made an invalid request or hit a runtime/network class of failure without offline evidence. | Call `classifyRequestError(new TypeError('failed'))` while `navigator.onLine` is not explicitly false. | Fixed. TypeError becomes `offline` only when `navigator.onLine === false`; otherwise it is `unknown` and feature pages use neutral service-unavailable wording. | `shared HTTP utility classifies statuses, timeouts, aborts, offline, and malformed JSON` |
| QA-004 | P1 | Reliability | `src/http.ts` `retryOnceForTemporary`; `src/main.ts` `requestOverpass`, `attractionJson` | Retry-After waiting used an ordinary timer and did not observe the request AbortSignal. | A stale request could wait through Retry-After and launch an unnecessary retry after the user had moved to a newer search. | Start a request that receives 429 with Retry-After, then abort the request before the delay ends. | Fixed. Retry delay is abort-aware and shared callers pass their AbortSignal. | `shared HTTP utility classifies statuses...` abort-during-Retry-After assertion |
| QA-005 | P2 | Testing | `package.json` `lint`; `eslint.config.js` | `npm run lint` ran `eslint dist --ext .js`, and config explicitly ignored `src/**/*.ts`. | Developers could ship source issues while linting generated output instead. | Inspect `package.json` and `eslint.config.js`; run lint before build output exists. | Fixed. `npm run lint` now typechecks TypeScript source and lints editable JS/config scripts; generated output is ignored. | `package scripts lint source and discover all compiled test files`; `npm run lint` |
| QA-006 | P2 | Testing | `package.json` `test` | Test script hard-coded `node --test dist-test/planner.test.js`. | Future `*.test.ts` files could be compiled but silently skipped. | Add a second test file and run the old script. | Fixed. Added `scripts/run-tests.mjs` to discover every compiled `*.test.js` under `dist-test`. | `package scripts lint source and discover all compiled test files`; `npm test` reports discovered files |
| QA-007 | P2 | Simplicity | `src/main.ts` mapped feature detail rows | Several cards rendered an opening-status line and also rendered the raw opening-hours row as `Opening status unavailable` when no source `opening_hours` existed. | Users saw duplicate unavailable opening information and could mistake a status message for source data. | Render a Taxi/Public Transport/Car Rental/Public Toilet/Halal/Attraction card with no `opening_hours`. | Fixed. Raw opening-hours rows render only when source `opening_hours` exists; the status line remains. | `mapped feature cards omit missing optional rows and avoid duplicate opening-hours fallback text` |

## Confirmed Defect Summary

- P0: 0 confirmed.
- P1: 4 confirmed and fixed.
- P2: 3 confirmed and fixed because the fixes were isolated and low risk.
- P3: 0 confirmed.

## Risks And Deferred Lower-Priority Work

| ID | Severity | Category | Evidence | Deferred reason |
|---|---|---|---|---|
| RISK-001 | P2 | Maintainability | `src/main.ts` remains a very large file with repeated search/status/render patterns across mapped features. | A broader extraction would be a redesign/refactor risk. The current task fixed confirmed defects without changing architecture. |
| RISK-002 | P2 | Accessibility | Source review shows many dynamic pages rely on full page rerenders after filter/sort changes. Existing tests cover Money input focus, but not every map/filter focus path in a real browser. | Needs a dedicated browser automation pass; no confirmed P0/P1 failure was reproduced in this repository-only audit. |
| RISK-003 | P2 | Simplicity | The home planner has many quick-action cards and feature pages share similar controls. | Broad navigation simplification would be a product/design task and is intentionally deferred. |

## Verification Notes

- `npm test` discovers compiled test files through `scripts/run-tests.mjs`.
- `npm run lint` no longer lints generated `dist`; it typechecks source and lints editable JavaScript/config scripts.
- External service behavior remains dependent on OpenStreetMap/Overpass, Wikimedia, Wikidata, Wikipedia, Open-Meteo, Frankfurter, and browser geolocation availability. The app now has clearer stale-request, retry, cache, and error-state handling for the confirmed failures above.
