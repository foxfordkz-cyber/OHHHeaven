// Demo: six cafes on one block for 60 game days, with both month closes.
// Run from the repository root: npx tsx engine/src/economy/demo.ts
// Uses the test fixtures until packs/cafe.json and data/places.json land in the main branch.
import type { Action, DayWeather, GameEvent, Place, WorldState } from '@ohh/shared';
import { dateOf } from '@ohh/shared';
import { applyAction, createWorld, tickDay, type EngineCtx } from '../index';
import { packs } from '../../test/fixtures/common';
import { config, owner, place } from '../../test/fixtures/world';

const placesList: Place[] = [
  place(1, { footTraffic: 0.8, rentPerSqftYear: 120, address: '31-01 Steinway St (corner)' }),
  place(2), place(3), place(4), place(5),
  place(6, { footTraffic: 0.3, rentPerSqftYear: 70, address: '42-15 Steinway St (side street)' }),
];
const ctx: EngineCtx = { packs, places: placesList };

const weather: DayWeather[] = Array.from({ length: 60 }, (_, i) => {
  const day = i + 1;
  if (day === 50) return { day, tempF: 28, condition: 'snow', footTrafficMult: 0.7, label: 'Snow' };
  if (day % 7 === 3) return { day, tempF: 41, condition: 'rain', footTrafficMult: 0.85, label: 'Rain' };
  return { day, tempF: 38, condition: 'clear', footTrafficMult: 1, label: 'Clear' };
});
const events: GameEvent[] = [{
  id: 'fair', kind: 'city', title: 'Street fair on Steinway St', text: 'The block is closed to cars for a weekend fair.',
  announcedDay: 40, startDay: 45, endDay: 47, effects: [{ target: 'footTraffic', mult: 1.2, niches: ['cafe'] }], origin: 'deck', block: 'main-st-100',
}];

let w: WorldState = { ...createWorld(config({ id: 'demo', name: 'Demo block' })), players: [1, 2, 3, 4, 5, 6].map(owner), weather, events };
const act = (playerId: string, a: Action): void => {
  const r = applyAction(w, ctx, playerId, a);
  if (r.error) throw new Error(`${playerId} ${a.type}: ${r.error}`);
  w = r.world;
};

const cafes: { who: string; name: string; kit: 'lean' | 'standard' | 'premium'; size: number }[] = [
  { who: 'pl1', name: 'Luna Cafe', kit: 'standard', size: 18 },
  { who: 'pl2', name: 'Brew & Co', kit: 'lean', size: 12 },
  { who: 'pl3', name: 'Cafe Blue', kit: 'premium', size: 24 },
  { who: 'pl4', name: 'Morning Owl', kit: 'standard', size: 18 },
  { who: 'pl5', name: 'Corner Cup', kit: 'standard', size: 18 },
  { who: 'pl6', name: 'Daily Grind', kit: 'standard', size: 18 },
];
cafes.forEach((c, i) => act(c.who, { type: 'open_business', niche: 'cafe', placeId: placesList[i].id, name: c.name, kitId: c.kit, size: c.size }));
act('pl2', { type: 'set_orders', orders: { price: 5.25 } });
act('pl3', { type: 'set_orders', orders: { price: 7.75, levers: { beans: 'specialty' } } });
act('pl4', { type: 'set_orders', orders: { staff: { barista: 2 } } });
act('pl5', { type: 'set_orders', orders: { shortcuts: ['cash_wages'], levers: { cleaning: 'minimal' } } });

const short = (s: string) => s.slice(0, 11).padEnd(11);
console.log('Six cafes on one block. Columns: served/lost customers that day; cash at the close of each month.');
console.log('Plan: Luna standard; Brew & Co cheap ($5.25, 12 seats); Cafe Blue premium ($7.75, specialty beans);');
console.log('Morning Owl only 2 baristas; Corner Cup pays cash wages and skimps on cleaning; Daily Grind opens on day 5, before its permits.\n');
console.log('day  date          weather | ' + cafes.map((c) => short(c.name)).join(' '));

while (w.day < 60) {
  if (w.day === 5) act('pl6', { type: 'launch' });
  if (w.day === 22) for (const c of cafes.slice(0, 5)) act(c.who, { type: 'launch' });
  if (w.day === 35) act('pl1', { type: 'spend', kind: 'marketing', amount: 2000 });
  w = tickDay(w, ctx);
  const date = dateOf(w.day);
  const wx = weather.find((d) => d.day === w.day)!;
  const cells = w.businesses.map((b) => {
    const r = b.days.at(-1)!;
    if (b.status === 'setup') return short('setup');
    const lost = r.lost.size + r.lost.staff + r.lost.closure;
    return short(`${r.servedUnits}/${lost}`);
  });
  console.log(`${String(w.day).padStart(3)}  ${date.label.padEnd(13)} ${wx.condition.padEnd(7)} | ${cells.join(' ')}`);
  const luna = w.businesses[0].days.at(-1)!;
  if (w.day === 46 || w.day === 50) console.log(`      Luna notes: ${luna.notes.join('; ')}`);
  if (w.day % 30 === 0) printClose(w);
}

function printClose(x: WorldState): void {
  const month = dateOf(x.day).month;
  console.log(`\n=== Month ${month} closed (day ${x.day}) ===`);
  console.log('cafe         status    served   lost  revenue   profit    cash end  taxes owed  quality rep  rank');
  for (const b of x.businesses) {
    const m = b.history.at(-1)!;
    const lost = m.lost.size + m.lost.staff + m.lost.closure;
    const owed = b.liabilities.filter((l) => !l.paid).reduce((a, l) => a + l.amount, 0);
    console.log(`${short(b.name)}  ${b.status.padEnd(8)} ${String(m.servedUnits).padStart(6)} ${String(lost).padStart(6)} ${money(m.revenue).padStart(9)} ${money(m.profit).padStart(8)} ${money(m.cashEnd).padStart(11)} ${money(owed).padStart(11)}  ${m.quality.toFixed(2)}  ${m.reputation.toFixed(2)}  ${m.rankInNiche}`);
  }
  const luna = x.businesses[0].history.at(-1)!;
  console.log(`\nLuna Cafe, month ${month} — every dollar is a line:`);
  for (const l of luna.lines) console.log(`  ${l.kind.padEnd(11)} ${l.label.padEnd(46)} ${money(l.amount).padStart(10)}`);
  const sum = luna.lines.reduce((a, l) => a + l.amount, 0);
  console.log(`  ${'sum of lines'.padEnd(58)} ${money(sum).padStart(10)}   = cash ${money(luna.cashStart)} → ${money(luna.cashEnd)}`);
  const trails = x.businesses.flatMap((b) => b.trails.map((t) => `${b.name}: ${t.violationId} (${t.months} mo, saved ${money(t.saved)})`));
  if (trails.length) console.log(`\nViolation trails for the law module: ${trails.join('; ')}`);
  console.log('');
}

function money(v: number): string {
  const s = Math.round(Math.abs(v)).toLocaleString('en-US');
  return (v < 0 ? '-$' : '$') + s;
}
