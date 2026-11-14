// analyze: аналитика как у настоящего владельца. Продажи и себестоимость — из дневных отчётов движка
// (прогноз на полный месяц по прошедшим дням), постоянные расходы — из модели затрат по распоряжениям.
import type { Analytics, Benchmark, BusinessState, DayReport, Money, NicheKpi, Pack, Place, WorldState } from '../../../shared/src/types';
import { RULES, dateOf } from '../../../shared/src/rules';
import { type EngineCtx, dealModifiers, exposureOf, netWorth, nicheKpisHook } from './link';
import { type CostModel, clamp, costModel, packOf, placeOf, r1, r2, r4, sizeCapMonth, staffCapMonth, sumLines } from './model';

/** Основа расчёта: месяц в штуках и деньгах. */
export interface Basis {
  source: 'mtd' | 'last_month' | 'none' | 'whatif';
  daysCounted: number;
  revenue: Money; served: number; demand: number;
  lost: { size: number; staff: number; closure: number };
  cogs: Money; sizeUtilization: number; finesActual: Money;
}

const EMPTY: Basis = { source: 'none', daysCounted: 0, revenue: 0, served: 0, demand: 0, lost: { size: 0, staff: 0, closure: 0 }, cogs: 0, sizeUtilization: 0, finesActual: 0 };

export function basisFromDays(days: DayReport[], source: Basis['source'], finesActual = 0): Basis {
  if (!days.length) return { ...EMPTY, source: 'none', finesActual };
  const k = RULES.DAYS_PER_MONTH / days.length;
  const sum = (f: (d: DayReport) => number) => days.reduce((s, d) => s + f(d), 0);
  return {
    source, daysCounted: days.length,
    revenue: r2(sum((d) => d.revenue) * k), served: sum((d) => d.servedUnits) * k, demand: sum((d) => d.demandUnits) * k,
    lost: { size: sum((d) => d.lost.size) * k, staff: sum((d) => d.lost.staff) * k, closure: sum((d) => d.lost.closure) * k },
    cogs: r2(sum((d) => d.variableCosts) * k), sizeUtilization: r4(sum((d) => d.sizeUtilization) / days.length), finesActual,
  };
}

/** Основа для текущего месяца: дни месяца; если их ещё нет — прошлый месяц из книг. */
export function currentBasis(b: BusinessState, w: WorldState): Basis {
  const monthStart = (dateOf(Math.max(1, w.day)).month - 1) * RULES.DAYS_PER_MONTH + 1;
  const finesActual = r2(-b.mtd.lines.filter((l) => l.kind === 'fine').reduce((s, l) => s + l.amount, 0));
  const days = b.days.filter((d) => d.day >= monthStart && d.day <= w.day);
  if (days.length) return basisFromDays(days, 'mtd', finesActual);
  const last = b.history[b.history.length - 1];
  if (last && b.status !== 'setup') {
    const cogs = -last.lines.filter((l) => l.kind === 'cogs').reduce((s, l) => s + l.amount, 0);
    return {
      source: 'last_month', daysCounted: 0, revenue: last.revenue, served: last.servedUnits, demand: last.demandUnits,
      lost: { ...last.lost }, cogs: r2(cogs), sizeUtilization: last.sizeUtilization, finesActual,
    };
  }
  return { ...EMPTY, finesActual };
}

export function modelFor(b: BusinessState, w: WorldState, ctx: EngineCtx): CostModel {
  const pack = packOf(ctx, b.niche);
  const mods = dealModifiers(w, ctx, b.id);
  return costModel({ pack, common: ctx.packs.common, place: placeOf(ctx, b.placeId), orders: b.orders, size: b.size, status: b.status, mods });
}

/** Прибыль месяца по основе и модели затрат. */
export function profitOf(basis: Basis, cm: CostModel): { preTax: Money; incomeTax: Money; profit: Money; savings: Money; fixed: Money; otherVar: Money } {
  const otherVar = sumLines(cm.variableLines(basis.served, basis.revenue));
  const fixed = sumLines(cm.fixed);
  const savings = sumLines(cm.savings(basis.revenue));
  const preTax = r2(basis.revenue - basis.cogs - otherVar - fixed + savings);
  const incomeTax = r2(cm.profitTaxRate * Math.max(0, preTax));
  return { preTax, incomeTax, profit: r2(preTax - incomeTax - basis.finesActual), savings, fixed, otherVar };
}

const verdictCost = (you: number, norm: number): Benchmark['verdict'] => (you <= norm ? 'good' : you <= norm + 0.05 ? 'ok' : 'bad');

function benchmarksOf(pack: Pack, a: { cogsPct: number; laborPct: number; rentPct: number; primeCostPct: number; netMarginPct: number }, revenue: Money): Benchmark[] {
  if (revenue <= 0) return [];
  const bm = pack.benchmarks;
  return [
    { metric: 'Cost of goods, % of sales', you: a.cogsPct, industry: bm.cogsPct, verdict: verdictCost(a.cogsPct, bm.cogsPct) },
    { metric: 'Labor, % of sales', you: a.laborPct, industry: bm.laborPct, verdict: verdictCost(a.laborPct, bm.laborPct) },
    { metric: 'Prime cost, % of sales', you: a.primeCostPct, industry: r4(bm.cogsPct + bm.laborPct), verdict: verdictCost(a.primeCostPct, bm.cogsPct + bm.laborPct) },
    { metric: 'Rent, % of sales', you: a.rentPct, industry: bm.rentPct, verdict: verdictCost(a.rentPct, bm.rentPct) },
    { metric: 'Net margin', you: a.netMarginPct, industry: bm.netMarginPct, verdict: a.netMarginPct >= bm.netMarginPct ? 'good' : a.netMarginPct >= 0 ? 'ok' : 'bad' },
  ];
}

function defaultKpis(b: BusinessState, pack: Pack, place: Place | undefined, basis: Basis, priceEff: Money): NicheKpi[] {
  const unit = pack.unit.name;
  const t = pack.sizing.takeawayShare ?? 0;
  const hours = pack.staff.reduce((s, r) => s + (b.orders.staff?.[r.id] ?? 0) * r.hoursPerMonth, 0);
  const out: NicheKpi[] = [
    { id: 'avg_ticket', label: `Average ${unit}`, value: r2(priceEff), unit: '$' },
    { id: 'units_per_day', label: `${unit[0].toUpperCase()}${unit.slice(1)}s per day`, value: r1(basis.served / RULES.DAYS_PER_MONTH), unit },
    { id: 'turnover', label: `${unit[0].toUpperCase()}${unit.slice(1)}s per ${pack.sizing.unitName} per day`, value: b.size > 0 ? r1((basis.served * (1 - t)) / b.size / RULES.DAYS_PER_MONTH) : 0, unit },
  ];
  if (place) out.push({ id: 'sales_per_sqft', label: 'Sales per sq ft, per year', value: Math.round((basis.revenue * 12) / place.sqft), unit: '$' });
  if (hours > 0) out.push({ id: 'sales_per_labor_hour', label: 'Sales per labor hour', value: r2(basis.revenue / hours), unit: '$' });
  return out;
}

/** Аналитика по основе: общий расчёт для analyze и whatIf. */
export function analyticsFrom(b: BusinessState, w: WorldState, ctx: EngineCtx, basis: Basis, cm: CostModel, opts: { month: number; daysIntoMonth: number; toDateShare: number }): Analytics {
  const pack = packOf(ctx, b.niche);
  const place = placeOf(ctx, b.placeId);
  const p = profitOf(basis, cm);
  const revenue = basis.revenue;
  const units = basis.served;
  const pct = (x: number) => (revenue > 0 ? r4(x / revenue) : 0);
  const perUnitCosts = units * cm.perUnit;
  const labor = cm.payroll + cm.payrollTax;
  // без промежуточных округлений: безубыточность должна сходиться с ручным расчётом
  const priceRaw = units > 0 ? revenue / units : cm.price * cm.priceMult;
  const unitCostNoPct = units > 0 ? basis.cogs / units + cm.perUnit : cm.cogsPerUnit + cm.perUnit;
  const variableRaw = unitCostNoPct + cm.pctRevenue * priceRaw;
  const contributionRaw = priceRaw - variableRaw;
  const priceEff = r2(priceRaw);
  const variablePerUnit = r2(variableRaw);
  const contribution = r2(contributionRaw);
  const fixedNet = r2(p.fixed - p.savings);
  const breakEvenUnits = fixedNet <= 0 ? 0 : contributionRaw > 0 ? Math.ceil(fixedNet / contributionRaw - 1e-9) : null;
  const breakEvenPrice = units > 0 ? r2((fixedNet / units + unitCostNoPct) / (cm.priceMult * Math.max(0.01, 1 - cm.pctRevenue))) : null;
  const staffCap = staffCapMonth(pack, b.orders);
  const lostUnits = basis.lost.size + basis.lost.staff + basis.lost.closure;
  const liabilities = b.liabilities.filter((l) => !l.paid).sort((x, y) => x.dueDay - y.dueDay);
  const nextDue = liabilities[0]?.dueDay;
  const taxDueNext = nextDue == null ? null : { amount: r2(liabilities.filter((l) => l.dueDay === nextDue).reduce((s, l) => s + l.amount, 0)), day: nextDue };
  const parts = {
    cogsPct: pct(basis.cogs + perUnitCosts), laborPct: pct(labor), rentPct: pct(cm.rent),
    primeCostPct: pct(basis.cogs + perUnitCosts + labor), netMarginPct: pct(p.profit),
  };
  const hook = nicheKpisHook(b, pack);
  return {
    month: opts.month, daysIntoMonth: opts.daysIntoMonth,
    revenue: r2(revenue), profit: p.profit,
    cumulativeProfit: r2(b.history.reduce((s, m) => s + m.profit, 0) + p.profit * opts.toDateShare),
    netWorth: netWorth(b, ctx),
    ...parts,
    fixedCostsMonth: fixedNet, variableCostPerUnit: variablePerUnit, contributionPerUnit: contribution,
    breakEvenUnitsMonth: breakEvenUnits, breakEvenRevenueMonth: breakEvenUnits == null ? null : r2(breakEvenUnits * priceEff), breakEvenPrice,
    utilization: staffCap > 0 && Number.isFinite(staffCap) ? r4(clamp(units / staffCap, 0, 1)) : 0,
    sizeUtilization: basis.sizeUtilization || (b.size > 0 ? r4(clamp(units / sizeCapMonth(pack, b.size), 0, 1)) : 0),
    lostSalesUnits: Math.round(lostUnits), lostSalesMoney: r2(Math.round(lostUnits) * priceEff),
    cashRunwayMonths: p.profit < 0 ? r1(Math.max(0, b.cash) / -p.profit) : null,
    setupInvested: r2(b.setupSpent), paybackMonths: p.profit > 0 ? r1(b.setupSpent / p.profit) : null,
    taxDueNext, exposure: exposureOf(b, ctx),
    benchmarks: benchmarksOf(pack, parts, revenue),
    nicheKpis: hook ?? defaultKpis(b, pack, place, basis, priceEff),
    nicheAvgPrice: nicheAvgPriceOf(b, w),
  };
}

export function analyze(b: BusinessState, w: WorldState, ctx: EngineCtx): Analytics {
  const basis = currentBasis(b, w);
  const cm = modelFor(b, w, ctx);
  const date = dateOf(Math.max(1, w.day));
  return analyticsFrom(b, w, ctx, basis, cm, {
    month: date.month,
    daysIntoMonth: basis.source === 'mtd' ? basis.daysCounted : 0,
    toDateShare: basis.source === 'mtd' ? basis.daysCounted / RULES.DAYS_PER_MONTH : 0,
  });
}

/** Average price of open businesses of the same niche (the business itself included). */
function nicheAvgPriceOf(b: BusinessState, w: WorldState): number {
  const open = w.businesses.filter((x) => x.niche === b.niche && x.status === 'open');
  if (!open.length) return b.orders.price;
  return Math.round((open.reduce((sum, x) => sum + x.orders.price, 0) / open.length) * 100) / 100;
}
