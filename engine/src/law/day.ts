// lawDay: движение дел, подозрительные цифры раз в квартал, конец закрытия по проверке.
import type { BusinessState, MonthReport, WorldState } from '../../../shared/src/types';
import { RULES, dateOf } from '../../../shared/src/rules';
import { LAW } from './constants';
import type { EngineCtx } from './ctx';
import { firstFreeAi, hasActiveCase, inspect, openCase, refuseBribe, settleFine, takeCase } from './cases';
import { addFeed, findViolation, packOf, roleOfViolation, shortcutsFor, staffCount } from './util';

export function lawDay(w: WorldState, ctx: EngineCtx): WorldState {
  let world = reopenClosed(w);
  world = quarterFlags(world, ctx);
  for (const id of world.cases.map((c) => c.id)) {
    const c = world.cases.find((x) => x.id === id);
    if (!c) continue;
    if (c.status === 'open' && world.day >= c.openedDay + RULES.CASE_GRACE_DAYS) {
      const ai = firstFreeAi(world, c);
      if (ai) world = takeCase(world, c.id, ai);
    } else if (c.status === 'taken' && c.inspectDay !== undefined && world.day >= c.inspectDay) {
      world = inspect(world, ctx, c.id);
    } else if (c.status === 'notice' && c.answerByDay !== undefined && world.day > c.answerByDay) {
      world = settleFine(world, ctx, c.id, { mult: 1, response: 'pay', reason: 'No answer in time: paid automatically. ' });
    } else if (c.status === 'bribe_offered' && c.answerByDay !== undefined && world.day > c.answerByDay) {
      world = refuseBribe(world, ctx, c.id);
    }
  }
  return world;
}

function reopenClosed(w: WorldState): WorldState {
  let world = w;
  for (const b of w.businesses) {
    if (b.status !== 'closed' || b.closedUntilDay === undefined || w.day < b.closedUntilDay) continue;
    world = {
      ...world,
      businesses: world.businesses.map((x) => {
        if (x.id !== b.id) return x;
        const { closedUntilDay: _done, ...rest } = x;
        void _done;
        return { ...rest, status: 'open' } as BusinessState;
      }),
    };
    world = addFeed(world, { id: `law:reopen:${b.id}:${w.day}`, kind: 'inspection', businessId: b.id, text: `${b.name} reopened after the closure order` });
  }
  return world;
}

const sumKind = (reports: MonthReport[], kind: string): number =>
  reports.reduce((s, m) => s + m.lines.filter((l) => l.kind === kind).reduce((x, l) => x + Math.abs(l.amount), 0), 0);

/** Подозрительные цифры за прошедший квартал: так налоговая сверяет квартальные отчёты (NYS-45, IRS 941). */
export function suspiciousNumbers(b: BusinessState, ctx: EngineCtx, reports: MonthReport[]): string[] {
  const taxes = [...(packOf(ctx, b.niche)?.taxes ?? []), ...(ctx.packs.common.taxes ?? [])];
  const payrollRate = taxes.filter((t) => t.base === 'payroll').reduce((s, t) => s + t.rate, 0);
  const salesRate = taxes.filter((t) => t.base === 'taxable_revenue' || t.base === 'revenue').reduce((s, t) => s + t.rate, 0);
  const shortcuts = shortcutsFor(ctx, b.niche);
  let hiddenPayrollTax = 0;
  let hiddenRevenue = 0;
  for (const line of reports.flatMap((m) => m.lines)) {
    if (line.kind !== 'saving' || !line.id.startsWith('saving:')) continue;
    const s = shortcuts.find((x) => x.id === line.id.slice('saving:'.length));
    const v = s ? findViolation(ctx, b.niche, s.violation) : undefined;
    if (!s || !v || roleOfViolation(ctx, b.niche, v) !== 'tax_auditor') continue;
    if (s.saves.basis === 'pct_payroll' || s.saves.basis === 'per_staff') hiddenPayrollTax += line.amount;
    if (s.saves.basis === 'pct_revenue') hiddenRevenue += salesRate > 0 ? line.amount / salesRate : line.amount;
  }
  const hints: string[] = [];
  const staff = staffCount(b);
  const expected = sumKind(reports, 'payroll') * payrollRate;
  const remitted = sumKind(reports, 'payroll_tax') - hiddenPayrollTax;
  if (staff >= LAW.PAYROLL_FLAG_MIN_STAFF && expected > 0 && remitted < LAW.PAYROLL_FLAG_RATIO * expected) {
    hints.push(`Payroll taxes look low for ${staff} staff`);
  }
  const revenue = sumKind(reports, 'revenue');
  if (revenue > 0 && hiddenRevenue / revenue >= LAW.REVENUE_FLAG_HIDDEN_SHARE) hints.push('Reported sales look low for the foot traffic');
  return hints;
}

function quarterFlags(w: WorldState, ctx: EngineCtx): WorldState {
  const d = dateOf(w.day);
  if (d.dayOfMonth !== 1 || d.month === 1 || (d.month - 1) % 3 !== 0) return w;
  const months = [d.month - 3, d.month - 2, d.month - 1];
  let world = w;
  for (const b of w.businesses) {
    if (b.status !== 'open' && b.status !== 'closed') continue;
    const reports = b.history.filter((m) => months.includes(m.month));
    if (reports.length === 0 || hasActiveCase(world, b.id, 'tax_auditor')) continue;
    const hints = suspiciousNumbers(b, ctx, reports);
    if (hints.length > 0) world = openCase(world, { businessId: b.id, role: 'tax_auditor', origin: 'flag', lead: hints }).world;
  }
  return world;
}
