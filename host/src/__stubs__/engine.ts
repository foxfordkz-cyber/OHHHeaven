// ЗАГЛУШКА @ohh/engine (агенты 02, 03, 04, 13). Упрощённая, но связная модель по CONTRACT §3–5,
// чтобы хост, сервер и сценарий проверки работали до прихода настоящего движка.
// Чистые функции: без Date, Math.random и мутаций входа. Числа — из пакетов и shared/src/rules.ts.
import type {
  Action, ActionResult, Analytics, BusinessState, Case, CaseCard, CaseNotice, Deal, DealTerms, DayReport, FoundViolation,
  GameEvent, InboxItem, MonthReport, NicheId, OfficialRole, OpenRecommendation, Pack, PackSetupItem, PackViolation, PnlLine,
  Place, RealWorldPlan, Recommendation, RoadmapItem, Standing, StandingOrders, ViolationTrail, WorldConfig, WorldState, Money,
  Benchmark, EffectTarget,
} from '@ohh/shared';
import { RULES, dateOf, isMonthEnd } from '@ohh/shared';
import type { EngineApi, EngineCtx } from '../types';
import { clamp, distanceM, formatMoney, round2, sum } from '../util';
import { publicBusiness } from '../public';

const CROSS_PROMO_MAX_M = 400;
const COMPETITION_RADIUS_M = 300;

// ───────────── помощники ─────────────

export const packOf = (ctx: EngineCtx, niche: NicheId): Pack | undefined => ctx.packs.niches[niche];
export const placeOf = (ctx: EngineCtx, id: string): Place | undefined => ctx.places.find((p) => p.id === id);
const bizOfPlayer = (w: WorldState, playerId: string): BusinessState | undefined =>
  w.businesses.find((b) => b.managerPlayerId === playerId && b.status !== 'bankrupt');

function setupCost(item: PackSetupItem, qty: number, size: number): Money {
  return item.cost * (item.scalesWithSize ? size : qty);
}

export function maxSizeFor(pack: Pack, place: Place): number {
  return Math.min(pack.sizing.max, Math.floor((place.sqft * RULES.USABLE_FLOOR_SHARE) / pack.sizing.sqftPerUnit));
}

export function defaultOrders(pack: Pack, staffCount: number): StandingOrders {
  const levers: Record<string, string> = {};
  for (const l of pack.levers) levers[l.id] = l.options[0]?.id ?? '';
  const staff: Record<string, number> = {};
  if (pack.staff[0]) staff[pack.staff[0].id] = Math.max(pack.capacity.minStaff, staffCount);
  return { price: pack.unit.refPrice, staff, levers, shortcuts: [], blockFund: false, autopilot: 'hold' };
}

const staffCount = (o: StandingOrders): number => sum(Object.values(o.staff));
const rentMonth = (place: Place): Money => round2((place.sqft * place.rentPerSqftYear) / 12);

function payrollMonth(pack: Pack, o: StandingOrders): Money {
  return round2(sum(pack.staff.map((r) => (o.staff[r.id] ?? 0) * r.hourlyWage * r.hoursPerMonth)));
}

function addLine(lines: PnlLine[], line: PnlLine): PnlLine[] {
  const i = lines.findIndex((l) => l.id === line.id);
  if (i < 0) return [...lines, { ...line, amount: round2(line.amount) }];
  const next = lines.slice();
  next[i] = { ...next[i], amount: round2(next[i].amount + line.amount) };
  return next;
}

function chargeMtd(b: BusinessState, line: PnlLine): void {
  b.cash = round2(b.cash + line.amount);
  b.mtd = { ...b.mtd, lines: addLine(b.mtd.lines, line) };
}

export function pushFeed(w: WorldState, kind: WorldState['feed'][number]['kind'], text: string, businessId?: string): void {
  const n = w.feed.filter((f) => f.day === w.day).length;
  w.feed = [...w.feed, { id: `f${w.day}_${n}`, day: w.day, kind, text, businessId }].slice(-200);
}

export function pushInbox(w: WorldState, playerId: string, item: Omit<InboxItem, 'id' | 'day' | 'read'>): void {
  const p = w.players.find((x) => x.id === playerId);
  if (!p || p.isAi) return;
  const id = `${playerId}_${w.day}_${p.inbox.length}_${item.kind}`;
  p.inbox = [...p.inbox, { ...item, id, day: w.day, read: false }].slice(-80);
}

function ownersOf(b: BusinessState): string[] {
  return b.owners.map((o) => o.playerId);
}

function allViolations(ctx: EngineCtx, niche: NicheId): PackViolation[] {
  return [...(packOf(ctx, niche)?.violations ?? []), ...ctx.packs.common.violations];
}

function roleOfViolation(ctx: EngineCtx, niche: NicheId, v: PackViolation): OfficialRole {
  const officials = [...(packOf(ctx, niche)?.officials ?? []), ...ctx.packs.common.officials];
  return officials.find((o) => o.id === v.official)?.role ?? (/tax|audit/.test(v.official) ? 'tax_auditor' : 'inspector');
}

function fineFor(v: PackViolation, t: ViolationTrail): Money {
  const f = v.fine;
  const raw = (f.base ?? 0) + (f.perMonth ?? 0) * Math.max(1, t.months) + (f.pctOfSaved ?? 0) * t.saved;
  return round2(f.max ? Math.min(f.max, raw) : raw);
}

function growTrail(b: BusinessState, violationId: string, saved: Money, month: number): void {
  const i = b.trails.findIndex((t) => t.violationId === violationId);
  if (i < 0) {
    b.trails = [...b.trails, { violationId, months: 1, saved: round2(saved), lastActiveMonth: month, discovered: false }];
  } else {
    const t = b.trails[i];
    const next = b.trails.slice();
    next[i] = { ...t, months: t.months + 1, saved: round2(t.saved + saved), lastActiveMonth: month };
    b.trails = next;
  }
}

function eventMult(w: WorldState, ctx: EngineCtx, b: BusinessState, target: EffectTarget): number {
  const place = placeOf(ctx, b.placeId);
  let m = 1;
  for (const e of w.events) {
    if (w.day < e.startDay || w.day > e.endDay) continue;
    if (e.block && place && e.block !== place.block) continue;
    for (const eff of e.effects) {
      if (eff.target !== target) continue;
      if (eff.niches && !eff.niches.includes(b.niche)) continue;
      if (eff.tiers && place && !eff.tiers.includes(place.tier)) continue;
      m *= clamp(eff.mult, 0.5, 1.5);
    }
  }
  return m;
}

export function dealModifiers(w: WorldState, _ctx: EngineCtx, businessId: string) {
  let cogsMult = 1, demandMult = 1, priceMult = 1;
  const footTrafficMult = 1;
  for (const d of w.deals) {
    if (d.status !== 'active' || (d.fromBusinessId !== businessId && d.toBusinessId !== businessId)) continue;
    if (d.terms.type === 'joint_purchase') cogsMult *= RULES.JOINT_PURCHASE_COGS_MULT;
    if (d.terms.type === 'cross_promo') { demandMult *= RULES.CROSS_PROMO_DEMAND_MULT; priceMult *= RULES.CROSS_PROMO_PRICE_MULT; }
  }
  return { cogsMult, demandMult, priceMult, footTrafficMult };
}

function itemsValue(b: BusinessState, ctx: EngineCtx): Money {
  const pack = packOf(ctx, b.niche);
  if (!pack) return 0;
  return sum(b.items.map((it) => {
    const s = pack.setup.find((x) => x.id === it.id);
    if (!s || !['equipment', 'furniture'].includes(s.kind)) return 0;
    return setupCost(s, it.qty, b.size);
  }));
}

export function netWorth(b: BusinessState, ctx: EngineCtx): Money {
  const owed = sum(b.liabilities.filter((l) => !l.paid).map((l) => l.amount));
  return round2(b.cash + RULES.NET_WORTH_ITEMS_SHARE * itemsValue(b, ctx) - owed);
}

// ───────────── мир ─────────────

export function createWorld(config: WorldConfig): WorldState {
  return {
    config, phase: 'running', day: 1, version: 1, bank: 0,
    players: [], businesses: [], officials: [], deals: [], cases: [], blockFunds: [],
    weather: [], events: [], feed: [], standings: [],
  };
}

const fail = (w: WorldState, error: string): ActionResult => ({ world: w, error });

export function applyAction(w0: WorldState, ctx: EngineCtx, playerId: string, a: Action): ActionResult {
  const player = w0.players.find((p) => p.id === playerId);
  if (!player) return fail(w0, 'Unknown player');
  const w = structuredClone(w0);
  const me = bizOfPlayer(w, playerId);
  const official = w.officials.find((o) => o.playerId === playerId);
  const month = dateOf(w.day).month;

  switch (a.type) {
    case 'open_business': {
      if (me) return fail(w0, 'You already run a business');
      const pack = packOf(ctx, a.niche);
      const place = placeOf(ctx, a.placeId);
      if (!pack || !place) return fail(w0, 'Unknown niche or place');
      if (!place.suitableFor.includes(a.niche)) return fail(w0, 'This space does not fit that kind of business');
      if (w.businesses.some((b) => b.placeId === place.id && b.status !== 'bankrupt')) return fail(w0, 'This space is taken');
      const kit = pack.kits.find((k) => k.id === a.kitId);
      if (!kit) return fail(w0, 'Unknown kit');
      const size = clamp(Math.round(a.size), pack.sizing.min, maxSizeFor(pack, place));
      const items = a.items ?? kit.items;
      for (const req of pack.setup.filter((s) => s.required)) {
        if (!items.some((it) => it.id === req.id)) return fail(w0, `Missing required item: ${req.name}`);
      }
      let cost = 0;
      for (const it of items) {
        const s = pack.setup.find((x) => x.id === it.id);
        if (!s) return fail(w0, `Unknown item: ${it.id}`);
        cost += setupCost(s, it.qty, size);
      }
      const cash = round2(pack.startCapital - cost);
      if (cash < 0) return fail(w0, `Not enough capital: kit costs ${formatMoney(cost)}`);
      const permits = items
        .map((it) => pack.setup.find((s) => s.id === it.id))
        .filter((s): s is PackSetupItem => !!s && (s.kind === 'permit' || s.kind === 'license') && !!s.waitDays)
        .map((s) => ({ itemId: s.id, appliedDay: w.day, readyDay: w.day + (s.waitDays ?? 0) }));
      const b: BusinessState = {
        id: `b${w.businesses.length + 1}`, name: a.name.trim().slice(0, 40) || `${player.name}'s ${pack.name}`,
        niche: a.niche, placeId: place.id, isAi: player.isAi,
        owners: [{ playerId, share: 1 }], managerPlayerId: playerId, status: 'setup', createdDay: w.day,
        cash, size, items: items.map((it) => ({ ...it })), setupSpent: round2(cost), permits,
        quality: 0.6, reputation: 0.5, trust: { kept: 0, broken: 0 },
        orders: defaultOrders(pack, 2), trails: [], liabilities: [],
        mtd: { lines: [{ id: 'setup', label: 'Opening purchases', kind: 'setup', amount: -round2(cost) }], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } },
        days: [], history: [],
      };
      w.businesses = [...w.businesses, b];
      pushFeed(w, 'opening', `${b.name} is setting up at ${place.address}`, b.id);
      break;
    }
    case 'launch': {
      if (!me) return fail(w0, 'No business');
      if (me.status !== 'setup') return fail(w0, 'Already open');
      me.status = 'open';
      me.openedDay = w.day;
      const pack = packOf(ctx, me.niche);
      for (const p of me.permits) {
        if (p.readyDay > w.day) {
          const s = pack?.setup.find((x) => x.id === p.itemId);
          if (s?.withoutItViolation) growTrail(me, s.withoutItViolation, 0, month);
        }
      }
      pushFeed(w, 'opening', `${me.name} opened its doors`, me.id);
      break;
    }
    case 'set_orders': {
      if (!me) return fail(w0, 'No business');
      const pack = packOf(ctx, me.niche)!;
      const o = { ...me.orders, ...a.orders };
      o.price = round2(clamp(o.price, pack.unit.priceMin, pack.unit.priceMax));
      const staff: Record<string, number> = {};
      for (const r of pack.staff) staff[r.id] = clamp(Math.round(o.staff[r.id] ?? 0), 0, pack.capacity.maxStaff);
      o.staff = staff;
      if (staffCount(o) > pack.capacity.maxStaff) return fail(w0, `At most ${pack.capacity.maxStaff} staff`);
      const known = new Set([...pack.shortcuts, ...ctx.packs.common.shortcuts].map((s) => s.id));
      o.shortcuts = (o.shortcuts ?? []).filter((s) => known.has(s));
      me.orders = o;
      break;
    }
    case 'buy_item': {
      if (!me) return fail(w0, 'No business');
      const s = packOf(ctx, me.niche)?.setup.find((x) => x.id === a.itemId);
      if (!s || a.qty < 1) return fail(w0, 'Unknown item');
      const cost = setupCost(s, a.qty, me.size);
      if (cost > me.cash) return fail(w0, 'Not enough cash');
      const i = me.items.findIndex((x) => x.id === s.id);
      me.items = i < 0 ? [...me.items, { id: s.id, qty: a.qty }] : me.items.map((x, j) => (j === i ? { ...x, qty: x.qty + a.qty } : x));
      chargeMtd(me, { id: 'setup', label: 'Equipment and furniture', kind: 'setup', amount: -cost });
      me.setupSpent = round2(me.setupSpent + cost);
      break;
    }
    case 'sell_item': {
      if (!me) return fail(w0, 'No business');
      const s = packOf(ctx, me.niche)?.setup.find((x) => x.id === a.itemId);
      const have = me.items.find((x) => x.id === a.itemId);
      if (!s || !have || a.qty < 1 || a.qty > have.qty) return fail(w0, 'You do not have that item');
      me.items = me.items.map((x) => (x.id === s.id ? { ...x, qty: x.qty - a.qty } : x)).filter((x) => x.qty > 0);
      chargeMtd(me, { id: 'resale', label: 'Sold equipment', kind: 'other', amount: round2(setupCost(s, a.qty, me.size) * RULES.RESALE_SHARE) });
      break;
    }
    case 'resize': {
      if (!me) return fail(w0, 'No business');
      const pack = packOf(ctx, me.niche)!;
      const place = placeOf(ctx, me.placeId)!;
      const size = clamp(Math.round(a.size), pack.sizing.min, maxSizeFor(pack, place));
      const diff = size - me.size;
      const perUnit = sum(pack.setup.filter((s) => s.scalesWithSize && me.items.some((it) => it.id === s.id)).map((s) => s.cost));
      if (diff > 0) {
        if (diff * perUnit > me.cash) return fail(w0, 'Not enough cash');
        chargeMtd(me, { id: 'setup', label: 'Equipment and furniture', kind: 'setup', amount: -diff * perUnit });
      } else if (diff < 0) {
        chargeMtd(me, { id: 'resale', label: 'Sold equipment', kind: 'other', amount: -diff * perUnit * RULES.RESALE_SHARE });
      }
      me.size = size;
      break;
    }
    case 'spend': {
      if (!me) return fail(w0, 'No business');
      const cost = a.kind === 'deep_clean' ? 600 : a.kind === 'accountant' ? 800 : clamp(a.amount ?? 500, 50, 20000);
      if (cost > me.cash) return fail(w0, 'Not enough cash');
      chargeMtd(me, { id: `spend_${a.kind}`, label: a.kind === 'deep_clean' ? 'Professional deep clean' : a.kind === 'accountant' ? 'Accountant' : a.kind === 'training' ? 'Staff training' : 'Marketing', kind: 'opex', amount: -cost });
      if (a.kind === 'deep_clean') {
        const sanitary = new Set(allViolations(ctx, me.niche).filter((v) => v.foundBy.includes('inspection') && roleOfViolation(ctx, me.niche, v) === 'inspector' && !v.id.startsWith('no_')).map((v) => v.id));
        me.trails = me.trails.filter((t) => !sanitary.has(t.violationId));
      }
      if (a.kind === 'accountant') {
        const i = me.trails.findIndex((t) => { const v = allViolations(ctx, me.niche).find((x) => x.id === t.violationId); return !!v && roleOfViolation(ctx, me.niche, v) === 'tax_auditor'; });
        if (i >= 0) {
          chargeMtd(me, { id: 'back_taxes', label: 'Back taxes paid voluntarily', kind: 'tax', amount: -me.trails[i].saved });
          me.trails = me.trails.filter((_, j) => j !== i);
        }
      }
      if (a.kind === 'marketing') me.reputation = clamp(me.reputation + Math.min(0.05, cost / 20000), 0, 1);
      if (a.kind === 'training') me.quality = clamp(me.quality + Math.min(0.05, cost / 20000), 0, 1);
      break;
    }
    case 'propose_deal': {
      if (!me) return fail(w0, 'No business');
      const to = w.businesses.find((b) => b.id === a.toBusinessId);
      if (!to || to.id === me.id) return fail(w0, 'Pick another business');
      if (me.status !== 'open' || to.status !== 'open') return fail(w0, 'Both businesses must be open');
      const active = (id: string) => w.deals.filter((d) => d.status === 'active' && (d.fromBusinessId === id || d.toBusinessId === id)).length;
      if (active(me.id) >= RULES.MAX_ACTIVE_DEALS || active(to.id) >= RULES.MAX_ACTIVE_DEALS) return fail(w0, 'Too many active deals');
      const err = dealTermsError(ctx, me, to, a.terms);
      if (err) return fail(w0, err);
      const d: Deal = { id: `d${w.deals.length + 1}`, fromBusinessId: me.id, toBusinessId: to.id, terms: a.terms, status: 'proposed', proposedDay: w.day, expiresDay: w.day + RULES.DEAL_OFFER_DAYS };
      w.deals = [...w.deals, d];
      pushInbox(w, to.managerPlayerId, { kind: 'deal', title: `${me.name} offers a ${dealLabel(a.terms)}`, text: `Answer within ${RULES.DEAL_OFFER_DAYS} days.`, ref: { type: 'deal', id: d.id } });
      break;
    }
    case 'answer_deal': {
      const d = w.deals.find((x) => x.id === a.dealId);
      if (!d || !me || d.toBusinessId !== me.id) return fail(w0, 'No such offer');
      if (d.status !== 'proposed') return fail(w0, 'This offer is no longer open');
      const from = w.businesses.find((b) => b.id === d.fromBusinessId)!;
      if (!a.accept) { d.status = 'declined'; pushInbox(w, from.managerPlayerId, { kind: 'deal', title: `${me.name} declined your offer`, text: dealLabel(d.terms), ref: { type: 'deal', id: d.id } }); break; }
      d.status = 'active';
      d.startDay = w.day;
      if (d.terms.type === 'joint_purchase' || d.terms.type === 'cross_promo' || d.terms.type === 'loan') d.endDay = w.day + d.terms.months * RULES.DAYS_PER_MONTH;
      if (d.terms.type === 'loan') {
        chargeMtd(from, { id: 'loan_out', label: `Loan to ${me.name}`, kind: 'deal', amount: -d.terms.amount });
        chargeMtd(me, { id: 'loan_in', label: `Loan from ${from.name}`, kind: 'deal', amount: d.terms.amount });
        d.paidBack = 0;
      }
      if (d.terms.type === 'partnership') {
        chargeMtd(from, { id: 'stake_out', label: `Stake in ${me.name}`, kind: 'deal', amount: -d.terms.amount });
        chargeMtd(me, { id: 'stake_in', label: `Investment from ${from.name}`, kind: 'deal', amount: d.terms.amount });
        const share = d.terms.sharePct / 100;
        me.owners = [...me.owners.map((o) => ({ ...o, share: round2(o.share * (1 - share)) })), { playerId: from.managerPlayerId, share }];
      }
      pushInbox(w, from.managerPlayerId, { kind: 'deal', title: `${me.name} accepted your ${dealLabel(d.terms)}`, text: 'The deal is active.', ref: { type: 'deal', id: d.id } });
      pushFeed(w, 'deal', `${from.name} and ${me.name} signed a ${dealLabel(d.terms)}`, me.id);
      break;
    }
    case 'cancel_deal': {
      const d = w.deals.find((x) => x.id === a.dealId);
      if (!d || !me || (d.fromBusinessId !== me.id && d.toBusinessId !== me.id)) return fail(w0, 'No such deal');
      if (d.status === 'proposed' && d.fromBusinessId === me.id) { d.status = 'cancelled'; break; }
      if (d.status !== 'active') return fail(w0, 'Deal is not active');
      d.status = 'cancelled';
      d.endDay = w.day;
      me.trust = { ...me.trust, broken: me.trust.broken + 1 };
      break;
    }
    case 'report': {
      if (!me) return fail(w0, 'No business');
      const target = w.businesses.find((b) => b.id === a.targetBusinessId);
      if (!target || target.id === me.id) return fail(w0, 'Pick another business');
      if (target.status === 'bankrupt') return fail(w0, 'This business is gone');
      const rep = [...(packOf(ctx, target.niche)?.reports ?? []), ...ctx.packs.common.reports].find((r) => r.id === a.reportId);
      if (!rep) return fail(w0, 'Unknown report');
      const recent = w.cases.filter((c) => c.reporterBusinessId === me.id && c.openedDay > w.day - 7).length;
      if (recent >= RULES.REPORTS_PER_WEEK) return fail(w0, `You can file ${RULES.REPORTS_PER_WEEK} report a week`);
      const c: Case = { id: `c${w.cases.length + 1}`, businessId: target.id, role: rep.role, origin: 'report', reportId: rep.id, reporterBusinessId: me.id, openedDay: w.day, hints: [rep.name], status: 'open' };
      w.cases = [...w.cases, c];
      pushFeed(w, 'report', `A complaint was filed against ${target.name}`, target.id);
      pushInbox(w, playerId, { kind: 'case', title: `Your report on ${target.name} is in the queue`, text: 'An official will pick it up within a few days.', ref: { type: 'case', id: c.id } });
      break;
    }
    case 'answer_notice': {
      const c = w.cases.find((x) => x.id === a.caseId);
      if (!c || !me || c.businessId !== me.id || c.status !== 'notice') return fail(w0, 'No such notice');
      if (a.response === 'bribe') {
        const amount = round2(a.bribeAmount ?? 0);
        if (amount <= 0 || amount > me.cash) return fail(w0, 'Bad amount');
        c.status = 'bribe_offered';
        c.response = 'bribe';
        c.bribeAmount = amount;
        c.answerByDay = w.day + RULES.BRIBE_ANSWER_DAYS;
        break;
      }
      if (a.response === 'contest') {
        chargeMtd(me, { id: 'legal', label: 'Lawyer to contest a fine', kind: 'fine', amount: -RULES.CONTEST_FEE });
        c.fine = round2((c.fine ?? 0) * RULES.CONTEST_FINE_MULT);
      }
      c.response = a.response;
      settleFine(w, ctx, c, 1);
      break;
    }
    case 'read_inbox': {
      const ids = new Set(a.ids);
      const p = w.players.find((x) => x.id === playerId)!;
      p.inbox = p.inbox.map((it) => (ids.has(it.id) ? { ...it, read: true } : it));
      break;
    }
    case 'take_case': {
      if (!official) return fail(w0, 'Officials only');
      const c = w.cases.find((x) => x.id === a.caseId);
      if (!c || c.status !== 'open' || c.role !== official.role) return fail(w0, 'Case is not available');
      if (official.suspendedUntilDay && official.suspendedUntilDay > w.day) return fail(w0, 'You are suspended');
      const cooldown = w.cases.some((x) => x.officialId === official.id && x.businessId === c.businessId && (x.takenDay ?? -999) > w.day - RULES.SAME_TARGET_COOLDOWN_DAYS);
      if (cooldown) return fail(w0, `You inspected this business less than ${RULES.SAME_TARGET_COOLDOWN_DAYS} days ago`);
      takeCase(w, c, official.id);
      break;
    }
    case 'dismiss_case': {
      if (!official) return fail(w0, 'Officials only');
      const c = w.cases.find((x) => x.id === a.caseId);
      if (!c || c.officialId !== official.id || c.status !== 'taken') return fail(w0, 'Not your case');
      c.status = 'open';
      c.officialId = undefined;
      c.takenDay = undefined;
      c.inspectDay = undefined;
      break;
    }
    case 'answer_bribe': {
      if (!official) return fail(w0, 'Officials only');
      const c = w.cases.find((x) => x.id === a.caseId);
      if (!c || c.officialId !== official.id || c.status !== 'bribe_offered') return fail(w0, 'No bribe to answer');
      if (a.accept) acceptBribe(w, ctx, c);
      else settleFine(w, ctx, c, RULES.REFUSED_BRIBE_FINE_MULT);
      break;
    }
    default:
      return fail(w0, 'Unknown action');
  }
  w.version = w0.version + 1;
  return { world: w };
}

function dealLabel(t: DealTerms): string {
  return t.type === 'joint_purchase' ? 'joint purchase' : t.type === 'cross_promo' ? 'cross-promo' : t.type === 'loan' ? `loan of ${formatMoney(t.amount)}` : `${t.sharePct}% partnership`;
}

function dealTermsError(ctx: EngineCtx, from: BusinessState, to: BusinessState, t: DealTerms): string | null {
  const pa = placeOf(ctx, from.placeId), pb = placeOf(ctx, to.placeId);
  switch (t.type) {
    case 'joint_purchase': return from.niche === to.niche ? null : 'Joint purchase is for businesses of the same kind';
    case 'cross_promo':
      if (from.niche === to.niche) return 'Cross-promo is for businesses of different kinds';
      if (pa && pb && distanceM(pa, pb) > CROSS_PROMO_MAX_M) return `Cross-promo needs a neighbor within ${CROSS_PROMO_MAX_M} m`;
      return null;
    case 'loan':
      if (t.monthlyRatePct < 0 || t.monthlyRatePct > RULES.LOAN_MAX_RATE_PCT) return `Rate must be 0-${RULES.LOAN_MAX_RATE_PCT}% a month`;
      return t.amount > 0 && t.amount <= from.cash ? null : 'Not enough cash for this loan';
    case 'partnership':
      if (t.sharePct < 5 || t.sharePct > 49) return 'Share must be 5-49%';
      return t.amount > 0 && t.amount <= from.cash ? null : 'Not enough cash for this stake';
  }
}

function takeCase(w: WorldState, c: Case, officialId: string): void {
  c.status = 'taken';
  c.officialId = officialId;
  c.takenDay = w.day;
  c.inspectDay = w.day + RULES.INSPECTION_DAYS;
}

function settleFine(w: WorldState, ctx: EngineCtx, c: Case, mult: number): void {
  const b = w.businesses.find((x) => x.id === c.businessId);
  const off = w.officials.find((o) => o.id === c.officialId);
  const fine = round2((c.fine ?? 0) * mult);
  if (b) {
    chargeMtd(b, { id: `fine_${c.id}`, label: 'City fine', kind: 'fine', amount: -fine });
    const found = new Set((c.found ?? []).map((f) => f.violationId));
    b.trails = b.trails.filter((t) => !found.has(t.violationId));
    const hits = (c.found ?? []).map((f) => allViolations(ctx, b.niche).find((v) => v.id === f.violationId)?.reputationHit ?? 0);
    b.reputation = clamp(b.reputation - sum(hits), 0, 1);
    if ((c.closureDays ?? 0) > 0 && b.status === 'open') { b.status = 'closed'; b.closedUntilDay = w.day + (c.closureDays ?? 0); }
    pushFeed(w, 'inspection', `${off?.role === 'tax_auditor' ? 'Tax auditor' : 'City inspector'} fined ${b.name} ${formatMoney(fine)}`, b.id);
    pushInbox(w, b.managerPlayerId, { kind: 'case', title: `You paid a fine of ${formatMoney(fine)}`, text: (c.found ?? []).map((f) => f.violationId).join(', '), ref: { type: 'case', id: c.id } });
  }
  c.fine = fine;
  c.status = 'closed';
  c.outcome = 'fined';
  c.closedDay = w.day;
}

function acceptBribe(w: WorldState, _ctx: EngineCtx, c: Case): void {
  const b = w.businesses.find((x) => x.id === c.businessId);
  const off = w.officials.find((o) => o.id === c.officialId);
  const amount = c.bribeAmount ?? 0;
  if (b) chargeMtd(b, { id: `payment_${c.id}`, label: 'Cash payment', kind: 'other', amount: -amount });
  if (off) {
    off.bribesTaken = round2(off.bribesTaken + amount);
    off.bribesThisMonth += 1;
    off.points += RULES.POINTS_PER_BRIBE * (c.found?.length ?? 1);
  }
  c.status = 'closed';
  c.outcome = 'bribed';
  c.closedDay = w.day;
}

// ───────────── день ─────────────

function lawDay(w: WorldState, ctx: EngineCtx): void {
  for (const c of w.cases) {
    const b = w.businesses.find((x) => x.id === c.businessId);
    if (c.status === 'open' && w.day - c.openedDay >= RULES.CASE_GRACE_DAYS) {
      const ai = w.officials.find((o) => o.isAi && o.role === c.role && !(o.suspendedUntilDay && o.suspendedUntilDay > w.day));
      if (ai) takeCase(w, c, ai.id);
    }
    if (c.status === 'taken' && (c.inspectDay ?? Infinity) <= w.day) {
      const off = w.officials.find((o) => o.id === c.officialId);
      const found: FoundViolation[] = [];
      if (b) {
        for (const t of b.trails) {
          const v = allViolations(ctx, b.niche).find((x) => x.id === t.violationId);
          if (v && roleOfViolation(ctx, b.niche, v) === c.role) found.push({ violationId: v.id, months: t.months, fine: fineFor(v, t), closureDays: v.closureDays ?? 0 });
        }
      }
      c.inspectDay = w.day;
      if (found.length > 0 && b) {
        c.found = found;
        c.fine = round2(sum(found.map((f) => f.fine)));
        c.closureDays = Math.max(...found.map((f) => f.closureDays));
        c.status = 'notice';
        c.answerByDay = w.day + RULES.NOTICE_ANSWER_DAYS;
        b.trails = b.trails.map((t) => (found.some((f) => f.violationId === t.violationId) ? { ...t, discovered: true } : t));
        if (off) { off.points += RULES.POINTS_PER_VIOLATION * found.length; off.casesClosed += 1; }
        pushInbox(w, b.managerPlayerId, { kind: 'case', title: `Violation notice: ${formatMoney(c.fine)}`, text: `Pay, contest or respond within ${RULES.NOTICE_ANSWER_DAYS} days. Silence means you pay.`, ref: { type: 'case', id: c.id } });
        pushFeed(w, 'inspection', `${c.role === 'tax_auditor' ? 'Tax auditor' : 'City inspector'} found violations at ${b.name}`, b.id);
      } else {
        c.status = 'closed';
        c.outcome = 'clean';
        c.closedDay = w.day;
        if (off) { off.points += RULES.POINTS_EMPTY_INSPECTION; off.casesClosed += 1; }
        if (c.origin === 'report' && c.reporterBusinessId) {
          const rep = w.businesses.find((x) => x.id === c.reporterBusinessId);
          const falseBefore = w.cases.filter((x) => x.reporterBusinessId === c.reporterBusinessId && x.outcome === 'clean' && x.id !== c.id).length;
          if (rep) {
            if (falseBefore >= 1) chargeMtd(rep, { id: `false_report_${c.id}`, label: 'Fine for a false report', kind: 'fine', amount: -RULES.FALSE_REPORT_FINE });
            pushInbox(w, rep.managerPlayerId, { kind: 'case', title: falseBefore >= 1 ? `False report: fined ${formatMoney(RULES.FALSE_REPORT_FINE)}` : 'Warning: your report found nothing', text: 'The inspection was clean.', ref: { type: 'case', id: c.id } });
          }
        }
        if (b) pushFeed(w, 'inspection', `Inspection at ${b.name}: no violations`, b.id);
      }
    }
    if (c.status === 'notice' && (c.answerByDay ?? Infinity) < w.day) { c.response = 'pay'; settleFine(w, ctx, c, 1); }
    if (c.status === 'bribe_offered' && (c.answerByDay ?? Infinity) < w.day) settleFine(w, ctx, c, RULES.REFUSED_BRIBE_FINE_MULT);
  }
  for (const b of w.businesses) {
    if (b.status === 'closed' && (b.closedUntilDay ?? 0) <= w.day) { b.status = 'open'; b.closedUntilDay = undefined; }
  }
}

function dealsDay(w: WorldState): void {
  for (const d of w.deals) {
    if (d.status === 'proposed' && d.expiresDay < w.day) d.status = 'expired';
    if (d.status === 'active' && d.endDay !== undefined && d.endDay <= w.day && d.terms.type !== 'loan') {
      d.status = 'completed';
      for (const id of [d.fromBusinessId, d.toBusinessId]) {
        const b = w.businesses.find((x) => x.id === id);
        if (b) b.trust = { ...b.trust, kept: b.trust.kept + 1 };
      }
    }
  }
}

function economyDay(w: WorldState, ctx: EngineCtx): void {
  const weather = w.weather.find((x) => x.day === w.day);
  const weekday = dateOf(w.day).weekday;
  for (const b of w.businesses) {
    if (b.status === 'bankrupt') continue;
    const pack = packOf(ctx, b.niche);
    const place = placeOf(ctx, b.placeId);
    if (!pack || !place) continue;
    const notes: string[] = [];
    const lost = { size: 0, staff: 0, closure: 0 };
    let demand = 0, served = 0, revenue = 0, variable = 0, util = 0;
    if (b.status === 'open' || b.status === 'closed') {
      const mods = dealModifiers(w, ctx, b.id);
      const comp = w.businesses.filter((o) => o.id !== b.id && o.niche === b.niche && o.status === 'open' && distanceM(place, placeOf(ctx, o.placeId) ?? place) <= COMPETITION_RADIUS_M).length;
      const leverDemand = 1 + sum(pack.levers.map((l) => l.options.find((o) => o.id === b.orders.levers[l.id])?.effects?.demand ?? 0));
      const weekdayMult = weekday === 5 ? 1.15 : weekday === 6 ? 0.9 : 1;
      demand = (pack.market.unitsPerSlotMonth / RULES.DAYS_PER_MONTH)
        * Math.pow(b.orders.price / pack.unit.refPrice, pack.market.priceElasticity)
        * (0.75 + 0.5 * b.quality) * (0.8 + 0.4 * b.reputation) * (0.5 + place.footTraffic)
        / (1 + 0.1 * comp)
        * weekdayMult * (weather?.footTrafficMult ?? 1) * eventMult(w, ctx, b, 'demand') * eventMult(w, ctx, b, 'footTraffic')
        * mods.demandMult * mods.footTrafficMult * leverDemand;
      demand = round2(demand);
      if (b.status === 'closed') {
        lost.closure = demand;
        notes.push('Closed by the city today');
      } else {
        const staffCap = pack.capacity.unitsPerStaffMonth === null ? Infinity
          : (staffCount(b.orders) * pack.capacity.unitsPerStaffMonth / RULES.DAYS_PER_MONTH) * eventMult(w, ctx, b, 'staffAvailability');
        const take = pack.sizing.takeawayShare ?? 0;
        const sizeCap = (b.size * pack.sizing.unitsServedPerSizeMonth / RULES.DAYS_PER_MONTH) / (1 - take);
        const hardCap = pack.capacity.hardCapUnits ? pack.capacity.hardCapUnits / RULES.DAYS_PER_MONTH : Infinity;
        const afterStaff = Math.min(demand, staffCap);
        lost.staff = round2(demand - afterStaff);
        const afterSize = Math.min(afterStaff, sizeCap);
        lost.size = round2(afterStaff - afterSize);
        served = round2(Math.min(afterSize, hardCap));
        util = sizeCap > 0 ? clamp(served / sizeCap, 0, 1.5) : 0;
        revenue = round2(served * b.orders.price * mods.priceMult);
        variable = round2(served * pack.unit.cogsPerUnit * mods.cogsMult * eventMult(w, ctx, b, 'cogs'));
        if (lost.size >= 5) notes.push(`Line out the door: ${Math.round(lost.size)} customers walked away`);
        if (lost.staff >= 5) notes.push(`Short-staffed: ${Math.round(lost.staff)} customers left unserved`);
        const crowd = pack.sizing.crowdPenaltyAbove ?? 0.95, empty = pack.sizing.emptyPenaltyBelow ?? 0.2;
        const qTarget = clamp(0.55 + sum(pack.levers.map((l) => l.options.find((o) => o.id === b.orders.levers[l.id])?.effects?.quality ?? 0))
          + sum(b.items.map((it) => pack.setup.find((s) => s.id === it.id)?.qualityBonus ?? 0)), 0.1, 0.95);
        b.quality = round2(clamp(b.quality + (qTarget - b.quality) * 0.05 - (util > crowd ? 0.01 : 0), 0, 1));
        b.reputation = round2(clamp(b.reputation + (b.quality - b.reputation) * 0.02 - (util < empty ? 0.003 : 0), 0, 1));
        chargeMtd(b, { id: 'revenue', label: 'Sales', kind: 'revenue', amount: revenue });
        chargeMtd(b, { id: 'cogs', label: 'Ingredients and supplies', kind: 'cogs', amount: -variable });
      }
    } else {
      notes.push('Setting up: no sales yet, rent is due anyway');
    }
    const report: DayReport = { day: w.day, demandUnits: demand, servedUnits: served, lost, revenue, variableCosts: variable, sizeUtilization: round2(util), weather: weather?.condition ?? 'clear', notes };
    b.days = [...b.days, report].slice(-30);
    b.mtd = {
      ...b.mtd, demandUnits: round2(b.mtd.demandUnits + demand), servedUnits: round2(b.mtd.servedUnits + served),
      lost: { size: round2(b.mtd.lost.size + lost.size), staff: round2(b.mtd.lost.staff + lost.staff), closure: round2(b.mtd.lost.closure + lost.closure) },
    };
  }
}

/** Месячные строки без зарплатных шорткатов: общая для закрытия месяца и для аналитики. */
function monthLines(b: BusinessState, ctx: EngineCtx, revenue: Money, served: number): { lines: PnlLine[]; payroll: Money; rent: Money } {
  const pack = packOf(ctx, b.niche)!;
  const place = placeOf(ctx, b.placeId)!;
  const lines: PnlLine[] = [];
  const payroll = payrollMonth(pack, b.orders);
  const rent = rentMonth(place);
  const staffN = staffCount(b.orders);
  if (payroll > 0) lines.push({ id: 'payroll', label: 'Wages', kind: 'payroll', amount: -payroll });
  for (const t of [...pack.taxes, ...ctx.packs.common.taxes]) {
    if (t.base === 'payroll' && payroll > 0) lines.push({ id: `tax_${t.id}`, label: t.name, kind: 'payroll_tax', amount: -round2(payroll * t.rate) });
    if (t.base === 'taxable_revenue' || t.base === 'revenue') lines.push({ id: `tax_${t.id}`, label: t.name, kind: 'tax', amount: -round2(revenue * (t.base === 'taxable_revenue' ? t.rate / (1 + t.rate) : t.rate)) });
  }
  lines.push({ id: 'rent', label: 'Rent', kind: 'rent', amount: -rent });
  for (const c of pack.monthlyCosts) {
    const amt = c.basis === 'fixed' ? c.amount : c.basis === 'per_staff' ? c.amount * staffN : c.basis === 'per_unit' ? c.amount * served : c.basis === 'pct_revenue' ? c.amount * revenue : c.amount * b.size;
    if (amt) lines.push({ id: `cost_${c.id}`, label: c.name, kind: 'opex', amount: -round2(amt) });
  }
  lines.push({ id: 'cleaning_size', label: 'Cleaning supplies for the room', kind: 'opex', amount: -round2(pack.sizing.cleaningCostPerSizeMonth * b.size) });
  for (const l of pack.levers) {
    const o = l.options.find((x) => x.id === b.orders.levers[l.id]);
    if (o && o.monthlyCost) lines.push({ id: `lever_${l.id}`, label: `${l.name}: ${o.label}`, kind: 'opex', amount: -o.monthlyCost });
  }
  if (b.orders.autopilot === 'manager') lines.push({ id: 'manager', label: 'Hired manager', kind: 'payroll', amount: -pack.manager.monthlySalary });
  return { lines, payroll, rent };
}

function shortcutLines(b: BusinessState, ctx: EngineCtx, base: { payroll: Money; revenue: Money; rent: Money; staffCount: number }, month: number) {
  const pack = packOf(ctx, b.niche)!;
  const lines: PnlLine[] = [];
  const trails: { violationId: string; saved: Money }[] = [];
  for (const id of b.orders.shortcuts) {
    const s = [...pack.shortcuts, ...ctx.packs.common.shortcuts].find((x) => x.id === id);
    if (!s) continue;
    const v = s.saves;
    const saved = round2(v.basis === 'fixed' ? v.amount : v.basis === 'pct_payroll' ? v.amount * base.payroll : v.basis === 'pct_revenue' ? v.amount * base.revenue : v.basis === 'pct_rent' ? v.amount * base.rent : v.amount * base.staffCount);
    if (saved > 0) lines.push({ id: `saving_${s.id}`, label: `Saved: ${s.name}`, kind: 'saving', amount: saved });
    trails.push({ violationId: s.violation, saved });
  }
  for (const l of pack.levers) {
    const o = l.options.find((x) => x.id === b.orders.levers[l.id]);
    if (o?.causes) trails.push({ violationId: o.causes, saved: Math.max(0, (l.options[0]?.monthlyCost ?? 0) - o.monthlyCost) });
  }
  const monthStart = (month - 1) * RULES.DAYS_PER_MONTH + 1;
  for (const p of b.permits) {
    const item = pack.setup.find((x) => x.id === p.itemId);
    if (!item?.withoutItViolation || b.openedDay === undefined || b.openedDay >= p.readyDay || p.readyDay <= monthStart) continue;
    const t = b.trails.find((x) => x.violationId === item.withoutItViolation);
    if (t && t.lastActiveMonth === month) continue;
    trails.push({ violationId: item.withoutItViolation, saved: 0 });
  }
  return { lines, trails };
}

function economyMonthClose(w: WorldState, ctx: EngineCtx): void {
  const month = dateOf(w.day).month;
  for (const b of w.businesses) {
    if (b.status === 'bankrupt') continue;
    const pack = packOf(ctx, b.niche);
    if (!pack || !placeOf(ctx, b.placeId)) continue;
    const revenue = b.mtd.lines.find((l) => l.id === 'revenue')?.amount ?? 0;
    const { lines, payroll, rent } = monthLines(b, ctx, revenue, b.mtd.servedUnits);
    for (const l of lines) chargeMtd(b, l);
    const sc = shortcutLines(b, ctx, { payroll, revenue, rent, staffCount: staffCount(b.orders) }, month);
    for (const l of sc.lines) chargeMtd(b, l);
    for (const t of sc.trails) growTrail(b, t.violationId, t.saved, month);
    b.trails = b.trails.filter((t) => month - t.lastActiveMonth < RULES.TRAIL_EXPIRY_MONTHS);
    const profit = round2(sum(b.mtd.lines.filter((l) => l.kind !== 'setup').map((l) => l.amount)));
    for (const t of ctx.packs.common.taxes.filter((x) => x.base === 'profit')) {
      if (profit > 0) b.liabilities = [...b.liabilities, { taxId: t.id, amount: round2(profit * t.rate), dueDay: w.config.seasonMonths * RULES.DAYS_PER_MONTH, paid: false }];
    }
    const allLines = b.mtd.lines;
    const change = round2(sum(allLines.map((l) => l.amount)));
    const servedDays = b.days.filter((d) => d.day > w.day - RULES.DAYS_PER_MONTH);
    const report: MonthReport = {
      month, avgPrice: b.orders.price, demandUnits: b.mtd.demandUnits, servedUnits: b.mtd.servedUnits, lost: b.mtd.lost,
      capacityUnits: round2(staffCount(b.orders) * (pack.capacity.unitsPerStaffMonth ?? 0)),
      sizeUtilization: round2(servedDays.length ? sum(servedDays.map((d) => d.sizeUtilization)) / servedDays.length : 0),
      lines: allLines, revenue: round2(revenue), profit, cashStart: round2(b.cash - change), cashEnd: b.cash,
      taxesAccrued: round2(-sum(allLines.filter((l) => l.kind === 'tax' || l.kind === 'payroll_tax').map((l) => l.amount))),
      taxesPaid: round2(-sum(allLines.filter((l) => l.kind === 'tax' || l.kind === 'payroll_tax').map((l) => l.amount))),
      fines: round2(-sum(allLines.filter((l) => l.kind === 'fine').map((l) => l.amount))),
      quality: b.quality, reputation: b.reputation, netWorth: netWorth(b, ctx), rankInNiche: 0,
    };
    b.history = [...b.history, report];
    b.mtd = { lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } };
    if (b.cash < 0) {
      b.status = 'bankrupt';
      b.bankruptDay = w.day;
      pushFeed(w, 'bankruptcy', `${b.name} went bankrupt`, b.id);
      for (const pid of ownersOf(b)) pushInbox(w, pid, { kind: 'money', title: `${b.name} went bankrupt`, text: `Cash fell to ${formatMoney(b.cash)}.`, ref: { type: 'business', id: b.id } });
    }
  }
  for (const o of w.officials) o.bribesThisMonth = 0;
}

export function computeStandings(w: WorldState, ctx: EngineCtx): Standing[] {
  const out: Standing[] = [];
  const niches = [...new Set(w.businesses.map((b) => b.niche))];
  for (const n of niches) {
    const list = w.businesses.filter((b) => b.niche === n);
    const alive = list.filter((b) => b.status !== 'bankrupt').sort((a, b) => netWorth(b, ctx) - netWorth(a, ctx) || a.id.localeCompare(b.id));
    const dead = list.filter((b) => b.status === 'bankrupt').sort((a, b) => (b.bankruptDay ?? 0) - (a.bankruptDay ?? 0));
    [...alive, ...dead].forEach((b, i) => out.push({ businessId: b.id, niche: n, rank: i + 1, netWorth: netWorth(b, ctx), isAi: b.isAi, bankrupt: b.status === 'bankrupt' }));
  }
  return out;
}

export function tickDay(w0: WorldState, ctx: EngineCtx): WorldState {
  if (w0.phase === 'ended') return w0;
  const w = structuredClone(w0);
  w.day += 1;
  w.weather = w.weather.filter((x) => x.day >= w.day);
  dealsDay(w);
  lawDay(w, ctx);
  economyDay(w, ctx);
  if (isMonthEnd(w.day)) {
    economyMonthClose(w, ctx);
    w.standings = computeStandings(w, ctx);
    for (const b of w.businesses) {
      const last = b.history[b.history.length - 1];
      if (last && last.month === dateOf(w.day).month) last.rankInNiche = w.standings.find((s) => s.businessId === b.id)?.rank ?? 0;
    }
  }
  if (w.day >= w.config.seasonMonths * RULES.DAYS_PER_MONTH) {
    w.phase = 'ended';
    w.standings = computeStandings(w, ctx);
    pushFeed(w, 'system', 'The season is over');
  }
  w.version = w0.version + 1;
  return w;
}

// ───────────── аналитика (агент 04) ─────────────

export function analyze(b: BusinessState, w: WorldState, ctx: EngineCtx): Analytics {
  const pack = packOf(ctx, b.niche)!;
  const date = dateOf(w.day);
  const daysInto = Math.max(1, date.dayOfMonth);
  const mtdRevenue = b.mtd.lines.find((l) => l.id === 'revenue')?.amount ?? 0;
  const mtdCogs = -(b.mtd.lines.find((l) => l.id === 'cogs')?.amount ?? 0);
  const recentDays = b.days.slice(-7);
  const avgServed = recentDays.length ? sum(recentDays.map((d) => d.servedUnits)) / recentDays.length : 0;
  const served = b.mtd.servedUnits > 0 ? (b.mtd.servedUnits / daysInto) * RULES.DAYS_PER_MONTH : avgServed * RULES.DAYS_PER_MONTH;
  const revenue = round2(mtdRevenue > 0 ? (mtdRevenue / daysInto) * RULES.DAYS_PER_MONTH : served * b.orders.price);
  const { lines } = monthLines(b, ctx, revenue, served);
  const variablePct = sum(pack.monthlyCosts.filter((c) => c.basis === 'pct_revenue').map((c) => c.amount))
    + sum(pack.taxes.filter((t) => t.base === 'taxable_revenue').map((t) => t.rate / (1 + t.rate)));
  const perUnit = sum(pack.monthlyCosts.filter((c) => c.basis === 'per_unit').map((c) => c.amount));
  const cogsUnit = served > 0 && mtdCogs > 0 ? mtdCogs / Math.max(1, b.mtd.servedUnits) : pack.unit.cogsPerUnit;
  const variableCostPerUnit = round2(cogsUnit + perUnit + variablePct * b.orders.price);
  const variableIds = new Set([...pack.monthlyCosts.filter((c) => c.basis === 'pct_revenue' || c.basis === 'per_unit').map((c) => `cost_${c.id}`), ...pack.taxes.filter((t) => t.base !== 'payroll').map((t) => `tax_${t.id}`)]);
  const fixedCostsMonth = round2(-sum(lines.filter((l) => !variableIds.has(l.id)).map((l) => l.amount)));
  const contributionPerUnit = round2(b.orders.price - variableCostPerUnit);
  const profit = round2(revenue - variableCostPerUnit * served - fixedCostsMonth);
  const breakEvenUnitsMonth = contributionPerUnit > 0 ? Math.ceil(fixedCostsMonth / contributionPerUnit) : null;
  const pct = (x: number) => (revenue > 0 ? round2(x / revenue) : 0);
  const labor = -sum(lines.filter((l) => l.kind === 'payroll' || l.kind === 'payroll_tax').map((l) => l.amount));
  const rent = -sum(lines.filter((l) => l.kind === 'rent').map((l) => l.amount));
  const cogs = cogsUnit * served;
  const lostUnits = round2(b.mtd.lost.size + b.mtd.lost.staff + b.mtd.lost.closure);
  const cumulativeProfit = round2(sum(b.history.map((h) => h.profit)) + sum(b.mtd.lines.filter((l) => l.kind !== 'setup').map((l) => l.amount)));
  const exposure = round2(sum(b.trails.map((t) => { const v = allViolations(ctx, b.niche).find((x) => x.id === t.violationId); return v ? fineFor(v, t) : 0; })));
  const capUnits = staffCount(b.orders) * (pack.capacity.unitsPerStaffMonth ?? 0);
  const bench = (metric: string, you: number, industry: number): Benchmark => ({ metric, you, industry, verdict: you <= industry * 1.05 ? 'good' : you <= industry * 1.2 ? 'ok' : 'bad' });
  const nextTaxDay = Math.ceil(w.day / RULES.DAYS_PER_MONTH) * RULES.DAYS_PER_MONTH;
  const taxMonth = -sum(lines.filter((l) => l.kind === 'tax' || l.kind === 'payroll_tax').map((l) => l.amount));
  return {
    month: date.month, daysIntoMonth: daysInto, revenue, profit, cumulativeProfit, netWorth: netWorth(b, ctx),
    cogsPct: pct(cogs), laborPct: pct(labor), rentPct: pct(rent), primeCostPct: pct(cogs + labor), netMarginPct: pct(profit),
    fixedCostsMonth, variableCostPerUnit, contributionPerUnit,
    breakEvenUnitsMonth, breakEvenRevenueMonth: breakEvenUnitsMonth === null ? null : round2(breakEvenUnitsMonth * b.orders.price),
    breakEvenPrice: served > 0 ? round2((fixedCostsMonth / served + cogsUnit + perUnit) / Math.max(0.05, 1 - variablePct)) : null,
    utilization: capUnits > 0 ? round2(served / capUnits) : 0,
    sizeUtilization: recentDays.length ? round2(sum(recentDays.map((d) => d.sizeUtilization)) / recentDays.length) : 0,
    lostSalesUnits: lostUnits, lostSalesMoney: round2(lostUnits * b.orders.price),
    cashRunwayMonths: profit < 0 ? round2(b.cash / -profit) : null,
    setupInvested: b.setupSpent, paybackMonths: profit > 0 ? round2(b.setupSpent / profit) : null,
    taxDueNext: taxMonth > 0 ? { amount: round2(taxMonth), day: nextTaxDay } : null,
    exposure,
    benchmarks: [bench('Food and supplies', pct(cogs), pack.benchmarks.cogsPct), bench('Labor', pct(labor), pack.benchmarks.laborPct), bench('Rent', pct(rent), pack.benchmarks.rentPct)],
    nicheKpis: [],
  };
}

export function recommend(b: BusinessState, w: WorldState, ctx: EngineCtx): Recommendation[] {
  const pack = packOf(ctx, b.niche)!;
  const out: Recommendation[] = [];
  const recent = b.days.slice(-7);
  const demand = sum(recent.map((d) => d.demandUnits));
  const lostSize = sum(recent.map((d) => d.lost.size));
  const lostStaff = sum(recent.map((d) => d.lost.staff));
  const firstRole = pack.staff[0]?.id;
  if (b.status === 'setup' && b.permits.every((p) => p.readyDay <= w.day)) {
    out.push({ id: 'launch_ready', severity: 'info', title: 'Permits are ready', text: 'Every permit is in. Open your doors.', suggested: { type: 'launch' } });
  }
  if (demand > 0 && lostSize / demand > 0.1) {
    const place = placeOf(ctx, b.placeId)!;
    const target = Math.min(maxSizeFor(pack, place), b.size + Math.max(1, Math.round(b.size * 0.2)));
    if (target > b.size) out.push({ id: 'too_small', severity: 'warn', title: 'Not enough room', text: `${Math.round(lostSize)} customers walked away this week. Add ${target - b.size} ${pack.sizing.unitName}s.`, suggested: { type: 'resize', size: target } });
  }
  if (demand > 0 && lostStaff / demand > 0.1 && firstRole) {
    const staff = { ...b.orders.staff, [firstRole]: (b.orders.staff[firstRole] ?? 0) + 1 };
    out.push({ id: 'short_staffed', severity: 'warn', title: 'Short-staffed', text: `${Math.round(lostStaff)} customers left unserved this week. Hire one more ${pack.staff[0].name.toLowerCase()}.`, suggested: { type: 'set_orders', orders: { staff } } });
  }
  const util = recent.length ? sum(recent.map((d) => d.sizeUtilization)) / recent.length : 1;
  if (b.status === 'open' && recent.length >= 5 && util < (pack.sizing.emptyPenaltyBelow ?? 0.2) && b.size > pack.sizing.min) {
    out.push({ id: 'too_big', severity: 'info', title: 'The room is mostly empty', text: `Only ${Math.round(util * 100)}% of ${pack.sizing.unitName}s are used. Fewer seats cost less.`, suggested: { type: 'resize', size: Math.max(pack.sizing.min, b.size - Math.max(1, Math.round(b.size * 0.2))) } });
  }
  if (b.orders.shortcuts.length > 0 || b.trails.length > 0) {
    out.push({ id: 'exposure', severity: 'warn', title: 'You are exposed to fines', text: `${b.trails.length} violation trail(s) would be found by an inspection.`, suggested: { type: 'set_orders', orders: { shortcuts: [] } } });
  }
  for (const c of w.cases.filter((x) => x.businessId === b.id && x.status === 'notice')) {
    out.push({ id: `notice_${c.id}`, severity: 'critical', title: `Fine notice: ${formatMoney(c.fine ?? 0)}`, text: `Answer by day ${c.answerByDay}. Silence means you pay.`, suggested: { type: 'answer_notice', caseId: c.id, response: 'pay' } });
  }
  if (b.history.length > 0) {
    const last = b.history[b.history.length - 1];
    if (last.profit < 0 && b.cash < -last.profit * 2) out.push({ id: 'low_cash', severity: 'critical', title: 'Cash is running out', text: `At last month's loss of ${formatMoney(-last.profit)}, cash lasts ${Math.max(0, b.cash / -last.profit).toFixed(1)} months.` });
  }
  return out;
}

export function recommendOpening(niche: NicheId, placeId: string, _w: WorldState, ctx: EngineCtx): OpenRecommendation[] {
  const pack = packOf(ctx, niche);
  const place = placeOf(ctx, placeId);
  if (!pack || !place) return [];
  const limit = maxSizeFor(pack, place);
  const permitDays = Math.max(0, ...pack.setup.filter((s) => s.waitDays).map((s) => s.waitDays ?? 0));
  const rent = rentMonth(place);
  const recs = pack.kits.map((kit) => {
    let size = clamp(kit.size, pack.sizing.min, limit);
    const total = (s: number) => round2(sum(kit.items.map((it) => { const item = pack.setup.find((x) => x.id === it.id); return item ? setupCost(item, it.qty, s) : 0; })));
    while (size > pack.sizing.min && total(size) > pack.startCapital) size -= 1;
    const cost = total(size);
    const expected = pack.market.unitsPerSlotMonth * (0.5 + place.footTraffic) * 0.85;
    const sizeCapMonth = size * pack.sizing.unitsServedPerSizeMonth / (1 - (pack.sizing.takeawayShare ?? 0));
    const staffNeeded = pack.capacity.unitsPerStaffMonth ? clamp(Math.ceil(Math.min(expected, sizeCapMonth) / pack.capacity.unitsPerStaffMonth), pack.capacity.minStaff, pack.capacity.maxStaff) : pack.capacity.minStaff;
    const orders = defaultOrders(pack, staffNeeded);
    const cashLeft = round2(pack.startCapital - cost);
    const why = [
      `${size} ${pack.sizing.unitName}s fit this ${place.sqft} sq ft space`,
      `Leaves ${formatMoney(cashLeft)} in the bank: ${(cashLeft / rent).toFixed(1)} months of rent`,
      permitDays > 0 ? `Permits take ${permitDays} days; rent is due meanwhile: ${formatMoney((rent * permitDays) / RULES.DAYS_PER_MONTH)}` : 'No permit wait',
      `${staffNeeded} staff for about ${Math.round(Math.min(expected, sizeCapMonth))} ${pack.unit.name}s a month`,
    ];
    const projected = Math.min(expected, sizeCapMonth) * (pack.unit.refPrice - pack.unit.cogsPerUnit) - rent - payrollMonth(pack, orders);
    return { rec: { kitId: kit.id, size, items: kit.items.map((x) => ({ ...x })), total: cost, cashLeft, orders, daysToOpen: permitDays, why } as OpenRecommendation, projected, fits: cost <= pack.startCapital };
  });
  return recs.filter((r) => r.fits).sort((a, b) => b.projected - a.projected).map((r) => r.rec);
}

export function whatIf(w: WorldState, ctx: EngineCtx, businessId: string, orders: Partial<StandingOrders>): { projected: MonthReport; analytics: Analytics } {
  let sim = structuredClone(w);
  sim.cases = [];
  const b = sim.businesses.find((x) => x.id === businessId);
  if (!b) throw new Error('Unknown business');
  b.orders = { ...b.orders, ...orders };
  for (let i = 0; i < RULES.DAYS_PER_MONTH && sim.phase === 'running'; i++) {
    if (sim.weather.length === 0 || !sim.weather.some((x) => x.day === sim.day + 1)) sim.weather = [...sim.weather, { day: sim.day + 1, tempF: 60, condition: 'clear', footTrafficMult: 1, label: 'Clear' }];
    sim = tickDay(sim, ctx);
  }
  const nb = sim.businesses.find((x) => x.id === businessId)!;
  const analytics = analyze(nb, sim, ctx);
  const projected = nb.history[nb.history.length - 1] ?? {
    month: dateOf(sim.day).month, avgPrice: nb.orders.price, demandUnits: nb.mtd.demandUnits, servedUnits: nb.mtd.servedUnits, lost: nb.mtd.lost,
    capacityUnits: 0, sizeUtilization: 0, lines: nb.mtd.lines, revenue: analytics.revenue, profit: analytics.profit, cashStart: b.cash, cashEnd: nb.cash,
    taxesAccrued: 0, taxesPaid: 0, fines: 0, quality: nb.quality, reputation: nb.reputation, netWorth: analytics.netWorth, rankInNiche: 0,
  };
  return { projected, analytics };
}

export function roadmapFor(niche: NicheId, b: BusinessState | null, w: WorldState, ctx: EngineCtx): RoadmapItem[] {
  const pack = packOf(ctx, niche);
  const steps = [...ctx.packs.common.roadmap, ...(pack?.roadmap ?? [])];
  return steps.map((s) => {
    if (!b) return { ...s, status: 'todo' as const };
    if (s.setupItemId) {
      const p = b.permits.find((x) => x.itemId === s.setupItemId);
      if (p) return p.readyDay <= w.day ? { ...s, status: 'done' as const, readyDay: p.readyDay } : { ...s, status: 'waiting' as const, readyDay: p.readyDay };
      return { ...s, status: b.items.some((it) => it.id === s.setupItemId) ? 'done' as const : 'todo' as const };
    }
    if (s.kind === 'launch') return { ...s, status: b.status === 'setup' ? 'todo' as const : 'done' as const };
    if (s.kind === 'people') return { ...s, status: staffCount(b.orders) > 0 ? 'done' as const : 'todo' as const };
    return { ...s, status: 'done' as const };
  });
}

export function realWorldPlan(b: BusinessState, w: WorldState, ctx: EngineCtx): RealWorldPlan {
  const pack = packOf(ctx, b.niche)!;
  const a = analyze(b, w, ctx);
  const startupBudget = b.items.map((it) => { const s = pack.setup.find((x) => x.id === it.id)!; return { label: s?.name ?? it.id, amount: s ? setupCost(s, it.qty, b.size) : 0 }; });
  const last = b.history[b.history.length - 1];
  const monthly = (last?.lines ?? b.mtd.lines).filter((l) => l.amount < 0 && l.kind !== 'setup' && l.kind !== 'fine').map((l) => ({ label: l.label, amount: -l.amount }));
  const fines = sum(b.history.map((h) => h.fines));
  const lessons = [
    { title: 'Fines', amount: round2(fines), lesson: fines > 0 ? 'Every shortcut you took was found and cost more than it saved.' : 'You paid no fines: running clean works.' },
    { title: 'Lost sales', amount: round2(a.lostSalesMoney), lesson: 'Customers you could not serve for lack of room or staff.' },
    { title: 'Rent', amount: round2(-sum((last?.lines ?? []).filter((l) => l.kind === 'rent').map((l) => l.amount))), lesson: 'Rent is the cost you sign for before you sell anything.' },
  ].sort((x, y) => y.amount - x.amount);
  return {
    niche: b.niche, businessName: b.name,
    startupBudget, startupTotal: round2(sum(startupBudget.map((x) => x.amount))),
    monthlyCosts: monthly, monthlyTotal: round2(sum(monthly.map((x) => x.amount))),
    reserveAdvised: round2(a.fixedCostsMonth * 6), breakEvenUnitsMonth: a.breakEvenUnitsMonth, paybackMonths: a.paybackMonths,
    checklist: [...ctx.packs.common.roadmap, ...pack.roadmap], suppliers: pack.suppliers, lessons,
    disclaimer: 'This is a simulation for practice, not legal or financial advice.',
  };
}

export function managerOrders(b: BusinessState, _w: WorldState, ctx: EngineCtx): Partial<StandingOrders> {
  const pack = packOf(ctx, b.niche);
  if (!pack) return {};
  const out: Partial<StandingOrders> = {};
  if (b.orders.shortcuts.length) out.shortcuts = [];
  const levers = { ...b.orders.levers };
  let leverChanged = false;
  for (const l of pack.levers) {
    const o = l.options.find((x) => x.id === levers[l.id]);
    if (o?.causes) { levers[l.id] = l.options.find((x) => !x.causes)?.id ?? levers[l.id]; leverChanged = true; }
  }
  if (leverChanged) out.levers = levers;
  const recent = b.days.slice(-7);
  const demand = sum(recent.map((d) => d.demandUnits));
  const lostStaff = sum(recent.map((d) => d.lost.staff));
  const role = pack.staff[0]?.id;
  if (role && demand > 0 && lostStaff / demand > 0.1 && staffCount(b.orders) < pack.capacity.maxStaff) out.staff = { ...b.orders.staff, [role]: (b.orders.staff[role] ?? 0) + 1 };
  return out;
}

// ───────────── закон: помощники для хоста (агент 03) ─────────────

export function noticesFor(w: WorldState, businessId: string): CaseNotice[] {
  return w.cases
    .filter((c) => c.businessId === businessId && (c.status === 'notice' || c.status === 'bribe_offered' || (c.status === 'closed' && c.outcome !== 'clean' && (c.closedDay ?? 0) > w.day - 30)))
    .map((c) => ({ caseId: c.id, role: c.role, found: c.found ?? [], fine: c.fine ?? 0, closureDays: c.closureDays ?? 0, answerByDay: c.answerByDay ?? w.day, status: c.status, outcome: c.outcome }));
}

export function queueFor(w: WorldState, ctx: EngineCtx, officialId: string): CaseCard[] {
  const off = w.officials.find((o) => o.id === officialId);
  if (!off) return [];
  return w.cases.filter((c) => c.status === 'open' && c.role === off.role).flatMap((c) => {
    const b = w.businesses.find((x) => x.id === c.businessId);
    return b ? [{ caseId: c.id, business: publicBusiness(w, ctx, b), role: c.role, origin: c.origin, openedDay: c.openedDay, hints: c.hints, status: c.status }] : [];
  });
}

export const stubEngine: EngineApi = {
  createWorld, applyAction, tickDay, netWorth, analyze, recommend, recommendOpening, whatIf, roadmapFor, realWorldPlan,
  managerOrders, noticesFor, queueFor, computeStandings,
};
