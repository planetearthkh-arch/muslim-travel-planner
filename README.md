# Muslim Travel Planner

A first working prototype of a privacy-first, worldwide Muslim travel-planning web application. It creates sample timed itineraries with attractions, travel estimates, prayer windows, mosque/prayer-space notes, wudu and women’s facility labels, halal-conscious meal stops, interactive city street maps, and a **Replan From Here** action.

## Prototype scope

- Mobile-first TypeScript web app with no framework lock-in and no paid services.
- English, Arabic, and Bahasa Indonesia interface support with correct RTL layout for Arabic.
- Includes mock data for 30 supported cities across Europe, the Middle East, Asia, North America, Africa, and Oceania.
- Uses sample/mock data only; no paid APIs and no API keys.
- Labels information as **Sample**, **Unverified**, or **Verified**. Restaurants are not described as verified halal unless supporting information is available.
- Does not collect precise location, registration, payment, or sensitive personal data.

## Map feature

- Each supported city includes a responsive Leaflet street map centered on the city latitude and longitude already stored in the sample city data.
- Map tiles come from the official OpenStreetMap tile endpoint: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
- OpenStreetMap attribution is displayed visibly on the map.
- The city-center marker identifies the selected city and country only.
- The **Open full map** button opens the selected city on OpenStreetMap.
- Itinerary **Find on map** links open OpenStreetMap search results for the place name and city.
- Exact place coordinates are not included in this prototype, so the app deliberately does not display mosque, attraction, restaurant, or prayer-place markers as precise locations.
- The app does not bulk-download, prefetch, or manually cache map tiles, does not use paid map APIs, Google Maps, Mapbox, API keys, or location tracking, and does not request the user’s precise location.
- If Leaflet or map tiles fail to load, the page shows graceful fallback text instead of blocking itinerary planning.

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
```
