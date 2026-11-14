// Barbershop niche hooks (agent 15). Pure functions: no network, files, Date or Math.random.
// Numbers come from packs/barbershop.json (`extra.weekdayDemand`, `extra.staffLoyalty`, `extra.payModels`,
// `extra.retail`, `extra.apprentice`, `extra.frontDesk`); the constants below are only fallbacks.
import type { BusinessState, DayReport, GameDate, NicheKpi, Pack, PnlLine } from '@ohh/shared';
import { RULES, dateOf } from '@ohh/shared';
import type { NicheHooks } from './index';

const DAYS = RULES.DAYS_PER_MONTH;
const FALLBACK_WEEKDAY = [0.6, 0.85, 0.95, 1.1, 1.4, 1.4, 0.7]; // Mon..Sun
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
/** A drop in monthly capacity smaller than this is not treated as a barber leaving. */
const DEPARTURE_THRESHOLD = 0.07;

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const extra = (pack: Pack, key: string): Record<string, unknown> => obj(obj(pack.extra)[key]);
const cents = (v: number): number => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

interface Settings {
  weekday: number[];
  followShare: number;
  returningShare: number;
  barberShare: number;
  payrollTaxRate: number;
  retailPerCut: number;
  retailCogsShare: number;
  apprenticeProductivity: number;
  frontDeskBoost: number;
}

export function settings(pack: Pack): Settings {
  const raw = extra(pack, 'weekdayDemand').mult;
  const list = Array.isArray(raw) && raw.length === 7 && raw.every((x) => typeof x === 'number' && x >= 0) ? (raw as number[]) : FALLBACK_WEEKDAY;
  const sum = list.reduce((a, x) => a + x, 0);
  // Normalized so that a week of demand equals seven average days.
  const weekday = sum > 0 ? list.map((x) => (x * 7) / sum) : FALLBACK_WEEKDAY;
  const loyalty = extra(pack, 'staffLoyalty');
  const pay = extra(pack, 'payModels');
  const retail = extra(pack, 'retail');
  return {
    weekday,
    followShare: clamp(num(loyalty.followShare, 0.32), 0, 1),
    returningShare: clamp(num(loyalty.returningClientShare, 0.4463), 0, 1),
    barberShare: clamp(num(obj(pay.commission).barberShare, 0.5), 0, 1),
    payrollTaxRate: clamp(num(pay.employerPayrollTaxRate, 0.1), 0, 1),
    retailPerCut: Math.max(0, num(retail.revenuePerHaircut, 2.5)),
    retailCogsShare: clamp(num(retail.cogsShare, 0.5), 0, 1),
    apprenticeProductivity: clamp(num(extra(pack, 'apprentice').productivity, 0.6), 0, 1),
    frontDeskBoost: clamp(num(extra(pack, 'frontDesk').capacityBoost, 0.05), 0, 1),
  };
}

const count = (b: BusinessState, role: string): number => Math.max(0, Math.floor(num(b.orders.staff[role], 0)));

/** People who cut hair. The front desk does not. */
export function cutters(b: BusinessState, pack: Pack): { heads: number; effective: number } {
  const s = settings(pack);
  const barbers = count(b, 'barber');
  const apprentices = count(b, 'apprentice');
  return { heads: barbers + apprentices, effective: barbers + apprentices * s.apprenticeProductivity };
}

/** Haircuts per day the barbers could do with enough chairs, and the chairs with enough barbers. */
export function capacityParts(b: BusinessState, pack: Pack): { staff: number; size: number } {
  const s = settings(pack);
  const perBarberDay = num(pack.capacity.unitsPerStaffMonth, 0) / DAYS;
  const perChairDay = num(pack.sizing.unitsServedPerSizeMonth, 0) / DAYS;
  const desk = count(b, 'front_desk') > 0 ? 1 + s.frontDeskBoost : 1;
  return { staff: cutters(b, pack).effective * perBarberDay * desk, size: Math.max(0, b.size) * perChairDay };
}

/** Haircuts per day: a chair without a barber earns nothing, a barber without a chair cuts nothing. */
export function capacityDay(b: BusinessState, pack: Pack): number {
  const c = capacityParts(b, pack);
  return Math.min(c.staff, c.size);
}

export function weekdayMult(weekday: number, pack: Pack): number {
  const i = ((Math.floor(weekday) % 7) + 7) % 7;
  return settings(pack).weekday[i];
}

/**
 * Share of monthly capacity lost because barbers left since the last closed month, 0..1.
 * BusinessState keeps no staff history, so the previous headcount is read from last month's capacityUnits.
 * Fewer chairs with the same barbers is not a departure.
 */
export function lostBarberShare(b: BusinessState, pack: Pack): number {
  const last = b.history.length ? b.history[b.history.length - 1] : null;
  if (!last || !(last.capacityUnits > 0)) return 0;
  const parts = capacityParts(b, pack);
  if (parts.staff > parts.size) return 0;
  const now = Math.min(parts.staff, parts.size) * DAYS;
  const drop = (last.capacityUnits - now) / last.capacityUnits;
  return drop >= DEPARTURE_THRESHOLD ? clamp(drop, 0, 1) : 0;
}

/** Demand multiplier of the month in which barbers left: their regulars partly follow them. */
export function departureMult(b: BusinessState, pack: Pack): number {
  return 1 - settings(pack).followShare * lostBarberShare(b, pack);
}

export function demandMult(b: BusinessState, date: GameDate, pack: Pack): number {
  return weekdayMult(date.weekday, pack) * departureMult(b, pack);
}

function revenueMtd(b: BusinessState): number {
  const fromLines = b.mtd.lines.filter((l) => l.kind === 'revenue' && l.amount > 0).reduce((a, l) => a + l.amount, 0);
  return fromLines > 0 ? fromLines : b.mtd.servedUnits * b.orders.price;
}

/** Month-close lines the common engine does not know: commission above hourly pay and the retail shelf. */
export function extraLines(b: BusinessState, pack: Pack, _month: number): PnlLine[] {
  const s = settings(pack);
  const lines: PnlLine[] = [];
  if (b.orders.levers.pay_model === 'commission') {
    const basePay = pack.staff
      .filter((r) => r.id === 'barber' || r.id === 'apprentice')
      .reduce((a, r) => a + count(b, r.id) * r.hourlyWage * r.hoursPerMonth, 0);
    const topUp = cents(Math.max(0, s.barberShare * revenueMtd(b) - basePay));
    if (topUp > 0) {
      lines.push({ id: 'commission_topup', label: 'Commission above hourly pay', kind: 'payroll', amount: -topUp });
      lines.push({ id: 'commission_topup_tax', label: 'Payroll taxes on commission', kind: 'payroll_tax', amount: -cents(topUp * s.payrollTaxRate) });
    }
  }
  if (b.orders.levers.retail === 'shelf' && b.mtd.servedUnits > 0) {
    const sales = cents(b.mtd.servedUnits * s.retailPerCut);
    lines.push({ id: 'retail_sales', label: 'Retail product sales', kind: 'revenue', amount: sales });
    lines.push({ id: 'retail_cogs', label: 'Retail products at wholesale cost', kind: 'cogs', amount: -cents(sales * s.retailCogsShare) });
  }
  return lines;
}

/** Days of the current month already played, 1..30, read from the last day report. */
function daysIntoMonth(b: BusinessState): number {
  const last = b.days.length ? b.days[b.days.length - 1] : null;
  return last ? dateOf(last.day).dayOfMonth : 0;
}

export function kpis(b: BusinessState, pack: Pack): NicheKpi[] {
  const s = settings(pack);
  const days = daysIntoMonth(b);
  const perChairMonth = num(pack.sizing.unitsServedPerSizeMonth, 0);
  const chairCapacity = b.size * perChairMonth * (days / DAYS);
  const chairLoad = chairCapacity > 0 ? clamp(b.mtd.servedUnits / chairCapacity, 0, 1) : 0;
  const heads = cutters(b, pack).heads;
  const revenueMonth = days > 0 ? (revenueMtd(b) * DAYS) / days : 0;
  const returning = clamp(s.returningShare * (0.5 + b.reputation) * departureMult(b, pack), 0, 0.95);
  return [
    { id: 'chair_utilization', label: 'Chair utilization', value: Math.round(chairLoad * 1000) / 10, unit: '%' },
    { id: 'revenue_per_barber', label: 'Revenue per barber', value: heads > 0 ? Math.round(revenueMonth / heads) : 0, unit: '$/mo' },
    { id: 'returning_clients', label: 'Returning clients', value: Math.round(returning * 1000) / 10, unit: '%' },
  ];
}

export function notes(b: BusinessState, r: DayReport, pack: Pack): string[] {
  const out: string[] = [];
  const weekday = dateOf(r.day).weekday;
  const peak = weekdayMult(weekday, pack) > 1.2;
  const heads = cutters(b, pack).heads;
  const lostStaff = Math.round(r.lost.staff);
  const lostSize = Math.round(r.lost.size);
  if (lostStaff > 0) {
    out.push(`${peak ? `${WEEKDAY_NAMES[weekday]} rush: ` : ''}${lostStaff} client${lostStaff === 1 ? '' : 's'} left because every barber was busy.`);
  }
  if (lostSize > 0) {
    out.push(`${peak ? `${WEEKDAY_NAMES[weekday]} rush: ` : ''}${lostSize} client${lostSize === 1 ? '' : 's'} left because every chair was taken.`);
  }
  if (b.size > heads) {
    const idle = b.size - heads;
    out.push(`${idle} chair${idle === 1 ? ' has' : 's have'} no barber. An empty chair earns nothing and still costs rent.`);
  }
  const lost = lostBarberShare(b, pack);
  if (lost > 0) {
    const pct = Math.round(settings(pack).followShare * lost * 100);
    out.push(`A barber left this month and took regulars along: about ${pct}% fewer clients until the month closes.`);
  }
  return out;
}

export const hooks: NicheHooks = { demandMult, capacityDay, extraLines, kpis, notes };
