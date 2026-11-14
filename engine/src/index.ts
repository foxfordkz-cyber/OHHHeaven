// Engine entry (agent 02). Assembles the modules in the fixed order of build/CONTRACT.md, section 3.
// Law (03) and deals (13) come from stubs with the same signatures until their modules land:
// then replace the two '__stubs__' imports below and in economy/deps.ts.
import type { Action, ActionResult, BusinessState, Money, PackSet, Place, WorldConfig, WorldState } from '@ohh/shared';
import { isMonthEnd, RULES } from '@ohh/shared';
import { economyActions, economyDay, economyMonthClose, netWorthOf } from './economy/index';
import { lawActions, lawDay, lawMonthClose } from './__stubs__/law';
import { computeStandings, dealActions, dealsDay, dealsMonthClose, finalizeSeason } from './__stubs__/deals';

export interface EngineCtx { packs: PackSet; places: Place[] }

export * from './economy/index';

export function createWorld(config: WorldConfig): WorldState {
  return {
    config, phase: 'running', day: 1, version: 1, bank: 0,
    players: [], businesses: [], officials: [], deals: [], cases: [], blockFunds: [],
    weather: [], events: [], feed: [], standings: [],
  };
}

export function applyAction(w: WorldState, ctx: EngineCtx, playerId: string, a: Action): ActionResult {
  if (w.phase === 'ended') return { world: w, error: 'The season is over' };
  const r = economyActions(w, ctx, playerId, a) ?? lawActions(w, ctx, playerId, a) ?? dealActions(w, ctx, playerId, a);
  if (!r) return { world: w, error: `Unknown action: ${(a as { type?: string }).type ?? '?'}` };
  if (r.error) return { world: w, error: r.error };
  return { world: r.world === w ? w : { ...r.world, version: w.version + 1 } };
}

/** One game day for the whole city. */
export function tickDay(w0: WorldState, ctx: EngineCtx): WorldState {
  if (w0.phase === 'ended') return w0;
  const day = w0.day + 1;
  let w: WorldState = { ...w0, day, weather: w0.weather.filter((d) => d.day >= day) };
  w = dealsDay(w, ctx);
  w = lawDay(w, ctx);
  w = economyDay(w, ctx);
  if (isMonthEnd(day)) {
    w = economyMonthClose(w, ctx);
    w = dealsMonthClose(w, ctx);
    w = lawMonthClose(w, ctx);
    w = bankruptcies(w, day);
    const standings = computeStandings(w, ctx);
    w = { ...w, standings, businesses: w.businesses.map((b) => withRank(b, standings, day)) };
  }
  if (day >= w.config.seasonMonths * RULES.DAYS_PER_MONTH) w = finalizeSeason(w, ctx);
  return { ...w, version: w0.version + 1 };
}

export function netWorth(b: BusinessState, ctx: EngineCtx): Money {
  return netWorthOf(b, ctx);
}

function bankruptcies(w: WorldState, day: number): WorldState {
  const gone = w.businesses.filter((b) => b.status !== 'bankrupt' && b.cash < 0);
  if (gone.length === 0) return w;
  const ids = new Set(gone.map((b) => b.id));
  const feed = gone.map((b, k) => ({ id: `feed-${day}-${w.feed.length + k}`, day, kind: 'bankruptcy' as const, text: `${b.name} went bankrupt: it could not cover the month's bills`, businessId: b.id }));
  const players = w.players.map((p) => {
    const mine = gone.filter((b) => b.owners.some((o) => o.playerId === p.id));
    if (mine.length === 0) return p;
    return { ...p, inbox: [...p.inbox, ...mine.map((b, k) => ({ id: `inbox-${day}-${p.inbox.length + k}`, day, kind: 'money' as const, title: 'Bankrupt', text: `${b.name} ran out of cash at the month close and is closed for good.`, ref: { type: 'business' as const, id: b.id }, read: false }))] };
  });
  return { ...w, players, feed: [...w.feed, ...feed], businesses: w.businesses.map((b) => (ids.has(b.id) ? { ...b, status: 'bankrupt' as const, bankruptDay: day } : b)) };
}

function withRank(b: BusinessState, standings: { businessId: string; rank: number }[], day: number): BusinessState {
  const last = b.history[b.history.length - 1];
  const s = standings.find((x) => x.businessId === b.id);
  if (!last || !s || last.month !== Math.floor((day - 1) / RULES.DAYS_PER_MONTH) + 1) return b;
  return { ...b, history: [...b.history.slice(0, -1), { ...last, rankInNiche: s.rank }] };
}
