import { cities } from './data.js';
import { calculatePrayerDisplay } from './athan.js';
import { optionLabels, type Language } from './i18n.js';
import type { CityData, ItineraryItem, PlannerPreferences, Place } from './models.js';

const addMinutes = (time: string, minutes: number) => {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(2026, 0, 1, h, m + minutes);
  return d.toTimeString().slice(0, 5);
};

const minutesOfDay = (time: string) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
};

const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const itineraryDates = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const dates: string[] = [];
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) dates.push(isoDate(date));
  return dates;
};

const travelMinutes = (prefs: PlannerPreferences) => {
  const city = findCity(prefs.city);
  if (prefs.transportation === 'taxi') return city.transportEstimates.taxi;
  if (prefs.transportation === 'public transport') return city.transportEstimates.publicTransport;
  return prefs.walkingAbility === 'low' ? city.transportEstimates.walking + 10 : city.transportEstimates.walking;
};

export const findCity = (name: string): CityData => cities.find((city) => city.city.toLowerCase() === name.trim().toLowerCase()) ?? cities[0];

const plannerCopy = {
  en: {
    travelTo: (name: string) => `Travel to ${name}`,
    travelDetails: (transportation: string) => `${transportation}; routing estimate, not live traffic.`,
    attractionDetails: (groupSize: number, hasChildren: boolean) => `Suggested visit plan. Good for group size ${groupSize}${hasChildren ? ' with children' : ''}.`,
    dhuhrTitle: (name: string) => `Dhuhr prayer window near ${name}`,
    dhuhrDetails: (method: string, women: string, wudu: string, notes: string) => `${method}. Women space: ${women}. Wudu: ${wudu}. ${notes}`,
    mealTitle: (name: string) => `Halal-conscious meal stop: ${name}`,
    mealDetails: (support: string, budget: string, preference: string) => `${support} Budget: ${budget}. Preference: ${preference}.`,
    asrTitle: 'Asr prayer window',
    asrDetails: (needs: string) => `Use nearby mosque/prayer room. Accessibility needs noted: ${needs || 'none supplied'}.`,
    freeTimeTitle: 'Explore nearby',
    freeTimeDetails: 'Open time to rest, browse nearby streets, or choose another suitable stop.',
  },
  ar: {
    travelTo: (name: string) => `الانتقال إلى ${name}`,
    travelDetails: (transportation: string) => `${transportation}؛ تقدير مسار وليس حركة مرور مباشرة.`,
    attractionDetails: (groupSize: number, hasChildren: boolean) => `خطة زيارة مقترحة. مناسبة لمجموعة من ${groupSize}${hasChildren ? ' مع أطفال' : ''}.`,
    dhuhrTitle: (name: string) => `نافذة صلاة الظهر قرب ${name}`,
    dhuhrDetails: (method: string, women: string, wudu: string, notes: string) => `${method}. مصلى النساء: ${women}. الوضوء: ${wudu}. ${notes}`,
    mealTitle: (name: string) => `توقف طعام يراعي الحلال: ${name}`,
    mealDetails: (support: string, budget: string, preference: string) => `${support} الميزانية: ${budget}. التفضيل: ${preference}.`,
    asrTitle: 'نافذة صلاة العصر',
    asrDetails: (needs: string) => `استخدم مسجدا أو غرفة صلاة قريبة. احتياجات سهولة الوصول المسجلة: ${needs || 'لم يتم إدخال شيء'}.`,
    freeTimeTitle: 'استكشاف قريب',
    freeTimeDetails: 'وقت مفتوح للراحة أو التجول في الشوارع القريبة أو اختيار محطة مناسبة أخرى.',
  },
  id: {
    travelTo: (name: string) => `Perjalanan ke ${name}`,
    travelDetails: (transportation: string) => `${transportation}; estimasi rute, bukan lalu lintas langsung.`,
    attractionDetails: (groupSize: number, hasChildren: boolean) => `Rencana kunjungan yang disarankan. Cocok untuk rombongan berjumlah ${groupSize}${hasChildren ? ' dengan anak-anak' : ''}.`,
    dhuhrTitle: (name: string) => `Rentang salat Zuhur dekat ${name}`,
    dhuhrDetails: (method: string, women: string, wudu: string, notes: string) => `${method}. Ruang perempuan: ${women}. Wudu: ${wudu}. ${notes}`,
    mealTitle: (name: string) => `Tempat makan yang memperhatikan halal: ${name}`,
    mealDetails: (support: string, budget: string, preference: string) => `${support} Anggaran: ${budget}. Preferensi: ${preference}.`,
    asrTitle: 'Rentang salat Asar',
    asrDetails: (needs: string) => `Gunakan masjid atau ruang salat terdekat. Kebutuhan aksesibilitas yang dicatat: ${needs || 'tidak ada'}.`,
    freeTimeTitle: 'Jelajahi sekitar',
    freeTimeDetails: 'Waktu bebas untuk beristirahat, melihat jalan sekitar, atau memilih perhentian lain yang sesuai.',
  },
};

const facilityNotes: Record<Language, Record<string, string>> = {
  en: {
    'Sample facility details; confirm locally before travel.': 'Facility information may be incomplete; confirm locally before travel.',
    'Verified in this mock dataset for prototype status-label testing only; reconfirm before travel.': 'Facility information may be incomplete; reconfirm before travel.',
  },
  ar: {
    'Sample facility details; confirm locally before travel.': 'قد تكون معلومات المرافق غير مكتملة؛ تحقق محليا قبل السفر.',
    'Verified in this mock dataset for prototype status-label testing only; reconfirm before travel.': 'قد تكون معلومات المرافق غير مكتملة؛ أعد التحقق قبل السفر.',
  },
  id: {
    'Sample facility details; confirm locally before travel.': 'Informasi fasilitas mungkin belum lengkap; konfirmasi di lokasi sebelum bepergian.',
    'Verified in this mock dataset for prototype status-label testing only; reconfirm before travel.': 'Informasi fasilitas mungkin belum lengkap; periksa kembali sebelum bepergian.',
  },
};

const halalSupport = (language: Language) => ({
  en: 'Halal status has not been independently confirmed; confirm halal certification, ingredients, and cross-contact before ordering.',
  ar: 'لم يتم تأكيد حالة الحلال بشكل مستقل؛ تحقق من شهادة الحلال والمكونات واحتمال التلامس قبل الطلب.',
  id: 'Status halal belum dikonfirmasi secara independen; pastikan sertifikasi halal, bahan, dan potensi kontaminasi silang sebelum memesan.',
})[language];

const facilityUncertainty = (language: Language) => ({
  en: 'Facility information may be incomplete',
  ar: 'قد تكون معلومات المرافق غير مكتملة',
  id: 'Informasi fasilitas mungkin belum lengkap',
})[language];

const makeItem = (date: string, item: Omit<ItineraryItem, 'date'>): ItineraryItem => ({ ...item, date, id: `${date}-${item.id}` });

const canFit = (start: string, durationMinutes: number, endTime: string) => minutesOfDay(start) + durationMinutes <= minutesOfDay(endTime);

export const generateItinerary = (prefs: PlannerPreferences, replanFromIndex = 0, language: Language = 'en'): ItineraryItem[] => {
  const city = findCity(prefs.city);
  const copy = plannerCopy[language];
  const attractions = city.places.filter((p) => p.type === 'attraction' && (prefs.interests.length === 0 || p.interests.some((i) => prefs.interests.includes(i))));
  const mosque = city.places.find((p) => p.type === 'mosque') as Place;
  const prayerSpace = city.places.find((p) => p.type === 'prayer-space') as Place;
  const restaurant = city.places.find((p) => p.type === 'restaurant') as Place;
  const prayerPlace = prefs.prayerPreference === 'quiet prayer space' ? prayerSpace : mosque;
  const travel = travelMinutes(prefs);
  const attractionPool = attractions.length ? attractions : city.places.filter((p) => p.type === 'attraction');
  const dates = itineraryDates(prefs.startDate, prefs.endDate);
  const items: ItineraryItem[] = [];
  let attractionCursor = 0;

  dates.forEach((date, dayIndex) => {
    let current = dates.length === 1 && dayIndex === 0 && replanFromIndex ? addMinutes(prefs.startHour, replanFromIndex * 35) : prefs.startHour;
    const dayItems: ItineraryItem[] = [];
    const addDayItem = (item: Omit<ItineraryItem, 'date'>) => dayItems.push(makeItem(date, item));
    const prayerTimes = calculatePrayerDisplay(city, prefs.prayerMethod, date, 'en-GB');
    const dhuhrMinutes = minutesOfDay(prayerTimes.Dhuhr);
    const asrMinutes = minutesOfDay(prayerTimes.Asr);
    let mealAdded = false;
    let attractionsAdded = 0;

    for (let slot = 0; slot < 2; slot += 1) {
      const place = attractionPool[attractionCursor];
      const hasFreshAttraction = Boolean(place);
      if (!hasFreshAttraction) {
        if (canFit(current, 60, prefs.endHour)) {
          addDayItem({ id: `explore-${dayIndex}-${slot}`, time: current, title: copy.freeTimeTitle, kind: 'free-time', durationMinutes: 60, details: copy.freeTimeDetails, status: 'Sample' });
          current = addMinutes(current, 60);
        }
        continue;
      }
      const blockDuration = travel + place.estimatedMinutes;
      if (!canFit(current, blockDuration, prefs.endHour)) break;
      addDayItem({ id: `travel-${dayIndex}-${slot}`, time: current, title: copy.travelTo(place.name), kind: 'travel', durationMinutes: travel, details: copy.travelDetails(optionLabels.transportation[language][prefs.transportation]), status: 'Sample' });
      current = addMinutes(current, travel);
      addDayItem({ id: `${place.id}-${dayIndex}`, time: current, title: place.name, kind: 'attraction', durationMinutes: place.estimatedMinutes, details: copy.attractionDetails(prefs.groupSize, prefs.children), place, status: place.verification });
      current = addMinutes(current, place.estimatedMinutes);
      attractionCursor += 1;
      attractionsAdded += 1;

      if (!mealAdded && canFit(addMinutes(current, 10), restaurant.estimatedMinutes, prefs.endHour)) {
        addDayItem({ id: `${restaurant.id}-${dayIndex}`, time: addMinutes(current, 10), title: copy.mealTitle(restaurant.name), kind: 'meal', durationMinutes: restaurant.estimatedMinutes, details: copy.mealDetails(halalSupport(language), optionLabels.budget[language][restaurant.budgetLevel ?? 'mid'], optionLabels.halalPreference[language][prefs.halalPreference]), place: restaurant, status: restaurant.verification });
        current = addMinutes(current, restaurant.estimatedMinutes + 10);
        mealAdded = true;
      }
    }

    if (dhuhrMinutes >= minutesOfDay(prefs.startHour) && canFit(prayerTimes.Dhuhr, prayerPlace.estimatedMinutes, prefs.endHour)) {
      addDayItem({ id: `dhuhr-${dayIndex}`, time: prayerTimes.Dhuhr, title: copy.dhuhrTitle(prayerPlace.name), kind: 'prayer', durationMinutes: prayerPlace.estimatedMinutes, details: copy.dhuhrDetails(prefs.prayerMethod, facilityUncertainty(language), facilityUncertainty(language), facilityNotes[language][prayerPlace.facility?.notes ?? ''] ?? ''), place: prayerPlace, status: prayerPlace.verification });
    }
    if (asrMinutes >= minutesOfDay(prefs.startHour) && canFit(prayerTimes.Asr, 25, prefs.endHour)) {
      addDayItem({ id: `asr-${dayIndex}`, time: prayerTimes.Asr, title: copy.asrTitle, kind: 'prayer', durationMinutes: 25, details: copy.asrDetails(prefs.accessibilityNeeds), place: prayerPlace, status: prayerPlace.verification });
    }
    if (!attractionsAdded && canFit(current, 60, prefs.endHour)) {
      addDayItem({ id: `explore-${dayIndex}`, time: current, title: copy.freeTimeTitle, kind: 'free-time', durationMinutes: 60, details: copy.freeTimeDetails, status: 'Sample' });
    }
    items.push(...dayItems.sort((a, b) => minutesOfDay(a.time) - minutesOfDay(b.time)));
  });

  return items;
};
