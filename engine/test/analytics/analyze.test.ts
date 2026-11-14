import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/analytics';
import { ctx, lived, r2 } from './helpers';

// Ручной расчёт: постоянные расходы F = аренда + зарплаты + налоги на зарплату + ежемесячные строки пакета
// + уборка за место + рычаги; переменные на единицу v = себестоимость + стаканы + эквайринг × цена.
const FIXED_LINES = 1100 + 260 + 120 + 150 + 260 + 90 + 220 + 350;   // без страховки за работника
const payrollTaxes = (payroll: number) => r2(0.0765 * payroll) + r2(0.006 * payroll) + r2(0.041 * payroll);
const v = (price: number) => 2.1 + 0.28 + 0.029 * price;

describe('analyze — break-even matches a hand calculation', () => {
  it('example 1: 820 sq ft on Bedford, 18 seats, $7.50, three baristas', () => {
    const { w, b } = lived([{ id: 'x', placeId: 'p_bedford_212', kitId: 'standard', orders: { price: 7.5, staff: { barista: 3 } } }], 10);
    const payroll = 3 * 18 * 160;
    const F = r2(820 * 95 / 12) + payroll + payrollTaxes(payroll) + FIXED_LINES + 110 * 3 + 10 * 18 + 450;
    const a = analyze(b, w, ctx);
    expect(a.fixedCostsMonth).toBeCloseTo(F, 2);                       // 19 708.71
    expect(a.breakEvenUnitsMonth).toBe(Math.ceil(F / (7.5 - v(7.5))));  // 4 021
    expect(a.breakEvenRevenueMonth).toBeCloseTo(Math.ceil(F / (7.5 - v(7.5))) * 7.5, 1);
    const q = a.revenue / 7.5;
    expect(a.breakEvenPrice!).toBeCloseTo((F / q + 2.38) / (1 - 0.029), 1);
  });

  it('example 2: 600 sq ft on Graham, 12 seats, $6.00, two baristas, deep clean and local ads', () => {
    const { w, b } = lived([{ id: 'x', placeId: 'p_graham_102', kitId: 'lean', orders: { price: 6, staff: { barista: 2 }, levers: { cleaning: 'full', marketing: 'local' } } }], 10);
    const payroll = 2 * 18 * 160;
    const F = 2400 + payroll + payrollTaxes(payroll) + FIXED_LINES + 110 * 2 + 10 * 12 + 900 + 600;
    const a = analyze(b, w, ctx);
    expect(a.fixedCostsMonth).toBeCloseTo(F, 2);                       // 13 261.36
    expect(a.breakEvenUnitsMonth).toBe(Math.ceil(F / (6 - v(6))));      // 3 849
    expect(a.contributionPerUnit).toBeCloseTo(6 - v(6), 2);
  });

  it('example 3: 1,400 sq ft on Grand, 26 seats, $9.00, manager on autopilot, specialty beans, long hours', () => {
    const { w, b } = lived([{ id: 'x', placeId: 'p_grand_450', kitId: 'premium', orders: { price: 9, staff: { barista: 2, shift_lead: 1 }, autopilot: 'manager', levers: { beans: 'specialty', hours: 'extended' } } }], 10);
    const payroll = 2 * 18 * 160 + 22 * 160 + 5200;
    const F = r2(1400 * 62 / 12) + payroll + payrollTaxes(payroll) + FIXED_LINES + 110 * 3 + 10 * 26 + 450 + 700 + 1100;
    const a = analyze(b, w, ctx);
    expect(a.fixedCostsMonth).toBeCloseTo(F, 2);                       // 28 891.61
    expect(a.breakEvenUnitsMonth).toBe(Math.ceil(F / (9 - v(9))));      // 4 544
  });
});

describe('analyze — the rest of the fields', () => {
  it('projects the month from the days so far', () => {
    const { w, b } = lived([{ id: 'x', placeId: 'p_bedford_212' }], 15);
    const a = analyze(b, w, ctx);
    const sold = b.days.reduce((s, d) => s + d.revenue, 0);
    expect(a.daysIntoMonth).toBe(15);
    expect(a.revenue).toBeCloseTo(sold * 2, 0);
    expect(a.primeCostPct).toBeCloseTo(a.cogsPct + a.laborPct, 3);
  });

  it('payback is null and runway is counted when the business loses money', () => {
    const { w, b } = lived([{ id: 'x', placeId: 'p_grand_450', size: 30, orders: { price: 5, staff: { barista: 8 } } }], 10);
    const a = analyze(b, w, ctx);
    expect(a.profit).toBeLessThan(0);
    expect(a.paybackMonths).toBeNull();
    expect(a.cashRunwayMonths).toBeGreaterThan(0);
  });

  it('payback = invested ÷ monthly profit when profitable', () => {
    const { w, b } = lived([{ id: 'x', placeId: 'p_graham_102', kitId: 'lean', orders: { staff: { barista: 3 } } }], 10);
    const a = analyze(b, w, ctx);
    expect(a.profit).toBeGreaterThan(0);
    expect(a.paybackMonths).toBeCloseTo(a.setupInvested / a.profit, 0);
    expect(a.cashRunwayMonths).toBeNull();
  });

  it('exposure sums the fines for every hidden violation', () => {
    const { w, b } = lived([{ id: 'x', placeId: 'p_bedford_212', orders: { shortcuts: ['cash_wages'] } }], 30);
    const trail = b.trails.find((t) => t.violationId === 'off_books_payroll')!;
    expect(analyze(b, w, ctx).exposure).toBeCloseTo(500 + 1.5 * trail.saved, -1); // the law module rounds fines to whole dollars
  });

  it('benchmarks compare with the pack norms and tax due comes from liabilities', () => {
    const { w, b } = lived([{ id: 'x', placeId: 'p_bedford_212' }], 35);
    const a = analyze(b, w, ctx);
    const rent = a.benchmarks.find((x) => x.metric.startsWith('Rent'))!;
    expect(rent.industry).toBe(0.1);
    expect(rent.verdict).toBe('bad');                                  // NYC rent ~20% of sales
    expect(a.taxDueNext?.day).toBe(110);
    expect(a.nicheKpis.map((k) => k.id)).toContain('avg_ticket');
  });

  it('does not mutate its input', () => {
    const { w, b } = lived([{ id: 'x', placeId: 'p_bedford_212' }], 5);
    const before = JSON.stringify(w);
    analyze(b, w, ctx);
    expect(JSON.stringify(w)).toBe(before);
  });
});
