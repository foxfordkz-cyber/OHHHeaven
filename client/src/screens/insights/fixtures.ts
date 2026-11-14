// Sample data for agent 11 screens (/dev/insights, /dev/end, /dev/plan) and their tests.
// Every month below is generated from a few parameters, so the lines of each MonthReport add up to the
// change in cash, as the contract requires. Money is game money; links in rule cards and the plan are real
// official pages (checked 14 Nov 2026). Numbers marked "sample" are illustrative until packs/cafe.json lands.
import type {
  Ack, AdvisorAnswer, Analytics, BusinessState, DayReport, Debrief, GameEvent, FeedItem, MonthReport,
  OwnerView, PackRuleCard, PackSupplier, PackRoadmapStep, Payout, PnlLine, PublicBusiness, Query,
  RealWorldPlan, Standing, WeatherCondition, WorldConfig, WorldPublic,
} from '@shared/types';
import { dateOf } from '@shared/rules';

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

// ───────────── the cafe and its months ─────────────
export const CAFE = {
  salesTaxRate: 0.08875,   // NYC combined sales tax, tax.ny.gov
  cardFeeShare: 0.026,     // sample: card processing share of sales
  cogsPerUnit: 1.95,       // sample
  sizeCapMonth: (seats: number) => (seats * 150) / (1 - 0.45),   // PACK.md example: 150 per seat, 45% takeaway
  staffCapMonth: (staff: number) => staff * 1800,
};

export interface MonthPlan {
  month: number; units: number; price: number; seats: number; staff: number;
  payroll: number; payrollTax: number; rent: number;
  utilities: number; insurance: number; cleaning: number; software: number; marketing: number; blockFund: number;
  saving?: number; fine?: number; incomeTax?: number; setup?: number; salesTaxPaid?: number; cogsMult?: number;
  quality: number; reputation: number; rank: number; lostSize?: number; lostStaff?: number; lostClosure?: number;
}

export function monthLines(p: MonthPlan): PnlLine[] {
  const revenue = r2(p.units * p.price);
  const cogs = r2(p.units * CAFE.cogsPerUnit * (p.cogsMult ?? 1));
  const lines: PnlLine[] = [
    { id: 'revenue', label: 'Sales', kind: 'revenue', amount: revenue },
    { id: 'sales_tax_collected', label: 'Sales tax collected (held for the state)', kind: 'tax', amount: r2(revenue * CAFE.salesTaxRate) },
    { id: 'cogs', label: 'Coffee, milk, food and cups', kind: 'cogs', amount: -cogs },
    { id: 'card_fees', label: 'Card processing fees', kind: 'opex', amount: -r2(revenue * CAFE.cardFeeShare) },
    { id: 'payroll', label: 'Wages', kind: 'payroll', amount: -p.payroll },
    { id: 'payroll_tax', label: 'Payroll taxes', kind: 'payroll_tax', amount: -p.payrollTax },
    { id: 'rent', label: 'Rent', kind: 'rent', amount: -p.rent },
    { id: 'utilities', label: 'Electricity and gas', kind: 'opex', amount: -p.utilities },
    { id: 'insurance', label: 'Insurance', kind: 'opex', amount: -p.insurance },
    { id: 'cleaning', label: 'Cleaning', kind: 'opex', amount: -p.cleaning },
    { id: 'software', label: 'POS and software', kind: 'opex', amount: -p.software },
    { id: 'marketing', label: 'Marketing', kind: 'opex', amount: -p.marketing },
  ];
  if (p.blockFund) lines.push({ id: 'block_fund', label: 'Block fund (Avenue A)', kind: 'deal', amount: -p.blockFund });
  if (p.saving) lines.push({ id: 'saving_cash_wages', label: 'Cash wages: payroll taxes not paid', kind: 'saving', amount: p.saving });
  if (p.fine) lines.push({ id: 'fine_dirty_surfaces', label: 'Health Department fine', kind: 'fine', amount: -p.fine });
  if (p.incomeTax) lines.push({ id: 'income_tax', label: 'Income tax set aside', kind: 'tax', amount: -p.incomeTax });
  if (p.salesTaxPaid) lines.push({ id: 'sales_tax_paid', label: 'Sales tax paid to New York State', kind: 'tax', amount: -p.salesTaxPaid });
  if (p.setup) lines.push({ id: 'setup', label: 'Build-out, equipment and permits', kind: 'setup', amount: -p.setup });
  return lines;
}

/** Profit leaves out the one-off setup and the sales tax that only passes through the till. */
export const isPassThrough = (l: PnlLine) => l.kind === 'setup' || l.id.startsWith('sales_tax');
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
    taxesAccrued: r2(lines.filter((l) => l.kind === 'tax' && l.amount > 0).reduce((s, l) => s + l.amount, 0) + (p.incomeTax ?? 0)),
    taxesPaid: r2((p.salesTaxPaid ?? 0) + (p.incomeTax ?? 0)), fines: p.fine ?? 0,
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
    const demand = r0(((p.units + (p.lostSize ?? 0) + (p.lostStaff ?? 0)) / 30) * WEEKDAY_MULT[date.weekday] * w.mult * (0.95 + rnd() * 0.1));
    const sizeCap = CAFE.sizeCapMonth(p.seats) / 30;
    const staffCap = CAFE.staffCapMonth(p.staff) / 30;
    const served = Math.min(demand, r0(sizeCap), r0(staffCap));
    const lostSize = sizeCap < staffCap ? demand - served : 0;
    const lostStaff = sizeCap >= staffCap ? demand - served : 0;
    const notes: string[] = [];
    if (lostSize > 0) notes.push(`Queue at the door: ${lostSize} walked away — not enough seats`);
    if (lostStaff > 0) notes.push(`Long wait at the counter: ${lostStaff} left — not enough staff`);
    if (w.c === 'storm') notes.push('Storm kept people indoors');
    out.push({
      day: d, demandUnits: demand, servedUnits: served, lost: { size: lostSize, staff: lostStaff, closure: 0 },
      revenue: r2(served * p.price), variableCosts: r2(served * (CAFE.cogsPerUnit * (p.cogsMult ?? 1) + p.price * CAFE.cardFeeShare)),
      sizeUtilization: r2(served / sizeCap), weather: w.c, notes,
    });
  }
  return out;
}

// ───────────── world, neighbors, standings ─────────────
export const CONFIG: WorldConfig = {
  id: 'demo', name: 'Demo city', city: 'nyc', seasonMonths: 12, dayMs: 2000, paused: false, maxOwners: 100,
  aiBusinessesTarget: 30, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05,
  nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 7,
};

function worldPublic(day: number, phase: 'running' | 'ended', paidOwners: number): WorldPublic {
  return {
    config: CONFIG, phase, day, date: dateOf(day), version: 1000 + day, bank: paidOwners * CONFIG.entryFee,
    msToNextDay: phase === 'ended' ? 0 : 1200,
    stats: { owners: paidOwners, aiBusinesses: 14, officials: 6, open: paidOwners + 14 - 2, bankrupt: 2 },
  };
}

// Invented names only: real NYC places may appear as map labels, never as game rivals (PROTOCOL, rule 12).
const CAFE_NAMES = ['Grind Theory', 'Pour Decisions', 'Latte Lab', 'Little Crumb', 'Morning Ritual', 'The Daily Pour',
  'Kettle & Crane', 'Steam & Bean', 'East Side Brew', 'Half Moon Cafe', 'Second Shot', 'Kiln Coffee', 'Bluebird Beans',
  'Tiny Table', 'Corner Roast', 'Oat & Honey', 'Rooftop Roasters', 'Marks & Mugs'];
const OWNER_NAMES = ['Priya', 'Marcus', 'Elena', 'Dmitri', 'Grace', 'Tomás', 'Aisha', 'Kenji', 'Sofia', 'Jamal', 'Lena',
  'Omar', 'Hana', 'Diego', 'Nora', 'Viktor', 'Ruth', 'Sam'];
const BARBER_NAMES = ['Fade Factory', 'Clean Cut Co.', 'Taper & Tonic', 'The Chair', 'Sharp & Co.', 'Straight Razor',
  'Uptown Fades', 'Clipper Club', 'Crown Cuts', 'Mane Street', 'Old School Barbers', 'Lineup Lounge'];

export const MY_BUSINESS_ID = 'b-me';
export const MY_PLAYER_ID = 'p-me';

/** Standings for one niche: humans and AI interleaved, my cafe at `myRank`. */
function nicheField(niche: 'cafe' | 'barbershop', size: number, aiEvery: number, myRank: number | null, topWorth: number, seed: number, bankruptRanks: number[] = []) {
  const rnd = mulberry32(seed);
  const names = niche === 'cafe' ? CAFE_NAMES : BARBER_NAMES;
  const standings: Standing[] = [];
  const neighbors: PublicBusiness[] = [];
  let worth = topWorth;
  let nameIdx = 0;
  for (let rank = 1; rank <= size; rank++) {
    const mine = rank === myRank;
    const isAi = !mine && rank % aiEvery === 0;
    const bankrupt = bankruptRanks.includes(rank);
    const id = mine ? MY_BUSINESS_ID : `${niche}-${rank}`;
    standings.push({ businessId: id, niche, rank, netWorth: bankrupt ? -r0(2000 + rnd() * 3000) : r0(worth), isAi, bankrupt });
    if (!mine) {
      const name = names[nameIdx++ % names.length];
      neighbors.push({
        id, name, ownerName: isAi ? `${name} (AI)` : OWNER_NAMES[(rank + seed) % OWNER_NAMES.length], isAi, niche,
        placeId: `place-${niche}-${rank}`, status: bankrupt ? 'bankrupt' : 'open', price: niche === 'cafe' ? r2(5.4 + rnd() * 2) : r0(28 + rnd() * 14),
        reputation: r2(0.45 + rnd() * 0.4), rankInNiche: rank, trust: { kept: r0(rnd() * 4), broken: rnd() < 0.15 ? 1 : 0 },
        grade: niche === 'cafe' ? (rnd() < 0.8 ? 'A' : 'B') : undefined, partners: [],
      });
    }
    worth -= topWorth * (0.04 + rnd() * 0.05);
  }
  return { standings, neighbors };
}

// ───────────── analytics for the month in progress ─────────────
function analyticsFor(o: {
  plan: MonthPlan; daysIntoMonth: number; history: MonthReport[]; cash: number; setupSpent: number; netWorth: number;
  liabilities: BusinessState['liabilities']; exposure: number; lostUnits: number; benchmarks: Analytics['benchmarks'];
}): Analytics {
  const p = o.plan;
  const lines = monthLines(p);
  const revenue = lines[0].amount;
  const profit = profitOf(lines);
  const cogs = -lines.find((l) => l.id === 'cogs')!.amount;
  const labor = p.payroll + p.payrollTax - (p.saving ?? 0);
  const variable = r2(CAFE.cogsPerUnit * (p.cogsMult ?? 1) + p.price * CAFE.cardFeeShare);
  const fixed = r2(p.payroll + p.payrollTax + p.rent + p.utilities + p.insurance + p.cleaning + p.software + p.marketing + p.blockFund - (p.saving ?? 0));
  const contribution = r2(p.price - variable);
  const be = contribution > 0 ? Math.ceil(fixed / contribution) : null;
  const cumulative = r2(o.history.reduce((s, m) => s + m.profit, 0) + (profit * o.daysIntoMonth) / 30);
  const due = o.liabilities.filter((l) => !l.paid).sort((a, b) => a.dueDay - b.dueDay)[0];
  return {
    month: p.month, daysIntoMonth: o.daysIntoMonth, revenue, profit, cumulativeProfit: cumulative, netWorth: o.netWorth,
    cogsPct: r2(cogs / revenue), laborPct: r2(labor / revenue), rentPct: r2(p.rent / revenue),
    primeCostPct: r2((cogs + labor) / revenue), netMarginPct: r2(profit / revenue),
    fixedCostsMonth: fixed, variableCostPerUnit: variable, contributionPerUnit: contribution,
    breakEvenUnitsMonth: be, breakEvenRevenueMonth: be === null ? null : r2(be * p.price),
    breakEvenPrice: r2((fixed + p.units * CAFE.cogsPerUnit * (p.cogsMult ?? 1)) / (p.units * (1 - CAFE.cardFeeShare))),
    utilization: r2(p.units / CAFE.staffCapMonth(p.staff)), sizeUtilization: r2(p.units / CAFE.sizeCapMonth(p.seats)),
    lostSalesUnits: o.lostUnits, lostSalesMoney: r2(o.lostUnits * p.price),
    cashRunwayMonths: profit < 0 ? r2(o.cash / -profit) : null,
    setupInvested: o.setupSpent, paybackMonths: profit > 0 ? Math.round(o.setupSpent / profit) : null,
    taxDueNext: due ? { amount: due.amount, day: due.dueDay } : null,
    exposure: o.exposure, benchmarks: o.benchmarks,
    nicheKpis: [
      { id: 'avg_ticket', label: 'Average ticket', value: p.price, unit: '$' },
      { id: 'orders_per_seat_day', label: 'Orders per seat per day', value: r2(p.units / 30 / p.seats), unit: 'orders' },
      { id: 'takeaway_share', label: 'Takeaway share', value: 0.45, unit: '%' },
      { id: 'grade', label: 'Health grade points', value: 9, unit: 'points' },
    ],
  };
}

// ───────────── the healthy cafe: month 6, day 12 ─────────────
const BASE = {
  seats: 22, staff: 4, payroll: 10260, payrollTax: 1130, rent: 7800,
  utilities: 1050, insurance: 260, cleaning: 264, software: 150, marketing: 300, blockFund: 300,
};

export const HEALTHY_PLANS: MonthPlan[] = [
  { ...BASE, month: 1, units: 1050, price: 6.5, payroll: 3420, payrollTax: 380, marketing: 900, blockFund: 0, setup: 48600, quality: 0.62, reputation: 0.5, rank: 12 },
  { ...BASE, month: 2, units: 4480, price: 6.5, quality: 0.66, reputation: 0.55, rank: 9, lostSize: 40 },
  { ...BASE, month: 3, units: 5010, price: 6.5, quality: 0.69, reputation: 0.6, rank: 7, lostSize: 120, salesTaxPaid: 3010 },
  { ...BASE, month: 4, units: 5290, price: 6.5, saving: 940, quality: 0.7, reputation: 0.63, rank: 6, lostSize: 160, incomeTax: 300 },
  { ...BASE, month: 5, units: 5560, price: 6.5, saving: 940, fine: 300, quality: 0.68, reputation: 0.6, rank: 5, lostSize: 210, incomeTax: 420 },
  { ...BASE, month: 6, units: 5420, price: 6.5, saving: 940, cogsMult: 1.0, quality: 0.71, reputation: 0.66, rank: 4, lostSize: 180, incomeTax: 400 },
];

const START_CASH = 75000;
const ITEMS_VALUE_SHARE = 0.5 * 41000;  // 0.5 × resale-relevant equipment value, sample

function buildHistory(plans: MonthPlan[], start: number): MonthReport[] {
  const out: MonthReport[] = [];
  let cash = start;
  for (const p of plans) {
    const m = monthReport(p, cash, ITEMS_VALUE_SHARE);
    out.push(m);
    cash = m.cashEnd;
  }
  return out;
}

const RULE_CARD_IDS = { cash: 'off_books_payroll_rule', grade: 'letter_grade', salesTax: 'sales_tax_rule', permit: 'fse_permit_rule' };

export const RULE_CARDS: PackRuleCard[] = [
  { id: RULE_CARD_IDS.cash, title: 'Payroll taxes are not optional', text: 'Paying wages in cash off the books skips withholding and payroll taxes. The IRS can make the owner personally pay the unpaid withheld taxes (Trust Fund Recovery Penalty, 26 U.S.C. § 6672).', source: 'https://www.irs.gov/TFRP' },
  { id: RULE_CARD_IDS.grade, title: 'Letter grades', text: 'Every NYC food place is inspected by the Health Department. 0–13 violation points is an A, 14–27 a B, 28 or more a C. The grade card must be posted at the door.', source: 'https://www.nyc.gov/site/doh/business/food-operators/letter-grading-for-restaurants.page' },
  { id: RULE_CARD_IDS.salesTax, title: 'Register for sales tax first', text: 'New York requires a Certificate of Authority at least 20 days before you make taxable sales. Sales tax you collect belongs to the state: keep it apart from your cash.', source: 'https://www.tax.ny.gov/bus/doingbus/sell.htm' },
  { id: RULE_CARD_IDS.permit, title: 'No permit, no coffee', text: 'A cafe needs a Food Service Establishment Permit from the NYC Health Department ($280) before it serves anyone. Opening early is a violation.', source: 'https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit' },
];

const EVENTS: GameEvent[] = [
  { id: 'ev-fair', kind: 'demand', title: 'Street fair on Avenue A', text: 'Weekend street fair: more people walk past every shop on the block.', announcedDay: 136, startDay: 139, endDay: 140, effects: [{ target: 'footTraffic', mult: 1.2 }], origin: 'deck', block: 'Avenue A' },
  { id: 'ev-coffee', kind: 'supply', title: 'Coffee beans up 15%', text: 'Green coffee prices jumped: roasters raise wholesale prices from next week.', announcedDay: 160, startDay: 166, endDay: 225, effects: [{ target: 'cogs', mult: 1.15, niches: ['cafe'] }], origin: 'ai' },
];

const FEED: FeedItem[] = [
  { id: 'f1', day: 85, kind: 'inspection', text: 'Health inspection at Bean There: grade A, no fine', businessId: MY_BUSINESS_ID },
  { id: 'f2', day: 141, kind: 'inspection', text: 'Health inspection at Bean There: dirty surfaces, fine $300', businessId: MY_BUSINESS_ID },
  { id: 'f3', day: 150, kind: 'deal', text: 'Bean There and Fade Factory started a cross-promo', businessId: MY_BUSINESS_ID },
  { id: 'f4', day: 158, kind: 'opening', text: 'Kiln Coffee opened on East 7th Street' },
];

function ownerView(o: {
  day: number; phase: 'running' | 'ended'; plans: MonthPlan[]; current: MonthPlan | null; status: BusinessState['status'];
  myRank: number | null; exposure: number; trails: BusinessState['trails']; liabilities: BusinessState['liabilities'];
  benchmarks: Analytics['benchmarks']; shortcuts: string[]; seed: number; price: number; staffBarista: number; startCash?: number;
}): OwnerView {
  const history = buildHistory(o.plans, o.startCash ?? START_CASH);
  const last = history[history.length - 1];
  const date = dateOf(o.day);
  const into = o.phase === 'ended' ? 30 : date.dayOfMonth;
  const allPlans = o.current ? [...o.plans, o.current] : o.plans;
  const days = o.status === 'setup' ? [] : dayReports(allPlans, Math.max(1, o.day - 29), o.day, o.seed);
  const thisMonth = days.filter((d) => dateOf(d.day).month === date.month);
  const sumLost = (k: 'size' | 'staff' | 'closure') => thisMonth.reduce((s, d) => s + d.lost[k], 0);
  const mtdLines = o.current ? monthLines(o.current).map((l) => ({ ...l, amount: r2((l.amount * into) / 30) })) : [];
  const cash = r2((last?.cashEnd ?? o.startCash ?? START_CASH) + mtdLines.reduce((s, l) => s + l.amount, 0));
  const unpaid = o.liabilities.filter((l) => !l.paid).reduce((s, l) => s + l.amount, 0);
  const netWorth = r2(cash + ITEMS_VALUE_SHARE - unpaid);
  const cafe = nicheField('cafe', 18, 3, o.myRank, 52000, 11, [17]);
  const barber = nicheField('barbershop', 12, 2, null, 38000, 23, [12]);
  const humans = [...cafe.standings, ...barber.standings].filter((s) => !s.isAi).length;
  const lostUnits = days.reduce((s, d) => s + d.lost.size + d.lost.staff + d.lost.closure, 0);
  const business: BusinessState = {
    id: MY_BUSINESS_ID, name: 'Bean There', niche: 'cafe', placeId: 'place-ave-a-114', isAi: false,
    owners: [{ playerId: MY_PLAYER_ID, share: 1 }], managerPlayerId: MY_PLAYER_ID, status: o.status,
    createdDay: 3, openedDay: o.status === 'setup' ? undefined : 24, cash, size: 22,
    items: [{ id: 'espresso_machine', qty: 1 }, { id: 'grinder', qty: 2 }, { id: 'chair', qty: 22 }, { id: 'table', qty: 11 }, { id: 'pos', qty: 1 }],
    setupSpent: 48600, permits: [{ itemId: 'fse_permit', appliedDay: 3, readyDay: 24 }], quality: o.current?.quality ?? 0.6,
    reputation: o.current?.reputation ?? 0.5, trust: { kept: 2, broken: 0 },
    orders: { price: o.price, staff: { barista: o.staffBarista, shift_lead: 1 }, levers: { cleaning: 'standard' }, shortcuts: o.shortcuts, blockFund: true, autopilot: 'hold' },
    trails: o.trails, liabilities: o.liabilities,
    mtd: {
      lines: mtdLines, demandUnits: thisMonth.reduce((s, d) => s + d.demandUnits, 0),
      servedUnits: thisMonth.reduce((s, d) => s + d.servedUnits, 0),
      lost: { size: sumLost('size'), staff: sumLost('staff'), closure: sumLost('closure') },
    },
    days, history,
  };
  const analytics = o.current && o.status !== 'setup'
    ? analyticsFor({ plan: o.current, daysIntoMonth: into, history, cash, setupSpent: 48600, netWorth, liabilities: o.liabilities, exposure: o.exposure, lostUnits, benchmarks: o.benchmarks })
    : null;
  return {
    kind: 'owner',
    me: { id: MY_PLAYER_ID, name: 'Maya', kind: 'owner', isAi: false, paid: true, joinedDay: 2, lastSeenDay: o.day - 1, inbox: [] },
    world: worldPublic(o.day, o.phase, humans),
    business, stakes: [{ businessId: MY_BUSINESS_ID, share: 1 }],
    neighbors: [...cafe.neighbors, ...barber.neighbors], deals: [], notices: [], blockFund: null,
    weather: [{ day: o.day, tempF: 74, condition: 'clear', footTrafficMult: 1.05, label: 'Clear 74°F' }],
    events: EVENTS, feed: FEED, analytics, recommendations: [], roadmap: [],
    leaderboards: { cafe: cafe.standings, barbershop: barber.standings }, away: null,
  };
}

const HEALTHY_BENCHMARKS: Analytics['benchmarks'] = [
  { metric: 'cogsPct', you: 0.3, industry: 0.3, verdict: 'ok' },
  { metric: 'laborPct', you: 0.3, industry: 0.3, verdict: 'ok' },
  { metric: 'rentPct', you: 0.22, industry: 0.1, verdict: 'bad' },
  { metric: 'netMarginPct', you: 0.08, industry: 0.06, verdict: 'good' },
];

/** Healthy cafe in June (day 162): profitable, cutting one corner, tax due on Jun 20. */
export const cafeView: OwnerView = ownerView({
  day: 162, phase: 'running', plans: HEALTHY_PLANS.slice(0, 5), current: HEALTHY_PLANS[5], status: 'open', myRank: 4,
  exposure: 4230, shortcuts: ['cash_wages'], seed: 5, price: 6.5, staffBarista: 3,
  trails: [{ violationId: 'off_books_payroll', months: 3, saved: 2820, lastActiveMonth: 6, discovered: false }],
  liabilities: [
    { taxId: 'sales_tax', amount: 9172, dueDay: 170, paid: false },
    { taxId: 'income_tax_estimate', amount: 1120, dueDay: 195, paid: false },
  ],
  benchmarks: HEALTHY_BENCHMARKS,
});

// ───────────── the struggling cafe: cheap coffee, too many people ─────────────
// Cheap coffee, one person too many, a bit too much rent: loses about $4,600 a month, cash for about a month.
const STRUGGLE = { ...BASE, staff: 5, payroll: 11550, payrollTax: 1270, rent: 7100, blockFund: 0 };
export const STRUGGLING_PLANS: MonthPlan[] = [
  { ...STRUGGLE, month: 1, units: 1100, price: 5.6, payroll: 4100, payrollTax: 450, marketing: 900, setup: 41000, quality: 0.6, reputation: 0.5, rank: 14 },
  { ...STRUGGLE, month: 2, units: 4700, price: 5.6, quality: 0.62, reputation: 0.52, rank: 13 },
  { ...STRUGGLE, month: 3, units: 4800, price: 5.6, quality: 0.63, reputation: 0.55, rank: 13, salesTaxPaid: 4800 },
  { ...STRUGGLE, month: 4, units: 4850, price: 5.6, quality: 0.63, reputation: 0.56, rank: 14 },
  { ...STRUGGLE, month: 5, units: 4900, price: 5.6, quality: 0.64, reputation: 0.57, rank: 15 },
];
export const cafeStrugglingView: OwnerView = ownerView({
  day: 138, phase: 'running', plans: STRUGGLING_PLANS.slice(0, 4), current: STRUGGLING_PLANS[4], status: 'open', myRank: 15,
  exposure: 0, shortcuts: [], seed: 9, price: 5.6, staffBarista: 4, trails: [],
  startCash: 71500,
  liabilities: [{ taxId: 'sales_tax', amount: 7310, dueDay: 140, paid: false }],
  benchmarks: [
    { metric: 'cogsPct', you: 0.38, industry: 0.3, verdict: 'bad' },
    { metric: 'laborPct', you: 0.38, industry: 0.3, verdict: 'bad' },
    { metric: 'rentPct', you: 0.31, industry: 0.1, verdict: 'bad' },
    { metric: 'netMarginPct', you: -0.09, industry: 0.06, verdict: 'bad' },
  ],
});

/** Still waiting for permits: no analytics yet. */
export const cafeSetupView: OwnerView = ownerView({
  day: 14, phase: 'running', plans: [], current: null, status: 'setup', myRank: 18, exposure: 0, shortcuts: [], seed: 3,
  price: 6.5, staffBarista: 3, trails: [], liabilities: [], benchmarks: [],
});

// ───────────── the season is over ─────────────
const ENDED_PLANS: MonthPlan[] = [
  ...HEALTHY_PLANS.slice(0, 5),
  { ...HEALTHY_PLANS[5], cogsMult: 1.15, fine: 0, salesTaxPaid: 9172 },
  { ...BASE, month: 7, units: 5600, price: 6.75, saving: 940, cogsMult: 1.15, quality: 0.72, reputation: 0.68, rank: 3, lostSize: 150, incomeTax: 450 },
  { ...BASE, month: 8, units: 5750, price: 6.75, cogsMult: 1.0, quality: 0.74, reputation: 0.7, rank: 3, lostSize: 160, incomeTax: 520, fine: 4230 },
  { ...BASE, month: 9, units: 5900, price: 6.75, quality: 0.75, reputation: 0.66, rank: 3, lostSize: 120, incomeTax: 560, salesTaxPaid: 10480 },
  { ...BASE, month: 10, units: 6050, price: 6.75, seats: 26, cleaning: 312, quality: 0.76, reputation: 0.7, rank: 2, incomeTax: 610 },
  { ...BASE, month: 11, units: 6180, price: 6.75, seats: 26, cleaning: 312, quality: 0.77, reputation: 0.72, rank: 2, incomeTax: 640 },
  { ...BASE, month: 12, units: 6400, price: 6.75, seats: 26, cleaning: 312, quality: 0.78, reputation: 0.74, rank: 2, incomeTax: 690, salesTaxPaid: 11120 },
];

const endedBase = ownerView({
  day: 360, phase: 'ended', plans: ENDED_PLANS, current: null, status: 'open', myRank: 2, exposure: 0, shortcuts: [], seed: 13,
  price: 6.75, staffBarista: 3, trails: [{ violationId: 'off_books_payroll', months: 5, saved: 4700, lastActiveMonth: 7, discovered: true }],
  liabilities: [], benchmarks: HEALTHY_BENCHMARKS,
});

/** Final payouts as `finalizeSeason` would write them; OwnerView has no such field yet, so it rides in `extra`. */
function finalPayouts(v: OwnerView): Payout[] {
  const pool = v.world.bank * v.world.config.prizeShare;
  const out: Payout[] = [];
  const boards = v.leaderboards;
  const humans = (n: string) => (boards[n as 'cafe'] ?? []).filter((s) => !s.isAi);
  const total = humans('cafe').length + humans('barbershop').length;
  for (const niche of ['cafe', 'barbershop'] as const) {
    const eligible = humans(niche).filter((s) => !s.bankrupt).sort((a, b) => a.rank - b.rank);
    const nichePool = (pool * humans(niche).length) / total;
    eligible.slice(0, 3).forEach((s, i) => {
      const owner = s.businessId === MY_BUSINESS_ID ? MY_PLAYER_ID : `owner-${s.businessId}`;
      out.push({ playerId: owner, kind: 'owner', amount: r2(nichePool * v.world.config.nichePrizeTable[i]), niche, rank: s.rank });
    });
  }
  out.push({ playerId: 'official-rivera', kind: 'official', amount: r2(v.world.bank * v.world.config.officialsShare), rank: 1 });
  out.push({ playerId: 'platform', kind: 'platform', amount: r2(v.world.bank * v.world.config.platformShare) });
  return out;
}

export const OFFICIALS_RANKING = [
  { name: 'Inspector Rivera', points: 140, isAi: false },
  { name: 'Auditor Okafor', points: 95, isAi: false },
  { name: 'City inspector (AI)', points: 80, isAi: true },
  { name: 'Inspector Walsh', points: 35, isAi: false },
  { name: 'Tax auditor (AI)', points: 20, isAi: true },
  { name: 'Auditor Brandt', points: -5, isAi: false },
];

export type ViewWithExtra = OwnerView & { extra?: { payouts?: Payout[]; officialsRanking?: typeof OFFICIALS_RANKING } };

export const cafeEndedView: ViewWithExtra = { ...endedBase, extra: { payouts: finalPayouts(endedBase), officialsRanking: OFFICIALS_RANKING } };
(cafeView as ViewWithExtra).extra = { officialsRanking: OFFICIALS_RANKING };

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

export const PLAN: RealWorldPlan = {
  niche: 'cafe', businessName: 'Bean There',
  startupBudget: [
    { label: 'Build-out and plumbing (sample)', amount: 9000 },
    { label: 'Espresso machine and grinders (sample)', amount: 11500 },
    { label: 'Furniture for 22 seats (sample)', amount: 4400 },
    { label: 'Refrigeration and small equipment (sample)', amount: 5195 },
    { label: 'Security deposit: two months of rent', amount: 15600 },
    { label: 'Permits, LLC and registration', amount: 505 },
    { label: 'Opening stock', amount: 2400 },
  ],
  startupTotal: 48600,
  monthlyCosts: [
    { label: 'Rent', amount: 7800 }, { label: 'Wages for 4 people', amount: 10260 }, { label: 'Payroll taxes', amount: 1130 },
    { label: 'Electricity and gas', amount: 1050 }, { label: 'Insurance', amount: 260 }, { label: 'Cleaning', amount: 264 },
    { label: 'POS and software', amount: 150 }, { label: 'Marketing', amount: 300 },
  ],
  monthlyTotal: 21214,
  reserveAdvised: 127284,
  breakEvenUnitsMonth: 4703, paybackMonths: 15,
  checklist: CHECKLIST, suppliers: SUPPLIERS,
  lessons: [
    { title: 'Rent above the norm', amount: 46200, lesson: 'Rent took 22% of your sales; cafes that last keep it near 10%. Over the season that is about $46,200 more than the norm. Negotiate, or pick a space with more walk-by traffic for the same rent.' },
    { title: 'Customers you turned away', amount: 7530, lesson: 'Saturdays had a queue for eight months: 1,140 people left without buying. Add seats or a takeaway window before the busy season.' },
    { title: 'Cash wages caught by the tax auditor', amount: 4230, lesson: 'You saved $4,700 on payroll taxes and paid $4,230 in fines on top of the taxes you owed. Run payroll through a provider from day one.', ruleCardId: RULE_CARD_IDS.cash },
  ],
  disclaimer: 'This plan comes from a learning simulation. It is not legal, tax or financial advice. Check every fee and rule with the agency before you act.',
};

export const DEBRIEF: Debrief = {
  headline: 'Second of 18 coffee shops: a real business with two expensive habits.',
  lostMoneyOn: PLAN.lessons.map((l) => ({ ...l })),
  didWell: ['Raised the price to $6.75 when beans went up and kept every regular', 'Added 4 seats in October: Saturday queues dropped by 80%', 'Kept a cross-promo with Fade Factory for 7 months'],
  nextTime: ['Register payroll before the first hire', 'Open with 26 seats, not 22', 'Negotiate rent below 15% of expected sales before you sign'],
  origin: 'rules',
};

export function advisorAnswer(question: string): AdvisorAnswer {
  const q = question.toLowerCase();
  if (q.includes('supplier'))
    return { answer: 'Start with three local roasters that sell wholesale: ask each for a tasting, a price per pound for 20 lb a week, and whether they train your baristas. Dairy usually comes from a regional distributor on a set delivery schedule.', sources: [{ title: 'NYC Business: Food Service Establishment Permit', url: 'https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit' }], origin: 'rules' };
  if (q.includes('cash'))
    return { answer: 'You save about $940 a month. If the tax auditor finds it, the fine is about 1.5× what you saved: $4,230 today, and it grows every month. The IRS can also make you personally pay the unpaid withheld taxes.', sources: [{ title: 'IRS: Trust Fund Recovery Penalty', url: 'https://www.irs.gov/TFRP' }], origin: 'rules' };
  if (q.includes('lose') || q.includes('lost'))
    return { answer: 'Yesterday 31 people walked away because all 22 seats were taken at the lunch peak. Two more seats would have served most of them: about $200 a day on Saturdays.', sources: [], origin: 'ai' };
  return { answer: 'At your current pace you clear break-even by about 700 orders a month. The biggest lever is rent: it is 22% of sales against a 10% norm.', sources: [], origin: 'rules' };
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
