// whatIf: копия мира, новые распоряжения одного бизнеса, остальные как есть, закон выключен,
// 30 дней вперёд через tickDay. Внутренний whatIfWith умеет больше: размер, открытие дверей, сделки, фонд квартала.
import type { Analytics, BusinessState, Deal, DealTerms, MonthReport, PnlLine, StandingOrders, WorldState } from '../../../shared/src/types';
import { RULES, dateOf } from '../../../shared/src/rules';
import { type EngineCtx, dealModifiers, netWorth, tickDay } from './link';
import { analyticsFrom, basisFromDays, profitOf } from './analyze';
import { costModel, hardCapMonth, packOf, placeOf, r2, sizeCapMonth, staffCapMonth } from './model';

export interface Scenario {
  orders?: Partial<StandingOrders>;
  size?: number;
  launch?: boolean;                                         // открыть двери (разрешения считаются готовыми)
  deals?: { partnerId: string; terms: DealTerms }[];        // активные сделки на время прогона
  blockFundActive?: boolean;                                // фонд квартала улицы активен
}

export interface ScenarioResult { projected: MonthReport; analytics: Analytics; business: BusinessState }

const memo = new WeakMap<WorldState, Map<string, ScenarioResult>>();

export function applyScenario(w: WorldState, ctx: EngineCtx, businessId: string, s: Scenario): WorldState {
  const c: WorldState = structuredClone(w);
  c.officials = [];                                          // закон выключен: дела не берут, штрафов нет
  c.cases = c.cases.filter((x) => x.status === 'closed');
  const b = c.businesses.find((x) => x.id === businessId);
  if (!b) throw new Error(`whatIf: no business ${businessId}`);
  const pack = packOf(ctx, b.niche);
  if (s.orders) b.orders = { ...b.orders, ...structuredClone(s.orders) };
  if (s.size != null && s.size !== b.size) {
    b.size = s.size;
    b.items = b.items.map((it) => (pack.setup.find((d) => d.id === it.id)?.scalesWithSize ? { ...it, qty: s.size! } : it));
  }
  if (s.launch && b.status === 'setup') {
    b.status = 'open'; b.openedDay = c.day;
    b.permits = b.permits.map((p) => ({ ...p, readyDay: Math.min(p.readyDay, c.day) }));
  }
  for (const [i, d] of (s.deals ?? []).entries()) {
    const deal: Deal = { id: `whatif_deal_${i}`, fromBusinessId: b.id, toBusinessId: d.partnerId, terms: d.terms, status: 'active', proposedDay: c.day, expiresDay: c.day, startDay: c.day };
    c.deals.push(deal);
  }
  if (s.blockFundActive) {
    const block = placeOf(ctx, b.placeId)?.block;
    const m = dateOf(Math.max(1, c.day)).month;
    if (block) for (const month of [m, m + 1]) c.blockFunds.push({ block, month, contributors: 0, eligible: 0, active: true, feeMonth: RULES.BLOCK_FUND_FEE_MONTH });
  }
  return c;
}

export function whatIfWith(w: WorldState, ctx: EngineCtx, businessId: string, s: Scenario = {}): ScenarioResult {
  const key = `${businessId}|${JSON.stringify(s)}`;
  let cache = memo.get(w);
  if (!cache) { cache = new Map(); memo.set(w, cache); }
  const hit = cache.get(key);
  if (hit) return hit;

  const start = applyScenario(w, ctx, businessId, s);
  const before = start.businesses.find((x) => x.id === businessId)!;
  let cur = start;
  for (let i = 0; i < RULES.DAYS_PER_MONTH; i++) cur = tickDay(cur, ctx);
  const after = cur.businesses.find((x) => x.id === businessId)!;
  const pack = packOf(ctx, after.niche);
  const place = placeOf(ctx, after.placeId);
  const days = after.days.filter((d) => d.day > start.day);
  const basis = basisFromDays(days, 'whatif');
  basis.source = 'whatif';
  // постоянные расходы — по распоряжениям сценария; множители сделок — как в начале прогона
  const mods = dealModifiers(start, ctx, businessId);
  const cm = costModel({ pack, common: ctx.packs.common, place, orders: before.orders, size: before.size, status: before.status === 'setup' && days.length === 0 ? 'setup' : 'open', mods });
  const p = profitOf(basis, cm);
  const lines: PnlLine[] = [
    { id: 'revenue', label: 'Sales', kind: 'revenue', amount: basis.revenue },
    { id: 'cogs', label: 'Cost of goods', kind: 'cogs', amount: -basis.cogs },
    ...cm.variableLines(basis.served, basis.revenue).map((l) => ({ id: l.id, label: l.label, kind: l.kind, amount: -l.amount })),
    ...cm.fixed.map((l) => ({ id: l.id, label: l.label, kind: l.kind, amount: -l.amount })),
    ...cm.savings(basis.revenue).map((l) => ({ id: l.id, label: l.label, kind: l.kind, amount: l.amount })),
  ];
  if (p.incomeTax > 0) lines.push({ id: 'income_tax_estimate', label: 'Income tax (estimate)', kind: 'tax', amount: -p.incomeTax });
  const peers = cur.businesses.filter((x) => x.niche === after.niche && x.status !== 'bankrupt').map((x) => ({ id: x.id, nw: netWorth(x, ctx) })).sort((a, z) => z.nw - a.nw);
  const projected: MonthReport = {
    month: dateOf(Math.max(1, w.day)).month,
    avgPrice: basis.served > 0 ? r2(basis.revenue / basis.served) : cm.priceEff,
    demandUnits: Math.round(basis.demand), servedUnits: Math.round(basis.served),
    lost: { size: Math.round(basis.lost.size), staff: Math.round(basis.lost.staff), closure: Math.round(basis.lost.closure) },
    capacityUnits: Math.round(Math.min(staffCapMonth(pack, before.orders), sizeCapMonth(pack, before.size), hardCapMonth(pack))),
    sizeUtilization: basis.sizeUtilization, lines, revenue: basis.revenue, profit: p.profit,
    cashStart: before.cash, cashEnd: after.cash, taxesAccrued: p.incomeTax, taxesPaid: 0, fines: 0,
    quality: after.quality, reputation: after.reputation, netWorth: netWorth(after, ctx),
    rankInNiche: peers.findIndex((x) => x.id === businessId) + 1,
  };
  const analytics = analyticsFrom(after, cur, ctx, basis, cm, { month: projected.month, daysIntoMonth: RULES.DAYS_PER_MONTH, toDateShare: 0 });
  const res: ScenarioResult = { projected, analytics, business: after };
  cache.set(key, res);
  return res;
}

/** `size` — the month with a different room (the what_if query's `size`, shared/src/types.ts). */
export function whatIf(w: WorldState, ctx: EngineCtx, businessId: string, orders: Partial<StandingOrders>, size?: number): { projected: MonthReport; analytics: Analytics } {
  const r = whatIfWith(w, ctx, businessId, size == null ? { orders } : { orders, size });
  return { projected: r.projected, analytics: r.analytics };
}
