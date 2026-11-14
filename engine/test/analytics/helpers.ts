// Общие помощники тестов аналитики: примерные данные из заглушек и прогон дней.
import type { BusinessState, WorldState } from '../../../shared/src/types';
import { makeBusiness, makeWorld, sampleCtx, type BizOpts } from '../../src/analytics/__stubs__/fixtures';
import { tickDay } from '../../src/analytics/link';

export const ctx = sampleCtx();

export function run(w: WorldState, days: number): WorldState {
  let cur = w;
  for (let i = 0; i < days; i++) cur = tickDay(cur, ctx);
  return cur;
}

/** Мир из одного или нескольких бизнесов, прожитый `days` дней; возвращает мир и первый бизнес. */
export function lived(opts: BizOpts[], days: number): { w: WorldState; b: BusinessState } {
  const w = run(makeWorld(opts.map((o) => makeBusiness(o))), days);
  return { w, b: w.businesses.find((x) => x.id === opts[0].id)! };
}

export const r2 = (x: number) => Math.round(x * 100) / 100;
