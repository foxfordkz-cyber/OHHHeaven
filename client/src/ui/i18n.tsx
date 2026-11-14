// Two languages. English is the main one; Russian is switched on by the visitor and remembered.
// Use: const tr = useT();  tr('English text', 'Русский текст')
import { useSyncExternalStore } from 'react';

export type Lang = 'en' | 'ru';

const KEY = 'fy-lang';
const EVENT = 'fy-lang-change';

export function getLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  try { return window.localStorage.getItem(KEY) === 'ru' ? 'ru' : 'en'; } catch { return 'en'; }
}

export function setLang(lang: Lang) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(KEY, lang); } catch { /* private mode: lasts for this page only */ }
  document.documentElement.lang = lang;
  window.dispatchEvent(new Event(EVENT));
}

/** Called once at start-up. */
export function initLang() {
  if (typeof document !== 'undefined') document.documentElement.lang = getLang();
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, () => 'en' as Lang);
}

/** Returns a picker: tr(english, russian). */
export function useT(): (en: string, ru: string) => string {
  const lang = useLang();
  return (en, ru) => (lang === 'ru' ? ru : en);
}

/** Outside React (plain functions): the text for the current language. */
export const pick = (en: string, ru: string): string => (getLang() === 'ru' ? ru : en);

/** EN · RU switch for headers. */
export function LangToggle() {
  const lang = useLang();
  return (
    <span className="lang-toggle" role="group" aria-label="Language">
      <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
      <button type="button" aria-pressed={lang === 'ru'} onClick={() => setLang('ru')}>RU</button>
    </span>
  );
}
