import { describe, expect, it } from 'vitest';
import type { Action, ClientView, GameEvent, OwnerView, OfficialView, WorldState } from '../../shared/src/types';
import { RULES, dateOf } from '../../shared/src/rules';
import { act, answer, defaultDeps, HostError, join, markSeen, step, viewFor, usingStubs } from '../src/index';
import { ctx, freePlace, makeWorld, pathsOf, run } from './helpers';

function ok(r: { world: WorldState; error?: string }): WorldState {
  if (r.error) throw new Error(r.error);
  return r.world;
}

function openCafe(w: WorldState, playerId: string, name: string, launchNow = true): WorldState {
  const placeId = freePlace(w);
  const rec = (answer(w, ctx, playerId, { type: 'recommend_opening', niche: 'cafe', placeId }) as { kitId: 'lean' | 'standard' | 'premium'; size: number; items: { id: string; qty: number }[]; orders: object }[])[0];
  let x = ok(act(w, ctx, playerId, { type: 'open_business', niche: 'cafe', placeId, name, kitId: rec.kitId, size: rec.size, items: rec.items }));
  x = ok(act(x, ctx, playerId, { type: 'set_orders', orders: rec.orders }));
  if (launchNow) x = ok(act(x, ctx, playerId, { type: 'launch' }));
  return x;
}

describe('newWorld and step', () => {
  it('a world of 30 residents runs 60 days on stubs', () => {
    expect(usingStubs.engine).toBe(true);
    let w = makeWorld();
    const ai = w.players.filter((p) => p.isAi);
    expect(ai.length).toBe(30);
    expect(w.officials.length).toBe(3);
    expect(w.businesses.length).toBe(27);
    expect(w.businesses.every((b) => b.status === 'open' && b.isAi)).toBe(true);
    expect(w.weather.length).toBe(RULES.FORECAST_DAYS + 1);
    const v0 = w.version;
    w = run(w, 60);
    expect(w.day).toBe(61);
    expect(w.version).toBeGreaterThan(v0 + 60);
    expect(w.weather[0].day).toBe(61);
    expect(w.weather.length).toBe(RULES.FORECAST_DAYS + 1);
    const alive = w.businesses.filter((b) => b.status !== 'bankrupt');
    expect(alive.length).toBeGreaterThan(20);
    for (const b of alive) expect(b.history.length).toBe(2);
    expect(w.standings.length).toBe(27);
    expect(w.events.length + w.feed.filter((f) => f.kind === 'event').length).toBeGreaterThan(0);
  });

  it('is deterministic for the same seed', () => {
    const a = run(makeWorld({ seed: 5 }), 20);
    const b = run(makeWorld({ seed: 5 }), 20);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('does not mutate its input', () => {
    const w = makeWorld();
    const copy = JSON.stringify(w);
    step(w, ctx, defaultDeps());
    viewFor(w, ctx, null);
    expect(JSON.stringify(w)).toBe(copy);
  });

  it('adds one event a week, prefers the AI queue, and announces it in advance', () => {
    const queued: GameEvent = { id: 'ai_test', kind: 'city', title: 'Test fair', text: 'x', announcedDay: 0, startDay: 1, endDay: 2, effects: [{ target: 'footTraffic', mult: 3 }], origin: 'ai' };
    let taken = 0;
    const deps = defaultDeps({ takeQueuedEvent: () => (taken++ === 0 ? queued : null) });
    let w = makeWorld({ deps });
    w = run(w, 7, deps);
    const e = w.events.find((x) => x.id === 'ai_test')!;
    expect(e).toBeTruthy();
    expect(e.startDay).toBeGreaterThanOrEqual(e.announcedDay + RULES.EVENT_NOTICE_DAYS);
    expect(e.effects[0].mult).toBe(1.3);
    expect(w.players.filter((p) => !p.isAi).length).toBe(0);
  });
});

describe('join', () => {
  it('owner pays the test fee into the bank, official plays free', () => {
    const w = makeWorld();
    const a = join(w, { name: 'Alice', kind: 'owner' });
    expect(a.error).toBeUndefined();
    expect(a.world.bank).toBe(w.bank + 5);
    expect(a.world.version).toBeGreaterThan(w.version);
    const o = join(a.world, { name: 'Olga', kind: 'official', role: 'inspector' });
    expect(o.world.bank).toBe(a.world.bank);
    expect(o.world.officials.some((x) => x.playerId === o.playerId && x.role === 'inspector' && !x.isAi)).toBe(true);
  });

  it('rejects bad input and closes after month JOIN_UNTIL_MONTH', () => {
    const w = makeWorld();
    expect(join(w, { name: '  ', kind: 'owner' }).error).toBeTruthy();
    expect(join(w, { name: 'X', kind: 'official' }).error).toBeTruthy();
    const late = { ...w, day: RULES.JOIN_UNTIL_MONTH * RULES.DAYS_PER_MONTH + 1 };
    expect(dateOf(late.day).month).toBe(RULES.JOIN_UNTIL_MONTH + 1);
    expect(join(late, { name: 'Late', kind: 'owner' }).error).toMatch(/closes/);
  });
});

describe('act', () => {
  it('checks shape, role and ownership, then updates lastSeenDay and version', () => {
    let w = makeWorld();
    const a = join(w, { name: 'Alice', kind: 'owner' }); w = a.world;
    const o = join(w, { name: 'Olga', kind: 'official', role: 'inspector' }); w = o.world;
    expect(act(w, ctx, 'nobody', { type: 'launch' }).error).toBe('Unknown player');
    expect(act(w, ctx, a.playerId, { type: 'bogus' } as unknown as Action).error).toMatch(/Unknown action/);
    expect(act(w, ctx, a.playerId, { type: 'take_case', caseId: 'c1' }).error).toMatch(/officials/i);
    expect(act(w, ctx, o.playerId, { type: 'launch' }).error).toMatch(/Officials/);
    expect(act(w, ctx, a.playerId, { type: 'launch' }).error).toMatch(/Open a business/);
    w = run(w, 3);
    const before = w.version;
    w = openCafe(w, a.playerId, 'Alice Coffee');
    const me = w.players.find((p) => p.id === a.playerId)!;
    expect(me.lastSeenDay).toBe(w.day);
    expect(w.version).toBeGreaterThan(before);
    const someoneElse = w.businesses.find((b) => b.managerPlayerId !== a.playerId)!;
    const deal = act(w, ctx, someoneElse.managerPlayerId, { type: 'propose_deal', toBusinessId: w.businesses.find((b) => b.managerPlayerId === a.playerId)!.id, terms: { type: 'joint_purchase', months: 1 } });
    expect(deal.error).toBeUndefined();
    const d = deal.world.deals[deal.world.deals.length - 1];
    const thirdParty = w.businesses.find((b) => b.managerPlayerId !== a.playerId && b.id !== someoneElse.id)!;
    expect(act(deal.world, ctx, thirdParty.managerPlayerId, { type: 'answer_deal', dealId: d.id, accept: true }).error).toMatch(/not addressed/);
    expect(act(deal.world, ctx, a.playerId, { type: 'answer_deal', dealId: d.id, accept: true }).error).toBeUndefined();
  });
});

describe('viewFor', () => {
  it('an owner never receives another business cash in any view', () => {
    let w = makeWorld();
    const a = join(w, { name: 'Alice', kind: 'owner' }); w = a.world;
    const b = join(w, { name: 'Bob', kind: 'owner' }); w = b.world;
    const o = join(w, { name: 'Olga', kind: 'official', role: 'inspector' }); w = o.world;
    w = openCafe(w, a.playerId, 'Alice Coffee');
    w = openCafe(w, b.playerId, 'Bob Beans', true);
    const bobBiz = w.businesses.find((x) => x.managerPlayerId === b.playerId)!;
    const rep = ctx.packs.niches.cafe!.reports.find((r) => r.id === 'report_no_permit')!;
    w = ok(act(w, ctx, a.playerId, { type: 'report', targetBusinessId: bobBiz.id, reportId: rep.id }));
    const views: [string, ClientView][] = [];
    for (let day = 0; day < 40; day++) {
      w = step(w, ctx, defaultDeps());
      if (day % 5 === 0) {
        views.push(['alice', viewFor(w, ctx, a.playerId)], ['bob', viewFor(w, ctx, b.playerId)], ['olga', viewFor(w, ctx, o.playerId)], ['city', viewFor(w, ctx, null)]);
      }
    }
    for (const [who, v] of views) {
      const cash = pathsOf(v, 'cash');
      if (v.kind === 'owner') {
        expect(cash.every((p) => p === 'business.cash'), `${who}: ${cash.join(', ')}`).toBe(true);
        expect((v as OwnerView).neighbors.every((n) => !('cash' in n))).toBe(true);
      } else {
        expect(cash, who).toEqual([]);
      }
      expect(pathsOf(v, 'strategy')).toEqual([]);
      expect(pathsOf(v, 'seenCash')).toEqual([]);
      expect(pathsOf(v, 'trails').every((p) => p === 'business.trails'), who).toBe(true);
    }
    const olga = viewFor(w, ctx, o.playerId) as OfficialView;
    expect(olga.kind).toBe('official');
    expect(olga.ranking.length).toBe(4);
    const alice = viewFor(w, ctx, a.playerId) as OwnerView;
    expect(alice.business?.name).toBe('Alice Coffee');
    expect(alice.analytics).not.toBeNull();
    expect(alice.leaderboards.cafe?.length).toBeGreaterThan(0);
    const bobViews = views.filter(([who]) => who === 'bob').map(([, v]) => v as OwnerView);
    expect(bobViews.some((v) => v.notices.length > 0)).toBe(true);
    const bobNow = w.businesses.find((x) => x.managerPlayerId === b.playerId)!;
    expect(bobNow.history[0].fines).toBeGreaterThan(0);
  });

  it('city view has no private data', () => {
    const w = run(makeWorld(), 5);
    const v = viewFor(w, ctx, null);
    expect(v.kind).toBe('city');
    expect(pathsOf(v, 'cash')).toEqual([]);
    expect(pathsOf(v, 'inbox')).toEqual([]);
    if (v.kind === 'city') expect(v.businesses.length).toBe(w.businesses.length);
  });

  it('away counts days, money earned and what waits for an answer', () => {
    let w = makeWorld();
    const a = join(w, { name: 'Alice', kind: 'owner' }); w = a.world;
    w = openCafe(w, a.playerId, 'Alice Coffee');
    const cashAtLastAct = w.businesses.find((x) => x.managerPlayerId === a.playerId)!.cash;
    const lastSeen = w.day;
    expect((viewFor(w, ctx, a.playerId) as OwnerView).away).toBeNull();
    w = run(w, 1);
    expect((viewFor(w, ctx, a.playerId) as OwnerView).away).toBeNull();
    const neighbor = w.businesses.find((x) => x.managerPlayerId !== a.playerId && x.niche === 'cafe' && x.status === 'open')!;
    const mine = w.businesses.find((x) => x.managerPlayerId === a.playerId)!;
    w = ok(act(w, ctx, neighbor.managerPlayerId, { type: 'propose_deal', toBusinessId: mine.id, terms: { type: 'joint_purchase', months: 1 } }));
    w = run(w, 1);
    const v = viewFor(w, ctx, a.playerId) as OwnerView;
    const now = w.businesses.find((x) => x.managerPlayerId === a.playerId)!;
    expect(v.away).not.toBeNull();
    expect(v.away!.days).toBe(w.day - lastSeen);
    expect(v.away!.profit).toBeCloseTo(now.cash - cashAtLastAct, 2);
    expect(v.away!.items.some((i) => i.kind === 'deal')).toBe(true);
    w = run(w, 38);
    const long = viewFor(w, ctx, a.playerId) as OwnerView;
    expect(long.away!.days).toBe(40);
    expect(long.away!.items.some((i) => i.kind === 'summary')).toBe(true);
    const seen = markSeen(w, a.playerId);
    expect(seen.version).toBe(w.version);
    expect((viewFor(seen, ctx, a.playerId) as OwnerView).away).toBeNull();
  });
});

describe('answer and managers', () => {
  it('answers synchronous queries and rejects AI ones', () => {
    let w = makeWorld();
    const a = join(w, { name: 'Alice', kind: 'owner' }); w = a.world;
    expect(() => answer(w, ctx, a.playerId, { type: 'what_if', orders: { price: 8 } })).toThrow(HostError);
    const recs = answer(w, ctx, a.playerId, { type: 'recommend_opening', niche: 'cafe', placeId: freePlace(w) }) as unknown[];
    expect(recs.length).toBeGreaterThan(0);
    expect((answer(w, ctx, a.playerId, { type: 'roadmap', niche: 'cafe' }) as unknown[]).length).toBeGreaterThan(0);
    w = openCafe(w, a.playerId, 'Alice Coffee');
    w = run(w, 3);
    const wi = answer(w, ctx, a.playerId, { type: 'what_if', orders: { price: 9 } }) as { projected: { revenue: number } };
    expect(wi.projected).toBeTruthy();
    expect(answer(w, ctx, a.playerId, { type: 'real_world_plan' })).toHaveProperty('startupTotal');
    expect(() => answer(w, ctx, a.playerId, { type: 'advisor', question: 'hi' })).toThrow(/AI service/);
    expect(() => answer(w, ctx, a.playerId, { type: 'recommend_opening', niche: 'cafe', placeId: 'nowhere' })).toThrow(/place/);
  });

  it('a hired manager drops shortcuts on review', () => {
    let w = makeWorld();
    const a = join(w, { name: 'Alice', kind: 'owner' }); w = a.world;
    w = openCafe(w, a.playerId, 'Alice Coffee');
    w = ok(act(w, ctx, a.playerId, { type: 'set_orders', orders: { shortcuts: ['cash_wages'], autopilot: 'manager' } }));
    expect(w.businesses.find((x) => x.managerPlayerId === a.playerId)!.orders.shortcuts).toEqual(['cash_wages']);
    w = run(w, RULES.MANAGER_REVIEW_DAYS);
    const b = w.businesses.find((x) => x.managerPlayerId === a.playerId)!;
    expect(b.orders.shortcuts).toEqual([]);
    expect(w.players.find((p) => p.id === a.playerId)!.inbox.some((i) => /manager/i.test(i.title))).toBe(true);
  });
});
