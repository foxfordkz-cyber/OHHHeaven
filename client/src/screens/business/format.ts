// Display formatting only. No game math here: numbers come from the view or from what_if.
import { dateOf } from '@ohh/shared/rules';
import type { EventEffect, WeatherCondition } from '@ohh/shared/types';

const whole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, minimumFractionDigits: 0 });
const cents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const count = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const MINUS = '−';

/** $3,240 — whole dollars. Negative numbers get a real minus sign: −$1,200. */
export function usd(n: number): string {
  const s = whole.format(Math.abs(n));
  return n < 0 && Math.round(Math.abs(n)) !== 0 ? `${MINUS}${s}` : s;
}

/** $6.40 — prices. */
export function usd2(n: number): string {
  const s = cents.format(Math.abs(n));
  return n < 0 ? `${MINUS}${s}` : s;
}

/** +$3,240 / −$1,200 / $0 */
export function signedUsd(n: number): string {
  if (Math.round(n) === 0) return '$0';
  return n > 0 ? `+${usd(n)}` : usd(n);
}

export function num(n: number): string {
  return count.format(n);
}

/** 0.36 → 36% */
export function pct(share: number, digits = 0): string {
  return `${(share * 100).toFixed(digits)}%`;
}

/** Multiplier → signed change: 1.15 → +15%, 0.85 → −15%. */
export function multChange(mult: number): string {
  const p = Math.round((mult - 1) * 100);
  if (p === 0) return '0%';
  return p > 0 ? `+${p}%` : `${MINUS}${Math.abs(p)}%`;
}

export function dayLabel(day: number): string {
  return dateOf(day).label;
}

/** "Apr 20" without the weekday. */
export function shortDate(day: number): string {
  const label = dateOf(day).label;
  const comma = label.indexOf(', ');
  return comma >= 0 ? label.slice(comma + 2) : label;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${num(n)} ${Math.abs(n) === 1 ? one : many}`;
}

/** "in 3 days", "today", "tomorrow", "2 days ago" relative to the current game day. */
export function relDay(day: number, today: number): string {
  const d = day - today;
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}

/** Real time until the next game day: "in 2s", "in 31 min", "in 1 h 5 min". */
export function realWait(ms: number): string {
  if (ms < 60_000) return `in ${Math.max(1, Math.round(ms / 1000))}s`;
  const min = Math.round(ms / 60_000);
  if (min < 60) return `in ${min} min`;
  return `in ${Math.floor(min / 60)} h ${min % 60} min`;
}

export const WEATHER_ICON: Record<WeatherCondition, string> = {
  clear: '☀️', cloudy: '☁️', rain: '🌧️', snow: '❄️', heat: '🔥', storm: '⛈️',
};

const TARGET_TEXT: Record<EventEffect['target'], string> = {
  demand: 'customers',
  cogs: 'cost per order',
  staffAvailability: 'staff hours',
  footTraffic: 'people walking by',
  utilities: 'utility bills',
  deliveryShare: 'delivery orders',
  rent: 'rent',
};

/** One effect in words: "+15% cost per order". */
export function effectText(e: EventEffect): string {
  return `${multChange(e.mult)} ${TARGET_TEXT[e.target]}`;
}

/** Is a higher value of this target good for an owner? */
export function effectIsGood(e: EventEffect): boolean {
  const up = e.mult >= 1;
  return e.target === 'cogs' || e.target === 'utilities' || e.target === 'rent' ? !up : up;
}

/** "Coffee shop" → "coffee shops", "Barbershop" → "barbershops". */
export function nichePlural(name: string): string {
  const low = name.toLowerCase();
  return low.endsWith('s') ? low : `${low}s`;
}
