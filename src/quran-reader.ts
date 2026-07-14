export type QuranVoiceAction = 'next' | 'previous' | 'stop' | 'unknown';

export type QuranGlossaryEntry = {
  word: string;
  meaning: string;
};

const arabicDiacritics = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const punctuation = /[^\p{L}\p{N}\s]/gu;

export function normalizeQuranVoiceInput(value: string) {
  return value
    .normalize('NFKC')
    .replace(arabicDiacritics, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(punctuation, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function parseQuranVoiceCommand(value: string): QuranVoiceAction {
  const normalized = normalizeQuranVoiceInput(value);

  const nextCommands = [
    'التالي',
    'الصفحه التاليه',
    'اقلب الصفحه',
    'اقلب للصفحه التاليه',
    'انتقل للصفحه التاليه',
    'next',
    'next page',
    'turn the page',
  ];
  const previousCommands = [
    'السابق',
    'الصفحه السابقه',
    'ارجع',
    'ارجع للصفحه السابقه',
    'previous',
    'previous page',
    'go back',
  ];
  const stopCommands = [
    'توقف',
    'اوقف الاستماع',
    'اغلق الميكروفون',
    'stop',
    'stop listening',
  ];

  if (nextCommands.some((command) => normalized.includes(command))) return 'next';
  if (previousCommands.some((command) => normalized.includes(command))) return 'previous';
  if (stopCommands.some((command) => normalized.includes(command))) return 'stop';
  return 'unknown';
}

export function dedupeQuranGlossary(entries: QuranGlossaryEntry[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = normalizeQuranVoiceInput(entry.word);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
