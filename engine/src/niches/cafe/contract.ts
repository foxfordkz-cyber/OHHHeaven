// Contract between the parts of the cafe model (build/ROUND3.md, wave B). Owner of this file: the lead.
// A part is one file in this folder, written by one executor: segments.ts, service.ts, staffing.ts, regulars.ts.
// Parts are pure: no network, no files, no Date, no Math.random, no writes into the business or the world.
// Numbers come from the pack (packs/cafe.json → extra.*); constants in code are only fallbacks.
import type { BusinessState, DayReport, GameDate, NicheKpi, Pack, Place, PnlLine } from '@ohh/shared';

/** What a part sees on one game day. */
export interface CafeDay {
  b: BusinessState;
  pack: Pack;
  place?: Place;
  date: GameDate;
  day: number;
  /** Orders that want to be served today, after every demand multiplier. Present for capacityDay and qualityDelta. */
  demand?: number;
}

export interface CafePart {
  /** Multiplier on today's demand. 1 changes nothing. Parts multiply. */
  demandMult?(d: CafeDay): number;
  /**
   * Orders this cafe can serve today. A number replaces the engine's staff and seat limits; null leaves them in place.
   * If several parts answer, the smallest wins.
   */
  capacityDay?(d: CafeDay): number | null;
  /** Added to today's quality target (the engine clamps the target to 0–1). Parts add up. */
  qualityDelta?(d: CafeDay): number;
  /** Money lines at the month close: every dollar is a line. */
  extraLines?(b: BusinessState, pack: Pack, month: number): PnlLine[];
  kpis?(b: BusinessState, pack: Pack): NicheKpi[];
  /** Short sentences for the owner's day report: what happened and why. */
  notes?(b: BusinessState, r: DayReport, pack: Pack): string[];
}
