// The real packs of agent 14 (packs/_common.json, packs/cafe.json) through the economy: skipped while they are not in the repo.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CommonPack, Pack, WorldState } from '@ohh/shared';
import { applyAction, createWorld, tickDay, type EngineCtx } from '../../src/index';
import { priceAdvice } from '../../src/economy/advice';
import { config, owner, place } from '../fixtures/world';

const file = (name: string) => new URL(`../../../packs/${name}`, import.meta.url);
const has = existsSync(file('cafe.json')) && existsSync(file('_common.json'));
const load = <T>(name: string): T => JSON.parse(readFileSync(file(name), 'utf8')) as T;

/** n honest cafes with one kit on the notes' space (800 sq ft at $90/sq ft/yr = $6,000 rent, foot traffic 0.5), launched when permits are ready. */
function city(n: number, opts: { kit?: string; size?: number; manager?: boolean } = {}) {
  const cafe = load<Pack>('cafe.json');
  const ctx: EngineCtx = { packs: { common: load<CommonPack>('_common.json'), niches: { cafe } }, places: Array.from({ length: n }, (_, i) => place(i + 1)) };
  let w: WorldState = { ...createWorld(config()), players: Array.from({ length: n }, (_, i) => owner(i + 1)) };
  const act = (pid: string, a: Parameters<typeof applyAction>[3]) => {
    const r = applyAction(w, ctx, pid, a);
    if (r.error) throw new Error(`${pid} ${a.type}: ${r.error}`);
    w = r.world;
  };
  const kit = cafe.kits.find((k) => k.id === (opts.kit ?? 'standard'))!;
  for (let i = 1; i <= n; i++) {
    act(`pl${i}`, { type: 'open_business', niche: 'cafe', placeId: `p${i}`, name: `Cafe ${i}`, kitId: kit.id, size: opts.size ?? kit.size });
    if (opts.manager) act(`pl${i}`, { type: 'set_orders', orders: { autopilot: 'manager' } });
  }
  const ready = Math.max(0, ...w.businesses[0].permits.map((p) => p.readyDay));
  while (w.day < ready) w = tickDay(w, ctx);
  for (let i = 1; i <= n; i++) act(`pl${i}`, { type: 'launch' });
  return { w, ctx, cafe, run: (until: number) => { while (w.day < until) w = tickDay(w, ctx); return w; } };
}

const beforeOwnerTaxes = (lines: { kind: string; amount: number }[]) => lines.filter((l) => !['setup', 'tax', 'saving', 'fine'].includes(l.kind)).reduce((a, l) => a + l.amount, 0);

describe.skipIf(!has)('real packs: packs/cafe.json and packs/_common.json', () => {
  it('an honest standard cafe sells about 200 checks a day at $8.50; with a hired manager it keeps about $4,000 before owner taxes, as in the notes', () => {
    const c = city(6, { manager: true });
    const w = c.run(180);
    expect(w.businesses.every((b) => b.status === 'open')).toBe(true);
    for (const m of w.businesses[0].history.slice(1)) {
      expect(m.servedUnits / 30).toBeGreaterThan(190);
      expect(m.servedUnits / 30).toBeLessThan(210);
      expect(m.avgPrice).toBe(c.cafe.unit.refPrice);
      expect(beforeOwnerTaxes(m.lines)).toBeGreaterThan(2_800);
      expect(beforeOwnerTaxes(m.lines)).toBeLessThan(5_500);
      expect(m.profit).toBeGreaterThan(0);
    }
  });

  it('a whole season: nobody honest goes bankrupt, every month adds up to the change of cash, profit stays under 25% of sales', () => {
    const w = city(6).run(360);
    for (const b of w.businesses) {
      expect(b.status).not.toBe('bankrupt');
      for (const m of b.history) expect(m.lines.reduce((a, l) => a + l.amount, 0)).toBeCloseTo(m.cashEnd - m.cashStart, 1);
      const rev = b.history.reduce((a, m) => a + m.revenue, 0);
      const profit = b.history.reduce((a, m) => a + m.profit, 0);
      expect(profit).toBeGreaterThan(0);
      expect(profit).toBeLessThan(0.25 * rev);
    }
  });

  it('too few seats earn less than the default room; price advice stays near the reference', () => {
    const profit = (size: number) => city(6, { size }).run(150).businesses[0].history.slice(1).reduce((a, m) => a + m.profit, 0);
    const def = profit(load<Pack>('cafe.json').sizing.default);
    expect(def).toBeGreaterThan(profit(10));
    const c = city(6);
    const w = c.run(60);
    const p = priceAdvice(w.businesses[0], w, c.ctx)!;
    expect(p).toBeGreaterThanOrEqual(c.cafe.unit.refPrice);
    expect(p).toBeLessThanOrEqual(c.cafe.unit.refPrice * 1.15);
  });
});
