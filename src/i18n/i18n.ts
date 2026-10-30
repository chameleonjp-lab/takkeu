import { TRANSLATIONS } from './translations';
import { getLanguageLocale, isSupportedLanguage, languageFromLocale } from './languages';
import type { Language } from './languages';
export { SUPPORTED_LANGUAGES, getLanguageLocale } from './languages';
export const LANGUAGE_STORAGE_KEY = 'takkeu.language.v1';
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
type NavigatorLanguages = { languages?: readonly string[]; language?: string };
export type Parameters = Readonly<Record<string, string | number>>;
function safeStorage(): Storage | null { try { return globalThis.localStorage ?? null; } catch { return null; } }
export function browserLanguage(nav?: NavigatorLanguages): Language {
  const preferences = [...(Array.isArray(nav?.languages) ? nav.languages : []), nav?.language].filter((tag): tag is string => typeof tag === 'string' && !!tag.trim());
  for (const tag of preferences) { const language = languageFromLocale(tag); if (language) return language; }
  return preferences.length ? 'en' : 'ja';
}
export function translate(source: string, parameters: Parameters = {}, language: Language = 'ja'): string {
  const catalog: Readonly<Record<string, string>> = TRANSLATIONS[language];
  const message = Object.hasOwn(catalog, source) ? catalog[source]! : source;
  return message.replace(/\{([a-zA-Z0-9_]+)\}/gu, (_placeholder, key: string) => Object.hasOwn(parameters, key) ? String(parameters[key]) : '—');
}
export function createI18n({ storage = safeStorage(), navigatorObject }: { storage?: Storage | null | undefined; navigatorObject?: NavigatorLanguages | undefined } = {}) {
  let language = browserLanguage(navigatorObject);
  try { const saved = storage?.getItem(LANGUAGE_STORAGE_KEY); if (isSupportedLanguage(saved)) language = saved; } catch { /* Memory selection remains available. */ }
  const listeners = new Set<() => void>();
  return {
    getLanguage: () => language,
    setLanguage(next: string) {
      if (!isSupportedLanguage(next)) return;
      try { storage?.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* Current page still switches. */ }
      if (language === next) return;
      language = next; listeners.forEach(listener => listener());
    },
    onLanguageChange(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    t: (source: string, parameters?: Parameters) => translate(source, parameters, language),
  };
}
// App initialization supplies browser/storage context. Plain module consumers keep Japanese.
let active = createI18n({ storage: null });
export function initializeLanguage(storage?: Storage | null, navigatorObject?: NavigatorLanguages): void {
  active = createI18n({ storage, navigatorObject });
}
export const getLanguage = (): Language => active.getLanguage();
export const setLanguage = (next: string): void => active.setLanguage(next);
export const onLanguageChange = (listener: () => void): (() => void) => active.onLanguageChange(listener);
export const t = (source: string, parameters?: Parameters, language = getLanguage()): string => translate(source, parameters, language);
const numberFormats = new Map<Language, Intl.NumberFormat>();
export function formatNumber(value: number, language = getLanguage()): string {
  // Preserve the original Japanese compact game counters; other locales group naturally.
  let formatter = numberFormats.get(language);
  if (!formatter) { formatter = new Intl.NumberFormat(getLanguageLocale(language), { useGrouping: language !== 'ja' }); numberFormats.set(language, formatter); }
  return formatter.format(value);
}
export function translateError(message: string): string {
  const status = /^ランキング通信に失敗しました（(\d+)）。$/u.exec(message);
  if (status) return t('ランキング通信に失敗しました（{status}）。', { status: status[1]! });
  if (Object.hasOwn(TRANSLATIONS.ja, message)) return t(message);
  return t('準備を完了できませんでした。もう一度お試しください。');
}
