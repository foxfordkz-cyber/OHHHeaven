// Calibration bench on the real engine, the real packs and the real place data.
//   npx tsx sim/calibrate.ts doors      — what every kind of door looks like before anyone opens there
//   npx tsx sim/calibrate.ts price      — which price earns the most at a typical door
//   npx tsx sim/calibrate.ts season [n] — n full seasons: the city's established shops plus newcomers
// The targets it is read against are printed with every table.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BusinessState, NicheId, Pack, PackSet, Place, WorldState } from '../shared/src/types';
import { RULES } from '../shared/src/rules';
import { baselineOrdersDay, buildoutOf, daysToOpenOf, isTakeover, rentMonthOf, rivalsOf } from '../shared/src/place';
import { defaultConfig, join as joinWorld, newWorld, step, act } from '../host/src/index';
import { defaultDeps } from '../host/src/deps';
import { createBotBrain } from '../bots/src/brain';
import type { OwnerStrategy } from '../bots/src/strategies';
import { recommendOpening } from '../engine/src/analytics/opening';
import { project } from '../engine/src/analytics/opening';
import { createWorld, netWorth } from '../engine/src/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const json = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), 'utf8')) as T;
const packs: PackSet = { common: json('packs/_common.json'), niches: { cafe: json<Pack>('packs/cafe.json'), barbershop: json<Pack>('packs/barbershop.json') } };
const places = json<Place[]>('data/places.json');
const ctx = { packs, places };
const usd = (x: number): string => (x < 0 ? '-$' : '$') + Math.round(Math.abs(x)).toLocaleString('en-US');
const pad = (s: string | number, n: number): string => String(s).padStart(n);
const q = (xs: number[], f: number): number => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * f)] : NaN);

const niche = (process.argv.find((a) => a.startsWith('--niche='))?.slice(8) ?? 'cafe') as NicheId;
const pack = packs.niches[niche]!;
const emptyWorld = (): WorldState => createWorld(defaultConfig({ id: 'cal', name: 'Calibration', demo: true, seed: 1 }));
const mode = process.argv[2] ?? 'doors';

// ───────────── doors ─────────────
if (mode === 'doors') {
  const w = emptyWorld();
  const rows = places.filter((p) => p.suitableFor.includes(niche)).map((p) => {
    const recs = recommendOpening(niche, p.id, w, ctx);
    const rec = recs.find((r) => r.kitId === 'standard') ?? recs[0];
    const res = project(pack, niche, p.id, rec.size, rec.items, rec.orders, rec.total, w, ctx);
    const a = res.analytics;
    const days = rec.daysToOpen;
    const firstYear = Number((rec.why[rec.why.length - 1].match(/First year[^:]*: (a loss of )?\$([\d,]+)/) ?? []).slice(1).reduce((s, x, i) => (i === 0 ? (x ? '-' : '') : s + x.replace(/,/g, '')), '')) || 0;
    return {
      p, rec, ped: p.pedestriansPerDay ?? 0, rivals: rivalsOf(p, niche)?.weight ?? 0, rent: rentMonthOf(p),
      kind: isTakeover(pack, p) ? 'for sale' : buildoutOf(pack, p)?.classId ?? '-', total: rec.total, left: rec.cashLeft, days,
      orders: Math.round(res.projected.servedUnits / 30), base: Math.round(baselineOrdersDay(pack, p) ?? 0),
      breakEven: a.breakEvenUnitsMonth != null ? Math.round(a.breakEvenUnitsMonth / 30) : NaN, profit: res.projected.profit,
      rentPct: a.rentPct, firstYear, staff: Object.values(rec.orders.staff).reduce((s, n) => s + n, 0),
    };
  }).sort((x, y) => x.ped - y.ped);
  console.log(`${pack.name}: ${rows.length} doors, nobody else playing. Mature month = the regular crowd is complete.`);
  console.log('door      people/day rivals  rent/mo  space     to open   cash left  days  orders/day  break-even  staff  month profit  rent%  first year');
  const show = rows.filter((_, i) => i % Math.max(1, Math.floor(rows.length / 26)) === 0);
  for (const r of show) {
    console.log(`${r.p.id}  ${pad(r.ped, 9)} ${pad(r.rivals.toFixed(1), 6)} ${pad(usd(r.rent), 8)}  ${r.kind.padEnd(9)} ${pad(usd(r.total), 8)} ${pad(usd(r.left), 10)} ${pad(r.days, 5)} ${pad(r.orders, 10)} ${pad(r.breakEven, 11)} ${pad(r.staff, 6)} ${pad(usd(r.profit), 13)} ${pad(Math.round(r.rentPct * 100) + '%', 6)} ${pad(usd(r.firstYear), 11)}`);
  }
  const afford = rows.filter((r) => r.left >= 0);
  const profitable = afford.filter((r) => r.profit > 0);
  console.log(`\naffordable with ${usd(pack.startCapital)}: ${afford.length} of ${rows.length} doors`);
  console.log(`  by space: ${['light', 'standard', 'heavy', 'for sale'].map((k) => `${k} ${afford.filter((r) => r.kind === k).length}/${rows.filter((r) => r.kind === k).length}`).join(', ')}`);
  console.log(`mature month in profit: ${profitable.length} of ${afford.length} affordable doors (target: about half)`);
  console.log(`mature month profit, affordable doors: quartiles ${usd(q(afford.map((r) => r.profit), 0.25))} / ${usd(q(afford.map((r) => r.profit), 0.5))} / ${usd(q(afford.map((r) => r.profit), 0.75))}; best ${usd(q(afford.map((r) => r.profit), 1))}`);
  console.log(`first year, affordable doors: quartiles ${usd(q(afford.map((r) => r.firstYear), 0.25))} / ${usd(q(afford.map((r) => r.firstYear), 0.5))} / ${usd(q(afford.map((r) => r.firstYear), 0.75))} (target: most below zero — the first year rarely pays back)`);
  console.log(`orders a day per 100 people walking by: median ${(q(rows.map((r) => (100 * r.orders) / Math.max(1, r.ped)), 0.5)).toFixed(1)}`);
  console.log(`rent as a share of sales, profitable doors: median ${Math.round(q(profitable.map((r) => r.rentPct), 0.5) * 100)}% (research notes: 6% city-centre median, 12% in the model shop)`);
}

// ───────────── price ─────────────
if (mode === 'price') {
  const w = emptyWorld();
  // doors a newcomer can afford with a full-size room: a trimmed room is capacity-bound and tells nothing about price
  const pool = places.filter((p) => p.suitableFor.includes(niche) && (p.pedestriansPerDay ?? 0) > 0)
    .filter((p) => { const r = recommendOpening(niche, p.id, w, ctx).find((x) => x.kitId === 'standard'); return !!r && r.cashLeft >= 0 && r.size >= Math.min(pack.sizing.default, 14); })
    .sort((a, b) => (a.pedestriansPerDay ?? 0) - (b.pedestriansPerDay ?? 0));
  const picks = [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => pool[Math.floor((pool.length - 1) * f)]);
  const ref = pack.unit.refPrice;
  const prices = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.45, 1.6].map((m) => Math.round(ref * m * 20) / 20);
  console.log(`${pack.name}: mature monthly profit by price, best staffing at each price (target: the best price within 10% of $${ref.toFixed(2)})`);
  console.log(`door (people/day)   ${prices.map((p) => pad('$' + p.toFixed(2), 9)).join('')}   best`);
  for (const p of picks) {
    const rec = recommendOpening(niche, p.id, w, ctx).find((r) => r.kitId === 'standard')!;
    const role = Object.keys(rec.orders.staff)[0];
    const row = prices.map((price) => {
      let best = -Infinity;
      for (let n = pack.capacity.minStaff; n <= pack.capacity.maxStaff; n++) {
        const res = project(pack, niche, p.id, rec.size, rec.items, { ...rec.orders, price, staff: { [role]: n } }, rec.total, w, ctx);
        best = Math.max(best, res.projected.profit);
      }
      return best;
    });
    const bi = row.indexOf(Math.max(...row));
    console.log(`${p.id} (${pad(p.pedestriansPerDay ?? 0, 6)})  ${row.map((x) => pad(usd(x), 9)).join('')}   $${prices[bi].toFixed(2)}`);
  }
}

// ───────────── seasons ─────────────
if (mode === 'season') {
  const seasons = Number(process.argv[3] ?? 3);
  const NEWCOMERS: OwnerStrategy[] = ['honest', 'honest', 'social', 'newbie', 'manager', 'loner', 'premium', 'dumper', 'cut_taxes', 'honest'];
  const all: { strat: string; est: boolean; bankrupt: boolean; openedDay: number; endCash: number; worth: number; lastProfit: number; price: number; kind: string; niche: string }[] = [];
  for (let s = 0; s < seasons; s++) {
    const seed = 100 + s * 7;
    const strategies = new Map<string, OwnerStrategy>();
    const brain = createBotBrain({ strategyOf: (p) => strategies.get(p.id), recommendOpening: (n, placeId, world, c) => recommendOpening(n, placeId, world, c) });
    const deps = defaultDeps({ bots: brain });
    let w = newWorld({ ...defaultConfig({ id: 'cal', name: 'Calibration', demo: true, seed }), aiBusinessesTarget: 30 }, ctx, deps);
    const newcomers: string[] = [];
    NEWCOMERS.forEach((st, i) => {
      const j = joinWorld(w, { name: `Newcomer ${s}-${i}`, kind: 'owner' });
      if (j.error) return;
      w = j.world;
      strategies.set(j.playerId, st);
      newcomers.push(j.playerId);
    });
    const days = w.config.seasonMonths * RULES.DAYS_PER_MONTH;
    for (let d = 1; d < days && w.phase === 'running'; d++) {
      for (const id of newcomers) {
        let acts: ReturnType<typeof brain.ownerActions> = [];
        try { acts = brain.ownerActions(w, ctx, id); } catch { acts = []; }
        for (const a of acts.slice(0, 12)) { const r = act(w, ctx, id, a); if (!r.error) w = r.world; }
      }
      w = step(w, ctx, deps);
    }
    for (const b of w.businesses as BusinessState[]) {
      const owner = w.players.find((p) => p.id === b.managerPlayerId);
      const place = places.find((p) => p.id === b.placeId);
      const last = b.history[b.history.length - 1];
      const p = packs.niches[b.niche]!;
      all.push({
        strat: strategies.get(b.managerPlayerId) ?? owner?.strategy ?? '?', est: !!owner?.isAi, bankrupt: b.status === 'bankrupt', openedDay: b.openedDay ?? -1,
        endCash: b.cash, worth: netWorth(b, ctx), lastProfit: last?.profit ?? 0, price: b.orders.price, niche: b.niche,
        kind: place && isTakeover(p, place) ? 'for sale' : (place && buildoutOf(p, place)?.classId) || '-',
      });
    }
    const never = newcomers.filter((id) => !w.businesses.some((b) => b.managerPlayerId === id)).length;
    if (never) console.log(`season ${s}: ${never} newcomers found no door they could afford`);
  }
  for (const n of [...new Set(all.map((r) => r.niche))]) {
    const p = packs.niches[n as NicheId]!;
    const est = all.filter((r) => r.niche === n && r.est), neu = all.filter((r) => r.niche === n && !r.est);
    console.log(`\n${p.name}, ${seasons} season(s). Start capital ${usd(p.startCapital)}, reference price $${p.unit.refPrice}`);
    console.log(`  established shops: ${est.length}, closed ${est.filter((r) => r.bankrupt).length} (${Math.round((100 * est.filter((r) => r.bankrupt).length) / Math.max(1, est.length))}%; target 5–10% a year)`);
    console.log(`    last month profit quartiles ${usd(q(est.filter((r) => !r.bankrupt).map((r) => r.lastProfit), 0.25))} / ${usd(q(est.filter((r) => !r.bankrupt).map((r) => r.lastProfit), 0.5))} / ${usd(q(est.filter((r) => !r.bankrupt).map((r) => r.lastProfit), 0.75))}; price quartiles $${q(est.map((r) => r.price), 0.25)} / $${q(est.map((r) => r.price), 0.5)} / $${q(est.map((r) => r.price), 0.75)}`);
    console.log(`  newcomers: ${neu.length}, closed ${neu.filter((r) => r.bankrupt).length} (${Math.round((100 * neu.filter((r) => r.bankrupt).length) / Math.max(1, neu.length))}%; target about 20% in the first year)`);
    console.log(`    still below their start capital: ${neu.filter((r) => r.worth < p.startCapital).length} of ${neu.length} (target: nearly all — the first year does not pay back)`);
    console.log(`    end cash quartiles ${usd(q(neu.map((r) => r.endCash), 0.25))} / ${usd(q(neu.map((r) => r.endCash), 0.5))} / ${usd(q(neu.map((r) => r.endCash), 0.75))}; last month profit ${usd(q(neu.filter((r) => !r.bankrupt).map((r) => r.lastProfit), 0.25))} / ${usd(q(neu.filter((r) => !r.bankrupt).map((r) => r.lastProfit), 0.5))} / ${usd(q(neu.filter((r) => !r.bankrupt).map((r) => r.lastProfit), 0.75))}`);
    const by = new Map<string, typeof neu>();
    for (const r of neu) by.set(r.strat, [...(by.get(r.strat) ?? []), r]);
    for (const [k, v] of by) console.log(`    ${k.padEnd(10)} n=${v.length}  closed ${v.filter((r) => r.bankrupt).length}  median end cash ${pad(usd(q(v.map((r) => r.endCash), 0.5)), 9)}  opened day ${q(v.map((r) => r.openedDay), 0.5)}  spaces: ${[...new Set(v.map((r) => r.kind))].join(',')}  price $${q(v.map((r) => r.price), 0.5)}`);
  }
}
