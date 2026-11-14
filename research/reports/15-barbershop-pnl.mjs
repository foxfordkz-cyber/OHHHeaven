#!/usr/bin/env node
// P&L of a typical barbershop month, straight from packs/barbershop.json.
// Usage: node research/reports/15-barbershop-pnl.mjs [packs/barbershop.json]
// Honest owner vs. an owner who turns on every shortcut, and what an inspection costs after N months.
import { readFileSync } from 'node:fs';

const pack = JSON.parse(readFileSync(process.argv[2] || 'packs/barbershop.json', 'utf8'));
const $ = (v) => (v < 0 ? '-' : '') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US');
const pct = (v) => (v * 100).toFixed(1) + '%';
const role = (id) => pack.staff.find((r) => r.id === id);
const lever = (id, opt) => pack.levers.find((l) => l.id === id).options.find((o) => o.id === opt);
const setup = new Map(pack.setup.map((x) => [x.id, x]));
const payrollTaxRate = pack.extra.payModels.employerPayrollTaxRate;

function kitTotal(id) {
  const kit = pack.kits.find((k) => k.id === id);
  return kit.items.reduce((a, it) => a + setup.get(it.id).cost * (setup.get(it.id).scalesWithSize ? kit.size : it.qty), 0);
}

// One month. s: { chairs, staff: {role: n}, cuts, price, tier, levers: {id: option}, shortcuts: [id] }
function month(s) {
  const lines = [];
  const add = (label, amount, kind) => lines.push({ label, amount, kind });
  const staffCount = Object.values(s.staff).reduce((a, n) => a + n, 0);
  const revenue = s.cuts * s.price;
  add(`Haircuts: ${s.cuts} x $${s.price}`, revenue, 'revenue');
  let retail = 0;
  if (s.levers.retail === 'shelf') {
    retail = s.cuts * pack.extra.retail.revenuePerHaircut;
    add('Retail products', retail, 'revenue');
    add('Retail products at wholesale cost', -retail * pack.extra.retail.cogsShare, 'cogs');
  }
  add('Supplies per haircut', -s.cuts * pack.unit.cogsPerUnit, 'cogs');
  let payroll = 0;
  for (const [id, n] of Object.entries(s.staff)) payroll += n * role(id).hourlyWage * role(id).hoursPerMonth;
  if (s.levers.pay_model === 'commission') {
    const cutPay = ['barber', 'apprentice'].reduce((a, id) => a + (s.staff[id] || 0) * role(id).hourlyWage * role(id).hoursPerMonth, 0);
    payroll += Math.max(0, pack.extra.payModels.commission.barberShare * revenue - cutPay);
  }
  add('Wages', -payroll, 'payroll');
  add(`Employer payroll taxes and insurance (${pct(payrollTaxRate)})`, -payroll * payrollTaxRate, 'payroll_tax');
  const rent = pack.extra.rentByTier[s.tier].monthlyFor750Sqft;
  add(`Rent, ${s.tier} tier, 750 sq ft`, -rent, 'rent');
  for (const c of pack.monthlyCosts) {
    const amount = c.basis === 'fixed' ? c.amount : c.basis === 'per_staff' ? c.amount * staffCount : c.basis === 'per_size' ? c.amount * s.chairs
      : c.basis === 'per_unit' ? c.amount * s.cuts : c.amount * (revenue + retail);
    add(c.name, -amount, 'opex');
  }
  add('Cleaning supplies per chair', -s.chairs * pack.sizing.cleaningCostPerSizeMonth, 'opex');
  for (const [id, opt] of Object.entries(s.levers)) {
    const o = lever(id, opt);
    if (o.monthlyCost) add(`${pack.levers.find((l) => l.id === id).name}: ${o.label}`, -o.monthlyCost, 'opex');
  }
  const base = { payroll, revenue: revenue + retail, rent, staffCount };
  const saved = {};
  for (const id of s.shortcuts || []) {
    const sc = pack.shortcuts.find((x) => x.id === id);
    const v = sc.saves.basis === 'fixed' ? sc.saves.amount : sc.saves.basis === 'pct_payroll' ? sc.saves.amount * base.payroll
      : sc.saves.basis === 'pct_revenue' ? sc.saves.amount * base.revenue : sc.saves.basis === 'pct_rent' ? sc.saves.amount * base.rent : sc.saves.amount * base.staffCount;
    saved[sc.violation] = (saved[sc.violation] || 0) + v;
    add(`Shortcut: ${sc.name}`, v, 'saving');
  }
  const total = (kind) => lines.filter((l) => l.kind === kind).reduce((a, l) => a + l.amount, 0);
  const allRevenue = total('revenue');
  const profit = lines.reduce((a, l) => a + l.amount, 0);
  return { lines, revenue: allRevenue, profit, saved, shares: { cogs: -total('cogs') / allRevenue, labor: -(total('payroll') + total('payroll_tax')) / allRevenue, rent: -total('rent') / allRevenue, net: profit / allRevenue } };
}

function fine(violationId, months, savedPerMonth) {
  const v = pack.violations.find((x) => x.id === violationId);
  const f = v.fine || {};
  const raw = (f.base || 0) + (f.perMonth || 0) * months + (f.pctOfSaved || 0) * savedPerMonth * months;
  return typeof f.max === 'number' ? Math.min(raw, f.max) : raw;
}

function print(title, m) {
  console.log(`\n### ${title}\n`);
  console.log('| Line | Month |');
  console.log('|---|---:|');
  for (const l of m.lines) console.log(`| ${l.label} | ${$(l.amount)} |`);
  console.log(`| **Profit before the owner's income taxes** | **${$(m.profit)}** |`);
  console.log(`\nShares of revenue: supplies ${pct(m.shares.cogs)} (norm ${pct(pack.benchmarks.cogsPct)}), labor ${pct(m.shares.labor)} (norm ${pct(pack.benchmarks.laborPct)}), rent ${pct(m.shares.rent)} (norm ${pct(pack.benchmarks.rentPct)}), net ${pct(m.shares.net)} (norm ${pct(pack.benchmarks.netMarginPct)}).`);
}

console.log(`# Barbershop P&L from ${process.argv[2] || 'packs/barbershop.json'} (version ${pack.version})`);
console.log('\n## Kits\n');
console.log('| Kit | Chairs | Cost | Cash left of $' + pack.startCapital.toLocaleString('en-US') + ' |');
console.log('|---|---:|---:|---:|');
for (const k of pack.kits) console.log(`| ${k.name} | ${k.size} | ${$(kitTotal(k.id))} | ${$(pack.startCapital - kitTotal(k.id))} |`);

const honestLevers = { pay_model: 'hourly', cleaning: 'staff_daily', booking: 'app', retail: 'shelf', amenities: 'basic' };
const honest = { chairs: 4, staff: { barber: 4 }, cuts: 580, price: pack.unit.refPrice, tier: 'mid', levers: honestLevers, shortcuts: [] };
const mHonest = month(honest);
print('Honest owner: 4 chairs, 4 barbers, mid-tier rent, 580 haircuts', mHonest);

console.log('\n### Honest owner: sensitivity\n');
console.log('| Case | Revenue | Profit | Net margin |');
console.log('|---|---:|---:|---:|');
const cases = [
  ['Slow month, 480 cuts', { cuts: 480 }], ['Typical month, 580 cuts', {}], ['Strong month, 680 cuts', { cuts: 680 }],
  ['Cheap tier rent, 580 cuts', { tier: 'cheap' }], ['Prime tier rent, 580 cuts', { tier: 'prime' }],
  ['3 barbers, 520 cuts (Saturday clients lost)', { staff: { barber: 3 }, cuts: 520 }],
  ['Commission 50%, 580 cuts', { levers: { ...honestLevers, pay_model: 'commission' } }],
  ['Price $60, 520 cuts', { price: 60, cuts: 520 }],
];
for (const [name, over] of cases) { const m = month({ ...honest, ...over }); console.log(`| ${name} | ${$(m.revenue)} | ${$(m.profit)} | ${pct(m.shares.net)} |`); }

const cheat = { ...honest, levers: { ...honestLevers, cleaning: 'minimal' }, shortcuts: pack.shortcuts.map((x) => x.id) };
const mCheat = month(cheat);
print('Owner who cuts every corner: same shop, all shortcuts on, minimal cleaning', mCheat);
console.log(`\nExtra profit against the honest owner: ${$(mCheat.profit - mHonest.profit)} a month.`);

const MONTHS = 6;
console.log(`\n### What an inspection finds after ${MONTHS} months\n`);
console.log('| Violation | Found by | Saved in ' + MONTHS + ' months | Fine | Law |');
console.log('|---|---|---:|---:|---|');
let totalSaved = 0, totalFine = 0;
const found = { ...mCheat.saved, dirty_shop: (lever('cleaning', 'staff_daily').monthlyCost - lever('cleaning', 'minimal').monthlyCost) };
for (const [vid, perMonth] of Object.entries(found)) {
  const v = pack.violations.find((x) => x.id === vid);
  const o = pack.officials.find((x) => x.id === v.official);
  const f = fine(vid, MONTHS, perMonth);
  totalSaved += perMonth * MONTHS; totalFine += f;
  console.log(`| ${v.name} | ${o.name} (${o.role}) | ${$(perMonth * MONTHS)} | ${$(f)} | ${v.law.split(';')[0]} |`);
}
console.log(`| **Total** | | **${$(totalSaved)}** | **${$(totalFine)}** | |`);
console.log(`\nNet result of ${MONTHS} months of shortcuts if everything is found: ${$(totalSaved - totalFine)}. Reputation hit: ${pct(Object.keys(found).reduce((a, vid) => a + (pack.violations.find((x) => x.id === vid).reputationHit || 0), 0))} in total.`);

console.log('\n### Opening before the licenses arrive\n');
for (const id of ['shop_owner_license', 'dohmh_barber_permit']) {
  const it = setup.get(id);
  console.log(`- ${it.name}: fee ${$(it.cost)}, wait ${it.waitDays} days; opening without it for 1 month costs ${$(fine(it.withoutItViolation, 1, 0))} if found.`);
}
const rentDay = pack.extra.rentByTier.mid.monthlyFor750Sqft / 30;
console.log(`- Rent while you wait 14 days at the mid tier: ${$(rentDay * 14)}.`);
