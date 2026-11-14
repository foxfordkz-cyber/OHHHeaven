// Модуль сделок (агент 13): сделки между игроками, фонд квартала, доли, места и призы.
// Каркас: сигнатуры из build/CONTRACT.md, раздел 3. Реализация — следующими коммитами.
import type { ActionResult, Action, DealTerms, Money, Standing, WorldState } from '../../../shared/src/types';
import type { EngineCtx } from './ctx';

export type { EngineCtx } from './ctx';

export function dealActions(_w: WorldState, _ctx: EngineCtx, _playerId: string, _a: Action): ActionResult | null {
  return null;
}

export function dealModifiers(_w: WorldState, _ctx: EngineCtx, _businessId: string) {
  return { cogsMult: 1, demandMult: 1, priceMult: 1, footTrafficMult: 1 };
}

export function dealsDay(w: WorldState, _ctx: EngineCtx): WorldState {
  return w;
}

export function dealsMonthClose(w: WorldState, _ctx: EngineCtx): WorldState {
  return w;
}

export function computeStandings(_w: WorldState, _ctx: EngineCtx): Standing[] {
  return [];
}

export function finalizeSeason(w: WorldState, _ctx: EngineCtx): WorldState {
  return w;
}

export function dealPreview(_w: WorldState, _ctx: EngineCtx, _from: string, _to: string, _terms: DealTerms): { allowed: boolean; reason?: string; monthlyEffect: { from: Money; to: Money } } {
  return { allowed: false, reason: 'not implemented', monthlyEffect: { from: 0, to: 0 } };
}
