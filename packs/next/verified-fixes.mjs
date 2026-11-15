#!/usr/bin/env node
// Проверенные исправления чисел действующего packs/cafe.json и packs/_common.json из D12 (задание A2, обновление 21:50).
//
//   node packs/next/verified-fixes.mjs                 — собрать packs/next/verified-fixes.json и напечатать таблицу
//   node packs/next/verified-fixes.mjs --check         — то же без записи: код 1, если файл устарел
//   node packs/next/verified-fixes.mjs --apply [--dir <корень>]
//                                                      — применить fixes к packs/cafe.json и packs/_common.json
//                                                        (по умолчанию — в этом репозитории; это делает ведущий)
//
// Правило отбора. Запись D12 сравнивается с действующей записью того же id поле за полем. В fixes идёт запись, у которой
// (1) изменилось хотя бы одно уже существующее число, (2) у версии D12 confidence: verified и ссылка source на страницу,
// которую D12 открыл сам (D12-number-check.md, разделы 4 и 4а). Тогда применяются все изменённые поля записи — число вместе
// с name, source, note, law, чтобы текст не расходился с числом. Изменения у оценок (estimate) и правки без чисел
// перечислены в notApplied и textOnly с причиной и не применяются. Шаг плана открытия (roadmap) своей пометки не имеет:
// он применяется вместе с предметом набора, на который ссылается setupItemId, если меняется то же число (follows).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const BRANCH = 'origin/claude/jolly-volta-dv0cll';
const args = process.argv.slice(2);
const argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const OUT = join(ROOT, 'packs/next/verified-fixes.json');

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function readD12(rel) {
  const local = join(ROOT, rel);
  if (existsSync(local)) return { json: JSON.parse(readFileSync(local, 'utf8')), from: rel };
  const text = execFileSync('git', ['show', `${BRANCH}:${rel}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  return { json: JSON.parse(text), from: `${BRANCH}:${rel}` };
}

// Листья, где изменилось существующее число: путь → [было, стало]
function numberChanges(oldV, newV, path = '') {
  const out = [];
  if (typeof oldV === 'number' && typeof newV === 'number') { if (oldV !== newV) out.push({ path, from: oldV, to: newV }); return out; }
  if (isObj(oldV) && isObj(newV)) for (const k of Object.keys(newV)) if (k in oldV) out.push(...numberChanges(oldV[k], newV[k], path ? `${path}.${k}` : k));
  return out;
}
const changedFields = (oldR, newR) => Object.keys(newR).filter((k) => k !== 'id' && k !== 'options' && !same(oldR[k], newR[k]));
const SKIP_EXTRA = new Set(['eventCatalog', 'mechanics', 'd12CheckedUnchanged']);   // новое содержание, а не исправление: в пакет D11

// Записи D12 как список: { pack, section, id, path, oldRec, newRec }
function pairs(packName, live, patch) {
  const out = [];
  for (const [section, v] of Object.entries(patch)) {
    if (section === 'sources') continue;
    if (Array.isArray(v)) {
      for (const rec of v) {
        const cur = (live[section] ?? []).find((x) => x.id === rec.id);
        if (!cur) { out.push({ pack: packName, path: `${section}[${rec.id}]`, missing: true }); continue; }
        out.push({ pack: packName, section, id: rec.id, path: `${section}[${rec.id}]`, oldRec: cur, newRec: rec });
        if (Array.isArray(rec.options)) for (const o of rec.options) {
          const co = (cur.options ?? []).find((x) => x.id === o.id);
          if (co) out.push({ pack: packName, section, id: rec.id, option: o.id, path: `${section}[${rec.id}].options[${o.id}]`, oldRec: co, newRec: o });
        }
      }
    } else if (section === 'extra' && isObj(v)) {
      for (const [k, rec] of Object.entries(v)) {
        if (SKIP_EXTRA.has(k)) continue;
        const cur = live.extra?.[k];
        if (!isObj(cur) || !isObj(rec)) { out.push({ pack: packName, path: `extra.${k}`, missing: true }); continue; }
        out.push({ pack: packName, section: 'extra', id: k, path: `extra.${k}`, oldRec: cur, newRec: rec });
      }
    } else if (isObj(v) && isObj(live[section])) {
      out.push({ pack: packName, section, id: section, path: section, oldRec: live[section], newRec: v });
    }
  }
  return out;
}

export function collect({ cafe, common, d12Cafe, d12Common }) {
  const fixes = [], notApplied = [], textOnly = [], missing = [];
  for (const p of [...pairs('cafe', cafe, d12Cafe), ...pairs('_common', common, d12Common)]) {
    if (p.missing) { missing.push({ pack: p.pack, record: p.path, reason: 'в действующем пакете нет записи с этим id' }); continue; }
    const nums = numberChanges(p.oldRec, p.newRec);
    const fields = changedFields(p.oldRec, p.newRec);
    if (!fields.length) continue;
    const conf = p.newRec.confidence ?? p.oldRec.confidence ?? null;
    const src = p.newRec.source ?? p.oldRec.source ?? null;
    const verified = conf === 'verified' && typeof src === 'string' && /^https?:\/\//.test(src);
    const row = { pack: p.pack, record: p.path, numbers: nums.map((n) => ({ field: n.path, from: n.from, to: n.to })), fields, confidence: conf, source: src };
    // Шаг плана открытия без своей пометки следует за предметом набора (setupItemId), если меняется то же число.
    const leader = p.section === 'roadmap' && conf === null && p.oldRec.setupItemId
      ? fixes.find((f) => f.pack === p.pack && f.record === `setup[${p.oldRec.setupItemId}]` && nums.every((n) => f.numbers.some((m) => m.field === n.path && m.from === n.from && m.to === n.to)))
      : null;
    if (leader) fixes.push({ ...row, confidence: leader.confidence, source: leader.source, follows: leader.record, set: Object.fromEntries(fields.map((f) => [f, clone(p.newRec[f])])), _p: p });
    else if (nums.length && verified) fixes.push({ ...row, set: Object.fromEntries(fields.map((f) => [f, clone(p.newRec[f])])), _p: p });
    else if (nums.length) notApplied.push({ ...row, reason: conf === 'verified' ? 'нет ссылки на первоисточник' : `у новой версии confidence: ${conf ?? 'нет'} — число получено расчётом, а не увидено в первоисточнике` });
    else textOnly.push({ ...row, reason: 'числа не меняются: источник, закон, пометка или расчёт' });
  }
  return { fixes, notApplied, textOnly, missing };
}

export function apply(cafe, common, fixes) {
  const packs = { cafe: clone(cafe), _common: clone(common) };
  for (const f of fixes) {
    const p = f._p ?? f;
    const pack = packs[f.pack];
    let target;
    if (p.section === 'extra') target = pack.extra[p.id];
    else if (Array.isArray(pack[p.section])) {
      target = pack[p.section].find((x) => x.id === p.id);
      if (p.option) target = target.options.find((o) => o.id === p.option);
    } else target = pack[p.section];
    Object.assign(target, clone(f.set));
  }
  return packs;
}

// ─── запуск ───
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const base = argOf('--dir') ?? ROOT;
  const cafe = JSON.parse(readFileSync(join(base, 'packs/cafe.json'), 'utf8'));
  const common = JSON.parse(readFileSync(join(base, 'packs/_common.json'), 'utf8'));
  const d12c = readD12('packs/parts/cafe/D12-number-check.json');
  const d12m = readD12('packs/parts/cafe/D12-number-check.common.json');
  const r = collect({ cafe, common, d12Cafe: d12c.json, d12Common: d12m.json });
  const strip = (x) => { const { _p, ...rest } = x; return rest; };
  // источники, на которые ссылаются применяемые записи и которых нет в sources пакета
  const d12Sources = [...(d12c.json.sources ?? [])];
  const addSources = (packName, live) => {
    const have = new Set((live.sources ?? []).map((s) => s.url));
    const want = new Set(r.fixes.filter((f) => f.pack === packName).map((f) => f.set.source ?? f.source).filter(Boolean));
    return [...want].filter((u) => !have.has(u)).map((u) => d12Sources.find((s) => s.url === u) ?? { url: u, title: `D12 number check: ${u.replace(/^https?:\/\//, '').split(/[/?#]/)[0]}`, checked: '2026-11-14' });
  };
  const doc = {
    note: 'Verified number fixes for the live packs/cafe.json and packs/_common.json from D12 (packs/parts/cafe/D12-number-check*.json, branch claude/jolly-volta-dv0cll). Only records whose D12 version is confidence: verified with a source page D12 opened, and where an existing number changes. Built and applied by packs/next/verified-fixes.mjs.',
    builtFrom: { d12Cafe: d12c.from, d12Common: d12m.from, cafe: `packs/cafe.json v${cafe.version}`, common: `packs/_common.json v${common.version}` },
    apply: 'node packs/next/verified-fixes.mjs --apply',
    fixes: r.fixes.map(strip),
    sourcesToAdd: { cafe: addSources('cafe', cafe), _common: addSources('_common', common) },
    notApplied: r.notApplied,
    textOnly: r.textOnly,
    missing: r.missing,
  };
  const text = `${JSON.stringify(doc, null, 2)}\n`;
  const fmt = (v) => (typeof v === 'number' ? String(v) : JSON.stringify(v));
  console.log(`D12: ${d12c.from}, ${d12m.from}`);
  console.log(`применяются (${r.fixes.length}):`);
  for (const f of r.fixes) console.log(`  ${f.pack}: ${f.record} — ${f.numbers.map((n) => `${n.field} ${fmt(n.from)} → ${fmt(n.to)}`).join(', ')} [${f.source}]`);
  console.log(`не применяются, оценки (${r.notApplied.length}):`);
  for (const f of r.notApplied) console.log(`  ${f.pack}: ${f.record} — ${f.numbers.map((n) => `${n.field} ${fmt(n.from)} → ${fmt(n.to)}`).join(', ')} (${f.confidence})`);
  console.log(`без чисел (${r.textOnly.length}): ${r.textOnly.map((f) => `${f.pack}:${f.record}`).join(', ')}`);
  if (r.missing.length) console.log(`нет в пакете (${r.missing.length}): ${r.missing.map((f) => `${f.pack}:${f.record}`).join(', ')}`);

  if (args.includes('--apply')) {
    const out = apply(cafe, common, r.fixes);
    out.cafe.sources = [...(out.cafe.sources ?? []), ...doc.sourcesToAdd.cafe];
    out._common.sources = [...(out._common.sources ?? []), ...doc.sourcesToAdd._common];
    writeFileSync(join(base, 'packs/cafe.json'), `${JSON.stringify(out.cafe, null, 2)}\n`);
    writeFileSync(join(base, 'packs/_common.json'), `${JSON.stringify(out._common, null, 2)}\n`);
    console.log(`применено: ${join(base, 'packs/cafe.json')}, ${join(base, 'packs/_common.json')}`);
  } else if (args.includes('--check')) {
    const ok = existsSync(OUT) && readFileSync(OUT, 'utf8') === text;
    console.log(ok ? 'packs/next/verified-fixes.json совпадает' : 'packs/next/verified-fixes.json устарел');
    process.exit(ok ? 0 : 1);
  } else {
    writeFileSync(OUT, text);
    console.log(`записано: packs/next/verified-fixes.json`);
  }
}
