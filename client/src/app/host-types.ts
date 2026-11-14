// Host-side signatures from build/CONTRACT.md, sections 3, 6 and 7. They are not in shared/src/types.ts,
// so the client keeps a copy here to talk to @ohh/host in the browser ("Practice offline").
import type {
  Action, ActionResult, ClientView, DayWeather, GameEvent, NicheId, OfficialRole, PackSet, Place, Query, WorldConfig, WorldState,
} from '@shared/types';

export interface EngineCtx { packs: PackSet; places: Place[] }

export interface BotBrain {
  populate(w: WorldState, ctx: EngineCtx, seed: number): { name: string; kind: 'owner' | 'official'; role?: OfficialRole; niche?: NicheId; placeId?: string; strategy: string }[];
  ownerActions(w: WorldState, ctx: EngineCtx, playerId: string): Action[];
  officialActions(w: WorldState, ctx: EngineCtx, playerId: string): Action[];
}

export interface HostDeps {
  bots: BotBrain;
  forecast(seed: number, fromDay: number, days: number): DayWeather[];
  deckEvent(w: WorldState, ctx: EngineCtx): GameEvent | null;
}

/** The six host functions the browser needs (build/CONTRACT.md, section 6). */
export interface HostModule {
  newWorld(config: WorldConfig, ctx: EngineCtx, deps: HostDeps): WorldState;
  join(w: WorldState, p: { name: string; kind: 'owner' | 'official'; role?: OfficialRole }): { world: WorldState; playerId: string };
  act(w: WorldState, ctx: EngineCtx, playerId: string, a: Action): ActionResult;
  step(w: WorldState, ctx: EngineCtx, deps: HostDeps): WorldState;
  viewFor(w: WorldState, ctx: EngineCtx, playerId: string | null): ClientView;
  answer(w: WorldState, ctx: EngineCtx, playerId: string, q: Query): unknown;
}
