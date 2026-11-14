// Audit infrastructure. Game state changes go only through the engine's public entry point.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAction, createWorld, defaultOrders, itemsCost, netWorth, openEstablished, tickDay } from '../../engine/src/index';
import type { EngineCtx } from '../../engine/src/index';
import { asEstablishedPlace, footfallParams, RULES } from '../../shared/src/index';
import type { Action, BusinessState, Pack, PackKit, PackSet, Place, Player, StandingOrders, WorldState } from '../../shared/src/types';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const outputDir = process.env.CAFE_AUDIT_OUT ? resolve(process.env.CAFE_AUDIT_OUT) : join(ROOT, 'sim/audit');
export const DAYS = 12 * RULES.DAYS_PER_MONTH;
export const CENT = 0.011; // One rounded cent plus floating point tolerance; not an economic threshold.
export const round = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
export function resolve(p: string): string { return isAbsolute(p) ? p : join(ROOT, p); }
export function readJson<T>(p: string): T { return JSON.parse(readFileSync(resolve(p), 'utf8')) as T; }
export const packPath = process.env.CAFE_AUDIT_PACK ?? 'packs/cafe.json';
export const commonPath = process.env.CAFE_AUDIT_COMMON ?? 'packs/_common.json';
export const cafe = readJson<Pack>(packPath);
export const packs: PackSet = { common: readJson(commonPath), niches: { cafe } };
export const places = readJson<Place[]>('data/places.json');
export interface Spec {
  label: string; kit?: PackKit['id']; size?: number; price?: number;
  staff?: Record<string, number>; levers?: Record<string, string>; place?: Place;
}
export const fixtureSource = {
  source: 'build/ROUND3.md#G1; sim/audit/README.md', confidence: 'estimate',
  note: 'Controlled regression inputs, not measured cafe statistics. The 800 sqft/$6000 monthly rent/0.5 foot-traffic fixture and 140-point grid preserve the earlier audit. Pedestrians = pack.market.unitsPerSlotMonth / (30 * pack.extra.footfall.captureRate): an average mature cafe without rivals starts at the old reference monthly demand. No renovation class is assigned, so the pack flat build-out cost applies. The role stress test overrides pedestrians with the largest cafe-door count in data/places.json; the bankruptcy stress test uses the smallest.',
};
export function fixturePlace(i = 0): Place {
  return {
    id: `audit-door-${i}`, address: 'Controlled audit fixture (not a real listing)', block: `audit-block-${i}`,
    lat: 40.73 + i * 0.01, lng: -73.98, kind: 'storefront', sqft: 800, tier: 'mid',
    rentPerSqftYear: 90, footTraffic: 0.5, suitableFor: ['cafe'],
    pedestriansPerDay: cafe.market.unitsPerSlotMonth / (RULES.DAYS_PER_MONTH * (footfallParams(cafe)?.captureRate ?? 1)),
    sourceDataset: 'audit:controlled-fixture', note: fixtureSource.note,
  };
}
export function emptyWorld(n: number): WorldState {
  const players: Player[] = Array.from({ length: n }, (_, i) => ({
    id: `audit-owner-${i}`, name: `Audit owner ${i}`, kind: 'owner', isAi: false, paid: true,
    joinedDay: 1, lastSeenDay: 1, inbox: [],
  }));
  return { ...createWorld({
    id: 'cafe-logic-audit', name: 'Cafe logic audit', city: 'nyc', seasonMonths: 12,
    dayMs: RULES.DAY_MS_DEMO, paused: false, maxOwners: 100, aiBusinessesTarget: 0,
    entryFee: 0, prizeShare: 0, officialsShare: 0, platformShare: 0, nichePrizeTable: [],
    demo: true, seed: 1,
  }), players };
}
export function act(w: WorldState, ctx: EngineCtx, i: number, a: Action): WorldState {
  const r = applyAction(w, ctx, `audit-owner-${i}`, a);
  if (r.error) throw new Error(`${a.type}, owner ${i}, day ${w.day}: ${r.error}`);
  return r.world;
}
export function ordersFor(s: Spec): Partial<StandingOrders> {
  const orders: Partial<StandingOrders> = { autopilot: 'hold', shortcuts: [] };
  if (s.price !== undefined) orders.price = s.price;
  // set_orders merges missing roles; zero them explicitly so a default lead cannot survive the comparison.
  if (s.staff) orders.staff = { ...Object.fromEntries(cafe.staff.map(r => [r.id, 0])), ...s.staff };
  if (s.levers) orders.levers = s.levers;
  return orders;
}
export function setup(specs: Spec[], established = false): { w: WorldState; ctx: EngineCtx } {
  const ps = specs.map((s, i) => s.place ?? fixturePlace(i));
  const ctx: EngineCtx = { packs, places: ps };
  let w = emptyWorld(specs.length);
  for (const [i, s] of specs.entries()) {
    const kit = cafe.kits.find(k => k.id === (s.kit ?? 'standard'));
    if (!kit) throw new Error(`Missing kit: ${s.kit}`);
    const a: Extract<Action, { type: 'open_business' }> = {
      type: 'open_business', niche: 'cafe', placeId: ps[i].id, name: s.label, kitId: kit.id, size: s.size ?? kit.size,
    };
    if (established) {
      const r = openEstablished(w, ctx, w.players[i].id, a);
      if (r.error) throw new Error(`openEstablished: ${r.error}`);
      w = r.world;
    } else w = act(w, ctx, i, a);
    w = act(w, ctx, i, { type: 'set_orders', orders: ordersFor(s) });
    const b = w.businesses[i];
    if (b.size !== a.size || (s.price !== undefined && b.orders.price !== s.price)) {
      throw new Error(`Engine changed requested size/price for ${s.label}; do not compare silently clamped profiles`);
    }
    if (s.staff && Object.entries(ordersFor(s).staff!).some(([id, n]) => b.orders.staff[id] !== n)) {
      throw new Error(`Engine changed requested staffing for ${s.label}`);
    }
  }
  return { w, ctx };
}
export type BeforeDay = (w: WorldState, ctx: EngineCtx) => WorldState;
export function run(w: WorldState, ctx: EngineCtx, end = DAYS, before?: BeforeDay): WorldState {
  while (w.day < end && w.phase !== 'ended') {
    for (const b of w.businesses) {
      // Unlike a fixed day-22 launch, this respects build-out and every permit in the current pack.
      if (b.status === 'setup' && b.permits.every(p => p.readyDay <= w.day)) {
        const i = w.players.findIndex(p => p.id === b.managerPlayerId);
        w = act(w, ctx, i, { type: 'launch' });
      }
    }
    if (before) w = before(w, ctx);
    w = tickDay(w, ctx);
  }
  return w;
}
export function simulate(specs: Spec[], end = DAYS, before?: BeforeDay, established = false) {
  const { w, ctx } = setup(specs, established);
  const final = run(w, ctx, end, before);
  return { w: final, ctx, summaries: final.businesses.map(b => summary(b, ctx)) };
}
export function summary(b: BusinessState, ctx: EngineCtx) {
  const recent = b.history.filter(m => m.month >= 10);
  return {
    label: b.name, placeId: b.placeId, status: b.status, openedDay: b.openedDay ?? null, bankruptDay: b.bankruptDay ?? null,
    size: b.size, orders: b.orders, cash: round(b.cash), netWorth: netWorth(b, ctx), setupSpent: b.setupSpent,
    revenue: round(b.history.reduce((s, m) => s + m.revenue, 0)),
    profit: round(b.history.reduce((s, m) => s + m.profit, 0)),
    served: b.history.reduce((s, m) => s + m.servedUnits, 0),
    demand: b.history.reduce((s, m) => s + m.demandUnits, 0),
    quality: b.quality, reputation: b.reputation,
    // A bankrupt cafe does not get a fabricated "last quarter" from earlier profitable months.
    lastQuarterProfit: recent.length === 3 ? round(recent.reduce((s, m) => s + m.profit, 0) / 3) : null,
    months: b.history.map(m => ({ month: m.month, demand: m.demandUnits, served: m.servedUnits, capacity: m.capacityUnits, profit: m.profit, revenue: m.revenue })),
  };
}
export function canFit(p: Place, specs: Spec[], established = false): boolean {
  return p.suitableFor.includes('cafe') && (p.pedestriansPerDay ?? 0) > 0 && (established || !p.forSale) && specs.every(s => {
    const kit = cafe.kits.find(k => k.id === (s.kit ?? 'standard'))!;
    const size = s.size ?? kit.size;
    return size <= Math.floor(p.sqft * RULES.USABLE_FLOOR_SHARE / cafe.sizing.sqftPerUnit)
      && itemsCost(cafe, kit.items, size, established ? asEstablishedPlace(cafe, p) : p) <= cafe.startCapital;
  });
}
export function metadata(extra: Record<string, unknown> = {}) {
  const hash = (p: string) => createHash('sha256').update(readFileSync(resolve(p))).digest('hex');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  const inputs = [packPath, commonPath, 'data/places.json'];
  if (existsSync(resolve('packs/parts/cafe/D20-formats.json'))) inputs.push('packs/parts/cafe/D20-formats.json');
  return {
    schemaVersion: 1, commit: git('rev-parse', 'HEAD'),
    inputs: Object.fromEntries(inputs.map(p => [relative(ROOT, resolve(p)), hash(p)])),
    auditor: Object.fromEntries(['harness', 'profiles', 'probes', 'sweep', 'diversity'].map(p => [`sim/audit/${p}.ts`, hash(`sim/audit/${p}.ts`)])),
    engineTree: git('rev-parse', 'HEAD:engine'), sharedTree: git('rev-parse', 'HEAD:shared'),
    days: DAYS, source: 'Engine simulation; not real-world outcome frequencies', confidence: 'estimate',
    note: 'Deterministic seed 1; no host bots, external events, weather shocks, prize money or human officials. Built-in law runs. Fixed legal orders; exceptions explicitly described per probe. Monetary outputs are model calculations, not researched prices.',
    ...extra,
  };
}
export function save(name: string, value: unknown): void {
  mkdirSync(outputDir, { recursive: true });
  const path = join(outputDir, name);
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
  console.log(`Saved ${path}`);
}
export function main(fn: () => void): void {
  try { fn(); } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.stack : String(error)}`);
    process.exitCode = 2;
  }
}
export { applyAction, defaultOrders, existsSync, itemsCost, netWorth, RULES };
