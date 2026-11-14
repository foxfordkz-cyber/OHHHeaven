import type { Action, Case, WorldState } from '../../../shared/src/types';
import { lawActions } from '../../src/law/index';
import { lawDay } from '../../src/law/day';
import { lawCtx } from '../fixtures/law-world';

/** Действие закона; падает, если вернулась ошибка или null. */
export function act(w: WorldState, playerId: string, a: Action): WorldState {
  const r = lawActions(w, lawCtx, playerId, a);
  if (!r) throw new Error(`law ignored ${a.type}`);
  if (r.error) throw new Error(r.error);
  return r.world;
}

export function actError(w: WorldState, playerId: string, a: Action): string | undefined {
  return lawActions(w, lawCtx, playerId, a)?.error;
}

/** n игровых дней только с lawDay (без закрытия месяца). */
export function days(w: WorldState, n: number): WorldState {
  let world = w;
  for (let i = 0; i < n; i++) world = lawDay({ ...world, day: world.day + 1 }, lawCtx);
  return world;
}

export const caseOf = (w: WorldState, id = 'case-1'): Case => {
  const c = w.cases.find((x) => x.id === id);
  if (!c) throw new Error(`no ${id}`);
  return c;
};

export const biz = (w: WorldState, id: string) => {
  const b = w.businesses.find((x) => x.id === id);
  if (!b) throw new Error(`no ${id}`);
  return b;
};

export const official = (w: WorldState, id: string) => {
  const o = w.officials.find((x) => x.id === id);
  if (!o) throw new Error(`no ${id}`);
  return o;
};

export const inboxOf = (w: WorldState, playerId: string) => w.players.find((p) => p.id === playerId)?.inbox ?? [];
