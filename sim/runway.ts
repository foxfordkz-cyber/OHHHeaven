// Does the money last until the shop pays for itself? Every door a newcomer can afford, before anyone else opens.
//   npx tsx sim/runway.ts [--niche=cafe] [--capture=0.088] [--start=0.35] [--ramp=75] [--sens=2.7] [--all] [--city]
// --city: the doors as a newcomer sees them on day 1 of a season, with the 30 established shops already trading
// (the same city as `sim/calibrate.ts season`); without it, an empty city.
// For each affordable door: the recommended opening (engine analytics), the rent paid while waiting, the losses of
// the ramp, the lowest the bank account gets (bots/src/runway.ts) and whether a careful resident would sign.
// The flags override pack.extra.footfall for a what-if; nothing is written.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NicheId, Pack, PackSet, Place } from '../shared/src/types';
import { buildoutOf, distanceM, isTakeover, overlap } from '../shared/src/place';
import { defaultConfig, newWorld } from '../host/src/index';
import { defaultDeps } from '../host/src/deps';
import { createBotBrain } from '../bots/src/brain';
import { project, recommendOpening } from '../engine/src/analytics/opening';
import { createWorld } from '../engine/src/index';
import { lastsThroughRamp, runwayOf } from '../bots/src/runway';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const json = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), 'utf8')) as T;
const argv = process.argv.slice(2);
const opt = (k: string): number | undefined => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a ? Number(a.slice(k.length + 3)) : undefined; };
const niche = (argv.find((a) => a.startsWith('--niche='))?.slice(8) ?? 'cafe') as NicheId;
const packs: PackSet = { common: json('packs/_common.json'), niches: { cafe: json<Pack>('packs/cafe.json'), barbershop: json<Pack>('packs/barbershop.json') } };
const pack = packs.niches[niche]!;
const foot = (pack.extra as { footfall?: Record<string, number> }).footfall;
if (foot) {
  if (opt('capture') != null) foot.captureRate = opt('capture')!;
  if (opt('start') != null) foot.awarenessStart = opt('start')!;
  if (opt('ramp') != null) foot.rampDays = opt('ramp')!;
  if (opt('sens') != null) foot.priceSensitivity = opt('sens')!;
}
const places = json<Place[]>('data/places.json');
const ctx = { packs, places };
const usd = (x: number): string => (x < 0 ? '-$' : '$') + Math.round(Math.abs(x)).toLocaleString('en-US');
const pad = (s: string | number, n: number): string => String(s).padStart(n);
const seed = opt('seed') ?? 100;
const city = argv.includes('--city');
const w = city
  ? newWorld({ ...defaultConfig({ id: 'cal', name: 'Calibration', demo: true, seed }), aiBusinessesTarget: 30 }, ctx, defaultDeps({ bots: createBotBrain({ recommendOpening: (n, pl, ww, c) => recommendOpening(n, pl, ww, c) }) }))
  : createWorld(defaultConfig({ id: 'cal', name: 'Calibration', demo: true, seed }));
const radius = foot?.radiusM ?? 0;
const trading = w.businesses.filter((b) => b.niche === niche && b.status !== 'bankrupt').map((b) => places.find((p) => p.id === b.placeId)!);
const rivalsAt = (p: Place): number => trading.reduce((s, q) => s + (q.id === p.id ? 0 : overlap(distanceM(p, q), radius)), 0);

const rows = places.filter((p) => p.suitableFor.includes(niche) && !trading.some((q) => q.id === p.id)).map((p) => {
  const rec = recommendOpening(niche, p.id, w, ctx).find((r) => r.kitId === 'standard') ?? recommendOpening(niche, p.id, w, ctx)[0];
  const eng = project(pack, niche, p.id, rec.size, rec.items, rec.orders, rec.total, w, ctx).projected;
  return { p, rec, eng, r: runwayOf(ctx, niche, p, rec, rivalsAt(p)), rivals: rivalsAt(p), kind: isTakeover(pack, p) ? 'for sale' : buildoutOf(pack, p)?.classId ?? '-' };
}).filter((x) => x.rec.cashLeft >= 0 && x.r);

console.log(`${city ? `City of seed ${seed} with ${trading.length} established ${pack.name.toLowerCase()}s. ` : 'Empty city. '}${pack.name}: footfall captureRate ${foot?.captureRate}, awarenessStart ${foot?.awarenessStart}, rampDays ${foot?.rampDays}; start capital ${usd(pack.startCapital)}`);
console.log('door        space   rivals  people/day  cash left  wait days  wait rent  orders/day (engine)  mature month (engine)  ramp loss  lowest cash  break-even day  signs?');
for (const x of rows.sort((a, b) => a.r!.lowestCash - b.r!.lowestCash)) {
  const r = x.r!;
  if (!argv.includes('--all') && rows.length > 40 && r.lowestCash > 60_000) continue;
  console.log(`${x.p.id.padEnd(11)} ${x.kind.padEnd(9)} ${pad(x.rivals.toFixed(1), 5)} ${pad(x.p.pedestriansPerDay ?? 0, 10)} ${pad(usd(x.rec.cashLeft), 10)} ${pad(x.rec.daysToOpen, 10)} ${pad(usd(r.waitRent), 10)} ${pad(`${Math.round(r.matureOrdersDay)} (${Math.round(x.eng.servedUnits / 30)})`, 19)} ${pad(`${usd(r.matureProfitMonth)} (${usd(x.eng.profit)})`, 22)} ${pad(usd(r.rampLoss), 10)} ${pad(usd(r.lowestCash), 12)} ${pad(r.breakEvenDay ?? 'never', 15)}  ${lastsThroughRamp(r) ? 'yes' : 'no'}`);
}
const broke = rows.filter((x) => x.r!.lowestCash < 0).length;
const careful = rows.filter((x) => lastsThroughRamp(x.r)).length;
// the request to the lead: count the rent of the wait as part of the opening bill
const fair = rows.filter((x) => x.rec.cashLeft - x.r!.waitRent >= 0);
const fairBroke = fair.filter((x) => x.r!.lowestCash < 0).length;
console.log(`\nif the rent paid while waiting counted as part of the opening bill: affordable ${fair.length}, the account goes below zero at ${fairBroke} (${Math.round((100 * fairBroke) / Math.max(1, fair.length))}%)`);
console.log(`affordable doors ${rows.length}: the account goes below zero at ${broke} (${Math.round((100 * broke) / Math.max(1, rows.length))}%; target about 20% for a newcomer who opens anyway); a careful resident signs at ${careful}`);
