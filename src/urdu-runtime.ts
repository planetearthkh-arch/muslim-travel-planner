import { athanLabels } from './athan-i18n.js';
import {
  labels,
  languages,
  optionLabels,
  prayerLabels,
  regionLabels,
  statusLabels,
} from './i18n.js';
import { urduExtraLabelsA } from './urdu-labels-extra-a.js';
import { urduExtraLabelsC } from './urdu-labels-extra-c.js';
import { urduFlightLabels } from './urdu-labels-flight.js';
import { urduLabels } from './urdu-labels.js';
import { urduTransportLabelsA } from './urdu-labels-transport-a.js';
import { urduTransportLabelsB } from './urdu-labels-transport-b.js';
import { urduTransportLabelsC } from './urdu-labels-transport-c.js';

type MutableLabelMap = Record<string, Record<string, string>>;

const mutableLanguages = languages as unknown as Array<{ code: string; label: string }>;
if (!mutableLanguages.some((language) => language.code === 'ur')) {
  mutableLanguages.push({ code: 'ur', label: 'اردو' });
}

const allUrduLabels = {
  ...labels.en,
  ...urduLabels,
  ...urduFlightLabels,
  ...urduTransportLabelsA,
  ...urduTransportLabelsB,
  ...urduTransportLabelsC,
  ...urduExtraLabelsA,
  ...urduExtraLabelsC,
};

(labels as unknown as MutableLabelMap).ur = allUrduLabels;
(regionLabels as unknown as MutableLabelMap).ur = {
  Europe: 'یورپ',
  'Middle East': 'مشرقِ وسطیٰ',
  Asia: 'ایشیا',
  'North America': 'شمالی امریکہ',
  Africa: 'افریقہ',
  Oceania: 'اوشیانا',
};
(statusLabels as unknown as MutableLabelMap).ur = {
  Sample: 'نمونہ',
  Unverified: 'غیر تصدیق شدہ',
  Verified: 'تصدیق شدہ',
};
(prayerLabels as unknown as MutableLabelMap).ur = {
  Fajr: 'فجر',
  Dhuhr: 'ظہر',
  Asr: 'عصر',
  Maghrib: 'مغرب',
  Isha: 'عشاء',
};

(optionLabels.budget as unknown as MutableLabelMap).ur = {
  low: 'کم',
  mid: 'درمیانہ',
  high: 'زیادہ',
};
(optionLabels.walkingAbility as unknown as MutableLabelMap).ur = {
  low: 'کم',
  medium: 'درمیانہ',
  high: 'زیادہ',
};
(optionLabels.transportation as unknown as MutableLabelMap).ur = {
  walking: 'پیدل',
  'public transport': 'عوامی ٹرانسپورٹ',
  taxi: 'ٹیکسی',
};
(optionLabels.prayerPreference as unknown as MutableLabelMap).ur = {
  mosque: 'مسجد',
  'quiet prayer space': 'پُرسکون نماز کی جگہ',
  flexible: 'لچکدار',
};
(optionLabels.halalPreference as unknown as MutableLabelMap).ur = {
  'strictly labelled': 'واضح طور پر حلال درج',
  'vegetarian/seafood options': 'سبزی یا سمندری غذا کے اختیارات',
  flexible: 'لچکدار',
};

(athanLabels as unknown as MutableLabelMap).ur = {
  title: 'نماز کے اوقات اور یاد دہانیاں',
  calculated: 'حساب شدہ نماز کے اوقات',
  sunrise: 'طلوعِ آفتاب',
  description: 'موبائل ایپ بند ہونے کے باوجود نماز کی اطلاعات مقرر کر سکتی ہے۔ آئی فون نظام کی اطلاع کی آواز استعمال کرتا ہے۔ براؤزر میں اذان صرف اس وقت چلتی ہے جب یہ صفحہ کھلا رہے۔',
  browserNotice: 'براؤزر پیش نظارہ: اذان اس وقت تک چلتی ہے جب یہ صفحہ کھلا رہے۔ ایپ بند ہونے پر نماز کی اطلاعات کے لیے موبائل ایپ نصب کریں۔',
  androidNotice: 'اس آلے پر پس منظر میں نماز کی اطلاعات دستیاب ہیں۔',
  enable: 'نماز کی اطلاعات فعال کریں',
  reschedule: 'نماز کی اطلاعات اپ ڈیٹ کریں',
  disable: 'اطلاعات بند کریں',
  test: 'اطلاع آزمائیں',
  stop: 'آزمائشی آواز بند کریں',
  preparing: 'نماز کی اطلاعات تیار ہو رہی ہیں…',
  scheduled: 'نماز کی اطلاعات مقرر ہو گئیں',
  disabled: 'نماز کی اطلاعات بند کر دی گئیں۔',
  failed: 'نماز کی اطلاعات ترتیب نہیں دی جا سکیں۔ اطلاع کی اجازت چیک کریں۔',
  noFuture: 'منتخب تاریخوں کے لیے آئندہ نماز کا وقت نہیں ملا۔',
  permissionNote: 'اطلاعات اور آوازوں کی اجازت دیں تاکہ نماز کی یاد دہانی وقت پر پہنچے۔',
};

function syncUrduDirection() {
  if (document.documentElement.lang === 'ur') {
    document.documentElement.dir = 'rtl';
  }
}

new MutationObserver(syncUrduDirection).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['lang', 'dir'],
});
window.queueMicrotask(syncUrduDirection);
