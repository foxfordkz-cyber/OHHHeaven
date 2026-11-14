import type { BusinessState, EffectTarget, GameEvent, NicheId, Pack, Place, WorldState } from '@ohh/shared';
import { clamp } from './util';

export const DEFAULT_WEEKDAY_MULT = [1, 1, 1, 1, 1, 1.15, 0.9]; // Mon..Sun (shared/src/rules.ts: day 1 is a Monday)

/**
 * Day-of-week multiplier: pack.extra.weekdayMult (7 numbers, Mon..Sun) if the pack sets it; otherwise the default
 * profile, unless the niche hook shapes demand itself (hookOwnsDemand): then 1, so the week is not counted twice.
 */
export function weekdayMult(pack: Pack, weekday: number, hookOwnsDemand = false): number {
  const raw = (pack.extra as Record<string, unknown> | undefined)?.weekdayMult;
  const set = Array.isArray(raw) && raw.length === 7 && raw.every((x) => typeof x === 'number');
  if (!set && hookOwnsDemand) return 1;
  const arr = set ? (raw as number[]) : DEFAULT_WEEKDAY_MULT;
  return arr[((weekday % 7) + 7) % 7];
}

export function activeEvents(w: WorldState, day: number): GameEvent[] {
  return w.events.filter((e) => e.startDay <= day && day <= e.endDay);
}

export const clipMult = (m: number): number => clamp(Number.isFinite(m) ? m : 1, 0.5, 1.5);

/** Product of all event effects on one target for one business; each effect and the product are clipped to 0.5–1.5. */
export function eventMult(events: readonly GameEvent[], target: EffectTarget, niche: NicheId, place: Place | undefined): number {
  let m = 1;
  for (const ev of events) {
    if (ev.block && place && ev.block !== place.block) continue;
    for (const ef of ev.effects) {
      if (ef.target !== target) continue;
      if (ef.niches && ef.niches.length > 0 && !ef.niches.includes(niche)) continue;
      if (ef.tiers && ef.tiers.length > 0 && (!place || !ef.tiers.includes(place.tier))) continue;
      m *= clipMult(ef.mult);
    }
  }
  return clipMult(m);
}

export interface LeverEffects { quality: number; reputation: number; demandMult: number; capacityMult: number; monthlyCost: number }

/**
 * Effects of the chosen settings, counted from the default options: an honest business with default settings is the
 * baseline the pack's numbers describe (unitsPerSlotMonth, quality 0.5). Monthly cost is the real cost of what is chosen.
 */
export function leverEffects(b: BusinessState, pack: Pack): LeverEffects {
  let quality = 0, reputation = 0, demand = 0, capacity = 0, monthlyCost = 0;
  let q0 = 0, r0 = 0, d0 = 0, c0 = 0;
  for (const lever of pack.levers) {
    const def = defaultLeverOption(lever.options);
    const opt = lever.options.find((o) => o.id === b.orders.levers[lever.id]) ?? def;
    if (def) { q0 += def.effects?.quality ?? 0; r0 += def.effects?.reputation ?? 0; d0 += def.effects?.demand ?? 0; c0 += def.effects?.capacity ?? 0; }
    if (!opt) continue;
    monthlyCost += opt.monthlyCost;
    quality += opt.effects?.quality ?? 0;
    reputation += opt.effects?.reputation ?? 0;
    demand += opt.effects?.demand ?? 0;
    capacity += opt.effects?.capacity ?? 0;
  }
  return {
    quality: quality - q0, reputation: reputation - r0,
    demandMult: Math.max(0.1, 1 + demand) / Math.max(0.1, 1 + d0), capacityMult: Math.max(0.1, 1 + capacity) / Math.max(0.1, 1 + c0),
    monthlyCost,
  };
}

export function defaultLeverOption<T extends { causes?: string }>(options: readonly T[]): T | undefined {
  return options.find((o) => !o.causes) ?? options[0];
}

function bonusOf(items: readonly { id: string; qty: number }[], pack: Pack): number {
  let q = 0;
  for (const it of items) {
    if (it.qty <= 0) continue;
    q += pack.setup.find((s) => s.id === it.id)?.qualityBonus ?? 0;
  }
  return q;
}

const standardBonus = new WeakMap<Pack, number>();
/** Quality bonus of the pack's standard kit (or its middle kit): that kit is average quality, 0.5. */
export function standardKitBonus(pack: Pack): number {
  let v = standardBonus.get(pack);
  if (v === undefined) {
    const kit = pack.kits.find((k) => k.id === 'standard') ?? pack.kits[Math.floor(pack.kits.length / 2)];
    v = kit ? bonusOf(kit.items, pack) : 0;
    standardBonus.set(pack, v);
  }
  return v;
}

/** Quality from what a business owns, counted from the standard kit (lean kits score below 0, premium above). */
export function itemsQuality(b: BusinessState, pack: Pack): number {
  return bonusOf(b.items, pack) - standardKitBonus(pack);
}

/** Training stock → quality bonus, saturating; 1 500 $ per worker gives half of the maximum. */
export function trainingBoost(training: number, staff: number): number {
  const k = 1500 * Math.max(1, staff);
  return (0.15 * Math.max(0, training)) / (Math.max(0, training) + k);
}

export const MARKETING_DECAY_DAY = 0.95;   // half-life about two weeks
export const TRAINING_DECAY_DAY = 0.99;    // skills fade slowly
