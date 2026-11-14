// @ohh-stub — placeholder by agent 01, signatures from build/CONTRACT.md §6. Owner: agent 06 replaces this file.
import type { Action, ActionResult, CityView, ClientView, DayWeather, GameEvent, OfficialRole, Query, WorldConfig, WorldState } from '@ohh/shared';
import { dateOf, RULES } from '@ohh/shared';
import { applyAction, createWorld, tickDay, type EngineCtx } from '@ohh/engine';
import type { BotBrain } from '@ohh/bots';

export interface HostDeps {
  bots: BotBrain;
  forecast(seed: number, fromDay: number, days: number): DayWeather[];
  deckEvent(w: WorldState, ctx: EngineCtx): GameEvent | null;
}

export function newWorld(config: WorldConfig, _ctx: EngineCtx, deps: HostDeps): WorldState {
  const w = createWorld(config);
  return { ...w, weather: deps.forecast(config.seed, w.day, RULES.FORECAST_DAYS + 1) };
}

export function join(w: WorldState, p: { name: string; kind: 'owner' | 'official'; role?: OfficialRole }): { world: WorldState; playerId: string } {
  const playerId = `p${w.players.length + 1}`;
  const player = { id: playerId, name: p.name, kind: p.kind, isAi: false, paid: false, role: p.role, joinedDay: w.day, lastSeenDay: w.day, inbox: [] };
  return { world: { ...w, players: [...w.players, player], version: w.version + 1 }, playerId };
}

export function act(w: WorldState, ctx: EngineCtx, playerId: string, a: Action): ActionResult {
  return applyAction(w, ctx, playerId, a);
}

export function step(w: WorldState, ctx: EngineCtx, deps: HostDeps): WorldState {
  const next = tickDay(w, ctx);
  return { ...next, weather: deps.forecast(w.config.seed, next.day, RULES.FORECAST_DAYS + 1) };
}

export function viewFor(w: WorldState, _ctx: EngineCtx, _playerId: string | null): ClientView {
  const city: CityView = {
    kind: 'city',
    world: {
      config: w.config, phase: w.phase, day: w.day, date: dateOf(w.day), version: w.version, bank: w.bank, msToNextDay: w.config.dayMs,
      stats: { owners: w.players.filter((p) => p.kind === 'owner').length, aiBusinesses: w.businesses.filter((b) => b.isAi).length, officials: w.officials.length, open: w.businesses.filter((b) => b.status === 'open').length, bankrupt: w.businesses.filter((b) => b.status === 'bankrupt').length },
    },
    businesses: [], weather: w.weather, events: w.events, feed: w.feed, leaderboards: {},
  };
  return city;
}

export function answer(_w: WorldState, _ctx: EngineCtx, _playerId: string, q: Query): unknown {
  return { error: `stub host: query '${q.type}' is not implemented yet` };
}
