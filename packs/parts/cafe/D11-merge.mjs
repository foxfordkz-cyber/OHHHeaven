#!/usr/bin/env node
// D11 — сборщик фрагментов кафе в packs/cafe.next.json.
// Запуск из корня репозитория: node packs/parts/cafe/D11-merge.mjs
// Вход: packs/parts/cafe/D11-base.json (пакет кафе v2 из ветки keen-cray = main + спрос по прохожим и ремонт по площади),
//       все packs/parts/cafe/DNN-*.json (D00–D19), решения D11-decisions.mjs.
// Выход: packs/cafe.next.json, packs/parts/cafe/D11-reference.json (справочник, который не нужен движку),
//        packs/parts/cafe/D11-merge-log.json (что откуда взято, повторы, противоречия).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from './D11-decisions.mjs';
import { mechanicsRanked } from './D11-mechanics-ranked.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const base = read(path.join(HERE, 'D11-base.json'));
const common = read(path.join(ROOT, 'packs/_common.json'));

// Фрагменты: основной JSON каждого задания. Служебные файлы D00 (аудит, дедупликация) читаются отдельно.
const SKIP = /audit|dedup|validation|reference|merge-log|base|\.common\./;
const fragFiles = fs.readdirSync(HERE).filter((f) => /^D\d\d-.*\.json$/.test(f) && !SKIP.test(f)).sort();
const frags = fragFiles.map((f) => ({ tag: f.slice(0, 3), file: f, calib: /calibration/.test(f), p: read(path.join(HERE, f)) }));

const SECTIONS = ['setup', 'monthlyCosts', 'staff', 'taxes', 'levers', 'shortcuts', 'violations', 'officials', 'reports', 'events', 'ruleCards', 'roadmap', 'suppliers'];
// Владельцы тем: их запись важнее при равной достоверности.
const OWNER = {
  setup: ['D03', 'D01', 'D02', 'D14'], monthlyCosts: ['D09', 'D03', 'D05'], staff: ['D05'], taxes: ['D09'],
  levers: [], shortcuts: ['D08'], violations: ['D08'], officials: ['D08'], reports: ['D08'], events: ['D07', 'D06', 'D04'],
  ruleCards: ['D08'], roadmap: ['D01', 'D14'], suppliers: ['D04'],
};
const GOV = /\b(nyc\.gov|ny\.gov|\.gov\/|\.gov$|irs\.gov|bls\.gov|dol\.gov|sba\.gov|ecfr\.gov|law\.cornell\.edu|codelibrary\.amlegal\.com|nysenate\.gov|govt\.westlaw|rules\.cityofnewyork\.us|nycourts\.gov|legistar)/;
const isGov = (u) => typeof u === 'string' && GOV.test(u);
const nameOf = (r) => r.name || r.title || r.category;
// Запись без обязательных полей раздела — это правка (патч) существующей записи, а не новая запись.
const REQUIRED = {
  setup: ['name', 'kind', 'cost', 'required'], monthlyCosts: ['name', 'kind', 'basis', 'amount'], staff: ['name', 'hourlyWage', 'hoursPerMonth'],
  taxes: ['name', 'base', 'rate', 'due'], levers: ['name', 'options'], shortcuts: ['name', 'what', 'saves', 'violation'],
  violations: ['name', 'law', 'official', 'foundBy', 'fine'], officials: ['name', 'agency', 'role'], reports: ['name', 'text', 'role', 'checks'],
  events: ['name', 'effect', 'months'], ruleCards: ['title', 'text'], roadmap: ['title', 'text', 'kind'], suppliers: ['category', 'what', 'whereToFind'],
};
const isPartial = (sec, r) => (REQUIRED[sec] || ['name']).some((k) => r[k] === undefined || r[k] === null);

const log = { inputs: fragFiles, base: 'D11-base.json', sections: {}, contradictions: [], aliasesApplied: [], moved: [], dropped: [], refFixes: [] };

// ---------- карта псевдонимов ----------
const aliasOf = (sec, id) => (D.alias[sec] && D.alias[sec][id]) || id;
const violationAlias = (id) => aliasOf('violations', id);
const officialAlias = (id) => aliasOf('officials', id);

// ---------- сбор кандидатов ----------
function score(sec, tag, r) {
  let s = 0;
  if (r.confidence === 'verified') s += 4;
  if (isGov(r.source)) s += 2;
  const own = OWNER[sec] || [];
  if (own.includes(tag)) s += 3 - own.indexOf(tag) * 0.3;
  if (tag === 'D00') s -= 1;            // D00 даёт в основном правки-аудиты, а не новые записи
  s += Math.min(JSON.stringify(r).length, 4000) / 40000; // чуть выше — у более полной записи
  return s;
}

const NUMERIC = { setup: ['cost', 'waitDays', 'lifespanMonths'], monthlyCosts: ['amount'], staff: ['hourlyWage', 'cashWage', 'hoursPerMonth'], taxes: ['rate'], violations: ['fine.base', 'fine.perMonth', 'fine.max', 'closureDays'], events: ['effect.mult', 'months'] };
const getp = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);

const merged = {};
const formatRecords = {};
const moveToFormats = (sec, rec, why) => { (formatRecords[sec] ||= []).push(rec); log.moved.push({ section: sec, id: rec.id, to: 'extra.formatRecords', why }); };

for (const sec of SECTIONS) {
  const groups = new Map(); // canonical id -> [{tag, r, partial}]
  const add = (tag, r) => {
    if (!r || !r.id) return;
    const cid = aliasOf(sec, r.id);
    if (cid !== r.id) log.aliasesApplied.push({ section: sec, from: r.id, to: cid, fragment: tag });
    if (!groups.has(cid)) groups.set(cid, []);
    groups.get(cid).push({ tag, r, partial: tag !== 'BASE' && isPartial(sec, r) });
  };
  for (const r of base[sec] || []) add('BASE', r);
  for (const f of frags) for (const r of f.p[sec] || []) add(f.tag, r);

  const out = [];
  const stat = { base: (base[sec] || []).length, candidates: 0, unique: 0, fixesOfBase: 0, newRecords: 0, multiSource: 0 };
  for (const [cid, cands] of groups) {
    stat.candidates += cands.length;
    const baseRec = cands.find((c) => c.tag === 'BASE');
    const patches = cands.filter((c) => c.partial);
    const full = cands.filter((c) => !c.partial && c.tag !== 'BASE');
    const pref = D.prefer[sec] && D.prefer[sec][cid];
    full.sort((a, b) => score(sec, a.tag, a.r) - score(sec, b.tag, b.r));
    // D12 — проверка чисел существующего пакета по первоисточникам: её правка записи из основы важнее оценок других фрагментов
    const d12 = baseRec && !pref && full.findIndex((c) => c.tag === 'D12');
    if (d12 !== false && d12 >= 0) full.push(full.splice(d12, 1)[0]);
    if (pref) { const i = full.findIndex((c) => c.tag === pref); if (i >= 0) full.push(full.splice(i, 1)[0]); }
    const winner = full[full.length - 1];
    let rec = baseRec ? structuredClone(baseRec.r) : {};
    for (const p of patches.sort((a, b) => score(sec, a.tag, a.r) - score(sec, b.tag, b.r))) {
      const { id, ...rest } = p.r;
      if (rest.fine && rec.fine) rest.fine = { ...rec.fine, ...rest.fine };
      rec = { ...rec, ...rest };
    }
    if (winner) {
      const keepEngine = {};
      if (baseRec) for (const k of ['costBasis', 'rate', 'afterBuildout', 'includedInTakeover', 'scalesWithSize']) if (baseRec.r[k] !== undefined && winner.r[k] === undefined) keepEngine[k] = baseRec.r[k];
      rec = { ...structuredClone(winner.r), ...keepEngine };
    }
    if (!rec.id && !winner && patches.length) { log.dropped.push({ section: sec, id: cid, why: 'only partial patches without a base record' }); continue; }
    rec.id = cid;
    // противоречия в числах между версиями
    for (const p of NUMERIC[sec] || []) {
      const vals = cands.map((c) => ({ tag: c.tag, id: c.r.id, v: getp(c.r, p), conf: c.r.confidence, src: c.r.source })).filter((x) => typeof x.v === 'number');
      const uniq = [...new Set(vals.map((x) => x.v))];
      if (uniq.length > 1) log.contradictions.push({ section: sec, id: cid, field: p, chosen: getp(rec, p), values: vals });
    }
    const from = [...new Set(cands.map((c) => c.tag))];
    if (baseRec && from.length > 1) stat.fixesOfBase++;
    if (!baseRec) stat.newRecords++;
    if (from.filter((t) => t !== 'BASE').length > 1) stat.multiSource++;
    out.push({ rec, from, winner: winner ? winner.tag : baseRec ? 'BASE' : patches[0]?.tag, ids: [...new Set(cands.map((c) => c.r.id))] });
  }
  stat.unique = out.length;
  merged[sec] = out;
  log.sections[sec] = stat;
}

// ---------- перенос в форматы, условные расходы, решения до открытия ----------
const provenance = {};
const finalSec = {};
for (const sec of SECTIONS) {
  const keep = [];
  for (const x of merged[sec]) {
    const r = x.rec;
    const dropWhy = D.drop[sec] && D.drop[sec][r.id];
    if (dropWhy) { log.dropped.push({ section: sec, id: r.id, why: dropWhy }); continue; }
    const fmt = (D.toFormats[sec] || []).includes(r.id) || (Array.isArray(r.formats) && !r.formats.includes('cafe')) || (Array.isArray(r.appliesTo) && sec !== 'setup' && r.appliesTo.every((a) => /cart|franchise|popup|market|kiosk|truck/.test(a)));
    if (fmt) { moveToFormats(sec, { ...r, from: x.from }, Array.isArray(r.formats) ? 'formats: ' + r.formats.join(', ') : 'another format or entry mode'); continue; }
    if (sec === 'monthlyCosts' && (D.conditionalCosts[r.id] || r.optional === true || r.fromMonth || r.activeWhen)) {
      (formatRecords.__conditional ||= []).push({ ...r, activeWhen: D.conditionalCosts[r.id] || r.activeWhen || (r.fromMonth ? `from month ${r.fromMonth}` : 'optional'), from: x.from });
      log.moved.push({ section: sec, id: r.id, to: 'extra.conditionalMonthlyCosts', why: D.conditionalCosts[r.id] || 'optional / activeWhen' });
      continue;
    }
    if (sec === 'levers' && (D.preOpening.includes(r.id) || r.oneTime === true || r.phase === 'preopening' || r.phase === 'pre_opening')) {
      (formatRecords.__preOpening ||= []).push({ ...r, from: x.from });
      log.moved.push({ section: sec, id: r.id, to: 'extra.preOpeningChoices', why: 'decided once before opening, not a monthly lever' });
      continue;
    }
    if (D.override[sec] && D.override[sec][r.id]) { Object.assign(r, structuredClone(D.override[sec][r.id])); log.overrides = [...(log.overrides || []), `${sec}.${r.id}`]; }
    if (sec === 'levers' && D.leverOptions && D.leverOptions[r.id]) {
      const lo = D.leverOptions[r.id];
      if (lo.order) r.options = [...lo.order.map((id) => r.options.find((o) => o.id === id)).filter(Boolean), ...r.options.filter((o) => !lo.order.includes(o.id))];
      if (lo.cost) for (const o of r.options) if (lo.cost[o.id] !== undefined) { o.note = `D11: was $${o.monthlyCost}. ${lo.why}`; o.monthlyCost = lo.cost[o.id]; }
      r.d11 = lo.why;
      log.overrides = [...(log.overrides || []), `levers.${r.id}`];
    }
    keep.push(r);
    (provenance[sec] ||= {})[r.id] = { from: x.from, chosen: x.winner, ...(x.ids.length > 1 ? { mergedIds: x.ids } : {}) };
  }
  finalSec[sec] = keep;
}

// ---------- ссылки ----------
const leverAlias = (id) => aliasOf('levers', id);
const shortcutAlias = (id) => aliasOf('shortcuts', id);
for (const v of finalSec.violations) { const o = officialAlias(v.official); if (o !== v.official) { log.refFixes.push({ at: `violations.${v.id}.official`, from: v.official, to: o }); v.official = o; } }
for (const s of finalSec.shortcuts) { const v = violationAlias(s.violation); if (v !== s.violation) { log.refFixes.push({ at: `shortcuts.${s.id}.violation`, from: s.violation, to: v }); s.violation = v; } }
for (const l of finalSec.levers) for (const o of l.options || []) if (o.causes) { const v = violationAlias(o.causes); if (v !== o.causes) { log.refFixes.push({ at: `levers.${l.id}.${o.id}.causes`, from: o.causes, to: v }); o.causes = v; } }
for (const st of finalSec.setup) if (st.withoutItViolation) st.withoutItViolation = violationAlias(st.withoutItViolation);
for (const o of finalSec.officials) o.checks = [...new Set((o.checks || []).map(violationAlias))];
for (const r of finalSec.reports) r.checks = [...new Set((r.checks || []).map(violationAlias))];
for (const r of finalSec.roadmap) if (r.setupItemId) r.setupItemId = aliasOf('setup', r.setupItemId);

const ids = (sec) => new Set(finalSec[sec].map((x) => x.id));
const vIds = new Set([...ids('violations'), ...common.violations.map((v) => v.id)]);
const oIds = new Set([...ids('officials'), ...common.officials.map((v) => v.id)]);
// нарушение без своего чиновника, ярлык без нарушения, жалоба без нарушений — чиним или выносим
for (const v of [...finalSec.violations]) if (!oIds.has(v.official)) { log.refFixes.push({ at: `violations.${v.id}.official`, from: v.official, to: '(missing official)' }); }
for (const s of [...finalSec.shortcuts]) if (!vIds.has(s.violation)) { finalSec.shortcuts = finalSec.shortcuts.filter((x) => x !== s); moveToFormats('shortcuts', s, `its violation ${s.violation} is not in the cafe pack`); }
for (const l of finalSec.levers) for (const o of l.options || []) if (o.causes && !vIds.has(o.causes)) { log.refFixes.push({ at: `levers.${l.id}.${o.id}.causes`, from: o.causes, to: null }); delete o.causes; }
for (const st of finalSec.setup) if (st.withoutItViolation && !vIds.has(st.withoutItViolation)) { log.refFixes.push({ at: `setup.${st.id}.withoutItViolation`, from: st.withoutItViolation, to: null }); delete st.withoutItViolation; }
for (const o of finalSec.officials) {
  // чиновник проверяет всё, что ему приписано в нарушениях
  for (const v of finalSec.violations) if (v.official === o.id && !o.checks.includes(v.id)) o.checks.push(v.id);
  const before = o.checks.length; o.checks = o.checks.filter((c) => vIds.has(c));
  if (o.checks.length !== before) log.refFixes.push({ at: `officials.${o.id}.checks`, removed: before - o.checks.length });
}
for (const r of [...finalSec.reports]) { r.checks = r.checks.filter((c) => vIds.has(c)); if (!r.checks.length) { finalSec.reports = finalSec.reports.filter((x) => x !== r); moveToFormats('reports', r, 'no cafe violation left to report'); } }
const setupIds = ids('setup');
for (const r of finalSec.roadmap) if (r.setupItemId && !setupIds.has(r.setupItemId)) { log.refFixes.push({ at: `roadmap.${r.id}.setupItemId`, from: r.setupItemId, to: null }); delete r.setupItemId; }
// чиновники из _common не переопределяем: если id совпал — убираем локальную копию
for (const o of [...finalSec.officials]) if (common.officials.some((c) => c.id === o.id)) { finalSec.officials = finalSec.officials.filter((x) => x !== o); log.dropped.push({ section: 'officials', id: o.id, why: 'already in _common' }); }
for (const s of [...finalSec.shortcuts]) if (common.shortcuts.some((c) => c.id === s.id)) { finalSec.shortcuts = finalSec.shortcuts.filter((x) => x !== s); log.dropped.push({ section: 'shortcuts', id: s.id, why: 'already in _common' }); }
for (const v of [...finalSec.violations]) if (common.violations.some((c) => c.id === v.id)) { finalSec.violations = finalSec.violations.filter((x) => x !== v); log.dropped.push({ section: 'violations', id: v.id, why: 'already in _common' }); }
for (const t of [...finalSec.taxes]) if (common.taxes.some((c) => c.id === t.id)) { finalSec.taxes = finalSec.taxes.filter((x) => x !== t); log.dropped.push({ section: 'taxes', id: t.id, why: 'already in _common (would be charged twice)' }); }

// ---------- верхний уровень ----------
const pack = structuredClone(base);
pack.version = 3;
const lastObj = (key) => { let v = null; for (const f of frags) if (f.p[key] && typeof f.p[key] === 'object' && !Array.isArray(f.p[key])) v = { tag: f.tag, v: f.p[key] }; return v; };
const topFrom = {};
for (const key of ['unit', 'market', 'capacity', 'sizing', 'benchmarks', 'manager']) {
  const owners = { market: 'D06', sizing: 'D02', manager: 'D05', capacity: null, benchmarks: 'D00', unit: 'D12' };
  let src = null;
  for (const f of frags) if (f.p[key] && typeof f.p[key] === 'object') { if (!src || f.tag === owners[key]) src = { tag: f.tag, v: f.p[key] }; }
  if (src) { pack[key] = { ...pack[key], ...structuredClone(src.v) }; topFrom[key] = src.tag; }
}
for (const sec of SECTIONS) pack[sec] = finalSec[sec];

// ---------- план открытия: один основной путь по порядку, другие пути — отдельно ----------
const roadmapPaths = {};
const pathOf = (id) => Object.entries(D.roadmapPaths || {}).find(([, ids]) => ids.includes(id))?.[0];
const mainSteps = [];
for (const r of pack.roadmap) { const pth = pathOf(r.id) || (r.path && !['all', 'scratch'].includes(r.path) ? r.path : null); if (pth) (roadmapPaths[pth] ||= []).push(r); else mainSteps.push(r); }
const ord = new Map((D.roadmapOrder || []).map((id, i) => [id, i]));
const unordered = mainSteps.filter((r) => !ord.has(r.id));
if (unordered.length) log.roadmapUnordered = unordered.map((r) => r.id);
const KIND_ORDER = ['idea', 'money', 'space', 'legal', 'permit', 'supplier', 'people', 'launch'];
pack.roadmap = mainSteps.sort((a, b) => (ord.has(a.id) ? ord.get(a.id) : 1000 + KIND_ORDER.indexOf(a.kind)) - (ord.has(b.id) ? ord.get(b.id) : 1000 + KIND_ORDER.indexOf(b.kind)))
  .map(({ order, path: _p, ...r }) => r);
for (const [k, v] of Object.entries(roadmapPaths)) roadmapPaths[k] = v.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

// ---------- наборы: все обязательные предметы, бюджет ----------
const setupById = new Map(pack.setup.map((s) => [s.id, s]));
const kitSrc = frags.find((f) => Array.isArray(f.p.kits))?.p.kits || base.kits;
pack.kits = kitSrc.map((k) => {
  const items = k.items.map((it) => ({ ...it, id: aliasOf('setup', it.id) })).filter((it) => setupById.has(it.id));
  const have = new Set(items.map((i) => i.id));
  for (const s of pack.setup) if (s.required && !have.has(s.id)) { items.push({ id: s.id, qty: 1 }); log.refFixes.push({ at: `kits.${k.id}`, added: s.id }); }
  const { note, ...rest } = k;
  return { ...rest, items };
});

// ---------- extra ----------
const extra = structuredClone(base.extra || {});
const ref = { eventCatalog: [], eventCatalogFull: [], nonObvious: [], failureStories: [], parts: {} };
// значения для движка, которые фрагменты уточнили
const extraOverride = { weekdayMult: 'D06', weekdayMultNote: 'D06', seatThresholds: 'D02', taxableShare: 'D04', taxableShareNote: 'D04', tipCredit: 'D12', takeover: 'D12' };
for (const [k, tag] of Object.entries(extraOverride)) { const f = frags.find((x) => x.tag === tag); if (f && f.p.extra && f.p.extra[k] !== undefined) { extra[k] = structuredClone(f.p.extra[k]); topFrom['extra.' + k] = tag; } }

// каталог событий: один id, псевдонимы, ходы игрока с новыми id
const evAlias = {}; // id -> canonical
const STOP = new Set('a an the of to and or for in on at by with your you is are be it its not no new old per as into out up off this that'.split(' '));
const toks = (s) => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)).map((w) => w.replace(/(ing|es|s)$/, '')));
const jac = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };
const cat = new Map();
const hasNums = (e) => Array.isArray(e.effects) && e.effects.length > 0;
for (const f of frags) if (!f.calib) for (const e of (f.p.extra && f.p.extra.eventCatalog) || []) {
  const cid = (D.alias.events && D.alias.events[e.id]) || e.id;
  const rec = { ...e, id: cid, from: [f.tag] };
  if (!cat.has(cid)) { cat.set(cid, rec); continue; }
  const cur = cat.get(cid);
  // запись с числами важнее записи без чисел, потом verified
  const better = (hasNums(rec) && !hasNums(cur)) || (hasNums(rec) === hasNums(cur) && rec.confidence === 'verified' && cur.confidence !== 'verified');
  const moves = [...(cur.playerMoves || []), ...(rec.playerMoves || [])];
  const merged2 = better ? { ...rec, from: [...cur.from, f.tag] } : { ...cur, from: [...cur.from, f.tag] };
  merged2.playerMoves = moves;
  merged2.aliases = [...new Set([...(cur.aliases || []), ...(rec.aliases || []), e.id].filter((x) => x !== cid))];
  cat.set(cid, merged2);
}
// похожие события из разных фрагментов: одно и то же под разными id (имя совпадает на 75% и больше)
const evs = [...cat.values()];
const tk = evs.map((e) => toks(e.name));
const absorbed = new Set();
for (let i = 0; i < evs.length; i++) {
  if (absorbed.has(i)) continue;
  for (let j = i + 1; j < evs.length; j++) {
    if (absorbed.has(j)) continue;
    if (evs[i].from.some((t) => evs[j].from.includes(t))) continue; // внутри одного фрагмента повторов не ищем
    if (jac(tk[i], tk[j]) < 0.75) continue;
    const [keep, lose] = hasNums(evs[j]) && !hasNums(evs[i]) ? [j, i] : [i, j];
    const a = evs[keep], b = evs[lose];
    a.from = [...new Set([...a.from, ...b.from])];
    a.aliases = [...new Set([...(a.aliases || []), b.id, ...(b.aliases || [])])];
    a.playerMoves = [...(a.playerMoves || []), ...(b.playerMoves || [])];
    evAlias[b.id] = a.id;
    absorbed.add(lose);
    if (lose === i) break;
  }
}
const leverIds = new Set(pack.levers.map((l) => l.id)), shortcutIds = new Set(pack.shortcuts.map((s) => s.id)), commonSc = new Set(common.shortcuts.map((s) => s.id));
const preIds = new Set((formatRecords.__preOpening || []).map((l) => l.id));
const catalog = [];
for (let i = 0; i < evs.length; i++) if (!absorbed.has(i)) catalog.push(evs[i]);
// калибровка D15–D19: числа поверх события с тем же id (или его псевдонимом); калибровка важнее исходной записи
const byAnyId = new Map(); for (const e of catalog) { byAnyId.set(e.id, e); for (const a of e.aliases || []) byAnyId.set(a, e); }
log.calibration = { applied: 0, newEvents: 0, files: frags.filter((f) => f.calib).map((f) => f.file) };
log.calibration.duplicatesMerged = [];
for (const f of frags) if (f.calib) for (const c of [...((f.p.extra && f.p.extra.eventCatalog) || []), ...((f.p.extra && f.p.extra.eventCalibration) || [])]) {
  const t = byAnyId.get(c.id) || byAnyId.get(evAlias[c.id]) || byAnyId.get((D.alias.events || {})[c.id]);
  // калибровщик нашёл, что событие D00 повторяет событие другого фрагмента: склеиваем
  const dup = c.duplicateOf && byAnyId.get(c.duplicateOf);
  if (dup && t && dup !== t) {
    dup.aliases = [...new Set([...(dup.aliases || []), t.id, ...(t.aliases || [])])];
    dup.playerMoves = [...(dup.playerMoves || []), ...(t.playerMoves || [])];
    dup.from = [...new Set([...(dup.from || []), ...(t.from || []), f.tag])];
    evAlias[t.id] = dup.id;
    const i = catalog.indexOf(t); if (i >= 0) catalog.splice(i, 1);
    byAnyId.set(t.id, dup);
    log.calibration.duplicatesMerged.push(`${t.id} -> ${dup.id}`);
    continue;
  }
  const { id, from: _f, sourceFragment: _s, duplicateOf: _d, ...rest } = c;
  if (t) { Object.assign(t, rest, { calibrated: f.tag, from: [...new Set([...(t.from || []), f.tag])] }); log.calibration.applied++; }
  else { catalog.push({ ...rest, id: c.id, from: [f.tag], calibrated: f.tag }); byAnyId.set(c.id, catalog[catalog.length - 1]); log.calibration.newEvents++; }
}
// ходы игрока — по новым id; поле эффекта — по словарю синонимов
const FIELD_SYN = D.effectFieldSynonyms || {};
const fieldStat = {};
for (const e of catalog) {
  const seen = new Set();
  e.playerMoves = (e.playerMoves || []).map((m) => {
    if (!m || typeof m !== 'object') return m;
    const kind = m.kind;
    const id = kind === 'lever' ? leverAlias(m.id) : kind === 'shortcut' ? shortcutAlias(m.id) : m.id;
    const where = kind === 'lever' ? (leverIds.has(id) ? 'levers' : preIds.has(id) ? 'extra.preOpeningChoices' : 'missing') : kind === 'shortcut' ? (shortcutIds.has(id) || commonSc.has(id) ? 'shortcuts' : 'missing') : 'other';
    return { ...m, id, ...(where === 'missing' ? { inPack: false } : {}) };
  }).filter((m) => { const k = JSON.stringify([m && m.kind, m && m.id]); if (seen.has(k)) return false; seen.add(k); return true; });
  e.effects = (e.effects || []).map((ef) => {
    if (!ef || typeof ef !== 'object') return ef;
    const syn = FIELD_SYN[ef.field];
    let out = ef;
    if (syn) { out = { ...ef, field: syn.field }; if (syn.valueToAdd && typeof ef.value === 'number') { out.add = syn.sign * ef.value; delete out.value; } }
    if (typeof out.amount === 'number' && out.add === undefined && out.mult === undefined) { out = { ...out, add: out.amount }; delete out.amount; }
    if (out.field === 'violation' && out.id) out.id = violationAlias(out.id);
    (fieldStat[out.field] ||= { count: 0, ops: new Set() }).count++;
    for (const op of ['mult', 'add', 'value', 'formula', 'id']) if (out[op] !== undefined) fieldStat[out.field].ops.add(op);
    return out;
  });
}
// словарь полей эффектов: что уже понимает движок, что нужно добавить
const ENGINE_FIELDS = new Set(['demand', 'cogs', 'staffAvailability', 'footTraffic', 'utilities', 'deliveryShare', 'rent', 'wages', 'inspections']);
const LEVER_FIELDS = new Set(['quality', 'reputation', 'capacity']);
extra.effectFields = Object.fromEntries(Object.entries(fieldStat).sort((x, y) => y[1].count - x[1].count).map(([k, v]) => [k, { events: v.count, ops: [...v.ops], engine: ENGINE_FIELDS.has(k) ? 'EventEffect target' : LEVER_FIELDS.has(k) ? 'lever effect only' : 'new', ...(D.effectFieldMeaning && D.effectFieldMeaning[k] ? { meaning: D.effectFieldMeaning[k] } : {}) }]));
// в пакет — события с числами (движок может их считать), в коротком виде; полные записи и события без чисел — в справочник
const SLIM = ['id', 'name', 'text', 'scale', 'months', 'durationMonths', 'trigger', 'realSignal', 'effects', 'playerMoves', 'realFrequency', 'tier', 'source', 'confidence', 'note', 'aliases', 'calibrated', 'from', 'formats', 'appliesTo', 'downtimeDays', 'oneTimeCost', 'closureDays', 'daily'];
const slim = (e) => Object.fromEntries(SLIM.filter((k) => e[k] !== undefined && !(Array.isArray(e[k]) && !e[k].length && k === 'aliases')).map((k) => [k, e[k]]));
const inPack = catalog.filter((e) => hasNums(e) && !(Array.isArray(e.formats) && !e.formats.includes('cafe'))).map(slim);
const inPackIds = new Set(inPack.map((e) => e.id));
const toRef = catalog.filter((e) => !inPackIds.has(e.id));
ref.eventCatalogFull = catalog;
extra.eventCatalog = inPack;
ref.eventCatalog = toRef;
log.eventCatalog = { total: [...cat.values()].length, afterFuzzyDedupe: catalog.length, inPack: inPack.length, inReference: toRef.length, fuzzyAliases: evAlias };

// механики: все, с источником; кластеры и порядок — в MERGE.md (D11-mechanics-ranked в extra)
const mech = [];
for (const f of frags) for (const m of (f.p.extra && f.p.extra.mechanics) || []) mech.push({ ...m, from: f.tag });
const mechById = new Map();
for (const m of mech) { if (!mechById.has(m.id)) mechById.set(m.id, m); else { const cur = mechById.get(m.id); cur.alsoFrom = [...new Set([...(cur.alsoFrom || []), m.from])]; } }
ref.mechanics = [...mechById.values()];
const clusterOf = Object.fromEntries(mechanicsRanked.flatMap((c) => c.members.map((m) => [m, c.id])));
log.mechanicsUnclustered = ref.mechanics.filter((m) => !clusterOf[m.id]).map((m) => m.id);
// в пакет — короткая карточка механики; полное описание (формулы, числа) — в справочнике и в MERGE.md
extra.mechanics = ref.mechanics.map((m) => ({ id: m.id, title: m.title, tier: m.tier, from: m.from, ...(m.alsoFrom ? { alsoFrom: m.alsoFrom } : {}), ...(clusterOf[m.id] ? { cluster: clusterOf[m.id] } : {}) }));
extra.mechanicsRanked = mechanicsRanked;

// неочевидное и истории закрытий — справочник (по ссылке и началу текста без повторов)
const dedupeText = (arr, key) => { const seen = new Set(); return arr.filter((x) => { const k = (String(x[key] || x.text || x.what || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80)) + '|' + (x.source || ''); if (seen.has(k)) return false; seen.add(k); return true; }); };
for (const f of frags) for (const x of (f.p.extra && f.p.extra.nonObvious) || []) ref.nonObvious.push({ ...x, from: f.tag });
for (const f of frags) for (const x of (f.p.extra && f.p.extra.failureStories) || []) ref.failureStories.push({ ...x, from: f.tag });
ref.nonObvious = dedupeText(ref.nonObvious, 'text');
ref.failureStories = dedupeText(ref.failureStories, 'what');

// данные механик, нужные движку, — в extra под понятными именами; всё прочее — в справочник по фрагментам
const ENGINE_EXTRA = {
  D01: ['entryModes', 'leaseTerms', 'preOpeningTimeline', 'takeover'],
  D02: ['floorPlan'],
  D03: ['equipment', 'serviceRates'],
  D04: ['menu', 'menuMix', 'cogsShares', 'ingredients', 'packagingSets', 'shelfLife', 'seasonality', 'signals'],
  D05: ['tips', 'staffModel', 'thresholds', 'laborBenchmarks', 'peopleCalendar'],
  D06: ['weekdayProfiles', 'hourCurve', 'monthCurve', 'guestSegments', 'channels', 'queue', 'ratingModel', 'competition'],
  D07: ['monthlyClimate', 'drinkMixByTemperature', 'weatherDayEffects', 'officeWeek', 'schoolCalendar2026_27'],
  D08: ['fineSchedules', 'inspectionPointsD08', 'requiredPostings', 'complianceCalendar', 'lawsuits', 'leaseLaw'],
  D09: ['financing', 'paymentCalendar', 'ubtSchedule', 'taxCredits', 'exitWaterfalls'],
  D10: ['ownerYear'],
  D13: ['formats', 'transitions'],
  D14: ['preOpening', 'takeoverRules', 'floorZones', 'winterDoor'],
};
const engineData = {};
const CONSUMED = new Set(['eventCatalog', 'mechanics', 'nonObvious', 'failureStories', ...Object.keys(extraOverride)]);
for (const f of frags) {
  const ex = f.p.extra || {};
  for (const [k, v] of Object.entries(ex)) {
    if (CONSUMED.has(k)) continue;
    if ((ENGINE_EXTRA[f.tag] || []).includes(k)) {
      // takeover от D01 не затирает takeover движка из ветки keen-cray
      const name = k === 'takeover' ? 'takeoverResearch' : k === 'formats' ? 'formats' : k;
      engineData[name] = v; topFrom['extra.' + name] = f.tag;
    } else (ref.parts[f.tag] ||= {})[k] = v;
  }
}
Object.assign(extra, engineData);
ref.formatRecords = Object.fromEntries(Object.entries(formatRecords).filter(([k]) => !k.startsWith('__')));
ref.roadmapPaths = roadmapPaths;
extra.roadmapPaths = Object.fromEntries(Object.entries(roadmapPaths).filter(([k]) => k !== 'formats'));
extra.formatRecordsIndex = Object.fromEntries(Object.entries(ref.formatRecords).map(([k, v]) => [k, v.map((r) => r.id)]));
extra.conditionalMonthlyCosts = [...(extra.conditionalMonthlyCosts || []), ...(formatRecords.__conditional || [])];
extra.preOpeningChoices = formatRecords.__preOpening || [];
extra.aliases = Object.fromEntries(Object.entries(D.alias).filter(([, v]) => Object.keys(v).length).concat([['eventCatalog', evAlias]]));
log.provenance = provenance;
extra.d11 = {
  builtBy: 'D11 assembler, packs/parts/cafe/D11-merge.mjs',
  builtFrom: fragFiles,
  base: 'packs/cafe.json v2 from branch claude/keen-cray-yytcbp (main v1 + footfall demand, build-out by space, takeover)',
  topLevelFrom: topFrom,
  reference: 'packs/parts/cafe/D11-reference.json: non-obvious facts, closure stories, uncalibrated events, research notes of each part',
};
pack.extra = extra;

// ---------- источники ----------
const srcMap = new Map();
for (const s of base.sources || []) srcMap.set(s.url, s);
for (const f of frags) for (const s of f.p.sources || []) { const u = typeof s === 'string' ? s : s.url; if (!u) continue; if (!srcMap.has(u)) srcMap.set(u, typeof s === 'string' ? { url: u, title: u, checked: '2026-11-14' } : { url: u, title: s.title || u, checked: s.checked || '2026-11-14' }); }
// в пакете — источники, на которые ссылаются записи пакета; полный список — в справочнике
const used = new Set();
const walk = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); for (const [k, v] of Object.entries(o)) { if (typeof v === 'string' && /^https?:\/\//.test(v) && /source|link|url/i.test(k)) used.add(v); else if (Array.isArray(v) && /sources/i.test(k)) v.forEach((u) => typeof u === 'string' ? used.add(u) : u && u.url && used.add(u.url)); else walk(v); } };
for (const k of Object.keys(pack)) if (k !== 'sources') walk(pack[k]);
for (const u of used) if (!srcMap.has(u)) srcMap.set(u, { url: u, title: u, checked: '2026-11-14' });
ref.sources = [...srcMap.values()];
pack.sources = ref.sources.filter((s) => used.has(s.url) || (base.sources || []).some((b) => b.url === s.url));

// ---------- запись ----------
const order = ['id', 'version', 'name', 'tagline', 'startCapital', 'unit', 'market', 'capacity', 'sizing', 'setup', 'kits', 'monthlyCosts', 'staff', 'taxes', 'levers', 'shortcuts', 'violations', 'officials', 'reports', 'events', 'ruleCards', 'benchmarks', 'suppliers', 'roadmap', 'manager', 'sources', 'extra'];
const outPack = {}; for (const k of order) if (pack[k] !== undefined) outPack[k] = pack[k]; for (const k of Object.keys(pack)) if (!(k in outPack)) outPack[k] = pack[k];
fs.writeFileSync(path.join(ROOT, 'packs/cafe.next.json'), JSON.stringify(outPack, null, 2) + '\n');
fs.writeFileSync(path.join(HERE, 'D11-reference.json'), JSON.stringify(ref, null, 1) + '\n');
log.counts = Object.fromEntries(SECTIONS.map((s) => [s, outPack[s].length]));
log.counts.eventCatalog = outPack.extra.eventCatalog.length; log.counts.mechanics = outPack.extra.mechanics.length;
log.counts.formatRecords = Object.fromEntries(Object.entries(ref.formatRecords).map(([k, v]) => [k, v.length]));
log.counts.conditionalMonthlyCosts = outPack.extra.conditionalMonthlyCosts.length; log.counts.preOpeningChoices = outPack.extra.preOpeningChoices.length;
log.counts.reference = { eventCatalog: ref.eventCatalog.length, nonObvious: ref.nonObvious.length, failureStories: ref.failureStories.length };
fs.writeFileSync(path.join(HERE, 'D11-merge-log.json'), JSON.stringify(log, null, 1) + '\n');
console.log(JSON.stringify(log.counts));
console.log('sizes KB: pack', Math.round(fs.statSync(path.join(ROOT, 'packs/cafe.next.json')).size / 1024), 'reference', Math.round(fs.statSync(path.join(HERE, 'D11-reference.json')).size / 1024));
console.log('contradictions', log.contradictions.length, 'aliases applied', log.aliasesApplied.length, 'moved', log.moved.length, 'dropped', log.dropped.length);
