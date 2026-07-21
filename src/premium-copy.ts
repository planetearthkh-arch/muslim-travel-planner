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
  comparisonTitle: string;
  freeLabel: string;
  premiumLabel: string;
  freeFeatures: string[];
  premiumFeatures: string[];
  lockedFeature: string;
  planPaywallTitle: string;
  planPaywallSubtitle: string;
  placesPaywallTitle: string;
  placesPaywallSubtitle: string;
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
    premium: 'Premium', lifetime: 'Lifetime', eyebrow: 'SafarMate Premium', title: 'Unlock your full Muslim-friendly trip',
    subtitle: 'Get the complete day-by-day itinerary, every mosque, halal place, landmark and attraction, plus maps, directions, prayer-aware routes and offline trip access.', once: 'one-time purchase',
    noSubscription: 'Pay once. No subscription. Keep Premium forever on your Apple Account.', purchase: 'Unlock Full Trip', restore: 'Restore Purchases', close: 'Close',
    included: 'Premium is active', legacy: 'Your early-supporter Lifetime Premium access is included.', purchased: 'Lifetime Premium is unlocked. Thank you for supporting SafarMate.',
    restored: 'Your Lifetime Premium purchase has been restored.', pending: 'Your purchase is pending approval.', cancelled: 'The purchase was cancelled.',
    unavailable: 'Purchases are temporarily unavailable. Please try again later.', error: 'We could not complete that request.',
    comparisonTitle: 'Free preview or the complete trip', freeLabel: 'Free Preview', premiumLabel: 'Lifetime Premium',
    freeFeatures: ['Prayer times, Qibla and weather', '2 preview results in each place category', 'First 2 stops from Day 1'],
    premiumFeatures: ['Complete personalized day-by-day itinerary', 'Every mosque, halal place, landmark and attraction', 'Full maps, directions, prayer-aware routes and transport guidance', 'In-flight tools, offline access, saving, sharing and export'],
    lockedFeature: 'Your preview is ready. Unlock the complete trip with Lifetime Premium.',
    planPaywallTitle: 'Your {days}-day Muslim-friendly trip is ready',
    planPaywallSubtitle: 'You are viewing {visible} of {stops} planned stops. Unlock the complete itinerary, prayer-aware routes, maps and travel tools.',
    placesPaywallTitle: 'Unlock all {total} {kind}',
    placesPaywallSubtitle: 'You are viewing {visible} preview results. Get every result, full maps, filters and directions with Lifetime Premium.',
    planPreviewTitle: 'Your complete Muslim-friendly trip is ready',
    planPreviewBody: 'You are seeing {visible} of {stops} planned stops. Unlock all {days} days, prayer-aware routes, maps and travel tools.',
    placesPreviewTitle: 'More {kind} are ready',
    placesPreviewBody: '{visible} of {total} shown. Unlock every result, filters, maps and directions.',
    unlockPlan: 'Unlock the complete trip', unlockPlaces: 'Unlock all results',
    placeKinds: { mosques: 'mosques and prayer spaces', halal: 'halal places', landmarks: 'landmarks and attractions' },
  },
  ar: {
    premium: 'بريميوم', lifetime: 'مدى الحياة', eyebrow: 'سفر ميت بريميوم', title: 'افتح رحلتك الكاملة المناسبة للمسلمين',
    subtitle: 'احصل على برنامج يومي كامل، وجميع المساجد والأماكن الحلال والمعالم والوجهات، مع الخرائط والاتجاهات والمسارات المراعية للصلاة والوصول دون إنترنت.', once: 'دفعة واحدة',
    noSubscription: 'ادفع مرة واحدة. دون اشتراك. احتفظ ببريميوم مدى الحياة على حساب Apple.', purchase: 'فتح الرحلة الكاملة', restore: 'استعادة المشتريات', close: 'إغلاق',
    included: 'بريميوم مفعّل', legacy: 'تم تضمين وصول بريميوم مدى الحياة لك بصفتك من المستخدمين الأوائل.', purchased: 'تم فتح بريميوم مدى الحياة. شكرًا لدعم سفر ميت.',
    restored: 'تمت استعادة شراء بريميوم مدى الحياة.', pending: 'عملية الشراء بانتظار الموافقة.', cancelled: 'تم إلغاء الشراء.',
    unavailable: 'المشتريات غير متاحة مؤقتًا. حاول لاحقًا.', error: 'تعذر إكمال الطلب.',
    comparisonTitle: 'معاينة مجانية أم الرحلة الكاملة', freeLabel: 'معاينة مجانية', premiumLabel: 'بريميوم مدى الحياة',
    freeFeatures: ['أوقات الصلاة والقبلة والطقس', 'نتيجتان للمعاينة في كل فئة', 'أول محطتين من اليوم الأول'],
    premiumFeatures: ['برنامج يومي شخصي كامل', 'جميع المساجد والأماكن الحلال والمعالم والوجهات', 'خرائط واتجاهات ومسارات مراعية للصلاة وإرشادات نقل كاملة', 'أدوات الصلاة أثناء الطيران والوصول دون إنترنت والحفظ والمشاركة والتصدير'],
    lockedFeature: 'المعاينة جاهزة. افتح الرحلة الكاملة مع بريميوم مدى الحياة.',
    planPaywallTitle: 'رحلتك المناسبة للمسلمين لمدة {days} أيام جاهزة',
    planPaywallSubtitle: 'تشاهد {visible} من أصل {stops} محطات مخططة. افتح البرنامج الكامل والمسارات المراعية للصلاة والخرائط وأدوات السفر.',
    placesPaywallTitle: 'افتح جميع {kind} وعددها {total}',
    placesPaywallSubtitle: 'تشاهد {visible} نتائج للمعاينة. احصل على جميع النتائج والخرائط والفلاتر والاتجاهات مع بريميوم مدى الحياة.',
    planPreviewTitle: 'رحلتك الكاملة المناسبة للمسلمين جاهزة',
    planPreviewBody: 'تشاهد {visible} من أصل {stops} محطة مخططة. افتح جميع أيام الرحلة وعددها {days} مع المسارات المراعية للصلاة والخرائط وأدوات السفر.',
    placesPreviewTitle: 'المزيد من {kind} جاهز',
    placesPreviewBody: 'يظهر {visible} من أصل {total}. افتح جميع النتائج والفلاتر والخرائط والاتجاهات.',
    unlockPlan: 'فتح الرحلة الكاملة', unlockPlaces: 'فتح جميع النتائج',
    placeKinds: { mosques: 'المساجد وأماكن الصلاة', halal: 'الأماكن الحلال', landmarks: 'المعالم والوجهات' },
  },
  id: {
    premium: 'Premium', lifetime: 'Seumur Hidup', eyebrow: 'SafarMate Premium', title: 'Buka perjalanan ramah Muslim Anda sepenuhnya',
    subtitle: 'Dapatkan rencana harian lengkap, setiap masjid, tempat halal, landmark dan atraksi, plus peta, arah, rute yang mempertimbangkan salat, dan akses offline.', once: 'sekali bayar',
    noSubscription: 'Bayar sekali. Tanpa langganan. Simpan Premium selamanya di Akun Apple Anda.', purchase: 'Buka Perjalanan Lengkap', restore: 'Pulihkan Pembelian', close: 'Tutup',
    included: 'Premium aktif', legacy: 'Akses Premium Seumur Hidup Anda sebagai pendukung awal sudah termasuk.', purchased: 'Premium Seumur Hidup berhasil dibuka. Terima kasih telah mendukung SafarMate.',
    restored: 'Pembelian Premium Seumur Hidup Anda telah dipulihkan.', pending: 'Pembelian Anda sedang menunggu persetujuan.', cancelled: 'Pembelian dibatalkan.',
    unavailable: 'Pembelian sementara tidak tersedia. Coba lagi nanti.', error: 'Permintaan tidak dapat diselesaikan.',
    comparisonTitle: 'Pratinjau gratis atau perjalanan lengkap', freeLabel: 'Pratinjau Gratis', premiumLabel: 'Premium Seumur Hidup',
    freeFeatures: ['Waktu salat, Kiblat, dan cuaca', '2 hasil pratinjau di setiap kategori tempat', '2 pemberhentian pertama dari Hari 1'],
    premiumFeatures: ['Rencana perjalanan harian pribadi lengkap', 'Setiap masjid, tempat halal, landmark, dan atraksi', 'Peta, arah, rute ramah salat, dan panduan transportasi lengkap', 'Alat dalam penerbangan, akses offline, simpan, bagikan, dan ekspor'],
    lockedFeature: 'Pratinjau Anda sudah siap. Buka perjalanan lengkap dengan Premium Seumur Hidup.',
    planPaywallTitle: 'Perjalanan ramah Muslim {days} hari Anda sudah siap',
    planPaywallSubtitle: 'Anda melihat {visible} dari {stops} pemberhentian. Buka rencana lengkap, rute ramah salat, peta, dan alat perjalanan.',
    placesPaywallTitle: 'Buka semua {total} {kind}',
    placesPaywallSubtitle: 'Anda melihat {visible} hasil pratinjau. Dapatkan semua hasil, peta, filter, dan arah dengan Premium Seumur Hidup.',
    planPreviewTitle: 'Perjalanan ramah Muslim lengkap Anda sudah siap',
    planPreviewBody: 'Anda melihat {visible} dari {stops} pemberhentian. Buka seluruh {days} hari, rute yang mempertimbangkan salat, peta, dan alat perjalanan.',
    placesPreviewTitle: 'Lebih banyak {kind} sudah siap',
    placesPreviewBody: '{visible} dari {total} ditampilkan. Buka semua hasil, filter, peta, dan arah.',
    unlockPlan: 'Buka perjalanan lengkap', unlockPlaces: 'Buka semua hasil',
    placeKinds: { mosques: 'masjid dan ruang salat', halal: 'tempat halal', landmarks: 'landmark dan atraksi' },
  },
  ms: {
    premium: 'Premium', lifetime: 'Seumur Hidup', eyebrow: 'SafarMate Premium', title: 'Buka perjalanan mesra Muslim anda sepenuhnya',
    subtitle: 'Dapatkan jadual harian lengkap, setiap masjid, tempat halal, mercu tanda dan tarikan, serta peta, arah, laluan mesra solat dan akses luar talian.', once: 'bayaran sekali',
    noSubscription: 'Bayar sekali. Tiada langganan. Kekalkan Premium selamanya pada Akaun Apple anda.', purchase: 'Buka Perjalanan Lengkap', restore: 'Pulihkan Pembelian', close: 'Tutup',
    included: 'Premium aktif', legacy: 'Akses Premium Seumur Hidup anda sebagai penyokong awal telah disertakan.', purchased: 'Premium Seumur Hidup telah dibuka. Terima kasih menyokong SafarMate.',
    restored: 'Pembelian Premium Seumur Hidup anda telah dipulihkan.', pending: 'Pembelian anda sedang menunggu kelulusan.', cancelled: 'Pembelian dibatalkan.',
    unavailable: 'Pembelian tidak tersedia buat sementara. Cuba lagi kemudian.', error: 'Permintaan tidak dapat diselesaikan.',
    comparisonTitle: 'Pratonton percuma atau perjalanan lengkap', freeLabel: 'Pratonton Percuma', premiumLabel: 'Premium Seumur Hidup',
    freeFeatures: ['Waktu solat, kiblat dan cuaca', '2 hasil pratonton dalam setiap kategori tempat', '2 persinggahan pertama daripada Hari 1'],
    premiumFeatures: ['Jadual perjalanan harian peribadi lengkap', 'Setiap masjid, tempat halal, mercu tanda dan tarikan', 'Peta, arah, laluan mesra solat dan panduan pengangkutan lengkap', 'Alat dalam penerbangan, akses luar talian, simpan, kongsi dan eksport'],
    lockedFeature: 'Pratonton anda sudah tersedia. Buka perjalanan lengkap dengan Premium Seumur Hidup.',
    planPaywallTitle: 'Perjalanan mesra Muslim {days} hari anda sudah tersedia',
    planPaywallSubtitle: 'Anda melihat {visible} daripada {stops} persinggahan. Buka jadual lengkap, laluan mesra solat, peta dan alat perjalanan.',
    placesPaywallTitle: 'Buka kesemua {total} {kind}',
    placesPaywallSubtitle: 'Anda melihat {visible} hasil pratonton. Dapatkan semua hasil, peta, penapis dan arah dengan Premium Seumur Hidup.',
    planPreviewTitle: 'Perjalanan mesra Muslim lengkap anda sudah tersedia',
    planPreviewBody: 'Anda melihat {visible} daripada {stops} persinggahan. Buka kesemua {days} hari, laluan mesra solat, peta dan alat perjalanan.',
    placesPreviewTitle: 'Lebih banyak {kind} sudah tersedia',
    placesPreviewBody: '{visible} daripada {total} dipaparkan. Buka semua hasil, penapis, peta dan arah.',
    unlockPlan: 'Buka perjalanan lengkap', unlockPlaces: 'Buka semua hasil',
    placeKinds: { mosques: 'masjid dan ruang solat', halal: 'tempat halal', landmarks: 'mercu tanda dan tarikan' },
  },
  tr: {
    premium: 'Premium', lifetime: 'Ömür Boyu', eyebrow: 'SafarMate Premium', title: 'Eksiksiz Müslüman dostu seyahatinizin kilidini açın',
    subtitle: 'Tam günlük planı, her camiyi, helal mekânı, simge yapıyı ve gezi noktasını; ayrıca haritaları, yol tariflerini, namaz odaklı rotaları ve çevrimdışı erişimi edinin.', once: 'tek seferlik ödeme',
    noSubscription: 'Bir kez ödeyin. Abonelik yok. Premium Apple Hesabınızda sonsuza kadar kalsın.', purchase: 'Tam Seyahati Aç', restore: 'Satın Alımları Geri Yükle', close: 'Kapat',
    included: 'Premium etkin', legacy: 'Erken destekçi Ömür Boyu Premium erişiminiz dahildir.', purchased: 'Ömür Boyu Premium açıldı. SafarMate’i desteklediğiniz için teşekkürler.',
    restored: 'Ömür Boyu Premium satın alımınız geri yüklendi.', pending: 'Satın alımınız onay bekliyor.', cancelled: 'Satın alma iptal edildi.',
    unavailable: 'Satın alımlar geçici olarak kullanılamıyor. Daha sonra tekrar deneyin.', error: 'İstek tamamlanamadı.',
    comparisonTitle: 'Ücretsiz önizleme veya eksiksiz seyahat', freeLabel: 'Ücretsiz Önizleme', premiumLabel: 'Ömür Boyu Premium',
    freeFeatures: ['Namaz vakitleri, kıble ve hava durumu', 'Her yer kategorisinde 2 önizleme sonucu', '1. Günün ilk 2 durağı'],
    premiumFeatures: ['Eksiksiz kişisel günlük seyahat planı', 'Her cami, helal mekân, simge yapı ve gezi noktası', 'Tam haritalar, yol tarifleri, namaz odaklı rotalar ve ulaşım rehberi', 'Uçuş içi araçlar, çevrimdışı erişim, kaydetme, paylaşma ve dışa aktarma'],
    lockedFeature: 'Önizlemeniz hazır. Eksiksiz seyahati Ömür Boyu Premium ile açın.',
    planPaywallTitle: '{days} günlük Müslüman dostu seyahatiniz hazır',
    planPaywallSubtitle: '{stops} planlı durağın {visible} tanesini görüyorsunuz. Tam planı, namaz odaklı rotaları, haritaları ve seyahat araçlarını açın.',
    placesPaywallTitle: 'Tüm {total} {kind} sonucunu açın',
    placesPaywallSubtitle: '{visible} önizleme sonucu görüyorsunuz. Ömür Boyu Premium ile tüm sonuçları, haritaları, filtreleri ve yol tariflerini edinin.',
    planPreviewTitle: 'Eksiksiz Müslüman dostu seyahatiniz hazır',
    planPreviewBody: '{stops} planlı durağın {visible} tanesini görüyorsunuz. {days} günün tamamını, namaz odaklı rotaları, haritaları ve seyahat araçlarını açın.',
    placesPreviewTitle: 'Daha fazla {kind} hazır',
    placesPreviewBody: '{total} sonuçtan {visible} tanesi gösteriliyor. Tüm sonuçları, filtreleri, haritaları ve yol tariflerini açın.',
    unlockPlan: 'Tam seyahati aç', unlockPlaces: 'Tüm sonuçları aç',
    placeKinds: { mosques: 'cami ve namaz alanı', halal: 'helal mekân', landmarks: 'simge yapı ve gezi noktası' },
  },
  fr: {
    premium: 'Premium', lifetime: 'À vie', eyebrow: 'SafarMate Premium', title: 'Débloquez tout votre voyage adapté aux musulmans',
    subtitle: 'Obtenez le programme complet jour par jour, chaque mosquée, adresse halal, monument et attraction, ainsi que les cartes, itinéraires, parcours tenant compte des prières et l’accès hors ligne.', once: 'achat unique',
    noSubscription: 'Payez une fois. Aucun abonnement. Gardez Premium à vie sur votre compte Apple.', purchase: 'Débloquer le Voyage Complet', restore: 'Restaurer les achats', close: 'Fermer',
    included: 'Premium est actif', legacy: 'Votre accès Premium à vie de soutien initial est inclus.', purchased: 'Premium à vie est débloqué. Merci de soutenir SafarMate.',
    restored: 'Votre achat Premium à vie a été restauré.', pending: 'Votre achat est en attente d’approbation.', cancelled: 'L’achat a été annulé.',
    unavailable: 'Les achats sont temporairement indisponibles. Réessayez plus tard.', error: 'Impossible de terminer cette demande.',
    comparisonTitle: 'Aperçu gratuit ou voyage complet', freeLabel: 'Aperçu Gratuit', premiumLabel: 'Premium à Vie',
    freeFeatures: ['Horaires de prière, Qibla et météo', '2 résultats d’aperçu dans chaque catégorie', 'Les 2 premières étapes du Jour 1'],
    premiumFeatures: ['Programme personnalisé complet jour par jour', 'Chaque mosquée, adresse halal, monument et attraction', 'Cartes, itinéraires, parcours de prière et conseils de transport complets', 'Outils en vol, accès hors ligne, sauvegarde, partage et export'],
    lockedFeature: 'Votre aperçu est prêt. Débloquez le voyage complet avec Premium à vie.',
    planPaywallTitle: 'Votre voyage de {days} jours adapté aux musulmans est prêt',
    planPaywallSubtitle: 'Vous voyez {visible} étapes sur {stops}. Débloquez le programme complet, les parcours tenant compte des prières, les cartes et les outils de voyage.',
    placesPaywallTitle: 'Débloquez les {total} {kind}',
    placesPaywallSubtitle: 'Vous voyez {visible} résultats d’aperçu. Obtenez tous les résultats, cartes, filtres et itinéraires avec Premium à vie.',
    planPreviewTitle: 'Votre voyage complet adapté aux musulmans est prêt',
    planPreviewBody: 'Vous voyez {visible} étapes sur {stops}. Débloquez les {days} jours, les parcours tenant compte des prières, les cartes et les outils de voyage.',
    placesPreviewTitle: 'Davantage de {kind} sont disponibles',
    placesPreviewBody: '{visible} résultats sur {total} sont affichés. Débloquez tous les résultats, filtres, cartes et itinéraires.',
    unlockPlan: 'Débloquer le voyage complet', unlockPlaces: 'Débloquer tous les résultats',
    placeKinds: { mosques: 'mosquées et espaces de prière', halal: 'adresses halal', landmarks: 'monuments et attractions' },
  },
  ur: {
    premium: 'پریمیم', lifetime: 'تاحیات', eyebrow: 'سفرمیٹ پریمیم', title: 'اپنا مکمل مسلم دوست سفر کھولیں',
    subtitle: 'مکمل روزانہ منصوبہ، ہر مسجد، حلال مقام، اہم جگہ اور سیاحتی مقام، نیز نقشے، راستے، نماز کے مطابق روٹس اور آف لائن رسائی حاصل کریں۔', once: 'ایک بار ادائیگی',
    noSubscription: 'ایک بار ادائیگی کریں۔ کوئی سبسکرپشن نہیں۔ اپنے Apple اکاؤنٹ پر پریمیم ہمیشہ رکھیں۔', purchase: 'مکمل سفر کھولیں', restore: 'خریداری بحال کریں', close: 'بند کریں',
    included: 'پریمیم فعال ہے', legacy: 'ابتدائی صارف کے طور پر آپ کی تاحیات پریمیم رسائی شامل ہے۔', purchased: 'تاحیات پریمیم کھل گیا۔ سفرمیٹ کی حمایت کا شکریہ۔',
    restored: 'آپ کی تاحیات پریمیم خریداری بحال ہوگئی۔', pending: 'آپ کی خریداری منظوری کی منتظر ہے۔', cancelled: 'خریداری منسوخ ہوگئی۔',
    unavailable: 'خریداری عارضی طور پر دستیاب نہیں۔ بعد میں کوشش کریں۔', error: 'درخواست مکمل نہیں ہو سکی۔',
    comparisonTitle: 'مفت پیش منظر یا مکمل سفر', freeLabel: 'مفت پیش منظر', premiumLabel: 'تاحیات پریمیم',
    freeFeatures: ['نماز کے اوقات، قبلہ اور موسم', 'ہر مقام کی قسم میں 2 پیش منظر نتائج', 'پہلے دن کے پہلے 2 مقامات'],
    premiumFeatures: ['مکمل ذاتی روزانہ سفری منصوبہ', 'ہر مسجد، حلال مقام، اہم جگہ اور سیاحتی مقام', 'مکمل نقشے، راستے، نماز کے مطابق روٹس اور ٹرانسپورٹ رہنمائی', 'پرواز کے اوزار، آف لائن رسائی، محفوظ کرنا، شیئر کرنا اور ایکسپورٹ'],
    lockedFeature: 'آپ کا پیش منظر تیار ہے۔ تاحیات پریمیم کے ساتھ مکمل سفر کھولیں۔',
    planPaywallTitle: 'آپ کا {days} دن کا مسلم دوست سفر تیار ہے',
    planPaywallSubtitle: 'آپ {stops} منصوبہ بند مقامات میں سے {visible} دیکھ رہے ہیں۔ مکمل منصوبہ، نماز کے مطابق روٹس، نقشے اور سفری اوزار کھولیں۔',
    placesPaywallTitle: 'تمام {total} {kind} کھولیں',
    placesPaywallSubtitle: 'آپ {visible} پیش منظر نتائج دیکھ رہے ہیں۔ تاحیات پریمیم کے ساتھ تمام نتائج، نقشے، فلٹر اور راستے حاصل کریں۔',
    planPreviewTitle: 'آپ کا مکمل مسلم دوست سفر تیار ہے',
    planPreviewBody: 'آپ {stops} منصوبہ بند مقامات میں سے {visible} دیکھ رہے ہیں۔ تمام {days} دن، نماز کے مطابق راستے، نقشے اور سفری اوزار کھولیں۔',
    placesPreviewTitle: 'مزید {kind} تیار ہیں',
    placesPreviewBody: '{total} میں سے {visible} دکھائے گئے ہیں۔ تمام نتائج، فلٹر، نقشے اور راستے کھولیں۔',
    unlockPlan: 'مکمل سفر کھولیں', unlockPlaces: 'تمام نتائج کھولیں',
    placeKinds: { mosques: 'مساجد اور نماز کی جگہیں', halal: 'حلال مقامات', landmarks: 'اہم مقامات اور سیاحتی جگہیں' },
  },
};
