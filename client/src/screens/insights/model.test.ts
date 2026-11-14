import { describe, expect, it } from 'vitest';
import { cafeSetupView, cafeStrugglingView, cafeView, monthLines, monthReport, HEALTHY_PLANS } from './fixtures';
import { advisorPresets, benchmarkRow, breakEvenModel, capacityModel, costGroups, costModel, headline, riskModel, taxModel, trendModel } from './model';

describe('fixtures are honest books', () => {
  it('every month: the lines add up to the change in cash', () => {
    for (const m of cafeView.business!.history) {
      const sum = m.lines.reduce((s, l) => s + l.amount, 0);
      expect(Math.round((m.cashStart + sum) * 100) / 100).toBe(m.cashEnd);
    }
  });
  it('profit leaves out setup and sales tax that only passes through', () => {
    const m = monthReport(HEALTHY_PLANS[0], 75000, 0);
    expect(m.profit).toBeLessThan(0);
    expect(m.cashEnd).toBeLessThan(m.cashStart + m.profit);   // setup money is gone as well
  });
});

describe('headline numbers', () => {
  it('shows profit, cash, runway and payback with the payback sentence', () => {
    const stats = headline(cafeView);
    expect(stats.map((s) => s.key)).toEqual(['profit', 'cash', 'runway', 'payback']);
    expect(stats[0].value.startsWith('+$')).toBe(true);
    expect(stats[2].value).toBe('In profit');
    expect(stats[3].sub).toMatch(/^Payback: \d+ months at this pace$/);
  });
  it('a losing cafe has a runway in months and no payback', () => {
    const stats = headline(cafeStrugglingView);
    expect(stats[0].tone).toBe('bad');
    expect(stats[2].value).toMatch(/months$/);
    expect(stats[3].value).toBe('Not yet');
  });
  it('a cafe still in setup has nothing to show', () => {
    expect(headline(cafeSetupView)).toEqual([]);
  });
});

describe('break-even caption', () => {
  it('says how many sales are needed and how many are on track', () => {
    const m = breakEvenModel(cafeView)!;
    const a = cafeView.analytics!;
    expect(m.caption).toBe(`You need ${a.breakEvenUnitsMonth!.toLocaleString('en-US')} orders a month to break even. You are on track for 5,420.`);
    expect(m.ahead).toBe(true);
    expect(breakEvenModel(cafeStrugglingView)!.ahead).toBe(false);
  });
});

describe('cost structure', () => {
  it('groups last month into six buckets and leaves out pass-through sales tax', () => {
    const lines = monthLines(HEALTHY_PLANS[4]);
    const g = costGroups(lines);
    expect(g.map((x) => x.key)).toEqual(['cogs', 'labor', 'rent', 'other', 'taxes', 'fines']);
    expect(g.find((x) => x.key === 'labor')!.amount).toBe(10260 + 1130);
    expect(g.find((x) => x.key === 'taxes')!.amount).toBe(420);       // income tax only, no sales tax
    expect(g.find((x) => x.key === 'fines')!.amount).toBe(300);
  });
  it('the bar uses the last full month and its shares add to 100%', () => {
    const m = costModel(cafeView)!;
    expect(m.period).toBe('May, last full month');
    expect(m.segments.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 10);
  });
  it('reads benchmarks the way an owner says them', () => {
    expect(benchmarkRow({ metric: 'laborPct', you: 0.38, industry: 0.3, verdict: 'bad' }).text).toBe('Labor 38% · industry 30% · high');
    expect(benchmarkRow({ metric: 'netMarginPct', you: -0.09, industry: 0.06, verdict: 'bad' }).word).toBe('low');
    expect(benchmarkRow({ metric: 'rentPct', you: 22, industry: 10, verdict: 'bad' }).text).toBe('Rent 22% · industry 10% · high');
  });
});

describe('trend, capacity, taxes, risk', () => {
  it('adds this month as a forecast point and marks inspections, fines and events', () => {
    const t = trendModel(cafeView);
    expect(t.points.at(-1)).toMatchObject({ month: 6, partial: true });
    expect(t.marks.map((m) => m.kind).sort()).toEqual(['event', 'event', 'fine', 'inspection', 'inspection']);
  });
  it('names the reason for lost sales and prices them', () => {
    const c = capacityModel(cafeView)!;
    expect(c.reasons[0].label).toBe('Not enough seats');
    expect(c.lostMoney).toBe(Math.round(c.lostUnits * cafeView.business!.orders.price));
    expect(c.headline).toMatch(/orders lost in the last 30 days · \$/);
  });
  it('knows when the next tax is due and whether cash covers it', () => {
    const ok = taxModel(cafeView)!;
    expect(ok.next).toMatchObject({ amount: 9172, day: 170, label: 'Tue, Jun 20', inDays: 8 });
    expect(ok.enough).toBe(true);
    const short = taxModel(cafeStrugglingView)!;
    expect(short.enough).toBe(false);
    expect(short.shortBy).toBe(Math.round(6810 - cafeStrugglingView.business!.cash));
  });
  it('puts fines-if-found next to what cutting corners saved', () => {
    const r = riskModel(cafeView)!;
    expect(r).toMatchObject({ exposure: 4230, saved: 2820, tone: 'bad' });
    expect(r.verdict).toBe('If they find it today you pay $4,230: $1,410 more than you saved.');
    expect(riskModel(cafeStrugglingView)!.tone).toBe('good');
  });
});

describe('advisor questions', () => {
  it('picks the three that fit the situation', () => {
    const q = advisorPresets(cafeView);
    expect(q).toHaveLength(3);
    expect(q).toContain('Is paying cash wages worth the risk?');
    expect(q).toContain('Where do I find a coffee supplier in real life?');
  });
  it('a losing cafe is asked how to stop losing money first', () => {
    expect(advisorPresets(cafeStrugglingView)).toContain('How do I stop losing money?');
  });
});
