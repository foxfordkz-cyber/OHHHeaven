import { describe, expect, it } from 'vitest';
import type { WorldState } from '@ohh/shared';
import { priceAdvice } from '../../src/economy/advice';
import { cafePack } from '../fixtures/cafe';
import { act, cafeCity, run } from '../fixtures/world';

const REF = cafePack.unit.refPrice;

describe('price advice from the demand model', () => {
  it('among honest rivals it advises a little above the reference, not the markup an elasticity formula gives', () => {
    let { w, ctx } = cafeCity(6);
    w = run(w, ctx, 10);
    const p = priceAdvice(w.businesses[0], w, ctx)!;
    expect(p).toBeGreaterThanOrEqual(REF);
    expect(p).toBeLessThanOrEqual(REF * 1.15);
    // rivals 40% above the reference do not drag the advice into the zone where customers leave
    const pricey: WorldState = { ...w, businesses: w.businesses.map((b, i) => (i === 0 ? b : { ...b, orders: { ...b.orders, price: REF * 1.4 } })) };
    expect(priceAdvice(w.businesses[0], pricey, ctx)!).toBeLessThanOrEqual(REF * 1.2);
    // a room too small for the demand may charge more
    const tiny = { ...w.businesses[0], size: 6 };
    expect(priceAdvice(tiny, w, ctx)!).toBeGreaterThan(p);
  });

  it('following it for a month earns more than the reference price and far more than a 50% markup', () => {
    let { w, ctx } = cafeCity(6);
    w = run(w, ctx, 30 - w.day);   // month 1 closed
    const advice = priceAdvice(w.businesses[0], w, ctx)!;
    const month2 = (price: number): number => {
      const x: WorldState = run(act(w, ctx, 'pl1', { type: 'set_orders', orders: { price } }), ctx, 30);
      return x.businesses[0].history.at(-1)!.profit;
    };
    const atRef = month2(REF), atAdvice = month2(advice), greedy = month2(REF * 1.5);
    expect(atAdvice).toBeGreaterThanOrEqual(atRef);
    expect(greedy).toBeLessThan(atRef - 5_000);
  });
});
