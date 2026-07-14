import './quran-reader.css';
import { dedupeQuranGlossary, parseQuranVoiceCommand } from './quran-reader.js';

type SpeechRecognitionResultLike = {
  0: { transcript: string };
  length: number;
  isFinal?: boolean;
};

type SpeechRecognitionEventLike = Event & {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorLike = Event & {
  error?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const glossary = dedupeQuranGlossary([
  { word: 'المتقين', meaning: 'الذين اتقوا الله بطاعته واجتنبوا معاصيه.' },
  { word: 'يؤمنون', meaning: 'يصدقون ويقرّون بما أنزل الله.' },
  { word: 'ينفقون', meaning: 'يخرجون من أموالهم في سبيل الله.' },
  { word: 'يقيمون', meaning: 'يحافظون على الصلاة ويؤدّونها.' },
  { word: 'يؤمنون', meaning: 'يصدقون بما أنزل الله.' },
  { word: 'أولئك', meaning: 'هؤلاء المذكورون.' },
  { word: 'هدى', meaning: 'دلالة وإرشاد إلى الحق.' },
  { word: 'مِن', meaning: 'ابتداء الغاية.' },
  { word: 'مؤمنين', meaning: 'مصدّقين بالله واليوم الآخر.' },
  { word: 'عذاب عظيم', meaning: 'عقاب شديد كبير.' },
  { word: 'غشاوة', meaning: 'ستر وغطاء.' },
]);

const coverMarkup = `
  <section class="quran-reader-cover" dir="rtl" aria-labelledby="quran-cover-title">
    <p>قارئ قرآن بتصميم المصحف المزيّن</p>
    <h2 id="quran-cover-title">القرآن الكريم</h2>
    <p>قل: «الصفحة التالية» أو “next page” للانتقال إلى نموذج الصفحة المعتمد.</p>
  </section>
`;

const samplePageMarkup = `
  <article class="quran-page" dir="rtl" aria-label="نموذج صفحة القرآن المعتمدة">
    <aside class="quran-margin" aria-label="معاني الكلمات الصعبة">
      ${glossary.map((entry) => `
        <div class="quran-glossary-item">
          <strong>${entry.word}</strong>
          <span>${entry.meaning}</span>
        </div>
      `).join('')}
    </aside>

    <section class="quran-page-main">
      <header class="quran-page-header" aria-label="بيانات الصفحة">
        <span>الجزء الثاني</span>
        <span>١٢٧</span>
        <span>سورة البقرة</span>
      </header>

      <div class="quran-verses" aria-label="نص قرآني نموذجي">
        <p>
          الم <span class="quran-ayah-number">١</span>
          ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ
          <span class="quran-difficult quran-tajweed-green">هُدًى</span>
          لِّلْمُتَّقِينَ <span class="quran-ayah-number">٢</span>
        </p>
        <p>
          الَّذِينَ <span class="quran-difficult quran-tajweed-green">يُؤْمِنُونَ</span> بِالْغَيْبِ
          وَ<span class="quran-difficult">يُقِيمُونَ</span> الصَّلَاةَ
          وَمِمَّا رَزَقْنَاهُمْ <span class="quran-difficult quran-tajweed-red">يُنفِقُونَ</span>
          <span class="quran-ayah-number">٣</span>
        </p>
        <p>
          وَالَّذِينَ <span class="quran-difficult quran-tajweed-red">يُؤْمِنُونَ</span> بِمَا أُنزِلَ إِلَيْكَ
          وَمَا أُنزِلَ <span class="quran-difficult">مِن</span> قَبْلِكَ
          وَبِالْآخِرَةِ هُمْ يُوقِنُونَ <span class="quran-ayah-number">٤</span>
        </p>
        <p>
          <span class="quran-difficult">أُولَٰئِكَ</span> عَلَىٰ
          <span class="quran-difficult quran-tajweed-green">هُدًى</span> مِّن رَّبِّهِمْ ۖ
          وَأُولَٰئِكَ هُمُ الْمُفْلِحُونَ <span class="quran-ayah-number">٥</span>
        </p>

        <div class="quran-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>

        <p>
          إِنَّ الَّذِينَ كَفَرُوا سَوَاءٌ عَلَيْهِمْ أَأَنذَرْتَهُمْ أَمْ لَمْ تُنذِرْهُمْ
          لَا <span class="quran-difficult quran-tajweed-red">يُؤْمِنُونَ</span>
          <span class="quran-ayah-number">٦</span>
        </p>
        <p>
          خَتَمَ اللَّهُ عَلَىٰ قُلُوبِهِمْ وَعَلَىٰ سَمْعِهِمْ ۖ
          وَعَلَىٰ أَبْصَارِهِمْ <span class="quran-difficult">غِشَاوَةٌ</span> ۖ
          وَلَهُمْ <span class="quran-difficult">عَذَابٌ عَظِيمٌ</span>
          <span class="quran-ayah-number">٧</span>
        </p>
        <p>
          وَمِنَ النَّاسِ مَن يَقُولُ آمَنَّا بِاللَّهِ وَبِالْيَوْمِ الْآخِرِ
          وَمَا هُم بِ<span class="quran-difficult quran-tajweed-red">مُؤْمِنِينَ</span>
          <span class="quran-ayah-number">٨</span>
        </p>
        <p>
          يُخَادِعُونَ اللَّهَ وَالَّذِينَ آمَنُوا وَمَا يَخْدَعُونَ إِلَّا أَنفُسَهُمْ
          وَمَا يَشْعُرُونَ <span class="quran-ayah-number">٩</span>
        </p>
      </div>

      <footer class="quran-page-note">
        نموذج بصري للتصميم المعتمد. يجب مطابقة النص والضبط وأرقام الصفحات مع مصدر مصحف موثّق قبل النشر النهائي.
      </footer>
    </section>
  </article>
`;

function installQuranReader() {
  if (document.querySelector('[data-quran-reader-launcher]')) return;

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'quran-reader-launcher';
  launcher.dataset.quranReaderLauncher = 'true';
  launcher.textContent = 'القرآن | Qur’an';
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-controls', 'quran-reader-dialog');

  const backdrop = document.createElement('div');
  backdrop.className = 'quran-reader-backdrop';
  backdrop.hidden = true;
  backdrop.innerHTML = `
    <section class="quran-reader-dialog" id="quran-reader-dialog" role="dialog" aria-modal="true" aria-labelledby="quran-reader-heading" dir="rtl">
      <header class="quran-reader-toolbar">
        <button type="button" class="ghost" data-quran-close aria-label="إغلاق قارئ القرآن">إغلاق</button>
        <div class="quran-reader-title">
          <strong id="quran-reader-heading">قارئ القرآن</strong>
          <span>صفحة مزخرفة، معاني فريدة، وأوامر صوتية</span>
        </div>
        <button type="button" class="quran-reader-voice" data-quran-voice aria-pressed="false">🎙 الأوامر الصوتية</button>
      </header>

      <div class="quran-reader-viewport" data-quran-viewport>
        <div class="quran-reader-stage" data-quran-stage></div>
      </div>

      <footer class="quran-reader-controls">
        <button type="button" class="ghost" data-quran-previous>الصفحة السابقة</button>
        <div class="quran-reader-status" data-quran-status role="status" aria-live="polite"></div>
        <button type="button" data-quran-next>الصفحة التالية</button>
      </footer>
    </section>
  `;

  document.body.append(launcher, backdrop);

  const stage = backdrop.querySelector<HTMLElement>('[data-quran-stage]');
  const viewport = backdrop.querySelector<HTMLElement>('[data-quran-viewport]');
  const status = backdrop.querySelector<HTMLElement>('[data-quran-status]');
  const closeButton = backdrop.querySelector<HTMLButtonElement>('[data-quran-close]');
  const voiceButton = backdrop.querySelector<HTMLButtonElement>('[data-quran-voice]');
  const nextButton = backdrop.querySelector<HTMLButtonElement>('[data-quran-next]');
  const previousButton = backdrop.querySelector<HTMLButtonElement>('[data-quran-previous]');
  if (!stage || !viewport || !status || !closeButton || !voiceButton || !nextButton || !previousButton) return;

  const steps = [coverMarkup, samplePageMarkup];
  let currentStep = 0;
  let previousFocus: HTMLElement | null = null;
  let touchStartX = 0;
  let voiceActive = false;
  let recognition: SpeechRecognitionLike | null = null;
  let restartTimer: number | undefined;

  const setStatus = (message: string) => {
    status.textContent = message;
  };

  const renderStep = () => {
    stage.innerHTML = steps[currentStep];
    viewport.scrollTo({ top: 0, behavior: 'smooth' });
    previousButton.disabled = currentStep === 0;
    nextButton.disabled = currentStep === steps.length - 1;
    setStatus(currentStep === 0 ? 'قل «الصفحة التالية» لفتح نموذج الصفحة.' : 'نموذج الصفحة المعتمد ظاهر الآن.');
  };

  const turnPage = (direction: 1 | -1) => {
    const nextStep = currentStep + direction;
    if (nextStep < 0) {
      setStatus('هذه هي الصفحة الأولى في النسخة التجريبية.');
      return;
    }
    if (nextStep >= steps.length) {
      setStatus('الصفحة التالية تحتاج إلى نص وصورة موثّقين قبل إضافتها.');
      return;
    }

    stage.classList.remove('is-turning-next', 'is-turning-previous');
    stage.classList.add(direction === 1 ? 'is-turning-next' : 'is-turning-previous');
    currentStep = nextStep;
    window.setTimeout(() => {
      renderStep();
      stage.classList.remove('is-turning-next', 'is-turning-previous');
    }, 145);
  };

  const stopVoice = (message = 'تم إيقاف الأوامر الصوتية.') => {
    voiceActive = false;
    if (restartTimer) window.clearTimeout(restartTimer);
    restartTimer = undefined;
    voiceButton.setAttribute('aria-pressed', 'false');
    voiceButton.textContent = '🎙 الأوامر الصوتية';
    try { recognition?.stop(); } catch { /* recognition may already be stopped */ }
    setStatus(message);
  };

  const startVoice = () => {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setStatus('التعرّف الصوتي غير متاح على هذا الجهاز. استخدم أزرار الصفحة.');
      return;
    }

    if (!recognition) {
      recognition = new Recognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const last = event.results[event.results.length - 1];
        const transcript = last?.[0]?.transcript ?? '';
        const action = parseQuranVoiceCommand(transcript);
        if (action === 'next') turnPage(1);
        else if (action === 'previous') turnPage(-1);
        else if (action === 'stop') stopVoice();
        else setStatus(`لم أفهم: «${transcript}». قل «الصفحة التالية» أو «الصفحة السابقة».`);
      };
      recognition.onerror = (event) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          stopVoice('لم يُسمح باستخدام الميكروفون. يمكنك استعمال أزرار الصفحة.');
          return;
        }
        setStatus('تعذّر سماع الأمر. حاول مرة أخرى.');
      };
      recognition.onend = () => {
        if (!voiceActive || backdrop.hidden) return;
        restartTimer = window.setTimeout(() => {
          try { recognition?.start(); } catch { /* the recognizer may still be settling */ }
        }, 300);
      };
    }

    voiceActive = true;
    voiceButton.setAttribute('aria-pressed', 'true');
    voiceButton.textContent = '■ إيقاف الاستماع';
    setStatus('أستمع الآن: قل «الصفحة التالية» أو «الصفحة السابقة».');
    try { recognition.start(); } catch { /* already active */ }
  };

  const closeReader = () => {
    stopVoice('');
    backdrop.hidden = true;
    document.body.classList.remove('quran-reader-open');
    previousFocus?.focus();
  };

  launcher.addEventListener('click', () => {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : launcher;
    backdrop.hidden = false;
    document.body.classList.add('quran-reader-open');
    renderStep();
    closeButton.focus();
  });

  closeButton.addEventListener('click', closeReader);
  nextButton.addEventListener('click', () => turnPage(1));
  previousButton.addEventListener('click', () => turnPage(-1));
  voiceButton.addEventListener('click', () => {
    if (voiceActive) stopVoice();
    else startVoice();
  });

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeReader();
  });

  viewport.addEventListener('pointerdown', (event) => {
    touchStartX = event.clientX;
  });
  viewport.addEventListener('pointerup', (event) => {
    const distance = event.clientX - touchStartX;
    if (Math.abs(distance) < 70) return;
    turnPage(distance < 0 ? 1 : -1);
  });

  document.addEventListener('keydown', (event) => {
    if (backdrop.hidden) return;
    if (event.key === 'Escape') closeReader();
    else if (event.key === 'ArrowLeft') turnPage(1);
    else if (event.key === 'ArrowRight') turnPage(-1);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installQuranReader, { once: true });
} else {
  installQuranReader();
}
