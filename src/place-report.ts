import type { Language } from './app-language.js';
import { safeExternalUrl } from './urls.js';

export type ReportReason = 'wrong-name' | 'wrong-location' | 'closed' | 'wrong-category' | 'hours' | 'contact' | 'accessibility' | 'halal' | 'other';

export type ReportablePlace = {
  feature: string;
  name: string;
  sourceUrl?: string;
  sourceType?: string;
  sourceId?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
};

export type PlaceReport = ReportablePlace & {
  reason: ReportReason;
  note: string;
  language: Language;
  timestamp: string;
};

type ReportCopy = {
  heading: string;
  issueTitle: string;
  feature: string;
  place: string;
  destination: string;
  sourceObject: string;
  sourceUrl: string;
  coordinates: string;
  reason: string;
  note: string;
  language: string;
  timestamp: string;
  notice: string;
  reasons: Record<ReportReason, string>;
};

const reportCopy: Record<Language, ReportCopy> = {
  en: {
    heading: 'SafarOne place report', issueTitle: 'Place report', feature: 'Feature', place: 'Place', destination: 'Destination',
    sourceObject: 'Source object', sourceUrl: 'Source URL', coordinates: 'Mapped coordinates', reason: 'Reason', note: 'Note',
    language: 'Language', timestamp: 'Timestamp', notice: 'Opening this issue page does not submit automatically. A GitHub account may be required.',
    reasons: { 'wrong-name': 'Wrong name', 'wrong-location': 'Wrong location', closed: 'Place is closed or removed', 'wrong-category': 'Wrong category', hours: 'Opening hours are wrong', contact: 'Phone or website is wrong', accessibility: 'Accessibility information is wrong', halal: 'Halal information is wrong', other: 'Other' },
  },
  ar: {
    heading: 'تقرير مكان من SafarOne', issueTitle: 'تقرير مكان', feature: 'الميزة', place: 'المكان', destination: 'الوجهة',
    sourceObject: 'عنصر المصدر', sourceUrl: 'رابط المصدر', coordinates: 'الإحداثيات على الخريطة', reason: 'السبب', note: 'ملاحظة',
    language: 'اللغة', timestamp: 'الوقت', notice: 'فتح صفحة البلاغ لا يرسله تلقائيًا، وقد يلزم حساب GitHub.',
    reasons: { 'wrong-name': 'الاسم غير صحيح', 'wrong-location': 'الموقع غير صحيح', closed: 'المكان مغلق أو أزيل', 'wrong-category': 'الفئة غير صحيحة', hours: 'ساعات العمل غير صحيحة', contact: 'الهاتف أو الموقع الإلكتروني غير صحيح', accessibility: 'معلومات سهولة الوصول غير صحيحة', halal: 'معلومات الحلال غير صحيحة', other: 'أخرى' },
  },
  id: {
    heading: 'Laporan tempat SafarOne', issueTitle: 'Laporan tempat', feature: 'Fitur', place: 'Tempat', destination: 'Tujuan',
    sourceObject: 'Objek sumber', sourceUrl: 'URL sumber', coordinates: 'Koordinat peta', reason: 'Alasan', note: 'Catatan',
    language: 'Bahasa', timestamp: 'Waktu', notice: 'Membuka halaman laporan ini tidak mengirimkannya secara otomatis. Akun GitHub mungkin diperlukan.',
    reasons: { 'wrong-name': 'Nama salah', 'wrong-location': 'Lokasi salah', closed: 'Tempat tutup atau telah dihapus', 'wrong-category': 'Kategori salah', hours: 'Jam buka salah', contact: 'Telepon atau situs web salah', accessibility: 'Informasi aksesibilitas salah', halal: 'Informasi halal salah', other: 'Lainnya' },
  },
  ms: {
    heading: 'Laporan tempat SafarOne', issueTitle: 'Laporan tempat', feature: 'Ciri', place: 'Tempat', destination: 'Destinasi',
    sourceObject: 'Objek sumber', sourceUrl: 'URL sumber', coordinates: 'Koordinat peta', reason: 'Sebab', note: 'Catatan',
    language: 'Bahasa', timestamp: 'Masa', notice: 'Membuka halaman laporan ini tidak menghantarnya secara automatik. Akaun GitHub mungkin diperlukan.',
    reasons: { 'wrong-name': 'Nama salah', 'wrong-location': 'Lokasi salah', closed: 'Tempat ditutup atau telah dialih keluar', 'wrong-category': 'Kategori salah', hours: 'Waktu operasi salah', contact: 'Telefon atau laman web salah', accessibility: 'Maklumat aksesibiliti salah', halal: 'Maklumat halal salah', other: 'Lain-lain' },
  },
  tr: {
    heading: 'SafarOne yer bildirimi', issueTitle: 'Yer bildirimi', feature: 'Özellik', place: 'Yer', destination: 'Varış noktası',
    sourceObject: 'Kaynak nesnesi', sourceUrl: 'Kaynak URL', coordinates: 'Harita koordinatları', reason: 'Neden', note: 'Not',
    language: 'Dil', timestamp: 'Zaman', notice: 'Bu bildirim sayfasını açmak bildirimi otomatik olarak göndermez. Bir GitHub hesabı gerekebilir.',
    reasons: { 'wrong-name': 'Ad yanlış', 'wrong-location': 'Konum yanlış', closed: 'Yer kapalı veya kaldırılmış', 'wrong-category': 'Kategori yanlış', hours: 'Çalışma saatleri yanlış', contact: 'Telefon veya web sitesi yanlış', accessibility: 'Erişilebilirlik bilgisi yanlış', halal: 'Helal bilgisi yanlış', other: 'Diğer' },
  },
  fr: {
    heading: 'Signalement de lieu SafarOne', issueTitle: 'Signalement de lieu', feature: 'Fonction', place: 'Lieu', destination: 'Destination',
    sourceObject: 'Objet source', sourceUrl: 'URL source', coordinates: 'Coordonnées cartographiques', reason: 'Motif', note: 'Note',
    language: 'Langue', timestamp: 'Horodatage', notice: 'L’ouverture de cette page ne transmet pas automatiquement le signalement. Un compte GitHub peut être nécessaire.',
    reasons: { 'wrong-name': 'Nom incorrect', 'wrong-location': 'Emplacement incorrect', closed: 'Lieu fermé ou supprimé', 'wrong-category': 'Catégorie incorrecte', hours: 'Horaires incorrects', contact: 'Téléphone ou site web incorrect', accessibility: 'Informations d’accessibilité incorrectes', halal: 'Informations halal incorrectes', other: 'Autre' },
  },
  ur: {
    heading: 'SafarOne مقام رپورٹ', issueTitle: 'مقام رپورٹ', feature: 'خصوصیت', place: 'مقام', destination: 'منزل',
    sourceObject: 'ماخذ آبجیکٹ', sourceUrl: 'ماخذ یو آر ایل', coordinates: 'نقشے کے نقاط', reason: 'وجہ', note: 'نوٹ',
    language: 'زبان', timestamp: 'وقت', notice: 'اس رپورٹ صفحے کو کھولنے سے رپورٹ خودکار طور پر جمع نہیں ہوتی۔ GitHub اکاؤنٹ درکار ہو سکتا ہے۔',
    reasons: { 'wrong-name': 'نام غلط ہے', 'wrong-location': 'مقام غلط ہے', closed: 'مقام بند یا حذف ہو چکا ہے', 'wrong-category': 'زمرہ غلط ہے', hours: 'اوقات غلط ہیں', contact: 'فون یا ویب سائٹ غلط ہے', accessibility: 'رسائی کی معلومات غلط ہیں', halal: 'حلال معلومات غلط ہیں', other: 'دیگر' },
  },
};

export const reportReasons: ReportReason[] = ['wrong-name', 'wrong-location', 'closed', 'wrong-category', 'hours', 'contact', 'accessibility', 'halal', 'other'];
const MAX_NOTE_LENGTH = 500;

export function sanitizeReportNote(value: string) {
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE_LENGTH);
}

export function sourcePartsFromOsmUrl(sourceUrl = '') {
  const match = /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/(\d+)/.exec(sourceUrl);
  return match ? { sourceType: match[1], sourceId: match[2] } : {};
}

export function normalizeReportablePlace(place: ReportablePlace) {
  const fromUrl = sourcePartsFromOsmUrl(place.sourceUrl);
  return {
    ...place,
    name: sanitizeReportNote(place.name).slice(0, 160) || 'Mapped place',
    sourceUrl: safeExternalUrl(place.sourceUrl),
    sourceType: place.sourceType ?? fromUrl.sourceType,
    sourceId: place.sourceId ?? fromUrl.sourceId,
    latitude: Number.isFinite(place.latitude) ? place.latitude : undefined,
    longitude: Number.isFinite(place.longitude) ? place.longitude : undefined,
  };
}

export function createPlaceReport(place: ReportablePlace, reason: ReportReason, note: string, language: Language, now = new Date().toISOString()): PlaceReport {
  return { ...normalizeReportablePlace(place), reason, note: sanitizeReportNote(note), language, timestamp: now };
}

export function buildReportText(report: PlaceReport) {
  const copy = reportCopy[report.language];
  const lines = [
    copy.heading,
    `${copy.feature}: ${report.feature}`,
    `${copy.place}: ${report.name}`,
    report.city || report.country ? `${copy.destination}: ${[report.city, report.country].filter(Boolean).join(', ')}` : '',
    report.sourceType && report.sourceId ? `${copy.sourceObject}: ${report.sourceType}/${report.sourceId}` : '',
    report.sourceUrl ? `${copy.sourceUrl}: ${report.sourceUrl}` : '',
    Number.isFinite(report.latitude) && Number.isFinite(report.longitude) ? `${copy.coordinates}: ${report.latitude}, ${report.longitude}` : '',
    `${copy.reason}: ${copy.reasons[report.reason]}`,
    report.note ? `${copy.note}: ${report.note}` : '',
    `${copy.language}: ${report.language}`,
    `${copy.timestamp}: ${report.timestamp}`,
  ].filter(Boolean);
  return lines.join('\n');
}

export function osmReportUrl(place: ReportablePlace) {
  const normalized = normalizeReportablePlace(place);
  if (normalized.sourceUrl) return normalized.sourceUrl;
  if (Number.isFinite(normalized.latitude) && Number.isFinite(normalized.longitude)) {
    return safeExternalUrl(`https://www.openstreetmap.org/note/new#map=17/${normalized.latitude}/${normalized.longitude}`);
  }
  return '';
}

export function githubIssueUrl(report: PlaceReport) {
  const copy = reportCopy[report.language];
  const title = `${copy.issueTitle}: ${report.feature} - ${report.name}`.slice(0, 180);
  const body = `${buildReportText(report)}\n\n${copy.notice}`;
  const url = new URL('https://github.com/planetearthkh-arch/muslim-travel-planner/issues/new');
  url.searchParams.set('title', title);
  url.searchParams.set('body', body);
  return safeExternalUrl(url.toString());
}

export function canShareReport(navigatorLike: Pick<Navigator, 'share'> | undefined) {
  return typeof navigatorLike?.share === 'function';
}
