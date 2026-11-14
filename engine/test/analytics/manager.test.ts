import { describe, expect, it } from 'vitest';
import { managerOrders } from '../../src/analytics';
import { cafePack, commonPack, makeBusiness, makeWorld, sampleWorld } from '../../src/analytics/__stubs__/fixtures';
import { ctx, run } from './helpers';

const risky = new Set(cafePack.levers.flatMap((l) => l.options.filter((o) => o.causes).map((o) => `${l.id}:${o.id}`)));
const shortcutIds = new Set([...cafePack.shortcuts, ...commonPack.shortcuts].map((s) => s.id));

describe('managerOrders', () => {
  it('never turns on a violation and never makes deals', () => {
    for (const w of [run(sampleWorld(), 40), run(makeWorld([makeBusiness({ id: 'x', placeId: 'p_bedford_212', size: 6 })]), 12)]) {
      for (const b of w.businesses.filter((x) => x.niche === 'cafe')) {
        const o = managerOrders(b, w, ctx);
        for (const s of o.shortcuts ?? []) expect(shortcutIds.has(s) && !b.orders.shortcuts.includes(s)).toBe(false);
        for (const [l, opt] of Object.entries(o.levers ?? {})) expect(risky.has(`${l}:${opt}`)).toBe(false);
        expect(o.blockFund).toBeUndefined();
        expect(o.autopilot).toBeUndefined();
      }
    }
  });

  it('switches off corners the owner cut when the risk outweighs the saving', () => {
    const w = run(makeWorld([makeBusiness({ id: 'cheat', placeId: 'p_bedford_212', orders: { shortcuts: ['cash_wages'], levers: { cleaning: 'minimal' } } })]), 35);
    const o = managerOrders(w.businesses[0], w, ctx);
    expect(o.shortcuts).toEqual([]);
    expect(o.levers?.cleaning).not.toBe('minimal');
  });

  it('adds a worker when the line is long', () => {
    const w = run(makeWorld([makeBusiness({ id: 'short', placeId: 'p_bedford_212', orders: { staff: { barista: 1 } } })]), 10);
    const o = managerOrders(w.businesses[0], w, ctx);
    expect((o.staff?.barista ?? 1)).toBeGreaterThan(1);
  });
});
