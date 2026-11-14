import { describe, expect, it } from 'vitest';
import type { OwnerView } from '@ohh/shared/types';
import { cafeEndedView, cafeRiskyView, cafeSetupView, cafeStrugglingView, cafeView, MAYA_PLANS, monthLines, monthReport } from './fixtures';
import { advisorPresets, benchmarkRow, breakEvenModel, capacityModel, costGroups, costModel, headline, kpiValue, mergeMarks, metricKey, riskModel, taxLabel, taxModel, trendModel } from './model';

const VIEWS = { cafeView, cafeStrugglingView, cafeRiskyView, cafeSetupView, cafeEndedView };
const r2 = (v: number) => Math.round(v * 100) / 100;

describe('fixtures are honest books', () => {
  it('every month of every sample: the lines add up to the change in cash', () => {
    for (const v of Object.values(VIEWS)) {
      for (const m of v.business!.history) {
        const sum = m.lines.reduce((s, l) => s + l.amount, 0);
        expect(r2(m.cashStart + sum)).toBe(m.cashEnd);
      }
    }
  });
  it('sales tax still owed is the tax collected minus the tax paid', () => {
    for (const [name, v] of Object.entries(VIEWS)) {
      const b = v.business!;
      const lines = [...b.history.flatMap((m) => m.lines), ...b.mtd.lines];
      const collected = lines.filter((l) => l.id === 'sales_tax_collected').reduce((s, l) => s + l.amount, 0);
      const paid = -lines.filter((l) => l.id.startsWith('tax_paid_sales_tax')).reduce((s, l) => s + l.amount, 0);
      const owed = b.liabilities.filter((l) => !l.paid).reduce((s, l) => s + l.amount, 0);
      expect(r2(collected - paid), name).toBeCloseTo(owed, 1);
    }
  });
  it('profit leaves out setup and sales tax that only passes through', () => {
    const m = monthReport(MAYA_PLANS[0], 224000, 0);
    expect(m.profit).toBe(-5554.49);                                  // lead's example: −$5,554 in January
    expect(m.cashEnd).toBeLessThan(m.cashStart + m.profit);           // the $139,500 of setup is gone as well
    expect(monthReport(MAYA_PLANS[2], 0, 0).profit).toBe(4152.15);    // March, 20 seats: +$4,152
  });
});

describe('headline numbers', () => {
  it('shows profit, cash, runway and payback with the payback sentence', () => {
    const stats = headline(cafeView);
    expect(stats.map((s) => s.key)).toEqual(['profit', 'cash', 'runway', 'payback']);
    expect(stats[0].value).toBe('+$6,098');
    expect(stats[1].sub).toBe('$11,288 of it is tax you owe');
    expect(stats[2].value).toBe('In profit');
    expect(stats[3].sentence).toBe('Payback: 23 months at this pace');
    expect(stats[3].sub).toBe('at this pace');
  });
  it('a losing cafe has a runway in months, no payback, and owes more tax than it has', () => {
    const stats = headline(cafeStrugglingView);
    expect(stats[0]).toMatchObject({ value: '−$4,026', tone: 'bad' });
    expect(stats[1]).toMatchObject({ value: '$9,800', tone: 'bad', sub: 'you owe $16,295 of tax: more than you have' });
    expect(stats[2].value).toBe('2.4 months');
    expect(stats[3]).toMatchObject({ value: 'Not yet', sub: 'at this pace the $150k you put in does not come back' });
  });
  it('out of cash is said plainly', () => {
    const b = cafeStrugglingView.business!;
    expect(headline({ ...cafeStrugglingView, business: { ...b, cash: -120 } })[2].value).toBe('Out of cash');
  });
  it('a cafe still in setup has nothing to show', () => {
    expect(headline(cafeSetupView)).toEqual([]);
  });
});

describe('break-even caption', () => {
  it('says how many sales are needed and how many are on track', () => {
    expect(breakEvenModel(cafeView)).toMatchObject({ caption: 'You need 5,205 orders a month to break even. You are on track for 6,235.', ahead: true });
    expect(breakEvenModel(cafeStrugglingView)).toMatchObject({ caption: 'You need 7,896 orders a month to break even. You are on track for 7,200.', ahead: false });
  });
  it('a sale that loses money has no break-even', () => {
    const a = cafeView.analytics!;
    const m = breakEvenModel({ ...cafeView, analytics: { ...a, breakEvenUnitsMonth: null } })!;
    expect(m.ahead).toBeNull();
    expect(m.caption).toMatch(/^Each order costs more than it brings in/);
  });
});

describe('cost structure', () => {
  it('groups a month into six buckets; sales tax collected and paid are not costs', () => {
    const april = monthLines(MAYA_PLANS[3]);
    expect(april.some((l) => l.id === 'tax_paid_sales_tax_d110' && l.amount === -8939.35)).toBe(true);   // lead: $8,939 on April 20
    const g = costGroups(april);
    expect(g.map((x) => x.key)).toEqual(['cogs', 'labor', 'rent', 'other', 'taxes', 'fines']);
    expect(g.find((x) => x.key === 'labor')!.amount).toBe(21000);
    expect(g.find((x) => x.key === 'other')!.amount).toBe(5950.45);    // card fees, utilities… and the $300 block fund
    expect(g.find((x) => x.key === 'taxes')!.amount).toBe(0);
    expect(costGroups(monthLines({ ...MAYA_PLANS[3], fine: 13312 })).find((x) => x.key === 'fines')!.amount).toBe(13312);
  });
  it('the bar uses the last full month and its shares add to 100%', () => {
    const m = costModel(cafeView)!;
    expect(m.period).toBe('May, last full month');
    expect(m.segments.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 10);
    expect(m.rows.map((r) => r.text)).toContain('Labor 40% · industry 32% · high');
  });
  it('reads benchmarks the way an owner says them, from keys or from agent 04 labels', () => {
    expect(benchmarkRow({ metric: 'laborPct', you: 0.38, industry: 0.3, verdict: 'bad' }).text).toBe('Labor 38% · industry 30% · high');
    expect(benchmarkRow({ metric: 'Labor, % of sales', you: 0.38, industry: 0.3, verdict: 'bad' })).toMatchObject({ metric: 'laborPct', text: 'Labor 38% · industry 30% · high' });
    expect(benchmarkRow({ metric: 'Cost of goods, % of sales', you: 0.26, industry: 0.3, verdict: 'good' }).text).toBe('Cost of sales 26% · industry 30% · low');
    expect(benchmarkRow({ metric: 'Net margin', you: -0.09, industry: 0.06, verdict: 'bad' }).word).toBe('low');
    expect(benchmarkRow({ metric: 'Net margin', you: 0.12, industry: 0.06, verdict: 'good' }).word).toBe('high');
    expect(benchmarkRow({ metric: 'Prime cost, % of sales', you: 0.62, industry: 0.62, verdict: 'good' }).word).toBe('normal');
    expect(benchmarkRow({ metric: 'rentPct', you: 22, industry: 10, verdict: 'bad' }).text).toBe('Rent 22% · industry 10% · high');
  });
  it('maps agent 04 labels to keys', () => {
    expect(['Cost of goods, % of sales', 'Labor, % of sales', 'Prime cost, % of sales', 'Rent, % of sales', 'Net margin', 'Something new'].map(metricKey))
      .toEqual(['cogsPct', 'laborPct', 'primeCostPct', 'rentPct', 'netMarginPct', 'Something new']);
  });
});

describe('trend, capacity, taxes, risk', () => {
  it('adds this month as a forecast point and marks events and inspections', () => {
    const t = trendModel(cafeView);
    expect(t.points.at(-1)).toMatchObject({ month: 6, partial: true });
    expect(t.marks).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'event', month: 2, label: 'Blizzard warning' })]));
    expect(t.marks.map((m) => m.kind).sort()).toEqual(['event', 'inspection']);
    // at the end of the season past events come from the inbox, as the host sends them
    expect(trendModel(cafeEndedView).marks.map((m) => m.kind).sort()).toEqual(['event', 'event', 'event', 'inspection', 'inspection']);
  });
  it('one mark per month and kind, however many notices came', () => {
    expect(mergeMarks([
      { month: 4, kind: 'event', label: 'Weekend farmers market' }, { month: 4, kind: 'event', label: 'Coffee bean prices jump' },
      { month: 4, kind: 'event', label: 'Weekend farmers market' }, { month: 4, kind: 'inspection', label: 'Grade A' },
    ])).toEqual([
      { month: 4, kind: 'event', label: 'Weekend farmers market · Coffee bean prices jump' }, { month: 4, kind: 'inspection', label: 'Grade A' },
    ]);
  });
  it('marks a month with a fine', () => {
    const b = cafeView.business!;
    const v: OwnerView = { ...cafeView, business: { ...b, history: b.history.map((m) => (m.month === 3 ? { ...m, fines: 300 } : m)) } };
    expect(trendModel(v).marks).toEqual(expect.arrayContaining([{ month: 3, kind: 'fine', label: 'Fine $300' }]));
  });
  it('names the reason for lost sales and prices them', () => {
    const c = capacityModel(cafeView)!;
    expect(c.reasons[0].label).toBe('Not enough seats');
    expect(c.lostMoney).toBe(Math.round(c.lostUnits * cafeView.business!.orders.price));
    expect(c.headline).toMatch(/^\d+ orders lost in the last 30 days · \$/);
  });
  it('knows when the next tax is due and whether cash covers it', () => {
    const ok = taxModel(cafeView)!;
    expect(ok.next).toMatchObject({ amount: 11288.47, day: 200, label: 'Thu, Jul 20', inDays: 38 });
    expect(ok.enough).toBe(true);
    const short = taxModel(cafeStrugglingView)!;
    expect(short.next).toMatchObject({ amount: 13578.75, label: 'Fri, Apr 20', inDays: 5 });   // lead: $13,579 on April 20
    expect(short).toMatchObject({ enough: false, shortBy: 3779 });                           // with $9,800 in cash
    expect(short.items).toHaveLength(2);                                                     // the second quarter is building up
  });
  it('puts fines-if-found next to what cutting corners saved', () => {
    const r = riskModel(cafeRiskyView)!;
    expect(r).toMatchObject({ exposure: 13312, saved: 5656, tone: 'bad' });
    expect(r.verdict).toBe('If they find it today you pay $13,312: $7,656 more than you saved.');
    expect(riskModel(cafeView)!.tone).toBe('good');
  });
  it('names open violations from the packs and does not compare with savings that are not there', () => {
    const b = cafeView.business!;
    const v: OwnerView = {
      ...cafeView, analytics: { ...cafeView.analytics!, exposure: 1500 },
      business: { ...b, trails: [{ violationId: 'no_fse_permit', months: 1, saved: 0, lastActiveMonth: 1, discovered: false }] },
    };
    const r = riskModel(v, (id) => (id === 'no_fse_permit' ? 'Operating without a food service permit' : undefined))!;
    expect(r.open).toEqual([{ violationId: 'no_fse_permit', name: 'Operating without a food service permit', months: 1, saved: 0 }]);
    expect(r.verdict).toBe('If they find it today you pay $1,500 in fines.');
    expect(riskModel(v)!.open[0].name).toBe('No fse permit');
  });
  it('says taxes by name: the pack’s, then a known one, then the id in words', () => {
    expect(taxLabel('sales_tax', () => 'NYC sales tax')).toBe('NYC sales tax');
    expect(taxLabel('employer_fica')).toBe('Employer Social Security and Medicare');
    expect(taxLabel('nys_withholding_tax')).toBe('NYS withholding tax');
    const b = cafeStrugglingView.business!;
    const v: OwnerView = { ...cafeStrugglingView, business: { ...b, liabilities: [...b.liabilities, { taxId: 'ny_unemployment', amount: 1602, dueDay: 110, paid: false }] } };
    expect(taxModel(v)!.items.map((i) => i.label)).toEqual(['Sales tax', 'NY unemployment insurance', 'Sales tax']);
  });
});

describe('niche numbers', () => {
  it('formats money, shares and counts; units from the packs come in the singular', () => {
    expect(kpiValue(7.5, '$')).toBe('$7.50');
    expect(kpiValue(242, '$')).toBe('$242');
    expect(kpiValue(0.6542, '%')).toBe('65%');
    expect(kpiValue(204, 'order')).toBe('204 orders');
    expect(kpiValue(5.7, 'order')).toBe('5.7 orders');
    expect(kpiValue(1, 'order')).toBe('1 order');
    expect(kpiValue(208, 'orders')).toBe('208 orders');
  });
});

describe('advisor questions', () => {
  it('picks the three that fit the situation', () => {
    const q = advisorPresets(cafeRiskyView);
    expect(q).toHaveLength(3);
    expect(q).toContain('Is paying cash wages worth the risk?');
    expect(q).toContain('Where do I find a coffee supplier in real life?');
  });
  it('a losing cafe is asked how to stop losing money and how to pay the tax', () => {
    expect(advisorPresets(cafeStrugglingView)).toEqual(['How do I stop losing money?', 'How do I pay $13,579 of tax due Fri, Apr 20?', 'Where do I find a coffee supplier in real life?']);
  });
  it('before opening, the questions are about permits', () => {
    expect(advisorPresets(cafeSetupView)[0]).toBe('What permits do I need before I open?');
  });
});
