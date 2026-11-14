// Модуль закона (агент 03): нарушения, жалобы, дела госслужащих, взятки.
// Контракт: build/CONTRACT.md, разделы 3 и 5. Чистые функции: без Date, Math.random, сети и файлов.
import type { Action, ActionResult, BusinessState, Money, PnlLine, ViolationTrail, WorldState } from '../../../shared/src/types';
import type { EngineCtx } from './ctx';

export type { EngineCtx } from './ctx';

export function lawActions(w: WorldState, _ctx: EngineCtx, _playerId: string, a: Action): ActionResult | null {
  void w; void a;
  return null;
}

export function lawDay(w: WorldState, _ctx: EngineCtx): WorldState {
  return w;
}

export function lawMonthClose(w: WorldState, _ctx: EngineCtx): WorldState {
  return w;
}

export function shortcutSavings(
  b: BusinessState,
  _ctx: EngineCtx,
  _base: { payroll: Money; revenue: Money; rent: Money; staffCount: number },
  _month: number,
): { lines: PnlLine[]; trails: ViolationTrail[] } {
  return { lines: [], trails: b.trails };
}
