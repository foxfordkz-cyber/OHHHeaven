import { describe, expect, it } from 'vitest';
import type { GameEvent, PackSet, Place, PublicBusiness } from '@ohh/shared/types';
import {
  activeFundBlocks, blockSegments, businessMarkers, capacityFor, closedBlocks, competitorsNearby, distanceM, liveEvents,
  occupiedPlaceIds, partnerLines, placeFeatures, rentPerMonth, todayWeather, trafficLabel,
} from './geo';

const place = (id: string, lat: number, lng: number, extra: Partial<Place> = {}): Place => ({
  id, address: id, block: 'E 7th St, 1st Ave–Ave A', lat, lng, kind: 'storefront', sqft: 1000, tier: 'mid',
  rentPerSqftYear: 96, footTraffic: 0.5, suitableFor: ['cafe', 'barbershop'], ...extra,
});
const biz = (id: string, placeId: string, extra: Partial<PublicBusiness> = {}): PublicBusiness => ({
  id, name: id, ownerName: 'x', isAi: false, niche: 'cafe', placeId, status: 'open', price: 5, reputation: 0.5,
  rankInNiche: 1, trust: { kept: 0, broken: 0 }, partners: [], ...extra,
});

const A = place('a', 40.7260, -73.9840);
const B = place('b', 40.7262, -73.9838);               // ~27 m from A
const C = place('c', 40.7300, -73.9900, { block: 'E 9th St, 1st–2nd Ave' }); // ~650 m away

describe('place facts', () => {
  it('rent per month = $/sq ft/yr × sq ft ÷ 12', () => {
    expect(rentPerMonth(A)).toBe(8000);
  });
  it('labels foot traffic', () => {
    expect(trafficLabel(0.8)).toBe('High');
    expect(trafficLabel(0.5)).toBe('Medium');
    expect(trafficLabel(0.2)).toBe('Low');
  });
  it('capacity uses usable floor share and pack sizing when given', () => {
    expect(capacityFor(A, 'cafe').units).toBe(Math.floor((1000 * 0.6) / 18));
    const packs = { common: {}, niches: { cafe: { sizing: { unitName: 'seats', sqftPerUnit: 20, max: 25 } } } } as unknown as PackSet;
    expect(capacityFor(A, 'cafe', packs)).toEqual({ units: 25, unitName: 'seats' });
  });
  it('measures distance in meters', () => {
    expect(distanceM(A, B)).toBeGreaterThan(20);
    expect(distanceM(A, B)).toBeLessThan(35);
  });
});

describe('occupancy and rivals', () => {
  it('bankrupt businesses free their place', () => {
    const taken = occupiedPlaceIds([biz('x', 'a'), biz('y', 'b', { status: 'bankrupt' })]);
    expect([...taken]).toEqual(['a']);
  });
  it('counts same-niche rivals within the radius only', () => {
    const list = [biz('x', 'b'), biz('y', 'c'), biz('z', 'b', { niche: 'barbershop' })];
    expect(competitorsNearby(A, 'cafe', list, [A, B, C])).toBe(1);
    expect(competitorsNearby(A, 'cafe', list, [A, B, C], 1000)).toBe(2);
  });
  it('marks places free, other niche or taken', () => {
    const fc = placeFeatures([A, B, place('d', 40.727, -73.983, { suitableFor: ['rentals'], kind: 'building' })], [biz('x', 'b')], 'cafe');
    expect(fc.features.map((f) => f.properties.state)).toEqual(['free', 'taken', 'other']);
  });
});

describe('business markers and deals', () => {
  it('dims closed and bankrupt businesses and draws mine last', () => {
    const m = businessMarkers([biz('mine', 'a'), biz('closed', 'b', { status: 'closed' }), biz('gone', 'c', { status: 'bankrupt' })], [A, B, C], 'mine');
    expect(m.at(-1)?.id).toBe('mine');
    expect(m.find((x) => x.id === 'closed')?.dim).toBe(true);
    expect(m.find((x) => x.id === 'gone')?.dim).toBe(true);
  });
  it('skips businesses whose place is unknown', () => {
    expect(businessMarkers([biz('x', 'nowhere')], [A])).toHaveLength(0);
  });
  it('draws one line per partner pair', () => {
    const fc = partnerLines([biz('x', 'a', { partners: ['y'] }), biz('y', 'c', { partners: ['x'] })], [A, C]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry.coordinates).toEqual([[A.lng, A.lat], [C.lng, C.lat]]);
  });
});

describe('blocks, events, weather', () => {
  it('makes one stretched segment per block with two or more places', () => {
    const seg = blockSegments([A, B, C]);
    expect([...seg.keys()]).toEqual(['E 7th St, 1st Ave–Ave A']);
    const [p, q] = seg.get('E 7th St, 1st Ave–Ave A')!;
    expect(distanceM({ lng: p[0], lat: p[1] }, { lng: q[0], lat: q[1] })).toBeGreaterThan(distanceM(A, B) + 40);
  });
  it('lists only active block funds', () => {
    expect(activeFundBlocks([
      { block: 'x', month: 1, contributors: 3, eligible: 4, active: true, feeMonth: 300 },
      { block: 'y', month: 1, contributors: 1, eligible: 4, active: false, feeMonth: 300 },
    ])).toEqual(['x']);
  });
  const ev = (id: string, kind: GameEvent['kind'], announcedDay: number, startDay: number, endDay: number, block?: string): GameEvent =>
    ({ id, kind, title: id, text: '', announcedDay, startDay, endDay, effects: [], origin: 'deck', block });
  it('keeps announced events until they end and closes streets only while active', () => {
    const events = [ev('a', 'traffic', 10, 12, 14, 'St Marks Pl, 2nd–3rd Ave'), ev('b', 'supply', 20, 22, 30), ev('c', 'traffic', 1, 2, 5, 'x')];
    expect(liveEvents(events, 11).map((e) => e.id)).toEqual(['a']);
    expect(closedBlocks(events, 11)).toEqual([]);
    expect(closedBlocks(events, 13)).toEqual(['St Marks Pl, 2nd–3rd Ave']);
    expect(closedBlocks(events)).toEqual(['St Marks Pl, 2nd–3rd Ave', 'x']);
  });
  it('picks today from a forecast', () => {
    const w = [{ day: 5, tempF: 50, condition: 'rain' as const, footTrafficMult: 0.8, label: 'r' }, { day: 6, tempF: 60, condition: 'clear' as const, footTrafficMult: 1, label: 'c' }];
    expect(todayWeather(w, 6)?.condition).toBe('clear');
    expect(todayWeather(w)?.condition).toBe('rain');
    expect(todayWeather(w[1])?.day).toBe(6);
    expect(todayWeather(undefined)).toBeUndefined();
  });
});
