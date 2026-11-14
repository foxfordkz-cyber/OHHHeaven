#!/usr/bin/env node
// Refreshes ai/src/data/nyc-climate.json from NOAA NCEI 1991-2020 monthly normals for Central Park.
// NOAA data are U.S. Government works (public domain). Run: node ai/scripts/fetch-climate.mjs [--dry-run]
// Needs network access to www.ncei.noaa.gov. Values it cannot read stay as they are, with their confidence marks.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const FILE = join(here, '..', 'src', 'data', 'nyc-climate.json');
const STATION = 'USW00094728'; // New York Central Park
const TYPES = {
  tmaxF: 'MLY-TMAX-NORMAL',
  tminF: 'MLY-TMIN-NORMAL',
  precipDays: 'MLY-PRCP-AVGNDS-GE001HI', // days with precipitation >= 0.01 in
  snowDays: 'MLY-SNOW-AVGNDS-GE001TI',   // days with snowfall >= 0.1 in
  hotDays: 'MLY-TMAX-AVGNDS-GRTH090',    // days with high >= 90 F
};
const URL_BASE = 'https://www.ncei.noaa.gov/access/services/data/v1';
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const url = `${URL_BASE}?dataset=normals-monthly-1991-2020&stations=${STATION}&format=json&units=standard&dataTypes=${Object.values(TYPES).join(',')}`;
  console.log(`GET ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': 'first-year-game climate refresh' }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`NCEI answered ${res.status} ${res.statusText}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('NCEI returned no rows');

  // One row per month; DATE is "01".."12" or "1991-2020-01" depending on the dataset version.
  const byMonth = new Map();
  for (const row of rows) {
    const m = Number(String(row.DATE ?? row.date ?? '').slice(-2));
    if (m >= 1 && m <= 12) byMonth.set(m, row);
  }

  const climate = JSON.parse(await readFile(FILE, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  let changed = 0;
  for (const [key, type] of Object.entries(TYPES)) {
    const values = [];
    for (let m = 1; m <= 12; m++) {
      const v = Number(byMonth.get(m)?.[type]);
      values.push(Number.isFinite(v) ? v : null);
    }
    if (values.some(v => v === null)) {
      console.warn(`${key}: ${type} missing for some months, kept the old values`);
      continue;
    }
    climate[key].values = values;
    climate[key].confidence = 'verified';
    climate[key].source = url;
    climate[key].note = `NOAA NCEI ${type}, ${STATION}, 1991-2020 normals, fetched ${today}.`;
    changed++;
    console.log(`${key}: ${values.join(', ')}`);
  }
  climate.updated = today;
  if (dryRun) {
    console.log(`dry run: ${changed} series would be updated`);
    return;
  }
  await writeFile(FILE, `${JSON.stringify(climate, null, 2)}\n`);
  console.log(`updated ${changed} series in ${FILE}`);
}

main().catch(err => {
  console.error(`fetch-climate failed: ${err.message}`);
  console.error('The game keeps working on the values already in nyc-climate.json.');
  process.exit(1);
});
