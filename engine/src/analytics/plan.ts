// realWorldPlan: то, что человек унесёт в жизнь. Бюджет из того, что он купил; расходы из его книг;
// резерв на шесть месяцев постоянных расходов (без срезанных углов); документы; поставщики; три урока.
import type { BusinessState, Money, Pack, PackRoadmapStep, PackSetupItem, Place, RealWorldPlan, RoadmapItem, WorldState } from '../../../shared/src/types';
import { RULES } from '../../../shared/src/rules';
import { buildoutOf, daysToOpenOf, distanceM, footfallParams, isTakeover, rentMonthOf, rivalsOf, setupItemCost } from '../../../shared/src/place';
import type { EngineCtx } from './link';
import { analyze, currentBasis, modelFor } from './analyze';
import { orderedSteps, roadmapFor } from './roadmap';
import { chosenOption, costModel, packOf, placeOf, r2, sumLines, violationsOf } from './model';
import { num, pct, plural, usd, usd2 } from './text';

/** $88 for whole dollars, $87.50 when the cents matter. */
const usdRate = (x: number): string => (Math.round(x) === x ? usd(x) : usd2(x));

export const DISCLAIMER = 'This is a training simulation, not legal, tax or financial advice. Rules, fees and wait times change; check them with the agencies listed and a licensed professional before you spend real money.';

/** One setup item as this player paid for it: priced at this place (build-out by what the space was, deposit by its rent). */
interface PricedItem { def: PackSetupItem; qty: number; unit: Money; amount: Money }

function pricedItems(b: BusinessState, pack: Pack, place: Place | undefined): PricedItem[] {
  return b.items.map((it) => {
    const def = pack.setup.find((d) => d.id === it.id);
    if (!def) return null;
    const qty = def.scalesWithSize ? b.size : it.qty;
    const unit = setupItemCost(pack, def, place);
    return { def, qty, unit, amount: r2(unit * qty) };
  }).filter((x): x is PricedItem => !!x && x.amount > 0);
}

function startupBudget(b: BusinessState, ctx: EngineCtx): { label: string; amount: Money }[] {
  const pack = packOf(ctx, b.niche);
  const place = placeOf(ctx, b.placeId);
  const lines = pricedItems(b, pack, place).map((p) => ({ label: p.qty > 1 ? `${p.def.name} × ${p.qty}` : p.def.name, amount: p.amount }));
  if (place && isTakeover(pack, place)) lines.unshift({ label: `Buying the operating business at ${place.address}`, amount: r2(place.forSale!.askingPrice) });
  if (!lines.length && b.setupSpent > 0) lines.push({ label: 'Setup (equipment, build-out, permits)', amount: r2(b.setupSpent) });
  return lines;
}

function monthlyFromBooks(b: BusinessState, w: WorldState, ctx: EngineCtx): { label: string; amount: Money }[] {
  const months = b.history.filter((m) => m.revenue > 0 || m.lines.length > 0);
  const skip = new Set(['fine', 'setup', 'tax', 'saving', 'revenue']);
  if (months.length) {
    const acc = new Map<string, number>();
    for (const m of months) for (const l of m.lines) {
      if (skip.has(l.kind) || l.amount >= 0) continue;
      acc.set(l.label, (acc.get(l.label) ?? 0) - l.amount);
    }
    return [...acc.entries()].map(([label, sum]) => ({ label, amount: r2(sum / months.length) })).sort((x, y) => y.amount - x.amount);
  }
  const basis = currentBasis(b, w);
  const cm = modelFor(b, w, ctx);
  const lines = [
    ...(basis.cogs > 0 ? [{ label: 'Cost of goods', amount: r2(basis.cogs) }] : []),
    ...cm.variableLines(basis.served, basis.revenue).map((l) => ({ label: l.label, amount: l.amount })),
    ...cm.fixed.map((l) => ({ label: l.label, amount: l.amount })),
  ];
  return lines.filter((l) => l.amount > 0).sort((x, y) => y.amount - x.amount);
}

function checklist(b: BusinessState, ctx: EngineCtx): PackRoadmapStep[] {
  const pack = packOf(ctx, b.niche);
  const steps = orderedSteps(ctx, b.niche).filter((s) => s.agency || s.link || s.fee != null);
  const covered = new Set(steps.map((s) => s.setupItemId).filter(Boolean));
  for (const d of pack.setup) {
    if (!(d.kind === 'permit' || d.kind === 'license') || covered.has(d.id)) continue;
    steps.push({ id: `item_${d.id}`, title: `Get: ${d.name}`, text: `Required before you open. Fee ${usd(d.cost)}.`, kind: 'permit', setupItemId: d.id, fee: d.cost, waitDays: d.waitDays, agency: d.agency, link: d.link });
  }
  return steps;
}

function lessons(b: BusinessState, w: WorldState, ctx: EngineCtx): RealWorldPlan['lessons'] {
  const pack = packOf(ctx, b.niche);
  const vs = violationsOf(ctx.packs.common, pack);
  const out: RealWorldPlan['lessons'] = [];
  const cardIds = new Set([...pack.ruleCards, ...ctx.packs.common.ruleCards].map((c) => c.id));
  // штрафы — по найденным нарушениям в делах
  for (const c of w.cases.filter((x) => x.businessId === b.id && (x.outcome === 'fined' || x.status === 'notice'))) {
    for (const f of c.found ?? []) {
      const v = vs.find((x) => x.id === f.violationId);
      out.push({ title: `Fine: ${v?.name ?? f.violationId}`, amount: r2(f.fine), lesson: `${v?.law ?? 'The law'} — the saving was not worth it. Fines grow every month the problem lasts.`, ruleCardId: cardIds.has(f.violationId) ? f.violationId : undefined });
    }
  }
  const fineLines = -b.history.flatMap((m) => m.lines).filter((l) => l.kind === 'fine').reduce((s, l) => s + l.amount, 0);
  if (!out.length && fineLines > 0) out.push({ title: 'Fines', amount: r2(fineLines), lesson: 'Every fine came from a corner you cut. Fix it before an inspector finds it.' });
  // потерянные продажи по причинам, в упущенной марже
  let size = 0, staff = 0, closure = 0;
  let rentOver = 0, laborOver = 0;
  for (const m of b.history) {
    const cogs = -m.lines.filter((l) => l.kind === 'cogs').reduce((s, l) => s + l.amount, 0);
    const margin = m.servedUnits > 0 ? Math.max(0, m.avgPrice - cogs / m.servedUnits) : 0;
    size += m.lost.size * margin; staff += m.lost.staff * margin; closure += m.lost.closure * margin;
    const rent = -m.lines.filter((l) => l.kind === 'rent').reduce((s, l) => s + l.amount, 0);
    const labor = -m.lines.filter((l) => l.kind === 'payroll' || l.kind === 'payroll_tax').reduce((s, l) => s + l.amount, 0);
    if (m.revenue > 0) { rentOver += Math.max(0, rent - pack.benchmarks.rentPct * m.revenue); laborOver += Math.max(0, labor - pack.benchmarks.laborPct * m.revenue); }
  }
  const lostUnits = (k: 'size' | 'staff' | 'closure') => b.history.reduce((s, m) => s + m.lost[k], 0);
  if (size > 0) out.push({ title: `Customers turned away: not enough ${pack.sizing.unitName}s`, amount: r2(size), lesson: `${num(lostUnits('size'))} ${pack.unit.name}s walked out because there was nowhere to sit. Size the room to the busiest hour, not the average.` });
  if (staff > 0) out.push({ title: 'Customers turned away: not enough staff', amount: r2(staff), lesson: `${num(lostUnits('staff'))} ${pack.unit.name}s were lost to the line. One more person on the busy shift often pays for itself.` });
  if (closure > 0) out.push({ title: 'Sales lost while closed', amount: r2(closure), lesson: 'Closed days still cost rent and wages. Permits and inspections decide when you can sell.' });
  if (rentOver > 0) out.push({ title: 'Rent above the norm', amount: r2(rentOver), lesson: `Rent should be near ${pct(pack.benchmarks.rentPct)} of sales. Negotiate, pick a cheaper block, or plan the sales that justify the address.` });
  if (laborOver > 0) out.push({ title: 'Labor above the norm', amount: r2(laborOver), lesson: `Labor should be near ${pct(pack.benchmarks.laborPct)} of sales. Schedule people to the hours that sell.` });
  return out.filter((l) => l.amount > 0).sort((x, y) => y.amount - x.amount).slice(0, 3);
}

// ───────────────────────── The plan of this player ─────────────────────────
// RealWorldPlan in shared/src/types.ts has no room for it (only the lead changes that file), so it travels as
// `extra.personal`. The client reads the same shape (client/src/screens/end/personal.ts).

export interface PlanPlace {
  address: string; block: string; sqft: number; tier: Place['tier'];
  rentMonth: Money; deposit: Money | null; depositMonths: number | null;
  formerUse: string | null;
  buildout: { label: string; perSqft: Money; days: number; cost: Money } | null;
  takeoverPrice: Money | null;
  pedestriansPerDay: number | null;
  rivals: { real150m: number; players: number; radiusM: number; nearest: { name: string; distM: number } | null };
}
export interface PlanMoneyPart { id: 'takeover' | 'deposit' | 'buildout' | 'equipment' | 'permits' | 'inventory' | 'other' | 'rent_before_open'; label: string; amount: Money }
export interface PlanSummary {
  cashBeforeFirstSale: Money; parts: PlanMoneyPart[];
  daysToOpen: number; weeksToOpen: number; opened: boolean;
  reserve: Money; reserveMonths: number; totalNeeded: Money;
  /** What the research notes budget in real life for this kind of space (rent paid before the first sale). */
  realLife: { rentMonths: number; amount: Money; note: string; source?: string } | null;
}
export interface PlanRisk { id: 'rivals' | 'rent' | 'before_open' | 'cash' | 'break_even' | 'fines' | 'lost'; title: string; amount: Money | null; why: string; fix: string }
export interface PlanStaffLine { roleId: string; name: string; count: number; hourlyWage: Money; hoursPerMonth: number; monthly: Money }
export interface PlanItemLine { id: string; name: string; kind: PackSetupItem['kind']; qty: number; unit: Money; total: Money }
export interface PlanStepMine { status: RoadmapItem['status']; readyDay?: number; mine?: string }
export interface PersonalPlan {
  place: PlanPlace | null;
  size: number; sizeUnit: string; price: Money; refPrice: Money; unitName: string;
  staff: PlanStaffLine[]; payrollMonth: Money; payrollTaxMonth: Money;
  equipment: PlanItemLine[]; equipmentTotal: Money;
  firstOrder: { name: string; amount: Money; sourcing: string | null } | null;
  summary: PlanSummary;
  risks: PlanRisk[];
  /** supplier id → why it matters for this player; suppliers that match a choice come first in `supplierOrder`. */
  supplierWhy: Record<string, string>; supplierOrder: string[];
  /** step id → its status in this player's season and a line with this player's numbers. */
  steps: Record<string, PlanStepMine>;
}
export type PersonalRealWorldPlan = RealWorldPlan & { extra: { personal: PersonalPlan } };

/** Insurance the owner buys (not the unemployment insurance tax). */
const isInsurance = (m: { label: string }): boolean => /insurance|owner's policy/i.test(m.label) && !/unemployment/i.test(m.label);

const EQUIPMENT_KINDS = new Set<PackSetupItem['kind']>(['equipment', 'furniture']);
const PERMIT_KINDS = new Set<PackSetupItem['kind']>(['permit', 'license']);

function partOf(def: PackSetupItem): PlanMoneyPart['id'] {
  if (def.kind === 'deposit') return 'deposit';
  if (def.kind === 'buildout' || def.costBasis === 'per_sqft' || def.costBasis === 'pct_of_buildout') return 'buildout';
  if (EQUIPMENT_KINDS.has(def.kind)) return 'equipment';
  if (PERMIT_KINDS.has(def.kind)) return 'permits';
  if (def.kind === 'inventory') return 'inventory';
  return 'other';
}
const PART_LABEL: Record<PlanMoneyPart['id'], string> = {
  takeover: 'Buying the business', deposit: 'Lease deposit', buildout: 'Build-out and design', equipment: 'Equipment and furniture',
  permits: 'Permits and licenses', inventory: 'Opening order', other: 'Legal, hiring, insurance and other', rent_before_open: 'Rent before the first sale',
};

function placePart(b: BusinessState, w: WorldState, ctx: EngineCtx, pack: Pack, place: Place | undefined, items: PricedItem[]): PlanPlace | null {
  if (!place) return null;
  const deposit = items.find((i) => i.def.kind === 'deposit');
  const bo = buildoutOf(pack, place);
  const radiusM = footfallParams(pack)?.radiusM ?? 250;
  const real = rivalsOf(place, b.niche);
  const players = w.businesses.filter((x) => x.id !== b.id && x.niche === b.niche && x.status !== 'bankrupt').map((x) => {
    const p = placeOf(ctx, x.placeId);
    return p ? { name: x.name, distM: Math.round(distanceM(place, p)) } : null;
  }).filter((x): x is { name: string; distM: number } => !!x && x.distM < radiusM);
  const nearest = [...players, ...(real?.nearest ?? [])].sort((x, y) => x.distM - y.distM)[0] ?? null;
  return {
    address: place.address, block: place.block, sqft: place.sqft, tier: place.tier,
    rentMonth: rentMonthOf(place),
    deposit: deposit ? deposit.amount : null,
    depositMonths: deposit?.def.costBasis === 'months_rent' ? deposit.def.rate ?? null : null,
    formerUse: place.formerUse ?? null,
    buildout: bo && !isTakeover(pack, place) ? { label: bo.label, perSqft: bo.perSqft, days: bo.days, cost: bo.cost } : null,
    takeoverPrice: isTakeover(pack, place) ? place.forSale!.askingPrice : null,
    pedestriansPerDay: place.pedestriansPerDay ?? null,
    rivals: { real150m: real?.within150m ?? 0, players: players.length, radiusM, nearest },
  };
}

/** Research notes' rent months before opening for this kind of space (pack.extra.realTimeline), keyed by build-out class. */
function realLifeRent(pack: Pack, place: Place | undefined): PlanSummary['realLife'] {
  const t = (pack.extra as { realTimeline?: { preOpeningRentMonths?: Record<string, number>; note?: string; source?: string } } | undefined)?.realTimeline;
  const bo = buildoutOf(pack, place);
  if (!t?.preOpeningRentMonths || !place || !bo) return null;
  const key = { light: 'almostReady', standard: 'typicalRefit', heavy: 'heavyConversion' }[bo.classId];
  const months = t.preOpeningRentMonths[key];
  if (typeof months !== 'number') return null;
  return { rentMonths: months, amount: r2(months * rentMonthOf(place)), note: t.note ?? '', source: t.source };
}

function summaryPart(b: BusinessState, pack: Pack, place: Place | undefined, items: PricedItem[], reserve: Money, fixedMonth: Money): PlanSummary {
  const acc = new Map<PlanMoneyPart['id'], Money>();
  const add = (id: PlanMoneyPart['id'], x: Money) => acc.set(id, r2((acc.get(id) ?? 0) + x));
  if (place && isTakeover(pack, place)) add('takeover', place.forSale!.askingPrice);
  for (const it of items) add(partOf(it.def), it.amount);
  const opened = b.openedDay != null;
  const daysToOpen = Math.max(0, opened ? b.openedDay! - b.createdDay : daysToOpenOf(pack, b.items, place));
  const rentDay = place ? rentMonthOf(place) / RULES.DAYS_PER_MONTH : 0;
  if (daysToOpen > 0 && rentDay > 0) add('rent_before_open', r2(daysToOpen * rentDay));
  const order: PlanMoneyPart['id'][] = ['takeover', 'buildout', 'equipment', 'deposit', 'rent_before_open', 'other', 'inventory', 'permits'];
  const parts = order.filter((id) => (acc.get(id) ?? 0) > 0).map((id) => ({ id, label: PART_LABEL[id], amount: acc.get(id)! }));
  const cashBeforeFirstSale = sumLines(parts);
  return {
    cashBeforeFirstSale, parts, daysToOpen, weeksToOpen: Math.max(1, Math.ceil(daysToOpen / 7)), opened,
    reserve, reserveMonths: fixedMonth > 0 ? Math.round((reserve / fixedMonth) * 10) / 10 : 0,
    totalNeeded: r2(cashBeforeFirstSale + reserve),
    realLife: realLifeRent(pack, place),
  };
}

function risksPart(b: BusinessState, w: WorldState, ctx: EngineCtx, pack: Pack, place: PlanPlace | null, summary: PlanSummary, fixedMonth: Money): PlanRisk[] {
  const out: PlanRisk[] = [];
  const a = analyze(b, w, ctx);
  const months = b.history.filter((m) => m.revenue > 0);
  if (place) {
    const n = place.rivals.real150m + place.rivals.players;
    if (n > 0) {
      const near = place.rivals.nearest ? ` The nearest, ${place.rivals.nearest.name}, is ${place.rivals.nearest.distM} m away.` : '';
      out.push({ id: 'rivals', title: `${plural(n, `${pack.name.toLowerCase()}`)} share your passers-by`, amount: null,
        why: `${[place.rivals.real150m > 0 ? `${num(place.rivals.real150m)} real ${place.rivals.real150m === 1 ? 'one' : 'ones'} within 150 m` : '', place.rivals.players > 0 ? `${num(place.rivals.players)} in the game within ${place.rivals.radiusM} m` : ''].filter(Boolean).join(' and ')} split the same ${place.pedestriansPerDay ? num(place.pedestriansPerDay) + ' people a day' : 'foot traffic'}.${near}`,
        fix: 'Walk the block at 8am and at 2pm before you sign; count their lines and their prices.' });
    }
  }
  const rentOver = months.reduce((s, m) => s + Math.max(0, -m.lines.filter((l) => l.kind === 'rent').reduce((x, l) => x + l.amount, 0) - pack.benchmarks.rentPct * m.revenue), 0);
  if (rentOver > 0 && place) {
    out.push({ id: 'rent', title: `Rent of ${usd(place.rentMonth)} is above ${pct(pack.benchmarks.rentPct)} of your sales`, amount: r2(rentOver),
      why: `In your season rent took ${pct(a.rentPct)} of sales. ${usd(rentOver)} over ${plural(months.length, 'month')} went to the landlord beyond the norm.`,
      fix: 'Ask for free months and a cap on increases, or plan the sales that pay for this address.' });
  }
  const before = summary.parts.find((p) => p.id === 'rent_before_open')?.amount ?? 0;
  if (before > 0) {
    out.push({ id: 'before_open', title: `${summary.weeksToOpen} weeks of rent with no sales`, amount: before,
      why: `From the lease to the first sale took ${plural(summary.daysToOpen, 'day')}${place?.buildout ? ` (${place.buildout.label.toLowerCase()})` : ''}.${summary.realLife ? ` In real life budget ${summary.realLife.rentMonths} months of rent: ${usd(summary.realLife.amount)}.` : ''}`,
      fix: 'Negotiate free rent for the build-out and apply for every permit the week you sign.' });
  }
  const low = b.history.reduce<{ cash: Money; month: number } | null>((m, h) => (!m || h.cashEnd < m.cash ? { cash: h.cashEnd, month: h.month } : m), null);
  if (low && fixedMonth > 0 && low.cash < fixedMonth * 2) {
    const broke = low.cash < 0 || b.status === 'bankrupt';
    out.push({ id: 'cash', title: broke ? `You ran out of cash in month ${low.month}` : `Cash fell to ${usd(low.cash)} in month ${low.month}`, amount: r2(Math.max(0, fixedMonth * 2 - low.cash)),
      why: broke
        ? `The bank account hit ${usd(low.cash)}${summary.opened ? '' : ' before the doors opened'}. Two months of fixed costs here are ${usd(fixedMonth * 2)}.`
        : `That is less than two months of fixed costs (${usd(fixedMonth * 2)}). One slow month or one fine would have closed you.`,
      fix: `Open with the ${usd(summary.reserve)} reserve on top of the ${usd(summary.cashBeforeFirstSale)} it takes to open.` });
  }
  const last = months[months.length - 1];
  if (a.breakEvenUnitsMonth != null && last && last.servedUnits < a.breakEvenUnitsMonth) {
    const perDay = (x: number) => Math.round(x / RULES.DAYS_PER_MONTH);
    out.push({ id: 'break_even', title: `You need ${num(perDay(a.breakEvenUnitsMonth))} ${pack.unit.name}s a day; you sold ${num(perDay(last.servedUnits))}`, amount: last.profit < 0 ? r2(-last.profit) : null,
      why: `At ${usd(b.orders.price)} each, fixed costs of ${usd(fixedMonth)} a month need ${num(a.breakEvenUnitsMonth)} ${pack.unit.name}s.`,
      fix: 'Cut the fixed costs you can (hours, staff on slow shifts) or find the morning crowd before you open.' });
  }
  if (a.exposure > 0) {
    out.push({ id: 'fines', title: 'Corners you cut can be found', amount: r2(a.exposure),
      why: `If an inspector found every violation you have today, the fines would be ${usd(a.exposure)}.`,
      fix: 'Run the business as you would with the inspector at the door: every permit, every payroll tax.' });
  }
  const lostSize = b.history.reduce((s, m) => s + m.lost.size + m.lost.staff, 0);
  if (lostSize > 0 && a.lostSalesMoney > 0) {
    out.push({ id: 'lost', title: `${num(lostSize)} ${pack.unit.name}s walked away`, amount: r2(a.lostSalesMoney),
      why: 'There was no seat or the line was too long at the busy hour.',
      fix: 'Staff and seat for the busiest hour, not the average one.' });
  }
  return out.sort((x, y) => (y.amount ?? -1) - (x.amount ?? -1)).slice(0, 3);
}

/** Supplier id → which of the player's choices it serves. Ids of packs/cafe.json; other niches get the generic list. */
function suppliersPart(b: BusinessState, pack: Pack, items: PricedItem[], equipmentTotal: Money, monthly: { label: string; amount: Money }[]): { why: Record<string, string>; order: string[] } {
  const why: Record<string, string> = {};
  const has = (id: string) => items.some((i) => i.def.id === id);
  const lever = (id: string) => { const l = pack.levers.find((x) => x.id === id); return l ? chosenOption(l, b.orders) : null; };
  const line = (re: RegExp) => monthly.find((m) => re.test(m.label));
  const sourcing = lever('sourcing');
  const inv = items.find((i) => i.def.kind === 'inventory');
  for (const s of pack.suppliers) {
    const k = `${s.id} ${s.category}`.toLowerCase();
    if (/bean|coffee/.test(k)) why[s.id] = `${sourcing ? `You chose “${sourcing.label}” beans and milk. ` : ''}${inv ? `Your opening order is ${usd(inv.amount)}.` : ''}`.trim();
    else if (/dairy|milk/.test(k) && sourcing) why[s.id] = `With “${sourcing.label}” sourcing; deliveries several times a week.`;
    else if (/pastry/.test(k)) why[s.id] = items.some((i) => /pastry/.test(i.def.id)) ? 'You bought a pastry case: line up a licensed bakery before day one.' : '';
    else if (/equipment_new|equipment, new/.test(k)) why[s.id] = equipmentTotal > 0 ? `You priced ${plural(items.filter((i) => EQUIPMENT_KINDS.has(i.def.kind)).length, 'item')} new: ${usd(equipmentTotal)}.` : '';
    else if (/equipment_used|used/.test(k)) why[s.id] = equipmentTotal > 0 ? `Your list costs ${usd(equipmentTotal)} new. Used machines and furniture are where a first owner saves most.` : '';
    else if (/pos|payment|register/.test(k)) why[s.id] = has('pos') ? `Your register is in the budget: ${usd(items.find((i) => i.def.id === 'pos')!.amount)}.` : '';
    else if (/insurance/.test(k)) { const ins = monthly.filter(isInsurance).reduce((x, m) => x + m.amount, 0); why[s.id] = ins > 0 ? `Your books show ${usd(ins)} a month for insurance.` : 'Workers’ comp is required before your first hire.'; }
    else if (/pest/.test(k)) { const o = lever('pest_control'); why[s.id] = o ? (o.causes ? `You chose “${o.label}”: that is a violation an inspector fines.` : `You chose “${o.label}”.`) : ''; }
    else if (/contractor|architect/.test(k)) why[s.id] = items.some((i) => partOf(i.def) === 'buildout') ? `Your build-out budget is ${usd(items.filter((i) => partOf(i.def) === 'buildout').reduce((x, i) => x + i.amount, 0))}.` : '';
    else if (/disposable|cup/.test(k)) { const l = line(/cup|packag|dispos/i); why[s.id] = l ? `Your books show ${usd(l.amount)} a month.` : ''; }
    else if (/waste|trash|carter/.test(k)) { const l = line(/trash|carter|waste/i); why[s.id] = l ? `Your books show ${usd(l.amount)} a month.` : ''; }
  }
  for (const id of Object.keys(why)) if (!why[id]) delete why[id];
  const order = [...pack.suppliers.filter((s) => why[s.id]), ...pack.suppliers.filter((s) => !why[s.id])].map((s) => s.id);
  return { why, order };
}

function stepsPart(b: BusinessState, w: WorldState, ctx: EngineCtx, pack: Pack, place: PlanPlace | null, items: PricedItem[], staff: PlanStaffLine[], payroll: Money, equipmentTotal: Money, summary: PlanSummary, monthly: { label: string; amount: Money }[]): Record<string, PlanStepMine> {
  const out: Record<string, PlanStepMine> = {};
  for (const s of roadmapFor(b.niche, b, w, ctx)) {
    const it = s.setupItemId ? items.find((i) => i.def.id === s.setupItemId) : undefined;
    const def = s.setupItemId ? pack.setup.find((d) => d.id === s.setupItemId) : undefined;
    const permit = s.setupItemId ? b.permits.find((p) => p.itemId === s.setupItemId) : undefined;
    let mine: string | undefined;
    if (def && PERMIT_KINDS.has(def.kind)) {
      mine = permit ? (permit.readyDay > w.day ? `Applied on day ${permit.appliedDay}; ready on day ${permit.readyDay}.` : `You got it on day ${permit.readyDay}.`)
        : it ? 'In your list.' : def.required ? 'Not in your list: you cannot open without it.' : 'You did not take it.';
    } else if (def && partOf(def) === 'buildout' && place) {
      mine = place.takeoverPrice != null ? `You bought an operating business for ${usd(place.takeoverPrice)}: no build-out.`
        : place.buildout ? `${place.buildout.label}: ${usdRate(place.buildout.perSqft)} per sq ft × ${num(place.sqft)} sq ft = ${usd(place.buildout.cost)}, about ${plural(place.buildout.days, 'day')}.` : undefined;
    } else if (def && EQUIPMENT_KINDS.has(def.kind) && s.kind === 'money') {
      mine = `Your list: ${plural(items.filter((i) => EQUIPMENT_KINDS.has(i.def.kind)).length, 'item')}, ${usd(equipmentTotal)} new.`;
    } else if (def && def.kind === 'inventory') {
      const src = pack.levers.find((l) => l.id === 'sourcing');
      mine = `Your opening order: ${usd(it?.amount ?? def.cost)}${src ? `, “${chosenOption(src, b.orders).label}” sourcing` : ''}.`;
    } else if (it) {
      mine = `${it.def.name}: ${usd(it.amount)} in your budget.`;
    } else if (s.kind === 'idea' && place && /space|scout|find|premises/.test(s.id)) {
      mine = `You chose ${place.address}: ${num(place.sqft)} sq ft, ${plural(b.size, pack.sizing.unitName)}, ${usd(place.rentMonth)} a month${place.formerUse ? `, a former ${place.formerUse}` : ''}.`;
    } else if (s.kind === 'idea' && place && /occupancy/.test(s.id)) {
      mine = `Ask the landlord of ${place.address} for its Certificate of Occupancy before you sign.`;
    } else if (s.kind === 'idea' && /concept|format/.test(s.id)) {
      mine = `Your format: ${plural(b.size, pack.sizing.unitName)}, ${usdRate(b.orders.price)} a ${pack.unit.name}, a team of ${staff.reduce((x, r) => x + r.count, 0)}.`;
    } else if (s.kind === 'idea' && /plan|budget/.test(s.id)) {
      mine = `This page is that plan: ${usd(summary.cashBeforeFirstSale)} before the first sale and ${usd(summary.reserve)} in reserve.`;
    } else if (/insurance/.test(s.id) && monthly.some(isInsurance)) {
      mine = `Your books: ${monthly.filter(isInsurance).map((m) => `${m.label.replace(/ paid$/, '')} ${usd(m.amount)}`).join(', ')} a month.`;
    } else if (s.kind === 'space' && place) {
      mine = `${place.address}: ${num(place.sqft)} sq ft, ${usd(place.rentMonth)} a month${place.deposit ? `, deposit ${usd(place.deposit)}${place.depositMonths ? ` (${place.depositMonths} months)` : ''}` : ''}.`;
    } else if (s.kind === 'people' && staff.length) {
      mine = `Your team: ${staff.map((r) => `${r.count} × ${r.name} at ${usd(r.hourlyWage)}/h`).join(', ')} — ${usd(payroll)} a month before payroll taxes.`;
    } else if (s.kind === 'launch') {
      mine = `${summary.opened ? `You opened on day ${b.openedDay}, ${plural(summary.daysToOpen, 'day')} after the lease.` : `About ${plural(summary.daysToOpen, 'day')} after the lease.`} Your reserve: ${usd(summary.reserve)}.`;
    }
    out[s.id] = { status: s.status, ...(s.readyDay != null ? { readyDay: s.readyDay } : {}), ...(mine ? { mine } : {}) };
  }
  return out;
}

export function personalPlan(b: BusinessState, w: WorldState, ctx: EngineCtx, monthly: { label: string; amount: Money }[], reserve: Money, fixedMonth: Money): PersonalPlan {
  const pack = packOf(ctx, b.niche);
  const place = placeOf(ctx, b.placeId);
  const items = pricedItems(b, pack, place);
  const pp = placePart(b, w, ctx, pack, place, items);
  // payroll as planned for an open shop (a business still in setup pays none yet)
  const cmOpen = costModel({ pack, common: ctx.packs.common, place, orders: b.orders, size: b.size });
  const staff: PlanStaffLine[] = pack.staff.map((r) => {
    const count = b.orders.staff?.[r.id] ?? 0;
    const wage = r.tipped && r.cashWage != null ? r.cashWage : r.hourlyWage;
    return { roleId: r.id, name: r.name, count, hourlyWage: wage, hoursPerMonth: r.hoursPerMonth, monthly: r2(count * wage * r.hoursPerMonth) };
  }).filter((r) => r.count > 0);
  const equipment = items.filter((i) => EQUIPMENT_KINDS.has(i.def.kind)).map((i) => ({ id: i.def.id, name: i.def.name, kind: i.def.kind, qty: i.qty, unit: i.unit, total: i.amount }));
  const equipmentTotal = sumLines(equipment.map((e) => ({ amount: e.total })));
  const inv = items.find((i) => i.def.kind === 'inventory');
  const src = pack.levers.find((l) => l.id === 'sourcing');
  const summary = summaryPart(b, pack, place, items, reserve, fixedMonth);
  const sup = suppliersPart(b, pack, items, equipmentTotal, monthly);
  return {
    place: pp, size: b.size, sizeUnit: pack.sizing.unitName, price: b.orders.price, refPrice: pack.unit.refPrice, unitName: pack.unit.name,
    staff, payrollMonth: r2(cmOpen.payroll), payrollTaxMonth: r2(cmOpen.payrollTax),
    equipment, equipmentTotal,
    firstOrder: inv ? { name: inv.def.name, amount: inv.amount, sourcing: src ? chosenOption(src, b.orders).label : null } : null,
    summary,
    risks: risksPart(b, w, ctx, pack, pp, summary, fixedMonth),
    supplierWhy: sup.why, supplierOrder: sup.order,
    steps: stepsPart(b, w, ctx, pack, pp, items, staff, r2(cmOpen.payroll), equipmentTotal, summary, monthly),
  };
}

export function realWorldPlan(b: BusinessState, w: WorldState, ctx: EngineCtx): PersonalRealWorldPlan {
  const pack = packOf(ctx, b.niche);
  const a = analyze(b, w, ctx);
  // reserve: six months of honest fixed costs of an open shop (no cut corners; a shop still in setup would count rent only)
  const cm = costModel({ pack, common: ctx.packs.common, place: placeOf(ctx, b.placeId), orders: { ...b.orders, shortcuts: [] }, size: b.size });
  const fixedMonth = sumLines(cm.fixed);
  const reserve = r2(6 * fixedMonth);
  const startup = startupBudget(b, ctx);
  const monthly = monthlyFromBooks(b, w, ctx);
  return {
    niche: b.niche, businessName: b.name,
    startupBudget: startup, startupTotal: sumLines(startup),
    monthlyCosts: monthly, monthlyTotal: sumLines(monthly),
    reserveAdvised: reserve,
    breakEvenUnitsMonth: a.breakEvenUnitsMonth, paybackMonths: a.paybackMonths,
    checklist: checklist(b, ctx), suppliers: pack.suppliers,
    lessons: lessons(b, w, ctx),
    disclaimer: DISCLAIMER,
    extra: { personal: personalPlan(b, w, ctx, monthly, reserve, fixedMonth) },
  };
}
