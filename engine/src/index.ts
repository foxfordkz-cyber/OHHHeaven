// @ohh-stub — placeholder by agent 01, signatures from build/CONTRACT.md §3. Owner: agent 02 replaces this file.
import type { Action, ActionResult, BusinessState, Money, PackSet, Place, WorldConfig, WorldState } from '@ohh/shared';

export interface EngineCtx { packs: PackSet; places: Place[] }

export function createWorld(config: WorldConfig): WorldState {
  return {
    config, phase: 'running', day: 1, version: 1, bank: 0,
    players: [], businesses: [], officials: [], deals: [], cases: [], blockFunds: [],
    weather: [], events: [], feed: [], standings: [],
  };
}

export function applyAction(w: WorldState, _ctx: EngineCtx, _playerId: string, a: Action): ActionResult {
  return { world: w, error: `stub engine: '${a.type}' is not implemented yet` };
}

export function tickDay(w: WorldState, _ctx: EngineCtx): WorldState {
  return { ...w, day: w.day + 1, version: w.version + 1 };
}

export function netWorth(b: BusinessState, _ctx: EngineCtx): Money {
  return b.cash;
}
