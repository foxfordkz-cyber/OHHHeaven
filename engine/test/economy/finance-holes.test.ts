// Three money holes found by the logic audit of 14 November 2026 (build/ROUND3.md, holes 3, 4 and 5).
import { describe, expect, it } from 'vitest';
import type { Action, BusinessState, MonthReport, WorldState } from '@ohh/shared';
import { applyAction, tickDay } from '../../src/index';
import { netWorthOf } from '../../src/economy/networth';
import { act, cafeCity, run } from '../fixtures/world';

const month = (b: BusinessState, n: number): MonthReport => b.history.find((m) => m.month === n)!;
const leverCost = (m: MonthReport): number => -m.lines.filter((l) => l.id.startsWith('lever_')).reduce((a, l) => a + l.amount, 0);
const sumLines = (m: MonthReport): number => Math.round(m.lines.reduce((a, l) => a + l.amount, 0) * 100) / 100;

describe('paid lever options are charged for the days they were on', () => {
  const paid = { levers: { cleaning: 'deep', beans: 'specialty', hours: 'extended' } };       // 600 + 600 + 700 a month
  const free = { levers: { cleaning: 'standard', beans: 'house', hours: 'standard' } };       // 200 + 0 + 0 a month

  it('switching to the cheap options for the closing day saves one day, not the month', () => {
    let { w, ctx } = cafeCity(2);
    w = act(w, ctx, 'pl1', { type: 'set_orders', orders: paid });
    w = act(w, ctx, 'pl2', { type: 'set_orders', orders: paid });
    while (w.day < 120) {
      w = tickDay(w, ctx);
      if (w.day % 30 === 29) w = act(w, ctx, 'pl2', { type: 'set_orders', orders: free });   // the closing day runs on the cheap options
      if (w.day % 30 === 0) w = act(w, ctx, 'pl2', { type: 'set_orders', orders: paid });    // and the next month starts on the paid ones again
    }
    const [honest, dodger] = w.businesses;
    for (const n of [3, 4]) {
      expect(leverCost(month(honest, n))).toBeCloseTo(1900, 2);
      expect(leverCost(month(dodger, n))).toBeCloseTo((29 / 30) * 1900 + (1 / 30) * 200, 1);   // each line is rounded to cents
      expect(sumLines(month(dodger, n))).toBeCloseTo(month(dodger, n).cashEnd - month(dodger, n).cashStart, 2);
    }
  });

  it('an option kept all month costs exactly its monthly price', () => {
    let { w, ctx } = cafeCity(1);
    w = act(w, ctx, 'pl1', { type: 'set_orders', orders: paid });
    w = run(w, ctx, 90 - w.day);
    const line = month(w.businesses[0], 3).lines.find((l) => l.id === 'lever_beans')!;
    expect(line.amount).toBeCloseTo(-600, 2);
    expect(line.label).toBe('Beans: Specialty roaster');
  });
});

describe('a loan moves cash and is not profit', () => {
  it('profit and accrued taxes of the month are the same with and without a loan taken that month', () => {
    const base = cafeCity(2);
    const ctx = base.ctx;
    let plain = run(base.w, ctx, 40 - base.w.day);
    let withLoan: WorldState = plain;
    withLoan = act(withLoan, ctx, 'pl1', { type: 'propose_deal', toBusinessId: withLoan.businesses[1].id, terms: { type: 'loan', amount: 30000, monthlyRatePct: 0, months: 6 } });
    withLoan = act(withLoan, ctx, 'pl2', { type: 'answer_deal', dealId: withLoan.deals[0].id, accept: true });
    expect(withLoan.businesses[1].cash - plain.businesses[1].cash).toBeCloseTo(30000, 2);
    plain = run(plain, ctx, 60 - plain.day);
    withLoan = run(withLoan, ctx, 60 - withLoan.day);
    for (const i of [0, 1]) {
      const a = month(plain.businesses[i], 2);
      const b = month(withLoan.businesses[i], 2);
      expect(b.profit).toBeCloseTo(a.profit, 2);
      expect(b.taxesAccrued).toBeCloseTo(a.taxesAccrued, 2);
      expect(sumLines(b)).toBeCloseTo(b.cashEnd - b.cashStart, 2);   // the loan still shows in the lines: they add up to the change of cash
    }
    expect(month(withLoan.businesses[1], 2).lines.some((l) => /:loan_in$/.test(l.id))).toBe(true);
  });
});

describe('capital belongs to the owner', () => {
  const bankrupt = (w: WorldState, cash: number): WorldState => ({
    ...w,
    businesses: w.businesses.map((b) => ({ ...b, status: 'bankrupt' as const, bankruptDay: w.day, cash, liabilities: [] })),
  });
  const reopen: Action = { type: 'open_business', niche: 'cafe', placeId: 'p1', name: 'Second try', kitId: 'standard', size: 18 };

  it('after a bankruptcy the owner cannot open again on a fresh starting capital', () => {
    const { w, ctx } = cafeCity(1);
    const broke = bankrupt(run(w, ctx, 5), 1200);
    const r = applyAction(broke, ctx, 'pl1', reopen);
    expect(r.error).toMatch(/Not enough money/);
    expect(r.error).toMatch(/left after Cafe 1 went bankrupt/);
    expect(r.world.businesses).toHaveLength(1);
  });

  it('a second business starts from what the bankrupt one was still worth', () => {
    const { w, ctx } = cafeCity(1);
    const broke = bankrupt(run(w, ctx, 5), 400_000);
    const left = netWorthOf(broke.businesses[0], ctx);
    const after = act(broke, ctx, 'pl1', reopen);
    const second = after.businesses[1] as BusinessState & { extra: { econ: { cashStart: number } } };
    expect(second.extra.econ.cashStart).toBeCloseTo(left, 2);
    expect(second.cash).toBeLessThan(left);
    expect(left).not.toBeCloseTo(ctx.packs.niches.cafe!.startCapital, 0);
  });
});
