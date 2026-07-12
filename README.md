# SafarMate

SafarMate is a Muslim travel planner for prayer-aware itineraries, saved trips, travel tools, nearby open-map place search, optional offline access to saved trip information, and native mobile packaging.

## Scope

- Mobile-first TypeScript web app with no framework lock-in and no paid services.
- English, Arabic, Bahasa Indonesia, Bahasa Melayu, Turkish, French, and Urdu interface support, with right-to-left layout for Arabic and Urdu.
- Includes mock data for 30 supported cities across Europe, the Middle East, Asia, North America, Africa, and Oceania.
- Uses open-data and public non-commercial APIs where configured; no API keys are committed.
- Restaurants are not described as certified halal unless source information supports that wording.
- Does not add accounts, analytics, ads, payments, or cloud sync. Location permission is optional and requested only when the user asks for Qibla direction or nearby travel places.

## Map and nearby-place features

- Maps use bundled MapLibre code and configured open map tile/style services.
- OpenStreetMap attribution is displayed visibly on the map.
- Nearby-place searches use bounded OpenStreetMap/Overpass requests and display exact mapped coordinates where the source provides them.
- The app does not bulk-download, prefetch, or manually cache map tiles, does not use paid map APIs, Google Maps, Mapbox, API keys, or background location tracking.
- If map data or map services fail to load, the page shows graceful fallback text instead of blocking itinerary planning.

## Weather provider

- Weather forecasts use the public Open-Meteo forecast endpoint for this non-commercial prototype.
- Before adding subscriptions, advertising, paid promotions, or other commercial use, configure a commercial Open-Meteo plan or a separate weather-provider adapter.
- Weather provider URLs and credentials must be supplied through configuration.
- API secrets must never be committed to GitHub.

## Run locally

```bash
npm run build
npm run dev
```

Then open <http://localhost:5173>.

## Quality checks

```bash
npm run typecheck
npm run test
npm run lint
npm run build
npm run test:browser-smoke
```

CI also compiles Android debug and release packages and verifies both an iOS simulator build and an unsigned device archive.
