#!/usr/bin/env node
// Rebuilds data/places.json (Place[]) and data/real-businesses.json (map labels) for the East Village.
// Node 20+, no dependencies.
//
//   node data/fetch-places.mjs            NYC Open Data + MTA over the network (no API key needed)
//   node data/fetch-places.mjs --sample   same pipeline on saved responses in data/sample/
//   node data/fetch-places.mjs --manual   no network: hand-made list on real streets, note "unverified"
//   node data/fetch-places.mjs --check    validate both files, exit 1 on errors
//   add --out <dir> to write somewhere other than data/

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { toLatLng, toGrid, distanceM, insideDistrict, streetName, avenueName } from './lib/grid.mjs';
import { STATIONS, FOOT_DECAY_M, CORRIDOR_RENT, TIER_LIMITS, SOURCES } from './lib/config.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const NICHES = ['cafe', 'barbershop', 'bodega', 'guesthouse', 'rentals'];

// ───────────── shared rules ─────────────

/** FNV-1a hash → [0, 1). Deterministic stand-in for randomness. */
export function unit(seed) {
  let h = 0x811c9dc5;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h >>> 0) / 0x1_0000_0000;
}

export function tierFor(rent) {
  if (rent >= TIER_LIMITS.prime) return 'prime';
  if (rent >= TIER_LIMITS.mid) return 'mid';
  return 'cheap';
}

/** Raw station score at a point: Σ sqrt(rides / maxRides) × exp(−d / FOOT_DECAY_M). */
export function stationScore(p, stations = STATIONS) {
  const max = Math.max(...stations.map((s) => s.rides));
  return stations.reduce((sum, st) => sum + Math.sqrt(st.rides / max) * Math.exp(-distanceM(p, st) / FOOT_DECAY_M), 0);
}

/** footTraffic 0–1 for every place: 0.1 + 0.9 × score / maxScore. Mutates nothing. */
export function withFootTraffic(places, stations = STATIONS) {
  const scores = places.map((p) => stationScore(p, stations));
  const max = Math.max(...scores, 1e-9);
  return places.map((p, i) => ({ ...p, footTraffic: round2(0.1 + (0.9 * scores[i]) / max) }));
}

export function rentFor({ corridor, sqft, corner = false, kind = 'storefront', seed = '' }) {
  const base = CORRIDOR_RENT[corridor]?.rent ?? CORRIDOR_RENT['side · east'].rent;
  if (kind === 'building') return Math.round(base * (0.92 + 0.16 * unit(`${seed}:rent`)));
  const sizeFactor = Math.min(1.3, Math.max(0.8, (1000 / sqft) ** 0.15));
  return Math.round(base * sizeFactor * (corner ? 1.08 : 1));
}

export function suitableFor({ kind, sqft, corner = false, onAvenue = false }) {
  if (kind === 'building') return ['guesthouse', 'rentals'];
  const out = [];
  if (sqft >= 400) out.push('cafe');
  if (sqft >= 300 && sqft <= 1600) out.push('barbershop');
  if (sqft >= 650 && (corner || onAvenue)) out.push('bodega');
  return out;
}

// ───────────── manual list on the real street grid ─────────────

/** Street segments of the East Village with storefront slots. Counts keep 4–10 places per block. */
export const MANUAL_BLOCKS = [
  { type: 'avenue', ave: '1st Ave', from: 1, to: 4, count: 5, corridor: '1st Ave' },
  { type: 'avenue', ave: '1st Ave', from: 4, to: 7, count: 5, corridor: '1st Ave' },
  { type: 'avenue', ave: '1st Ave', from: 7, to: 10, count: 6, corridor: '1st Ave' },
  { type: 'avenue', ave: '1st Ave', from: 10, to: 14, count: 6, corridor: '1st Ave' },
  { type: 'avenue', ave: '2nd Ave', from: 1, to: 4, count: 5, corridor: '2nd Ave' },
  { type: 'avenue', ave: '2nd Ave', from: 4, to: 8, count: 5, corridor: '2nd Ave' },
  { type: 'avenue', ave: '2nd Ave', from: 8, to: 10, count: 6, corridor: '2nd Ave' },
  { type: 'avenue', ave: '2nd Ave', from: 10, to: 14, count: 4, corridor: '2nd Ave' },
  { type: 'avenue', ave: 'Ave A', from: 0, to: 4, count: 4, corridor: 'Ave A' },
  { type: 'avenue', ave: 'Ave A', from: 4, to: 7, count: 5, corridor: 'Ave A' },
  { type: 'avenue', ave: 'Ave A', from: 7, to: 10, count: 6, corridor: 'Ave A · Tompkins', sides: 'west' },
  { type: 'avenue', ave: 'Ave A', from: 10, to: 14, count: 5, corridor: 'Ave A' },
  { type: 'avenue', ave: 'Ave B', from: 2, to: 7, count: 4, corridor: 'Ave B' },
  { type: 'avenue', ave: 'Ave B', from: 10, to: 14, count: 4, corridor: 'Ave B' },
  { type: 'avenue', ave: 'Ave C', from: 2, to: 10, count: 4, corridor: 'Ave C' },
  { type: 'street', s: 8, from: -2, to: -1, count: 5, corridor: 'St Marks Pl' },
  { type: 'street', s: 8, from: -1, to: 0, count: 4, corridor: 'St Marks Pl' },
  { type: 'street', s: 8, from: 0, to: 1, count: 4, corridor: 'St Marks Pl' },
  { type: 'street', s: 6, from: -1, to: 0, count: 5, corridor: 'side · west' },
  { type: 'street', s: 7, from: 0, to: 1, count: 4, corridor: 'side · east' },
  { type: 'street', s: 9, from: -2, to: -1, count: 4, corridor: 'side · west' },
  { type: 'street', s: 9, from: -1, to: 0, count: 4, corridor: 'side · west' },
  { type: 'street', s: 9, from: 0, to: 1, count: 4, corridor: 'side · east' },
  { type: 'street', s: 10, from: 0, to: 1, count: 4, corridor: 'side · east' },
  { type: 'street', s: 4, from: -2.1, to: -1, count: 4, corridor: 'E 4th St' },
  { type: 'street', s: 5, from: 0, to: 1, count: 4, corridor: 'building', kind: 'building' },
  { type: 'street', s: 11, from: -1, to: 0, count: 4, corridor: 'building', kind: 'building' },
  { type: 'street', s: 12, from: -1, to: 0, count: 4, corridor: 'building', kind: 'building' },
];

/** Two avenues as a short span, east-to-west for numbered ones: "1st–2nd Ave", "1st Ave–Ave A", "Bowery–2nd Ave". */
export function avenueSpan(aLeft, aRight) {
  const name = (a) => (a <= -2.05 ? 'Bowery' : avenueName(a));
  const [x, y] = [name(aLeft), name(aRight)];
  const numbered = (n) => /^\d/.test(n);
  if (numbered(x) && numbered(y)) {
    const [lo, hi] = [x, y].sort();
    return { span: `${lo.replace(' Ave', '')}–${hi}`, pair: `${lo} & ${hi}` };
  }
  return { span: `${x}–${y}`, pair: `${x} & ${y}` };
}

export function blockName(b) {
  if (b.type === 'avenue') {
    const a = AVE_INDEX[b.ave];
    const from = streetName(b.from, a), to = streetName(b.to, a);
    const head = from.endsWith(' Pl') ? from : from.replace(/ St$/, '');
    return `${b.ave}, ${head}–${to}`;
  }
  return `${streetName(b.s, (b.from + b.to) / 2)}, ${avenueSpan(b.from, b.to).span}`;
}

const nearLabel = (t, first, second) => (t < 0.34 ? first : t > 0.66 ? second : 'mid-block');

const AVE_INDEX = { '3rd Ave': -2, '2nd Ave': -1, '1st Ave': 0, 'Ave A': 1, 'Ave B': 2, 'Ave C': 3, 'Ave D': 4 };

function sizeFor(b, corner, seed) {
  const h = unit(`${seed}:sqft`);
  const r10 = (x) => Math.round(x / 10) * 10;
  if (b.kind === 'building') return r10(3200 + h * 5600);
  if (corner) return r10(1100 + h * 1300);
  if (b.type === 'avenue') return r10(650 + h * 950);
  if (b.corridor === 'St Marks Pl') return r10(450 + h * 900);
  if (b.corridor === 'E 4th St') return r10(500 + h * 1000);
  return r10(380 + h * 820);
}

export function buildManualPlaces() {
  const out = [];
  let n = 0;
  for (const b of MANUAL_BLOCKS) {
    const block = blockName(b);
    for (let i = 0; i < b.count; i++) {
      n += 1;
      const id = `ev-${String(n).padStart(3, '0')}`;
      const t = (i + 0.5) / b.count;
      let lat, lng, address, corner = false;
      const kind = b.kind ?? 'storefront';
      if (b.type === 'avenue') {
        const a = AVE_INDEX[b.ave];
        corner = i === 0;
        const s = corner ? b.from + 0.12 : b.from + t * (b.to - b.from);
        const west = b.sides === 'west' ? true : i % 2 === 0;
        ({ lat, lng } = toLatLng(s, a, 0, west ? -16 : 16));
        address = corner
          ? `${b.ave} & ${streetName(b.from, a)}, ${west ? 'NW' : 'NE'} corner`
          : `${b.ave} between ${streetName(Math.floor(s), a)} & ${streetName(Math.ceil(s), a)}, ${west ? 'west' : 'east'} side, ${nearLabel(s - Math.floor(s), `near ${streetName(Math.floor(s), a)}`, `near ${streetName(Math.ceil(s), a)}`)}`;
      } else {
        const a = b.from + t * (b.to - b.from);
        const north = i % 2 === 0;
        ({ lat, lng } = toLatLng(b.s, a, north ? 14 : -14, 0));
        const [x, y] = avenueSpan(b.from, b.to).pair.split(' & ');
        const nearFirst = avenueName(b.from) === x || (b.from <= -2.05 && x === 'Bowery');
        address = `${streetName(b.s, a)} between ${x} & ${y}, ${north ? 'north' : 'south'} side, ${nearLabel(t, `near ${nearFirst ? x : y}`, `near ${nearFirst ? y : x}`)}`;
      }
      const sqft = sizeFor(b, corner, id);
      const rentPerSqftYear = rentFor({ corridor: b.corridor, sqft, corner, kind, seed: id });
      out.push({
        id, address, block, lat, lng, kind, sqft,
        tier: tierFor(rentPerSqftYear), rentPerSqftYear, footTraffic: 0,
        suitableFor: suitableFor({ kind, sqft, corner, onAvenue: b.type === 'avenue' }),
        sourceDataset: 'manual:east-village-grid-v1', note: 'unverified',
      });
    }
  }
  return withFootTraffic(out);
}

// ───────────── network pipeline (NYC Open Data, MTA) ─────────────

const SOCRATA = 'https://data.cityofnewyork.us/resource';
const NYSDATA = 'https://data.ny.gov/resource';

export function soqlUrl(base, id, params) {
  const q = new URLSearchParams(params);
  return `${base}/${id}.json?${q.toString()}`;
}

export const QUERIES = {
  ridership: () => soqlUrl(NYSDATA, SOURCES.ridership.id, {
    $select: 'station_complex_id, station_complex, sum(ridership) as rides, avg(latitude) as lat, avg(longitude) as lng',
    $where: "borough = 'Manhattan' AND transit_timestamp >= '2024-01-01T00:00:00' AND transit_timestamp < '2025-01-01T00:00:00'",
    $group: 'station_complex_id, station_complex', $limit: '1000',
  }),
  storefronts: () => soqlUrl(SOCRATA, SOURCES.storefronts.id, { $where: "borough = 'MANHATTAN' AND zip_code in ('10003','10009')", $limit: '50000' }),
  storefrontsAny: () => soqlUrl(SOCRATA, SOURCES.storefronts.id, { $limit: '50000', $q: '10009' }),
  pluto: () => soqlUrl(SOCRATA, SOURCES.pluto.id, {
    $select: 'bbl, address, bldgclass, bldgarea, retailarea, numfloors, latitude, longitude, zipcode',
    $where: "borough = 'MN' AND zipcode in (10003, 10009)", $limit: '50000',
  }),
  restaurants: () => soqlUrl(SOCRATA, SOURCES.restaurants.id, {
    $select: 'camis, dba, building, street, zipcode, cuisine_description, grade, grade_date, latitude, longitude',
    $where: "boro = 'Manhattan' AND zipcode in ('10003','10009') AND grade IS NOT NULL", $order: 'grade_date DESC', $limit: '50000',
  }),
  businesses: () => soqlUrl(SOCRATA, SOURCES.businesses.id, { $where: "address_zip in ('10003','10009')", $limit: '50000' }),
};

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'first-year-game-data/1.0' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

async function loadInputs(mode) {
  if (mode === 'sample') {
    const read = async (name) => JSON.parse(await readFile(join(HERE, 'sample', `${name}.json`), 'utf8'));
    return { ridership: await read('ridership'), storefronts: await read('storefronts'), pluto: await read('pluto'), restaurants: await read('restaurants'), businesses: await read('businesses') };
  }
  const safe = async (name, ...urls) => {
    for (const u of urls) {
      try { const rows = await getJson(u); console.log(`  ${name}: ${rows.length} rows ← ${u}`); return rows; }
      catch (e) { console.warn(`  ${name}: ${e.message}`); }
    }
    return [];
  };
  return {
    ridership: await safe('ridership', QUERIES.ridership()),
    storefronts: await safe('storefronts', QUERIES.storefronts(), QUERIES.storefrontsAny()),
    pluto: await safe('pluto', QUERIES.pluto()),
    restaurants: await safe('restaurants', QUERIES.restaurants()),
    businesses: await safe('businesses', QUERIES.businesses()),
  };
}

const pick = (row, re) => { const k = Object.keys(row).find((key) => re.test(key)); return k === undefined ? undefined : row[k]; };
const num = (x) => (x === undefined || x === null || x === '' ? NaN : Number(x));

export function stationsFromRidership(rows) {
  const out = rows.map((r) => ({ id: String(r.station_complex_id), name: r.station_complex, lat: num(r.lat), lng: num(r.lng), rides: num(r.rides), confidence: 'verified' }))
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.rides) && distanceM(s, { lat: 40.7265, lng: -73.9845 }) < 1800);
  return out.length >= 3 ? out : STATIONS;
}

/** Which block (street segment) a point belongs to, in the same naming as the manual list. */
export function blockOf(lat, lng) {
  const { s, a } = toGrid(lat, lng);
  const toAve = Math.abs(a - Math.round(a)) * 217, toStreet = Math.abs(s - Math.round(s)) * 77.5;
  // storefronts sit ~15 m off the centerline; corners count as avenue frontage
  if (toAve <= 25 || toAve < toStreet) {
    const ave = avenueName(a);
    const cuts = [0, 4, 7, 10, 14.5];
    let lo = 0; while (lo < cuts.length - 2 && s >= cuts[lo + 1]) lo += 1;
    return { block: blockName({ type: 'avenue', ave, from: cuts[lo], to: Math.min(14, cuts[lo + 1]) }), onAvenue: true, corridor: corridorFor({ type: 'avenue', ave, s }) };
  }
  const st = Math.round(s), left = Math.floor(a), right = left + 1;
  return { block: blockName({ type: 'street', s: st, from: left, to: right }), onAvenue: false, corridor: corridorFor({ type: 'street', s: st, a }) };
}

function corridorFor({ type, ave, s, a }) {
  if (type === 'avenue') {
    if (ave === 'Ave A' && s > 7 && s < 10) return 'Ave A · Tompkins';
    return CORRIDOR_RENT[ave] ? ave : 'Ave C';
  }
  if (s === 8 && a < 1) return 'St Marks Pl';
  if (s === 4 && a < -1) return 'E 4th St';
  return a < 0 ? 'side · west' : 'side · east';
}

export function buildFromData(inputs) {
  const stations = stationsFromRidership(inputs.ridership);
  const plutoByBbl = new Map(inputs.pluto.map((r) => [String(r.bbl).split('.')[0], r]));
  const seen = new Set();
  const candidates = [];
  for (const r of inputs.storefronts) {
    const lat = num(pick(r, /^lat/i)), lng = num(pick(r, /^(lon|lng)/i));
    const address = String(pick(r, /address/i) ?? '').replace(/\s+/g, ' ').trim();
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !address || !insideDistrict(lat, lng)) continue;
    const key = address.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const vacant = /^(y|yes|true|1)$/i.test(String(pick(r, /vacan/i) ?? ''));
    const lot = plutoByBbl.get(String(pick(r, /bbl/i) ?? '').split('.')[0]);
    const retail = num(lot?.retailarea);
    const sqft = Number.isFinite(retail) && retail > 150 ? Math.min(4000, Math.round(retail)) : 900;
    candidates.push({ lat, lng, address: titleCase(address), vacant, sqft, sqftKnown: Number.isFinite(retail) && retail > 150, kind: 'storefront' });
  }
  for (const r of inputs.pluto) {
    const lat = num(r.latitude), lng = num(r.longitude), area = num(r.bldgarea), floors = num(r.numfloors);
    if (!/^C/.test(String(r.bldgclass ?? '')) || !(area >= 3000 && area <= 9000) || !(floors <= 6) || !insideDistrict(lat, lng)) continue;
    candidates.push({ lat, lng, address: titleCase(String(r.address ?? '')), vacant: false, sqft: Math.round(area), sqftKnown: true, kind: 'building' });
  }
  const groups = new Map();
  for (const c of candidates) {
    const where = blockOf(c.lat, c.lng);
    const g = groups.get(where.block) ?? [];
    g.push({ ...c, ...where });
    groups.set(where.block, g);
  }
  const stores = [], buildings = [];
  for (const [, g] of [...groups].sort()) {
    buildings.push(...g.filter((c) => c.kind === 'building'));
    const st = g.filter((c) => c.kind === 'storefront').sort((x, y) => Number(y.vacant) - Number(x.vacant));
    if (st.length >= 4) stores.push(st.slice(0, 10));
  }
  // buildings first: up to 4 per block on the 4 blocks with the most walk-ups
  const bByBlock = new Map();
  for (const b of buildings) { const l = bByBlock.get(b.block) ?? []; l.push(b); bByBlock.set(b.block, l); }
  const pickedBuildings = [...bByBlock.values()].filter((l) => l.length >= 4).sort((x, y) => y.length - x.length).slice(0, 4).flatMap((l) => l.slice(0, 4));
  // storefront blocks, biggest first, until the 140 cap
  let picked = [...pickedBuildings];
  for (const block of stores.sort((x, y) => y.length - x.length)) {
    if (picked.length + 4 > 140) break;
    picked.push(...block.slice(0, Math.min(block.length, 140 - picked.length)));
  }
  let n = 0;
  const places = picked.map((c) => {
    n += 1;
    const id = `ev-${String(n).padStart(3, '0')}`;
    const rentPerSqftYear = rentFor({ corridor: c.kind === 'building' ? 'building' : c.corridor, sqft: c.sqft, kind: c.kind, seed: id });
    const notes = ['rent: estimate by corridor'];
    if (!c.sqftKnown) notes.push('sqft: estimate');
    if (c.kind === 'storefront' && !c.vacant) notes.push('reported occupied');
    return {
      id, address: c.address, block: c.block, lat: c.lat, lng: c.lng, kind: c.kind, sqft: c.sqft,
      tier: tierFor(rentPerSqftYear), rentPerSqftYear, footTraffic: 0,
      suitableFor: suitableFor({ kind: c.kind, sqft: c.sqft, onAvenue: c.onAvenue }),
      sourceDataset: c.kind === 'building' ? `${SOURCES.pluto.id} (PLUTO)` : `${SOURCES.storefronts.id} + ${SOURCES.pluto.id}`,
      note: notes.join('; '),
    };
  });
  return withFootTraffic(places, stations);
}

export function buildRealBusinesses(inputs) {
  const latest = new Map();
  for (const r of inputs.restaurants) {
    const lat = num(r.latitude), lng = num(r.longitude);
    if (!Number.isFinite(lat) || !insideDistrict(lat, lng)) continue;
    const prev = latest.get(r.camis);
    if (!prev || String(r.grade_date) > String(prev.grade_date)) latest.set(r.camis, r);
  }
  const out = [];
  for (const r of latest.values()) {
    const cuisine = String(r.cuisine_description ?? '');
    const type = /coffee|tea/i.test(cuisine) ? 'cafe' : /bakery/i.test(cuisine) ? 'bakery' : /bottled|juice|donut/i.test(cuisine) ? 'cafe' : 'restaurant';
    out.push({ id: `doh-${r.camis}`, name: titleCase(r.dba), type, lat: num(r.latitude), lng: num(r.longitude), address: titleCase(`${r.building ?? ''} ${r.street ?? ''}`.trim()), grade: ['A', 'B', 'C'].includes(r.grade) ? r.grade : null, source: SOURCES.restaurants.id });
  }
  for (const r of inputs.businesses) {
    const lat = num(pick(r, /^lat/i)), lng = num(pick(r, /^(lon|lng)/i));
    const name = pick(r, /dba|trade/i) || pick(r, /business_name/i);
    if (!name || !Number.isFinite(lat) || !insideDistrict(lat, lng)) continue;
    if (!/^active/i.test(String(pick(r, /status/i) ?? 'active'))) continue;
    out.push({ id: `dcwp-${pick(r, /license_n/i) ?? out.length}`, name: titleCase(String(name)), type: 'shop', lat, lng, address: titleCase(`${pick(r, /address_building/i) ?? ''} ${pick(r, /address_street/i) ?? ''}`.trim()), grade: null, source: SOURCES.businesses.id, category: String(pick(r, /categor|industry/i) ?? '') });
  }
  const dedup = new Map();
  for (const b of out) { const k = `${b.name.toLowerCase()}|${b.lat.toFixed(4)}|${b.lng.toFixed(4)}`; if (!dedup.has(k)) dedup.set(k, b); }
  const list = [...dedup.values()].sort((x, y) => unit(x.id) - unit(y.id));
  return list.slice(0, 300);
}

function titleCase(s) {
  return String(s ?? '').toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (_, d, x) => d + x.toLowerCase());
}
function round2(x) { return Math.round(x * 100) / 100; }

// ───────────── check ─────────────

export function checkPlaces(places) {
  const errors = [], warnings = [];
  if (!Array.isArray(places)) return { errors: ['places.json is not an array'], warnings };
  if (places.length < 100 || places.length > 140) warnings.push(`places: ${places.length} (task wants 100–140)`);
  if (places.length < 40) errors.push(`places: ${places.length} < 40`);
  const ids = new Set();
  const perBlock = new Map();
  const perNiche = Object.fromEntries(NICHES.map((n) => [n, 0]));
  places.forEach((p, i) => {
    const at = `places[${i}] ${p?.id ?? ''}`;
    for (const k of ['id', 'address', 'block']) if (typeof p[k] !== 'string' || !p[k].trim()) errors.push(`${at}: ${k} missing`);
    if (ids.has(p.id)) errors.push(`${at}: duplicate id`); ids.add(p.id);
    for (const k of ['lat', 'lng', 'sqft', 'rentPerSqftYear', 'footTraffic']) if (typeof p[k] !== 'number' || !Number.isFinite(p[k])) errors.push(`${at}: ${k} not a number`);
    if (!['storefront', 'building'].includes(p.kind)) errors.push(`${at}: kind ${p.kind}`);
    if (!['prime', 'mid', 'cheap'].includes(p.tier)) errors.push(`${at}: tier ${p.tier}`);
    else if (tierFor(p.rentPerSqftYear) !== p.tier) errors.push(`${at}: tier ${p.tier} does not match rent ${p.rentPerSqftYear}`);
    if (!(p.footTraffic >= 0 && p.footTraffic <= 1)) errors.push(`${at}: footTraffic out of 0–1`);
    if (!(p.sqft > 0)) errors.push(`${at}: sqft ≤ 0`);
    if (!(p.rentPerSqftYear > 0)) errors.push(`${at}: rent ≤ 0`);
    if (!insideDistrict(p.lat, p.lng)) errors.push(`${at}: outside the East Village`);
    if (!Array.isArray(p.suitableFor) || p.suitableFor.some((n) => !NICHES.includes(n))) errors.push(`${at}: suitableFor`);
    else p.suitableFor.forEach((n) => { perNiche[n] += 1; });
    perBlock.set(p.block, (perBlock.get(p.block) ?? 0) + 1);
  });
  if (perNiche.cafe < 40) errors.push(`cafe places ${perNiche.cafe} < 40`);
  if (perNiche.barbershop < 40) errors.push(`barbershop places ${perNiche.barbershop} < 40`);
  for (const n of ['bodega', 'guesthouse', 'rentals']) if (perNiche[n] < 10) errors.push(`${n} places ${perNiche[n]} < 10`);
  for (const [block, count] of perBlock) if (count < 4 || count > 10) errors.push(`block "${block}": ${count} places (needs 4–10)`);
  return { errors, warnings, stats: { places: places.length, blocks: perBlock.size, perNiche } };
}

export function checkBusinesses(list) {
  const errors = [], warnings = [];
  if (!Array.isArray(list)) return { errors: ['real-businesses.json is not an array'], warnings };
  if (list.length < 150 || list.length > 300) warnings.push(`real businesses: ${list.length} (task wants 150–300)`);
  const ids = new Set();
  list.forEach((b, i) => {
    const at = `businesses[${i}] ${b?.id ?? ''}`;
    if (typeof b.name !== 'string' || !b.name.trim()) errors.push(`${at}: name missing`);
    if (typeof b.type !== 'string') errors.push(`${at}: type missing`);
    if (ids.has(b.id)) errors.push(`${at}: duplicate id`); ids.add(b.id);
    if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng) || !insideDistrict(b.lat, b.lng)) errors.push(`${at}: coordinates outside the East Village`);
    if (b.grade !== undefined && b.grade !== null && !['A', 'B', 'C', 'Z', 'P', 'N'].includes(b.grade)) errors.push(`${at}: grade ${b.grade}`);
  });
  return { errors, warnings, stats: { businesses: list.length } };
}

// ───────────── main ─────────────

async function main(argv) {
  const has = (f) => argv.includes(f);
  const outIdx = argv.indexOf('--out');
  const outDir = outIdx >= 0 ? resolve(argv[outIdx + 1]) : HERE;
  const placesFile = join(outDir, 'places.json'), bizFile = join(outDir, 'real-businesses.json');

  if (has('--check')) {
    const places = JSON.parse(await readFile(placesFile, 'utf8'));
    const biz = JSON.parse(await readFile(bizFile, 'utf8').catch(() => '[]'));
    const a = checkPlaces(places), b = checkBusinesses(biz);
    for (const w of [...a.warnings, ...b.warnings]) console.log(`warn  ${w}`);
    for (const e of [...a.errors, ...b.errors]) console.log(`ERROR ${e}`);
    console.log(`places ${a.stats?.places} in ${a.stats?.blocks} blocks · niches ${JSON.stringify(a.stats?.perNiche)} · real businesses ${b.stats?.businesses}`);
    const bad = a.errors.length + b.errors.length;
    console.log(bad ? `FAIL: ${bad} errors` : 'OK');
    process.exit(bad ? 1 : 0);
  }

  await mkdir(outDir, { recursive: true });
  if (has('--manual')) {
    const places = buildManualPlaces();
    await writeFile(placesFile, JSON.stringify(places, null, 2) + '\n');
    console.log(`manual: wrote ${places.length} places → ${placesFile}`);
    return;
  }
  const mode = has('--sample') ? 'sample' : 'network';
  console.log(`${mode}: loading inputs`);
  const inputs = await loadInputs(mode);
  const places = buildFromData(inputs);
  const biz = buildRealBusinesses(inputs);
  if (places.length < 40) { console.error(`only ${places.length} places from data — keeping the existing file`); process.exit(2); }
  await writeFile(placesFile, JSON.stringify(places, null, 2) + '\n');
  if (biz.length) await writeFile(bizFile, JSON.stringify(biz, null, 2) + '\n');
  console.log(`${mode}: wrote ${places.length} places, ${biz.length} real businesses → ${outDir}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((e) => { console.error(e); process.exit(1); });
}
