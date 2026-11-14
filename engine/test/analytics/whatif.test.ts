import { describe, expect, it } from 'vitest';
import { whatIf } from '../../src/analytics';
import { sampleWorld } from '../../src/analytics/__stubs__/fixtures';
import { ctx, run } from './helpers';

describe('whatIf', () => {
  const w = run(sampleWorld(), 20);

  it('runs 30 days on a copy and leaves the world untouched', () => {
    const before = JSON.stringify(w);
    const r = whatIf(w, ctx, 'b_me', { price: 8 });
    expect(JSON.stringify(w)).toBe(before);
    expect(r.projected.servedUnits).toBeGreaterThan(0);
    expect(r.analytics.daysIntoMonth).toBe(30);
  });

  it('is deterministic', () => {
    const a = whatIf(w, ctx, 'b_me', { price: 6.75 });
    const b = whatIf(structuredClone(w), ctx, 'b_me', { price: 6.75 });
    expect(b.projected).toEqual(a.projected);
  });

  it('a higher price sells fewer units; more staff costs more', () => {
    const lo = whatIf(w, ctx, 'b_me', { price: 6 });
    const hi = whatIf(w, ctx, 'b_me', { price: 9 });
    expect(hi.projected.servedUnits).toBeLessThan(lo.projected.servedUnits);
    const more = whatIf(w, ctx, 'b_me', { staff: { barista: 6 } });
    expect(more.analytics.fixedCostsMonth).toBeGreaterThan(lo.analytics.fixedCostsMonth);
  });

  it('runs with the law switched off: a pending notice brings no fine', () => {
    const withNotice = { ...w, cases: [{ id: 'c1', businessId: 'b_me', role: 'inspector' as const, origin: 'report' as const, openedDay: 18, hints: [], status: 'notice' as const, fine: 2000, found: [], answerByDay: 21 }] };
    expect(whatIf(withNotice, ctx, 'b_me', {}).projected.fines).toBe(0);
  });

  it('projected profit equals the sum of its lines', () => {
    const r = whatIf(w, ctx, 'b_me', {});
    const sum = r.projected.lines.reduce((s, l) => s + l.amount, 0);
    expect(r.projected.profit).toBeCloseTo(sum, 0);
  });
});
