import { describe, expect, it } from 'vitest';
import { marketParams, monthlyDemand, priceSensitivity, type DemandInput } from '../../src/economy/demand';
import { economyDay } from '../../src/economy/day';
import { cafePack } from '../fixtures/cafe';
import { barbershopPack } from '../fixtures/barbershop';
import { packs } from '../fixtures/common';
import { act, config, ctxWith, owner, places, run } from '../fixtures/world';
import { createWorld } from '../../src/index';

const m = marketParams(cafePack);
const shop = (id: string, over: Partial<DemandInput> = {}): DemandInput => ({ id, price: 6.5, quality: 0.5, reputation: 0.5, footTraffic: 0.5, marketing: 0, ...over });

describe('demand model (report 43, generalised)', () => {
  it('identical businesses get equal shares, exactly unitsPerSlotMonth at the reference point', () => {
    const { demand } = monthlyDemand(m, [shop('a'), shop('b'), shop('c'), shop('d')]);
    for (const d of demand) expect(d).toBeCloseTo(cafePack.market.unitsPerSlotMonth, 6);
  });

  it('raising own price by 1% cuts own demand by about |priceElasticity| %', () => {
    for (const n of [1, 3, 6, 12]) {
      const base = monthlyDemand(m, Array.from({ length: n }, (_, i) => shop(`s${i}`)));
      const up = monthlyDemand(m, Array.from({ length: n }, (_, i) => shop(`s${i}`, i === 0 ? { price: 6.5 * 1.01 } : {})));
      const pct = ((up.demand[0] - base.demand[0]) / base.demand[0]) * 100;
      expect(pct).toBeGreaterThan(cafePack.market.priceElasticity * 1.1);
      expect(pct).toBeLessThan(cafePack.market.priceElasticity * 0.9);
    }
    expect(priceSensitivity(m, 4)).toBeGreaterThan(Math.abs(cafePack.market.priceElasticity));
  });

  it('when everyone raises prices the market shrinks', () => {
    const base = monthlyDemand(m, [shop('a'), shop('b'), shop('c')]).demand.reduce((a, b) => a + b, 0);
    const up = monthlyDemand(m, [shop('a', { price: 7.5 }), shop('b', { price: 7.5 }), shop('c', { price: 7.5 })]).demand.reduce((a, b) => a + b, 0);
    expect(up).toBeLessThan(base * 0.97);
  });

  it('quality, reputation, location and ads each raise a business share', () => {
    const base = monthlyDemand(m, [shop('a'), shop('b')]).demand[0];
    for (const over of [{ quality: 0.7 }, { reputation: 0.7 }, { footTraffic: 0.8 }, { marketing: 2000 }]) {
      expect(monthlyDemand(m, [shop('a', over), shop('b')]).demand[0]).toBeGreaterThan(base);
    }
  });

  it('businesses compete only inside their niche', () => {
    const pls = places(4);
    const ctx = ctxWith(pls, { ...packs, niches: { cafe: cafePack, barbershop: barbershopPack } });
    const build = (barberPrice: number) => {
      let w = { ...createWorld(config()), players: [owner(1), owner(2), owner(3), owner(4)] };
      w = act(w, ctx, 'pl1', { type: 'open_business', niche: 'cafe', placeId: 'p1', name: 'C1', kitId: 'standard', size: 18 });
      w = act(w, ctx, 'pl2', { type: 'open_business', niche: 'cafe', placeId: 'p2', name: 'C2', kitId: 'standard', size: 18 });
      w = act(w, ctx, 'pl3', { type: 'open_business', niche: 'barbershop', placeId: 'p3', name: 'B1', kitId: 'standard', size: 4 });
      w = act(w, ctx, 'pl4', { type: 'open_business', niche: 'barbershop', placeId: 'p4', name: 'B2', kitId: 'standard', size: 4 });
      w = run(w, ctx, 21);
      for (const p of ['pl1', 'pl2', 'pl3', 'pl4']) w = act(w, ctx, p, { type: 'launch' });
      w = act(w, ctx, 'pl3', { type: 'set_orders', orders: { price: barberPrice } });
      return economyDay({ ...w, day: w.day + 1 }, ctx);
    };
    const cheap = build(20), dear = build(60);
    const demandOf = (w: ReturnType<typeof build>, id: string) => w.businesses.find((b) => b.id === id)!.days.at(-1)!.demandUnits;
    expect(demandOf(cheap, 'biz_1')).toBe(demandOf(dear, 'biz_1'));
    expect(demandOf(cheap, 'biz_3')).toBeGreaterThan(demandOf(dear, 'biz_3'));
    expect(demandOf(cheap, 'biz_4')).toBeLessThan(demandOf(dear, 'biz_4'));
  });
});
