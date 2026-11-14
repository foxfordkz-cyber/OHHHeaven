import { describe, expect, it } from 'vitest';
import type { MonthReport, PnlLine } from '../../../shared/src/types';
import { lawDay, lawMonthClose, suspiciousNumbers } from '../../src/law/index';
import { business, lawCtx, lawWorld, orders } from '../fixtures/law-world';
import { biz, caseOf } from './helpers';

const report = (month: number, lines: PnlLine[]): MonthReport => ({
  month, avgPrice: 6.5, demandUnits: 3000, servedUnits: 3000, lost: { size: 0, staff: 0, closure: 0 }, capacityUnits: 3000, sizeUtilization: 0.7,
  lines, revenue: 19500, profit: 0, cashStart: 0, cashEnd: 0, taxesAccrued: 0, taxesPaid: 0, fines: 0, quality: 0.6, reputation: 0.6, netWorth: 0, rankInNiche: 0,
});
const payrollMonth = (month: number, payroll: number, hidden: number, extra: PnlLine[] = []) => report(month, [
  { id: 'revenue', label: 'Sales', kind: 'revenue', amount: 19500 },
  { id: 'payroll', label: 'Wages', kind: 'payroll', amount: -payroll },
  { id: 'payroll_tax', label: 'Payroll taxes', kind: 'payroll_tax', amount: -Math.round(payroll * 0.1235) },
  ...(hidden > 0 ? [{ id: 'saving:cash_wages', label: 'Kept', kind: 'saving' as const, amount: hidden }] : []),
  ...extra,
]);

describe('lawMonthClose', () => {
  it('a trail fades TRAIL_EXPIRY_MONTHS after the last violation', () => {
    const trail = { violationId: 'dirty_surfaces', months: 3, saved: 1050, lastActiveMonth: 1, discovered: false };
    const w = lawWorld({ luna: { trails: [trail] } });
    expect(biz(lawMonthClose({ ...w, day: 180 }, lawCtx), 'luna').trails).toEqual([trail]);
    expect(biz(lawMonthClose({ ...w, day: 210 }, lawCtx), 'luna').trails).toEqual([]);
  });

  it('routine inspection after 6 months open; none while an inspector case is open', () => {
    const w = lawMonthClose({ ...lawWorld(), day: 180 }, lawCtx);
    expect(w.cases.map((c) => [c.businessId, c.role, c.origin])).toEqual([
      ['luna', 'inspector', 'routine'], ['rival', 'inspector', 'routine'], ['honest', 'inspector', 'routine'],
    ]);
    expect(caseOf(w).hints).toEqual(['Routine inspection', 'Never inspected, open 6 months']);
    expect(lawMonthClose({ ...lawWorld(), day: 150 }, lawCtx).cases).toEqual([]);
    expect(lawMonthClose({ ...w, day: 210 }, lawCtx).cases).toHaveLength(3);
  });

  it('an inspection that never happened turns into an overdue flag', () => {
    let w = lawMonthClose({ ...lawWorld(), day: 180 }, lawCtx);
    w = { ...w, day: 185, cases: w.cases.map((c) => ({ ...c, status: 'closed' as const, outcome: 'dismissed' as const, closedDay: 185 })) };
    w = lawMonthClose({ ...w, day: 210 }, lawCtx);
    expect(caseOf(w, 'case-4')).toMatchObject({ businessId: 'luna', origin: 'flag', role: 'inspector' });
    expect(caseOf(w, 'case-4').hints).toEqual(['Inspection overdue', 'Never inspected, open 7 months']);
  });

  it('after an inspection the clock restarts and the hint says how long ago it was', () => {
    const inspected = { id: 'case-1', businessId: 'luna', role: 'inspector' as const, origin: 'routine' as const, openedDay: 175, hints: [], status: 'closed' as const, officialId: 'of_insp', takenDay: 176, inspectDay: 177, outcome: 'clean' as const, closedDay: 177 };
    const w = { ...lawWorld(), day: 390 - 30, cases: [inspected] };
    const closed = lawMonthClose(w, lawCtx);
    expect(closed.cases.filter((c) => c.businessId === 'luna')).toHaveLength(2);
    expect(caseOf(closed, 'case-2').hints).toEqual(['Routine inspection', 'No inspection in 6 months']);
  });
});

describe('suspicious numbers (quarterly)', () => {
  const payroll = 5 * 17 * 140;
  const five = business('luna', 'Luna Cafe', 'pl_luna', 'p1', { orders: orders({ staff: { barista: 5 } }) });

  it('payroll taxes look low for a shop with 5 staff paying cash', () => {
    const hidden = Math.round(payroll * 0.1235);
    expect(suspiciousNumbers(five, lawCtx, [1, 2, 3].map((m) => payrollMonth(m, payroll, hidden)))).toEqual(['Payroll taxes look low for 5 staff']);
  });

  it('a small shop and an honest shop are not flagged', () => {
    const four = business('luna', 'Luna Cafe', 'pl_luna', 'p1');
    const hidden = Math.round(4 * 17 * 140 * 0.1235);
    expect(suspiciousNumbers(four, lawCtx, [1, 2, 3].map((m) => payrollMonth(m, 4 * 17 * 140, hidden)))).toEqual([]);
    expect(suspiciousNumbers(five, lawCtx, [1, 2, 3].map((m) => payrollMonth(m, payroll, 0)))).toEqual([]);
  });

  it('reported sales look low when a quarter of revenue is hidden', () => {
    const skim = (amount: number) => [1, 2, 3].map((m) => payrollMonth(m, payroll, 0, [{ id: 'saving:skim_cash_sales', label: 'Kept', kind: 'saving', amount }]));
    expect(suspiciousNumbers(five, lawCtx, skim(293))).toEqual([]);
    expect(suspiciousNumbers(five, lawCtx, skim(500))).toEqual(['Reported sales look low for the foot traffic']);
  });

  it('lawDay opens a flag case on the first day of a new quarter', () => {
    const hidden = Math.round(payroll * 0.1235);
    const w = lawWorld({ day: 90, luna: { orders: orders({ staff: { barista: 5 } }), history: [1, 2, 3].map((m) => payrollMonth(m, payroll, hidden)) } });
    const day91 = lawDay({ ...w, day: 91 }, lawCtx);
    expect(day91.cases).toHaveLength(1);
    expect(caseOf(day91)).toMatchObject({ businessId: 'luna', role: 'tax_auditor', origin: 'flag', status: 'open' });
    expect(caseOf(day91).hints[0]).toBe('Payroll taxes look low for 5 staff');
    expect(lawDay({ ...w, day: 92 }, lawCtx).cases).toEqual([]);
  });
});
