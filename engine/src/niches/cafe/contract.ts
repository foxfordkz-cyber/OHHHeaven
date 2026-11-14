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

// ───────────── what parts ask each other ─────────────
// service.ts needs to know who comes (segments.ts) and how fast the team works (staffing.ts). Both answers have a
// plain fallback here, so every part can be written and tested before the others exist.

/** One group of guests on one day. `share` of all groups adds up to 1. */
export interface GuestGroup {
  id: string;            // 'office' | 'residents' | 'tourists' | 'students' | …
  share: number;         // share of today's orders
  sitShare: number;      // share of the group that takes a seat; the rest take away
  morningShare: number;  // share of the group's orders that arrive in the morning rush
}
export interface GuestMix { groups: GuestGroup[] }

/** How fast and how well today's team works. */
export interface StaffPower {
  ordersPerDay: number;      // orders the team can make in the whole day
  rushOrdersPerHour: number; // orders the team can make in one hour of the rush
  qualityDelta: number;      // what the team adds to the quality target
}

const DAYS_PER_MONTH = 30;

/** Fallback until segments.ts answers: one group, the pack's takeaway share, no rush. */
export function defaultGuestMix(pack: Pack): GuestMix {
  const takeaway = Math.min(0.95, Math.max(0, pack.sizing.takeawayShare ?? 0));
  return { groups: [{ id: 'everyone', share: 1, sitShare: 1 - takeaway, morningShare: 0 }] };
}

/** Fallback until staffing.ts answers: every worker is the same, as the engine counts today. */
export function defaultStaffPower(b: BusinessState, pack: Pack): StaffPower {
  const heads = Object.values(b.orders.staff).reduce((a, n) => a + Math.max(0, n), 0);
  const perStaff = pack.capacity.unitsPerStaffMonth;
  const ordersPerDay = perStaff == null ? Infinity : (heads * perStaff) / DAYS_PER_MONTH;
  return { ordersPerDay, rushOrdersPerHour: Infinity, qualityDelta: 0 };
}
