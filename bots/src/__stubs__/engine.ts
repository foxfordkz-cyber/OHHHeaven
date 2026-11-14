// STUB engine for agent 07 (residents + balance). Same public signatures as build/CONTRACT.md §3–5:
// createWorld, applyAction, tickDay, netWorth, recommendOpening, managerOrders, computeStandings.
// Replace with @ohh/engine (agents 02, 03, 04, 13) when it lands in the main branch — sim/engine.ts switches.
// Deterministic, no Date / Math.random; inputs are not mutated (copy-on-write per call).
import type {
  Action, ActionResult, BusinessState, Case, Deal, DealTerms, FeedItem, FoundViolation, GameEvent, InboxItem,
  MonthReport, NicheId, OfficialRole, OfficialState, OpenRecommendation, Pack, PackSet, PackShortcut, PackViolation,
  Payout, PnlKind, PnlLine, Place, Player, Standing, StandingOrders, WorldConfig, WorldState,
} from '../../../shared/src/types';
import { RULES, dateOf, isMonthEnd } from '../../../shared/src/rules';

export interface EngineCtx { packs: PackSet; places: Place[]; /** simulator-only knobs (stub engine) */ tuning?: { routineEveryMonths?: number } }

// ───────────── lookups ─────────────
const placeCache = new WeakMap<Place[], Map<string, Place>>();
export function placeOf(ctx: EngineCtx, id: string): Place | undefined {
  let m = placeCache.get(ctx.places);
  if (!m) { m = new Map(ctx.places.map((p) => [p.id, p])); placeCache.set(ctx.places, m); }
  return m.get(id);
}
export function packOf(ctx: EngineCtx, niche: NicheId): Pack {
  const p = ctx.packs.niches[niche];
  if (!p) throw new Error(`no pack for ${niche}`);
  return p;
}
export function violationOf(ctx: EngineCtx, pack: Pack | undefined, id: string): PackViolation | undefined {
  return pack?.violations.find((v) => v.id === id) ?? ctx.packs.common.violations.find((v) => v.id === id);
}
export function shortcutOf(ctx: EngineCtx, pack: Pack, id: string): PackShortcut | undefined {
  return pack.shortcuts.find((s) => s.id === id) ?? ctx.packs.common.shortcuts.find((s) => s.id === id);
}
export function roleOfViolation(ctx: EngineCtx, pack: Pack | undefined, id: string): OfficialRole | null {
  const v = violationOf(ctx, pack, id);
  if (!v) return null;
  const off = pack?.officials.find((o) => o.id === v.official) ?? ctx.packs.common.officials.find((o) => o.id === v.official);
  return off?.role ?? null;
}
export function reportsFor(ctx: EngineCtx, pack: Pack) { return [...pack.reports, ...ctx.packs.common.reports]; }
export function allShortcuts(ctx: EngineCtx, pack: Pack) { return [...pack.shortcuts, ...ctx.packs.common.shortcuts]; }
export const maxSizeAt = (pack: Pack, place: Place) => Math.floor((place.sqft * RULES.USABLE_FLOOR_SHARE) / pack.sizing.sqftPerUnit);
export const monthlyRent = (place: Place) => (place.sqft * place.rentPerSqftYear) / 12;
export const staffCount = (o: StandingOrders) => Object.values(o.staff).reduce((s, n) => s + n, 0);
const SANITATION = new Set(['dirty_surfaces', 'pests', 'expired_food', 'no_sterilization']);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const r2 = (x: number) => Math.round(x * 100) / 100;

function distanceM(a: Place, b: Place): number {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ───────────── world ─────────────
export function createWorld(config: WorldConfig): WorldState {
  return { config, phase: 'running', day: 0, version: 0, bank: 0, players: [], businesses: [], officials: [], deals: [], cases: [], blockFunds: [], weather: [], events: [], feed: [], standings: [] };
}

/** Copy-on-write draft: top-level arrays are copied; entities are copied the first time they change. */
class Draft {
  w: WorldState;
  private copied = new Set<object>();
  constructor(src: WorldState) {
    this.w = { ...src, players: src.players.slice(), businesses: src.businesses.slice(), officials: src.officials.slice(), deals: src.deals.slice(), cases: src.cases.slice(), blockFunds: src.blockFunds.slice(), events: src.events, feed: src.feed.slice(), standings: src.standings };
  }
  biz(i: number): BusinessState {
    let b = this.w.businesses[i];
    if (!this.copied.has(b)) {
      b = { ...b, mtd: { ...b.mtd, lines: b.mtd.lines.slice(), lost: { ...b.mtd.lost } }, orders: { ...b.orders, staff: { ...b.orders.staff }, levers: { ...b.orders.levers }, shortcuts: b.orders.shortcuts.slice() }, trails: b.trails.map((t) => ({ ...t })), liabilities: b.liabilities.map((l) => ({ ...l })), days: b.days, history: b.history, trust: { ...b.trust }, owners: b.owners.slice(), permits: b.permits.slice(), items: b.items.slice() };
      this.w.businesses[i] = b; this.copied.add(b);
    }
    return b;
  }
  bizById(id: string): BusinessState | undefined { const i = this.w.businesses.findIndex((b) => b.id === id); return i < 0 ? undefined : this.biz(i); }
  deal(i: number): Deal { let d = this.w.deals[i]; if (!this.copied.has(d)) { d = { ...d }; this.w.deals[i] = d; this.copied.add(d); } return d; }
  case(i: number): Case { let c = this.w.cases[i]; if (!this.copied.has(c)) { c = { ...c }; this.w.cases[i] = c; this.copied.add(c); } return c; }
  official(i: number): OfficialState { let o = this.w.officials[i]; if (!this.copied.has(o)) { o = { ...o }; this.w.officials[i] = o; this.copied.add(o); } return o; }
  player(i: number): Player { let p = this.w.players[i]; if (!this.copied.has(p)) { p = { ...p, inbox: p.inbox.slice() }; this.w.players[i] = p; this.copied.add(p); } return p; }
  feed(kind: FeedItem['kind'], text: string, businessId?: string) {
    this.w.feed.push({ id: `f${this.w.day}-${this.w.feed.length}`, day: this.w.day, kind, text, businessId });
    if (this.w.feed.length > 200) this.w.feed.splice(0, this.w.feed.length - 200);
  }
  inbox(playerId: string, kind: InboxItem['kind'], title: string, text: string, ref?: InboxItem['ref']) {
    const i = this.w.players.findIndex((p) => p.id === playerId);
    if (i < 0) return;
    const p = this.player(i);
    p.inbox.push({ id: `i${this.w.day}-${p.inbox.length}`, day: this.w.day, kind, title, text, ref, read: false });
    if (p.inbox.length > 60) p.inbox.splice(0, p.inbox.length - 60);
  }
  done(): WorldState { this.w.version += 1; return this.w; }
}

function addLine(b: BusinessState, id: string, label: string, kind: PnlKind, amount: number) {
  if (!amount) return;
  b.cash += amount;
  const l = b.mtd.lines.find((x) => x.id === id);
  if (l) l.amount = r2(l.amount + amount); else b.mtd.lines.push({ id, label, kind, amount: r2(amount) });
}

function itemCost(pack: Pack, id: string, qty: number, size: number): number {
  const it = pack.setup.find((s) => s.id === id);
  if (!it) return 0;
  return it.cost * (it.scalesWithSize ? size : qty);
}
function itemsValue(pack: Pack, b: BusinessState): number {
  let v = 0;
  for (const it of b.items) {
    const s = pack.setup.find((x) => x.id === it.id);
    if (s && (s.kind === 'equipment' || s.kind === 'furniture' || s.kind === 'buildout')) v += s.cost * (s.scalesWithSize ? b.size : it.qty);
  }
  return v;
}
function baseQuality(pack: Pack, b: BusinessState): number {
  let q = 0.5;
  for (const it of b.items) q += pack.setup.find((s) => s.id === it.id)?.qualityBonus ?? 0;
  for (const lv of pack.levers) q += lv.options.find((o) => o.id === b.orders.levers[lv.id])?.effects?.quality ?? 0;
  return clamp(q, 0.05, 0.95);
}
function leverDemand(pack: Pack, b: BusinessState): number {
  let d = 0;
  for (const lv of pack.levers) d += lv.options.find((o) => o.id === b.orders.levers[lv.id])?.effects?.demand ?? 0;
  return 1 + d;
}

export function defaultOrders(pack: Pack, staff?: number): StandingOrders {
  const levers: Record<string, string> = {};
  for (const lv of pack.levers) levers[lv.id] = lv.options[0].id;
  return { price: pack.unit.refPrice, staff: { [pack.staff[0].id]: staff ?? pack.capacity.minStaff }, levers, shortcuts: [], blockFund: false, autopilot: 'hold' };
}

/** Expected monthly demand of one business at reference price, before competition effects. */
export function expectedMonthlyDemand(pack: Pack, place: Place): number {
  const e = Math.exp(5 * pack.market.weights.location * (place.footTraffic - 0.55));
  return pack.market.unitsPerSlotMonth * (0.6 + 0.8 * place.footTraffic) * (e / (e + 0.4286));
}

export function netWorth(b: BusinessState, ctx: EngineCtx, w?: WorldState): number {
  const pack = ctx.packs.niches[b.niche];
  const items = pack ? itemsValue(pack, b) : 0;
  const unpaid = b.liabilities.filter((l) => !l.paid).reduce((s, l) => s + l.amount, 0);
  let owed = 0;
  if (w) for (const d of w.deals) {
    if (d.status === 'active' && d.terms.type === 'loan' && d.toBusinessId === b.id) owed += Math.max(0, loanTotal(d.terms) - (d.paidBack ?? 0));
  }
  return r2(b.cash + RULES.NET_WORTH_ITEMS_SHARE * items - unpaid - owed);
}
const loanPayment = (t: Extract<DealTerms, { type: 'loan' }>) => {
  const r = t.monthlyRatePct / 100;
  return r === 0 ? t.amount / t.months : (t.amount * r) / (1 - (1 + r) ** -t.months);
};
const loanTotal = (t: Extract<DealTerms, { type: 'loan' }>) => loanPayment(t) * t.months;

// ───────────── recommendations (stub of agent 04) ─────────────
export function recommendOpening(niche: NicheId, placeId: string, w: WorldState, ctx: EngineCtx): OpenRecommendation[] {
  const pack = packOf(ctx, niche);
  const place = placeOf(ctx, placeId);
  if (!place) return [];
  const cap = Math.min(pack.sizing.max, maxSizeAt(pack, place));
  const demand = expectedMonthlyDemand(pack, place);
  const order: PackKitId[] = ['standard', 'lean', 'premium'];
  return order.map((id) => {
    const kit = pack.kits.find((k) => k.id === id)!;
    const size = clamp(kit.size, pack.sizing.min, cap);
    const items = kit.items.map((it) => ({ id: it.id, qty: pack.setup.find((s) => s.id === it.id)?.scalesWithSize ? size : it.qty }));
    const total = items.reduce((s, it) => s + itemCost(pack, it.id, it.qty, size), 0);
    const servable = Math.min(demand, size * pack.sizing.unitsServedPerSizeMonth / (1 - (pack.sizing.takeawayShare ?? 0)));
    const staff = clamp(Math.ceil((servable / (pack.capacity.unitsPerStaffMonth ?? servable)) * 1.05), pack.capacity.minStaff, pack.capacity.maxStaff);
    const orders = defaultOrders(pack, staff);
    const daysToOpen = Math.max(0, ...kit.items.map((it) => pack.setup.find((s) => s.id === it.id)?.waitDays ?? 0));
    return {
      kitId: id, size, items, total, cashLeft: pack.startCapital - total, orders, daysToOpen,
      why: [`${size} ${pack.sizing.unitName}s fit this ${place.sqft} sq ft space`, `Leaves $${Math.round(pack.startCapital - total).toLocaleString('en-US')} in the bank`, `Permits take ${daysToOpen} days — rent is due meanwhile: $${Math.round((monthlyRent(place) * daysToOpen) / 30).toLocaleString('en-US')}`],
    };
  }).filter((r) => r.cashLeft >= 0);
}
type PackKitId = 'lean' | 'standard' | 'premium';

/** Stub of agent 04's managerOrders: safe orders, no violations, staff to recent demand. */
export function managerOrders(b: BusinessState, w: WorldState, ctx: EngineCtx): Partial<StandingOrders> {
  const pack = packOf(ctx, b.niche);
  const recent = b.days.slice(-7);
  const demandDay = recent.length ? recent.reduce((s, d) => s + d.demandUnits, 0) / recent.length : expectedMonthlyDemand(pack, placeOf(ctx, b.placeId)!) / 30;
  const per = (pack.capacity.unitsPerStaffMonth ?? 1e9) / 30;
  const staff = clamp(Math.ceil((demandDay / per) * 1.05), pack.capacity.minStaff, pack.capacity.maxStaff);
  const levers: Record<string, string> = {};
  for (const lv of pack.levers) {
    const cur = lv.options.find((o) => o.id === b.orders.levers[lv.id]);
    levers[lv.id] = cur && !cur.causes ? cur.id : lv.options[0].id;
  }
  return { price: clamp(b.orders.price, pack.unit.refPrice * 0.9, pack.unit.refPrice * 1.15), staff: { [pack.staff[0].id]: staff }, levers, shortcuts: [] };
}

/** Stub of agent 04's price advice ("price below/above the optimum"): Lerner rule on the business's own books.
 *  p* = c / (1 - 1/e), e = |elasticity| × (1 - share of the niche); c = variable cost per unit incl. card fees. */
export function recommendedPrice(b: BusinessState, w: WorldState, ctx: EngineCtx): number {
  const pack = packOf(ctx, b.niche);
  const open = w.businesses.filter((x) => x.niche === b.niche && x.status === 'open').length || 1;
  const e = Math.abs(pack.market.priceElasticity) * (1 - 1 / (open + 0.4286 * open));
  const pctRev = pack.monthlyCosts.filter((c) => c.basis === 'pct_revenue').reduce((s, c) => s + c.amount, 0);
  const perUnit = pack.monthlyCosts.filter((c) => c.basis === 'per_unit').reduce((s, c) => s + c.amount, 0);
  const c = pack.unit.cogsPerUnit + perUnit;
  if (e <= 1.05) return pack.unit.priceMax;
  const p = c / Math.max(0.05, 1 - 1 / e - pctRev);
  return r2(clamp(p, pack.unit.priceMin, pack.unit.priceMax));
}

// ───────────── actions ─────────────
const err = (w: WorldState, error: string): ActionResult => ({ world: w, error });

export function applyAction(w: WorldState, ctx: EngineCtx, playerId: string, a: Action): ActionResult {
  if (w.phase !== 'running') return err(w, 'season ended');
  const pi = w.players.findIndex((p) => p.id === playerId);
  if (pi < 0) return err(w, 'unknown player');
  const player = w.players[pi];
  const bi = w.businesses.findIndex((b) => b.managerPlayerId === playerId && b.status !== 'bankrupt');
  const oi = w.officials.findIndex((o) => o.playerId === playerId);

  if (a.type === 'take_case' || a.type === 'dismiss_case' || a.type === 'answer_bribe') {
    if (player.kind !== 'official' || oi < 0) return err(w, 'not an official');
    return officialAction(w, ctx, oi, a);
  }
  if (a.type === 'read_inbox') {
    const d = new Draft(w); const p = d.player(pi);
    p.inbox = p.inbox.map((it) => (a.ids.includes(it.id) ? { ...it, read: true } : it));
    return { world: d.done() };
  }
  if (player.kind !== 'owner') return err(w, 'not an owner');
  if (a.type === 'open_business') return openBusiness(w, ctx, player, a);
  if (bi < 0) return err(w, 'no business');
  const b0 = w.businesses[bi];
  const pack = packOf(ctx, b0.niche);
  const d = new Draft(w);

  switch (a.type) {
    case 'launch': {
      if (b0.status !== 'setup') return err(w, 'already open');
      const b = d.biz(bi); b.status = 'open'; b.openedDay = w.day;
      d.feed('opening', `${b.name} opened its doors`, b.id);
      return { world: d.done() };
    }
    case 'set_orders': {
      const b = d.biz(bi); const o = a.orders;
      if (o.price !== undefined) { if (!Number.isFinite(o.price)) return err(w, 'bad price'); b.orders.price = r2(clamp(o.price, pack.unit.priceMin, pack.unit.priceMax)); }
      if (o.staff) {
        const roles = new Set(pack.staff.map((s) => s.id));
        for (const [k, v] of Object.entries(o.staff)) { if (!roles.has(k) || !Number.isFinite(v) || v < 0) return err(w, 'bad staff'); }
        const total = Object.values(o.staff).reduce((s, n) => s + Math.round(n), 0);
        if (total < pack.capacity.minStaff || total > pack.capacity.maxStaff) return err(w, 'staff out of range');
        b.orders.staff = Object.fromEntries(Object.entries(o.staff).map(([k, v]) => [k, Math.round(v)]));
      }
      if (o.levers) for (const [k, v] of Object.entries(o.levers)) {
        const lv = pack.levers.find((x) => x.id === k);
        if (!lv || !lv.options.some((x) => x.id === v)) return err(w, 'bad lever');
        b.orders.levers[k] = v;
      }
      if (o.shortcuts) {
        const ok = new Set(allShortcuts(ctx, pack).map((s) => s.id));
        if (!o.shortcuts.every((s) => ok.has(s))) return err(w, 'bad shortcut');
        b.orders.shortcuts = [...new Set(o.shortcuts)];
      }
      if (o.blockFund !== undefined) b.orders.blockFund = !!o.blockFund;
      if (o.autopilot !== undefined) { if (o.autopilot !== 'hold' && o.autopilot !== 'manager') return err(w, 'bad autopilot'); b.orders.autopilot = o.autopilot; }
      return { world: d.done() };
    }
    case 'resize': {
      const place = placeOf(ctx, b0.placeId)!;
      const size = Math.round(a.size);
      if (size < pack.sizing.min || size > Math.min(pack.sizing.max, maxSizeAt(pack, place))) return err(w, 'size does not fit');
      const b = d.biz(bi);
      const perUnit = pack.setup.filter((s) => s.scalesWithSize).reduce((s, x) => s + x.cost, 0);
      const delta = size - b.size;
      const money = delta > 0 ? -perUnit * delta : perUnit * -delta * RULES.RESALE_SHARE;
      if (b.cash + money < 0) return err(w, 'not enough cash');
      addLine(b, 'resize', 'Furniture bought / sold', 'setup', money); b.size = size;
      return { world: d.done() };
    }
    case 'buy_item': case 'sell_item': {
      const it = pack.setup.find((s) => s.id === a.itemId);
      const qty = Math.round(a.qty);
      if (!it || qty <= 0 || it.scalesWithSize) return err(w, 'bad item');
      const b = d.biz(bi);
      const have = b.items.find((x) => x.id === it.id)?.qty ?? 0;
      if (a.type === 'buy_item') {
        if (b.cash < it.cost * qty) return err(w, 'not enough cash');
        addLine(b, 'buy_item', 'Equipment bought', 'setup', -it.cost * qty);
        b.items = have ? b.items.map((x) => (x.id === it.id ? { ...x, qty: x.qty + qty } : x)) : [...b.items, { id: it.id, qty }];
      } else {
        if (have < qty || it.required) return err(w, 'cannot sell');
        addLine(b, 'sell_item', 'Equipment sold', 'setup', it.cost * qty * RULES.RESALE_SHARE);
        b.items = b.items.map((x) => (x.id === it.id ? { ...x, qty: x.qty - qty } : x)).filter((x) => x.qty > 0);
      }
      return { world: d.done() };
    }
    case 'spend': {
      const amount = a.kind === 'deep_clean' ? 600 : a.kind === 'accountant' ? 800 : Math.round(a.amount ?? 500);
      if (!(amount > 0)) return err(w, 'bad amount');
      const b = d.biz(bi);
      if (b.cash < amount) return err(w, 'not enough cash');
      addLine(b, `spend_${a.kind}`, `Spent on ${a.kind.replace('_', ' ')}`, 'opex', -amount);
      if (a.kind === 'marketing') b.reputation = clamp(b.reputation + Math.min(0.05, amount / 40000), 0, 1);
      if (a.kind === 'training') b.quality = clamp(b.quality + Math.min(0.05, amount / 30000), 0, 1);
      if (a.kind === 'deep_clean') b.trails = b.trails.filter((t) => !SANITATION.has(t.violationId));
      if (a.kind === 'accountant') {
        const idx = b.trails.findIndex((t) => roleOfViolation(ctx, pack, t.violationId) === 'tax_auditor');
        if (idx >= 0) { addLine(b, 'back_taxes', 'Back taxes paid voluntarily', 'tax', -b.trails[idx].saved); b.trails.splice(idx, 1); }
      }
      return { world: d.done() };
    }
    case 'report': {
      const ti = w.businesses.findIndex((x) => x.id === a.targetBusinessId);
      if (ti < 0 || ti === bi) return err(w, 'bad target');
      const t = w.businesses[ti];
      if (t.status === 'bankrupt' || t.status === 'closed') return err(w, 'target not operating');
      const tp = packOf(ctx, t.niche);
      const rep = reportsFor(ctx, tp).find((r) => r.id === a.reportId);
      if (!rep) return err(w, 'bad report');
      const recent = w.cases.filter((c) => c.reporterBusinessId === b0.id && c.openedDay > w.day - 7).length;
      if (recent >= RULES.REPORTS_PER_WEEK) return err(w, 'report limit');
      d.w.cases.push({ id: `c${w.cases.length + 1}`, businessId: t.id, role: rep.role, origin: 'report', reportId: rep.id, reporterBusinessId: b0.id, openedDay: w.day, hints: [`Complaint: ${rep.name}`], status: 'open' });
      d.feed('report', `Someone reported ${t.name} to the city`, t.id);
      return { world: d.done() };
    }
    case 'answer_notice': {
      const ci = w.cases.findIndex((c) => c.id === a.caseId && c.businessId === b0.id);
      if (ci < 0 || w.cases[ci].status !== 'notice') return err(w, 'no such notice');
      if (a.response === 'bribe') {
        const amt = Math.round(a.bribeAmount ?? 0);
        if (!(amt > 0) || amt > b0.cash) return err(w, 'bad bribe');
        const c = d.case(ci); c.status = 'bribe_offered'; c.response = 'bribe'; c.bribeAmount = amt; c.answerByDay = w.day + RULES.BRIBE_ANSWER_DAYS;
        return { world: d.done() };
      }
      settle(d, ctx, ci, a.response);
      return { world: d.done() };
    }
    case 'propose_deal': return proposeDeal(w, ctx, d, bi, a.toBusinessId, a.terms);
    case 'answer_deal': {
      const di = w.deals.findIndex((x) => x.id === a.dealId);
      if (di < 0) return err(w, 'no deal');
      const deal = w.deals[di];
      if (deal.toBusinessId !== b0.id || deal.status !== 'proposed') return err(w, 'cannot answer');
      const dd = d.deal(di);
      if (!a.accept) { dd.status = 'declined'; return { world: d.done() }; }
      const activeOf = (id: string) => w.deals.filter((x) => x.status === 'active' && (x.fromBusinessId === id || x.toBusinessId === id)).length;
      if (activeOf(deal.fromBusinessId) >= RULES.MAX_ACTIVE_DEALS || activeOf(deal.toBusinessId) >= RULES.MAX_ACTIVE_DEALS) { dd.status = 'expired'; return { world: d.done() }; }
      const from = d.bizById(deal.fromBusinessId);
      if (!from || from.status === 'bankrupt') { dd.status = 'expired'; return { world: d.done() }; }
      const to = d.biz(bi);
      if (deal.terms.type === 'loan' || deal.terms.type === 'partnership') {
        if (from.cash < deal.terms.amount) { dd.status = 'expired'; return { world: d.done() }; }
        addLine(from, `deal_${deal.id}`, `Deal ${deal.terms.type} with ${to.name}`, 'deal', -deal.terms.amount);
        addLine(to, `deal_${deal.id}`, `Deal ${deal.terms.type} with ${from.name}`, 'deal', deal.terms.amount);
        if (deal.terms.type === 'partnership') {
          const s = deal.terms.sharePct / 100;
          to.owners = [...to.owners.map((o) => ({ ...o, share: o.share * (1 - s) })), { playerId: from.managerPlayerId, share: s }];
        }
      }
      dd.status = 'active'; dd.startDay = w.day; dd.paidBack = 0;
      d.feed('deal', `${from.name} and ${to.name} made a deal: ${deal.terms.type.replace('_', ' ')}`, to.id);
      return { world: d.done() };
    }
    case 'cancel_deal': {
      const di = w.deals.findIndex((x) => x.id === a.dealId);
      if (di < 0) return err(w, 'no deal');
      const deal = w.deals[di];
      if (deal.fromBusinessId !== b0.id && deal.toBusinessId !== b0.id) return err(w, 'not your deal');
      const dd = d.deal(di);
      if (deal.status === 'proposed' && deal.fromBusinessId === b0.id) { dd.status = 'cancelled'; return { world: d.done() }; }
      if (deal.status !== 'active') return err(w, 'not active');
      dd.status = 'broken'; dd.endDay = w.day;
      d.biz(bi).trust.broken += 1;
      d.feed('deal', `${b0.name} walked out of a deal`, b0.id);
      return { world: d.done() };
    }
  }
  return err(w, `unsupported action`);
}

function openBusiness(w: WorldState, ctx: EngineCtx, player: Player, a: Extract<Action, { type: 'open_business' }>): ActionResult {
  if (w.businesses.some((b) => b.managerPlayerId === player.id)) return err(w, 'one business per owner per season');
  const pack = ctx.packs.niches[a.niche];
  const place = placeOf(ctx, a.placeId);
  if (!pack || !place || !place.suitableFor.includes(a.niche)) return err(w, 'bad niche or place');
  if (w.businesses.some((b) => b.placeId === a.placeId && b.status !== 'bankrupt')) return err(w, 'place taken');
  const size = Math.round(a.size);
  if (size < pack.sizing.min || size > Math.min(pack.sizing.max, maxSizeAt(pack, place))) return err(w, 'size does not fit');
  const kit = pack.kits.find((k) => k.id === a.kitId);
  if (!kit) return err(w, 'bad kit');
  const items = (a.items ?? kit.items).map((it) => ({ id: it.id, qty: pack.setup.find((s) => s.id === it.id)?.scalesWithSize ? size : Math.max(1, Math.round(it.qty)) }));
  for (const req of pack.setup.filter((s) => s.required)) if (!items.some((it) => it.id === req.id)) return err(w, `missing ${req.id}`);
  if (items.some((it) => !pack.setup.some((s) => s.id === it.id))) return err(w, 'unknown item');
  const cost = items.reduce((s, it) => s + itemCost(pack, it.id, it.qty, size), 0);
  if (cost > pack.startCapital) return err(w, 'not enough capital');
  const d = new Draft(w);
  const id = `b${w.businesses.length + 1}`;
  const permits = items.flatMap((it) => { const s = pack.setup.find((x) => x.id === it.id)!; return s.waitDays ? [{ itemId: s.id, appliedDay: w.day, readyDay: w.day + s.waitDays }] : []; });
  const b: BusinessState = {
    id, name: a.name.slice(0, 40) || `${player.name}'s ${pack.name}`, niche: a.niche, placeId: a.placeId, isAi: player.isAi,
    owners: [{ playerId: player.id, share: 1 }], managerPlayerId: player.id, status: 'setup', createdDay: w.day,
    cash: pack.startCapital, size, items, setupSpent: cost, permits, quality: 0.5, reputation: 0.5, trust: { kept: 0, broken: 0 },
    orders: defaultOrders(pack), trails: [], liabilities: [],
    mtd: { lines: [{ id: 'setup', label: 'Opening purchases', kind: 'setup', amount: -cost }], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } },
    days: [], history: [],
  };
  b.cash -= cost;
  b.quality = baseQuality(pack, b);
  d.w.businesses.push(b);
  return { world: d.done() };
}

function proposeDeal(w: WorldState, ctx: EngineCtx, d: Draft, bi: number, toId: string, terms: DealTerms): ActionResult {
  const from = w.businesses[bi];
  const to = w.businesses.find((b) => b.id === toId);
  if (!to || to.id === from.id) return err(w, 'bad partner');
  if (from.status !== 'open' || to.status !== 'open') return err(w, 'both must be open');
  // proposer: active + own pending offers; partner: active deals only (that is what the proposer can see)
  const live = (id: string, withProposed: boolean) => w.deals.filter((x) => (x.fromBusinessId === id || x.toBusinessId === id) && (x.status === 'active' || (withProposed && x.status === 'proposed'))).length;
  if (live(from.id, true) >= RULES.MAX_ACTIVE_DEALS || live(to.id, false) >= RULES.MAX_ACTIVE_DEALS) return err(w, 'too many deals');
  if (w.deals.some((x) => x.status === 'proposed' && x.fromBusinessId === from.id && x.toBusinessId === to.id)) return err(w, 'already proposed');
  switch (terms.type) {
    case 'joint_purchase': if (from.niche !== to.niche || !(terms.months >= 1 && terms.months <= 12)) return err(w, 'joint purchase: same niche, 1–12 months'); break;
    case 'cross_promo': {
      const pa = placeOf(ctx, from.placeId)!, pb = placeOf(ctx, to.placeId)!;
      if (from.niche === to.niche || distanceM(pa, pb) > 400 || !(terms.months >= 1 && terms.months <= 12)) return err(w, 'cross promo: other niche within 400 m');
      break;
    }
    case 'loan': if (!(terms.amount > 0) || terms.amount > from.cash || !(terms.monthlyRatePct >= 0 && terms.monthlyRatePct <= RULES.LOAN_MAX_RATE_PCT) || !(terms.months >= 1 && terms.months <= 12)) return err(w, 'bad loan'); break;
    case 'partnership': if (!(terms.amount > 0) || terms.amount > from.cash || !(terms.sharePct >= 5 && terms.sharePct <= 49)) return err(w, 'bad partnership'); break;
    default: return err(w, 'bad terms');
  }
  d.w.deals.push({ id: `d${w.deals.length + 1}`, fromBusinessId: from.id, toBusinessId: to.id, terms, status: 'proposed', proposedDay: w.day, expiresDay: w.day + RULES.DEAL_OFFER_DAYS });
  d.inbox(to.managerPlayerId, 'deal', 'New deal offer', `${from.name} offers ${terms.type.replace('_', ' ')}`, { type: 'deal', id: `d${w.deals.length + 1}` });
  return { world: d.done() };
}

function officialAction(w: WorldState, ctx: EngineCtx, oi: number, a: Extract<Action, { type: 'take_case' | 'dismiss_case' | 'answer_bribe' }>): ActionResult {
  const off = w.officials[oi];
  const ci = w.cases.findIndex((c) => c.id === a.caseId);
  if (ci < 0) return err(w, 'no case');
  const c0 = w.cases[ci];
  if (off.exposed && (off.suspendedUntilDay ?? 0) > w.day) return err(w, 'suspended');
  const d = new Draft(w);
  if (a.type === 'take_case') {
    if (c0.status !== 'open' || c0.role !== off.role) return err(w, 'cannot take');
    const recent = w.cases.some((c) => c.officialId === off.id && c.businessId === c0.businessId && (c.takenDay ?? -999) > w.day - RULES.SAME_TARGET_COOLDOWN_DAYS);
    if (recent) return err(w, 'same target cooldown');
    const c = d.case(ci); c.status = 'taken'; c.officialId = off.id; c.takenDay = w.day; c.inspectDay = w.day + RULES.INSPECTION_DAYS;
    return { world: d.done() };
  }
  if (c0.officialId && c0.officialId !== off.id) return err(w, 'not your case');
  if (a.type === 'dismiss_case') {
    if (c0.status !== 'open' && c0.status !== 'taken') return err(w, 'cannot dismiss');
    const c = d.case(ci); c.status = 'closed'; c.outcome = 'dismissed'; c.closedDay = w.day; c.officialId = off.id;
    return { world: d.done() };
  }
  if (c0.status !== 'bribe_offered') return err(w, 'no bribe');
  if (a.accept) {
    const bIdx = w.businesses.findIndex((b) => b.id === c0.businessId);
    const b = d.biz(bIdx);
    const amt = Math.min(c0.bribeAmount ?? 0, Math.max(0, b.cash));
    addLine(b, 'bribe', 'Cash handed over', 'other', -amt);
    const c = d.case(ci); c.status = 'closed'; c.outcome = 'bribed'; c.closedDay = w.day;
    const o = d.official(oi); o.points += RULES.POINTS_PER_BRIBE * (c0.found?.length ?? 1); o.bribesThisMonth += 1; o.bribesTaken += amt; o.casesClosed += 1;
  } else {
    settle(d, ctx, ci, 'refused');
  }
  return { world: d.done() };
}

/** Owner pays (or contests, or a bribe was refused): fine, closure, reputation, trails cleared. */
function settle(d: Draft, ctx: EngineCtx, ci: number, how: 'pay' | 'contest' | 'refused') {
  const c = d.case(ci);
  const bIdx = d.w.businesses.findIndex((b) => b.id === c.businessId);
  if (bIdx < 0) return;
  const b = d.biz(bIdx);
  const pack = ctx.packs.niches[b.niche]!;
  const base = c.fine ?? 0;
  const fine = how === 'contest' ? base * RULES.CONTEST_FINE_MULT : how === 'refused' ? base * RULES.REFUSED_BRIBE_FINE_MULT : base;
  if (how === 'contest') addLine(b, 'contest_fee', 'Lawyer (contest)', 'fine', -RULES.CONTEST_FEE);
  addLine(b, 'fine', 'Fines', 'fine', -fine);
  const found = new Set((c.found ?? []).map((f) => f.violationId));
  let hit = 0;
  for (const id of found) hit += violationOf(ctx, pack, id)?.reputationHit ?? 0;
  b.reputation = clamp(b.reputation - hit, 0, 1);
  b.trails = b.trails.filter((t) => !found.has(t.violationId));
  if ((c.closureDays ?? 0) > 0) { b.status = 'closed'; b.closedUntilDay = d.w.day + (c.closureDays ?? 0); }
  c.status = 'closed'; c.outcome = 'fined'; c.closedDay = d.w.day; c.response = how === 'refused' ? 'bribe' : how;
  const oi = d.w.officials.findIndex((o) => o.id === c.officialId);
  if (oi >= 0) d.official(oi).casesClosed += 1;
  d.feed('inspection', `City fined ${b.name} $${Math.round(fine).toLocaleString('en-US')}`, b.id);
}

// ───────────── the day ─────────────
interface Mods { cogs: number; demand: number; price: number; traffic: number }

function eventMult(events: GameEvent[], day: number, target: string, niche: NicheId, place: Place): number {
  let m = 1;
  for (const e of events) {
    if (day < e.startDay || day > e.endDay) continue;
    if (e.block && e.block !== place.block) continue;
    for (const ef of e.effects) {
      if (ef.target !== target) continue;
      if (ef.niches && !ef.niches.includes(niche)) continue;
      if (ef.tiers && !ef.tiers.includes(place.tier)) continue;
      m *= clamp(ef.mult, 0.5, 1.5);
    }
  }
  return m;
}

export function dealModifiers(w: WorldState, ctx: EngineCtx, businessId: string): Mods {
  const m: Mods = { cogs: 1, demand: 1, price: 1, traffic: 1 };
  for (const dl of w.deals) {
    if (dl.status !== 'active' || (dl.fromBusinessId !== businessId && dl.toBusinessId !== businessId)) continue;
    if (dl.terms.type === 'joint_purchase') m.cogs = RULES.JOINT_PURCHASE_COGS_MULT;
    if (dl.terms.type === 'cross_promo') { m.demand *= RULES.CROSS_PROMO_DEMAND_MULT; m.price *= RULES.CROSS_PROMO_PRICE_MULT; }
  }
  const b = w.businesses.find((x) => x.id === businessId);
  const place = b && placeOf(ctx, b.placeId);
  if (place && w.blockFunds.some((f) => f.block === place.block && f.active && f.month === dateOf(w.day).month)) m.traffic *= RULES.BLOCK_FUND_TRAFFIC_MULT;
  return m;
}

export function tickDay(w0: WorldState, ctx: EngineCtx): WorldState {
  if (w0.phase !== 'running') return w0;
  const d = new Draft(w0);
  const w = d.w;
  w.day += 1;
  const day = w.day;
  const date = dateOf(day);
  // deals: expired offers
  w.deals.forEach((dl, i) => { if (dl.status === 'proposed' && day > dl.expiresDay) d.deal(i).status = 'expired'; });
  lawDay(d, ctx);
  // reopen businesses closed by inspection
  w.businesses.forEach((b, i) => { if (b.status === 'closed' && (b.closedUntilDay ?? 0) <= day) { const x = d.biz(i); x.status = 'open'; x.closedUntilDay = undefined; } });
  economyDay(d, ctx, date.weekday);
  if (isMonthEnd(day)) monthClose(d, ctx, date.month);
  if (day >= w.config.seasonMonths * RULES.DAYS_PER_MONTH) finalizeSeason(d, ctx);
  return d.done();
}

function modsMap(w: WorldState, ctx: EngineCtx): Map<string, Mods> {
  const map = new Map<string, Mods>();
  const get = (id: string) => { let m = map.get(id); if (!m) { m = { cogs: 1, demand: 1, price: 1, traffic: 1 }; map.set(id, m); } return m; };
  for (const dl of w.deals) {
    if (dl.status !== 'active') continue;
    for (const id of [dl.fromBusinessId, dl.toBusinessId]) {
      const m = get(id);
      if (dl.terms.type === 'joint_purchase') m.cogs = RULES.JOINT_PURCHASE_COGS_MULT;
      if (dl.terms.type === 'cross_promo') { m.demand *= RULES.CROSS_PROMO_DEMAND_MULT; m.price *= RULES.CROSS_PROMO_PRICE_MULT; }
    }
  }
  const month = dateOf(w.day).month;
  const active = new Set(w.blockFunds.filter((f) => f.active && f.month === month).map((f) => f.block));
  if (active.size) for (const b of w.businesses) if (active.has(placeOf(ctx, b.placeId)!.block)) get(b.id).traffic *= RULES.BLOCK_FUND_TRAFFIC_MULT;
  return map;
}
const NO_MODS: Mods = { cogs: 1, demand: 1, price: 1, traffic: 1 };

function economyDay(d: Draft, ctx: EngineCtx, weekday: number) {
  const w = d.w, day = w.day;
  const mods = modsMap(w, ctx);
  const todayW = w.weather.find((x) => x.day === day);
  const weather = todayW?.footTrafficMult ?? 1;
  const wd = weekday === 5 ? 1.15 : weekday === 6 ? 0.9 : 1;
  const byNiche = new Map<NicheId, number[]>();
  w.businesses.forEach((b, i) => { if (b.status === 'open') { const a = byNiche.get(b.niche) ?? []; a.push(i); byNiche.set(b.niche, a); } });
  // setup and closed businesses still log an empty day
  w.businesses.forEach((b, i) => {
    if (b.status === 'setup' || b.status === 'closed') {
      const x = d.biz(i);
      x.days = [...x.days.slice(-29), { day, demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 }, revenue: 0, variableCosts: 0, sizeUtilization: 0, weather: todayW?.condition ?? 'clear', notes: [b.status === 'closed' ? 'Closed by the city today' : 'Not open yet'] }];
    }
  });
  for (const [niche, idxs] of byNiche) {
    const pack = packOf(ctx, niche);
    const eps = Math.abs(pack.market.priceElasticity);
    const kq = 6 * pack.market.weights.quality, kr = 10 * pack.market.weights.reputation, kl = 5 * pack.market.weights.location;
    const rows = idxs.map((i) => {
      const b = w.businesses[i];
      const place = placeOf(ctx, b.placeId)!;
      const m = mods.get(b.id) ?? NO_MODS;
      const traffic = weather * wd * m.traffic * eventMult(w.events, day, 'footTraffic', niche, place);
      const slot = (pack.market.unitsPerSlotMonth / 30) * (0.6 + 0.8 * place.footTraffic) * traffic;
      const price = b.orders.price * m.price;
      const U = -eps * Math.log(price / pack.unit.refPrice) + kq * (b.quality - 0.5) + kr * (b.reputation - 0.5) + kl * (place.footTraffic - 0.55);
      const dm = m.demand * leverDemand(pack, b) * eventMult(w.events, day, 'demand', niche, place);
      return { i, place, m, slot, price, e: Math.exp(U), dm };
    });
    const pool = rows.reduce((s, r) => s + r.slot, 0);
    const denom = rows.reduce((s, r) => s + r.e, 0) + 0.4286 * rows.length;
    for (const r of rows) {
      const b = d.biz(r.i);
      const demand = (pool * r.e / denom) * r.dm;
      const staffAvail = eventMult(w.events, day, 'staffAvailability', niche, r.place);
      const staffCap = staffCount(b.orders) * ((pack.capacity.unitsPerStaffMonth ?? 1e9) / 30) * staffAvail;
      const sizeCap = (b.size * pack.sizing.unitsServedPerSizeMonth) / 30 / (1 - (pack.sizing.takeawayShare ?? 0));
      const hard = pack.capacity.hardCapUnits ? pack.capacity.hardCapUnits / 30 : Infinity;
      const served = Math.min(demand, staffCap, sizeCap, hard);
      const lost = { size: 0, staff: 0, closure: 0 };
      if (demand > served + 1e-9) { if (sizeCap <= staffCap) lost.size = demand - served; else lost.staff = demand - served; }
      const util = sizeCap > 0 ? served / sizeCap : 0;
      const notes: string[] = [];
      let qTarget = baseQuality(pack, b);
      if (util > (pack.sizing.crowdPenaltyAbove ?? 1)) { qTarget -= 0.1; notes.push(`Line out the door: ${Math.round(lost.size + lost.staff)} customers walked away`); }
      b.quality = clamp(b.quality + 0.1 * (qTarget - b.quality), 0, 1);
      const lostShare = demand > 0 ? (lost.size + lost.staff) / demand : 0;
      let repTarget = 0.5 + 0.3 * (b.quality - 0.5) - 0.4 * lostShare;
      if (util < (pack.sizing.emptyPenaltyBelow ?? 0)) { repTarget -= 0.05; notes.push('Half-empty room today'); }
      b.reputation = clamp(b.reputation + 0.03 * (repTarget - b.reputation), 0, 1);
      const revenue = served * r.price;
      const cogs = served * pack.unit.cogsPerUnit * r.m.cogs * eventMult(w.events, day, 'cogs', niche, r.place);
      addLine(b, 'revenue', 'Sales', 'revenue', revenue);
      addLine(b, 'cogs', 'Cost of goods', 'cogs', -cogs);
      for (const t of pack.taxes) {
        if (t.base !== 'taxable_revenue') continue;
        const tax = revenue * t.rate;
        addLine(b, 'sales_tax_collected', 'Sales tax collected (owed to the state)', 'tax', tax);
        accrue(b, t.id, tax, quarterEndDay(day));
      }
      b.mtd.demandUnits += demand; b.mtd.servedUnits += served;
      b.mtd.lost.size += lost.size; b.mtd.lost.staff += lost.staff;
      b.days = [...b.days.slice(-29), { day, demandUnits: r2(demand), servedUnits: r2(served), lost: { size: r2(lost.size), staff: r2(lost.staff), closure: 0 }, revenue: r2(revenue), variableCosts: r2(cogs), sizeUtilization: r2(util), weather: todayW?.condition ?? 'clear', notes }];
    }
  }
}

const quarterEndDay = (day: number) => Math.ceil(day / 90) * 90;
function accrue(b: BusinessState, taxId: string, amount: number, dueDay: number) {
  const l = b.liabilities.find((x) => x.taxId === taxId && x.dueDay === dueDay && !x.paid);
  if (l) l.amount += amount; else b.liabilities.push({ taxId, amount, dueDay, paid: false });
}

function monthClose(d: Draft, ctx: EngineCtx, month: number) {
  const w = d.w, day = w.day;
  const bankrupt: number[] = [];
  w.businesses.forEach((b0, i) => {
    if (b0.status === 'bankrupt') return;
    const b = d.biz(i);
    const pack = packOf(ctx, b.niche);
    const place = placeOf(ctx, b.placeId)!;
    const revenue = b.mtd.lines.find((l) => l.id === 'revenue')?.amount ?? 0;
    const staffN = staffCount(b.orders);
    const payroll = pack.staff.reduce((s, r) => s + (b.orders.staff[r.id] ?? 0) * r.hourlyWage * r.hoursPerMonth, 0);
    const rent = monthlyRent(place);
    const operating = b.status === 'open' || b.status === 'closed';
    addLine(b, 'rent', 'Rent', 'rent', -rent);
    if (operating) {
      addLine(b, 'payroll', 'Wages', 'payroll', -payroll);
      if (b.orders.autopilot === 'manager') addLine(b, 'manager', 'Manager salary', 'payroll', -pack.manager.monthlySalary);
      for (const t of [...ctx.packs.common.taxes, ...pack.taxes]) if (t.base === 'payroll') addLine(b, t.id, t.name, 'payroll_tax', -payroll * t.rate);
      for (const c of pack.monthlyCosts) {
        const amt = c.basis === 'fixed' ? c.amount : c.basis === 'per_staff' ? c.amount * staffN : c.basis === 'per_unit' ? c.amount * b.mtd.servedUnits : c.basis === 'pct_revenue' ? c.amount * revenue : c.amount * b.size;
        addLine(b, c.id, c.name, 'opex', -amt);
      }
      addLine(b, 'cleaning_size', 'Cleaning (per seat)', 'opex', -pack.sizing.cleaningCostPerSizeMonth * b.size);
      for (const lv of pack.levers) {
        const opt = lv.options.find((o) => o.id === b.orders.levers[lv.id]);
        if (opt) addLine(b, `lever_${lv.id}`, `${lv.name}: ${opt.label}`, 'opex', -opt.monthlyCost);
      }
      if (b.orders.blockFund) addLine(b, 'block_fund', 'Block fund', 'deal', -RULES.BLOCK_FUND_FEE_MONTH);
      // shortcuts → savings now, trails for later
      const grow = (violationId: string, saved: number) => {
        const t = b.trails.find((x) => x.violationId === violationId);
        if (t) { t.months += 1; t.saved += saved; t.lastActiveMonth = month; } else b.trails.push({ violationId, months: 1, saved, lastActiveMonth: month, discovered: false });
      };
      for (const id of b.orders.shortcuts) {
        const sc = shortcutOf(ctx, pack, id);
        if (!sc) continue;
        const s = sc.saves;
        const saved = s.basis === 'fixed' ? s.amount : s.basis === 'pct_payroll' ? s.amount * payroll : s.basis === 'pct_revenue' ? s.amount * revenue : s.basis === 'pct_rent' ? s.amount * rent : s.amount * staffN;
        addLine(b, `saving_${id}`, `Saved: ${sc.name}`, 'saving', saved);
        grow(sc.violation, saved);
      }
      for (const lv of pack.levers) {
        const opt = lv.options.find((o) => o.id === b.orders.levers[lv.id]);
        if (opt?.causes) grow(opt.causes, Math.max(0, lv.options[0].monthlyCost - opt.monthlyCost));
      }
      for (const p of b.permits) {
        if (p.readyDay > day - 30 && b.openedDay !== undefined && b.openedDay < p.readyDay) {
          const s = pack.setup.find((x) => x.id === p.itemId);
          if (s?.withoutItViolation) grow(s.withoutItViolation, 0);
        }
      }
    }
    // income tax accrues on positive profit; everything due at quarter end is paid now
    const profitBeforeTax = b.mtd.lines.filter((l) => l.kind !== 'setup' && l.kind !== 'deal' && l.kind !== 'tax').reduce((s, l) => s + l.amount, 0);
    for (const t of ctx.packs.common.taxes) if (t.base === 'profit' && profitBeforeTax > 0) accrue(b, t.id, profitBeforeTax * t.rate, quarterEndDay(day));
    const due = b.liabilities.filter((l) => !l.paid && l.dueDay <= day);
    if (due.length) { addLine(b, 'taxes_paid', 'Taxes paid', 'tax', -due.reduce((s, l) => s + l.amount, 0)); b.liabilities = b.liabilities.filter((l) => !(l.dueDay <= day)); }
    // trails expire
    b.trails = b.trails.filter((t) => month - t.lastActiveMonth < RULES.TRAIL_EXPIRY_MONTHS);
  });
  dealsMonthClose(d, ctx, month);
  lawMonthClose(d, ctx, month);
  w.businesses.forEach((b0, i) => {
    if (b0.status === 'bankrupt') return;
    const b = d.biz(i);
    const lines = b.mtd.lines;
    const revenue = lines.find((l) => l.id === 'revenue')?.amount ?? 0;
    const profit = lines.filter((l) => l.kind !== 'setup' && l.kind !== 'deal' && l.kind !== 'tax').reduce((s, l) => s + l.amount, 0);
    const cashEnd = b.cash;
    const cashStart = cashEnd - lines.reduce((s, l) => s + l.amount, 0);
    const rep: MonthReport = {
      month, avgPrice: b.orders.price, demandUnits: r2(b.mtd.demandUnits), servedUnits: r2(b.mtd.servedUnits), lost: { size: r2(b.mtd.lost.size), staff: r2(b.mtd.lost.staff), closure: 0 },
      capacityUnits: 0, sizeUtilization: 0, lines, revenue: r2(revenue), profit: r2(profit), cashStart: r2(cashStart), cashEnd: r2(cashEnd),
      taxesAccrued: 0, taxesPaid: -(lines.find((l) => l.id === 'taxes_paid')?.amount ?? 0), fines: -(lines.filter((l) => l.kind === 'fine').reduce((s, l) => s + l.amount, 0)),
      quality: r2(b.quality), reputation: r2(b.reputation), netWorth: netWorth(b, ctx, w), rankInNiche: 0,
    };
    b.history = [...b.history, rep];
    b.mtd = { lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } };
    if (b.cash < 0) bankrupt.push(i);
  });
  for (const i of bankrupt) {
    const b = d.biz(i);
    b.status = 'bankrupt'; b.bankruptDay = w.day;
    d.feed('bankruptcy', `${b.name} went bankrupt`, b.id);
    w.deals.forEach((dl, j) => { if (dl.status === 'active' && (dl.fromBusinessId === b.id || dl.toBusinessId === b.id)) { const x = d.deal(j); x.status = 'broken'; x.endDay = w.day; } });
  }
  w.standings = computeStandings(w, ctx);
}

function dealsMonthClose(d: Draft, ctx: EngineCtx, month: number) {
  const w = d.w;
  w.deals.forEach((dl, j) => {
    if (dl.status !== 'active') return;
    const fi = w.businesses.findIndex((b) => b.id === dl.fromBusinessId), ti = w.businesses.findIndex((b) => b.id === dl.toBusinessId);
    if (fi < 0 || ti < 0) return;
    const x = d.deal(j);
    const t = dl.terms;
    if (t.type === 'loan') {
      const pay = loanPayment(t);
      const debtor = d.biz(ti), lender = d.biz(fi);
      if (debtor.cash < pay) { x.status = 'broken'; x.endDay = w.day; debtor.trust.broken += 1; d.feed('deal', `${debtor.name} missed a loan payment`, debtor.id); return; }
      addLine(debtor, `loan_${dl.id}`, `Loan payment to ${lender.name}`, 'deal', -pay);
      addLine(lender, `loan_${dl.id}`, `Loan payment from ${debtor.name}`, 'deal', pay);
      x.paidBack = (x.paidBack ?? 0) + pay;
      if (x.paidBack >= loanTotal(t) - 0.01) { x.status = 'completed'; x.endDay = w.day; debtor.trust.kept += 1; lender.trust.kept += 1; }
      return;
    }
    if (t.type === 'partnership') {
      const biz = d.biz(ti), inv = d.biz(fi);
      const profit = biz.mtd.lines.filter((l) => l.kind !== 'setup' && l.kind !== 'deal' && l.kind !== 'tax').reduce((s, l) => s + l.amount, 0);
      if (profit > 0) { const share = (profit * t.sharePct) / 100; addLine(biz, `share_${dl.id}`, `Profit share to ${inv.name}`, 'deal', -share); addLine(inv, `share_${dl.id}`, `Profit share from ${biz.name}`, 'deal', share); }
      return;
    }
    if (w.day - (dl.startDay ?? w.day) >= t.months * RULES.DAYS_PER_MONTH) {
      x.status = 'completed'; x.endDay = w.day; d.biz(fi).trust.kept += 1; d.biz(ti).trust.kept += 1;
    }
  });
  // block fund for next month
  const blocks = new Map<string, { eligible: number; contributors: number }>();
  for (const b of w.businesses) {
    if (b.status !== 'open' && b.status !== 'closed') continue;
    const blk = placeOf(ctx, b.placeId)!.block;
    const s = blocks.get(blk) ?? { eligible: 0, contributors: 0 };
    s.eligible += 1; if (b.orders.blockFund) s.contributors += 1;
    blocks.set(blk, s);
  }
  w.blockFunds = [...blocks].map(([block, s]) => ({ block, month: month + 1, contributors: s.contributors, eligible: s.eligible, active: s.eligible > 0 && s.contributors / s.eligible >= RULES.BLOCK_FUND_THRESHOLD, feeMonth: RULES.BLOCK_FUND_FEE_MONTH }));
}

function lawDay(d: Draft, ctx: EngineCtx) {
  const w = d.w, day = w.day;
  w.cases.forEach((c0, ci) => {
    if (c0.status === 'open' && day - c0.openedDay >= RULES.CASE_GRACE_DAYS) {
      const oi = w.officials.findIndex((o) => o.isAi && o.role === c0.role && !(o.exposed && (o.suspendedUntilDay ?? 0) > day));
      if (oi >= 0) { const c = d.case(ci); c.status = 'taken'; c.officialId = w.officials[oi].id; c.takenDay = day; c.inspectDay = day + RULES.INSPECTION_DAYS; }
    }
    const c1 = w.cases[ci];
    if (c1.status === 'taken' && (c1.inspectDay ?? Infinity) <= day) inspect(d, ctx, ci);
    const c2 = w.cases[ci];
    if (c2.status === 'notice' && (c2.answerByDay ?? Infinity) < day) settle(d, ctx, ci, 'pay');
    if (c2.status === 'bribe_offered' && (c2.answerByDay ?? Infinity) < day) settle(d, ctx, ci, 'refused');
  });
}

function inspect(d: Draft, ctx: EngineCtx, ci: number) {
  const w = d.w;
  const c = d.case(ci);
  const bIdx = w.businesses.findIndex((b) => b.id === c.businessId);
  const oi = w.officials.findIndex((o) => o.id === c.officialId);
  const b0 = w.businesses[bIdx];
  if (!b0 || b0.status === 'bankrupt') { c.status = 'closed'; c.outcome = 'dismissed'; c.closedDay = w.day; return; }
  const pack = ctx.packs.niches[b0.niche]!;
  const trails = b0.trails.filter((t) => !t.discovered && roleOfViolation(ctx, pack, t.violationId) === c.role);
  c.inspectDay = w.day;
  if (!trails.length) {
    c.status = 'closed'; c.outcome = 'clean'; c.closedDay = w.day; c.found = [];
    if (oi >= 0) { const o = d.official(oi); o.points += RULES.POINTS_EMPTY_INSPECTION; o.casesClosed += 1; }
    if (c.origin === 'report' && c.reporterBusinessId) {
      const prior = w.cases.filter((x) => x.reporterBusinessId === c.reporterBusinessId && x.outcome === 'clean' && x.id !== c.id).length;
      const ri = w.businesses.findIndex((b) => b.id === c.reporterBusinessId);
      if (ri >= 0) {
        const rb = d.biz(ri);
        if (prior >= 1) { addLine(rb, 'false_report', 'Fine: false report', 'fine', -RULES.FALSE_REPORT_FINE); d.feed('report', `${rb.name} was fined for a false report against ${b0.name}`, rb.id); }
        else d.inbox(rb.managerPlayerId, 'case', 'Warning: false report', 'The inspection found nothing. A second false report costs a fine.');
      }
    }
    return;
  }
  const found: FoundViolation[] = trails.map((t) => {
    const v = violationOf(ctx, pack, t.violationId)!;
    const raw = (v.fine.base ?? 0) + (v.fine.perMonth ?? 0) * t.months + (v.fine.pctOfSaved ?? 0) * t.saved;
    return { violationId: t.violationId, months: t.months, fine: r2(v.fine.max ? Math.min(v.fine.max, raw) : raw), closureDays: v.closureDays ?? 0 };
  });
  c.found = found; c.fine = r2(found.reduce((s, f) => s + f.fine, 0)); c.closureDays = Math.max(0, ...found.map((f) => f.closureDays));
  c.status = 'notice'; c.answerByDay = w.day + RULES.NOTICE_ANSWER_DAYS;
  if (oi >= 0) d.official(oi).points += RULES.POINTS_PER_VIOLATION * found.length;
  d.inbox(b0.managerPlayerId, 'case', 'Violation notice', `Fine $${Math.round(c.fine)}. Answer within ${RULES.NOTICE_ANSWER_DAYS} days.`, { type: 'case', id: c.id });
}

function lawMonthClose(d: Draft, ctx: EngineCtx, month: number) {
  const w = d.w, day = w.day;
  // flags from suspicious numbers (tax side) and routine inspections
  w.businesses.forEach((b) => {
    if (b.status !== 'open') return;
    const openTax = w.cases.some((c) => c.businessId === b.id && c.role === 'tax_auditor' && (c.status === 'open' || c.status === 'taken' || (c.closedDay ?? -999) > day - 90));
    const taxTrail = b.trails.find((t) => (t.violationId === 'off_books_payroll' || t.violationId === 'misclassification' || t.violationId === 'sales_tax_fraud') && t.months >= 2);
    if (taxTrail && !openTax) {
      const hint = taxTrail.violationId === 'sales_tax_fraud' ? 'Reported sales look low for this foot traffic' : `Payroll taxes look low for ${staffCount(b.orders)} staff`;
      w.cases.push({ id: `c${w.cases.length + 1}`, businessId: b.id, role: 'tax_auditor', origin: 'flag', openedDay: day, hints: [hint], status: 'open' });
    }
    const every = ctx.tuning?.routineEveryMonths ?? RULES.ROUTINE_INSPECTION_EVERY_MONTHS;
    if (month % every === 0) w.cases.push({ id: `c${w.cases.length + 1}`, businessId: b.id, role: 'inspector', origin: 'routine', openedDay: day, hints: [`No inspection in ${every} months`], status: 'open' });
  });
  // internal affairs: the official with the most bribes this month is exposed
  let top = -1, best = 0;
  w.officials.forEach((o, i) => { if (o.bribesThisMonth > best) { best = o.bribesThisMonth; top = i; } });
  if (top >= 0) {
    const o = d.official(top);
    o.exposed = true; o.points = 0; o.suspendedUntilDay = day + RULES.DAYS_PER_MONTH;
    d.feed('bribe', `Internal affairs exposed official ${o.name}`);
    const bribery = ctx.packs.common.violations.find((v) => v.id === 'bribery');
    w.cases.forEach((c) => {
      if (c.outcome === 'bribed' && c.officialId === o.id && (c.closedDay ?? 0) > day - RULES.DAYS_PER_MONTH) {
        const bi = w.businesses.findIndex((b) => b.id === c.businessId);
        if (bi >= 0 && w.businesses[bi].status !== 'bankrupt') addLine(d.biz(bi), 'bribery_fine', 'Fine: bribery', 'fine', -(bribery?.fine.base ?? 5000));
      }
    });
  }
  w.officials.forEach((o, i) => { if (o.bribesThisMonth) d.official(i).bribesThisMonth = 0; if (o.exposed && (o.suspendedUntilDay ?? 0) <= day) d.official(i).exposed = false; });
}

// ───────────── standings and season end ─────────────
export function computeStandings(w: WorldState, ctx: EngineCtx): Standing[] {
  const out: Standing[] = [];
  const niches = [...new Set(w.businesses.map((b) => b.niche))];
  for (const n of niches) {
    const list = w.businesses.filter((b) => b.niche === n).map((b) => ({ b, nw: b.status === 'bankrupt' ? -Infinity : netWorth(b, ctx, w) }));
    list.sort((x, y) => (x.b.status === 'bankrupt' && y.b.status === 'bankrupt' ? (y.b.bankruptDay ?? 0) - (x.b.bankruptDay ?? 0) : y.nw - x.nw));
    list.forEach((x, k) => out.push({ businessId: x.b.id, niche: n, rank: k + 1, netWorth: x.b.status === 'bankrupt' ? 0 : x.nw, isAi: x.b.isAi, bankrupt: x.b.status === 'bankrupt' }));
  }
  return out;
}

function finalizeSeason(d: Draft, ctx: EngineCtx) {
  const w = d.w;
  w.standings = computeStandings(w, ctx);
  const payouts: Payout[] = [];
  const prize = w.bank * w.config.prizeShare;
  const paidOwners = w.players.filter((p) => p.kind === 'owner' && p.paid);
  const byNiche = new Map<NicheId, number>();
  for (const p of paidOwners) { const b = w.businesses.find((x) => x.owners.some((o) => o.playerId === p.id)); if (b) byNiche.set(b.niche, (byNiche.get(b.niche) ?? 0) + 1); }
  const total = [...byNiche.values()].reduce((s, n) => s + n, 0) || 1;
  for (const [n, cnt] of byNiche) {
    const fund = (prize * cnt) / total;
    const winners = w.standings.filter((s) => s.niche === n && !s.isAi && !s.bankrupt).slice(0, w.config.nichePrizeTable.length);
    const shares = w.config.nichePrizeTable.slice(0, winners.length);
    const norm = shares.reduce((s, x) => s + x, 0) || 1;
    winners.forEach((s, k) => {
      const b = w.businesses.find((x) => x.id === s.businessId)!;
      for (const o of b.owners) payouts.push({ playerId: o.playerId, kind: 'owner', amount: r2((fund * shares[k] / norm) * o.share), niche: n, rank: s.rank });
    });
  }
  const offs = w.officials.filter((o) => !o.isAi && !o.exposed);
  const pts = offs.reduce((s, o) => s + Math.max(0, o.points), 0);
  for (const o of offs) if (pts > 0) payouts.push({ playerId: o.playerId, kind: 'official', amount: r2((w.bank * w.config.officialsShare * Math.max(0, o.points)) / pts) });
  payouts.push({ playerId: 'platform', kind: 'platform', amount: r2(w.bank - payouts.reduce((s, p) => s + p.amount, 0)) });
  w.payouts = payouts;
  w.phase = 'ended';
}
