// The napkin sum of a careful resident (bots/src/runway.ts) on the real coffee pack and the real map.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { OpenRecommendation, Pack, PackSet, Place } from '../../shared/src/types';
import { lastsThroughRamp, runwayOf } from '../src/runway';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const json = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), 'utf8')) as T;
const cafe = json<Pack>('packs/cafe.json');
const packs: PackSet = { common: json('packs/_common.json'), niches: { cafe } };
const places = json<Place[]>('data/places.json').filter((p) => p.suitableFor.includes('cafe') && (p.pedestriansPerDay ?? 0) > 3000);
const ctx = { packs, places };
const door = [...places].sort((a, b) => (a.pedestriansPerDay ?? 0) - (b.pedestriansPerDay ?? 0))[0];   // a quiet block: the crowd, not the room, limits the orders

const plan = (over: Partial<OpenRecommendation> = {}): OpenRecommendation => ({
  kitId: 'standard', size: 18, items: [], total: 150_000, cashLeft: cafe.startCapital - 150_000, daysToOpen: 81, why: [],
  orders: { price: cafe.unit.refPrice, staff: { [cafe.staff[0].id]: 3 }, levers: {}, shortcuts: [], blockFund: false, autopilot: 'hold' },
  ...over,
});

describe('runway: does the money last until the shop pays for itself', () => {
  it('is deterministic and counts the rent of the wait', () => {
    const a = runwayOf(ctx, 'cafe', door, plan())!;
    expect(runwayOf(ctx, 'cafe', door, plan())).toEqual(a);
    expect(a.waitRent).toBeCloseTo((door.sqft * door.rentPerSqftYear) / 12 * (81 / 30), 2);
  });

  it('a longer wait and a bigger bill only lower the lowest cash', () => {
    const base = runwayOf(ctx, 'cafe', door, plan())!;
    expect(runwayOf(ctx, 'cafe', door, plan({ daysToOpen: 180 }))!.lowestCash).toBeLessThan(base.lowestCash);
    expect(runwayOf(ctx, 'cafe', door, plan({ total: 200_000 }))!.lowestCash).toBeLessThan(base.lowestCash);
  });

  it('neighbours take orders; spending everything on the setup fails the check', () => {
    // a full team, so the room and not the staff limits the orders
    const big = plan({ size: cafe.sizing.max, orders: { ...plan().orders, staff: { [cafe.staff[0].id]: cafe.capacity.maxStaff } } });
    const alone = runwayOf(ctx, 'cafe', door, big)!;
    const crowded = runwayOf(ctx, 'cafe', door, big, 3)!;
    expect(crowded.matureOrdersDay).toBeLessThan(alone.matureOrdersDay);
    const broke = runwayOf(ctx, 'cafe', door, plan({ total: cafe.startCapital - 1_000 }))!;
    expect(broke.lowestCash).toBeLessThan(0);
    expect(lastsThroughRamp(broke)).toBe(false);
    expect(lastsThroughRamp(runwayOf(ctx, 'cafe', door, plan({ total: 60_000, daysToOpen: 0 })))).toBe(true);
  });

  it('a door without footfall data or an unknown niche: no opinion', () => {
    expect(runwayOf(ctx, 'cafe', { ...door, pedestriansPerDay: undefined }, plan())).toBeNull();
    expect(runwayOf(ctx, 'barbershop', door, plan())).toBeNull();
    expect(lastsThroughRamp(null)).toBe(true);
  });
});
