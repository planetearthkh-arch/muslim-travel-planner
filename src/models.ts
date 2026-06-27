export type VerificationStatus = 'Sample' | 'Unverified' | 'Verified';
export type PrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';
export type PrayerMethod = 'Muslim World League' | 'Egyptian General Authority' | 'Umm al-Qura' | 'ISNA' | 'Turkey Diyanet';

export interface FacilityNote {
  womenPrayerSpace: VerificationStatus;
  wudu: VerificationStatus;
  accessibility: VerificationStatus;
  notes: string;
}

export interface Place {
  id: string;
  name: string;
  type: 'attraction' | 'mosque' | 'prayer-space' | 'restaurant';
  area: string;
  description: string;
  estimatedMinutes: number;
  interests: string[];
  familyFriendly: boolean;
  indoor: boolean;
  verification: VerificationStatus;
  facility?: FacilityNote;
  halalSupport?: string;
  evidence?: string;
  budgetLevel?: 'low' | 'mid' | 'high';
}

export interface CityData {
  city: string;
  country: string;
  timezone: string;
  coordinates: { lat: number; lng: number };
  prayerWindows: Record<PrayerName, string>;
  places: Place[];
}

export interface PlannerPreferences {
  city: string;
  startDate: string;
  endDate: string;
  startHour: string;
  endHour: string;
  interests: string[];
  groupSize: number;
  children: boolean;
  walkingAbility: 'low' | 'medium' | 'high';
  transportation: 'walking' | 'public transport' | 'taxi';
  budget: 'low' | 'mid' | 'high';
  prayerMethod: PrayerMethod;
  prayerPreference: 'mosque' | 'quiet prayer space' | 'flexible';
  womenPrayerRequired: boolean;
  wuduRequired: boolean;
  accessibilityNeeds: string;
  halalPreference: 'strictly labelled' | 'vegetarian/seafood options' | 'flexible';
}

export interface ItineraryItem {
  id: string;
  time: string;
  title: string;
  kind: 'travel' | 'attraction' | 'prayer' | 'meal';
  durationMinutes: number;
  details: string;
  place?: Place;
  status: VerificationStatus;
}
