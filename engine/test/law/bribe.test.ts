import { describe, expect, it } from 'vitest';
import { RULES } from '../../../shared/src/rules';
import { lawMonthClose, mineFor } from '../../src/law/index';
import { lawCtx, lawWorld } from '../fixtures/law-world';
import { act, actError, biz, caseOf, days, inboxOf, official } from './helpers';

const cheater = { trails: [{ violationId: 'off_books_payroll', months: 6, saved: 7056, lastActiveMonth: 6, discovered: false }] };

/** Дело дошло до уведомления на 2-й день: аудитор-человек взял его сам. */
function noticeOn(day = 1) {
  let w = act(lawWorld({ day, luna: cheater }), 'pl_rival', { type: 'report', targetBusinessId: 'luna', reportId: 'report_cash_payroll' });
  w = act(w, 'pl_aud', { type: 'take_case', caseId: 'case-1' });
  return days(w, 1);
}

describe('bribe', () => {
  it('accepted: no fine, the trail stays, the official gets points', () => {
    let w = act(noticeOn(), 'pl_luna', { type: 'answer_notice', caseId: 'case-1', response: 'bribe', bribeAmount: 2500 });
    expect(caseOf(w)).toMatchObject({ status: 'bribe_offered', bribeAmount: 2500, answerByDay: 2 + RULES.BRIBE_ANSWER_DAYS });
    expect(inboxOf(w, 'pl_aud').at(-1)?.title).toBe('Luna Cafe offers $2,500');
    expect(mineFor(w, lawCtx, 'of_aud')[0]).toMatchObject({ caseId: 'case-1', status: 'bribe_offered', bribeAmount: 2500 });
    w = act(w, 'pl_aud', { type: 'answer_bribe', caseId: 'case-1', accept: true });
    expect(caseOf(w)).toMatchObject({ status: 'closed', outcome: 'bribed' });
    expect(biz(w, 'luna').cash).toBe(40000 - 2500);
    expect(biz(w, 'luna').trails).toEqual(cheater.trails);
    expect(official(w, 'of_aud')).toMatchObject({ bribesTaken: 2500, bribesThisMonth: 1, points: RULES.POINTS_PER_BRIBE, casesClosed: 1 });
    expect(w.feed.some((f) => f.kind === 'bribe')).toBe(false);
  });

  it('Internal Affairs exposes the official at month close; the owner pays the bribery fine', () => {
    let w = act(noticeOn(), 'pl_luna', { type: 'answer_notice', caseId: 'case-1', response: 'bribe', bribeAmount: 2500 });
    w = act(w, 'pl_aud', { type: 'answer_bribe', caseId: 'case-1', accept: true });
    const closed = lawMonthClose({ ...w, day: 30 }, lawCtx);
    expect(official(closed, 'of_aud')).toMatchObject({ points: 0, exposed: true, suspendedUntilDay: 60, bribesThisMonth: 0 });
    const fine = 5000 + 2 * 2500;
    expect(biz(closed, 'luna').cash).toBe(40000 - 2500 - fine);
    expect(biz(closed, 'luna').mtd.lines.at(-1)).toEqual({ id: 'bribery:case-1', label: 'Fine: Bribing a public servant', kind: 'fine', amount: -fine });
    expect(closed.feed.map((f) => f.text)).toContain('Internal Affairs exposed Dev, tax auditor: 1 bribe this month');
    expect(closed.feed.map((f) => f.text)).toContain('Luna Cafe fined $10,000 for bribing an official');
    expect(actError(closed, 'pl_aud', { type: 'take_case', caseId: 'case-1' })).toBe('You were exposed by Internal Affairs');
  });

  it('only the official with the most bribes this month is exposed', () => {
    let w = act(noticeOn(), 'pl_luna', { type: 'answer_notice', caseId: 'case-1', response: 'bribe', bribeAmount: 1000 });
    w = act(w, 'pl_aud', { type: 'answer_bribe', caseId: 'case-1', accept: true });
    w = { ...w, officials: w.officials.map((o) => (o.id === 'of_insp' ? { ...o, bribesThisMonth: 2, bribesTaken: 3000 } : o)) };
    const closed = lawMonthClose({ ...w, day: 30 }, lawCtx);
    expect(official(closed, 'of_insp').exposed).toBe(true);
    expect(official(closed, 'of_aud')).toMatchObject({ exposed: false, points: RULES.POINTS_PER_BRIBE, bribesThisMonth: 0 });
    expect(biz(closed, 'luna').cash).toBe(40000 - 1000);
  });

  it('refused: the fine grows ×1.5 and the city hears about it', () => {
    let w = act(noticeOn(), 'pl_luna', { type: 'answer_notice', caseId: 'case-1', response: 'bribe', bribeAmount: 2500 });
    w = act(w, 'pl_aud', { type: 'answer_bribe', caseId: 'case-1', accept: false });
    const fine = Math.round(11084 * RULES.REFUSED_BRIBE_FINE_MULT);
    expect(caseOf(w)).toMatchObject({ status: 'closed', outcome: 'fined', response: 'bribe', fine });
    expect(biz(w, 'luna').cash).toBe(40000 - fine);
    expect(official(w, 'of_aud')).toMatchObject({ points: RULES.POINTS_PER_VIOLATION, bribesThisMonth: 0 });
    expect(w.feed.at(-1)?.text).toBe(`Tax auditor refused a bribe from Luna Cafe; fine raised to $${fine.toLocaleString('en-US')}`);
  });

  it('an official who does not answer has refused', () => {
    const w = act(noticeOn(), 'pl_luna', { type: 'answer_notice', caseId: 'case-1', response: 'bribe', bribeAmount: 2500 });
    const lateDay = days(w, RULES.BRIBE_ANSWER_DAYS + 1);
    expect(caseOf(lateDay)).toMatchObject({ outcome: 'fined', fine: Math.round(11084 * RULES.REFUSED_BRIBE_FINE_MULT) });
  });

  it('cannot offer more than the cash in the register; only the case official answers', () => {
    const w = noticeOn();
    expect(actError(w, 'pl_luna', { type: 'answer_notice', caseId: 'case-1', response: 'bribe', bribeAmount: 50000 })).toBe('Not enough cash');
    const offered = act(w, 'pl_luna', { type: 'answer_notice', caseId: 'case-1', response: 'bribe', bribeAmount: 100 });
    expect(actError(offered, 'pl_ai_aud', { type: 'answer_bribe', caseId: 'case-1', accept: true })).toBe('Not your case');
    expect(actError(offered, 'pl_luna', { type: 'answer_bribe', caseId: 'case-1', accept: true })).toBe('Only officials can answer offers');
  });
});
