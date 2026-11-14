import type { BusinessState, EffectTarget, GameEvent, NicheId, Pack, Place, WorldState } from '../../../shared/src/types';
import { clamp } from './util';

export const DEFAULT_WEEKDAY_MULT = [1, 1, 1, 1, 1, 1.15, 0.9]; // Mon..Sun (shared/src/rules.ts: day 1 is a Monday)

export function weekdayMult(pack: Pack, weekday: number): number {
  const raw = (pack.extra as Record<string, unknown> | undefined)?.weekdayMult;
  const arr = Array.isArray(raw) && raw.length === 7 && raw.every((x) => typeof x === 'number') ? (raw as number[]) : DEFAULT_WEEKDAY_MULT;
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

export function leverEffects(b: BusinessState, pack: Pack): LeverEffects {
  let quality = 0, reputation = 0, demand = 0, capacity = 0, monthlyCost = 0;
  for (const lever of pack.levers) {
    const opt = lever.options.find((o) => o.id === b.orders.levers[lever.id]) ?? defaultLeverOption(lever.options);
    if (!opt) continue;
    monthlyCost += opt.monthlyCost;
    quality += opt.effects?.quality ?? 0;
    reputation += opt.effects?.reputation ?? 0;
    demand += opt.effects?.demand ?? 0;
    capacity += opt.effects?.capacity ?? 0;
  }
  return { quality, reputation, demandMult: Math.max(0.1, 1 + demand), capacityMult: Math.max(0.1, 1 + capacity), monthlyCost };
}

export function defaultLeverOption<T extends { causes?: string }>(options: readonly T[]): T | undefined {
  return options.find((o) => !o.causes) ?? options[0];
}

/** Base quality of a business from what it owns and how it is run (before crowding and training). */
export function itemsQuality(b: BusinessState, pack: Pack): number {
  let q = 0;
  for (const it of b.items) {
    if (it.qty <= 0) continue;
    q += pack.setup.find((s) => s.id === it.id)?.qualityBonus ?? 0;
  }
  return q;
}

/** Training stock → quality bonus, saturating; 1 500 $ per worker gives half of the maximum. */
export function trainingBoost(training: number, staff: number): number {
  const k = 1500 * Math.max(1, staff);
  return (0.15 * Math.max(0, training)) / (Math.max(0, training) + k);
}

export const MARKETING_DECAY_DAY = 0.95;   // half-life about two weeks
export const TRAINING_DECAY_DAY = 0.99;    // skills fade slowly
