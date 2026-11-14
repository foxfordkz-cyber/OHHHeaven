import { describe, expect, it } from 'vitest';
import { exposureOf, mineFor, noticesFor, queueFor } from '../../src/law/index';
import { lawCtx, lawWorld } from '../fixtures/law-world';
import { act, actError, biz, days, inboxOf } from './helpers';

const trails = [
  { violationId: 'off_books_payroll', months: 3, saved: 3528, lastActiveMonth: 3, discovered: false },
  { violationId: 'unreported_sales', months: 3, saved: 879, lastActiveMonth: 3, discovered: false },
  { violationId: 'dirty_surfaces', months: 2, saved: 700, lastActiveMonth: 3, discovered: false },
  { violationId: 'no_fse_permit', months: 1, saved: 0, lastActiveMonth: 1, discovered: false },
];

describe('owner protection', () => {
  it('deep clean wipes sanitary trails, keeps permit and tax trails, and costs money', () => {
    const w = act(lawWorld({ day: 95, luna: { trails } }), 'pl_luna', { type: 'spend', kind: 'deep_clean' });
    const luna = biz(w, 'luna');
    expect(luna.trails.map((t) => t.violationId)).toEqual(['off_books_payroll', 'unreported_sales', 'no_fse_permit']);
    expect(luna.cash).toBe(40000 - 432);
    expect(luna.mtd.lines.at(-1)).toEqual({ id: 'deep_clean:95', label: 'Deep clean', kind: 'opex', amount: -432 });
    expect(inboxOf(w, 'pl_luna').at(-1)?.title).toBe('Deep clean done: $432');
  });

  it('accountant pays back the biggest tax trail without a penalty', () => {
    const w = act(lawWorld({ day: 95, luna: { trails } }), 'pl_luna', { type: 'spend', kind: 'accountant' });
    const luna = biz(w, 'luna');
    expect(luna.trails.map((t) => t.violationId)).toEqual(['unreported_sales', 'dirty_surfaces', 'no_fse_permit']);
    expect(luna.cash).toBe(40000 - 3528 - 350);
    expect(luna.mtd.lines.slice(-2).map((l) => [l.kind, l.amount])).toEqual([['tax', -3528], ['other', -350]]);
    expect(actError(lawWorld({ day: 95 }), 'pl_luna', { type: 'spend', kind: 'accountant' })).toBe('No tax issues to fix');
  });
});

describe('views for the host', () => {
  it('exposure drops after the accountant', () => {
    const before = lawWorld({ day: 95, luna: { trails } });
    const after = act(before, 'pl_luna', { type: 'spend', kind: 'accountant' });
    expect(exposureOf(biz(before, 'luna'), lawCtx) - exposureOf(biz(after, 'luna'), lawCtx)).toBe(500 + 1.5 * 3528);
  });

  it('the queue shows open cases of my role only; my cases show what I found', () => {
    let w = act(lawWorld({ day: 1, luna: { trails } }), 'pl_rival', { type: 'report', targetBusinessId: 'luna', reportId: 'report_cash_payroll' });
    w = act(w, 'pl_honest', { type: 'report', targetBusinessId: 'luna', reportId: 'report_dirty_kitchen' });
    expect(queueFor(w, lawCtx, 'of_aud').map((c) => c.caseId)).toEqual(['case-1']);
    expect(queueFor(w, lawCtx, 'of_insp').map((c) => c.caseId)).toEqual(['case-2']);
    expect(queueFor(w, lawCtx, 'of_aud')[0].business).toMatchObject({ id: 'luna', name: 'Luna Cafe', ownerName: 'Maya', status: 'open' });
    w = days(act(w, 'pl_aud', { type: 'take_case', caseId: 'case-1' }), 1);
    expect(queueFor(w, lawCtx, 'of_aud')).toEqual([]);
    expect(mineFor(w, lawCtx, 'of_aud')[0]).toMatchObject({ caseId: 'case-1', status: 'notice' });
    expect(mineFor(w, lawCtx, 'of_aud')[0].found?.map((f) => f.violationId)).toEqual(['off_books_payroll', 'unreported_sales']);
    expect(noticesFor(w, 'luna').map((n) => n.caseId)).toEqual(['case-1']);
    expect(noticesFor(w, 'rival')).toEqual([]);
    expect(queueFor(w, lawCtx, 'nobody')).toEqual([]);
  });
});
