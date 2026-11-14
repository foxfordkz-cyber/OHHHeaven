import { describe, expect, it } from 'vitest';
import type { WorldState } from '../../../shared/src/types';
import { runDays } from '../../src/law/__stubs__/economy';
import { deepFreeze, lawCtx, lawWorld, orders } from '../fixtures/law-world';
import { act, biz } from './helpers';

const fines = (w: WorldState, id: string) => biz(w, id).history.flatMap((m) => m.lines).filter((l) => l.kind === 'fine').reduce((s, l) => s - l.amount, 0);

/** Дойти до дня, когда дело закрыто (не больше 20 дней). */
function untilClosed(w: WorldState, caseId: string): WorldState {
  let world = w;
  for (let i = 0; i < 20 && world.cases.find((c) => c.id === caseId)?.status !== 'closed'; i++) world = runDays(world, lawCtx, 1);
  return world;
}

describe('a year in the city (economy stub)', () => {
  it('an honest business pays zero fines over a year, even with routine inspections', () => {
    const year = runDays(lawWorld({ day: 0 }), lawCtx, 360);
    expect(year.day).toBe(360);
    for (const id of ['luna', 'rival', 'honest']) {
      expect(fines(year, id)).toBe(0);
      expect(biz(year, id).history).toHaveLength(12);
      expect(biz(year, id).trails).toEqual([]);
    }
    expect(year.cases.filter((c) => c.outcome === 'fined')).toEqual([]);
    expect(year.cases.filter((c) => c.origin === 'routine').map((c) => c.outcome)).toEqual(['clean', 'clean', 'clean']);
  });

  it('six months of cash wages, then a report and an audit: the fine is bigger than the savings', () => {
    let w = runDays(lawWorld({ day: 0, luna: { orders: orders({ shortcuts: ['cash_wages'] }) } }), lawCtx, 180);
    const trail = biz(w, 'luna').trails.find((t) => t.violationId === 'off_books_payroll');
    expect(trail).toMatchObject({ months: 6, saved: 6 * 1176, lastActiveMonth: 6 });
    w = act(runDays(w, lawCtx, 1), 'pl_rival', { type: 'report', targetBusinessId: 'luna', reportId: 'report_cash_payroll' });
    const caseId = w.cases.at(-1)!.id;
    w = untilClosed(w, caseId);
    const c = w.cases.find((x) => x.id === caseId)!;
    expect(c).toMatchObject({ outcome: 'fined', response: 'pay', officialId: 'of_ai_aud' });
    expect(c.fine).toBe(500 + 1.5 * 6 * 1176);
    expect(c.fine!).toBeGreaterThan(trail!.saved);
    expect(w.feed.map((f) => f.text)).toContain(`Tax auditor fined Luna Cafe $${c.fine!.toLocaleString('en-US')}`);
  });

  it('the same world gives the same year, and the start world is never mutated', () => {
    const start = deepFreeze(lawWorld({ day: 0, luna: { orders: orders({ shortcuts: ['cash_wages', 'skip_pest_control'], levers: { cleaning: 'minimal' } }) } }));
    const snapshot = JSON.stringify(start);
    const a = runDays(start, lawCtx, 240);
    const b = runDays(start, lawCtx, 240);
    expect(a).toEqual(b);
    expect(JSON.stringify(start)).toBe(snapshot);
    expect(a.cases.length).toBeGreaterThan(0);
  });
});
