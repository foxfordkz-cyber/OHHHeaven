// Агент 04 — аналитика, советы, план открытия, личный план. Ничего не меняет в мире.
// Сигнатуры — build/CONTRACT.md, раздел 3.
import type {
  BusinessState, NicheId, OpenRecommendation, Recommendation, RoadmapItem, RealWorldPlan, StandingOrders, WorldState,
} from '../../../shared/src/types';
import type { EngineCtx } from './link';

export type { EngineCtx } from './link';
export { analyze } from './analyze';
export { whatIf } from './whatif';

const todo = (name: string): never => { throw new Error(`analytics.${name}: not implemented yet`); };
export function recommend(_b: BusinessState, _w: WorldState, _ctx: EngineCtx): Recommendation[] { return todo('recommend'); }
export function recommendOpening(_niche: NicheId, _placeId: string, _w: WorldState, _ctx: EngineCtx): OpenRecommendation[] { return todo('recommendOpening'); }
export function roadmapFor(_niche: NicheId, _b: BusinessState | null, _w: WorldState, _ctx: EngineCtx): RoadmapItem[] { return todo('roadmapFor'); }
export function realWorldPlan(_b: BusinessState, _w: WorldState, _ctx: EngineCtx): RealWorldPlan { return todo('realWorldPlan'); }
export function managerOrders(_b: BusinessState, _w: WorldState, _ctx: EngineCtx): Partial<StandingOrders> { return todo('managerOrders'); }
