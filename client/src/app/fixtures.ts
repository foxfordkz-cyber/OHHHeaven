// Example data for /dev screens and the offline stub. Plausible East Village numbers for a coffee shop.
// Places, packs and businesses here are placeholders: the real ones come from data/places.json (agent 09)
// and packs/*.json (agents 14–16). Every number that is not from a cited source is marked "estimate".
import type {
  Analytics, BusinessState, CaseCard, CityView, ClientView, CommonPack, DayReport, DayWeather, Deal, FeedItem, GameEvent,
  IdeaMatch, InboxItem, MonthReport, NicheId, OfficialView, OpenRecommendation, OwnerView, Pack, PackSet, Place, Player,
  PublicBusiness, Recommendation, RoadmapItem, Standing, StandingOrders, WorldConfig, WorldPublic,
} from '@ohh/shared/types';
import { RULES, dateOf } from '@ohh/shared/rules';

export const FIXTURE_DAY = 74;

export const demoConfig: WorldConfig = {
  id: 'demo', name: 'Demo City', city: 'nyc', seasonMonths: 12, dayMs: RULES.DAY_MS_DEMO, paused: false,
  maxOwners: 100, aiBusinessesTarget: 24, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05,
  nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 7,
};

// ───────────────────────── places (fixture; real list: data/places.json) ─────────────────────────

const P = (id: string, address: string, block: string, lat: number, lng: number, sqft: number, tier: Place['tier'], rentPerSqftYear: number, footTraffic: number, suitableFor: NicheId[]): Place =>
  ({ id, address, block, lat, lng, kind: 'storefront', sqft, tier, rentPerSqftYear, footTraffic, suitableFor, sourceDataset: 'fixture', note: 'fixture — replaced by data/places.json (agent 09); rent is an estimate' });

export const fixturePlaces: Place[] = [
  P('p01', '114 Avenue A', 'Avenue A, 7th–8th St', 40.7262, -73.9832, 900, 'prime', 120, 0.82, ['cafe', 'barbershop', 'bodega']),
  P('p02', '137 Avenue A', 'Avenue A, 8th–9th St', 40.7272, -73.9826, 750, 'mid', 95, 0.74, ['cafe', 'barbershop']),
  P('p03', '33 E 7th St', 'E 7th St, 2nd–3rd Ave', 40.7279, -73.9887, 650, 'mid', 88, 0.66, ['cafe', 'barbershop', 'bodega']),
  P('p04', '96 E 7th St', 'E 7th St, 1st Ave–Ave A', 40.7262, -73.9846, 560, 'cheap', 70, 0.58, ['cafe', 'barbershop']),
  P('p05', '18 St Marks Pl', 'St Marks Pl, 2nd–3rd Ave', 40.729, -73.9885, 820, 'prime', 140, 0.9, ['cafe', 'barbershop', 'bodega']),
  P('p06', '305 E 9th St', 'E 9th St, 1st–2nd Ave', 40.729, -73.9858, 600, 'mid', 85, 0.61, ['cafe', 'barbershop']),
  P('p07', '211 E 10th St', 'E 10th St, 1st–2nd Ave', 40.7293, -73.9851, 900, 'mid', 82, 0.57, ['cafe', 'barbershop', 'bodega', 'guesthouse']),
  P('p08', '150 1st Ave', '1st Ave, 9th–10th St', 40.7283, -73.984, 1100, 'prime', 130, 0.86, ['cafe', 'barbershop', 'bodega']),
  P('p09', '84 2nd Ave', '2nd Ave, 4th–5th St', 40.7261, -73.9893, 1000, 'prime', 125, 0.8, ['cafe', 'barbershop']),
  P('p10', '412 E 6th St', 'E 6th St, 1st Ave–Ave A', 40.7249, -73.9845, 480, 'cheap', 65, 0.5, ['cafe', 'barbershop']),
  P('p11', '178 E 4th St', 'E 4th St, Ave A–B', 40.723, -73.984, 700, 'cheap', 60, 0.45, ['cafe', 'barbershop', 'rentals']),
  P('p12', '29 Avenue B', 'Avenue B, 2nd–3rd St', 40.722, -73.983, 850, 'cheap', 58, 0.42, ['cafe', 'bodega', 'guesthouse', 'rentals']),
  P('p13', '72 E 1st St', 'E 1st St, 1st–2nd Ave', 40.7231, -73.988, 640, 'mid', 80, 0.55, ['cafe', 'barbershop']),
  P('p14', '113 2nd Ave', '2nd Ave, 6th–7th St', 40.7276, -73.988, 900, 'prime', 128, 0.84, ['cafe', 'bodega']),
  P('p15', '31 Avenue A', 'Avenue A, 2nd–3rd St', 40.7225, -73.9865, 700, 'mid', 92, 0.7, ['cafe', 'barbershop']),
  P('p16', '87 E 4th St', 'E 4th St, 2nd Ave–Bowery', 40.7265, -73.9905, 520, 'mid', 84, 0.62, ['barbershop', 'cafe']),
];

// ───────────────────────── weather, events, feed ─────────────────────────

const W = (day: number, tempF: number, condition: DayWeather['condition'], footTrafficMult: number): DayWeather => {
  const word = { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', snow: 'Snow', heat: 'Heat', storm: 'Storm' }[condition];
  return { day, tempF, condition, footTrafficMult, label: `${word} ${tempF}°F` };
};

export const fixtureWeather: DayWeather[] = [
  W(74, 46, 'rain', 0.85), W(75, 49, 'cloudy', 0.95), W(76, 55, 'clear', 1.05), W(77, 58, 'clear', 1.08),
  W(78, 51, 'rain', 0.86), W(79, 50, 'cloudy', 0.96), W(80, 53, 'clear', 1.02), W(81, 34, 'snow', 0.72),
];

export const fixtureEvents: GameEvent[] = [
  {
    id: 'e-beans', kind: 'supply', title: 'Coffee beans up 8%',
    text: 'Wholesale coffee prices rose this week. Ingredient costs for coffee shops are 8% higher for two weeks.',
    announcedDay: 71, startDay: 74, endDay: 88, effects: [{ target: 'cogs', mult: 1.08, niches: ['cafe'] }], origin: 'deck',
  },
  {
    id: 'e-fair', kind: 'city', title: 'Street fair on Avenue A',
    text: 'Avenue A between 7th and 9th St is closed to cars on Saturday and Sunday. Foot traffic on the block +20%.',
    announcedDay: 72, startDay: 76, endDay: 77, effects: [{ target: 'footTraffic', mult: 1.2 }], origin: 'ai', block: 'Avenue A, 7th–8th St',
  },
];

export const fixtureFeed: FeedItem[] = [
  { id: 'f10', day: 74, kind: 'inspection', text: 'Health inspector visited Steam & Stone: 2 violations, closed for 3 days.', businessId: 'b05' },
  { id: 'f09', day: 74, kind: 'deal', text: "Maya's Morning Cup and Sharp Corner Barbers started a cross-promo.", businessId: 'b01' },
  { id: 'f08', day: 73, kind: 'opening', text: 'Blade & Brick signed a lease on E 4th St. Permits are pending.', businessId: 'b09' },
  { id: 'f07', day: 73, kind: 'event', text: 'Coffee beans up 8% for two weeks.' },
  { id: 'f06', day: 72, kind: 'bankruptcy', text: 'Tin Lantern Coffee went bankrupt after two months of losses.', businessId: 'b06' },
  { id: 'f05', day: 72, kind: 'report', text: 'A business on 1st Ave was reported to the tax office.' },
  { id: 'f04', day: 71, kind: 'inspection', text: 'Tax auditor closed a case on 2nd Ave: clean.' },
  { id: 'f03', day: 71, kind: 'opening', text: 'Copper Bean opened its doors on E 1st St.', businessId: 'b11' },
  { id: 'f02', day: 70, kind: 'deal', text: 'Two coffee shops started joint purchasing: ingredients −6% for both.' },
  { id: 'f01', day: 70, kind: 'system', text: 'Season 0 is live: 46 owners and 9 city officials.' },
];

// ───────────────────────── businesses ─────────────────────────

const B = (id: string, name: string, ownerName: string, isAi: boolean, niche: NicheId, placeId: string, status: PublicBusiness['status'], price: number, reputation: number, rankInNiche: number, kept: number, broken: number, grade: string | undefined, partners: string[] = []): PublicBusiness =>
  ({ id, name, ownerName, isAi, niche, placeId, status, price, reputation, rankInNiche, trust: { kept, broken }, grade, partners });

export const fixtureBusinesses: PublicBusiness[] = [
  B('b01', "Maya's Morning Cup", 'Maya Chen', false, 'cafe', 'p01', 'open', 6.4, 0.74, 2, 2, 0, 'A', ['b07']),
  B('b02', 'Halfmoon Coffee', 'AI', true, 'cafe', 'p05', 'open', 6.9, 0.81, 1, 3, 0, 'A'),
  B('b03', 'Ortiz Espresso Bar', 'Luis Ortiz', false, 'cafe', 'p09', 'open', 5.9, 0.69, 3, 1, 1, 'A'),
  B('b04', 'Little Ember Café', 'AI', true, 'cafe', 'p14', 'open', 6.2, 0.66, 4, 0, 0, 'B'),
  B('b05', 'Steam & Stone', 'Priya Nair', false, 'cafe', 'p08', 'closed', 6.0, 0.52, 6, 1, 0, 'C'),
  B('b06', 'Tin Lantern Coffee', 'AI', true, 'cafe', 'p15', 'bankrupt', 4.9, 0.3, 7, 0, 2, undefined),
  B('b07', 'Sharp Corner Barbers', 'Andre Wallace', false, 'barbershop', 'p02', 'open', 38, 0.78, 1, 2, 0, undefined, ['b01']),
  B('b08', 'East Fade Studio', 'AI', true, 'barbershop', 'p03', 'open', 34, 0.71, 2, 1, 0, undefined),
  B('b09', 'Blade & Brick', 'Sam Kowalski', false, 'barbershop', 'p16', 'setup', 36, 0.5, 4, 0, 0, undefined),
  B('b10', 'Seventh Street Cuts', 'AI', true, 'barbershop', 'p07', 'open', 30, 0.64, 3, 0, 0, undefined),
  B('b11', 'Copper Bean', 'AI', true, 'cafe', 'p13', 'open', 5.6, 0.63, 5, 0, 0, 'A'),
];

const S = (businessId: string, niche: NicheId, rank: number, netWorth: number, isAi: boolean, bankrupt = false): Standing => ({ businessId, niche, rank, netWorth, isAi, bankrupt });

export const fixtureLeaderboards: Partial<Record<NicheId, Standing[]>> = {
  cafe: [S('b02', 'cafe', 1, 61_300, true), S('b01', 'cafe', 2, 54_800, false), S('b03', 'cafe', 3, 49_700, false), S('b04', 'cafe', 4, 47_900, true), S('b11', 'cafe', 5, 44_200, true), S('b05', 'cafe', 6, 31_000, false), S('b06', 'cafe', 7, -2_400, true, true)],
  barbershop: [S('b07', 'barbershop', 1, 41_800, false), S('b08', 'barbershop', 2, 39_500, true), S('b10', 'barbershop', 3, 35_200, true), S('b09', 'barbershop', 4, 28_000, false)],
};

export function worldPublic(day = FIXTURE_DAY, version = 1_200, config: WorldConfig = demoConfig): WorldPublic {
  return {
    config, phase: 'running', day, date: dateOf(day), version, bank: 230, msToNextDay: Math.round(config.dayMs * 0.4),
    stats: { owners: 46, aiBusinesses: 38, officials: 9, open: 71, bankrupt: 4 },
  };
}

export const cityView: CityView = {
  kind: 'city', world: worldPublic(), businesses: fixtureBusinesses, weather: fixtureWeather,
  events: fixtureEvents, feed: fixtureFeed, leaderboards: fixtureLeaderboards,
};

// ───────────────────────── owner: Maya, coffee shop on Avenue A ─────────────────────────

export const fixtureOrders: StandingOrders = {
  price: 6.4, staff: { barista: 3, shift_lead: 1 }, levers: { cleaning: 'standard', marketing: 'social' },
  shortcuts: [], blockFund: false, autopilot: 'hold',
};

const day = (d: number, demandUnits: number, servedUnits: number, lostSize: number, lostStaff: number, weather: DayWeather['condition'], notes: string[] = []): DayReport => ({
  day: d, demandUnits, servedUnits, lost: { size: lostSize, staff: lostStaff, closure: 0 },
  revenue: Math.round(servedUnits * 6.4), variableCosts: Math.round(servedUnits * 2.05), sizeUtilization: Math.min(1, servedUnits / 260),
  weather, notes,
});

const monthFeb: MonthReport = {
  month: 2, avgPrice: 6.35, demandUnits: 7_480, servedUnits: 6_910, lost: { size: 380, staff: 190, closure: 0 },
  capacityUnits: 7_200, sizeUtilization: 0.86,
  lines: [
    { id: 'revenue', label: 'Sales', kind: 'revenue', amount: 43_879 },
    { id: 'cogs', label: 'Coffee, milk and pastries', kind: 'cogs', amount: -13_129 },
    { id: 'payroll', label: 'Wages (3 baristas, 1 shift lead)', kind: 'payroll', amount: -11_520 },
    { id: 'payroll_tax', label: 'Payroll taxes', kind: 'payroll_tax', amount: -1_150 },
    { id: 'rent', label: 'Rent, 114 Avenue A', kind: 'rent', amount: -9_000 },
    { id: 'utilities', label: 'Utilities', kind: 'opex', amount: -1_150 },
    { id: 'insurance', label: 'Insurance', kind: 'opex', amount: -420 },
    { id: 'supplies', label: 'Cups, lids, napkins', kind: 'opex', amount: -860 },
    { id: 'cleaning', label: 'Cleaning', kind: 'opex', amount: -300 },
    { id: 'marketing', label: 'Social media ads', kind: 'opex', amount: -250 },
  ],
  revenue: 43_879, profit: 6_100, cashStart: 30_800, cashEnd: 36_900,
  taxesAccrued: 3_894, taxesPaid: 0, fines: 0, quality: 0.72, reputation: 0.74, netWorth: 53_300, rankInNiche: 2,
};

export const fixtureInbox: InboxItem[] = [
  { id: 'i3', day: 74, kind: 'deal', title: 'Cross-promo with Sharp Corner Barbers is active', text: 'About +6% customers for both while it lasts.', ref: { type: 'deal', id: 'd1' }, read: false },
  { id: 'i2', day: 72, kind: 'case', title: 'Health inspection: grade A', text: 'The inspector found no violations. Your grade card stays A.', read: false },
  { id: 'i1', day: 70, kind: 'summary', title: 'Rainy week ahead', text: 'Foot traffic is down about 15% on rainy days. Consider fewer staff on Tuesday.', read: false },
];

export const ownerPlayer: Player = { id: 'u-maya', name: 'Maya Chen', kind: 'owner', isAi: false, paid: true, joinedDay: 3, lastSeenDay: 68, inbox: fixtureInbox };

export const ownerBusiness: BusinessState = {
  id: 'b01', name: "Maya's Morning Cup", niche: 'cafe', placeId: 'p01', isAi: false,
  owners: [{ playerId: 'u-maya', share: 1 }], managerPlayerId: 'u-maya', status: 'open',
  createdDay: 5, openedDay: 31, cash: 38_420, size: 24,
  items: [{ id: 'espresso_machine', qty: 1 }, { id: 'grinder', qty: 2 }, { id: 'refrigeration', qty: 1 }, { id: 'pos', qty: 1 }, { id: 'seating', qty: 24 }],
  setupSpent: 84_600, permits: [{ itemId: 'fse_permit', appliedDay: 8, readyDay: 29 }, { itemId: 'sales_tax_cert', appliedDay: 6, readyDay: 26 }],
  quality: 0.72, reputation: 0.74, trust: { kept: 2, broken: 0 }, orders: fixtureOrders, trails: [],
  liabilities: [{ taxId: 'sales_tax', amount: 6_120, dueDay: 80, paid: false }],
  mtd: {
    lines: [
      { id: 'revenue', label: 'Sales', kind: 'revenue', amount: 20_450 },
      { id: 'cogs', label: 'Coffee, milk and pastries', kind: 'cogs', amount: -6_530 },
      { id: 'rent', label: 'Rent, 114 Avenue A', kind: 'rent', amount: -4_200 },
    ],
    demandUnits: 3_380, servedUnits: 3_190, lost: { size: 120, staff: 70, closure: 0 },
  },
  days: [
    day(68, 252, 240, 8, 4, 'clear'), day(69, 270, 251, 12, 7, 'clear', ['Line out the door at 8:30 am']),
    day(70, 238, 230, 4, 4, 'cloudy'), day(71, 226, 222, 0, 4, 'cloudy'), day(72, 205, 205, 0, 0, 'rain'),
    day(73, 291, 250, 26, 15, 'clear', ['41 customers walked away: not enough seats and staff']), day(74, 214, 210, 0, 4, 'rain'),
  ],
  history: [monthFeb],
};

export const fixtureAnalytics: Analytics = {
  month: 3, daysIntoMonth: 14, revenue: 45_200, profit: 5_400, cumulativeProfit: 11_500, netWorth: 54_800,
  cogsPct: 0.32, laborPct: 0.29, rentPct: 0.2, primeCostPct: 0.61, netMarginPct: 0.12,
  fixedCostsMonth: 23_400, variableCostPerUnit: 2.05, contributionPerUnit: 4.35,
  breakEvenUnitsMonth: 5_380, breakEvenRevenueMonth: 34_430, breakEvenPrice: 5.62,
  utilization: 0.88, sizeUtilization: 0.86, lostSalesUnits: 190, lostSalesMoney: 1_216,
  cashRunwayMonths: null, setupInvested: 84_600, paybackMonths: 15,
  taxDueNext: { amount: 6_120, day: 80 }, exposure: 0,
  benchmarks: [
    { metric: 'Ingredients (COGS)', you: 0.32, industry: 0.3, verdict: 'ok' },
    { metric: 'Labor', you: 0.29, industry: 0.3, verdict: 'good' },
    { metric: 'Rent', you: 0.2, industry: 0.1, verdict: 'bad' },
  ],
  nicheKpis: [{ id: 'cups_per_staff_hour', label: 'Cups per staff hour', value: 16.6, unit: 'cups' }],
};

export const fixtureRecommendations: Recommendation[] = [
  {
    id: 'rec-weekend-barista', severity: 'warn', title: 'Add a barista on busy days',
    text: '41 customers walked away on Saturday: not enough staff. One more barista costs about $2,720 a month.',
    suggested: { type: 'set_orders', orders: { staff: { barista: 4, shift_lead: 1 } } }, impact: { profitDeltaMonth: 1_180 },
  },
  {
    id: 'rec-price', severity: 'info', title: 'Your price is below the street',
    text: 'Your ticket is $6.40; nearby coffee shops average $6.55. Customers here care more about quality than price.',
    suggested: { type: 'set_orders', orders: { price: 6.6 } }, impact: { profitDeltaMonth: 520 },
  },
];

export const fixtureDeals: Deal[] = [
  { id: 'd1', fromBusinessId: 'b01', toBusinessId: 'b07', terms: { type: 'cross_promo', months: 2 }, status: 'active', proposedDay: 72, expiresDay: 75, startDay: 74, endDay: 134 },
];

// ───────────────────────── the coffee-shop opening path ─────────────────────────

// Fees and waits: see the `source` of each step. Where no official number exists, `estimate`.
export const fixtureRoadmap: RoadmapItem[] = [
  { id: 'rm-entity', title: 'Form your business (LLC)', text: 'File Articles of Organization with New York State. Within 120 days, publish a notice in two newspapers for six weeks.', kind: 'legal', fee: 200, waitDays: 7, agency: 'NYS Department of State', link: 'https://dos.ny.gov/limited-liability-company-llc', status: 'done' },
  { id: 'rm-ein', title: 'Get an Employer Identification Number', text: 'Free, online, issued immediately. You need it to hire staff and open a business bank account.', kind: 'legal', fee: 0, agency: 'IRS', link: 'https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number', status: 'done' },
  { id: 'rm-sales-tax', title: 'Register to collect sales tax', text: 'Apply for a Certificate of Authority at least 20 days before you start selling. Combined NYC sales tax is 8.875%.', kind: 'legal', setupItemId: 'sales_tax_cert', fee: 0, waitDays: 20, agency: 'NYS Department of Taxation and Finance', link: 'https://www.tax.ny.gov/bus/st/register.htm', status: 'done' },
  { id: 'rm-lease', title: 'Sign a commercial lease', text: 'Landlords usually ask for a security deposit of several months of rent. Check the certificate of occupancy allows a café.', kind: 'space', setupItemId: 'deposit', agency: 'Landlord', status: 'done' },
  { id: 'rm-buildout', title: 'Build out and equip the space', text: 'Plumbing, sinks, counters, espresso machine and refrigeration. Most of your startup money goes here.', kind: 'money', setupItemId: 'buildout', waitDays: 14, agency: 'Contractor', status: 'done' },
  { id: 'rm-fse', title: 'Food Service Establishment Permit', text: 'Required before you serve food or drinks. Expect a pre-permit inspection by the Health Department.', kind: 'permit', setupItemId: 'fse_permit', fee: 280, waitDays: 21, agency: 'NYC Department of Health and Mental Hygiene', link: 'https://www.nyc.gov/site/doh/business/food-operators/food-service-establishments.page', status: 'done' },
  { id: 'rm-fpc', title: 'Food Protection Certificate', text: 'At least one supervisor on every shift must hold the certificate: free online course, in-person exam.', kind: 'people', waitDays: 10, agency: 'NYC Department of Health and Mental Hygiene', link: 'https://www.nyc.gov/site/doh/business/food-operators/food-protection-course.page', status: 'done' },
  { id: 'rm-suppliers', title: 'Choose suppliers', text: 'Coffee roaster, dairy, bakery and paper goods. Ask for net-30 terms once you have a track record.', kind: 'supplier', agency: 'Wholesalers', status: 'done' },
  { id: 'rm-staff', title: 'Hire your team', text: 'Minimum wage in New York City is $17.00 an hour in 2026. You also need workers’ compensation and disability insurance.', kind: 'people', agency: 'NYS Department of Labor', link: 'https://dol.ny.gov/minimum-wage-0', status: 'done' },
  { id: 'rm-launch', title: 'Open your doors', text: 'Opening before the permits arrive is a violation: the Health Department can fine you and close you.', kind: 'launch', status: 'done' },
];

/** The roadmap of a player who has not opened yet: the same steps, all still to do. */
export const fixtureRoadmapTodo: RoadmapItem[] = fixtureRoadmap.map((s) => ({ ...s, status: 'todo' }));

const KIT_STANDARD = [{ id: 'espresso_machine', qty: 1 }, { id: 'grinder', qty: 2 }, { id: 'refrigeration', qty: 1 }, { id: 'pos', qty: 1 }, { id: 'seating', qty: 1 }, { id: 'buildout', qty: 1 }, { id: 'deposit', qty: 1 }, { id: 'fse_permit', qty: 1 }, { id: 'sales_tax_cert', qty: 1 }, { id: 'llc', qty: 1 }, { id: 'opening_stock', qty: 1 }];
const KIT_LEAN = [{ id: 'espresso_machine_used', qty: 1 }, { id: 'grinder', qty: 1 }, { id: 'refrigeration', qty: 1 }, { id: 'pos', qty: 1 }, { id: 'seating', qty: 1 }, { id: 'buildout', qty: 1 }, { id: 'deposit', qty: 1 }, { id: 'fse_permit', qty: 1 }, { id: 'sales_tax_cert', qty: 1 }, { id: 'llc', qty: 1 }, { id: 'opening_stock', qty: 1 }];
const KIT_PREMIUM = [{ id: 'espresso_machine', qty: 1 }, { id: 'grinder', qty: 3 }, { id: 'refrigeration', qty: 2 }, { id: 'pos', qty: 2 }, { id: 'seating', qty: 1 }, { id: 'buildout', qty: 1 }, { id: 'deposit', qty: 1 }, { id: 'fse_permit', qty: 1 }, { id: 'sales_tax_cert', qty: 1 }, { id: 'llc', qty: 1 }, { id: 'opening_stock', qty: 1 }];

export const fixtureIdea: IdeaMatch = {
  niche: 'cafe', businessName: 'Morning Cup', tier: 'mid', kitId: 'standard',
  notes: ['Looks like a coffee shop with pastries.', 'Morning foot traffic matters more than size: look near a subway exit.'], origin: 'rules',
};

const commonOwner = (me: Player, extra: Partial<OwnerView> = {}): OwnerView => ({
  kind: 'owner', me, world: worldPublic(), business: null, stakes: [], neighbors: fixtureBusinesses.filter((b) => b.id !== 'b01'),
  deals: [], notices: [], blockFund: null, weather: fixtureWeather, events: fixtureEvents, feed: fixtureFeed,
  analytics: null, recommendations: [], roadmap: [], leaderboards: fixtureLeaderboards, away: null, ...extra,
});

/** A returning owner: business open, six days away. */
export const ownerView: OwnerView = commonOwner(ownerPlayer, {
  business: ownerBusiness, stakes: [{ businessId: 'b01', share: 1 }], deals: fixtureDeals,
  blockFund: { block: 'Avenue A, 7th–8th St', month: 3, contributors: 3, eligible: 6, active: false, feeMonth: RULES.BLOCK_FUND_FEE_MONTH },
  analytics: fixtureAnalytics, recommendations: fixtureRecommendations, roadmap: fixtureRoadmap,
  away: { days: 6, profit: 3_240, items: fixtureInbox },
});

/** A new owner who joined and has not opened anything yet. */
export const ownerViewNew: OwnerView = commonOwner({ ...ownerPlayer, id: 'u-new', name: 'Jordan', joinedDay: FIXTURE_DAY, lastSeenDay: FIXTURE_DAY, inbox: [] });

/** An owner waiting for permits: rent is already running. */
export const ownerViewSetup: OwnerView = commonOwner({ ...ownerPlayer, id: 'u-new', name: 'Jordan', joinedDay: 70, lastSeenDay: FIXTURE_DAY, inbox: [] }, {
  business: {
    ...ownerBusiness, id: 'b20', name: 'Jordan’s Coffee', placeId: 'p04', owners: [{ playerId: 'u-new', share: 1 }], managerPlayerId: 'u-new',
    status: 'setup', createdDay: 70, openedDay: undefined, cash: 30_920, setupSpent: 89_080, quality: 0.6, reputation: 0.5, trust: { kept: 0, broken: 0 },
    permits: [{ itemId: 'fse_permit', appliedDay: 70, readyDay: 91 }, { itemId: 'sales_tax_cert', appliedDay: 70, readyDay: 90 }],
    liabilities: [], mtd: { lines: [{ id: 'rent', label: 'Rent, 96 E 7th St', kind: 'rent', amount: -1_307 }], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } },
    days: [], history: [],
  },
  roadmap: fixtureRoadmap.map((s) => (s.id === 'rm-fse' ? { ...s, status: 'waiting', readyDay: 91 } : s.id === 'rm-sales-tax' ? { ...s, status: 'waiting', readyDay: 90 } : s.id === 'rm-launch' ? { ...s, status: 'todo' } : s)),
});

// ───────────────────────── official: health inspector ─────────────────────────

const card = (caseId: string, businessId: string, origin: CaseCard['origin'], openedDay: number, hints: string[], status: CaseCard['status'] = 'open'): CaseCard =>
  ({ caseId, business: fixtureBusinesses.find((b) => b.id === businessId)!, role: 'inspector', origin, openedDay, hints, status });

export const officialView: OfficialView = {
  kind: 'official', me: { id: 'u-ines', name: 'Ines Park', kind: 'official', isAi: false, paid: false, role: 'inspector', joinedDay: 10, lastSeenDay: 73, inbox: [] },
  world: worldPublic(),
  official: { id: 'o1', playerId: 'u-ines', name: 'Ines Park', isAi: false, role: 'inspector', points: 40, casesClosed: 5, bribesTaken: 0, bribesThisMonth: 0, exposed: false },
  queue: [
    card('c11', 'b03', 'report', 73, ['A neighbor reports a dirty prep area', 'No deep clean recorded in 3 months']),
    card('c12', 'b10', 'routine', 72, ['Routine inspection: 6 months since the last one']),
    card('c13', 'b11', 'flag', 74, ['Cleaning spend is half the norm for this size']),
  ],
  mine: [{ ...card('c09', 'b05', 'report', 71, ['Neighbor report: mice seen near the back door'], 'notice'), found: [{ violationId: 'pests', months: 2, fine: 1_200, closureDays: 3 }] }],
  ranking: [{ name: 'Ines Park', points: 40, isAi: false }, { name: 'City inspector (AI)', points: 35, isAi: true }, { name: 'Tom Reyes', points: 20, isAi: false }],
  weather: fixtureWeather, events: fixtureEvents, feed: fixtureFeed,
};

export const fixtureViews: Record<string, ClientView> = { city: cityView, owner: ownerView, ownerNew: ownerViewNew, ownerSetup: ownerViewSetup, official: officialView };

// ───────────────────────── packs (placeholder until packs/*.json from agents 14–16) ─────────────────────────

const NYC_SALES_TAX = 'https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/quick_reference_guide_for_taxable_and_exempt_property_and_services.htm';

export const fixtureCommon: CommonPack = {
  id: '_common', version: 1, name: 'New York City — common rules',
  taxes: [{ id: 'sales_tax', name: 'NYC sales tax', base: 'taxable_revenue', rate: 0.08875, due: 'quarterly', source: NYC_SALES_TAX, confidence: 'verified' }],
  shortcuts: [{ id: 'cash_wages', name: 'Pay staff in cash, off the books', what: 'No payroll taxes, no workers’ comp', saves: { basis: 'pct_payroll', amount: 0.12 }, violation: 'unreported_wages' }],
  violations: [{ id: 'unreported_wages', name: 'Unreported wages', law: 'NY Labor Law § 195; IRS employment tax rules', official: 'tax_office', foundBy: ['audit', 'complaint'], fine: { base: 2_000, pctOfSaved: 1, max: 50_000 }, confidence: 'estimate' }],
  officials: [{ id: 'tax_office', name: 'Tax auditor', agency: 'NYS Department of Taxation and Finance', role: 'tax_auditor', checks: ['unreported_wages'] }],
  reports: [{ id: 'report_tax', name: 'Report to the tax office', text: 'You think they pay staff off the books.', role: 'tax_auditor', checks: ['unreported_wages'] }],
  ruleCards: [{ id: 'rc-sales-tax', title: 'Sales tax is not your money', text: 'You collect 8.875% on every taxable sale and pay it to the state each quarter. Spend it and you owe it anyway.', source: NYC_SALES_TAX }],
  roadmap: [], sources: [{ url: NYC_SALES_TAX, title: 'NYS Tax — sales tax', checked: '2026-11-14' }],
};

const setup = (id: string, name: string, kind: Pack['setup'][number]['kind'], cost: number, required: boolean, extra: Partial<Pack['setup'][number]> = {}): Pack['setup'][number] =>
  ({ id, name, kind, cost, required, confidence: 'estimate', ...extra });

export const fixtureCafePack: Pack = {
  id: 'cafe', version: 1, name: 'Coffee shop', tagline: 'Espresso, pastries and a line out the door at 8 am.', startCapital: 120_000,
  unit: { name: 'order', refPrice: 6.4, priceMin: 3, priceMax: 12, cogsPerUnit: 1.9, confidence: 'estimate' },
  market: { unitsPerSlotMonth: 4_200, priceElasticity: -1.4, weights: { price: 0.35, quality: 0.25, reputation: 0.2, location: 0.2 }, confidence: 'estimate' },
  capacity: { unitsPerStaffMonth: 2_600, minStaff: 1, maxStaff: 8 },
  sizing: { unitName: 'seat', min: 8, max: 60, default: 24, sqftPerUnit: 18, unitsServedPerSizeMonth: 220, takeawayShare: 0.55, cleaningCostPerSizeMonth: 12, emptyPenaltyBelow: 0.25, crowdPenaltyAbove: 0.9, confidence: 'estimate' },
  setup: [
    setup('llc', 'LLC filing fee', 'license', 200, true, { agency: 'NYS Department of State', link: 'https://dos.ny.gov/limited-liability-company-llc', waitDays: 7 }),
    setup('sales_tax_cert', 'Certificate of Authority (sales tax)', 'license', 0, true, { agency: 'NYS Department of Taxation and Finance', link: 'https://www.tax.ny.gov/bus/st/register.htm', waitDays: 20, withoutItViolation: 'no_sales_tax_cert' }),
    setup('fse_permit', 'Food Service Establishment Permit', 'permit', 280, true, { agency: 'NYC Department of Health and Mental Hygiene', link: 'https://www.nyc.gov/site/doh/business/food-operators/food-service-establishments.page', waitDays: 21, withoutItViolation: 'no_fse_permit' }),
    setup('deposit', 'Security deposit (3 months of rent)', 'deposit', 27_000, true),
    setup('buildout', 'Build-out: plumbing, sinks, counter', 'buildout', 35_000, true),
    setup('espresso_machine', 'Espresso machine, two groups', 'equipment', 14_000, true, { lifespanMonths: 84, qualityBonus: 0.05 }),
    setup('espresso_machine_used', 'Used espresso machine', 'equipment', 6_500, false, { lifespanMonths: 36 }),
    setup('grinder', 'Coffee grinder', 'equipment', 1_200, true, { lifespanMonths: 60 }),
    setup('refrigeration', 'Under-counter refrigeration', 'equipment', 4_800, true, { lifespanMonths: 96 }),
    setup('pos', 'Point-of-sale terminal', 'equipment', 1_100, true),
    setup('seating', 'Table and chair, per seat', 'furniture', 180, false, { scalesWithSize: true, qualityBonus: 0.02 }),
    setup('opening_stock', 'Opening stock: beans, milk, cups', 'inventory', 3_000, true),
  ],
  kits: [
    { id: 'lean', name: 'Lean', size: 12, items: KIT_LEAN, pitch: 'Mostly takeaway, used machine, cash stays in the bank.' },
    { id: 'standard', name: 'Standard', size: 24, items: KIT_STANDARD, pitch: 'A neighborhood café that can handle the morning rush.' },
    { id: 'premium', name: 'Premium', size: 36, items: KIT_PREMIUM, pitch: 'Room for the lunch crowd. Little cash left for a slow start.' },
  ],
  monthlyCosts: [
    { id: 'utilities', name: 'Utilities', kind: 'utilities', basis: 'fixed', amount: 1_150, confidence: 'estimate' },
    { id: 'insurance', name: 'Insurance', kind: 'insurance', basis: 'fixed', amount: 420, confidence: 'estimate' },
  ],
  staff: [
    { id: 'barista', name: 'Barista', hourlyWage: 17, hoursPerMonth: 160, source: 'https://dol.ny.gov/minimum-wage-0', confidence: 'verified' },
    { id: 'shift_lead', name: 'Shift lead', hourlyWage: 21, hoursPerMonth: 160, confidence: 'estimate' },
  ],
  taxes: [],
  levers: [
    { id: 'cleaning', name: 'Cleaning', options: [{ id: 'basic', label: 'Basic', monthlyCost: 150, causes: 'unsanitary_conditions' }, { id: 'standard', label: 'Standard', monthlyCost: 300 }, { id: 'deep', label: 'Deep weekly', monthlyCost: 600, effects: { quality: 0.03 } }] },
    { id: 'marketing', name: 'Marketing', options: [{ id: 'none', label: 'None', monthlyCost: 0 }, { id: 'social', label: 'Social media', monthlyCost: 250, effects: { demand: 0.03 } }] },
  ],
  shortcuts: [{ id: 'skip_cleaning', name: 'Clean less often', what: 'Cut the cleaning crew to once a week', saves: { basis: 'fixed', amount: 250 }, violation: 'unsanitary_conditions' }],
  violations: [
    { id: 'no_fse_permit', name: 'Operating without a permit', law: 'NYC Health Code § 81.05', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 1_000, max: 2_000 }, closureDays: 7, confidence: 'estimate' },
    { id: 'no_sales_tax_cert', name: 'Selling without a Certificate of Authority', law: 'NY Tax Law § 1134', official: 'tax_office', foundBy: ['audit'], fine: { base: 500 }, confidence: 'estimate' },
    { id: 'unsanitary_conditions', name: 'Unsanitary conditions', law: 'NYC Health Code Article 81', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 300, perMonth: 100, max: 2_000 }, reputationHit: 0.1, confidence: 'estimate' },
  ],
  officials: [{ id: 'health_inspector', name: 'Health inspector', agency: 'NYC Department of Health and Mental Hygiene', role: 'inspector', checks: ['no_fse_permit', 'unsanitary_conditions'] }],
  reports: [{ id: 'report_health', name: 'Report to the Health Department', text: 'You think their kitchen is dirty or they serve without a permit.', role: 'inspector', checks: ['no_fse_permit', 'unsanitary_conditions'] }],
  events: [],
  ruleCards: [{ id: 'rc-fse', title: 'No permit, no coffee', text: 'You need a Food Service Establishment Permit before you serve anything. Opening early is a violation that can close you.', source: 'https://www.nyc.gov/site/doh/business/food-operators/food-service-establishments.page' }],
  benchmarks: { cogsPct: 0.3, laborPct: 0.3, rentPct: 0.1, netMarginPct: 0.08, confidence: 'estimate' },
  suppliers: [{ id: 'roaster', category: 'Coffee', what: 'Wholesale coffee beans', whereToFind: 'Local roasters sell wholesale with free training for new cafés.', confidence: 'estimate' }],
  roadmap: fixtureRoadmapTodo.map(({ status: _status, readyDay: _readyDay, ...step }) => step),
  manager: { monthlySalary: 4_800, confidence: 'estimate' },
  sources: [{ url: 'https://dol.ny.gov/minimum-wage-0', title: 'NYS Department of Labor — minimum wage', checked: '2026-11-14' }],
};

/** Setup cost the way the client previews it: price x qty, or x size for items that scale with size. */
function sumKit(pack: Pack, items: { id: string; qty: number }[], size: number): number {
  return items.reduce((t, it) => {
    const item = pack.setup.find((x) => x.id === it.id);
    return item ? t + item.cost * (item.scalesWithSize ? size : it.qty) : t;
  }, 0);
}

function formatUsd(v: number): string {
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

const rec = (kitId: OpenRecommendation['kitId'], size: number, items: { id: string; qty: number }[], staff: Record<string, number>, why: (cashLeft: number) => string[]): OpenRecommendation => {
  const total = sumKit(fixtureCafePack, items, size);
  const cashLeft = fixtureCafePack.startCapital - total;
  return { kitId, size, items, total, cashLeft, orders: { ...fixtureOrders, staff }, daysToOpen: 21, why: why(cashLeft) };
};

/** recommend_opening for a coffee shop at 29 Avenue B (p12, fits 28 seats). The recommended kit comes first. */
export const fixtureOpenRecommendations: OpenRecommendation[] = [
  rec('standard', 24, KIT_STANDARD, { barista: 3, shift_lead: 1 }, (left) => ['24 seats fit 850 sq ft with room for the counter and the line', `Keeps ${formatUsd(left)} in the bank for the slow first months`, 'A two-group espresso machine keeps up with the 8 am rush']),
  rec('lean', 12, KIT_LEAN, { barista: 2, shift_lead: 0 }, (left) => [`Most cash stays in the bank: ${formatUsd(left)}`, 'Mostly takeaway: half the seats', 'A used machine breaks down more often']),
  rec('premium', 28, KIT_PREMIUM, { barista: 4, shift_lead: 1 }, (left) => ['Every seat the room allows for the lunch crowd', `Only ${formatUsd(left)} left in the bank, risky if sales start slow`, 'Higher quality supports higher prices']),
];

/** Example barbershop pack (placeholder until packs/barbershop.json from agent 15). All numbers are estimates. */
export const fixtureBarberPack: Pack = {
  ...fixtureCafePack,
  id: 'barbershop', name: 'Barbershop', tagline: 'Chairs, regulars and a license on the wall.', startCapital: 60_000,
  unit: { name: 'haircut', refPrice: 35, priceMin: 15, priceMax: 80, cogsPerUnit: 2.5, confidence: 'estimate' },
  market: { unitsPerSlotMonth: 520, priceElasticity: -0.9, weights: { price: 0.25, quality: 0.3, reputation: 0.3, location: 0.15 }, confidence: 'estimate' },
  capacity: { unitsPerStaffMonth: 330, minStaff: 1, maxStaff: 8 },
  sizing: { unitName: 'chair', min: 1, max: 8, default: 3, sqftPerUnit: 70, unitsServedPerSizeMonth: 330, cleaningCostPerSizeMonth: 40, confidence: 'estimate' },
  setup: [
    setup('deposit', 'Security deposit (3 months of rent)', 'deposit', 12_000, true),
    setup('buildout', 'Build-out: sinks, mirrors, lighting', 'buildout', 18_000, true),
    setup('chair', 'Barber chair and station, per chair', 'furniture', 2_400, true, { scalesWithSize: true, qualityBonus: 0.02 }),
    setup('tools', 'Clippers, sterilizer, towels', 'equipment', 1_800, true),
    setup('pos', 'Point-of-sale terminal', 'equipment', 1_100, true),
    setup('opening_stock', 'Opening stock: products, capes', 'inventory', 1_200, true),
  ],
  kits: [
    { id: 'lean', name: 'Lean', size: 2, items: [{ id: 'deposit', qty: 1 }, { id: 'buildout', qty: 1 }, { id: 'chair', qty: 2 }, { id: 'tools', qty: 1 }, { id: 'pos', qty: 1 }, { id: 'opening_stock', qty: 1 }], pitch: 'Two chairs, the owner cuts too.' },
    { id: 'standard', name: 'Standard', size: 3, items: [{ id: 'deposit', qty: 1 }, { id: 'buildout', qty: 1 }, { id: 'chair', qty: 3 }, { id: 'tools', qty: 1 }, { id: 'pos', qty: 1 }, { id: 'opening_stock', qty: 1 }], pitch: 'Three chairs and walk-ins all day.' },
    { id: 'premium', name: 'Premium', size: 5, items: [{ id: 'deposit', qty: 1 }, { id: 'buildout', qty: 1 }, { id: 'chair', qty: 5 }, { id: 'tools', qty: 1 }, { id: 'pos', qty: 2 }, { id: 'opening_stock', qty: 1 }], pitch: 'A shop that books out on weekends.' },
  ],
  staff: [{ id: 'barber', name: 'Barber', hourlyWage: 22, hoursPerMonth: 160, confidence: 'estimate' }],
  levers: [], shortcuts: [], violations: [], officials: [], reports: [], ruleCards: [], suppliers: [], roadmap: [],
  manager: { monthlySalary: 4_200, confidence: 'estimate' }, sources: [],
};

export const fixturePacks: PackSet = { common: fixtureCommon, niches: { cafe: fixtureCafePack, barbershop: fixtureBarberPack } };
