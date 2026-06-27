import type { CityData } from './models.js';

const sampleFacility = {
  womenPrayerSpace: 'Sample',
  wudu: 'Sample',
  accessibility: 'Sample',
  notes: 'Sample facility details; confirm locally before travel.',
} as const;

const verifiedFacility = {
  womenPrayerSpace: 'Verified',
  wudu: 'Verified',
  accessibility: 'Sample',
  notes: 'Verified in this mock dataset for prototype status-label testing only; reconfirm before travel.',
} as const;

const cityRows = [
  'Jerusalem|Palestine / Israel|Al-Aqsa Mosque|Old City lanes|Levantine family kitchen',
  'London|United Kingdom|London Central Mosque|British Museum|Modest Turkish grill',
  'Istanbul|Türkiye|Sultan Ahmed Mosque|Hagia Sophia area|Ottoman lokanta',
  'Paris|France|Grande Mosquée de Paris|Louvre courtyard|North African bistro',
  'Tokyo|Japan|Tokyo Camii|Asakusa district|Halal ramen house',
  'New York|United States|Islamic Cultural Center of New York|Central Park|Halal cart classics',
];

export const cities: CityData[] = cityRows.map((row, index) => {
  const [city, country, mosque, attraction, restaurant] = row.split('|');
  const isLondon = city === 'London';

  return {
    city,
    country,
    timezone: 'Sample timezone',
    coordinates: { lat: 30 + index, lng: -20 + index },
    prayerWindows: {
      Fajr: '05:00–06:00',
      Dhuhr: '12:45–14:00',
      Asr: '16:30–17:45',
      Maghrib: '20:05–20:45',
      Isha: '21:35–22:45',
    },
    places: [
      {
        id: `${city}-a1`,
        name: attraction,
        type: 'attraction',
        area: 'Central area',
        description: 'Sample highlight selected for a first-time family-friendly visit.',
        estimatedMinutes: 90,
        interests: ['history', 'culture', 'family'],
        familyFriendly: true,
        indoor: false,
        verification: isLondon ? 'Verified' : 'Sample',
        evidence: isLondon ? 'Mock verified entry included only so testers can see the Verified label state.' : undefined,
      },
      {
        id: `${city}-a2`,
        name: `${city} heritage walk`,
        type: 'attraction',
        area: 'Historic quarter',
        description: 'Sample low-pressure route with rest stops and flexible pacing.',
        estimatedMinutes: 75,
        interests: ['walking', 'history', 'architecture'],
        familyFriendly: true,
        indoor: false,
        verification: 'Sample',
      },
      {
        id: `${city}-m1`,
        name: mosque,
        type: 'mosque',
        area: 'Accessible by transit/taxi',
        description: 'Sample mosque/prayer option; opening times and facilities are not live.',
        estimatedMinutes: 35,
        interests: ['prayer'],
        familyFriendly: true,
        indoor: true,
        verification: isLondon ? 'Verified' : 'Unverified',
        evidence: isLondon ? 'Mock verified facility record for prototype label testing; not live operational data.' : undefined,
        facility: isLondon ? verifiedFacility : sampleFacility,
      },
      {
        id: `${city}-p1`,
        name: `${city} quiet prayer room`,
        type: 'prayer-space',
        area: 'Museum or community venue area',
        description: 'Sample fallback prayer space for itinerary planning only.',
        estimatedMinutes: 25,
        interests: ['prayer'],
        familyFriendly: true,
        indoor: true,
        verification: 'Sample',
        facility: sampleFacility,
      },
      {
        id: `${city}-r1`,
        name: restaurant,
        type: 'restaurant',
        area: 'Near main route',
        description: 'Sample meal stop with Muslim-friendly planning notes.',
        estimatedMinutes: 60,
        interests: ['food'],
        familyFriendly: true,
        indoor: true,
        verification: 'Unverified',
        halalSupport: 'Unverified sample listing only. Ask for current halal certificate or supplier details before eating.',
        budgetLevel: 'mid',
      },
    ],
  } satisfies CityData;
});
