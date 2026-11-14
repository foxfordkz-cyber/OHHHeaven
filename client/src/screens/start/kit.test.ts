import { describe, expect, it } from 'vitest';
import type { BusinessState, Place, PublicBusiness } from '@ohh/shared/types';
import { fixtureCafePack, fixtureCommon, fixtureOpenRecommendations, fixturePlaces, ownerViewSetup } from '../../app/fixtures';
import {
  competitorsNear, daysToOpen, distanceM, fineLabel, freePlaces, groupLines, kitLines, kitTotal, maxSizeFor, permitsProgress, rentPerMonth,
  requiredIds, spentSoFar, toggleItem, trafficLabel, violationFor,
} from './kit';

const pack = fixtureCafePack;
const standard = fixtureOpenRecommendations[0];
const place = (id: string): Place => fixturePlaces.find((p) => p.id === id)!;

describe('kit lines and totals', () => {
  it('multiplies by qty, and by size for items that scale with size', () => {
    const lines = kitLines(pack, standard.items, 24);
    expect(lines.find((l) => l.item.id === 'grinder')).toMatchObject({ units: 2, cost: 2_400 });
    expect(lines.find((l) => l.item.id === 'seating')).toMatchObject({ units: 24, cost: 24 * 180 });
    expect(kitTotal(pack, standard.items, 24)).toBe(standard.total);
    expect(kitTotal(pack, standard.items, 23)).toBe(standard.total - 180);
  });

  it('skips unknown items and empty quantities', () => {
    expect(kitLines(pack, [{ id: 'nope', qty: 1 }, { id: 'pos', qty: 0 }], 10)).toEqual([]);
  });

  it('groups lines by kind and the subtotals add up to the total', () => {
    const groups = groupLines(kitLines(pack, standard.items, standard.size));
    expect(groups.map((g) => g.group.id)).toEqual(['legal', 'space', 'equipment', 'furniture', 'stock']);
    expect(groups.reduce((s, g) => s + g.subtotal, 0)).toBe(standard.total);
  });
});

describe('place facts', () => {
  it('fits the size into the usable floor and the pack limits', () => {
    expect(maxSizeFor(pack, place('p12'))).toBe(28); // 850 × 0.6 ÷ 18
    expect(maxSizeFor(pack, place('p10'))).toBe(16); // 480 × 0.6 ÷ 18
    expect(maxSizeFor(pack, undefined)).toBe(pack.sizing.max);
  });

  it('turns the yearly rent per square foot into a monthly rent', () => {
    expect(rentPerMonth(place('p01'))).toBe(9_000);
  });

  it('measures distance and counts rivals of the same niche within 400 m', () => {
    expect(Math.round(distanceM({ lat: 40.7262, lng: -73.9832 }, { lat: 40.7272, lng: -73.9832 }))).toBe(111);
    const biz = (id: string, placeId: string, niche: PublicBusiness['niche'], status: PublicBusiness['status'] = 'open'): PublicBusiness =>
      ({ id, name: id, ownerName: 'x', isAi: false, niche, placeId, status, price: 6, reputation: 0.5, rankInNiche: 1, trust: { kept: 0, broken: 0 }, partners: [] });
    const rivals = [biz('a', 'p02', 'cafe'), biz('b', 'p04', 'cafe'), biz('c', 'p02', 'barbershop'), biz('d', 'p12', 'cafe', 'bankrupt')];
    expect(competitorsNear(place('p01'), 'cafe', rivals, fixturePlaces)).toBe(2);
  });

  it('lists free places that suit the niche, busiest first', () => {
    const taken: PublicBusiness[] = [{ id: 'x', name: 'x', ownerName: 'x', isAi: true, niche: 'cafe', placeId: 'p05', status: 'open', price: 6, reputation: 0.5, rankInNiche: 1, trust: { kept: 0, broken: 0 }, partners: [] }];
    const free = freePlaces(fixturePlaces, 'cafe', taken);
    expect(free.some((p) => p.id === 'p05')).toBe(false);
    expect(free.every((p) => p.suitableFor.includes('cafe'))).toBe(true);
    expect(free[0].footTraffic).toBeGreaterThanOrEqual(free[free.length - 1].footTraffic);
    expect(trafficLabel(0.9)).toBe('Very busy');
    expect(trafficLabel(0.2)).toBe('Quiet');
  });
});

describe('rules of the setup', () => {
  it('cannot open before the slowest permit', () => {
    expect(daysToOpen(pack, standard.items)).toBe(21);
    expect(daysToOpen(pack, [{ id: 'pos', qty: 1 }])).toBe(0);
  });

  it('knows required items and toggles optional ones', () => {
    expect(requiredIds(pack).has('fse_permit')).toBe(true);
    expect(requiredIds(pack).has('seating')).toBe(false);
    const without = toggleItem(standard.items, 'seating', false);
    expect(without.some((i) => i.id === 'seating')).toBe(false);
    expect(toggleItem(without, 'seating', true).some((i) => i.id === 'seating')).toBe(true);
    expect(toggleItem(standard.items, 'seating', true)).toBe(standard.items);
  });

  it('finds the violation of working without an item and describes the fine', () => {
    const permit = pack.setup.find((s) => s.id === 'fse_permit')!;
    const v = violationFor(permit, pack, fixtureCommon)!;
    expect(v.id).toBe('no_fse_permit');
    expect(fineLabel(v)).toBe('Fine $1,000 (up to $2,000) · closed 7 days');
    expect(violationFor(pack.setup.find((s) => s.id === 'pos')!, pack, fixtureCommon)).toBeUndefined();
  });
});

describe('waiting for permits', () => {
  it('reports days left and readiness per permit', () => {
    const b = ownerViewSetup.business as BusinessState;
    const now = permitsProgress(b, 74, pack);
    expect(now.find((p) => p.itemId === 'fse_permit')).toMatchObject({ daysLeft: 17, ready: false, name: 'Food Service Establishment Permit' });
    const later = permitsProgress(b, 95, pack);
    expect(later.every((p) => p.ready && p.progress === 1)).toBe(true);
  });

  it('counts setup and costs booked while waiting', () => {
    const b = ownerViewSetup.business as BusinessState;
    expect(spentSoFar(b)).toBe(b.setupSpent + 1_307);
  });
});
