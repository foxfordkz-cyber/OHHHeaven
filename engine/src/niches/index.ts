// Registry of niche hooks (owner: agent 01). Niche files engine/src/niches/<id>.ts are written by agents 14–16;
// agent 01 adds one import line here when a niche branch is merged.
import type { BusinessState, DayReport, GameDate, NicheId, NicheKpi, Pack, Place, PnlLine } from '@ohh/shared';

/** The day a hook is asked about: where the business stands, which day it is, how many orders want to be served. */
export interface NicheEnv { place?: Place; day: number; date: GameDate; demand?: number }

export interface NicheHooks {
  demandMult?(b: BusinessState, date: GameDate, pack: Pack, env?: NicheEnv): number;
  capacityDay?(b: BusinessState, pack: Pack, env?: NicheEnv): number | null;
  /** Added to the day's quality target, which the economy clamps to 0–1. */
  qualityDelta?(b: BusinessState, pack: Pack, env: NicheEnv): number;
  extraLines?(b: BusinessState, pack: Pack, month: number): PnlLine[];
  kpis?(b: BusinessState, pack: Pack): NicheKpi[];
  notes?(b: BusinessState, r: DayReport, pack: Pack): string[];
}

import { hooks as cafe } from './cafe';
import { hooks as barbershop } from './barbershop';

export const NICHE_HOOKS: Partial<Record<NicheId, NicheHooks>> = {
  cafe,
  barbershop,
};

/** Same registry under the name agent 02's economy imports. */
export const nicheHooks = NICHE_HOOKS;

const NO_HOOKS: NicheHooks = {};

/** Hooks for a niche; an empty object when the niche has none yet. */
export function hooksFor(niche: NicheId): NicheHooks {
  return NICHE_HOOKS[niche] ?? NO_HOOKS;
}
