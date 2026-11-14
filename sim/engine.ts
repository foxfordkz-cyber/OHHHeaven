// Engine adapter for the simulator. Uses the real @ohh/engine + @ohh/host + @ohh/ai when they exist in the
// repository (main branch), otherwise agent 07's stubs. Packs and places: packs/*.json and data/places.json
// when present, otherwise the stub data.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Action, ActionResult, BusinessState, DayWeather, GameEvent, NicheId, OfficialRole, OpenRecommendation, Pack, PackSet, Place, StandingOrders, WorldConfig, WorldState } from '../shared/src/types';
import * as stubEngine from '../bots/src/__stubs__/engine';
import * as stubHost from '../bots/src/__stubs__/host';
import { stubPacks } from '../bots/src/__stubs__/packs';
import { stubPlaces } from '../bots/src/__stubs__/places';

export interface Ctx { packs: PackSet; places: Place[]; tuning?: { routineEveryMonths?: number } }

export interface EngineApi {
  source: 'stub' | 'real';
  createWorld(config: WorldConfig): WorldState;
  applyAction(w: WorldState, ctx: Ctx, playerId: string, a: Action): ActionResult;
  tickDay(w: WorldState, ctx: Ctx): WorldState;
  netWorth(b: BusinessState, ctx: Ctx, w?: WorldState): number;
  recommendOpening(niche: NicheId, placeId: string, w: WorldState, ctx: Ctx): OpenRecommendation[];
  managerOrders(b: BusinessState, w: WorldState, ctx: Ctx): Partial<StandingOrders>;
  join(w: WorldState, p: { name: string; kind: 'owner' | 'official'; role?: OfficialRole; isAi?: boolean; paid?: boolean }): { world: WorldState; playerId: string };
  forecast(seed: number, fromDay: number, days: number): DayWeather[];
  deckEvent(w: WorldState): GameEvent | null;
}

export const stubApi: EngineApi = {
  source: 'stub',
  createWorld: stubEngine.createWorld,
  applyAction: stubEngine.applyAction,
  tickDay: stubEngine.tickDay,
  netWorth: stubEngine.netWorth,
  recommendOpening: stubEngine.recommendOpening,
  managerOrders: stubEngine.managerOrders,
  join: stubHost.join,
  forecast: stubHost.forecast,
  deckEvent: (w) => stubHost.deckEvent(w),
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Real engine if agent 02's engine/src/index.ts is in the repo; otherwise the stub. */
export async function loadEngine(prefer: 'auto' | 'stub' = 'auto'): Promise<EngineApi> {
  const enginePath = join(ROOT, 'engine/src/index.ts');
  if (prefer === 'stub' || !existsSync(enginePath)) return stubApi;
  try {
    const eng = await import(pathToFileURL(enginePath).href);
    const hostPath = join(ROOT, 'host/src/index.ts');
    const host = existsSync(hostPath) ? await import(pathToFileURL(hostPath).href) : null;
    const analyticsPath = join(ROOT, 'engine/src/analytics/index.ts');
    const analytics = existsSync(analyticsPath) ? await import(pathToFileURL(analyticsPath).href) : null;
    const aiPath = join(ROOT, 'ai/src/index.ts');
    const ai = existsSync(aiPath) ? await import(pathToFileURL(aiPath).href) : null;
    return {
      source: 'real',
      createWorld: eng.createWorld,
      applyAction: eng.applyAction,
      tickDay: eng.tickDay,
      netWorth: (b, ctx) => eng.netWorth(b, ctx),
      recommendOpening: analytics?.recommendOpening ?? stubEngine.recommendOpening,
      managerOrders: analytics?.managerOrders ?? stubEngine.managerOrders,
      join: host?.join ?? stubHost.join,
      forecast: ai?.forecast ?? stubHost.forecast,
      deckEvent: ai?.deckEvent ? (w: WorldState) => ai.deckEvent(w, undefined) : (w) => stubHost.deckEvent(w),
    };
  } catch (e) {
    console.error(`[sim] real engine failed to load, using stub: ${(e as Error).message}`);
    return stubApi;
  }
}

/** packs/*.json and data/places.json when they exist, otherwise the stub data. */
export function loadData(): { packs: PackSet; places: Place[]; source: string } {
  const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
  const has = (p: string) => existsSync(join(ROOT, p));
  if (has('packs/_common.json') && has('packs/cafe.json') && has('data/places.json')) {
    const niches: Partial<Record<NicheId, Pack>> = {};
    for (const id of ['cafe', 'barbershop'] as NicheId[]) if (has(`packs/${id}.json`)) niches[id] = read(`packs/${id}.json`);
    return { packs: { common: read('packs/_common.json'), niches }, places: read('data/places.json'), source: 'repo' };
  }
  return { packs: stubPacks, places: stubPlaces, source: 'stub' };
}
