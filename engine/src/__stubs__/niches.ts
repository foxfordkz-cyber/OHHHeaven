// Stub of engine/src/niches/index.ts (agent 01 builds the real registry; agents 14 and 15 write the hooks).
// Same shape as build/CONTRACT.md, section 3. Replace the import in engine/src/economy/hooks.ts when the real file lands.
import type { BusinessState, DayReport, GameDate, NicheId, NicheKpi, Pack, PnlLine } from '../../../shared/src/types';

export interface NicheHooks {
  demandMult?(b: BusinessState, date: GameDate, pack: Pack): number;
  capacityDay?(b: BusinessState, pack: Pack): number | null;
  extraLines?(b: BusinessState, pack: Pack, month: number): PnlLine[];
  kpis?(b: BusinessState, pack: Pack): NicheKpi[];
  notes?(b: BusinessState, r: DayReport, pack: Pack): string[];
}

export const nicheHooks: Partial<Record<NicheId, NicheHooks>> = {};
