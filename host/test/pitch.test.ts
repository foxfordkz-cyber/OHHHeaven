// Город показа: части сборки на настоящих пакетах (полная сборка — server/test/pitch.test.ts).
import cafe from '../../packs/cafe.json';
import common from '../../packs/_common.json';
import places from '../../data/places.json';
import { describe, expect, it } from 'vitest';
import type { CommonPack, Pack, Place, WorldState } from '@ohh/shared';
import { defaultConfig, defaultDeps, newWorld, type EngineCtx } from '../src/index';
import { PITCH_CAST, SEATS_STEP, branchActions, choosePitchPlaces, isPitchWorld, pitchDeps, pitchShortcut } from '../src/pitch';
import { distanceM } from '@ohh/shared';

const ctx: EngineCtx = {
  packs: { common: common as unknown as CommonPack, niches: { cafe: cafe as unknown as Pack } },
  places: places as unknown as Place[],
};
const pitchCity = (): WorldState =>
  newWorld({ ...defaultConfig({ id: 'pitch', name: 'Pitch City', demo: true, seed: 2611 }), aiBusinessesTarget: PITCH_CAST.ai.length }, ctx, pitchDeps(defaultDeps()));

describe('pitch city parts', () => {
  it("Viktor's shortcut is the one a tax auditor's report finds: hidden payroll", () => {
    const s = pitchShortcut(ctx)!;
    expect(s.id).toBe('cash_wages');
    expect(s.role).toBe('tax_auditor');
    const report = [...ctx.packs.common.reports, ...(cafe as unknown as Pack).reports].find((r) => r.id === s.reportId)!;
    expect(report.checks).toContain(s.violationId);
  });

  it('eight AI cafes with the LIVE-SHOW names and two AI officials, no complainers', () => {
    const w = pitchCity();
    expect(isPitchWorld(w)).toBe(true);
    const owners = w.players.filter((p) => p.kind === 'owner');
    expect(owners.map((p) => p.name)).toEqual(PITCH_CAST.ai.map((a) => a.name));
    expect(owners.every((p) => p.isAi)).toBe(true);
    expect(w.businesses.map((b) => b.name)).toEqual(PITCH_CAST.ai.map((a) => `${a.name}'s Coffee`));
    expect(w.officials.map((o) => `${o.name}:${o.role}`)).toEqual(['Sam:tax_auditor', 'Dana:inspector']);
    const strategies = w.players.map((p) => (p as { strategy?: string }).strategy);
    expect(strategies).not.toContain('complainer');
    expect(strategies.some((s) => s?.startsWith('cut_'))).toBe(false);
  });

  it('two free neighboring doors; Maya has room for more seats', () => {
    const w = pitchCity();
    const pair = choosePitchPlaces(w, ctx)!;
    expect(pair).not.toBeNull();
    expect(distanceM(pair.maya, pair.viktor)).toBeLessThan(250);
    const taken = new Set(w.businesses.map((b) => b.placeId));
    expect(taken.has(pair.maya.id) || taken.has(pair.viktor.id)).toBe(false);
    expect(pair.maya.forSale).toBeFalsy();
  });

  it('"Add seats" past 20 seats buys the customer restroom first; "Raise the price" stays in the pack range', () => {
    const w = pitchCity();
    const b = w.businesses[0]!;
    const big = ctx.places.filter((p) => p.sqft * 0.6 / 18 >= 26).sort((a, c) => a.id.localeCompare(c.id))[0]!;
    const at18: WorldState = { ...w, businesses: w.businesses.map((x) => (x.id === b.id ? { ...x, size: 18, placeId: big.id, items: x.items.filter((i) => i.id !== 'customer_restroom') } : x)) };
    const seats = branchActions(at18, ctx, b.managerPlayerId, 'seats')!;
    expect(seats).toEqual([{ type: 'buy_item', itemId: 'customer_restroom', qty: 1 }, { type: 'resize', size: 18 + SEATS_STEP }]);
    const at12: WorldState = { ...at18, businesses: at18.businesses.map((x) => (x.id === b.id ? { ...x, size: 12 } : x)) };
    expect(branchActions(at12, ctx, b.managerPlayerId, 'seats')).toEqual([{ type: 'resize', size: 12 + SEATS_STEP }]);
    const price = branchActions(at18, ctx, b.managerPlayerId, 'price')![0] as { type: 'set_orders'; orders: { price: number } };
    expect(price.orders.price).toBeGreaterThan(b.orders.price);
    expect(price.orders.price).toBeLessThanOrEqual((cafe as unknown as Pack).unit.priceMax);
  });
});
