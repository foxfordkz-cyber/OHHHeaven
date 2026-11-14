#!/usr/bin/env node
// First Year — revenue model for the pitch. B2C subscription only:
// no partner, corporate, advertising or prize-pool revenue anywhere below.
//
// Every number in docs/pitch/MONEY.md and in the deck comes out of this file.
// Change an input and everything downstream is recomputed:
//
//   node docs/pitch/model.mjs                        # full printout
//   node docs/pitch/model.mjs freeToPaid=0.06        # override any input by key
//   node docs/pitch/model.mjs --json                 # inputs and outputs as JSON
//   node docs/pitch/model.mjs --check                # exit 1 if LTV <= CAC
//
// Each input is one of
//   kind 'fact'        — a published number; `source` is the page it is on;
//   kind 'assumption'  — our decision or estimate; `note` says how it was set.
// The functions below only combine inputs: no randomness, no hidden constants.

/**
 * @typedef {object} Input
 * @property {number} value
 * @property {'fact' | 'assumption'} kind
 * @property {string} label
 * @property {string} [source]  URL of the page the number is on
 * @property {string} [note]    how an assumption was set, or a caveat on a fact
 */

/** @type {Record<string, Input>} */
export const INPUTS = {
  // ---- 1. Price ------------------------------------------------------------
  priceMonthly: {
    value: 19, kind: 'assumption', label: 'Monthly plan, $',
    note: 'Product decision (build/ROUND3.md, B14). Same as LivePlan Standard billed monthly ($20).',
  },
  priceAnnual: {
    value: 149, kind: 'assumption', label: 'Annual plan, $',
    note: 'Product decision: 7.8x monthly, 35% off 12 x $19. LivePlan annual is 9x its monthly price ($15 x 12 vs $20).',
  },
  annualShare: {
    value: 0.336, kind: 'fact', label: 'New subscriptions that pick the annual plan',
    source: 'https://www.revenuecat.com/state-of-subscription-apps',
    note: 'RevenueCat State of Subscription Apps 2026: annual plans are 33.6% of subscription durations (secondary summary of the report). Mobile apps; we are web.',
  },

  // ---- 2. Retention ----------------------------------------------------------
  monthlyRetention12: {
    value: 0.08, kind: 'fact', label: 'Monthly-plan payers still paying at month 12',
    source: 'https://www.revenuecat.com/state-of-subscription-apps',
    note: 'RevenueCat SOSA 2026, all categories: 12-month retention of monthly plans fell from 10% to 8%.',
  },
  annualRenewal: {
    value: 0.28, kind: 'fact', label: 'Annual-plan payers who renew for year 2',
    source: 'https://www.revenuecat.com/state-of-subscription-apps',
    note: 'RevenueCat SOSA 2026, all categories: first-year annual retention fell from 31% to 28%.',
  },

  // ---- 3. Cost to serve ------------------------------------------------------
  cardPct: { value: 0.029, kind: 'fact', label: 'Card fee, share of each charge', source: 'https://stripe.com/pricing' },
  cardFixed: { value: 0.30, kind: 'fact', label: 'Card fee, $ per charge', source: 'https://stripe.com/pricing' },
  billingPct: {
    value: 0.007, kind: 'fact', label: 'Stripe Billing fee, share of each charge',
    source: 'https://stripe.com/billing/pricing', note: 'Pay-as-you-go Billing rate since July 2024.',
  },
  llmInPerM: {
    value: 0.30, kind: 'fact', label: 'LLM input, $ per 1M tokens (Gemini 2.5 Flash)',
    source: 'https://ai.google.dev/gemini-api/docs/pricing',
  },
  llmOutPerM: {
    value: 2.50, kind: 'fact', label: 'LLM output, $ per 1M tokens (Gemini 2.5 Flash)',
    source: 'https://ai.google.dev/gemini-api/docs/pricing',
  },
  llmCallsPaid: {
    value: 300, kind: 'assumption', label: 'LLM calls per paying user per month',
    note: 'Ten a day: city news, advisor answers, month review. The game runs without AI (fallback path), so this is a ceiling we control.',
  },
  llmCallsFree: {
    value: 100, kind: 'assumption', label: 'LLM calls per free user (whole free month)',
    note: 'Free tier = city, idea, place, opening plan and the first month of the shop.',
  },
  tokensInPerCall: { value: 3000, kind: 'assumption', label: 'Input tokens per call', note: 'Prompt with the shop state and pack rules.' },
  tokensOutPerCall: { value: 400, kind: 'assumption', label: 'Output tokens per call', note: 'A short news item or answer.' },
  hostingPerPaid: {
    value: 0.50, kind: 'assumption', label: 'Hosting per paying user per month, $',
    note: 'One Node server holds a whole city; the engine is pure functions over a JSON snapshot. Deliberately generous.',
  },
  hostingPerFree: { value: 0.10, kind: 'assumption', label: 'Hosting per free user, $', note: 'One month of play.' },

  // ---- 4. Acquisition --------------------------------------------------------
  cpc: {
    value: 0.70, kind: 'fact', label: 'Meta ads, cost per click (traffic campaigns), $',
    source: 'https://www.wordstream.com/blog/facebook-ads-benchmarks-2025',
    note: 'WordStream/LocaliQ 2025, all industries.',
  },
  landingToStart: {
    value: 0.066, kind: 'fact', label: 'Landing visitors who start a free game',
    source: 'https://unbounce.com/conversion-benchmark-report/',
    note: 'Unbounce Conversion Benchmark Report 2024: median landing-page conversion, all industries.',
  },
  freeToPaid: {
    value: 0.04, kind: 'assumption', label: 'Free players who become payers',
    source: 'https://www.lennysnewsletter.com/p/what-is-a-good-free-to-paid-conversion',
    note: 'Middle of the 3-5% "good" band for self-serve freemium (Lenny Rachitsky and Kyle Poyar, 1,000+ products). Duolingo: 9.0% of MAU pay.',
  },
  paidShare: {
    value: 0.10, kind: 'assumption', label: 'Payers who come from paid ads',
    note: 'Plan: paid ads only for testing; growth from organic channels built into the product (MONEY.md §5).',
  },
  organicCostPerPayer: {
    value: 15, kind: 'assumption', label: 'Organic cost per payer (content, creators, referral credit), $',
    note: 'Half of Duolingo 2024 marketing per net new paying subscriber (computed below from its filings).',
  },
  duolingoMarketing2024: {
    value: 90.49e6, kind: 'fact', label: 'Duolingo sales & marketing 2024, $',
    source: 'https://www.statista.com/statistics/1248057/duolingo-annual-sales-and-marketing-expenses/',
  },
  duolingoPaidEnd2023: {
    value: 6.6e6, kind: 'fact', label: 'Duolingo paid subscribers, end of 2023',
    source: 'https://www.sec.gov/Archives/edgar/data/1562088/000156208824000048/q4fy23shareholderletter.htm',
  },
  duolingoPaidEnd2024: {
    value: 9.5e6, kind: 'fact', label: 'Duolingo paid subscribers, end of 2024',
    source: 'https://investors.duolingo.com/static-files/99006c40-d8cf-41ca-b5b1-c5cb1fa5ba88',
  },
  duolingoPaidNow: {
    value: 11.5e6, kind: 'fact', label: 'Duolingo paid subscribers, Sept 30 2025',
    source: 'https://www.sec.gov/Archives/edgar/data/1562088/000162828025049514/q3fy25duolingo9-30x25share.htm',
  },

  // ---- 5. Market -------------------------------------------------------------
  usPopulation: {
    value: 340_110_988, kind: 'fact', label: 'US residents, July 1 2024',
    source: 'https://www.census.gov/quickfacts/fact/table/US/PST045224',
  },
  usUnder18: {
    value: 73.1e6, kind: 'fact', label: 'US residents under 18, 2024',
    source: 'https://www.census.gov/newsroom/press-releases/2025/older-adults-outnumber-children.html',
  },
  us21to45: {
    value: 113e6, kind: 'assumption', label: 'US residents aged 21-45',
    source: 'https://www2.census.gov/programs-surveys/popest/tables/2020-2024/national/asrh/nc-est2024-agesex.xlsx',
    note: 'Estimate: five 5-year cohorts (20-24 ... 40-44) of 22.0-23.6M each in Census V2024, about 113M; shifting one year to 21-45 changes this by <1%. Exact sum not read: the Census file is not reachable from our build machine.',
  },
  consideringShare: {
    value: 0.14, kind: 'fact', label: 'Adults considering starting a business',
    source: 'https://www.norc.org/research/library/nationwide-entrepreneurship-survey-data-publicly-released-finds-steady-decline-interest-new-business-ventures.html',
    note: 'NORC Entrepreneurship in the Population (EPOP) 2025, probability sample: ~14% (17% in 2022). Applied to 21-45 as is; no age split published.',
  },
  businessApplications: {
    value: 5_246_630, kind: 'fact', label: 'US new-business applications, 2024',
    source: 'https://fred.stlouisfed.org/graph/?g=1nSO0',
    note: 'Census Business Formation Statistics, sum of 2024 monthly seasonally adjusted totals (FRED BABATOTALSAUS).',
  },
  foodApplications: {
    value: 292_000, kind: 'assumption', label: 'Of them: accommodation & food services, 2024',
    source: 'https://www.census.gov/econ/bfs/pdf/historic/bfs_2024m10.pdf',
    note: 'Estimate: mean of the five 2024 monthly figures we read (26,838; 26,026; 22,918; 22,795; 23,187 = 24,353) x 12.',
  },
  nycPopulation: {
    value: 8_478_072, kind: 'fact', label: 'New York City residents, July 1 2024',
    source: 'https://www.census.gov/newsroom/press-releases/2025/vintage-2024-popest.html',
  },
  metroShare: {
    value: 0.864, kind: 'fact', label: 'US residents living in a metro area, 2024',
    source: 'https://www.census.gov/library/stories/2025/04/metro-area-trends.html',
  },

  // ---- 6. Path to the target ---------------------------------------------------
  penetration: {
    value: 0.04, kind: 'assumption', label: 'Share of the reachable pool paying at any time',
    note: 'Same at every step so the steps compare. Below Duolingo (9.0% of its MAU pay) because our pool is not our users yet.',
  },
  targetArr: { value: 100e6, kind: 'assumption', label: 'Target ARR, $', note: 'Bar set by the judges.' },
};

/** Return a copy of `inputs` with `key=value` arguments applied. Unknown keys throw. */
export function withOverrides(inputs, args) {
  const out = structuredClone(inputs);
  for (const arg of args) {
    const m = /^([A-Za-z0-9]+)=(-?[\d._e+]+)$/.exec(arg);
    if (!m) continue;
    const [, key, raw] = m;
    if (!(key in out)) throw new Error(`Unknown input "${key}". Known: ${Object.keys(out).join(', ')}`);
    const value = Number(raw.replaceAll('_', ''));
    if (!Number.isFinite(value)) throw new Error(`Input "${key}" needs a number, got "${raw}"`);
    out[key] = { ...out[key], value, kind: 'assumption', note: `Overridden on the command line (was ${inputs[key].value}).` };
  }
  return out;
}

/** Every derived number. Pure: the same inputs give the same outputs. */
export function compute(inp) {
  const v = (key) => {
    if (!(key in inp)) throw new Error(`Missing input "${key}"`);
    return inp[key].value;
  };

  // -- Revenue per charge, after card and billing fees.
  const net = (price) => price * (1 - v('cardPct') - v('billingPct')) - v('cardFixed');
  const netMonthly = net(v('priceMonthly'));
  const netAnnual = net(v('priceAnnual'));

  // -- Cost to serve.
  const llmCall = (v('tokensInPerCall') * v('llmInPerM') + v('tokensOutPerCall') * v('llmOutPerM')) / 1e6;
  const servePaid = v('llmCallsPaid') * llmCall + v('hostingPerPaid'); // per paying user per month
  const serveFree = v('llmCallsFree') * llmCall + v('hostingPerFree'); // per free user, whole free month

  // -- Lifetimes. Monthly plans: constant churn fitted to month-12 retention
  //    (real curves churn faster early and slower later, so this undercounts the tail).
  const monthlyChurn = 1 - v('monthlyRetention12') ** (1 / 12);
  const lifeMonthly = 1 / monthlyChurn; // paid months
  const yearsAnnual = 1 / (1 - v('annualRenewal')); // paid years
  const lifeAnnual = 12 * yearsAnnual; // months of service

  // -- LTV: contribution over a lifetime (revenue after fees minus cost to serve).
  const ltvMonthly = lifeMonthly * (netMonthly - servePaid);
  const ltvAnnual = yearsAnnual * (netAnnual - 12 * servePaid);
  const a = v('annualShare');
  const ltv = (1 - a) * ltvMonthly + a * ltvAnnual;

  // -- The paying base in steady state: annual payers stay longer, so they are a
  //    bigger share of the base than of new subscriptions.
  const lifeNew = (1 - a) * lifeMonthly + a * lifeAnnual; // average months per new payer
  const baseAnnualShare = (a * lifeAnnual) / lifeNew;
  const arpu = (1 - baseAnnualShare) * v('priceMonthly') + baseAnnualShare * (v('priceAnnual') / 12);
  const contributionPerMonth = ltv / lifeNew;
  const grossMargin = contributionPerMonth / arpu;

  // -- CAC. Paid: click -> free game -> payer. Every payer also carries the cost of
  //    serving the free players it took to find them.
  const costPerFreeStart = v('cpc') / v('landingToStart');
  const cacPaidAds = costPerFreeStart / v('freeToPaid');
  const freeTierPerPayer = serveFree / v('freeToPaid');
  const cac = v('paidShare') * cacPaidAds + (1 - v('paidShare')) * v('organicCostPerPayer') + freeTierPerPayer;
  const ltvToCac = ltv / cac;
  const ltvToCacPaidOnly = ltv / (cacPaidAds + freeTierPerPayer);
  const paybackMonths = cac / contributionPerMonth;
  // Largest share of payers that can come from paid ads and keep LTV/CAC at 3 or more.
  const maxPaidShareFor3x = (ltv / 3 - freeTierPerPayer - v('organicCostPerPayer')) / (cacPaidAds - v('organicCostPerPayer'));
  const duolingoMarketingPerNetPayer = v('duolingoMarketing2024') / (v('duolingoPaidEnd2024') - v('duolingoPaidEnd2023'));

  // -- Market, top down.
  const usAdults = v('usPopulation') - v('usUnder18');
  const consideringAdults = usAdults * v('consideringShare');
  const considering21to45 = v('us21to45') * v('consideringShare');
  const share21to45 = v('us21to45') / v('usPopulation');
  const foodShare = v('foodApplications') / v('businessApplications');

  // -- Path to the target: the reachable pool grows step by step.
  const nycConsidering = v('nycPopulation') * share21to45 * v('consideringShare');
  const steps = [
    { name: 'Coffee and food, New York City', pool: nycConsidering * foodShare },
    { name: 'Every kind of small business, New York City', pool: nycConsidering },
    { name: 'Every kind of small business, every US metro', pool: considering21to45 * v('metroShare') },
  ].map((s) => {
    const payers = s.pool * v('penetration');
    return { ...s, payers, arr: payers * arpu * 12 };
  });
  const payersForTarget = v('targetArr') / (12 * arpu);
  const last = steps[steps.length - 1];
  const penetrationForTarget = payersForTarget / last.pool;

  // -- Bottom up: what the funnel must do every month to hold the target base.
  const newPayersPerMonth = payersForTarget / lifeNew;
  const freeStartsPerMonth = newPayersPerMonth / v('freeToPaid');
  const marketingPerYear = newPayersPerMonth * 12 * cac;
  const marketingShareOfArr = marketingPerYear / v('targetArr');

  // -- Retention for the monthly plan: share of a cohort still paying after m months.
  const retention = [1, 2, 3, 6, 12, 24].map((m) => ({ month: m, share: (1 - monthlyChurn) ** m }));

  return {
    retention,
    netMonthly, netAnnual, llmCall, servePaid, serveFree,
    monthlyChurn, lifeMonthly, lifeAnnual, lifeNew,
    ltvMonthly, ltvAnnual, ltv,
    baseAnnualShare, arpu, contributionPerMonth, grossMargin,
    costPerFreeStart, cacPaidAds, freeTierPerPayer, cac, ltvToCac, ltvToCacPaidOnly, paybackMonths,
    maxPaidShareFor3x, duolingoMarketingPerNetPayer,
    usAdults, consideringAdults, considering21to45, share21to45, foodShare,
    steps, payersForTarget, penetrationForTarget,
    newPayersPerMonth, freeStartsPerMonth, marketingPerYear, marketingShareOfArr,
  };
}

/** The levers that move LTV/CAC most, each tried alone against the base case. */
export const SENSITIVITY = {
  freeToPaid: [0.02, 0.04, 0.06, 0.08],
  paidShare: [0, 0.1, 0.2, 0.3],
  monthlyRetention12: [0.05, 0.08, 0.12],
  annualRenewal: [0.2, 0.28, 0.36],
  priceAnnual: [129, 149, 179],
  organicCostPerPayer: [0, 15, 31],
};

/** LTV, CAC and LTV/CAC for each value in SENSITIVITY, others held at `inp`. */
export function sensitivity(inp, grid = SENSITIVITY) {
  return Object.entries(grid).map(([key, values]) => ({
    key,
    label: inp[key].label,
    cases: values.map((value) => {
      const o = compute({ ...inp, [key]: { ...inp[key], value } });
      return { value, ltv: o.ltv, cac: o.cac, ltvToCac: o.ltvToCac };
    }),
  }));
}

// ---- Printing ------------------------------------------------------------------

const money = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `$${(n / 1e3).toFixed(0)}k`;
  return abs > 0 && abs < 0.1 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
};
const count = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : Math.round(n).toLocaleString('en-US'));
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const row = (label, value) => `  ${label.padEnd(52)} ${value}`;

export function report(inp, o) {
  const L = [];
  L.push('First Year — revenue model (B2C subscription only)');
  L.push('F = published fact (source in --json), A = our assumption', '');

  L.push('INPUTS');
  for (const [key, i] of Object.entries(inp)) {
    L.push(`  ${i.kind === 'fact' ? 'F' : 'A'}  ${i.label.padEnd(60)} ${String(i.value).padStart(12)}  ${key}`);
  }

  L.push('', 'ONE PAYING USER');
  L.push(row('Monthly charge after fees', money(o.netMonthly)));
  L.push(row('Annual charge after fees', money(o.netAnnual)));
  L.push(row('Cost to serve a payer per month (LLM + hosting)', `${money(o.servePaid)}  (LLM call ${money(o.llmCall)})`));
  L.push(row('Monthly churn fitted to month-12 retention', pct(o.monthlyChurn)));
  L.push(row('Monthly plan still paying after 1/2/3/6/12/24 months', o.retention.map((r) => pct(r.share)).join(' / ')));
  L.push(row('Paid months, monthly plan', o.lifeMonthly.toFixed(1)));
  L.push(row('Months of service, annual plan', o.lifeAnnual.toFixed(1)));
  L.push(row('LTV, monthly plan', money(o.ltvMonthly)));
  L.push(row('LTV, annual plan', money(o.ltvAnnual)));
  L.push(row('LTV, blended by plan mix', money(o.ltv)));
  L.push(row('Annual plans in the paying base', pct(o.baseAnnualShare)));
  L.push(row('ARPU of the paying base, per month', money(o.arpu)));
  L.push(row('Gross margin', pct(o.grossMargin)));

  L.push('', 'ACQUISITION');
  L.push(row('Paid ads: cost per free game started', money(o.costPerFreeStart)));
  L.push(row('Paid ads: cost per payer', money(o.cacPaidAds)));
  L.push(row('Free tier served per payer found', money(o.freeTierPerPayer)));
  L.push(row(`Blended CAC (${pct(inp.paidShare.value)} of payers from ads)`, money(o.cac)));
  L.push(row('LTV / CAC, blended', `${o.ltvToCac.toFixed(1)}x`));
  L.push(row('LTV / CAC, paid ads only', `${o.ltvToCacPaidOnly.toFixed(2)}x`));
  L.push(row('CAC payback', `${o.paybackMonths.toFixed(1)} months`));
  L.push(row('Max share of payers from ads for LTV/CAC >= 3', pct(Math.max(0, o.maxPaidShareFor3x))));
  L.push(row('Duolingo 2024 marketing per net new paying sub', money(o.duolingoMarketingPerNetPayer)));

  L.push('', 'MARKET, TOP DOWN');
  L.push(row('US adults (18+)', count(o.usAdults)));
  L.push(row('US adults considering starting a business', count(o.consideringAdults)));
  L.push(row('US 21-45 (our user) considering a business', count(o.considering21to45)));
  L.push(row('Food share of new-business applications', pct(o.foodShare)));

  L.push('', `PATH TO ${money(inp.targetArr.value)} ARR  (penetration ${pct(inp.penetration.value)} of each pool)`);
  o.steps.forEach((s, i) => {
    L.push(`  ${i + 1}. ${s.name}`);
    L.push(row('     reachable pool (21-45, considering a business)', count(s.pool)));
    L.push(row('     paying subscribers', count(s.payers)));
    L.push(row('     ARR', money(s.arr)));
  });
  L.push(row('Paying subscribers needed for the target', count(o.payersForTarget)));
  L.push(row('  as a share of the step-3 pool', pct(o.penetrationForTarget)));
  L.push(row('  as a share of Duolingo paid subscribers today', pct(o.payersForTarget / inp.duolingoPaidNow.value)));

  L.push('', 'BOTTOM UP, AT THE TARGET');
  L.push(row('New payers needed per month', count(o.newPayersPerMonth)));
  L.push(row('Free games started per month', count(o.freeStartsPerMonth)));
  L.push(row('  vs new-business applications per month (Census)', count(inp.businessApplications.value / 12)));
  L.push(row('Marketing per year at blended CAC', money(o.marketingPerYear)));
  L.push(row('  as a share of ARR (Duolingo 2024: ~12%)', pct(o.marketingShareOfArr)));

  L.push('', 'WHAT MOVES LTV / CAC  (one input at a time, the rest as above)');
  for (const s of sensitivity(inp)) {
    L.push(`  ${s.key}: ${s.label}`);
    for (const c of s.cases) {
      const mark = c.value === inp[s.key].value ? '  <- base' : '';
      L.push(`      ${String(c.value).padEnd(8)} LTV ${money(c.ltv).padEnd(9)} CAC ${money(c.cac).padEnd(9)} ${c.ltvToCac.toFixed(1)}x${mark}`);
    }
  }
  return L.join('\n');
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop());
if (isMain) {
  const args = process.argv.slice(2);
  let inp;
  try {
    inp = withOverrides(INPUTS, args);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
  const out = compute(inp);
  if (args.includes('--json')) console.log(JSON.stringify({ inputs: inp, outputs: out }, null, 2));
  else console.log(report(inp, out));
  if (args.includes('--check') && !(out.ltvToCac > 1)) {
    console.error(`FAIL: LTV/CAC is ${out.ltvToCac.toFixed(2)}x`);
    process.exit(1);
  }
}
