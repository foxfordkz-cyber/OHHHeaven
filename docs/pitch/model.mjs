#!/usr/bin/env node
// First Year — revenue model for the pitch (B2C subscription only).
//
// Every number the deck and docs/pitch/MONEY.md use comes out of this file.
// Change an assumption and everything downstream is recomputed:
//
//   node docs/pitch/model.mjs                      # full printout
//   node docs/pitch/model.mjs --json               # machine-readable
//   node docs/pitch/model.mjs monthlyChurn=0.15    # override any input by key
//
// Each input is either
//   kind: 'fact'        — taken from a public source (url in `source`), or
//   kind: 'assumption'  — our choice or an estimate; `note` says how it was set.
// No randomness, no hidden constants: the functions below only combine inputs.

/** @typedef {{ value: number, kind: 'fact' | 'assumption', label: string, source?: string, note?: string }} Input */

/** @type {Record<string, Input>} */
export const INPUTS = {
  // ---- Price -------------------------------------------------------------
  priceMonthly: {
    value: 19, kind: 'assumption', label: 'Monthly plan, $',
    note: 'Product decision (build/ROUND3.md, B14). Anchor: business-plan software at $15-20/mo — see MONEY.md §2.',
  },
  priceAnnual: {
    value: 129, kind: 'assumption', label: 'Annual plan, $',
    note: 'Product decision: ~6.8x monthly (43% off 12 x $19). In line with consumer apps whose annual plan is 5-8x monthly — see MONEY.md §2.',
  },
  annualShare: {
    value: 0.5, kind: 'assumption', label: 'Share of payers on the annual plan',
    note: 'Placeholder until the subscription-benchmark source is filled in (MONEY.md §4).',
  },

  // ---- Costs per paying user ----------------------------------------------
  stripePct: { value: 0.029, kind: 'fact', label: 'Card fee, % of charge', source: 'https://stripe.com/pricing' },
  stripeFixed: { value: 0.30, kind: 'fact', label: 'Card fee, $ per charge', source: 'https://stripe.com/pricing' },
  serveCostMonthly: {
    value: 1.0, kind: 'assumption', label: 'Hosting + AI per paying user per month, $',
    note: 'Placeholder estimate, to be replaced with a calculation from model prices (MONEY.md §4).',
  },

  // ---- Funnel --------------------------------------------------------------
  freeToPaid: {
    value: 0.04, kind: 'assumption', label: 'Free starters who become payers',
    note: 'Placeholder; benchmark source to be added (MONEY.md §4).',
  },
  monthlyChurn: {
    value: 0.12, kind: 'assumption', label: 'Monthly churn of monthly-plan payers',
    note: 'Placeholder; benchmark source to be added (MONEY.md §4).',
  },
  annualRenewal: {
    value: 0.3, kind: 'assumption', label: 'Annual plans that renew for year 2',
    note: 'Placeholder; benchmark source to be added (MONEY.md §4).',
  },
  cacPaid: {
    value: 40, kind: 'assumption', label: 'Blended cost to acquire one payer, $',
    note: 'Placeholder; benchmark source to be added (MONEY.md §4).',
  },

  // ---- Market --------------------------------------------------------------
  usAdults21to45: {
    value: 110e6, kind: 'assumption', label: 'US residents aged 21-45',
    note: 'Placeholder until the Census figure is filled in (MONEY.md §3).',
  },
  businessApplicationsPerYear: {
    value: 5.2e6, kind: 'assumption', label: 'US new-business applications per year',
    note: 'Placeholder until the Census BFS figure is filled in (MONEY.md §3).',
  },

  // ---- Path to $100M ARR -----------------------------------------------------
  targetArr: { value: 100e6, kind: 'assumption', label: 'Target ARR, $', note: 'Bar set by the judges.' },
};

/** Apply `key=value` overrides from argv to a copy of INPUTS. */
export function withOverrides(inputs, args) {
  const out = structuredClone(inputs);
  for (const arg of args) {
    const m = /^([A-Za-z0-9]+)=(-?[\d.e+]+)$/.exec(arg);
    if (!m) continue;
    const [, key, raw] = m;
    if (!(key in out)) throw new Error(`Unknown input "${key}". Known: ${Object.keys(out).join(', ')}`);
    out[key] = { ...out[key], value: Number(raw), kind: 'assumption', note: `Overridden on the command line (was ${inputs[key].value}).` };
  }
  return out;
}

/** All derived numbers. Pure: same inputs, same outputs. */
export function compute(inp) {
  const v = (k) => inp[k].value;

  // Revenue per payer per month, blended across plans, after card fees.
  const monthlyNet = v('priceMonthly') * (1 - v('stripePct')) - v('stripeFixed');
  const annualNet = v('priceAnnual') * (1 - v('stripePct')) - v('stripeFixed');
  const arpuGross = (1 - v('annualShare')) * v('priceMonthly') + v('annualShare') * (v('priceAnnual') / 12);
  const arpuNet = (1 - v('annualShare')) * monthlyNet + v('annualShare') * (annualNet / 12);
  const marginPerMonth = arpuNet - v('serveCostMonthly');

  // Lifetime of one payer, in months.
  const monthlyLifetime = 1 / v('monthlyChurn');
  const annualLifetime = 12 / (1 - v('annualRenewal')); // 12 months per year, geometric renewals
  const ltvMonthly = monthlyLifetime * (monthlyNet - v('serveCostMonthly'));
  const ltvAnnual = (annualNet - 12 * v('serveCostMonthly')) / (1 - v('annualRenewal'));
  const ltv = (1 - v('annualShare')) * ltvMonthly + v('annualShare') * ltvAnnual;
  const ltvToCac = ltv / v('cacPaid');
  const paybackMonths = v('cacPaid') / marginPerMonth;

  // Payers needed for the target.
  const payersForTarget = v('targetArr') / (12 * arpuGross);

  return {
    arpuGross, arpuNet, marginPerMonth,
    monthlyLifetime, annualLifetime,
    ltvMonthly, ltvAnnual, ltv, ltvToCac, paybackMonths,
    payersForTarget,
  };
}

const usd = (n) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${n.toLocaleString('en-US', { maximumFractionDigits: n < 100 ? 2 : 0 })}`);
const num = (n) => Math.round(n).toLocaleString('en-US');

function print(inp, out) {
  const lines = [];
  lines.push('First Year — revenue model (B2C subscription)', '');
  lines.push('INPUTS  (F = public source, A = assumption)');
  for (const [key, i] of Object.entries(inp)) {
    lines.push(`  ${i.kind === 'fact' ? 'F' : 'A'}  ${i.label.padEnd(48)} ${String(i.value).padStart(12)}   ${key}`);
  }
  lines.push('', 'UNIT ECONOMICS');
  lines.push(`  Blended ARPU, gross              ${usd(out.arpuGross)} / month`);
  lines.push(`  Blended ARPU, after card fees    ${usd(out.arpuNet)} / month`);
  lines.push(`  Contribution per payer           ${usd(out.marginPerMonth)} / month`);
  lines.push(`  LTV, monthly plan                ${usd(out.ltvMonthly)}  (${out.monthlyLifetime.toFixed(1)} months)`);
  lines.push(`  LTV, annual plan                 ${usd(out.ltvAnnual)}  (${out.annualLifetime.toFixed(1)} months)`);
  lines.push(`  LTV, blended                     ${usd(out.ltv)}`);
  lines.push(`  CAC                              ${usd(inp.cacPaid.value)}`);
  lines.push(`  LTV / CAC                        ${out.ltvToCac.toFixed(1)}x`);
  lines.push(`  CAC payback                      ${out.paybackMonths.toFixed(1)} months`);
  lines.push('', 'PATH TO TARGET');
  lines.push(`  Paying subscribers for ${usd(inp.targetArr.value)} ARR   ${num(out.payersForTarget)}`);
  return lines.join('\n');
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('model.mjs');
if (isMain) {
  const args = process.argv.slice(2);
  const inp = withOverrides(INPUTS, args);
  const out = compute(inp);
  if (args.includes('--json')) console.log(JSON.stringify({ inputs: inp, outputs: out }, null, 2));
  else console.log(print(inp, out));
}
