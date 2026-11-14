// Where the cash of a newcomer goes, month by month, before and after the doors open.
//   npx tsx sim/trace.ts [seasons] [--niche=cafe] [--json=out.json]
// Same city as `sim/calibrate.ts season`: 30 established shops (AI residents) plus ten newcomers who play the
// recommended opening. For every newcomer of the niche it prints: the opening bill (setup spent, cash left on
// opening day), then each month's lines (revenue, cogs, payroll, rent, opex, taxes) and cash at month end, and for
// the ones that closed — the month the cash ran out and what ate it. The summary splits the drain into
// "before the doors open" and "after", so the cause of a closure is visible in numbers, not guessed.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BusinessState, NicheId, Pack, PackSet, Place } from '../shared/src/types';
import { RULES } from '../shared/src/rules';
import { baselineOrdersDay, buildoutOf, isTakeover, rentMonthOf } from '../shared/src/place';
import { defaultConfig, join as joinWorld, newWorld, step, act } from '../host/src/index';
import { defaultDeps } from '../host/src/deps';
import { createBotBrain } from '../bots/src/brain';
import type { OwnerStrategy } from '../bots/src/strategies';
import { recommendOpening } from '../engine/src/analytics/opening';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const json = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), 'utf8')) as T;
const packs: PackSet = { common: json('packs/_common.json'), niches: { cafe: json<Pack>('packs/cafe.json'), barbershop: json<Pack>('packs/barbershop.json') } };
const places = json<Place[]>('data/places.json');
const ctx = { packs, places };
const usd = (x: number): string => (x < 0 ? '-$' : '$') + Math.round(Math.abs(x)).toLocaleString('en-US');
const pad = (s: string | number, n: number): string => String(s).padStart(n);
const argv = process.argv.slice(2);
const seasons = Number(argv.find((a) => /^\d+$/.test(a)) ?? 1);
const niche = (argv.find((a) => a.startsWith('--niche='))?.slice(8) ?? 'cafe') as NicheId;
const jsonOut = argv.find((a) => a.startsWith('--json='))?.slice(7);
const seed0 = Number(argv.find((a) => a.startsWith('--seed='))?.slice(7) ?? 100);

export const NEWCOMERS: OwnerStrategy[] = ['honest', 'honest', 'social', 'newbie', 'manager', 'loner', 'premium', 'dumper', 'cut_taxes', 'honest'];

interface Row {
  season: number; strat: string; est: boolean; place: string; kind: string; ped: number; base: number; rent: number;
  createdDay: number; openedDay: number; bankruptDay: number | null; setupSpent: number; cashAtOpen: number | null;
  months: { m: number; open: boolean; revenue: number; cogs: number; payroll: number; rent: number; opex: number; other: number; taxes: number; profit: number; cashEnd: number; served: number; price: number }[];
}

const rows: Row[] = [];
const t0 = Date.now();
for (let s = 0; s < seasons; s++) {
  const seed = seed0 + s * 7;
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
  const cashAtOpen = new Map<string, number>();
  const days = w.config.seasonMonths * RULES.DAYS_PER_MONTH;
  for (let d = 1; d < days && w.phase === 'running'; d++) {
    for (const id of newcomers) {
      let acts: ReturnType<typeof brain.ownerActions> = [];
      try { acts = brain.ownerActions(w, ctx, id); } catch { acts = []; }
      for (const a of acts.slice(0, 12)) { const r = act(w, ctx, id, a); if (!r.error) w = r.world; }
    }
    w = step(w, ctx, deps);
    for (const b of w.businesses) if (b.openedDay != null && !cashAtOpen.has(b.id)) cashAtOpen.set(b.id, b.cash);
  }
  for (const b of w.businesses as BusinessState[]) {
    if (b.niche !== niche) continue;
    const owner = w.players.find((p) => p.id === b.managerPlayerId);
    const place = places.find((p) => p.id === b.placeId)!;
    const p = packs.niches[b.niche]!;
    const sum = (h: BusinessState['history'][number], k: string) => h.lines.filter((l) => l.kind === k).reduce((a, l) => a + l.amount, 0);
    rows.push({
      season: s, strat: strategies.get(b.managerPlayerId) ?? owner?.strategy ?? '?', est: !!owner?.isAi, place: place.id,
      kind: isTakeover(p, place) ? 'for sale' : buildoutOf(p, place)?.classId ?? '-', ped: place.pedestriansPerDay ?? 0,
      base: Math.round(baselineOrdersDay(p, place) ?? 0), rent: rentMonthOf(place),
      createdDay: b.createdDay, openedDay: b.openedDay ?? -1, bankruptDay: b.bankruptDay ?? null, setupSpent: b.setupSpent,
      cashAtOpen: cashAtOpen.get(b.id) ?? null,
      months: b.history.map((h) => ({
        m: h.month, open: (b.openedDay ?? 1e9) <= h.month * RULES.DAYS_PER_MONTH, revenue: h.revenue, cogs: sum(h, 'cogs'), payroll: sum(h, 'payroll'),
        rent: sum(h, 'rent'), opex: sum(h, 'opex'), other: sum(h, 'other') + sum(h, 'deal') + sum(h, 'fine'), taxes: -h.taxesPaid, profit: h.profit, cashEnd: h.cashEnd,
        served: h.servedUnits, price: h.avgPrice,
      })),
    });
  }
  console.error(`season ${s} done, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

const neu = rows.filter((r) => !r.est);
const est = rows.filter((r) => r.est);
console.log(`# ${packs.niches[niche]!.name}: newcomers ${neu.length} (closed ${neu.filter((r) => r.bankruptDay != null).length}), established ${est.length} (closed ${est.filter((r) => r.bankruptDay != null).length}), start capital ${usd(packs.niches[niche]!.startCapital)}`);
for (const r of [...neu, ...est.filter((x) => x.bankruptDay != null)]) {
  console.log(`\n## ${r.est ? 'established' : 'newcomer'} ${r.strat} @ ${r.place} (${r.kind}; ${r.ped} people/day, map says ${r.base} orders/day; rent ${usd(r.rent)}/mo)`);
  console.log(`   lease day ${r.createdDay}, doors open day ${r.openedDay}, ${r.bankruptDay != null ? `CLOSED day ${r.bankruptDay}` : 'alive'}; spent on setup ${usd(r.setupSpent)}, cash on opening day ${r.cashAtOpen == null ? '—' : usd(r.cashAtOpen)}`);
  console.log('   month  open  orders/day  price   revenue      cogs   payroll      rent      opex     other     taxes    profit  cash end');
  for (const m of r.months) console.log(`   ${pad(m.m, 5)} ${m.open ? '  yes' : '   no'} ${pad(Math.round(m.served / 30), 11)} ${pad('$' + m.price.toFixed(2), 6)} ${[m.revenue, m.cogs, m.payroll, m.rent, m.opex, m.other, m.taxes, m.profit, m.cashEnd].map((x) => pad(usd(x), 9)).join(' ')}`);
}
// where the money went: before the doors opened, the first 90 days open, after that
const agg = (xs: Row[]) => {
  const pre = { rent: 0, other: 0 }, ramp = { profit: 0, n: 0 }, later = { profit: 0, n: 0 };
  for (const r of xs) for (const m of r.months) {
    const openMonth = Math.ceil(r.openedDay / 30);
    if (m.m < openMonth) { pre.rent += m.rent; pre.other += m.payroll + m.opex + m.other; }
    else if (m.m < openMonth + 3) { ramp.profit += m.profit; ramp.n++; } else { later.profit += m.profit; later.n++; }
  }
  return { n: xs.length, setup: xs.reduce((a, r) => a + r.setupSpent, 0) / Math.max(1, xs.length), preRent: pre.rent / Math.max(1, xs.length), preOther: pre.other / Math.max(1, xs.length), rampMonth: ramp.profit / Math.max(1, ramp.n), laterMonth: later.profit / Math.max(1, later.n) };
};
console.log('\n# Where the cash went (means per business)');
console.log('group                      n     setup   rent before open   other before open   profit/mo first 3 open months   profit/mo after');
for (const [label, xs] of [['newcomers closed', neu.filter((r) => r.bankruptDay != null)], ['newcomers alive', neu.filter((r) => r.bankruptDay == null)], ['established', est]] as [string, Row[]][]) {
  const a = agg(xs);
  console.log(`${label.padEnd(24)} ${pad(a.n, 3)} ${pad(usd(a.setup), 9)} ${pad(usd(a.preRent), 18)} ${pad(usd(a.preOther), 19)} ${pad(usd(a.rampMonth), 31)} ${pad(usd(a.laterMonth), 17)}`);
}
console.log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(rows, null, 1));
