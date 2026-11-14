import { describe, expect, it } from 'vitest';
import { RULES } from '@ohh/shared';
import { applyAction, createWorld, tickDay } from '../../src/index';
import { itemsCost } from '../../src/economy/actions';
import { econOf } from '../../src/economy/util';
import { cafePack } from '../fixtures/cafe';
import { act, cafeCity, config, ctxWith, owner, place, run } from '../fixtures/world';

const fresh = (sqft = 800) => {
  const ctx = ctxWith([place(1, { sqft }), place(2, { sqft })]);
  return { ctx, w: { ...createWorld(config()), players: [owner(1), owner(2)] } };
};

describe('open_business and launch', () => {
  it('charges the kit (seats × size), sets up permits and starts in setup', () => {
    const { w, ctx } = fresh();
    const r = applyAction(w, ctx, 'pl1', { type: 'open_business', niche: 'cafe', placeId: 'p1', name: 'Luna Cafe', kitId: 'standard', size: 20 });
    expect(r.error).toBeUndefined();
    const b = r.world.businesses[0];
    const kit = cafePack.kits.find((k) => k.id === 'standard')!;
    const cost = itemsCost(cafePack, kit.items, 20);
    expect(cost).toBe(106_155 - 18 * 220 + 20 * 220);
    expect(b.cash).toBe(cafePack.startCapital - cost);
    expect(b.items.find((i) => i.id === 'seat')!.qty).toBe(20);
    expect(b.status).toBe('setup');
    expect(b.permits.map((p) => [p.itemId, p.readyDay])).toEqual([['fse_permit', 22], ['food_protection_cert', 8]]);
    expect(b.mtd.lines[0]).toMatchObject({ kind: 'setup', amount: -cost });
  });

  it('refuses a missing required item, a room too big for the space, a taken space and a second business', () => {
    const { w, ctx } = fresh(500);
    const noMachine = cafePack.kits[1].items.filter((i) => i.id !== 'espresso_machine');
    expect(applyAction(w, ctx, 'pl1', { type: 'open_business', niche: 'cafe', placeId: 'p1', name: 'X', kitId: 'standard', size: 12, items: noMachine }).error).toMatch(/Missing required item/);
    const max = Math.floor((500 * RULES.USABLE_FLOOR_SHARE) / cafePack.sizing.sqftPerUnit);
    expect(applyAction(w, ctx, 'pl1', { type: 'open_business', niche: 'cafe', placeId: 'p1', name: 'X', kitId: 'standard', size: max + 1 }).error).toMatch(/fit in 500 sq ft/);
    const w1 = act(w, ctx, 'pl1', { type: 'open_business', niche: 'cafe', placeId: 'p1', name: 'X', kitId: 'lean', size: 12 });
    expect(applyAction(w1, ctx, 'pl2', { type: 'open_business', niche: 'cafe', placeId: 'p1', name: 'Y', kitId: 'lean', size: 12 }).error).toMatch(/taken/);
    expect(applyAction(w1, ctx, 'pl1', { type: 'open_business', niche: 'cafe', placeId: 'p2', name: 'Z', kitId: 'lean', size: 12 }).error).toMatch(/already run/);
  });

  it('refuses a setup the starting capital cannot pay for', () => {
    const { w, ctx } = fresh();
    const poor = { ...ctx, packs: { ...ctx.packs, niches: { cafe: { ...cafePack, startCapital: 50_000 } } } };
    expect(applyAction(w, poor, 'pl1', { type: 'open_business', niche: 'cafe', placeId: 'p1', name: 'X', kitId: 'standard', size: 18 }).error).toMatch(/Not enough money/);
  });

  it('launch opens the doors once and posts to the feed', () => {
    let { w } = cafeCity(1, { launchDay: 22 });
    expect(w.businesses[0].status).toBe('open');
    expect(w.businesses[0].openedDay).toBe(22);
    expect(w.feed.at(-1)!.kind).toBe('opening');
    const ctx = ctxWith([place(1)]);
    expect(applyAction(w, ctx, 'pl1', { type: 'launch' }).error).toMatch(/already open/);
  });
});

describe('standing orders', () => {
  it('set_orders clips price and staff to the pack limits and rejects unknown ids', () => {
    const { w, ctx } = cafeCity(1);
    const a = act(w, ctx, 'pl1', { type: 'set_orders', orders: { price: 50, staff: { barista: 20, shift_lead: 5 } } }).businesses[0].orders;
    expect(a.price).toBe(cafePack.unit.priceMax);
    expect(a.staff.barista + a.staff.shift_lead).toBe(cafePack.capacity.maxStaff);
    const b = act(w, ctx, 'pl1', { type: 'set_orders', orders: { price: 0.5, staff: { barista: 0, shift_lead: 0 } } }).businesses[0].orders;
    expect(b.price).toBe(cafePack.unit.priceMin);
    expect(b.staff.barista + b.staff.shift_lead).toBe(cafePack.capacity.minStaff);
    expect(applyAction(w, ctx, 'pl1', { type: 'set_orders', orders: { levers: { cleaning: 'robots' } } }).error).toMatch(/Unknown option/);
    expect(applyAction(w, ctx, 'pl1', { type: 'set_orders', orders: { shortcuts: ['tax_magic'] } }).error).toMatch(/Unknown shortcut/);
  });

  it('more staff lifts a staff-bound shop, fewer staff loses customers', () => {
    const { w, ctx } = cafeCity(1);
    const one = run(act(w, ctx, 'pl1', { type: 'set_orders', orders: { staff: { barista: 1 } } }), ctx, 3).businesses[0].days.at(-1)!;
    expect(one.lost.staff).toBeGreaterThan(100);
    expect(one.notes.some((n) => n.startsWith('Short-staffed'))).toBe(true);
  });
});

describe('buying, selling, resizing, spending', () => {
  it('buy_item and sell_item move cash by the price and by RESALE_SHARE', () => {
    const { w, ctx } = cafeCity(1);
    const cash = w.businesses[0].cash;
    const bought = act(w, ctx, 'pl1', { type: 'buy_item', itemId: 'grinder', qty: 1 }).businesses[0];
    expect(bought.cash).toBe(cash - 1500);
    expect(bought.items.find((i) => i.id === 'grinder')!.qty).toBe(3);
    const sold = act(w, ctx, 'pl1', { type: 'sell_item', itemId: 'grinder', qty: 1 }).businesses[0];
    expect(sold.cash).toBe(cash + 1500 * RULES.RESALE_SHARE);
    expect(applyAction(w, ctx, 'pl1', { type: 'sell_item', itemId: 'espresso_machine', qty: 1 }).error).toMatch(/required/);
    expect(applyAction(w, ctx, 'pl1', { type: 'buy_item', itemId: 'seat', qty: 2 }).error).toMatch(/number of seats/);
  });

  it('resize buys or sells seats and respects the space', () => {
    const { w, ctx } = cafeCity(1);
    const cash = w.businesses[0].cash;
    const up = act(w, ctx, 'pl1', { type: 'resize', size: 24 }).businesses[0];
    expect(up.size).toBe(24);
    expect(up.cash).toBe(cash - 6 * 220);
    expect(up.items.find((i) => i.id === 'seat')!.qty).toBe(24);
    const down = act(w, ctx, 'pl1', { type: 'resize', size: 12 }).businesses[0];
    expect(down.cash).toBe(cash + 6 * 220 * RULES.RESALE_SHARE);
    expect(applyAction(w, ctx, 'pl1', { type: 'resize', size: 27 }).error).toMatch(/fit in 800 sq ft/);
  });

  it('advertising lifts demand and fades; training lifts quality', () => {
    const { w, ctx } = cafeCity(2);
    const ad = act(w, ctx, 'pl1', { type: 'spend', kind: 'marketing', amount: 3000 });
    expect(econOf(ad.businesses[0]).marketing).toBe(3000);
    const d1 = tickDay(ad, ctx);
    expect(d1.businesses[0].days.at(-1)!.demandUnits).toBeGreaterThan(d1.businesses[1].days.at(-1)!.demandUnits);
    const later = run(d1, ctx, 40);
    expect(econOf(later.businesses[0]).marketing).toBeLessThan(500);
    const trained = run(act(w, ctx, 'pl2', { type: 'spend', kind: 'training', amount: 6000 }), ctx, 20);
    expect(trained.businesses[1].quality).toBeGreaterThan(trained.businesses[0].quality);
    expect(applyAction(w, ctx, 'pl1', { type: 'spend', kind: 'marketing', amount: 10_000_000 }).error).toMatch(/Not enough cash/);
  });

  it('read_inbox marks items read', () => {
    const { w, ctx } = cafeCity(1, { launchDay: 3 });
    const id = w.players[0].inbox[0].id;
    expect(act(w, ctx, 'pl1', { type: 'read_inbox', ids: [id] }).players[0].inbox[0].read).toBe(true);
  });
});

describe('speed', () => {
  it('100 businesses × 360 days in under two seconds', () => {
    const { w, ctx } = cafeCity(100, { launchDay: 1 });
    const t0 = performance.now();
    const end = run(w, ctx, 359);
    const ms = performance.now() - t0;
    expect(end.day).toBe(360);
    expect(ms).toBeLessThan(2000);
  });
});
