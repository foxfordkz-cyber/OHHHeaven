import { describe, expect, it } from 'vitest';
import type { OwnerView, Payout } from '@shared/types';
import { cafeEndedView, cafeView, MY_PLAYER_ID, OFFICIALS_RANKING, SEASON_PAYOUTS } from '../insights/fixtures';
import { allBoards, myResult, nicheBoard, nichePools, officialsBoard, placePrizes, splitCents } from './prizes';

const cents = (v: number) => Math.round(v * 100);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** cafeView with one barbershop run by a person (the sample city has only AI barbers). */
function withHumanBarber(v: OwnerView, bankrupt = false): OwnerView {
  const x = structuredClone(v);
  x.leaderboards.barbershop = x.leaderboards.barbershop!.map((s, i) => (i === 0 ? { ...s, isAi: false, bankrupt } : s));
  x.neighbors = x.neighbors.map((n) => (n.id === 'ai-barber-1' ? { ...n, isAi: false, status: bankrupt ? 'bankrupt' : 'open' } : n));
  return x;
}

describe('prize fund', () => {
  it('splits cents by largest remainder, like the engine', () => {
    expect(splitCents(250, [35, 25])).toEqual([146, 104]);          // lead's example: Dana $1.46, Sam $1.04
    expect(sum(splitCents(4500, [10, 1]))).toBe(4500);
    expect(splitCents(100, [0, 0])).toEqual([0, 0]);
  });
  it('the prizes shown in all niche tables add up to the prize fund of the view', () => {
    const fund = cafeView.world.bank * cafeView.world.config.prizeShare;
    const shown = allBoards(cafeView).flatMap((b) => b.rows).reduce((s, r) => s + (r.prize ?? 0), 0);
    expect(cents(shown)).toBe(cents(fund));
  });
  it('niche funds are weighted by human owners; a niche of AI businesses only gets nothing', () => {
    expect(nichePools(cafeView)).toEqual({ cafe: 45 });
    const pools = nichePools(withHumanBarber(cafeView));
    expect(cents(pools.cafe! + pools.barbershop!)).toBe(cents(cafeView.world.bank * 0.9));
    expect(pools).toEqual({ cafe: 40.91, barbershop: 4.09 });       // 10 human cafes, 1 human barbershop
  });
  it('counts owners from the city list when the table shows only the top rows', () => {
    const v = structuredClone(cafeView);
    v.leaderboards.cafe = v.leaderboards.cafe!.slice(0, 5);
    expect(nichePools(withHumanBarber(v))).toEqual({ cafe: 40.91, barbershop: 4.09 });
    expect(myResult(v)!.of).toBe(20);
  });
  it('the board says how the fund is split today', () => {
    expect(nicheBoard(cafeView, 'cafe').split).toEqual([50, 30, 20]);
    const two = structuredClone(cafeView);
    two.leaderboards.cafe = two.leaderboards.cafe!.map((s) => (['b-omar', 'b-nora', 'b-grind', 'b-crumb', 'b-ritual', 'b-kiln'].includes(s.businessId) ? { ...s, bankrupt: true } : s));
    expect(nicheBoard(two, 'cafe').split).toEqual([62.5, 37.5]);
  });
  it('splits 50/30/20 and scales up when fewer than three can win', () => {
    expect(placePrizes(100, [0.5, 0.3, 0.2], 5)).toEqual([50, 30, 20]);
    expect(placePrizes(100, [0.5, 0.3, 0.2], 2)).toEqual([62.5, 37.5]);
    expect(sum(placePrizes(10, [0.5, 0.3, 0.2], 3))).toBe(10);
    expect(placePrizes(100, [0.5, 0.3, 0.2], 0)).toEqual([]);
  });
});

describe('niche table', () => {
  const board = nicheBoard(cafeView, 'cafe');
  it('AI businesses are marked and win nothing; bankrupt ones neither', () => {
    for (const r of board.rows.filter((x) => x.isAi || x.bankrupt)) expect(r.prize).toBeNull();
    expect(board.rows.some((r) => r.isAi)).toBe(true);
    expect(board.rows.filter((r) => r.bankrupt).map((r) => r.rank)).toEqual([19, 20]);
  });
  it('the podium is the top three human businesses, even with an AI business between them', () => {
    expect(board.rows.filter((r) => r.podium).map((r) => [r.rank, r.podium, r.prize])).toEqual([[1, 1, 22.5], [3, 2, 13.5], [4, 3, 9]]);
    expect(board.rows[1]).toMatchObject({ isAi: true, prize: null, podium: null });
    expect(board.mine).toMatchObject({ name: 'Maya’s Coffee', rank: 3, mine: true });
  });
  it('takes names from the table, else from the city list', () => {
    const v = structuredClone(cafeView);
    v.leaderboards.cafe = v.leaderboards.cafe!.map(({ name: _n, ...s }) => s);
    expect(nicheBoard(v, 'cafe').rows.map((r) => r.name)).toEqual(board.rows.map((r) => r.name));
  });
  it('a prize sent by the server (Standing.prize) wins over the projection', () => {
    const v = structuredClone(cafeView);
    v.leaderboards.cafe![0].prize = 20;
    expect(nicheBoard(v, 'cafe').rows[0].prize).toBe(20);
  });
});

describe('after the season', () => {
  it('with only my own payouts the table shows the prizes by the rule, which match what was paid', () => {
    const ended = nicheBoard(cafeEndedView, 'cafe');
    const paid = SEASON_PAYOUTS.filter((p) => p.niche === 'cafe').map((p) => p.amount);
    expect(ended.rows.filter((r) => r.prize !== null).map((r) => r.prize)).toEqual(paid);
    expect(paid).toEqual([22.5, 13.5, 9]);                              // lead's final table
  });
  it('with everyone’s payouts the table shows the money paid, co-owners summed', () => {
    const split: Payout[] = SEASON_PAYOUTS.flatMap((p) => (p.niche === 'cafe' && p.rank === 1
      ? [{ ...p, playerId: 'owner-a', amount: 11.25 }, { ...p, playerId: 'owner-b', amount: 11.25 }]
      : p.niche === 'cafe' && p.rank === 3 ? [{ ...p, amount: 8.99 }] : [p]));
    const rows = nicheBoard({ ...cafeEndedView, payouts: split }, 'cafe').rows;
    expect(rows.filter((r) => r.podium).map((r) => r.prize)).toEqual([22.5, 13.5, 8.99]);
  });
  it('final payouts are matched by place among winners, not by row', () => {
    const payouts: Payout[] = [
      { playerId: 'owner-b-bagel', kind: 'owner', amount: 22.5, niche: 'cafe', rank: 1 },
      { playerId: MY_PLAYER_ID, kind: 'owner', amount: 13.5, niche: 'cafe', rank: 2 },
      { playerId: 'owner-b-omar', kind: 'owner', amount: 9.01, niche: 'cafe', rank: 3 },
    ];
    const v: OwnerView = { ...cafeView, world: { ...cafeView.world, phase: 'ended' }, payouts };
    const omar = nicheBoard(v, 'cafe').rows.find((r) => r.businessId === 'b-omar')!;
    expect(omar).toMatchObject({ rank: 4, podium: 3, prize: 9.01 });
  });
  it('a niche where nobody can win hands its fund to the others, so the whole fund is still shown', () => {
    const pools = nichePools(withHumanBarber(cafeView, true));
    expect(pools.barbershop).toBe(0);
    expect(cents(pools.cafe!)).toBe(cents(cafeView.world.bank * 0.9));
  });
  it('the season’s payouts add up to the bank', () => {
    expect(cents(sum(SEASON_PAYOUTS.map((p) => p.amount)))).toBe(cents(cafeEndedView.world.bank));
  });
});

describe('officials and my result', () => {
  it('officials split their share by points; AI and zero points get nothing', () => {
    const o = officialsBoard(cafeView.world, OFFICIALS_RANKING);
    expect(o.pool).toBe(2.5);
    expect(o.rows.map((r) => r.prize)).toEqual([1.46, 1.04, null, null, null]);   // lead: Dana $1.46, Sam $1.04, Rick 0
    expect(cents(sum(o.rows.map((r) => r.prize ?? 0)))).toBe(cents(o.pool));
  });
  it('my result at the end is the money paid to me', () => {
    const r = myResult(cafeEndedView)!;
    expect(r).toEqual({ niche: 'cafe', rank: 2, of: 20, payout: 13.5, final: true });
    expect(myResult(cafeView)).toMatchObject({ rank: 3, of: 20, payout: 13.5, final: false });
  });
});
