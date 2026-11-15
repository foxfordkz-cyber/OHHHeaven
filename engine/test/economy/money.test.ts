import { describe, expect, it } from 'vitest';
import type { GameEvent, MonthReport, WorldState } from '@ohh/shared';
import { tickDay } from '../../src/index';
import { act, cafeCity, run } from '../fixtures/world';

const sumLines = (lines: { amount: number }[]) => Math.round(lines.reduce((a, l) => a + l.amount, 0) * 100) / 100;

describe('month close', () => {
  it('six identical honest cafes: nobody goes bankrupt, profit is positive and at most 25% of revenue', () => {
    let { w, ctx } = cafeCity(6);
    w = run(w, ctx, 360 - w.day);
    expect(w.phase).toBe('ended');
    for (const b of w.businesses) {
      expect(b.status).not.toBe('bankrupt');
      expect(b.history).toHaveLength(12);
      const revenue = b.history.reduce((a, m) => a + m.revenue, 0);
      const profit = b.history.reduce((a, m) => a + m.profit, 0);
      expect(profit).toBeGreaterThan(0);
      expect(profit).toBeLessThanOrEqual(0.25 * revenue);
      for (const m of b.history.slice(1)) expect(m.profit).toBeGreaterThan(0);
    }
    const ranks = w.businesses.map((b) => b.history.at(-1)!.rankInNiche).sort();
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('every month the lines add up to the change of cash, whatever the owner does', () => {
    let { w, ctx } = cafeCity(3);
    const plan: Record<number, (x: WorldState) => WorldState> = {
      25: (x) => act(x, ctx, 'pl1', { type: 'spend', kind: 'marketing', amount: 1500 }),
      33: (x) => act(x, ctx, 'pl1', { type: 'buy_item', itemId: 'pastry_case', qty: 1 }),
      40: (x) => act(x, ctx, 'pl2', { type: 'set_orders', orders: { shortcuts: ['cash_wages', 'skip_pest_control'], levers: { cleaning: 'minimal' } } }),
      47: (x) => act(x, ctx, 'pl3', { type: 'resize', size: 22 }),
      52: (x) => act(x, ctx, 'pl3', { type: 'sell_item', itemId: 'grinder', qty: 1 }),
      61: (x) => act(x, ctx, 'pl1', { type: 'set_orders', orders: { price: 7.25, staff: { barista: 3, shift_lead: 1 }, autopilot: 'manager', blockFund: true } }),
      75: (x) => act(x, ctx, 'pl2', { type: 'spend', kind: 'training', amount: 2000 }),
    };
    while (w.day < 180) {
      w = tickDay(w, ctx);
      if (plan[w.day]) w = plan[w.day](w);
    }
    for (const b of w.businesses) {
      for (const m of b.history) {
        expect(sumLines(m.lines)).toBeCloseTo(m.cashEnd - m.cashStart, 2);
      }
      for (let i = 1; i < b.history.length; i++) expect(b.history[i].cashStart).toBe(b.history[i - 1].cashEnd);
    }
    const m3 = w.businesses[0].history[2];
    const kinds = new Set(m3.lines.map((l) => l.kind));
    for (const k of ['revenue', 'cogs', 'rent', 'payroll', 'payroll_tax', 'opex', 'tax', 'deal']) expect(kinds.has(k as never)).toBe(true);
    expect(m3.lines.some((l) => l.id === 'payroll_manager')).toBe(true);
    const cheat = w.businesses[1].history[2];
    expect(cheat.lines.some((l) => l.kind === 'saving' && /cash_wages/.test(l.id))).toBe(true);
  });

  it('sales tax collected sits in liabilities until its quarter is due, then it is paid', () => {
    let { w, ctx } = cafeCity(1);
    w = run(w, ctx, 100 - w.day);
    const due = w.businesses[0].liabilities.filter((l) => l.taxId === 'sales_tax' && !l.paid);
    expect(due.length).toBeGreaterThan(0);
    expect(due[0].dueDay).toBe(110);
    w = run(w, ctx, 10);
    const q1 = w.businesses[0].liabilities.find((l) => l.taxId === 'sales_tax' && l.dueDay === 110)!;
    expect(q1.paid).toBe(true);
    expect(w.businesses[0].mtd.lines.some((l) => l.id === 'sales_tax_paid_sales_tax_d110')).toBe(true);
    // every sales tax line says so in its id, whatever the pack calls the tax (agents 10 and 11 filter by it)
    expect(w.businesses[0].mtd.lines.filter((l) => l.kind === 'tax' && /sales tax/i.test(l.label)).every((l) => l.id.includes('sales_tax'))).toBe(true);
  });

  it('a business that spent the sales tax it collected goes bankrupt on the day the tax is due', () => {
    let { w, ctx } = cafeCity(1);
    w = run(w, ctx, 109 - w.day);
    const owed = w.businesses[0].liabilities.filter((l) => !l.paid && l.dueDay === 110).reduce((a, l) => a + l.amount, 0);
    expect(owed).toBeGreaterThan(5000);
    w = act(w, ctx, 'pl1', { type: 'spend', kind: 'marketing', amount: Math.floor(w.businesses[0].cash - 100) });
    w = tickDay(w, ctx);
    const b = w.businesses[0];
    expect(b.status).toBe('bankrupt');
    expect(b.bankruptDay).toBe(110);
    expect(w.feed.at(-1)!.kind).toBe('bankruptcy');
    expect(w.players[0].inbox.at(-1)!.title).toMatch(/taxes/i);
  });

  it('a business that cannot cover the month bills goes bankrupt at the month close', () => {
    let { w, ctx } = cafeCity(1, { size: 8, placesOver: { rentPerSqftYear: 400 } });
    w = run(w, ctx, 200);
    const b = w.businesses[0];
    expect(b.status).toBe('bankrupt');
    expect((b.bankruptDay ?? 0) % 30).toBe(0);
  });

  it('a business still in setup pays rent from the first day and sells nothing', () => {
    let { w } = cafeCity(1, { launchDay: 45, launch: false });
    const b = w.businesses[0];
    expect(b.status).toBe('setup');
    const m1 = b.history[0];
    expect(m1.revenue).toBe(0);
    expect(m1.lines.find((l) => l.kind === 'rent')!.amount).toBeCloseTo(-6000, 0);
    expect(m1.lines.some((l) => l.kind === 'payroll')).toBe(false);
    expect(b.days.at(-1)!.notes[0]).toMatch(/Not open yet/);
  });
});

describe('month boundary with other modules', () => {
  it('lines added by deals (into the closed report) and by law (into the new month) keep every month balanced', async () => {
    const { economyDay, economyMonthClose, syncMonthStart } = await import('../../src/economy/index');
    let { w, ctx } = cafeCity(1);
    w = run(w, ctx, 59 - w.day);
    // day 60: economy day and close, then a deals line into the closed report and a law fine into the new month
    w = economyMonthClose(economyDay({ ...w, day: 60 }, ctx), ctx);
    const b = w.businesses[0];
    const report = b.history.at(-1)!;
    const dealLine = { id: 'deal:loan:x', label: 'Loan payment', kind: 'deal' as const, amount: -250 };
    const fineLine = { id: 'fine:c1', label: 'Fine: dirty surfaces', kind: 'fine' as const, amount: -300 };
    const patched = {
      ...b,
      cash: b.cash - 250 - 300,
      history: [...b.history.slice(0, -1), { ...report, lines: [...report.lines, dealLine], cashEnd: report.cashEnd - 250 }],
      mtd: { ...b.mtd, lines: [...b.mtd.lines, fineLine] },
    };
    w = syncMonthStart({ ...w, businesses: [patched] });
    w = run(w, ctx, 30);
    const [m2, m3] = w.businesses[0].history.slice(-2);
    expect(sumLines(m2.lines)).toBeCloseTo(m2.cashEnd - m2.cashStart, 2);
    expect(sumLines(m3.lines)).toBeCloseTo(m3.cashEnd - m3.cashStart, 2);
    expect(m3.lines.some((l) => l.id === 'fine:c1')).toBe(true);
    expect(m3.fines).toBe(300);
  });
});

describe('sales tax base', () => {
  it('taxableShare and taxableShareByTax set which part of revenue each sales tax applies to', async () => {
    const { taxableShare } = await import('../../src/economy/taxes');
    const { cafePack } = await import('../fixtures/cafe');
    expect(taxableShare(cafePack, 'sales_tax')).toBe(0.9);
    const shop = { ...cafePack, extra: { taxableShare: 1, taxableShareByTax: { retail_sales_tax: 0.1, service_tax: 1 } } };
    expect(taxableShare(shop, 'retail_sales_tax')).toBe(0.1);
    expect(taxableShare(shop, 'service_tax')).toBe(1);
    expect(taxableShare(shop, 'other')).toBe(1);
    let { w, ctx } = cafeCity(1);
    w = run(w, ctx, 10);
    const day = w.businesses[0].days.at(-1)!;
    const collected = w.businesses[0].mtd.lines.find((l) => l.id === 'sales_tax_collected')!.amount;
    expect(collected).toBeGreaterThan(0);
    expect(day.revenue * 0.9 * 0.08875).toBeLessThan(collected);
  });
});

describe('payroll taxes with a wage base per worker', () => {
  it('FUTA stops at $7,000 per worker a season and NY SUI at $17,600 (_common.extra.wageBases)', () => {
    let { w, ctx } = cafeCity(1);
    w = run(w, ctx, 360 - w.day);
    const b = w.businesses[0];
    const staff = Object.values(b.orders.staff).reduce((a, n) => a + n, 0);
    const accrued = (id: string) => b.liabilities.filter((l) => l.taxId === id).reduce((a, l) => a + l.amount, 0);
    expect(accrued('futa')).toBeCloseTo(0.006 * 7000 * staff, 0);
    expect(accrued('ny_sui')).toBeCloseTo(0.041 * 17600 * staff, 0);
    const payroll = b.history.reduce((a, m) => a + m.lines.filter((l) => l.kind === 'payroll').reduce((x, l) => x - l.amount, 0), 0);
    expect(accrued('ny_sui')).toBeLessThan(0.041 * payroll);
  });
});

describe("'wages' events and the headcount at the month end", () => {
  it("a 'wages' event raises hourly pay for the days it lasts, not the manager's salary; staffPrev keeps the month-end staff", () => {
    const { w, ctx } = cafeCity(1);
    let x = act(w, ctx, 'pl1', { type: 'set_orders', orders: { autopilot: 'manager' } });
    x = run(x, ctx, 30 - x.day);                                   // month 1 closed on day 30
    const b = x.businesses[0];
    expect(b.staffPrev).toEqual(b.orders.staff);
    const hike: GameEvent = { id: 'mw', kind: 'regulation', title: 'Minimum wage goes up', text: '', announcedDay: 25, startDay: 31, endDay: 45, effects: [{ target: 'wages', mult: 1.2 }], origin: 'deck' };
    const plain = run(x, ctx, 30).businesses[0].history.at(-1)!;
    const raised = run({ ...x, events: [hike] }, ctx, 30).businesses[0].history.at(-1)!;
    const pay = (m: MonthReport, id: string) => -(m.lines.find((l) => l.id === id)?.amount ?? 0);
    expect(plain.month).toBe(2);
    for (const role of ctx.packs.niches.cafe!.staff) {
      if (pay(plain, `payroll_${role.id}`) === 0) continue;
      expect(pay(raised, `payroll_${role.id}`) / pay(plain, `payroll_${role.id}`)).toBeCloseTo(1 + 0.2 * 15 / 30, 3);   // 15 of 30 days at +20%
    }
    expect(pay(plain, 'payroll_manager')).toBeGreaterThan(0);
    expect(pay(raised, 'payroll_manager')).toBe(pay(plain, 'payroll_manager'));
    expect(sumLines(raised.lines)).toBeCloseTo(raised.cashEnd - raised.cashStart, 2);
  });
});

describe('the base month of the notes (research/market/notes/Стоимость кофейни Нью Йорка 2026/economics.md)', () => {
  it('an honest standard cafe on an average block sells about 200 checks a day at $8.50 and keeps about $4,000 a month', () => {
    let { w, ctx } = cafeCity(6);
    w = run(w, ctx, 180 - w.day);
    const b = w.businesses[0];
    expect(b.orders.staff).toEqual({ barista: 4, shift_lead: 1 });
    for (const m of b.history.slice(1)) {   // month 1 is the opening month
      expect(m.servedUnits / 30).toBeGreaterThan(190);
      expect(m.servedUnits / 30).toBeLessThan(210);
      expect(m.avgPrice).toBe(8.5);
      expect(m.profit).toBeGreaterThan(2_500);
      expect(m.profit).toBeLessThan(5_500);
    }
  });
});
