import { beforeEach, describe, expect, it } from 'vitest';
import type { DayReport, MonthReport, StandingOrders } from '@ohh/shared/types';
import { cafePack } from './__stubs__/cafePack';
import { lostToday, nextDecision } from './decision';
import { fixture } from './fixtures';
import { bottleneckOf, changeList, deltaOf, fieldChanged, isolate, outlookOf, perDayCost, signedCount } from './forecast';
import { checkPromise, clearPromise, loadPromise, promiseExpired, reportDayFor, savePromise, type ForecastPromise } from './promise';
import { kpiText } from './today';

const month = (over: Partial<MonthReport> = {}): MonthReport => ({
  month: 4, avgPrice: 6.5, demandUnits: 6000, servedUnits: 6000, lost: { size: 0, staff: 0, closure: 0 },
  capacityUnits: 7200, sizeUtilization: 0.7, lines: [], revenue: 39000, profit: 2400, cashStart: 20000, cashEnd: 22400,
  taxesAccrued: 0, taxesPaid: 0, fines: 0, quality: 0.7, reputation: 0.6, netWorth: 40000, rankInNiche: 3, ...over,
});

const orders: StandingOrders = { price: 6.5, staff: { barista: 3, shift_lead: 1 }, levers: { hours: 'standard' }, shortcuts: [], blockFund: false, autopilot: 'hold' };

describe('forecast: the next 30 days in words', () => {
  it('orders a day and the limit come from the projected month', () => {
    const o = outlookOf(month({ servedUnits: 5400, demandUnits: 6000, lost: { size: 0, staff: 600, closure: 0 } }));
    expect(o.ordersPerDay).toBe(180);
    expect(o.demandPerDay).toBe(200);
    expect(o.bottleneck.id).toBe('staff');
    expect(o.bottleneck.perDay).toBe(20);
    expect(o.bottleneck.text).toMatch(/^About 20 a day leave the line/);
  });

  it('seats win when more leave for lack of a seat; tiny losses are noise and demand is the limit', () => {
    expect(bottleneckOf(month({ lost: { size: 900, staff: 300, closure: 0 } }), 'seat').id).toBe('seats');
    const calm = bottleneckOf(month({ lost: { size: 30, staff: 20, closure: 0 } }));
    expect(calm.id).toBe('demand');
    expect(calm.text).toMatch(/could serve about 40 more a day/);
  });

  it('delta and signs', () => {
    const a = outlookOf(month());
    const z = outlookOf(month({ servedUnits: 5700, profit: 3100, cashEnd: 23100 }));
    expect(deltaOf(a, z)).toEqual({ ordersPerDay: -10, profit: 700, cashEnd: 700, bottleneckChanged: false });
    expect([signedCount(3), signedCount(-4), signedCount(0)]).toEqual(['+3', '−4', '±0']);
  });

  it('one control at a time: isolate keeps the rest of the current orders', () => {
    const draft = { ...orders, price: 7, staff: { barista: 4, shift_lead: 1 }, levers: { hours: 'long' } };
    expect(isolate(orders, draft, 'price')).toEqual({ price: 7 });
    expect(isolate(orders, draft, 'staff:barista')).toEqual({ staff: { barista: 4, shift_lead: 1 } });
    expect(isolate(orders, draft, 'lever:hours')).toEqual({ levers: { hours: 'long' } });
    expect(fieldChanged(orders, draft, 'staff:shift_lead')).toBe(false);
    expect(fieldChanged(orders, draft, 'lever:hours')).toBe(true);
  });

  it('change list names every change in words', () => {
    const draft = { ...orders, price: 6.9, staff: { barista: 4, shift_lead: 1 }, levers: { hours: 'long' } };
    const list = changeList(orders, draft, cafePack);
    expect(list[0]).toBe('Price $6.50 → $6.90');
    expect(list[1]).toBe('Barista 3 → 4');
    expect(list[2]).toMatch(/^Opening hours: .+ → .+/);
  });

  it('a paid lever costs its monthly price over 30 days', () => {
    expect(perDayCost(2300)).toBe(76.67);
  });
});

describe('promise: forecast at Apply against the days that ran', () => {
  const p: ForecastPromise = { businessId: 'b1', appliedDay: 100, changes: ['Price $6.50 → $6.90'], before: { ordersPerDay: 200, profit: 2400 }, after: { ordersPerDay: 180, profit: 3100 }, reportDay: 120 };
  const day = (d: number, served: number): DayReport => ({ day: d, demandUnits: served, servedUnits: served, lost: { size: 0, staff: 0, closure: 0 }, revenue: served * 6.9, variableCosts: 0, sizeUtilization: 0.5, weather: 'clear', notes: [] });

  beforeEach(() => localStorage.clear());

  it('waits until the first day on new settings, then compares only those days', () => {
    expect(checkPromise(p, [day(99, 300), day(100, 300)], 100)).toEqual({ status: 'waiting', startDay: 101 });
    const c = checkPromise(p, [day(100, 300), day(101, 176), day(102, 170)], 102);
    expect(c).toMatchObject({ status: 'seen', days: 2, actualPerDay: 173, promisedPerDay: 180, gap: -7, verdict: 'on_track' });
    expect(checkPromise(p, [day(101, 120)], 101)).toMatchObject({ verdict: 'below' });
    expect(checkPromise(p, [day(101, 230)], 101)).toMatchObject({ verdict: 'above' });
    expect(checkPromise({ ...p, after: null }, [day(101, 230)], 101)).toMatchObject({ verdict: 'no_forecast' });
  });

  it('report day is the end of the month of the first new day; it expires a week later', () => {
    expect(reportDayFor(100)).toBe(120);
    expect(reportDayFor(120)).toBe(150);
    expect(promiseExpired(p, 127)).toBe(false);
    expect(promiseExpired(p, 128)).toBe(true);
  });

  it('kept on the device per business', () => {
    savePromise(p);
    expect(loadPromise('b1')).toEqual(p);
    expect(loadPromise('b2')).toBeNull();
    clearPromise('b1');
    expect(loadPromise('b1')).toBeNull();
  });
});

describe('decision: one thing waits on Today', () => {
  it('critical advice first', () => {
    const d = nextDecision(fixture('open'), null);
    expect(d?.kind).toBe('advice');
    expect(d && d.kind === 'advice' && d.rec.severity).toBe('critical');
  });

  it('a pending fine notice is the decision itself; setup has its own panel', () => {
    expect(nextDecision(fixture('notice'), null)).toBeNull();
    expect(nextDecision(fixture('setup'), null)).toBeNull();
  });

  it('without advice: an offer, then a change below its forecast, then lost customers, then try a change', () => {
    const v = { ...fixture('away'), recommendations: [] };
    expect(nextDecision(v, null)?.kind).toBe('offer');
    const quiet = { ...v, deals: [] };
    const below = { status: 'seen' as const, days: 2, actualPerDay: 120, promisedPerDay: 180, gap: -60, verdict: 'below' as const };
    expect(nextDecision(quiet, below)?.kind).toBe('promise');
    const b = quiet.business!;
    const last = b.days[b.days.length - 1];
    const busy = { ...quiet, business: { ...b, days: [...b.days.slice(0, -1), { ...last, demandUnits: 300, lost: { size: 0, staff: 40, closure: 0 } }] } };
    expect(nextDecision(busy, null)).toMatchObject({ kind: 'lost', reason: 'staff', units: 40 });
    const calm = { ...quiet, business: { ...b, days: b.days.map((d) => ({ ...d, lost: { size: 0, staff: 0, closure: 0 } })) } };
    expect(nextDecision(calm, null)?.kind).toBe('try');
  });

  it('lostToday ignores noise below 2% of demand', () => {
    const d: DayReport = { day: 5, demandUnits: 1000, servedUnits: 990, lost: { size: 10, staff: 0, closure: 0 }, revenue: 0, variableCosts: 0, sizeUtilization: 1, weather: 'clear', notes: [] };
    expect(lostToday([d], 5)).toBeNull();
    expect(lostToday([{ ...d, lost: { size: 30, staff: 0, closure: 0 } }], 5)).toEqual({ reason: 'seats', units: 30, day: 5 });
  });
});

describe('niche numbers in words', () => {
  it('percent, money per month, plain', () => {
    expect(kpiText({ id: 'a', label: 'Chair utilization', value: 62.46, unit: '%' })).toBe('62.5%');
    expect(kpiText({ id: 'b', label: 'Revenue per barber', value: 4210, unit: '$/mo' })).toBe('$4,210/mo');
    expect(kpiText({ id: 'c', label: 'Seat turns', value: 9.1, unit: 'x' })).toBe('9.1x');
    expect(kpiText({ id: 'd', label: 'Wait', value: 4, unit: 'min' })).toBe('4 min');
  });
});
