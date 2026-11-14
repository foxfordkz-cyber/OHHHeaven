// recommend: советы системы. Каждое правило срабатывает от чисел, содержит число и готовое действие;
// эффект на прибыль месяца считает whatIf (сценарий против базового прогона на тех же 30 днях).
import type { Action, Analytics, BusinessState, DealTerms, Pack, PackLever, PackLeverOption, Place, Recommendation, StandingOrders, WorldState } from '../../../shared/src/types';
import { RULES } from '../../../shared/src/rules';
import type { EngineCtx } from './link';
import { analyze, currentBasis, modelFor, type Basis } from './analyze';
import { type Scenario, type ScenarioResult, whatIfWith } from './whatif';
import { type CostModel, chosenOption, clamp, itemsCost, legalOptions, maxSizeForPlace, metersBetween, packOf, placeOf, r1, r2, staffCapMonth, staffCount, violationsOf } from './model';
import { num, pct, plural, usd, usd2 } from './text';

interface RC {
  b: BusinessState; w: WorldState; ctx: EngineCtx; pack: Pack; place?: Place;
  a: Analytics; basis: Basis; cm: CostModel;
  base: ScenarioResult;
  run(s: Scenario): ScenarioResult;
  delta(s: Scenario): number;
}

type Rule = (rc: RC) => Recommendation | null;

const SEV: Record<Recommendation['severity'], number> = { critical: 0, warn: 1, info: 2 };

function rec(id: string, severity: Recommendation['severity'], title: string, text: string, suggested?: Action, delta?: number, ruleCardId?: string): Recommendation {
  const r: Recommendation = { id, severity, title, text };
  if (suggested) r.suggested = suggested;
  if (delta != null) r.impact = { profitDeltaMonth: Math.round(delta) };
  if (ruleCardId) r.ruleCardId = ruleCardId;
  return r;
}

const orders = (o: Partial<StandingOrders>): Action => ({ type: 'set_orders', orders: o });
const roundPrice = (p: number, pack: Pack) => clamp(Math.round(p / 0.25) * 0.25, pack.unit.priceMin, pack.unit.priceMax);
const isOperating = (b: BusinessState) => b.status === 'open' || b.status === 'closed';
const mainRole = (pack: Pack) => pack.staff[0];
const wageOf = (pack: Pack, roleId: string) => { const r = pack.staff.find((x) => x.id === roleId); return r ? (r.tipped && r.cashWage != null ? r.cashWage : r.hourlyWage) * r.hoursPerMonth : 0; };

function staffChange(rc: RC, d: number): Record<string, number> | null {
  const cur = { ...rc.b.orders.staff };
  const total = staffCount(rc.b.orders);
  if (total + d < rc.pack.capacity.minStaff || total + d > rc.pack.capacity.maxStaff) return null;
  const role = d > 0 ? mainRole(rc.pack).id : Object.entries(cur).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!role) return null;
  cur[role] = Math.max(0, (cur[role] ?? 0) + d);
  return cur;
}

function cheapestLegalLevers(rc: RC): Record<string, string> {
  const out = { ...rc.b.orders.levers };
  for (const lever of rc.pack.levers) {
    const legal = legalOptions(lever);
    if (legal.length) out[lever.id] = [...legal].sort((a, b) => a.monthlyCost - b.monthlyCost)[0].id;
  }
  return out;
}

function demandUpgrade(rc: RC): { lever: PackLever; option: PackLeverOption; delta: number } | null {
  let best: { lever: PackLever; option: PackLeverOption; delta: number } | null = null;
  for (const lever of rc.pack.levers) {
    const cur = chosenOption(lever, rc.b.orders);
    for (const o of legalOptions(lever)) {
      if ((o.effects?.demand ?? 0) <= (cur.effects?.demand ?? 0)) continue;
      const delta = rc.delta({ orders: { levers: { ...rc.b.orders.levers, [lever.id]: o.id } } });
      if (!best || delta > best.delta) best = { lever, option: o, delta };
    }
  }
  return best;
}

interface Option { label: string; s: Scenario; action: Action }
function bestOf(rc: RC, opts: Option[]): (Option & { delta: number }) | null {
  let best: (Option & { delta: number }) | null = null;
  for (const o of opts) {
    const delta = rc.delta(o.s);
    if (!best || delta > best.delta) best = { ...o, delta };
  }
  return best;
}

function savingOptions(rc: RC): Option[] {
  const out: Option[] = [];
  const cut = staffChange(rc, -1);
  if (cut) out.push({ label: `Drop one ${pack1(rc, cut)}`, s: { orders: { staff: cut } }, action: orders({ staff: cut }) });
  const cheap = cheapestLegalLevers(rc);
  if (JSON.stringify(cheap) !== JSON.stringify(rc.b.orders.levers)) out.push({ label: 'Switch to the cheapest legal options for cleaning, marketing and the rest', s: { orders: { levers: cheap } }, action: orders({ levers: cheap }) });
  const up = roundPrice(rc.b.orders.price * 1.05, rc.pack);
  if (up > rc.b.orders.price) out.push({ label: `Raise your price to ${usd2(up)}`, s: { orders: { price: up } }, action: orders({ price: up }) });
  return out;
}
const pack1 = (rc: RC, staff: Record<string, number>) => {
  const role = Object.keys(rc.b.orders.staff).find((k) => (staff[k] ?? 0) < (rc.b.orders.staff[k] ?? 0)) ?? mainRole(rc.pack).id;
  return rc.pack.staff.find((r) => r.id === role)?.name.toLowerCase() ?? 'worker';
};

function neighbors(rc: RC) {
  if (!rc.place) return [];
  return rc.w.businesses
    .filter((x) => x.id !== rc.b.id && x.status === 'open')
    .map((x) => ({ x, place: placeOf(rc.ctx, x.placeId) }))
    .filter((n): n is { x: BusinessState; place: Place } => !!n.place)
    .map((n) => ({ ...n, meters: Math.round(metersBetween(rc.place!, n.place)) }))
    .sort((p, q) => p.meters - q.meters);
}
const hasDealWith = (rc: RC, otherId: string, type: DealTerms['type']) => rc.w.deals.some((d) => d.terms.type === type
  && (d.status === 'active' || d.status === 'proposed')
  && ((d.fromBusinessId === rc.b.id && d.toBusinessId === otherId) || (d.toBusinessId === rc.b.id && d.fromBusinessId === otherId)));

const cardFor = (rc: RC, ids: string[]) => ids.find((id) => rc.pack.ruleCards.some((c) => c.id === id) || rc.ctx.packs.common.ruleCards.some((c) => c.id === id));

// ───────────────────────── правила ─────────────────────────

const fewSeats: Rule = (rc) => {
  const { b, pack, a, basis } = rc;
  if (!isOperating(b) || basis.demand <= 0) return null;
  const crowded = a.sizeUtilization >= (pack.sizing.crowdPenaltyAbove ?? 0.9) || basis.lost.size >= 0.05 * basis.demand;
  if (!crowded) return null;
  const t = pack.sizing.takeawayShare ?? 0;
  const need = Math.ceil(((basis.served + basis.lost.size) * (1 - t)) / (pack.sizing.unitsServedPerSizeMonth * 0.85));
  const max = maxSizeForPlace(pack, rc.place);
  const target = Math.min(max, Math.max(b.size + 1, need));
  const lostDay = basis.lost.size / RULES.DAYS_PER_MONTH;
  const sev = basis.lost.size >= 0.15 * basis.demand ? 'critical' : 'warn';
  const head = `${num(lostDay)} customers a day walk away for lack of seats — ${num(basis.lost.size)} ${pack.unit.name}s and ${usd(basis.lost.size * a.revenue / Math.max(1, basis.served))} in sales a month.`;
  if (target > b.size) {
    const extra = itemsCost(pack, b.items.filter((i) => pack.setup.find((d) => d.id === i.id)?.scalesWithSize), target) - itemsCost(pack, b.items.filter((i) => pack.setup.find((d) => d.id === i.id)?.scalesWithSize), b.size);
    const d = rc.delta({ size: target });
    return rec('few_seats', sev, `Too few ${pack.sizing.unitName}s`, `${head} Add ${target - b.size} (${b.size} → ${target}); the furniture costs ${usd(extra)} once.`, { type: 'resize', size: target }, d);
  }
  const p = roundPrice(b.orders.price * 1.08, pack);
  if (p <= b.orders.price) return null;
  const d = rc.delta({ orders: { price: p } });
  return rec('few_seats', sev, `Too few ${pack.sizing.unitName}s`, `${head} This space fits no more than ${max}. Raise the price to ${usd2(p)} so the room earns more per seat.`, orders({ price: p }), d);
};

const manySeats: Rule = (rc) => {
  const { b, pack, a, basis } = rc;
  if (!isOperating(b) || basis.served <= 0) return null;
  if (a.sizeUtilization >= (pack.sizing.emptyPenaltyBelow ?? 0.3) || b.size <= pack.sizing.min) return null;
  const t = pack.sizing.takeawayShare ?? 0;
  const need = Math.ceil(((basis.served + basis.lost.size) * (1 - t)) / (pack.sizing.unitsServedPerSizeMonth * 0.7));
  const target = Math.max(pack.sizing.min, need);
  if (target >= b.size) return null;
  const scaled = b.items.filter((i) => pack.setup.find((d) => d.id === i.id)?.scalesWithSize);
  const resale = r2((itemsCost(pack, scaled, b.size) - itemsCost(pack, scaled, target)) * RULES.RESALE_SHARE);
  const upkeep = (b.size - target) * pack.sizing.cleaningCostPerSizeMonth;
  const d = rc.delta({ size: target });
  return rec('many_seats', 'warn', `Too many empty ${pack.sizing.unitName}s`, `Your room is only ${pct(a.sizeUtilization)} full. ${b.size - target} empty ${pack.sizing.unitName}s cost ${usd(upkeep)} a month in upkeep and make the place feel dead. Shrink to ${target}; the furniture sells back for ${usd(resale)}.`, { type: 'resize', size: target }, d);
};

function priceRule(dir: 1 | -1): Rule {
  return (rc) => {
    const { b, pack, basis } = rc;
    if (!isOperating(b) || basis.served <= 0) return null;
    const up = roundPrice(b.orders.price * 1.08, pack), down = roundPrice(b.orders.price * 0.92, pack);
    const dUp = up > b.orders.price ? rc.delta({ orders: { price: up } }) : -Infinity;
    const dDown = down < b.orders.price ? rc.delta({ orders: { price: down } }) : -Infinity;
    const threshold = Math.max(100, 0.005 * rc.a.revenue);
    const target = dir > 0 ? up : down, d = dir > 0 ? dUp : dDown, other = dir > 0 ? dDown : dUp;
    if (!(d >= threshold && d >= other)) return null;
    const r = rc.run({ orders: { price: target } });
    const ch = (r.projected.servedUnits - rc.base.projected.servedUnits) / Math.max(1, rc.base.projected.servedUnits);
    const sev = d >= 300 ? 'warn' : 'info';
    return dir > 0
      ? rec('price_up', sev, 'Your price is below what this street pays', `Raising the price from ${usd2(b.orders.price)} to ${usd2(target)} adds about ${usd(d)} a month: you lose ${pct(Math.abs(ch))} of ${pack.unit.name}s but earn more on each.`, orders({ price: target }), d)
      : rec('price_down', sev, 'Your price is scaring customers away', `Cutting the price from ${usd2(b.orders.price)} to ${usd2(target)} brings ${pct(Math.abs(ch))} more ${pack.unit.name}s and about ${usd(d)} more profit a month.`, orders({ price: target }), d);
  };
}

const staffCut: Rule = (rc) => {
  const { b, a, basis, pack } = rc;
  if (!isOperating(b) || a.utilization >= 0.6 || basis.lost.staff >= 1) return null;
  const s = staffChange(rc, -1);
  if (!s) return null;
  const d = rc.delta({ orders: { staff: s } });
  if (d <= 0) return null;
  const cap = staffCapMonth(pack, b.orders);
  return rec('staff_cut', 'warn', 'More people than the work needs', `Your team could serve ${num(cap)} ${pack.unit.name}s a month but sells ${num(basis.served)} — ${pct(a.utilization)} busy. One fewer ${pack1(rc, s)} saves about ${usd(d)} a month.`, orders({ staff: s }), d);
};

const staffAdd: Rule = (rc) => {
  const { b, a, basis, pack } = rc;
  if (!isOperating(b)) return null;
  if (!(basis.lost.staff >= 0.05 * Math.max(1, basis.demand) || a.utilization >= 0.97)) return null;
  const s = staffChange(rc, +1);
  if (!s) return null;
  const d = rc.delta({ orders: { staff: s } });
  if (d <= 0) return null;
  const role = mainRole(pack);
  const sev = basis.lost.staff >= 0.15 * basis.demand ? 'critical' : 'warn';
  return rec('staff_add', sev, 'Not enough hands', `${num(basis.lost.staff)} ${pack.unit.name}s a month are lost because the team can’t keep up. One more ${role.name.toLowerCase()} costs ${usd(wageOf(pack, role.id))} a month and adds about ${usd(d)} in profit.`, orders({ staff: s }), d);
};

const laborHigh: Rule = (rc) => {
  const { a, pack, b } = rc;
  if (!isOperating(b) || a.revenue <= 0 || a.laborPct <= pack.benchmarks.laborPct + 0.05) return null;
  const opts = savingOptions(rc).filter((o) => !o.label.startsWith('Switch'));
  const best = bestOf(rc, opts);
  if (!best || best.delta <= 0) return null;
  const sev = a.laborPct > pack.benchmarks.laborPct + 0.1 ? 'warn' : 'info';
  return rec('labor_high', sev, 'Labor costs above the norm', `Labor eats ${pct(a.laborPct)} of sales; for this kind of business the norm is about ${pct(pack.benchmarks.laborPct)}. ${best.label}: about ${usd(best.delta)} a month more profit.`, best.action, best.delta);
};

const cogsHigh: Rule = (rc) => {
  const { a, pack, b } = rc;
  if (!isOperating(b) || a.revenue <= 0 || a.cogsPct <= pack.benchmarks.cogsPct + 0.04) return null;
  const opts: Option[] = [];
  const same = neighbors(rc).find((n) => n.x.niche === b.niche && !hasDealWith(rc, n.x.id, 'joint_purchase'));
  if (same) opts.push({ label: `Buy supplies together with ${same.x.name}`, s: { deals: [{ partnerId: same.x.id, terms: { type: 'joint_purchase', months: 3 } }] }, action: { type: 'propose_deal', toBusinessId: same.x.id, terms: { type: 'joint_purchase', months: 3 } } });
  const up = roundPrice(b.orders.price * 1.05, pack);
  if (up > b.orders.price) opts.push({ label: `Raise your price to ${usd2(up)}`, s: { orders: { price: up } }, action: orders({ price: up }) });
  const best = bestOf(rc, opts);
  if (!best || best.delta <= 0) return null;
  return rec('cogs_high', 'info', 'Cost of goods above the norm', `Cost of goods is ${pct(a.cogsPct)} of sales; the norm is about ${pct(pack.benchmarks.cogsPct)}. ${best.label}: about ${usd(best.delta)} a month.`, best.action, best.delta);
};

const rentHigh: Rule = (rc) => {
  const { a, pack, b, cm } = rc;
  if (!isOperating(b) || a.revenue <= 0 || a.rentPct <= pack.benchmarks.rentPct + 0.04) return null;
  const up = demandUpgrade(rc);
  if (!up || up.delta <= 0) return null;
  const neededSales = cm.rent / pack.benchmarks.rentPct;
  const lv = { ...b.orders.levers, [up.lever.id]: up.option.id };
  return rec('rent_high', 'info', 'Rent is heavy for your sales', `Rent is ${pct(a.rentPct)} of sales; the norm is about ${pct(pack.benchmarks.rentPct)}. At ${usd(cm.rent)} rent that norm needs ${usd(neededSales)} in sales a month. ${up.lever.name}: “${up.option.label}” (${usd(up.option.monthlyCost)}/month) adds about ${usd(up.delta)} profit.`, orders({ levers: lv }), up.delta);
};

const taxCashShort: Rule = (rc) => {
  const { a, b, w } = rc;
  if (!a.taxDueNext) return null;
  const daysLeft = a.taxDueNext.day - w.day;
  const weekCosts = Math.max(0, a.fixedCostsMonth) / 4.3;
  if (daysLeft < 0 || daysLeft > 14 || b.cash >= a.taxDueNext.amount + weekCosts) return null;
  const best = bestOf(rc, savingOptions(rc));
  const short = a.taxDueNext.amount + weekCosts - b.cash;
  const text = `${usd(a.taxDueNext.amount)} in taxes is due on day ${a.taxDueNext.day} (${plural(daysLeft, 'day')} from now). You have ${usd(b.cash)} — short by ${usd(short)} once a week of costs is paid. Spending collected sales tax is how cafes go bankrupt on the due date.`;
  return rec('tax_cash_short', 'critical', 'Tax due soon, cash too thin', best ? `${text} ${best.label}.` : text, best?.action ?? orders({ levers: cheapestLegalLevers(rc) }), best?.delta, cardFor(rc, ['sales_tax']));
};

const runwayShort: Rule = (rc) => {
  const { a } = rc;
  if (a.cashRunwayMonths == null || a.cashRunwayMonths >= 2) return null;
  const best = bestOf(rc, savingOptions(rc));
  const sev = a.cashRunwayMonths < 1 ? 'critical' : 'warn';
  const head = `At this pace your cash lasts ${r1(a.cashRunwayMonths)} months: you lose ${usd(-a.profit)} a month.`;
  if (!best || best.delta <= 0) return rec('runway_short', sev, 'Running out of cash', `${head} Cut costs now.`, orders({ levers: cheapestLegalLevers(rc) }));
  return rec('runway_short', sev, 'Running out of cash', `${head} ${best.label}: about ${usd(best.delta)} a month back.`, best.action, best.delta);
};

const exposureHigh: Rule = (rc) => {
  const { a, b, pack } = rc;
  const saved = r2(b.trails.filter((t) => !t.discovered).reduce((s, t) => s + t.saved, 0));
  const risky = pack.levers.filter((l) => chosenOption(l, b.orders).causes);
  if (a.exposure <= 0 || a.exposure <= saved || (!b.orders.shortcuts.length && !risky.length)) return null;
  const levers = { ...b.orders.levers };
  for (const l of risky) levers[l.id] = [...legalOptions(l)].sort((x, y) => x.monthlyCost - y.monthlyCost)[0]?.id ?? levers[l.id];
  const change: Partial<StandingOrders> = { shortcuts: [], levers };
  const d = rc.delta({ orders: change });
  const card = cardFor(rc, [...b.trails.map((t) => t.violationId), 'workers_comp', 'payroll_taxes']);
  return rec('exposure_high', 'critical', 'The fines would dwarf what you saved', `If an inspector finds what you are doing, fines total about ${usd(a.exposure)} — you have saved only ${usd(saved)} by cutting corners. Stop now: a trail fades ${RULES.TRAIL_EXPIRY_MONTHS} months after the last violation.`, orders(change), d, card);
};

const eventAhead: Rule = (rc) => {
  const { b, w, pack, place } = rc;
  if (!isOperating(b)) return null;
  let found: { title: string; from: number; to: number; mult: number } | null = null;
  for (const e of w.events) {
    if (e.startDay <= w.day || e.startDay > w.day + 7) continue;
    if (e.block && place && e.block !== place.block) continue;
    const mult = e.effects.filter((f) => (f.target === 'demand' || f.target === 'footTraffic') && (!f.niches || f.niches.includes(b.niche)) && (!f.tiers || !place || f.tiers.includes(place.tier)))
      .reduce((m, f) => m * clamp(f.mult, 0.5, 1.5), 1);
    if (Math.abs(mult - 1) >= 0.1) { found = { title: e.title, from: e.startDay, to: e.endDay, mult }; break; }
  }
  if (!found) {
    const bad = w.weather.filter((d) => d.day > w.day && d.day <= w.day + 7 && d.footTrafficMult <= 0.75);
    if (bad.length >= 2) found = { title: `${bad[0].label} weather`, from: bad[0].day, to: bad[bad.length - 1].day, mult: bad.reduce((s, d) => s + d.footTrafficMult, 0) / bad.length };
  }
  if (!found) return null;
  const s = staffChange(rc, found.mult < 1 ? -1 : +1);
  if (!s) return null;
  const d = rc.delta({ orders: { staff: s } });
  const ch = Math.round((found.mult - 1) * 100);
  const action = found.mult < 1 ? `Schedule one fewer ${pack1(rc, s)}` : `Bring in one more ${mainRole(pack).name.toLowerCase()}`;
  return rec('event_ahead', 'info', `Ahead: ${found.title}`, `${found.title}, days ${found.from}–${found.to}: foot traffic ${ch > 0 ? '+' : ''}${ch}%. ${action} for those days and switch back after (over a full month this change is worth ${usd(d)}).`, orders({ staff: s }), d);
};

const jointPurchase: Rule = (rc) => {
  const { b, pack } = rc;
  if (!isOperating(b)) return null;
  const n = neighbors(rc).find((x) => x.x.niche === b.niche && !hasDealWith(rc, x.x.id, 'joint_purchase'));
  if (!n) return null;
  const terms: DealTerms = { type: 'joint_purchase', months: 3 };
  const d = rc.delta({ deals: [{ partnerId: n.x.id, terms }] });
  return rec('joint_purchase', 'info', 'Buy supplies together', `${n.x.name} sells ${pack.unit.name}s too, ${num(n.meters)} m away. Buy together for 3 months: cost per ${pack.unit.name} −${Math.round((1 - RULES.JOINT_PURCHASE_COGS_MULT) * 100)}%, about ${usd(d)} a month for you.`, { type: 'propose_deal', toBusinessId: n.x.id, terms }, d);
};

const crossPromo: Rule = (rc) => {
  const { b } = rc;
  if (!isOperating(b)) return null;
  const n = neighbors(rc).find((x) => x.x.niche !== b.niche && x.meters <= 400 && !hasDealWith(rc, x.x.id, 'cross_promo'));
  if (!n) return null;
  const terms: DealTerms = { type: 'cross_promo', months: 3 };
  const d = rc.delta({ deals: [{ partnerId: n.x.id, terms }] });
  return rec('cross_promo', 'info', 'Swap customers with a neighbor', `${n.x.name} (${n.x.niche}) is ${num(n.meters)} m away. Send each other customers for 3 months: +${Math.round((RULES.CROSS_PROMO_DEMAND_MULT - 1) * 100)}% demand for a ${Math.round((1 - RULES.CROSS_PROMO_PRICE_MULT) * 100)}% discount — about ${usd(d)} a month.`, { type: 'propose_deal', toBusinessId: n.x.id, terms }, d);
};

const blockFundOneShort: Rule = (rc) => {
  const { b, w, ctx, place } = rc;
  if (!isOperating(b) || !place || b.orders.blockFund) return null;
  const onBlock = w.businesses.filter((x) => x.status === 'open' && placeOf(ctx, x.placeId)?.block === place.block);
  const eligible = onBlock.length;
  const payers = onBlock.filter((x) => x.orders.blockFund).length;
  if (eligible < 2 || payers / eligible >= RULES.BLOCK_FUND_THRESHOLD || (payers + 1) / eligible < RULES.BLOCK_FUND_THRESHOLD) return null;
  const d = rc.delta({ orders: { blockFund: true }, blockFundActive: true });
  return rec('block_fund_one_short', 'info', 'Your block is one payer short', `${payers} of ${eligible} businesses on your block pay into the block fund; one more and everyone gets +${Math.round((RULES.BLOCK_FUND_TRAFFIC_MULT - 1) * 100)}% foot traffic. Your share is ${usd(RULES.BLOCK_FUND_FEE_MONTH)} a month; worth about ${usd(d)} to you.`, orders({ blockFund: true }), d);
};

const launchReady: Rule = (rc) => {
  const { b, pack, w, cm } = rc;
  if (b.status !== 'setup') return null;
  const required = pack.setup.filter((s) => s.required && s.waitDays && b.items.some((i) => i.id === s.id));
  const ready = required.every((s) => { const p = b.permits.find((x) => x.itemId === s.id); return !p || p.readyDay <= w.day; });
  if (!ready) return null;
  const opened = rc.run({ launch: true });
  const d = opened.analytics.profit - rc.base.analytics.profit;
  return rec('launch_ready', 'warn', 'Permits are ready — open the doors', `All ${plural(required.length, 'permit')} are in hand. Every closed day costs ${usd(cm.rent / RULES.DAYS_PER_MONTH)} in rent. Open now: projected ${usd(opened.analytics.profit)} profit in the first month.`, { type: 'launch' }, d, cardFor(rc, ['fse_permit']));
};

const noticeWaiting: Rule = (rc) => {
  const { b, w, ctx, pack } = rc;
  const c = w.cases.find((x) => x.businessId === b.id && x.status === 'notice');
  if (!c || c.fine == null) return null;
  const contestCost = r2(c.fine * RULES.CONTEST_FINE_MULT + RULES.CONTEST_FEE);
  const contest = contestCost < c.fine;
  const names = (c.found ?? []).map((f) => violationsOf(ctx.packs.common, pack).find((v) => v.id === f.violationId)?.name ?? f.violationId);
  const closure = c.closureDays ? ` and ${plural(c.closureDays, 'day')} closed` : '';
  const sev = c.fine > b.cash ? 'critical' : 'warn';
  const text = `The ${c.role === 'inspector' ? 'inspector' : 'auditor'} found ${names.length ? names.join(', ') : 'violations'}: fine ${usd(c.fine)}${closure}. Answer by day ${c.answerByDay ?? w.day}. Contesting costs ${usd(RULES.CONTEST_FEE)} for a lawyer and cuts the fine to ${usd(c.fine * RULES.CONTEST_FINE_MULT)} — ${contest ? `you save ${usd(c.fine - contestCost)}` : `${usd(contestCost - c.fine)} more than paying`}.`;
  return rec('notice_waiting', sev, 'A fine is waiting for your answer', text, { type: 'answer_notice', caseId: c.id, response: contest ? 'contest' : 'pay' }, contest ? c.fine - contestCost : 0, cardFor(rc, (c.found ?? []).map((f) => f.violationId)));
};

const riskyLever: Rule = (rc) => {
  const { b, pack, ctx } = rc;
  for (const lever of pack.levers) {
    const o = chosenOption(lever, b.orders);
    if (!o.causes) continue;
    const legal = [...legalOptions(lever)].sort((x, y) => x.monthlyCost - y.monthlyCost)[0];
    if (!legal) continue;
    const v = violationsOf(ctx.packs.common, pack).find((x) => x.id === o.causes);
    const lv = { ...b.orders.levers, [lever.id]: legal.id };
    const d = rc.delta({ orders: { levers: lv } });
    return rec('risky_lever', 'warn', `${lever.name}: this option breaks the law`, `“${o.label}” saves ${usd(legal.monthlyCost - o.monthlyCost)} a month but counts as ${v?.name ?? o.causes}: fines start at ${usd(v?.fine.base ?? 0)}. Switch to “${legal.label}”.`, orders({ levers: lv }), d, cardFor(rc, [o.causes]));
  }
  return null;
};

const managerCostly: Rule = (rc) => {
  const { b, a, pack } = rc;
  if (b.orders.autopilot !== 'manager' || a.profit >= pack.manager.monthlySalary) return null;
  const d = rc.delta({ orders: { autopilot: 'hold' } });
  if (d <= 0) return null;
  return rec('manager_costly', 'info', 'The manager costs more than the business makes', `Your manager costs ${usd(pack.manager.monthlySalary)} a month and the business makes ${usd(a.profit)}. Running it yourself adds about ${usd(d)} a month.`, orders({ autopilot: 'hold' }), d);
};

const idleCash: Rule = (rc) => {
  const { b, a } = rc;
  if (!isOperating(b) || a.profit <= 0 || b.cash < 4 * Math.max(1, a.fixedCostsMonth) || a.sizeUtilization >= 0.6 || a.utilization >= 0.7) return null;
  const up = demandUpgrade(rc);
  if (!up || up.delta <= 0) return null;
  const lv = { ...b.orders.levers, [up.lever.id]: up.option.id };
  return rec('idle_cash_marketing', 'info', 'Idle cash, empty seats', `You have ${usd(b.cash)} in the bank and the room is ${pct(a.sizeUtilization)} full. ${up.lever.name}: “${up.option.label}” (${usd(up.option.monthlyCost)}/month) brings about ${usd(up.delta)} more profit.`, orders({ levers: lv }), up.delta);
};

export const RULE_IDS = ['few_seats', 'many_seats', 'price_up', 'price_down', 'staff_cut', 'staff_add', 'labor_high', 'cogs_high', 'rent_high', 'tax_cash_short', 'runway_short', 'exposure_high', 'event_ahead', 'joint_purchase', 'cross_promo', 'block_fund_one_short', 'launch_ready', 'notice_waiting', 'risky_lever', 'manager_costly', 'idle_cash_marketing'] as const;

const RULES_LIST: Rule[] = [fewSeats, manySeats, priceRule(1), priceRule(-1), staffCut, staffAdd, laborHigh, cogsHigh, rentHigh, taxCashShort, runwayShort, exposureHigh, eventAhead, jointPurchase, crossPromo, blockFundOneShort, launchReady, noticeWaiting, riskyLever, managerCostly, idleCash];

const recMemo = new WeakMap<WorldState, Map<string, Recommendation[]>>();

export function recommend(b: BusinessState, w: WorldState, ctx: EngineCtx): Recommendation[] {
  if (b.status === 'bankrupt') return [];
  let cache = recMemo.get(w);
  if (!cache) { cache = new Map(); recMemo.set(w, cache); }
  const key = JSON.stringify([b.id, b.orders, b.size, b.status, b.cash]);
  const hit = cache.get(key);
  if (hit) return hit;
  const same = w.businesses.includes(b);
  const inWorld = w.businesses.some((x) => x.id === b.id);
  const world = same ? w : inWorld ? { ...w, businesses: w.businesses.map((x) => (x.id === b.id ? b : x)) } : { ...w, businesses: [...w.businesses, b] };
  const base = whatIfWith(world, ctx, b.id, {});
  const rc: RC = {
    b, w: world, ctx, pack: packOf(ctx, b.niche), place: placeOf(ctx, b.placeId),
    a: analyze(b, world, ctx), basis: currentBasis(b, world), cm: modelFor(b, world, ctx),
    base,
    run: (s) => whatIfWith(world, ctx, b.id, s),
    delta: (s) => Math.round(whatIfWith(world, ctx, b.id, s).analytics.profit - base.analytics.profit),
  };
  const out: Recommendation[] = [];
  const seen = new Set<string>();
  const all = RULES_LIST.map((r) => r(rc)).filter((r): r is Recommendation => !!r)
    .sort((x, y) => SEV[x.severity] - SEV[y.severity] || (y.impact?.profitDeltaMonth ?? 0) - (x.impact?.profitDeltaMonth ?? 0));
  for (const r of all) {
    const k = r.suggested ? JSON.stringify(r.suggested) : r.id;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  cache.set(key, out);
  return out;
}

