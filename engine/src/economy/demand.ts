// Share-of-market model from research/reports/43-economy-sim.md (section 1), generalised to any niche pack.
// One segment, logit with an outside option ("buy elsewhere"). Weights come from pack.market.weights,
// location from place.footTraffic. The step is a month here; the day step divides by 30 and applies daily multipliers.
import type { Pack, Place } from '@ohh/shared';
import { distanceM, overlap, rivalsOf, type FootfallParams } from '@ohh/shared';

export interface DemandInput {
  id: string;
  price: number;
  quality: number;      // 0–1, 0.5 is average
  reputation: number;   // 0–1, 0.5 is average
  footTraffic: number;  // 0–1 from the place, 0.5 is average
  marketing: number;    // decaying stock of ad spend, $
}

export interface MarketParams {
  refPrice: number;
  elasticity: number;          // negative
  weights: { price: number; quality: number; reputation: number; location: number };
  unitsPerSlotMonth: number;
  outside: number;             // weight of "buy elsewhere" per business at the reference point
  adsHalf: number;             // ad stock that gives ln(2) × ADS_W of utility
  fairBand: number;            // price up to fair × fairBand costs only the ordinary elasticity
  overprice: number;           // steepness of the extra loss above that band (utility −overprice × ln(p / band)²)
}

/** Report 43: utility += 0.22 · ln(1 + ads / half). */
export const ADS_W = 0.22;
export const OUTSIDE_DEFAULT = 1;
export const FAIR_BAND_DEFAULT = 1.1;
export const OVERPRICE_DEFAULT = 25;

/** What customers think a fair price is for this quality: the reference price, ±30% between the worst and the best quality. */
export function fairPrice(refPrice: number, quality: number): number {
  return refPrice * (1 + 0.6 * (quality - 0.5));
}

export function marketParams(pack: Pack): MarketParams {
  const extra = (pack.extra ?? {}) as Record<string, unknown>;
  const num = (k: string, d: number): number => (typeof extra[k] === 'number' && Number.isFinite(extra[k] as number) ? (extra[k] as number) : d);
  const outside = num('outsideWeight', OUTSIDE_DEFAULT);
  return {
    refPrice: pack.unit.refPrice,
    elasticity: pack.market.priceElasticity,
    weights: pack.market.weights,
    unitsPerSlotMonth: pack.market.unitsPerSlotMonth,
    outside,
    adsHalf: Math.max(1, 0.05 * pack.market.unitsPerSlotMonth * pack.unit.refPrice),
    fairBand: Math.max(1, num('fairPriceBand', FAIR_BAND_DEFAULT)),
    overprice: Math.max(0, num('overpriceSteepness', OVERPRICE_DEFAULT)),
  };
}

/**
 * Price sensitivity that makes a business's own-price elasticity at the reference point equal to
 * pack.market.priceElasticity: in a logit with an outside option, ε_own = −e · (1 − s), s = 1 / (N · (1 + o)).
 */
export function priceSensitivity(m: MarketParams, n: number): number {
  const s = 1 / (Math.max(1, n) * (1 + m.outside));
  return Math.abs(m.elasticity) / (1 - s);
}

/**
 * Attractiveness of each business: exp(utility). Non-price terms are scaled by |elasticity| and the weight ratios.
 * Above fair price × fairBand customers leave fast (they know what a cup costs on this street): the extra term keeps
 * the contract's elasticity at the reference price and makes a price far above fair a losing move, alone or together.
 */
export function attractiveness(m: MarketParams, xs: readonly DemandInput[]): number[] {
  const e = priceSensitivity(m, xs.length);
  const k = Math.abs(m.elasticity);
  const wp = Math.max(0.05, m.weights.price);
  const kq = k * (m.weights.quality / wp);
  const kr = k * (m.weights.reputation / wp);
  const kl = k * (m.weights.location / wp);
  return xs.map((x) => {
    const p = Math.max(0.01, x.price);
    const over = Math.max(0, Math.log(p / (fairPrice(m.refPrice, x.quality) * m.fairBand)));
    const u =
      -e * Math.log(p / m.refPrice) -
      m.overprice * over * over +
      kq * (x.quality - 0.5) +
      kr * (x.reputation - 0.5) +
      kl * (x.footTraffic - 0.5) +
      ADS_W * Math.log(1 + Math.max(0, x.marketing) / m.adsHalf);
    return Math.exp(u);
  });
}

/**
 * Monthly demand of every business in one niche. Each storefront brings passers-by in proportion to its foot traffic;
 * the pool is split by attractiveness, and the outside option takes the rest. Identical businesses at the reference
 * point each get exactly unitsPerSlotMonth.
 */
export function monthlyDemand(m: MarketParams, xs: readonly DemandInput[]): { demand: number[]; pull: number[] } {
  if (xs.length === 0) return { demand: [], pull: [] };
  const pull = attractiveness(m, xs);
  const pool = xs.reduce((a, x) => a + m.unitsPerSlotMonth * (1 + m.outside) * (0.5 + x.footTraffic), 0);
  const denom = xs.length * m.outside + pull.reduce((a, b) => a + b, 0);
  return { demand: pull.map((a) => (pool * a) / denom), pull };
}

// ───────────────────────── demand from the people who walk past ─────────────────────────

export interface FootfallInput extends DemandInput { place: Place; awareness: number }   // awareness 0–1: share of the regular crowd

const distCache = new WeakMap<Place, Map<string, number>>();
function distBetween(a: Place, b: Place): number {
  let m = distCache.get(a);
  if (!m) { m = new Map(); distCache.set(a, m); }
  let d = m.get(b.id);
  if (d === undefined) { d = distanceM(a, b); m.set(b.id, d); }
  return d;
}

/**
 * Monthly demand when the pack and every competing place carry footfall data (pack.extra.footfall,
 * place.pedestriansPerDay). People walking the block × the share who buy at an average, known shop; shops closer
 * than radiusM, real coffee shops around (place.rivals) and "not here" split them. A shop alone on its block at the
 * reference price gets pedestrians × captureRate a day.
 */
export function footfallDemand(pack: Pack, f: FootfallParams, m: MarketParams, xs: readonly FootfallInput[]): { demand: number[]; pull: number[] } {
  const k = Math.abs(m.elasticity);
  const wp = Math.max(0.05, m.weights.price);
  const kq = k * (m.weights.quality / wp), kr = k * (m.weights.reputation / wp);
  const strength = xs.map((x) => Math.exp(
    -f.priceSensitivity * Math.log(Math.max(0.01, x.price) / m.refPrice)
    + kq * (x.quality - 0.5) + kr * (x.reputation - 0.5)
    + ADS_W * Math.log(1 + Math.max(0, x.marketing) / m.adsHalf)));
  const demand = xs.map((x, i) => {
    let rivals = (rivalsOf(x.place, pack.id)?.weight ?? 0) * f.staticWeight;
    for (let j = 0; j < xs.length; j++) {
      if (j === i) continue;
      const o = overlap(distBetween(x.place, xs[j].place), f.radiusM);
      if (o > 0) rivals += o * strength[j] * xs[j].awareness;
    }
    const share = strength[i] / (strength[i] + rivals + f.outside);
    return (x.place.pedestriansPerDay ?? 0) * 30 * f.captureRate * (1 + f.outside) * share * x.awareness;
  });
  return { demand, pull: strength.map((a, i) => a * xs[i].awareness) };
}
