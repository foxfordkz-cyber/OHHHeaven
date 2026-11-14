import { describe, expect, it } from 'vitest';
import { exposureOf, fineFor, findViolations, savingsOf, shortcutSavings } from '../../src/law/index';
import { lawCafePack, lawCommonPack } from '../fixtures/law-packs';
import { business, lawCtx, orders } from '../fixtures/law-world';

const base = { payroll: 9520, revenue: 19500, rent: 9000, staffCount: 4 };
const violation = (id: string) => [...lawCafePack.violations, ...lawCommonPack.violations].find((v) => v.id === id)!;

describe('shortcutSavings', () => {
  it('cash wages: a saving line and a trail that grows every month', () => {
    const b = business('luna', 'Luna Cafe', 'pl_luna', 'p1', { orders: orders({ shortcuts: ['cash_wages'] }) });
    const m1 = shortcutSavings(b, lawCtx, base, 1);
    expect(m1.lines).toEqual([{ id: 'saving:cash_wages', label: 'Kept: Pay staff in cash, off the books', kind: 'saving', amount: 1176 }]);
    expect(m1.trails).toEqual([{ violationId: 'off_books_payroll', months: 1, saved: 1176, lastActiveMonth: 1, discovered: false }]);
    const m2 = shortcutSavings({ ...b, trails: m1.trails }, lawCtx, base, 2);
    expect(m2.trails).toEqual([{ violationId: 'off_books_payroll', months: 2, saved: 2352, lastActiveMonth: 2, discovered: false }]);
  });

  it('a lever option with causes leaves a trail; saved = cheapest legal option minus the chosen one', () => {
    const b = business('luna', 'Luna Cafe', 'pl_luna', 'p1', { orders: orders({ levers: { cleaning: 'minimal' } }) });
    const r = shortcutSavings(b, lawCtx, base, 3);
    expect(r.lines).toEqual([]);
    expect(r.trails).toEqual([{ violationId: 'dirty_surfaces', months: 1, saved: 350, lastActiveMonth: 3, discovered: false }]);
  });

  it('opening before the permit is ready leaves a trail only for months worked without it', () => {
    const b = business('luna', 'Luna Cafe', 'pl_luna', 'p1', { openedDay: 5, permits: [{ itemId: 'fse_permit', appliedDay: 1, readyDay: 26 }] });
    const m1 = shortcutSavings(b, lawCtx, base, 1);
    expect(m1.trails).toEqual([{ violationId: 'no_fse_permit', months: 1, saved: 0, lastActiveMonth: 1, discovered: false }]);
    expect(shortcutSavings({ ...b, trails: m1.trails }, lawCtx, base, 2).trails).toEqual(m1.trails);
  });

  it('a permit bought without waiting counts as held; no permit at all is a violation', () => {
    const instant = business('luna', 'Luna Cafe', 'pl_luna', 'p1', { permits: [] });
    expect(shortcutSavings(instant, lawCtx, base, 1).trails).toEqual([]);
    const none = business('luna', 'Luna Cafe', 'pl_luna', 'p1', { permits: [], items: [{ id: 'espresso_machine', qty: 1 }] });
    expect(shortcutSavings(none, lawCtx, base, 1).trails.map((t) => t.violationId)).toEqual(['no_fse_permit']);
  });

  it('a business still in setup leaves no permit trail', () => {
    const b = business('luna', 'Luna Cafe', 'pl_luna', 'p1', { status: 'setup', openedDay: undefined, permits: [], items: [] });
    expect(shortcutSavings(b, lawCtx, base, 1).trails).toEqual([]);
  });

  it('honest orders: no lines, no trails, and the input is returned untouched', () => {
    const b = business('honest', 'Honest Beans', 'pl_honest', 'p3');
    const r = shortcutSavings(b, lawCtx, base, 1);
    expect(r).toEqual({ lines: [], trails: [] });
  });
});

describe('savingsOf', () => {
  it('handles every basis', () => {
    const s = (basis: 'fixed' | 'pct_payroll' | 'pct_revenue' | 'pct_rent' | 'per_staff', amount: number) =>
      savingsOf({ id: 'x', name: 'x', what: 'x', saves: { basis, amount }, violation: 'v' }, base);
    expect([s('fixed', 180), s('pct_payroll', 0.1), s('pct_revenue', 0.015), s('pct_rent', 0.05), s('per_staff', 100)]).toEqual([180, 952, 293, 450, 400]);
  });
});

describe('fineFor', () => {
  it('base + perMonth × months + pctOfSaved × saved', () => {
    expect(fineFor(violation('off_books_payroll'), 6, 7056)).toBe(11084);
    expect(fineFor(violation('no_fse_permit'), 2, 0)).toBe(2000);
  });
  it('stops at max', () => {
    expect(fineFor(violation('dirty_surfaces'), 20, 10000)).toBe(2000);
  });
});

describe('findViolations and exposureOf', () => {
  const b = business('luna', 'Luna Cafe', 'pl_luna', 'p1', {
    trails: [
      { violationId: 'off_books_payroll', months: 6, saved: 7056, lastActiveMonth: 6, discovered: false },
      { violationId: 'dirty_surfaces', months: 2, saved: 700, lastActiveMonth: 6, discovered: false },
    ],
  });

  it('an inspection finds only what belongs to its role', () => {
    expect(findViolations(b, lawCtx, 'tax_auditor', 'report', 185).map((f) => f.violationId)).toEqual(['off_books_payroll']);
    expect(findViolations(b, lawCtx, 'inspector', 'routine', 185).map((f) => f.violationId)).toEqual(['dirty_surfaces']);
  });

  it('expired trails are not found', () => {
    expect(findViolations(b, lawCtx, 'tax_auditor', 'report', 361)).toEqual([]);
  });

  it('exposure is the sum of fines if everything were found', () => {
    expect(exposureOf(b, lawCtx)).toBe(11084 + 850);
  });
});
