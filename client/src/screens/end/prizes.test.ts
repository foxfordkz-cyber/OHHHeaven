import { describe, expect, it } from 'vitest';
import { cafeEndedView, cafeView, OFFICIALS_RANKING } from '../insights/fixtures';
import { allBoards, myResult, nicheBoard, nichePools, officialsBoard, placePrizes } from './prizes';

const cents = (v: number) => Math.round(v * 100);

describe('prize fund', () => {
  it('the prizes shown in all niche tables add up to the prize fund of the view', () => {
    const fund = cafeView.world.bank * cafeView.world.config.prizeShare;
    const shown = allBoards(cafeView).flatMap((b) => b.rows).reduce((s, r) => s + (r.prize ?? 0), 0);
    expect(cents(shown)).toBe(cents(fund));
  });
  it('niche funds are weighted by human owners', () => {
    const pools = nichePools(cafeView);
    expect(cents(pools.cafe! + pools.barbershop!)).toBe(cents(cafeView.world.bank * 0.9));
    expect(pools.cafe!).toBeGreaterThan(pools.barbershop!);
  });
  it('splits 50/30/20 and scales up when fewer than three can win', () => {
    expect(placePrizes(100, [0.5, 0.3, 0.2], 5)).toEqual([50, 30, 20]);
    expect(placePrizes(100, [0.5, 0.3, 0.2], 2)).toEqual([62.5, 37.5]);
    expect(placePrizes(10, [0.5, 0.3, 0.2], 3).reduce((s, x) => s + x, 0)).toBe(10);
    expect(placePrizes(100, [0.5, 0.3, 0.2], 0)).toEqual([]);
  });
});

describe('niche table', () => {
  const board = nicheBoard(cafeView, 'cafe');
  it('AI businesses are marked and win nothing; bankrupt ones neither', () => {
    for (const r of board.rows.filter((x) => x.isAi || x.bankrupt)) expect(r.prize).toBeNull();
    expect(board.rows.some((r) => r.isAi)).toBe(true);
  });
  it('the podium is the top three human businesses, and my row is found', () => {
    expect(board.rows.filter((r) => r.podium).map((r) => r.podium)).toEqual([1, 2, 3]);
    expect(board.mine).toMatchObject({ name: 'Bean There', rank: 4, mine: true });
  });
  it('after the season the table shows the final payouts', () => {
    const ended = nicheBoard(cafeEndedView, 'cafe');
    const finals = cafeEndedView.extra!.payouts!.filter((p) => p.niche === 'cafe');
    expect(ended.rows.filter((r) => r.prize !== null).map((r) => r.prize)).toEqual(finals.map((p) => p.amount));
  });
});

describe('officials and my result', () => {
  it('officials split their share by points; AI and negative points get nothing', () => {
    const o = officialsBoard(cafeView.world, OFFICIALS_RANKING);
    expect(cents(o.rows.reduce((s, r) => s + (r.prize ?? 0), 0))).toBe(cents(o.pool));
    expect(o.rows.filter((r) => r.isAi || r.points <= 0).every((r) => r.prize === null)).toBe(true);
  });
  it('my result at the end uses the final payout', () => {
    const r = myResult(cafeEndedView)!;
    expect(r).toMatchObject({ niche: 'cafe', rank: 2, final: true });
    expect(r.payout).toBe(cafeEndedView.extra!.payouts!.find((p) => p.playerId === cafeEndedView.me.id)!.amount);
    expect(myResult(cafeView)!.final).toBe(false);
  });
});

describe('same rule as finalizeSeason (agent 13)', () => {
  it('a niche where nobody can win hands its fund to the others, so the whole fund is still shown', () => {
    const v = structuredClone(cafeView);
    v.leaderboards.barbershop = v.leaderboards.barbershop!.map((s) => (s.isAi ? s : { ...s, bankrupt: true }));
    const pools = nichePools(v);
    expect(pools.barbershop).toBe(0);
    expect(Math.round(pools.cafe! * 100)).toBe(Math.round(v.world.bank * 0.9 * 100));
  });
  it('final payouts are matched by place among winners, even when an AI business sits in between', () => {
    const v = structuredClone(cafeEndedView);
    const board = nicheBoard(v, 'cafe');
    const third = board.rows.find((r) => r.podium === 3)!;
    expect(third.prize).toBe(v.extra!.payouts!.find((p) => p.niche === 'cafe' && p.rank === 3)!.amount);
  });
});
