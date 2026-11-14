#!/usr/bin/env node
// Money model for First Year: B2C subscription only.
//
// Every number the pitch uses is printed by this script. Change an input and
// everything downstream is recalculated:
//
//   node docs/pitch/model.mjs                      # base case
//   node docs/pitch/model.mjs conversion=0.08      # override any input by key
//   node docs/pitch/model.mjs --json               # machine-readable output
//
// Each input is marked:
//   fact        - taken from a published source (link in `source`)
//   derived     - arithmetic on facts (formula in `note`)
//   assumption  - our choice, not proven; the reason is in `note`
//
// The explanation in Russian lives in docs/pitch/MONEY.md.

/** @typedef {{ value: number, kind: 'fact' | 'derived' | 'assumption', label: string, source?: string, note?: string }} Input */

/** @type {Record<string, Input>} */
export const INPUTS = {
  // ---- Price -------------------------------------------------------------
  priceMonthly: {
    value: 19, kind: 'assumption', label: 'Monthly plan, $',
    note: 'Pricing hypothesis already used in the live show and the paywall (B14). Not validated with buyers.',
  },
  priceAnnual: {
    value: 149, kind: 'assumption', label: 'Annual plan, $',
    note: '35% below 12 x $19. Market average discount is deeper (67%, Airbridge 2026), but our use is concentrated in a decision window of months, so we do not push the annual plan hard.',
    source: 'https://www.airbridge.io/en/blog/subscription-app-pricing-by-category-2026-benchmark',
  },
  annualMix: {
    value: 0.4, kind: 'assumption', label: 'Share of new payers who choose annual',
    note: 'No data of our own yet; 40% is a middle guess between monthly-heavy and annual-heavy app categories.',
  },

  // ---- Retention (benchmarks) ---------------------------------------------
  monthlyChurnFirst: {
    value: 0.30, kind: 'fact', label: 'Monthly plan: churn after the first paid month',
    source: 'https://www.deck.gallery/subscription-apps-2025/',
    note: 'RevenueCat State of Subscription Apps 2025: "nearly 30% first-month churn".',
  },
  monthlyRetention12: {
    value: 0.175, kind: 'fact', label: 'Monthly plan: share still paying after 12 months',
    source: 'https://www.airbridge.io/en/blog/subscription-app-pricing-by-category-2026-benchmark',
    note: 'Airbridge 2026, 75,000+ subscription apps: monthly subscribers retain 17.5% after 12 months.',
  },
  annualRenewal: {
    value: 0.441, kind: 'fact', label: 'Annual plan: share renewing after year one',
    source: 'https://www.airbridge.io/en/blog/subscription-app-pricing-by-category-2026-benchmark',
    note: 'Airbridge 2026: annual subscribers retain 44.1% after 12 months. We apply the same rate to the second renewal.',
  },
  horizonMonths: {
    value: 24, kind: 'assumption', label: 'Lifetime horizon for a monthly payer, months',
    note: 'We count revenue for two years at most: after opening (or deciding not to) the need fades. Conservative.',
  },
  horizonYears: {
    value: 3, kind: 'assumption', label: 'Lifetime horizon for an annual payer, years',
    note: 'Three paid years at most. Conservative.',
  },

  // ---- Cost to serve --------------------------------------------------------
  cardPct: {
    value: 0.029, kind: 'fact', label: 'Card fee, share of payment',
    source: 'https://stripe.com/pricing', note: 'Stripe standard US card rate 2.9% + 30c.',
  },
  cardFixed: {
    value: 0.30, kind: 'fact', label: 'Card fee, fixed per payment, $',
    source: 'https://stripe.com/pricing',
  },
  aiInputPerM: {
    value: 0.30, kind: 'fact', label: 'AI input tokens, $ per million',
    source: 'https://ai.google.dev/gemini-api/docs/pricing', note: 'Gemini 2.5 Flash, standard tier.',
  },
  aiOutputPerM: {
    value: 2.50, kind: 'fact', label: 'AI output tokens, $ per million',
    source: 'https://ai.google.dev/gemini-api/docs/pricing', note: 'Gemini 2.5 Flash, standard tier, thinking included.',
  },
  aiCallsPaidMonth: {
    value: 200, kind: 'assumption', label: 'AI calls per paying player per month',
    note: 'Advisor, city events, season review. About 7 a day; generous on purpose.',
  },
  aiCallsFree: {
    value: 30, kind: 'assumption', label: 'AI calls per free player (whole free tier)',
    note: 'Idea, place, plan and the first month.',
  },
  aiInTokensPerCall: { value: 3000, kind: 'assumption', label: 'Input tokens per AI call' },
  aiOutTokensPerCall: { value: 500, kind: 'assumption', label: 'Output tokens per AI call' },
  hostingPerActiveMonth: {
    value: 0.25, kind: 'assumption', label: 'Hosting per active player per month, $',
    note: 'One shared Node server and a snapshot store; the engine is pure functions and also runs in the browser.',
  },

  // ---- Conversion and acquisition ------------------------------------------
  conversion: {
    value: 0.05, kind: 'assumption', label: 'Free player -> paying',
    note: 'Freemium benchmark 2-5% average, 8-10% strong (Crazy Egg / Appcues summaries); Duolingo ~8.6% (13.1M paid / 153.1M MAU, Q3 2026). Our free tier ends after the first month of the cafe, at the moment the player most wants to know what happens next; we still take the average, not the strong case.',
    source: 'https://www.sec.gov/Archives/edgar/data/0001562088/000162828026069474/q3fy26duolingo9-30x26share.htm',
  },
  metaCpc: {
    value: 0.70, kind: 'fact', label: 'Paid social cost per click, $',
    source: 'https://www.wordstream.com/blog/facebook-ads-benchmarks-2025',
    note: 'WordStream / LocaliQ 2025, US Facebook traffic campaigns, all industries.',
  },
  searchCpc: {
    value: 5.26, kind: 'fact', label: 'Paid search cost per click, $',
    source: 'https://www.wordstream.com/blog/2025-google-ads-benchmarks',
    note: 'WordStream 2025 Google Ads, all industries.',
  },
  clickToPlay: {
    value: 0.20, kind: 'assumption', label: 'Ad click -> starts playing free',
    note: 'Guest entry, no card, no sign-up form. One in five is our guess until we measure it.',
  },
  organicCostPerPlayer: {
    value: 0.50, kind: 'assumption', label: 'Organic channels: cost per free player, $',
    note: 'Content (real closure stories, "how much does it cost to open a coffee shop"), short video, community. Cost of one content producer spread over players at scale.',
  },
  paidShare: {
    value: 0.4, kind: 'assumption', label: 'Share of free players from paid social',
    note: 'The rest from organic channels. Paid search is shown only as a check: it does not pay back.',
  },

  // ---- Market ----------------------------------------------------------------
  adultsConsidered: {
    value: 145_000_000, kind: 'fact', label: 'US adults who seriously considered starting a business',
    source: 'https://gusto.com/resources/gusto-insights/building-a-business-survey',
    note: 'Gusto / Morning Consult, 1-8 Sep 2026, 6,105 adults: 54% of US adults.',
  },
  activeShare: {
    value: 1 / 3, kind: 'fact', label: 'Of them, actively working toward it now',
    source: 'https://gusto.com/resources/gusto-insights/building-a-business-survey',
  },
  storefrontShare: {
    value: 0.30, kind: 'assumption', label: 'Share whose idea needs premises (food, retail, personal care, fitness)',
    note: 'Food and accommodation alone are 16.3% of high-propensity business applications (see foodShare); storefront retail and personal services add to that. 30% is our estimate.',
  },
  foodHba: {
    value: 278_436, kind: 'fact', label: 'High-propensity business applications, food & accommodation (NAICS 72), 2025',
    source: 'https://founderreports.com/how-many-businesses-are-started-each-year/',
    note: 'Secondary source citing Census BFS; monthly Census series agrees (~25k a month): https://fred.stlouisfed.org/series/BAHBANAICS72SAUS',
  },
  allHba: {
    value: 1_708_842, kind: 'fact', label: 'High-propensity business applications, all industries, 2025',
    source: 'https://founderreports.com/how-many-businesses-are-started-each-year/',
    note: 'Secondary source citing Census BFS; out of 5,671,836 applications in total.',
  },
  coffeeShare: {
    value: 0.13, kind: 'assumption', label: 'Coffee shops among food & drink ideas',
    note: 'About 85,100 snack and non-alcoholic beverage bars (NAICS 722515, CBP 2023, secondary: vantainsights.com) against about 644,000 restaurants and eating places (NAICS 72251). 13% is that ratio; low confidence.',
  },

  // ---- Path: annual reach of each segment by free players --------------------
  reachStep1: {
    value: 0.05, kind: 'assumption', label: 'Step 1 reach: coffee aspirants who play per year',
  },
  reachStep2: {
    value: 0.10, kind: 'assumption', label: 'Step 2 reach: food & drink aspirants who play per year',
  },
  reachStep3: {
    value: 0.20, kind: 'assumption', label: 'Step 3 reach: storefront aspirants who play per year',
  },
  targetArr: {
    value: 100_000_000, kind: 'assumption', label: 'Target ARR, $', note: 'Jury criterion.',
  },
};

// ---------------------------------------------------------------------------

/** Apply `key=value` overrides from the command line. */
export function withOverrides(inputs, args) {
  const out = structuredClone(inputs);
  for (const arg of args) {
    const m = /^([A-Za-z0-9]+)=(-?[0-9.eE_+]+)$/.exec(arg);
    if (!m) continue;
    const [, key, raw] = m;
    if (!(key in out)) throw new Error(`Unknown input "${key}". Known: ${Object.keys(out).join(', ')}`);
    const value = Number(raw.replaceAll('_', ''));
    if (!Number.isFinite(value)) throw new Error(`Input "${key}" must be a number, got "${raw}"`);
    out[key] = { ...out[key], value, kind: 'assumption', note: `Overridden on the command line (was ${inputs[key].value}).` };
  }
  return out;
}

/** Pure calculation: inputs in, every pitch number out. */
export function compute(inputs) {
  const v = Object.fromEntries(Object.entries(inputs).map(([k, x]) => [k, x.value]));

  // Retention curve of a monthly payer: month 1 always paid, then a first-month
  // drop, then a constant churn chosen so that 12-month retention matches the benchmark.
  const afterFirst = 1 - v.monthlyChurnFirst;
  const steadyKeep = Math.pow(v.monthlyRetention12 / afterFirst, 1 / 11);
  let monthlyPaidMonths = 0;
  for (let m = 0; m < v.horizonMonths; m++) monthlyPaidMonths += m === 0 ? 1 : afterFirst * Math.pow(steadyKeep, m - 1);

  let annualPaidYears = 0;
  for (let y = 0; y < v.horizonYears; y++) annualPaidYears += Math.pow(v.annualRenewal, y);

  // Cost to serve
  const aiCostPerCall = (v.aiInTokensPerCall * v.aiInputPerM + v.aiOutTokensPerCall * v.aiOutputPerM) / 1e6;
  const servePaidMonth = v.aiCallsPaidMonth * aiCostPerCall + v.hostingPerActiveMonth;
  const serveFree = v.aiCallsFree * aiCostPerCall + v.hostingPerActiveMonth;
  const cardFee = (price) => price * v.cardPct + v.cardFixed;

  const monthlyGrossPerMonth = v.priceMonthly - cardFee(v.priceMonthly) - servePaidMonth;
  const annualGrossPerYear = v.priceAnnual - cardFee(v.priceAnnual) - 12 * servePaidMonth;

  // Lifetime value per new payer (revenue and gross profit), blended by plan mix
  const ltvRevenueMonthly = v.priceMonthly * monthlyPaidMonths;
  const ltvRevenueAnnual = v.priceAnnual * annualPaidYears;
  const ltvRevenue = (1 - v.annualMix) * ltvRevenueMonthly + v.annualMix * ltvRevenueAnnual;
  const ltvGross = (1 - v.annualMix) * monthlyGrossPerMonth * monthlyPaidMonths + v.annualMix * annualGrossPerYear * annualPaidYears;
  const grossMargin = ltvGross / ltvRevenue;

  // Acquisition: cost of one paying player, including serving the free players who do not pay
  const freeServePerPayer = serveFree / v.conversion;
  const paidCostPerPlayer = v.metaCpc / v.clickToPlay;
  const cacPaid = paidCostPerPlayer / v.conversion + freeServePerPayer;
  const cacSearch = v.searchCpc / v.clickToPlay / v.conversion + freeServePerPayer;
  const cacOrganic = v.organicCostPerPlayer / v.conversion + freeServePerPayer;
  const cacBlended = v.paidShare * cacPaid + (1 - v.paidShare) * cacOrganic;
  const paybackMonthsPaid = cacPaid / monthlyGrossPerMonth;
  const paybackMonthsBlended = cacBlended / monthlyGrossPerMonth;
  // Highest paid-social click price at which paid alone still gives LTV/CAC = 3
  const maxCpcFor3x = (ltvGross / 3 - freeServePerPayer) * v.conversion * v.clickToPlay;

  // Market
  const activeAspirants = v.adultsConsidered * v.activeShare;
  const storefrontAspirants = activeAspirants * v.storefrontShare;
  const foodShare = v.foodHba / v.allHba;
  const foodAspirants = activeAspirants * foodShare;
  const coffeeAspirants = foodAspirants * v.coffeeShare;
  const runRateArpu = (1 - v.annualMix) * 12 * v.priceMonthly + v.annualMix * v.priceAnnual;
  const tamStorefront = storefrontAspirants * runRateArpu;
  const samFood = foodAspirants * runRateArpu;
  const somCoffee = coffeeAspirants * runRateArpu;

  // Steady state: ARR = new payers per year x lifetime revenue per payer.
  // Paying subscribers on hand = new payers per year x average paid lifetime in years.
  const lifetimeYears = (1 - v.annualMix) * monthlyPaidMonths / 12 + v.annualMix * annualPaidYears;
  const step = (name, segment, reach) => {
    const freePlayers = segment * reach;
    const newPayers = freePlayers * v.conversion;
    return { name, segment, reach, freePlayers, newPayers, payingOnHand: newPayers * lifetimeYears, arr: newPayers * ltvRevenue };
  };
  const steps = [
    step('1. Coffee shop, New York data, players across the US', coffeeAspirants, v.reachStep1),
    step('2. All food & drink formats, ten US cities', foodAspirants, v.reachStep2),
    step('3. Every storefront small business, whole US', storefrontAspirants, v.reachStep3),
  ];
  const usArr = steps[2].arr;
  const gapArr = Math.max(0, v.targetArr - usArr);
  const gapNewPayers = gapArr / ltvRevenue;
  const gapFreePlayers = gapNewPayers / v.conversion;
  steps.push({
    name: '4. Other countries (what is required, not a forecast)',
    segment: NaN, reach: NaN,
    freePlayers: gapFreePlayers, newPayers: gapNewPayers,
    payingOnHand: gapNewPayers * lifetimeYears, arr: gapArr,
  });
  const targetNewPayers = v.targetArr / ltvRevenue;
  const targetPayingOnHand = targetNewPayers * lifetimeYears;
  const arrPerPaying = ltvRevenue / lifetimeYears;
  const abroadVsUs = gapFreePlayers / steps[2].freePlayers;

  return {
    retention: { afterFirst, steadyMonthlyChurn: 1 - steadyKeep, monthlyPaidMonths, annualPaidYears, lifetimeYears },
    serving: { aiCostPerCall, servePaidMonth, serveFree, monthlyGrossPerMonth, annualGrossPerYear },
    ltv: { ltvRevenueMonthly, ltvRevenueAnnual, ltvRevenue, ltvGross, grossMargin },
    cac: {
      paidCostPerPlayer, freeServePerPayer, cacPaid, cacSearch, cacOrganic, cacBlended,
      ltvToCacBlended: ltvGross / cacBlended, ltvToCacPaid: ltvGross / cacPaid, ltvToCacSearch: ltvGross / cacSearch,
      paybackMonthsPaid, paybackMonthsBlended, maxCpcFor3x,
    },
    market: { activeAspirants, storefrontAspirants, foodShare, foodAspirants, coffeeAspirants, runRateArpu, tamStorefront, samFood, somCoffee },
    path: { steps, usArr, targetNewPayers, targetPayingOnHand, arrPerPaying, abroadVsUs },
  };
}

/** Same model at several values of one input: shows which assumptions matter. */
export function sensitivity(inputs, key, values) {
  return values.map((value) => {
    const r = compute({ ...inputs, [key]: { ...inputs[key], value } });
    return { value, ltvGross: r.ltv.ltvGross, cacBlended: r.cac.cacBlended, ltvToCac: r.cac.ltvToCacBlended, usArr: r.path.usArr };
  });
}

// ---------------------------------------------------------------------------
// Printing

const usd = (x, d = 0) => (Number.isFinite(x) ? '$' + x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '-');
const num = (x) => (Number.isFinite(x) ? Math.round(x).toLocaleString('en-US') : '-');
const pct = (x, d = 1) => (Number.isFinite(x) ? (x * 100).toFixed(d) + '%' : '-');
const big = (x) => (Math.abs(x) >= 1e9 ? usd(x / 1e9, 2) + 'B' : Math.abs(x) >= 1e6 ? usd(x / 1e6, 1) + 'M' : usd(x));
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

function print(inputs, r) {
  const L = [];
  const row = (label, value) => L.push('  ' + pad(label, 58) + value);
  const head = (t) => L.push('', t, '-'.repeat(t.length));

  L.push('First Year - money model (B2C subscription only)', 'Every line below is recalculated from the inputs at the end.');

  head('Price');
  row('Monthly plan', usd(inputs.priceMonthly.value) + ' / month');
  row('Annual plan', usd(inputs.priceAnnual.value) + ' / year (' + usd(inputs.priceAnnual.value / 12, 2) + ' / month)');
  row('Blended run-rate revenue per paying player', usd(r.market.runRateArpu) + ' / year');

  head('Retention (benchmarks, not our data)');
  row('Monthly: still paying after month 1', pct(r.retention.afterFirst));
  row('Monthly: steady churn after month 1', pct(r.retention.steadyMonthlyChurn) + ' / month');
  row('Monthly: average paid months', r.retention.monthlyPaidMonths.toFixed(2));
  row('Annual: average paid years', r.retention.annualPaidYears.toFixed(2));

  head('Unit economics of one paying player');
  row('AI cost per call', usd(r.serving.aiCostPerCall, 4));
  row('Cost to serve a paying player', usd(r.serving.servePaidMonth, 2) + ' / month');
  row('Cost to serve a free player (whole free tier)', usd(r.serving.serveFree, 2));
  row('Gross profit, monthly plan', usd(r.serving.monthlyGrossPerMonth, 2) + ' / month');
  row('Gross profit, annual plan', usd(r.serving.annualGrossPerYear, 2) + ' / year');
  row('Lifetime revenue per payer (LTV, revenue)', usd(r.ltv.ltvRevenue, 2));
  row('Lifetime gross profit per payer (LTV)', usd(r.ltv.ltvGross, 2));
  row('Gross margin', pct(r.ltv.grossMargin));

  head('Cost to acquire one paying player (CAC)');
  row('Paid social: cost per free player', usd(r.cac.paidCostPerPlayer, 2));
  row('Free tier served per payer (players who never pay)', usd(r.cac.freeServePerPayer, 2));
  row('CAC, paid social', usd(r.cac.cacPaid, 2));
  row('CAC, organic', usd(r.cac.cacOrganic, 2));
  row('CAC, blended (' + pct(inputs.paidShare.value, 0) + ' paid)', usd(r.cac.cacBlended, 2));
  row('LTV / CAC, blended', r.cac.ltvToCacBlended.toFixed(1) + 'x');
  row('LTV / CAC, paid social only', r.cac.ltvToCacPaid.toFixed(1) + 'x');
  row('LTV / CAC, paid search only (check)', r.cac.ltvToCacSearch.toFixed(2) + 'x');
  row('Payback on a monthly payer, paid social', r.cac.paybackMonthsPaid.toFixed(1) + ' months');
  row('Payback on a monthly payer, blended', r.cac.paybackMonthsBlended.toFixed(1) + ' months');
  row('Highest social click price for LTV/CAC = 3 on paid alone', usd(r.cac.maxCpcFor3x, 2));

  head('Market (United States)');
  row('Adults actively working toward a business', num(r.market.activeAspirants));
  row('... whose idea needs premises (storefront)', num(r.market.storefrontAspirants));
  row('... food & drink (share of high-propensity apps: ' + pct(r.market.foodShare) + ')', num(r.market.foodAspirants));
  row('... coffee shop', num(r.market.coffeeAspirants));
  row('TAM: storefront aspirants x run-rate revenue', big(r.market.tamStorefront) + ' / year');
  row('SAM: food & drink aspirants x run-rate revenue', big(r.market.samFood) + ' / year');
  row('Coffee only x run-rate revenue', big(r.market.somCoffee) + ' / year');

  head('Path to ' + big(inputs.targetArr.value) + ' ARR (steady state; each US step contains the one before)');
  L.push('  ' + pad('Step', 54) + lpad('segment', 12) + lpad('reach', 7) + lpad('free/yr', 12) + lpad('new pay/yr', 12) + lpad('paying', 10) + lpad('ARR', 10));
  for (const s of r.path.steps) {
    L.push('  ' + pad(s.name, 54) + lpad(num(s.segment), 12) + lpad(pct(s.reach, 0), 7) + lpad(num(s.freePlayers), 12) + lpad(num(s.newPayers), 12) + lpad(num(s.payingOnHand), 10) + lpad(big(s.arr), 10));
  }
  row('ARR per paying subscriber on hand', usd(r.path.arrPerPaying, 2));
  row('Paying subscribers for $1M ARR', num(1e6 / r.path.arrPerPaying));
  row('New paying players a year needed for the target', num(r.path.targetNewPayers));
  row('Paying subscribers on hand at the target', num(r.path.targetPayingOnHand));
  row('Free players needed abroad, as a multiple of step 3', r.path.abroadVsUs.toFixed(1) + 'x');

  head('Sensitivity: which assumption moves the result');
  const sens = (key, values, fmt) => {
    for (const s of sensitivity(inputs, key, values)) {
      row(`${key} = ${fmt(s.value)}`, `LTV ${usd(s.ltvGross)}  CAC ${usd(s.cacBlended)}  LTV/CAC ${s.ltvToCac.toFixed(1)}x  US ARR ${big(s.usArr)}`);
    }
  };
  sens('conversion', [0.02, 0.03, 0.05, 0.08], (x) => pct(x, 0));
  sens('monthlyChurnFirst', [0.2, 0.3, 0.5], (x) => pct(x, 0));
  sens('priceMonthly', [12, 19, 29], (x) => usd(x));
  sens('metaCpc', [0.7, 1.5, 3], (x) => usd(x, 2));
  sens('paidShare', [0.2, 0.4, 0.8], (x) => pct(x, 0));

  head('Inputs (fact = published source, derived = arithmetic, assumption = ours)');
  for (const [key, x] of Object.entries(inputs)) {
    L.push('  ' + pad(key, 24) + pad(x.kind, 12) + pad(x.value.toLocaleString('en-US', { maximumFractionDigits: 4 }), 14) + x.label);
    if (x.source) L.push('  ' + ' '.repeat(50) + x.source);
  }
  return L.join('\n');
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const args = process.argv.slice(2);
  try {
    const inputs = withOverrides(INPUTS, args);
    const result = compute(inputs);
    if (args.includes('--json')) console.log(JSON.stringify({ inputs, result }, null, 2));
    else console.log(print(inputs, result));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
