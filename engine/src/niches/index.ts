// Registry of niche hooks (owner: agent 01). Niche files engine/src/niches/<id>.ts are written by agents 14–16;
// agent 01 adds one import line here when a niche branch is merged.
import type { BusinessState, DayReport, GameDate, NicheId, NicheKpi, Pack, PnlLine } from '@ohh/shared';

export interface NicheHooks {
  demandMult?(b: BusinessState, date: GameDate, pack: Pack): number;
  capacityDay?(b: BusinessState, pack: Pack): number | null;
  extraLines?(b: BusinessState, pack: Pack, month: number): PnlLine[];
  kpis?(b: BusinessState, pack: Pack): NicheKpi[];
  notes?(b: BusinessState, r: DayReport, pack: Pack): string[];
}

// import { hooks as cafe } from './cafe';
// import { hooks as barbershop } from './barbershop';

export const NICHE_HOOKS: Partial<Record<NicheId, NicheHooks>> = {
  // cafe,
  // barbershop,
};

const NO_HOOKS: NicheHooks = {};

/** Hooks for a niche; an empty object when the niche has none yet. */
export function hooksFor(niche: NicheId): NicheHooks {
  return NICHE_HOOKS[niche] ?? NO_HOOKS;
}
