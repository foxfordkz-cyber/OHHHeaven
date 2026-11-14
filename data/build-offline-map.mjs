#!/usr/bin/env node
// Builds the offline fallback for CityMap from the street grid model (no tiles needed):
//   data/offline-map.png        schematic dark map of the East Village, north-up
//   data/offline-map.json       its corner coordinates for a MapLibre image source
//   data/offline-buildings.json GeoJSON footprints with heights for 3D extrusion, parks and water
// Needs Playwright with Chromium (preinstalled in the build container): node data/build-offline-map.mjs

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { toLatLng, STREET_M, AVENUE_M, streetName, avenueName } from './lib/grid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// grid window drawn on the image (wider than the district so edges are not empty)
const S0 = -2.2, S1 = 16.2, A0 = -3.4, A1 = 5.6;
const corners = [toLatLng(S0, A0), toLatLng(S1, A0), toLatLng(S1, A1), toLatLng(S0, A1)];
const west = Math.min(...corners.map((c) => c.lng)), east = Math.max(...corners.map((c) => c.lng));
const south = Math.min(...corners.map((c) => c.lat)), north = Math.max(...corners.map((c) => c.lat));
const W = 2400;
const H = Math.round(W * ((north - south) * 111_040) / ((east - west) * 111_320 * Math.cos((40.727 * Math.PI) / 180)));

const px = ({ lat, lng }) => [((lng - west) / (east - west)) * W, ((north - lat) / (north - south)) * H];
const P = (s, a, du = 0, dv = 0) => px(toLatLng(s, a, du, dv));
const poly = (pts) => pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');

function hash(x) { let h = 2166136261; for (const c of String(x)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h / 2 ** 32; }

// ─── geometry in grid space ───
const RIVER_A = 5.0, PARK_RIVER_A = 4.62;
const isTompkins = (s, a) => s >= 7 && s < 10 && a >= 1 && a < 2;
const isStuyTown = (s, a) => s >= 14 && a >= 0 && a < 3;
const inDistrict = (s, a) => s >= 0 && s < 14 && a >= -2 && a < 4.4;

function blockQuad(s, a, insetU = 9, insetV = 15, aEnd = a + 1, sEnd = s + 1) {
  return [toLatLng(s, a, insetU, insetV), toLatLng(s, aEnd, insetU, -insetV), toLatLng(sEnd, aEnd, -insetU, -insetV), toLatLng(sEnd, a, -insetU, insetV)];
}

function buildings() {
  const features = [];
  for (let s = Math.ceil(S0); s < S1 - 1; s++) {
    for (let a = Math.ceil(A0); a < Math.min(A1, PARK_RIVER_A) - 0.4; a++) {
      if (isTompkins(s, a) || isStuyTown(s, a)) continue;
      const aEnd = Math.min(a + 1, PARK_RIVER_A - 0.15);
      const lots = 6;
      for (let row = 0; row < 2; row++) {
        for (let k = 0; k < lots; k++) {
          const a0 = a + ((aEnd - a) * k) / lots, a1 = a + ((aEnd - a) * (k + 1)) / lots;
          const s0 = s + row * 0.5, s1 = s + (row + 1) * 0.5;
          const iu0 = row === 0 ? 9 : 1.5, iu1 = row === 1 ? 9 : 1.5;
          const iv0 = k === 0 ? 15 : 1.2, iv1 = k === lots - 1 ? 15 : 1.2;
          const ring = [toLatLng(s0, a0, iu0, iv0), toLatLng(s0, a1, iu0, -iv1), toLatLng(s1, a1, -iu1, -iv1), toLatLng(s1, a0, -iu1, iv0)];
          const h = hash(`${s}:${a}:${row}:${k}`);
          const tall = a >= 3 && s <= 8 ? 1 : 0; // public housing towers east of Ave C
          const height = tall ? 38 + h * 30 : 13 + h * 14 + (h > 0.93 ? 25 : 0);
          features.push(feature(ring, { kind: 'building', height: Math.round(height), inside: inDistrict(s, a) }));
        }
      }
    }
  }
  // Stuyvesant Town: towers north of 14th St
  for (let s = 14; s < S1 - 1; s += 1) for (let a = 0; a < 3; a += 0.5) {
    const ring = blockQuad(s + 0.2, a + 0.08, 0, 0, a + 0.32, s + 0.55);
    features.push(feature(ring, { kind: 'building', height: Math.round(40 + hash(`st${s}${a}`) * 8), inside: false }));
  }
  return features;
}

function parks() {
  return [
    feature(blockQuad(7, 1, 9, 15, 2, 10), { kind: 'park', name: 'Tompkins Square Park' }),
    feature([toLatLng(S0, PARK_RIVER_A), toLatLng(S1, PARK_RIVER_A), toLatLng(S1, RIVER_A), toLatLng(S0, RIVER_A)], { kind: 'park', name: 'East River Park' }),
    feature([toLatLng(S0, RIVER_A), toLatLng(S1, RIVER_A), toLatLng(S1, A1 + 1), toLatLng(S0, A1 + 1)], { kind: 'water', name: 'East River' }),
  ];
}

function feature(ring, properties) {
  const coords = ring.map((p) => [p.lng, p.lat]);
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...coords, coords[0]]] }, properties };
}

// ─── raster ───
function svg() {
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  out.push(`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d1326"/><stop offset="1" stop-color="#090d1a"/></linearGradient></defs>`);
  out.push(`<rect width="${W}" height="${H}" fill="url(#g)"/>`);
  for (const f of parks()) {
    const ring = f.geometry.coordinates[0].map(([lng, lat]) => px({ lat, lng }));
    const fill = f.properties.kind === 'water' ? '#06182c' : '#0e2a22';
    out.push(`<polygon points="${poly(ring)}" fill="${fill}"/>`);
  }
  // block ground (sidewalk tone)
  for (let s = Math.ceil(S0); s < S1 - 1; s++) for (let a = Math.ceil(A0); a < PARK_RIVER_A - 0.4; a++) {
    if (isTompkins(s, a)) continue;
    const q = blockQuad(s, a, 8, 13, Math.min(a + 1, PARK_RIVER_A - 0.12)).map(px);
    out.push(`<polygon points="${poly(q)}" fill="${inDistrict(s, a) ? '#151b33' : '#11162a'}"/>`);
  }
  // streets and avenues
  const line = (p, q, w, color) => out.push(`<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`);
  for (let s = Math.ceil(S0); s <= Math.floor(S1); s++) {
    const major = s === 0 || s === 14;
    line(P(s, A0), P(s, PARK_RIVER_A), major ? 16 : 9, major ? '#2f3d6e' : '#232c52');
  }
  for (let a = Math.ceil(A0); a <= 4; a++) line(P(S0, a), P(S1, a), 13, '#2a3663');
  line(P(S0, 4.55), P(S1, 4.55), 18, '#34437a'); // FDR Drive
  // labels
  const label = (text, at, angle, size, color, weight = 600) => out.push(`<text x="${at[0].toFixed(1)}" y="${at[1].toFixed(1)}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${angle} ${at[0].toFixed(1)} ${at[1].toFixed(1)})" letter-spacing="1">${text}</text>`);
  const streetAngle = (() => { const [x1, y1] = P(5, 0), [x2, y2] = P(5, 1); return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI; })();
  const aveAngle = (() => { const [x1, y1] = P(0, 0), [x2, y2] = P(1, 0); return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI; })();
  for (let s = 0; s <= 14; s++) label(streetName(s, 0).toUpperCase(), P(s, -1.5), streetAngle, 15, '#7e8ab8');
  for (let s = 1; s <= 13; s += 3) label(streetName(s, 3).toUpperCase(), P(s, 2.5), streetAngle, 14, '#6b7699');
  for (let a = -2; a <= 4; a++) {
    for (const s of [2.5, 11.5]) label(avenueName(a).toUpperCase(), P(s, a, 0, 0), aveAngle + (aveAngle < -90 ? 180 : 0), 16, '#93a0d0', 700);
  }
  label('TOMPKINS SQUARE PARK', P(8.5, 1.5), streetAngle, 20, '#5fd3a0', 700);
  label('EAST RIVER PARK', P(7, 4.8), aveAngle + (aveAngle < -90 ? 180 : 0), 16, '#4fb88a', 700);
  label('EAST VILLAGE', P(11.2, 0.5), streetAngle, 42, 'rgba(160,175,230,0.22)', 800);
  out.push(`<text x="${W - 24}" y="${H - 24}" font-family="Inter, Arial" font-size="18" fill="#56608a" text-anchor="end">Schematic offline map · street grid model · © OpenStreetMap contributors (street names)</text>`);
  out.push('</svg>');
  return out.join('\n');
}

async function main() {
  const fc = { type: 'FeatureCollection', features: [...parks(), ...buildings()] };
  await writeFile(join(HERE, 'offline-buildings.json'), JSON.stringify(fc));
  const meta = {
    coordinates: [[west, north], [east, north], [east, south], [west, south]],
    width: W, height: H, note: 'schematic: street grid model of the East Village, not a tile snapshot',
  };
  await writeFile(join(HERE, 'offline-map.json'), JSON.stringify(meta, null, 2) + '\n');
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:#000">${svg()}</body></html>`);
  await page.screenshot({ path: join(HERE, 'offline-map.png'), clip: { x: 0, y: 0, width: W, height: H } });
  await browser.close();
  console.log(`offline map ${W}×${H}, ${fc.features.length} features, bbox ${west.toFixed(5)},${south.toFixed(5)} – ${east.toFixed(5)},${north.toFixed(5)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
