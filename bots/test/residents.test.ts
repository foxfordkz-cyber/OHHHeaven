import { describe, expect, it } from 'vitest';
import type { Action, WorldState } from '../../shared/src/types';
import { RULES } from '../../shared/src/rules';
import { brainFor } from '../../sim/run';
import { createBotBrain, playableNiches, nicheFromName, choosePlace } from '../src/brain';
import { officialSight, ownerSight, publicBusinesses } from '../src/observe';
import { OWNER_STRATEGIES, PROFILES, ownerStrategyFromName, officialStrategyFromName } from '../src/strategies';
import { hashStr, mulberry32, rngFor, seedFor, shuffle } from '../src/rng';
import { businessName, streetToken } from '../src/names';
import { join } from '../src/__stubs__/host';
import { ctx, emptyWorld, runSeason, setup, stubApi, NICHES } from './helpers';

const sig = (w: WorldState) => JSON.stringify({ day: w.day, b: w.businesses.map((b) => [b.id, b.status, Math.round(b.cash * 100)]), d: w.deals.length, c: w.cases.length, s: w.standings });

describe('determinism', () => {
  it('same seed gives the same season, a different seed a different one', () => {
    const a = runSeason(stubApi, setup(7));
    const b = runSeason(stubApi, setup(7));
    const c = runSeason(stubApi, setup(8));
    expect(sig(a.world)).toBe(sig(b.world));
    expect(sig(a.world)).not.toBe(sig(c.world));
  });
});

describe('residents never send invalid actions (500 random states)', () => {
  it('owners and officials: every action applies without error', () => {
    let states = 0, checked = 0;
    const errors: string[] = [];
    for (let seed = 1; seed <= 25; seed++) {
      const rng = mulberry32(seed * 977);
      const days = new Set(Array.from({ length: 20 }, () => 1 + Math.floor(rng() * 359)));
      while (days.size < 20) days.add(1 + Math.floor(rng() * 359));
      const s = setup(seed, { brain: { harassLeader: rng() < 0.3, officialCasesPerDay: 1 + Math.floor(rng() * 4) } });
      const brain = brainFor(stubApi, s);
      const ownerIds = s.owners.map((_, i) => `p${i + 1}`), officialIds = s.officials.map((_, i) => `p${s.owners.length + i + 1}`);
      s.onDay = (w, day) => {
        // chaos: random legal moves by random owners make unusual states (many deals, cases, odd prices)
        let x = w;
        for (let k = 0; k < 4; k++) {
          const pid = ownerIds[Math.floor(rng() * ownerIds.length)];
          const others = x.businesses.filter((b) => b.status === 'open');
          const t = others[Math.floor(rng() * Math.max(1, others.length))];
          const pack = ctx.packs.niches[t?.niche ?? 'cafe']!;
          const a: Action = rng() < 0.4 ? { type: 'set_orders', orders: { price: pack.unit.priceMin + rng() * (pack.unit.priceMax - pack.unit.priceMin) } }
            : rng() < 0.6 && t ? { type: 'propose_deal', toBusinessId: t.id, terms: rng() < 0.5 ? { type: 'cross_promo', months: 2 } : { type: 'joint_purchase', months: 2 } }
            : t ? { type: 'report', targetBusinessId: t.id, reportId: rng() < 0.5 ? 'report_taxes' : pack.reports[0].id } : { type: 'read_inbox', ids: [] };
          const r = stubApi.applyAction(x, ctx, pid, a);
          if (!r.error) x = r.world;
        }
        if (!days.has(day)) return x;
        states++;
        for (const pid of ownerIds) {
          let y = x;
          for (const a of brain.ownerActions(x, ctx, pid)) { checked++; const r = stubApi.applyAction(y, ctx, pid, a); if (r.error) errors.push(`${s.owners[Number(pid.slice(1)) - 1].strategy} ${a.type}: ${r.error}`); else y = r.world; }
        }
        for (const pid of officialIds) {
          let y = x;
          for (const a of brain.officialActions(x, ctx, pid)) { checked++; const r = stubApi.applyAction(y, ctx, pid, a); if (r.error) errors.push(`official ${a.type}: ${r.error}`); else y = r.world; }
        }
        return x;
      };
      runSeason(stubApi, s);
    }
    expect(states).toBe(500);
    expect(checked).toBeGreaterThan(1000);
    if (errors.length) console.log([...new Set(errors)].join('\n'));
    expect(errors).toEqual([]);
  });

  it('a whole season of residents produces no invalid action', () => {
    for (const seed of [11, 12, 13]) expect(runSeason(stubApi, { ...setup(seed), recordErrors: true }).errors).toEqual([]);
  });
});

describe('honest owners survive the first three months', () => {
  it('no honest owner is bankrupt by day 90 (20 seasons)', () => {
    let honest = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = runSeason(stubApi, { ...setup(seed, {}, ['honest', 'honest', 'premium', 'cut_all', 'dumper']), days: 91 });
      for (const o of r.owners.filter((x) => x.strategy === 'honest')) { honest++; expect(o.bankruptByMonth3).toBe(false); expect(o.cashAtMonth3 ?? 0).toBeGreaterThan(0); }
    }
    expect(honest).toBeGreaterThan(300);
  });
});

describe('populate', () => {
  it('about thirty AI businesses on distinct places and three officials, names map to characters', () => {
    const brain = createBotBrain();
    const w = emptyWorld(3);
    const list = brain.populate(w, ctx, 42);
    const owners = list.filter((e) => e.kind === 'owner');
    const officials = list.filter((e) => e.kind === 'official');
    expect(owners).toHaveLength(30);
    expect(new Set(owners.map((o) => o.placeId)).size).toBe(30);
    expect(new Set(list.map((o) => o.name)).size).toBe(list.length);
    expect(new Set(owners.map((o) => o.strategy))).toEqual(new Set(OWNER_STRATEGIES));
    expect(officials.map((o) => o.role).sort()).toEqual(['inspector', 'inspector', 'tax_auditor']);
    for (const o of owners) { expect(ownerStrategyFromName(o.name)).toBe(o.strategy); expect(nicheFromName(o.name, playableNiches(ctx))).toBe(o.niche); }
    for (const o of officials) expect(officialStrategyFromName(o.name)).toBe(o.strategy);
    expect(brain.populate(w, ctx, 42)).toEqual(list);
  });

  it('host joins the list and residents open on the places populate promised, marked isAi', () => {
    const brain = createBotBrain();
    let w = emptyWorld(4);
    const list = brain.populate(w, ctx, 9);
    const ids: string[] = [];
    for (const e of list) { const r = join(w, { name: e.name, kind: e.kind, role: e.role, isAi: true }); w = r.world; ids.push(r.playerId); }
    list.forEach((e, k) => { if (e.kind !== 'owner') return; for (const a of brain.ownerActions(w, ctx, ids[k])) { const r = stubApi.applyAction(w, ctx, ids[k], a); expect(r.error).toBeUndefined(); w = r.world; } });
    const ai = w.businesses.filter((b) => b.isAi);
    expect(ai).toHaveLength(30);
    list.forEach((e, k) => { if (e.kind === 'owner') expect(w.businesses.find((b) => b.managerPlayerId === ids[k])?.placeId).toBe(e.placeId); });
    expect(w.players.filter((p) => p.isAi)).toHaveLength(33);
  });
});

function worldWithTwo(strategyA: string, strategyB: string) {
  let w = emptyWorld(5);
  const a = join(w, { name: 'Alice Test', kind: 'owner', isAi: false }); w = a.world;
  const b = join(w, { name: 'Bob Test', kind: 'owner', isAi: false }); w = b.world;
  const map = new Map([[a.playerId, strategyA], [b.playerId, strategyB]]);
  const brain = createBotBrain({ strategyOf: (p) => map.get(p.id) as never, nicheOf: (p) => (p.id === a.playerId ? 'cafe' : 'barbershop') });
  const act = (pid: string) => { for (const x of brain.ownerActions(w, ctx, pid)) { const r = stubApi.applyAction(w, ctx, pid, x); expect(r.error).toBeUndefined(); w = r.world; } };
  return { get w() { return w; }, set w(x) { w = x; }, a: a.playerId, b: b.playerId, act, brain };
}

describe('answers to deals and notices', () => {
  it('a resident answers a deal offer the same day it sees it, by the partner’s trust', () => {
    const t = worldWithTwo('honest', 'honest');
    for (let d = 0; d < 35; d++) { t.act(t.a); t.act(t.b); t.w = stubApi.tickDay(t.w, ctx); }
    const [ba, bb] = [t.w.businesses[0], t.w.businesses[1]];
    expect(ba.status).toBe('open'); expect(bb.status).toBe('open');
    const offer = (id: string, terms: { type: 'cross_promo'; months: number }) => ({ id, fromBusinessId: ba.id, toBusinessId: bb.id, terms, status: 'proposed' as const, proposedDay: t.w.day, expiresDay: t.w.day + RULES.DEAL_OFFER_DAYS });
    t.w = { ...t.w, deals: [...t.w.deals, offer('d900', { type: 'cross_promo', months: 2 })] };
    t.act(t.b);
    expect(t.w.deals.find((d) => d.id === 'd900')!.status).toBe('active');
    // a partner with a record of broken deals is refused the same day
    t.w = { ...t.w, businesses: t.w.businesses.map((b) => (b.id === ba.id ? { ...b, trust: { kept: 0, broken: 3 } } : b)), deals: [...t.w.deals, offer('d901', { type: 'cross_promo', months: 2 })] };
    t.act(t.b);
    expect(t.w.deals.find((d) => d.id === 'd901')!.status).toBe('declined');
  });

  it('notice answers follow the character: honest pays, bribe-giver offers cash, contester contests big fines', () => {
    for (const [strategy, expected] of [['honest', 'pay'], ['cut_bribe', 'bribe'], ['cut_taxes', 'contest']] as const) {
      const t = worldWithTwo(strategy, 'honest');
      t.act(t.a);
      const biz = t.w.businesses[0];
      t.w = { ...t.w, businesses: t.w.businesses.map((b) => (b.id === biz.id ? { ...b, status: 'open' as const } : b)), cases: [{ id: 'c1', businessId: biz.id, role: 'tax_auditor', origin: 'flag', openedDay: t.w.day, hints: [], status: 'notice', found: [{ violationId: 'off_books_payroll', months: 6, fine: 9000, closureDays: 0 }], fine: 9000, closureDays: 0, answerByDay: t.w.day + 2 }] };
      const acts = t.brain.ownerActions(t.w, ctx, t.a);
      const ans = acts.find((x) => x.type === 'answer_notice');
      expect(ans && ans.type === 'answer_notice' ? ans.response : null).toBe(expected);
      const r = stubApi.applyAction(t.w, ctx, t.a, ans!);
      expect(r.error).toBeUndefined();
    }
  });
});

describe('officials', () => {
  it('take cases by priority, the bribe-taker accepts at or above the threshold, honest ones refuse', () => {
    let w = emptyWorld(6);
    const o1 = join(w, { name: 'Ivy Honest', kind: 'official', role: 'inspector', isAi: true }); w = o1.world;
    const o2 = join(w, { name: 'Rex Bent', kind: 'official', role: 'inspector', isAi: true }); w = o2.world;
    const map = new Map([[o1.playerId, 'complaint_chaser'], [o2.playerId, 'bribe_taker']]);
    const brain = createBotBrain({ strategyOf: (p) => map.get(p.id) as never });
    const own = join(w, { name: 'Cara Shop', kind: 'owner' }); w = own.world;
    const rec = stubApi.recommendOpening('cafe', ctx.places[0].id, w, ctx)[0];
    w = stubApi.applyAction(w, ctx, own.playerId, { type: 'open_business', niche: 'cafe', placeId: ctx.places[0].id, name: 'Cara', kitId: rec.kitId, size: rec.size }).world;
    const bid = w.businesses[0].id;
    w = { ...w, cases: [
      { id: 'c1', businessId: bid, role: 'inspector', origin: 'routine', openedDay: 1, hints: [], status: 'open' },
      { id: 'c2', businessId: bid, role: 'inspector', origin: 'report', openedDay: 1, hints: [], status: 'open' },
    ] };
    const take = brain.officialActions(w, ctx, o1.playerId);
    expect(take[0]).toEqual({ type: 'take_case', caseId: 'c2' });
    const bribe = (amount: number, off: string): WorldState => ({ ...w, cases: [{ id: 'c3', businessId: bid, role: 'inspector', origin: 'report', openedDay: 1, hints: [], status: 'bribe_offered', officialId: w.officials.find((o) => o.playerId === off)!.id, bribeAmount: amount, fine: 2000, found: [{ violationId: 'pests', months: 2, fine: 2000, closureDays: 3 }] }] });
    expect(brain.officialActions(bribe(1200, o2.playerId), ctx, o2.playerId)).toContainEqual({ type: 'answer_bribe', caseId: 'c3', accept: true });
    expect(brain.officialActions(bribe(800, o2.playerId), ctx, o2.playerId)).toContainEqual({ type: 'answer_bribe', caseId: 'c3', accept: false });
    expect(brain.officialActions(bribe(5000, o1.playerId), ctx, o1.playerId)).toContainEqual({ type: 'answer_bribe', caseId: 'c3', accept: false });
  });
});

describe('sight: residents see only what a human would', () => {
  it('neighbours are public cards without cash, books or violations', () => {
    const r = runSeason(stubApi, { ...setup(2), days: 60 });
    const w = r.world;
    const s = ownerSight(w, 'p1')!;
    const keys = new Set(s.neighbors().flatMap((n) => Object.keys(n)));
    for (const k of ['cash', 'trails', 'history', 'mtd', 'liabilities', 'orders', 'days']) expect(keys.has(k)).toBe(false);
    expect(s.business?.managerPlayerId).toBe('p1');
    expect(publicBusinesses(w)).toHaveLength(w.businesses.length);
    const o = officialSight(w, `p${41}`)!;
    for (const c of [...o.queue, ...o.mine]) expect(Object.keys(c.business)).not.toContain('cash');
    expect(ownerSight(w, 'nobody')).toBeNull();
    expect(officialSight(w, 'p1')).toBeNull();
  });
});

describe('helpers', () => {
  it('rng is seeded and stable', () => {
    const a = mulberry32(1), b = mulberry32(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(hashStr('cafe')).toBe(hashStr('cafe'));
    expect(seedFor('x', 1)).toBe(hashStr('x|1'));
    expect(rngFor('a')()).toBe(rngFor('a')());
    expect(shuffle(mulberry32(3), [1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
  it('names: street token and business names are readable', () => {
    expect(streetToken('St Marks Pl, 2nd–3rd Ave')).toBe('St Marks');
    expect(businessName('cafe', 'Maria Alvarez', 'E 7th St, 1st Ave–Ave A', 0)).toBe('Alvarez Coffee');
    expect(businessName('barbershop', 'Omar Haddad', 'E 7th St, 1st Ave–Ave A', 1)).toBe('E 7th Barbers');
  });
  it('choosePlace respects the character tier and skips occupied places', () => {
    const prime = choosePlace(ctx, 'Zoe Park', 'cafe', PROFILES.premium, new Set());
    expect(prime?.tier).toBe('prime');
    const cheap = choosePlace(ctx, 'Zoe Park', 'cafe', PROFILES.dumper, new Set());
    expect(cheap?.tier).toBe('cheap');
    expect(choosePlace(ctx, 'Zoe Park', 'cafe', PROFILES.honest, new Set(ctx.places.map((p) => p.id)))).toBeUndefined();
    expect(playableNiches(ctx)).toEqual(NICHES.slice().sort());
  });
  it('a closed or bankrupt season produces no actions', () => {
    const brain = createBotBrain();
    const w = { ...emptyWorld(1), phase: 'ended' as const };
    expect(brain.ownerActions(w, ctx, 'p1')).toEqual([]);
    expect(brain.officialActions(w, ctx, 'p1')).toEqual([]);
    expect(brain.ownerActions({} as never, ctx, 'p1')).toEqual([]);
    expect(RULES.DEAL_OFFER_DAYS).toBeGreaterThan(0);
  });
});
