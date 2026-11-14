#!/usr/bin/env node
// Builds packs/parts/cafe/D06-demand.json from the part files and checks it.
// Usage: node build.mjs <repoRoot>
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = process.argv[2];
const partsDir = join(here, 'parts');
const files = readdirSync(partsDir).filter((f) => f.endsWith('.json')).sort();

const LIST_KEYS = ['setup', 'monthlyCosts', 'staff', 'taxes', 'levers', 'shortcuts', 'violations', 'officials', 'reports', 'events', 'ruleCards', 'roadmap', 'suppliers', 'sources'];
const out = { id: 'cafe', part: 'D06', title: 'Demand, guests, queue, reputation', checked: '2026-11-14' };
const problems = [];

function mergeExtra(target, src) {
  for (const [k, v] of Object.entries(src)) {
    if (Array.isArray(v) && Array.isArray(target[k])) target[k].push(...v);
    else if (k in target && !Array.isArray(v) && typeof v === 'object' && v && typeof target[k] === 'object') Object.assign(target[k], v);
    else if (k in target) problems.push(`extra.${k} defined twice`);
    else target[k] = v;
  }
}

for (const f of files) {
  let part;
  try { part = JSON.parse(readFileSync(join(partsDir, f), 'utf8')); }
  catch (e) { problems.push(`${f}: not JSON: ${e.message}`); continue; }
  for (const [k, v] of Object.entries(part)) {
    if (k === 'extra') { out.extra ??= {}; mergeExtra(out.extra, v); }
    else if (LIST_KEYS.includes(k)) { out[k] ??= []; out[k].push(...v); }
    else if (k in out) problems.push(`${f}: key ${k} defined twice`);
    else out[k] = v;
  }
}

// ---- checks ----
const pack = JSON.parse(readFileSync(join(repo, 'packs/cafe.json'), 'utf8'));
const common = JSON.parse(readFileSync(join(repo, 'packs/_common.json'), 'utf8'));
const cyr = /[А-Яа-яЁё]/;
const idRe = /^[a-z][a-z0-9_]*$/;
const INTENDED_FIXES = { levers: ['hours'] };

for (const key of LIST_KEYS.filter((k) => k !== 'sources')) {
  const seen = new Set();
  const existing = new Set([...(pack[key] || []), ...(common[key] || [])].map((x) => x.id));
  for (const it of out[key] || []) {
    if (!idRe.test(it.id || '')) problems.push(`${key}: bad id ${it.id}`);
    if (seen.has(it.id)) problems.push(`${key}: duplicate id ${it.id} inside the fragment`);
    seen.add(it.id);
    if (existing.has(it.id) && !(INTENDED_FIXES[key] || []).includes(it.id)) problems.push(`${key}: id ${it.id} already exists in the pack or _common`);
  }
}
const strings = [];
(function walk(x, path) {
  if (typeof x === 'string') strings.push([path, x]);
  else if (Array.isArray(x)) x.forEach((v, i) => walk(v, `${path}[${i}]`));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) walk(v, `${path}.${k}`);
})(out, '');
for (const [p, s] of strings) {
  if (cyr.test(s)) problems.push(`cyrillic in ${p}`);
  if (/[—–]/.test(s)) problems.push(`long dash in ${p}`);
}
for (const c of out.ruleCards || []) if (c.text.length > 280) problems.push(`ruleCard ${c.id}: ${c.text.length} chars`);

const near = (a, b, eps = 0.011) => Math.abs(a - b) <= eps;
const sum = (a) => a.reduce((x, y) => x + y, 0);
const ex = out.extra || {};
if (ex.weekdayMult && !near(sum(ex.weekdayMult), 7)) problems.push(`weekdayMult sums to ${sum(ex.weekdayMult)}`);
for (const [k, v] of Object.entries(ex.weekdayProfiles || {})) if (v && Array.isArray(v.mult) && !near(sum(v.mult), 7)) problems.push(`weekdayProfiles.${k} sums to ${sum(v.mult).toFixed(3)}`);
for (const k of ['neighborhood', 'office']) if (ex.hourCurve?.[k] && (!near(sum(ex.hourCurve[k]), 1, 0.001) || ex.hourCurve[k].length !== 24)) problems.push(`hourCurve.${k}: sum ${sum(ex.hourCurve[k])}, length ${ex.hourCurve[k].length}`);
for (const k of ['neighborhood', 'office', 'tourist']) if (ex.monthCurve?.[k] && (!near(sum(ex.monthCurve[k]), 12) || ex.monthCurve[k].length !== 12)) problems.push(`monthCurve.${k}: sum ${sum(ex.monthCurve[k])}`);
for (const [k, mix] of Object.entries(ex.guestSegments?.mixByBlock || {})) if (!near(sum(Object.values(mix)), 1, 0.001)) problems.push(`guestSegments.mixByBlock.${k} sums to ${sum(Object.values(mix))}`);
if (out.market) { const w = out.market.weights; if (!near(w.price + w.quality + w.reputation + w.location, 1, 0.001)) problems.push('market.weights do not sum to 1'); }

// every player move of a catalog event must exist
const leverIds = new Set([...(pack.levers || []), ...(out.levers || [])].map((l) => l.id));
const shortcutIds = new Set([...(pack.shortcuts || []), ...(common.shortcuts || []), ...(out.shortcuts || [])].map((s) => s.id));
const mechIds = new Set((ex.mechanics || []).map((m) => m.id));
const catIds = new Set();
for (const ev of ex.eventCatalog || []) {
  if (!idRe.test(ev.id || '')) problems.push(`eventCatalog: bad id ${ev.id}`);
  if (catIds.has(ev.id)) problems.push(`eventCatalog: duplicate ${ev.id}`);
  catIds.add(ev.id);
  for (const k of ['name', 'text', 'scale', 'realSignal', 'effects', 'durationMonths', 'playerMoves', 'tier', 'source', 'confidence', 'note']) if (ev[k] === undefined) problems.push(`eventCatalog ${ev.id}: no ${k}`);
  if (!['point', 'block', 'city', 'country', 'world'].includes(ev.scale)) problems.push(`eventCatalog ${ev.id}: scale ${ev.scale}`);
  if (!['core', 'deep', 'exotic'].includes(ev.tier)) problems.push(`eventCatalog ${ev.id}: tier ${ev.tier}`);
  if (!Array.isArray(ev.playerMoves) || ev.playerMoves.length === 0) problems.push(`eventCatalog ${ev.id}: no player move`);
  for (const m of ev.playerMoves || []) {
    if (m.kind === 'lever' && !leverIds.has(m.id)) problems.push(`eventCatalog ${ev.id}: lever ${m.id} unknown`);
    if (m.kind === 'shortcut' && !shortcutIds.has(m.id)) problems.push(`eventCatalog ${ev.id}: shortcut ${m.id} unknown`);
    if (m.kind === 'mechanic' && !mechIds.has(m.id)) problems.push(`eventCatalog ${ev.id}: mechanic ${m.id} unknown`);
    if (!['lever', 'shortcut', 'mechanic', 'price', 'staff'].includes(m.kind)) problems.push(`eventCatalog ${ev.id}: move kind ${m.kind}`);
  }
  if (!/^https?:\/\//.test(ev.source || '')) problems.push(`eventCatalog ${ev.id}: source`);
}
for (const m of ex.mechanics || []) {
  for (const k of ['id', 'title', 'playerDecision', 'engineMath', 'fieldsNeeded', 'numbers', 'tier']) if (m[k] === undefined) problems.push(`mechanic ${m.id}: no ${k}`);
  for (const n of m.numbers || []) if (!/^https?:\/\//.test(n.source || '') || !n.confidence) problems.push(`mechanic ${m.id}: number '${n.what}' lacks source or confidence`);
}

// sources list: every URL used anywhere
const urls = new Set();
for (const [, s] of strings) for (const m of s.match(/https?:\/\/[^\s"')]+/g) || []) urls.add(m.replace(/[.,;]$/, ''));
out.sources = [...urls].sort().map((url) => ({ url, checked: '2026-11-14', how: 'search result, page not opened' }));

const outPath = join(repo, 'packs/parts/cafe/D06-demand.json');
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');

// ---- trial merge into the real pack, for validate-pack ----
const merged = JSON.parse(JSON.stringify(pack));
for (const key of LIST_KEYS.filter((k) => k !== 'sources')) {
  for (const it of out[key] || []) {
    const i = (merged[key] || []).findIndex((x) => x.id === it.id);
    if (i >= 0) merged[key][i] = it; else (merged[key] ??= []).push(it);
  }
}
if (out.market) merged.market = out.market;
merged.extra = { ...(merged.extra || {}), ...(out.extra || {}) };
writeFileSync(join(here, 'cafe.trial.json'), JSON.stringify(merged, null, 2));

const count = (k) => (out[k] || []).length;
console.log(`levers ${count('levers')}, shortcuts ${count('shortcuts')}, violations ${count('violations')}, officials ${count('officials')}, reports ${count('reports')}, ruleCards ${count('ruleCards')}, suppliers ${count('suppliers')}, events ${count('events')}`);
console.log(`eventCatalog ${(ex.eventCatalog || []).length}, mechanics ${(ex.mechanics || []).length}, nonObvious ${(ex.nonObvious || []).length}, sources ${out.sources.length}`);
const tiers = {}; for (const ev of ex.eventCatalog || []) tiers[`${ev.scale}/${ev.tier}`] = (tiers[`${ev.scale}/${ev.tier}`] || 0) + 1;
console.log('catalog by scale/tier:', JSON.stringify(tiers));
if (problems.length) { console.log('PROBLEMS:'); for (const p of problems) console.log('  - ' + p); process.exit(1); }
console.log('OK ->', outPath);
