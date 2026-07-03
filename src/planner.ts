import { cities } from './data.js';
import { calculatePrayerDisplay } from './athan.js';
import { optionLabels, type Language } from './i18n.js';
import type { CityData, ItineraryItem, PlannerPreferences, Place, PrayerName, VerificationStatus } from './models.js';

const addMinutes = (time: string, minutes: number) => {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(2026, 0, 1, h, m + minutes);
  return d.toTimeString().slice(0, 5);
};

const minutesOfDay = (time: string) => {
  const match = /(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return Number.NaN;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (/\bPM\b/i.test(time) && hour < 12) hour += 12;
  if (/\bAM\b/i.test(time) && hour === 12) hour = 0;
  return hour * 60 + minute;
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
    attractionDetails: (groupSize: number, hasChildren: boolean, note: string) => `Suggested visit plan. Good for group size ${groupSize}${hasChildren ? ' with children' : ''}.${note ? ` ${note}` : ''}`,
    prayerTitle: (prayer: string, name: string) => `${prayer} prayer near ${name}`,
    prayerDetails: (method: string, women: string, wudu: string, notes: string, fallback: string) => `${method}. Women space: ${women}. Wudu: ${wudu}.${fallback ? ` ${fallback}` : ''}${notes ? ` ${notes}` : ''}`,
    mealTitle: (name: string) => `Halal-conscious meal stop: ${name}`,
    mealDetails: (support: string, budget: string, preference: string, fallback: string) => `${support} Budget: ${budget}. Preference: ${preference}.${fallback ? ` ${fallback}` : ''}`,
    freeTimeTitle: 'Explore nearby',
    freeTimeDetails: 'Open time to rest, browse nearby streets, or choose another suitable stop.',
    freeTimeAlternativeDetails: 'Alternative open time to rest or choose a different nearby stop.',
    fallbackAttraction: 'A perfect match was not available, so the safest suitable stop was selected.',
    fallbackMeal: 'A perfect budget or halal-preference match was not available in the planner data.',
    fallbackPrayer: 'A perfect facility match was not available in the planner data; confirm facilities locally.',
  },
  ar: {
    travelTo: (name: string) => `الانتقال إلى ${name}`,
    travelDetails: (transportation: string) => `${transportation}؛ تقدير مسار وليس حركة مرور مباشرة.`,
    attractionDetails: (groupSize: number, hasChildren: boolean, note: string) => `خطة زيارة مقترحة. مناسبة لمجموعة من ${groupSize}${hasChildren ? ' مع أطفال' : ''}.${note ? ` ${note}` : ''}`,
    prayerTitle: (prayer: string, name: string) => `صلاة ${prayer} قرب ${name}`,
    prayerDetails: (method: string, women: string, wudu: string, notes: string, fallback: string) => `${method}. مصلى النساء: ${women}. الوضوء: ${wudu}.${fallback ? ` ${fallback}` : ''}${notes ? ` ${notes}` : ''}`,
    mealTitle: (name: string) => `توقف طعام يراعي الحلال: ${name}`,
    mealDetails: (support: string, budget: string, preference: string, fallback: string) => `${support} الميزانية: ${budget}. التفضيل: ${preference}.${fallback ? ` ${fallback}` : ''}`,
    freeTimeTitle: 'استكشاف قريب',
    freeTimeDetails: 'وقت مفتوح للراحة أو التجول في الشوارع القريبة أو اختيار محطة مناسبة أخرى.',
    freeTimeAlternativeDetails: 'وقت بديل مفتوح للراحة أو اختيار محطة قريبة مختلفة.',
    fallbackAttraction: 'لم يتوفر تطابق مثالي، لذلك تم اختيار محطة مناسبة وآمنة قدر الإمكان.',
    fallbackMeal: 'لا يتوفر تطابق مثالي للميزانية أو تفضيل الطعام الحلال في بيانات المخطط.',
    fallbackPrayer: 'لا يتوفر تطابق مثالي للمرافق في بيانات المخطط؛ تحقق من المرافق محليا.',
  },
  id: {
    travelTo: (name: string) => `Perjalanan ke ${name}`,
    travelDetails: (transportation: string) => `${transportation}; estimasi rute, bukan lalu lintas langsung.`,
    attractionDetails: (groupSize: number, hasChildren: boolean, note: string) => `Rencana kunjungan yang disarankan. Cocok untuk rombongan berjumlah ${groupSize}${hasChildren ? ' dengan anak-anak' : ''}.${note ? ` ${note}` : ''}`,
    prayerTitle: (prayer: string, name: string) => `Rentang salat ${prayer} dekat ${name}`,
    prayerDetails: (method: string, women: string, wudu: string, notes: string, fallback: string) => `${method}. Ruang perempuan: ${women}. Wudu: ${wudu}.${fallback ? ` ${fallback}` : ''}${notes ? ` ${notes}` : ''}`,
    mealTitle: (name: string) => `Tempat makan yang memperhatikan halal: ${name}`,
    mealDetails: (support: string, budget: string, preference: string, fallback: string) => `${support} Anggaran: ${budget}. Preferensi: ${preference}.${fallback ? ` ${fallback}` : ''}`,
    freeTimeTitle: 'Jelajahi sekitar',
    freeTimeDetails: 'Waktu bebas untuk beristirahat, melihat jalan sekitar, atau memilih perhentian lain yang sesuai.',
    freeTimeAlternativeDetails: 'Waktu bebas alternatif untuk beristirahat atau memilih perhentian terdekat yang berbeda.',
    fallbackAttraction: 'Kecocokan sempurna tidak tersedia, jadi perhentian paling sesuai dipilih.',
    fallbackMeal: 'Kecocokan anggaran atau preferensi halal yang sempurna tidak tersedia dalam data perencana.',
    fallbackPrayer: 'Kecocokan fasilitas yang sempurna tidak tersedia dalam data perencana; konfirmasi fasilitas di lokasi.',
  },
  ms: {
    travelTo: (name: string) => `Perjalanan ke ${name}`,
    travelDetails: (transportation: string) => `${transportation}; anggaran laluan, bukan trafik langsung.`,
    attractionDetails: (groupSize: number, hasChildren: boolean, note: string) => `Rancangan lawatan yang dicadangkan. Sesuai untuk kumpulan seramai ${groupSize}${hasChildren ? ' dengan kanak-kanak' : ''}.${note ? ` ${note}` : ''}`,
    prayerTitle: (prayer: string, name: string) => `Waktu solat ${prayer} berhampiran ${name}`,
    prayerDetails: (method: string, women: string, wudu: string, notes: string, fallback: string) => `${method}. Ruang wanita: ${women}. Wuduk: ${wudu}.${fallback ? ` ${fallback}` : ''}${notes ? ` ${notes}` : ''}`,
    mealTitle: (name: string) => `Hentian makan yang mengambil kira halal: ${name}`,
    mealDetails: (support: string, budget: string, preference: string, fallback: string) => `${support} Anggaran: ${budget}. Pilihan: ${preference}.${fallback ? ` ${fallback}` : ''}`,
    freeTimeTitle: 'Teroka kawasan berhampiran',
    freeTimeDetails: 'Masa lapang untuk berehat, melihat jalan sekitar, atau memilih hentian lain yang sesuai.',
    freeTimeAlternativeDetails: 'Masa lapang alternatif untuk berehat atau memilih hentian berhampiran yang berbeza.',
    fallbackAttraction: 'Padanan sempurna tidak tersedia, jadi hentian paling sesuai dipilih.',
    fallbackMeal: 'Padanan anggaran atau pilihan halal yang sempurna tidak tersedia dalam data perancang.',
    fallbackPrayer: 'Padanan kemudahan yang sempurna tidak tersedia dalam data perancang; sahkan kemudahan di lokasi.',
  },
  tr: {
    travelTo: (name: string) => `${name} noktasına seyahat`,
    travelDetails: (transportation: string) => `${transportation}; canlı trafik değil, rota tahminidir.`,
    attractionDetails: (groupSize: number, hasChildren: boolean, note: string) => `Önerilen ziyaret planı. ${groupSize} kişilik grup için uygundur${hasChildren ? ', çocuklarla birlikte' : ''}.${note ? ` ${note}` : ''}`,
    prayerTitle: (prayer: string, name: string) => `${name} yakınında ${prayer} namazı`,
    prayerDetails: (method: string, women: string, wudu: string, notes: string, fallback: string) => `${method}. Kadın alanı: ${women}. Abdest: ${wudu}.${fallback ? ` ${fallback}` : ''}${notes ? ` ${notes}` : ''}`,
    mealTitle: (name: string) => `Helal hassasiyetli yemek molası: ${name}`,
    mealDetails: (support: string, budget: string, preference: string, fallback: string) => `${support} Bütçe: ${budget}. Tercih: ${preference}.${fallback ? ` ${fallback}` : ''}`,
    freeTimeTitle: 'Yakını keşfet',
    freeTimeDetails: 'Dinlenmek, yakındaki sokakları gezmek veya başka uygun bir durak seçmek için serbest zaman.',
    freeTimeAlternativeDetails: 'Dinlenmek veya yakındaki farklı bir durağı seçmek için alternatif serbest zaman.',
    fallbackAttraction: 'Tam eşleşme bulunamadığı için en güvenli uygun durak seçildi.',
    fallbackMeal: 'Planlayıcı verilerinde bütçe veya helal tercihi için tam eşleşme bulunamadı.',
    fallbackPrayer: 'Planlayıcı verilerinde tesisler için tam eşleşme bulunamadı; imkânları yerinde doğrulayın.',
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
  ms: {
    'Sample facility details; confirm locally before travel.': 'Maklumat kemudahan mungkin tidak lengkap; sahkan di lokasi sebelum mengembara.',
    'Verified in this mock dataset for prototype status-label testing only; reconfirm before travel.': 'Maklumat kemudahan mungkin tidak lengkap; semak semula sebelum mengembara.',
  },
  tr: {
    'Sample facility details; confirm locally before travel.': 'Tesis bilgileri eksik olabilir; seyahatten önce yerinde doğrulayın.',
    'Verified in this mock dataset for prototype status-label testing only; reconfirm before travel.': 'Tesis bilgileri eksik olabilir; seyahatten önce yeniden kontrol edin.',
  },
};

const halalSupport = (language: Language) => ({
  en: 'Halal status has not been independently confirmed; confirm halal certification, ingredients, and cross-contact before ordering.',
  ar: 'لم يتم تأكيد حالة الحلال بشكل مستقل؛ تحقق من شهادة الحلال والمكونات واحتمال التلامس قبل الطلب.',
  id: 'Status halal belum dikonfirmasi secara independen; pastikan sertifikasi halal, bahan, dan potensi kontaminasi silang sebelum memesan.',
  ms: 'Status halal belum disahkan secara bebas; pastikan pensijilan halal, bahan, dan potensi pencemaran silang sebelum membuat pesanan.',
  tr: 'Helal durumu bağımsız olarak doğrulanmamıştır; sipariş vermeden önce helal sertifikasını, içerikleri ve çapraz temas riskini doğrulayın.',
})[language];

const facilityUncertainty = (language: Language) => ({
  en: 'Facility information may be incomplete',
  ar: 'قد تكون معلومات المرافق غير مكتملة',
  id: 'Informasi fasilitas mungkin belum lengkap',
  ms: 'Maklumat kemudahan mungkin tidak lengkap',
  tr: 'Tesis bilgileri eksik olabilir',
})[language];

const makeItem = (date: string, item: Omit<ItineraryItem, 'date'>): ItineraryItem => ({ ...item, date, id: `${date}-${item.id}` });

const verificationScore = (status: VerificationStatus | undefined) => status === 'Verified' ? 3 : status === 'Sample' ? 2 : status === 'Unverified' ? 1 : 0;

const matchesAccessibility = (place: Place, prefs: PlannerPreferences) => !prefs.accessibilityNeeds.trim() || verificationScore(place.facility?.accessibility) >= 2;

const choosePrayerPlace = (city: CityData, prefs: PlannerPreferences) => {
  const candidates = city.places.filter((place) => place.type === 'mosque' || place.type === 'prayer-space');
  const scored = candidates.map((place) => {
    let score = place.type === 'mosque' ? 4 : 3;
    if (prefs.prayerPreference === 'mosque') score += place.type === 'mosque' ? 8 : 0;
    if (prefs.prayerPreference === 'quiet prayer space') score += place.type === 'prayer-space' ? 8 : 0;
    if (prefs.prayerPreference === 'flexible') score += verificationScore(place.verification);
    if (prefs.womenPrayerRequired) score += verificationScore(place.facility?.womenPrayerSpace) * 3;
    if (prefs.wuduRequired) score += verificationScore(place.facility?.wudu) * 3;
    if (prefs.accessibilityNeeds.trim()) score += verificationScore(place.facility?.accessibility) * 2;
    return { place, score };
  }).sort((a, b) => b.score - a.score);
  const selected = scored[0]?.place ?? candidates[0];
  const perfect = (!prefs.womenPrayerRequired || verificationScore(selected?.facility?.womenPrayerSpace) >= 2)
    && (!prefs.wuduRequired || verificationScore(selected?.facility?.wudu) >= 2)
    && matchesAccessibility(selected, prefs);
  return { place: selected, perfect };
};

const rankedAttractions = (city: CityData, prefs: PlannerPreferences) => {
  const attractions = city.places.filter((place) => place.type === 'attraction');
  const scored = attractions.map((place, index) => {
    const interestMatches = prefs.interests.filter((interest) => place.interests.includes(interest)).length;
    let score = interestMatches * 12;
    if (!prefs.interests.length) score += 4;
    if (prefs.children) score += place.familyFriendly ? 8 : -12;
    if (prefs.walkingAbility === 'low') {
      score += place.indoor ? 4 : 0;
      score -= Math.max(0, place.estimatedMinutes - 80) / 10;
      score -= place.interests.includes('walking') ? 6 : 0;
    }
    if (prefs.walkingAbility === 'high') score += place.interests.includes('walking') ? 5 : 0;
    return { place, score, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((item) => item.place);
};

const chooseRestaurant = (city: CityData, prefs: PlannerPreferences) => {
  const restaurants = city.places.filter((place) => place.type === 'restaurant');
  const scored = restaurants.map((place, index) => {
    let score = place.budgetLevel === prefs.budget ? 10 : 0;
    const text = `${place.description} ${place.halalSupport ?? ''}`.toLowerCase();
    if (prefs.halalPreference === 'vegetarian/seafood options') score += /vegetarian|seafood|fish|plant|koshary/.test(text) ? 8 : 0;
    if (prefs.halalPreference === 'strictly labelled') score += /certif|halal/.test(text) ? 6 : 0;
    if (prefs.children) score += /family/.test(text) ? 3 : 0;
    return { place, score, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = scored[0]?.place ?? restaurants[0];
  const perfectBudget = selected?.budgetLevel === prefs.budget;
  const description = `${selected?.description ?? ''} ${selected?.halalSupport ?? ''}`.toLowerCase();
  const perfectHalal = prefs.halalPreference === 'flexible'
    || (prefs.halalPreference === 'strictly labelled' && /certif|halal/.test(description))
    || (prefs.halalPreference === 'vegetarian/seafood options' && /vegetarian|seafood|fish|plant|koshary/.test(description));
  return { place: selected, perfect: Boolean(perfectBudget && perfectHalal) };
};

const rotate = <T>(items: T[], offset: number) => items.length ? [...items.slice(offset % items.length), ...items.slice(0, offset % items.length)] : [];

const prayerNames: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const prayerDisplayNames: Record<Language, Record<PrayerName, string>> = {
  en: { Fajr: 'Fajr', Dhuhr: 'Dhuhr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Isha' },
  ar: { Fajr: 'الفجر', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' },
  id: { Fajr: 'Subuh', Dhuhr: 'Zuhur', Asr: 'Asar', Maghrib: 'Magrib', Isha: 'Isya' },
  ms: { Fajr: 'Subuh', Dhuhr: 'Zohor', Asr: 'Asar', Maghrib: 'Maghrib', Isha: 'Isyak' },
  tr: { Fajr: 'Sabah', Dhuhr: 'Öğle', Asr: 'İkindi', Maghrib: 'Akşam', Isha: 'Yatsı' },
};

interface ScheduleContext {
  copy: typeof plannerCopy[Language];
  language: Language;
  prefs: PlannerPreferences;
  city: CityData;
  date: string;
  dayIndex: number;
  travel: number;
  attractionPool: Place[];
  attractionOffset: number;
  meal: { place: Place; perfect: boolean };
  prayer: { place: Place; perfect: boolean };
  replanDay: boolean;
}

const itemEnd = (item: ItineraryItem) => minutesOfDay(item.time) + item.durationMinutes;

function addFreeTime(context: ScheduleContext, dayItems: ItineraryItem[], startMinutes: number, endMinutes: number, slot: string) {
  const duration = endMinutes - startMinutes;
  if (duration < 30) return;
  dayItems.push(makeItem(context.date, {
    id: `explore-${context.dayIndex}-${slot}`,
    time: addMinutes('00:00', startMinutes),
    title: context.copy.freeTimeTitle,
    kind: 'free-time',
    durationMinutes: Math.min(duration, 90),
    details: context.replanDay ? context.copy.freeTimeAlternativeDetails : context.copy.freeTimeDetails,
    status: 'Sample',
  }));
}

function fillGap(context: ScheduleContext, dayItems: ItineraryItem[], startMinutes: number, endMinutes: number, state: { usedAttractions: Set<string>; mealAdded: boolean }) {
  let current = startMinutes;
  const attraction = context.attractionPool.find((place) => !state.usedAttractions.has(place.id));
  const meal = context.meal.place;
  const canAddMeal = !state.mealAdded && meal && current + meal.estimatedMinutes <= endMinutes;
  const shouldMealFirst = canAddMeal && (current >= 11 * 60 || !attraction || current + context.travel + attraction.estimatedMinutes + 10 + meal.estimatedMinutes > endMinutes);

  if (shouldMealFirst) {
    dayItems.push(makeItem(context.date, {
      id: `${meal.id}-${context.dayIndex}`,
      time: addMinutes('00:00', current),
      title: context.copy.mealTitle(meal.name),
      kind: 'meal',
      durationMinutes: meal.estimatedMinutes,
      details: context.copy.mealDetails(halalSupport(context.language), optionLabels.budget[context.language][meal.budgetLevel ?? 'mid'], optionLabels.halalPreference[context.language][context.prefs.halalPreference], context.meal.perfect ? '' : context.copy.fallbackMeal),
      place: meal,
      status: meal.verification,
    }));
    state.mealAdded = true;
    current += meal.estimatedMinutes;
  }

  if (attraction && current + context.travel + attraction.estimatedMinutes <= endMinutes) {
    const matchesInterests = !context.prefs.interests.length || attraction.interests.some((interest) => context.prefs.interests.includes(interest));
    const familyMatch = !context.prefs.children || attraction.familyFriendly;
    const walkingMatch = context.prefs.walkingAbility !== 'low' || !attraction.interests.includes('walking') || attraction.indoor;
    dayItems.push(makeItem(context.date, {
      id: `travel-${context.dayIndex}-${attraction.id}`,
      time: addMinutes('00:00', current),
      title: context.copy.travelTo(attraction.name),
      kind: 'travel',
      durationMinutes: context.travel,
      details: context.copy.travelDetails(optionLabels.transportation[context.language][context.prefs.transportation]),
      status: 'Sample',
    }));
    current += context.travel;
    dayItems.push(makeItem(context.date, {
      id: `${attraction.id}-${context.dayIndex}`,
      time: addMinutes('00:00', current),
      title: attraction.name,
      kind: 'attraction',
      durationMinutes: attraction.estimatedMinutes,
      details: context.copy.attractionDetails(context.prefs.groupSize, context.prefs.children, matchesInterests && familyMatch && walkingMatch ? '' : context.copy.fallbackAttraction),
      place: attraction,
      status: attraction.verification,
    }));
    state.usedAttractions.add(attraction.id);
    current += attraction.estimatedMinutes;
  }

  if (!state.mealAdded && meal && current + 10 + meal.estimatedMinutes <= endMinutes && current >= 10 * 60) {
    current += 10;
    dayItems.push(makeItem(context.date, {
      id: `${meal.id}-${context.dayIndex}`,
      time: addMinutes('00:00', current),
      title: context.copy.mealTitle(meal.name),
      kind: 'meal',
      durationMinutes: meal.estimatedMinutes,
      details: context.copy.mealDetails(halalSupport(context.language), optionLabels.budget[context.language][meal.budgetLevel ?? 'mid'], optionLabels.halalPreference[context.language][context.prefs.halalPreference], context.meal.perfect ? '' : context.copy.fallbackMeal),
      place: meal,
      status: meal.verification,
    }));
    state.mealAdded = true;
    current += meal.estimatedMinutes;
  }

  addFreeTime(context, dayItems, current, endMinutes, `${startMinutes}-${endMinutes}`);
}

function generateBaseItinerary(prefs: PlannerPreferences, language: Language, replanDayIndex = -1) {
  const city = findCity(prefs.city);
  const copy = plannerCopy[language];
  const travel = travelMinutes(prefs);
  const dates = itineraryDates(prefs.startDate, prefs.endDate);
  const attractionPool = rankedAttractions(city, prefs);
  const meal = chooseRestaurant(city, prefs);
  const prayer = choosePrayerPlace(city, prefs);
  const items: ItineraryItem[] = [];
  const usedAttractions = new Set<string>();

  dates.forEach((date, dayIndex) => {
    const dayItems: ItineraryItem[] = [];
    const state = { usedAttractions, mealAdded: false };
    const startMinutes = minutesOfDay(prefs.startHour);
    const endMinutes = minutesOfDay(prefs.endHour);
    const dayAttractions = rotate(attractionPool, dayIndex === replanDayIndex ? dayIndex + 1 : 0);
    const context: ScheduleContext = { copy, language, prefs, city, date, dayIndex, travel, attractionPool: dayAttractions, attractionOffset: dayIndex, meal, prayer, replanDay: dayIndex === replanDayIndex };
    const prayerTimes = calculatePrayerDisplay(city, prefs.prayerMethod, date, 'en-GB');
    const prayers = prayerNames
      .map((name) => ({ name, time: prayerTimes[name], minutes: minutesOfDay(prayerTimes[name]), duration: prayer.place.estimatedMinutes }))
      .filter((entry) => Number.isFinite(entry.minutes) && entry.minutes >= startMinutes && entry.minutes + entry.duration <= endMinutes)
      .sort((a, b) => a.minutes - b.minutes);
    let current = startMinutes;

    prayers.forEach((entry) => {
      fillGap(context, dayItems, current, entry.minutes, state);
      dayItems.push(makeItem(date, {
        id: `${entry.name.toLowerCase()}-${dayIndex}`,
        time: entry.time,
        title: copy.prayerTitle(prayerDisplayNames[language][entry.name], prayer.place.name),
        kind: 'prayer',
        durationMinutes: entry.duration,
        details: copy.prayerDetails(prefs.prayerMethod, facilityUncertainty(language), facilityUncertainty(language), facilityNotes[language][prayer.place.facility?.notes ?? ''] ?? '', prayer.perfect ? '' : copy.fallbackPrayer),
        place: prayer.place,
        status: prayer.place.verification,
      }));
      current = entry.minutes + entry.duration;
    });

    fillGap(context, dayItems, current, endMinutes, state);
    items.push(...dayItems.sort((a, b) => minutesOfDay(a.time) - minutesOfDay(b.time)));
  });

  return items.filter((item) => minutesOfDay(item.time) >= minutesOfDay(prefs.startHour) && itemEnd(item) <= minutesOfDay(prefs.endHour));
}

export const generateItinerary = (prefs: PlannerPreferences, replanFromIndex = 0, language: Language = 'en'): ItineraryItem[] => {
  if (!replanFromIndex) return generateBaseItinerary(prefs, language);
  const baseline = generateBaseItinerary(prefs, language);
  const target = baseline[replanFromIndex - 1];
  const dates = itineraryDates(prefs.startDate, prefs.endDate);
  const replanDayIndex = Math.max(0, dates.indexOf(target?.date ?? dates[0] ?? ''));
  return generateBaseItinerary(prefs, language, replanDayIndex);
};
