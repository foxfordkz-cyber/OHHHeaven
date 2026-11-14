// Balance check of a niche pack: a season of identical businesses for each kit, and a sweep over room sizes.
// Run from the repository root: npx tsx engine/src/economy/check-pack.ts cafe
// Reads packs/_common.json and packs/<niche>.json (falls back to the test fixtures), data/places.json if present.
import { existsSync, readFileSync } from 'node:fs';
import type { CommonPack, NicheId, Pack, PackKit, Place, WorldState } from '@ohh/shared';
import { RULES } from '@ohh/shared';
import { applyAction, createWorld, tickDay, type EngineCtx } from '../index';
import { commonPack as fixtureCommon } from '../../test/fixtures/common';
import { cafePack as fixtureCafe } from '../../test/fixtures/cafe';
import { config, owner, place } from '../../test/fixtures/world';

const niche = (process.argv[2] ?? 'cafe') as NicheId;
const readJson = <T>(path: string): T | null => (existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : null);
const common = readJson<CommonPack>('packs/_common.json') ?? fixtureCommon;
const found = readJson<Pack>(`packs/${niche}.json`) ?? (niche === 'cafe' ? fixtureCafe : null);
if (!found) throw new Error(`packs/${niche}.json not found`);
const pack: Pack = found;
console.log(`Pack: ${existsSync(`packs/${niche}.json`) ? `packs/${niche}.json` : 'test fixture'} · common: ${existsSync('packs/_common.json') ? 'packs/_common.json' : 'test fixture'}`);

const mapPlaces = (readJson<Place[]>('data/places.json') ?? []).filter((p) => p.suitableFor.length === 0 || p.suitableFor.includes(niche));
// The space: 800 sq ft (the research notes' cafe) unless the room needs more; rent from the pack's mid tier if it has one,
// else the median map place, else $90.
const BASE_SQFT = 800;
const sqftFor = (size: number) => Math.max(BASE_SQFT, Math.ceil((size * pack.sizing.sqftPerUnit) / RULES.USABLE_FLOOR_SHARE) + 1);
const midTier = ((pack.extra ?? {}) as { rentByTier?: { mid?: { rentPerSqftYear?: number } } }).rentByTier?.mid?.rentPerSqftYear;
const typical = mapPlaces.length > 0 ? [...mapPlaces].sort((a, b) => a.rentPerSqftYear - b.rentPerSqftYear)[Math.floor(mapPlaces.length / 2)] : null;
const rentPerSqft = midTier ?? typical?.rentPerSqftYear ?? 90;
const rentFrom = midTier ? 'pack extra.rentByTier.mid' : typical ? `median map place ${typical.id}` : 'estimate, no data/places.json';
console.log(`Space: ${BASE_SQFT} sq ft (more if the room needs it) at $${rentPerSqft}/sq ft/yr (${rentFrom}), foot traffic 0.5\n`);

interface Result { kit: string; size: number; setup: number; cashLeft: number; revenue: number; profit: number; bankrupt: number; lostShare: number; util: number; balanced: boolean }

function season(kit: PackKit, size: number, n = 6): Result {
  const places = Array.from({ length: n }, (_, i) => place(i + 1, { sqft: sqftFor(size), rentPerSqftYear: rentPerSqft, footTraffic: 0.5 }));
  const ctx: EngineCtx = { packs: { common, niches: { [niche]: pack } }, places };
  let w: WorldState = { ...createWorld(config()), players: Array.from({ length: n }, (_, i) => owner(i + 1)) };
  for (let i = 1; i <= n; i++) {
    const r = applyAction(w, ctx, `pl${i}`, { type: 'open_business', niche, placeId: `p${i}`, name: `Shop ${i}`, kitId: kit.id, size });
    if (r.error) throw new Error(`${kit.id} × ${size}: ${r.error}`);
    w = r.world;
  }
  const wait = Math.max(0, ...w.businesses[0].permits.map((p) => p.readyDay));
  while (w.day < wait) w = tickDay(w, ctx);
  for (let i = 1; i <= n; i++) w = applyAction(w, ctx, `pl${i}`, { type: 'launch' }).world;
  while (w.phase === 'running') w = tickDay(w, ctx);
  const b = w.businesses[0];
  const h = b.history;
  const demand = h.reduce((a, m) => a + m.demandUnits, 0);
  const lost = h.reduce((a, m) => a + m.lost.size + m.lost.staff + m.lost.closure, 0);
  return {
    kit: kit.id, size, setup: b.setupSpent, cashLeft: pack.startCapital - b.setupSpent,
    revenue: h.reduce((a, m) => a + m.revenue, 0), profit: h.reduce((a, m) => a + m.profit, 0),
    bankrupt: w.businesses.filter((x) => x.status === 'bankrupt').length,
    lostShare: demand > 0 ? lost / demand : 0,
    util: h.length ? h.reduce((a, m) => a + m.sizeUtilization, 0) / h.length : 0,
    balanced: w.businesses.every((x) => x.history.every((m) => Math.abs(m.lines.reduce((a, l) => a + l.amount, 0) - (m.cashEnd - m.cashStart)) < 0.05)),
  };
}

const $ = (v: number) => (v < 0 ? '-$' : '$') + Math.round(Math.abs(v)).toLocaleString('en-US');
const row = (r: Result) => `${r.kit.padEnd(9)} ${String(r.size).padStart(4)} ${$(r.setup).padStart(10)} ${$(r.cashLeft).padStart(10)} ${$(r.revenue / 12).padStart(10)} ${$(r.profit / 12).padStart(9)} ${(r.revenue ? (100 * r.profit) / r.revenue : 0).toFixed(1).padStart(6)}% ${String(r.bankrupt).padStart(4)} ${(100 * r.lostShare).toFixed(1).padStart(6)}% ${r.util.toFixed(2).padStart(5)}  ${r.balanced ? 'ok' : 'MISMATCH'}`;
const head = 'kit       size      setup  cash left  rev/month  prof/mo  margin bkrp   lost  util  lines=cash';

console.log('Six identical honest businesses per kit, one season:');
console.log(head);
for (const kit of pack.kits) console.log(row(season(kit, kit.size)));

const standard = pack.kits.find((k) => k.id === 'standard') ?? pack.kits[0];
console.log(`\nRoom size sweep with the ${standard.id} kit (benchmarks: net margin ${(pack.benchmarks.netMarginPct * 100).toFixed(0)}%):`);
console.log(head);
const step = Math.max(1, Math.round((pack.sizing.max - pack.sizing.min) / 8));
let best: Result | null = null;
for (let size = pack.sizing.min; size <= pack.sizing.max; size += step) {
  const r = season(standard, size);
  if (!best || r.profit > best.profit) best = r;
  console.log(row(r));
}
console.log(`\nBest size by profit: ${best?.size} ${pack.sizing.unitName}s (pack default: ${pack.sizing.default}).`);
