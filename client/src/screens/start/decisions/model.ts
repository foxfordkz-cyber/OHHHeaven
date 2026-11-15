// The opening decisions: everything the player chooses before signing the lease, and what each choice does to
// the three numbers on top of the screen — cash left, the opening day and the monthly bills.
// Pure functions over pack data. They mirror the engine (shared/src/place.ts for the money paid on signing,
// engine/src/analytics/model.ts `costModel` for the monthly bills); the engine decides the real money when
// `open_business` and `set_orders` arrive.
import type { CommonPack, Money, OpenRecommendation, Pack, PackLever, PackLeverOption, PackSetupItem, PackViolation, Place, StandingOrders } from '@ohh/shared/types';
import { RULES } from '@ohh/shared/rules';
import { baselineOrdersDay, buildoutOf, daysToOpenOf, isTakeover, openingCost, rentMonthOf, setupItemCost } from '@ohh/shared/place';
import { maxSizeFor } from '../kit';

// ───────────────────────── what the player has chosen ─────────────────────────

export interface Choices {
  size: number;
  extras: string[];                    // optional setup items the player buys
  staff: Record<string, number>;       // role id → people
  levers: Record<string, string>;      // lever id → option id
  price: Money;
}

export type KitItems = { id: string; qty: number }[];

const round2 = (x: number): number => Math.round((x + Number.EPSILON) * 100) / 100;
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

interface SeatRule { seats: number; rule?: string; law?: string; setupItemId?: string; source?: string }

/** Rules that start at a number of seats and need an item (pack.extra.seatThresholds: a customer restroom from 20 seats). */
export function seatRules(pack: Pack): SeatRule[] {
  const raw = (pack.extra as { seatThresholds?: unknown } | undefined)?.seatThresholds;
  return Array.isArray(raw) ? (raw as SeatRule[]).filter((t) => t && typeof t.seats === 'number') : [];
}

/** Items the law adds at this size, whether the player ticked them or not. */
export function forcedExtras(pack: Pack, size: number): string[] {
  return seatRules(pack).filter((t) => t.setupItemId && size >= t.seats && pack.setup.some((s) => s.id === t.setupItemId && !s.required)).map((t) => t.setupItemId!);
}

export const optionalItems = (pack: Pack): PackSetupItem[] => pack.setup.filter((s) => !s.required);

/** The legal default of a lever: the first option that causes no violation (same rule as the engine). */
export const legalDefault = (lever: PackLever): PackLeverOption => lever.options.find((o) => !o.causes) ?? lever.options[0];

/**
 * What the address gives before any choice. An empty room gives nothing. An operating shop is bought as it stands:
 * its seats and the equipment of the standard kit come with the price, and changing them is buying and selling
 * after the lease is signed (`buy_item`, `sell_item`, `resize`).
 */
export interface Baseline { takeover: boolean; size: number; included: string[] }

export function baselineOf(pack: Pack, place?: Place): Baseline {
  if (!isTakeover(pack, place)) return { takeover: false, size: Math.min(pack.sizing.min, maxSizeFor(pack, place)), included: [] };
  const optional = new Set(optionalItems(pack).map((s) => s.id));
  const kit = pack.kits.find((k) => k.id === 'standard') ?? pack.kits[0];
  return { takeover: true, size: place!.forSale!.size, included: (kit?.items ?? []).filter((i) => i.qty > 0 && optional.has(i.id)).map((i) => i.id) };
}

/** The least the law allows: required items only, the smallest room, the smallest team, default settings, the reference price. */
export function baseChoices(pack: Pack, place?: Place): Choices {
  const levers: Record<string, string> = {};
  for (const l of pack.levers) if (l.options.length) levers[l.id] = legalDefault(l).id;
  const staff: Record<string, number> = {};
  pack.staff.forEach((r, i) => { staff[r.id] = i === 0 ? pack.capacity.minStaff : 0; });
  const base = baselineOf(pack, place);
  return { size: base.size, extras: [...base.included], staff, levers, price: pack.unit.refPrice };
}

/** What the system would pick: the recommended kit of `recommend_opening`, as choices. */
export function recommendedChoices(pack: Pack, rec: OpenRecommendation, place?: Place): Choices {
  const base = baseChoices(pack, place);
  const optional = new Set(optionalItems(pack).map((s) => s.id));
  const max = maxSizeFor(pack, place);
  return {
    // an operating shop is recommended as it stands: nothing to buy, nothing to sell
    size: isTakeover(pack, place) ? base.size : clamp(rec.size, pack.sizing.min, max),
    extras: isTakeover(pack, place) ? base.extras : rec.items.filter((i) => i.qty > 0 && optional.has(i.id)).map((i) => i.id),
    staff: { ...base.staff, ...rec.orders.staff },
    levers: { ...base.levers, ...rec.orders.levers },
    price: rec.orders.price,
  };
}

/** Everything that will stand in the shop: what is required, the extras, and what the seat rules add. */
export function itemsOf(pack: Pack, c: Choices): KitItems {
  const extras = new Set([...c.extras, ...forcedExtras(pack, c.size)]);
  return pack.setup.filter((s) => s.required || extras.has(s.id)).map((s) => ({ id: s.id, qty: s.scalesWithSize ? c.size : 1 }));
}

/** The list `open_business` gets. An operating shop is signed for as it stands; the changes follow in `afterSigning`. */
export function signingItems(pack: Pack, place: Place | undefined, c: Choices): { size: number; items: KitItems } {
  const base = baselineOf(pack, place);
  if (!base.takeover) return { size: c.size, items: itemsOf(pack, c) };
  return { size: base.size, items: itemsOf(pack, { ...c, size: base.size, extras: base.included }) };
}

export type FollowUp =
  | { type: 'buy_item'; itemId: string; qty: number }
  | { type: 'sell_item'; itemId: string; qty: number }
  | { type: 'resize'; size: number }
  | { type: 'set_orders'; orders: Pick<StandingOrders, 'price' | 'staff' | 'levers'> };

/**
 * What is sent right after the lease is signed. Always the standing orders (team, settings, price). In an operating
 * shop also the player's changes to what stands there: purchases first (a restroom must exist before the 20th seat),
 * then the seats, then what is sold.
 */
export function afterSigning(pack: Pack, place: Place | undefined, c: Choices): FollowUp[] {
  const base = baselineOf(pack, place);
  const out: FollowUp[] = [];
  if (base.takeover) {
    const wanted = new Set([...c.extras, ...forcedExtras(pack, c.size)]);
    for (const id of wanted) if (!base.included.includes(id)) out.push({ type: 'buy_item', itemId: id, qty: 1 });
    if (c.size !== base.size) out.push({ type: 'resize', size: c.size });
    for (const id of base.included) if (!wanted.has(id)) out.push({ type: 'sell_item', itemId: id, qty: 1 });
  }
  out.push({ type: 'set_orders', orders: ordersOf(c) });
  return out;
}

/** Money the changes to an operating shop cost on top of its price: purchases at list price, sales at the resale share. */
export function takeoverChanges(pack: Pack, place: Place | undefined, c: Choices): ReceiptLine[] {
  const base = baselineOf(pack, place);
  if (!base.takeover) return [];
  const def = (id: string) => pack.setup.find((s) => s.id === id);
  const out: ReceiptLine[] = [];
  const wanted = new Set([...c.extras, ...forcedExtras(pack, c.size)]);
  for (const id of wanted) if (!base.included.includes(id) && def(id)) out.push({ id, label: def(id)!.name, amount: def(id)!.cost, yours: true });
  const perSeat = pack.setup.filter((x) => x.scalesWithSize).reduce((a, x) => a + x.cost, 0);
  const delta = c.size - base.size;
  const unit = pack.sizing.unitName;
  if (delta > 0) out.push({ id: 'seats_added', label: `${delta} more ${unit}${delta === 1 ? '' : 's'}`, amount: round2(perSeat * delta), yours: true });
  if (delta < 0) out.push({ id: 'seats_sold', label: `Sold: furniture of ${-delta} ${unit}${delta === -1 ? '' : 's'}`, amount: -round2(perSeat * -delta * RULES.RESALE_SHARE), yours: true });
  for (const id of base.included) if (!wanted.has(id) && def(id)) out.push({ id: `sold_${id}`, label: `Sold: ${def(id)!.name}`, amount: -round2(def(id)!.cost * RULES.RESALE_SHARE), yours: true });
  return out;
}

/** The standing orders sent right after the lease is signed. */
export function ordersOf(c: Choices): Pick<StandingOrders, 'price' | 'staff' | 'levers'> {
  return { price: c.price, staff: { ...c.staff }, levers: { ...c.levers } };
}

export const staffCount = (staff: Record<string, number>): number => Object.values(staff).reduce((s, n) => s + Math.max(0, n || 0), 0);

// ───────────────────────── the numbers on top of the screen ─────────────────────────

export interface BillLine { id: string; label: string; amount: Money; group: 'rent' | 'people' | 'running' | 'choices' }

export interface Summary {
  capital: Money;
  paid: Money;                 // paid on the day the lease is signed
  cashLeft: Money;             // capital − paid
  days: number;                // days from signing until the doors may open
  rentDay: Money;              // rent is due from the day of signing
  rentBeforeOpening: Money;    // rent paid while the room is built and the permits arrive
  cashAtOpening: Money;        // what is in the bank on the first day of sales
  monthly: Money;              // bills of a full month with the doors open, before a single sale
  bills: BillLine[];
  marginPerOrder: Money;       // price minus beans, milk, cup and card fees
  breakEvenDay: number | null; // orders a day that cover the monthly bills
  cornerOrdersDay: number | null; // what an average, known shop sells on this corner at the reference price
  seatsCapDay: number;         // orders a day the room can hold
  teamCapDay: number | null;   // orders a day the team can make
  quality: number;             // 0–1; 0.5 is the usual shop with the standard setup
  monthsOfBills: number | null;// how many months of bills the opening-day cash covers with no sales at all
}

const roleWage = (r: Pack['staff'][number]): Money => (r.tipped && r.cashWage != null ? r.cashWage : r.hourlyWage) * r.hoursPerMonth;

/** Bills of a full open month before a single sale: rent, people, running costs, and what the settings add. */
export function monthlyBills(pack: Pack, common: CommonPack | undefined, place: Place | undefined, c: Choices): BillLine[] {
  const taxes = [...(common?.taxes ?? []), ...pack.taxes];
  const rent = place && place.rentPerSqftYear > 0 && place.sqft > 0
    ? rentMonthOf(place)
    : pack.monthlyCosts.filter((x) => x.kind === 'rent' && x.basis === 'fixed').reduce((s, x) => s + x.amount, 0);
  const out: BillLine[] = [{ id: 'rent', label: 'Rent', amount: rent, group: 'rent' }];
  let payroll = 0;
  for (const role of pack.staff) {
    const n = c.staff[role.id] ?? 0;
    if (n <= 0) continue;
    const amount = round2(n * roleWage(role));
    payroll += amount;
    out.push({ id: `payroll_${role.id}`, label: `${role.name} × ${n}`, amount, group: 'people' });
  }
  const payrollTax = round2(taxes.filter((t) => t.base === 'payroll').reduce((s, t) => s + t.rate, 0) * payroll);
  if (payrollTax > 0) out.push({ id: 'payroll_tax', label: 'Payroll taxes and insurance', amount: payrollTax, group: 'people' });
  const n = staffCount(c.staff);
  let running = 0;
  for (const t of taxes.filter((x) => x.base === 'rent')) running += t.rate * rent;
  for (const t of taxes.filter((x) => x.base === 'fixed')) running += t.due === 'annual' ? t.rate / 12 : t.due === 'quarterly' ? t.rate / 3 : t.rate;
  for (const m of pack.monthlyCosts) {
    if (m.kind === 'rent' && place) continue;
    if (m.basis === 'per_unit' || m.basis === 'pct_revenue') continue;
    if (m.kind === 'rent') continue;
    running += m.basis === 'fixed' ? m.amount : m.basis === 'per_staff' ? m.amount * n : m.amount * c.size;
  }
  running += pack.sizing.cleaningCostPerSizeMonth * c.size;
  if (running > 0) out.push({ id: 'running', label: 'Utilities, insurance, upkeep and services', amount: round2(running), group: 'running' });
  for (const lever of pack.levers) {
    const o = lever.options.find((x) => x.id === c.levers[lever.id]) ?? legalDefault(lever);
    if (o && o.monthlyCost > 0) out.push({ id: `lever_${lever.id}`, label: `${lever.name}: ${o.label}`, amount: o.monthlyCost, group: 'choices' });
  }
  return out;
}

/** Money that leaves with every order: ingredients, the cup, card fees and taxes on sales. */
export function marginPerOrder(pack: Pack, common: CommonPack | undefined, price: Money): Money {
  const taxes = [...(common?.taxes ?? []), ...pack.taxes];
  let perUnit = pack.unit.cogsPerUnit, pct = 0;
  for (const m of pack.monthlyCosts) {
    if (m.basis === 'per_unit') perUnit += m.amount;
    if (m.basis === 'pct_revenue') pct += m.amount;
  }
  for (const t of taxes.filter((x) => x.base === 'revenue')) pct += t.rate;
  return round2(price * (1 - pct) - perUnit);
}

/** Setup quality as the engine counts it at opening: 0.5 for the standard kit, plus or minus what you bought. */
export function qualityOf(pack: Pack, c: Choices): number {
  const bonus = (ids: Iterable<string>) => [...ids].reduce((s, id) => s + (pack.setup.find((d) => d.id === id)?.qualityBonus ?? 0), 0);
  const std = pack.kits.find((k) => k.id === 'standard') ?? pack.kits[Math.floor(pack.kits.length / 2)];
  const stdBonus = std ? bonus(std.items.filter((i) => i.qty > 0).map((i) => i.id)) : 0;
  const lever = pack.levers.reduce((s, l) => s + (l.options.find((o) => o.id === c.levers[l.id])?.effects?.quality ?? 0), 0);
  return clamp(0.5 - stdBonus + bonus(itemsOf(pack, c).map((i) => i.id)) + lever, 0, 1);
}

export function summarize(pack: Pack, common: CommonPack | undefined, place: Place | undefined, c: Choices, capital: Money = pack.startCapital): Summary {
  const items = itemsOf(pack, c);
  const signed = signingItems(pack, place, c);
  const paid = round2(openingCost(pack, signed.items, signed.size, place) + takeoverChanges(pack, place, c).reduce((a, l) => a + l.amount, 0));
  const build = buildoutOf(pack, place);
  const days = place && build ? daysToOpenOf(pack, items, place) : items.reduce((m, { id }) => {
    const d = pack.setup.find((s) => s.id === id);
    return d?.required ? Math.max(m, d.waitDays ?? 0) : m;
  }, 0);
  const bills = monthlyBills(pack, common, place, c);
  const monthly = round2(bills.reduce((s, l) => s + l.amount, 0));
  const rentDay = round2((bills.find((l) => l.id === 'rent')?.amount ?? 0) / RULES.DAYS_PER_MONTH);
  const rentBeforeOpening = round2(rentDay * days);
  const cashLeft = round2(capital - paid);
  const cashAtOpening = round2(cashLeft - rentBeforeOpening);
  const margin = marginPerOrder(pack, common, c.price);
  const per = pack.capacity.unitsPerStaffMonth;
  const capacityBoost = pack.levers.reduce((s, l) => s + (l.options.find((o) => o.id === c.levers[l.id])?.effects?.capacity ?? 0), 0);
  const takeaway = pack.sizing.takeawayShare ?? 0;
  const corner = place ? baselineOrdersDay(pack, place) : null;
  return {
    capital, paid, cashLeft, days, rentDay, rentBeforeOpening, cashAtOpening, monthly, bills,
    marginPerOrder: margin,
    breakEvenDay: margin > 0 ? Math.ceil(monthly / margin / RULES.DAYS_PER_MONTH) : null,
    cornerOrdersDay: corner == null ? null : Math.round(corner),
    seatsCapDay: Math.round((c.size * pack.sizing.unitsServedPerSizeMonth) / Math.max(0.05, 1 - takeaway) / RULES.DAYS_PER_MONTH),
    teamCapDay: per ? Math.round((staffCount(c.staff) * per * (1 + capacityBoost)) / RULES.DAYS_PER_MONTH) : null,
    quality: qualityOf(pack, c),
    monthsOfBills: monthly > 0 ? Math.max(0, Math.round((cashAtOpening / monthly) * 10) / 10) : null,
  };
}

// ───────────────────────── the receipt: why this much money is left ─────────────────────────

export interface ReceiptLine { id: string; label: string; amount: Money; yours?: boolean }   // yours — bought or sold because the player chose it

/** Everything paid on signing, grouped the way a person would explain it. A positive amount is money paid, a negative one is money back. */
export function receipt(pack: Pack, place: Place | undefined, choices: Choices): ReceiptLine[] {
  const takeover = isTakeover(pack, place);
  const signed = signingItems(pack, place, choices);
  const items = signed.items;
  const c = { ...choices, size: signed.size };
  const cost = (d: PackSetupItem) => setupItemCost(pack, d, place) * (d.scalesWithSize ? c.size : 1);
  const defs = items.map((i) => pack.setup.find((s) => s.id === i.id)!).filter(Boolean);
  const sum = (ds: PackSetupItem[]) => round2(ds.reduce((s, d) => s + cost(d), 0));
  const required = defs.filter((d) => d.required);
  const out: ReceiptLine[] = [];
  if (takeover) out.push({ id: 'takeover', label: 'The operating shop: room, equipment, furniture and its regulars', amount: place!.forSale!.askingPrice });
  const build = buildoutOf(pack, place);
  const group = (id: string, label: string, ds: PackSetupItem[]) => {
    const amount = sum(ds);
    if (amount > 0) out.push({ id, label, amount });
  };
  group('deposit', 'Lease security deposit', required.filter((d) => d.kind === 'deposit'));
  group('buildout', build ? build.label : 'Build-out', required.filter((d) => d.kind === 'buildout'));
  group('legal', 'Permits, licenses, lawyer, architect and filings', required.filter((d) => d.kind === 'permit' || d.kind === 'license' || (d.kind === 'other' && !d.scalesWithSize)));
  group('equipment', 'Equipment the law and the menu require', required.filter((d) => d.kind === 'equipment'));
  group('furniture', `Furniture for ${c.size} ${pack.sizing.unitName}${c.size === 1 ? '' : 's'}`, required.filter((d) => d.kind === 'furniture' || (d.kind === 'other' && d.scalesWithSize)));
  group('stock', 'Opening stock', required.filter((d) => d.kind === 'inventory'));
  if (takeover) return [...out, ...takeoverChanges(pack, place, choices)];
  for (const d of defs.filter((x) => !x.required)) {
    const amount = round2(cost(d));
    out.push({ id: d.id, label: d.name, amount, yours: true });
  }
  return out;
}

// ───────────────────────── decisions and their options ─────────────────────────

export interface OptionRisk { name: string; law?: string; fine: string }

export interface DecisionOption {
  id: string;
  label: string;
  detail?: string;                 // what it leads to, in plain words
  upfront: Money;                  // paid on signing
  monthly: Money;                  // added to the monthly bills
  waitDays?: number;               // a wait that does not hold the opening back (a sidewalk license)
  quality?: number;                // change of the quality score, in points of 100
  demand?: number;                 // share of extra guests (0.08 = +8%)
  capacity?: number;               // share of extra orders the team can make
  risk?: OptionRisk;               // breaking the law: what the city does when it finds out
  items?: string[];                // 'items' decisions: the optional items this option buys
  standing?: boolean;              // an operating shop: this is how it stands today, nothing to buy or sell
}

export type DecisionKind = 'size' | 'items' | 'staff' | 'lever' | 'price';

export interface Decision {
  id: string;
  kind: DecisionKind;
  title: string;                   // short name for the list: "Seats"
  question: string;                // the card headline: "How many seats?"
  why?: string;                    // one line under the headline: what is at stake
  leverId?: string;
  groupItems?: string[];           // 'items' decisions: every optional item this decision is about
  options: DecisionOption[];       // empty for size, staff and price: they are set with a stepper or a slider
  recommended: string | null;      // option id, or a formatted value for stepper decisions
}

export interface ItemGroup { id: string; title: string; question: string; why?: string; options: { id: string; label: string; detail?: string; items: string[] }[] }
export interface LeverText { title: string; question: string; why?: string; details?: Record<string, string> }
export interface DecisionTexts { order?: string[]; itemGroups?: ItemGroup[]; levers?: Record<string, LeverText>; size?: { question: string; why?: string }; staff?: { question: string; why?: string }; price?: { question: string; why?: string } }

function fineOf(v: PackViolation): string {
  const f = v.fine;
  const parts: string[] = [];
  if (f.base) parts.push(`$${f.base.toLocaleString('en-US')}`);
  if (f.perMonth) parts.push(`+$${f.perMonth.toLocaleString('en-US')} a month`);
  if (f.pctOfSaved) parts.push(`+${Math.round(f.pctOfSaved * 100)}% of what you saved`);
  const closure = v.closureDays ? `, closed for ${v.closureDays} days` : '';
  return `${parts.join(' ') || 'a fine set by the agency'}${closure}`;
}

function riskOf(pack: Pack, common: CommonPack | undefined, violationId: string | undefined): OptionRisk | undefined {
  if (!violationId) return undefined;
  const v = pack.violations.find((x) => x.id === violationId) ?? common?.violations.find((x) => x.id === violationId);
  return v ? { name: v.name, law: v.law, fine: fineOf(v) } : undefined;
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Every opening decision of this niche, in the order a person meets them. `texts` gives the niche its own words and
 * groups its optional items into real-life choices; whatever the texts do not cover still becomes a decision, so a
 * new item or lever in the pack is never decided silently for the player.
 */
export function buildDecisions(pack: Pack, common: CommonPack | undefined, place: Place | undefined, rec: Choices | null, texts: DecisionTexts = {}, size: number = pack.sizing.min): Decision[] {
  const out: Decision[] = [];
  const base = baselineOf(pack, place);
  const takeover = base.takeover;
  const def = (id: string) => pack.setup.find((s) => s.id === id);
  // an empty room: the price of the item at this address; an operating shop: list price to add, the resale share back to sell
  const priceOf = (id: string): Money => {
    const d = def(id);
    if (!d) return 0;
    return takeover ? d.cost : round2(setupItemCost(pack, d, place) * (d.scalesWithSize ? size : 1));
  };
  /** What choosing this set of a group's items costs against what already stands in the shop. */
  const costOf = (items: readonly string[], group: readonly string[]): Money => {
    const had = base.included.filter((id) => group.includes(id));
    const buy = items.filter((id) => !had.includes(id)).reduce((a, id) => a + priceOf(id), 0);
    const sell = had.filter((id) => !items.includes(id)).reduce((a, id) => a + priceOf(id) * RULES.RESALE_SHARE, 0);
    return round2(buy - sell);
  };
  const bonusOf = (items: readonly string[]): number => items.reduce((a, id) => a + (def(id)?.qualityBonus ?? 0), 0);
  const qualityVs = (items: readonly string[], group: readonly string[]): number | undefined =>
    pts(Math.round((bonusOf(items) - bonusOf(base.included.filter((id) => group.includes(id)))) * 1000) / 1000);
  const pts = (q: number | undefined): number | undefined => (q ? Math.round(q * 100) : undefined);
  const optional = optionalItems(pack);
  const forcedBySeats = new Set(seatRules(pack).map((t) => t.setupItemId).filter(Boolean) as string[]);

  if (maxSizeFor(pack, place) > pack.sizing.min) {
    out.push({ id: 'size', kind: 'size', title: `${cap(pack.sizing.unitName)}s`, question: texts.size?.question ?? `How many ${pack.sizing.unitName}s?`, why: texts.size?.why, options: [], recommended: rec ? String(rec.size) : null });
  }

  {
    const grouped = new Set<string>();
    for (const g of texts.itemGroups ?? []) {
      const known = g.options.every((o) => o.items.every((id) => optional.some((s) => s.id === id)));
      if (!known) continue;
      const all = [...new Set(g.options.flatMap((o) => o.items))];
      all.forEach((id) => grouped.add(id));
      const had = base.included.filter((id) => all.includes(id));
      const options: DecisionOption[] = g.options.map((o) => ({
        id: o.id, label: o.label, detail: o.detail, items: o.items,
        upfront: costOf(o.items, all), monthly: 0,
        quality: qualityVs(o.items, all),
        waitDays: o.items.reduce((m, id) => Math.max(m, def(id)?.waitDays ?? 0), 0) || undefined,
        standing: takeover && sameSet(o.items, had) ? true : undefined,
      }));
      const recPick = rec ? options.find((o) => sameSet(o.items ?? [], rec.extras.filter((id) => all.includes(id)))) : undefined;
      out.push({ id: g.id, kind: 'items', title: g.title, question: g.question, why: g.why, groupItems: all, options, recommended: recPick?.id ?? null });
    }
    for (const s of optional) {
      if (grouped.has(s.id) || forcedBySeats.has(s.id)) continue;
      out.push({
        id: `item_${s.id}`, kind: 'items', title: s.name, question: `Buy it: ${s.name.toLowerCase()}?`, groupItems: [s.id],
        options: [
          { id: 'skip', label: 'Open without it', upfront: costOf([], [s.id]), monthly: 0, items: [], quality: qualityVs([], [s.id]), standing: takeover && !base.included.includes(s.id) ? true : undefined },
          { id: 'buy', label: s.name, upfront: costOf([s.id], [s.id]), monthly: 0, items: [s.id], quality: qualityVs([s.id], [s.id]), waitDays: s.waitDays || undefined, standing: takeover && base.included.includes(s.id) ? true : undefined },
        ],
        recommended: rec ? (rec.extras.includes(s.id) ? 'buy' : 'skip') : null,
      });
    }
  }

  if (pack.staff.length > 0) {
    out.push({ id: 'staff', kind: 'staff', title: 'Team', question: texts.staff?.question ?? 'How many people do you hire?', why: texts.staff?.why, options: [], recommended: rec ? pack.staff.filter((r) => (rec.staff[r.id] ?? 0) > 0).map((r) => `${rec.staff[r.id]} × ${r.name.toLowerCase()}`).join(', ') : null });
  }

  for (const lever of pack.levers) {
    if (lever.options.length < 2) continue;
    const t = texts.levers?.[lever.id];
    out.push({
      id: `lever_${lever.id}`, kind: 'lever', leverId: lever.id, title: t?.title ?? lever.name, question: t?.question ?? `${lever.name}: which way?`, why: t?.why,
      options: lever.options.map((o) => ({
        id: o.id, label: o.label, detail: t?.details?.[o.id], upfront: 0, monthly: o.monthlyCost,
        quality: pts(o.effects?.quality), demand: o.effects?.demand || undefined, capacity: o.effects?.capacity || undefined,
        risk: riskOf(pack, common, o.causes),
      })),
      recommended: rec ? rec.levers[lever.id] ?? legalDefault(lever).id : legalDefault(lever).id,
    });
  }

  out.push({ id: 'price', kind: 'price', title: 'Price', question: texts.price?.question ?? `What does one ${pack.unit.name} cost?`, why: texts.price?.why, options: [], recommended: rec ? String(rec.price) : String(pack.unit.refPrice) });

  // the room first, then what stands in it, then the people, then how the shop runs, the price last;
  // inside each group the niche's own order, and whatever it does not name keeps the order of the pack
  const order = texts.order;
  if (!order) return out;
  const groupOf: Record<DecisionKind, number> = { size: 0, items: 1, staff: 2, lever: 3, price: 4 };
  const rank = (d: Decision) => { const i = order.indexOf(d.id); return i < 0 ? order.length : i; };
  return out.map((d, i) => ({ d, i })).sort((a, b) => groupOf[a.d.kind] - groupOf[b.d.kind] || rank(a.d) - rank(b.d) || a.i - b.i).map((x) => x.d);
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Which option of an 'items' or 'lever' decision the choices hold right now. */
export function pickedOption(d: Decision, c: Choices): string | null {
  if (d.kind === 'lever') return c.levers[d.leverId!] ?? null;
  if (d.kind !== 'items') return null;
  const mine = c.extras.filter((id) => d.groupItems!.includes(id));
  return d.options.find((o) => sameSet(o.items ?? [], mine))?.id ?? null;
}

/** Choosing an option of an 'items' or 'lever' decision. */
export function choose(d: Decision, optionId: string, c: Choices): Choices {
  const o = d.options.find((x) => x.id === optionId);
  if (!o) return c;
  if (d.kind === 'lever') return { ...c, levers: { ...c.levers, [d.leverId!]: o.id } };
  if (d.kind === 'items') return { ...c, extras: [...c.extras.filter((id) => !d.groupItems!.includes(id)), ...(o.items ?? [])] };
  return c;
}

/** Sets one decision to what the system recommends, leaving the others as they are. */
export function applyRecommended(d: Decision, c: Choices, rec: Choices): Choices {
  switch (d.kind) {
    case 'size': return { ...c, size: rec.size };
    case 'staff': return { ...c, staff: { ...rec.staff } };
    case 'price': return { ...c, price: rec.price };
    default: return d.recommended ? choose(d, d.recommended, c) : c;
  }
}

/** Keeps a team inside the limits of the pack: at least the legal minimum, at most what the counter holds. */
export function setStaff(pack: Pack, c: Choices, roleId: string, n: number): Choices {
  const others = staffCount(c.staff) - (c.staff[roleId] ?? 0);
  const next = clamp(Math.floor(n), Math.max(0, pack.capacity.minStaff - others), Math.max(0, pack.capacity.maxStaff - others));
  return { ...c, staff: { ...c.staff, [roleId]: next } };
}

export function setSize(pack: Pack, place: Place | undefined, c: Choices, size: number): Choices {
  return { ...c, size: clamp(Math.floor(size), pack.sizing.min, maxSizeFor(pack, place)) };
}

export function setPrice(pack: Pack, c: Choices, price: number): Choices {
  return { ...c, price: round2(clamp(price, pack.unit.priceMin, pack.unit.priceMax)) };
}

/** `open_business` wants a kit id: the ready-made kit whose optional purchases are closest to what the player chose. */
export function closestKit(pack: Pack, c: Choices): Pack['kits'][number]['id'] {
  const optional = new Set(optionalItems(pack).map((s) => s.id));
  const mine = new Set([...c.extras, ...forcedExtras(pack, c.size)]);
  let best = pack.kits[0], bestScore = -1;
  for (const k of pack.kits) {
    const theirs = new Set(k.items.filter((i) => i.qty > 0 && optional.has(i.id)).map((i) => i.id));
    const both = [...mine].filter((id) => theirs.has(id)).length;
    const either = new Set([...mine, ...theirs]).size;
    const score = either === 0 ? 1 : both / either;
    if (score > bestScore) { best = k; bestScore = score; }
  }
  return best?.id ?? 'standard';
}
