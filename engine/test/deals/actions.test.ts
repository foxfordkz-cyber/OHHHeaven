import { describe, expect, it } from 'vitest';
import { RULES } from '../../../shared/src/rules';
import { dealActions } from '../../src/deals';
import { act, actErr, advance, biz, ctx, street } from './fixtures';

describe('propose_deal and answer_deal', () => {
  it('creates an offer that lives DEAL_OFFER_DAYS and notifies the other side', () => {
    const w0 = street();
    const w1 = act(w0, 'u-ana', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'joint_purchase', months: 2 } });
    const d = w1.deals[0];
    expect(d).toMatchObject({ fromBusinessId: 'ana', toBusinessId: 'kai', status: 'proposed', proposedDay: 5, expiresDay: 5 + RULES.DEAL_OFFER_DAYS });
    expect(w1.players.find((p) => p.id === 'u-kai')!.inbox.map((i) => i.ref?.id)).toContain(d.id);
    expect(w1.feed.some((f) => f.kind === 'deal' && f.text.includes('offered'))).toBe(true);
    expect(w1.version).toBe(w0.version + 1);
  });

  it('ignores actions that belong to other modules', () => {
    expect(dealActions(street(), ctx, 'u-ana', { type: 'launch' })).toBeNull();
  });

  it('accepting starts the deal next day and tells the proposer', () => {
    let w = act(street(), 'u-ana', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'joint_purchase', months: 2 } });
    w = act(w, 'u-kai', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    expect(w.deals[0]).toMatchObject({ status: 'active', startDay: 6, endDay: 6 + 2 * RULES.DAYS_PER_MONTH });
    expect(w.players.find((p) => p.id === 'u-ana')!.inbox.some((i) => i.title.includes('accepted'))).toBe(true);
    expect(w.feed.some((f) => f.text.includes('started a joint purchase'))).toBe(true);
  });

  it('declining closes the offer', () => {
    let w = act(street(), 'u-ana', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'joint_purchase', months: 1 } });
    w = act(w, 'u-kai', { type: 'answer_deal', dealId: w.deals[0].id, accept: false });
    expect(w.deals[0].status).toBe('declined');
  });

  it('only the receiver can answer', () => {
    const w = act(street(), 'u-ana', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'joint_purchase', months: 1 } });
    expect(actErr(w, 'u-ana', { type: 'answer_deal', dealId: w.deals[0].id, accept: true })).toMatch(/Only the business/);
  });

  it('an unanswered offer expires after DEAL_OFFER_DAYS', () => {
    let w = act(street(), 'u-ana', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'joint_purchase', months: 1 } });
    w = advance(w, RULES.DEAL_OFFER_DAYS);
    expect(w.deals[0].status).toBe('proposed');
    w = advance(w, 1);
    expect(w.deals[0].status).toBe('expired');
    expect(actErr(w, 'u-kai', { type: 'answer_deal', dealId: w.deals[0].id, accept: true })).toMatch(/no longer open/);
    expect(w.players.find((p) => p.id === 'u-ana')!.inbox.some((i) => i.title.includes('expired'))).toBe(true);
  });
});

describe('deal checks', () => {
  it('rejects deals with yourself, bankrupt or unopened businesses', () => {
    const w = street();
    expect(actErr(w, 'u-ana', { type: 'propose_deal', toBusinessId: 'ana', terms: { type: 'cross_promo', months: 1 } })).toMatch(/yourself/);
    const bankrupt = { ...w, businesses: w.businesses.map((b) => (b.id === 'kai' ? { ...b, status: 'bankrupt' as const } : b)) };
    expect(actErr(bankrupt, 'u-ana', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'joint_purchase', months: 1 } })).toMatch(/bankrupt/);
    const setup = { ...w, businesses: w.businesses.map((b) => (b.id === 'kai' ? { ...b, status: 'setup' as const } : b)) };
    expect(actErr(setup, 'u-ana', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'joint_purchase', months: 1 } })).toMatch(/must be open/);
    // Заём бизнесу, который ещё открывается, разрешён: на открытие и нужны деньги.
    expect(act(setup, 'u-ana', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'loan', amount: 1000, monthlyRatePct: 2, months: 3 } }).deals).toHaveLength(1);
  });

  it('joint purchase needs the same niche; cross-promo needs different niches within 400 m', () => {
    const w = street();
    expect(actErr(w, 'u-ana', { type: 'propose_deal', toBusinessId: 'lena', terms: { type: 'joint_purchase', months: 1 } })).toMatch(/same kind/);
    expect(actErr(w, 'u-ana', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'cross_promo', months: 1 } })).toMatch(/different kinds/);
    expect(actErr(w, 'u-ana', { type: 'propose_deal', toBusinessId: 'rob', terms: { type: 'cross_promo', months: 1 } })).toMatch(/400 m/);
    expect(act(w, 'u-ana', { type: 'propose_deal', toBusinessId: 'lena', terms: { type: 'cross_promo', months: 1 } }).deals).toHaveLength(1);
  });

  it('checks loan and stake terms', () => {
    const w = street();
    const loan = (amount: number, monthlyRatePct: number, months = 3) => ({ type: 'propose_deal' as const, toBusinessId: 'kai', terms: { type: 'loan' as const, amount, monthlyRatePct, months } });
    expect(actErr(w, 'u-ana', loan(1000, RULES.LOAN_MAX_RATE_PCT + 0.5))).toMatch(/Interest/);
    expect(actErr(w, 'u-ana', loan(50_000, 2))).toMatch(/does not have/);
    expect(actErr(w, 'u-ana', loan(1000, 2, 0))).toMatch(/Term/);
    const stake = (amount: number, sharePct: number) => ({ type: 'propose_deal' as const, toBusinessId: 'kai', terms: { type: 'partnership' as const, amount, sharePct } });
    expect(actErr(w, 'u-ana', stake(5000, 4))).toMatch(/5 to 49/);
    expect(actErr(w, 'u-ana', stake(5000, 50))).toMatch(/5 to 49/);
    expect(actErr(w, 'u-ana', stake(25_000, 20))).toMatch(/does not have/);
  });

  it('limits active deals to MAX_ACTIVE_DEALS per business', () => {
    let w = street();
    // У Ana четыре активные сделки: закупки с Kai и Sam, кросс-промо с Lena, заём Rob.
    const deals: [string, string, Parameters<typeof act>[2]][] = [
      ['u-ana', 'u-kai', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'joint_purchase', months: 3 } }],
      ['u-ana', 'u-sam', { type: 'propose_deal', toBusinessId: 'sam', terms: { type: 'joint_purchase', months: 3 } }],
      ['u-ana', 'u-lena', { type: 'propose_deal', toBusinessId: 'lena', terms: { type: 'cross_promo', months: 3 } }],
      ['u-ana', 'u-rob', { type: 'propose_deal', toBusinessId: 'rob', terms: { type: 'loan', amount: 1000, monthlyRatePct: 1, months: 3 } }],
    ];
    for (const [from, to, a] of deals) {
      w = act(w, from, a);
      w = act(w, to, { type: 'answer_deal', dealId: w.deals[w.deals.length - 1].id, accept: true });
    }
    expect(w.deals.filter((d) => d.status === 'active')).toHaveLength(RULES.MAX_ACTIVE_DEALS);
    expect(actErr(w, 'u-ana', { type: 'propose_deal', toBusinessId: 'rob', terms: { type: 'partnership', amount: 1000, sharePct: 10 } })).toMatch(/active deals/);
    expect(actErr(w, 'u-rob', { type: 'propose_deal', toBusinessId: 'ana', terms: { type: 'partnership', amount: 1000, sharePct: 10 } })).toMatch(/active deals/);
  });

  it('does not allow two deals of the same kind with the same partner', () => {
    let w = act(street(), 'u-ana', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'joint_purchase', months: 1 } });
    expect(actErr(w, 'u-kai', { type: 'propose_deal', toBusinessId: 'ana', terms: { type: 'joint_purchase', months: 2 } })).toMatch(/already waiting/);
    w = act(w, 'u-kai', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    expect(actErr(w, 'u-kai', { type: 'propose_deal', toBusinessId: 'ana', terms: { type: 'joint_purchase', months: 2 } })).toMatch(/already have/);
  });

  it('re-checks money when the offer is accepted', () => {
    let w = act(street(), 'u-ana', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'loan', amount: 15_000, monthlyRatePct: 2, months: 3 } });
    w = { ...w, businesses: w.businesses.map((b) => (b.id === 'ana' ? { ...b, cash: 10_000 } : b)) };
    expect(actErr(w, 'u-kai', { type: 'answer_deal', dealId: w.deals[0].id, accept: true })).toMatch(/does not have/);
    expect(biz(w, 'kai').cash).toBe(20_000);
  });
});

describe('cancel_deal', () => {
  it('the proposer can withdraw an open offer without a penalty', () => {
    let w = act(street(), 'u-ana', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'joint_purchase', months: 1 } });
    expect(actErr(w, 'u-kai', { type: 'cancel_deal', dealId: w.deals[0].id })).toMatch(/Decline/);
    w = act(w, 'u-ana', { type: 'cancel_deal', dealId: w.deals[0].id });
    expect(w.deals[0].status).toBe('cancelled');
    expect(biz(w, 'ana').trust).toEqual({ kept: 0, broken: 0 });
  });

  it('quitting an active deal early is a broken deal for the quitter', () => {
    let w = act(street(), 'u-ana', { type: 'propose_deal', toBusinessId: 'lena', terms: { type: 'cross_promo', months: 3 } });
    w = act(w, 'u-lena', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    w = act(w, 'u-lena', { type: 'cancel_deal', dealId: w.deals[0].id });
    expect(w.deals[0].status).toBe('cancelled');
    expect(biz(w, 'lena').trust).toEqual({ kept: 0, broken: 1 });
    expect(biz(w, 'ana').trust).toEqual({ kept: 0, broken: 0 });
    expect(w.players.find((p) => p.id === 'u-ana')!.inbox.some((i) => i.title.includes('quit'))).toBe(true);
    expect(w.feed.some((f) => f.text.includes('broke'))).toBe(true);
  });

  it('a stake cannot be cancelled and a lender cannot call a loan', () => {
    let w = act(street(), 'u-ana', { type: 'propose_deal', toBusinessId: 'kai', terms: { type: 'partnership', amount: 5000, sharePct: 20 } });
    w = act(w, 'u-kai', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    expect(actErr(w, 'u-ana', { type: 'cancel_deal', dealId: w.deals[0].id })).toMatch(/stake/);
    w = act(w, 'u-sam', { type: 'propose_deal', toBusinessId: 'rob', terms: { type: 'loan', amount: 3000, monthlyRatePct: 2, months: 3 } });
    w = act(w, 'u-rob', { type: 'answer_deal', dealId: w.deals[1].id, accept: true });
    expect(actErr(w, 'u-sam', { type: 'cancel_deal', dealId: w.deals[1].id })).toMatch(/lender/);
    expect(actErr(w, 'u-kai', { type: 'cancel_deal', dealId: w.deals[1].id })).toMatch(/not your deal/);
  });
});
