// Cafe part "service" (task B01): seats and takeaway, the morning rush, the queue. Checks of build/FORMATS.md, 3.6.
// The inputs from the other parts (guest groups, the team) are given explicitly, built from the D20 data, so these
// checks do not move when segments.ts or staffing.ts change. The engine run at the end uses whatever they give.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BusinessState, DayReport, GameDate, Pack, Place } from '@ohh/shared';
import type { CafeDay, StaffPower } from '../../src/niches/cafe/contract';
import {
  crowdDrop, engineQualityTake, part, seatsThatFit, serviceCfg, serviceDay, serviceDayWith, serviceKpis, serviceNotes, walkAway,
  type Group, type ServiceCfg, type ServiceInputs,
} from '../../src/niches/cafe/service';
import { hooks as cafeHooks } from '../../src/niches/cafe';
import { cafePack } from '../fixtures/cafe';
import { cafeCity, run } from '../fixtures/world';

const json = <T>(rel: string): T => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8')) as T;
const B01 = json<{ extra: { service: ServiceCfg } }>('../../../packs/parts/cafe/B01-service.json').extra.service;
interface Seg { id: string; sitShare: number; morningShare: number; dwellHours: number }
interface Staffing { roles: Record<string, { speed: number; lead?: boolean }>; ordersPerPaidHour: number; rushOrdersPerPersonHour: number; rushCrewShare: number; rushCrewOwner: number; leadNeededFrom: number; noLead: { speedMult: number } }
const D20 = json<{ extra: { guestSegments: { segments: Seg[]; mixByBlock: Record<string, Record<string, number>> }; staffing: Staffing } }>('../../../packs/parts/cafe/D20-formats.json').extra;

const pack: Pack = { ...cafePack, extra: { ...(cafePack.extra ?? {}), service: B01, guestSegments: D20.guestSegments } };
/** Only this part's section: segments.ts and staffing.ts give their plain fallbacks, whatever is written in them. */
const solo: Pack = { ...cafePack, extra: { ...(cafePack.extra ?? {}), service: B01 } };
const date: GameDate = { day: 0, month: 10, weekday: 2 } as GameDate;   // a Wednesday in October, as in FORMATS 3.5

/** Guests of a pure block type from the D20 mix. */
function mix(block: 'office' | 'residential' | 'campus' | 'tourist'): Group[] {
  return D20.guestSegments.segments.map((s) => ({
    id: s.id, share: D20.guestSegments.mixByBlock[block][s.id] ?? 0, sitShare: s.sitShare, morningShare: s.morningShare, dwellHours: s.dwellHours,
  }));
}
/** The team as build/FORMATS.md 4.3 counts it (160 paid hours each), without levers. */
function team(staff: Record<string, number>): StaffPower {
  const T = D20.staffing;
  const n = Object.values(staff).reduce((a, k) => a + k, 0);
  const hasLead = Object.entries(staff).some(([id, k]) => k > 0 && T.roles[id]?.lead);
  const m = !hasLead && n >= T.leadNeededFrom ? T.noLead.speedMult : 1;
  let hours = 0, speed = 0;
  for (const [id, k] of Object.entries(staff)) { hours += k * 160 * (T.roles[id]?.speed ?? 1); speed += k * (T.roles[id]?.speed ?? 1); }
  return { ordersPerDay: (hours * T.ordersPerPaidHour * m) / 30, rushOrdersPerHour: T.rushOrdersPerPersonHour * (T.rushCrewOwner + T.rushCrewShare * n) * (speed / n) * m, qualityDelta: 0 };
}
const four = { barista: 3, shift_lead: 1 };
const shop = (size: number, staff: Record<string, number> = four): BusinessState =>
  ({ id: 'c1', niche: 'cafe', status: 'open', size, orders: { price: 8.5, staff, levers: {}, shortcuts: [], blockFund: false, autopilot: 'hold' }, days: [] } as unknown as BusinessState);
const roomy = { id: 'x', sqft: 1400 } as Place;   // fits 55 seats: the floor never limits these checks
const day = (b: BusinessState, demand: number, place: Place | undefined = roomy, p: Pack = pack): CafeDay => ({ b, pack: p, place, date, day: 0, demand });
const inputs = (block: Parameters<typeof mix>[0], staff: Record<string, number> = four, hoursLostShare = 0): ServiceInputs =>
  ({ groups: mix(block), team: team(staff), hoursLostShare });
const sd = (size: number, demand: number, block: Parameters<typeof mix>[0], staff: Record<string, number> = four, place: Place | undefined = roomy) =>
  serviceDayWith(day(shop(size, staff), demand, place), B01, inputs(block, staff));

describe('cafe service: seats and takeaway', () => {
  it('1. a to-go counter is not stopped by its seats: 6 seats, 250 orders, office block', () => {
    const s = sd(6, 250, 'office');
    expect(s.served).toBeGreaterThanOrEqual(240);
    expect(s.lost.seats).toBeLessThanOrEqual(5);
  });

  it('2. above what the team can make, 8 seats serve more than 30 with the same team (office, 400 orders)', () => {
    expect(sd(8, 400, 'office').served).toBeGreaterThan(sd(30, 400, 'office').served);
  });

  it('3. seats limit only the guests who sit: lost to seats ≤ wanted × (1 − noSeatTakesAway); nobody sits, nobody is lost to seats', () => {
    for (const block of ['office', 'residential', 'campus', 'tourist'] as const) {
      for (const size of [0, 6, 12, 18, 30]) {
        for (const dem of [50, 250, 400, 700]) {
          const s = sd(size, dem, block);
          expect(s.lost.seats).toBeLessThanOrEqual(s.seats.wanted * (1 - B01.noSeatTakesAway) + 1e-9);
        }
      }
    }
    const standing = mix('office').map((g) => ({ ...g, sitShare: 0 }));
    const s = serviceDayWith(day(shop(0), 400), B01, { groups: standing, team: team(four), hoursLostShare: 0 });
    expect(s.lost.seats).toBe(0);
    expect(s.seats.wanted).toBe(0);
  });

  it('4. long stays fill the room: 18 seats, 400 orders lose guests to seats on a residential block, none on an office block', () => {
    expect(sd(18, 400, 'residential').lost.seats).toBeGreaterThan(0);
    expect(sd(18, 400, 'office').lost.seats).toBe(0);
  });

  it('5. the line grows when the rush is short of hands: 550 orders, office block', () => {
    const two = sd(18, 550, 'office', { barista: 2 });
    const five = sd(18, 550, 'office', { barista: 4, shift_lead: 1 });
    expect(two.rush.walked).toBeGreaterThan(five.rush.walked);
    expect(two.rush.line).toBeGreaterThan(five.rush.line);
    expect(sd(18, 250, 'office').rush.walked).toBe(0);
  });

  it('6. every order is accounted for: served + lost to the line, seats and hands = demand; hours on top', () => {
    for (const block of ['office', 'residential', 'campus', 'tourist'] as const) {
      for (const size of [0, 6, 18, 40]) {
        for (const dem of [0, 1, 120, 400, 900]) {
          for (const staff of [{ barista: 1 }, four, { barista: 6, shift_lead: 1 }]) {
            const s = serviceDayWith(day(shop(size, staff), dem), B01, inputs(block, staff, 0.1));
            expect(s.served).toBeGreaterThanOrEqual(0);
            expect(s.served + s.lost.queue + s.lost.seats + s.lost.labor).toBeCloseTo(s.demand, 6);
            expect(s.demand + s.lost.hours).toBeCloseTo(dem, 6);
          }
        }
      }
    }
  });

  it('7. seats with no floor do not exist: 500 sq ft holds 5 seats, and the day says so', () => {
    const small = { id: 'y', sqft: 500 } as Place;
    expect(seatsThatFit(small, B01)).toBe(5);
    const d = day(shop(24), 250, small);
    const s = serviceDayWith(d, B01, inputs('residential'));
    expect(s.seats.fit).toBe(5);
    expect(s.seats.count).toBe(5);
    expect(serviceNotes(d, s).some((n) => n.startsWith('Only 5 seats fit in 500 sq ft'))).toBe(true);
    expect(seatsThatFit(undefined, B01, 24)).toBe(24);
  });

  it('8. the same input gives the same day; the file has no clock and no randomness', () => {
    expect(sd(12, 430, 'tourist')).toEqual(sd(12, 430, 'tourist'));
    const src = readFileSync(new URL('../../src/niches/cafe/service.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/Math\.random|\bDate\b/);
  });

  it('9. without extra.service the part changes nothing and keeps the engine\'s own words', () => {
    const d = { ...day(shop(18), 300), pack: cafePack };
    expect(serviceCfg(cafePack)).toBeNull();
    expect(serviceDay(d)).toBeNull();
    expect(part.capacityDay!(d)).toBeNull();
    expect(part.qualityDelta!(d)).toBe(0);
    expect(part.kpis).toBeUndefined();
    expect(serviceKpis(shop(18), cafePack)).toEqual([]);
    const r = { day: 40, demandUnits: 300, servedUnits: 280, lost: { size: 12, staff: 8, closure: 0 } } as DayReport;
    // the engine is silent about its own limits when the cafe has capacity and notes hooks: the parts say it, once
    expect(cafeHooks.notes!(shop(18), r, cafePack)).toEqual(['Line out the door: 12 customers walked away', 'Short-staffed: 8 customers left unserved']);
  });
});

describe('cafe service: the line and what the player is told', () => {
  it('walk-away follows the pack\'s points: nobody below 5 in line, half from 20', () => {
    const pts = B01.walkAwayByLine;
    expect(walkAway(0, pts)).toBe(0);
    expect(walkAway(5, pts)).toBe(0);
    expect(walkAway(7.5, pts)).toBeCloseTo(0.05, 10);
    expect(walkAway(15, pts)).toBeCloseTo(0.3, 10);
    expect(walkAway(40, pts)).toBe(0.5);
  });

  it('capacity: with nobody lost the team can take more (spare); with guests lost it is what was served', () => {
    const calm = day(shop(18), 150, roomy, solo);
    const s = serviceDay(calm)!;
    expect(s.lost.queue + s.lost.seats + s.lost.labor).toBeLessThan(0.5);
    expect(part.capacityDay!(calm)).toBeCloseTo(s.served + s.spare, 9);
    const busy = day(shop(18, { barista: 1 }), 600, roomy, solo);
    expect(part.capacityDay!(busy)).toBeCloseTo(serviceDay(busy)!.served, 9);
  });

  it('a lost rush and a short team name the fix and its size: one more barista keeps guests, in orders and dollars', () => {
    const d = day(shop(18, { barista: 2 }), 550);
    const s = serviceDayWith(d, B01, inputs('office', { barista: 2 }));
    expect(s.rush.walked).toBeGreaterThan(0);
    const n = serviceNotes(d, s, (x) => inputs('office', x.b.orders.staff));
    expect(n[0]).toMatch(/^Morning rush: served \d+% of \d+: \d+ in line at 8 am, \d+-minute wait, \d+ walked on\. One more barista in the rush would keep about \d+ of them\.$/);
    expect(n.some((x) => /^Out of hands: \d+ orders not made today — the team makes \d+ a day\. One more barista: \+\d+ orders, about \$[\d,]+ a day after ingredients for about \$\d+ a day in wages\.$/.test(x))).toBe(true);
    // the promise is the same arithmetic as the day: one more barista really serves that many more
    const gain = Number(/\+(\d+) orders/.exec(n.find((x) => x.startsWith('Out of hands'))!)![1]);
    const more = serviceDayWith(day(shop(18, { barista: 3 }), 550), B01, inputs('office', { barista: 3 }));
    expect(gain).toBe(Math.round(more.served - s.served));
  });

  it('when the espresso machine is the limit, the note says hands will not help', () => {
    const big = { barista: 6, shift_lead: 1 };
    const d = day(shop(18, big), 900);
    const s = serviceDayWith(d, B01, inputs('office', big));
    expect(s.rush.capPerHour * s.labor).toBeCloseTo(B01.machineOrdersPerHour, 9);
    expect(serviceNotes(d, s, (x) => inputs('office', x.b.orders.staff))[0]).toMatch(/espresso machine is at its ceiling \(90 orders an hour\)/);
  });

  it('a calm morning still reports its result, so every day has a score to beat', () => {
    const d = day(shop(18), 150);
    const s = serviceDayWith(d, B01, inputs('residential'));
    expect(serviceNotes(d, s)[0]).toMatch(/^Morning rush: served 100% of \d+, no line\. The bar makes \d+ orders an hour\.$/);
  });

  it('quality ends where the day deserves: the engine\'s old room tests are given back, the part\'s own are taken', () => {
    // 14 seats, 250 orders: the old room limit (14 × 170 / 30 / 0.4 = 198) calls it "packed"; at the busiest hour
    // 85% of the seats are in use, so it is not; six people make every order: nothing is deserved, 0.08 comes back
    const calm = day(shop(14, { barista: 5, shift_lead: 1 }), 250, roomy, solo);
    const s = serviceDay(calm)!;
    expect(s.seats.crowded).toBe(false);
    expect(s.lost.labor).toBeLessThan(0.5);
    expect(part.qualityDelta!(calm)).toBeCloseTo(0.08, 10);
    // everywhere: what the engine takes + what the part adds = what the part says the day deserves
    for (const size of [0, 6, 14, 24, 40]) {
      for (const dem of [60, 250, 500]) {
        for (const staff of [{ barista: 1 }, four, { barista: 5, shift_lead: 1 }]) {
          const d = day(shop(size, staff), dem, roomy, solo);
          const x = serviceDay(d)!;
          const cap = part.capacityDay!(d)!;
          const took = engineQualityTake(d, x, cap);
          const due = (x.seats.crowded ? crowdDrop(B01, x, solo) : 0) + (x.lost.labor >= 0.5 ? 0.04 : 0);
          expect(-(took.crowd + took.staff) + part.qualityDelta!(d)).toBeCloseTo(-due, 10);
        }
      }
    }
  });

  it('a packed room costs by who sits in it: full drop for a room where 40% sit, a share of it at a to-go counter', () => {
    const counter = sd(8, 300, 'office');          // on an office block about 28% of guests sit
    const room = sd(18, 400, 'residential');        // more than half of the residents sit
    expect(counter.seats.crowded).toBe(true);
    expect(room.seats.crowded).toBe(true);
    const share = counter.seats.seated / counter.served;
    expect(crowdDrop(B01, counter, solo)).toBeCloseTo(B01.crowdQualityDrop * share / 0.4, 10);
    expect(crowdDrop(B01, counter, solo)).toBeLessThan(crowdDrop(B01, room, solo));
    expect(crowdDrop(B01, room, solo)).toBe(B01.crowdQualityDrop);
  });

  it('with the offset off, the part only adds a packed room the engine did not see, and never doubles it', () => {
    const off: Pack = { ...solo, extra: { ...solo.extra, service: { ...B01, offsetEngineRoomTests: false } } };
    const counter = { ...day(shop(6), 250), pack: off };       // packed by both counts: the engine already took 0.08
    expect(part.qualityDelta!(counter)).toBe(0);
    const hall = { ...day(shop(40), 250), pack: off };          // neither count calls it packed
    expect(part.qualityDelta!(hall)).toBe(0);
  });
});

describe('cafe service in the engine', () => {
  it('a 6-seat counter with the service section serves well past the old room limit of 6 × 170 / 30 / 0.4 = 85 a day', () => {
    const { w, ctx } = cafeCity(1, { pack, size: 6 });
    const after = run(w, ctx, 20);
    const b = after.businesses[0];
    const open = b.days.filter((r) => r.demandUnits > 0);
    expect(open.length).toBeGreaterThan(0);
    const best = Math.max(...open.map((r) => r.servedUnits));
    const oldRoom = (6 * pack.sizing.unitsServedPerSizeMonth) / 30 / (1 - (pack.sizing.takeawayShare ?? 0));
    const demandTop = Math.max(...open.map((r) => r.demandUnits));
    if (demandTop > oldRoom + 5) expect(best).toBeGreaterThan(oldRoom);
    expect(open.every((r) => r.servedUnits <= r.demandUnits)).toBe(true);
    expect(open.at(-1)!.notes.some((n) => n.startsWith('Morning rush:'))).toBe(true);
    expect(serviceKpis(b, pack).map((k) => k.id)).toEqual(['rush_served', 'bar_in_rush', 'seat_turns', 'seats_in_use_peak']);
  });
});
