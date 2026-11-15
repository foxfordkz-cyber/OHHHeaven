// Sample data for agent 11 screens (/dev/insights, /dev/end, /dev/plan) and their tests.
// The season follows the lead's worked example (docs/demo/demo-cycle.md): Maya's coffee shop, $224,000 of capital,
// $139,500 to open, a 21-day permit wait, $8.50 a ticket, rent $6,000; Leo goes bankrupt over sales tax on April 20,
// Victor over cash wages in May. Every month is generated from a few parameters, the way the engine books it: the
// lines of a MonthReport add up to the change in cash, sales tax owed equals the tax collected (calendar quarters, due
// on the 20th, as engine/src/economy/taxes.ts), savings from a cut corner are their own line, benchmarks follow agent
// 04's rule. Money is game money; the example's numbers are the lead's estimates from the user's research notes.
// Links in rule cards and the plan are real official pages (checked 14 Nov 2026).
import type {
  Ack, AdvisorAnswer, Analytics, Benchmark, BusinessState, DayReport, Debrief, GameEvent, FeedItem, MonthReport,
  OwnerView, PackRuleCard, PackSupplier, PackRoadmapStep, Payout, PnlLine, PublicBusiness, Query,
  RealWorldPlan, Standing, WeatherCondition, WorldConfig, WorldPublic,
} from '@ohh/shared/types';
import { dateOf } from '@ohh/shared/rules';
import { int, money } from './format';

// ───────────── deterministic noise ─────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r2 = (v: number) => Math.round(v * 100) / 100;
const r0 = (v: number) => Math.round(v);
const DAYS = 30;

// ───────────── the cafe and its months ─────────────
export const CAFE = {
  salesTaxRate: 0.08875,     // New York City combined sales tax rate, tax.ny.gov
  cardFeeShare: 0.04135,     // lead's example: card fees $2,109 on $51,000 of sales
  cogsShare: 0.28,           // lead's example: food and supplies 28% of sales
  sizeCapMonth: (seats: number) => seats * 375,   // lead's example: 12 seats serve 150 tickets a day
  staffCapMonth: (staff: number) => staff * 1800,
};

/** Cafe norms from agent 04's research (research/reports/04-analytics.md: Bellwether Coffee, Chron, Paytronix, Toast). */
export const CAFE_NORMS = { cogsPct: 0.3, laborPct: 0.32, rentPct: 0.1, netMarginPct: 0.06 };

export interface MonthPlan {
  month: number; units: number; price: number; seats: number; staff: number;
  payroll: number; payrollTax: number; rent: number;
  utilities: number; insurance: number; cleaning: number; software: number; marketing: number; blockFund: number;
  saving?: number; fine?: number; setup?: number; salesTaxPaid?: number; cogsMult?: number;
  quality: number; reputation: number; rank: number; lostSize?: number; lostStaff?: number; lostClosure?: number;
}

const cogsPerUnit = (p: MonthPlan) => p.price * CAFE.cogsShare * (p.cogsMult ?? 1);
const revenueOf = (p: MonthPlan) => r2(p.units * p.price);
/** What one more sale leaves after its food and card fee. */
export const contributionOf = (p: MonthPlan) => p.price - cogsPerUnit(p) - p.price * CAFE.cardFeeShare;
/** Sales tax collected in a month (the engine's line sales_tax_collected). */
export const collectedTax = (p: MonthPlan) => r2(revenueOf(p) * CAFE.salesTaxRate);
/** Engine rule: quarterly tax is due on day 20 of the month after the calendar quarter (April 20 = day 110). */
export const salesTaxDueDay = (month: number) => Math.ceil(month / 3) * 3 * DAYS + 20;

/** Each finished quarter's sales tax is paid in the first month of the next one. */
function withQuarterlyTax(plans: MonthPlan[]): MonthPlan[] {
  return plans.map((p) => {
    if (p.month % 3 !== 1 || p.month === 1) return p;
    const owed = r2(plans.filter((x) => x.month >= p.month - 3 && x.month < p.month).reduce((s, x) => s + collectedTax(x), 0));
    return owed > 0 ? { ...p, salesTaxPaid: owed } : p;
  });
}

export function monthLines(p: MonthPlan): PnlLine[] {
  const revenue = revenueOf(p);
  const lines: PnlLine[] = [
    { id: 'revenue', label: 'Sales', kind: 'revenue', amount: revenue },
    { id: 'sales_tax_collected', label: 'Sales tax collected (owed to the state)', kind: 'tax', amount: collectedTax(p) },
    { id: 'cogs', label: 'Coffee, milk, food and cups', kind: 'cogs', amount: -r2(p.units * cogsPerUnit(p)) },
    { id: 'card_fees', label: 'Card processing fees', kind: 'opex', amount: -r2(revenue * CAFE.cardFeeShare) },
    { id: 'payroll', label: 'Wages', kind: 'payroll', amount: -p.payroll },
    { id: 'payroll_tax', label: 'Payroll taxes', kind: 'payroll_tax', amount: -p.payrollTax },
    { id: 'rent', label: 'Rent', kind: 'rent', amount: -p.rent },
    { id: 'utilities', label: 'Electricity, gas and water', kind: 'opex', amount: -p.utilities },
    { id: 'insurance', label: 'Insurance', kind: 'opex', amount: -p.insurance },
    { id: 'cleaning', label: 'Cleaning', kind: 'opex', amount: -p.cleaning },
    { id: 'software', label: 'POS and software', kind: 'opex', amount: -p.software },
    { id: 'marketing', label: 'Marketing', kind: 'opex', amount: -p.marketing },
  ];
  if (p.blockFund) lines.push({ id: 'block_fund', label: 'Block fund (Bedford Avenue)', kind: 'deal', amount: -p.blockFund });
  if (p.saving) lines.push({ id: 'saving:off_books_payroll', label: 'Kept: payroll taxes on cash wages', kind: 'saving', amount: p.saving });
  if (p.fine) lines.push({ id: 'fine', label: 'Fine', kind: 'fine', amount: -p.fine });
  if (p.salesTaxPaid) {
    const due = salesTaxDueDay(p.month - 1);
    lines.push({ id: `tax_paid_sales_tax_d${due}`, label: 'Sales tax paid', kind: 'tax', amount: -p.salesTaxPaid });
  }
  if (p.setup) lines.push({ id: 'setup', label: 'Build-out, equipment and permits', kind: 'setup', amount: -p.setup });
  return lines;
}

/** Profit leaves out the one-off setup and the sales tax that only passes through the till. */
export const isPassThrough = (l: PnlLine) => l.kind === 'setup' || /sales_tax/.test(l.id);
export const profitOf = (lines: PnlLine[]) => r2(lines.filter((l) => !isPassThrough(l)).reduce((s, l) => s + l.amount, 0));

export function monthReport(p: MonthPlan, cashStart: number, netWorthExtra: number): MonthReport {
  const lines = monthLines(p);
  const cashEnd = r2(cashStart + lines.reduce((s, l) => s + l.amount, 0));
  const capacity = Math.min(CAFE.sizeCapMonth(p.seats), CAFE.staffCapMonth(p.staff));
  const lost = { size: p.lostSize ?? 0, staff: p.lostStaff ?? 0, closure: p.lostClosure ?? 0 };
  return {
    month: p.month, avgPrice: p.price,
    demandUnits: p.units + lost.size + lost.staff + lost.closure, servedUnits: p.units, lost,
    capacityUnits: r0(capacity), sizeUtilization: r2(p.units / CAFE.sizeCapMonth(p.seats)),
    lines, revenue: lines[0].amount, profit: profitOf(lines), cashStart, cashEnd,
    taxesAccrued: collectedTax(p), taxesPaid: p.salesTaxPaid ?? 0, fines: p.fine ?? 0,
    quality: p.quality, reputation: p.reputation, netWorth: r2(cashEnd + netWorthExtra), rankInNiche: p.rank,
  };
}

const WEEKDAY_MULT = [0.86, 0.9, 0.95, 1.0, 1.08, 1.25, 1.12];   // Mon..Sun, sample
const WEATHER: { c: WeatherCondition; mult: number }[] = [
  { c: 'clear', mult: 1.05 }, { c: 'cloudy', mult: 1 }, { c: 'rain', mult: 0.82 }, { c: 'clear', mult: 1.04 },
  { c: 'heat', mult: 0.93 }, { c: 'cloudy', mult: 0.99 }, { c: 'storm', mult: 0.7 },
];

/** Daily reports for days [from, to] from the plan of each day's month. */
export function dayReports(plans: MonthPlan[], from: number, to: number, seed: number): DayReport[] {
  const rnd = mulberry32(seed);
  const out: DayReport[] = [];
  for (let d = from; d <= to; d++) {
    const date = dateOf(d);
    const p = plans.find((x) => x.month === date.month) ?? plans[plans.length - 1];
    const w = WEATHER[Math.floor(rnd() * WEATHER.length)];
    const demand = r0(((p.units + (p.lostSize ?? 0) + (p.lostStaff ?? 0)) / DAYS) * WEEKDAY_MULT[date.weekday] * w.mult * (0.95 + rnd() * 0.1));
    const sizeCap = CAFE.sizeCapMonth(p.seats) / DAYS;
    const staffCap = CAFE.staffCapMonth(p.staff) / DAYS;
    const served = Math.min(demand, r0(sizeCap), r0(staffCap));
    const lostSize = sizeCap < staffCap ? demand - served : 0;
    const lostStaff = sizeCap >= staffCap ? demand - served : 0;
    const notes: string[] = [];
    if (lostSize > 0) notes.push(`${lostSize} walked away: not enough seats`);
    if (lostStaff > 0) notes.push(`${lostStaff} left a long line: not enough staff`);
    if (w.c === 'storm') notes.push('Storm kept people indoors');
    out.push({
      day: d, demandUnits: demand, servedUnits: served, lost: { size: lostSize, staff: lostStaff, closure: 0 },
      revenue: r2(served * p.price), variableCosts: r2(served * (cogsPerUnit(p) + p.price * CAFE.cardFeeShare)),
      sizeUtilization: r2(served / sizeCap), weather: w.c, notes,
    });
  }
  return out;
}

// ───────────── world, people and tables ─────────────
export const CONFIG: WorldConfig = {
  id: 'demo', name: 'Demo city', city: 'nyc', seasonMonths: 12, dayMs: 2000, paused: false, maxOwners: 100,
  aiBusinessesTarget: 20, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05,
  nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 7,
};

function worldPublic(day: number, phase: 'running' | 'ended', owners: number, bankrupt: number): WorldPublic {
  return {
    config: CONFIG, phase, day, date: dateOf(day), version: 1000 + day, bank: owners * CONFIG.entryFee,
    msToNextDay: phase === 'ended' ? 0 : 1200,
    stats: { owners, aiBusinesses: 16, officials: 5, open: owners + 16 - bankrupt, bankrupt },
  };
}

export const MY_BUSINESS_ID = 'b-maya';
export const MY_PLAYER_ID = 'p-maya';

/** Cafes of the example: 10 played by people (all paid $5), 10 run by the city's AI. Invented names only. */
const CAFES: { id: string; name: string; owner: string; isAi: boolean }[] = [
  { id: 'b-bagel', name: 'Bean & Bagel', owner: 'Ana', isAi: false },
  { id: MY_BUSINESS_ID, name: 'Maya’s Coffee', owner: 'Maya', isAi: false },
  { id: 'b-omar', name: 'Omar’s Cafe', owner: 'Omar', isAi: false },
  { id: 'b-nora', name: 'Nora’s Roast', owner: 'Nora', isAi: false },
  { id: 'b-grind', name: 'Grind Theory', owner: 'Hana', isAi: false },
  { id: 'b-crumb', name: 'Little Crumb', owner: 'Diego', isAi: false },
  { id: 'b-ritual', name: 'Morning Ritual', owner: 'Priya', isAi: false },
  { id: 'b-kiln', name: 'Kiln Coffee', owner: 'Kenji', isAi: false },
  { id: 'b-victor', name: 'Victor’s Espresso', owner: 'Victor', isAi: false },
  { id: 'b-leo', name: 'Leo’s Espresso', owner: 'Leo', isAi: false },
  ...['Latte Lab', 'Pour Decisions', 'The Daily Pour', 'Kettle & Crane', 'Steam & Bean', 'East Side Brew', 'Half Moon Cafe',
    'Second Shot', 'Corner Roast', 'Oat & Honey'].map((name, i) => ({ id: `ai-cafe-${i + 1}`, name, owner: `${name} (AI)`, isAi: true })),
];
const BARBERS = ['Fade Room', 'Clean Cut Co.', 'Taper & Tonic', 'Clipper Club', 'Crown Cuts', 'Lineup Lounge']
  .map((name, i) => ({ id: `ai-barber-${i + 1}`, name, owner: `${name} (AI)`, isAi: true }));

/**
 * A niche table as computeStandings builds it (engine/src/deals/standings.ts): open businesses by net worth, the
 * bankrupt at the bottom in the given order (who lasted longer is higher). `me` is left out of the neighbors.
 */
function table(niche: 'cafe' | 'barbershop', worth: [string, number][], bankrupt: string[], me: string | null) {
  const pool = niche === 'cafe' ? CAFES : BARBERS;
  const alive = worth.filter(([id]) => !bankrupt.includes(id)).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const dead = bankrupt.map((id) => worth.find(([x]) => x === id)!).filter(Boolean);
  const standings: Standing[] = [...alive, ...dead].map(([id, w], i) => {
    const b = pool.find((x) => x.id === id)!;
    return { businessId: id, niche, rank: i + 1, netWorth: w, isAi: b.isAi, bankrupt: bankrupt.includes(id), name: b.name };
  });
  const rnd = mulberry32(niche === 'cafe' ? 11 : 23);
  const neighbors: PublicBusiness[] = standings.filter((s) => s.businessId !== me).map((s) => {
    const b = pool.find((x) => x.id === s.businessId)!;
    return {
      id: b.id, name: b.name, ownerName: b.owner, isAi: b.isAi, niche, placeId: `place-${b.id}`,
      status: s.bankrupt ? 'bankrupt' : 'open', price: niche === 'cafe' ? r2(7.5 + rnd() * 2) : r0(30 + rnd() * 12),
      reputation: r2(0.45 + rnd() * 0.4), rankInNiche: s.rank, trust: { kept: r0(rnd() * 4), broken: 0 },
      grade: niche === 'cafe' ? 'A' : undefined, partners: [],
    };
  });
  return { standings, neighbors };
}

const BARBER_TABLE = table('barbershop', BARBERS.map((b, i) => [b.id, 96000 - i * 9500]), [], null);

// ───────────── analytics for the month in progress ─────────────
const verdictCost = (you: number, norm: number): Benchmark['verdict'] => (you <= norm ? 'good' : you <= norm + 0.05 ? 'ok' : 'bad');

/** The five rows of agent 04's benchmarksOf (engine/src/analytics/analyze.ts), labels and verdicts included. */
function benchmarksFor(a: { cogsPct: number; laborPct: number; rentPct: number; primeCostPct: number; netMarginPct: number }): Benchmark[] {
  const n = CAFE_NORMS;
  return [
    { metric: 'Cost of goods, % of sales', you: a.cogsPct, industry: n.cogsPct, verdict: verdictCost(a.cogsPct, n.cogsPct) },
    { metric: 'Labor, % of sales', you: a.laborPct, industry: n.laborPct, verdict: verdictCost(a.laborPct, n.laborPct) },
    { metric: 'Prime cost, % of sales', you: a.primeCostPct, industry: r2(n.cogsPct + n.laborPct), verdict: verdictCost(a.primeCostPct, n.cogsPct + n.laborPct) },
    { metric: 'Rent, % of sales', you: a.rentPct, industry: n.rentPct, verdict: verdictCost(a.rentPct, n.rentPct) },
    { metric: 'Net margin', you: a.netMarginPct, industry: n.netMarginPct, verdict: a.netMarginPct >= n.netMarginPct ? 'good' : a.netMarginPct >= 0 ? 'ok' : 'bad' },
  ];
}

function analyticsFor(o: {
  plan: MonthPlan; daysIntoMonth: number; history: MonthReport[]; cash: number; setupSpent: number; netWorth: number;
  liabilities: BusinessState['liabilities']; exposure: number; lostUnits: number;
}): Analytics {
  const p = o.plan;
  const lines = monthLines(p);
  const revenue = lines[0].amount;
  const profit = profitOf(lines);
  const cogs = -lines.find((l) => l.id === 'cogs')!.amount;
  const labor = p.payroll + p.payrollTax - (p.saving ?? 0);
  const variable = r2(cogsPerUnit(p) + p.price * CAFE.cardFeeShare);
  const fixed = r2(p.payroll + p.payrollTax + p.rent + p.utilities + p.insurance + p.cleaning + p.software + p.marketing + p.blockFund - (p.saving ?? 0));
  const contribution = r2(p.price - variable);
  const be = contribution > 0 ? Math.ceil(fixed / contribution) : null;
  const cumulative = r2(o.history.reduce((s, m) => s + m.profit, 0) + (profit * o.daysIntoMonth) / DAYS);
  const due = o.liabilities.filter((l) => !l.paid).sort((a, b) => a.dueDay - b.dueDay)[0];
  const shares = {
    cogsPct: r2(cogs / revenue), laborPct: r2(labor / revenue), rentPct: r2(p.rent / revenue),
    primeCostPct: r2((cogs + labor) / revenue), netMarginPct: r2(profit / revenue),
  };
  return {
    month: p.month, daysIntoMonth: o.daysIntoMonth, revenue, profit, cumulativeProfit: cumulative, netWorth: o.netWorth,
    ...shares,
    fixedCostsMonth: fixed, variableCostPerUnit: variable, contributionPerUnit: contribution,
    breakEvenUnitsMonth: be, breakEvenRevenueMonth: be === null ? null : r2(be * p.price),
    breakEvenPrice: r2((fixed + p.units * cogsPerUnit(p)) / (p.units * (1 - CAFE.cardFeeShare))),
    utilization: r2(p.units / CAFE.staffCapMonth(p.staff)), sizeUtilization: r2(p.units / CAFE.sizeCapMonth(p.seats)),
    lostSalesUnits: o.lostUnits, lostSalesMoney: r2(o.lostUnits * p.price),
    cashRunwayMonths: profit < 0 ? r2(o.cash / -profit) : null,
    setupInvested: o.setupSpent, paybackMonths: profit > 0 ? Math.round(o.setupSpent / profit) : null,
    taxDueNext: due ? { amount: due.amount, day: due.dueDay } : null,
    exposure: o.exposure, benchmarks: benchmarksFor(shares),
    nicheKpis: [
      { id: 'avg_ticket', label: 'Average ticket', value: p.price, unit: '$' },
      { id: 'tickets_per_day', label: 'Tickets a day', value: r0(p.units / DAYS), unit: 'orders' },
      { id: 'tickets_per_seat_day', label: 'Tickets per seat a day', value: r2(p.units / DAYS / p.seats), unit: 'orders' },
      { id: 'prime_cost', label: 'Prime cost', value: shares.primeCostPct, unit: '%' },
    ],
  };
}

/** Sales tax still owed on the view day: one liability per due day, growing as the quarter goes (engine's accrue). */
function openSalesTax(plans: MonthPlan[], current: MonthPlan | null, into: number, day: number): BusinessState['liabilities'] {
  const months = [
    ...plans.map((p) => ({ month: p.month, tax: collectedTax(p) })),
    ...(current ? [{ month: current.month, tax: r2((collectedTax(current) * into) / DAYS) }] : []),
  ];
  const byDue = new Map<number, number>();
  for (const m of months) {
    const due = salesTaxDueDay(m.month);
    if (due > day) byDue.set(due, r2((byDue.get(due) ?? 0) + m.tax));    // earlier quarters were paid on their day
  }
  return [...byDue].map(([dueDay, amount]) => ({ taxId: 'sales_tax', amount, dueDay, paid: false }));
}

// ───────────── Maya's months (lead's example) ─────────────
const SETUP = 139500;
const START = 224000;
const ITEMS_VALUE = 26200;          // equipment, furniture and the 8 extra seats; half counts in net worth
const MAYA = {
  price: 8.5, staff: 5, payroll: 19450, payrollTax: 1550, rent: 6000,
  utilities: 1500, insurance: 400, cleaning: 300, software: 159, marketing: 1100, blockFund: 0,
};
const MAYA_SEASON: MonthPlan[] = withQuarterlyTax([
  // January: doors open on day 22 after the 21-day permit wait, 9 days of sales at 150 a day: −$5,554 (lead)
  { ...MAYA, month: 1, seats: 12, units: 1350, payroll: 3560, payrollTax: 323, setup: SETUP, quality: 0.6, reputation: 0.5, rank: 6 },
  // February: 12 seats serve 150 a day, 50 more walk away: $12,750 of sales lost
  { ...MAYA, month: 2, seats: 12, units: 4500, lostSize: 1500, quality: 0.62, reputation: 0.53, rank: 5 },
  // March: 8 seats added for $1,200, 200 tickets a day: +$4,152 (lead)
  { ...MAYA, month: 3, seats: 20, units: 6000, setup: 1200, quality: 0.68, reputation: 0.6, rank: 4 },
  // April: joint purchase (food −6%) and the block fund ($300, more people on the street): about +$6,095 (lead)
  { ...MAYA, month: 4, seats: 20, units: 6235, cogsMult: 0.94, blockFund: 300, quality: 0.7, reputation: 0.64, rank: 3, lostSize: 60 },
  { ...MAYA, month: 5, seats: 20, units: 6235, cogsMult: 0.94, blockFund: 300, quality: 0.71, reputation: 0.66, rank: 3, lostSize: 120 },
  { ...MAYA, month: 6, seats: 20, units: 6235, cogsMult: 0.94, blockFund: 300, quality: 0.72, reputation: 0.67, rank: 3, lostSize: 140 },
  { ...MAYA, month: 7, seats: 20, units: 6235, cogsMult: 0.94, blockFund: 300, quality: 0.73, reputation: 0.68, rank: 2, lostSize: 100 },
  { ...MAYA, month: 8, seats: 20, units: 6235, cogsMult: 0.94, blockFund: 300, quality: 0.74, reputation: 0.69, rank: 2, lostSize: 90 },
  // September–October: coffee beans up 12%
  { ...MAYA, month: 9, seats: 20, units: 6235, cogsMult: 0.94 * 1.12, blockFund: 300, quality: 0.74, reputation: 0.7, rank: 2, lostSize: 80 },
  { ...MAYA, month: 10, seats: 20, units: 6235, cogsMult: 0.94 * 1.12, blockFund: 300, quality: 0.75, reputation: 0.71, rank: 2 },
  { ...MAYA, month: 11, seats: 20, units: 6235, cogsMult: 0.94, blockFund: 300, quality: 0.76, reputation: 0.72, rank: 2 },
  { ...MAYA, month: 12, seats: 20, units: 6235, cogsMult: 0.94, blockFund: 300, quality: 0.77, reputation: 0.73, rank: 2 },
]);
export const MAYA_PLANS: MonthPlan[] = MAYA_SEASON.slice(0, 6);

function buildHistory(plans: MonthPlan[], start: number, itemsHalf: number): MonthReport[] {
  const out: MonthReport[] = [];
  let cash = start;
  for (const p of plans) {
    const m = monthReport(p, cash, itemsHalf);
    out.push(m);
    cash = m.cashEnd;
  }
  return out;
}

const RULE_CARD_IDS = { cash: 'off_books_payroll_rule', grade: 'letter_grade', salesTax: 'sales_tax_rule', permit: 'fse_permit_rule' };

export const RULE_CARDS: PackRuleCard[] = [
  { id: RULE_CARD_IDS.cash, title: 'Payroll taxes are not optional', text: 'Paying wages in cash off the books skips withholding and payroll taxes. The IRS can make the owner personally pay the unpaid withheld taxes (Trust Fund Recovery Penalty, 26 U.S.C. § 6672).', source: 'https://www.irs.gov/TFRP' },
  { id: RULE_CARD_IDS.grade, title: 'Letter grades', text: 'Every NYC food place is inspected by the Health Department. 0–13 violation points is an A, 14–27 a B, 28 or more a C. The grade card must be posted at the door.', source: 'https://www.nyc.gov/site/doh/business/food-operators/letter-grading-for-restaurants.page' },
  { id: RULE_CARD_IDS.salesTax, title: 'The sales tax you collect is not yours', text: 'New York requires a Certificate of Authority at least 20 days before you make taxable sales, and the tax you collect is owed to the state on the filing date. Keep it apart from your cash.', source: 'https://www.tax.ny.gov/bus/doingbus/sell.htm' },
  { id: RULE_CARD_IDS.permit, title: 'No permit, no coffee', text: 'A cafe needs a Food Service Establishment Permit from the NYC Health Department ($280) before it serves anyone. Opening early is a violation.', source: 'https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit' },
];

const EVENTS: GameEvent[] = [
  { id: 'ev-blizzard', kind: 'weather', title: 'Blizzard warning', text: 'Heavy snow for two days: about 30% fewer people on every street.', announcedDay: 45, startDay: 48, endDay: 49, effects: [{ target: 'footTraffic', mult: 0.7 }], origin: 'ai' },
  { id: 'ev-heat', kind: 'weather', title: 'Heat wave', text: 'Hot week ahead: cold drinks sell better, hot ones worse.', announcedDay: 187, startDay: 190, endDay: 196, effects: [{ target: 'demand', mult: 1.05, niches: ['cafe'] }], origin: 'ai' },
  { id: 'ev-beans', kind: 'supply', title: 'Coffee beans up 12%', text: 'Green coffee prices rose: roasters raise wholesale prices for two months.', announcedDay: 238, startDay: 241, endDay: 300, effects: [{ target: 'cogs', mult: 1.12, niches: ['cafe'] }], origin: 'ai' },
];

const FEED: FeedItem[] = [
  { id: 'f1', day: 75, kind: 'inspection', text: 'Health inspection at Maya’s Coffee after a complaint: clean, grade A', businessId: MY_BUSINESS_ID },
  { id: 'f2', day: 91, kind: 'deal', text: 'Maya’s Coffee and Bean & Bagel buy supplies together', businessId: MY_BUSINESS_ID },
  { id: 'f3', day: 110, kind: 'bankruptcy', text: 'Leo’s Espresso closed: could not pay sales tax', businessId: 'b-leo' },
  { id: 'f4', day: 150, kind: 'bankruptcy', text: 'Victor’s Espresso closed after a payroll audit', businessId: 'b-victor' },
  { id: 'f5', day: 258, kind: 'inspection', text: 'Health inspection at Maya’s Coffee: grade A', businessId: MY_BUSINESS_ID },
];

/** Officials of the example: Dana and Rick are city inspectors, Sam is the tax auditor; Rick was caught taking a bribe. */
export const OFFICIALS_RANKING = [
  { name: 'Dana (inspector)', points: 35, isAi: false },
  { name: 'Sam (tax auditor)', points: 25, isAi: false },
  { name: 'City inspector (AI)', points: 15, isAi: true },
  { name: 'Tax auditor (AI)', points: 10, isAi: true },
  { name: 'Rick (inspector) · caught taking a bribe', points: 0, isAi: false },
];

interface ViewSpec {
  day: number; phase: 'running' | 'ended'; plans: MonthPlan[]; current: MonthPlan | null; status: BusinessState['status'];
  me: { businessId: string; playerId: string; name: string; owner: string };
  exposure: number; trails: BusinessState['trails']; shortcuts: string[]; seed: number; staff: Record<string, number>; seats: number;
  /** Net worth of the other cafes; the player's own is computed (or `myWorth`, the lead's number). */
  others: [string, number][]; bankrupt: string[]; ownersInCity: number; myWorth?: number;
  /** Calibrate the starting cash so that the cash today is exactly this (lead's numbers for Leo and Victor). */
  cashToday?: number;
  /** Money spent to open (default: Maya's $139,500). */
  setup?: number;
}

const MAYA_ME = { businessId: MY_BUSINESS_ID, playerId: MY_PLAYER_ID, name: 'Maya’s Coffee', owner: 'Maya' };

function ownerView(o: ViewSpec): OwnerView {
  const date = dateOf(o.day);
  const into = o.phase === 'ended' ? DAYS : date.dayOfMonth;
  const mtdLines = o.current ? monthLines(o.current).map((l) => ({ ...l, amount: r2((l.amount * into) / DAYS) })) : [];
  const mtdSum = mtdLines.reduce((s, l) => s + l.amount, 0);
  const planned = buildHistory(o.plans, START, ITEMS_VALUE / 2);
  const start = o.cashToday === undefined ? START : r2(START + (o.cashToday - ((planned.at(-1)?.cashEnd ?? START) + mtdSum)));
  const history = buildHistory(o.plans, start, ITEMS_VALUE / 2);
  const setupSpent = o.setup ?? SETUP;
  const cash = r2((history.at(-1)?.cashEnd ?? start - (o.status === 'setup' ? setupSpent : 0)) + mtdSum);
  const liabilities = openSalesTax(o.plans, o.current, into, o.day);
  const allPlans = o.current ? [...o.plans, o.current] : o.plans;
  const days = o.status === 'setup' ? [] : dayReports(allPlans, Math.max(1, o.day - 29), o.day, o.seed);
  const thisMonth = days.filter((d) => dateOf(d.day).month === date.month);
  const sumLost = (k: 'size' | 'staff' | 'closure') => thisMonth.reduce((s, d) => s + d.lost[k], 0);
  const unpaid = liabilities.reduce((s, l) => s + l.amount, 0);
  const netWorth = r2(cash + ITEMS_VALUE / 2 - unpaid);
  const cafe = table('cafe', [...o.others, [o.me.businessId, o.myWorth ?? r0(netWorth)]], o.bankrupt, o.me.businessId);
  const myRank = cafe.standings.find((s) => s.businessId === o.me.businessId)?.rank ?? 0;
  const lostUnits = days.reduce((s, d) => s + d.lost.size + d.lost.staff + d.lost.closure, 0);
  const business: BusinessState = {
    id: o.me.businessId, name: o.me.name, niche: 'cafe', placeId: `place-${o.me.businessId}`, isAi: false,
    owners: [{ playerId: o.me.playerId, share: 1 }], managerPlayerId: o.me.playerId, status: o.status,
    createdDay: 1, openedDay: o.status === 'setup' ? undefined : 22, cash, size: o.seats,
    items: [{ id: 'espresso_machine', qty: 1 }, { id: 'grinder', qty: 2 }, { id: 'chair', qty: o.seats }, { id: 'table', qty: Math.ceil(o.seats / 2) }, { id: 'pos', qty: 1 }],
    setupSpent, permits: [{ itemId: 'fse_permit', appliedDay: 1, readyDay: 22 }], quality: o.current?.quality ?? 0.6,
    reputation: o.current?.reputation ?? 0.5, trust: { kept: 2, broken: 0 },
    orders: { price: (o.current ?? o.plans.at(-1))?.price ?? MAYA.price, staff: o.staff, levers: { cleaning: 'standard' }, shortcuts: o.shortcuts, blockFund: true, autopilot: 'manager' },
    trails: o.trails, liabilities,
    mtd: {
      lines: mtdLines, demandUnits: thisMonth.reduce((s, d) => s + d.demandUnits, 0),
      servedUnits: thisMonth.reduce((s, d) => s + d.servedUnits, 0),
      lost: { size: sumLost('size'), staff: sumLost('staff'), closure: sumLost('closure') },
    },
    days, history: history.map((m) => ({ ...m, rankInNiche: m.month === date.month ? myRank : m.rankInNiche })),
  };
  const analytics = o.current && o.status !== 'setup'
    ? analyticsFor({ plan: o.current, daysIntoMonth: into, history, cash, setupSpent, netWorth, liabilities, exposure: o.exposure, lostUnits })
    : null;
  return {
    kind: 'owner',
    me: {
      id: o.me.playerId, name: o.me.owner, kind: 'owner', isAi: false, paid: true, joinedDay: 1, lastSeenDay: o.day - 1,
      // the host sends every announced event to the inbox; the view's `events` keeps only current and coming ones
      inbox: EVENTS.filter((e) => e.announcedDay <= o.day).map((e) => ({ id: `in-${e.id}`, day: e.announcedDay, kind: 'event' as const, title: e.title, text: `${e.text} Starts ${dateOf(e.startDay).label}.`, read: true })),
    },
    world: worldPublic(o.day, o.phase, o.ownersInCity, o.bankrupt.length),
    business, stakes: [{ businessId: o.me.businessId, share: 1 }],
    neighbors: [...cafe.neighbors, ...BARBER_TABLE.neighbors], deals: [], notices: [], blockFund: null,
    weather: [{ day: o.day, tempF: 74, condition: 'clear', footTrafficMult: 1.05, label: 'Clear 74°F' }],
    events: EVENTS.filter((e) => e.announcedDay <= o.day && e.endDay >= o.day), feed: FEED.filter((f) => f.day <= o.day), analytics, recommendations: [], roadmap: [],
    leaderboards: { cafe: cafe.standings, barbershop: BARBER_TABLE.standings }, away: null,
    officialsRanking: OFFICIALS_RANKING,
  };
}

/** Net worth of the other cafes in April (before anyone went bankrupt), in June and at the end (lead's final table). */
const APRIL: [string, number][] = [
  ['b-bagel', 96000], ['ai-cafe-1', 93500], [MY_BUSINESS_ID, 91000], ['b-omar', 88200], ['b-victor', 86900], ['ai-cafe-2', 84000],
  ['b-nora', 81200], ['ai-cafe-3', 76100], ['b-grind', 73300], ['ai-cafe-4', 70200], ['b-crumb', 67000], ['ai-cafe-5', 63800],
  ['b-ritual', 60100], ['ai-cafe-6', 57400], ['b-kiln', 54000], ['ai-cafe-7', 50200], ['ai-cafe-8', 46900], ['ai-cafe-9', 43100],
  ['ai-cafe-10', 39800], ['b-leo', 31000],
];
const JUNE: [string, number][] = [
  ['b-bagel', 112400], ['ai-cafe-1', 108900], ['b-omar', 98700], ['ai-cafe-2', 94100], ['b-nora', 90300],
  ['ai-cafe-3', 86000], ['b-grind', 81500], ['ai-cafe-4', 77200], ['b-crumb', 72800], ['ai-cafe-5', 68100], ['b-ritual', 63900],
  ['ai-cafe-6', 59400], ['b-kiln', 55200], ['ai-cafe-7', 50800], ['ai-cafe-8', 46100], ['ai-cafe-9', 41700], ['ai-cafe-10', 37300],
  ['b-victor', -4300], ['b-leo', -6100],
];
const FINAL: [string, number][] = [
  ['b-bagel', 151800], ['b-omar', 128400], ['ai-cafe-1', 121300], ['b-nora', 119000], ['ai-cafe-2', 112600],
  ['b-grind', 104200], ['ai-cafe-3', 98100], ['b-crumb', 87400], ['ai-cafe-4', 80900], ['b-ritual', 72300], ['ai-cafe-5', 66800],
  ['b-kiln', 61000], ['ai-cafe-6', 57200], ['ai-cafe-7', 52500], ['ai-cafe-8', 48300], ['ai-cafe-9', 44000], ['ai-cafe-10', 39600],
  ['b-victor', -4300], ['b-leo', -6100],
];
const without = (rows: [string, number][], id: string) => rows.filter(([x]) => x !== id);

/** Maya on June 12: in profit with her deals; the second quarter's sales tax is building up for July 20. */
export const cafeView: OwnerView = ownerView({
  day: 162, phase: 'running', plans: MAYA_PLANS.slice(0, 5), current: MAYA_PLANS[5], status: 'open', me: MAYA_ME,
  exposure: 0, shortcuts: [], seed: 5, staff: { barista: 4, manager: 1 }, trails: [], seats: 20,
  others: JUNE, bankrupt: ['b-victor', 'b-leo'], ownersInCity: 10,
});

// ───────────── Leo on April 15: ads ate the cash, the quarter's sales tax is due in five days ─────────────
const LEO_SETUP = 150000;
const LEO = { ...MAYA, staff: 6, payroll: 25000, payrollTax: 2000, rent: 7200, marketing: 9000 };
const LEO_PLANS: MonthPlan[] = [
  // Ads bring more people than Maya gets, but a bigger room, six staff and the ads eat it all, month after month
  { ...LEO, month: 1, seats: 24, units: 2250, payroll: 5000, payrollTax: 400, marketing: 20000, setup: LEO_SETUP, quality: 0.6, reputation: 0.5, rank: 4 },
  { ...LEO, month: 2, seats: 24, units: 7800, marketing: 15000, quality: 0.62, reputation: 0.55, rank: 5 },
  { ...LEO, month: 3, seats: 24, units: 7950, marketing: 15000, quality: 0.6, reputation: 0.55, rank: 6 },
  { ...LEO, month: 4, seats: 24, units: 7200, quality: 0.58, reputation: 0.52, rank: 8 },
];

/** Leo's Espresso on April 15 (from Leo's seat): ads ate the cash; $13,579 of first-quarter sales tax is due April 20, he has $9,800. */
export const cafeStrugglingView: OwnerView = ownerView({
  day: 105, phase: 'running', plans: LEO_PLANS.slice(0, 3), current: LEO_PLANS[3], status: 'open',
  me: { businessId: 'b-leo', playerId: 'p-leo', name: 'Leo’s Espresso', owner: 'Leo' }, setup: LEO_SETUP,
  exposure: 0, shortcuts: [], seed: 9, staff: { barista: 5, manager: 1 }, trails: [], seats: 24, cashToday: 9800,
  others: [...without(APRIL, 'b-leo')], bankrupt: [], ownersInCity: 10,
});

// ───────────── Victor on May 5: four baristas paid in cash since February ─────────────
const VICTOR = { ...MAYA, price: 7.25 };
const VICTOR_PLANS: MonthPlan[] = withQuarterlyTax([
  { ...VICTOR, month: 1, seats: 20, units: 1800, payroll: 3560, payrollTax: 323, setup: SETUP, quality: 0.58, reputation: 0.5, rank: 3 },
  { ...VICTOR, month: 2, seats: 20, units: 6400, saving: 1414, quality: 0.6, reputation: 0.55, rank: 4 },
  { ...VICTOR, month: 3, seats: 20, units: 6600, saving: 1414, quality: 0.6, reputation: 0.56, rank: 5 },
  { ...VICTOR, month: 4, seats: 20, units: 6700, saving: 1414, quality: 0.61, reputation: 0.57, rank: 5 },
  { ...VICTOR, month: 5, seats: 20, units: 6700, saving: 1414, quality: 0.61, reputation: 0.57, rank: 5 },
]);

/** Victor's Espresso on May 5 (from Victor's seat): $1,414 a month kept, $5,656 in four months, $13,312 if found. */
export const cafeRiskyView: OwnerView = ownerView({
  day: 125, phase: 'running', plans: VICTOR_PLANS.slice(0, 4), current: VICTOR_PLANS[4], status: 'open',
  me: { businessId: 'b-victor', playerId: 'p-victor', name: 'Victor’s Espresso', owner: 'Victor' },
  exposure: 13312, shortcuts: ['cash_wages'], seed: 21, staff: { barista: 4, manager: 1 }, seats: 20, cashToday: 18000,
  trails: [{ violationId: 'off_books_payroll', months: 4, saved: 5656, lastActiveMonth: 5, discovered: false }],
  others: [...without(APRIL, 'b-victor').filter(([id]) => id !== 'b-leo'), ['b-leo', -6100]], bankrupt: ['b-leo'], ownersInCity: 10,
});

/** Maya on day 14, still waiting for the food permit: no analytics yet. */
export const cafeSetupView: OwnerView = ownerView({
  day: 14, phase: 'running', plans: [], current: null, status: 'setup', me: MAYA_ME, exposure: 0, shortcuts: [],
  seed: 3, staff: { barista: 4, manager: 1 }, seats: 12, trails: [],
  others: without(APRIL, MY_BUSINESS_ID).map(([id]) => [id, START - SETUP + ITEMS_VALUE / 2]), bankrupt: [], ownersInCity: 10,
});

// ───────────── the season is over (lead's final table) ─────────────
const endedBase = ownerView({
  day: 360, phase: 'ended', plans: MAYA_SEASON, current: null, status: 'open', me: MAYA_ME, exposure: 0,
  shortcuts: [], seed: 13, staff: { barista: 4, manager: 1 }, seats: 20, trails: [],
  // the lead's table gives Maya $142,200; her generated season is close but not identical, so the table uses his number
  others: FINAL, myWorth: 142200, bankrupt: ['b-victor', 'b-leo'], ownersInCity: 10,
});

/**
 * Every payout of the season as finalizeSeason writes WorldState.payouts (agent 13): cents by the 50/30/20 table,
 * rank = place among the winners. The officials' and platform's shares are the lead's numbers.
 */
export const SEASON_PAYOUTS: Payout[] = (() => {
  const cents = r0(endedBase.world.bank * 100);
  const prizeC = r0(cents * CONFIG.prizeShare);
  const officialsC = r0(cents * CONFIG.officialsShare);
  const winners = (endedBase.leaderboards.cafe ?? []).filter((s) => !s.isAi && !s.bankrupt).sort((a, b) => a.rank - b.rank).slice(0, 3);
  const out: Payout[] = winners.map((s, i) => ({
    playerId: s.businessId === MY_BUSINESS_ID ? MY_PLAYER_ID : `owner-${s.businessId}`, kind: 'owner',
    amount: r2((prizeC * CONFIG.nichePrizeTable[i]) / 100), niche: 'cafe', rank: i + 1,
  }));
  out.push({ playerId: 'official-dana', kind: 'official', amount: 1.46 });
  out.push({ playerId: 'official-sam', kind: 'official', amount: 1.04 });
  out.push({ playerId: 'platform', kind: 'platform', amount: r2((cents - prizeC - officialsC) / 100) });
  return out;
})();

/** End of the season from Maya's seat. OwnerView.payouts holds this player's payouts only (CONTRACT). */
export const cafeEndedView: OwnerView = { ...endedBase, payouts: SEASON_PAYOUTS.filter((p) => p.playerId === MY_PLAYER_ID) };

// ───────────── query answers ─────────────
const CHECKLIST: PackRoadmapStep[] = [
  { id: 'form_llc', title: 'Form an LLC', kind: 'legal', text: 'File Articles of Organization with the New York Department of State, then publish notice of formation in two newspapers.', fee: 200, agency: 'NY Department of State', link: 'https://dos.ny.gov/articles-organization-domestic-limited-liability-company-0' },
  { id: 'get_ein', title: 'Get an EIN', kind: 'legal', text: 'Free federal tax number for your business. You need it to hire and to open a business bank account.', fee: 0, agency: 'IRS', link: 'https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number' },
  { id: 'sales_tax_coa', title: 'Register for sales tax (Certificate of Authority)', kind: 'legal', text: 'Apply at least 20 days before your first sale. Display the certificate in the shop.', waitDays: 20, agency: 'NYS Department of Taxation and Finance', link: 'https://www.tax.ny.gov/bus/doingbus/sell.htm' },
  { id: 'fse_permit', title: 'Food Service Establishment Permit', kind: 'permit', text: 'Apply before you build out. An inspector visits before you open.', fee: 280, waitDays: 21, agency: 'NYC Health Department (DOHMH)', link: 'https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit' },
  { id: 'food_protection', title: 'Food Protection Certificate', kind: 'people', text: 'A certified supervisor must be on site whenever you are open. The online course is free; the exam is taken in person.', fee: 24.6, agency: 'NYC Health Department (DOHMH)', link: 'https://www.nyc.gov/site/doh/business/health-academy/food-protection-online-free.page' },
];

const SUPPLIERS: PackSupplier[] = [
  { id: 'beans', category: 'Coffee beans', what: 'Wholesale roasted coffee, often with free barista training', whereToFind: 'Local roasters with wholesale programs; ask three for a tasting and a price per pound' },
  { id: 'dairy', category: 'Milk and dairy', what: 'Daily or every-other-day delivery of milk and oat milk', whereToFind: 'Regional dairy distributors and cash-and-carry restaurant warehouses' },
  { id: 'equipment', category: 'Equipment', what: 'Espresso machine, grinders, refrigeration', whereToFind: 'New or certified used from restaurant equipment dealers; lease-to-own is common' },
];

// Maya's three losses, from her own months (the engine's lessons are money lost, the largest first)
const FEB = MAYA_SEASON[1];
const LOST_SEATS = r2((FEB.lostSize ?? 0) * contributionOf(FEB));
const RENT_WAITING = r2((MAYA.rent * 21) / DAYS);
const BEANS = r2(MAYA_SEASON.filter((p) => (p.cogsMult ?? 1) > 1).reduce((s, p) => s + p.units * p.price * CAFE.cogsShare * 0.94 * 0.12, 0));

const LESSONS: RealWorldPlan['lessons'] = [
  { title: 'Not enough seats in February', amount: LOST_SEATS, lesson: `12 seats served 150 tickets a day while 200 people came: ${int(FEB.lostSize ?? 0)} walked away, ${money(revenueOf({ ...FEB, units: FEB.lostSize ?? 0 }))} of sales and ${money(LOST_SEATS)} after coffee, milk and card fees. Size the room to the busiest hour, not the average.` },
  { title: 'Rent while you waited for the permit', amount: RENT_WAITING, lesson: `The food permit took 21 days and the rent ran from day one: ${money(RENT_WAITING)} before the first coffee. Apply before you sign, or ask the landlord for free rent during the build-out.`, ruleCardId: RULE_CARD_IDS.permit },
  { title: 'Coffee beans up 12% in September and October', amount: BEANS, lesson: 'Roasters passed the higher price of green coffee on to you for two months. Ask your roaster for a fixed price for six months, or raise a cup by 25¢ when beans jump.' },
];

/** Maya's plan, numbers from the lead's example (docs/demo/demo-cycle.md). */
export const PLAN: RealWorldPlan = {
  niche: 'cafe', businessName: 'Maya’s Coffee',
  startupBudget: [
    { label: 'Security deposit: three months of rent', amount: 18000 },
    { label: 'Build-out of a former coffee shop ($87.50 per sq ft)', amount: 70000 },
    { label: 'Architect and approvals', amount: 7000 },
    { label: 'Equipment, furniture and smallwares', amount: 25000 },
    { label: 'Delivery, sales tax and installation', amount: 3500 },
    { label: 'Sign', amount: 1500 },
    { label: 'Lease lawyer', amount: 3500 },
    { label: 'LLC, publication and permits', amount: 2500 },
    { label: 'Opening stock', amount: 3000 },
    { label: 'Hiring and training', amount: 4000 },
    { label: 'Insurance and utility hookups', amount: 1500 },
  ],
  startupTotal: SETUP,
  monthlyCosts: [
    { label: 'Wages with payroll taxes: 4 baristas and a manager', amount: 21000 },
    { label: 'Rent', amount: 6000 },
    { label: 'Electricity, gas and water', amount: 1500 },
    { label: 'Marketing', amount: 1100 },
    { label: 'Insurance', amount: 400 },
    { label: 'Cleaning', amount: 300 },
    { label: 'POS and software', amount: 159 },
  ],
  monthlyTotal: 30459,
  reserveAdvised: START - SETUP,
  breakEvenUnitsMonth: Math.ceil(30459 / contributionOf(MAYA_SEASON[2])), paybackMonths: 23,
  checklist: CHECKLIST, suppliers: SUPPLIERS,
  lessons: LESSONS,
  disclaimer: 'This plan comes from a learning simulation. It is not legal, tax or financial advice. Check every fee and rule with the agency before you act.',
};

export const DEBRIEF: Debrief = {
  headline: 'Second of ten human coffee shops — a real business that needed more seats sooner.',
  lostMoneyOn: LESSONS.map((l) => ({ ...l })),
  didWell: [
    'Added 8 seats in March for $1,200: +$8,666 a month',
    'Bought supplies with Bean & Bagel: food 6% cheaper, +$857 a month',
    'Paid $300 into the block fund: +$1,086 a month after the fee',
    'Lent Omar $8,000 at 3% a month and got it all back: +$609',
  ],
  nextTime: ['Open with 20 seats, not 12', 'Apply for the food permit before you sign the lease', 'Move 9% of every sale into a tax account the day you sell'],
  origin: 'rules',
};

export function advisorAnswer(question: string): AdvisorAnswer {
  const q = question.toLowerCase();
  if (q.includes('supplier'))
    return { answer: 'Start with three local roasters that sell wholesale: ask each for a tasting, a price per pound for 20 lb a week, and whether they train your baristas. Dairy usually comes from a regional distributor on a set delivery schedule.', sources: [{ title: 'NYC Business: Food Service Establishment Permit', url: 'https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit' }], origin: 'rules' };
  if (q.includes('cash'))
    return { answer: 'You keep about $1,414 a month. If the tax auditor finds it, the fine today is $13,312 — more than twice the $5,656 you kept — and it grows every month. The IRS can also make you personally pay the unpaid withheld taxes.', sources: [{ title: 'IRS: Trust Fund Recovery Penalty', url: 'https://www.irs.gov/TFRP' }], origin: 'rules' };
  if (q.includes('tax'))
    return { answer: 'You owe $13,579 of sales tax on April 20 and have $9,800. Stop the ads today ($9,000 a month), and ask the Tax Department about a payment plan before the due date rather than after.', sources: [{ title: 'NY Tax Department: selling products or services', url: 'https://www.tax.ny.gov/bus/doingbus/sell.htm' }], origin: 'rules' };
  if (q.includes('lose') || q.includes('lost'))
    return { answer: 'Saturday lunch filled all 20 seats and the rest walked away. Two more seats or a faster takeaway line would have kept most of them.', sources: [], origin: 'ai' };
  const a = cafeView.analytics!;
  const ahead = r0(a.revenue / (a.variableCostPerUnit + a.contributionPerUnit) - (a.breakEvenUnitsMonth ?? 0));
  const labor = a.benchmarks.find((b) => b.metric.startsWith('Labor'))!;
  return { answer: `You sell about ${int(ahead)} tickets a month more than break-even. The biggest lever left is labor: ${Math.round(labor.you * 100)}% of sales against about ${Math.round(labor.industry * 100)}% for typical coffee shops.`, sources: [], origin: 'rules' };
}

/** Pretends to be the server: answers after `delayMs`; `hang` never answers (to test the timeout). */
export function fakeQuery(opts: { delayMs?: number; hang?: boolean; plan?: RealWorldPlan; debrief?: Debrief } = {}) {
  return function query<T>(q: Query): Promise<Ack<T>> {
    if (opts.hang) return new Promise(() => {});
    const data = q.type === 'advisor' ? advisorAnswer(q.question)
      : q.type === 'real_world_plan' ? (opts.plan ?? PLAN)
      : q.type === 'debrief' ? (opts.debrief ?? DEBRIEF)
      : undefined;
    const ack: Ack<T> = data === undefined ? { ok: false, error: `No sample answer for ${q.type}` } : { ok: true, data: data as T };
    return new Promise((resolve) => setTimeout(() => resolve(ack), opts.delayMs ?? 400));
  };
}
