// Сравнение пакетов кафе на сценарии теста engine/test/economy/real-packs.test.ts (задание A2).
//   npx tsx packs/next/compare.ts
// 1) ужатый packs/next/cafe.json даёт ту же игру, что полный packs/cafe.next.json (история бизнесов совпадает до цента);
// 2) по месяцам: заказов в день, «до налогов владельца» с наёмным управляющим и без, деньги через 12 месяцев —
//    для пакета v1 (packs/cafe.json) и нового; расходы нового пакета против старого по статьям.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CommonPack, Pack, WorldState } from '../../shared/src/types';
import { applyAction, createWorld, tickDay, type EngineCtx } from '../../engine/src/index';
import { config, owner, place } from '../../engine/test/fixtures/world';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as T;
const readFull = (): Pack => (existsSync(join(ROOT, 'packs/cafe.next.json'))
  ? read<Pack>('packs/cafe.next.json')
  : JSON.parse(execFileSync('git', ['show', 'origin/claude/jolly-volta-dv0cll:packs/cafe.next.json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 })) as Pack);

const PACKS: Record<string, { cafe: Pack; common: CommonPack }> = {
  v1: { cafe: read('packs/cafe.json'), common: read('packs/_common.json') },
  full: { cafe: readFull(), common: read('packs/next/_common.json') },
  next: { cafe: read('packs/next/cafe.json'), common: read('packs/next/_common.json') },
  'next+old common': { cafe: read('packs/next/cafe.json'), common: read('packs/_common.json') },
};

function city(set: { cafe: Pack; common: CommonPack }, n: number, opts: { manager?: boolean; size?: number } = {}) {
  const ctx: EngineCtx = { packs: { common: set.common, niches: { cafe: set.cafe } }, places: Array.from({ length: n }, (_, i) => place(i + 1)) };
  let w: WorldState = { ...createWorld(config()), players: Array.from({ length: n }, (_, i) => owner(i + 1)) };
  const act = (pid: string, a: Parameters<typeof applyAction>[3]) => { const r = applyAction(w, ctx, pid, a); if (r.error) throw new Error(`${pid} ${a.type}: ${r.error}`); w = r.world; };
  const kit = set.cafe.kits.find((k) => k.id === 'standard')!;
  for (let i = 1; i <= n; i++) {
    act(`pl${i}`, { type: 'open_business', niche: 'cafe', placeId: `p${i}`, name: `Cafe ${i}`, kitId: kit.id, size: opts.size ?? kit.size });
    if (opts.manager) act(`pl${i}`, { type: 'set_orders', orders: { autopilot: 'manager' } });
  }
  const ready = Math.max(0, ...w.businesses[0].permits.map((p) => p.readyDay));
  while (w.day < ready) w = tickDay(w, ctx);
  for (let i = 1; i <= n; i++) act(`pl${i}`, { type: 'launch' });
  return (until: number) => { while (w.day < until) w = tickDay(w, ctx); return w; };
}

const beforeOwnerTaxes = (lines: { kind: string; amount: number }[]) => lines.filter((l) => !['setup', 'tax', 'saving', 'fine'].includes(l.kind)).reduce((a, l) => a + l.amount, 0);
const usd = (x: number) => `$${Math.round(x).toLocaleString('en-US')}`;
const range = (xs: number[]) => (xs.length ? `${usd(Math.min(...xs))}–${usd(Math.max(...xs))}` : '—');

// 1. ужатый против полного
const a = city(PACKS.full, 6, { manager: true })(360).businesses.map((b) => b.history);
const b = city(PACKS.next, 6, { manager: true })(360).businesses.map((b) => b.history);
const same = JSON.stringify(a) === JSON.stringify(b);
console.log(`ужатый пакет = полный (6 кафе, 360 дней, с управляющим): ${same ? 'да, история совпадает' : 'НЕТ'}`);

// 2. по месяцам
console.log('\n| пакет | заказов в день | до налогов владельца, с управляющим (мес. 2–6) | без управляющего (мес. 2–6) | деньги через 12 мес., с управляющим |');
console.log('|---|---|---|---|---|');
const lineSums: Record<string, Record<string, number>> = {};
for (const name of ['v1', 'next', 'next+old common']) {
  const set = PACKS[name];
  const wm = city(set, 6, { manager: true })(360);
  const wo = city(set, 6)(180);
  const hm = wm.businesses[0].history;
  const served = hm.slice(1, 6).map((m) => m.servedUnits / 30);
  const bm = hm.slice(1, 6).map((m) => beforeOwnerTaxes(m.lines));
  const bo = wo.businesses[0].history.slice(1).map((m) => beforeOwnerTaxes(m.lines));
  console.log(`| ${name} | ${Math.round(Math.min(...served))}–${Math.round(Math.max(...served))} | ${range(bm)} | ${range(bo)} | ${usd(wm.businesses[0].cash)} |`);
  const m3 = hm[2];
  lineSums[name] = {};
  for (const l of m3.lines) lineSums[name][`${l.kind}: ${l.label}`] = (lineSums[name][`${l.kind}: ${l.label}`] ?? 0) + l.amount;
}
// 3. статьи третьего месяца: что изменилось
console.log('\nТретий месяц, с управляющим: статьи, где новый пакет отличается от v1 больше чем на $25');
const keys = new Set([...Object.keys(lineSums.v1), ...Object.keys(lineSums.next)]);
const diff = [...keys].map((k) => [k, (lineSums.next[k] ?? 0) - (lineSums.v1[k] ?? 0)] as const).filter(([, d]) => Math.abs(d) > 25).sort((x, y) => x[1] - y[1]);
for (const [k, d] of diff) console.log(`  ${d > 0 ? '+' : '−'}${usd(Math.abs(d))}  ${k}`);
const tot = (s: Record<string, number>) => Object.entries(s).filter(([k]) => !/^(setup|tax|saving|fine):/.test(k)).reduce((x, [, v]) => x + v, 0);
console.log(`  итого до налогов владельца: v1 ${usd(tot(lineSums.v1))}, новый ${usd(tot(lineSums.next))}`);
process.exit(same ? 0 : 1);
