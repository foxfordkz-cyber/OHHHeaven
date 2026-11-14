// Cafe part "service" (task B01): the checks of build/FORMATS.md 3.6 and the example table of 3.5.
// Guests and team are passed explicitly, built here from D20-formats.json with the formulas of FORMATS.md 2.3 and 4.3,
// so these checks do not depend on when segments.ts (B02) and staffing.ts (B03) land.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dateOf } from '@ohh/shared';
import type { BusinessState, DayReport, Pack, Place, StandingOrders } from '@ohh/shared';
import rawPack from '../../../packs/cafe.json';
import rawFormats from '../../../packs/parts/cafe/D20-formats.json';
import rawPlaces from '../../../data/places.json';
import { composeHooks } from '../../src/niches/cafe';
import {
  part, seatUseDay, serviceCfg, serviceDay, serviceDayNotes, serviceDayWith, serviceKpis, serviceNotes, seatsThatFit, walkAway,
  type Guests, type ServiceCfg, type ServiceInputs,
} from '../../src/niches/cafe/service';
import type { CafeDay, StaffPower } from '../../src/niches/cafe/contract';

const basePack = rawPack as unknown as Pack;
const X = (rawFormats as unknown as { extra: Record<string, any> }).extra;
const pack: Pack = { ...basePack, extra: { ...(basePack.extra ?? {}), guestSegments: X.guestSegments, service: X.service, staffing: X.staffing } };
const cfg = serviceCfg(pack) as ServiceCfg;
const places = rawPlaces as unknown as Place[];
const placeById = (id: string): Place => places.find((p) => p.id === id)!;
const OFFICE = placeById('ev-062');       // FORMATS.md 3.5: 49% office guests
const HOME = placeById('ev-004');         // residential
const WED_OCT = { weekday: 2, month: 10 };
const DAY = 40;
const DATE = dateOf(DAY);
const at = (b: BusinessState, demand: number, place: Place = OFFICE, p: Pack = pack): CafeDay => ({ b, pack: p, place, date: DATE, day: DAY, demand });

// ───────────── guests: FORMATS.md 1.2 and 2.3 ─────────────
const G = X.guestSegments;
function guestsAt(place: Place, date = WED_OCT): Guests {
  const near = (distM: number, reach: number): number => Math.max(0, 1 - distM / reach);
  const r = G.blockRules;
  const w: Record<string, number> = { residential: r.residentialBase, office: 0, campus: 0, tourist: 0 };
  for (const a of place.anchors ?? []) {
    if (a.kind === r.office.anchor) w.office += ((a.ridersPerDay ?? r.office.ridersRef) / r.office.ridersRef) * near(a.distM, r.office.reachM);
    if (a.kind === r.campus.anchor) w.campus = Math.max(w.campus, r.campus.weight * near(a.distM, r.campus.reachM));
    const t = r.tourist[a.kind];
    if (typeof t === 'number') w.tourist = Math.max(w.tourist, t * near(a.distM, r.tourist.reachM));
  }
  w.office = Math.min(r.office.maxWeight, w.office);
  const tot = Object.values(w).reduce((a, b) => a + b, 0);
  const rows = G.segments.map((s: any) => {
    const base = Object.keys(w).reduce((a, k) => a + (w[k] / tot) * (G.mixByBlock[k][s.id] ?? 0), 0);
    return { s, raw: base * s.week[date.weekday] * s.months[date.month - 1] };
  });
  const vol = rows.reduce((a: number, x: any) => a + x.raw, 0);
  return { groups: rows.map(({ s, raw }: any) => ({ id: s.id, share: raw / vol, sitShare: s.sitShare, morningShare: s.morningShare, dwellHours: s.dwellHours })) };
}

// ───────────── team: FORMATS.md 4.3, standard hours, no levers ─────────────
const T = X.staffing;
function teamOf(staff: Record<string, number>): StaffPower {
  const n = Object.values(staff).reduce((a, k) => a + k, 0);
  const hasLead = Object.entries(staff).some(([id, k]) => k > 0 && T.roles[id]?.lead);
  const noLead = !hasLead && n >= T.leadNeededFrom;
  const team = noLead ? T.noLead.speedMult : 1;
  let hoursSpeed = 0, speedSum = 0;
  for (const [id, k] of Object.entries(staff)) {
    const role = T.roles[id] ?? { speed: 1 };
    const hours = basePack.staff.find((s) => s.id === id)!.hoursPerMonth;
    hoursSpeed += k * hours * role.speed;
    speedSum += k * role.speed;
  }
  return {
    ordersPerDay: (hoursSpeed * T.ordersPerPaidHour * team) / 30,
    rushOrdersPerHour: T.rushOrdersPerPersonHour * (T.rushCrewOwner + T.rushCrewShare * n) * (speedSum / n) * team,
    qualityDelta: 0,
  };
}

const FOUR = { barista: 3, shift_lead: 1 };
const day = (place: Place, demand: number, seats: number, staff: Record<string, number> = FOUR, over: Partial<ServiceInputs> = {}) =>
  serviceDayWith(cfg, { demand, hoursShare: 0, guests: guestsAt(place), power: teamOf(staff), seatsOwned: seats, place, ...over });
const lostSum = (s: ReturnType<typeof day>): number => s.served + s.lost.hours + s.lost.queue + s.lost.seats + s.lost.labor;

// ───────────── a cafe for the hooks ─────────────
function orders(over: Partial<StandingOrders> = {}): StandingOrders {
  return { price: 8.5, staff: { ...FOUR }, levers: {}, shortcuts: [], blockFund: false, autopilot: 'hold', ...over } as StandingOrders;
}
function cafe(over: Partial<BusinessState> = {}): BusinessState {
  return {
    id: 'c1', name: 'Test Cafe', niche: 'cafe', placeId: OFFICE.id, isAi: false,
    owners: [{ playerId: 'u1', share: 1 }], managerPlayerId: 'u1', status: 'open', createdDay: 1, openedDay: 1,
    cash: 40000, size: 18, items: [], setupSpent: 90000, permits: [], quality: 0.5, reputation: 0.5,
    trust: { kept: 0, broken: 0 }, orders: orders(), trails: [], liabilities: [],
    mtd: { lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } },
    days: [], history: [], ...over,
  } as BusinessState;
}
const report = (dayN: number, demand: number): DayReport => ({
  day: dayN, demandUnits: demand, servedUnits: demand, lost: { size: 0, staff: 0, closure: 0 }, revenue: 0, variableCosts: 0,
  sizeUtilization: 0, weather: 'clear', notes: [],
});

describe('cafe service — the example of FORMATS.md 3.5 (same numbers as packs/parts/cafe/D20-examples.mjs)', () => {
  const rows: [Place, number, number, number][] = [
    // place, orders wanted, seats, served
    [OFFICE, 250, 6, 246], [OFFICE, 250, 30, 248], [OFFICE, 400, 6, 259], [OFFICE, 400, 30, 248],
    [OFFICE, 550, 6, 261], [OFFICE, 550, 30, 248], [HOME, 250, 6, 233], [HOME, 250, 30, 216], [HOME, 400, 6, 236],
  ];
  it.each(rows)('%s, %i orders, %i seats → %i served', (place, demand, seats, served) => {
    expect(Math.round(day(place, demand, seats).served)).toBe(served);
  });
  it('the rush at 550 orders and 30 seats: a line of about 22, a 21-minute wait, about 60 walked on', () => {
    const s = day(OFFICE, 550, 30);
    expect(s.rush.line).toBeCloseTo(21.8, 0);
    expect(Math.round(s.rush.waitMin)).toBe(21);
    expect(s.rush.walked).toBeCloseTo(60.5, 0);
  });
});

describe('cafe service — checks of FORMATS.md 3.6', () => {
  it('1. takeaway does not hit the seats: 6 seats, 250 orders, office place', () => {
    const s = day(OFFICE, 250, 6);
    expect(s.served).toBeGreaterThanOrEqual(240);
    expect(s.lost.seats).toBeLessThanOrEqual(5);
  });

  it('2. task B01: at 400 orders a counter of 8 seats serves more than a room of 30 with the same team', () => {
    expect(day(OFFICE, 400, 8).served).toBeGreaterThan(day(OFFICE, 400, 30).served);
  });

  it('3. seats limit only those who sit', () => {
    for (const place of [OFFICE, HOME]) for (const demand of [50, 250, 400, 700]) for (const seats of [0, 6, 18, 40]) {
      for (const staff of [{ barista: 2 }, FOUR, { barista: 5, shift_lead: 1 }]) {
        const s = day(place, demand, seats, staff);
        expect(s.lost.seats).toBeLessThanOrEqual(s.seats.wanted * (1 - cfg.noSeatTakesAway) + 1e-9);
      }
    }
    const nobodySits: Guests = { groups: guestsAt(OFFICE).groups.map((g) => ({ ...g, sitShare: 0 })) };
    const s = day(OFFICE, 400, 0, FOUR, { guests: nobodySits });
    expect(s.lost.seats).toBe(0);
    expect(s.seats.wanted).toBe(0);
  });

  it('4. long stays fill the room: residential 400 orders, 18 seats loses guests to seats; office does not', () => {
    expect(day(HOME, 400, 18).lost.seats).toBeGreaterThan(0);
    expect(day(OFFICE, 400, 18).lost.seats).toBe(0);
  });

  it('5. the line grows when the rush is short of hands', () => {
    expect(day(OFFICE, 550, 18, { barista: 2 }).rush.walked).toBeGreaterThan(day(OFFICE, 550, 18, { barista: 5 }).rush.walked);
    expect(day(OFFICE, 250, 18).rush.walked).toBe(0);
  });

  it('6. every order is either served or lost for one reason', () => {
    for (const place of [OFFICE, HOME]) for (const demand of [0, 1, 120, 400, 900]) for (const seats of [0, 8, 30]) {
      for (const hoursShare of [0, 0.1]) {
        const s = day(place, demand, seats, FOUR, { hoursShare });
        expect(s.served).toBeGreaterThanOrEqual(0);
        expect(Math.abs(lostSum(s) - demand)).toBeLessThan(1e-6);
      }
    }
  });

  it('7. a room smaller than the seats: 500 sq ft, 24 seats owned → 5 fit and the owner is told', () => {
    const small = { ...HOME, sqft: 500 };
    expect(seatsThatFit(small, cfg)).toBe(5);
    const s = day(small, 250, 24);
    expect(s.seats.fit).toBe(5);
    expect(s.seats.count).toBe(5);
    expect(serviceNotes(s, 24, small.sqft)).toContain('Only 5 seats fit in 500 sq ft: 19 of your 24 seats have no floor');
    const b = cafe({ size: 24 });
    const notes = serviceDayNotes(b, report(DAY, 250), pack, { place: small, day: DAY, date: DATE });
    expect(notes.some((n) => n.startsWith('Only 5 seats fit'))).toBe(true);
  });

  it('8. determinism: the same inputs give the same day; no Math.random and no Date in the file', () => {
    expect(day(OFFICE, 437, 12)).toEqual(day(OFFICE, 437, 12));
    const src = readFileSync(join(__dirname, '../../src/niches/cafe/service.ts'), 'utf8').replace(/\/\/.*$/gm, '');
    expect(src).not.toMatch(/Math\.random|new Date|Date\.now/);
  });

  it('9. without extra.service the part answers nothing', () => {
    const plain = basePack;
    const b = cafe();
    const d = at(b, 300, OFFICE, plain);
    expect(serviceCfg(plain)).toBeNull();
    expect(serviceDay(d)).toBeNull();
    expect(part.capacityDay!(d)).toBeNull();
    expect(part.qualityDelta!(d)).toBe(0);
    expect(serviceKpis({ ...b, days: [report(DAY, 300)] }, plain)).toEqual([]);
    expect(serviceDayNotes(b, report(DAY, 300), plain)).toEqual([]);
    expect(Object.keys(part).sort()).toEqual(['capacityDay', 'qualityDelta']);   // kpis and notes wait for the engine (journal)
  });
});

describe('cafe service — through the hooks the engine calls', () => {
  const hooks = composeHooks([part]);
  const env = { place: OFFICE, day: DAY, date: DATE, demand: 300 };

  it('capacityDay answers a number with the pack section, and null without the day', () => {
    const cap = hooks.capacityDay!(cafe(), pack, env);
    expect(typeof cap).toBe('number');
    expect(cap as number).toBeGreaterThan(0);
    expect(hooks.capacityDay!(cafe(), pack)).toBeNull();
  });

  it('a quiet day reports spare hands; a day with losses reports exactly what was served', () => {
    const quiet = part.capacityDay!(at(cafe(), 60)) as number;
    expect(quiet).toBeGreaterThan(60);
    const busy = at(cafe({ orders: orders({ staff: { barista: 1 } }) }), 600);
    expect(part.capacityDay!(busy)).toBeCloseTo(serviceDay(busy)!.served, 9);
    expect(serviceDay(busy)!.served).toBeLessThan(600);
  });

  it('the takeaway share is not cut by the seats any more: 6 seats serve far more than the old limit', () => {
    const b = cafe({ size: 6 });
    const old = (6 * basePack.sizing.unitsServedPerSizeMonth / 30) / (1 - (basePack.sizing.takeawayShare ?? 0));
    const cap = part.capacityDay!(at(b, 250)) as number;
    expect(cap).toBeGreaterThan(2 * old);
  });

  it('kpis and notes read the last day of the report', () => {
    const b = cafe({ size: 30, orders: orders({ staff: { barista: 2 } }), days: [report(DAY, 550)] });
    const k = serviceKpis(b, pack);
    expect(k.map((x) => x.id)).toEqual(['rush_served', 'bar_rush_per_hour', 'seat_turns', 'seats_peak_use']);
    const notes = serviceDayNotes(b, report(DAY, 550), pack);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.join(' ')).toMatch(/Out of hands|Morning rush/);
  });

  it('seat use at the busiest hour: a takeaway counter is not "packed" just because it sells a lot', () => {
    const counter = at(cafe({ size: 8 }), 300);
    const oldUtil = 300 / ((8 * basePack.sizing.unitsServedPerSizeMonth / 30) / (1 - (basePack.sizing.takeawayShare ?? 0)));
    const use = seatUseDay(counter) as number;
    expect(oldUtil).toBeGreaterThan(2.5);                     // FORMATS.md, request 5: the old judgement
    expect(use).toBeLessThan(oldUtil);
    expect(use > cfg.crowdAbove).toBe(serviceDay(counter)!.seats.crowded);
    expect(seatUseDay(at(cafe({ size: 0 }), 300))).toBeNull();
    expect(seatUseDay(at(cafe(), 300, OFFICE, basePack))).toBeNull();
  });

  it('walkAway follows the pack points and stays flat outside them', () => {
    const pts = cfg.walkAwayByLine;
    expect(walkAway(0, pts)).toBe(0);
    expect(walkAway(5, pts)).toBe(0);
    expect(walkAway(12.5, pts)).toBeCloseTo(0.2, 9);
    expect(walkAway(60, pts)).toBe(0.5);
  });
});
