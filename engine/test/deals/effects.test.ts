import { describe, expect, it } from 'vitest';
import { RULES } from '../../../shared/src/rules';
import { dealModifiers } from '../../src/deals';
import { act, advance, biz, ctx, street } from './fixtures';

const DPM = RULES.DAYS_PER_MONTH;

describe('joint purchase', () => {
  it('cuts supply costs for both while active, then completes with a kept deal each', () => {
    let w = act(street(), 'u-ana', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'joint_purchase', months: 1 } });
    w = act(w, 'u-kai', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    expect(dealModifiers(w, ctx, 'ana').cogsMult).toBe(1);                       // день 5: ещё не началась
    w = advance(w, 1);                                                           // день 6
    expect(dealModifiers(w, ctx, 'ana').cogsMult).toBe(RULES.JOINT_PURCHASE_COGS_MULT);
    expect(dealModifiers(w, ctx, 'kai').cogsMult).toBe(RULES.JOINT_PURCHASE_COGS_MULT);
    expect(dealModifiers(w, ctx, 'lena').cogsMult).toBe(1);
    w = advance(w, DPM - 1);                                                     // день 35 — последний день действия
    expect(w.deals[0].status).toBe('active');
    expect(dealModifiers(w, ctx, 'ana').cogsMult).toBe(RULES.JOINT_PURCHASE_COGS_MULT);
    w = advance(w, 1);                                                           // день 36
    expect(w.deals[0].status).toBe('completed');
    expect(dealModifiers(w, ctx, 'ana').cogsMult).toBe(1);
    expect(biz(w, 'ana').trust).toEqual({ kept: 1, broken: 0 });
    expect(biz(w, 'kai').trust).toEqual({ kept: 1, broken: 0 });
  });
});

describe('cross-promo', () => {
  it('raises demand and trims the price for both neighbors', () => {
    let w = act(street(), 'u-lena', { type: 'propose_deal', toBusinessId: 'ana', terms: { type: 'cross_promo', months: 2 } });
    w = act(w, 'u-ana', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    w = advance(w, 1);
    for (const id of ['ana', 'lena']) {
      expect(dealModifiers(w, ctx, id)).toEqual({ cogsMult: 1, demandMult: RULES.CROSS_PROMO_DEMAND_MULT, priceMult: RULES.CROSS_PROMO_PRICE_MULT, footTrafficMult: 1 });
    }
    w = advance(w, 2 * DPM);
    expect(w.deals[0].status).toBe('completed');
    expect(dealModifiers(w, ctx, 'ana').demandMult).toBe(1);
    expect(biz(w, 'lena').trust.kept).toBe(1);
  });

  it('two deals of the same kind do not stack', () => {
    let w = act(street(), 'u-ana', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'joint_purchase', months: 2 } });
    w = act(w, 'u-kai', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    w = act(w, 'u-ana', { type: 'propose_deal', toBusinessId: 'sam', terms: { type: 'joint_purchase', months: 2 } });
    w = act(w, 'u-sam', { type: 'answer_deal', dealId: w.deals[1].id, accept: true });
    w = advance(w, 1);
    expect(dealModifiers(w, ctx, 'ana').cogsMult).toBe(RULES.JOINT_PURCHASE_COGS_MULT);
  });

  it('a deal of a bankrupt partner ends without touching the survivor', () => {
    let w = act(street(), 'u-lena', { type: 'propose_deal', toBusinessId: 'ana', terms: { type: 'cross_promo', months: 3 } });
    w = act(w, 'u-ana', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    w = { ...w, businesses: w.businesses.map((b) => (b.id === 'lena' ? { ...b, status: 'bankrupt' as const, bankruptDay: 5 } : b)) };
    w = advance(w, 1);
    expect(w.deals[0].status).toBe('cancelled');
    expect(biz(w, 'ana').trust).toEqual({ kept: 0, broken: 0 });
    expect(dealModifiers(w, ctx, 'ana').demandMult).toBe(1);
  });
});
