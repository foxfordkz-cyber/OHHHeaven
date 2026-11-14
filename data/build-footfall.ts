// Turns the open-data snapshots in data/open/ into numbers for every place in data/places.json:
// passers-by per day, what stands nearby, the real coffee shops around, what the space used to be,
// and the rent that goes with that much foot traffic.
//
//   bash data/fetch-open-data.sh     (network: refreshes data/open/*.raw.json)
//   npx tsx data/build-footfall.ts   (offline: rewrites data/places.json and data/open/fit.json)
//
// What is measured and what is modelled:
//   measured  — DOT sidewalk counts at fixed points, MTA entries per station, DOHMH establishments, city facilities;
//   modelled  — passers-by at each door (no public count exists for every block), rent, the former use of a space.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnchorKind, FormerUse, Pack, Place, PlaceAnchor } from '../shared/src/types';
import { ANCHOR_REACH_M, askingPriceFor, distanceM, footfallParams, overlap } from '../shared/src/place';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = <T>(p: string): T => JSON.parse(readFileSync(join(HERE, p), 'utf8')) as T;

// ───────────── assumptions (every one is printed into data/open/fit.json) ─────────────
const A = {
  /** DOT counts 5 weekday hours (7–9 and 16–19). A 12-hour trading day at the same average hourly rate = × 12/5. */
  dayFromCountedHours: 12 / 5,
  /** DOT counts both sidewalks of the block, and so does the number stored for each place. */
  oneSide: 1,
  /** How fast the pull of a subway station fades with walking distance, metres. */
  subwayDecayM: 250,
  /** Food and drink places within this distance stand in for local street life (residents, nightlife). */
  foodRadiusM: 150,
  /** A side street next to a counted corridor carries this share of its people. */
  sideStreet: 0.6,
  /** A corner sees two streets. */
  corner: 1.25,
  /** An establishment counts as trading if it was inspected on or after this date. */
  activeSince: '2024-01-01',
  /** Real coffee shops closer than this share the passers-by (must match pack.extra.footfall.radiusM). */
  rivalRadiusM: 250,
};

// ───────────── raw data ─────────────
interface DotRow { the_geom: { coordinates: [number, number] }; from_stree: string; to_street: string; iex: string; [k: string]: unknown }
interface MtaRow { station_complex_id: string; station_complex: string; d: string; rides: string; lat: string; lng: string }
interface FoodRow { camis: string; dba?: string; building?: string; street?: string; cuisine_description?: string; latitude?: string; longitude?: string; last_inspection?: string }
interface FacRow { facname: string; latitude: string; longitude: string; facsubgrp: string; factype: string }

const num = (v: unknown): number | null => {
  if (typeof v !== 'string') return null;
  const n = Number(v.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};
const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const title = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim().replace(/(^|[\s\-/(.&'])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());

const stations = (() => {
  const by = new Map<string, { name: string; lat: number; lng: number; wd: number[]; sat: number[]; sun: number[] }>();
  for (const r of read<MtaRow[]>('open/mta-ridership.raw.json')) {
    const s = by.get(r.station_complex_id) ?? { name: r.station_complex, lat: Number(r.lat), lng: Number(r.lng), wd: [], sat: [], sun: [] };
    const dow = new Date(r.d).getUTCDay();
    (dow === 6 ? s.sat : dow === 0 ? s.sun : s.wd).push(Number(r.rides));
    by.set(r.station_complex_id, s);
  }
  return [...by.values()].map((s) => ({ name: s.name, lat: s.lat, lng: s.lng, weekday: Math.round(avg(s.wd)), saturday: Math.round(avg(s.sat)), sunday: Math.round(avg(s.sun)) }));
})();

const food = read<FoodRow[]>('open/dohmh-restaurants.raw.json')
  .filter((r) => r.latitude && r.longitude && Number(r.latitude) !== 0 && (r.last_inspection ?? '') >= A.activeSince)
  .map((r) => ({ name: title(r.dba ?? 'Unnamed'), cuisine: r.cuisine_description ?? '', lat: Number(r.latitude), lng: Number(r.longitude), address: title(`${r.building ?? ''} ${r.street ?? ''}`) }));
const cafes = food.filter((f) => /^(Coffee\/Tea|Donuts)$/i.test(f.cuisine));

const FAC_KIND: Record<string, AnchorKind> = {
  'COLLEGES OR UNIVERSITIES': 'college', 'PUBLIC K-12 SCHOOLS': 'school', 'NON-PUBLIC K-12 SCHOOLS': 'school', PARKS: 'park',
  'HOSPITALS AND CLINICS': 'hospital', 'PUBLIC LIBRARIES': 'library', MUSEUMS: 'museum', 'STREETSCAPES, PLAZAS, AND MALLS': 'plaza',
};
const facilities = read<FacRow[]>('open/facilities.raw.json')
  // a "hospital" row that is a two-person clinic does not move a street: keep hospitals and diagnostic centres only
  .filter((r) => r.facsubgrp !== 'HOSPITALS AND CLINICS' || /HOSPITAL|DIAGNOSTIC|MEDICAL CENTER/i.test(`${r.factype} ${r.facname}`))
  .map((r) => ({ kind: FAC_KIND[r.facsubgrp], name: title(r.facname), lat: Number(r.latitude), lng: Number(r.longitude) }))
  .filter((r) => r.kind && Number.isFinite(r.lat));

// ───────────── the model ─────────────
type LL = { lat: number; lng: number };
const subwayScore = (p: LL): number => stations.reduce((a, s) => a + s.weekday * Math.exp(-distanceM(p, s) / A.subwayDecayM), 0);
const foodNear = (p: LL): number => food.reduce((a, f) => a + (distanceM(p, f) <= A.foodRadiusM ? 1 : 0), 0);

// calibration: DOT screenlines on streets (not bridges) inside the area the snapshots cover
const dot = read<DotRow[]>('open/dot-pedestrian-counts.raw.json')
  .map((r) => {
    const [lng, lat] = r.the_geom.coordinates;
    const seasons = ['may25', 'oct25'].map((s) => [num(r[`${s}_am`]), num(r[`${s}_pm`])]).filter((x): x is [number, number] => x[0] != null && x[1] != null);
    return { name: `${r.from_stree} (${r.to_street} – ${r.iex})`, lat, lng, weekday5h: Math.round(avg(seasons.map(([a, b]) => a + b))), seasons: seasons.length };
  })
  .filter((r) => r.seasons > 0 && !/bridge|greenway|path/i.test(r.name) && r.lat > 40.713 && r.lat < 40.739 && r.lng > -74.006 && r.lng < -73.97)
  .map((r) => ({ ...r, observed: Math.round(r.weekday5h * A.dayFromCountedHours * A.oneSide), subway: subwayScore(r), food: foodNear(r) }));

// least squares for observed ≈ k1·subway + k2·food, both ≥ 0
const fit = (() => {
  const s11 = dot.reduce((a, r) => a + r.subway * r.subway, 0), s12 = dot.reduce((a, r) => a + r.subway * r.food, 0), s22 = dot.reduce((a, r) => a + r.food * r.food, 0);
  const b1 = dot.reduce((a, r) => a + r.subway * r.observed, 0), b2 = dot.reduce((a, r) => a + r.food * r.observed, 0);
  const det = s11 * s22 - s12 * s12;
  let k1 = det !== 0 ? (b1 * s22 - b2 * s12) / det : 0, k2 = det !== 0 ? (b2 * s11 - b1 * s12) / det : 0;
  if (k1 < 0) { k1 = 0; k2 = b2 / s22; }
  if (k2 < 0) { k2 = 0; k1 = b1 / s11; }
  return { k1, k2 };
})();
const model = (p: LL): number => fit.k1 * subwayScore(p) + fit.k2 * foodNear(p);

// ───────────── places ─────────────
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const isCorridor = (block: string): boolean => /^(\d+(st|nd|rd|th) Ave|Ave [A-D]|St Marks Pl|E 14th St|E Houston)/.test(block);

const places = read<Place[]>('places.json');
const cafePack = JSON.parse(readFileSync(join(HERE, '../packs/cafe.json'), 'utf8')) as Pack;
const params = footfallParams(cafePack);
if (params && params.radiusM !== A.rivalRadiusM) throw new Error(`pack.extra.footfall.radiusM (${params.radiusM}) must equal rivalRadiusM (${A.rivalRadiusM})`);

const out: Place[] = places.map((p0) => {
  const { pedestriansPerDay: _a, corner: _b, formerUse: _c, forSale: _d, anchors: _e, rivals: _f, footfallNote: _g, ...p } = p0;
  const corner = /corner/i.test(p.address);
  const corridor = isCorridor(p.block);
  const ped = Math.round((model(p) * (corridor ? 1 : A.sideStreet) * (corner ? A.corner : 1)) / 10) * 10;

  const anchors: PlaceAnchor[] = [];
  const nearestStation = stations.map((s) => ({ s, d: distanceM(p, s) })).sort((a, b) => a.d - b.d)[0];
  if (nearestStation && nearestStation.d <= 700) anchors.push({ kind: 'subway', name: nearestStation.s.name, distM: Math.round(nearestStation.d), ridersPerDay: nearestStation.s.weekday });
  for (const kind of ['college', 'school', 'park', 'hospital', 'library', 'museum', 'plaza'] as AnchorKind[]) {
    const near = facilities.filter((f) => f.kind === kind).map((f) => ({ f, d: distanceM(p, f) })).sort((a, b) => a.d - b.d)[0];
    if (near && near.d <= ANCHOR_REACH_M[kind]) anchors.push({ kind, name: near.f.name, distM: Math.round(near.d) });
  }

  const around = cafes.map((c) => ({ c, d: distanceM(p, c) })).filter((x) => x.d < A.rivalRadiusM).sort((a, b) => a.d - b.d);
  const rivals = [{
    niche: 'cafe' as const,
    within150m: around.filter((x) => x.d <= 150).length,
    weight: Math.round(around.reduce((a, x) => a + overlap(x.d, A.rivalRadiusM), 0) * 100) / 100,
    nearest: around.slice(0, 3).map((x) => ({ name: x.c.name, distM: Math.round(x.d) })),
  }];

  // rent follows foot traffic: the range comes from the research notes (small Brooklyn shops under $100,
  // prime Manhattan corridors $281–409 a sq ft a year); the East Village sits between. Estimate, not a listing.
  const sizeAdj = p.sqft > 3000 ? 0.8 : p.sqft > 1500 ? 0.9 : p.sqft < 700 ? 1.1 : 1;
  const bargain = 0.88 + 0.24 * hash01(`rent:${p.id}`);
  const rentPerSqftYear = Math.round(Math.min(240, Math.max(65, (58 + 0.011 * ped) * sizeAdj * bargain)));
  const tier = rentPerSqftYear >= 150 ? 'prime' : rentPerSqftYear >= 105 ? 'mid' : 'cheap';

  const next: Place = { ...p, tier, rentPerSqftYear, pedestriansPerDay: ped, anchors, rivals, footfallNote: 'modelled: MTA station entries within walking distance and DOHMH food places within 150 m, scaled to DOT sidewalk counts' };
  if (corner) next.corner = true;
  if (p.kind === 'storefront') {
    // No public record says what a vacant storefront used to be: the shares are a game assumption for a street
    // full of food businesses. Assigned by a fixed hash, so the map never changes by itself.
    const u = hash01(`use:${p.id}`);
    const use: FormerUse = u < 0.42 ? 'cafe' : u < 0.7 ? 'food' : u < 0.92 ? 'retail' : 'salon';
    next.formerUse = use;
  }
  return next;
});

// the 0–1 scale older code reads: 0.5 is the median door
const sorted = out.map((p) => p.pedestriansPerDay ?? 0).sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)];
for (const p of out) p.footTraffic = Math.round(Math.min(1, Math.max(0.05, (0.5 * (p.pedestriansPerDay ?? 0)) / median)) * 100) / 100;

// operating coffee shops for sale: former cafes picked by the same fixed hash, priced from the sales the address supports
if (params) {
  for (const p of out) {
    if (p.formerUse !== 'cafe' || !p.suitableFor.includes('cafe') || hash01(`sale:${p.id}`) >= 0.4) continue;
    const price = askingPriceFor(cafePack, p);
    if (price == null) continue;
    const maxSeats = Math.floor((p.sqft * 0.6) / cafePack.sizing.sqftPerUnit);
    p.forSale = { niche: 'cafe', askingPrice: price, size: Math.max(cafePack.sizing.min, Math.min(maxSeats, cafePack.sizing.default)), note: 'estimate: a share of a year of sales at this address, not a listing' };
  }
}

writeFileSync(join(HERE, 'places.json'), JSON.stringify(out, null, 1) + '\n');
const fitOut = {
  built: new Date().toISOString().slice(0, 10),
  fetched: readFileSync(join(HERE, 'open/FETCHED'), 'utf8').trim(),
  assumptions: A,
  formula: 'people walking the block per weekday (both sidewalks) = k1 × Σ(station weekday entries × exp(−distance / subwayDecayM)) + k2 × (food places within foodRadiusM); × sideStreet off the corridors; × corner at corners',
  k1: fit.k1, k2: fit.k2,
  calibration: dot.map((r) => ({ where: r.name, weekday5hBothSides: r.weekday5h, observedDay: r.observed, modelled: Math.round(model(r)), errorPct: Math.round((model(r) / r.observed - 1) * 100) })),
  stations: stations.sort((a, b) => b.weekday - a.weekday),
  counts: { foodPlacesActive: food.length, coffeeShopsActive: cafes.length, facilities: facilities.length, places: out.length },
  sources: [
    { name: 'NYC DOT Bi-Annual Pedestrian Counts', url: 'https://data.cityofnewyork.us/d/cqsj-cfgu', used: 'May and October 2025 weekday counts at the screenlines nearest to the East Village' },
    { name: 'MTA Subway Hourly Ridership: Beginning 2025', url: 'https://data.ny.gov/d/5wq4-mkjj', used: 'entries per station complex, 5–18 October 2026' },
    { name: 'DOHMH New York City Restaurant Inspection Results', url: 'https://data.cityofnewyork.us/d/43nn-pn8j', used: 'establishments inspected since 2024: street life and real coffee shops' },
    { name: 'NYC Facilities Database (City Planning)', url: 'https://data.cityofnewyork.us/d/ji82-xba5', used: 'colleges, schools, parks, hospitals, libraries, museums' },
  ],
};
writeFileSync(join(HERE, 'open/fit.json'), JSON.stringify(fitOut, null, 1) + '\n');

// ───────────── report ─────────────
const q = (xs: number[], f: number): number => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * f)];
const peds = out.filter((p) => p.kind === 'storefront').map((p) => p.pedestriansPerDay ?? 0);
console.log(`fit: k1=${fit.k1.toFixed(4)} per weighted subway entry, k2=${fit.k2.toFixed(1)} per food place`);
for (const c of fitOut.calibration) console.log(`  ${c.where.padEnd(52)} observed ${String(c.observedDay).padStart(6)}  modelled ${String(c.modelled).padStart(6)}  (${c.errorPct > 0 ? '+' : ''}${c.errorPct}%)`);
console.log(`passers-by per day at a door: min ${q(peds, 0)}, quartile ${q(peds, 0.25)}, median ${q(peds, 0.5)}, quartile ${q(peds, 0.75)}, max ${q(peds, 1)}`);
const rents = out.filter((p) => p.kind === 'storefront').map((p) => Math.round((p.sqft * p.rentPerSqftYear) / 12));
console.log(`rent a month: min ${q(rents, 0)}, median ${q(rents, 0.5)}, max ${q(rents, 1)}; per sq ft a year: ${q(out.map((p) => p.rentPerSqftYear), 0)}–${q(out.map((p) => p.rentPerSqftYear), 1)}`);
const uses: Record<string, number> = {};
for (const p of out) uses[p.forSale ? 'for sale' : p.formerUse ?? 'building'] = (uses[p.forSale ? 'for sale' : p.formerUse ?? 'building'] ?? 0) + 1;
console.log('spaces:', uses, '| tiers:', out.reduce<Record<string, number>>((m, p) => ({ ...m, [p.tier]: (m[p.tier] ?? 0) + 1 }), {}));
console.log(`real coffee shops within 150 m of a place: median ${q(out.map((p) => p.rivals?.[0]?.within150m ?? 0), 0.5)}, max ${q(out.map((p) => p.rivals?.[0]?.within150m ?? 0), 1)}`);
const sale = out.filter((p) => p.forSale).map((p) => p.forSale!.askingPrice);
if (sale.length) console.log(`for sale: ${sale.length} coffee shops, asking ${q(sale, 0)}–${q(sale, 1)}, median ${q(sale, 0.5)}`);
