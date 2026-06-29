import type { CityData } from './models.js';
import type { Language } from './i18n.js';

export interface CurrencyInfo {
  code: string;
  name: Record<Language, string>;
  symbol: string;
  flag: string;
  countries: string[];
  search: string[];
}

export interface PairRate {
  base: string;
  quote: string;
  rate: number;
  date: string;
  refreshedAt: string;
  cached: boolean;
}

export interface ConversionResult {
  amount: number;
  converted: number;
  rate: number;
  reverseRate: number;
}

export const FRANKFURTER_BASE_URL = 'https://api.frankfurter.dev/v2';
export const RATE_CACHE_MS = 1000 * 60 * 60 * 12;
export const CURRENCY_CACHE_MS = 1000 * 60 * 60 * 24 * 7;
export const popularCurrencyCodes = ['USD', 'EUR', 'GBP', 'ILS', 'JOD', 'SAR', 'AED', 'TRY', 'EGP', 'MAD', 'QAR', 'KWD', 'BHD', 'OMR', 'IDR', 'MYR', 'PKR', 'BDT', 'INR', 'JPY', 'CNY', 'KRW', 'AUD', 'CAD', 'CHF'];

const names: Record<string, { en: string; ar: string; id: string; symbol: string; flag: string; countries: string[]; aliases?: string[] }> = {
  USD: { en: 'US Dollar', ar: 'دولار أمريكي', id: 'Dolar AS', symbol: '$', flag: '🇺🇸', countries: ['United States'], aliases: ['America'] },
  EUR: { en: 'Euro', ar: 'يورو', id: 'Euro', symbol: '€', flag: '🇪🇺', countries: ['Euro area', 'France', 'Spain', 'Italy'] },
  GBP: { en: 'British Pound', ar: 'جنيه إسترليني', id: 'Poundsterling Inggris', symbol: '£', flag: '🇬🇧', countries: ['United Kingdom'] },
  ILS: { en: 'Israeli New Shekel', ar: 'شيكل إسرائيلي جديد', id: 'Shekel Baru Israel', symbol: '₪', flag: '🇮🇱', countries: ['Israel', 'Palestine'] },
  JOD: { en: 'Jordanian Dinar', ar: 'دينار أردني', id: 'Dinar Yordania', symbol: 'د.ا', flag: '🇯🇴', countries: ['Jordan', 'Palestine'] },
  SAR: { en: 'Saudi Riyal', ar: 'ريال سعودي', id: 'Riyal Saudi', symbol: 'ر.س', flag: '🇸🇦', countries: ['Saudi Arabia'] },
  AED: { en: 'UAE Dirham', ar: 'درهم إماراتي', id: 'Dirham UEA', symbol: 'د.إ', flag: '🇦🇪', countries: ['United Arab Emirates'] },
  TRY: { en: 'Turkish Lira', ar: 'ليرة تركية', id: 'Lira Turki', symbol: '₺', flag: '🇹🇷', countries: ['Türkiye', 'Turkey'] },
  EGP: { en: 'Egyptian Pound', ar: 'جنيه مصري', id: 'Pound Mesir', symbol: '£', flag: '🇪🇬', countries: ['Egypt'] },
  MAD: { en: 'Moroccan Dirham', ar: 'درهم مغربي', id: 'Dirham Maroko', symbol: 'د.م.', flag: '🇲🇦', countries: ['Morocco'] },
  QAR: { en: 'Qatari Riyal', ar: 'ريال قطري', id: 'Riyal Qatar', symbol: 'ر.ق', flag: '🇶🇦', countries: ['Qatar'] },
  KWD: { en: 'Kuwaiti Dinar', ar: 'دينار كويتي', id: 'Dinar Kuwait', symbol: 'د.ك', flag: '🇰🇼', countries: ['Kuwait'] },
  BHD: { en: 'Bahraini Dinar', ar: 'دينار بحريني', id: 'Dinar Bahrain', symbol: 'د.ب', flag: '🇧🇭', countries: ['Bahrain'] },
  OMR: { en: 'Omani Rial', ar: 'ريال عماني', id: 'Rial Oman', symbol: 'ر.ع.', flag: '🇴🇲', countries: ['Oman'] },
  IDR: { en: 'Indonesian Rupiah', ar: 'روبية إندونيسية', id: 'Rupiah Indonesia', symbol: 'Rp', flag: '🇮🇩', countries: ['Indonesia'] },
  MYR: { en: 'Malaysian Ringgit', ar: 'رينغيت ماليزي', id: 'Ringgit Malaysia', symbol: 'RM', flag: '🇲🇾', countries: ['Malaysia'] },
  PKR: { en: 'Pakistani Rupee', ar: 'روبية باكستانية', id: 'Rupee Pakistan', symbol: '₨', flag: '🇵🇰', countries: ['Pakistan'] },
  BDT: { en: 'Bangladeshi Taka', ar: 'تاكا بنغلاديشي', id: 'Taka Bangladesh', symbol: '৳', flag: '🇧🇩', countries: ['Bangladesh'] },
  INR: { en: 'Indian Rupee', ar: 'روبية هندية', id: 'Rupee India', symbol: '₹', flag: '🇮🇳', countries: ['India'] },
  JPY: { en: 'Japanese Yen', ar: 'ين ياباني', id: 'Yen Jepang', symbol: '¥', flag: '🇯🇵', countries: ['Japan'] },
  CNY: { en: 'Chinese Yuan', ar: 'يوان صيني', id: 'Yuan Tiongkok', symbol: '¥', flag: '🇨🇳', countries: ['China'] },
  KRW: { en: 'South Korean Won', ar: 'وون كوري جنوبي', id: 'Won Korea Selatan', symbol: '₩', flag: '🇰🇷', countries: ['South Korea'] },
  AUD: { en: 'Australian Dollar', ar: 'دولار أسترالي', id: 'Dolar Australia', symbol: 'A$', flag: '🇦🇺', countries: ['Australia'] },
  CAD: { en: 'Canadian Dollar', ar: 'دولار كندي', id: 'Dolar Kanada', symbol: 'C$', flag: '🇨🇦', countries: ['Canada'] },
  CHF: { en: 'Swiss Franc', ar: 'فرنك سويسري', id: 'Franc Swiss', symbol: 'CHF', flag: '🇨🇭', countries: ['Switzerland'] },
  SGD: { en: 'Singapore Dollar', ar: 'دولار سنغافوري', id: 'Dolar Singapura', symbol: 'S$', flag: '🇸🇬', countries: ['Singapore'] },
  THB: { en: 'Thai Baht', ar: 'بات تايلاندي', id: 'Baht Thailand', symbol: '฿', flag: '🇹🇭', countries: ['Thailand'] },
  ZAR: { en: 'South African Rand', ar: 'راند جنوب أفريقي', id: 'Rand Afrika Selatan', symbol: 'R', flag: '🇿🇦', countries: ['South Africa'] },
  BAM: { en: 'Bosnia-Herzegovina Convertible Mark', ar: 'مارك بوسني قابل للتحويل', id: 'Mark Konvertibel Bosnia-Herzegovina', symbol: 'KM', flag: '🇧🇦', countries: ['Bosnia and Herzegovina'] },
  UZS: { en: 'Uzbekistani Som', ar: 'سوم أوزبكي', id: 'Som Uzbekistan', symbol: "so'm", flag: '🇺🇿', countries: ['Uzbekistan'] },
};

const localeFor = (language: Language) => ({ en: 'en-US', ar: 'ar', id: 'id-ID' })[language];

export const makeCurrencyInfo = (code: string, englishName?: string): CurrencyInfo => {
  const upper = code.toUpperCase();
  const known = names[upper];
  const en = known?.en ?? englishName ?? upper;
  const ar = known?.ar ?? en;
  const id = known?.id ?? en;
  const countries = known?.countries ?? [];
  return {
    code: upper,
    name: { en, ar, id },
    symbol: known?.symbol ?? upper,
    flag: known?.flag ?? '¤',
    countries,
    search: [upper, en, ar, id, ...countries, ...(known?.aliases ?? [])].map((value) => value.toLowerCase()),
  };
};

export const fallbackCurrencies = Object.keys(names).map((code) => makeCurrencyInfo(code));

export const normalizeCurrencies = (payload: unknown): CurrencyInfo[] => {
  const entries = Array.isArray(payload)
    ? payload
      .filter((item): item is { iso_code: string; name: string; symbol?: string | null } => Boolean(item) && typeof item === 'object' && typeof (item as { iso_code?: unknown }).iso_code === 'string' && typeof (item as { name?: unknown }).name === 'string')
      .map((item) => [item.iso_code, item.name] as [string, string])
    : payload && typeof payload === 'object'
      ? Object.entries(payload as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      : null;
  if (!entries) throw new Error('Malformed currency response');
  const normalized = entries
    .filter(([code, name]) => /^[A-Z]{3}$/.test(code) && Boolean(name.trim()))
    .map(([code, name]) => makeCurrencyInfo(code, name))
    .sort((a, b) => a.code.localeCompare(b.code));
  if (!normalized.length) throw new Error('Malformed currency response');
  return normalized;
};

export const parseAmountInput = (raw: string): { value: number | null; error?: 'empty' | 'negative' | 'invalid' | 'tooLarge' } => {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, error: 'empty' };
  if (/^-/.test(trimmed) || /−/.test(trimmed)) return { value: null, error: 'negative' };
  const normalizedDigits = trimmed.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const numeric = normalizedDigits.replace(/[^\d.,]/g, '');
  if (!numeric || !/\d/.test(numeric)) return { value: null, error: 'invalid' };
  const lastComma = numeric.lastIndexOf(',');
  const lastDot = numeric.lastIndexOf('.');
  const decimal = lastComma > lastDot ? ',' : lastDot > -1 ? '.' : '';
  const cleaned = decimal ? numeric.slice(0, numeric.lastIndexOf(decimal)).replace(/[.,]/g, '') + '.' + numeric.slice(numeric.lastIndexOf(decimal) + 1).replace(/[.,]/g, '') : numeric.replace(/[.,]/g, '');
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return { value: null, error: 'invalid' };
  if (value > 1_000_000_000_000_000) return { value: null, error: 'tooLarge' };
  return { value };
};

export const convertAmount = (amount: number, rate: number): ConversionResult => {
  if (!Number.isFinite(amount) || !Number.isFinite(rate) || rate <= 0) throw new Error('Invalid conversion input');
  return { amount, converted: amount * rate, rate, reverseRate: 1 / rate };
};

export const validateRateResponse = (payload: unknown, base: string, quote: string, refreshedAt = new Date().toISOString()): PairRate => {
  if (!payload || typeof payload !== 'object') throw new Error('Malformed rate response');
  const body = payload as { base?: unknown; quote?: unknown; date?: unknown; rate?: unknown; rates?: unknown };
  const directRate = body.quote === quote ? body.rate : undefined;
  const legacyRate = body.rates && typeof body.rates === 'object' ? (body.rates as Record<string, unknown>)[quote] : undefined;
  const rate = directRate ?? legacyRate;
  if (body.base !== base || typeof body.date !== 'string') throw new Error('Missing rate data');
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) throw new Error('Unsupported currency');
  return { base, quote, rate, date: body.date, refreshedAt, cached: false };
};

export const formatCurrencyAmount = (value: number, code: string, language: Language) => new Intl.NumberFormat(localeFor(language), {
  style: 'currency',
  currency: code,
  currencyDisplay: 'narrowSymbol',
  maximumSignificantDigits: Math.abs(value) > 0 && Math.abs(value) < 0.01 ? 6 : undefined,
}).format(value);

export const formatPlainNumber = (value: number, language: Language) => new Intl.NumberFormat(localeFor(language), { maximumSignificantDigits: 8 }).format(value);

export const searchCurrencies = (currencies: CurrencyInfo[], query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return currencies;
  return currencies.filter((currency) => currency.search.some((part) => part.includes(normalized)));
};

export const destinationCurrency = (city: CityData) => city.money.localCurrencies[0]?.code ?? 'USD';

export const cacheKeyForRate = (base: string, quote: string) => `mtp-rate-${base}-${quote}`;

export const readJsonCache = <T>(storage: Storage | undefined, key: string, maxAgeMs: number): T | null => {
  if (!storage) return null;
  try {
    const cached = JSON.parse(storage.getItem(key) ?? '') as { savedAt: number; value: T };
    if (!cached || Date.now() - cached.savedAt > maxAgeMs) return null;
    return cached.value;
  } catch {
    return null;
  }
};

export const writeJsonCache = <T>(storage: Storage | undefined, key: string, value: T) => {
  try {
    storage?.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // Browsers can deny storage in private modes; conversion should still work.
  }
};

export const historyStats = (ratesPayload: Record<string, Record<string, number>> | Array<{ date: string; base: string; quote: string; rate: number }>, quote: string, base = 'EUR') => {
  const points = (Array.isArray(ratesPayload)
    ? Object.entries(ratesPayload.reduce<Record<string, Record<string, number>>>((days, item) => {
      days[item.date] = { ...(days[item.date] ?? {}), [item.quote]: item.rate };
      return days;
    }, {})).map(([date, rates]) => {
      const rate = base === 'EUR' ? rates[quote] : quote === 'EUR' ? 1 / rates[base] : rates[quote] / rates[base];
      return { date, rate };
    })
    : Object.entries(ratesPayload).map(([date, rates]) => ({ date, rate: base === 'EUR' ? rates[quote] : quote === 'EUR' ? 1 / rates[base] : rates[quote] / rates[base] })))
    .filter((point): point is { date: string; rate: number } => typeof point.rate === 'number' && Number.isFinite(point.rate) && point.rate > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!points.length) throw new Error('Missing history data');
  const start = points[0].rate;
  const latest = points[points.length - 1].rate;
  return {
    points,
    high: Math.max(...points.map((point) => point.rate)),
    low: Math.min(...points.map((point) => point.rate)),
    start,
    latest,
    changePercent: ((latest - start) / start) * 100,
  };
};
