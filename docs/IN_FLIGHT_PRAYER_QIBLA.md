# In-Flight Prayer & Qibla

SafarOne Flight Mode provides the best available estimate based on live GPS or the stored flight route. It is designed for use after the traveller prepares a flight while online or before departure; the in-flight calculations themselves do not need a runtime network request.

## GPS Mode

When the user explicitly enables live GPS, SafarOne asks the platform for high-accuracy location updates. The app uses finite latitude, longitude, timestamp, accuracy, altitude, and GPS course-over-ground values when available. If the course value is unavailable, SafarOne can derive a track from recent GPS fixes.

This is labelled as GPS track over ground. It is not called aircraft heading, cabin direction, or magnetic compass direction.

## Route-Estimate Mode

If GPS is denied, unavailable, inaccurate, or stale, SafarOne automatically falls back to the saved route estimate. The user can use elapsed-time progress or adjust a 0-100% route progress slider.

The route is a direct airport-to-airport great-circle estimate unless the user adds optional waypoints. Airline routing, air-traffic-control routing, weather deviations, holding patterns, and runway procedures can differ from this estimate.

## No Magnetic Compass

Flight Mode uses no magnetic compass and no DeviceOrientation dependency. Qibla is calculated as a true bearing from the active estimated position. The relative left/right angle is compared with GPS track over ground, derived GPS track, or the stored route tangent.

## Prayer Calculations

Prayer calculations use the existing local `adhan` package and the selected calculation method. Flight Mode computes Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha for the active latitude, longitude, and timestamp, including adjacent-day continuity for long flights and midnight crossings.

UTC is the primary in-flight display. Optional departure and arrival IANA time zones are shown only when valid. SafarOne does not infer a civil time zone from longitude.

## Altitude Note

Cruise altitude is stored and displayed as context only. SafarOne does not silently alter Fajr, Isha, sunrise, or sunset boundaries with an unverified altitude formula.

At cruising altitude, the visible horizon and observed sunrise or sunset may differ from ground-level calculations. Follow trusted religious guidance.

## Airport Data

The bundled compact airport index is derived from public-domain OurAirports data and reduced to fields needed for offline flight preparation: IATA, ICAO/ident, name, municipality, country, latitude, longitude, and elevation where available.

The current index is intentionally compact for launch and can be regenerated from OurAirports before expanding coverage. It is bundled in the web, PWA, iOS, and Android app assets through the normal Vite build.

## On-Device Privacy

Prepared flight plans are stored locally in the browser or native WebView storage under a versioned SafarOne key. They include airports, optional waypoints, schedule, planned duration, prayer method, optional altitude, and optional time-zone names.

Flight Mode does not store passport numbers, booking references, identity documents, payment cards, or loyalty credentials. It does not send prepared flight plans to a SafarOne server.

## Offline Behavior

Prepared flight calculations are available offline. Live GPS availability depends on the device, aircraft, seat, operating-system permission, and safety restrictions. Live maps, weather, exchange rates, external websites, and external directions remain separate online tools.

## iPhone Airplane Mode Manual Test Checklist

1. Prepare and save a flight while online.
2. Open Flight Mode and confirm the dashboard appears.
3. Enable Airplane Mode when required by crew instructions.
4. Reload the app after it has already been installed or visited and confirm the saved flight remains visible.
5. Confirm Route Estimate Mode works without network.
6. If location is allowed and available, confirm live GPS status appears; if not, confirm the route estimate remains usable.
7. Confirm UTC prayer times, Qibla true bearing, and relative GPS-track wording remain visible.
8. Confirm Arabic RTL, Bahasa Indonesia, and Bahasa Melayu labels are readable.
9. Confirm no magnetic compass wording appears in Flight Mode.

