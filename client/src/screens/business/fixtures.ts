// Sample OwnerView data for /dev/biz and tests. Plausible numbers for a small Brooklyn coffee shop;
// they only drive the screen. Inside each sample the books add up: sum of month lines = cash change.
import type {
  Analytics, BusinessState, CaseNotice, DayReport, DayWeather, Deal, GameEvent, InboxItem, MonthReport,
  OwnerView, PnlLine, PublicBusiness, Recommendation, RoadmapItem, Standing, WeatherCondition, WorldConfig,
} from '../../../../shared/src/types';
import { dateOf, RULES } from '../../../../shared/src/rules';

export type FixtureName = 'setup' | 'open' | 'away' | 'notice' | 'closed' | 'bankrupt' | 'none';

const ME = 'p_me';
const BIZ = 'biz_me';
const PRICE = 6.5;
const COGS = 1.9;
const SALES_TAX = 0.08875;
const SEAT_CAP = 164;   // orders/day the room serves at 18 seats (fixture)
const STAFF_CAP = 240;  // orders/day 4 workers serve (fixture)

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const r = Math.round;

const config: WorldConfig = {
  id: 'demo', name: 'Demo Williamsburg', city: 'nyc', seasonMonths: 12, dayMs: RULES.DAY_MS_DEMO, paused: false,
  maxOwners: 100, aiBusinessesTarget: 40, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05,
  nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 7,
};

const CONDITIONS: { c: WeatherCondition; t: number; m: number; label: string }[] = [
  { c: 'clear', t: 61, m: 1.05, label: 'Sunny' },
  { c: 'cloudy', t: 57, m: 1, label: 'Cloudy' },
  { c: 'rain', t: 52, m: 0.82, label: 'Rain' },
  { c: 'clear', t: 64, m: 1.08, label: 'Sunny and mild' },
  { c: 'cloudy', t: 55, m: 0.97, label: 'Overcast' },
  { c: 'rain', t: 50, m: 0.8, label: 'Showers' },
  { c: 'clear', t: 59, m: 1.03, label: 'Clear' },
];

export function weatherFrom(day: number, days = RULES.FORECAST_DAYS + 1): DayWeather[] {
  return Array.from({ length: days }, (_, i) => {
    const w = CONDITIONS[(day + i) % CONDITIONS.length];
    return { day: day + i, tempF: w.t, condition: w.c, footTrafficMult: w.m, label: w.label };
  });
}

const WEEKDAY = [0.9, 0.9, 0.95, 1, 1.1, 1.25, 1.15];

function dayReport(day: number, opts: { closed?: boolean; base?: number } = {}): DayReport {
  const w = weatherFrom(day, 1)[0];
  const demand = r((opts.base ?? 190) * WEEKDAY[dateOf(day).weekday] * w.footTrafficMult);
  if (opts.closed) {
    return {
      day, demandUnits: demand, servedUnits: 0, lost: { size: 0, staff: 0, closure: demand }, revenue: 0, variableCosts: 0,
      sizeUtilization: 0, weather: w.condition, notes: ['Closed by the Health Department. Every customer was turned away.'],
    };
  }
  const served = Math.min(demand, SEAT_CAP, STAFF_CAP);
  const lostSize = demand - served;
  const notes: string[] = [];
  if (lostSize >= 30) notes.push('Queue out the door from 8 to 10am.');
  if (w.condition === 'rain') notes.push('Rain kept people indoors: fewer walk-ins.');
  return {
    day, demandUnits: demand, servedUnits: served, lost: { size: lostSize, staff: 0, closure: 0 },
    revenue: r(served * PRICE * 100) / 100, variableCosts: r(served * COGS * 100) / 100,
    sizeUtilization: Math.min(1, r((served / SEAT_CAP) * 100) / 100), weather: w.condition, notes,
  };
}

export function daysRange(from: number, to: number, closedDays: number[] = [], base?: number): DayReport[] {
  const out: DayReport[] = [];
  for (let d = Math.max(1, from); d <= to; d++) out.push(dayReport(d, { closed: closedDays.includes(d), base }));
  return out;
}

const line = (id: string, label: string, kind: PnlLine['kind'], amount: number): PnlLine => ({ id, label, kind, amount: r(amount * 100) / 100 });

/** Standard month-close lines of the sample cafe; amounts are fixture values. */
function closeLines(opts: { cashWages: boolean; payroll?: number }): PnlLine[] {
  const payroll = opts.payroll ?? 10500;
  const lines = [
    line('payroll', 'Wages', 'payroll', -payroll),
    line('fica_employer', 'Social Security and Medicare (employer)', 'payroll_tax', -payroll * 0.0765),
    line('payroll_other', 'Unemployment and disability insurance', 'payroll_tax', -payroll * 0.035),
    line('rent', 'Rent', 'rent', -6500),
    line('utilities', 'Electricity and gas', 'opex', -900),
    line('insurance', 'General liability insurance', 'opex', -250),
    line('lever_cleaning', 'Cleaning: Daily deep clean', 'opex', -900),
    line('lever_beans', 'Coffee beans: Local roaster', 'opex', -300),
    line('lever_hours', 'Opening hours: 7am–7pm', 'opex', -200),
  ];
  if (opts.cashWages) lines.push(line('shortcut_cash_wages', 'Not paid: payroll taxes (cash wages)', 'saving', payroll * 0.18));
  return lines;
}

function salesLines(month: number, revenue: number): PnlLine[] {
  return [
    line(`revenue_m${month}`, 'Sales', 'revenue', revenue),
    line(`cogs_m${month}`, 'Coffee, milk and pastries', 'cogs', -revenue * (COGS / PRICE)),
    line(`sales_tax_m${month}`, 'Sales tax collected (owed to NY State)', 'tax', revenue * SALES_TAX),
  ];
}

function monthReport(month: number, cashStart: number, lines: PnlLine[], extra: Partial<MonthReport> = {}): MonthReport {
  const revenue = sum(lines.filter((l) => l.kind === 'revenue').map((l) => l.amount));
  const total = sum(lines.map((l) => l.amount));
  const collected = sum(lines.filter((l) => l.id.startsWith('sales_tax')).map((l) => l.amount));
  const served = r(revenue / PRICE);
  return {
    month, avgPrice: PRICE, demandUnits: r(served * 1.22), servedUnits: served,
    lost: { size: r(served * 0.22), staff: 0, closure: 0 }, capacityUnits: SEAT_CAP * 30, sizeUtilization: 0.94,
    lines, revenue: r(revenue), profit: r(total - collected - sum(lines.filter((l) => l.kind === 'setup').map((l) => l.amount))),
    cashStart: r(cashStart * 100) / 100, cashEnd: r((cashStart + total) * 100) / 100,
    taxesAccrued: r(collected), taxesPaid: 0, fines: -sum(lines.filter((l) => l.kind === 'fine').map((l) => l.amount)),
    quality: 0.7, reputation: 0.62, netWorth: r(cashStart + total), rankInNiche: 5,
    ...extra,
  };
}

function history(): MonthReport[] {
  const m1Lines = [
    line('setup', 'Build-out, equipment and furniture', 'setup', -38400),
    ...salesLines(1, 5460),
    ...closeLines({ cashWages: false, payroll: 6100 }),
  ];
  const m1 = monthReport(1, 60000, m1Lines, { rankInNiche: 14 });
  const m2 = monthReport(2, m1.cashEnd, [...salesLines(2, 27300), ...closeLines({ cashWages: true })], { rankInNiche: 8 });
  const m3 = monthReport(3, m2.cashEnd, [...salesLines(3, 31200), ...closeLines({ cashWages: true })], { rankInNiche: 5 });
  return [m1, m2, m3];
}

function mtdFrom(days: DayReport[], month: number) {
  const inMonth = days.filter((d) => dateOf(d.day).month === month);
  const revenue = sum(inMonth.map((d) => d.revenue));
  const lines: PnlLine[] = inMonth.length
    ? [
      line('revenue_mtd', 'Sales', 'revenue', revenue),
      line('cogs_mtd', 'Coffee, milk and pastries', 'cogs', -sum(inMonth.map((d) => d.variableCosts))),
      line('sales_tax_mtd', 'Sales tax collected (owed to NY State)', 'tax', revenue * SALES_TAX),
    ]
    : [];
  return {
    lines,
    demandUnits: sum(inMonth.map((d) => d.demandUnits)),
    servedUnits: sum(inMonth.map((d) => d.servedUnits)),
    lost: {
      size: sum(inMonth.map((d) => d.lost.size)),
      staff: sum(inMonth.map((d) => d.lost.staff)),
      closure: sum(inMonth.map((d) => d.lost.closure)),
    },
  };
}

function business(day: number, closedDays: number[] = []): BusinessState {
  const hist = history();
  const days = daysRange(day - 29, day, closedDays);
  const mtd = mtdFrom(days, dateOf(day).month);
  const cash = r((hist[hist.length - 1].cashEnd + sum(mtd.lines.map((l) => l.amount))) * 100) / 100;
  const salesTaxOwed = r(sum(hist.flatMap((m) => m.lines).filter((l) => l.id.startsWith('sales_tax')).map((l) => l.amount)));
  return {
    id: BIZ, name: 'Bean There', niche: 'cafe', placeId: 'bedford_212', isAi: false,
    owners: [{ playerId: ME, share: 1 }], managerPlayerId: ME,
    status: 'open', createdDay: 2, openedDay: 24,
    cash, size: 18,
    items: [{ id: 'espresso_machine', qty: 1 }, { id: 'grinder', qty: 1 }, { id: 'chair', qty: 18 }, { id: 'table_share', qty: 18 }],
    setupSpent: 38400, permits: [{ itemId: 'fse_permit', appliedDay: 2, readyDay: 23 }],
    quality: 0.72, reputation: 0.64, trust: { kept: 2, broken: 0 },
    orders: {
      price: PRICE, staff: { barista: 3, shift_lead: 1 }, levers: { cleaning: 'full', beans: 'standard', hours: 'standard' },
      shortcuts: ['cash_wages'], blockFund: false, autopilot: 'hold',
    },
    trails: [{ violationId: 'off_books_payroll', months: 2, saved: 3780, lastActiveMonth: 3, discovered: false }],
    liabilities: [
      { taxId: 'sales_tax', amount: salesTaxOwed, dueDay: 110, paid: false },
      { taxId: 'fica_employer', amount: 803, dueDay: 105, paid: false },
    ],
    mtd, days, history: hist,
  };
}

const neighbors: PublicBusiness[] = [
  { id: 'biz_n1', name: 'Northside Coffee', ownerName: 'Devon', isAi: false, niche: 'cafe', placeId: 'bedford_180', status: 'open', price: 6.8, reputation: 0.7, rankInNiche: 2, trust: { kept: 3, broken: 0 }, grade: 'A', partners: [] },
  { id: 'biz_ai1', name: 'Gristle & Grind', ownerName: 'AI', isAi: true, niche: 'cafe', placeId: 'n6th_88', status: 'open', price: 6.2, reputation: 0.58, rankInNiche: 6, trust: { kept: 1, broken: 0 }, grade: 'A', partners: [] },
  { id: 'biz_ai2', name: 'Kettle & Key', ownerName: 'AI', isAi: true, niche: 'cafe', placeId: 'berry_140', status: 'open', price: 5.9, reputation: 0.51, rankInNiche: 9, trust: { kept: 0, broken: 1 }, grade: 'B', partners: [] },
  { id: 'biz_n2', name: 'Fade Street Barbers', ownerName: 'Luis', isAi: false, niche: 'barbershop', placeId: 'bedford_230', status: 'open', price: 38, reputation: 0.66, rankInNiche: 3, trust: { kept: 2, broken: 0 }, partners: [] },
  { id: 'biz_ai3', name: 'Bedford Deli & Grocery', ownerName: 'AI', isAi: true, niche: 'bodega', placeId: 'bedford_201', status: 'open', price: 9, reputation: 0.6, rankInNiche: 4, trust: { kept: 0, broken: 0 }, partners: [] },
];

function cafeStandings(myRank: number, myNet: number, total = 23): Standing[] {
  return Array.from({ length: total }, (_, i) => {
    const rank = i + 1;
    if (rank === myRank) return { businessId: BIZ, niche: 'cafe', rank, netWorth: r(myNet), isAi: false, bankrupt: false };
    return { businessId: `biz_c${rank}`, niche: 'cafe', rank, netWorth: r(90000 - rank * 3100), isAi: rank % 3 !== 1, bankrupt: rank > total - 2 };
  });
}

function events(day: number): GameEvent[] {
  return [
    {
      id: 'ev_fair', kind: 'city', title: 'Bedford Ave street fair', text: 'The avenue closes to cars on Sunday. Expect crowds from noon.',
      announcedDay: day - 3, startDay: day + 1, endDay: day + 1, effects: [{ target: 'footTraffic', mult: 1.3 }], origin: 'ai', block: 'Bedford Ave',
    },
    {
      id: 'ev_beans', kind: 'supply', title: 'Coffee beans up 15%', text: 'Arabica prices jumped after a poor harvest. Roasters pass it on next week.',
      announcedDay: day - 2, startDay: day + 3, endDay: day + 62, effects: [{ target: 'cogs', mult: 1.15, niches: ['cafe'] }], origin: 'deck',
    },
    {
      id: 'ev_ltrain', kind: 'traffic', title: 'L train weekend shutdown', text: 'No L trains between Manhattan and Bedford Av next weekend.',
      announcedDay: day - 1, startDay: day + 6, endDay: day + 7, effects: [{ target: 'footTraffic', mult: 0.85 }], origin: 'ai',
    },
  ];
}

function analytics(b: BusinessState, day: number): Analytics {
  const d = dateOf(day);
  return {
    month: d.month, daysIntoMonth: d.dayOfMonth,
    revenue: 31980, profit: 2310, cumulativeProfit: -12450, netWorth: r(b.cash + 0.5 * 12000),
    cogsPct: 0.29, laborPct: 0.36, rentPct: 0.2, primeCostPct: 0.65, netMarginPct: 0.072,
    fixedCostsMonth: 20050, variableCostPerUnit: COGS, contributionPerUnit: PRICE - COGS,
    breakEvenUnitsMonth: 4359, breakEvenRevenueMonth: 28333, breakEvenPrice: 5.98,
    utilization: 0.68, sizeUtilization: 0.97, lostSalesUnits: 1230, lostSalesMoney: 7995,
    cashRunwayMonths: null, setupInvested: 38400, paybackMonths: 16.6,
    taxDueNext: { amount: 803, day: 105 }, exposure: 5670,
    benchmarks: [
      { metric: 'Cost of goods', you: 0.29, industry: 0.3, verdict: 'good' },
      { metric: 'Labor', you: 0.36, industry: 0.3, verdict: 'bad' },
      { metric: 'Rent', you: 0.2, industry: 0.08, verdict: 'bad' },
    ],
    nicheKpis: [{ id: 'seat_turns', label: 'Seat turns per day', value: 9.1, unit: 'x' }],
  };
}

function recommendations(): Recommendation[] {
  return [
    {
      id: 'rec_cash_wages', severity: 'critical', title: 'Stop paying wages in cash',
      text: 'You have skipped $3,780 of payroll taxes. If an auditor finds it, you pay it back plus a fine of 1.5× that.',
      suggested: { type: 'set_orders', orders: { shortcuts: [] } }, impact: { profitDeltaMonth: -1890 }, ruleCardId: 'off_books_payroll',
    },
    {
      id: 'rec_seats', severity: 'warn', title: 'Add 4 seats',
      text: '41 customers a day walk away at peak hours because every seat is taken.',
      suggested: { type: 'resize', size: 22 }, impact: { profitDeltaMonth: 1850 },
    },
    {
      id: 'rec_price', severity: 'info', title: 'Raise your price to $6.90',
      text: 'Your room is full and nearby cafes charge $6.30 on average.',
      suggested: { type: 'set_orders', orders: { price: 6.9 } }, impact: { profitDeltaMonth: 640 },
    },
    {
      id: 'rec_hours', severity: 'info', title: 'Stay open until 10pm',
      text: 'Evenings on Bedford Ave are busy and your room is empty after 7pm.',
      suggested: { type: 'set_orders', orders: { levers: { cleaning: 'full', beans: 'standard', hours: 'long' } } }, impact: { profitDeltaMonth: 380 },
    },
  ];
}

const doneRoadmap: RoadmapItem[] = [
  { id: 'llc', title: 'Form an LLC', text: 'File Articles of Organization with NY State.', kind: 'legal', status: 'done' },
  { id: 'get_fse_permit', title: 'Get your Food Service Establishment Permit', text: 'An inspector visits before you open.', kind: 'permit', setupItemId: 'fse_permit', waitDays: 21, agency: 'NYC DOHMH', status: 'done' },
];

function player(day: number, inbox: InboxItem[] = []) {
  return { id: ME, name: 'Maya', kind: 'owner' as const, isAi: false, paid: true, joinedDay: 2, lastSeenDay: day, inbox };
}

function world(day: number, stats?: Partial<OwnerView['world']['stats']>): OwnerView['world'] {
  return {
    config, phase: 'running', day, date: dateOf(day), version: 1000 + day, bank: 500, msToNextDay: 1200,
    stats: { owners: 100, aiBusinesses: 38, officials: 6, open: 121, bankrupt: 4, ...stats },
  };
}

function baseOpen(day = 97): OwnerView {
  const b = business(day);
  return {
    kind: 'owner', me: player(day), world: world(day), business: b, stakes: [],
    neighbors, deals: [], notices: [], blockFund: { block: 'Bedford Ave', month: dateOf(day).month, contributors: 3, eligible: 7, active: false, feeMonth: RULES.BLOCK_FUND_FEE_MONTH },
    weather: weatherFrom(day), events: events(day),
    feed: [
      { id: 'f1', day: day - 1, kind: 'inspection', text: 'Kettle & Key got a B after a health inspection.', businessId: 'biz_ai2' },
      { id: 'f2', day: day - 2, kind: 'opening', text: 'A new bodega opened on Berry St.' },
    ],
    analytics: analytics(b, day), recommendations: recommendations(), roadmap: doneRoadmap,
    leaderboards: { cafe: cafeStandings(4, b.cash + 6000) }, away: null,
  };
}

const offer: Deal = {
  id: 'deal_7', fromBusinessId: 'biz_n2', toBusinessId: BIZ, terms: { type: 'cross_promo', months: 3 },
  status: 'proposed', proposedDay: 96, expiresDay: 96 + RULES.DEAL_OFFER_DAYS,
};

function awayView(): OwnerView {
  const v = baseOpen(97);
  const items: InboxItem[] = [
    { id: 'in_sum', day: 97, kind: 'summary', title: '6 days while you were away', text: 'You served 1,010 orders and made $3,240 after costs.', read: false },
    { id: 'in_case', day: 94, kind: 'case', title: 'Health inspection: grade A', text: 'An inspector visited on Wednesday. 9 points, grade A. Nothing to pay.', ref: { type: 'case', id: 'case_12' }, read: false },
    { id: 'in_deal', day: 96, kind: 'deal', title: 'Fade Street Barbers offers a cross-promo', text: 'They send their clients to you and you send yours, for 3 months.', ref: { type: 'deal', id: 'deal_7' }, read: false },
    { id: 'in_event', day: 95, kind: 'event', title: 'Coffee beans up 15% from Apr 10', text: 'Announced: your cost per order rises next week.', read: false },
  ];
  return { ...v, me: player(97, items), deals: [offer], away: { days: 6, profit: 3240, items } };
}

const pendingNotice: CaseNotice = {
  caseId: 'case_17', role: 'inspector',
  found: [
    { violationId: 'dirty_surfaces', months: 2, fine: 500, closureDays: 0 },
    { violationId: 'no_pest_control', months: 1, fine: 700, closureDays: 2 },
  ],
  fine: 1200, closureDays: 2, answerByDay: 99, status: 'notice',
};

function noticeView(): OwnerView {
  const v = baseOpen(97);
  return { ...v, notices: [pendingNotice] };
}

function closedView(): OwnerView {
  const day = 97;
  const b = business(day, [96, 97]);
  const v = baseOpen(day);
  const closed: BusinessState = { ...b, status: 'closed', closedUntilDay: 99 };
  return {
    ...v, business: closed,
    notices: [{ ...pendingNotice, status: 'closed', outcome: 'fined', answerByDay: 95 }],
    recommendations: [
      { id: 'rec_clean', severity: 'warn', title: 'Book a deep clean before you reopen', text: 'Inspectors come back after a closure. A deep clean clears sanitation trails.', suggested: { type: 'spend', kind: 'deep_clean' } },
    ],
  };
}

function setupView(): OwnerView {
  const day = 97;
  const v = baseOpen(day);
  const setupLines: PnlLine[] = [line('setup', 'Build-out, equipment and furniture', 'setup', -38400)];
  const b: BusinessState = {
    ...business(day), status: 'setup', createdDay: 90, openedDay: undefined, cash: 21600,
    permits: [{ itemId: 'fse_permit', appliedDay: 90, readyDay: 111 }],
    trails: [], liabilities: [], days: [], history: [],
    mtd: { lines: setupLines, demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } },
    orders: { price: PRICE, staff: { barista: 2, shift_lead: 1 }, levers: { cleaning: 'standard', beans: 'standard', hours: 'standard' }, shortcuts: [], blockFund: false, autopilot: 'hold' },
  };
  return {
    ...v, business: b, analytics: null,
    roadmap: [
      { id: 'llc', title: 'Form an LLC', text: 'File Articles of Organization with NY State.', kind: 'legal', status: 'done' },
      { id: 'lease', title: 'Sign the lease', text: '212 Bedford Ave, 1,100 sq ft.', kind: 'space', status: 'done' },
      { id: 'buildout', title: 'Build out and equip', text: 'Standard kit: 18 seats, espresso machine, grinder.', kind: 'money', status: 'done' },
      { id: 'get_fse_permit', title: 'Get your Food Service Establishment Permit', text: 'An inspector visits before you open.', kind: 'permit', setupItemId: 'fse_permit', waitDays: 21, agency: 'NYC DOHMH', status: 'waiting', readyDay: 111 },
      { id: 'hire', title: 'Hire your first staff', text: '2 baristas and a shift lead.', kind: 'people', status: 'todo' },
      { id: 'open', title: 'Open the doors', text: 'Once the permit is in.', kind: 'launch', status: 'todo' },
    ],
    recommendations: [
      { id: 'rec_wait', severity: 'info', title: 'Wait for your permit: ready Apr 21', text: 'Opening earlier is operating without a permit. Rent is already running: $6,500 a month.' },
    ],
    leaderboards: { cafe: cafeStandings(17, 21600) },
  };
}

function bankruptView(): OwnerView {
  const day = 121;
  const v = baseOpen(day);
  const hist = history();
  const m4Lines = [
    ...salesLines(4, 14200),
    ...closeLines({ cashWages: true }),
    line('fine_case_21', 'Fine: unreported cash payroll', 'fine', -9450),
    line('sales_tax_paid', 'Sales tax paid for Q1', 'tax', -5677),
    line('lever_ads', 'Ad campaign', 'opex', -4000),
  ];
  const m4 = monthReport(4, hist[2].cashEnd, m4Lines, { rankInNiche: 21 });
  const b: BusinessState = {
    ...business(day), status: 'bankrupt', bankruptDay: 120, cash: m4.cashEnd, history: [...hist, m4],
    days: daysRange(day - 29, day - 1, [], 120), liabilities: [], trails: [{ violationId: 'off_books_payroll', months: 3, saved: 5670, lastActiveMonth: 4, discovered: true }],
    mtd: { lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } },
  };
  return { ...v, business: b, recommendations: [], analytics: null, leaderboards: { cafe: cafeStandings(21, m4.cashEnd) } };
}

function noneView(): OwnerView {
  const v = baseOpen(97);
  return { ...v, business: null, analytics: null, recommendations: [], roadmap: [], leaderboards: { cafe: cafeStandings(30, 0, 23).slice(0, 23) } };
}

export function fixture(name: FixtureName): OwnerView {
  switch (name) {
    case 'setup': return setupView();
    case 'open': return baseOpen();
    case 'away': return awayView();
    case 'notice': return noticeView();
    case 'closed': return closedView();
    case 'bankrupt': return bankruptView();
    case 'none': return noneView();
  }
}

export const FIXTURE_NAMES: FixtureName[] = ['open', 'away', 'notice', 'setup', 'closed', 'bankrupt', 'none'];
