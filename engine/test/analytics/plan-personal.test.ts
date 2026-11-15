// The personal part of the real-world plan (B09): numbers of this player's place, kit, team and season,
// on the real packs and the real map. Skipped while the packs are not in the repo.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CommonPack, Pack, Place, Player, WorldState } from '../../../shared/src/types';
import { buildoutOf, rentMonthOf } from '../../../shared/src/place';
import { applyAction, createWorld, tickDay } from '../../src/index';
import { recommendOpening } from '../../src/analytics/opening';
import { realWorldPlan, type PersonalRealWorldPlan } from '../../src/analytics/plan';
import { roadmapFor } from '../../src/analytics/roadmap';

const file = (p: string) => new URL(`../../../${p}`, import.meta.url);
const has = existsSync(file('packs/cafe.json')) && existsSync(file('packs/_common.json')) && existsSync(file('data/places.json'));
const load = <T>(p: string): T => JSON.parse(readFileSync(file(p), 'utf8')) as T;

const CONFIG = { id: 'b09', name: 'Plan', city: 'nyc' as const, seasonMonths: 12, dayMs: 2000, paused: false, maxOwners: 100, aiBusinessesTarget: 0, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05, nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 11 };
const owner: Player = { id: 'pl1', name: 'Owner', kind: 'owner', isAi: false, paid: true, joinedDay: 0, lastSeenDay: 0, inbox: [] };

describe.skipIf(!has)('realWorldPlan: the plan of this player (real packs, real map)', () => {
  const cafe = load<Pack>('packs/cafe.json');
  const ctx = { packs: { common: load<CommonPack>('packs/_common.json'), niches: { cafe } }, places: load<Place[]>('data/places.json') };

  /** One recommended standard cafe at `place`, run until `days`, launching as soon as the permits allow. */
  function season(place: Place, days: number): { w: WorldState; plan: PersonalRealWorldPlan } {
    let w: WorldState = { ...createWorld(CONFIG), players: [owner] };
    const rec = recommendOpening('cafe', place.id, w, ctx).find((r) => r.kitId === 'standard')!;
    const act = (a: Parameters<typeof applyAction>[3]) => { const r = applyAction(w, ctx, 'pl1', a); if (r.error) throw new Error(r.error); w = r.world; };
    act({ type: 'open_business', niche: 'cafe', placeId: place.id, name: 'Plan Cafe', kitId: rec.kitId, size: rec.size, items: rec.items });
    act({ type: 'set_orders', orders: rec.orders });
    while (w.day < days) {
      w = tickDay(w, ctx);
      if (w.businesses[0].status === 'setup') { const r = applyAction(w, ctx, 'pl1', { type: 'launch' }); if (!r.error) w = r.world; }
    }
    return { w, plan: realWorldPlan(w.businesses[0], w, ctx) };
  }

  // a cheap former retail space (heavy build-out), a former cafe (light) and a cafe for sale (takeover)
  const empty = createWorld(CONFIG);
  const affordable = ctx.places.filter((p) => p.suitableFor.includes('cafe') && !p.forSale && (p.pedestriansPerDay ?? 0) > 0)
    .sort((a, b) => rentMonthOf(a) - rentMonthOf(b))
    .filter((p) => (recommendOpening('cafe', p.id, empty, ctx).find((r) => r.kitId === 'standard')?.cashLeft ?? -1) >= 0);
  const formerCafe = affordable.find((p) => p.formerUse === 'cafe')!;
  const forSale = ctx.places.filter((p) => p.forSale?.niche === 'cafe').sort((a, b) => rentMonthOf(a) - rentMonthOf(b))[0];

  const { w, plan } = season(formerCafe, 150);
  const b = w.businesses[0];
  const me = plan.extra.personal;

  it('prices the build-out and the deposit at this address, as the engine charged them', () => {
    const bo = buildoutOf(cafe, formerCafe)!;
    expect(me.place?.buildout?.cost).toBe(bo.cost);
    expect(plan.startupBudget.find((l) => l.label.startsWith(cafe.setup.find((d) => d.costBasis === 'per_sqft')!.name))?.amount).toBe(bo.cost);
    expect(me.place?.deposit).toBeCloseTo(3 * rentMonthOf(formerCafe), 2);
    expect(plan.startupTotal).toBeCloseTo(b.setupSpent, 2);
  });

  it('sums the money before the first sale from the kit and the rent paid while waiting', () => {
    const s = me.summary;
    expect(s.cashBeforeFirstSale).toBeCloseTo(s.parts.reduce((x, p) => x + p.amount, 0), 2);
    const rentBefore = s.parts.find((p) => p.id === 'rent_before_open')?.amount ?? 0;
    expect(s.cashBeforeFirstSale).toBeCloseTo(plan.startupTotal + rentBefore, 1);
    if (s.opened) expect(s.daysToOpen).toBe(b.openedDay! - b.createdDay);
    expect(rentBefore).toBeCloseTo((s.daysToOpen * rentMonthOf(formerCafe)) / 30, 0);
    expect(s.weeksToOpen).toBe(Math.max(1, Math.ceil(s.daysToOpen / 7)));
    expect(s.totalNeeded).toBeCloseTo(s.cashBeforeFirstSale + s.reserve, 2);
    expect(s.reserve).toBe(plan.reserveAdvised);
  });

  it('gives every roadmap step its status and the steps that carry this player\'s numbers a line of their own', () => {
    const road = roadmapFor('cafe', b, w, ctx);
    expect(Object.keys(me.steps).sort()).toEqual(road.map((s) => s.id).sort());
    for (const s of road) expect(me.steps[s.id].status).toBe(s.status);
    const lease = road.find((s) => s.kind === 'space' && !s.setupItemId)!;
    expect(me.steps[lease.id].mine).toContain(formerCafe.address);
    expect(me.steps[road.find((s) => s.kind === 'people')!.id].mine).toMatch(/\$[\d,]+ a month/);
    const fse = road.find((s) => s.setupItemId === 'fse_permit')!;
    expect(me.steps[fse.id].mine).toMatch(/day \d+/);
  });

  it('lists the team, the equipment with prices and the first order of this kit', () => {
    expect(me.staff.reduce((x, r) => x + r.count, 0)).toBe(Object.values(b.orders.staff).reduce((x, n) => x + n, 0));
    expect(me.payrollMonth).toBeCloseTo(me.staff.reduce((x, r) => x + r.monthly, 0), 2);
    expect(me.equipment.length).toBeGreaterThan(5);
    expect(me.equipmentTotal).toBeCloseTo(me.equipment.reduce((x, e) => x + e.total, 0), 2);
    expect(me.equipment.find((e) => e.id === 'chair')?.qty).toBe(b.size);
    expect(me.firstOrder?.amount).toBeGreaterThan(0);
  });

  it('names at most three risks of this place, the costliest first', () => {
    expect(me.risks.length).toBeGreaterThan(0);
    expect(me.risks.length).toBeLessThanOrEqual(3);
    const amounts = me.risks.map((r) => r.amount ?? -1);
    expect(amounts).toEqual([...amounts].sort((x, y) => y - x));
    for (const r of me.risks) { expect(r.why.length).toBeGreaterThan(10); expect(r.fix.length).toBeGreaterThan(10); }
  });

  it('does not tell the same story twice: a risk that a lesson of the season already tells is left out', () => {
    const ids = new Set(me.risks.map((r) => r.id));
    if (plan.lessons.some((l) => l.title.startsWith('Rent above'))) expect(ids.has('rent')).toBe(false);
    if (plan.lessons.some((l) => l.title.startsWith('Customers turned away'))) expect(ids.has('lost')).toBe(false);
  });

  it('puts the suppliers that serve a choice of this player first, with the reason', () => {
    expect([...me.supplierOrder].sort()).toEqual(cafe.suppliers.map((s) => s.id).sort());
    const firstWithout = me.supplierOrder.findIndex((id) => !me.supplierWhy[id]);
    if (firstWithout >= 0) expect(me.supplierOrder.slice(firstWithout).every((id) => !me.supplierWhy[id])).toBe(true);
    const sourcing = cafe.levers.find((l) => l.id === 'sourcing')!;
    const chosen = sourcing.options.find((o) => o.id === (b.orders.levers.sourcing ?? sourcing.options[0].id))!;
    expect(me.supplierWhy.coffee_beans).toContain(chosen.label);
  });

  it('for an operating business bought as it stands: the asking price, no build-out', () => {
    const t = season(forSale, 20).plan;
    expect(t.startupBudget[0].amount).toBe(forSale.forSale!.askingPrice);
    expect(t.extra.personal.place?.takeoverPrice).toBe(forSale.forSale!.askingPrice);
    expect(t.extra.personal.place?.buildout).toBeNull();
    expect(t.extra.personal.summary.parts.find((p) => p.id === 'takeover')?.amount).toBe(forSale.forSale!.askingPrice);
  });

  it('is plain data: it survives the trip to the client', () => {
    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
  });
});
