import { describe, expect, it } from 'vitest';
import type { RealWorldPlan } from '@ohh/shared/types';
import { PLAN } from '../insights/fixtures';
import sample from './plan.sample.json';
import { aheadOf, nextStep, parseMoney, personalOf, readiness } from './personal';

const real = sample as unknown as RealWorldPlan;

describe('the plan of this player', () => {
  it('reads the personal part the engine sends, and nothing from a plan without one', () => {
    const me = personalOf(real)!;
    expect(me.place?.address).toMatch(/St Marks Pl/);
    expect(me.summary.cashBeforeFirstSale).toBeCloseTo(me.summary.parts.reduce((s, p) => s + p.amount, 0), 1);
    expect(personalOf(PLAN)).toBeNull();
    expect(personalOf({ ...PLAN, extra: { personal: { summary: 'x' } } } as unknown as RealWorldPlan)).toBeNull();
  });

  it('turns savings and months of reserve into a verdict at once', () => {
    const s = { cashBeforeFirstSale: 140000, reserve: 180000, reserveMonths: 6 };   // $30,000 of fixed costs a month
    expect(readiness(s, 100000, 6)).toMatchObject({ verdict: 'short', needed: 320000, gap: -220000, carries: 0 });
    expect(readiness(s, 200000, 6)).toMatchObject({ verdict: 'short', carries: 2 });           // opens, but two months of costs is too thin
    expect(readiness(s, 260000, 6)).toMatchObject({ verdict: 'thin', gap: -60000, carries: 4 });
    expect(readiness(s, 260000, 3)).toMatchObject({ verdict: 'ready', reserve: 90000, needed: 230000, gap: 30000 });
    expect(readiness(s, 500000, 9).carries).toBe(12);
  });

  it('reads money the way people type it', () => {
    expect(['$120,000', '120000', '120k', ' 1.5m ', '85,500.50'].map(parseMoney)).toEqual([120000, 120000, 120000, 1500000, 85501]);
    expect(['', 'lots', '-5', '12e3'].map(parseMoney)).toEqual([null, null, null, null]);
  });

  it('names the next real-life step and what is still ahead', () => {
    const steps = [{ id: 'a', fee: 200, waitDays: 1 }, { id: 'b', fee: 1475, waitDays: 42 }, { id: 'c', waitDays: 20 }];
    expect(nextStep(steps, new Set())?.id).toBe('a');
    expect(nextStep(steps, new Set(['a']))?.id).toBe('b');
    expect(nextStep(steps, new Set(['a', 'b', 'c']))).toBeNull();
    expect(aheadOf(steps, new Set(['a']))).toEqual({ fees: 1475, longestWait: 42, count: 2 });
  });
});
