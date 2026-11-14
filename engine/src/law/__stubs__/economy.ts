// Заглушка экономики агента 02 — только чтобы прогонять месяцы в тестах и демо закона.
// Настоящий порядок дня и месяца — build/CONTRACT.md, раздел 3; заменить на engine/src/index.ts, когда он появится.
import type { BusinessState, MonthReport, PnlLine, WorldState } from '../../../../shared/src/types';
import { RULES, isMonthEnd } from '../../../../shared/src/rules';
import type { EngineCtx } from '../ctx';
import { lawDay } from '../day';
import { lawMonthClose } from '../month';
import { shortcutSavings } from '../trails';
import { monthOfDay, packOf, staffCount } from '../util';

/** Простые месячные деньги кафе: выручка 3 000 заказов по цене, себестоимость, зарплата, налоги на зарплату, аренда, рычаги. */
function closeBusiness(b: BusinessState, ctx: EngineCtx, month: number): BusinessState {
  if (b.status === 'setup' || b.status === 'bankrupt') return b;
  const pack = packOf(ctx, b.niche);
  const taxes = [...(pack?.taxes ?? []), ...(ctx.packs.common.taxes ?? [])];
  const payroll = Math.round((pack?.staff ?? []).reduce((s, r) => s + (b.orders.staff[r.id] ?? 0) * r.hourlyWage * r.hoursPerMonth, 0));
  const payrollRate = taxes.filter((t) => t.base === 'payroll').reduce((s, t) => s + t.rate, 0);
  const revenue = Math.round(3000 * b.orders.price);
  const rent = 9000;
  const levers = (pack?.levers ?? []).reduce((s, l) => s + (l.options.find((o) => o.id === b.orders.levers[l.id])?.monthlyCost ?? 0), 0);
  const close: PnlLine[] = [
    { id: 'revenue', label: 'Sales', kind: 'revenue', amount: revenue },
    { id: 'cogs', label: 'Ingredients', kind: 'cogs', amount: -Math.round(3000 * (pack?.unit.cogsPerUnit ?? 0)) },
    { id: 'payroll', label: 'Wages', kind: 'payroll', amount: -payroll },
    { id: 'payroll_tax', label: 'Payroll taxes', kind: 'payroll_tax', amount: -Math.round(payroll * payrollRate) },
    { id: 'rent', label: 'Rent', kind: 'rent', amount: -rent },
    { id: 'levers', label: 'Cleaning and upkeep', kind: 'opex', amount: -levers },
  ];
  const s = shortcutSavings(b, ctx, { payroll, revenue, rent, staffCount: staffCount(b) }, month);
  const lines = [...b.mtd.lines, ...close, ...s.lines];
  const delta = [...close, ...s.lines].reduce((x, l) => x + l.amount, 0);
  const cashEnd = b.cash + delta;
  const report: MonthReport = {
    month, avgPrice: b.orders.price, demandUnits: 3000, servedUnits: 3000, lost: { size: 0, staff: 0, closure: 0 },
    capacityUnits: 3000, sizeUtilization: 0.7, lines, revenue, profit: lines.reduce((x, l) => x + l.amount, 0),
    cashStart: cashEnd - lines.reduce((x, l) => x + l.amount, 0), cashEnd, taxesAccrued: 0, taxesPaid: 0,
    fines: -lines.filter((l) => l.kind === 'fine').reduce((x, l) => x + l.amount, 0),
    quality: b.quality, reputation: b.reputation, netWorth: cashEnd, rankInNiche: 0,
  };
  return { ...b, cash: cashEnd, trails: s.trails, history: [...b.history, report], mtd: { lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } } };
}

export function stubEconomyMonthClose(w: WorldState, ctx: EngineCtx): WorldState {
  const month = monthOfDay(w.day);
  return { ...w, businesses: w.businesses.map((b) => closeBusiness(b, ctx, month)) };
}

/** Один игровой день в порядке CONTRACT: lawDay, затем закрытие месяца (экономика → закон). */
export function stubTick(w: WorldState, ctx: EngineCtx): WorldState {
  let world: WorldState = { ...w, day: w.day + 1 };
  world = lawDay(world, ctx);
  if (isMonthEnd(world.day)) world = lawMonthClose(stubEconomyMonthClose(world, ctx), ctx);
  return { ...world, version: world.version + 1 };
}

export function runDays(w: WorldState, ctx: EngineCtx, days: number): WorldState {
  let world = w;
  for (let i = 0; i < days && world.day < RULES.DAYS_PER_MONTH * 12; i++) world = stubTick(world, ctx);
  return world;
}
