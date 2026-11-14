import { describe, expect, it } from 'vitest';
import rawPack from '../../../packs/barbershop.json';
import { dateOf } from '@ohh/shared';
import type { BusinessState, DayReport, MonthReport, Pack, StandingOrders } from '@ohh/shared';
import { capacityDay, cutters, demandMult, departureMult, extraLines, hooks, kpis, lostBarberShare, notes, weekdayMult } from '../../src/niches/barbershop';

const pack = rawPack as unknown as Pack;

function orders(over: Partial<StandingOrders> = {}): StandingOrders {
  return {
    price: 50, staff: { barber: 4 }, levers: { pay_model: 'hourly', cleaning: 'staff_daily', booking: 'walk_in', retail: 'none', amenities: 'basic' },
    shortcuts: [], blockFund: false, autopilot: 'hold', ...over,
  };
}

function business(over: Partial<BusinessState> = {}): BusinessState {
  return {
    id: 'b1', name: 'Test Cuts', niche: 'barbershop', placeId: 'p1', isAi: false,
    owners: [{ playerId: 'u1', share: 1 }], managerPlayerId: 'u1', status: 'open', createdDay: 1, openedDay: 1,
    cash: 40000, size: 4, items: [], setupSpent: 45000, permits: [], quality: 0.5, reputation: 0.5,
    trust: { kept: 0, broken: 0 }, orders: orders(), trails: [], liabilities: [],
    mtd: { lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } },
    days: [], history: [], ...over,
  };
}

function month(capacityUnits: number): MonthReport {
  return {
    month: 1, avgPrice: 50, demandUnits: 600, servedUnits: 560, lost: { size: 0, staff: 0, closure: 0 }, capacityUnits, sizeUtilization: 0.5,
    lines: [], revenue: 28000, profit: 2500, cashStart: 40000, cashEnd: 42500, taxesAccrued: 0, taxesPaid: 0, fines: 0,
    quality: 0.5, reputation: 0.5, netWorth: 60000, rankInNiche: 1,
  };
}

function day(d: number, over: Partial<DayReport> = {}): DayReport {
  return { day: d, demandUnits: 20, servedUnits: 20, lost: { size: 0, staff: 0, closure: 0 }, revenue: 1000, variableCosts: 32, sizeUtilization: 0.5, weather: 'clear', notes: [], ...over };
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}

describe('barbershop: Friday and Saturday peak', () => {
  it('weekday multipliers average to 1 over a week', () => {
    const sum = [0, 1, 2, 3, 4, 5, 6].reduce((a, w) => a + weekdayMult(w, pack), 0);
    expect(sum).toBeCloseTo(7, 6);
  });

  it('Friday and Saturday are the two busiest days, Monday the slowest', () => {
    const m = [0, 1, 2, 3, 4, 5, 6].map((w) => weekdayMult(w, pack));
    const top = [...m].sort((a, b) => b - a);
    expect([m[4], m[5]].sort()).toEqual([top[0], top[1]].sort());
    expect(m[4]).toBeGreaterThan(1.2);
    expect(Math.min(...m)).toBe(m[0]);
  });

  it('demandMult follows the game calendar: day 1 is Monday, day 5 Friday, day 6 Saturday', () => {
    const b = business();
    expect(demandMult(b, dateOf(5), pack)).toBeGreaterThan(demandMult(b, dateOf(1), pack) * 2);
    expect(demandMult(b, dateOf(6), pack)).toBeCloseTo(demandMult(b, dateOf(5), pack), 6);
    expect(demandMult(b, dateOf(8), pack)).toBeCloseTo(demandMult(b, dateOf(1), pack), 6);
  });
});

describe('barbershop: chairs and barbers', () => {
  const perBarberDay = pack.capacity.unitsPerStaffMonth! / 30;
  const perChairDay = pack.sizing.unitsServedPerSizeMonth / 30;

  it('four barbers on four chairs are limited by the barbers', () => {
    expect(capacityDay(business(), pack)).toBeCloseTo(4 * perBarberDay, 6);
  });

  it('a chair without a barber earns nothing', () => {
    expect(capacityDay(business({ orders: orders({ staff: {} }) }), pack)).toBe(0);
    expect(capacityDay(business({ orders: orders({ staff: { barber: 1 } }) }), pack)).toBeCloseTo(perBarberDay, 6);
  });

  it('barbers without chairs are limited by the chairs', () => {
    expect(capacityDay(business({ size: 2 }), pack)).toBeCloseTo(2 * perChairDay, 6);
  });

  it('the front desk cuts no hair but frees the barbers a little', () => {
    expect(capacityDay(business({ orders: orders({ staff: { front_desk: 3 } }) }), pack)).toBe(0);
    const withDesk = capacityDay(business({ orders: orders({ staff: { barber: 4, front_desk: 1 } }) }), pack);
    expect(withDesk).toBeCloseTo(4 * perBarberDay * 1.05, 6);
  });

  it('an apprentice counts as 60% of a barber', () => {
    const b = business({ orders: orders({ staff: { barber: 2, apprentice: 1 } }) });
    expect(cutters(b, pack)).toEqual({ heads: 3, effective: 2.6 });
    expect(capacityDay(b, pack)).toBeCloseTo(2.6 * perBarberDay, 6);
  });
});

describe('barbershop: a barber who leaves takes clients along', () => {
  const fourBarbersMonth = 4 * pack.capacity.unitsPerStaffMonth!;

  it('no history, no loss', () => {
    expect(departureMult(business(), pack)).toBe(1);
  });

  it('same headcount as last month, no loss', () => {
    expect(departureMult(business({ history: [month(fourBarbersMonth)] }), pack)).toBe(1);
  });

  it('one of four barbers left: a quarter of the book, 32% of it follows', () => {
    const b = business({ orders: orders({ staff: { barber: 3 } }), history: [month(fourBarbersMonth)] });
    expect(lostBarberShare(b, pack)).toBeCloseTo(0.25, 6);
    expect(departureMult(b, pack)).toBeCloseTo(1 - 0.32 * 0.25, 6);
    expect(demandMult(b, dateOf(4), pack)).toBeCloseTo(weekdayMult(3, pack) * 0.92, 6);
  });

  it('hiring does not reduce demand', () => {
    const b = business({ orders: orders({ staff: { barber: 5 } }), history: [month(fourBarbersMonth)] });
    expect(departureMult(b, pack)).toBe(1);
  });

  it('removing chairs while keeping the barbers is not a departure', () => {
    const b = business({ size: 2, history: [month(fourBarbersMonth)] });
    expect(departureMult(b, pack)).toBe(1);
  });

  it('the loss ends when the month closes with the new headcount', () => {
    const threeBarbersMonth = 3 * pack.capacity.unitsPerStaffMonth!;
    const b = business({ orders: orders({ staff: { barber: 3 } }), history: [month(fourBarbersMonth), month(threeBarbersMonth)] });
    expect(departureMult(b, pack)).toBe(1);
  });
});

describe('barbershop: month-close lines', () => {
  const basePay = 4 * 22.3 * 160;

  it('hourly pay and no retail add nothing', () => {
    const b = business({ mtd: { lines: [{ id: 'sales', label: 'Sales', kind: 'revenue', amount: 40000 }], demandUnits: 800, servedUnits: 800, lost: { size: 0, staff: 0, closure: 0 } } });
    expect(extraLines(b, pack, 1)).toEqual([]);
  });

  it('commission pays the difference above hourly pay, with payroll taxes', () => {
    const b = business({
      orders: orders({ levers: { pay_model: 'commission', retail: 'none' } }),
      mtd: { lines: [{ id: 'sales', label: 'Sales', kind: 'revenue', amount: 40000 }], demandUnits: 800, servedUnits: 800, lost: { size: 0, staff: 0, closure: 0 } },
    });
    const lines = extraLines(b, pack, 1);
    const topUp = 0.5 * 40000 - basePay;
    expect(lines.find((l) => l.id === 'commission_topup')).toMatchObject({ kind: 'payroll', amount: -topUp });
    expect(lines.find((l) => l.id === 'commission_topup_tax')!.amount).toBeCloseTo(-topUp * 0.1, 2);
  });

  it('in a slow month commission never goes below hourly pay: no negative top-up', () => {
    const b = business({
      orders: orders({ levers: { pay_model: 'commission', retail: 'none' } }),
      mtd: { lines: [{ id: 'sales', label: 'Sales', kind: 'revenue', amount: 20000 }], demandUnits: 400, servedUnits: 400, lost: { size: 0, staff: 0, closure: 0 } },
    });
    expect(extraLines(b, pack, 1)).toEqual([]);
  });

  it('the retail shelf sells $2.50 per haircut at half cost', () => {
    const b = business({
      orders: orders({ levers: { pay_model: 'hourly', retail: 'shelf' } }),
      mtd: { lines: [], demandUnits: 600, servedUnits: 600, lost: { size: 0, staff: 0, closure: 0 } },
    });
    expect(extraLines(b, pack, 1)).toEqual([
      { id: 'retail_sales', label: 'Retail product sales', kind: 'revenue', amount: 1500 },
      { id: 'retail_cogs', label: 'Retail products at wholesale cost', kind: 'cogs', amount: -750 },
    ]);
  });
});

describe('barbershop: indicators and notes', () => {
  it('reports chair utilization, revenue per barber and returning clients', () => {
    const b = business({
      days: [day(14), day(15)],
      mtd: { lines: [{ id: 'sales', label: 'Sales', kind: 'revenue', amount: 14000 }], demandUnits: 300, servedUnits: 280, lost: { size: 0, staff: 0, closure: 0 } },
    });
    const k = kpis(b, pack);
    expect(k.map((x) => x.id)).toEqual(['chair_utilization', 'revenue_per_barber', 'returning_clients']);
    // 280 cuts in 15 days on 4 chairs that could take 4 * 300 * 15/30 = 600
    expect(k[0]).toMatchObject({ value: 46.7, unit: '%' });
    // $14,000 in half a month = $28,000 a month over 4 barbers
    expect(k[1]).toMatchObject({ value: 7000, unit: '$/mo' });
    // 44.63% returning clients at average reputation
    expect(k[2]).toMatchObject({ value: 44.6, unit: '%' });
  });

  it('a better reputation means more returning clients; a departure means fewer', () => {
    const base = kpis(business({ days: [day(10)] }), pack)[2].value;
    const loved = kpis(business({ days: [day(10)], reputation: 0.9 }), pack)[2].value;
    const afterLoss = kpis(business({ days: [day(10)], orders: orders({ staff: { barber: 3 } }), history: [month(4 * 220)] }), pack)[2].value;
    expect(loved).toBeGreaterThan(base);
    expect(afterLoss).toBeLessThan(base);
  });

  it('empty shop: indicators are zero, not NaN', () => {
    const k = kpis(business({ orders: orders({ staff: {} }) }), pack);
    expect(k.every((x) => Number.isFinite(x.value))).toBe(true);
    expect(k[0].value).toBe(0);
    expect(k[1].value).toBe(0);
  });

  it('notes name the Saturday rush and the idle chair', () => {
    const b = business({ size: 5 });
    const n = notes(b, day(6, { lost: { size: 0, staff: 7, closure: 0 } }), pack);
    expect(n).toContain('Saturday rush: 7 clients left because every barber was busy.');
    expect(n).toContain('1 chair has no barber. An empty chair earns nothing and still costs rent.');
  });

  it('notes mention the barber who left', () => {
    const b = business({ orders: orders({ staff: { barber: 3 } }), size: 3, history: [month(4 * 220)] });
    expect(notes(b, day(2), pack)).toEqual(['A barber left this month and took regulars along: about 8% fewer clients until the month closes.']);
  });

  it('a quiet, fully staffed day has no notes', () => {
    expect(notes(business(), day(2), pack)).toEqual([]);
  });
});

describe('barbershop: hooks are pure', () => {
  it('same input, same output, input untouched', () => {
    const b = deepFreeze(business({
      orders: orders({ staff: { barber: 3, apprentice: 1, front_desk: 1 }, levers: { pay_model: 'commission', retail: 'shelf' } }),
      history: [month(4 * 220)], days: [day(35), day(36)],
      mtd: { lines: [{ id: 'sales', label: 'Sales', kind: 'revenue', amount: 9000 }], demandUnits: 200, servedUnits: 180, lost: { size: 0, staff: 3, closure: 0 } },
    }));
    const frozenPack = deepFreeze(JSON.parse(JSON.stringify(pack)) as Pack);
    const run = () => JSON.stringify([
      hooks.demandMult!(b, dateOf(36), frozenPack), hooks.capacityDay!(b, frozenPack), hooks.extraLines!(b, frozenPack, 2),
      hooks.kpis!(b, frozenPack), hooks.notes!(b, b.days[1], frozenPack),
    ]);
    expect(run()).toBe(run());
  });

  it('works without the extra block: fallbacks keep the same shape', () => {
    const bare = { ...pack, extra: undefined } as Pack;
    expect(weekdayMult(4, bare)).toBeCloseTo(1.4, 6);
    expect(capacityDay(business(), bare)).toBeGreaterThan(0);
  });
});

describe('barbershop pack: numbers hold together', () => {
  const setup = new Map(pack.setup.map((x) => [x.id, x]));
  const kitTotal = (id: string) => {
    const kit = pack.kits.find((k) => k.id === id)!;
    return kit.items.reduce((a, it) => a + setup.get(it.id)!.cost * (setup.get(it.id)!.scalesWithSize ? kit.size : it.qty), 0);
  };

  it('every kit fits the starting capital and gets more expensive from lean to premium', () => {
    expect(kitTotal('lean')).toBeLessThan(kitTotal('standard'));
    expect(kitTotal('standard')).toBeLessThan(kitTotal('premium'));
    expect(kitTotal('premium')).toBeLessThan(pack.startCapital);
  });

  it('kit size fits 3-5 chairs and scaled items carry the kit size', () => {
    for (const kit of pack.kits) {
      expect(kit.size).toBeGreaterThanOrEqual(3);
      expect(kit.size).toBeLessThanOrEqual(5);
      for (const it of kit.items) if (setup.get(it.id)!.scalesWithSize) expect(it.qty).toBe(kit.size);
    }
  });

  it('both licenses are required, have a wait and a violation for opening without them', () => {
    const violations = new Set(pack.violations.map((v) => v.id));
    for (const id of ['shop_owner_license', 'dohmh_barber_permit']) {
      const it = setup.get(id)!;
      expect(it.required).toBe(true);
      expect(it.waitDays).toBeGreaterThan(0);
      expect(violations.has(it.withoutItViolation!)).toBe(true);
    }
  });

  it('every violation is checked by an official and can be reported', () => {
    const checked = new Set(pack.officials.flatMap((o) => o.checks));
    const reportable = new Set(pack.reports.flatMap((r) => r.checks));
    for (const v of pack.violations) {
      expect(checked.has(v.id), `${v.id} has no official`).toBe(true);
      expect(reportable.has(v.id), `${v.id} cannot be reported`).toBe(true);
    }
  });

  it('haircuts are taxed at the city rate only, products at the full rate', () => {
    expect(pack.taxes.find((t) => t.id === 'nyc_service_sales_tax')!.rate).toBe(0.045);
    expect(pack.taxes.find((t) => t.id === 'retail_sales_tax')!.rate).toBe(0.08875);
  });

  it('no barber is paid below the NYC minimum wage, and there is no tip credit', () => {
    for (const r of pack.staff) {
      expect(r.hourlyWage).toBeGreaterThanOrEqual(17);
      if (r.tipped) expect(r.cashWage).toBe(r.hourlyWage);
    }
  });

  it('an honest owner at the reference price ends a typical month with a small profit', () => {
    // 4 chairs, 4 barbers, mid-tier rent, 580 haircuts at $50; all legal levers at their plain option.
    const cuts = 580, price = pack.unit.refPrice, chairs = 4, barbers = 4;
    const revenue = cuts * price;
    const barber = pack.staff.find((r) => r.id === 'barber')!;
    const payroll = barbers * barber.hourlyWage * barber.hoursPerMonth;
    const payrollTax = payroll * (pack.extra as { payModels: { employerPayrollTaxRate: number } }).payModels.employerPayrollTaxRate;
    const rent = (pack.extra as { rentByTier: { mid: { monthlyFor750Sqft: number } } }).rentByTier.mid.monthlyFor750Sqft;
    const other = pack.monthlyCosts.reduce((a, c) => a + (c.basis === 'fixed' ? c.amount : c.basis === 'per_staff' ? c.amount * barbers : c.basis === 'per_size' ? c.amount * chairs : c.basis === 'per_unit' ? c.amount * cuts : c.amount * revenue), 0);
    const cleaning = pack.levers.find((l) => l.id === 'cleaning')!.options.find((o) => o.id === 'staff_daily')!.monthlyCost + chairs * pack.sizing.cleaningCostPerSizeMonth;
    const profit = revenue - cuts * pack.unit.cogsPerUnit - payroll - payrollTax - rent - other - cleaning;
    expect(profit).toBeGreaterThan(0);
    expect(profit / revenue).toBeLessThan(0.2);
  });
});
