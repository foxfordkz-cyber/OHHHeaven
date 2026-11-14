import { describe, expect, it } from 'vitest';
import { breakEvenGeometry, dayBars, DEFAULT_BOX, linear, niceCeil, stackBar, ticks, trendGeometry } from './charts';

describe('scales', () => {
  it('maps domain ends to range ends and is linear in between', () => {
    const s = linear([0, 100], [10, 210]);
    expect(s(0)).toBe(10);
    expect(s(100)).toBe(210);
    expect(s(25)).toBe(60);
  });
  it('rounds axis ends up to tidy numbers', () => {
    expect([niceCeil(7), niceCeil(13), niceCeil(2400), niceCeil(6775), niceCeil(26000), niceCeil(0)]).toEqual([7.5, 15, 2500, 7500, 30000, 1]);
    expect(ticks(10000)).toEqual([0, 2500, 5000, 7500, 10000]);
  });
});

describe('break-even chart', () => {
  // fixed 20,560 a month, cost of a sale 2.12, price 6.50 → break-even 4,695 sales, on track for 5,420
  const g = breakEvenGeometry({ fixed: 20560, variable: 2.12, price: 6.5, breakEven: 4695, onTrack: 5420 });
  const { left, right, top, bottom, width, height } = DEFAULT_BOX;
  it('x axis runs from 0 to a tidy end past both markers', () => {
    expect(g.x.domain).toEqual([0, 7500]);
    expect(g.x(0)).toBe(left);
    expect(g.x(7500)).toBe(width - right);
  });
  it('y axis covers the higher of revenue and cost at the right edge', () => {
    expect(g.y.domain[1]).toBe(50000);           // revenue at 7,500 sales = 48,750
    expect(g.y(0)).toBe(height - bottom);
    expect(g.y(50000)).toBe(top);
  });
  it('lines start where they should: revenue at 0, total cost at fixed costs', () => {
    expect(g.revenue.startsWith(`M${left},${height - bottom}`)).toBe(true);
    expect(g.cost.startsWith(`M${left},${g.y(20560)}`)).toBe(true);
    expect(g.fixed).toBe(`M${left},${g.y(20560)} L${width - right},${g.y(20560)}`);
  });
  it('places the break-even and you-are-here markers on the revenue line', () => {
    expect(g.breakEven).toEqual({ x: g.x(4695), y: g.y(6.5 * 4695), value: 4695, label: 'break-even' });
    expect(g.here.x).toBe(g.x(5420));
    expect(g.here.y).toBe(g.y(6.5 * 5420));
    expect(g.here.x).toBeGreaterThan(g.breakEven!.x);   // ahead of break-even
    expect(g.profitArea).not.toBeNull();
  });
  it('has no break-even marker when a sale loses money', () => {
    const loss = breakEvenGeometry({ fixed: 20000, variable: 7, price: 6.5, breakEven: null, onTrack: 4000 });
    expect(loss.breakEven).toBeNull();
    expect(loss.profitArea).toBeNull();
    expect(loss.lossArea).not.toBeNull();
  });
  it('every coordinate stays inside the chart box', () => {
    for (const p of [g.here, g.breakEven!]) {
      expect(p.x).toBeGreaterThanOrEqual(left);
      expect(p.x).toBeLessThanOrEqual(width - right);
      expect(p.y).toBeGreaterThanOrEqual(top);
      expect(p.y).toBeLessThanOrEqual(height - bottom);
    }
  });
});

describe('trend chart', () => {
  const points = [
    { month: 1, revenue: 6825, profit: -8700, cash: 17700 },
    { month: 2, revenue: 29120, profit: -900, cash: 16800 },
    { month: 3, revenue: 32565, profit: 1300, cash: 18100, partial: true },
  ];
  const g = trendGeometry(points, [{ month: 2, kind: 'inspection', label: 'Grade A' }, { month: 9, kind: 'event', label: 'later' }]);
  it('spreads months evenly and draws negative profit below zero', () => {
    const xs = g.series[0].points.map((p) => p.x);
    expect(xs[1] - xs[0]).toBeCloseTo(xs[2] - xs[1], 1);
    expect(g.y.domain[0]).toBe(-10000);
    expect(g.series[1].points[0].y).toBeGreaterThan(g.zeroY);
    expect(g.series[1].points[2].y).toBeLessThan(g.zeroY);
  });
  it('keeps marks inside the shown months and flags the forecast point', () => {
    expect(g.marks).toEqual([{ x: g.x(2), kind: 'inspection', label: 'Grade A', month: 2 }]);
    expect(g.series[0].points[2].partial).toBe(true);
    expect(g.monthLabels.map((m) => m.label)).toEqual(['Jan', 'Feb', 'Mar']);
  });
});

describe('100% cost bar', () => {
  it('shares add to 1 and widths add to the bar width exactly', () => {
    const segs = stackBar([{ key: 'a', label: 'A', amount: 1 }, { key: 'b', label: 'B', amount: 2 }, { key: 'c', label: 'C', amount: 0 }, { key: 'd', label: 'D', amount: 3.3 }], 358);
    expect(segs.map((s) => s.key)).toEqual(['a', 'b', 'd']);
    expect(segs.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 10);
    expect(Math.round(segs.reduce((s, x) => s + x.width, 0) * 10) / 10).toBe(358);
    expect(segs[1].x).toBe(segs[0].width);
  });
  it('is empty when there are no costs', () => {
    expect(stackBar([{ key: 'a', label: 'A', amount: 0 }])).toEqual([]);
  });
});

describe('capacity bars', () => {
  it('stacks lost sales on top of served sales and never draws a negative height', () => {
    const { bars, y } = dayBars([{ day: 1, demandUnits: 233, servedUnits: 200 }, { day: 2, demandUnits: 150, servedUnits: 150 }]);
    expect(bars[0].lost).toBe(33);
    expect(bars[0].lostY).toBe(y(233));
    expect(bars[0].servedY).toBe(y(200));
    expect(bars[1].lostH).toBe(0);
    for (const b of bars) expect(b.servedH).toBeGreaterThanOrEqual(0);
  });
});
