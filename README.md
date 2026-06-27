# Muslim Travel Planner

A first working prototype of a privacy-first, worldwide Muslim travel-planning web application. It creates sample timed itineraries with attractions, travel estimates, prayer windows, mosque/prayer-space notes, wudu and women’s facility labels, halal-conscious meal stops, and a **Replan From Here** action.

## Prototype scope

- Mobile-first TypeScript web app with no framework lock-in and no paid services.
- English and Arabic interface with correct RTL layout for Arabic.
- Accepts any city in the search field and includes mock data for Jerusalem, London, Istanbul, Paris, Tokyo, and New York.
- Uses sample/mock data only; no paid APIs and no API keys.
- Labels information as **Sample**, **Unverified**, or **Verified**. Restaurants are not described as verified halal unless supporting information is available.
- Does not collect precise location, registration, payment, or sensitive personal data.
- Data models are designed to later connect to maps, routing, prayer-time, mosque, attraction, and halal-information APIs.

## Run locally

```bash
npm run build
npm run dev
```

Then open <http://localhost:5173>.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
