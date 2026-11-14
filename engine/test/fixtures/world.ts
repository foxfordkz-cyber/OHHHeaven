// Helpers to build worlds for tests and the demo: places on one block, players, opening businesses.
import type { Action, Pack, PackSet, Place, Player, WorldConfig, WorldState } from '@ohh/shared';
import { applyAction, createWorld, tickDay, type EngineCtx } from '../../src/index';
import { packs as fixturePacks } from './common';

export function place(i: number, over: Partial<Place> = {}): Place {
  return {
    id: `p${i}`, address: `${100 + i * 2} Main St, Queens`, block: 'main-st-100', lat: 40.76 + i * 0.0001, lng: -73.92,
    kind: 'storefront', sqft: 800, tier: 'mid', rentPerSqftYear: 90, footTraffic: 0.5, suitableFor: [],
    note: 'test place; rent $90/sq ft/yr is an estimate for a mid-tier Queens storefront', ...over,
  };
}

export function places(n: number, over: Partial<Place> = {}): Place[] {
  return Array.from({ length: n }, (_, i) => place(i + 1, over));
}

export function config(over: Partial<WorldConfig> = {}): WorldConfig {
  return {
    id: 'test', name: 'Test city', city: 'nyc', seasonMonths: 12, dayMs: 2000, paused: false, maxOwners: 100,
    aiBusinessesTarget: 0, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05,
    nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 11, ...over,
  };
}

export function owner(i: number): Player {
  return { id: `pl${i}`, name: `Owner ${i}`, kind: 'owner', isAi: false, paid: true, joinedDay: 0, lastSeenDay: 0, inbox: [] };
}

export function ctxWith(placesList: Place[], packs: PackSet = fixturePacks): EngineCtx {
  return { packs, places: placesList };
}

export function act(w: WorldState, ctx: EngineCtx, playerId: string, a: Action): WorldState {
  const r = applyAction(w, ctx, playerId, a);
  if (r.error) throw new Error(`${a.type}: ${r.error}`);
  return r.world;
}

/** A world with n owners, each opening a cafe with the given kit on its own place, launched when permits are ready. */
export function cafeCity(n: number, opts: { kit?: 'lean' | 'standard' | 'premium'; size?: number; pack?: Pack; placesOver?: Partial<Place>; launchDay?: number; launch?: boolean } = {}) {
  const pls = places(n, opts.placesOver);
  const pack = opts.pack ?? fixturePacks.niches.cafe!;
  const ctx = ctxWith(pls, { ...fixturePacks, niches: { ...fixturePacks.niches, cafe: pack } });
  let w: WorldState = { ...createWorld(config()), players: Array.from({ length: n }, (_, i) => owner(i + 1)) };
  for (let i = 1; i <= n; i++) {
    const kit = pack.kits.find((k) => k.id === (opts.kit ?? 'standard'))!;
    w = act(w, ctx, `pl${i}`, { type: 'open_business', niche: 'cafe', placeId: `p${i}`, name: `Cafe ${i}`, kitId: kit.id, size: opts.size ?? kit.size });
  }
  const launchDay = opts.launchDay ?? 22;   // created on day 1: the 21-day food permit is ready on day 22
  while (w.day < launchDay) w = tickDay(w, ctx);
  if (opts.launch !== false) for (let i = 1; i <= n; i++) w = act(w, ctx, `pl${i}`, { type: 'launch' });
  return { w, ctx };
}

export function run(w: WorldState, ctx: EngineCtx, days: number): WorldState {
  let x = w;
  for (let i = 0; i < days; i++) x = tickDay(x, ctx);
  return x;
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}
