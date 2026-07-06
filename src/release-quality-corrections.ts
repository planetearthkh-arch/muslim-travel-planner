import type { Language } from './app-language.js';

export const releaseQualityLabelCorrections = {
  en: {
    prototype: 'Release 1.0',
  },
  ar: {
    prototype: 'الإصدار 1.0',
  },
  id: {
    prototype: 'Rilis 1.0',
    prayerAppleMaps: 'Buka di Apple Maps',
  },
  ms: {
    prototype: 'Keluaran 1.0',
    prayerAppleMaps: 'Buka dalam Apple Maps',
  },
  tr: {
    prototype: 'Sürüm 1.0',
    prayerAppleMaps: 'Apple Haritalar’da aç',
  },
  fr: {
    prototype: 'Version 1.0',
  },
  ur: {
    prototype: 'ریلیز 1.0',
    prayerAppleMaps: 'Apple Maps میں کھولیں',
  },
} satisfies Record<Language, Record<string, string>>;
