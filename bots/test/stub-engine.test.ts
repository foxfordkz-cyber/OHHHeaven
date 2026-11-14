import { describe, expect, it } from 'vitest';
import type { WorldState } from '../../shared/src/types';
import { recommendedPrice, recommendOpening } from '../src/__stubs__/engine';
import { deckEvent, flatWeather, forecast, join } from '../src/__stubs__/host';
import { clonePacks } from '../src/__stubs__/packs';
import { ctx, emptyWorld, runSeason, setup, stubApi } from './helpers';

function deepFreeze<T>(o: T): T { if (o && typeof o === 'object') { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; }

describe('stub engine (agent 07 stand-in for @ohh/engine)', () => {
  it('every dollar is a line: month lines sum to the cash change', () => {
    const r = runSeason(stubApi, { ...setup(5), days: 120 });
    for (const b of r.world.businesses) for (const h of b.history) {
      const sum = h.lines.reduce((s, l) => s + l.amount, 0);
      expect(Math.abs(h.cashEnd - h.cashStart - sum)).toBeLessThan(0.05);
    }
  });

  it('identical businesses on one block get equal demand; inputs are not mutated', () => {
    let w: WorldState = emptyWorld(2);
    const places = ctx.places.filter((p) => p.block === ctx.places[12].block).slice(0, 2);
    const ids: string[] = [];
    for (let k = 0; k < 2; k++) { const r = join(w, { name: `Twin ${k}`, kind: 'owner' }); w = r.world; ids.push(r.playerId); }
    places.forEach((p, k) => {
      w = stubApi.applyAction(w, ctx, ids[k], { type: 'open_business', niche: 'cafe', placeId: p.id, name: `Twin ${k}`, kitId: 'standard', size: 14 }).world;
      w = stubApi.applyAction(w, ctx, ids[k], { type: 'launch' }).world;
    });
    w = { ...w, weather: flatWeather(1, 8) };
    deepFreeze(w);
    const next = stubApi.tickDay(w, ctx);
    const [a, b] = next.businesses.map((x) => x.days.at(-1)!);
    expect(a.demandUnits).toBeCloseTo(b.demandUnits, 6);
    expect(w.day).toBe(0);
  });

  it('price advice sits near the pack reference price; openings fit capital; weather and deck are seeded', () => {
    const packs = clonePacks();
    const w = { ...emptyWorld(1), businesses: Array.from({ length: 20 }, () => ({ niche: 'cafe', status: 'open' })) } as unknown as WorldState;
    const p = recommendedPrice({ niche: 'cafe' } as never, w, { packs, places: [] });
    expect(p).toBeGreaterThan(packs.niches.cafe!.unit.refPrice * 0.85);
    expect(p).toBeLessThan(packs.niches.cafe!.unit.refPrice * 1.25);
    for (const r of recommendOpening('cafe', ctx.places[0].id, emptyWorld(1), ctx)) expect(r.cashLeft).toBeGreaterThanOrEqual(0);
    expect(forecast(3, 1, 7)).toEqual(forecast(3, 1, 7));
    const evs = Array.from({ length: 24 }, (_, i) => deckEvent({ ...emptyWorld(4), day: (i + 1) * 15 }));
    expect(evs.some((e) => e !== null)).toBe(true);
    for (const e of evs) if (e) for (const ef of e.effects) { expect(ef.mult).toBeGreaterThanOrEqual(0.7); expect(ef.mult).toBeLessThanOrEqual(1.3); }
  });
});
