import { describe, expect, it } from 'vitest';
import type { GameEvent, WorldState } from '@ohh/shared';
import { applyAction, createWorld, netWorth, tickDay } from '../../src/index';
import { NICHE_HOOKS } from '../../src/niches/index';
import { cafePack } from '../fixtures/cafe';
import { cafeCity, config, deepFreeze, run } from '../fixtures/world';

describe('createWorld, applyAction, tickDay, netWorth', () => {
  it('creates an empty running world on day 1 (the opening day; tickDay computes day 2 next)', () => {
    const w = createWorld(config());
    expect(w.day).toBe(1);
    expect(w.phase).toBe('running');
    expect(w.businesses).toEqual([]);
  });

  it('is deterministic and never mutates its input', () => {
    const a = cafeCity(4);
    const b = cafeCity(4);
    const wa = run(a.w, a.ctx, 70);
    const wb = run(b.w, b.ctx, 70);
    expect(JSON.stringify(wa)).toBe(JSON.stringify(wb));
    const frozen = deepFreeze(structuredClone(wa));
    const snapshot = JSON.stringify(frozen);
    const next = tickDay(frozen, a.ctx);
    expect(next.day).toBe(frozen.day + 1);
    const r = applyAction(frozen, a.ctx, 'pl1', { type: 'set_orders', orders: { price: 7 } });
    expect(r.error).toBeUndefined();
    const s = applyAction(frozen, a.ctx, 'pl2', { type: 'spend', kind: 'marketing', amount: 500 });
    expect(s.error).toBeUndefined();
    expect(JSON.stringify(frozen)).toBe(snapshot);
  });

  it('bumps the version on every change and reports unknown actions and players', () => {
    const { w, ctx } = cafeCity(1);
    const r = applyAction(w, ctx, 'pl1', { type: 'set_orders', orders: { price: 7 } });
    expect(r.world.version).toBe(w.version + 1);
    expect(tickDay(w, ctx).version).toBe(w.version + 1);
    expect(applyAction(w, ctx, 'nobody', { type: 'launch' }).error).toBe('Unknown player');
    expect(applyAction(w, ctx, 'pl1', { type: 'no_such_action' } as never).error).toMatch(/Unknown action/);
  });

  it('net worth counts cash, half of furniture and equipment, minus unpaid taxes', () => {
    let { w, ctx } = cafeCity(1);
    w = run(w, ctx, 60);
    const b = w.businesses[0];
    const equip = b.items.reduce((a, it) => {
      const def = cafePack.setup.find((s) => s.id === it.id)!;
      return a + (def.kind === 'equipment' || def.kind === 'furniture' ? def.cost * it.qty : 0);
    }, 0);
    const owed = b.liabilities.filter((l) => !l.paid).reduce((a, l) => a + l.amount, 0);
    expect(netWorth(b, ctx)).toBeCloseTo(b.cash + 0.5 * equip - owed, 1);
  });
});

describe('day: weather, events, weekday, closures, hooks', () => {
  const base = () => {
    const { w, ctx } = cafeCity(2);
    return { w: run(w, ctx, 2), ctx };   // day 23
  };
  const demandNext = (w: WorldState, ctx: ReturnType<typeof base>['ctx'], over: Partial<WorldState> = {}) =>
    tickDay({ ...w, ...over }, ctx).businesses[0].days.at(-1)!;

  it('weekday multipliers: Saturday +15%, Sunday −10% (pack.extra.weekdayMult)', () => {
    let { w, ctx } = base();
    while ((w.day + 1 - 1) % 7 !== 4) w = tickDay(w, ctx);  // next day is a Friday
    const fri = tickDay(w, ctx);
    const sat = tickDay(fri, ctx);
    const sun = tickDay(sat, ctx);
    const d = (x: WorldState) => x.businesses[1].days.at(-1)!.demandUnits;
    expect(d(sat) / d(fri)).toBeCloseTo(1.15, 1);
    expect(d(sun) / d(fri)).toBeCloseTo(0.9, 1);
  });

  it('weather foot traffic scales demand and leaves a note', () => {
    const { w, ctx } = base();
    const plain = demandNext(w, ctx);
    const rainy = demandNext(w, ctx, { weather: [{ day: w.day + 1, tempF: 45, condition: 'rain', footTrafficMult: 0.8, label: 'Rain' }] });
    expect(rainy.demandUnits / plain.demandUnits).toBeCloseTo(0.8, 1);
    expect(rainy.weather).toBe('rain');
    expect(rainy.notes.some((n) => n.startsWith('Rain: foot traffic -20%'))).toBe(true);
  });

  it('event effects are clipped to 0.5–1.5 and filtered by niche, tier and block', () => {
    const { w, ctx } = base();
    const ev = (effects: GameEvent['effects'], block?: string): GameEvent => ({ id: 'e1', kind: 'city', title: 'Street fair', text: '', announcedDay: 0, startDay: 1, endDay: 999, effects, origin: 'deck', block });
    const plain = demandNext(w, ctx).demandUnits;
    expect(demandNext(w, ctx, { events: [ev([{ target: 'demand', mult: 3 }])] }).demandUnits / plain).toBeCloseTo(1.5, 1);
    expect(demandNext(w, ctx, { events: [ev([{ target: 'demand', mult: 0.1 }])] }).demandUnits / plain).toBeCloseTo(0.5, 1);
    expect(demandNext(w, ctx, { events: [ev([{ target: 'demand', mult: 1.3, niches: ['barbershop'] }])] }).demandUnits).toBe(plain);
    expect(demandNext(w, ctx, { events: [ev([{ target: 'demand', mult: 1.3, tiers: ['prime'] }])] }).demandUnits).toBe(plain);
    expect(demandNext(w, ctx, { events: [ev([{ target: 'demand', mult: 1.3 }], 'other-block')] }).demandUnits).toBe(plain);
    const fair = demandNext(w, ctx, { events: [ev([{ target: 'footTraffic', mult: 1.2, tiers: ['mid'], niches: ['cafe'] }], 'main-st-100')] });
    expect(fair.demandUnits / plain).toBeCloseTo(1.2, 1);
    expect(fair.notes).toContain('Event: Street fair');
    const pricey = tickDay({ ...w, events: [ev([{ target: 'cogs', mult: 1.25 }])] }, ctx).businesses[0].days.at(-1)!;
    const normal = tickDay(w, ctx).businesses[0].days.at(-1)!;
    expect(pricey.variableCosts / pricey.servedUnits).toBeCloseTo(1.25 * normal.variableCosts / normal.servedUnits, 2);
    const strike = tickDay({ ...w, events: [ev([{ target: 'staffAvailability', mult: 0.5 }])] }, ctx).businesses[0].days.at(-1)!;
    expect(strike.lost.staff).toBeGreaterThan(0);
    expect(strike.notes.some((n) => n.startsWith('Short-staffed'))).toBe(true);
  });

  it('a business closed by the city sells nothing, counts the loss and reopens on time', () => {
    const { w, ctx } = base();
    const closed = { ...w, businesses: w.businesses.map((b, i) => (i === 0 ? { ...b, status: 'closed' as const, closedUntilDay: w.day + 2 } : b)) };
    const d1 = tickDay(closed, ctx);
    const r1 = d1.businesses[0].days.at(-1)!;
    expect(r1.servedUnits).toBe(0);
    expect(r1.lost.closure).toBeGreaterThan(0);
    expect(d1.businesses[1].days.at(-1)!.notes.some((n) => /came over from a crowded neighbor/.test(n))).toBe(true);
    const d3 = run(d1, ctx, 2);
    expect(d3.businesses[0].status).toBe('open');
    expect(d3.businesses[0].days.at(-1)!.servedUnits).toBeGreaterThan(0);
  });

  it('niche hooks change demand, capacity, month lines and notes; without hooks the default applies', () => {
    const { w, ctx } = base();
    const plain = demandNext(w, ctx);
    NICHE_HOOKS.cafe = {
      demandMult: () => 1.1,
      capacityDay: () => 50,
      notes: () => ['Morning rush'],
      extraLines: () => [{ id: 'hook_line', label: 'Milk delivery fee', kind: 'opex', amount: -40 }],
    };
    try {
      const hooked = demandNext(w, ctx);
      expect(hooked.demandUnits / plain.demandUnits).toBeCloseTo(1.1, 1);
      expect(hooked.servedUnits).toBeLessThanOrEqual(50);
      expect(hooked.notes).toContain('Morning rush');
      const closed = run(w, ctx, 30 - w.day + 30);
      expect(closed.businesses[0].history.at(-1)!.lines.some((l) => l.id === 'hook_line')).toBe(true);
    } finally {
      delete NICHE_HOOKS.cafe;
    }
  });
});

describe('opening and permits', () => {
  it('opening before the permit is ready leaves a trail at the month close and a warning', () => {
    let { w, ctx } = cafeCity(1, { launchDay: 3 });
    expect(w.businesses[0].status).toBe('open');
    expect(w.players[0].inbox.at(-1)!.title).toBe('Opened without a permit');
    w = run(w, ctx, 30 - w.day);
    const ids = w.businesses[0].trails.map((t) => t.violationId);
    expect(ids).toContain('no_fse_permit');
    expect(ids).toContain('no_food_protection');
  });

  it('opening after the permits are ready leaves no trail', () => {
    let { w, ctx } = cafeCity(1, { launchDay: 22 });
    w = run(w, ctx, 30 - w.day);
    expect(w.businesses[0].trails).toEqual([]);
  });
});

describe('niche hooks: who owns the week and the capacity', () => {
  it('a hook with demandMult and no pack.extra.weekdayMult turns the default week off; capacityDay replaces staff and room limits', () => {
    const plainPack = { ...cafePack, extra: { taxableShare: 0.9 } };
    const { w, ctx } = cafeCity(2, { pack: plainPack });
    let x = w;
    while (x.day % 7 !== 5) x = tickDay(x, ctx);   // day d has weekday (d − 1) mod 7, so the next day is a Saturday
    const satDefault = tickDay(x, ctx).businesses[1].days.at(-1)!.demandUnits;
    NICHE_HOOKS.cafe = { demandMult: () => 1, capacityDay: () => 100 };
    try {
      const sat = tickDay(x, ctx).businesses[1].days.at(-1)!;
      expect(satDefault / sat.demandUnits).toBeCloseTo(1.15, 1);
      expect(sat.servedUnits).toBe(100);
      expect(sat.lost.staff).toBe(sat.demandUnits - 100);   // the hook limit is below the room: not a seat problem
      expect(sat.notes.some((n) => n.startsWith('Short-staffed'))).toBe(true);
      // a niche with its own capacity and its own notes explains the limit itself: the engine does not say it twice
      NICHE_HOOKS.cafe = { capacityDay: () => 100, notes: (_b, r) => (r.lost.staff > 0 ? [`${r.lost.staff} guests left: every barista was busy`] : []) };
      const told = tickDay(x, ctx).businesses[1].days.at(-1)!;
      expect(told.notes.some((n) => n.startsWith('Short-staffed'))).toBe(false);
      expect(told.notes).toContain(`${told.lost.staff} guests left: every barista was busy`);
      NICHE_HOOKS.cafe = { capacityDay: () => 10_000 };
      const roomy = tickDay(x, ctx).businesses[1].days.at(-1)!;
      expect(roomy.lost.size + roomy.lost.staff).toBe(0);
    } finally {
      delete NICHE_HOOKS.cafe;
    }
  });
});
