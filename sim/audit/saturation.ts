// Does the market saturate? One cafe alone at a door, then the same cafe with 2, 5 and 9 identical neighbours
// opened at the nearest doors. Real engine, real packs, real place data.
//   npx tsx sim/audit/saturation.ts
// Exit code 1 if neighbours do not take customers from the first cafe.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pack, PackSet, Place, Player, WorldState } from '../../shared/src/types';
import { distanceM } from '../../shared/src/place';
import { applyAction, createWorld, tickDay } from '../../engine/src/index';
import { recommendOpening } from '../../engine/src/analytics/opening';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const json = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), 'utf8')) as T;
const packs: PackSet = { common: json('packs/_common.json'), niches: { cafe: json<Pack>('packs/cafe.json') } };
const places = json<Place[]>('data/places.json');
const ctx = { packs, places };
const empty = createWorld({ id: 'sat0', name: 'Saturation', city: 'nyc', seasonMonths: 12, dayMs: 2000, paused: false, maxOwners: 100, aiBusinessesTarget: 0, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05, nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 11 });
// only doors a newcomer can afford with the standard kit
const doors = places.filter((p) => p.suitableFor.includes('cafe') && (p.pedestriansPerDay ?? 0) > 0
  && (recommendOpening('cafe', p.id, empty, ctx).find((r) => r.kitId === 'standard')?.cashLeft ?? -1) >= 0);
const median = [...doors].sort((a, b) => (a.pedestriansPerDay ?? 0) - (b.pedestriansPerDay ?? 0))[Math.floor(doors.length / 2)];
const near = [...doors].sort((a, b) => distanceM(median, a) - distanceM(median, b));

function season(n: number): { demand: number; profit: number; cash: number; farthestM: number } {
  const players: Player[] = Array.from({ length: n }, (_, i) => ({ id: `pl${i + 1}`, name: `Owner ${i + 1}`, kind: 'owner', isAi: false, paid: true, joinedDay: 0, lastSeenDay: 0, inbox: [] }));
  let w: WorldState = { ...createWorld({ id: 'sat', name: 'Saturation', city: 'nyc', seasonMonths: 12, dayMs: 2000, paused: false, maxOwners: 100, aiBusinessesTarget: 0, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05, nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 11 }), players };
  const must = (r: { world: WorldState; error?: string }, what: string): WorldState => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.world; };
  for (let i = 0; i < n; i++) {
    const rec = recommendOpening('cafe', near[i].id, w, ctx).find((r) => r.kitId === 'standard')!;
    w = must(applyAction(w, ctx, `pl${i + 1}`, { type: 'open_business', niche: 'cafe', placeId: near[i].id, name: `Cafe ${i + 1}`, kitId: rec.kitId, size: rec.size, items: rec.items }), 'open');
    w = must(applyAction(w, ctx, `pl${i + 1}`, { type: 'set_orders', orders: rec.orders }), 'orders');
  }
  while (w.day < 360) {
    w = tickDay(w, ctx);
    for (let i = 0; i < n; i++) {
      const b = w.businesses[i];
      if (b.status === 'setup') { const r = applyAction(w, ctx, `pl${i + 1}`, { type: 'launch' }); if (!r.error) w = r.world; }
    }
  }
  const first = w.businesses[0];
  const last3 = first.history.slice(-3);
  return {
    demand: Math.round(last3.reduce((a, m) => a + m.demandUnits, 0) / Math.max(1, last3.length)),
    profit: Math.round(last3.reduce((a, m) => a + m.profit, 0) / Math.max(1, last3.length)),
    cash: Math.round(first.cash), farthestM: Math.round(distanceM(median, near[n - 1])),
  };
}

console.log(`door ${median.id}: ${median.address}, ${median.pedestriansPerDay} people a day`);
console.log('cafes  farthest neighbour  demand/month (first cafe)  profit/month  cash at day 360');
const rows = [1, 3, 6, 10].map((n) => ({ n, ...season(n) }));
for (const r of rows) console.log(`${String(r.n).padStart(5)}  ${String(r.farthestM + ' m').padStart(18)}  ${String(r.demand).padStart(25)}  ${String(r.profit).padStart(12)}  ${String(r.cash).padStart(15)}`);
const ok = rows[rows.length - 1].demand < 0.9 * rows[0].demand;
console.log(ok ? 'PASS: neighbours take customers from the first cafe' : 'FAIL: the first cafe keeps its demand whatever the number of neighbours');
process.exit(ok ? 0 : 1);
