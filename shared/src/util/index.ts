// Small deterministic helpers shared by every package. No Date, no Math.random.

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Rounds to cents; stable for values like 1.005. */
export const round2 = (x: number): number => Math.round((x + Math.sign(x) * Number.EPSILON) * 100) / 100;

export function sum(xs: readonly number[]): number;
export function sum<T>(xs: readonly T[], f: (x: T) => number): number;
export function sum<T>(xs: readonly T[], f?: (x: T) => number): number {
  let s = 0;
  for (const x of xs) s += f ? f(x) : (x as unknown as number);
  return s;
}

const USD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, minimumFractionDigits: 0 });
const USD2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 2 });

/** "$1,234" (cents: false, default) or "$1,234.50" (cents: true). Negative numbers get a minus sign: "-$80". */
export function formatMoney(x: number, opts: { cents?: boolean } = {}): string {
  if (!Number.isFinite(x)) return '—';
  const v = opts.cents ? round2(x) : Math.round(x);
  return (opts.cents ? USD2 : USD0).format(v === 0 ? 0 : v);
}

/** Seeded PRNG (mulberry32). Same seed → same sequence in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic id from a seed and a counter: uid(7, 1) is always the same 8-char base36 string. */
export function uid(seed: number, n: number): string {
  let h = (Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul((n >>> 0) + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  const a = h.toString(36).padStart(7, '0');
  const b = ((n >>> 0) % 36).toString(36);
  return (a + b).slice(-8);
}
