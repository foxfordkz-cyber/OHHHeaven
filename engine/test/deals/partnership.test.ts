import { describe, expect, it } from 'vitest';
import { act, actErr, advance, biz, street } from './fixtures';

const invest = (to: string, amount: number, sharePct: number) =>
  ({ type: 'propose_deal' as const, toBusinessId: to, terms: { type: 'partnership' as const, amount, sharePct } });

describe('partnership (stake)', () => {
  it('moves the money into the business and adds the investor to the owners', () => {
    let w = act(street(), 'u-ana', invest('lena', 5000, 20));
    w = act(w, 'u-lena', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    expect(biz(w, 'ana').cash).toBe(15_000);
    expect(biz(w, 'lena').cash).toBe(25_000);
    expect(biz(w, 'lena').owners).toEqual([{ playerId: 'u-lena', share: 0.8 }, { playerId: 'u-ana', share: 0.2 }]);
  });

  it('pays the investor their share of positive monthly profit only', () => {
    let w = act(street(), 'u-ana', invest('lena', 5000, 20));
    w = act(w, 'u-lena', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    w = advance(w, 25, (m): Record<string, number> => (m === 1 ? { lena: 4000 } : {}));
    expect(biz(w, 'ana').cash).toBe(15_800);                                // 20% от 4 000
    expect(biz(w, 'lena').cash).toBe(25_000 + 4000 - 800);
    const r = biz(w, 'lena').history.at(-1)!;
    expect(r.lines.at(-1)).toMatchObject({ kind: 'deal', amount: -800 });
    expect(r.cashEnd).toBe(biz(w, 'lena').cash);
    w = advance(w, 30, () => ({ lena: -1000 }));                            // убыток — делить нечего
    expect(biz(w, 'ana').cash).toBe(15_800);
    expect(w.players.find((p) => p.id === 'u-ana')!.inbox.some((i) => i.title.includes('profit share'))).toBe(true);
  });

  it('outside partners together cannot own more than 49%', () => {
    let w = act(street(), 'u-ana', invest('lena', 4000, 30));
    w = act(w, 'u-lena', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    expect(actErr(w, 'u-kai', invest('lena', 4000, 20))).toMatch(/at most 49%/);
    w = act(w, 'u-kai', invest('lena', 4000, 19));
    w = act(w, 'u-lena', { type: 'answer_deal', dealId: w.deals[1].id, accept: true });
    const owners = biz(w, 'lena').owners;
    expect(owners.reduce((s, o) => s + o.share, 0)).toBeCloseTo(1, 9);
    expect(owners.find((o) => o.playerId === 'u-lena')!.share).toBeCloseTo(0.567, 6);
  });

  it('a stake in a business that went bankrupt is lost without a trust penalty', () => {
    let w = act(street(), 'u-ana', invest('lena', 5000, 20));
    w = act(w, 'u-lena', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    w = { ...w, businesses: w.businesses.map((b) => (b.id === 'lena' ? { ...b, status: 'bankrupt' as const, bankruptDay: 5 } : b)) };
    w = advance(w, 1);
    expect(w.deals[0].status).toBe('broken');
    expect(biz(w, 'lena').trust.broken).toBe(0);
  });
});
