import { describe, expect, it } from 'vitest';
import { dealPreview, loanScheduleFor } from '../../src/deals';
import { ctx, economyClose, street } from './fixtures';

describe('dealPreview', () => {
  const w = economyClose({ ...street(), day: 30 }, { ana: 3000, kai: 2000, lena: 4000 });

  it('says why a deal is not allowed', () => {
    expect(dealPreview(w, ctx, 'ana', 'kai', { type: 'cross_promo', months: 1 })).toMatchObject({ allowed: false, reason: expect.stringMatching(/different kinds/) });
    expect(dealPreview(w, ctx, 'ana', 'rob', { type: 'cross_promo', months: 1 }).allowed).toBe(false);
  });

  it('estimates joint purchase savings from last month supply costs', () => {
    const p = dealPreview(w, ctx, 'ana', 'kai', { type: 'joint_purchase', months: 2 });
    // Отчёт заглушки: выручка $13 000 и $12 000, себестоимость 30% → $3 900 и $3 600; экономия 6%.
    expect(p).toEqual({ allowed: true, monthlyEffect: { from: 234, to: 216 } });
  });

  it('estimates cross-promo, loan and stake money per month', () => {
    const cross = dealPreview(w, ctx, 'ana', 'lena', { type: 'cross_promo', months: 1 });
    expect(cross.allowed).toBe(true);
    expect(cross.monthlyEffect.from).toBeCloseTo(13_000 * (1.06 * 0.98 - 1) - 3900 * 0.06, 2);
    const loan = dealPreview(w, ctx, 'ana', 'kai', { type: 'loan', amount: 6000, monthlyRatePct: 2, months: 3 });
    const pay = loanScheduleFor(6000, 2, 3, 31)[0].payment;
    expect(loan.monthlyEffect).toEqual({ from: pay, to: -pay });
    const stake = dealPreview(w, ctx, 'ana', 'lena', { type: 'partnership', amount: 5000, sharePct: 20 });
    expect(stake.monthlyEffect).toEqual({ from: 800, to: -800 });
  });
});
