import { describe, expect, it } from 'vitest';
import { RULES } from '../../../shared/src/rules';
import { noticesFor } from '../../src/law/index';
import { business, deepFreeze, lawWorld } from '../fixtures/law-world';
import { act, actError, biz, caseOf, days, inboxOf, official } from './helpers';

const cheater = {
  trails: [
    { violationId: 'off_books_payroll', months: 6, saved: 7056, lastActiveMonth: 6, discovered: false },
    { violationId: 'dirty_surfaces', months: 2, saved: 700, lastActiveMonth: 6, discovered: false },
  ],
};

describe('who takes the case', () => {
  it('a case nobody took goes to the first free AI official on the 4th day', () => {
    const w = act(lawWorld({ day: 1, luna: cheater }), 'pl_rival', { type: 'report', targetBusinessId: 'luna', reportId: 'report_cash_payroll' });
    const day3 = days(w, 2);
    expect(caseOf(day3).status).toBe('open');
    const day4 = days(day3, 1);
    expect(day4.day).toBe(4);
    expect(caseOf(day4)).toMatchObject({ status: 'taken', officialId: 'of_ai_aud', takenDay: 4, inspectDay: 4 + RULES.INSPECTION_DAYS });
    expect(inboxOf(day4, 'pl_ai_aud').map((i) => i.title)).toEqual(['Case taken: Luna Cafe']);
  });

  it('a human official takes a case; the same official cannot take the same business again within 30 days', () => {
    let w = act(lawWorld({ day: 1, luna: cheater }), 'pl_rival', { type: 'report', targetBusinessId: 'luna', reportId: 'report_dirty_kitchen' });
    w = act(w, 'pl_insp', { type: 'take_case', caseId: 'case-1' });
    expect(caseOf(w)).toMatchObject({ status: 'taken', officialId: 'of_insp', takenDay: 1, inspectDay: 2 });
    w = act({ ...w, day: 10 }, 'pl_honest', { type: 'report', targetBusinessId: 'luna', reportId: 'report_no_permit' });
    expect(actError(w, 'pl_insp', { type: 'take_case', caseId: 'case-2' })).toBe('You inspected this business less than 30 days ago');
    expect(actError({ ...w, day: 31 }, 'pl_insp', { type: 'take_case', caseId: 'case-2' })).toBeUndefined();
  });

  it('checks role, status and who is asking', () => {
    const w = act(lawWorld({ day: 1 }), 'pl_rival', { type: 'report', targetBusinessId: 'luna', reportId: 'report_cash_payroll' });
    expect(actError(w, 'pl_insp', { type: 'take_case', caseId: 'case-1' })).toBe('This case needs another kind of official');
    expect(actError(w, 'pl_luna', { type: 'take_case', caseId: 'case-1' })).toBe('Only officials can take cases');
    const taken = act(w, 'pl_aud', { type: 'take_case', caseId: 'case-1' });
    expect(actError(taken, 'pl_ai_aud', { type: 'take_case', caseId: 'case-1' })).toBe('Case is already taken');
  });
});

describe('inspection and notice', () => {
  const reported = () => act(lawWorld({ day: 1, luna: cheater }), 'pl_rival', { type: 'report', targetBusinessId: 'luna', reportId: 'report_cash_payroll' });

  it('finds every trail of the official role and sends a notice', () => {
    const w = days(act(reported(), 'pl_aud', { type: 'take_case', caseId: 'case-1' }), 1);
    expect(caseOf(w)).toMatchObject({
      status: 'notice', fine: 11084, closureDays: 0, answerByDay: 2 + RULES.NOTICE_ANSWER_DAYS,
      found: [{ violationId: 'off_books_payroll', months: 6, fine: 11084, closureDays: 0 }],
    });
    expect(inboxOf(w, 'pl_luna').at(-1)?.title).toBe('Notice of violation: $11,084 fine');
    expect(w.feed.at(-1)?.text).toBe('Tax auditor cited Luna Cafe for 1 violation');
    expect(noticesFor(w, 'luna')).toEqual([{ caseId: 'case-1', role: 'tax_auditor', found: caseOf(w).found, fine: 11084, closureDays: 0, answerByDay: 4, status: 'notice' }]);
  });

  it('silence equals pay: the fine is charged after the deadline and the trail resets', () => {
    const notice = days(act(reported(), 'pl_aud', { type: 'take_case', caseId: 'case-1' }), 1);
    const onDeadline = days(notice, 2);
    expect(caseOf(onDeadline).status).toBe('notice');
    const after = days(onDeadline, 1);
    expect(caseOf(after)).toMatchObject({ status: 'closed', outcome: 'fined', response: 'pay', fine: 11084, closedDay: 5 });
    const luna = biz(after, 'luna');
    expect(luna.cash).toBe(40000 - 11084);
    expect(luna.mtd.lines.at(-1)).toEqual({ id: 'fine:case-1', label: 'Fine: Unreported cash payroll', kind: 'fine', amount: -11084 });
    expect(luna.trails).toEqual([
      { violationId: 'off_books_payroll', months: 0, saved: 0, lastActiveMonth: 6, discovered: true },
      cheater.trails[1],
    ]);
    expect(luna.reputation).toBeCloseTo(0.55);
    expect(official(after, 'of_aud')).toMatchObject({ points: RULES.POINTS_PER_VIOLATION, casesClosed: 1 });
    expect(after.feed.at(-1)?.text).toBe('Tax auditor fined Luna Cafe $11,084');
    expect(inboxOf(after, 'pl_luna').at(-1)?.text).toContain('No answer in time: paid automatically.');
  });

  it('pay right away is the same as silence', () => {
    const notice = days(act(reported(), 'pl_aud', { type: 'take_case', caseId: 'case-1' }), 1);
    const paid = act(notice, 'pl_luna', { type: 'answer_notice', caseId: 'case-1', response: 'pay' });
    expect(biz(paid, 'luna').cash).toBe(40000 - 11084);
    expect(caseOf(paid)).toMatchObject({ outcome: 'fined', response: 'pay' });
  });

  it('contest: lawyer fee plus a reduced fine', () => {
    const notice = days(act(reported(), 'pl_aud', { type: 'take_case', caseId: 'case-1' }), 1);
    const contested = act(notice, 'pl_luna', { type: 'answer_notice', caseId: 'case-1', response: 'contest' });
    const fine = Math.round(11084 * RULES.CONTEST_FINE_MULT);
    expect(caseOf(contested)).toMatchObject({ outcome: 'fined', response: 'contest', fine });
    expect(biz(contested, 'luna').cash).toBe(40000 - RULES.CONTEST_FEE - fine);
  });

  it('only the owner answers, and only while the notice waits', () => {
    const notice = days(act(reported(), 'pl_aud', { type: 'take_case', caseId: 'case-1' }), 1);
    expect(actError(notice, 'pl_rival', { type: 'answer_notice', caseId: 'case-1', response: 'pay' })).toBe('Not your business');
    expect(actError(notice, 'pl_luna', { type: 'answer_notice', caseId: 'case-1', response: 'bribe' })).toBe('Offer an amount');
    const paid = act(notice, 'pl_luna', { type: 'answer_notice', caseId: 'case-1', response: 'pay' });
    expect(actError(paid, 'pl_luna', { type: 'answer_notice', caseId: 'case-1', response: 'pay' })).toBe('This notice is not waiting for an answer');
  });

  it('closure: evidence of pests closes the cafe for 3 days, then it reopens', () => {
    let w = act(lawWorld({ day: 1, luna: { trails: [{ violationId: 'pest_evidence', months: 1, saved: 180, lastActiveMonth: 1, discovered: false }] } }),
      'pl_rival', { type: 'report', targetBusinessId: 'luna', reportId: 'report_dirty_kitchen' });
    w = days(act(w, 'pl_insp', { type: 'take_case', caseId: 'case-1' }), 1);
    w = act(w, 'pl_luna', { type: 'answer_notice', caseId: 'case-1', response: 'pay' });
    expect(biz(w, 'luna')).toMatchObject({ status: 'closed', closedUntilDay: 5 });
    expect(biz(w, 'luna').reputation).toBeCloseTo(0.45);
    expect(w.feed.at(-1)?.text).toBe('Luna Cafe is closed for 3 days by city order');
    const day4 = days(w, 2);
    expect(biz(day4, 'luna').status).toBe('closed');
    const day5 = days(day4, 1);
    expect(biz(day5, 'luna').status).toBe('open');
    expect(biz(day5, 'luna').closedUntilDay).toBeUndefined();
    expect(day5.feed.at(-1)?.text).toBe('Luna Cafe reopened after the closure order');
  });

  it('a cafe open without its permit is caught right away, even before a month closes', () => {
    let w = lawWorld({ day: 5, luna: { openedDay: 3, permits: [{ itemId: 'fse_permit', appliedDay: 1, readyDay: 22 }] } });
    w = act(w, 'pl_rival', { type: 'report', targetBusinessId: 'luna', reportId: 'report_no_permit' });
    w = days(w, 4);
    expect(caseOf(w)).toMatchObject({ status: 'notice', fine: 1000, closureDays: 7, found: [{ violationId: 'no_fse_permit', months: 0, fine: 1000, closureDays: 7 }] });
  });
});

describe('clean inspections and false reports', () => {
  it('an empty inspection costs the official points', () => {
    let w = act(lawWorld({ day: 1 }), 'pl_rival', { type: 'report', targetBusinessId: 'honest', reportId: 'report_dirty_kitchen' });
    w = days(act(w, 'pl_insp', { type: 'take_case', caseId: 'case-1' }), 1);
    expect(caseOf(w)).toMatchObject({ status: 'closed', outcome: 'clean', fine: 0, found: [] });
    expect(official(w, 'of_insp')).toMatchObject({ points: RULES.POINTS_EMPTY_INSPECTION, casesClosed: 1 });
    expect(w.feed.at(-1)?.text).toBe('City inspector inspected Honest Beans: no violations');
  });

  it('first false report is a warning; the second costs $500 and reveals the reporter', () => {
    let w = act(lawWorld({ day: 1 }), 'pl_rival', { type: 'report', targetBusinessId: 'honest', reportId: 'report_dirty_kitchen' });
    w = days(w, 4);
    expect(caseOf(w)).toMatchObject({ outcome: 'clean' });
    expect(biz(w, 'rival').cash).toBe(40000);
    expect(inboxOf(w, 'pl_rival').at(-1)?.title).toBe('Warning: unfounded report');
    expect(inboxOf(w, 'pl_honest').map((i) => i.title)).toEqual(['Inspection passed']);

    w = act({ ...w, day: 40 }, 'pl_rival', { type: 'report', targetBusinessId: 'honest', reportId: 'report_cash_payroll' });
    w = days(w, 4);
    expect(caseOf(w, 'case-2')).toMatchObject({ outcome: 'clean' });
    expect(biz(w, 'rival').cash).toBe(40000 - RULES.FALSE_REPORT_FINE);
    expect(biz(w, 'rival').mtd.lines.at(-1)).toEqual({ id: 'false_report:case-2', label: 'Fine: false report to the city', kind: 'fine', amount: -RULES.FALSE_REPORT_FINE });
    expect(inboxOf(w, 'pl_honest').at(-1)?.title).toBe('The report came from Rival Roasters');
  });

  it('dismiss_case closes a case without an inspection or points', () => {
    let w = act(lawWorld({ day: 1 }), 'pl_rival', { type: 'report', targetBusinessId: 'luna', reportId: 'report_dirty_kitchen' });
    w = act(w, 'pl_insp', { type: 'dismiss_case', caseId: 'case-1' });
    expect(caseOf(w)).toMatchObject({ status: 'closed', outcome: 'dismissed', closedDay: 1 });
    expect(official(w, 'of_insp').points).toBe(0);
    expect(actError(w, 'pl_insp', { type: 'dismiss_case', caseId: 'case-1' })).toBe('You can dismiss only open cases or your own case before the inspection');
  });
});

describe('no mutation', () => {
  it('every step leaves the input world untouched', () => {
    const start = deepFreeze(lawWorld({ day: 1, luna: { ...cheater, cash: 40000 } }));
    const snapshot = JSON.stringify(start);
    let w = act(start, 'pl_rival', { type: 'report', targetBusinessId: 'luna', reportId: 'report_cash_payroll' });
    w = deepFreeze(act(deepFreeze(w), 'pl_aud', { type: 'take_case', caseId: 'case-1' }));
    w = deepFreeze(days(w, 1));
    w = deepFreeze(act(w, 'pl_luna', { type: 'answer_notice', caseId: 'case-1', response: 'bribe', bribeAmount: 2000 }));
    w = deepFreeze(act(w, 'pl_aud', { type: 'answer_bribe', caseId: 'case-1', accept: false }));
    expect(JSON.stringify(start)).toBe(snapshot);
    expect(business('x', 'x', 'p', 'p1').status).toBe('open');
  });
});
