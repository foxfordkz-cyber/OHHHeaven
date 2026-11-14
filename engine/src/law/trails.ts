// Следы нарушений: экономия от срезанных углов, рост следа, формула штрафа, что найдёт проверка.
import type {
  BusinessState, Case, FoundViolation, Money, OfficialRole, PackSetupItem, PackShortcut, PackViolation, PnlLine, ViolationTrail,
} from '../../../shared/src/types';
import { RULES } from '../../../shared/src/rules';
import type { EngineCtx } from './ctx';
import { findViolation, money, monthEndDay, monthOfDay, monthStartDay, packOf, roleOfViolation, shortcutsFor } from './util';

export interface SavingsBase { payroll: Money; revenue: Money; rent: Money; staffCount: number }

/** Штраф по пакету: base + perMonth × месяцев + pctOfSaved × сэкономленное, не больше max. */
export function fineFor(v: PackViolation, months: number, saved: Money): Money {
  const f = v.fine ?? {};
  let fine = (f.base ?? 0) + (f.perMonth ?? 0) * months + (f.pctOfSaved ?? 0) * saved;
  if (f.max !== undefined && f.max !== null) fine = Math.min(fine, f.max);
  return Math.max(0, money(fine));
}

export function savingsOf(s: PackShortcut, base: SavingsBase): Money {
  const a = s.saves.amount;
  switch (s.saves.basis) {
    case 'fixed': return money(a);
    case 'pct_payroll': return money(a * base.payroll);
    case 'pct_revenue': return money(a * base.revenue);
    case 'pct_rent': return money(a * base.rent);
    case 'per_staff': return money(a * base.staffCount);
    default: return 0;
  }
}

function grow(trails: ViolationTrail[], violationId: string, saved: Money, month: number): ViolationTrail[] {
  const i = trails.findIndex((t) => t.violationId === violationId);
  if (i < 0) return [...trails, { violationId, months: 1, saved, lastActiveMonth: month, discovered: false }];
  const t = trails[i];
  const next: ViolationTrail = {
    ...t,
    months: t.lastActiveMonth === month ? t.months : t.months + 1,   // два источника одного нарушения за месяц — один месяц
    saved: t.saved + saved,
    lastActiveMonth: month,
  };
  return trails.map((x, j) => (j === i ? next : x));
}

/** Есть ли у бизнеса разрешение на этот день. Предмет без waitDays выдаётся сразу при покупке. */
export function hasPermitOn(b: BusinessState, item: PackSetupItem, day: number): boolean {
  const p = b.permits.find((x) => x.itemId === item.id);
  if (p) return day >= p.readyDay;
  return b.items.some((x) => x.id === item.id && x.qty > 0);
}

/** Работал ли бизнес в этом месяце хотя бы день без обязательного разрешения. */
function operatedWithout(b: BusinessState, item: PackSetupItem, month: number): boolean {
  if (b.openedDay === undefined || b.status === 'setup') return false;
  const from = Math.max(b.openedDay, monthStartDay(month));
  const to = monthEndDay(month);
  if (from > to) return false;
  return !hasPermitOn(b, item, from);
}

/** Экономия месяца по включённым срезанным углам и рост следов (сюда же рычаги с causes и работа без разрешения). */
export function shortcutSavings(b: BusinessState, ctx: EngineCtx, base: SavingsBase, month: number): { lines: PnlLine[]; trails: ViolationTrail[] } {
  const pack = packOf(ctx, b.niche);
  const shortcuts = shortcutsFor(ctx, b.niche);
  let trails = b.trails;
  const lines: PnlLine[] = [];

  for (const id of b.orders.shortcuts) {
    const s = shortcuts.find((x) => x.id === id);
    if (!s) continue;
    const amount = savingsOf(s, base);
    if (amount > 0) lines.push({ id: `saving:${s.id}`, label: `Kept: ${s.name}`, kind: 'saving', amount });
    trails = grow(trails, s.violation, amount, month);
  }

  for (const lever of pack?.levers ?? []) {
    const opt = lever.options.find((o) => o.id === b.orders.levers[lever.id]);
    if (!opt?.causes) continue;
    const compliant = lever.options.filter((o) => !o.causes).map((o) => o.monthlyCost);
    const baseline = compliant.length > 0 ? Math.min(...compliant) : opt.monthlyCost;
    trails = grow(trails, opt.causes, Math.max(0, money(baseline - opt.monthlyCost)), month);
  }

  for (const item of pack?.setup ?? []) {
    if (item.required && item.withoutItViolation && operatedWithout(b, item, month)) trails = grow(trails, item.withoutItViolation, 0, month);
  }
  return { lines, trails };
}

/** Нарушения, которые идут прямо сейчас: работа без обязательного разрешения. Их видно без закрытого месяца. */
export function ongoingPermitViolations(b: BusinessState, ctx: EngineCtx, day: number): string[] {
  if (b.status === 'setup' || b.status === 'bankrupt' || b.openedDay === undefined || b.openedDay > day) return [];
  return (packOf(ctx, b.niche)?.setup ?? [])
    .filter((item) => item.required && item.withoutItViolation && !hasPermitOn(b, item, day))
    .map((item) => item.withoutItViolation as string);
}

export const trailExpired = (t: ViolationTrail, month: number): boolean => month - t.lastActiveMonth >= RULES.TRAIL_EXPIRY_MONTHS;

/** Чем проверка ищет нарушения: инспектор — осмотром, аудитор — аудитом, дело по жалобе — ещё и по жалобе. */
function methodsOf(role: OfficialRole, origin: Case['origin']): string[] {
  const m = [role === 'inspector' ? 'inspection' : 'audit'];
  if (origin === 'report') m.push('complaint');
  return m;
}

function findableBy(v: PackViolation, methods: string[]): boolean {
  return !v.foundBy || v.foundBy.length === 0 || v.foundBy.some((f) => methods.includes(f));
}

/** Всё, что найдёт проверка роли `role` сегодня. Случая нет: нарушение есть — оно найдено. */
export function findViolations(b: BusinessState, ctx: EngineCtx, role: OfficialRole, origin: Case['origin'], day: number): FoundViolation[] {
  const month = monthOfDay(day);
  const methods = methodsOf(role, origin);
  const out: FoundViolation[] = [];
  const seen = new Set<string>();
  const consider = (violationId: string, months: number, saved: Money) => {
    if (seen.has(violationId)) return;
    const v = findViolation(ctx, b.niche, violationId);
    if (!v || roleOfViolation(ctx, b.niche, v) !== role || !findableBy(v, methods)) return;
    seen.add(violationId);
    out.push({ violationId, months, fine: fineFor(v, months, saved), closureDays: v.closureDays ?? 0 });
  };
  for (const t of b.trails) if (t.months > 0 && !trailExpired(t, month)) consider(t.violationId, t.months, t.saved);
  for (const id of ongoingPermitViolations(b, ctx, day)) {
    const t = b.trails.find((x) => x.violationId === id);
    consider(id, t?.months ?? 0, t?.saved ?? 0);
  }
  return out;
}

/** Сколько штрафов придёт, если найдут все текущие нарушения обеими ролями (показывает аналитика). */
export function exposureOf(b: BusinessState, ctx: EngineCtx): Money {
  const day = b.days.length > 0 ? b.days[b.days.length - 1].day : (b.openedDay ?? b.createdDay);
  let total = 0;
  for (const role of ['inspector', 'tax_auditor'] as const) {
    for (const f of findViolations(b, ctx, role, 'report', day)) total += f.fine;
  }
  return total;
}
