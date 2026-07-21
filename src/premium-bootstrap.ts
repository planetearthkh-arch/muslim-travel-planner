import { languageDirection, parseLanguage, type Language } from './app-language.js';
import { premiumService, type PremiumState, type PurchaseOutcome } from './premium.js';

interface PremiumCopy {
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
}

const copyByLanguage: Record<Language, PremiumCopy> = {
  en: {
    premium: 'Premium', lifetime: 'Lifetime', eyebrow: 'SafarMate Premium', title: 'Travel with every tool unlocked',
    subtitle: 'One secure App Store purchase. Keep Premium forever on your Apple Account.', once: 'one-time purchase',
    noSubscription: 'No subscription. No recurring charge.', purchase: 'Unlock Lifetime Premium', restore: 'Restore Purchases', close: 'Close',
    included: 'Premium is active', legacy: 'Your early-supporter Premium access is included.', purchased: 'Premium unlocked. Thank you for supporting SafarMate.',
    restored: 'Your Premium purchase has been restored.', pending: 'Your purchase is pending approval.', cancelled: 'The purchase was cancelled.',
    unavailable: 'Purchases are temporarily unavailable. Please try again later.', error: 'We could not complete that request.',
    features: ['Advanced saved-trip management', 'Share and export trip plans', 'Advanced in-flight prayer tools', 'Currency and advanced transport tools', 'Offline access to saved travel details', 'Future Lifetime Premium features'],
    lockedFeature: 'This advanced travel tool is included with Lifetime Premium.',
  },
  ar: {
    premium: 'بريميوم', lifetime: 'مدى الحياة', eyebrow: 'سفر ميت بريميوم', title: 'افتح جميع أدوات السفر',
    subtitle: 'دفعة آمنة واحدة عبر App Store، واحتفظ ببريميوم مدى الحياة على حساب Apple.', once: 'دفعة واحدة',
    noSubscription: 'دون اشتراك أو رسوم متكررة.', purchase: 'فتح بريميوم مدى الحياة', restore: 'استعادة المشتريات', close: 'إغلاق',
    included: 'بريميوم مفعّل', legacy: 'تم تضمين وصول بريميوم لك بصفتك من المستخدمين الأوائل.', purchased: 'تم فتح بريميوم. شكرًا لدعم سفر ميت.',
    restored: 'تمت استعادة شراء بريميوم.', pending: 'عملية الشراء بانتظار الموافقة.', cancelled: 'تم إلغاء الشراء.',
    unavailable: 'المشتريات غير متاحة مؤقتًا. حاول لاحقًا.', error: 'تعذر إكمال الطلب.',
    features: ['إدارة متقدمة للرحلات المحفوظة', 'مشاركة خطط الرحلات وتصديرها', 'أدوات متقدمة للصلاة أثناء الطيران', 'العملات وأدوات النقل المتقدمة', 'وصول دون إنترنت لتفاصيل الرحلات المحفوظة', 'ميزات بريميوم المستقبلية مدى الحياة'],
    lockedFeature: 'هذه الأداة المتقدمة متاحة ضمن بريميوم مدى الحياة.',
  },
  id: {
    premium: 'Premium', lifetime: 'Seumur Hidup', eyebrow: 'SafarMate Premium', title: 'Buka semua alat perjalanan',
    subtitle: 'Satu pembelian aman melalui App Store. Nikmati Premium selamanya di Akun Apple Anda.', once: 'sekali bayar',
    noSubscription: 'Tanpa langganan. Tanpa biaya berulang.', purchase: 'Buka Premium Seumur Hidup', restore: 'Pulihkan Pembelian', close: 'Tutup',
    included: 'Premium aktif', legacy: 'Akses Premium pendukung awal Anda sudah termasuk.', purchased: 'Premium berhasil dibuka. Terima kasih telah mendukung SafarMate.',
    restored: 'Pembelian Premium Anda telah dipulihkan.', pending: 'Pembelian Anda sedang menunggu persetujuan.', cancelled: 'Pembelian dibatalkan.',
    unavailable: 'Pembelian sementara tidak tersedia. Coba lagi nanti.', error: 'Permintaan tidak dapat diselesaikan.',
    features: ['Pengelolaan perjalanan tersimpan tingkat lanjut', 'Bagikan dan ekspor rencana perjalanan', 'Alat salat dalam penerbangan tingkat lanjut', 'Mata uang dan alat transportasi tingkat lanjut', 'Akses offline ke detail perjalanan tersimpan', 'Fitur Premium Seumur Hidup mendatang'],
    lockedFeature: 'Alat perjalanan tingkat lanjut ini termasuk dalam Premium Seumur Hidup.',
  },
  ms: {
    premium: 'Premium', lifetime: 'Seumur Hidup', eyebrow: 'SafarMate Premium', title: 'Buka semua alat perjalanan',
    subtitle: 'Satu pembelian selamat melalui App Store. Kekalkan Premium selamanya pada Akaun Apple anda.', once: 'bayaran sekali',
    noSubscription: 'Tiada langganan. Tiada caj berulang.', purchase: 'Buka Premium Seumur Hidup', restore: 'Pulihkan Pembelian', close: 'Tutup',
    included: 'Premium aktif', legacy: 'Akses Premium penyokong awal anda telah disertakan.', purchased: 'Premium telah dibuka. Terima kasih menyokong SafarMate.',
    restored: 'Pembelian Premium anda telah dipulihkan.', pending: 'Pembelian anda sedang menunggu kelulusan.', cancelled: 'Pembelian dibatalkan.',
    unavailable: 'Pembelian tidak tersedia buat sementara. Cuba lagi kemudian.', error: 'Permintaan tidak dapat diselesaikan.',
    features: ['Pengurusan perjalanan tersimpan lanjutan', 'Kongsi dan eksport pelan perjalanan', 'Alat solat dalam penerbangan lanjutan', 'Mata wang dan alat pengangkutan lanjutan', 'Akses luar talian kepada butiran perjalanan tersimpan', 'Ciri Premium Seumur Hidup akan datang'],
    lockedFeature: 'Alat perjalanan lanjutan ini termasuk dalam Premium Seumur Hidup.',
  },
  tr: {
    premium: 'Premium', lifetime: 'Ömür Boyu', eyebrow: 'SafarMate Premium', title: 'Tüm seyahat araçlarının kilidini açın',
    subtitle: 'App Store üzerinden tek güvenli satın alma. Apple Hesabınızda Premium’u sonsuza kadar koruyun.', once: 'tek seferlik ödeme',
    noSubscription: 'Abonelik yok. Tekrarlayan ücret yok.', purchase: 'Ömür Boyu Premium’u Aç', restore: 'Satın Alımları Geri Yükle', close: 'Kapat',
    included: 'Premium etkin', legacy: 'Erken destekçi Premium erişiminiz dahildir.', purchased: 'Premium açıldı. SafarMate’i desteklediğiniz için teşekkürler.',
    restored: 'Premium satın alımınız geri yüklendi.', pending: 'Satın alımınız onay bekliyor.', cancelled: 'Satın alma iptal edildi.',
    unavailable: 'Satın alımlar geçici olarak kullanılamıyor. Daha sonra tekrar deneyin.', error: 'İstek tamamlanamadı.',
    features: ['Gelişmiş kayıtlı seyahat yönetimi', 'Seyahat planlarını paylaşma ve dışa aktarma', 'Gelişmiş uçuş içi namaz araçları', 'Döviz ve gelişmiş ulaşım araçları', 'Kayıtlı seyahat ayrıntılarına çevrimdışı erişim', 'Gelecekteki Ömür Boyu Premium özellikleri'],
    lockedFeature: 'Bu gelişmiş seyahat aracı Ömür Boyu Premium’a dahildir.',
  },
  fr: {
    premium: 'Premium', lifetime: 'À vie', eyebrow: 'SafarMate Premium', title: 'Débloquez tous les outils de voyage',
    subtitle: 'Un achat sécurisé sur l’App Store. Gardez Premium à vie sur votre compte Apple.', once: 'achat unique',
    noSubscription: 'Aucun abonnement. Aucun paiement récurrent.', purchase: 'Débloquer Premium à vie', restore: 'Restaurer les achats', close: 'Fermer',
    included: 'Premium est actif', legacy: 'Votre accès Premium de soutien initial est inclus.', purchased: 'Premium est débloqué. Merci de soutenir SafarMate.',
    restored: 'Votre achat Premium a été restauré.', pending: 'Votre achat est en attente d’approbation.', cancelled: 'L’achat a été annulé.',
    unavailable: 'Les achats sont temporairement indisponibles. Réessayez plus tard.', error: 'Impossible de terminer cette demande.',
    features: ['Gestion avancée des voyages enregistrés', 'Partage et exportation des itinéraires', 'Outils avancés de prière en vol', 'Devises et transports avancés', 'Accès hors ligne aux détails enregistrés', 'Futures fonctions Premium à vie'],
    lockedFeature: 'Cet outil de voyage avancé est inclus dans Premium à vie.',
  },
  ur: {
    premium: 'پریمیم', lifetime: 'تاحیات', eyebrow: 'سفرمیٹ پریمیم', title: 'تمام سفری اوزار کھولیں',
    subtitle: 'App Store کے ذریعے ایک محفوظ خریداری۔ اپنے Apple اکاؤنٹ پر پریمیم ہمیشہ رکھیں۔', once: 'ایک بار ادائیگی',
    noSubscription: 'کوئی سبسکرپشن یا بار بار چارج نہیں۔', purchase: 'تاحیات پریمیم کھولیں', restore: 'خریداری بحال کریں', close: 'بند کریں',
    included: 'پریمیم فعال ہے', legacy: 'ابتدائی صارف کے طور پر آپ کی پریمیم رسائی شامل ہے۔', purchased: 'پریمیم کھل گیا۔ سفرمیٹ کی حمایت کا شکریہ۔',
    restored: 'آپ کی پریمیم خریداری بحال ہوگئی۔', pending: 'آپ کی خریداری منظوری کی منتظر ہے۔', cancelled: 'خریداری منسوخ ہوگئی۔',
    unavailable: 'خریداری عارضی طور پر دستیاب نہیں۔ بعد میں کوشش کریں۔', error: 'درخواست مکمل نہیں ہو سکی۔',
    features: ['محفوظ سفروں کا جدید انتظام', 'سفری منصوبے شیئر اور ایکسپورٹ کریں', 'پرواز کے دوران نماز کے جدید اوزار', 'کرنسی اور جدید ٹرانسپورٹ اوزار', 'محفوظ سفری تفصیلات تک آف لائن رسائی', 'مستقبل کی تاحیات پریمیم خصوصیات'],
    lockedFeature: 'یہ جدید سفری آلہ تاحیات پریمیم میں شامل ہے۔',
  },
};

const premiumHashes = new Set(['#flight-mode', '#money', '#car-rental', '#public-transport', '#taxi-services']);
const premiumSelectors = [
  '[data-share-trip]', '[data-copy-trip]', '[data-export-trip]', '[data-duplicate-trip]',
  '#share-trip', '#copy-trip', '#export-trip', '#export-calendar',
  '#open-flight-mode', '#open-money', '#open-car-rental', '#open-public-transport', '#open-taxi-services',
].join(',');

let premiumState: PremiumState = premiumService.current();
let dialog: HTMLElement | null = null;
let statusMessage = '';
let lastTrigger: HTMLElement | null = null;

function language(): Language {
  try { return parseLanguage(localStorage.getItem('mtp-language')) ?? 'en'; } catch { return 'en'; }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' })[character] ?? character);
}

function currentCopy() { return copyByLanguage[language()]; }
function displayPrice() { return premiumState.displayPrice || '$3.99'; }

function paywallMarkup(reason = '') {
  const lang = language();
  const copy = copyByLanguage[lang];
  const dir = languageDirection(lang);
  const active = premiumState.entitled;
  const price = escapeHtml(displayPrice());
  const featureItems = copy.features.map((feature) => `<li><span aria-hidden="true">✓</span><span>${escapeHtml(feature)}</span></li>`).join('');
  const message = statusMessage || (reason ? copy.lockedFeature : '') || (premiumState.grandfathered ? copy.legacy : '');
  return `<div class="premium-backdrop" data-premium-close></div>
    <section class="premium-sheet" role="dialog" aria-modal="true" aria-labelledby="premium-title" dir="${dir}">
      <div class="premium-grabber" aria-hidden="true"></div>
      <button class="premium-close" type="button" data-premium-close aria-label="${escapeHtml(copy.close)}">×</button>
      <div class="premium-mark" aria-hidden="true"><span>✦</span></div>
      <p class="premium-eyebrow">${escapeHtml(copy.eyebrow)}</p>
      <h2 id="premium-title">${escapeHtml(active ? copy.included : copy.title)}</h2>
      <p class="premium-subtitle">${escapeHtml(active ? (premiumState.grandfathered ? copy.legacy : copy.purchased) : copy.subtitle)}</p>
      <div class="premium-price" ${active ? 'hidden' : ''}><strong>${price}</strong><span>${escapeHtml(copy.once)}</span></div>
      <p class="premium-no-subscription" ${active ? 'hidden' : ''}>${escapeHtml(copy.noSubscription)}</p>
      <ul class="premium-features">${featureItems}</ul>
      <p class="premium-status" role="status" aria-live="polite">${escapeHtml(message)}</p>
      <div class="premium-actions">
        ${active ? `<button class="premium-primary" type="button" data-premium-close>${escapeHtml(copy.close)}</button>` : `<button class="premium-primary" type="button" data-premium-buy ${premiumState.loading || !premiumState.available ? 'disabled' : ''}><span>${escapeHtml(copy.purchase)}</span><strong>${price}</strong></button>`}
        <button class="premium-restore" type="button" data-premium-restore ${premiumState.loading ? 'disabled' : ''}>${escapeHtml(copy.restore)}</button>
      </div>
    </section>`;
}

function closePaywall() {
  if (!dialog) return;
  dialog.remove();
  dialog = null;
  document.documentElement.classList.remove('premium-open');
  document.querySelector('#root')?.removeAttribute('inert');
  lastTrigger?.focus();
}

function renderPaywall(reason = '') {
  if (!dialog) return;
  dialog.innerHTML = paywallMarkup(reason);
  bindPaywall(reason);
}

function openPaywall(reason = '', trigger?: HTMLElement | null) {
  lastTrigger = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  statusMessage = '';
  if (dialog) dialog.remove();
  dialog = document.createElement('div');
  dialog.className = 'premium-layer';
  dialog.innerHTML = paywallMarkup(reason);
  document.body.append(dialog);
  document.documentElement.classList.add('premium-open');
  document.querySelector('#root')?.setAttribute('inert', '');
  bindPaywall(reason);
  dialog.querySelector<HTMLElement>('[data-premium-buy], [data-premium-close]')?.focus();
}

function outcomeMessage(outcome: PurchaseOutcome, restored = false) {
  const copy = currentCopy();
  if (outcome === 'purchased') return restored ? copy.restored : copy.purchased;
  if (outcome === 'pending') return copy.pending;
  if (outcome === 'cancelled') return copy.cancelled;
  return premiumState.error ? `${copy.error} ${premiumState.error}` : copy.unavailable;
}

function bindPaywall(reason: string) {
  if (!dialog) return;
  dialog.querySelectorAll<HTMLElement>('[data-premium-close]').forEach((element) => element.addEventListener('click', closePaywall));
  dialog.querySelector<HTMLButtonElement>('[data-premium-buy]')?.addEventListener('click', async () => {
    statusMessage = '';
    renderPaywall(reason);
    const result = await premiumService.purchase();
    premiumState = result.state;
    statusMessage = outcomeMessage(result.outcome);
    renderPaywall(reason);
    ensurePremiumEntry();
  });
  dialog.querySelector<HTMLButtonElement>('[data-premium-restore]')?.addEventListener('click', async () => {
    statusMessage = '';
    renderPaywall(reason);
    const result = await premiumService.restore();
    premiumState = result.state;
    statusMessage = outcomeMessage(result.outcome, true);
    renderPaywall(reason);
    ensurePremiumEntry();
  });
}

function ensurePremiumEntry() {
  const root = document.querySelector<HTMLElement>('#root');
  if (!root) return;
  const copy = currentCopy();
  const existing = root.querySelector<HTMLButtonElement>('[data-premium-entry]');
  const label = premiumState.entitled ? `${copy.premium} ✓` : copy.premium;
  if (existing) {
    existing.innerHTML = `<span aria-hidden="true">✦</span><span>${escapeHtml(label)}</span>`;
    existing.classList.toggle('is-active', premiumState.entitled);
    return;
  }
  const host = root.querySelector<HTMLElement>('.hero') ?? root.querySelector<HTMLElement>('main');
  if (!host) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `premium-entry${premiumState.entitled ? ' is-active' : ''}`;
  button.dataset.premiumEntry = 'true';
  button.innerHTML = `<span aria-hidden="true">✦</span><span>${escapeHtml(label)}</span>`;
  button.addEventListener('click', () => openPaywall('', button));
  host.append(button);
}

function targetRequiresPremium(target: HTMLElement): boolean {
  const actionable = target.closest<HTMLElement>('a, button, [role="button"]');
  if (!actionable || actionable.matches('[data-premium-entry], [data-premium-buy], [data-premium-restore], [data-premium-close]')) return false;
  if (actionable.matches(premiumSelectors)) return true;
  const href = actionable instanceof HTMLAnchorElement ? actionable.getAttribute('href') : null;
  if (href && premiumHashes.has(href)) return true;
  const hash = actionable.dataset.view ? `#${actionable.dataset.view}` : '';
  return premiumHashes.has(hash);
}

function bindGlobalGating() {
  document.addEventListener('click', (event) => {
    if (premiumState.entitled || !(event.target instanceof HTMLElement) || !targetRequiresPremium(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPaywall('locked', event.target.closest<HTMLElement>('a, button, [role="button"]'));
  }, true);
  window.addEventListener('hashchange', () => {
    if (premiumState.entitled || !premiumHashes.has(window.location.hash)) return;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    openPaywall('locked');
  });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && dialog) closePaywall(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void premiumService.refresh(true); });
}

export async function startPremiumExperience() {
  premiumService.subscribe((state) => {
    premiumState = state;
    ensurePremiumEntry();
    if (dialog) renderPaywall();
  });
  bindGlobalGating();
  const root = document.querySelector('#root');
  if (root) new MutationObserver(() => ensurePremiumEntry()).observe(root, { childList: true, subtree: false });
  ensurePremiumEntry();
  await premiumService.refresh();
}

void startPremiumExperience();
