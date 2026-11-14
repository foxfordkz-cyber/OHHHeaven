import { describe, expect, it } from 'vitest';
import type { WorldState } from '../../../shared/src/types';
import { RULE_IDS, recommend } from '../../src/analytics';
import { makeBusiness, makeWorld, sampleWorld } from '../../src/analytics/__stubs__/fixtures';
import { ctx, run } from './helpers';

const ids = (w: WorldState, id: string) => recommend(w.businesses.find((b) => b.id === id)!, w, ctx).map((r) => r.id);

describe('recommend — seats', () => {
  it('“too few seats” fires on a crowded room', () => {
    const w = run(makeWorld([makeBusiness({ id: 'tiny', placeId: 'p_bedford_212', size: 6 })]), 10);
    const r = recommend(w.businesses[0], w, ctx).find((x) => x.id === 'few_seats');
    expect(r).toBeDefined();
    expect(r!.suggested).toMatchObject({ type: 'resize' });
    expect((r!.suggested as { size: number }).size).toBeGreaterThan(6);
    expect(r!.impact!.profitDeltaMonth).toBeGreaterThan(0);
  });

  it('“too many seats” fires on an empty room', () => {
    const w = run(makeWorld([makeBusiness({ id: 'huge', placeId: 'p_grand_450', size: 40, orders: { staff: { barista: 2 } } }), makeBusiness({ id: 'rival', placeId: 'p_grand_450', isAi: true })]), 10);
    const r = recommend(w.businesses[0], w, ctx).find((x) => x.id === 'many_seats');
    expect(r).toBeDefined();
    expect((r!.suggested as { size: number }).size).toBeLessThan(40);
  });

  it('both stay silent on a well-sized room', () => {
    const w = run(makeWorld([makeBusiness({ id: 'ok', placeId: 'p_bedford_212', size: 18 })]), 10);
    const got = ids(w, 'ok');
    expect(got).not.toContain('few_seats');
    expect(got).not.toContain('many_seats');
  });
});

describe('recommend — every advice has a number, an action and an effect', () => {
  it('there are at least 18 rules', () => {
    expect(RULE_IDS.length).toBeGreaterThanOrEqual(18);
  });

  it('texts carry numbers and one-tap actions', () => {
    const base = run(sampleWorld(), 40);
    const w: WorldState = { ...base, cases: [{ id: 'c1', businessId: 'b_me', role: 'inspector', origin: 'report', openedDay: 38, hints: [], status: 'notice', fine: 2800, found: [{ violationId: 'dirty_surfaces', months: 1, fine: 2800, closureDays: 0 }], answerByDay: 42 }] };
    const recs = recommend(w.businesses.find((b) => b.id === 'b_me')!, w, ctx);
    expect(recs.length).toBeGreaterThan(2);
    for (const r of recs) {
      expect(r.text).toMatch(/\d/);
      expect(r.suggested).toBeDefined();
      expect(typeof r.impact?.profitDeltaMonth).toBe('number');
    }
    const kinds = recs.map((r) => r.id);
    expect(kinds).toContain('notice_waiting');
    expect(kinds).toContain('joint_purchase');
    expect(kinds).toContain('cross_promo');
  });
});

describe('recommend — situational rules', () => {
  it('permits ready → open the doors', () => {
    const b = { ...makeBusiness({ id: 's', placeId: 'p_graham_102', status: 'setup', day: 25 }) };
    const w = makeWorld([b], 25);
    const r = recommend(b, w, ctx).find((x) => x.id === 'launch_ready');
    expect(r?.suggested).toEqual({ type: 'launch' });
    expect(r!.impact!.profitDeltaMonth).toBeGreaterThan(0);
  });

  it('fines would dwarf the savings → stop cutting corners', () => {
    const w = run(makeWorld([makeBusiness({ id: 'cheat', placeId: 'p_bedford_212', orders: { shortcuts: ['cash_wages', 'skip_workers_comp'] } })]), 35);
    const r = recommend(w.businesses[0], w, ctx).find((x) => x.id === 'exposure_high');
    expect(r?.severity).toBe('critical');
    expect(r?.suggested).toMatchObject({ type: 'set_orders', orders: { shortcuts: [] } });
  });

  it('cash runway under two months', () => {
    const w = run(makeWorld([makeBusiness({ id: 'burn', placeId: 'p_grand_450', size: 30, cash: 9000, orders: { price: 5, staff: { barista: 8 } } })]), 8);
    expect(ids(w, 'burn')).toContain('runway_short');
  });

  it('tax due soon and not enough cash', () => {
    const w0 = run(makeWorld([makeBusiness({ id: 't', placeId: 'p_bedford_212' })]), 10);
    const b = { ...w0.businesses[0], cash: 1500, liabilities: [{ taxId: 'sales_tax', amount: 6000, dueDay: 15, paid: false }] };
    const w = { ...w0, businesses: [b] };
    const r = recommend(b, w, ctx).find((x) => x.id === 'tax_cash_short');
    expect(r?.severity).toBe('critical');
    expect(r?.text).toContain('$6,000');
  });

  it('block fund one payer short', () => {
    const w0 = sampleWorld();
    w0.businesses = w0.businesses.map((b) => (b.id === 'b_luna' ? { ...b, orders: { ...b.orders, blockFund: true } } : b));
    const w = run(w0, 10);
    expect(ids(w, 'b_me')).toContain('block_fund_one_short');
  });

  it('an option that breaks the law gets flagged', () => {
    const w = run(makeWorld([makeBusiness({ id: 'dirty', placeId: 'p_bedford_212', orders: { levers: { cleaning: 'minimal' } } })]), 5);
    const r = recommend(w.businesses[0], w, ctx).find((x) => x.id === 'risky_lever' || x.id === 'exposure_high');
    expect(r).toBeDefined();
  });

  it('bad weather ahead suggests a staffing change', () => {
    const w0 = run(sampleWorld(), 10);
    const w: WorldState = { ...w0, events: [{ id: 'e', kind: 'weather', title: 'Blizzard', text: '', announcedDay: 10, startDay: 13, endDay: 15, effects: [{ target: 'footTraffic', mult: 0.6 }], origin: 'deck' }] };
    expect(ids(w, 'b_me')).toContain('event_ahead');
  });

  it('a bankrupt business gets no advice', () => {
    const b = { ...makeBusiness({ id: 'gone', placeId: 'p_bedford_212' }), status: 'bankrupt' as const };
    expect(recommend(b, makeWorld([b], 5), ctx)).toEqual([]);
  });
});
