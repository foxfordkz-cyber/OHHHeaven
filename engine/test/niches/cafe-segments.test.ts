// B02: guest groups by place and time (engine/src/niches/cafe/segments.ts). Checks of build/FORMATS.md, section 2.6.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dateOf, type BusinessState, type DayReport, type Pack, type Place } from '@ohh/shared';
import { weekdayMult } from '../../src/economy/effects';
import { defaultGuestMix, type CafeDay } from '../../src/niches/cafe/contract';
import {
  blockTypeOf, blockWeights, guestMix, guestMixAt, nextMonthChange, notes, part, placeGuests, segmentFit, segmentKpis, segmentsCfg, segmentsDemandMult, type BlockType,
} from '../../src/niches/cafe/segments';
import { applyAction, createWorld, tickDay } from '../../src/index';
import { recommendOpening } from '../../src/analytics/opening';
import type { CommonPack, PackSet, Player, WorldState } from '@ohh/shared';
import { config } from '../fixtures/world';

const read = <T>(p: string): T => JSON.parse(readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')) as T;
const base = read<Pack>('packs/cafe.json');
const data = read<{ extra: { guestSegments: unknown } }>('packs/parts/cafe/B02-segments.json').extra.guestSegments;
const pack: Pack = { ...base, extra: { ...(base.extra ?? {}), guestSegments: data } };
const places = read<Place[]>('data/places.json').filter((p) => p.suitableFor.length === 0 || p.suitableFor.includes('cafe'));
const byId = (id: string) => places.find((p) => p.id === id)!;

/** A pack where every block has the guests of one "pure" block type (the examples of FORMATS.md 2.5). */
function pure(k: BlockType): Pack {
  const g = JSON.parse(JSON.stringify(data)) as { mixByBlock: Record<BlockType, unknown> };
  for (const t of Object.keys(g.mixByBlock) as BlockType[]) g.mixByBlock[t] = g.mixByBlock[k];
  return { ...base, extra: { ...(base.extra ?? {}), guestSegments: g } };
}

function cafe(over: { price?: number; quality?: number; size?: number; days?: DayReport[] } = {}): BusinessState {
  return {
    id: 'c1', niche: 'cafe', size: over.size ?? 18, quality: over.quality ?? 0.5, reputation: 0.5,
    orders: { price: over.price ?? base.unit.refPrice, staff: {}, levers: {}, shortcuts: [], blockFund: false, autopilot: 'hold' },
    days: over.days ?? [], history: [],
  } as unknown as BusinessState;
}
const day = (b: BusinessState, p: Pack, place: Place | undefined, n = 3 * 30 + 3): CafeDay => ({ b, pack: p, place, date: dateOf(n), day: n });
const WED_OCT = 276; // October 6th, a Wednesday (weekday 2, month 10), the day of the FORMATS.md 2.5 examples
const specialty = () => cafe({ price: 11, quality: 0.72 });
const cheap = () => cafe({ price: 6.5, quality: 0.45 });

describe('cafe segments (B02)', () => {
  it('the example day is a Wednesday in October', () => {
    expect(dateOf(WED_OCT)).toMatchObject({ weekday: 2, month: 10 });
  });

  it('1. the reference cafe fits exactly 1 at every place on every day', () => {
    for (const p of places) for (const n of [1, 6, 100, 200, 273, 355]) {
      expect(segmentFit(day(cafe(), pack, p, n)).mult).toBeCloseTo(1, 9);
    }
  });

  it('2. shares add up to 1 at every place of the map', () => {
    for (const p of places) {
      const s = guestMix(day(cafe(), pack, p)).groups.reduce((a, g) => a + g.share, 0);
      expect(Math.abs(s - 1)).toBeLessThan(1e-9);
    }
  });

  it('3. the volume averages 1 over the year; a week averages the base shares times the month', () => {
    const cfg = segmentsCfg(pack)!;
    for (const p of places) {
      let sum = 0;
      for (let n = 1; n <= 360; n++) sum += guestMixAt(pack, p, dateOf(n))!.volume;
      expect(Math.abs(sum / 360 - 1)).toBeLessThanOrEqual(0.02);
    }
    const p = byId('ev-078');
    const w = blockWeights(p, pack);
    const month = 5;
    const expected = cfg.segments.reduce((a, s) => a + (Object.keys(w) as BlockType[]).reduce((x, k) => x + w[k] * (cfg.mixByBlock[k][s.id] ?? 0), 0) * s.months[month - 1], 0);
    let week = 0;
    for (let wd = 0; wd < 7; wd++) week += guestMixAt(pack, p, { weekday: wd, month })!.volume;
    expect(week / 7).toBeCloseTo(expected, 2);
  });

  it('4. no anchors is a residential block; 100 m from a college students are more than 30%', () => {
    const bare = { ...places[0], anchors: [] } as Place;
    expect(blockTypeOf(bare, pack)).toBe('residential');
    expect(blockWeights(bare, pack)).toEqual({ residential: 1, office: 0, campus: 0, tourist: 0 });
    const college = { ...places[0], anchors: [{ kind: 'college', name: 'A college', distM: 100 }] } as Place;
    expect(blockTypeOf(college, pack)).toBe('campus');
    const students = guestMix(day(cafe(), pack, college, WED_OCT)).groups.find((g) => g.id === 'students')!;
    expect(students.share).toBeGreaterThan(0.3);
  });

  it('5. specialty wins with visitors and on a prime block, loses with commuters and students; cheap is the reverse', () => {
    const at = (b: BusinessState, p: Pack, place?: Place) => segmentFit(day(b, p, place, WED_OCT)).mult;
    expect(at(specialty(), pure('tourist'))).toBeGreaterThanOrEqual(0.95);
    expect(at(specialty(), pure('residential'), { ...places[0], anchors: [], tier: 'prime' } as Place)).toBeGreaterThanOrEqual(0.95);
    expect(at(specialty(), pure('office'))).toBeLessThanOrEqual(0.6);
    expect(at(specialty(), pure('campus'))).toBeLessThanOrEqual(0.6);
    // the real campus door ev-078 is on a prime block: its residents pay for quality, so specialty loses less there
    expect(at(specialty(), pack, byId('ev-078'))).toBeLessThan(0.8);
    expect(at(cheap(), pure('office'))).toBeGreaterThanOrEqual(1.5);
    expect(at(cheap(), pure('campus'))).toBeGreaterThanOrEqual(1.5);
    expect(at(cheap(), pack, byId('ev-078'))).toBeGreaterThanOrEqual(1.4);
  });

  it('the examples of FORMATS.md 2.5 come out to two decimals', () => {
    const at = (b: BusinessState, k: BlockType) => Math.round(segmentFit(day(b, pure(k), undefined, WED_OCT)).mult * 100) / 100;
    expect(['residential', 'office', 'campus', 'tourist'].map((k) => at(cheap(), k as BlockType))).toEqual([1.47, 1.6, 1.6, 1.44]);
    expect(['residential', 'office', 'campus', 'tourist'].map((k) => at(specialty(), k as BlockType))).toEqual([0.77, 0.58, 0.52, 0.96]);
    expect(['residential', 'office', 'campus', 'tourist'].map((k) => at(cafe({ size: 30 }), k as BlockType))).toEqual([1.23, 1.09, 1.32, 1.14]);
    expect(['residential', 'office', 'campus', 'tourist'].map((k) => at(cafe({ size: 6 }), k as BlockType))).toEqual([0.82, 0.92, 0.77, 0.89]);
  });

  it('6. two identical cafes at one place get the same multiplier', () => {
    const p = byId('ev-078');
    expect(segmentsDemandMult(day(specialty(), pack, p))).toBe(segmentsDemandMult(day({ ...specialty(), id: 'c2' }, pack, p)));
  });

  it('7. a week in which 10% walked away costs 18% of commuters and 5% of residents', () => {
    const lostWeek: DayReport[] = Array.from({ length: 7 }, (_, i) => ({
      day: 100 + i, demandUnits: 200, servedUnits: 180, lost: { size: 10, staff: 10, closure: 0 },
      revenue: 0, variableCosts: 0, sizeUtilization: 1, weather: 'clear', notes: [],
    }));
    const calm = segmentFit(day(cafe(), pack, byId('ev-078'))).byGroup;
    const after = segmentFit(day(cafe({ days: lostWeek }), pack, byId('ev-078'))).byGroup;
    const drop = (id: string) => 1 - after.find((g) => g.id === id)!.fit / calm.find((g) => g.id === id)!.fit;
    expect(drop('office')).toBeCloseTo(1 - Math.exp(-0.2), 9);
    expect(drop('residents')).toBeCloseTo(1 - Math.exp(-0.05), 9);
  });

  it('8. without pack data: the default mix, and the engine keeps its own week', () => {
    for (const p of [base, { ...base, extra: { ...base.extra, weekdayMult: undefined } } as Pack]) {
      const d = day(cafe({ price: 11 }), p, byId('ev-078'));
      expect(guestMix(d)).toEqual(defaultGuestMix(p));
      for (let wd = 0; wd < 7; wd++) {
        const dd = { ...d, date: { ...d.date, weekday: wd } };
        // what the engine multiplies with this hook present equals what it multiplied without it
        expect(weekdayMult(p, wd, true) * part.demandMult!(dd)).toBeCloseTo(weekdayMult(p, wd, false), 12);
      }
      expect(part.notes!(cafe({ price: 11 }), { day: 92 } as DayReport, p)).toEqual([]);
      expect(segmentKpis(cafe(), p)).toEqual([]);
      expect(placeGuests(p, byId('ev-078'))).toBeNull();
    }
  });

  it('with data the week comes from the groups only: the pack weekday is divided out', () => {
    const p = byId('ev-078');
    for (let n = 1; n <= 7; n++) {
      const d = day(cafe(), pack, p, n);
      expect(weekdayMult(pack, d.date.weekday, true) * segmentsDemandMult(d)).toBeCloseTo(guestMixAt(pack, p, d.date)!.volume, 12);
    }
  });

  it('the place card: who walks here, a label, shares add up to 1', () => {
    const g = placeGuests(pack, byId('ev-078'))!;
    expect(g.blockType).toBe('campus');
    expect(g.label).toBe('Students (term time)');
    expect(g.groups.find((x) => x.id === 'students')!.share).toBeGreaterThan(0.3);
    expect(g.groups.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1, 9);
    const types = new Set(places.filter((x) => x.pedestriansPerDay).map((x) => blockTypeOf(x, pack)));
    expect(types).toEqual(new Set(['residential', 'office', 'campus', 'tourist']));
  });

  it('the owner hears why a group stays away, on Mondays only', () => {
    const monday = { day: 92 } as DayReport;    // day 92 is a Monday
    expect(dateOf(92).weekday).toBe(0);
    const said = part.notes!(specialty(), monday, pack);
    expect(said.length).toBeGreaterThan(0);
    expect(said[0]).toMatch(/\$11 too much\. They buy \d+% less than an average coffee buyer/);
    expect(part.notes!(specialty(), { day: 93 } as DayReport, pack)).toEqual([]);
    expect(part.notes!(cafe(), monday, pack)).toEqual([]);
    expect(part.notes!(cafe({ size: 6 }), monday, pack).join(' ')).toMatch(/want a seat/);
  });

  it('numbers per group: 100% for the reference cafe, specialty below 100% for commuters', () => {
    expect(segmentKpis(cafe(), pack).map((k) => k.value)).toEqual([100, 100, 100, 100]);
    const k = segmentKpis(specialty(), pack);
    expect(k.find((x) => x.id === 'guest_fit_office')!.value).toBeLessThan(60);
    expect(k.find((x) => x.id === 'guest_fit_tourists')!.value).toBeGreaterThan(100);
  });

  it('with the door known: shares at this door, and a warning a week before the term ends', () => {
    const p = byId('ev-078');
    const may = nextMonthChange(pack, p, 5)!;
    expect(may.change).toBeLessThan(-0.05);
    expect(may.groupId).toBe('students');
    expect(nextMonthChange(pack, p, 8)!.change).toBeGreaterThan(0.05);
    const lastMondayOfMay = 148;
    expect(dateOf(lastMondayOfMay)).toMatchObject({ weekday: 0, month: 5, dayOfMonth: 28 });
    const said = notes(specialty(), { day: lastMondayOfMay } as DayReport, pack, { place: p });
    expect(said[0]).toMatch(/^Next month about \d+% fewer guests at this door: students drop by \d+%/);
    expect(said.some((x) => /of your guests/.test(x))).toBe(true);
    // the first Monday of the month says nothing about next month
    expect(notes(specialty(), { day: 120 + 1 } as DayReport, pack, { place: p }).some((x) => /Next month/.test(x))).toBe(false);
  });

  it('a season through the real engine: an honest standard cafe at a median door stays in the black with guest groups', () => {
    const json = <T>(f: string): T => read<T>(f);
    const ctx = { packs: { common: json<CommonPack>('packs/_common.json'), niches: { cafe: pack } } as PackSet, places: read<Place[]>('data/places.json') };
    const empty = createWorld(config());
    const doors = ctx.places.filter((x) => x.suitableFor.includes('cafe') && (x.pedestriansPerDay ?? 0) > 0
      && (recommendOpening('cafe', x.id, empty, ctx).find((r) => r.kitId === 'standard')?.cashLeft ?? -1) >= 0);
    const door = [...doors].sort((a, b) => (a.pedestriansPerDay ?? 0) - (b.pedestriansPerDay ?? 0))[Math.floor(doors.length / 2)];
    const players: Player[] = [{ id: 'pl1', name: 'Owner', kind: 'owner', isAi: false, paid: true, joinedDay: 0, lastSeenDay: 0, inbox: [] }];
    let w: WorldState = { ...createWorld(config()), players };
    const rec = recommendOpening('cafe', door.id, w, ctx).find((r) => r.kitId === 'standard')!;
    const must = (r: { world: WorldState; error?: string }) => { expect(r.error).toBeUndefined(); return r.world; };
    w = must(applyAction(w, ctx, 'pl1', { type: 'open_business', niche: 'cafe', placeId: door.id, name: 'Cafe', kitId: rec.kitId, size: rec.size, items: rec.items }));
    w = must(applyAction(w, ctx, 'pl1', { type: 'set_orders', orders: rec.orders }));
    while (w.day < 360) {
      w = tickDay(w, ctx);
      if (w.businesses[0].status === 'setup') { const r = applyAction(w, ctx, 'pl1', { type: 'launch' }); if (!r.error) w = r.world; }
    }
    const b = w.businesses[0];
    expect(b.status).toBe('open');
    const last = b.history.slice(-6);
    expect(last.reduce((a, m) => a + m.profit, 0) / last.length).toBeGreaterThan(0);
  });
});
