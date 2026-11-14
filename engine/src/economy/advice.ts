// Price advice from the engine's own demand model: for residents (agent 07), the hired manager and the advisor (agent 04).
import type { BusinessState, Pack, WorldState } from '@ohh/shared';
import { RULES } from '@ohh/shared';
import type { EngineCtx } from '../index';
import { marketParams, monthlyDemand, type DemandInput } from './demand';
import { leverEffects } from './effects';
import { hooksFor } from './hooks';
import { econOf, placeOf, round2, staffCount } from './util';

/** What the business can serve in a month as it stands: people, room and the pack's hard cap (or the niche hook). */
export function capacityMonth(b: BusinessState, pack: Pack): number {
  const D = RULES.DAYS_PER_MONTH;
  const hardCap = pack.capacity.hardCapUnits ? pack.capacity.hardCapUnits : Infinity;
  const hookCap = hooksFor(b.niche).capacityDay?.(b, pack);
  if (typeof hookCap === 'number' && Number.isFinite(hookCap)) return Math.min(Math.max(0, hookCap) * D, hardCap);
  const per = pack.capacity.unitsPerStaffMonth;
  const staffCap = per == null ? Infinity : staffCount(b.orders.staff) * per * leverEffects(b, pack).capacityMult;
  const takeaway = Math.min(0.95, Math.max(0, pack.sizing.takeawayShare ?? 0));
  const sizeCap = (b.size * pack.sizing.unitsServedPerSizeMonth) / (1 - takeaway);
  return Math.min(staffCap, sizeCap, hardCap);
}

/**
 * The price that earns this business the most in a month at its rivals' prices of today, with its own staff, room and
 * settings as they are: the engine's demand (the fair-price band included), capped by what the business can serve,
 * times what a unit leaves after goods, per-unit costs and costs that are a share of revenue. Rounded to 25 cents.
 * Pure and cheap (one demand evaluation per 25-cent step). null when the niche has no pack.
 */
export function priceAdvice(b: BusinessState, w: WorldState, ctx: EngineCtx): number | null {
  const pack = ctx.packs.niches[b.niche];
  if (!pack) return null;
  const input = (x: BusinessState, price: number): DemandInput => ({
    id: x.id, price, quality: x.quality, reputation: x.reputation,
    footTraffic: placeOf(ctx, x.placeId)?.footTraffic ?? 0.5, marketing: econOf(x).marketing,
  });
  const rivals = w.businesses
    .filter((x) => x.niche === b.niche && x.id !== b.id && (x.status === 'open' || x.status === 'closed'))
    .map((x) => input(x, x.orders.price));
  const params = marketParams(pack);
  const shareOfRevenue = pack.monthlyCosts.filter((c) => c.basis === 'pct_revenue').reduce((a, c) => a + c.amount, 0);
  const perUnit = pack.unit.cogsPerUnit + pack.monthlyCosts.filter((c) => c.basis === 'per_unit').reduce((a, c) => a + c.amount, 0);
  const cap = capacityMonth(b, pack);
  const demandMult = leverEffects(b, pack).demandMult;
  let best = b.orders.price;
  let bestValue = -Infinity;
  const steps = Math.floor((pack.unit.priceMax - pack.unit.priceMin) / 0.25 + 1e-9);
  for (let i = 0; i <= steps; i++) {
    const p = pack.unit.priceMin + i * 0.25;
    const sold = Math.min(cap, monthlyDemand(params, [input(b, p), ...rivals]).demand[0] * demandMult);
    const value = sold * (p * (1 - shareOfRevenue) - perUnit);
    if (value > bestValue + 1e-6) { bestValue = value; best = p; }
  }
  return round2(best);
}
