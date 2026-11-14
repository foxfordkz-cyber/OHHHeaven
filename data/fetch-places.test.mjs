// node --test data/   (built-in test runner, no dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  blockName, blockOf, buildFromData, buildManualPlaces, buildRealBusinesses, checkBusinesses, checkPlaces,
  rentFor, stationScore, suitableFor, tierFor, unit, withFootTraffic, QUERIES,
} from './fetch-places.mjs';
import { toGrid, toLatLng, insideDistrict, distanceM } from './lib/grid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = async (f) => JSON.parse(await readFile(join(HERE, f), 'utf8'));

test('grid model round-trips and is calibrated on known points', () => {
  const p = toLatLng(8.5, 1.5);
  const g = toGrid(p.lat, p.lng);
  assert.ok(Math.abs(g.s - 8.5) < 0.01 && Math.abs(g.a - 1.5) < 0.01);
  // Tompkins Square Park center (Wikipedia 40.72639, -73.98139) within 30 m
  assert.ok(distanceM(p, { lat: 40.72639, lng: -73.98139 }) < 30);
  assert.ok(insideDistrict(40.7265, -73.9840));
  assert.ok(!insideDistrict(40.7500, -73.9800)); // Midtown
});

test('tiers follow the rent limits', () => {
  assert.equal(tierFor(130), 'prime');
  assert.equal(tierFor(90), 'mid');
  assert.equal(tierFor(55), 'cheap');
});

test('rent per sq ft is higher for small spaces and corners, flat-ish for buildings', () => {
  const small = rentFor({ corridor: '1st Ave', sqft: 500 });
  const big = rentFor({ corridor: '1st Ave', sqft: 2000 });
  assert.ok(small > big);
  assert.ok(rentFor({ corridor: '1st Ave', sqft: 1000, corner: true }) > rentFor({ corridor: '1st Ave', sqft: 1000 }));
  const b = rentFor({ corridor: 'building', sqft: 5000, kind: 'building', seed: 'x' });
  assert.ok(b >= 50 && b <= 64);
});

test('suitability rules by kind and size', () => {
  assert.deepEqual(suitableFor({ kind: 'building', sqft: 5000 }), ['guesthouse', 'rentals']);
  assert.deepEqual(suitableFor({ kind: 'storefront', sqft: 350 }), ['barbershop']);
  assert.deepEqual(suitableFor({ kind: 'storefront', sqft: 900, onAvenue: true }), ['cafe', 'barbershop', 'bodega']);
  assert.deepEqual(suitableFor({ kind: 'storefront', sqft: 2200, corner: true }), ['cafe', 'bodega']);
});

test('foot traffic falls with distance from stations and stays within 0.1–1', () => {
  const near = stationScore({ lat: 40.7310, lng: -73.9818 }); // 1 Av L
  const far = stationScore({ lat: 40.7230, lng: -73.9770 });  // Ave C, no subway
  assert.ok(near > far);
  const fx = withFootTraffic([{ lat: 40.7310, lng: -73.9818 }, { lat: 40.7230, lng: -73.9770 }]);
  assert.equal(fx[0].footTraffic, 1);
  assert.ok(fx[1].footTraffic >= 0.1 && fx[1].footTraffic < 0.5);
});

test('unit() is deterministic and in [0, 1)', () => {
  assert.equal(unit('ev-001'), unit('ev-001'));
  for (const s of ['a', 'b', 'ev-120']) assert.ok(unit(s) >= 0 && unit(s) < 1);
});

test('block names match the task format', () => {
  assert.equal(blockName({ type: 'street', s: 7, from: 0, to: 1 }), 'E 7th St, 1st Ave–Ave A');
  assert.equal(blockName({ type: 'street', s: 9, from: -1, to: 0 }), 'E 9th St, 1st–2nd Ave');
  assert.equal(blockName({ type: 'avenue', ave: 'Ave A', from: 7, to: 10 }), 'Ave A, E 7th–E 10th St');
  assert.equal(blockName({ type: 'avenue', ave: '2nd Ave', from: 4, to: 8 }), '2nd Ave, E 4th–St Marks Pl');
  const p = toLatLng(8.6, 1, 0, -16);
  assert.equal(blockOf(p.lat, p.lng).block, 'Ave A, E 7th–E 10th St');
});

test('manual places pass the check: 100–140 places, 4–10 per block, niche minimums', () => {
  const places = buildManualPlaces();
  const r = checkPlaces(places);
  assert.deepEqual(r.errors, []);
  assert.ok(places.length >= 100 && places.length <= 140);
  assert.ok(places.every((p) => p.note === 'unverified'));
});

test('the committed data/places.json passes the check', async () => {
  const r = checkPlaces(await read('places.json'));
  assert.deepEqual(r.errors, []);
});

test('check catches broken places', () => {
  const [a, b, c, d] = buildManualPlaces();
  const r = checkPlaces([{ ...a, tier: 'cheap' }, { ...b, id: a.id }, { ...c, lat: 40.76 }, { ...d, footTraffic: 2 }]);
  assert.ok(r.errors.some((e) => e.includes('does not match rent')));
  assert.ok(r.errors.some((e) => e.includes('duplicate id')));
  assert.ok(r.errors.some((e) => e.includes('outside the East Village')));
  assert.ok(r.errors.some((e) => e.includes('footTraffic')));
});

test('network pipeline on the saved sample builds valid places and real businesses', async () => {
  const inputs = {
    ridership: await read('sample/ridership.json'), storefronts: await read('sample/storefronts.json'),
    pluto: await read('sample/pluto.json'), restaurants: await read('sample/restaurants.json'), businesses: await read('sample/businesses.json'),
  };
  const places = buildFromData(inputs);
  assert.deepEqual(checkPlaces(places).errors, []);
  assert.ok(places.length >= 100);
  assert.ok(!places.some((p) => p.address === 'Sample Outside'));
  const biz = buildRealBusinesses(inputs);
  assert.deepEqual(checkBusinesses(biz).errors, []);
  assert.ok(biz.length >= 150 && biz.length <= 300);
  const camis = biz.filter((b) => b.id.startsWith('doh-')).map((b) => b.id);
  assert.equal(new Set(camis).size, camis.length);           // one row per restaurant
  assert.equal(biz.find((b) => b.id === 'doh-50000009').grade, null); // newest row (Z, pending) wins over an older A; only A/B/C are shown
  assert.ok(!biz.some((b) => b.id === 'dcwp-SAMPLE-9'));      // inactive license dropped
});

test('queries need no API key', () => {
  for (const q of Object.values(QUERIES)) {
    const url = q();
    assert.match(url, /^https:\/\/data\.(cityofnewyork\.us|ny\.gov)\/resource\/[a-z0-9]{4}-[a-z0-9]{4}\.json\?/);
    assert.doesNotMatch(url, /app_token|key=/i);
  }
});
