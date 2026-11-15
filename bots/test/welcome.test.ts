// A dealmaker greets a shop of its trade that has just opened nearby (bots/src/brain.ts, welcome).
import { describe, expect, it } from 'vitest';
import type { Action, WorldState } from '../../shared/src/types';
import { createBotBrain, WELCOME_M } from '../src/brain';
import { join } from '../src/__stubs__/host';
import { ctx, emptyWorld, stubApi } from './helpers';

describe('a new shop next door hears from its neighbour within two days', () => {
  it('a social resident offers a joint purchase to a fresh cafe nearby, not to an old one and not to a far one', () => {
    let w: WorldState = emptyWorld(5);
    const a = join(w, { name: 'Alice Test', kind: 'owner', isAi: false }); w = a.world;
    const b = join(w, { name: 'Bob Test', kind: 'owner', isAi: false }); w = b.world;
    const who = new Map([[a.playerId, 'social'], [b.playerId, 'honest']]);
    const brain = createBotBrain({ strategyOf: (p) => who.get(p.id) as never, nicheOf: () => 'cafe' });
    for (let d = 0; d < 35; d++) {
      for (const pid of [a.playerId, b.playerId]) for (const x of brain.ownerActions(w, ctx, pid)) { const r = stubApi.applyAction(w, ctx, pid, x); if (!r.error) w = r.world; }
      w = stubApi.tickDay(w, ctx);
    }
    const [ba, bb] = [w.businesses.find((x) => x.managerPlayerId === a.playerId)!, w.businesses.find((x) => x.managerPlayerId === b.playerId)!];
    expect(ba.status).toBe('open'); expect(bb.status).toBe('open');
    // put Bob's room about 110 m from Alice's, and drop any deal between them
    const home = ctx.places.find((p) => p.id === ba.placeId)!;
    const near = { ...ctx, places: ctx.places.map((p) => (p.id === bb.placeId ? { ...p, lat: home.lat + 0.001, lng: home.lng } : p)) };
    const far = { ...ctx, places: ctx.places.map((p) => (p.id === bb.placeId ? { ...p, lat: home.lat + 0.02, lng: home.lng } : p)) };
    w = { ...w, deals: [] };
    const toBob = (acts: Action[]) => acts.filter((x) => x.type === 'propose_deal' && x.toBusinessId === bb.id);
    // a day when the weekly round of offers does not reach Bob anyway
    let day = w.day;
    for (let k = 0; k < 7 && toBob(brain.ownerActions({ ...w, day }, near, a.playerId)).length; k++) day++;
    w = { ...w, day };
    expect(toBob(brain.ownerActions(w, near, a.playerId))).toHaveLength(0);
    const opened = (ago: number): WorldState => ({ ...w, feed: [...w.feed, { id: 'f-new', day: w.day - ago, kind: 'opening', text: `${bb.name} opened its doors`, businessId: bb.id }] });
    const offers = toBob(brain.ownerActions(opened(1), near, a.playerId));
    expect(offers).toHaveLength(1);
    expect(offers[0].type === 'propose_deal' && offers[0].terms.type).toBe('joint_purchase');
    expect(stubApi.applyAction(opened(1), near, a.playerId, offers[0]).error).toBeUndefined();
    expect(toBob(brain.ownerActions(opened(5), near, a.playerId))).toHaveLength(0);   // old news
    expect(toBob(brain.ownerActions(opened(1), far, a.playerId))).toHaveLength(0);    // ~2.2 km away
    expect(WELCOME_M).toBeLessThan(2000);
  });
});
