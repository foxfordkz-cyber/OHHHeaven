// The plan of this player: the part of the real-world plan built from their own place, kit, team and season.
// The engine sends it as `plan.extra.personal` (engine/src/analytics/plan.ts, PersonalPlan): RealWorldPlan in
// shared/src/types.ts has no field for it yet, so the shape is repeated here and checked before use. A plan
// without it (an older shared link) still renders the general parts.
import type { RealWorldPlan } from '@ohh/shared/types';

export interface PlanPlace {
  address: string; block: string; sqft: number; tier: string;
  rentMonth: number; deposit: number | null; depositMonths: number | null;
  formerUse: string | null;
  buildout: { label: string; perSqft: number; days: number; cost: number } | null;
  takeoverPrice: number | null;
  pedestriansPerDay: number | null;
  rivals: { real150m: number; players: number; radiusM: number; nearest: { name: string; distM: number } | null };
}
export interface PlanMoneyPart { id: string; label: string; amount: number }
export interface PlanSummary {
  cashBeforeFirstSale: number; parts: PlanMoneyPart[];
  daysToOpen: number; weeksToOpen: number; opened: boolean;
  reserve: number; reserveMonths: number; totalNeeded: number;
  realLife: { rentMonths: number; amount: number; note: string; source?: string } | null;
}
export interface PlanRisk { id: string; title: string; amount: number | null; why: string; fix: string }
export interface PlanStepMine { status: 'todo' | 'waiting' | 'done'; readyDay?: number; mine?: string }
export interface PersonalPlan {
  place: PlanPlace | null;
  size: number; sizeUnit: string; price: number; refPrice: number; unitName: string;
  staff: { roleId: string; name: string; count: number; hourlyWage: number; hoursPerMonth: number; monthly: number }[];
  payrollMonth: number; payrollTaxMonth: number;
  equipment: { id: string; name: string; kind: string; qty: number; unit: number; total: number }[]; equipmentTotal: number;
  firstOrder: { name: string; amount: number; sourcing: string | null } | null;
  summary: PlanSummary;
  risks: PlanRisk[];
  supplierWhy: Record<string, string>; supplierOrder: string[];
  steps: Record<string, PlanStepMine>;
}

/** The personal part of a plan, or null when the plan carries none (or something else under that name). */
export function personalOf(plan: RealWorldPlan): PersonalPlan | null {
  const p = (plan as RealWorldPlan & { extra?: { personal?: unknown } }).extra?.personal as Partial<PersonalPlan> | undefined;
  if (!p || typeof p !== 'object') return null;
  const s = p.summary;
  if (!s || typeof s.cashBeforeFirstSale !== 'number' || !Array.isArray(s.parts) || !Array.isArray(p.risks) || !p.steps || typeof p.steps !== 'object') return null;
  return {
    place: p.place ?? null, size: p.size ?? 0, sizeUnit: p.sizeUnit ?? 'seat', price: p.price ?? 0, refPrice: p.refPrice ?? 0, unitName: p.unitName ?? 'order',
    staff: Array.isArray(p.staff) ? p.staff : [], payrollMonth: p.payrollMonth ?? 0, payrollTaxMonth: p.payrollTaxMonth ?? 0,
    equipment: Array.isArray(p.equipment) ? p.equipment : [], equipmentTotal: p.equipmentTotal ?? 0,
    firstOrder: p.firstOrder ?? null, summary: s, risks: p.risks,
    supplierWhy: p.supplierWhy ?? {}, supplierOrder: Array.isArray(p.supplierOrder) ? p.supplierOrder : [],
    steps: p.steps,
  };
}

// ───────────────────────── the savings check: the decision on this page ─────────────────────────

export const RESERVE_CHOICES = [3, 6, 9] as const;
export type ReserveMonths = (typeof RESERVE_CHOICES)[number];

export interface Readiness {
  monthly: number;           // fixed costs of one month (the reserve the engine advises is six of them)
  reserve: number;           // reserve for the chosen number of months
  needed: number;            // money before the first sale + reserve
  gap: number;               // savings − needed: below zero — short by that much
  carries: number | null;    // months the savings carry the shop after opening, if every month sold nothing
  verdict: 'short' | 'thin' | 'ready';
}

/**
 * What the person's own savings mean for this plan. `reserveMonths` is their choice; the monthly figure comes from the
 * engine's reserve (six months of honest fixed costs). Pure: the page shows it the moment either number changes.
 */
export function readiness(summary: Pick<PlanSummary, 'cashBeforeFirstSale' | 'reserve' | 'reserveMonths'>, savings: number, reserveMonths: number): Readiness {
  const monthly = summary.reserveMonths > 0 ? summary.reserve / summary.reserveMonths : 0;
  const reserve = Math.round(monthly * reserveMonths);
  const needed = Math.round(summary.cashBeforeFirstSale + reserve);
  const gap = Math.round(savings - needed);
  const left = savings - summary.cashBeforeFirstSale;
  const carries = monthly > 0 ? Math.max(0, Math.floor((left / monthly) * 10) / 10) : null;
  const verdict = left < 0 || (carries !== null && carries < 3) ? 'short' : gap < 0 ? 'thin' : 'ready';
  return { monthly: Math.round(monthly), reserve, needed, gap, carries, verdict };
}

/** "$120,000", "120k", "120,000.50" → 120000; anything else → null. */
export function parseMoney(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/[$,\s]/g, '');
  const m = /^(\d+(?:\.\d+)?)(k|m)?$/.exec(t);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] === 'k' ? 1_000 : m[2] === 'm' ? 1_000_000 : 1);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// ───────────────────────── real-life progress: the reason to come back ─────────────────────────

const KEY = 'fy-plan-progress';

/** A plan's key on this device: one list of ticked steps per business and address. */
export const progressKey = (plan: Pick<RealWorldPlan, 'businessName'>, me: PersonalPlan | null): string => `${plan.businessName}|${me?.place?.address ?? ''}`;

interface Stored { done: string[]; savings?: number; reserveMonths?: number }

export function loadProgress(key: string): Stored {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Stored>;
    const s = all[key];
    return s && Array.isArray(s.done) ? s : { done: [] };
  } catch {
    return { done: [] };
  }
}

export function saveProgress(key: string, s: Stored): void {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Stored>;
    all[key] = s;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* private mode or blocked storage: progress lasts for this page only */ }
}

/** The first step not yet done in real life, in plan order. */
export function nextStep<T extends { id: string }>(steps: T[], done: ReadonlySet<string>): T | null {
  return steps.find((s) => !done.has(s.id)) ?? null;
}

/** Money and days of the steps still ahead (fees that are known; the longest wait among them). */
export function aheadOf(steps: { id: string; fee?: number; waitDays?: number }[], done: ReadonlySet<string>): { fees: number; longestWait: number; count: number } {
  const left = steps.filter((s) => !done.has(s.id));
  return {
    fees: left.reduce((x, s) => x + (s.fee ?? 0), 0),
    longestWait: left.reduce((x, s) => Math.max(x, s.waitDays ?? 0), 0),
    count: left.length,
  };
}
