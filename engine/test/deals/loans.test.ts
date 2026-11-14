import { describe, expect, it } from 'vitest';
import { firstDueDay, loanScheduleFor, computeStandings } from '../../src/deals';
import { act, advance, biz, ctx, street } from './fixtures';

const lend = (amount: number, monthlyRatePct: number, months: number) =>
  ({ type: 'propose_deal' as const, toBusinessId: 'kai', terms: { type: 'loan' as const, amount, monthlyRatePct, months } });

const sum = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;

describe('loan schedule', () => {
  it('equal payments repay principal to the cent', () => {
    const s = loanScheduleFor(10_000, 3, 6, 6);
    expect(s).toHaveLength(6);
    expect(sum(s.map((x) => x.principal))).toBe(10_000);
    expect(s[5].balanceAfter).toBe(0);
    expect(new Set(s.slice(0, 5).map((x) => x.payment)).size).toBe(1);
    expect(Math.abs(s[5].payment - s[0].payment)).toBeLessThan(0.05);
    expect(s[0].payment).toBeCloseTo(1845.98, 2);                 // аннуитет 10 000 под 3% на 6 месяцев
  });

  it('zero interest splits the principal evenly', () => {
    const s = loanScheduleFor(1000, 0, 3, 10);
    expect(s.map((x) => x.payment)).toEqual([333.33, 333.33, 333.34]);
  });

  it('the first payment comes at a month close at least half a month after the start', () => {
    expect(firstDueDay(6)).toBe(30);
    expect(firstDueDay(17)).toBe(60);
    expect(firstDueDay(31)).toBe(60);
  });
});

describe('loan', () => {
  it('moves the money at once and is repaid in full at month closes', () => {
    let w = act(street(), 'u-ana', lend(6000, 2, 3));
    w = act(w, 'u-kai', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    expect(biz(w, 'ana').cash).toBe(14_000);
    expect(biz(w, 'kai').cash).toBe(26_000);
    expect(biz(w, 'ana').mtd.lines.at(-1)).toMatchObject({ kind: 'deal', amount: -6000 });
    expect(biz(w, 'kai').mtd.lines.at(-1)).toMatchObject({ kind: 'deal', amount: 6000 });
    const sched = loanScheduleFor(6000, 2, 3, 6);
    w = advance(w, 25);                                                     // день 30: первый платёж
    expect(w.deals[0].paidBack).toBe(sched[0].payment);
    const r = biz(w, 'kai').history.at(-1)!;
    expect(r.lines.filter((l) => l.kind === 'deal').map((l) => l.amount)).toEqual([-sched[0].principal, -sched[0].interest]);
    expect(r.cashEnd).toBe(biz(w, 'kai').cash);
    w = advance(w, 60);                                                     // дни 60 и 90
    const total = sum(sched.map((x) => x.payment));
    expect(w.deals[0]).toMatchObject({ status: 'completed', paidBack: total });
    expect(biz(w, 'ana').cash).toBe(Math.round((14_000 + total) * 100) / 100);
    expect(biz(w, 'kai').cash).toBe(Math.round((26_000 - total) * 100) / 100);
    expect(biz(w, 'ana').trust).toEqual({ kept: 1, broken: 0 });
    expect(biz(w, 'kai').trust).toEqual({ kept: 1, broken: 0 });
  });

  it('a missed payment breaks the deal and writes the rest off at the lender', () => {
    let w = act(street(), 'u-ana', lend(10_000, 3, 6));
    w = act(w, 'u-kai', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    w = advance(w, 25);                                                     // первый платёж прошёл
    expect(w.deals[0].status).toBe('active');
    w = advance(w, 30, () => ({ kai: -biz(w, 'kai').cash - 500 }));         // в месяце 2 у Kai пустая касса
    expect(w.deals[0].status).toBe('broken');
    expect(biz(w, 'kai').trust).toEqual({ kept: 0, broken: 1 });
    const writeoff = biz(w, 'ana').history.at(-1)!.lines.find((l) => l.id.endsWith('writeoff'))!;
    expect(writeoff.amount).toBe(0);
    expect(writeoff.label).toMatch(/written off/);
    expect(w.feed.some((f) => f.text.includes('defaulted'))).toBe(true);
    // Должник всё ещё должен: срыв не поднимает его в таблице, а кредитор долг списал.
    const st = computeStandings(w, ctx);
    const left = loanScheduleFor(10_000, 3, 6, 6)[0].balanceAfter;
    expect(st.find((s) => s.businessId === 'kai')!.netWorth).toBe(Math.round((biz(w, 'kai').cash - left) * 100) / 100);
    expect(st.find((s) => s.businessId === 'ana')!.netWorth).toBe(biz(w, 'ana').cash);
  });

  it('bankruptcy of the borrower writes the rest off as a separate line', () => {
    let w = act(street(), 'u-ana', lend(8000, 1, 4));
    w = act(w, 'u-kai', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    w = { ...w, businesses: w.businesses.map((b) => (b.id === 'kai' ? { ...b, status: 'bankrupt' as const, bankruptDay: 5 } : b)) };
    w = advance(w, 1);
    expect(w.deals[0].status).toBe('broken');
    const line = biz(w, 'ana').mtd.lines.find((l) => l.id.endsWith('writeoff'))!;
    expect(line).toMatchObject({ kind: 'deal', amount: 0 });
    expect(line.label).toContain('$8,000');
    expect(biz(w, 'ana').cash).toBe(12_000);
  });

  it('the borrower may repay early: a kept deal, not a broken one', () => {
    let w = act(street(), 'u-ana', lend(6000, 2, 3));
    w = act(w, 'u-kai', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    w = advance(w, 25);
    const left = loanScheduleFor(6000, 2, 3, 6)[0].balanceAfter;
    w = act(w, 'u-kai', { type: 'cancel_deal', dealId: w.deals[0].id });
    expect(w.deals[0].status).toBe('completed');
    expect(biz(w, 'kai').trust).toEqual({ kept: 1, broken: 0 });
    expect(biz(w, 'ana').mtd.lines.at(-1)!.amount).toBe(left);
  });

  it('a lender with an active loan keeps the receivable in the standings', () => {
    let w = act(street(), 'u-ana', lend(6000, 2, 3));
    w = act(w, 'u-kai', { type: 'answer_deal', dealId: w.deals[0].id, accept: true });
    const st = computeStandings(w, ctx);
    expect(st.find((s) => s.businessId === 'ana')!.netWorth).toBe(20_000);
    expect(st.find((s) => s.businessId === 'kai')!.netWorth).toBe(20_000);
  });
});
