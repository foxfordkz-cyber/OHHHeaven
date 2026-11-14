// Light and dark theme. The choice lives in <html data-theme> (set before first paint by the inline script
// in index.html), is remembered in localStorage and follows the system setting until the user picks one.
import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'fy-theme';
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

function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function getTheme(): Theme {
  if (!hasDom()) return 'dark';
  const v = document.documentElement.dataset.theme;
  return v === 'light' || v === 'dark' ? v : stored() ?? systemTheme();
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

/** Called once at start-up: applies the theme and follows the system setting until the user chooses. */
export function initTheme() {
  if (!hasDom()) return;
  apply(getTheme());
  window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (!stored()) apply(systemTheme());
  });
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'dark' as Theme);
}
