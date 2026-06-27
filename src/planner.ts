import { cities } from './data.js';
import type { CityData, ItineraryItem, PlannerPreferences, Place } from './models.js';

const addMinutes = (time: string, minutes: number) => {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(2026, 0, 1, h, m + minutes);
  return d.toTimeString().slice(0, 5);
};

const travelMinutes = (prefs: PlannerPreferences) => {
  if (prefs.transportation === 'taxi') return 15;
  if (prefs.transportation === 'public transport') return 25;
  return prefs.walkingAbility === 'low' ? 30 : 20;
};

export const findCity = (name: string): CityData => cities.find((city) => city.city.toLowerCase() === name.trim().toLowerCase()) ?? cities[0];

export const generateItinerary = (prefs: PlannerPreferences, replanFromIndex = 0): ItineraryItem[] => {
  const city = findCity(prefs.city);
  const attractions = city.places.filter((p) => p.type === 'attraction' && (prefs.interests.length === 0 || p.interests.some((i) => prefs.interests.includes(i))));
  const mosque = city.places.find((p) => p.type === 'mosque') as Place;
  const prayerSpace = city.places.find((p) => p.type === 'prayer-space') as Place;
  const restaurant = city.places.find((p) => p.type === 'restaurant') as Place;
  const prayerPlace = prefs.prayerPreference === 'quiet prayer space' ? prayerSpace : mosque;
  let current = replanFromIndex ? addMinutes(prefs.startHour, replanFromIndex * 35) : prefs.startHour;
  const travel = travelMinutes(prefs);
  const selectedAttractions = (attractions.length ? attractions : city.places.filter((p) => p.type === 'attraction')).slice(0, 2);
  const items: ItineraryItem[] = [];

  selectedAttractions.forEach((place, index) => {
    items.push({ id: `travel-${index}`, time: current, title: `Travel to ${place.name}`, kind: 'travel', durationMinutes: travel, details: `${prefs.transportation}; sample routing estimate, not live traffic.`, status: 'Sample' });
    current = addMinutes(current, travel);
    items.push({ id: place.id, time: current, title: place.name, kind: 'attraction', durationMinutes: place.estimatedMinutes, details: `${place.description} Good for group size ${prefs.groupSize}${prefs.children ? ' with children' : ''}.`, place, status: place.verification });
    current = addMinutes(current, place.estimatedMinutes);
    if (index === 0) {
      items.push({ id: 'dhuhr', time: city.prayerWindows.Dhuhr, title: `Dhuhr prayer window near ${prayerPlace.name}`, kind: 'prayer', durationMinutes: prayerPlace.estimatedMinutes, details: `${prefs.prayerMethod}. Women space: ${prayerPlace.facility?.womenPrayerSpace}. Wudu: ${prayerPlace.facility?.wudu}. ${prayerPlace.facility?.notes}`, place: prayerPlace, status: prayerPlace.verification });
      items.push({ id: restaurant.id, time: addMinutes(current, 10), title: `Halal-conscious meal stop: ${restaurant.name}`, kind: 'meal', durationMinutes: restaurant.estimatedMinutes, details: `${restaurant.halalSupport} Budget: ${restaurant.budgetLevel}. Preference: ${prefs.halalPreference}.`, place: restaurant, status: restaurant.verification });
      current = addMinutes(current, restaurant.estimatedMinutes + 10);
    }
  });

  items.push({ id: 'asr', time: city.prayerWindows.Asr, title: `Asr prayer window`, kind: 'prayer', durationMinutes: 25, details: `Use nearby mosque/prayer room. Accessibility needs noted: ${prefs.accessibilityNeeds || 'none supplied'}.`, place: prayerPlace, status: prayerPlace.verification });
  return items;
};
