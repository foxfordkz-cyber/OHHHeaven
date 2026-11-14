#!/usr/bin/env node
// Проверка пакета ниши по контракту build/PACK.md.
// Запуск: node build/validate-pack.mjs packs/cafe.json [packs/_common.json]
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const file = process.argv[2];
if (!file) { console.error('usage: node build/validate-pack.mjs packs/<id>.json'); process.exit(2); }

let pack;
try { pack = JSON.parse(readFileSync(file, 'utf8')); }
catch (e) { console.error(`ERROR  файл не читается как JSON: ${e.message}`); process.exit(1); }

const commonPath = process.argv[3] || join(dirname(file), '_common.json');
let common = {};
if (pack.id !== '_common' && existsSync(commonPath)) {
  try { common = JSON.parse(readFileSync(commonPath, 'utf8')); } catch { /* общий пакет ещё не готов */ }
}

const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);
const isCommon = pack.id === '_common';
const arr = (k) => (Array.isArray(pack[k]) ? pack[k] : []);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const str = (v) => typeof v === 'string' && v.trim().length > 0;
const idRe = /^[a-z][a-z0-9_]*$/;
const cyr = /[А-Яа-яЁё]/;

// Верхний уровень
if (!str(pack.id) || !/^_?[a-z][a-z0-9_]*$/.test(pack.id)) err('id: нужна строка в snake_case');
if (!str(pack.name)) err('name: пусто');
if (!isCommon) {
  if (!num(pack.startCapital) || pack.startCapital <= 0) err('startCapital: нужно положительное число');
  const u = pack.unit || {};
  for (const k of ['refPrice', 'priceMin', 'priceMax', 'cogsPerUnit']) if (!num(u[k])) err(`unit.${k}: нужно число`);
  if (num(u.priceMin) && num(u.priceMax) && !(u.priceMin < u.refPrice && u.refPrice < u.priceMax)) err('unit: должно быть priceMin < refPrice < priceMax');
  if (!str(u.name)) err('unit.name: пусто');
  const m = pack.market || {};
  if (!num(m.unitsPerSlotMonth) || m.unitsPerSlotMonth <= 0) err('market.unitsPerSlotMonth: нужно положительное число');
  if (!num(m.priceElasticity) || m.priceElasticity >= 0) err('market.priceElasticity: нужно отрицательное число');
  const w = m.weights || {};
  const ws = ['price', 'quality', 'reputation', 'location'].map((k) => w[k]);
  if (!ws.every(num)) err('market.weights: нужны price, quality, reputation, location');
  else if (Math.abs(ws.reduce((a, b) => a + b, 0) - 1) > 0.01) err('market.weights: сумма должна быть 1');
  const c = pack.capacity || {};
  if (!num(c.unitsPerStaffMonth) && !num(c.hardCapUnits)) err('capacity: нужно unitsPerStaffMonth или hardCapUnits');
  if (!num(c.minStaff) || !num(c.maxStaff)) err('capacity.minStaff / maxStaff: нужны числа');
  const z = pack.sizing || {};
  for (const k of ['min', 'max', 'default', 'sqftPerUnit', 'unitsServedPerSizeMonth', 'cleaningCostPerSizeMonth']) if (!num(z[k])) err(`sizing.${k}: нужно число`);
  if (!str(z.unitName)) err('sizing.unitName: пусто');
  if (num(z.min) && num(z.max) && num(z.default) && !(z.min <= z.default && z.default <= z.max)) err('sizing: должно быть min <= default <= max');
  const b = pack.benchmarks || {};
  for (const k of ['cogsPct', 'laborPct', 'rentPct', 'netMarginPct']) if (!num(b[k]) || b[k] > 1) err(`benchmarks.${k}: нужна доля от 0 до 1`);
  const kits = Array.isArray(pack.kits) ? pack.kits : [];
  const setupById = new Map((Array.isArray(pack.setup) ? pack.setup : []).filter((x) => x && x.id).map((x) => [x.id, x]));
  for (const want of ['lean', 'standard', 'premium']) if (!kits.some((k) => k && k.id === want)) err(`kits: нет набора «${want}»`);
  kits.forEach((k, i) => {
    const at = `kits[${i}]${k && k.id ? ` (${k.id})` : ''}`;
    if (!k || !Array.isArray(k.items)) return err(`${at}: нужен список items`);
    if (!num(k.size) || (num(z.min) && k.size < z.min) || (num(z.max) && k.size > z.max)) err(`${at}.size: вне sizing.min…max`);
    if (!str(k.name) || !str(k.pitch)) err(`${at}: нужны name и pitch`);
    const inKit = new Set(k.items.map((x) => x && x.id));
    k.items.forEach((x) => { if (!x || !setupById.has(x.id)) err(`${at}: предмета «${x && x.id}» нет в setup`); });
    for (const [id, it] of setupById) if (it.required === true && !inKit.has(id)) err(`${at}: нет обязательного предмета «${id}»`);
    let total = 0;
    k.items.forEach((x) => { const it = setupById.get(x && x.id); if (it && num(it.cost)) total += it.cost * (it.scalesWithSize ? k.size : (num(x.qty) ? x.qty : 1)); });
    if (num(pack.startCapital) && total > pack.startCapital) err(`${at}: набор стоит ${Math.round(total)}, это больше startCapital ${pack.startCapital}`);
  });
}

// Общая проверка списков
const ids = new Map();
function checkList(key, fn, { needSource = true } = {}) {
  arr(key).forEach((it, i) => {
    const at = `${key}[${i}]${it && it.id ? ` (${it.id})` : ''}`;
    if (!it || typeof it !== 'object') return err(`${at}: не объект`);
    if (!str(it.id) || !idRe.test(it.id)) err(`${at}: id в snake_case обязателен`);
    else if (ids.has(`${key}:${it.id}`)) err(`${at}: повтор id`);
    else ids.set(`${key}:${it.id}`, true);
    if (!str(it.name) && !str(it.title)) err(`${at}: нет name/title`);
    for (const k of ['name', 'title', 'label', 'what', 'text', 'category', 'whereToFind']) if (str(it[k]) && cyr.test(it[k])) err(`${at}.${k}: текст для игрока должен быть на английском`);
    if (needSource) {
      if (!str(it.source) || !/^https?:\/\//.test(it.source)) (it.confidence === 'estimate' && str(it.note) ? warn : err)(`${at}: нет ссылки source`);
      if (it.confidence !== undefined && !['verified', 'estimate'].includes(it.confidence)) err(`${at}: confidence — verified или estimate`);
      if (it.confidence === 'estimate' && !str(it.note)) err(`${at}: у оценки должен быть расчёт в note`);
    }
    fn && fn(it, at);
  });
}

const oneOf = (v, list, at, k) => { if (!list.includes(v)) err(`${at}.${k}: «${v}» не из [${list.join(', ')}]`); };

checkList('setup', (it, at) => {
  if (!num(it.cost) || it.cost < 0) err(`${at}.cost: нужно число`);
  oneOf(it.kind, ['equipment', 'furniture', 'buildout', 'deposit', 'permit', 'license', 'inventory', 'other'], at, 'kind');
  if (typeof it.required !== 'boolean') err(`${at}.required: true или false`);
});
checkList('monthlyCosts', (it, at) => {
  if (!num(it.amount) || it.amount < 0) err(`${at}.amount: нужно число`);
  oneOf(it.basis, ['fixed', 'per_staff', 'per_unit', 'pct_revenue', 'per_size'], at, 'basis');
  oneOf(it.kind, ['rent', 'utilities', 'insurance', 'supplies', 'cleaning', 'marketing', 'fees', 'maintenance', 'debt', 'other'], at, 'kind');
  if (it.basis === 'pct_revenue' && it.amount > 1) err(`${at}.amount: доля, а не проценты`);
});
checkList('staff', (it, at) => {
  if (!num(it.hourlyWage) || it.hourlyWage <= 0) err(`${at}.hourlyWage: нужно число`);
  if (!num(it.hoursPerMonth) || it.hoursPerMonth <= 0) err(`${at}.hoursPerMonth: нужно число`);
  if (it.tipped && !num(it.cashWage)) err(`${at}.cashWage: для работника с чаевыми обязателен`);
});
checkList('taxes', (it, at) => {
  if (!num(it.rate) || it.rate < 0) err(`${at}.rate: нужно число`);
  oneOf(it.base, ['revenue', 'taxable_revenue', 'payroll', 'profit', 'rent', 'fixed'], at, 'base');
  oneOf(it.due, ['monthly', 'quarterly', 'annual'], at, 'due');
  if (it.base !== 'fixed' && it.rate > 1) err(`${at}.rate: доля, а не проценты`);
});

const violationIds = new Set([...arr('violations'), ...(common.violations || [])].map((v) => v && v.id));
const officialIds = new Set([...arr('officials'), ...(common.officials || [])].map((o) => o && o.id));

checkList('levers', (it, at) => {
  if (!Array.isArray(it.options) || it.options.length < 2) return err(`${at}.options: нужно минимум два варианта`);
  it.options.forEach((o, j) => {
    if (!str(o.id) || !str(o.label)) err(`${at}.options[${j}]: нужны id и label`);
    if (!num(o.monthlyCost)) err(`${at}.options[${j}].monthlyCost: нужно число`);
    if (str(o.label) && cyr.test(o.label)) err(`${at}.options[${j}].label: на английском`);
    if (o.causes && !violationIds.has(o.causes)) err(`${at}.options[${j}].causes: нарушения «${o.causes}» нет`);
  });
}, { needSource: false });
checkList('shortcuts', (it, at) => {
  if (!str(it.what)) err(`${at}.what: нужен текст для игрока`);
  const s = it.saves || {};
  oneOf(s.basis, ['fixed', 'pct_payroll', 'pct_revenue', 'pct_rent', 'per_staff'], at, 'saves.basis');
  if (!num(s.amount) || s.amount <= 0) err(`${at}.saves.amount: нужно положительное число`);
  if (!violationIds.has(it.violation)) err(`${at}.violation: нарушения «${it.violation}» нет ни здесь, ни в _common`);
}, { needSource: false });
checkList('violations', (it, at) => {
  if (!str(it.law)) err(`${at}.law: нужна ссылка на норму закона`);
  if (!officialIds.has(it.official)) err(`${at}.official: чиновника «${it.official}» нет ни здесь, ни в _common`);
  if (!Array.isArray(it.foundBy) || !it.foundBy.length) err(`${at}.foundBy: пусто`);
  else it.foundBy.forEach((f) => oneOf(f, ['inspection', 'audit', 'complaint', 'sting'], at, 'foundBy'));
  const f = it.fine || {};
  if (![f.base, f.perMonth, f.pctOfSaved].some((v) => num(v) && v > 0) && !(num(it.closureDays) && it.closureDays > 0)) err(`${at}: нет ни штрафа, ни закрытия`);
  if (!num(it.reputationHit)) warn(`${at}.reputationHit: не задан`);
});
checkList('officials', (it, at) => {
  if (!str(it.agency)) err(`${at}.agency: пусто`);
  oneOf(it.role, ['inspector', 'tax_auditor'], at, 'role');
  if (!Array.isArray(it.checks) || !it.checks.length) warn(`${at}.checks: чиновник ничего не проверяет`);
  else it.checks.forEach((c) => { if (!violationIds.has(c)) err(`${at}.checks: нарушения «${c}» нет`); });
});
checkList('reports', (it, at) => {
  if (!str(it.text)) err(`${at}.text: нужен текст для игрока`);
  oneOf(it.role, ['inspector', 'tax_auditor'], at, 'role');
  if (!Array.isArray(it.checks) || !it.checks.length) err(`${at}.checks: пусто`);
  else it.checks.forEach((c) => { if (!violationIds.has(c)) err(`${at}.checks: нарушения «${c}» нет`); });
}, { needSource: false });
checkList('roadmap', (it, at) => {
  if (!str(it.text)) err(`${at}.text: пусто`);
  oneOf(it.kind, ['idea', 'legal', 'permit', 'space', 'money', 'supplier', 'people', 'launch'], at, 'kind');
  if (['legal', 'permit'].includes(it.kind) && (!str(it.link) || !/^https?:\/\//.test(it.link))) warn(`${at}.link: у шага с документом нужна официальная ссылка`);
  if (it.setupItemId && !isCommon && !arr('setup').some((x) => x && x.id === it.setupItemId)) err(`${at}.setupItemId: предмета «${it.setupItemId}» нет в setup`);
}, { needSource: false });
checkList('suppliers', (it, at) => {
  for (const k of ['category', 'what', 'whereToFind']) if (!str(it[k])) err(`${at}.${k}: пусто`);
}, { needSource: false });
arr('setup').forEach((it, i) => {
  if (!it || !['permit', 'license'].includes(it.kind)) return;
  const at = `setup[${i}] (${it.id})`;
  if (!num(it.waitDays)) warn(`${at}.waitDays: у разрешения нужен срок ожидания в днях`);
  if (!str(it.agency)) warn(`${at}.agency: кто выдаёт`);
  if (it.withoutItViolation && !violationIds.has(it.withoutItViolation)) err(`${at}.withoutItViolation: нарушения «${it.withoutItViolation}» нет`);
  if (it.required && !it.withoutItViolation) warn(`${at}.withoutItViolation: что будет, если открыться без этого`);
});
if (!isCommon && !(pack.manager && num(pack.manager.monthlySalary))) err('manager.monthlySalary: нужно число');
checkList('events', (it, at) => {
  const e = it.effect || {};
  if (!str(e.field) || !num(e.mult)) err(`${at}.effect: нужны field и mult`);
  if (!num(it.months)) err(`${at}.months: нужно число`);
});
checkList('ruleCards', (it, at) => {
  if (!str(it.text)) err(`${at}.text: пусто`);
  else if (it.text.length > 280) warn(`${at}.text: ${it.text.length} знаков, лимит 280`);
});

// У каждого нарушения должен быть способ в него попасть
const reachable = new Set([...arr('shortcuts').map((s) => s.violation), ...arr('levers').flatMap((l) => (l.options || []).map((o) => o.causes))]);
arr('violations').forEach((v) => { if (v && v.id && !reachable.has(v.id)) warn(`violations (${v.id}): ни один shortcut или lever к нему не ведёт`); });

// Минимальный объём
const min = isCommon
  ? { taxes: 5, shortcuts: 5, violations: 6, officials: 2, reports: 2, roadmap: 8, ruleCards: 8 }
  : { setup: 12, monthlyCosts: 10, staff: 2, levers: 4, shortcuts: 8, violations: 10, officials: 2, reports: 3, events: 5, ruleCards: 12, roadmap: 10, suppliers: 6 };
for (const [k, n] of Object.entries(min)) if (arr(k).length < n) warn(`${k}: ${arr(k).length}, нужно не меньше ${n}`);
if (!arr('sources').length) warn('sources: список источников пуст');

const all = ['setup', 'monthlyCosts', 'staff', 'taxes', 'violations'].flatMap(arr);
const verified = all.filter((x) => x && x.confidence === 'verified').length;

for (const m of errors) console.log(`ERROR  ${m}`);
for (const m of warns) console.log(`WARN   ${m}`);
console.log(`--- ${file}: ошибок ${errors.length}, предупреждений ${warns.length}; чисел с пометкой verified: ${verified} из ${all.length}`);
process.exit(errors.length ? 1 : 0);
