// ЗАГЛУШКА движка до появления настоящих модулей в основной ветке:
//   tickDay, netWorth — агент 02 (engine/src/index.ts); dealModifiers — агент 13 (engine/src/deals);
//   exposureOf — агент 03 (engine/src/law); nicheKpisHook — крючки ниш (engine/src/niches, агенты 01 и 14).
// Подключается только через ../link.ts. Простая детерминированная экономика по разделу 3 CONTRACT:
// спрос дня, мощность по людям и залу, потери с причиной, закрытие месяца по модели затрат, следы нарушений.
import type {
  BusinessState, DayReport, Money, MonthReport, NicheKpi, Pack, PnlLine, WorldState,
} from '../../../../shared/src/types';
import { RULES, dateOf, isMonthEnd } from '../../../../shared/src/rules';
import {
  type Ctx, clamp, costModel, hardCapMonth, leverEffects, placeOf, r2, sizeCapMonth, staffCapMonth,
  taxesOf, violationsOf, chosenOption, sumLines,
} from '../model';

export function dealModifiers(w: WorldState, ctx: Ctx, businessId: string): { cogsMult: number; demandMult: number; priceMult: number; footTrafficMult: number } {
  const m = { cogsMult: 1, demandMult: 1, priceMult: 1, footTrafficMult: 1 };
  for (const d of w.deals) {
    if (d.status !== 'active' || (d.fromBusinessId !== businessId && d.toBusinessId !== businessId)) continue;
    if (d.terms.type === 'joint_purchase') m.cogsMult *= RULES.JOINT_PURCHASE_COGS_MULT;
    if (d.terms.type === 'cross_promo') { m.demandMult *= RULES.CROSS_PROMO_DEMAND_MULT; m.priceMult *= RULES.CROSS_PROMO_PRICE_MULT; }
  }
  const b = w.businesses.find((x) => x.id === businessId);
  const place = b ? placeOf(ctx, b.placeId) : undefined;
  const month = dateOf(w.day).month;
  if (place && w.blockFunds.some((f) => f.block === place.block && f.active && f.month === month)) m.footTrafficMult *= RULES.BLOCK_FUND_TRAFFIC_MULT;
  return m;
}

export function exposureOf(b: BusinessState, ctx: Ctx): Money {
  const pack = ctx.packs.niches[b.niche];
  if (!pack) return 0;
  const vs = violationsOf(ctx.packs.common, pack);
  let total = 0;
  for (const t of b.trails) {
    if (t.discovered) continue;
    const v = vs.find((x) => x.id === t.violationId);
    if (!v) continue;
    let fine = (v.fine.base ?? 0) + (v.fine.perMonth ?? 0) * t.months + (v.fine.pctOfSaved ?? 0) * t.saved;
    if (v.fine.max != null) fine = Math.min(fine, v.fine.max);
    total += fine;
  }
  return r2(total);
}

export function netWorth(b: BusinessState, ctx: Ctx): Money {
  const pack = ctx.packs.niches[b.niche];
  let items = 0;
  if (pack) for (const it of b.items) {
    const def = pack.setup.find((s) => s.id === it.id);
    if (def && (def.kind === 'equipment' || def.kind === 'furniture')) items += def.cost * it.qty;
  }
  const owed = b.liabilities.filter((l) => !l.paid).reduce((s, l) => s + l.amount, 0);
  return r2(b.cash + RULES.NET_WORTH_ITEMS_SHARE * items - owed);
}

export function nicheKpisHook(_b: BusinessState, _pack: Pack): NicheKpi[] | null { return null; }

// ───────────────────────── день ─────────────────────────

function eventMults(w: WorldState, b: BusinessState, ctx: Ctx): Record<string, number> {
  const out: Record<string, number> = {};
  const place = placeOf(ctx, b.placeId);
  for (const e of w.events) {
    if (w.day < e.startDay || w.day > e.endDay) continue;
    if (e.block && place && e.block !== place.block) continue;
    for (const ef of e.effects) {
      if (ef.niches && !ef.niches.includes(b.niche)) continue;
      if (ef.tiers && place && !ef.tiers.includes(place.tier)) continue;
      out[ef.target] = (out[ef.target] ?? 1) * clamp(ef.mult, 0.5, 1.5);
    }
  }
  return out;
}

const quarterDueDay = (month: number): number => Math.ceil(month / 3) * 3 * RULES.DAYS_PER_MONTH + 20;

function addLine(lines: PnlLine[], line: PnlLine): void {
  const ex = lines.find((l) => l.id === line.id);
  if (ex) ex.amount = r2(ex.amount + line.amount); else lines.push({ ...line });
}

function sellDay(b: BusinessState, w: WorldState, ctx: Ctx, pack: Pack): void {
  const place = placeOf(ctx, b.placeId);
  const mods = dealModifiers(w, ctx, b.id);
  const ev = eventMults(w, b, ctx);
  const date = dateOf(w.day);
  const weekday = date.weekday === 5 ? 1.15 : date.weekday === 6 ? 0.9 : 1;
  const weather = w.weather.find((d) => d.day === w.day)?.footTrafficMult ?? 1;
  const lev = leverEffects(pack, b.orders);
  const q = clamp(b.quality + lev.quality, 0, 1);
  const loc = 0.6 + 0.8 * (place?.footTraffic ?? 0.5);
  const price = b.orders.price * mods.priceMult;
  const priceFactor = Math.pow(price / pack.unit.refPrice, pack.market.priceElasticity);
  const rivals = w.businesses.filter((x) => x.niche === b.niche && x.status === 'open' && placeOf(ctx, x.placeId)?.block === place?.block).length;
  const comp = 1 / (1 + 0.15 * Math.max(0, rivals - 1));
  const month = pack.market.unitsPerSlotMonth * loc * (0.8 + 0.4 * q) * (0.8 + 0.4 * b.reputation) * priceFactor * comp
    * (1 + lev.demand) * mods.demandMult * mods.footTrafficMult * (ev.demand ?? 1) * (ev.footTraffic ?? 1);
  const demand = (month / 30) * weekday * weather;
  const staffCap = (staffCapMonth(pack, b.orders, lev.capacity) * (ev.staffAvailability ?? 1)) / 30;
  const sizeCap = sizeCapMonth(pack, b.size) / 30;
  const hard = hardCapMonth(pack) / 30;
  let served = 0;
  const lost = { size: 0, staff: 0, closure: 0 };
  if (b.status === 'closed') lost.closure = demand;
  else {
    const afterStaff = Math.min(demand, staffCap);
    lost.staff = demand - afterStaff;
    served = Math.min(afterStaff, sizeCap, hard);
    lost.size = afterStaff - served;
  }
  const revenue = r2(served * price);
  const variable = r2(served * pack.unit.cogsPerUnit * mods.cogsMult * (ev.cogs ?? 1));
  const util = sizeCap > 0 ? served / sizeCap : 0;
  const notes: string[] = [];
  if (lost.size >= 1) notes.push(`Line out the door: ${Math.round(lost.size)} customers walked away`);
  if (lost.staff >= 1) notes.push(`Short-staffed: ${Math.round(lost.staff)} orders lost`);
  if (util > (pack.sizing.crowdPenaltyAbove ?? 0.9)) b.reputation = clamp(b.reputation - 0.002, 0, 1);
  else if (util < (pack.sizing.emptyPenaltyBelow ?? 0.3)) b.reputation = clamp(b.reputation - 0.001, 0, 1);
  else b.reputation = clamp(b.reputation + 0.001, 0, 1);

  const salesTaxRate = taxesOf(ctx.packs.common, pack).filter((t) => t.base === 'taxable_revenue').reduce((s, t) => s + t.rate, 0);
  const salesTax = r2(revenue * salesTaxRate);
  b.cash = r2(b.cash + revenue - variable + salesTax);
  addLine(b.mtd.lines, { id: 'revenue', label: 'Sales', kind: 'revenue', amount: revenue });
  addLine(b.mtd.lines, { id: 'cogs', label: 'Cost of goods', kind: 'cogs', amount: -variable });
  if (salesTax > 0) addLine(b.mtd.lines, { id: 'sales_tax_collected', label: 'Sales tax collected (owed to the state)', kind: 'tax', amount: salesTax });
  b.mtd.demandUnits += demand; b.mtd.servedUnits += served;
  b.mtd.lost.size += lost.size; b.mtd.lost.staff += lost.staff; b.mtd.lost.closure += lost.closure;
  const day: DayReport = {
    day: w.day, demandUnits: r2(demand), servedUnits: r2(served),
    lost: { size: r2(lost.size), staff: r2(lost.staff), closure: r2(lost.closure) },
    revenue, variableCosts: variable, sizeUtilization: r2(util), weather: w.weather.find((d) => d.day === w.day)?.condition ?? 'clear', notes,
  };
  b.days = [...b.days, day].slice(-RULES.DAYS_PER_MONTH);
}

function payDueTaxes(b: BusinessState, w: WorldState): void {
  for (const l of b.liabilities) {
    if (l.paid || l.dueDay !== w.day) continue;
    l.paid = true;
    b.cash = r2(b.cash - l.amount);
    addLine(b.mtd.lines, { id: `paid_${l.taxId}`, label: `Tax paid: ${l.taxId}`, kind: 'tax', amount: -l.amount });
  }
}

// ───────────────────────── месяц ─────────────────────────

function closeMonth(b: BusinessState, w: WorldState, ctx: Ctx, pack: Pack): void {
  const month = dateOf(w.day).month;
  const place = placeOf(ctx, b.placeId);
  const mods = dealModifiers(w, ctx, b.id);
  const cm = costModel({ pack, common: ctx.packs.common, place, orders: b.orders, size: b.size, status: b.status, mods });
  const lines = b.mtd.lines.map((l) => ({ ...l }));
  const revenue = lines.filter((l) => l.kind === 'revenue').reduce((s, l) => s + l.amount, 0);
  const cashStart = r2(b.cash - sumLines(lines));
  for (const l of cm.variableLines(b.mtd.servedUnits, revenue)) lines.push({ id: l.id, label: l.label, kind: l.kind, amount: -l.amount });
  for (const l of cm.fixed) lines.push({ id: l.id, label: l.label, kind: l.kind, amount: -l.amount });
  for (const l of cm.savings(revenue)) lines.push({ id: l.id, label: l.label, kind: 'saving', amount: l.amount });
  const operating = sumLines(lines.filter((l) => !(l.kind === 'tax' && (l.id === 'sales_tax_collected' || l.id.startsWith('paid_')))));
  const incomeTax = r2(cm.profitTaxRate * Math.max(0, operating));
  const salesTax = lines.find((l) => l.id === 'sales_tax_collected')?.amount ?? 0;
  if (salesTax > 0) b.liabilities.push({ taxId: 'sales_tax', amount: salesTax, dueDay: quarterDueDay(month), paid: false });
  if (incomeTax > 0) b.liabilities.push({ taxId: 'income_tax', amount: incomeTax, dueDay: quarterDueDay(month), paid: false });
  const monthCash = sumLines(lines.filter((l) => !b.mtd.lines.some((m) => m.id === l.id)));
  b.cash = r2(b.cash + monthCash);

  // следы нарушений: срезанные углы, рискованные варианты рычагов, работа без разрешения
  const grow = (violationId: string, saved: Money) => {
    const t = b.trails.find((x) => x.violationId === violationId && !x.discovered);
    if (t) { t.months += 1; t.saved = r2(t.saved + saved); t.lastActiveMonth = month; }
    else b.trails.push({ violationId, months: 1, saved: r2(saved), lastActiveMonth: month, discovered: false });
  };
  const shortcuts = [...pack.shortcuts, ...ctx.packs.common.shortcuts];
  for (const s of cm.savings(revenue)) {
    const sc = shortcuts.find((x) => `saving_${x.id}` === s.id);
    if (sc) grow(sc.violation, s.amount);
  }
  for (const lever of pack.levers) {
    const o = chosenOption(lever, b.orders);
    if (o.causes) grow(o.causes, Math.max(0, Math.max(...lever.options.filter((x) => !x.causes).map((x) => x.monthlyCost), 0) - o.monthlyCost));
  }
  if (b.status === 'open') for (const p of b.permits) {
    const def = pack.setup.find((s) => s.id === p.itemId);
    if (def?.withoutItViolation && p.readyDay > w.day) grow(def.withoutItViolation, 0);
  }

  const report: MonthReport = {
    month, avgPrice: b.mtd.servedUnits > 0 ? r2(revenue / b.mtd.servedUnits) : b.orders.price,
    demandUnits: Math.round(b.mtd.demandUnits), servedUnits: Math.round(b.mtd.servedUnits),
    lost: { size: Math.round(b.mtd.lost.size), staff: Math.round(b.mtd.lost.staff), closure: Math.round(b.mtd.lost.closure) },
    capacityUnits: Math.round(Math.min(staffCapMonth(pack, b.orders), sizeCapMonth(pack, b.size), hardCapMonth(pack))),
    sizeUtilization: b.days.length ? r2(b.days.reduce((s, d) => s + d.sizeUtilization, 0) / b.days.length) : 0,
    lines, revenue: r2(revenue), profit: r2(operating - incomeTax), cashStart, cashEnd: b.cash,
    taxesAccrued: r2(incomeTax + salesTax), taxesPaid: r2(-lines.filter((l) => l.id.startsWith('paid_')).reduce((s, l) => s + l.amount, 0)),
    fines: r2(-lines.filter((l) => l.kind === 'fine').reduce((s, l) => s + l.amount, 0)),
    quality: b.quality, reputation: b.reputation, netWorth: netWorth(b, ctx), rankInNiche: 0,
  };
  b.history = [...b.history, report];
  b.mtd = { lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } };
}

export function tickDay(w0: WorldState, ctx: Ctx): WorldState {
  const w: WorldState = structuredClone(w0);
  w.day += 1;
  w.version += 1;
  w.weather = w.weather.filter((d) => d.day >= w.day);
  for (const b of w.businesses) {
    const pack = ctx.packs.niches[b.niche];
    if (!pack || b.status === 'bankrupt') continue;
    if (b.status === 'closed' && b.closedUntilDay != null && w.day > b.closedUntilDay) b.status = 'open';
    if (b.status === 'open' || b.status === 'closed') sellDay(b, w, ctx, pack);
    payDueTaxes(b, w);
  }
  if (isMonthEnd(w.day)) {
    for (const b of w.businesses) {
      const pack = ctx.packs.niches[b.niche];
      if (pack && b.status !== 'bankrupt') closeMonth(b, w, ctx, pack);
    }
  }
  for (const b of w.businesses) {
    if (b.status !== 'bankrupt' && b.cash < 0) { b.status = 'bankrupt'; b.bankruptDay = w.day; }
  }
  return w;
}
