// Dry run of the season schedule from build/EVENTS.md, section 2, on the real file packs/next/cafe.events.json.
// It is a reference for B09 and a check of the rules in the file, not game code: nothing imports it.
//
//   npx tsx packs/next/plan-preview.ts            # seeds 1..5, one line per season
//   npx tsx packs/next/plan-preview.ts 42 list    # one seed, every event of the season
//
// Covers the calendar launch only (182 of 197 events). The city of the dry run: three streets, two shops on each,
// all open since day 1. Events that follow from a player's decision need a played game and are not planned here.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash32 } from '../../ai/src/rng';
import { weatherOn } from '../../ai/src/weather';

const HERE = dirname(fileURLToPath(import.meta.url));
const file = JSON.parse(readFileSync(join(HERE, 'cafe.events.json'), 'utf8'));
const R = file.rules;
interface Ev { id: string; scale: string; months: number[]; durationDays: number; noticeDays: number; launch: string; weather?: string[] }
const catalog: Ev[] = file.events.filter((e: Ev) => e.launch === 'calendar');

type Group = 'wide' | 'city' | 'block' | 'point';
const groupOf = (scale: string): Group => (scale === 'world' || scale === 'country' ? 'wide' : (scale as Group));
const localOf = (g: Group): 'wide' | 'city' | 'local' => (g === 'block' || g === 'point' ? 'local' : g);
const monthOfDay = (day: number): number => (Math.floor((day - 1) / 30) % 12) + 1;
interface Planned { id: string; group: Group; announcedDay: number; startDay: number; endDay: number; long: boolean; block?: string; businessId?: string }

export function planSeason(seed: number, season = 0): { planned: Planned[]; emptySlots: Record<Group, number>; slots: Record<Group, number> } {
  const blocks = ['Bedford Ave', 'Court St', 'Smith St'];
  const shops = blocks.flatMap((block) => [1, 2].map((n) => ({ id: `shop-${block[0]}${n}`, block })));
  const planned: Planned[] = [];
  const used = new Set<string>();
  const emptySlots: Record<Group, number> = { wide: 0, city: 0, block: 0, point: 0 };
  const slots: Record<Group, number> = { wide: 0, city: 0, block: 0, point: 0 };
  let lastLongWindow = -99;

  const touches = (p: Planned, shop: { id: string; block: string }): boolean =>
    p.group === 'wide' || p.group === 'city' || (p.group === 'block' && p.block === shop.block) || (p.group === 'point' && p.businessId === shop.id);
  const overlaps = (p: Planned, s: number, e: number): boolean => p.startDay <= e && p.endDay >= s;

  /** May this event run from s to e for these shops without breaking the limits of section 2.2? */
  const fits = (g: Group, long: boolean, s: number, e: number, who: { id: string; block: string }[]): boolean => who.every((shop) => {
    const mine = planned.filter((p) => touches(p, shop) && overlaps(p, s, e));
    if (long) return mine.filter((p) => p.long).length < R.maxLongActive;
    return mine.filter((p) => !p.long && localOf(p.group) === localOf(g)).length < R.maxShortActive[localOf(g)];
  });

  const pick = (g: Group, month: number, who: { id: string; block: string }[], keyOf: (e: Ev) => number, extra: Partial<Planned>): void => {
    slots[g]++;
    const from = (month - 1) * 30 + 16, to = month * 30 + 15;      // the window: day 16 of this month to day 15 of the next
    const list = catalog.filter((e) => groupOf(e.scale) === g && !used.has(e.id + (extra.businessId ?? ''))).sort((a, b) => keyOf(a) - keyOf(b) || a.id.localeCompare(b.id));
    for (const e of list) {
      const long = e.durationDays >= R.longFromDays;
      if (long && (g === 'wide' || g === 'city') && month - lastLongWindow < R.newLongEveryWindows) continue;
      let start = from + (keyOf(e) % 30);
      if (e.weather) {
        start = -1;
        for (let d = from; d <= to; d++) if (e.weather.includes(weatherOn(seed, d).condition)) { start = d; break; }
        if (start < 0) continue;                                   // no such weather in the forecast: the event does not happen
      }
      if (start > R.seasonDays || !e.months.includes(monthOfDay(start))) continue;
      const end = Math.min(R.seasonDays, start + e.durationDays - 1);
      if (!fits(g, long, start, end, who)) continue;
      planned.push({ id: e.id, group: g, announcedDay: start - e.noticeDays, startDay: start, endDay: end, long, ...extra });
      used.add(e.id + (extra.businessId ?? ''));
      if (long && (g === 'wide' || g === 'city')) lastLongWindow = month;
      return;
    }
    emptySlots[g]++;
  };

  for (let month = 1; month <= 12; month++) {
    pick('wide', month, shops, (e) => hash32(`${seed}|${e.id}|${season}`), {});
    pick('city', month, shops, (e) => hash32(`${seed}|${e.id}|${season}`), {});
    const block = blocks[hash32(`${seed}|block|${month}`) % blocks.length];
    pick('block', month, shops.filter((s) => s.block === block), (e) => hash32(`${seed}|${e.id}|${season}`), { block });
    for (const shop of shops) {
      if ((hash32(`${seed}|${shop.id}`) + month) % R.pointEveryWindows !== 0) continue;
      if ((month - 1) * 30 + 1 < R.minDaysOpenForPoint) continue;
      pick('point', month, [shop], (e) => hash32(`${seed}|${e.id}|${shop.id}`), { businessId: shop.id });
    }
  }
  return { planned: planned.sort((a, b) => a.startDay - b.startDay), emptySlots, slots };
}

const argSeed = Number(process.argv[2]);
const seeds = Number.isFinite(argSeed) && process.argv[2] !== undefined ? [argSeed] : [1, 2, 3, 4, 5];
let bad = 0;
for (const seed of seeds) {
  const { planned, emptySlots, slots } = planSeason(seed);
  const again = planSeason(seed).planned;
  const same = JSON.stringify(again) === JSON.stringify(planned);
  const notice = planned.every((p) => p.startDay - p.announcedDay >= 3 && p.announcedDay >= 1);
  const months = planned.every((p) => file.events.find((e: Ev) => e.id === p.id).months.includes(monthOfDay(p.startDay)));
  const shopB1 = planned.filter((p) => p.group === 'wide' || p.group === 'city' || (p.group === 'block' && p.block === 'Bedford Ave') || p.businessId === 'shop-B1');
  let peak = 0;
  for (let d = 1; d <= 360; d++) peak = Math.max(peak, shopB1.filter((p) => p.startDay <= d && p.endDay >= d).length);
  const by = (g: Group): string => `${planned.filter((p) => p.group === g).length}/${slots[g]}`;
  console.log(`seed ${seed}: ${planned.length} events in the city (wide ${by('wide')}, city ${by('city')}, block ${by('block')}, point ${by('point')} of the slots); ` +
    `one shop sees ${shopB1.length}, at most ${peak} at once; empty slots ${JSON.stringify(emptySlots)}; ` +
    `same seed twice: ${same ? 'same' : 'DIFFERENT'}; notice ok: ${notice}; months ok: ${months}`);
  if (!same || !notice || !months) bad++;
  if (process.argv[3] === 'list') for (const p of planned) console.log(`  day ${String(p.startDay).padStart(3)}-${String(p.endDay).padEnd(3)} announced ${String(p.announcedDay).padStart(3)}  ${p.group.padEnd(5)} ${p.long ? 'long ' : 'short'} ${p.id}${p.block ? ` @ ${p.block}` : ''}${p.businessId ? ` @ ${p.businessId}` : ''}`);
}
const a = planSeason(1).planned.map((p) => p.id).join(), b = planSeason(2).planned.map((p) => p.id).join();
console.log(`seeds 1 and 2 give ${a === b ? 'THE SAME' : 'different'} seasons`);
process.exit(bad > 0 || a === b ? 1 : 0);
