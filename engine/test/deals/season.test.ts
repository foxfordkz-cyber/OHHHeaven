import { describe, expect, it } from 'vitest';
import type { BusinessState, Payout, WorldState } from '../../../shared/src/types';
import { computeStandings, finalizeSeason, splitCents } from '../../src/deals';
import { act, biz, ctx, makeBusiness, makeOfficial, makePlayer, makeWorld } from './fixtures';

const cents = (ps: Payout[]) => ps.reduce((s, p) => s + Math.round(p.amount * 100), 0);
const paid = (ps: Payout[], playerId: string) => Math.round(ps.filter((p) => p.playerId === playerId).reduce((s, p) => s + p.amount, 0) * 100) / 100;

/**
 * Три ниши. Кафе: 4 человека (один банкрот) и ИИ на первом месте. Барбершоп: 2 человека. Магазин у дома: 1 человек.
 * Банк — $5 × 7 оплативших владельцев = $35.
 */
function season(): WorldState {
  const cash = (x: number): Partial<BusinessState> => ({ cash: x });
  const businesses = [
    makeBusiness('c-ai', 'cafe', 'p-a1', 'u-ai1', { ...cash(90_000), isAi: true }),
    makeBusiness('c1', 'cafe', 'p-a2', 'u-c1', cash(60_000)),
    makeBusiness('c2', 'cafe', 'p-a3', 'u-c2', cash(50_000)),
    makeBusiness('c3', 'cafe', 'p-a4', 'u-c3', cash(40_000)),
    makeBusiness('c4', 'cafe', 'p-a5', 'u-c4', { ...cash(-3_000), status: 'bankrupt', bankruptDay: 200 }),
    makeBusiness('b1', 'barbershop', 'p-s1', 'u-b1', cash(30_000)),
    makeBusiness('b2', 'barbershop', 'p-s2', 'u-b2', cash(35_000)),
    makeBusiness('g1', 'bodega', 'p-s3', 'u-g1', cash(10_000)),
  ];
  const players = [
    makePlayer('u-ai1', { isAi: true, paid: false }),
    ...['u-c1', 'u-c2', 'u-c3', 'u-c4', 'u-b1', 'u-b2', 'u-g1'].map((id) => makePlayer(id)),
    makePlayer('u-off1', { kind: 'official' }), makePlayer('u-off2', { kind: 'official' }), makePlayer('u-off3', { kind: 'official' }),
  ];
  const officials = [
    makeOfficial('o1', 'u-off1', 30), makeOfficial('o2', 'u-off2', 10),
    makeOfficial('o3', 'u-off3', 50, { exposed: true }), makeOfficial('o4', 'u-aiof', 80, { isAi: true }),
  ];
  return makeWorld(businesses, players, { day: 360, bank: 35, officials });
}

describe('computeStandings', () => {
  it('ranks by net worth inside each niche, bankrupts at the bottom by bankruptcy day', () => {
    const w = season();
    const extra = makeBusiness('c5', 'cafe', 'p-a5', 'u-c5', { cash: 1000, status: 'bankrupt', bankruptDay: 100 });
    const st = computeStandings({ ...w, businesses: [...w.businesses, extra] }, ctx);
    expect(st.filter((s) => s.niche === 'cafe').map((s) => [s.businessId, s.rank])).toEqual([
      ['c-ai', 1], ['c1', 2], ['c2', 3], ['c3', 4], ['c4', 5], ['c5', 6],
    ]);
    expect(st.filter((s) => s.niche === 'barbershop').map((s) => s.businessId)).toEqual(['b2', 'b1']);
    expect(st.find((s) => s.businessId === 'c-ai')!.isAi).toBe(true);
  });

  it('counts half the value of furniture and equipment and subtracts unpaid taxes', () => {
    const w = season();
    const rich = makeBusiness('c9', 'cafe', 'p-a1', 'u-c9', {
      cash: 1000, items: [{ id: 'espresso', qty: 1 }, { id: 'tables', qty: 10 }, { id: 'permit', qty: 1 }],
      liabilities: [{ taxId: 'sales', amount: 400, dueDay: 400, paid: false }, { taxId: 'old', amount: 999, dueDay: 10, paid: true }],
    });
    const st = computeStandings({ ...w, businesses: [rich] }, ctx);
    expect(st[0].netWorth).toBe(1000 + 0.5 * (8000 + 3000) - 400);
  });
});

describe('finalizeSeason', () => {
  it('splits the bank by niche, pays the top three humans, skips AI and bankrupts, sums to the bank', () => {
    const w = finalizeSeason(season(), ctx);
    const ps = w.payouts!;
    expect(w.phase).toBe('ended');
    expect(cents(ps)).toBe(3500);
    // Призовой банк $31.50: кафе 4/7, барбершоп 2/7, магазин 1/7.
    // Кафе $18.00: c1 50%, c2 30%, c3 20% (ИИ первое место не берёт, банкрот c4 — тоже).
    expect(paid(ps, 'u-c1')).toBe(9);
    expect(paid(ps, 'u-c2')).toBe(5.4);
    expect(paid(ps, 'u-c3')).toBe(3.6);
    expect(paid(ps, 'u-c4')).toBe(0);
    expect(paid(ps, 'u-ai1')).toBe(0);
    // Барбершоп $9.00 на двоих: 50 и 30 → 62,5% и 37,5%.
    expect(paid(ps, 'u-b2')).toBe(5.63);
    expect(paid(ps, 'u-b1')).toBe(3.37);
    // Магазин $4.50 — единственному человеку целиком.
    expect(paid(ps, 'u-g1')).toBe(4.5);
    // Госслужащие $1.75 по очкам 30:10; разоблачённый и ИИ — ноль.
    expect(paid(ps, 'u-off1')).toBe(1.31);
    expect(paid(ps, 'u-off2')).toBe(0.44);
    expect(paid(ps, 'u-off3')).toBe(0);
    expect(paid(ps, 'platform')).toBe(1.75);
    expect(ps.find((p) => p.playerId === 'u-c1')).toMatchObject({ kind: 'owner', niche: 'cafe', rank: 1 });
    expect(w.players.find((p) => p.id === 'u-c1')!.inbox.some((i) => i.title === 'Season prize')).toBe(true);
  });

  it('a niche without eligible winners gives its pool to the other niches', () => {
    const w0 = season();
    const w1 = { ...w0, businesses: w0.businesses.map((b) => (b.id === 'g1' ? { ...b, status: 'bankrupt' as const, bankruptDay: 300 } : b)) };
    const ps = finalizeSeason(w1, ctx).payouts!;
    expect(cents(ps)).toBe(3500);
    expect(paid(ps, 'u-g1')).toBe(0);
    // $4.50 магазина делится между кафе и барбершопом как 4:2.
    expect(Math.round((paid(ps, 'u-c1') + paid(ps, 'u-c2') + paid(ps, 'u-c3')) * 100)).toBe(1800 + 300);
  });

  it('splits a business prize between its owners by their stakes', () => {
    let w = season();
    w = { ...w, day: 300, phase: 'running' };
    w = act(w, 'u-b1', { type: 'propose_deal', toBusinessId: 'c1', terms: { type: 'partnership', amount: 10_000, sharePct: 25 } });
    w = act(w, 'u-c1', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    // c1 получил $10k и по-прежнему первый среди людей в кафе; b1 потерял $10k и стал вторым в барбершопе.
    w = { ...w, day: 360 };
    const end = finalizeSeason(w, ctx);
    const ps = end.payouts!;
    expect(cents(ps)).toBe(3500);
    expect(ps.filter((p) => p.niche === 'cafe' && p.rank === 1).map((p) => [p.playerId, p.amount])).toEqual([['u-c1', 6.75], ['u-b1', 2.25]]);
    expect(end.deals[0].status).toBe('completed');
    expect(biz(end, 'c1').trust.kept).toBe(1);
  });

  it('with no human officials and no winners at all, everything goes to the platform', () => {
    const w = makeWorld([makeBusiness('x', 'cafe', 'p-a1', 'u-x', { status: 'bankrupt', bankruptDay: 10 })], [makePlayer('u-x')], { bank: 5, day: 360 });
    const ps = finalizeSeason(w, ctx).payouts!;
    expect(ps).toEqual([{ playerId: 'platform', kind: 'platform', amount: 5 }]);
  });

  it('is idempotent once the season has ended', () => {
    const once = finalizeSeason(season(), ctx);
    expect(finalizeSeason(once, ctx)).toBe(once);
  });
});

describe('splitCents', () => {
  it('always sums to the total and respects zero weights', () => {
    for (const total of [0, 1, 7, 100, 3333, 99_999]) {
      for (const weights of [[1], [0.5, 0.3, 0.2], [1, 1, 1], [3, 0, 1], [0.05, 0.9, 0.05]]) {
        const parts = splitCents(total, weights);
        expect(parts.reduce((s, x) => s + x, 0)).toBe(weights.some((x) => x > 0) ? total : 0);
        weights.forEach((x, i) => { if (x === 0) expect(parts[i]).toBe(0); });
      }
    }
  });
});
