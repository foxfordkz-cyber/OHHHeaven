import { describe, expect, it } from 'vitest';
import { RULES } from '../../../shared/src/rules';
import { dealModifiers, dealsMonthClose } from '../../src/deals';
import { advance, biz, ctx, economyClose, makeBusiness, makePlayer, makeWorld } from './fixtures';

/** Atlantic Ave: пять открытых бизнесов; Smith St: один. Порог 0,6 → нужно трое из пяти. */
function block(payers: string[]) {
  const ids = ['a1', 'a2', 'a3', 'a4', 'a5'];
  const businesses = [
    ...ids.map((id, i) => makeBusiness(id, i % 2 ? 'barbershop' : 'cafe', `p-${id}`, `u-${id}`, { orders: { price: 5, staff: {}, levers: {}, shortcuts: [], blockFund: payers.includes(id), autopilot: 'hold' } })),
    makeBusiness('s1', 'cafe', 'p-s1', 'u-s1', { orders: { price: 5, staff: {}, levers: {}, shortcuts: [], blockFund: true, autopilot: 'hold' } }),
  ];
  return makeWorld(businesses, businesses.map((b) => makePlayer(b.managerPlayerId)), { day: 29 });
}

describe('block fund', () => {
  it('below the threshold: fees are charged, the status is inactive, no effect', () => {
    let w = advance(block(['a1', 'a2']), 1);                               // день 30: 2 из 5
    expect(biz(w, 'a1').cash).toBe(20_000 - RULES.BLOCK_FUND_FEE_MONTH);
    expect(biz(w, 'a3').cash).toBe(20_000);
    expect(w.blockFunds.find((f) => f.block === 'Atlantic Ave')).toEqual({ block: 'Atlantic Ave', month: 2, contributors: 2, eligible: 5, active: false, feeMonth: RULES.BLOCK_FUND_FEE_MONTH });
    w = advance(w, 1);
    expect(dealModifiers(w, ctx, 'a1').footTrafficMult).toBe(1);
  });

  it('at the threshold: next month the whole block gets more foot traffic, non-payers too', () => {
    let w = advance(block(['a1', 'a2', 'a3']), 1);                         // 3 из 5 = 0,6
    const st = w.blockFunds.find((f) => f.block === 'Atlantic Ave')!;
    expect(st).toMatchObject({ month: 2, contributors: 3, eligible: 5, active: true });
    expect(dealModifiers(w, ctx, 'a4').footTrafficMult).toBe(1);            // ещё месяц 1
    w = advance(w, 1);                                                     // день 31 — месяц 2
    for (const id of ['a1', 'a2', 'a3', 'a4', 'a5']) expect(dealModifiers(w, ctx, id).footTrafficMult).toBe(RULES.BLOCK_FUND_TRAFFIC_MULT);
    // Smith St: один бизнес и он платит — 1 из 1, у него свой фонд.
    expect(dealModifiers(w, ctx, 's1').footTrafficMult).toBe(RULES.BLOCK_FUND_TRAFFIC_MULT);
    expect(w.feed.some((f) => f.text.startsWith('Atlantic Ave'))).toBe(true);
    expect(w.players.find((p) => p.id === 'u-a4')!.inbox.some((i) => i.title.includes('Block fund is live'))).toBe(true);
    w = advance(w, 29);                                                    // день 60: никто не передумал — фонд и на месяц 3
    expect(w.blockFunds.filter((f) => f.block === 'Atlantic Ave').map((f) => f.month)).toEqual([2, 3]);
  });

  it('the fee line lands in the month report and is not charged twice', () => {
    let w = block(['a1', 'a2', 'a3']);
    w = { ...w, day: 30 };
    w = economyClose(w);
    const once = dealsMonthClose(w, ctx);
    expect(biz(once, 'a1').history.at(-1)!.lines.filter((l) => /blockfund/.test(l.id))).toHaveLength(1);
    expect(biz(once, 'a1').history.at(-1)!.cashEnd).toBe(biz(once, 'a1').cash);
    const twice = dealsMonthClose(once, ctx);
    expect(biz(twice, 'a1').cash).toBe(biz(once, 'a1').cash);
  });

  it('a business without the cash skips the fee and does not count', () => {
    let w = block(['a1', 'a2', 'a3']);
    w = { ...w, businesses: w.businesses.map((b) => (b.id === 'a3' ? { ...b, cash: 100 } : b)) };
    w = advance(w, 1);
    expect(biz(w, 'a3').cash).toBe(100);
    expect(w.blockFunds.find((f) => f.block === 'Atlantic Ave')).toMatchObject({ contributors: 2, active: false });
  });

  it('no fee in the last month of the season', () => {
    const w0 = block(['a1', 'a2', 'a3']);
    const w = advance({ ...w0, day: 359 }, 1);
    expect(biz(w, 'a1').cash).toBe(20_000);
    expect(w.blockFunds).toHaveLength(0);
  });
});
