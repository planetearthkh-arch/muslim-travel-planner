# SafarMate

SafarMate is a Muslim travel planner for prayer-aware itineraries, saved trips, travel tools, nearby open-map place search, optional offline access to saved trip information, and native mobile packaging.

## SafarMate 1.1

- The iPhone app remains free to download.
- Optional **SafarMate Premium Lifetime** is a one-time, non-consumable App Store purchase.
- Product ID: `com.planetearthkh.safarmate.premium.lifetime`.
- StoreKit 2 verifies purchases and restores them through the customer’s Apple Account.
- Customers whose verified original production build is 154 or earlier receive Premium automatically as early supporters.
- Premium purchase and paywall UI are available only in the iOS app; the web and Android builds retain their existing behavior.

## Scope

- Mobile-first TypeScript web app with no framework lock-in.
- English, Arabic, Bahasa Indonesia, Bahasa Melayu, Turkish, French, and Urdu interface support, with right-to-left layout for Arabic and Urdu.
- Includes mock data for 30 supported cities across Europe, the Middle East, Asia, North America, Africa, and Oceania.
- Uses open-data services and native Apple services where configured; no API keys are committed.
- Restaurants are not described as certified halal unless source information supports that wording.
- Does not add user accounts, analytics, ads, or cloud sync. Location permission is optional and requested only when the user asks for Qibla direction or nearby travel places.

## Premium entitlement model

- Apple’s verified StoreKit transaction is the source of truth.
- Restore Purchases calls `AppStore.sync()` and re-checks current verified entitlements.
- The app does not contain a local developer switch that can create Premium access.
- The original App Store build is checked through verified `AppTransaction` data for the version-1.0 grandfathering rule.
- StoreKit Sandbox reports a non-production original version, so test purchases remain testable before release.

## Map and nearby-place features

- Maps use bundled MapLibre code and configured open map tile/style services.
- OpenStreetMap attribution is displayed visibly on the map.
- Free iPhone users see two mosque or halal results together with a clean in-app preview map; full interaction, all results and directions require Lifetime Premium.
- Nearby-place searches use bounded OpenStreetMap/Overpass requests and display exact mapped coordinates where the source provides them.
- The app does not bulk-download, prefetch, or manually cache map tiles, does not use paid map APIs, Google Maps, Mapbox, API keys, or background location tracking.
- If map data or map services fail to load, the page shows graceful fallback text instead of blocking itinerary planning.

## Weather provider

- The commercial iPhone build routes weather requests through native Apple WeatherKit and displays Apple Weather attribution and the legal source link.
- WeatherKit requires iOS 16 or later and the WeatherKit capability on the production App ID and Xcode target.
- The non-iOS prototype can continue using Open-Meteo only in accordance with the selected Open-Meteo licence and plan.
- API secrets must never be committed to GitHub.

## Run locally

```bash
npm run build
npm run dev
```

Then open <http://localhost:5173>.

## iOS preparation

```bash
npm run ios:sync
npm run ios:open
```

The sync step configures SafarMate 1.1.0 build 159 and the WeatherKit entitlement before opening Xcode. The Apple Developer App ID must also have WeatherKit enabled before signing the release archive.

## Quality checks

```bash
npm run typecheck
npm run test
npm run lint
npm run build
npm run test:browser-smoke
npm run ios:verify
npm run ios:archive-verify
```

CI also compiles Android debug and release packages and verifies both an iOS simulator build and an unsigned device archive.
