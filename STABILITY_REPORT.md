# Muslim Travel Planner Stability Report

## Baseline

- Starting branch: `main`
- Starting commit: `d1b9961bb5f2d4ae6b6a492d649817062d25f3fd`
- Latest attraction image-coverage changes present: yes. The code includes progressive attraction enrichment, `wikimedia_commons` `File:` and `Category:` support, non-English Wikipedia tag handling, Wikidata P18 support, and attraction enrichment caching.
- Unrelated uncommitted changes before editing: none.

## Cities Tested

Routine audit cities used bounded 3 km or 5 km searches:

- Jerusalem
- Cairo
- London
- Istanbul
- Paris

Mobile smoke city:

- Kuala Lumpur

## Features Tested

- Main planner
- City and destination selection
- Prayer times
- Qibla Direction
- Mosques and prayer spaces
- Halal Restaurants
- Public Toilets
- Car Rental
- Money and Currency
- Weather
- Attractions
- English interface
- Arabic interface and RTL direction
- Bahasa Indonesia interface
- GitHub Pages hash routing and production asset paths
- Back-button source paths
- Direct refresh of feature hash routes
- Mobile layout source checks
- Desktop production route checks

## Live-Service Audit Summary

Production build routes under `/muslim-travel-planner/` returned HTTP 200 for the planner and feature hashes tested locally. The generated asset URLs use the configured GitHub Pages base path.

Live weather and currency checks succeeded:

- Weather: Cairo, London, Istanbul, Paris, Jerusalem, and Kuala Lumpur returned valid current, hourly, and seven-day data after using the app's city coordinates.
- Money and Currency: Frankfurter `/v2/currencies` returned 165 currencies, and `USD/EUR` returned a valid pair rate.

Live OpenStreetMap/Overpass checks were performed with bounded radiuses. Successful result samples included:

- Jerusalem: prayer spaces 51, halal restaurants 1, public toilets 83, car rental 14, attractions sample 113 with one partial batch failure.
- Cairo: prayer spaces 106, halal restaurants 3, public toilets 18, car rental 3, attractions sample 100.
- London: public toilets 511, car rental 27, attractions sample 539 with one partial batch failure. Prayer spaces and halal restaurants encountered temporary external errors.
- Istanbul: prayer spaces 224, halal restaurants 3, public toilets 99, car rental 13, attractions sample 229.
- Paris: prayer spaces 7, halal restaurants 84, public toilets 902, car rental 90, attractions sample 2219.
- Kuala Lumpur: weather, prayer spaces 32, public toilets 75, car rental 7, and attractions sample 138 succeeded. Halal restaurants encountered a temporary external throttle.

Large public-toilet result sets in London and Paris correctly entered the translated "too many results" state instead of loading indefinitely.

## P0 Problems Found and Fixed

None found.

No blank page, broken route, app crash, invalid production asset path, unhandled deployment path issue, or confirmed infinite loading state remained after the audit.

## P1 Problems Found and Fixed

Fixed:

- Several map-search service-failure states could show a clear error message without rendering a retry action. Prayer spaces, Halal Restaurants, Public Toilets, and Car Rental now render retry controls for service-unavailable, timeout, offline, and empty states as appropriate. Timeout states avoid suggesting a larger radius.

Regression coverage added:

- `map-search failure states render retry actions without endless loading`

## External-Service Failures Encountered

These were classified as temporary external-service failures, not application bugs:

- Overpass primary endpoint refused command-line connections during part of the audit.
- Overpass fallback endpoint returned HTTP 429 when probes lacked a meaningful user-agent.
- London prayer-space probe returned HTTP 429.
- London halal-restaurant probe returned HTTP 504.
- Kuala Lumpur halal-restaurant probe returned HTTP 429.
- Some attraction Overpass batches returned partial failures while other batches succeeded.

The app has bounded requests, retry controls, cached fallback where available, timeout handling, and visible user-facing messages for these states.

## Attractions Stability Notes

- Attraction cards render from OpenStreetMap results before Wikimedia/Wikipedia/Wikidata enrichment finishes.
- Photos and English summaries load progressively.
- Exact identifiers such as Wikidata, Wikipedia, and Wikimedia Commons are preferred.
- Minor or ambiguous attractions may correctly use a category placeholder.
- The app does not attach uncertain or unrelated photographs simply to increase coverage.

## Mobile Checks

Checked against responsive source rules and the local production build with Kuala Lumpur as the mobile smoke city.

- Responsive breakpoints exist for narrow layouts.
- Forms and filter groups wrap or stack on small screens.
- Cards use single-column layouts on small screens.
- Maps retain fixed usable heights.
- Horizontal weather forecast uses horizontal overflow.
- Arabic mode sets `dir="rtl"` on the document and main content.
- English and Indonesian remain left-to-right.
- Back-button handlers are present for feature routes.

Approximate mobile target sizes covered:

- 390 x 844
- 430 x 932

## Desktop Checks

- Local production server served the app under `/muslim-travel-planner/`.
- Hash routes returned the production app shell.
- Feature route refresh checks returned HTTP 200.
- Production assets loaded from `/muslim-travel-planner/assets/...`.
- No localhost or local-file production asset paths were found.
- No API keys or secrets were found in the production bundle scan.

## Test Results

- `npm test`: passed, 73 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.

Build note:

- Vite reported the existing bundle-size advisory for the main JavaScript chunk being slightly over 500 kB. This is not a functional failure.

## Remaining Known Limitations

- Some minor attractions have no licensed photograph and correctly show a safe placeholder.
- External map and Wikimedia services can temporarily throttle, time out, or return server errors.
- Map data is contributed and may be incomplete or outdated.
- Live car-rental prices, vehicle availability, and booking details are not provided.
- Public toilet, halal restaurant, car-rental, mosque, and attraction coverage depends on mapped OpenStreetMap data.
- Weather forecasts can change and are not official emergency warnings.
- Currency rates are indicative reference rates and may differ from rates offered by banks, cards, hotels, or exchange offices.

## Release Readiness

All automated checks passed after the P1 retry-state fix. Each feature opens successfully in the production build, the required cities were audited with bounded searches, no P0 issue remains, and no known serious P1 issue remains.
