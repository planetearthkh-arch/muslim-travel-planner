import type { Language } from './app-language.js';
import { ensureRtlMapSupport } from './map-rtl-bootstrap.js';

export const OPEN_FREE_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright';
const BUNDLED_STYLE_URL = new URL('./vendor/openfreemap-bright.json', document.baseURI).toString();
const STYLE_LOAD_TIMEOUT_MS = 5_000;
const RTL_LANGUAGES = new Set<Language>(['ar', 'ur']);

type StyleLayer = {
  type?: string;
  layout?: Record<string, unknown>;
};

type MapStyle = {
  version: number;
  sources: Record<string, unknown>;
  sprite?: string;
  glyphs?: string;
  layers: StyleLayer[];
  [key: string]: unknown;
};

let sourceStylePromise: Promise<MapStyle | null> | undefined;
const localizedStyles = new Map<string, MapStyle>();

function hasNameField(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  if (value[0] === 'get' && typeof value[1] === 'string') {
    return value[1] === 'name' || value[1] === 'name_en' || value[1].startsWith('name:');
  }
  return value.some(hasNameField);
}

function latinNameExpression(language: Language) {
  const preferred = language === 'en' ? ['name:en', 'name_en'] : [`name:${language}`, 'name:latin', 'name_en'];
  return ['coalesce', ...preferred.map((field) => ['get', field]), ['get', 'name']] as unknown[];
}

function rtlNameExpression(language: 'ar' | 'ur') {
  return [
    'coalesce',
    ['get', `name:${language}`],
    ['get', 'name:nonlatin'],
    ['get', 'name:latin'],
    ['get', 'name_en'],
    ['get', 'name'],
  ] as unknown[];
}

async function loadBundledStyle() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), STYLE_LOAD_TIMEOUT_MS);
  try {
    const response = await fetch(BUNDLED_STYLE_URL, { cache: 'force-cache', signal: controller.signal });
    if (!response.ok) return null;
    const value = await response.json() as MapStyle;
    return value.version === 8 && Array.isArray(value.layers) ? value : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

function cloneStyle(style: MapStyle): MapStyle {
  return JSON.parse(JSON.stringify(style)) as MapStyle;
}

function localizeStyle(style: MapStyle, language: Language, rtlReady: boolean) {
  const cacheKey = `${language}:${rtlReady ? 'rtl' : 'latin'}`;
  const cached = localizedStyles.get(cacheKey);
  if (cached) return cloneStyle(cached);

  const localized = cloneStyle(style);
  const expression = RTL_LANGUAGES.has(language) && rtlReady
    ? rtlNameExpression(language as 'ar' | 'ur')
    : latinNameExpression(language);

  for (const layer of localized.layers) {
    if (layer.type !== 'symbol' || !layer.layout) continue;
    const textField = layer.layout['text-field'];
    if (!hasNameField(textField)) continue;
    layer.layout['text-field'] = expression;
  }

  localizedStyles.set(cacheKey, localized);
  return cloneStyle(localized);
}

/**
 * Return a deterministic, language-aware style. If RTL shaping cannot load,
 * Arabic and Urdu maps fall back to Latin labels rather than losing symbols.
 */
export async function mapStyleForLanguage(language: Language): Promise<MapStyle | string> {
  sourceStylePromise ??= loadBundledStyle();
  const [style, rtlReady] = await Promise.all([
    sourceStylePromise,
    ensureRtlMapSupport(language),
  ]);
  if (!style) return OPEN_FREE_MAP_STYLE_URL;
  return localizeStyle(style, language, rtlReady);
}
