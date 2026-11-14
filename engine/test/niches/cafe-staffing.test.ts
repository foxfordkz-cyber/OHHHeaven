// Cafe part "staffing" (build/FORMATS.md section 4, task B03): roles and skill, cover of the open hours.
// Numbers: the real packs/cafe.json with the section packs/parts/cafe/B03-staffing.json put into extra, as the integrator does.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BusinessState, CommonPack, DayReport, Pack, WorldState } from '@ohh/shared';
import { applyAction, createWorld, tickDay, type EngineCtx } from '../../src/index';
import { hooks } from '../../src/niches/cafe';
import { defaultStaffPower, type CafeDay } from '../../src/niches/cafe/contract';
import { part as servicePart } from '../../src/niches/cafe/service';
import { coverage, part, staffPower, staffingCfg, teamChange, teamKpis, teamPower, type StaffingCfg } from '../../src/niches/cafe/staffing';
import { config, owner, place } from '../fixtures/world';

const file = (name: string) => new URL(`../../../packs/${name}`, import.meta.url);
const load = <T>(url: URL): T => JSON.parse(readFileSync(url, 'utf8')) as T;
// the tests set the sections themselves, whatever the integrator has already put into packs/cafe.json
const real = load<Pack>(file('cafe.json'));
const { staffing: _s, service: _v, ...rest } = (real.extra ?? {}) as Record<string, unknown>;
const plain: Pack = { ...real, extra: rest };
const section = load<{ extra: { staffing: StaffingCfg } }>(file('parts/cafe/B03-staffing.json')).extra.staffing;
const pack: Pack = { ...plain, extra: { ...rest, staffing: section } };
/** The service section of the spec (packs/parts/cafe/D20-formats.json): with it and a service part, that part counts the day. */
const serviceSection = load<{ extra: { service: unknown } }>(file('parts/cafe/D20-formats.json')).extra.service;
const withService: Pack = { ...pack, extra: { ...rest, staffing: section, service: serviceSection } };
const serviceAnswers = typeof servicePart.capacityDay === 'function';
const cfg = staffingCfg(pack)!;

const shop = (staff: Record<string, number>, levers: Record<string, string> = {}, size = 18): BusinessState =>
  ({ size, orders: { price: 8.5, staff, levers, shortcuts: [], blockFund: false, autopilot: 'hold' } }) as unknown as BusinessState;
const day = (b: BusinessState, p: Pack = pack, demand = 200): CafeDay => ({ b, pack: p, date: { month: 10, weekday: 2 } as CafeDay['date'], day: 40, demand });
const power = (staff: Record<string, number>, levers: Record<string, string> = {}) => teamPower(staff, shop(staff, levers), pack, cfg);
const report = (over: Partial<DayReport> = {}): DayReport =>
  ({ day: 40, demandUnits: 200, servedUnits: 200, lost: { size: 0, staff: 0, closure: 0 }, revenue: 0, variableCosts: 0, sizeUtilization: 0.5, weather: 'clear', notes: [], ...over }) as DayReport;

describe('staffing: the team (FORMATS 4.5 table)', () => {
  it('reproduces the spec table: orders a day, the bar in the rush, quality', () => {
    const rows: [Record<string, number>, number, number, number][] = [
      [{ barista: 2 }, 149, 50, 0],
      [{ barista: 3 }, 202, 56, -0.03],
      [{ barista: 2, shift_lead: 1 }, 231, 65, 0.04],
      [{ barista: 4 }, 269, 68, -0.03],
      [{ barista: 3, shift_lead: 1 }, 306, 77, 0.03],
      [{ barista: 2, shift_lead: 1, trainee_barista: 1 }, 273, 72, 0.03],
      [{ barista: 2, trainee_barista: 2 }, 190, 52, -0.04],
      [{ barista: 5, shift_lead: 1 }, 455, 102, 0.03],
    ];
    for (const [staff, orders, rush, q] of rows) {
      const t = power(staff);
      expect(Math.round(t.ordersPerDay), JSON.stringify(staff)).toBe(orders);
      expect(Math.round(t.rushOrdersPerHour), JSON.stringify(staff)).toBe(rush);
      expect(Math.round(t.qualityDelta * 100) / 100, JSON.stringify(staff)).toBe(q);
    }
  });

  it('check 1, hole 2: three baristas and a lead beat four baristas by 10% in speed and 0.05 in quality', () => {
    const lead = power({ barista: 3, shift_lead: 1 }), four = power({ barista: 4 });
    expect(lead.ordersPerDay).toBeGreaterThanOrEqual(four.ordersPerDay * 1.1);
    expect(lead.qualityDelta - four.qualityDelta).toBeGreaterThanOrEqual(0.05);
    // and it is priced: the swap costs the wage gap and says what it brings
    const swap = teamChange(shop({ barista: 4 }), pack, 'barista', 'shift_lead')!;
    expect(swap.wagesMonth).toBe(480);
    expect(swap.ordersPerDay).toBeGreaterThan(20);
    expect(swap.qualityDelta).toBeCloseTo(0.065, 6);
  });

  it('check 2: a small team does not need a lead', () => {
    const two = power({ barista: 2 });
    expect(two.noLead).toBe(false);
    expect(two.qualityDelta).toBe(0);
    expect(two.ordersPerDay).toBeCloseTo((2 * 160 * 14) / 30, 6);
  });

  it('check 3: a trainee learns faster next to a lead', () => {
    const withLead = power({ barista: 2, shift_lead: 1, trainee_barista: 1 });
    const without = power({ barista: 2, trainee_barista: 2 });
    expect(withLead.traineeSpeed).toBe(0.75);
    expect(without.traineeSpeed).toBe(0.55);
    expect(Math.round(withLead.ordersPerDay)).toBe(273);
    expect(Math.round(without.ordersPerDay)).toBe(190);
  });

  it('check 4: no team is best at every load (served × margin − wages, open hours counted)', () => {
    const teams: Record<string, number>[] = [{ barista: 2 }, { barista: 3 }, { barista: 2, shift_lead: 1 }, { barista: 4 }, { barista: 3, shift_lead: 1 }, { barista: 5, shift_lead: 1 }];
    const margin = pack.unit.refPrice - pack.unit.cogsPerUnit;
    const best = (demand: number) => teams
      .map((staff) => {
        const b = shop(staff);
        const served = Math.min(demand, part.capacityDay!(day(b, pack, demand))!);
        return { staff: JSON.stringify(staff), profit: served * margin * 30 - power(staff).wagesMonth };
      })
      .sort((a, z) => z.profit - a.profit)[0].staff;
    const winners = new Set([120, 220, 330].map(best));
    expect(winners.size).toBeGreaterThanOrEqual(2);
  });

  it('check 7: an unknown role works as a trained barista; nobody on staff makes nothing', () => {
    expect(power({ barista: 1, cook: 1 }).ordersPerDay).toBeCloseTo(power({ barista: 2 }).ordersPerDay, 6);
    expect(power({}).ordersPerDay).toBe(0);
    expect(power({ barista: 0, shift_lead: -3 }).ordersPerDay).toBe(0);
  });

  it('levers: market-plus pay speeds the bar up, specialty drinks slow it down', () => {
    const base = power({ barista: 3, shift_lead: 1 }).ordersPerDay;
    expect(power({ barista: 3, shift_lead: 1 }, { staff_pay: 'above' }).ordersPerDay / base).toBeCloseTo(1.04, 6);
    expect(power({ barista: 3, shift_lead: 1 }, { sourcing: 'specialty' }).ordersPerDay / base).toBeCloseTo(0.85, 6);
  });
});

describe('staffing: cover of the open hours', () => {
  it('check 5: two baristas fill two thirds of the floor hours; quiet one-person hours lose nobody, busy ones lose the rest', () => {
    const quiet = coverage(day(shop({ barista: 2 }), pack, 100));
    expect(quiet.coveredShare).toBeCloseTo(0.667, 3);
    expect(quiet.darkHours).toBe(0);
    expect(quiet.thinHours).toBeCloseTo(8, 6);
    expect(quiet.soloOrdersPerHour).toBeCloseTo(1700 / 160, 6);
    expect(quiet.lostDemandShare).toBe(0);            // 46 orders over 8 one-person hours: 5.8 an hour, one person makes 10.6
    const busy = coverage(day(shop({ barista: 2 }), pack, 300));
    expect(busy.lostDemandShare).toBeCloseTo((300 * (8 / 12) * 0.69 - 8 * 10.625) / 300, 6);   // 138 want those hours, 85 served
    const short = coverage(day(shop({ barista: 2 }, { hours: 'short' }), pack, 300));
    expect(short.coveredShare).toBe(1);
    expect(short.lostDemandShare).toBe(0);
  });

  it('nobody on the floor shuts the door: those hours lose their customers whatever the demand (FORMATS 4.3)', () => {
    const solo: Pack = { ...pack, extra: { ...pack.extra, staffing: { ...cfg, ownerHoursPerMonth: 0 } } };
    const c = coverage(day(shop({ barista: 2 }), solo, 50));   // 320 paid hours against 360 open hours
    expect(c.darkHours).toBeCloseTo(12 - 320 / 30, 6);
    expect(c.thinHours).toBeCloseTo(320 / 30, 6);
    expect(c.lostDemandShare).toBeCloseTo(((12 - 320 / 30) / 12) * 0.69, 6);
  });

  it('check 6: long hours bring their paid hours with them', () => {
    const c = coverage(day(shop({ barista: 4 }, { hours: 'long' })));
    expect(c.paidHours).toBe(890);
    expect(c.neededHours).toBe(900);
    expect(c.lostDemandShare).toBeLessThan(0.01);
  });
});

describe('staffing: the day', () => {
  it('alone it keeps the engine units: trained baristas without the no-lead penalty make the pack 1,700 orders a month each', () => {
    // two baristas: no lead needed, so the engine's old limit is exact
    expect(part.capacityDay!(day(shop({ barista: 2 }), pack, 100))).toBe(100);
    expect(part.capacityDay!(day(shop({ barista: 4 }), pack, 100))).toBe(100);
    const busy = part.capacityDay!(day(shop({ barista: 2 }), pack, 1000))!;
    expect(busy).toBeCloseTo((2 * pack.capacity.unitsPerStaffMonth!) / 30, 6);
    // the lead earns their wage in capacity
    const four = part.capacityDay!(day(shop({ barista: 4 }), pack, 1000))!;
    const lead = part.capacityDay!(day(shop({ barista: 3, shift_lead: 1 }), pack, 1000))!;
    expect(four).toBeCloseTo((4 * 1700 * 0.9) / 30, 6);
    expect(lead).toBeCloseTo((4.1 * 1700) / 30, 6);
  });

  it('alone it keeps the engine room limit (the service part is the one that fixes it)', () => {
    const tiny = part.capacityDay!(day(shop({ barista: 5, shift_lead: 1 }, {}, 6), pack, 1000))!;
    expect(tiny).toBeCloseTo((6 * pack.sizing.unitsServedPerSizeMonth) / 30 / (1 - pack.sizing.takeawayShare!), 6);
  });

  it('quality goes to the day through the glued hooks', () => {
    const b = shop({ barista: 3, shift_lead: 1 });
    expect(hooks.qualityDelta!(b, pack, { day: 40, date: day(b).date, demand: 200 })).toBeCloseTo(0.035, 6);
    expect(hooks.capacityDay!(b, pack, { day: 40, date: day(b).date, demand: 1000 })).toBeCloseTo((4.1 * 1700) / 30, 6);
  });

  it('kpis and notes say what the team makes and what decision waits', () => {
    const k = teamKpis(shop({ barista: 4 }), pack);
    expect(k.map((x) => x.id)).toEqual(['team_orders_day', 'open_hours_covered', 'team_quality']);
    expect(k[0].value).toBe(204);
    expect(k[2].value).toBe(-3);
    const n = part.notes!(shop({ barista: 4 }), report(), pack);
    expect(n.some((s) => /^No shift lead on a team of 4: the bar is 10% slower .*\+28 orders a day .*\$480 more a month/.test(s))).toBe(true);
    const dark = part.notes!(shop({ barista: 2 }), report({ demandUnits: 200, lost: { size: 0, staff: 60, closure: 0 } }), pack);
    expect(dark[0]).toBe('Not enough people: about 8 of 12 open hours a day run with one person. 7 customers did not get served in those hours today. One more barista costs $3,360 a month');
    expect(dark[1]).toMatch(/^Short-staffed: 53 customers left unserved — the team makes 113 orders a day$/);
    const trainee = part.notes!(shop({ barista: 2, trainee_barista: 1 }), report(), pack);
    expect(trainee.some((s) => s.includes('55% speed: nobody on the team can train them — next to a shift lead they would work at 75%'))).toBe(true);
    expect(part.notes!(shop({ barista: 3, shift_lead: 1 }), report(), pack)).toEqual([]);
  });

  it('check 8: without extra.staffing the part changes nothing', () => {
    const b = shop({ barista: 3, shift_lead: 1 });
    expect(staffingCfg(plain)).toBeNull();
    expect(staffPower(day(b, plain))).toEqual(defaultStaffPower(b, plain));
    expect(part.capacityDay!(day(b, plain, 500))).toBeNull();
    expect(part.qualityDelta!(day(b, plain))).toBe(0);
    expect(teamKpis(b, plain)).toEqual([]);
    expect(part.kpis).toBeUndefined();   // the engine's default KPIs stay on screen
    expect(coverage(day(b, plain)).lostDemandShare).toBe(0);
    expect(teamChange(b, plain, 'barista', 'shift_lead')).toBeNull();
    // the engine stays quiet about its limits when the cafe has hooks for them: the part says what the engine would
    expect(part.notes!(b, report({ lost: { size: 3, staff: 5, closure: 0 } }), plain))
      .toEqual(['Line out the door: 3 customers walked away', 'Short-staffed: 5 customers left unserved']);
  });

  it('is deterministic: the same input gives the same answer', () => {
    const b = shop({ barista: 2, shift_lead: 1, trainee_barista: 1 });
    expect(staffPower(day(b))).toEqual(staffPower(day(b)));
    expect(part.notes!(b, report(), pack)).toEqual(part.notes!(b, report(), pack));
  });
});

describe('staffing next to the service part', () => {
  it.skipIf(!serviceAnswers)('with extra.service the service part counts the day: staffing only cuts the hours nobody covers', () => {
    const b = shop({ barista: 3, shift_lead: 1 });
    expect(part.capacityDay!(day(b, withService, 1000))).toBeNull();            // the crew covers the day
    const two = shop({ barista: 2 });
    const cut = coverage(day(two, withService, 300)).lostDemandShare;
    expect(cut).toBeGreaterThan(0);
    expect(part.capacityDay!(day(two, withService, 300))).toBeCloseTo(300 * (1 - cut), 6);
    expect(teamKpis(b, withService).find((k) => k.id === 'rush_bar')?.value).toBe(77);   // to-go orders: the service part's units
    expect(teamKpis(b, withService)[0].value).toBe(306);
  });

  it('without a service part (or its section) staffing keeps the engine units and limits', () => {
    const b = shop({ barista: 3, shift_lead: 1 });
    const alone = serviceAnswers ? pack : withService;   // a section without code, or no section: staffing counts alone
    expect(part.capacityDay!(day(b, alone, 1000))).toBeCloseTo((4.1 * 1700) / 30, 6);
  });
});

describe('staffing: through the economy with the real pack', () => {
  function city(staff: Record<string, number>) {
    const ctx: EngineCtx = { packs: { common: load<CommonPack>(file('_common.json')), niches: { cafe: pack } }, places: [place(1)] };
    let w: WorldState = { ...createWorld(config()), players: [owner(1)] };
    const act = (a: Parameters<typeof applyAction>[3]) => { const r = applyAction(w, ctx, 'pl1', a); if (r.error) throw new Error(r.error); w = r.world; };
    act({ type: 'open_business', niche: 'cafe', placeId: 'p1', name: 'Cafe', kitId: 'standard', size: 18 });
    act({ type: 'set_orders', orders: { staff } });
    const ready = Math.max(0, ...w.businesses[0].permits.map((p) => p.readyDay));
    while (w.day < ready) w = tickDay(w, ctx);
    act({ type: 'launch' });
    for (let i = 0; i < 60; i++) w = tickDay(w, ctx);
    return w.businesses[0];
  }

  it('a lead replacing a barista lifts quality; the day report explains a team without one', () => {
    const four = city({ barista: 4, shift_lead: 0 });
    const lead = city({ barista: 3, shift_lead: 1 });
    expect(lead.quality).toBeGreaterThan(four.quality + 0.03);
    expect(four.days.at(-1)!.notes.some((n) => n.startsWith('No shift lead on a team of 4'))).toBe(true);
    expect(lead.days.at(-1)!.notes.some((n) => n.startsWith('No shift lead'))).toBe(false);
  });
});
