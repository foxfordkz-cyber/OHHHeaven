// Will the savings last until the shop pays for itself? The napkin sum a careful owner does before signing a lease,
// from public data only: the map (people walking by, real rivals, rent), the pack (costs, wages, the ramp of the
// regular crowd) and the opening plan the analytics screen recommends. No engine internals, no randomness.
//
//   cash on the day the lease is signed  = start capital − the setup bill            (rec.total)
//   − rent while the room is built and permits wait                                  (rec.daysToOpen days)
//   − the losses of the first months, while the regulars are still finding the shop (awareness ramp)
//   = the lowest the bank account gets. A careful owner wants it to stay above one month of fixed costs.
import type { NicheId, OpenRecommendation, Pack, Place } from '../../shared/src/types';
import { RULES } from '../../shared/src/rules';
import { awarenessAt, footfallParams, isTakeover, rentMonthOf, rivalsOf, takeoverRules } from '../../shared/src/place';
import type { EngineCtx } from './__stubs__/engine';

export interface Runway {
  /** rent paid before the doors open */
  waitRent: number;
  /** fixed costs of an open month: rent, wages with payroll taxes, the pack's fixed lines, chosen levers */
  fixedMonth: number;
  /** orders a day once the regular crowd is complete (people walking by × share, capped by the team and the room) */
  matureOrdersDay: number;
  /** profit of a month once the regulars know the shop, after profit taxes */
  matureProfitMonth: number;
  /** cash lost between the opening day and the day the shop starts to earn */
  rampLoss: number;
  /** the lowest the bank account gets in the first year */
  lowestCash: number;
  /** day after opening when a day's takings first cover the day's costs; null — never within a year */
  breakEvenDay: number | null;
}

const taxRate = (ctx: EngineCtx, base: string): number => ctx.packs.common.taxes.filter((t) => t.base === base).reduce((s, t) => s + (t.rate ?? 0), 0);

/**
 * The cash curve of a newcomer who follows `rec` at `place`, counting the playing shops within the pack's radius
 * (`rivalsNearby`, each an average known shop). Day by day over a year; deterministic.
 */
export function runwayOf(ctx: EngineCtx, niche: NicheId, place: Place, rec: OpenRecommendation, rivalsNearby = 0): Runway | null {
  const pack: Pack | undefined = ctx.packs.niches[niche];
  const f = pack ? footfallParams(pack) : null;
  if (!pack || !f || !place.pedestriansPerDay) return null;
  const D = RULES.DAYS_PER_MONTH;
  const rent = rentMonthOf(place);
  const waitRent = (rent * rec.daysToOpen) / D;
  const price = rec.orders.price;
  const staff = Object.entries(rec.orders.staff);
  const heads = staff.reduce((s, [, n]) => s + n, 0);
  const wages = staff.reduce((s, [id, n]) => { const r = pack.staff.find((x) => x.id === id) ?? pack.staff[0]; return s + n * (r.tipped && r.cashWage != null ? r.cashWage : r.hourlyWage) * r.hoursPerMonth; }, 0);
  const levers = pack.levers.reduce((s, lv) => s + (lv.options.find((o) => o.id === rec.orders.levers[lv.id])?.monthlyCost ?? 0), 0);
  let fixed = rent + wages * (1 + taxRate(ctx, 'payroll')) + levers + pack.sizing.cleaningCostPerSizeMonth * rec.size;
  let perOrder = pack.unit.cogsPerUnit, pctRevenue = 0;
  for (const c of pack.monthlyCosts) {
    if (c.kind === 'rent') continue;
    if (c.basis === 'fixed') fixed += c.amount;
    else if (c.basis === 'per_staff') fixed += c.amount * heads;
    else if (c.basis === 'per_unit') perOrder += c.amount;
    else if (c.basis === 'pct_revenue') pctRevenue += c.amount;
    else fixed += c.amount * rec.size;
  }
  const margin = price * (1 - pctRevenue) - perOrder;
  // the footfall model of the engine for one average shop: utility −e·ln(price/ref), real rivals at staticWeight, playing rivals at 1
  const strength = Math.exp(-f.priceSensitivity * Math.log(Math.max(0.01, price) / pack.unit.refPrice));
  const rivals = (rivalsOf(place, niche)?.weight ?? 0) * f.staticWeight + rivalsNearby;
  const demandDay = place.pedestriansPerDay * f.captureRate * (1 + f.outside) * (strength / (strength + rivals + f.outside));
  const staffCap = pack.capacity.unitsPerStaffMonth ? (heads * pack.capacity.unitsPerStaffMonth) / D : Infinity;
  const roomCap = (rec.size * pack.sizing.unitsServedPerSizeMonth) / (1 - (pack.sizing.takeawayShare ?? 0)) / D;
  const cap = Math.min(staffCap, roomCap);
  const a0 = isTakeover(pack, place) ? takeoverRules(pack)?.awareness ?? f.awarenessStart : f.awarenessStart;
  // profit taxes (self-employment and income tax) take their share of a good day; a losing day pays none
  const keep = 1 - taxRate(ctx, 'profit');
  // from the bill, not from rec.cashLeft: the cash left must not count the rent of the wait twice if the plan starts to include it
  let cash = pack.startCapital - rec.total - waitRent, lowest = cash, loss = 0, breakEven: number | null = null;
  for (let t = 0; t < RULES.DAYS_PER_MONTH * 12 - rec.daysToOpen; t++) {
    const day = Math.min(cap, demandDay * awarenessAt(t, a0, f.rampDays)) * margin - fixed / D;
    if (day < 0) loss -= day; else if (breakEven == null) breakEven = t;
    cash += day < 0 ? day : day * keep;
    lowest = Math.min(lowest, cash);
  }
  const mature = Math.min(cap, demandDay) * margin * D - fixed;
  return { waitRent, fixedMonth: fixed, matureOrdersDay: Math.min(cap, demandDay), matureProfitMonth: mature > 0 ? mature * keep : mature, rampLoss: loss, lowestCash: lowest, breakEvenDay: breakEven };
}

/** A careful owner signs only if the account never drops below one month of fixed costs on the way to break-even. */
export const lastsThroughRamp = (r: Runway | null): boolean => !r || r.lowestCash >= r.fixedMonth;
