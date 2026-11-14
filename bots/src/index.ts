// @ohh-stub — placeholder by agent 01, interface from build/CONTRACT.md §7. Owner: agent 07 replaces this file.
import type { Action, NicheId, OfficialRole, WorldState } from '@ohh/shared';
import type { EngineCtx } from '@ohh/engine';

export interface BotBrain {
  populate(w: WorldState, ctx: EngineCtx, seed: number): { name: string; kind: 'owner' | 'official'; role?: OfficialRole; niche?: NicheId; placeId?: string; strategy: string }[];
  ownerActions(w: WorldState, ctx: EngineCtx, playerId: string): Action[];
  officialActions(w: WorldState, ctx: EngineCtx, playerId: string): Action[];
}

export const botBrain: BotBrain = {
  populate: () => [],
  ownerActions: () => [],
  officialActions: () => [],
};
