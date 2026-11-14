// Number formatting for agent 11 screens. Pure, locale fixed to en-US (the audience is in the US).

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** $41,230 · −$1,200 · +$2,480 with `sign`. Cents only below $100 or when asked. */
export function money(n: number, opts: { sign?: boolean; cents?: boolean } = {}): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const body = (opts.cents ?? abs < 100) ? usd2.format(abs) : usd0.format(Math.round(abs));
  if (n < 0) return `−${body}`;
  return opts.sign && n > 0 ? `+${body}` : body;
}

/** $41.2k · $1.3M · $950 */
export function compactMoney(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}$${dec1.format(abs / 1_000_000)}M`;
  if (abs >= 10_000) return `${sign}$${int0.format(abs / 1_000)}k`;
  if (abs >= 1_000) return `${sign}$${dec1.format(abs / 1_000)}k`;
  return `${sign}$${int0.format(abs)}`;
}

export const int = (n: number): string => (Number.isFinite(n) ? int0.format(Math.round(n)) : '—');

/**
 * Shares in this project are fractions (0.33 = 33%), as in packs ("rates are fractions").
 * A value above 1.5 is taken as already in percent, so 33 and 0.33 both print "33%".
 */
export function toFraction(x: number): number {
  return Math.abs(x) > 1.5 ? x / 100 : x;
}

export function pct(x: number, digits = 0): string {
  if (!Number.isFinite(x)) return '—';
  const v = toFraction(x) * 100;
  return `${digits ? v.toFixed(digits) : Math.round(v)}%`;
}

export function monthsLabel(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  if (n < 1) return 'under 1 month';
  const r = Math.round(n);
  return `${r} month${r === 1 ? '' : 's'}`;
}

/** What one sale is called in each niche, singular and plural. */
export const UNIT_WORDS: Record<string, [string, string]> = {
  cafe: ['order', 'orders'],
  barbershop: ['haircut', 'haircuts'],
  bodega: ['sale', 'sales'],
  guesthouse: ['room-night', 'room-nights'],
  rentals: ['rented apartment', 'rented apartments'],
};

export function unitWord(niche: string, n: number): string {
  const [one, many] = UNIT_WORDS[niche] ?? ['sale', 'sales'];
  return Math.round(n) === 1 ? one : many;
}

export const NICHE_NAMES: Record<string, string> = {
  cafe: 'Coffee shops',
  barbershop: 'Barbershops',
  bodega: 'Corner stores',
  guesthouse: 'Guesthouses',
  rentals: 'Rentals',
};

export const nicheName = (niche: string): string => NICHE_NAMES[niche] ?? niche;
