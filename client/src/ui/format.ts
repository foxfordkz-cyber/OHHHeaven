import type { Money } from '@shared/types';

const MINUS = '−';

/** $38,420 · −$1,010 · +$3,240 (signed) · $1.2M (compact) · $6.40 (cents). */
export function formatMoney(value: Money, opts: { signed?: boolean; compact?: boolean; cents?: boolean } = {}): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  let body: string;
  if (opts.compact && abs >= 1_000_000) body = `${trim(abs / 1_000_000)}M`;
  else if (opts.compact && abs >= 10_000) body = `${trim(abs / 1_000)}k`;
  else {
    const cents = opts.cents ?? (abs < 100 && abs % 1 !== 0);
    body = abs.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  }
  const sign = value < 0 ? MINUS : opts.signed && value > 0 ? '+' : '';
  return `${sign}$${body}`;
}

function trim(n: number): string {
  return n >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, '');
}

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  const s = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return value < 0 ? `${MINUS}${s}` : s;
}

/** 0.124 → "12%"; 0.0875 with digits 1 → "8.8%". */
export function formatPct(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return `${formatNumber(value * 100, digits)}%`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${formatNumber(n)} ${n === 1 ? one : many}`;

export type MoneyTone = 'profit' | 'loss' | 'neutral';
export const toneOf = (value: number): MoneyTone => (value > 0 ? 'profit' : value < 0 ? 'loss' : 'neutral');
