import { describe, expect, it } from 'vitest';
import { recommendOpening } from '../../src/analytics';
import { cafePack, places, sampleWorld } from '../../src/analytics/__stubs__/fixtures';
import { itemsCost, maxSizeForPlace } from '../../src/analytics/model';
import { ctx } from './helpers';

describe('recommendOpening', () => {
  const w = sampleWorld();

  it('offers three kits that fit the space and the capital, with orders and reasons', () => {
    const recs = recommendOpening('cafe', 'p_graham_102', w, ctx);
    expect(recs.map((r) => r.kitId).sort()).toEqual(['lean', 'premium', 'standard']);
    const place = places.find((p) => p.id === 'p_graham_102')!;
    for (const r of recs) {
      expect(r.total).toBeLessThanOrEqual(cafePack.startCapital);
      expect(r.total).toBeCloseTo(itemsCost(cafePack, r.items, r.size), 2);
      expect(r.cashLeft).toBeCloseTo(cafePack.startCapital - r.total, 2);
      expect(r.size).toBeLessThanOrEqual(maxSizeForPlace(cafePack, place));
      expect(r.orders.shortcuts).toEqual([]);
      expect(r.daysToOpen).toBe(30);                                   // longest wait: DOB alteration permit
      expect(r.why.length).toBeGreaterThanOrEqual(3);
      expect(r.why.length).toBeLessThanOrEqual(4);
      for (const y of r.why) expect(y).toMatch(/\d/);
      for (const s of cafePack.setup.filter((x) => x.required)) expect(r.items.some((i) => i.id === s.id)).toBe(true);
    }
  });

  it('trims a kit that does not fit the space', () => {
    const premium = recommendOpening('cafe', 'p_graham_102', w, ctx).find((r) => r.kitId === 'premium')!;
    expect(premium.size).toBe(20);                                     // 600 sq ft × 0.6 ÷ 18
    expect(premium.why[0]).toContain('trimmed from 26');
  });

  it('trims a kit that does not fit the capital', () => {
    const poor = { ...ctx, packs: { ...ctx.packs, niches: { cafe: { ...cafePack, startCapital: 70000 } } } };
    const recs = recommendOpening('cafe', 'p_bedford_212', w, poor);
    for (const r of recs) expect(r.total).toBeLessThanOrEqual(70000);
    const premium = recs.find((r) => r.kitId === 'premium')!;
    expect(premium.items.some((i) => i.id === 'design_upgrade')).toBe(false);
    expect(premium.why[1]).toContain('Dropped');
  });

  it('is deterministic', () => {
    expect(recommendOpening('cafe', 'p_bedford_212', w, ctx)).toEqual(recommendOpening('cafe', 'p_bedford_212', w, ctx));
  });
});
