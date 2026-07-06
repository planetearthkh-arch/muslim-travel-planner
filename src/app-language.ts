import {
  labels as coreLabels,
  languages as coreLanguages,
  optionLabels as coreOptionLabels,
  prayerLabels as corePrayerLabels,
  regionLabels as coreRegionLabels,
  statusLabels as coreStatusLabels,
  type Language as CoreLanguage,
} from './i18n.js';
import { indonesianLabelCorrections, malayLabelCorrections } from './language-quality-corrections.js';
import { urduExtraLabelsA } from './urdu-labels-extra-a.js';
import { urduExtraLabelsC } from './urdu-labels-extra-c.js';
import { urduFlightLabels } from './urdu-labels-flight.js';
import { urduLabels } from './urdu-labels.js';
import { urduTransportLabelsA } from './urdu-labels-transport-a.js';
import { urduTransportLabelsB } from './urdu-labels-transport-b.js';
import { urduTransportLabelsC } from './urdu-labels-transport-c.js';
import type { PrayerName, Region, VerificationStatus } from './models.js';

export type Language = CoreLanguage | 'ur';

export const languages: Array<{ code: Language; label: string }> = [
  ...coreLanguages,
  { code: 'ur', label: 'اردو' },
];

export const languageDirection = (language: Language) => language === 'ar' || language === 'ur' ? 'rtl' : 'ltr';

export const localeForLanguage = (language: Language) => ({
  en: 'en-US',
  ar: 'ar',
  ur: 'ur-PK',
  id: 'id-ID',
  ms: 'ms-MY',
  tr: 'tr-TR',
  fr: 'fr-FR',
} satisfies Record<Language, string>)[language];

export function parseLanguage(value: unknown): Language | null {
  return languages.some((language) => language.code === value) ? value as Language : null;
}

export const labels: Record<Language, Record<string, string>> = {
  en: { ...coreLabels.en, prototype: 'Release 1.0' },
  ar: { ...coreLabels.ar, prototype: 'الإصدار 1.0' },
  id: { ...coreLabels.id, ...indonesianLabelCorrections, prototype: 'Rilis 1.0', prayerAppleMaps: 'Buka di Apple Maps' },
  ms: { ...coreLabels.ms, ...malayLabelCorrections, prototype: 'Keluaran 1.0', prayerAppleMaps: 'Buka dalam Apple Maps' },
  tr: { ...coreLabels.tr, prototype: 'Sürüm 1.0', prayerAppleMaps: 'Apple Haritalar’da aç' },
  fr: { ...coreLabels.fr, prototype: 'Version 1.0' },
  ur: {
    ...coreLabels.en,
    ...urduLabels,
    ...urduFlightLabels,
    ...urduTransportLabelsA,
    ...urduTransportLabelsB,
    ...urduTransportLabelsC,
    ...urduExtraLabelsA,
    ...urduExtraLabelsC,
    prototype: 'ریلیز 1.0',
    prayerAppleMaps: 'Apple Maps میں کھولیں',
  },
};

export const regionLabels = {
  ...coreRegionLabels,
  ur: {
    Europe: 'یورپ',
    'Middle East': 'مشرقِ وسطیٰ',
    Asia: 'ایشیا',
    'North America': 'شمالی امریکہ',
    Africa: 'افریقہ',
    Oceania: 'اوشیانا',
  },
} satisfies Record<Language, Record<Region, string>>;

export const statusLabels = {
  ...coreStatusLabels,
  ur: { Sample: 'نمونہ', Unverified: 'غیر تصدیق شدہ', Verified: 'تصدیق شدہ' },
} satisfies Record<Language, Record<VerificationStatus, string>>;

export const prayerLabels = {
  ...corePrayerLabels,
  ur: { Fajr: 'فجر', Dhuhr: 'ظہر', Asr: 'عصر', Maghrib: 'مغرب', Isha: 'عشاء' },
} satisfies Record<Language, Record<PrayerName, string>>;

export const optionLabels = {
  budget: {
    ...coreOptionLabels.budget,
    ur: { low: 'کم', mid: 'درمیانہ', high: 'زیادہ' },
  },
  walkingAbility: {
    ...coreOptionLabels.walkingAbility,
    ur: { low: 'کم', medium: 'درمیانہ', high: 'زیادہ' },
  },
  transportation: {
    ...coreOptionLabels.transportation,
    ur: { walking: 'پیدل', 'public transport': 'عوامی ٹرانسپورٹ', taxi: 'ٹیکسی' },
  },
  prayerPreference: {
    ...coreOptionLabels.prayerPreference,
    ur: { mosque: 'مسجد', 'quiet prayer space': 'پُرسکون نماز کی جگہ', flexible: 'لچکدار' },
  },
  halalPreference: {
    ...coreOptionLabels.halalPreference,
    ur: { 'strictly labelled': 'واضح طور پر حلال درج', 'vegetarian/seafood options': 'سبزی یا سمندری غذا کے اختیارات', flexible: 'لچکدار' },
  },
};
