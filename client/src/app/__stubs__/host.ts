// STUB of @ohh/host (agent 06) with the signatures of build/CONTRACT.md, section 6.
// It plays a small city on example data so the client works offline before the real host lands.
// Money here is a rough placeholder, not the game economy: the real numbers come from @ohh/engine.
import type {
  Action, ActionResult, BusinessState, CityView, ClientView, DayReport, OfficialRole, OfficialView, OpenRecommendation, OwnerView,
  Player, PublicBusiness, Query, RealWorldPlan, RoadmapItem, Standing, WorldConfig, WorldPublic, WorldState,
} from '@ohh/shared/types';
import { RULES, dateOf } from '@ohh/shared/rules';
import type { EngineCtx, HostDeps } from '../host-types';
import {
  FIXTURE_DAY, fixtureAnalytics, fixtureEvents, fixtureFeed, fixtureOpenRecommendations, fixturePacks, fixturePlaces,
  fixtureRecommendations, fixtureRoadmapTodo, fixtureWeather, officialView, ownerBusiness,
} from '../fixtures';
import { fixtureBusinesses } from '../fixtures';

export const stubCtx: EngineCtx = { packs: fixturePacks, places: fixturePlaces };

const CONDITIONS = ['clear', 'cloudy', 'rain', 'clear', 'cloudy', 'clear', 'snow'] as const;

export const stubDeps: HostDeps = {
  bots: { populate: () => [], ownerActions: () => [], officialActions: () => [] },
  forecast(seed, fromDay, days) {
    return Array.from({ length: days }, (_, i) => {
      const d = fromDay + i;
      const month = dateOf(d).month;
      // NYC normal highs by month (estimate from NOAA Central Park normals), plus a small seeded wobble.
      const normal = [39, 42, 50, 62, 72, 80, 85, 84, 76, 65, 54, 44][(month - 1) % 12];
      const tempF = normal + ((d * 7 + seed) % 9) - 4;
      const condition = CONDITIONS[(d + seed) % CONDITIONS.length];
      const mult = { clear: 1.05, cloudy: 0.97, rain: 0.85, snow: 0.72, heat: 0.9, storm: 0.7 }[condition];
      const word = { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', snow: 'Snow', heat: 'Heat', storm: 'Storm' }[condition];
      return { day: d, tempF, condition: tempF > 40 && condition === 'snow' ? 'rain' : condition, footTrafficMult: mult, label: `${tempF > 40 && condition === 'snow' ? 'Rain' : word} ${tempF}°F` };
    });
  },
  deckEvent: () => null,
};

function fullBusiness(pub: PublicBusiness, i: number): BusinessState {
  return {
    ...ownerBusiness, id: pub.id, name: pub.name, niche: pub.niche, placeId: pub.placeId, isAi: pub.isAi,
    owners: [{ playerId: pub.isAi ? `ai-${pub.id}` : `u-${pub.id}`, share: 1 }], managerPlayerId: pub.isAi ? `ai-${pub.id}` : `u-${pub.id}`,
    status: pub.status, cash: 20_000 + i * 2_300, reputation: pub.reputation, trust: pub.trust,
    orders: { ...ownerBusiness.orders, price: pub.price }, days: [], history: [],
  };
}

/** Example businesses sit on the places of the current map (real data/places.json when present). */
function seatBusinesses(ctx: EngineCtx): PublicBusiness[] {
  const used = new Set<string>();
  return fixtureBusinesses.filter((b) => b.id !== 'b01').map((b) => {
    if (ctx.places.some((p) => p.id === b.placeId)) {
      used.add(b.placeId);
      return b;
    }
    const spot = ctx.places.find((p) => !used.has(p.id) && p.suitableFor.includes(b.niche)) ?? ctx.places.find((p) => !used.has(p.id));
    if (spot) used.add(spot.id);
    return { ...b, placeId: spot?.id ?? b.placeId };
  });
}

export function newWorld(config: WorldConfig, ctx: EngineCtx, deps: HostDeps): WorldState {
  const businesses = seatBusinesses(ctx).map(fullBusiness);
  const players: Player[] = businesses.map((b) => ({
    id: b.managerPlayerId, name: fixtureBusinesses.find((p) => p.id === b.id)!.ownerName, kind: 'owner', isAi: b.isAi, paid: !b.isAi,
    joinedDay: 1, lastSeenDay: FIXTURE_DAY, inbox: [],
  }));
  return {
    config, phase: 'running', day: FIXTURE_DAY, version: 1, bank: 230, players, businesses, officials: [officialView.official],
    deals: [], cases: [], blockFunds: [], weather: [fixtureWeather[0], ...deps.forecast(config.seed, FIXTURE_DAY + 1, RULES.FORECAST_DAYS)],
    events: fixtureEvents, feed: fixtureFeed, standings: [],
  };
}

const bump = (w: WorldState, patch: Partial<WorldState>): WorldState => ({ ...w, ...patch, version: w.version + 1 });

export function join(w: WorldState, p: { name: string; kind: 'owner' | 'official'; role?: OfficialRole }): { world: WorldState; playerId: string } {
  const name = p.name.trim();
  if (!name) throw new Error('Enter your name to join.');
  if (dateOf(w.day).month > RULES.JOIN_UNTIL_MONTH) throw new Error('This season is closed for new players.');
  const playerId = `p${w.players.length + 1}-${w.version}`;
  const player: Player = { id: playerId, name, kind: p.kind, isAi: false, paid: p.kind === 'owner', role: p.role, joinedDay: w.day, lastSeenDay: w.day, inbox: [] };
  const bank = p.kind === 'owner' ? w.bank + w.config.entryFee : w.bank;
  return { world: bump(w, { players: [...w.players, player], bank, feed: [{ id: `f-join-${playerId}`, day: w.day, kind: 'system', text: `${name} joined the city as ${p.kind === 'owner' ? 'an owner' : 'a city official'}.` }, ...w.feed] }), playerId };
}

const myBusiness = (w: WorldState, playerId: string) => w.businesses.find((b) => b.managerPlayerId === playerId && b.status !== 'bankrupt');

function kitTotalFromPack(ctx: EngineCtx, b: { niche: BusinessState['niche']; size: number; items: { id: string; qty: number }[] }): number {
  const pack = ctx.packs.niches[b.niche];
  if (!pack) return 0;
  return b.items.reduce((s, it) => {
    const item = pack.setup.find((x) => x.id === it.id);
    if (!item) return s;
    return s + item.cost * (item.scalesWithSize ? b.size : it.qty);
  }, 0);
}

export function act(w: WorldState, ctx: EngineCtx, playerId: string, a: Action): ActionResult {
  const player = w.players.find((p) => p.id === playerId);
  if (!player) return { world: w, error: 'Unknown player. Join the city first.' };
  const touched = { ...w, players: w.players.map((p) => (p.id === playerId ? { ...p, lastSeenDay: w.day } : p)) };
  const mine = myBusiness(w, playerId);
  switch (a.type) {
    case 'open_business': {
      if (mine) return { world: w, error: 'You already run a business in this city.' };
      const pack = ctx.packs.niches[a.niche];
      if (!pack) return { world: w, error: 'This niche is opening soon.' };
      const place = ctx.places.find((p) => p.id === a.placeId);
      if (!place) return { world: w, error: 'Pick a place on the map.' };
      if (w.businesses.some((b) => b.placeId === a.placeId && b.status !== 'bankrupt')) return { world: w, error: 'This place is taken.' };
      const kit = pack.kits.find((k) => k.id === a.kitId);
      const items = a.items ?? kit?.items ?? [];
      const total = kitTotalFromPack(ctx, { niche: a.niche, size: a.size, items });
      const permits = pack.setup.filter((s) => s.waitDays && items.some((it) => it.id === s.id)).map((s) => ({ itemId: s.id, appliedDay: w.day, readyDay: w.day + (s.waitDays ?? 0) }));
      const biz: BusinessState = {
        ...ownerBusiness, id: `b-${playerId}`, name: a.name.trim() || 'My business', niche: a.niche, placeId: a.placeId, isAi: false,
        owners: [{ playerId, share: 1 }], managerPlayerId: playerId, status: 'setup', createdDay: w.day, openedDay: undefined,
        cash: pack.startCapital - total, size: a.size, items, setupSpent: total, permits, quality: 0.6, reputation: 0.5,
        trust: { kept: 0, broken: 0 }, orders: { ...ownerBusiness.orders, price: pack.unit.refPrice }, trails: [], liabilities: [],
        mtd: { lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } }, days: [], history: [],
      };
      return { world: bump(touched, { businesses: [...w.businesses, biz], feed: [{ id: `f-open-${biz.id}`, day: w.day, kind: 'opening', text: `${biz.name} signed a lease at ${place.address}.`, businessId: biz.id }, ...w.feed] }) };
    }
    case 'launch': {
      if (!mine) return { world: w, error: 'Open a business first.' };
      if (mine.status !== 'setup') return { world: w, error: 'Your doors are already open.' };
      const early = mine.permits.some((p) => p.readyDay > w.day);
      const trails = early ? [...mine.trails, { violationId: 'no_fse_permit', months: 0, saved: 0, lastActiveMonth: dateOf(w.day).month, discovered: false }] : mine.trails;
      const opened = { ...mine, status: 'open' as const, openedDay: w.day, trails };
      return { world: bump(touched, { businesses: w.businesses.map((b) => (b.id === mine.id ? opened : b)), feed: [{ id: `f-launch-${mine.id}-${w.day}`, day: w.day, kind: 'opening', text: `${mine.name} opened its doors${early ? ' — before the permits arrived' : ''}.`, businessId: mine.id }, ...w.feed] }) };
    }
    case 'set_orders': {
      if (!mine) return { world: w, error: 'Open a business first.' };
      const next = { ...mine, orders: { ...mine.orders, ...a.orders } };
      return { world: bump(touched, { businesses: w.businesses.map((b) => (b.id === mine.id ? next : b)) }) };
    }
    case 'read_inbox':
      return { world: bump(touched, { players: touched.players.map((p) => (p.id === playerId ? { ...p, inbox: p.inbox.map((i) => (a.ids.includes(i.id) ? { ...i, read: true } : i)) } : p)) }) };
    default:
      return { world: w, error: 'Offline practice does not support this action yet.' };
  }
}

function stubDay(b: BusinessState, w: WorldState): DayReport {
  const weather = w.weather[0];
  const demand = Math.round(240 * (weather?.footTrafficMult ?? 1) * (1 + ((w.day * 13) % 7) / 50));
  const served = Math.min(demand, Math.round(b.size * 11));
  return { day: w.day, demandUnits: demand, servedUnits: served, lost: { size: demand - served, staff: 0, closure: 0 }, revenue: Math.round(served * b.orders.price), variableCosts: Math.round(served * 2.05), sizeUtilization: Math.min(1, served / Math.max(1, b.size * 11)), weather: weather?.condition ?? 'clear', notes: [] };
}

export function step(w: WorldState, ctx: EngineCtx, deps: HostDeps): WorldState {
  if (w.phase !== 'running') return w;
  const nextDay = w.day + 1;
  const forecast = deps.forecast(w.config.seed, nextDay, RULES.FORECAST_DAYS + 1);
  const rentPerDay = (b: BusinessState) => {
    const place = ctx.places.find((p) => p.id === b.placeId);
    return place ? Math.round((place.sqft * place.rentPerSqftYear) / 12 / RULES.DAYS_PER_MONTH) : 250;
  };
  const businesses = w.businesses.map((b) => {
    if (b.status === 'bankrupt') return b;
    if (b.status === 'setup') return { ...b, cash: b.cash - rentPerDay(b) };
    const r = stubDay(b, { ...w, day: nextDay, weather: forecast });
    const cash = b.cash + r.revenue - r.variableCosts - rentPerDay(b) - 520;
    return { ...b, cash, days: [...b.days.slice(-29), r] };
  });
  return { ...w, day: nextDay, version: w.version + 1, weather: forecast, businesses, phase: dateOf(nextDay).month > w.config.seasonMonths ? 'ended' : 'running' };
}

function publicOf(w: WorldState, b: BusinessState, rank: number): PublicBusiness {
  const owner = w.players.find((p) => p.id === b.managerPlayerId);
  return { id: b.id, name: b.name, ownerName: b.isAi ? 'AI' : owner?.name ?? 'Owner', isAi: b.isAi, niche: b.niche, placeId: b.placeId, status: b.status, price: b.orders.price, reputation: b.reputation, rankInNiche: rank, trust: b.trust, partners: [] };
}

function standings(w: WorldState): Standing[] {
  const byNiche = new Map<string, BusinessState[]>();
  for (const b of w.businesses) byNiche.set(b.niche, [...(byNiche.get(b.niche) ?? []), b]);
  const out: Standing[] = [];
  for (const list of byNiche.values()) {
    [...list].sort((a, b) => b.cash - a.cash).forEach((b, i) => out.push({ businessId: b.id, niche: b.niche, rank: i + 1, netWorth: b.cash, isAi: b.isAi, bankrupt: b.status === 'bankrupt' }));
  }
  return out;
}

function worldPublicOf(w: WorldState): WorldPublic {
  const humans = w.players.filter((p) => !p.isAi);
  return {
    config: w.config, phase: w.phase, day: w.day, date: dateOf(w.day), version: w.version, bank: w.bank, msToNextDay: w.config.dayMs,
    stats: { owners: humans.filter((p) => p.kind === 'owner').length + 44, aiBusinesses: w.businesses.filter((b) => b.isAi).length, officials: w.officials.length + 8, open: w.businesses.filter((b) => b.status === 'open').length, bankrupt: w.businesses.filter((b) => b.status === 'bankrupt').length },
  };
}

export function viewFor(w: WorldState, _ctx: EngineCtx, playerId: string | null): ClientView {
  const st = standings(w);
  const rankOf = (id: string) => st.find((s) => s.businessId === id)?.rank ?? 0;
  const pubs = w.businesses.map((b) => publicOf(w, b, rankOf(b.id)));
  const leaderboards: CityView['leaderboards'] = {};
  for (const s of st) (leaderboards[s.niche] ??= []).push(s);
  const base = { world: worldPublicOf(w), weather: w.weather, events: w.events, feed: w.feed.slice(0, 30), leaderboards };
  const me = playerId ? w.players.find((p) => p.id === playerId) : undefined;
  if (!me) return { kind: 'city', businesses: pubs, ...base };
  if (me.kind === 'official') {
    const ov: OfficialView = { ...officialView, me, world: base.world, weather: base.weather, events: base.events, feed: base.feed };
    return ov;
  }
  const business = myBusiness(w, me.id) ?? null;
  const roadmap: RoadmapItem[] = business ? roadmapItems(w, business) : [];
  const ov: OwnerView = {
    kind: 'owner', me, ...base, business, stakes: business ? [{ businessId: business.id, share: 1 }] : [],
    neighbors: pubs.filter((p) => p.id !== business?.id), deals: [], notices: [], blockFund: null,
    analytics: business?.status === 'open' ? fixtureAnalytics : null, recommendations: business?.status === 'open' ? fixtureRecommendations : [],
    roadmap, away: null,
  };
  return ov;
}

function roadmapItems(w: WorldState, b: BusinessState | null): RoadmapItem[] {
  return fixtureRoadmapTodo.map((s) => {
    if (!b) return s;
    const permit = s.setupItemId ? b.permits.find((p) => p.itemId === s.setupItemId) : undefined;
    if (permit) return permit.readyDay > w.day ? { ...s, status: 'waiting', readyDay: permit.readyDay } : { ...s, status: 'done', readyDay: permit.readyDay };
    if (s.kind === 'launch') return { ...s, status: b.status === 'setup' ? 'todo' : 'done' };
    return { ...s, status: 'done' };
  });
}

export function answer(w: WorldState, ctx: EngineCtx, playerId: string, q: Query): unknown {
  switch (q.type) {
    case 'recommend_opening': {
      const pack = ctx.packs.niches[q.niche];
      if (!pack) throw new Error('This niche is opening soon.');
      return fixtureOpenRecommendations.map((r): OpenRecommendation => {
        const total = kitTotalFromPack(ctx, { niche: q.niche, size: r.size, items: r.items });
        return { ...r, total, cashLeft: pack.startCapital - total };
      });
    }
    case 'roadmap':
      return roadmapItems(w, myBusiness(w, playerId) ?? null);
    case 'what_if':
      return { projected: ownerBusiness.history[0], analytics: fixtureAnalytics };
    case 'real_world_plan': {
      const b = myBusiness(w, playerId);
      const plan: RealWorldPlan = {
        niche: b?.niche ?? 'cafe', businessName: b?.name ?? 'My business',
        startupBudget: [{ label: 'Setup and permits', amount: b?.setupSpent ?? 0 }], startupTotal: b?.setupSpent ?? 0,
        monthlyCosts: [{ label: 'Rent', amount: 9_000 }, { label: 'Wages', amount: 11_520 }], monthlyTotal: 20_520,
        reserveAdvised: 61_560, breakEvenUnitsMonth: fixtureAnalytics.breakEvenUnitsMonth, paybackMonths: fixtureAnalytics.paybackMonths,
        checklist: fixtureRoadmapTodo, suppliers: fixturePacks.niches.cafe?.suppliers ?? [], lessons: [],
        disclaimer: 'Practice numbers. Check every figure with the agency before you sign anything.',
      };
      return plan;
    }
    default:
      throw new Error('This question needs the city server.');
  }
}
