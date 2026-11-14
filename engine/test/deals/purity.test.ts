import { describe, expect, it } from 'vitest';
import { computeStandings, dealActions, dealModifiers, dealPreview, dealsDay, dealsMonthClose, finalizeSeason } from '../../src/deals';
import { act, ctx, deepFreeze, economyClose, street } from './fixtures';

/** Мир со всеми видами сделок посреди месяца. */
function busy() {
  let w = street();
  w = act(w, 'u-ana', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'joint_purchase', months: 2 } });
  w = act(w, 'u-kai', { type: 'answer_deal', dealId: w.deals.at(-1)!.id, accept: true });
  w = act(w, 'u-lena', { type: 'propose_deal', toBusinessId: 'ana', terms: { type: 'cross_promo', months: 2 } });
  w = act(w, 'u-ana', { type: 'answer_deal', dealId: w.deals.at(-1)!.id, accept: true });
  w = act(w, 'u-sam', { type: 'propose_deal', toBusinessId: 'rob', terms: { type: 'loan', amount: 4000, monthlyRatePct: 3, months: 4 } });
  w = act(w, 'u-rob', { type: 'answer_deal', dealId: w.deals.at(-1)!.id, accept: true });
  w = act(w, 'u-kai', { type: 'propose_deal', toBusinessId: 'lena', terms: { type: 'partnership', amount: 3000, sharePct: 10 } });
  w = act(w, 'u-lena', { type: 'answer_deal', dealId: w.deals.at(-1)!.id, accept: true });
  w = act(w, 'u-rob', { type: 'propose_deal', toBusinessId: 'sam', terms: { type: 'cross_promo', months: 1 } });
  return { ...w, day: 30, businesses: w.businesses.map((b) => ({ ...b, orders: { ...b.orders, blockFund: true } })) };
}

describe('purity', () => {
  it('no function mutates its input', () => {
    const w = deepFreeze(economyClose(busy(), { lena: 5000 }));
    expect(() => {
      dealsDay(w, ctx);
      dealsMonthClose(w, ctx);
      computeStandings(w, ctx);
      finalizeSeason(w, ctx);
      dealModifiers(w, ctx, 'ana');
      dealPreview(w, ctx, 'ana', 'lena', { type: 'cross_promo', months: 1 });
      dealActions(w, ctx, 'u-sam', { type: 'answer_deal', dealId: w.deals.at(-1)!.id, accept: true });
      dealActions(w, ctx, 'u-ana', { type: 'cancel_deal', dealId: w.deals[0].id });
    }).not.toThrow();
  });

  it('the same input gives the same output', () => {
    const run = () => {
      let w = economyClose(busy(), { lena: 5000, rob: -100 });
      w = dealsMonthClose(w, ctx);
      w = dealsDay({ ...w, day: 31 }, ctx);
      return JSON.stringify({ w, st: computeStandings(w, ctx), end: finalizeSeason({ ...w, day: 360, bank: 25 }, ctx) });
    };
    expect(run()).toBe(run());
  });

  it('a month close keeps every month report balanced: lines sum to the change in cash', () => {
    const w = dealsMonthClose(economyClose(busy(), { lena: 5000, kai: 1200 }), ctx);
    for (const b of w.businesses) {
      const r = b.history.at(-1)!;
      const sum = r.lines.reduce((s, l) => s + l.amount, 0);
      expect(Math.round((r.cashStart + sum) * 100) / 100).toBe(r.cashEnd);
      expect(r.cashEnd).toBe(b.cash);
    }
  });
});
