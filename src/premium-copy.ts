import type { Language } from './app-language.js';

export type PreviewKind = 'mosques' | 'halal' | 'landmarks';

export interface PremiumCopy {
  premium: string;
  lifetime: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  once: string;
  noSubscription: string;
  purchase: string;
  restore: string;
  close: string;
  included: string;
  legacy: string;
  purchased: string;
  restored: string;
  pending: string;
  cancelled: string;
  unavailable: string;
  error: string;
  features: string[];
  lockedFeature: string;
  planPreviewTitle: string;
  planPreviewBody: string;
  placesPreviewTitle: string;
  placesPreviewBody: string;
  unlockPlan: string;
  unlockPlaces: string;
  placeKinds: Record<PreviewKind, string>;
}

export const copyByLanguage: Record<Language, PremiumCopy> = {
  en: {
    premium: 'Premium', lifetime: 'Lifetime', eyebrow: 'SafarMate Premium', title: 'Unlock your complete Muslim-friendly trip',
    subtitle: 'Get the full day-by-day itinerary, every mosque, halal place, landmark and attraction, plus maps, directions and prayer-aware travel tools.', once: 'one-time purchase',
    noSubscription: 'No subscription. No recurring charge.', purchase: 'Unlock Lifetime Premium', restore: 'Restore Purchases', close: 'Close',
    included: 'Premium is active', legacy: 'Your early-supporter Premium access is included.', purchased: 'Premium unlocked. Thank you for supporting SafarMate.',
    restored: 'Your Premium purchase has been restored.', pending: 'Your purchase is pending approval.', cancelled: 'The purchase was cancelled.',
    unavailable: 'Purchases are temporarily unavailable. Please try again later.', error: 'We could not complete that request.',
    features: ['Complete personalized day-by-day itinerary', 'All mosque, halal-food, landmark and attraction results', 'Maps, directions, filters and transport guidance', 'Full in-flight prayer and Qibla tools', 'Offline trip details, saving and export', 'All future Lifetime Premium features'],
    lockedFeature: 'Unlock the complete plan and all Muslim-friendly places for this destination.',
    planPreviewTitle: 'Your complete Muslim-friendly trip is ready',
    planPreviewBody: 'You are seeing {visible} of {stops} planned stops. Unlock all {days} days, prayer-aware routes, maps and travel tools.',
    placesPreviewTitle: 'More {kind} are ready',
    placesPreviewBody: '{visible} of {total} shown. Unlock every result, filters, maps and directions.',
    unlockPlan: 'Unlock the complete trip', unlockPlaces: 'Unlock all results',
    placeKinds: { mosques: 'mosques and prayer spaces', halal: 'halal places', landmarks: 'landmarks and attractions' },
  },
  ar: {
    premium: 'بريميوم', lifetime: 'مدى الحياة', eyebrow: 'سفر ميت بريميوم', title: 'افتح رحلتك الإسلامية الكاملة',
    subtitle: 'احصل على برنامج يومي كامل، وجميع المساجد والأماكن الحلال والمعالم والوجهات، مع الخرائط والاتجاهات وأدوات السفر المراعية للصلاة.', once: 'دفعة واحدة',
    noSubscription: 'دون اشتراك أو رسوم متكررة.', purchase: 'فتح بريميوم مدى الحياة', restore: 'استعادة المشتريات', close: 'إغلاق',
    included: 'بريميوم مفعّل', legacy: 'تم تضمين وصول بريميوم لك بصفتك من المستخدمين الأوائل.', purchased: 'تم فتح بريميوم. شكرًا لدعم سفر ميت.',
    restored: 'تمت استعادة شراء بريميوم.', pending: 'عملية الشراء بانتظار الموافقة.', cancelled: 'تم إلغاء الشراء.',
    unavailable: 'المشتريات غير متاحة مؤقتًا. حاول لاحقًا.', error: 'تعذر إكمال الطلب.',
    features: ['برنامج يومي شخصي كامل', 'جميع نتائج المساجد والطعام الحلال والمعالم والوجهات', 'الخرائط والاتجاهات والفلاتر وإرشادات النقل', 'أدوات الصلاة والقبلة الكاملة أثناء الطيران', 'تفاصيل الرحلة دون إنترنت والحفظ والتصدير', 'جميع ميزات بريميوم المستقبلية مدى الحياة'],
    lockedFeature: 'افتح الخطة الكاملة وجميع الأماكن المناسبة للمسلمين في هذه الوجهة.',
    planPreviewTitle: 'رحلتك الإسلامية الكاملة جاهزة',
    planPreviewBody: 'تشاهد {visible} من أصل {stops} محطة مخططة. افتح جميع أيام الرحلة وعددها {days} مع المسارات المراعية للصلاة والخرائط وأدوات السفر.',
    placesPreviewTitle: 'المزيد من {kind} جاهز',
    placesPreviewBody: 'يظهر {visible} من أصل {total}. افتح جميع النتائج والفلاتر والخرائط والاتجاهات.',
    unlockPlan: 'فتح الرحلة الكاملة', unlockPlaces: 'فتح جميع النتائج',
    placeKinds: { mosques: 'المساجد وأماكن الصلاة', halal: 'الأماكن الحلال', landmarks: 'المعالم والوجهات' },
  },
  id: {
    premium: 'Premium', lifetime: 'Seumur Hidup', eyebrow: 'SafarMate Premium', title: 'Buka perjalanan ramah Muslim Anda secara lengkap',
    subtitle: 'Dapatkan rencana harian lengkap, semua masjid, tempat halal, landmark dan atraksi, plus peta, arah, dan alat perjalanan yang mempertimbangkan waktu salat.', once: 'sekali bayar',
    noSubscription: 'Tanpa langganan. Tanpa biaya berulang.', purchase: 'Buka Premium Seumur Hidup', restore: 'Pulihkan Pembelian', close: 'Tutup',
    included: 'Premium aktif', legacy: 'Akses Premium pendukung awal Anda sudah termasuk.', purchased: 'Premium berhasil dibuka. Terima kasih telah mendukung SafarMate.',
    restored: 'Pembelian Premium Anda telah dipulihkan.', pending: 'Pembelian Anda sedang menunggu persetujuan.', cancelled: 'Pembelian dibatalkan.',
    unavailable: 'Pembelian sementara tidak tersedia. Coba lagi nanti.', error: 'Permintaan tidak dapat diselesaikan.',
    features: ['Rencana perjalanan harian pribadi lengkap', 'Semua hasil masjid, makanan halal, landmark, dan atraksi', 'Peta, arah, filter, dan panduan transportasi', 'Alat salat dan Kiblat dalam penerbangan lengkap', 'Detail offline, penyimpanan, dan ekspor perjalanan', 'Semua fitur Premium Seumur Hidup mendatang'],
    lockedFeature: 'Buka rencana lengkap dan semua tempat ramah Muslim untuk tujuan ini.',
    planPreviewTitle: 'Perjalanan ramah Muslim lengkap Anda sudah siap',
    planPreviewBody: 'Anda melihat {visible} dari {stops} pemberhentian. Buka seluruh {days} hari, rute yang mempertimbangkan salat, peta, dan alat perjalanan.',
    placesPreviewTitle: 'Lebih banyak {kind} sudah siap',
    placesPreviewBody: '{visible} dari {total} ditampilkan. Buka semua hasil, filter, peta, dan arah.',
    unlockPlan: 'Buka perjalanan lengkap', unlockPlaces: 'Buka semua hasil',
    placeKinds: { mosques: 'masjid dan ruang salat', halal: 'tempat halal', landmarks: 'landmark dan atraksi' },
  },
  ms: {
    premium: 'Premium', lifetime: 'Seumur Hidup', eyebrow: 'SafarMate Premium', title: 'Buka perjalanan mesra Muslim anda sepenuhnya',
    subtitle: 'Dapatkan jadual harian lengkap, semua masjid, tempat halal, mercu tanda dan tarikan, serta peta, arah dan alat perjalanan yang mengambil kira waktu solat.', once: 'bayaran sekali',
    noSubscription: 'Tiada langganan. Tiada caj berulang.', purchase: 'Buka Premium Seumur Hidup', restore: 'Pulihkan Pembelian', close: 'Tutup',
    included: 'Premium aktif', legacy: 'Akses Premium penyokong awal anda telah disertakan.', purchased: 'Premium telah dibuka. Terima kasih menyokong SafarMate.',
    restored: 'Pembelian Premium anda telah dipulihkan.', pending: 'Pembelian anda sedang menunggu kelulusan.', cancelled: 'Pembelian dibatalkan.',
    unavailable: 'Pembelian tidak tersedia buat sementara. Cuba lagi kemudian.', error: 'Permintaan tidak dapat diselesaikan.',
    features: ['Jadual perjalanan harian peribadi lengkap', 'Semua hasil masjid, makanan halal, mercu tanda dan tarikan', 'Peta, arah, penapis dan panduan pengangkutan', 'Alat solat dan kiblat dalam penerbangan lengkap', 'Butiran luar talian, simpanan dan eksport perjalanan', 'Semua ciri Premium Seumur Hidup akan datang'],
    lockedFeature: 'Buka pelan lengkap dan semua tempat mesra Muslim untuk destinasi ini.',
    planPreviewTitle: 'Perjalanan mesra Muslim lengkap anda sudah tersedia',
    planPreviewBody: 'Anda melihat {visible} daripada {stops} persinggahan. Buka kesemua {days} hari, laluan mesra solat, peta dan alat perjalanan.',
    placesPreviewTitle: 'Lebih banyak {kind} sudah tersedia',
    placesPreviewBody: '{visible} daripada {total} dipaparkan. Buka semua hasil, penapis, peta dan arah.',
    unlockPlan: 'Buka perjalanan lengkap', unlockPlaces: 'Buka semua hasil',
    placeKinds: { mosques: 'masjid dan ruang solat', halal: 'tempat halal', landmarks: 'mercu tanda dan tarikan' },
  },
  tr: {
    premium: 'Premium', lifetime: 'Ömür Boyu', eyebrow: 'SafarMate Premium', title: 'Eksiksiz Müslüman dostu seyahatinizin kilidini açın',
    subtitle: 'Tam günlük planı, tüm camileri, helal mekânları, simge yapıları ve gezilecek yerleri; ayrıca haritaları, yol tariflerini ve namaz odaklı seyahat araçlarını edinin.', once: 'tek seferlik ödeme',
    noSubscription: 'Abonelik yok. Tekrarlayan ücret yok.', purchase: 'Ömür Boyu Premium’u Aç', restore: 'Satın Alımları Geri Yükle', close: 'Kapat',
    included: 'Premium etkin', legacy: 'Erken destekçi Premium erişiminiz dahildir.', purchased: 'Premium açıldı. SafarMate’i desteklediğiniz için teşekkürler.',
    restored: 'Premium satın alımınız geri yüklendi.', pending: 'Satın alımınız onay bekliyor.', cancelled: 'Satın alma iptal edildi.',
    unavailable: 'Satın alımlar geçici olarak kullanılamıyor. Daha sonra tekrar deneyin.', error: 'İstek tamamlanamadı.',
    features: ['Eksiksiz kişisel günlük seyahat planı', 'Tüm cami, helal yemek, simge yapı ve gezi sonuçları', 'Haritalar, yol tarifleri, filtreler ve ulaşım rehberi', 'Tam uçuş içi namaz ve kıble araçları', 'Çevrimdışı ayrıntılar, kaydetme ve dışa aktarma', 'Gelecekteki tüm Ömür Boyu Premium özellikleri'],
    lockedFeature: 'Bu destinasyon için tam planı ve tüm Müslüman dostu yerleri açın.',
    planPreviewTitle: 'Eksiksiz Müslüman dostu seyahatiniz hazır',
    planPreviewBody: '{stops} planlı durağın {visible} tanesini görüyorsunuz. {days} günün tamamını, namaz odaklı rotaları, haritaları ve seyahat araçlarını açın.',
    placesPreviewTitle: 'Daha fazla {kind} hazır',
    placesPreviewBody: '{total} sonuçtan {visible} tanesi gösteriliyor. Tüm sonuçları, filtreleri, haritaları ve yol tariflerini açın.',
    unlockPlan: 'Tam seyahati aç', unlockPlaces: 'Tüm sonuçları aç',
    placeKinds: { mosques: 'cami ve namaz alanı', halal: 'helal mekân', landmarks: 'simge yapı ve gezi noktası' },
  },
  fr: {
    premium: 'Premium', lifetime: 'À vie', eyebrow: 'SafarMate Premium', title: 'Débloquez votre voyage complet adapté aux musulmans',
    subtitle: 'Obtenez le programme jour par jour, toutes les mosquées, adresses halal, monuments et attractions, ainsi que les cartes, itinéraires et outils tenant compte des prières.', once: 'achat unique',
    noSubscription: 'Aucun abonnement. Aucun paiement récurrent.', purchase: 'Débloquer Premium à vie', restore: 'Restaurer les achats', close: 'Fermer',
    included: 'Premium est actif', legacy: 'Votre accès Premium de soutien initial est inclus.', purchased: 'Premium est débloqué. Merci de soutenir SafarMate.',
    restored: 'Votre achat Premium a été restauré.', pending: 'Votre achat est en attente d’approbation.', cancelled: 'L’achat a été annulé.',
    unavailable: 'Les achats sont temporairement indisponibles. Réessayez plus tard.', error: 'Impossible de terminer cette demande.',
    features: ['Programme personnalisé complet jour par jour', 'Tous les résultats de mosquées, adresses halal, monuments et attractions', 'Cartes, itinéraires, filtres et conseils de transport', 'Outils complets de prière et de Qibla en vol', 'Détails hors ligne, sauvegarde et export du voyage', 'Toutes les futures fonctions Premium à vie'],
    lockedFeature: 'Débloquez le programme complet et tous les lieux adaptés aux musulmans pour cette destination.',
    planPreviewTitle: 'Votre voyage complet adapté aux musulmans est prêt',
    planPreviewBody: 'Vous voyez {visible} étapes sur {stops}. Débloquez les {days} jours, les parcours tenant compte des prières, les cartes et les outils de voyage.',
    placesPreviewTitle: 'Davantage de {kind} sont disponibles',
    placesPreviewBody: '{visible} résultats sur {total} sont affichés. Débloquez tous les résultats, filtres, cartes et itinéraires.',
    unlockPlan: 'Débloquer le voyage complet', unlockPlaces: 'Débloquer tous les résultats',
    placeKinds: { mosques: 'mosquées et espaces de prière', halal: 'adresses halal', landmarks: 'monuments et attractions' },
  },
  ur: {
    premium: 'پریمیم', lifetime: 'تاحیات', eyebrow: 'سفرمیٹ پریمیم', title: 'اپنا مکمل مسلم دوست سفر کھولیں',
    subtitle: 'مکمل روزانہ منصوبہ، تمام مساجد، حلال مقامات، اہم جگہیں اور سیاحتی مقامات، نیز نقشے، راستے اور نماز کو مدنظر رکھنے والے سفری اوزار حاصل کریں۔', once: 'ایک بار ادائیگی',
    noSubscription: 'کوئی سبسکرپشن یا بار بار چارج نہیں۔', purchase: 'تاحیات پریمیم کھولیں', restore: 'خریداری بحال کریں', close: 'بند کریں',
    included: 'پریمیم فعال ہے', legacy: 'ابتدائی صارف کے طور پر آپ کی پریمیم رسائی شامل ہے۔', purchased: 'پریمیم کھل گیا۔ سفرمیٹ کی حمایت کا شکریہ۔',
    restored: 'آپ کی پریمیم خریداری بحال ہوگئی۔', pending: 'آپ کی خریداری منظوری کی منتظر ہے۔', cancelled: 'خریداری منسوخ ہوگئی۔',
    unavailable: 'خریداری عارضی طور پر دستیاب نہیں۔ بعد میں کوشش کریں۔', error: 'درخواست مکمل نہیں ہو سکی۔',
    features: ['مکمل ذاتی روزانہ سفری منصوبہ', 'تمام مسجد، حلال کھانے، اہم مقامات اور سیاحتی نتائج', 'نقشے، راستے، فلٹر اور ٹرانسپورٹ رہنمائی', 'پرواز کے دوران مکمل نماز اور قبلہ اوزار', 'آف لائن تفصیلات، محفوظ کرنا اور ایکسپورٹ', 'تمام مستقبل کی تاحیات پریمیم خصوصیات'],
    lockedFeature: 'اس منزل کے لیے مکمل منصوبہ اور تمام مسلم دوست مقامات کھولیں۔',
    planPreviewTitle: 'آپ کا مکمل مسلم دوست سفر تیار ہے',
    planPreviewBody: 'آپ {stops} منصوبہ بند مقامات میں سے {visible} دیکھ رہے ہیں۔ تمام {days} دن، نماز کے مطابق راستے، نقشے اور سفری اوزار کھولیں۔',
    placesPreviewTitle: 'مزید {kind} تیار ہیں',
    placesPreviewBody: '{total} میں سے {visible} دکھائے گئے ہیں۔ تمام نتائج، فلٹر، نقشے اور راستے کھولیں۔',
    unlockPlan: 'مکمل سفر کھولیں', unlockPlaces: 'تمام نتائج کھولیں',
    placeKinds: { mosques: 'مساجد اور نماز کی جگہیں', halal: 'حلال مقامات', landmarks: 'اہم مقامات اور سیاحتی جگہیں' },
  },
};
