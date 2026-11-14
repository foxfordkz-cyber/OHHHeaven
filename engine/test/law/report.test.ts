import { describe, expect, it } from 'vitest';
import { lawActions, queueFor } from '../../src/law/index';
import { deepFreeze, lawCtx, lawWorld } from '../fixtures/law-world';
import { act, actError, caseOf, inboxOf } from './helpers';

const reportPayroll = { type: 'report', targetBusinessId: 'luna', reportId: 'report_cash_payroll' } as const;

describe('report', () => {
  it('opens a case with the role from the report template; the reporter stays hidden', () => {
    const w = deepFreeze(lawWorld({ day: 5 }));
    const next = act(w, 'pl_rival', reportPayroll);
    expect(caseOf(next)).toMatchObject({
      businessId: 'luna', role: 'tax_auditor', origin: 'report', reportId: 'report_cash_payroll', reporterBusinessId: 'rival', status: 'open', openedDay: 5,
    });
    expect(caseOf(next).hints).toEqual(['Complaint: Report off-the-books payroll', '1 complaint this month', 'Never inspected']);
    expect(next.feed.map((f) => f.text)).toEqual(['Someone reported Luna Cafe to the city']);
    expect(inboxOf(next, 'pl_rival').map((i) => i.title)).toEqual(['Report filed: Luna Cafe']);
    expect(inboxOf(next, 'pl_luna')).toEqual([]);
    const card = queueFor(next, lawCtx, 'of_aud')[0];
    expect(card.caseId).toBe('case-1');
    expect(JSON.stringify(card)).not.toContain('Rival');
    expect(next.version).toBe(w.version + 1);
  });

  it('counts complaints this month in the hints', () => {
    let w = act(lawWorld({ day: 5 }), 'pl_rival', reportPayroll);
    w = act(w, 'pl_honest', { type: 'report', targetBusinessId: 'luna', reportId: 'report_dirty_kitchen' });
    expect(caseOf(w, 'case-2').hints).toContain('2 complaints this month');
  });

  it('allows one report per week', () => {
    const w = act(lawWorld({ day: 5 }), 'pl_rival', reportPayroll);
    expect(actError(w, 'pl_rival', { type: 'report', targetBusinessId: 'honest', reportId: 'report_cash_payroll' })).toBe('You can file 1 report per week');
    expect(actError({ ...w, day: 11 }, 'pl_rival', { type: 'report', targetBusinessId: 'honest', reportId: 'report_cash_payroll' })).toBe('You can file 1 report per week');
    expect(actError({ ...w, day: 12 }, 'pl_rival', { type: 'report', targetBusinessId: 'honest', reportId: 'report_cash_payroll' })).toBeUndefined();
  });

  it('refuses reports on yourself, closed, bankrupt and unopened businesses, unknown templates and non-owners', () => {
    const w = lawWorld({ day: 5, honest: { status: 'closed', closedUntilDay: 9 } });
    expect(actError(w, 'pl_luna', reportPayroll)).toBe('You cannot report your own business');
    expect(actError(w, 'pl_rival', { type: 'report', targetBusinessId: 'honest', reportId: 'report_cash_payroll' })).toBe('This business is closed');
    expect(actError(lawWorld({ honest: { status: 'bankrupt' } }), 'pl_rival', { type: 'report', targetBusinessId: 'honest', reportId: 'report_cash_payroll' })).toBe('This business is closed');
    expect(actError(lawWorld({ honest: { status: 'setup' } }), 'pl_rival', { type: 'report', targetBusinessId: 'honest', reportId: 'report_cash_payroll' })).toBe('This business has not opened yet');
    expect(actError(w, 'pl_rival', { type: 'report', targetBusinessId: 'luna', reportId: 'nope' })).toBe('Unknown report type');
    expect(actError(w, 'pl_rival', { type: 'report', targetBusinessId: 'ghost', reportId: 'report_cash_payroll' })).toBe('Business not found');
    expect(actError(w, 'pl_insp', reportPayroll)).toBe('You need a business to report a competitor');
  });

  it('returns null for actions owned by other modules', () => {
    const w = lawWorld();
    expect(lawActions(w, lawCtx, 'pl_luna', { type: 'set_orders', orders: { price: 7 } })).toBeNull();
    expect(lawActions(w, lawCtx, 'pl_luna', { type: 'spend', kind: 'marketing', amount: 100 })).toBeNull();
    expect(lawActions(w, lawCtx, 'pl_luna', { type: 'launch' })).toBeNull();
  });
});
