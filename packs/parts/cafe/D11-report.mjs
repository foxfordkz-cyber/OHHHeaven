#!/usr/bin/env node
// D11: пересчитать автоматические блоки MERGE.md после сборки (между <!-- D11:auto:NAME --> и <!-- /D11:auto:NAME -->).
// Запуск из корня репозитория после D11-merge.mjs: node packs/parts/cafe/D11-report.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { mechanicsRanked } from './D11-mechanics-ranked.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const p = read(path.join(ROOT, 'packs/cafe.next.json'));
const main = read(path.join(ROOT, 'packs/cafe.json'));
const log = read(path.join(HERE, 'D11-merge-log.json'));
const ref = read(path.join(HERE, 'D11-reference.json'));
const pl = (k, one, few, many) => { const a = Math.abs(k) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
const n = (x) => x.toLocaleString('ru-RU').replace(/ /g, ' ');
const SECS = ['setup', 'monthlyCosts', 'staff', 'taxes', 'levers', 'shortcuts', 'violations', 'officials', 'reports', 'events', 'ruleCards', 'roadmap', 'suppliers'];

const validate = execSync(`node ${path.join(ROOT, 'build/validate-pack.mjs')} ${path.join(ROOT, 'packs/cafe.next.json')} || true`, { encoding: 'utf8' }).trim().split('\n');
const vLast = validate[validate.length - 1].replace(/^---\s*/, '');
const errors = +(vLast.match(/ошибок (\d+)/) || [])[1];
const warns = +(vLast.match(/предупреждений (\d+)/) || [])[1];
const glued = Object.keys(log.eventCatalog.fuzzyAliases || {}).length + (log.calibration.duplicatesMerged || []).length;
const calibrated = p.extra.eventCatalog.filter((e) => e.calibrated).length;
let leverDefaults = 0; for (const l of p.levers) { const d = l.options.find((o) => !o.causes) || l.options[0]; leverDefaults += d.monthlyCost; }
const kitCost = (pk, k) => k.items.reduce((a, it) => { const s = pk.setup.find((x) => x.id === it.id); return a + (s ? s.cost * (s.scalesWithSize ? k.size : it.qty || 1) : 0); }, 0);
const json = JSON.stringify(p);
let movesTot = 0, movesMiss = 0; for (const e of p.extra.eventCatalog) for (const m of e.playerMoves || []) { movesTot++; if (m && m.inPack === false) movesMiss++; }
const fmtRec = Object.values(log.counts.formatRecords || {}).reduce((a, b) => a + b, 0);

const blocks = {
  verdict: [
    `1. \`packs/cafe.next.json\` собран из основы и ${log.inputs.length} файлов фрагментов (${[...new Set(log.inputs.map((f) => f.slice(0, 3)))].join(', ')}). Валидатор: **${errors} ${pl(errors, 'ошибка', 'ошибки', 'ошибок')}**, ${warns} ${pl(warns, 'предупреждение', 'предупреждения', 'предупреждений')} (раздел 7).`,
    `2. Пакет вырос с 6 событий и 5 рычагов до ${n(p.extra.eventCatalog.length)} событий с числами в \`extra.eventCatalog\` (${n(calibrated)} откалиброваны в D15–D19), ${p.levers.length} рычагов, ${p.shortcuts.length} срезанных углов, ${p.violations.length} нарушений, ${p.ruleCards.length} карточек правил и плана открытия из ${p.roadmap.length} шагов по порядку.`,
    `3. Повторы склеены: ${log.aliasesApplied.length} ${pl(log.aliasesApplied.length, 'запись', 'записи', 'записей')} под чужими \`id\` сведены к одному \`id\`, ещё ${glued} ${pl(glued, 'событие склеено', 'события склеены', 'событий склеены')} по названию и по отметкам калибровщиков (\`duplicateOf\`). Старые \`id\` сохранены в \`extra.aliases\` и в \`aliases\` у событий.`,
  ].join('\n'),
  counts: ['| Раздел | main (v1) | записей во фрагментах | уникальных id после склейки | в cafe.next.json | исправлено записей main | вынесено в extra |', '|---|---|---|---|---|---|---|',
    ...SECS.map((s) => { const st = log.sections[s]; const mv = log.moved.filter((x) => x.section === s).length; return `| ${s} | ${main[s].length} | ${st.candidates - st.base} | ${st.unique} | ${p[s].length} | ${st.fixesOfBase} | ${mv} |`; })].join('\n'),
  extraSummary: `Сверх разделов: \`extra.eventCatalog\` — ${n(p.extra.eventCatalog.length)} событий с числами (в main 0), из них ${n(calibrated)} откалиброваны в D15–D19 (применено калибровок: ${n(log.calibration.applied)}, файлы: ${log.calibration.files.join(', ')}); \`extra.mechanics\` — ${p.extra.mechanics.length} предложенных механик; \`extra.mechanicsRanked\` — ${mechanicsRanked.length} механик по важности; \`extra.effectFields\` — словарь ${Object.keys(p.extra.effectFields).length} полей эффектов. Справочник \`D11-reference.json\`: ${n(ref.nonObvious.length)} неочевидных фактов, ${ref.failureStories.length} историй закрытий, ${ref.eventCatalog.length} событий без чисел, полные записи всех событий и механик, ${fmtRec} записей других форматов.\n\nНаборы (с новыми обязательными предметами): ${p.kits.map((k) => `${k.id} — $${n(Math.round(kitCost(p, k)))} (main $${n(Math.round(kitCost(main, main.kits.find((x) => x.id === k.id))))})`).join('; ')}; стартовый капитал $${n(p.startCapital)}. Цена рычагов по умолчанию — $${n(leverDefaults)} в месяц (раздел 5.2). Вес пакета: ${n(Math.round(json.length / 1024))} КБ, в gzip ${n(Math.round(zlib.gzipSync(json).length / 1024))} КБ (main — ${n(Math.round(JSON.stringify(main).length / 1024))} КБ). Источников в пакете ${n(p.sources.length)}, всего ${n(ref.sources.length)}.`,
  moved: `Вынесено из разделов: в \`D11-reference.json → formatRecords\` — ${fmtRec}, в \`extra.conditionalMonthlyCosts\` — ${p.extra.conditionalMonthlyCosts.length}, в \`extra.preOpeningChoices\` — ${p.extra.preOpeningChoices.length}, в \`extra.roadmapPaths\` — ${Object.entries(p.extra.roadmapPaths).map(([k, v]) => `${k} ${v.length}`).join(', ')}. Варианты, добавленные к рычагам записями \`addsOptionsTo\`: ${(log.optionsAdded || []).join(', ') || 'нет'}. Расчёт подставлен из каталога для оценок без \`note\`: ${(log.notesFilled || []).join(', ') || 'нет'}.\n\nХоды игрока в событиях: ${n(movesTot)}; из них ${n(movesMiss)} ссылаются на рычаг или срезанный угол, которого нет в пакете (помечены \`inPack: false\`). Это займы и выход из бизнеса (механики 11 и 12), рычаги других форматов и ответы, которые калибровщики D15–D17 придумали для одного события (\`*_response\`). Движку нужен «ход события» — вариант, который живёт только внутри события (раздел 8).`,
  contradictions: (() => {
    const getp = (o, pth) => pth.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
    const ov = new Set(log.overrides || []);
    const rows = log.contradictions.map((c) => {
      const rec = (p[c.section] || []).find((r) => r.id === c.id);
      const fin = rec ? getp(rec, c.field) : 'вынесено в extra';
      const vals = c.values.map((v) => `${v.tag}${v.id !== c.id ? ` (${v.id})` : ''} ${v.v}${v.conf === 'verified' ? ' ✓' : ''}`).join('; ');
      return `| \`${c.section}.${c.id}\` | ${c.field} | ${vals} | **${fin === undefined ? '—' : fin}**${ov.has(`${c.section}.${c.id}`) ? ' (D11)' : ''} |`;
    });
    return [`Всего расхождений: ${rows.length}.`, '', '| Запись | Поле | Версии | Итог |', '|---|---|---|---|', ...rows].join('\n');
  })(),
};

const file = path.join(HERE, 'MERGE.md');
let md = fs.readFileSync(file, 'utf8');
for (const [k, v] of Object.entries(blocks)) {
  const re = new RegExp(`(<!-- D11:auto:${k} -->)[\\s\\S]*?(<!-- /D11:auto:${k} -->)`);
  if (!re.test(md)) { console.error(`no block ${k}`); continue; }
  md = md.replace(re, `$1\n${v}\n$2`);
}
fs.writeFileSync(file, md);
console.log(`MERGE.md updated: ${vLast}`);
