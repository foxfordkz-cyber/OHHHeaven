// Агент 04 — аналитика, советы, план открытия, личный план. Ничего не меняет в мире.
// Каркас: сигнатуры из build/CONTRACT.md, раздел 3. Реализация — следующими коммитами.
import type {
  Analytics, BusinessState, MonthReport, NicheId, OpenRecommendation, Recommendation,
  RoadmapItem, RealWorldPlan, StandingOrders, WorldState, PackSet, Place,
} from '../../../shared/src/types';

export interface EngineCtx { packs: PackSet; places: Place[] }

const todo = (name: string): never => { throw new Error(`analytics.${name}: not implemented yet`); };

export function analyze(_b: BusinessState, _w: WorldState, _ctx: EngineCtx): Analytics { return todo('analyze'); }
export function recommend(_b: BusinessState, _w: WorldState, _ctx: EngineCtx): Recommendation[] { return todo('recommend'); }
export function recommendOpening(_niche: NicheId, _placeId: string, _w: WorldState, _ctx: EngineCtx): OpenRecommendation[] { return todo('recommendOpening'); }
export function whatIf(_w: WorldState, _ctx: EngineCtx, _businessId: string, _orders: Partial<StandingOrders>): { projected: MonthReport; analytics: Analytics } { return todo('whatIf'); }
export function roadmapFor(_niche: NicheId, _b: BusinessState | null, _w: WorldState, _ctx: EngineCtx): RoadmapItem[] { return todo('roadmapFor'); }
export function realWorldPlan(_b: BusinessState, _w: WorldState, _ctx: EngineCtx): RealWorldPlan { return todo('realWorldPlan'); }
export function managerOrders(_b: BusinessState, _w: WorldState, _ctx: EngineCtx): Partial<StandingOrders> { return todo('managerOrders'); }
