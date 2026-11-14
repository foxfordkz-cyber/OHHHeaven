import { describe, expect, it } from 'vitest';
import type { Pack, Place, PublicBusiness } from '@ohh/shared/types';
import { baselineOrdersDay, buildoutOf, daysToOpenOf, rentMonthOf } from '@ohh/shared/place';
import cafeJson from '../../../packs/cafe.json';
import placesJson from '../../../data/places.json';
import { daysLabel, placeFacts, placeStake, playingRivalsNear, rivalMeaning, unitsFit, versusMe } from './placeFacts';

const pack = cafeJson as unknown as Pack;
const places = placesJson as unknown as Place[];
const ev1 = places.find((p) => p.id === 'ev-001')!;

const biz = (id: string, placeId: string, extra: Partial<PublicBusiness> = {}): PublicBusiness => ({
  id, name: id, ownerName: 'x', isAi: false, niche: 'cafe', placeId, status: 'open', price: 8.5, reputation: 0.5,
  rankInNiche: 1, trust: { kept: 0, broken: 0 }, partners: [], ...extra,
});

/** Another real place of the dataset at the given distance band from ev-001 (meters), for rivals. */
function placeAround(minM: number, maxM: number): Place {
  const p = places.find((x) => {
    if (x.id === ev1.id) return false;
    const d = Math.hypot((x.lat - ev1.lat) * 111_040, (x.lng - ev1.lng) * 111_320 * Math.cos((ev1.lat * Math.PI) / 180));
    return d > minM && d < maxM;
  });
  if (!p) throw new Error(`no place ${minM}–${maxM} m from ev-001`);
  return p;
}

describe('placeFacts — the place card reads the same numbers the engine charges', () => {
  it('passers-by, rent, build-out and days to open come from the data and shared/src/place.ts', () => {
    const f = placeFacts(ev1, pack, [], places);
    expect(f.passersBy).toBe(ev1.pedestriansPerDay);
    expect(f.rentMonth).toBe(Math.round(rentMonthOf(ev1)));
    const build = buildoutOf(pack, ev1)!;
    expect(f.former?.build.days).toBe(build.days);
    expect(f.former?.build.cost).toBe(build.cost);
    expect(f.former?.takeover).toBe(false);
    // the cheapest kit of the pack decides "opens from" and the days to open
    const days = Math.min(...pack.kits.map((k) => daysToOpenOf(pack, k.items, ev1)));
    expect(f.opening!.days).toBeGreaterThanOrEqual(days);
    expect(f.opening!.days).toBeGreaterThanOrEqual(build.days);
    expect(f.radiusM).toBe(250);
  });

  it('with no playing rival the orders a day equal the engine baseline', () => {
    const f = placeFacts(ev1, pack, [], places);
    expect(f.ordersDay).not.toBeNull();
    expect(f.ordersDay!).toBeCloseTo(baselineOrdersDay(pack, ev1)!, 6);
    expect(f.ordersDayAlone).toBeCloseTo(f.ordersDay!, 6);
    const s = f.split!;
    expect(s.yourShare).toBeCloseTo(1 / (s.you + s.real + s.players + s.outside), 9);
    expect(s.players).toBe(0);
    expect(s.real).toBeGreaterThan(0); // ev-001 has five real cafés within 150 m
  });

  it('a playing café nearby takes part of the passers-by; a far one does not', () => {
    const near = placeAround(20, 120);
    const far = placeAround(400, 900);
    const alone = placeFacts(ev1, pack, [], places).ordersDay!;
    const withNear = placeFacts(ev1, pack, [biz('maya', near.id)], places);
    const withFar = placeFacts(ev1, pack, [biz('viktor', far.id)], places);
    expect(withNear.ordersDay!).toBeLessThan(alone);
    expect(withNear.playingRivals).toHaveLength(1);
    expect(withNear.playingRivals[0].overlap).toBeGreaterThan(0.4);
    expect(withFar.ordersDay!).toBeCloseTo(alone, 6);
    expect(withFar.playingRivals).toHaveLength(0);
  });

  it('a rival still getting ready is listed but does not take customers yet; the stake says what it will cost', () => {
    const near = placeAround(20, 120);
    const f = placeFacts(ev1, pack, [biz('Maya', near.id, { status: 'setup' })], places);
    expect(f.playingRivals[0].status).toBe('setup');
    expect(f.ordersDay!).toBeCloseTo(placeFacts(ev1, pack, [], places).ordersDay!, 6);
    const stake = placeStake(f);
    expect(stake).toMatch(/^Maya is getting ready \d+ m away/);
    const [from, to] = [...stake.matchAll(/(\d+) (?:to|orders)/g)].map((m) => Number(m[1]));
    expect(to).toBeLessThan(from);
  });

  it('bankrupt businesses, other niches, my own business and the place itself are not rivals', () => {
    const near = placeAround(20, 120);
    const list = [
      biz('gone', near.id, { status: 'bankrupt' }),
      biz('cuts', near.id, { niche: 'barbershop' }),
      biz('me', near.id),
      biz('here', ev1.id),
    ];
    expect(playingRivalsNear(ev1, 'cafe', list, places, 250, 'me')).toHaveLength(0);
  });

  it('a taken place says so instead of a stake', () => {
    const f = placeFacts(ev1, pack, [biz('x', ev1.id)], places, { taken: true });
    expect(placeStake(f)).toMatch(/signed this lease already/);
  });

  it('works without a pack (packs still loading): no invented numbers', () => {
    const f = placeFacts(ev1, undefined, [], places);
    expect(f.ordersDay).toBeNull();
    expect(f.split).toBeNull();
    expect(f.opening).toBeNull();
    expect(f.former).toBeNull();
    expect(f.passersBy).toBe(ev1.pedestriansPerDay);
  });

  it('every café place in the city gets a card without throwing, with sane numbers', () => {
    for (const p of places.filter((x) => x.suitableFor.includes('cafe'))) {
      const f = placeFacts(p, pack, [], places);
      expect(f.rentMonth).toBeGreaterThan(0);
      if (f.ordersDay != null) expect(f.ordersDay).toBeGreaterThan(0);
      if (f.opening) expect(f.opening.days).toBeGreaterThanOrEqual(0);
      expect(unitsFit(p, pack)).toBeGreaterThanOrEqual(1);
    }
  });

  it('labels read like a person wrote them, in both languages', () => {
    const ru = (_en: string, r: string) => r;
    expect(daysLabel(0)).toBe('right away');
    expect(daysLabel(30)).toBe('30 days');
    expect(daysLabel(120)).toBe('about 4 months');
    expect(daysLabel(120, ru)).toBe('около 4 мес.');
    expect(rivalMeaning({ id: 'a', name: 'A', isAi: false, status: 'open', distM: 60, overlap: 0.76, rank: 2 })).toBe('60 m away: shares the same passers-by (overlap 76%)');
  });
});

describe('versusMe — a business on the live map seen from mine', () => {
  const near = placeAround(20, 120);
  const me = biz('me', ev1.id, { price: 6, rankInNiche: 4 });
  it('a café next door: distance, overlap, cheaper and above me', () => {
    const v = versusMe(biz('maya', near.id, { price: 5.5, rankInNiche: 2 }), me, places);
    expect(v.sameNiche).toBe(true);
    expect(v.overlap).toBeGreaterThan(0.4);
    expect(v.priceGap).toBe(-0.5);
    expect(v.rankGap).toBe(-2);
    expect(v.line).toMatch(/m from you, sharing about \d+% of your passers-by; \$0\.50 cheaper than you · 2 places above you\./);
  });
  it('a barbershop is not a rival', () => {
    const v = versusMe(biz('cuts', near.id, { niche: 'barbershop' }), me, places);
    expect(v.sameNiche).toBe(false);
    expect(v.overlap).toBe(0);
    expect(v.line).toMatch(/not a rival/);
  });
});
