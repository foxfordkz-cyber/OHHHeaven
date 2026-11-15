// Balance check of the season (agent 07, Part B).
//   npx tsx sim/season.ts --owners 40 --officials 3 --seasons 200 --seed 1
// Options: --quick (fewer seasons in side experiments), --engine stub (force agent 07's stub engine).
// Prints one table per balance question. Answers and decisions: research/reports/07-balance.md.
import type { NicheId, PackSet, Place } from '../shared/src/types';
import { RULES } from '../shared/src/rules';
import { ALL_OWNER_STRATEGIES, type OwnerStrategy } from '../bots/src/strategies';
import { loadData, loadEngine, type EngineApi } from './engine';
import { DEFAULT_OFFICIALS, mixedOwners, runSeason, type OwnerResult, type OwnerSpec, type SeasonSetup } from './run';

const argv = process.argv.slice(2);
const arg = (k: string, d: number) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? Number(argv[i + 1]) : d; };
const OWNERS = arg('owners', 40), OFFICIALS = arg('officials', 3), SEASONS = arg('seasons', 200), SEED = arg('seed', 1);
const QUICK = argv.includes('--quick');
const side = (n: number) => Math.max(2, QUICK ? Math.ceil(n / 2) : n);
const MAIN: OwnerStrategy[] = ALL_OWNER_STRATEGIES.filter((s) => s !== 'cash_wages');

const t0 = Date.now();
const api: EngineApi = await loadEngine(argv.includes('--engine') && argv[argv.indexOf('--engine') + 1] === 'stub' ? 'stub' : 'auto');
const data = loadData();
const NICHES = (Object.keys(data.packs.niches) as NicheId[]).sort();
const officials = Array.from({ length: OFFICIALS }, (_, i) => DEFAULT_OFFICIALS[i % DEFAULT_OFFICIALS.length]);
const clone = (p: PackSet): PackSet => JSON.parse(JSON.stringify(p));

// ───────────── printing ─────────────
const out: string[] = [];
const print = (s = '') => { out.push(s); console.log(s); };
function table(head: string[], rows: (string | number)[][]) {
  print(`| ${head.join(' | ')} |`);
  print(`|${head.map(() => '---').join('|')}|`);
  for (const r of rows) print(`| ${r.map((x) => (typeof x === 'number' ? fmt(x) : x)).join(' | ')} |`);
  print();
}
const fmt = (x: number) => (Number.isInteger(x) ? x.toLocaleString('en-US') : x.toLocaleString('en-US', { maximumFractionDigits: 1 }));
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');
const usd = (x: number) => `$${Math.round(x).toLocaleString('en-US')}`;
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function runMany(n: number, seed0: number, mk: (seed: number) => SeasonSetup): OwnerResult[][] {
  const res: OwnerResult[][] = [];
  for (let k = 0; k < n; k++) res.push(runSeason(api, mk(seed0 + k)).owners);
  return res;
}
function byStrategy(seasons: OwnerResult[][]) {
  const m = new Map<OwnerStrategy, OwnerResult[]>();
  for (const s of seasons) for (const o of s) (m.get(o.strategy) ?? m.set(o.strategy, []).get(o.strategy)!).push(o);
  return m;
}
const base = (seed: number, owners: OwnerSpec[], extra: Partial<SeasonSetup> = {}): SeasonSetup => ({ seed, owners, officials, packs: data.packs, places: data.places, ...extra });
const mix = (counts: [OwnerStrategy, number][]): OwnerSpec[] => {
  const list: OwnerStrategy[] = counts.flatMap(([s, n]) => Array.from({ length: n }, () => s));
  const seen = new Map<OwnerStrategy, number>();
  return list.map((s) => { const i = seen.get(s) ?? 0; seen.set(s, i + 1); return { strategy: s, niche: NICHES[i % NICHES.length] }; });
};

print(`# Season balance — ${OWNERS} owners, ${OFFICIALS} officials, ${SEASONS} seasons, seed ${SEED}`);
print(`engine: ${api.source}, data: ${data.source}${QUICK ? ', quick side experiments' : ''}`);
print();

// ───────────── main run: Q1, Q3 baseline, Q5a, Q6, Q9 ─────────────
const mainOwners = mixedOwners(OWNERS, MAIN, NICHES);
const main = runMany(SEASONS, SEED, (seed) => base(seed, mainOwners));
const S = byStrategy(main);
const totalPrizes = main.flat().filter((o) => o.prizePlace).length;

print('## Q1. Prize places (top 3 of each niche) and bankruptcies by character');
table(['character', 'owner-seasons', 'share of prize places', 'prize rate', 'bankrupt', 'mean net worth', 'mean fines', 'mean savings'],
  MAIN.map((s) => { const xs = S.get(s) ?? []; return [s, xs.length, pct(xs.filter((o) => o.prizePlace).length, totalPrizes), pct(xs.filter((o) => o.prizePlace).length, xs.length), pct(xs.filter((o) => o.bankrupt).length, xs.length), usd(mean(xs.map((o) => o.netWorth))), usd(mean(xs.map((o) => o.fines))), usd(mean(xs.map((o) => o.savings)))]; })
    .sort((a, b) => parseFloat(String(b[2])) - parseFloat(String(a[2]))));
const share = (s: OwnerStrategy) => (S.get(s) ?? []).filter((o) => o.prizePlace).length / Math.max(1, totalPrizes);
const bust = (s: OwnerStrategy) => { const xs = S.get(s) ?? []; return xs.filter((o) => o.bankrupt).length / Math.max(1, xs.length); };
const top = MAIN.reduce((a, s) => (share(s) > share(a) ? s : a), MAIN[0]);
print(`check: max share ${top} ${(100 * share(top)).toFixed(1)}% (target ≤ 35%) → ${share(top) <= 0.35 ? 'OK' : 'FAIL'}; cut_all bankrupt ${(100 * bust('cut_all')).toFixed(1)}% vs honest ${(100 * bust('honest')).toFixed(1)}% → ${bust('cut_all') > bust('honest') ? 'OK' : 'FAIL'}`);
print();

// ───────────── Q2: complaint and inspection frequency vs value of cheating ─────────────
print('## Q2. Net worth of cheaters minus honest, by detection channel and frequency');
{
  const rows: (string | number)[][] = [];
  const cell = (label: string, tuning: SeasonSetup['tuning'], cshare: number, salt: number) => {
    const nC = Math.round(OWNERS * cshare), nCheat = Math.round(OWNERS / 4);
    const owners = mix([['cut_all', nCheat], ['cut_taxes', nCheat], ['complainer', nC], ['honest', OWNERS - 2 * nCheat - nC]]);
    const res = byStrategy(runMany(side(6), SEED + 10_000 + salt, (seed) => base(seed, owners, { tuning })));
    const h = mean((res.get('honest') ?? []).map((o) => o.netWorth));
    const ca = res.get('cut_all') ?? [], ct = res.get('cut_taxes') ?? [];
    rows.push([label, `${Math.round(cshare * 100)}% (${nC})`, usd(mean(ca.map((o) => o.netWorth)) - h), usd(mean(ct.map((o) => o.netWorth)) - h), pct(ca.filter((o) => o.bankrupt).length, ca.length), pct(ct.filter((o) => o.fines > 0).length, ct.length)]);
  };
  let salt = 0;
  for (const routine of [12, 6]) for (const cshare of [0, 0.15, 0.3]) cell(`tax flags on, health routine every ${routine} mo`, { routineEveryMonths: routine }, cshare, ++salt);
  for (const cshare of [0, 0.3]) cell('no tax flags, health routine every 6 mo', { taxFlags: false }, cshare, ++salt);
  for (const audit of [6, 4, 3, 2]) cell(`no tax flags, routine tax audit every ${audit} mo`, { taxFlags: false, routineAuditEveryMonths: audit }, 0.15, ++salt);
  table(['detection', 'complainers', 'cut_all − honest', 'cut_taxes − honest', 'cut_all bankrupt', 'cut_taxes caught'], rows);
}

// ───────────── Q3: honest newbies going bankrupt vs startCapital ─────────────
print('## Q3. Honest newbies bankrupt within the season, by startCapital');
{
  print(`baseline (main run): newbie bankrupt ${pct((S.get('newbie') ?? []).filter((o) => o.bankrupt).length, (S.get('newbie') ?? []).length)}, honest ${pct((S.get('honest') ?? []).filter((o) => o.bankrupt).length, (S.get('honest') ?? []).length)}`);
  print();
  const rows: (string | number)[][] = [];
  const owners = mix([['newbie', Math.round(OWNERS / 2)], ['honest', OWNERS - Math.round(OWNERS / 2)]]);
  const found = new Map<NicheId, { mult: number; rate: number }>();
  for (const mult of [0.6, 0.75, 0.9, 1, 1.2]) {
    const packs = clone(data.packs);
    for (const n of NICHES) packs.niches[n]!.startCapital = Math.round(data.packs.niches[n]!.startCapital * mult);
    const res = runMany(side(12), SEED + 20_000 + Math.round(mult * 100), (seed) => ({ ...base(seed, owners), packs }));
    const row: (string | number)[] = [`×${mult}`];
    for (const n of NICHES) {
      const xs = res.flat().filter((o) => o.niche === n && o.strategy === 'newbie');
      const rate = xs.filter((o) => o.bankrupt).length / Math.max(1, xs.length);
      row.push(`${usd(packs.niches[n]!.startCapital)}: ${(100 * rate).toFixed(1)}%`);
      const best = found.get(n);
      if (!best || Math.abs(rate - 0.225) < Math.abs(best.rate - 0.225)) found.set(n, { mult, rate });
    }
    const hon = res.flat().filter((o) => o.strategy === 'honest');
    row.push(pct(hon.filter((o) => o.bankrupt).length, hon.length));
    rows.push(row);
  }
  table(['startCapital', ...NICHES.map((n) => `${n}: newbie bankrupt`), 'honest bankrupt'], rows);
  for (const [n, f] of found) print(`pick for ${n}: startCapital ${usd(data.packs.niches[n]!.startCapital * f.mult)} (×${f.mult}) → newbies bankrupt ${(100 * f.rate).toFixed(1)}% (target 15–30%)`);
  print();
}

// ───────────── Q4: pctOfSaved multiplier for cash wages ─────────────
print('## Q4. Cash wages: net worth minus honest twin, by pctOfSaved of off_books_payroll');
{
  const owners = mix([['cash_wages', Math.round(OWNERS / 2)], ['honest', OWNERS - Math.round(OWNERS / 2)]]);
  const pts: { k: number; ev: number }[] = [];
  const rows: (string | number)[][] = [];
  for (const k of [0, 0.5, 1, 1.5, 2, 3]) {
    const packs = clone(data.packs);
    const v = packs.common.violations.find((x) => x.id === 'off_books_payroll');
    if (v) v.fine.pctOfSaved = k;
    const res = byStrategy(runMany(side(8), SEED + 30_000 + Math.round(k * 10), (seed) => ({ ...base(seed, owners), packs })));
    const cw = res.get('cash_wages') ?? [], h = res.get('honest') ?? [];
    const ev = mean(cw.map((o) => o.netWorth)) - mean(h.map((o) => o.netWorth));
    pts.push({ k, ev });
    rows.push([k, usd(mean(cw.map((o) => o.savings))), usd(mean(cw.map((o) => o.fines))), pct(cw.filter((o) => o.fines > 0).length, cw.length), usd(ev), pct(cw.filter((o) => o.bankrupt).length, cw.length)]);
  }
  table(['pctOfSaved', 'saved per season', 'fines per season', 'caught at least once', 'net worth vs honest', 'bankrupt'], rows);
  let zero: number | null = null;
  for (let i = 1; i < pts.length; i++) if (pts[i - 1].ev > 0 && pts[i].ev <= 0) zero = pts[i - 1].k + (pts[i].k - pts[i - 1].k) * (pts[i - 1].ev / (pts[i - 1].ev - pts[i].ev));
  print(zero === null ? `zero expected value: ${pts[0].ev <= 0 ? 'already negative at pctOfSaved 0 (perMonth part and detection alone make it a losing bet)' : 'not reached in the tested range'}` : `zero expected value at pctOfSaved ≈ ${zero.toFixed(2)}`);
  print();
}

// ───────────── Q5: does complaining pay; does ganging up on the leader pay ─────────────
print('## Q5. Complaints');
{
  const c = S.get('complainer') ?? [], h = S.get('honest') ?? [];
  table(['main run', 'mean net worth', 'prize rate', 'mean fines (false reports)'], [
    ['complainer', usd(mean(c.map((o) => o.netWorth))), pct(c.filter((o) => o.prizePlace).length, c.length), usd(mean(c.map((o) => o.fines)))],
    ['honest', usd(mean(h.map((o) => o.netWorth))), pct(h.filter((o) => o.prizePlace).length, h.length), usd(mean(h.map((o) => o.fines)))],
  ]);
  const owners = mix([['complainer', Math.round(OWNERS / 4)], ['honest', Math.round(OWNERS / 4)], ['premium', Math.round(OWNERS / 8)], ['cut_taxes', Math.round(OWNERS / 8)], ['social', OWNERS - Math.round(OWNERS / 4) * 2 - Math.round(OWNERS / 8) * 2]]);
  const rows: (string | number)[][] = [];
  for (const harass of [false, true]) {
    const runs = runMany(side(10), SEED + 40_000, (seed) => base(seed, owners, { brain: { harassLeader: harass } }));
    const all = runs.flat();
    const comp = all.filter((o) => o.strategy === 'complainer');
    const leaders = all.filter((o) => o.strategy !== 'complainer' && o.rank === 1);
    const others = all.filter((o) => o.strategy !== 'complainer');
    rows.push([harass ? 'harass the leader weekly' : 'report only when suspicious', usd(mean(comp.map((o) => o.netWorth))), usd(mean(comp.map((o) => o.fines))), usd(mean(leaders.map((o) => o.netWorth))), usd(mean(others.map((o) => o.netWorth))), pct(comp.filter((o) => o.prizePlace).length, comp.length)]);
  }
  table(['complainers', 'their net worth', 'their fines', 'niche leaders (rank 1) net worth', 'everyone else', 'complainer prize rate'], rows);
}

// ───────────── Q6: social vs loner ─────────────
print('## Q6. Deals: social owner vs a loner who refuses every deal (same mix of neighbours)');
{
  const rows: (string | number)[][] = [];
  const line = (label: string, R: Map<OwnerStrategy, OwnerResult[]>) => {
    const so = R.get('social') ?? [], lo = R.get('loner') ?? [], ho = R.get('honest') ?? [];
    const a = mean(so.map((o) => o.netWorth)), b = mean(lo.map((o) => o.netWorth)), c = mean(ho.map((o) => o.netWorth));
    rows.push([label, usd(a), usd(c), usd(b), b ? `${(((a - b) / Math.abs(b)) * 100).toFixed(1)}%` : '—', b ? `${(((c - b) / Math.abs(b)) * 100).toFixed(1)}%` : '—']);
  };
  const owners = mix([['social', Math.round(OWNERS / 4)], ['loner', Math.round(OWNERS / 4)], ['honest', Math.round(OWNERS / 4)], ['premium', Math.round(OWNERS / 8)], ['unreliable', OWNERS - Math.round(OWNERS / 4) * 3 - Math.round(OWNERS / 8)]]);
  const variants: [string, SeasonSetup['tuning']][] = [
    ['current rules', {}],
    ['block fund threshold 0.6 → 0.4', { blockThreshold: 0.4 }],
    ['block fund fee $300 → $150', { blockFee: 150 }],
    ['cross promo demand 1.06 → 1.12', { crossDemandMult: 1.12 }],
    ['joint purchase 0.94 → 0.90 + cross promo 1.10', { jointCogsMult: 0.9, crossDemandMult: 1.1 }],
    ['cross promo price 0.98 → 1.00', { crossPriceMult: 1 }],
    ['joint 0.90, cross 1.10 at price 1.00, fund fee $150', { jointCogsMult: 0.9, crossDemandMult: 1.1, crossPriceMult: 1, blockFee: 150 }],
  ];
  for (const [label, tuning] of variants) line(label, byStrategy(runMany(side(8), SEED + 45_000, (seed) => base(seed, owners, { tuning }))));
  table(['rules', 'social net worth', 'honest (accepts offers)', 'loner (refuses all)', 'social ahead of loner', 'honest ahead of loner'], rows);
}

// ───────────── Q7: room size curve by place tier ─────────────
print('## Q7. Monthly profit by room size (months 2–4, honest orders, 9 standard competitors)');
{
  for (const n of NICHES) {
    const pack = data.packs.niches[n]!;
    const rows: (string | number)[][] = [];
    const sizes: number[] = [];
    for (let s = pack.sizing.min; s <= pack.sizing.max; s += Math.max(1, Math.round((pack.sizing.max - pack.sizing.min) / 10))) sizes.push(s);
    const tiers: Place['tier'][] = ['prime', 'mid', 'cheap'];
    const best: string[] = [];
    const curves = tiers.map((tier) => {
      const place = data.places.filter((p) => p.tier === tier).sort((a, b) => b.sqft - a.sqft)[0];
      const fit = Math.min(pack.sizing.max, Math.floor((place.sqft * RULES.USABLE_FLOOR_SHARE) / pack.sizing.sqftPerUnit));
      const curve = sizes.map((size) => (size > fit ? null : sizeProfit(n, place, size)));
      const valid = curve.map((v, i) => ({ v, s: sizes[i] })).filter((x) => x.v !== null) as { v: number; s: number }[];
      const opt = valid.reduce((a, x) => (x.v > a.v ? x : a), valid[0]);
      best.push(`${tier} (${place.sqft} sq ft, fits ${fit}): best ${opt.s} ${pack.sizing.unitName}s, ${usd(opt.v)}/mo, ${opt.s > valid[0].s && opt.s < valid[valid.length - 1].s ? 'inner optimum' : 'edge'}`);
      return curve;
    });
    sizes.forEach((s, i) => rows.push([s, ...curves.map((c) => (c[i] === null ? '—' : usd(c[i]!)))]));
    print(`### ${n}`);
    table([pack.sizing.unitName + 's', ...tiers], rows);
    for (const b of best) print(`- ${b}`);
    print();
  }
}

function sizeProfit(niche: NicheId, place: Place, size: number): number {
  const pack = data.packs.niches[niche]!;
  const ctx = { packs: data.packs, places: data.places };
  let w = api.createWorld({ id: 'size', name: 'size', city: 'nyc', seasonMonths: 12, dayMs: 2000, paused: false, maxOwners: 100, aiBusinessesTarget: 0, entryFee: 0, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05, nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 1 });
  const mids = data.places.filter((p) => p.tier !== 'prime' && p.id !== place.id).slice(0, 9);
  const plan = [{ place, size }, ...mids.map((p) => ({ place: p, size: Math.min(pack.sizing.default, Math.floor((p.sqft * RULES.USABLE_FLOOR_SHARE) / pack.sizing.sqftPerUnit)) }))];
  const ids: string[] = [];
  plan.forEach((x, k) => {
    const r = api.join(w, { name: `Size ${k}`, kind: 'owner' }); w = r.world; ids.push(r.playerId);
    const rec = api.recommendOpening(niche, x.place.id, w, ctx).find((q) => q.kitId === 'standard');
    w = api.applyAction(w, ctx, r.playerId, { type: 'open_business', niche, placeId: x.place.id, name: `Size ${k}`, kitId: 'standard', size: x.size }).world;
    if (rec) w = api.applyAction(w, ctx, r.playerId, { type: 'set_orders', orders: { staff: rec.orders.staff } }).world;
    w = api.applyAction(w, ctx, r.playerId, { type: 'launch' }).world;
  });
  for (let d = 1; d <= 120; d++) {
    w = { ...w, weather: Array.from({ length: 8 }, (_, i) => ({ day: d + i, tempF: 60, condition: 'clear' as const, footTrafficMult: 1, label: 'clear' })) };
    if (d % 7 === 0) for (const pid of ids) { const b = w.businesses.find((x) => x.managerPlayerId === pid)!; w = api.applyAction(w, ctx, pid, { type: 'set_orders', orders: { staff: api.managerOrders(b, w, ctx).staff } }).world; }
    w = api.tickDay(w, ctx);
  }
  const b = w.businesses.find((x) => x.managerPlayerId === ids[0])!;
  // setup purchases are a one-off; the monthly profit is the running result, plus the furniture's monthly depreciation
  const perUnit = pack.setup.filter((s) => s.scalesWithSize).reduce((s, x) => s + x.cost / (x.lifespanMonths ?? 60), 0);
  return mean(b.history.slice(1, 4).map((h) => h.profit)) - perUnit * size;
}

// ───────────── Q8: weather and events vs places ─────────────
print('## Q8. Do weather and events decide the places? Same seasons with flat weather and no events');
{
  const k = Math.min(SEASONS, side(40));
  let corr = 0, pairs = 0, sameWinners = 0, prizeSlots = 0, rankMove = 0, moves = 0;
  for (let i = 0; i < k; i++) {
    const real = main[i];
    const flat = runSeason(api, base(SEED + i, mainOwners, { weather: 'flat', events: false })).owners;
    for (const n of NICHES) {
      const a = real.filter((o) => o.niche === n), b = flat.filter((o) => o.niche === n);
      const ra = new Map(a.map((o) => [o.playerId, o.rank])), rb = new Map(b.map((o) => [o.playerId, o.rank]));
      const ids = [...ra.keys()];
      const m = ids.length;
      const d2 = ids.reduce((s, id) => s + (ra.get(id)! - rb.get(id)!) ** 2, 0);
      corr += 1 - (6 * d2) / (m * (m * m - 1)); pairs++;
      for (const id of ids) { rankMove += Math.abs(ra.get(id)! - rb.get(id)!); moves++; }
      const wa = new Set(a.filter((o) => o.prizePlace).map((o) => o.playerId)), wb = new Set(b.filter((o) => o.prizePlace).map((o) => o.playerId));
      for (const id of wa) { prizeSlots++; if (wb.has(id)) sameWinners++; }
    }
  }
  table(['seasons compared', 'rank correlation (Spearman)', 'prize winners unchanged', 'mean rank move'], [[k, (corr / pairs).toFixed(3), pct(sameWinners, prizeSlots), (rankMove / moves).toFixed(2)]]);
}

// ───────────── Q9: manager-run shop vs daily player ─────────────
print('## Q9. Owner who logs in once a game month with a manager vs one who plays every day');
{
  const m = S.get('manager') ?? [], h = S.get('honest') ?? [];
  const rows: (string | number)[][] = [['main run (pack manager salary)', usd(mean(m.map((o) => o.netWorth))), pct(m.filter((o) => o.bankrupt).length, m.length), usd(mean(h.map((o) => o.netWorth))), pct(h.filter((o) => o.bankrupt).length, h.length)]];
  const owners = mix([['manager', Math.round(OWNERS / 4)], ['honest', Math.round(OWNERS / 4)], ['social', Math.round(OWNERS / 4)], ['premium', OWNERS - 3 * Math.round(OWNERS / 4)]]);
  for (const mult of [0.5, 0.25]) {
    const packs = clone(data.packs);
    for (const n of NICHES) packs.niches[n]!.manager.monthlySalary = Math.round(data.packs.niches[n]!.manager.monthlySalary * mult);
    const res = byStrategy(runMany(side(8), SEED + 50_000 + mult * 100, (seed) => ({ ...base(seed, owners), packs })));
    const mm = res.get('manager') ?? [], hh = res.get('honest') ?? [];
    rows.push([`manager salary ×${mult} (${NICHES.map((n) => usd(packs.niches[n]!.manager.monthlySalary)).join(' / ')})`, usd(mean(mm.map((o) => o.netWorth))), pct(mm.filter((o) => o.bankrupt).length, mm.length), usd(mean(hh.map((o) => o.netWorth))), pct(hh.filter((o) => o.bankrupt).length, hh.length)]);
  }
  table(['setup', 'manager-run net worth', 'manager-run bankrupt', 'daily player net worth', 'daily player bankrupt'], rows);
}

print(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (argv.includes('--save')) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(new URL('../research/reports/07-balance-output.md', import.meta.url), out.join('\n') + '\n');
}
