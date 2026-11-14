import { readFileSync, writeFileSync } from 'node:fs';
import { SRC, used, u } from './src.mjs';
import * as p1 from './p1.mjs';
import * as p2 from './p2.mjs';
import * as p3 from './p3.mjs';
import * as p4 from './p4.mjs';
const repo = '/home/user/OHHHeaven';
const cafe = JSON.parse(readFileSync(repo + '/packs/cafe.json', 'utf8'));
const common = JSON.parse(readFileSync(repo + '/packs/_common.json', 'utf8'));

const frag = {
  id: 'cafe', fragment: 'D09-money', researcher: 'D09', topic: 'Money, taxes, insurance, exit', checked: '2026-11-14',
  taxes: p1.taxes, monthlyCosts: p1.monthlyCosts, setup: p1.setup, levers: p1.levers,
  shortcuts: p2.shortcuts, violations: p2.violations, officials: p2.officials, reports: p2.reports,
  events: p2.events, ruleCards: p2.ruleCards, roadmap: p2.roadmap, suppliers: p2.suppliers,
  extra: {
    howNumbersWereChecked: 'November 14, 2026. The sandbox blocked direct page fetches (sba.gov, tax.ny.gov, irs.gov, squareup.com and others returned a proxy refusal), so every primary source was read through a web search restricted to that source\'s own domain, which returns the text of the page. verified = the number came back from the primary source\'s own page that way. estimate = a secondary source, a number carried over from the existing pack, a planning value, or my own arithmetic; the note says which. Game-balance values (demand effects, deductibles, renewal surcharges, days frozen, auction recovery) are design choices and are labelled as such.',
    eventCatalog: p3.eventCatalog, effectFields: p3.effectFields, mechanics: p4.mechanics,
    financing: p4.financing, paymentCalendar: p4.paymentCalendar, ownerTaxExamples: p4.ownerTaxExamples, ubtSchedule: p4.ubtSchedule,
    taxCredits: p4.taxCredits, exitWaterfalls: p4.exitWaterfalls, nonObvious: p4.nonObvious, failureStories: p4.failureStories,
    corrections: p4.corrections, mergeNotes: p4.mergeNotes,
  },
};
frag.sources = [...used].map((k) => ({ url: SRC[k][0], title: SRC[k][1], checked: '2026-11-14' }));

// ───── checks ─────
const errs = [], warns = [];
const ids = (a) => a.map((x) => x.id);
const dup = (a) => a.filter((x, i) => a.indexOf(x) !== i);
const lists = ['taxes', 'monthlyCosts', 'setup', 'levers', 'shortcuts', 'violations', 'officials', 'reports', 'events', 'ruleCards', 'roadmap', 'suppliers'];
const intended = { taxes: ['sales_tax'], monthlyCosts: ['insurance'] };
for (const k of lists) {
  const mine = ids(frag[k]);
  for (const d of dup(mine)) errs.push(`${k}: duplicate id ${d}`);
  const existing = new Set([...(cafe[k] || []).map((x) => x.id), ...((common[k] || []).map((x) => x.id))]);
  for (const id of mine) if (existing.has(id) && !(intended[k] || []).includes(id)) errs.push(`${k}: id ${id} already exists in the pack`);
  for (const id of mine) if (!/^[a-z][a-z0-9_]*$/.test(id)) errs.push(`${k}: bad id ${id}`);
}
for (const d of dup(ids(frag.extra.eventCatalog))) errs.push(`eventCatalog duplicate ${d}`);
for (const d of dup(ids(frag.extra.mechanics))) errs.push(`mechanics duplicate ${d}`);
const allViol = new Set([...ids(frag.violations), ...ids(cafe.violations), ...ids(common.violations)]);
const allOff = new Set([...ids(frag.officials), ...ids(cafe.officials), ...ids(common.officials)]);
const allLev = new Set([...ids(frag.levers), ...ids(cafe.levers)]);
const allShort = new Set([...ids(frag.shortcuts), ...ids(cafe.shortcuts), ...ids(common.shortcuts)]);
const allMech = new Set(ids(frag.extra.mechanics));
const allSetup = new Set([...ids(frag.setup), ...ids(cafe.setup)]);
const evIds = new Set([...ids(frag.extra.eventCatalog), ...ids(frag.events), ...ids(cafe.events)]);
for (const s of frag.shortcuts) if (!allViol.has(s.violation)) errs.push(`shortcut ${s.id}: no violation ${s.violation}`);
for (const v of frag.violations) { if (!allOff.has(v.official)) errs.push(`violation ${v.id}: no official ${v.official}`); }
for (const o of [...frag.officials, ...frag.reports]) for (const c of o.checks) if (!allViol.has(c)) errs.push(`${o.id}: checks unknown ${c}`);
for (const s of frag.setup) if (s.withoutItViolation && !allViol.has(s.withoutItViolation)) errs.push(`setup ${s.id}: unknown violation`);
for (const r of frag.roadmap) if (r.setupItemId && !allSetup.has(r.setupItemId)) errs.push(`roadmap ${r.id}: unknown setup ${r.setupItemId}`);
for (const l of frag.levers) for (const o of l.options) for (const c of (o.covers || [])) if (!evIds.has(c)) errs.push(`lever ${l.id}.${o.id}: covers unknown event ${c}`);
const reach = new Set([...frag.shortcuts.map((s) => s.violation), ...frag.setup.map((s) => s.withoutItViolation)]);
for (const v of frag.violations) if (!reach.has(v.id)) warns.push(`violation ${v.id} not reachable`);
for (const e of frag.extra.eventCatalog) {
  for (const f of ['id', 'name', 'text', 'scale', 'trigger', 'realSignal', 'effects', 'durationMonths', 'playerMoves', 'realFrequency', 'tier', 'source', 'confidence', 'note']) if (e[f] === undefined) errs.push(`event ${e.id}: missing ${f}`);
  if (!Array.isArray(e.months)) errs.push(`event ${e.id}: months`);
  if (!['point', 'block', 'city', 'country', 'world'].includes(e.scale)) errs.push(`event ${e.id}: scale`);
  if (!['core', 'deep', 'exotic'].includes(e.tier)) errs.push(`event ${e.id}: tier`);
  if (!e.playerMoves.length) errs.push(`event ${e.id}: no player move`);
  for (const m of e.playerMoves) { const set = m.kind === 'lever' ? allLev : m.kind === 'shortcut' ? allShort : allMech; if (!set.has(m.id)) errs.push(`event ${e.id}: unknown ${m.kind} ${m.id}`); }
}
for (const m of frag.extra.mechanics) for (const f of ['id', 'title', 'playerDecision', 'engineMath', 'fieldsNeeded', 'numbers', 'tier']) if (m[f] === undefined) errs.push(`mechanic ${m.id}: missing ${f}`);
for (const c of frag.ruleCards) if (c.text.length > 280) errs.push(`ruleCard ${c.id}: ${c.text.length} chars`);
const cyr = /[А-Яа-яЁё]/; if (cyr.test(JSON.stringify(frag))) errs.push('cyrillic text inside the fragment');
// every sourced entry has source + confidence + note when estimate
const walk = (o, path) => { if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${path}[${x && x.id ? x.id : i}]`)); else if (o && typeof o === 'object') { if ('confidence' in o) { if (!['verified', 'estimate'].includes(o.confidence)) errs.push(`${path}: confidence`); if (!o.source || !/^https?:\/\//.test(o.source)) errs.push(`${path}: source`); } for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`); } };
walk(frag, 'frag');

const out = repo + '/packs/parts/cafe/D09-money.json';
writeFileSync(out, JSON.stringify(frag, null, 2) + '\n');

// merged view for the validator
const merged = JSON.parse(JSON.stringify(cafe));
for (const k of lists) { const map = new Map((merged[k] || []).map((x) => [x.id, x])); for (const x of frag[k]) map.set(x.id, x); merged[k] = [...map.values()]; }
merged.extra = { ...merged.extra, ...frag.extra };
merged.sources = [...merged.sources, ...frag.sources];
writeFileSync('/tmp/claude-0/-home-user-OHHHeaven/69367581-b6cb-521a-8dcb-00a3124c046b/scratchpad/build/merged.json', JSON.stringify(merged, null, 2));

const conf = { verified: 0, estimate: 0 };
const cnt = (o) => { if (Array.isArray(o)) o.forEach(cnt); else if (o && typeof o === 'object') { if (o.confidence) conf[o.confidence]++; Object.values(o).forEach(cnt); } };
cnt(frag);
const counts = Object.fromEntries(lists.map((k) => [k, frag[k].length]));
Object.assign(counts, { eventCatalog: frag.extra.eventCatalog.length, mechanics: frag.extra.mechanics.length, financing: frag.extra.financing.length, paymentCalendar: frag.extra.paymentCalendar.rows.length, nonObvious: frag.extra.nonObvious.length, failureStories: frag.extra.failureStories.length, corrections: frag.extra.corrections.length, sources: frag.sources.length });
const tiers = {}; for (const e of frag.extra.eventCatalog) tiers[e.tier] = (tiers[e.tier] || 0) + 1;
const trig = {}; for (const e of frag.extra.eventCatalog) { const t = e.trigger.split(':')[0]; trig[t] = (trig[t] || 0) + 1; }
console.log(JSON.stringify({ counts, confidence: conf, tiers, triggers: trig, bytes: JSON.stringify(frag).length }, null, 1));
for (const w of warns) console.log('WARN ', w);
for (const e of errs) console.log('ERROR', e);
console.log(errs.length ? 'FAILED' : 'OK');
process.exit(errs.length ? 1 : 0);
