import { describe, expect, it } from 'vitest';
import { cafePack } from '../fixtures/cafe';
import { cafeCity, run } from '../fixtures/world';

const profitAt = (size: number) => {
  let { w, ctx } = cafeCity(6, { size, placesOver: { sqft: 1400 } });
  w = run(w, ctx, 180 - w.day);
  const b = w.businesses[0];
  return { profit: b.history.slice(1).reduce((a, m) => a + m.profit, 0), b };
};

describe('room size', () => {
  it('too few and too many seats both earn less than the recommended size', () => {
    const rec = profitAt(cafePack.sizing.default);
    const few = profitAt(8);
    const many = profitAt(40);
    expect(rec.profit).toBeGreaterThan(few.profit);
    expect(rec.profit).toBeGreaterThan(many.profit);
    expect(few.b.history[2].lost.size).toBeGreaterThan(1000);
    expect(few.b.days.some((d) => d.notes.some((n) => /^Line out the door: \d+ customers walked away$/.test(n)))).toBe(true);
    expect(many.b.days.some((d) => d.notes.some((n) => n.startsWith('Empty room')))).toBe(true);
    expect(many.b.reputation).toBeLessThan(rec.b.reputation);
  });
});
