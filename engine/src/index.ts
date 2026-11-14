// @ohh-stub — walking-skeleton engine by agent 01, signatures from build/CONTRACT.md §3. Owner: agent 02 replaces this file.
// Deliberately simple numbers: just enough for scripts/smoke.mjs to walk the §10 scenario end to end.
import type {
  Action, ActionResult, BusinessState, Case, Deal, FeedItem, FoundViolation, InboxItem, Money, MonthReport,
  Pack, PackSet, PackViolation, Place, PnlLine, Standing, StandingOrders, WorldConfig, WorldState,
} from '@ohh/shared';
import { RULES, dateOf, isMonthEnd, round2, sum, uid } from '@ohh/shared';

export interface EngineCtx { packs: PackSet; places: Place[] }

const clone = <T>(x: T): T => structuredClone(x);
const emptyMtd = (): BusinessState['mtd'] => ({ lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } });
const nextId = (w: WorldState, prefix: string): string => `${prefix}_${uid(w.config.seed, w.version * 97 + w.cases.length + w.deals.length + w.businesses.length + w.feed.length)}`;

function packOf(ctx: EngineCtx, b: BusinessState): Pack | undefined { return ctx.packs.niches[b.niche]; }

function violationsOf(ctx: EngineCtx, b: BusinessState): PackViolation[] {
  return [...(packOf(ctx, b)?.violations ?? []), ...(ctx.packs.common?.violations ?? [])];
}

function roleOfViolation(ctx: EngineCtx, b: BusinessState, v: PackViolation): string | undefined {
  const officials = [...(packOf(ctx, b)?.officials ?? []), ...(ctx.packs.common?.officials ?? [])];
  return officials.find((o) => o.id === v.official)?.role ?? (v.official === 'tax_auditor' ? 'tax_auditor' : 'inspector');
}

function push(w: WorldState, item: Omit<FeedItem, 'id' | 'day'>): void {
  w.feed = [{ id: nextId(w, 'f'), day: w.day, ...item }, ...w.feed].slice(0, 100);
}

function notify(w: WorldState, playerId: string, item: Omit<InboxItem, 'id' | 'day' | 'read'>): void {
  const p = w.players.find((x) => x.id === playerId);
  if (p) p.inbox = [{ id: nextId(w, 'm'), day: w.day, read: false, ...item }, ...p.inbox].slice(0, 200);
}

function addLine(b: BusinessState, line: Omit<PnlLine, 'id'>): void {
  const id = `${line.kind}_${b.mtd.lines.length}`;
  b.mtd.lines.push({ id, ...line, amount: round2(line.amount) });
  b.cash = round2(b.cash + line.amount);
}

function myBusiness(w: WorldState, playerId: string): BusinessState | undefined {
  return w.businesses.find((b) => b.managerPlayerId === playerId && b.status !== 'bankrupt');
}

function defaultOrders(pack: Pack): StandingOrders {
  const levers: Record<string, string> = {};
  for (const l of pack.levers) if (l.options[0]) levers[l.id] = l.options[0].id;
  return {
    price: pack.unit.refPrice,
    staff: pack.staff[0] ? { [pack.staff[0].id]: Math.max(1, pack.capacity.minStaff) } : {},
    levers, shortcuts: [], blockFund: false, autopilot: 'hold',
  };
}

export function setupCost(pack: Pack, size: number, items: { id: string; qty: number }[]): Money {
  return round2(sum(items, (it) => {
    const s = pack.setup.find((x) => x.id === it.id);
    return s ? s.cost * (s.scalesWithSize ? size : it.qty) : 0;
  }));
}

export function createWorld(config: WorldConfig): WorldState {
  return {
    config, phase: 'running', day: 1, version: 1, bank: 0,
    players: [], businesses: [], officials: [], deals: [], cases: [], blockFunds: [],
    weather: [], events: [], feed: [], standings: [],
  };
}

export function netWorth(b: BusinessState, ctx: EngineCtx): Money {
  const pack = packOf(ctx, b);
  const items = pack ? setupCost(pack, b.size, b.items.filter((i) => pack.setup.find((s) => s.id === i.id && ['equipment', 'furniture'].includes(s.kind)))) : 0;
  const owed = sum(b.liabilities.filter((l) => !l.paid), (l) => l.amount);
  return round2(b.cash + RULES.NET_WORTH_ITEMS_SHARE * items - owed);
}

export function applyAction(w0: WorldState, ctx: EngineCtx, playerId: string, a: Action): ActionResult {
  const w = clone(w0);
  const fail = (error: string): ActionResult => ({ world: w0, error });
  const me = w.players.find((p) => p.id === playerId);
  if (!me) return fail('unknown player');
  const biz = myBusiness(w, playerId);
  const done = (): ActionResult => { w.version += 1; return { world: w }; };

  switch (a.type) {
    case 'open_business': {
      if (biz) return fail('you already run a business');
      const pack = ctx.packs.niches[a.niche];
      if (!pack) return fail(`niche ${a.niche} is not playable yet`);
      if (!ctx.places.find((p) => p.id === a.placeId)) return fail('unknown place');
      if (w.businesses.some((b) => b.placeId === a.placeId && b.status !== 'bankrupt')) return fail('place is taken');
      const kit = pack.kits.find((k) => k.id === a.kitId);
      const items = a.items ?? kit?.items ?? [];
      const cost = setupCost(pack, a.size, items);
      const b: BusinessState = {
        id: nextId(w, 'b'), name: a.name, niche: a.niche, placeId: a.placeId, isAi: me.isAi,
        owners: [{ playerId, share: 1 }], managerPlayerId: playerId, status: 'setup', createdDay: w.day,
        cash: pack.startCapital, size: a.size, items, setupSpent: cost,
        permits: pack.setup.filter((s) => s.waitDays && items.some((i) => i.id === s.id)).map((s) => ({ itemId: s.id, appliedDay: w.day, readyDay: w.day + (s.waitDays ?? 0) })),
        quality: 0.5, reputation: 0.5, trust: { kept: 0, broken: 0 }, orders: defaultOrders(pack),
        trails: [], liabilities: [], mtd: emptyMtd(), days: [], history: [],
      };
      addLine(b, { label: 'Opening costs', kind: 'setup', amount: -cost });
      w.businesses.push(b);
      push(w, { kind: 'opening', text: `${a.name} signed a lease`, businessId: b.id });
      return done();
    }
    case 'launch': {
      if (!biz || biz.status !== 'setup') return fail('nothing to launch');
      biz.status = 'open'; biz.openedDay = w.day;
      const pack = packOf(ctx, biz);
      for (const p of biz.permits) {
        const item = pack?.setup.find((s) => s.id === p.itemId);
        if (p.readyDay > w.day && item?.withoutItViolation) biz.trails.push({ violationId: item.withoutItViolation, months: 0, saved: 0, lastActiveMonth: dateOf(w.day).month, discovered: false });
      }
      push(w, { kind: 'opening', text: `${biz.name} opened its doors`, businessId: biz.id });
      return done();
    }
    case 'set_orders': {
      if (!biz) return fail('no business');
      biz.orders = { ...biz.orders, ...a.orders, staff: { ...biz.orders.staff, ...(a.orders.staff ?? {}) }, levers: { ...biz.orders.levers, ...(a.orders.levers ?? {}) } };
      return done();
    }
    case 'resize': { if (!biz) return fail('no business'); biz.size = a.size; return done(); }
    case 'spend': {
      if (!biz) return fail('no business');
      const amount = a.amount ?? 500;
      addLine(biz, { label: `Spend: ${a.kind}`, kind: 'opex', amount: -amount });
      if (a.kind === 'deep_clean') biz.trails = biz.trails.filter((t) => !violationsOf(ctx, biz).some((v) => v.id === t.violationId && roleOfViolation(ctx, biz, v) === 'inspector'));
      return done();
    }
    case 'buy_item': case 'sell_item': {
      if (!biz) return fail('no business');
      const pack = packOf(ctx, biz); const s = pack?.setup.find((x) => x.id === a.itemId);
      if (!s) return fail('unknown item');
      const sign = a.type === 'buy_item' ? 1 : -1;
      const item = biz.items.find((i) => i.id === a.itemId);
      if (item) item.qty = Math.max(0, item.qty + sign * a.qty); else if (sign > 0) biz.items.push({ id: a.itemId, qty: a.qty });
      addLine(biz, { label: `${a.type === 'buy_item' ? 'Bought' : 'Sold'} ${s.name}`, kind: 'setup', amount: -sign * s.cost * a.qty * (sign > 0 ? 1 : RULES.RESALE_SHARE) });
      return done();
    }
    case 'report': {
      if (!biz) return fail('open a business first');
      const target = w.businesses.find((b) => b.id === a.targetBusinessId);
      if (!target) return fail('unknown business');
      const rep = [...(packOf(ctx, target)?.reports ?? []), ...(ctx.packs.common?.reports ?? [])].find((r) => r.id === a.reportId);
      if (!rep) return fail('unknown report');
      const c: Case = { id: nextId(w, 'c'), businessId: target.id, role: rep.role, origin: 'report', reportId: rep.id, reporterBusinessId: biz.id, openedDay: w.day, hints: [rep.name], status: 'open' };
      w.cases.push(c);
      push(w, { kind: 'report', text: `A complaint was filed against ${target.name}`, businessId: target.id });
      return done();
    }
    case 'answer_notice': {
      const c = w.cases.find((x) => x.id === a.caseId);
      if (!c || c.status !== 'notice') return fail('no open notice');
      const b = w.businesses.find((x) => x.id === c.businessId);
      if (!b || b.managerPlayerId !== playerId) return fail('not your notice');
      c.response = a.response;
      if (a.response === 'bribe') { c.status = 'bribe_offered'; c.bribeAmount = a.bribeAmount ?? 0; return done(); }
      const fine = a.response === 'contest' ? (c.fine ?? 0) * RULES.CONTEST_FINE_MULT + RULES.CONTEST_FEE : (c.fine ?? 0);
      addLine(b, { label: 'Fine', kind: 'fine', amount: -fine });
      c.status = 'closed'; c.outcome = 'fined'; c.closedDay = w.day;
      return done();
    }
    case 'take_case': {
      const off = w.officials.find((o) => o.playerId === playerId);
      const c = w.cases.find((x) => x.id === a.caseId);
      if (!off || !c || c.status !== 'open' || c.role !== off.role) return fail('cannot take this case');
      c.status = 'taken'; c.officialId = off.id; c.takenDay = w.day; c.inspectDay = w.day + RULES.INSPECTION_DAYS;
      return done();
    }
    case 'dismiss_case': {
      const c = w.cases.find((x) => x.id === a.caseId);
      if (!c) return fail('unknown case');
      c.status = 'closed'; c.outcome = 'dismissed'; c.closedDay = w.day;
      return done();
    }
    case 'answer_bribe': {
      const c = w.cases.find((x) => x.id === a.caseId);
      const off = w.officials.find((o) => o.playerId === playerId);
      if (!c || !off || c.status !== 'bribe_offered') return fail('no bribe to answer');
      const b = w.businesses.find((x) => x.id === c.businessId)!;
      if (a.accept) { addLine(b, { label: 'Bribe', kind: 'other', amount: -(c.bribeAmount ?? 0) }); off.bribesTaken += c.bribeAmount ?? 0; off.bribesThisMonth += 1; c.outcome = 'bribed'; }
      else { addLine(b, { label: 'Fine (refused bribe)', kind: 'fine', amount: -(c.fine ?? 0) * RULES.REFUSED_BRIBE_FINE_MULT }); c.outcome = 'fined'; }
      c.status = 'closed'; c.closedDay = w.day;
      return done();
    }
    case 'propose_deal': {
      if (!biz) return fail('open a business first');
      const to = w.businesses.find((b) => b.id === a.toBusinessId);
      if (!to || to.id === biz.id) return fail('unknown business');
      const d: Deal = { id: nextId(w, 'd'), fromBusinessId: biz.id, toBusinessId: to.id, terms: a.terms, status: 'proposed', proposedDay: w.day, expiresDay: w.day + RULES.DEAL_OFFER_DAYS };
      w.deals.push(d);
      notify(w, to.managerPlayerId, { kind: 'deal', title: 'New deal offer', text: `${biz.name} offers ${a.terms.type.replace('_', ' ')}`, ref: { type: 'deal', id: d.id } });
      return done();
    }
    case 'answer_deal': {
      const d = w.deals.find((x) => x.id === a.dealId);
      if (!d || d.status !== 'proposed' || !biz || d.toBusinessId !== biz.id) return fail('no offer to answer');
      if (a.accept) {
        d.status = 'active'; d.startDay = w.day;
        d.endDay = 'months' in d.terms ? w.day + d.terms.months * RULES.DAYS_PER_MONTH : undefined;
        push(w, { kind: 'deal', text: `${biz.name} accepted a ${d.terms.type.replace('_', ' ')} deal`, businessId: biz.id });
      } else d.status = 'declined';
      return done();
    }
    case 'cancel_deal': {
      const d = w.deals.find((x) => x.id === a.dealId);
      if (!d || !biz || (d.fromBusinessId !== biz.id && d.toBusinessId !== biz.id)) return fail('unknown deal');
      if (d.status === 'active') biz.trust.broken += 1;
      d.status = 'cancelled';
      return done();
    }
    case 'read_inbox': {
      for (const m of me.inbox) if (a.ids.includes(m.id)) m.read = true;
      return done();
    }
    default:
      return fail('unknown action');
  }
}

function dealMult(w: WorldState, b: BusinessState): { cogs: number; demand: number; price: number } {
  let cogs = 1, demand = 1, price = 1;
  for (const d of w.deals) {
    if (d.status !== 'active' || (d.fromBusinessId !== b.id && d.toBusinessId !== b.id)) continue;
    if (d.terms.type === 'joint_purchase') cogs *= RULES.JOINT_PURCHASE_COGS_MULT;
    if (d.terms.type === 'cross_promo') { demand *= RULES.CROSS_PROMO_DEMAND_MULT; price *= RULES.CROSS_PROMO_PRICE_MULT; }
  }
  return { cogs, demand, price };
}

function economyDay(w: WorldState, ctx: EngineCtx, b: BusinessState): void {
  const pack = packOf(ctx, b);
  if (!pack) return;
  if (b.status === 'closed' && (b.closedUntilDay ?? 0) <= w.day) b.status = 'open';
  if (b.status !== 'open') return;
  const place = ctx.places.find((p) => p.id === b.placeId);
  const weather = w.weather.find((x) => x.day === w.day)?.footTrafficMult ?? 1;
  const m = dealMult(w, b);
  const demand = (pack.market.unitsPerSlotMonth / RULES.DAYS_PER_MONTH) * Math.pow(b.orders.price / pack.unit.refPrice, pack.market.priceElasticity) * weather * m.demand * (0.6 + 0.8 * (place?.footTraffic ?? 0.5));
  const staff = sum(Object.values(b.orders.staff));
  const staffCap = staff * (pack.capacity.unitsPerStaffMonth ?? Infinity) / RULES.DAYS_PER_MONTH;
  const sizeCap = b.size * pack.sizing.unitsServedPerSizeMonth / RULES.DAYS_PER_MONTH / (1 - (pack.sizing.takeawayShare ?? 0));
  const served = Math.floor(Math.min(demand, staffCap, sizeCap));
  const revenue = served * b.orders.price * m.price;
  const variable = served * pack.unit.cogsPerUnit * m.cogs;
  addLine(b, { label: 'Sales', kind: 'revenue', amount: revenue });
  addLine(b, { label: 'Ingredients', kind: 'cogs', amount: -variable });
  b.mtd.demandUnits += Math.round(demand); b.mtd.servedUnits += served;
  b.mtd.lost.staff += Math.max(0, Math.round(Math.min(demand, sizeCap) - Math.min(demand, sizeCap, staffCap)));
  b.mtd.lost.size += Math.max(0, Math.round(demand - Math.min(demand, sizeCap)));
  b.days = [...b.days, { day: w.day, demandUnits: Math.round(demand), servedUnits: served, lost: { size: 0, staff: 0, closure: 0 }, revenue: round2(revenue), variableCosts: round2(variable), sizeUtilization: sizeCap > 0 ? Math.min(1, served / sizeCap) : 0, weather: w.weather.find((x) => x.day === w.day)?.condition ?? 'clear', notes: [] }].slice(-30);
}

function monthClose(w: WorldState, ctx: EngineCtx, b: BusinessState): void {
  const pack = packOf(ctx, b);
  if (!pack || b.status === 'bankrupt') return;
  const month = dateOf(w.day).month;
  const payroll = sum(pack.staff, (r) => (b.orders.staff[r.id] ?? 0) * r.hourlyWage * r.hoursPerMonth);
  addLine(b, { label: 'Payroll', kind: 'payroll', amount: -payroll });
  for (const c of pack.monthlyCosts.filter((x) => x.basis === 'fixed')) addLine(b, { label: c.name, kind: c.kind === 'rent' ? 'rent' : 'opex', amount: -c.amount });
  for (const l of pack.levers) {
    const opt = l.options.find((o) => o.id === b.orders.levers[l.id]);
    if (opt?.monthlyCost) addLine(b, { label: `${l.name}: ${opt.label}`, kind: 'opex', amount: -opt.monthlyCost });
    if (opt?.causes) touchTrail(b, opt.causes, 0, month);
  }
  for (const id of b.orders.shortcuts) {
    const s = [...pack.shortcuts, ...(ctx.packs.common?.shortcuts ?? [])].find((x) => x.id === id);
    if (!s) continue;
    const saved = s.saves.basis === 'fixed' ? s.saves.amount : s.saves.basis === 'pct_payroll' ? s.saves.amount * payroll : s.saves.amount * 1_000;
    addLine(b, { label: `Saved: ${s.name}`, kind: 'saving', amount: saved });
    touchTrail(b, s.violation, saved, month);
  }
  const lines = b.mtd.lines;
  const delta = sum(lines, (l) => l.amount);
  const revenue = sum(lines.filter((l) => l.kind === 'revenue'), (l) => l.amount);
  const report: MonthReport = {
    month, avgPrice: b.orders.price, demandUnits: b.mtd.demandUnits, servedUnits: b.mtd.servedUnits, lost: b.mtd.lost,
    capacityUnits: b.mtd.servedUnits + b.mtd.lost.size + b.mtd.lost.staff, sizeUtilization: b.days.length ? sum(b.days, (d) => d.sizeUtilization) / b.days.length : 0,
    lines, revenue: round2(revenue), profit: round2(sum(lines.filter((l) => l.kind !== 'setup'), (l) => l.amount)),
    cashStart: round2(b.cash - delta), cashEnd: b.cash, taxesAccrued: 0, taxesPaid: 0,
    fines: round2(-sum(lines.filter((l) => l.kind === 'fine'), (l) => l.amount)),
    quality: b.quality, reputation: b.reputation, netWorth: netWorth(b, ctx), rankInNiche: 0,
  };
  b.history = [...b.history, report];
  b.mtd = emptyMtd();
  if (b.cash < 0) { b.status = 'bankrupt'; b.bankruptDay = w.day; push(w, { kind: 'bankruptcy', text: `${b.name} went bankrupt`, businessId: b.id }); }
  notify(w, b.managerPlayerId, { kind: 'summary', title: `Month ${month} closed`, text: `Profit ${Math.round(report.profit)} · cash ${Math.round(b.cash)}`, ref: { type: 'business', id: b.id } });
}

function touchTrail(b: BusinessState, violationId: string, saved: Money, month: number): void {
  const t = b.trails.find((x) => x.violationId === violationId);
  if (t) { t.months += 1; t.saved = round2(t.saved + saved); t.lastActiveMonth = month; }
  else b.trails.push({ violationId, months: 1, saved: round2(saved), lastActiveMonth: month, discovered: false });
}

function fineFor(v: PackViolation, months: number, saved: Money): Money {
  const raw = (v.fine.base ?? 0) + (v.fine.perMonth ?? 0) * months + (v.fine.pctOfSaved ?? 0) * saved;
  return round2(v.fine.max == null ? raw : Math.min(v.fine.max, raw));
}

function lawDay(w: WorldState, ctx: EngineCtx): void {
  for (const c of w.cases) {
    if (c.status === 'open' && w.day - c.openedDay >= RULES.CASE_GRACE_DAYS) {
      const off = w.officials.find((o) => o.isAi && o.role === c.role && !o.exposed);
      if (off) { c.status = 'taken'; c.officialId = off.id; c.takenDay = w.day; c.inspectDay = w.day + RULES.INSPECTION_DAYS; }
    }
    if (c.status === 'taken' && (c.inspectDay ?? Infinity) <= w.day) {
      const b = w.businesses.find((x) => x.id === c.businessId);
      const off = w.officials.find((o) => o.id === c.officialId);
      if (!b || !off) continue;
      const found: FoundViolation[] = [];
      for (const t of b.trails) {
        const v = violationsOf(ctx, b).find((x) => x.id === t.violationId);
        if (v && roleOfViolation(ctx, b, v) === c.role) { found.push({ violationId: v.id, months: t.months, fine: fineFor(v, t.months, t.saved), closureDays: v.closureDays ?? 0 }); t.discovered = true; }
      }
      off.casesClosed += 1;
      if (!found.length) {
        c.status = 'closed'; c.outcome = 'clean'; c.closedDay = w.day; off.points += RULES.POINTS_EMPTY_INSPECTION;
        const rep = w.businesses.find((x) => x.id === c.reporterBusinessId);
        if (rep) notify(w, rep.managerPlayerId, { kind: 'case', title: 'Complaint found nothing', text: `The inspection of ${b.name} was clean. This is a warning.`, ref: { type: 'case', id: c.id } });
        continue;
      }
      c.status = 'notice'; c.found = found; c.fine = round2(sum(found, (f) => f.fine)); c.closureDays = Math.max(...found.map((f) => f.closureDays));
      c.answerByDay = w.day + RULES.NOTICE_ANSWER_DAYS; off.points += RULES.POINTS_PER_VIOLATION * found.length;
      notify(w, b.managerPlayerId, { kind: 'case', title: 'Inspection notice', text: `Fine ${Math.round(c.fine)} for ${found.length} violation(s).`, ref: { type: 'case', id: c.id } });
      push(w, { kind: 'inspection', text: `${b.name} was fined after an inspection`, businessId: b.id });
    }
    if (c.status === 'notice' && (c.answerByDay ?? Infinity) < w.day) {
      const b = w.businesses.find((x) => x.id === c.businessId);
      if (b) addLine(b, { label: 'Fine', kind: 'fine', amount: -(c.fine ?? 0) });
      if (b && c.closureDays) { b.status = 'closed'; b.closedUntilDay = w.day + c.closureDays; }
      c.status = 'closed'; c.outcome = 'fined'; c.response = 'pay'; c.closedDay = w.day;
    }
  }
}

function dealsDay(w: WorldState): void {
  for (const d of w.deals) {
    if (d.status === 'proposed' && w.day > d.expiresDay) d.status = 'expired';
    if (d.status === 'active' && d.endDay != null && w.day >= d.endDay) {
      d.status = 'completed';
      for (const id of [d.fromBusinessId, d.toBusinessId]) { const b = w.businesses.find((x) => x.id === id); if (b) b.trust.kept += 1; }
    }
  }
}

function standings(w: WorldState, ctx: EngineCtx): Standing[] {
  const out: Standing[] = [];
  const niches = [...new Set(w.businesses.map((b) => b.niche))];
  for (const n of niches) {
    const list = w.businesses.filter((b) => b.niche === n).map((b) => ({ b, nw: netWorth(b, ctx) })).sort((x, y) => y.nw - x.nw);
    list.forEach((x, i) => out.push({ businessId: x.b.id, niche: n, rank: i + 1, netWorth: x.nw, isAi: x.b.isAi, bankrupt: x.b.status === 'bankrupt' }));
  }
  return out;
}

export function tickDay(w0: WorldState, ctx: EngineCtx): WorldState {
  if (w0.phase === 'ended') return w0;
  const w = clone(w0);
  w.day += 1; w.version += 1;
  dealsDay(w);
  lawDay(w, ctx);
  for (const b of w.businesses) economyDay(w, ctx, b);
  if (isMonthEnd(w.day)) {
    for (const b of w.businesses) monthClose(w, ctx, b);
    w.standings = standings(w, ctx);
    for (const s of w.standings) { const b = w.businesses.find((x) => x.id === s.businessId); const last = b?.history.at(-1); if (last) last.rankInNiche = s.rank; }
  }
  if (w.day >= w.config.seasonMonths * RULES.DAYS_PER_MONTH) w.phase = 'ended';
  return w;
}

