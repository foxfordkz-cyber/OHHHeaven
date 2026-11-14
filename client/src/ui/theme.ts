// Light and dark theme. The choice lives in <html data-theme> (set before first paint by the inline script
// in index.html) and is remembered in localStorage. Light is the default.
import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'fy-theme-2';
const EVENT = 'fy-theme-change';
const PAGE_BG: Record<Theme, string> = { dark: '#0f0f0e', light: '#f3f1ea' };

const hasDom = () => typeof document !== 'undefined';

function stored(): Theme | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

/** Light is the look of the product; dark is there for those who switch to it. */
const DEFAULT: Theme = 'light';

export function getTheme(): Theme {
  if (!hasDom()) return 'dark';
  const v = document.documentElement.dataset.theme;
  return v === 'light' || v === 'dark' ? v : stored() ?? DEFAULT;
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PAGE_BG[theme]);
  window.dispatchEvent(new Event(EVENT));
}

/** The user picked a theme: remember it. */
export function setTheme(theme: Theme) {
  if (!hasDom()) return;
  try { window.localStorage.setItem(KEY, theme); } catch { /* private mode: the choice lasts for this page only */ }
  apply(theme);
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

/** Called once at start-up: applies the stored theme, or the default one. */
export function initTheme() {
  if (!hasDom()) return;
  apply(getTheme());
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'dark' as Theme);
}
