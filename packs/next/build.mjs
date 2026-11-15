#!/usr/bin/env node
// Сборка лёгкого пакета кафе из packs/cafe.next.json (D11, ветка claude/jolly-volta-dv0cll). Задание A2 третьего захода.
//
//   node packs/next/build.mjs            — собрать packs/next/cafe.json, _common.json, cafe.reference.json и напечатать отчёт
//   node packs/next/build.mjs --check    — то же без записи: код возврата 1, если файлы на диске устарели
//
// Источник: packs/cafe.next.json, если он есть в рабочей копии, иначе `git show origin/claude/jolly-volta-dv0cll:packs/cafe.next.json`
// (флаг --src <файл> задаёт свой). Правки D12 для общего пакета: packs/parts/cafe/D12-number-check.common.json или та же ветка.
// Общий пакет-основа — packs/_common.json этой ветки. Если рядом лежит packs/parts/cafe/D20-formats.json (задание A1),
// его разделы extra.* вливаются в пакет (они важнее одноимённых разделов D11).
//
// Что делает (подробно — packs/next/SWAP.md):
//  1. extra.eventCatalog — убирается (события: packs/next/cafe.events.json, задание A3);
//  2. extra — остаются только разделы, которые читает код (KEEP_NOW) или назначенные волне B (KEEP_WAVE_B); прочие — в справку;
//  3. служебные поля сборки (d11, d03, evidence, seenIn, …) — в справку;
//  4. note у записей с confidence: verified — в справку (у оценок note остаётся: в нём расчёт);
//  5. ruleCards — в пакете карточки, до которых игра доходит по id (нарушение, предмет, рычаг, налог, id из кода
//     аналитики, все карточки v1 и tier: core); остальные — в packs/next/cafe.cards.json (база знаний советника, на сервере);
//  6. sources — в пакете источники главных чисел (unit, market, capacity, sizing, benchmarks, manager); у каждой записи
//     своя ссылка в source; полный список с заголовками — в справке;
//  7. extra.leverGroups — из packs/next/lever-groups.mjs.
// Справка packs/next/cafe.reference.json хранит всё убранное, кроме каталога событий, с путём до каждой записи.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVER_GROUPS, SHORTCUT_GROUPS } from './lever-groups.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const BRANCH = 'origin/claude/jolly-volta-dv0cll';
const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };

function readSource(rel, override) {
  if (override) return { json: JSON.parse(readFileSync(override, 'utf8')), from: override };
  const local = join(ROOT, rel);
  if (existsSync(local)) return { json: JSON.parse(readFileSync(local, 'utf8')), from: rel };
  const text = execFileSync('git', ['show', `${BRANCH}:${rel}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  return { json: JSON.parse(text), from: `${BRANCH}:${rel}` };
}

// ─── что оставить в extra ───
// Читает код сейчас (поиск по `extra.` и по именам ключей в engine/ host/ server/ client/ bots/ ai/ shared/, без тестов).
export const KEEP_NOW = {
  footfall: 'shared/src/place.ts footfallParams, engine/src/economy/demand.ts footfallDemand, bots/src/brain.ts',
  buildout: 'shared/src/place.ts buildoutRules → цена и срок ремонта по прошлому назначению помещения',
  takeover: 'shared/src/place.ts takeoverRules → покупка действующей кофейни',
  weekdayMult: 'engine/src/economy/effects.ts weekdayMult',
  taxableShare: 'engine/src/economy/taxes.ts taxableShare',
  taxableShareByTax: 'engine/src/economy/taxes.ts taxableShare',
  rentByTier: 'engine/src/economy/check-pack.ts',
  seatThresholds: 'engine/src/economy/actions.ts seatThresholds (санузел от 20 мест и т. п.)',
  exclusiveShortcuts: 'engine/src/economy/actions.ts exclusiveShortcuts',
  outsideWeight: 'engine/src/economy/demand.ts marketParams',
  fairPriceBand: 'engine/src/economy/demand.ts marketParams',
  overpriceSteepness: 'engine/src/economy/demand.ts marketParams',
};
// Назначены волне B: код появится в этом заходе, данные нужны в пакете.
export const KEEP_WAVE_B = {
  guestSegments: 'B02 segments.ts — только из D20 (A1); раздел D11 другой формы уходит в справку',
  service: 'B01 service.ts — из D20 (A1)',
  staffing: 'B03 staffing.ts — из D20 (A1)',
  regulars: 'B04 regulars.ts — из D20 (A1)',
  profiles: 'B07 recommendOpening, G1 diversity.ts — из D20 (A1)',
  financing: 'B08 deals: SBA 7(a), микрозаём, кассовый аванс (D09)',
  exitWaterfalls: 'B08 deals: продажа бизнеса и закрытие с долгами (D09)',
  fineSchedules: 'B06 law: штраф растёт с номером нарушения за 12 месяцев (D08)',
  inspectionPointsD08: 'B06 law: буква A/B/C по баллам проверки (D08)',
};
// Разделы D11, у которых в D20 будет своя версия: из D11 не берём, чтобы часть волны B не прочла чужую форму.
const D20_ONLY = new Set(['guestSegments', 'service', 'staffing', 'regulars', 'profiles']);

// Служебные поля сборки и справочные поля без читателя в коде: из записей — в справку.
const DROP_FIELDS = new Set([
  'd11', 'd03', 'evidence', 'seenIn', 'checkedVia', 'supportingSources', 'moreSources', 'tier',
  'lifespanSource', 'lifespanConfidence', 'realFrequency', 'fineFormula', 'fineSteps',
  'priceAnchor', 'minimumOrder', 'paymentTerms', 'leadTime', 'failureModes', 'monthlyVolume',
  'savesNote', 'table', 'next', 'realRate', 'nycRealRate', 'realAmount',
]);
const LISTS = ['setup', 'monthlyCosts', 'staff', 'taxes', 'levers', 'shortcuts', 'violations', 'officials', 'reports', 'events', 'ruleCards', 'suppliers', 'roadmap'];
const SINGLE = ['unit', 'market', 'capacity', 'sizing', 'benchmarks', 'manager'];

// id карточек, которые код аналитики запрашивает напрямую (engine/src/analytics/recommend.ts cardFor, plan.ts).
const CARD_IDS_IN_CODE = ['sales_tax', 'workers_comp', 'payroll_taxes', 'fse_permit'];

const clone = (v) => JSON.parse(JSON.stringify(v));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function slimRecord(rec, path, ref) {
  const out = {};
  for (const [k, v] of Object.entries(rec)) {
    if (DROP_FIELDS.has(k)) { (ref.fields[path] ??= {})[k] = v; continue; }
    if (k === 'note' && rec.confidence === 'verified' && typeof rec.source === 'string' && /^https?:/.test(rec.source)) { ref.notes[path] = v; continue; }
    if (k === 'options' && Array.isArray(v)) { out[k] = v.map((o, i) => (isObj(o) ? slimRecord(o, `${path}.options[${o.id ?? i}]`, ref) : o)); continue; }
    out[k] = v;
  }
  return out;
}

function urlsIn(v, set = new Set()) {
  if (typeof v === 'string') { if (/^https?:\/\//.test(v)) set.add(v); }
  else if (Array.isArray(v)) v.forEach((x) => urlsIn(x, set));
  else if (isObj(v)) Object.values(v).forEach((x) => urlsIn(x, set));
  return set;
}

export function buildLeverGroups(pack, common) {
  const leverIds = new Set(pack.levers.map((l) => l.id));
  const scIds = new Set(pack.shortcuts.map((s) => s.id));
  const violations = new Map([...pack.violations, ...common.violations].map((v) => [v.id, v]));
  const seen = new Set();
  const problems = [];
  const groups = LEVER_GROUPS.map((g) => ({ id: g.id, label: g.label, levers: [], shortcuts: [] }));
  const byId = new Map(groups.map((g) => [g.id, g]));
  for (const g of LEVER_GROUPS) for (const [id, show] of Object.entries(g.levers)) {
    if (!leverIds.has(id)) problems.push(`leverGroups: рычага ${id} нет в пакете`);
    if (seen.has(id)) problems.push(`leverGroups: рычаг ${id} в двух темах`);
    seen.add(id);
    byId.get(g.id).levers.push({ id, show });
  }
  for (const id of leverIds) if (!seen.has(id)) problems.push(`leverGroups: рычаг ${id} без темы`);
  const scGroups = SHORTCUT_GROUPS.map((g) => ({ id: g.id, label: g.label, levers: [], shortcuts: [] }));
  const byOfficial = new Map(SHORTCUT_GROUPS.flatMap((g) => g.officials.map((o) => [o, g])));
  const scSeen = new Set();
  for (const s of pack.shortcuts) {
    const official = violations.get(s.violation)?.official;
    const g = byOfficial.get(official);
    if (!g) { problems.push(`leverGroups: у угла ${s.id} нет темы для ${official}`); continue; }
    scGroups.find((x) => x.id === g.id).shortcuts.push({ id: s.id, show: g.show[s.id] ?? 'more' });
    scSeen.add(s.id);
  }
  for (const g of SHORTCUT_GROUPS) for (const id of Object.keys(g.show)) if (!scIds.has(id)) problems.push(`leverGroups: угла ${id} нет в пакете`);
  // одна тема на экране может держать и рычаги, и углы: углы «street» — к рычагам «street»
  const all = [...groups];
  for (const g of scGroups) {
    const same = all.find((x) => x.id === g.id);
    if (same) same.shortcuts.push(...g.shortcuts); else all.push(g);
  }
  const first = { levers: all.flatMap((g) => g.levers.filter((x) => x.show === 'first').map((x) => x.id)), shortcuts: all.flatMap((g) => g.shortcuts.filter((x) => x.show === 'first').map((x) => x.id)) };
  if (first.levers.length < 12 || first.levers.length > 15) problems.push(`leverGroups: сразу видно ${first.levers.length} рычагов, нужно 12–15`);
  return {
    value: {
      note: 'Manage tab: show the "first" levers from day one; the rest appear when their condition is met (months, phase, entry, staffAtLeast, seatsAtLeast, afterDays, event, lowCash) or under "All levers" ("more"). Every lever and shortcut of the pack is in exactly one group.',
      first,
      groups: all.filter((g) => g.levers.length || g.shortcuts.length),
    },
    problems,
    counts: { levers: seen.size, shortcuts: scSeen.size, firstLevers: first.levers.length, firstShortcuts: first.shortcuts.length },
  };
}

// D12: поля записей поверх старых (по id), новые записи — в конец; extra — глубокое слияние.
function deepMerge(a, b) {
  if (!isObj(a) || !isObj(b)) return clone(b);
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = isObj(v) && isObj(a[k]) ? deepMerge(a[k], v) : clone(v);
  return out;
}
export function applyCommonPatch(common, patch) {
  const out = clone(common);
  const log = [];
  for (const [k, v] of Object.entries(patch)) {
    if (Array.isArray(v)) {
      out[k] = Array.isArray(out[k]) ? out[k] : [];
      for (const rec of v) {
        const i = out[k].findIndex((x) => x.id === rec.id);
        if (i >= 0) {
          const changed = Object.keys(rec).filter((f) => JSON.stringify(out[k][i][f]) !== JSON.stringify(rec[f]));
          out[k][i] = { ...out[k][i], ...clone(rec) };
          log.push(`${k}.${rec.id}: ${changed.length ? changed.join(', ') : 'без изменений'}`);
        } else { out[k].push(clone(rec)); log.push(`${k}.${rec.id}: новая запись`); }
      }
    } else if (k === 'extra') {
      const before = JSON.stringify(out.extra ?? {});
      out.extra = deepMerge(out.extra ?? {}, v);
      log.push(`extra: ${Object.keys(v).join(', ')}${before === JSON.stringify(out.extra) ? ' (без изменений)' : ''}`);
    } else { out[k] = clone(v); log.push(`${k}: заменено`); }
  }
  // sources общего пакета пополняются ссылками из правок
  const have = new Set((out.sources ?? []).map((s) => s.url));
  for (const u of urlsIn(patch)) if (!have.has(u)) { (out.sources ??= []).push({ url: u, title: titleFor(u), checked: '2026-11-14' }); have.add(u); }
  return { common: out, log };
}
const titleFor = (u) => `D12 number check: ${u.replace(/^https?:\/\//, '').split(/[/?#]/)[0]}`;

// Запись JSON: по записи на строку — компактно и с читаемым diff.
export function stringifyPack(p) {
  const lines = ['{'];
  const keys = Object.keys(p);
  keys.forEach((k, i) => {
    const v = p[k];
    const comma = i < keys.length - 1 ? ',' : '';
    if (Array.isArray(v) && v.length && v.every(isObj)) {
      lines.push(`  ${JSON.stringify(k)}: [`);
      v.forEach((x, j) => lines.push(`    ${JSON.stringify(x)}${j < v.length - 1 ? ',' : ''}`));
      lines.push(`  ]${comma}`);
    } else if (isObj(v) && Object.keys(v).length > 1 && JSON.stringify(v).length > 400) {
      lines.push(`  ${JSON.stringify(k)}: {`);
      const ek = Object.keys(v);
      ek.forEach((kk, j) => lines.push(`    ${JSON.stringify(kk)}: ${JSON.stringify(v[kk])}${j < ek.length - 1 ? ',' : ''}`));
      lines.push(`  }${comma}`);
    } else lines.push(`  ${JSON.stringify(k)}: ${JSON.stringify(v)}${comma}`);
  });
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

export function build({ src, common, d12, d20, v1 }) {
  const ref = { note: 'Everything packs/next/build.mjs moved out of packs/next/cafe.json, except extra.eventCatalog (see packs/next/cafe.events.json). Paths point to the record in the full pack packs/cafe.next.json.', extra: {}, fields: {}, notes: {}, sources: [] };
  const removed = { eventCatalog: 0, extra: [], fields: 0, notes: 0, cards: 0, sources: 0 };
  const pack = {};
  for (const [k, v] of Object.entries(src)) {
    if (k === 'extra' || k === 'sources') continue;
    if (LISTS.includes(k) && Array.isArray(v)) pack[k] = v.map((r) => slimRecord(r, `${k}[${r.id}]`, ref));
    else if (SINGLE.includes(k) && isObj(v)) pack[k] = slimRecord(v, k, ref);
    else pack[k] = clone(v);
  }
  // extra
  const extra = {};
  const ex = src.extra ?? {};
  for (const [k, v] of Object.entries(ex)) {
    if (k === 'eventCatalog') { removed.eventCatalog = Array.isArray(v) ? v.length : 1; continue; }
    if ((k in KEEP_NOW) || ((k in KEEP_WAVE_B) && !D20_ONLY.has(k))) extra[k] = clone(v);
    else { ref.extra[k] = v; removed.extra.push(k); }
  }
  const fromD20 = [];
  if (d20 && isObj(d20.extra)) for (const [k, v] of Object.entries(d20.extra)) { extra[k] = clone(v); fromD20.push(k); }
  const lg = buildLeverGroups(pack, common);
  extra.leverGroups = lg.value;
  pack.extra = extra;
  // ruleCards: до которых игра доходит по id
  const linked = new Set([...CARD_IDS_IN_CODE, ...(v1?.ruleCards ?? []).map((c) => c.id)]);
  for (const P of [pack, common]) for (const k of LISTS.filter((x) => x !== 'ruleCards')) for (const r of P[k] ?? []) {
    if (!isObj(r)) continue;
    for (const f of ['id', 'violation', 'withoutItViolation']) if (typeof r[f] === 'string') linked.add(r[f]);
    for (const o of r.options ?? []) { if (o.id) linked.add(o.id); if (o.causes) linked.add(o.causes); }
  }
  const tierOf = new Map((src.ruleCards ?? []).map((c) => [c.id, c.tier]));
  const cards = pack.ruleCards ?? [];
  pack.ruleCards = cards.filter((c) => linked.has(c.id) || tierOf.get(c.id) === 'core');
  const moreCards = cards.filter((c) => !pack.ruleCards.includes(c));
  removed.cards = moreCards.length;
  // sources: источники главных чисел; полный список — в справке
  const srcList = Array.isArray(src.sources) ? src.sources : [];
  const headline = urlsIn(SINGLE.map((k) => pack[k]));
  pack.sources = srcList.filter((s) => headline.has(s.url));
  ref.sources = srcList.filter((s) => !headline.has(s.url));
  const used = urlsIn(pack);
  const listedAll = new Set(srcList.map((s) => s.url));
  const missing = [...used].filter((u) => !listedAll.has(u));
  removed.fields = Object.values(ref.fields).reduce((a, f) => a + Object.keys(f).length, 0);
  removed.notes = Object.keys(ref.notes).length;
  removed.sources = ref.sources.length;
  const patched = applyCommonPatch(common, d12);
  const cardFile = { note: 'Rule cards of the cafe pack that no game record links to by id: knowledge for the advisor (ai/src/advisor.ts). Same shape as pack.ruleCards. Built by packs/next/build.mjs.', ruleCards: moreCards };
  return { pack, reference: ref, cards: cardFile, common: patched.common, commonLog: patched.log, removed, fromD20, leverGroups: lg, missingSources: missing };
}

// ─── запуск ───
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const src = readSource('packs/cafe.next.json', argOf('--src'));
  const d12 = readSource('packs/parts/cafe/D12-number-check.common.json', argOf('--d12'));
  const common = JSON.parse(readFileSync(join(ROOT, 'packs/_common.json'), 'utf8'));
  const d20path = join(ROOT, 'packs/parts/cafe/D20-formats.json');
  const d20 = existsSync(d20path) ? JSON.parse(readFileSync(d20path, 'utf8')) : null;
  const v1 = JSON.parse(readFileSync(join(ROOT, 'packs/cafe.json'), 'utf8'));
  const r = build({ src: src.json, common, d12: d12.json, d20, v1 });
  const files = {
    'packs/next/cafe.json': stringifyPack(r.pack),
    'packs/next/_common.json': `${JSON.stringify(r.common, null, 2)}\n`,
    'packs/next/cafe.cards.json': stringifyPack(r.cards),
    'packs/next/cafe.reference.json': stringifyPack(r.reference),
  };
  const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(0)} КБ`;
  console.log(`источник: ${src.from} (${kb(JSON.stringify(src.json, null, 2))} с отступами, ${kb(JSON.stringify(src.json))} без)`);
  console.log(`D12: ${d12.from}; D20: ${d20 ? 'packs/parts/cafe/D20-formats.json → ' + r.fromD20.join(', ') : 'нет файла, разделы волны B из D20 не вставлены'}`);
  console.log(`убрано: eventCatalog ${r.removed.eventCatalog} событий; extra ${r.removed.extra.length} разделов; служебных полей ${r.removed.fields}; note у verified ${r.removed.notes}; карточек в cafe.cards.json ${r.removed.cards}; sources в справку ${r.removed.sources}`);
  console.log(`extra в пакете: ${Object.keys(r.pack.extra).join(', ')}`);
  console.log(`leverGroups: рычагов ${r.leverGroups.counts.levers}, углов ${r.leverGroups.counts.shortcuts}, сразу видно ${r.leverGroups.counts.firstLevers} рычагов и ${r.leverGroups.counts.firstShortcuts} углов`);
  if (r.missingSources.length) console.log(`ссылки без записи в sources: ${r.missingSources.length}`);
  for (const p of r.leverGroups.problems) console.log(`ОШИБКА ${p}`);
  console.log(`_common, правки D12 (${r.commonLog.length}):\n  ${r.commonLog.join('\n  ')}`);
  let stale = false;
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(ROOT, rel);
    const same = existsSync(abs) && readFileSync(abs, 'utf8') === text;
    if (CHECK) { if (!same) { stale = true; console.log(`устарел: ${rel}`); } }
    else writeFileSync(abs, text);
    console.log(`${rel}: ${kb(text)}${CHECK ? (same ? ' (совпадает)' : '') : ''}`);
  }
  if (r.leverGroups.problems.length || stale) process.exit(1);
}
