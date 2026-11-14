// Test and demo fixtures for @ohh/ai until packs/*.json (agents 14–16) and the engine (agents 02–04) land.
// Numbers follow the example in build/PACK.md and are FIXTURES, not game data. Replace by loading packs/*.json.
import type {
  Analytics, BusinessState, CommonPack, EngineCtx, GameEvent, Pack, PackSet, Place, RealWorldPlan, StandingOrders, WorldState,
} from '../shared';
import { forecast } from '../weather';

const SRC = 'fixture (build/PACK.md example)';

export const cafePack: Pack = {
  id: 'cafe', version: 0, name: 'Coffee shop', tagline: 'Espresso, pastries and a line out the door',
  startCapital: 60000,
  unit: { name: 'order', refPrice: 6.5, priceMin: 3, priceMax: 12, cogsPerUnit: 1.9, source: SRC, confidence: 'estimate' },
  market: { unitsPerSlotMonth: 5200, priceElasticity: -1.4, weights: { price: 0.35, quality: 0.25, reputation: 0.2, location: 0.2 }, source: SRC, confidence: 'estimate' },
  capacity: { unitsPerStaffMonth: 1800, minStaff: 1, maxStaff: 8 },
  sizing: { unitName: 'seat', min: 6, max: 40, default: 18, sqftPerUnit: 18, unitsServedPerSizeMonth: 150, takeawayShare: 0.45, cleaningCostPerSizeMonth: 12, crowdPenaltyAbove: 0.9, emptyPenaltyBelow: 0.3, source: SRC, confidence: 'estimate' },
  setup: [
    { id: 'espresso_machine', name: 'Espresso machine', kind: 'equipment', cost: 9000, required: true, lifespanMonths: 84, qualityBonus: 0.03, source: SRC, confidence: 'estimate' },
    { id: 'chair', name: 'Dining chair', kind: 'furniture', cost: 85, required: true, scalesWithSize: true, lifespanMonths: 60, source: SRC, confidence: 'estimate' },
    { id: 'buildout', name: 'Counter and plumbing build-out', kind: 'buildout', cost: 18000, required: true, source: SRC, confidence: 'estimate' },
    { id: 'deposit', name: 'Security deposit (2 months)', kind: 'deposit', cost: 19000, required: true, source: SRC, confidence: 'estimate' },
    { id: 'fse_permit', name: 'Food Service Establishment Permit', kind: 'permit', cost: 280, required: true, waitDays: 21, agency: 'NYC DOHMH', link: 'https://www.nyc.gov/site/doh/services/restaurant-grades.page', withoutItViolation: 'no_fse_permit', source: SRC, confidence: 'estimate' },
  ],
  kits: [
    { id: 'lean', name: 'Lean start', size: 12, items: [{ id: 'espresso_machine', qty: 1 }, { id: 'buildout', qty: 1 }, { id: 'deposit', qty: 1 }, { id: 'fse_permit', qty: 1 }], pitch: 'Cheapest way to open. Small room, used equipment.' },
    { id: 'standard', name: 'Standard', size: 18, items: [{ id: 'espresso_machine', qty: 1 }, { id: 'buildout', qty: 1 }, { id: 'deposit', qty: 1 }, { id: 'fse_permit', qty: 1 }], pitch: 'A comfortable room for the morning rush.' },
    { id: 'premium', name: 'Premium', size: 24, items: [{ id: 'espresso_machine', qty: 2 }, { id: 'buildout', qty: 1 }, { id: 'deposit', qty: 1 }, { id: 'fse_permit', qty: 1 }], pitch: 'Two machines, more seats, better finish.' },
  ],
  monthlyCosts: [{ id: 'rent', name: 'Rent', kind: 'rent', basis: 'fixed', amount: 9500, source: SRC, confidence: 'estimate' }],
  staff: [
    { id: 'barista', name: 'Barista', hourlyWage: 17, tipped: true, cashWage: 14.15, hoursPerMonth: 140, licenseRequired: null, source: SRC, confidence: 'estimate' },
    { id: 'shift_lead', name: 'Shift lead', hourlyWage: 21, hoursPerMonth: 160, source: SRC, confidence: 'estimate' },
  ],
  taxes: [{ id: 'sales_tax', name: 'Sales tax', base: 'taxable_revenue', rate: 0.08875, due: 'quarterly', appliesIf: 'prepared food and drinks', source: SRC, confidence: 'estimate' }],
  levers: [{ id: 'cleaning', name: 'Cleaning', options: [
    { id: 'full', label: 'Daily deep clean', monthlyCost: 900, effects: { quality: 0.05 } },
    { id: 'minimal', label: 'Wipe and go', monthlyCost: 250, effects: { quality: -0.05 }, causes: 'dirty_surfaces' },
  ] }],
  shortcuts: [
    { id: 'cash_wages', name: 'Pay staff in cash, off the books', what: 'No payroll taxes this month. If anyone audits you, you owe it all back with penalties.', saves: { basis: 'pct_payroll', amount: 0.18 }, violation: 'off_books_payroll' },
    { id: 'skip_cleaning', name: 'Skip the deep clean', what: 'Saves the cleaning crew. A health inspector will see it.', saves: { basis: 'fixed', amount: 650 }, violation: 'dirty_surfaces' },
  ],
  violations: [
    { id: 'off_books_payroll', name: 'Unreported cash payroll', law: 'NY and federal payroll tax law (fixture)', official: 'tax_auditor', foundBy: ['audit', 'complaint'], fine: { base: 0, perMonth: 0, pctOfSaved: 1.5, max: null }, closureDays: 0, reputationHit: 0.1, criminal: 'Willful failure to pay payroll taxes can become a criminal case.', source: SRC, confidence: 'estimate' },
    { id: 'dirty_surfaces', name: 'Unsanitary food contact surfaces', law: 'NYC Health Code Article 81 (fixture)', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 300, perMonth: 0, max: 2000 }, closureDays: 0, reputationHit: 0.05, source: SRC, confidence: 'estimate' },
    { id: 'no_fse_permit', name: 'Operating without a food service permit', law: 'NYC Health Code §81.05 (fixture)', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 1000, perMonth: 500, max: 5000 }, closureDays: 7, reputationHit: 0.1, source: SRC, confidence: 'estimate' },
  ],
  officials: [
    { id: 'health_inspector', name: 'Health inspector', agency: 'NYC DOHMH', role: 'inspector', checks: ['dirty_surfaces', 'no_fse_permit'], source: SRC },
    { id: 'tax_auditor', name: 'Tax auditor', agency: 'NYS Department of Taxation and Finance', role: 'tax_auditor', checks: ['off_books_payroll'], source: SRC },
  ],
  reports: [{ id: 'report_dirty_kitchen', name: 'Report unsanitary conditions (311)', text: 'The Health Department sends an inspector. If you are wrong, you get a warning.', role: 'inspector', checks: ['dirty_surfaces'] }],
  events: [],
  ruleCards: [
    { id: 'letter_grade', title: 'Letter grades', text: 'Inspections are unannounced, at least once a year. You get two chances to earn an A in each inspection cycle.', source: 'https://www.nyc.gov/site/doh/services/restaurant-grades.page' },
    { id: 'tipped_wage', title: 'Tipped wage in NYC', text: 'Tipped food service workers in NYC must get at least $14.15 an hour in cash wages with a $2.85 tip credit, so tips bring them to $17.00.', source: 'https://dol.ny.gov/minimum-wage' },
    { id: 'payroll_taxes', title: 'Payroll taxes', text: 'Employers withhold income tax and pay Social Security, Medicare and unemployment insurance on every paycheck. Cash wages off the books skip all of them.', source: 'fixture' },
  ],
  benchmarks: { cogsPct: 0.3, laborPct: 0.3, rentPct: 0.08, netMarginPct: 0.06, source: SRC, confidence: 'estimate' },
  suppliers: [
    { id: 'coffee_beans', category: 'Coffee', what: 'Wholesale roasted beans, often with free equipment service', whereToFind: 'Local wholesale roasters; ask cafes you like who supplies them', source: SRC, confidence: 'estimate' },
    { id: 'dairy', category: 'Milk and dairy', what: 'Milk and oat milk delivered several times a week', whereToFind: 'Regional dairy distributors and restaurant supply wholesalers', source: SRC, confidence: 'estimate' },
  ],
  roadmap: [
    { id: 'get_fse_permit', title: 'Get your Food Service Establishment Permit', kind: 'permit', text: 'Apply online before you build out. An inspector visits before you open.', setupItemId: 'fse_permit', fee: 280, waitDays: 21, agency: 'NYC DOHMH', link: 'https://www.nyc.gov/site/doh/services/restaurant-grades.page' },
    { id: 'find_roaster', title: 'Pick a coffee roaster', kind: 'supplier', text: 'Taste three roasters and compare wholesale prices and equipment service.' },
  ],
  manager: { monthlySalary: 4800, source: SRC, confidence: 'estimate' },
  sources: [{ url: 'https://dol.ny.gov/minimum-wage', title: 'NY DOL minimum wage', checked: '2026-11-14' }],
};

export const barbershopPack: Pack = {
  ...cafePack,
  id: 'barbershop', name: 'Barbershop', tagline: 'Fades, beards and regulars',
  unit: { name: 'haircut', refPrice: 35, priceMin: 15, priceMax: 80, cogsPerUnit: 2, source: SRC, confidence: 'estimate' },
  sizing: { ...cafePack.sizing, unitName: 'chair', min: 2, max: 8, default: 4, sqftPerUnit: 60, unitsServedPerSizeMonth: 300, takeawayShare: 0 },
  kits: [
    { id: 'lean', name: 'Two chairs', size: 2, items: [], pitch: 'Two used chairs and a mirror wall.' },
    { id: 'standard', name: 'Four chairs', size: 4, items: [], pitch: 'Four chairs for walk-ins and bookings.' },
    { id: 'premium', name: 'Six chairs', size: 6, items: [], pitch: 'A full shop with a waiting lounge.' },
  ],
  staff: [{ id: 'barber', name: 'Licensed barber', hourlyWage: 20, hoursPerMonth: 160, licenseRequired: 'NYS barber license', source: SRC, confidence: 'estimate' }],
  suppliers: [{ id: 'barber_supply', category: 'Barber supplies', what: 'Clippers, blades, capes and disinfectant', whereToFind: 'Beauty and barber supply wholesalers', source: SRC, confidence: 'estimate' }],
  ruleCards: [{ id: 'barber_license', title: 'Barber license', text: 'Every barber cutting hair in New York needs a state barber license from the Department of State.', source: 'fixture' }],
};

export const commonPack: CommonPack = {
  id: '_common', version: 0, name: 'Common NYC rules',
  taxes: [], shortcuts: [], violations: [], officials: [], reports: [],
  ruleCards: [
    { id: 'min_wage', title: 'NYC minimum wage', text: 'The minimum wage in New York City is $17.00 an hour from January 1, 2026.', source: 'https://dol.ny.gov/minimum-wage' },
    { id: 'trash_bins', title: 'Trash in lidded bins', text: 'Since March 1, 2024, every NYC business must set out trash in bins with secure lids.', source: 'https://www.nyc.gov/site/dsny/news/24-011/starting-friday-march-1-all-new-york-city-businesses-must-put-trash-lidded-bins-' },
  ],
  roadmap: [
    { id: 'form_llc', title: 'Form your LLC', kind: 'legal', text: 'File Articles of Organization with the NY Department of State.', agency: 'NYS DOS' },
    { id: 'get_ein', title: 'Get an EIN', kind: 'legal', text: 'Apply for a free Employer Identification Number from the IRS.', agency: 'IRS' },
  ],
  sources: [],
};

export const packSet: PackSet = { common: commonPack, niches: { cafe: cafePack, barbershop: barbershopPack } };

export const places: Place[] = [
  { id: 'p1', address: '120 Bedford Ave', block: 'Bedford Ave', lat: 40.7187, lng: -73.9573, kind: 'storefront', sqft: 900, tier: 'prime', rentPerSqftYear: 110, footTraffic: 0.9, suitableFor: ['cafe', 'barbershop', 'bodega'] },
  { id: 'p2', address: '45 N 6th St', block: 'N 6th St', lat: 40.7197, lng: -73.9606, kind: 'storefront', sqft: 700, tier: 'mid', rentPerSqftYear: 80, footTraffic: 0.6, suitableFor: ['cafe', 'barbershop'] },
  { id: 'p3', address: '300 Graham Ave', block: 'Graham Ave', lat: 40.7137, lng: -73.9443, kind: 'storefront', sqft: 650, tier: 'cheap', rentPerSqftYear: 55, footTraffic: 0.45, suitableFor: ['cafe', 'barbershop', 'bodega'] },
];

export const ctx: EngineCtx = { packs: packSet, places };

const orders: StandingOrders = { price: 6.5, staff: { barista: 3 }, levers: { cleaning: 'full' }, shortcuts: [], blockFund: false, autopilot: 'hold' };

export function makeWorld(seed = 1, day = 1, events: GameEvent[] = []): WorldState {
  return {
    config: { id: 'demo', name: 'Demo city', city: 'nyc', seasonMonths: 12, dayMs: 2000, paused: false, maxOwners: 100, aiBusinessesTarget: 6, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05, nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed },
    phase: 'running', day, version: 1, bank: 0,
    players: [], businesses: [], officials: [], deals: [], cases: [], blockFunds: [],
    weather: forecast(seed, day, 8), events, feed: [], standings: [],
  };
}

export const business: BusinessState = {
  id: 'b1', name: 'Bean There', niche: 'cafe', placeId: 'p1', isAi: false,
  owners: [{ playerId: 'u1', share: 1 }], managerPlayerId: 'u1', status: 'open',
  createdDay: 1, openedDay: 22, cash: 21400, size: 18, items: [{ id: 'espresso_machine', qty: 1 }], setupSpent: 47900, permits: [],
  quality: 0.62, reputation: 0.58, trust: { kept: 1, broken: 0 }, orders,
  trails: [], liabilities: [],
  mtd: { lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } },
  days: [], history: [],
};

export const analytics: Analytics = {
  month: 4, daysIntoMonth: 12, revenue: 31200, profit: 1850, cumulativeProfit: -3200, netWorth: 38600,
  cogsPct: 0.31, laborPct: 0.36, rentPct: 0.3, primeCostPct: 0.67, netMarginPct: 0.06,
  fixedCostsMonth: 21900, variableCostPerUnit: 2.1, contributionPerUnit: 4.4,
  breakEvenUnitsMonth: 4977, breakEvenRevenueMonth: 32350, breakEvenPrice: 6.1,
  utilization: 0.93, sizeUtilization: 0.88, lostSalesUnits: 410, lostSalesMoney: 2665,
  cashRunwayMonths: null, setupInvested: 47900, paybackMonths: 26,
  taxDueNext: { amount: 2770, day: 120 }, exposure: 0,
  benchmarks: [
    { metric: 'laborPct', you: 0.36, industry: 0.3, verdict: 'bad' },
    { metric: 'cogsPct', you: 0.31, industry: 0.3, verdict: 'ok' },
  ],
  nicheKpis: [{ id: 'orders_per_hour', label: 'Orders per staff hour', value: 11.2, unit: 'orders' }],
};

export const plan: RealWorldPlan = {
  niche: 'cafe', businessName: 'Bean There',
  startupBudget: [{ label: 'Build-out', amount: 18000 }, { label: 'Deposit', amount: 19000 }, { label: 'Espresso machine', amount: 9000 }], startupTotal: 47900,
  monthlyCosts: [{ label: 'Rent', amount: 9500 }, { label: 'Payroll', amount: 7140 }], monthlyTotal: 21900,
  reserveAdvised: 65700, breakEvenUnitsMonth: 4977, paybackMonths: 26,
  checklist: [...cafePack.roadmap, ...commonPack.roadmap], suppliers: cafePack.suppliers,
  lessons: [
    { title: 'Queue at the morning rush', amount: 7800, lesson: 'You turned away customers in months 3-5 with two baristas.', ruleCardId: undefined },
    { title: 'Health fine for skipped cleaning', amount: 1300, lesson: 'Skipping the deep clean saved $650 a month and cost a $1,300 fine.', ruleCardId: 'letter_grade' },
    { title: 'Opened before the permit', amount: 1000, lesson: 'Opening a week early without the permit brought a fine.', ruleCardId: undefined },
  ],
  disclaimer: 'Game estimates, not financial or legal advice.',
};
