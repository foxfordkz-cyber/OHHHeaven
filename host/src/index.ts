// @ohh-stub — walking-skeleton host by agent 01, signatures from build/CONTRACT.md §6. Owner: agent 06 replaces this file.
import type {
  Action, ActionResult, Analytics, BusinessState, CaseCard, CaseNotice, CityView, ClientView, DayWeather, GameEvent,
  NicheId, OfficialRole, OfficialView, OpenRecommendation, OwnerView, Pack, Player, PublicBusiness, Query, RealWorldPlan,
  RoadmapItem, Standing, StandingOrders, WorldConfig, WorldPublic, WorldState,
} from '@ohh/shared';
import { RULES, dateOf, round2, sum, uid } from '@ohh/shared';
import { applyAction, createWorld, netWorth, tickDay, type EngineCtx } from '@ohh/engine';
import type { BotBrain } from '@ohh/bots';

export interface HostDeps {
  bots: BotBrain;
  forecast(seed: number, fromDay: number, days: number): DayWeather[];
  deckEvent(w: WorldState, ctx: EngineCtx): GameEvent | null;
}

type JoinInput = { name: string; kind: 'owner' | 'official'; role?: OfficialRole };

function addPlayer(w0: WorldState, p: JoinInput, isAi: boolean): { world: WorldState; playerId: string } {
  const w = structuredClone(w0);
  const playerId = `p_${uid(w.config.seed, w.players.length + 1)}`;
  const player: Player = { id: playerId, name: p.name, kind: p.kind, isAi, paid: false, role: p.role, joinedDay: w.day, lastSeenDay: w.day, inbox: [] };
  w.players.push(player);
  if (p.kind === 'official') {
    w.officials.push({ id: `o_${uid(w.config.seed, 500 + w.officials.length)}`, playerId, name: p.name, isAi, role: p.role ?? 'inspector', points: 0, casesClosed: 0, bribesTaken: 0, bribesThisMonth: 0, exposed: false });
  }
  w.version += 1;
  return { world: w, playerId };
}

function defaultOrders(pack: Pack): StandingOrders {
  const levers: Record<string, string> = {};
  for (const l of pack.levers) if (l.options[0]) levers[l.id] = l.options[0].id;
  return { price: pack.unit.refPrice, staff: pack.staff[0] ? { [pack.staff[0].id]: Math.max(1, pack.capacity.minStaff) } : {}, levers, shortcuts: [], blockFund: false, autopilot: 'hold' };
}

function kitCost(pack: Pack, size: number, items: { id: string; qty: number }[]): number {
  return round2(sum(items, (it) => { const s = pack.setup.find((x) => x.id === it.id); return s ? s.cost * (s.scalesWithSize ? size : it.qty) : 0; }));
}

export function newWorld(config: WorldConfig, ctx: EngineCtx, deps: HostDeps): WorldState {
  let w = createWorld(config);
  w = { ...w, weather: deps.forecast(config.seed, w.day, RULES.FORECAST_DAYS + 1) };
  // Cases nobody takes go to an AI official (CONTRACT §5), so the city always has one per role.
  for (const role of ['inspector', 'tax_auditor'] as const) w = addPlayer(w, { name: role === 'inspector' ? 'City inspector (AI)' : 'Tax auditor (AI)', kind: 'official', role }, true).world;
  for (const r of deps.bots.populate(w, ctx, config.seed)) {
    const joined = addPlayer(w, { name: r.name, kind: r.kind, role: r.role }, true);
    w = joined.world;
    const pack = r.niche ? ctx.packs.niches[r.niche] : undefined;
    if (r.kind === 'owner' && pack && r.placeId) {
      const kit = pack.kits.find((k) => k.id === 'standard') ?? pack.kits[0];
      if (!kit) continue;
      const opened = applyAction(w, ctx, joined.playerId, { type: 'open_business', niche: pack.id, placeId: r.placeId, name: `${r.name}`, kitId: kit.id, size: kit.size, items: kit.items });
      w = opened.error ? w : applyAction(opened.world, ctx, joined.playerId, { type: 'launch' }).world;
    }
  }
  return w;
}

export function join(w: WorldState, p: JoinInput): { world: WorldState; playerId: string } {
  return addPlayer(w, p, false);
}

export function act(w: WorldState, ctx: EngineCtx, playerId: string, a: Action): ActionResult {
  const r = applyAction(w, ctx, playerId, a);
  if (r.error) return r;
  const world = structuredClone(r.world);
  const p = world.players.find((x) => x.id === playerId);
  if (p) p.lastSeenDay = world.day;
  return { world };
}

export function step(w0: WorldState, ctx: EngineCtx, deps: HostDeps): WorldState {
  let w = w0;
  for (const p of w.players.filter((x) => x.isAi)) {
    const actions = p.kind === 'owner' ? deps.bots.ownerActions(w, ctx, p.id) : deps.bots.officialActions(w, ctx, p.id);
    for (const a of actions) { const r = applyAction(w, ctx, p.id, a); if (!r.error) w = r.world; }
  }
  const ev = deps.deckEvent(w, ctx);
  if (ev && !w.events.some((e) => e.id === ev.id)) w = { ...w, events: [...w.events, ev] };
  w = tickDay(w, ctx);
  return { ...w, weather: deps.forecast(w.config.seed, w.day, RULES.FORECAST_DAYS + 1) };
}

function worldPublic(w: WorldState): WorldPublic {
  return {
    config: w.config, phase: w.phase, day: w.day, date: dateOf(w.day), version: w.version, bank: w.bank, msToNextDay: w.config.dayMs,
    stats: {
      owners: w.players.filter((p) => p.kind === 'owner' && !p.isAi).length, aiBusinesses: w.businesses.filter((b) => b.isAi).length,
      officials: w.officials.length, open: w.businesses.filter((b) => b.status === 'open').length, bankrupt: w.businesses.filter((b) => b.status === 'bankrupt').length,
    },
  };
}

function publicBusiness(w: WorldState, b: BusinessState): PublicBusiness {
  const owner = w.players.find((p) => p.id === b.managerPlayerId);
  const partners = w.deals.filter((d) => d.status === 'active' && (d.fromBusinessId === b.id || d.toBusinessId === b.id)).map((d) => (d.fromBusinessId === b.id ? d.toBusinessId : d.fromBusinessId));
  return {
    id: b.id, name: b.name, ownerName: owner?.name ?? '—', isAi: b.isAi, niche: b.niche, placeId: b.placeId, status: b.status,
    price: b.orders.price, reputation: b.reputation, rankInNiche: w.standings.find((s) => s.businessId === b.id)?.rank ?? 0, trust: b.trust, partners,
  };
}

function leaderboards(w: WorldState): Partial<Record<NicheId, Standing[]>> {
  const out: Partial<Record<NicheId, Standing[]>> = {};
  for (const s of w.standings) (out[s.niche] ??= []).push(s);
  return out;
}

function analyticsFor(b: BusinessState, w: WorldState, ctx: EngineCtx): Analytics {
  const pack = ctx.packs.niches[b.niche];
  const date = dateOf(w.day);
  const lines = b.mtd.lines.filter((l) => l.kind !== 'setup');
  const days = Math.max(1, date.dayOfMonth);
  const scale = RULES.DAYS_PER_MONTH / days;
  const revenue = round2(sum(lines.filter((l) => l.kind === 'revenue'), (l) => l.amount) * scale);
  const last = b.history.at(-1);
  const profit = round2(last ? last.profit : sum(lines, (l) => l.amount) * scale);
  const pct = (kind: string) => (last && last.revenue > 0 ? round2(-sum(last.lines.filter((l) => l.kind === kind), (l) => l.amount) / last.revenue) : 0);
  const price = b.orders.price;
  const cogsUnit = pack?.unit.cogsPerUnit ?? 0;
  const fixed = round2(sum(pack?.monthlyCosts.filter((c) => c.basis === 'fixed') ?? [], (c) => c.amount) + sum(pack?.staff ?? [], (r) => (b.orders.staff[r.id] ?? 0) * r.hourlyWage * r.hoursPerMonth));
  const contribution = round2(price - cogsUnit);
  const breakEvenUnits = contribution > 0 ? Math.ceil(fixed / contribution) : null;
  const lost = b.mtd.lost.size + b.mtd.lost.staff + b.mtd.lost.closure;
  return {
    month: date.month, daysIntoMonth: date.dayOfMonth, revenue, profit, cumulativeProfit: round2(sum(b.history, (h) => h.profit)), netWorth: netWorth(b, ctx),
    cogsPct: pct('cogs'), laborPct: pct('payroll'), rentPct: pct('rent'), primeCostPct: round2(pct('cogs') + pct('payroll')),
    netMarginPct: last && last.revenue > 0 ? round2(last.profit / last.revenue) : 0,
    fixedCostsMonth: fixed, variableCostPerUnit: cogsUnit, contributionPerUnit: contribution,
    breakEvenUnitsMonth: breakEvenUnits, breakEvenRevenueMonth: breakEvenUnits == null ? null : round2(breakEvenUnits * price), breakEvenPrice: null,
    utilization: b.mtd.demandUnits > 0 ? round2(b.mtd.servedUnits / b.mtd.demandUnits) : 0, sizeUtilization: b.days.at(-1)?.sizeUtilization ?? 0,
    lostSalesUnits: lost, lostSalesMoney: round2(lost * price),
    cashRunwayMonths: profit < 0 ? round2(b.cash / -profit) : null, setupInvested: b.setupSpent, paybackMonths: profit > 0 ? round2(b.setupSpent / profit) : null,
    taxDueNext: null, exposure: 0, benchmarks: [], nicheKpis: [],
  };
}

function roadmapItems(niche: NicheId, b: BusinessState | null, w: WorldState, ctx: EngineCtx): RoadmapItem[] {
  const steps = [...(ctx.packs.common?.roadmap ?? []), ...(ctx.packs.niches[niche]?.roadmap ?? [])];
  return steps.map((s) => {
    const permit = b?.permits.find((p) => p.itemId === s.setupItemId);
    const status: RoadmapItem['status'] = permit ? (permit.readyDay <= w.day ? 'done' : 'waiting') : b && b.status !== 'setup' ? 'done' : 'todo';
    return { ...s, status, readyDay: permit?.readyDay };
  });
}

export function viewFor(w: WorldState, ctx: EngineCtx, playerId: string | null): ClientView {
  const me = playerId ? w.players.find((p) => p.id === playerId) : undefined;
  const base = { world: worldPublic(w), weather: w.weather, events: w.events, feed: w.feed };
  if (!me) {
    const city: CityView = { kind: 'city', ...base, businesses: w.businesses.map((b) => publicBusiness(w, b)), leaderboards: leaderboards(w) };
    return city;
  }
  if (me.kind === 'official') {
    const official = w.officials.find((o) => o.playerId === me.id)!;
    const card = (c: WorldState['cases'][number]): CaseCard => {
      const b = w.businesses.find((x) => x.id === c.businessId)!;
      return { caseId: c.id, business: publicBusiness(w, b), role: c.role, origin: c.origin, openedDay: c.openedDay, hints: c.hints, status: c.status, bribeAmount: c.bribeAmount, found: c.found };
    };
    const view: OfficialView = {
      kind: 'official', me, ...base, official,
      queue: w.cases.filter((c) => c.status === 'open' && c.role === official.role).map(card),
      mine: w.cases.filter((c) => c.officialId === official.id && c.status !== 'closed').map(card),
      ranking: w.officials.map((o) => ({ name: o.name, points: o.points, isAi: o.isAi })).sort((a, b) => b.points - a.points),
    };
    return view;
  }
  const business = w.businesses.find((b) => b.managerPlayerId === me.id) ?? null;
  const notices: CaseNotice[] = business
    ? w.cases.filter((c) => c.businessId === business.id && c.found?.length).map((c) => ({ caseId: c.id, role: c.role, found: c.found ?? [], fine: c.fine ?? 0, closureDays: c.closureDays ?? 0, answerByDay: c.answerByDay ?? w.day, status: c.status, outcome: c.outcome }))
    : [];
  const view: OwnerView = {
    kind: 'owner', me, ...base, business,
    stakes: w.businesses.flatMap((b) => b.owners.filter((o) => o.playerId === me.id).map((o) => ({ businessId: b.id, share: o.share }))),
    neighbors: w.businesses.filter((b) => b.id !== business?.id).map((b) => publicBusiness(w, b)),
    deals: business ? w.deals.filter((d) => d.fromBusinessId === business.id || d.toBusinessId === business.id) : [],
    notices, blockFund: null,
    analytics: business ? analyticsFor(business, w, ctx) : null, recommendations: [],
    roadmap: business ? roadmapItems(business.niche, business, w, ctx) : [],
    leaderboards: leaderboards(w), away: null,
  };
  return view;
}

export function answer(w: WorldState, ctx: EngineCtx, playerId: string, q: Query): unknown {
  const business = w.businesses.find((b) => b.managerPlayerId === playerId) ?? null;
  switch (q.type) {
    case 'recommend_opening': {
      const pack = ctx.packs.niches[q.niche];
      if (!pack) return { error: `niche ${q.niche} is not playable yet` };
      return pack.kits.map((k): OpenRecommendation => {
        const total = kitCost(pack, k.size, k.items);
        const waits = k.items.map((i) => pack.setup.find((s) => s.id === i.id)?.waitDays ?? 0);
        return { kitId: k.id, size: k.size, items: k.items, total, cashLeft: round2(pack.startCapital - total), orders: defaultOrders(pack), daysToOpen: Math.max(0, ...waits), why: [k.pitch] };
      });
    }
    case 'what_if': {
      if (!business) return { error: 'no business' };
      const analytics = analyticsFor(business, w, ctx);
      return { projected: business.history.at(-1) ?? null, analytics };
    }
    case 'roadmap':
      return roadmapItems(q.niche, business, w, ctx);
    case 'real_world_plan': {
      if (!business) return { error: 'no business' };
      const pack = ctx.packs.niches[business.niche];
      const plan: RealWorldPlan = {
        niche: business.niche, businessName: business.name,
        startupBudget: [{ label: 'Opening costs', amount: business.setupSpent }], startupTotal: business.setupSpent,
        monthlyCosts: (pack?.monthlyCosts ?? []).map((c) => ({ label: c.name, amount: c.amount })), monthlyTotal: round2(sum(pack?.monthlyCosts ?? [], (c) => c.amount)),
        reserveAdvised: round2(3 * sum(pack?.monthlyCosts ?? [], (c) => c.amount)), breakEvenUnitsMonth: analyticsFor(business, w, ctx).breakEvenUnitsMonth, paybackMonths: null,
        checklist: [...(ctx.packs.common?.roadmap ?? []), ...(pack?.roadmap ?? [])], suppliers: pack?.suppliers ?? [], lessons: [],
        disclaimer: 'A game estimate, not financial or legal advice.',
      };
      return plan;
    }
    default:
      return { error: `query '${q.type}' is answered by the server (@ohh/ai)` };
  }
}
