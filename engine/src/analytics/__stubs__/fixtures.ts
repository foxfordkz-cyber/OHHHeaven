// ЗАГЛУШКА данных: пакет кафе, общий пакет и места до появления packs/cafe.json и packs/_common.json
// (агент 14) и data/places.json (агент 09). Числа — оценки для тестов аналитики; подтверждённые
// поиском помечены verified и ссылкой. Когда настоящие пакеты придут в основную ветку, тесты и демо
// переключаются на них в одном месте — функция sampleCtx().
import type { BusinessState, CommonPack, NicheId, Pack, PackKit, Place, StandingOrders, WorldState } from '../../../../shared/src/types';
import { itemsCost } from '../model';

const EST = { confidence: 'estimate' as const, note: 'fixture for analytics until packs/cafe.json lands' };
const NYC_WAGE = 'https://dol.ny.gov/minimum-wage';
const FSE = 'https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit';

export const commonPack: CommonPack = {
  id: '_common', version: 1, name: 'NYC rules for every small business',
  taxes: [
    { id: 'fica_employer', name: 'Social Security and Medicare (employer share)', base: 'payroll', rate: 0.0765, due: 'monthly', source: 'https://www.irs.gov/taxtopics/tc751', ...EST },
    { id: 'futa', name: 'Federal unemployment tax (FUTA)', base: 'payroll', rate: 0.006, due: 'quarterly', source: 'https://www.irs.gov/taxtopics/tc759', ...EST },
    { id: 'ny_sui', name: 'NY unemployment insurance', base: 'payroll', rate: 0.041, due: 'quarterly', source: 'https://dol.ny.gov/unemployment-insurance-tax-rates', ...EST },
    { id: 'nyc_ubt', name: 'NYC unincorporated business tax', base: 'profit', rate: 0.04, due: 'quarterly', source: 'https://www.nyc.gov/site/finance/business/business-unincorporated.page', ...EST },
    { id: 'income_tax_estimate', name: 'Owner income tax (estimate)', base: 'profit', rate: 0.21, due: 'quarterly', ...EST },
  ],
  shortcuts: [
    { id: 'cash_wages', name: 'Pay staff in cash, off the books', what: 'No payroll taxes this month. An audit makes you pay it all back with penalties.', saves: { basis: 'pct_payroll', amount: 0.1235 }, violation: 'off_books_payroll' },
    { id: 'skip_workers_comp', name: 'Skip workers’ comp insurance', what: 'Save the premium. One injured worker and the state comes after you.', saves: { basis: 'per_staff', amount: 110 }, violation: 'no_workers_comp' },
    { id: 'hide_sales', name: 'Ring up some sales off the register', what: 'Less sales tax to send. Auditors compare your sales with your supplies.', saves: { basis: 'pct_revenue', amount: 0.03 }, violation: 'underreported_sales' },
  ],
  violations: [
    { id: 'off_books_payroll', name: 'Unreported cash payroll', law: 'NY Labor Law §195; 26 U.S.C. §3102', official: 'tax_auditor', foundBy: ['audit', 'complaint'], fine: { base: 500, pctOfSaved: 1.5, max: null }, reputationHit: 0.05, ...EST },
    { id: 'no_workers_comp', name: 'No workers’ compensation coverage', law: 'NY Workers’ Compensation Law §52', official: 'tax_auditor', foundBy: ['audit', 'complaint'], fine: { perMonth: 6000, max: null }, source: 'https://www.wcb.ny.gov/content/main/Employers/Penalties.jsp', ...EST, note: 'up to $2,000 per 10 days without coverage → $6,000 a month' },
    { id: 'underreported_sales', name: 'Underreported sales tax', law: 'NY Tax Law §1145', official: 'tax_auditor', foundBy: ['audit'], fine: { base: 1000, pctOfSaved: 1.5, max: null }, ...EST },
  ],
  officials: [
    { id: 'tax_auditor', name: 'Tax auditor', agency: 'NYS Department of Taxation and Finance', role: 'tax_auditor', checks: ['off_books_payroll', 'no_workers_comp', 'underreported_sales'], ...EST },
  ],
  reports: [
    { id: 'report_cash_wages', name: 'Report off-the-books pay', text: 'A tax auditor checks the payroll. If you are wrong, you get a warning.', role: 'tax_auditor', checks: ['off_books_payroll', 'no_workers_comp'] },
  ],
  ruleCards: [
    { id: 'sales_tax', title: 'Sales tax is not your money', text: 'NYC charges 8.875% on prepared food and drinks. You collect it for the state and file every quarter, 20 days after the quarter ends.', source: 'https://www.tax.ny.gov/bus/st/stidx.htm' },
    { id: 'workers_comp', title: 'Workers’ comp is mandatory', text: 'Every NY employer needs workers’ compensation and disability coverage. Without it: up to $2,000 for every 10 days.', source: 'https://www.wcb.ny.gov/content/main/Employers/Penalties.jsp' },
    { id: 'payroll_taxes', title: 'Payroll taxes', text: 'On top of wages you pay 7.65% Social Security and Medicare, plus federal and state unemployment insurance.', source: 'https://www.irs.gov/taxtopics/tc751' },
  ],
  roadmap: [
    { id: 'pick_concept', title: 'Pick your concept and run the numbers', text: 'Decide what you sell, to whom and at what price. Check the break-even before you sign anything.', kind: 'idea' },
    { id: 'form_llc', title: 'Form an LLC with New York State', text: 'File Articles of Organization online with the Department of State.', kind: 'legal', fee: 200, waitDays: 7, agency: 'NYS Department of State', link: 'https://dos.ny.gov/limited-liability-company-llc', ...{} },
    { id: 'get_ein', title: 'Get an EIN from the IRS', text: 'Free, online, in minutes. You need it for the bank and for payroll.', kind: 'legal', fee: 0, waitDays: 1, agency: 'IRS', link: 'https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number' },
    { id: 'sales_tax_registration', title: 'Register for sales tax (Certificate of Authority)', text: 'Register at least 20 days before you start selling.', kind: 'legal', fee: 0, waitDays: 20, agency: 'NYS Department of Taxation and Finance', link: 'https://www.tax.ny.gov/bus/st/register.htm' },
    { id: 'business_bank', title: 'Open a business bank account', text: 'Keep the business money apart from family money.', kind: 'money' },
    { id: 'insurance', title: 'Buy workers’ comp, disability and liability insurance', text: 'Required before your first employee starts.', kind: 'money', agency: 'NYS Workers’ Compensation Board', link: 'https://www.wcb.ny.gov/content/main/Employers/coverage.jsp' },
    { id: 'register_employer', title: 'Register as an employer with NYS Labor', text: 'Needed for unemployment insurance once you hire.', kind: 'people', agency: 'NYS Department of Labor', link: 'https://dol.ny.gov/unemployment-insurance-employers' },
  ],
  sources: [{ url: NYC_WAGE, title: 'NYS minimum wage', checked: '2026-11-14' }],
};

const setup: Pack['setup'] = [
  { id: 'espresso_machine', name: 'Two-group espresso machine', kind: 'equipment', cost: 12000, required: true, lifespanMonths: 84, qualityBonus: 0.03, ...EST },
  { id: 'grinder', name: 'Commercial grinder', kind: 'equipment', cost: 1800, required: true, lifespanMonths: 60, ...EST },
  { id: 'fridge', name: 'Undercounter refrigerator', kind: 'equipment', cost: 2600, required: true, lifespanMonths: 84, ...EST },
  { id: 'pos', name: 'POS terminal and printer', kind: 'equipment', cost: 1400, required: true, lifespanMonths: 48, ...EST },
  { id: 'dishwasher', name: 'Commercial dishwasher', kind: 'equipment', cost: 4200, required: false, lifespanMonths: 84, qualityBonus: 0.02, ...EST },
  { id: 'display_case', name: 'Pastry display case', kind: 'equipment', cost: 3600, required: false, lifespanMonths: 84, qualityBonus: 0.02, ...EST },
  { id: 'chair', name: 'Cafe chair', kind: 'furniture', cost: 95, required: true, scalesWithSize: true, lifespanMonths: 60, ...EST },
  { id: 'table_share', name: 'Table (per seat)', kind: 'furniture', cost: 120, required: true, scalesWithSize: true, lifespanMonths: 60, ...EST },
  { id: 'buildout_basic', name: 'Basic build-out: plumbing, counter, lighting', kind: 'buildout', cost: 18000, required: true, ...EST },
  { id: 'design_upgrade', name: 'Designer interior', kind: 'buildout', cost: 22000, required: false, qualityBonus: 0.06, ...EST },
  { id: 'signage', name: 'Storefront sign', kind: 'other', cost: 2500, required: false, ...EST },
  { id: 'security_deposit', name: 'Security deposit (3 months of rent)', kind: 'deposit', cost: 19500, required: true, ...EST },
  { id: 'opening_inventory', name: 'Opening stock: beans, milk, cups, pastries', kind: 'inventory', cost: 3500, required: true, ...EST },
  { id: 'fse_permit', name: 'Food Service Establishment Permit', kind: 'permit', cost: 280, required: true, waitDays: 21, agency: 'NYC DOHMH', link: FSE, withoutItViolation: 'no_fse_permit', source: FSE, confidence: 'verified', note: 'fee verified; wait is an estimate' },
  { id: 'food_protection_cert', name: 'Food Protection Certificate', kind: 'license', cost: 25, required: true, waitDays: 7, agency: 'NYC DOHMH', link: 'https://www.nyc.gov/site/doh/business/food-operators/food-protection-course.page', withoutItViolation: 'no_food_protection_cert', ...EST },
  { id: 'dob_alteration_permit', name: 'Alteration permit for the build-out', kind: 'permit', cost: 1500, required: true, waitDays: 30, agency: 'NYC Department of Buildings', link: 'https://www.nyc.gov/site/buildings/index.page', withoutItViolation: 'no_alteration_permit', ...EST },
];

const base = ['espresso_machine', 'grinder', 'fridge', 'pos', 'chair', 'table_share', 'buildout_basic', 'security_deposit', 'opening_inventory', 'fse_permit', 'food_protection_cert', 'dob_alteration_permit'];
const kit = (id: PackKit['id'], name: string, size: number, extra: { id: string; qty: number }[], pitch: string): PackKit => ({
  id, name, size, pitch,
  items: [...base.map((x) => ({ id: x, qty: x === 'chair' || x === 'table_share' ? size : 1 })), ...extra],
});

export const cafePack: Pack = {
  id: 'cafe', version: 1, name: 'Coffee shop', tagline: 'Espresso, pastries and a line out the door at 8am.', startCapital: 120000,
  unit: { name: 'order', refPrice: 7.5, priceMin: 4, priceMax: 14, cogsPerUnit: 2.1, ...EST },
  market: { unitsPerSlotMonth: 4200, priceElasticity: -1.4, weights: { price: 0.35, quality: 0.25, reputation: 0.2, location: 0.2 }, ...EST },
  capacity: { unitsPerStaffMonth: 1800, minStaff: 1, maxStaff: 8, hardCapUnits: null },
  sizing: { unitName: 'seat', min: 6, max: 40, default: 18, sqftPerUnit: 18, unitsServedPerSizeMonth: 150, takeawayShare: 0.55, cleaningCostPerSizeMonth: 10, crowdPenaltyAbove: 0.9, emptyPenaltyBelow: 0.3, ...EST },
  setup,
  kits: [
    kit('lean', 'Lean start', 12, [], 'Cheapest way to open: small room, the essentials only.'),
    kit('standard', 'Standard', 18, [{ id: 'dishwasher', qty: 1 }, { id: 'display_case', qty: 1 }, { id: 'signage', qty: 1 }], 'A full cafe with a pastry case and a sign people notice.'),
    kit('premium', 'Premium', 26, [{ id: 'dishwasher', qty: 1 }, { id: 'display_case', qty: 1 }, { id: 'signage', qty: 1 }, { id: 'design_upgrade', qty: 1 }], 'Designer room, more seats, higher prices.'),
  ],
  monthlyCosts: [
    { id: 'utilities', name: 'Electricity, gas and water', kind: 'utilities', basis: 'fixed', amount: 1100, ...EST },
    { id: 'liability_insurance', name: 'General liability insurance', kind: 'insurance', basis: 'fixed', amount: 260, ...EST },
    { id: 'workers_comp_premium', name: 'Workers’ comp and disability insurance', kind: 'insurance', basis: 'per_staff', amount: 110, ...EST },
    { id: 'card_fees', name: 'Card processing fees', kind: 'fees', basis: 'pct_revenue', amount: 0.029, ...EST },
    { id: 'cups_lids', name: 'Cups, lids and napkins', kind: 'supplies', basis: 'per_unit', amount: 0.28, ...EST },
    { id: 'pos_software', name: 'POS software', kind: 'fees', basis: 'fixed', amount: 120, ...EST },
    { id: 'internet_phone', name: 'Internet and phone', kind: 'utilities', basis: 'fixed', amount: 150, ...EST },
    { id: 'waste_carting', name: 'Commercial waste carting', kind: 'other', basis: 'fixed', amount: 260, ...EST },
    { id: 'pest_control', name: 'Pest control', kind: 'maintenance', basis: 'fixed', amount: 90, ...EST },
    { id: 'repairs', name: 'Repairs and equipment service', kind: 'maintenance', basis: 'fixed', amount: 220, ...EST },
    { id: 'accounting', name: 'Bookkeeping and accountant', kind: 'fees', basis: 'fixed', amount: 350, ...EST },
  ],
  staff: [
    { id: 'barista', name: 'Barista', hourlyWage: 18, hoursPerMonth: 160, licenseRequired: null, source: NYC_WAGE, confidence: 'estimate', note: 'NYC minimum wage 2026 is $17.00 (verified); cafes pay a little above' },
    { id: 'shift_lead', name: 'Shift lead', hourlyWage: 22, hoursPerMonth: 160, licenseRequired: 'food_protection_cert', ...EST },
  ],
  taxes: [
    { id: 'sales_tax', name: 'NYC sales tax', base: 'taxable_revenue', rate: 0.08875, due: 'quarterly', appliesIf: 'prepared food and drinks', source: 'https://www.tax.ny.gov/bus/st/stidx.htm', ...EST },
  ],
  levers: [
    { id: 'cleaning', name: 'Cleaning', options: [
      { id: 'standard', label: 'Close-down clean every night', monthlyCost: 450 },
      { id: 'full', label: 'Daily deep clean', monthlyCost: 900, effects: { quality: 0.05 } },
      { id: 'minimal', label: 'Wipe and go', monthlyCost: 150, effects: { quality: -0.05 }, causes: 'dirty_surfaces' },
    ] },
    { id: 'marketing', name: 'Marketing', options: [
      { id: 'none', label: 'Word of mouth', monthlyCost: 0 },
      { id: 'local', label: 'Local ads and flyers', monthlyCost: 600, effects: { demand: 0.05 } },
      { id: 'heavy', label: 'Social ads and promos', monthlyCost: 1800, effects: { demand: 0.12 } },
    ] },
    { id: 'beans', name: 'Coffee beans', options: [
      { id: 'house', label: 'House blend', monthlyCost: 0 },
      { id: 'specialty', label: 'Single-origin specialty', monthlyCost: 700, effects: { quality: 0.06, demand: 0.02 } },
    ] },
    { id: 'hours', name: 'Opening hours', options: [
      { id: 'standard', label: '7am–6pm', monthlyCost: 0 },
      { id: 'extended', label: '6am–9pm', monthlyCost: 1100, effects: { demand: 0.07, capacity: 0.1 } },
    ] },
  ],
  shortcuts: [
    { id: 'reuse_expired_dairy', name: 'Use milk past its date', what: 'Throw away less. A sick customer or an inspector ends it fast.', saves: { basis: 'pct_revenue', amount: 0.01 }, violation: 'spoiled_food' },
  ],
  violations: [
    { id: 'dirty_surfaces', name: 'Unsanitary food contact surfaces', law: 'NYC Health Code Article 81', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 600, perMonth: 100, max: 2000 }, reputationHit: 0.08, ...EST },
    { id: 'no_fse_permit', name: 'Operating without a food service permit', law: 'NYC Health Code §81.05', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 1000, perMonth: 500, max: null }, closureDays: 7, reputationHit: 0.1, ...EST },
    { id: 'no_food_protection_cert', name: 'No certified food protection supervisor', law: 'NYC Health Code §81.15', official: 'health_inspector', foundBy: ['inspection'], fine: { base: 300, max: 1000 }, ...EST },
    { id: 'no_alteration_permit', name: 'Build-out without a DOB permit', law: 'NYC Administrative Code §28-105.1', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 4000, max: 10000 }, ...EST },
    { id: 'spoiled_food', name: 'Food past its use-by date', law: 'NYC Health Code §81.07', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 500, perMonth: 200, pctOfSaved: 1, max: 5000 }, reputationHit: 0.1, ...EST },
  ],
  officials: [
    { id: 'health_inspector', name: 'Health inspector', agency: 'NYC DOHMH', role: 'inspector', checks: ['dirty_surfaces', 'no_fse_permit', 'no_food_protection_cert', 'no_alteration_permit', 'spoiled_food'], ...EST },
  ],
  reports: [
    { id: 'report_dirty', name: 'Report unsanitary conditions (311)', text: 'The Health Department sends an inspector. If you are wrong, you get a warning.', role: 'inspector', checks: ['dirty_surfaces', 'spoiled_food'] },
    { id: 'report_no_permit', name: 'Report a cafe open without a permit', text: 'An inspector checks the permits on the wall.', role: 'inspector', checks: ['no_fse_permit'] },
  ],
  events: [
    { id: 'coffee_price_spike', name: 'Coffee beans up 15%', effect: { field: 'cogsPerUnit', mult: 1.15 }, months: 2, ...EST },
  ],
  ruleCards: [
    { id: 'letter_grade', title: 'Letter grades', text: 'Every NYC restaurant posts an A, B or C from its last health inspection. Fewer violation points, better grade.', source: 'https://www.nyc.gov/site/doh/business/food-operators/letter-grading-for-restaurants.page' },
    { id: 'fse_permit', title: 'No permit, no coffee', text: 'You need a Food Service Establishment Permit before you sell. The fee is $280; opening without it means fines and closure.', source: FSE },
    { id: 'minimum_wage', title: 'Minimum wage in NYC', text: 'In 2026 the minimum wage in New York City is $17.00 an hour; overtime is $25.50.', source: NYC_WAGE },
  ],
  benchmarks: { cogsPct: 0.3, laborPct: 0.32, rentPct: 0.1, netMarginPct: 0.06, source: 'https://bellwethercoffee.com/blog/coffee-shop-profit-margins', confidence: 'estimate', note: 'coffee shop ranges: COGS 25–35%, labor 30–40%, rent 8–15%, net 2.5–7% (vendor blogs; see research/reports/04-analytics.md)' },
  suppliers: [
    { id: 'coffee_beans', category: 'Coffee', what: 'Wholesale roasted beans, often with free grinder and machine service', whereToFind: 'Local wholesale roasters; ask cafes you like who supplies them', ...EST },
    { id: 'dairy', category: 'Milk and alt-milk', what: 'Daily dairy delivery and oat or almond milk by the case', whereToFind: 'Regional dairy distributors and food-service wholesalers', ...EST },
    { id: 'pastries', category: 'Pastries', what: 'Morning delivery of croissants and baked goods', whereToFind: 'Wholesale bakeries that deliver to cafes before 7am', ...EST },
    { id: 'equipment', category: 'Equipment', what: 'Espresso machines, grinders, refrigeration, used or new', whereToFind: 'Restaurant equipment dealers; used-equipment auctions', ...EST },
    { id: 'paper_goods', category: 'Cups and packaging', what: 'Cups, lids, sleeves and bags', whereToFind: 'Food-service packaging distributors and cash-and-carry stores', ...EST },
    { id: 'cleaning', category: 'Cleaning and pest control', what: 'Sanitizers, pest control contract, grease trap service', whereToFind: 'Licensed pest control firms; janitorial supply wholesalers', ...EST },
  ],
  roadmap: [
    { id: 'find_space', title: 'Find a storefront that allows a cafe', text: 'Check the Certificate of Occupancy allows eating and drinking before you sign.', kind: 'space', agency: 'NYC Department of Buildings', link: 'https://www.nyc.gov/site/buildings/index.page' },
    { id: 'sign_lease', title: 'Sign the lease and pay the deposit', text: 'Landlords usually ask for about three months of rent up front.', kind: 'space', setupItemId: 'security_deposit' },
    { id: 'alteration_permit', title: 'Get a DOB permit for the build-out', text: 'Plumbing, counters and lighting need an alteration permit.', kind: 'permit', setupItemId: 'dob_alteration_permit', fee: 1500, waitDays: 30, agency: 'NYC Department of Buildings', link: 'https://www.nyc.gov/site/buildings/index.page' },
    { id: 'fse_permit', title: 'Get your Food Service Establishment Permit', text: 'Apply online before you build out. An inspector visits before you open.', kind: 'permit', setupItemId: 'fse_permit', fee: 280, waitDays: 21, agency: 'NYC DOHMH', link: FSE },
    { id: 'food_protection', title: 'Pass the Food Protection course', text: 'Someone on every shift needs the certificate.', kind: 'permit', setupItemId: 'food_protection_cert', fee: 25, waitDays: 7, agency: 'NYC DOHMH', link: 'https://www.nyc.gov/site/doh/business/food-operators/food-protection-course.page' },
    { id: 'buy_equipment', title: 'Buy equipment and furniture', text: 'Espresso machine, grinder, refrigeration, seats.', kind: 'supplier', setupItemId: 'espresso_machine' },
    { id: 'open_accounts', title: 'Open supplier accounts', text: 'Beans, dairy, pastries and cups — line up two suppliers for each.', kind: 'supplier', setupItemId: 'opening_inventory' },
    { id: 'hire', title: 'Hire baristas', text: 'Pay at least $17.00 an hour in NYC.', kind: 'people' },
    { id: 'soft_open', title: 'Soft-open to friends and neighbors', text: 'Run a few days at half speed before the grand opening.', kind: 'launch' },
  ],
  manager: { monthlySalary: 5200, ...EST },
  sources: [{ url: FSE, title: 'NYC Food Service Establishment Permit', checked: '2026-11-14' }, { url: NYC_WAGE, title: 'NYS minimum wage', checked: '2026-11-14' }],
};

export const places: Place[] = [
  { id: 'p_bedford_212', address: '212 Bedford Ave, Brooklyn', block: 'bedford-n6-n7', lat: 40.7178, lng: -73.9579, kind: 'storefront', sqft: 820, tier: 'prime', rentPerSqftYear: 95, footTraffic: 0.7, suitableFor: ['cafe', 'barbershop', 'bodega'], note: 'fixture' },
  { id: 'p_bedford_230', address: '230 Bedford Ave, Brooklyn', block: 'bedford-n6-n7', lat: 40.7172, lng: -73.9584, kind: 'storefront', sqft: 760, tier: 'prime', rentPerSqftYear: 92, footTraffic: 0.68, suitableFor: ['cafe', 'barbershop'], note: 'fixture' },
  { id: 'p_bedford_198', address: '198 Bedford Ave, Brooklyn', block: 'bedford-n6-n7', lat: 40.7183, lng: -73.9575, kind: 'storefront', sqft: 640, tier: 'prime', rentPerSqftYear: 90, footTraffic: 0.66, suitableFor: ['barbershop', 'cafe'], note: 'fixture' },
  { id: 'p_grand_450', address: '450 Grand St, Brooklyn', block: 'grand-union', lat: 40.7115, lng: -73.9505, kind: 'storefront', sqft: 1400, tier: 'mid', rentPerSqftYear: 62, footTraffic: 0.3, suitableFor: ['cafe', 'bodega'], note: 'fixture' },
  { id: 'p_graham_102', address: '102 Graham Ave, Brooklyn', block: 'graham-sv', lat: 40.7055, lng: -73.9431, kind: 'storefront', sqft: 600, tier: 'cheap', rentPerSqftYear: 48, footTraffic: 0.45, suitableFor: ['cafe', 'barbershop', 'bodega'], note: 'fixture' },
];

export const sampleCtx = () => ({ packs: { common: commonPack, niches: { cafe: cafePack } }, places });

export function defaultOrders(over: Partial<StandingOrders> = {}): StandingOrders {
  return { price: 7.5, staff: { barista: 3 }, levers: {}, shortcuts: [], blockFund: false, autopilot: 'hold', ...over };
}

export interface BizOpts {
  id: string; name?: string; niche?: NicheId; placeId: string; kitId?: PackKit['id']; size?: number;
  orders?: Partial<StandingOrders>; status?: BusinessState['status']; cash?: number; isAi?: boolean; day?: number;
}

/** Бизнес, открытый по набору пакета кафе (без проверки площади: это делает рекомендация). */
export function makeBusiness(o: BizOpts): BusinessState {
  const pack = cafePack;
  const k = pack.kits.find((x) => x.id === (o.kitId ?? 'standard'))!;
  const size = o.size ?? k.size;
  const items = k.items.map((it) => ({ id: it.id, qty: pack.setup.find((s) => s.id === it.id)?.scalesWithSize ? size : it.qty }));
  const spent = itemsCost(pack, items, size);
  const day = o.day ?? 1;
  return {
    id: o.id, name: o.name ?? 'Test Cafe', niche: o.niche ?? 'cafe', placeId: o.placeId, isAi: o.isAi ?? false,
    owners: [{ playerId: `pl_${o.id}`, share: 1 }], managerPlayerId: `pl_${o.id}`,
    status: o.status ?? 'open', createdDay: day, openedDay: (o.status ?? 'open') === 'open' ? day : undefined,
    cash: o.cash ?? pack.startCapital - spent, size, items, setupSpent: spent,
    permits: pack.setup.filter((s) => s.waitDays && items.some((i) => i.id === s.id)).map((s) => ({ itemId: s.id, appliedDay: day - 40, readyDay: day - 40 + (s.waitDays ?? 0) })),
    quality: 0.5, reputation: 0.5, trust: { kept: 0, broken: 0 },
    orders: defaultOrders(o.orders), trails: [], liabilities: [],
    mtd: { lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } }, days: [], history: [],
  };
}

export function makeWorld(businesses: BusinessState[], day = 0): WorldState {
  return {
    config: { id: 'test', name: 'Test city', city: 'nyc', seasonMonths: 12, dayMs: 2000, paused: false, maxOwners: 100, aiBusinessesTarget: 10, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05, nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 11 },
    phase: 'running', day, version: 1, bank: 0,
    players: businesses.map((b) => ({ id: b.managerPlayerId, name: b.name, kind: 'owner' as const, isAi: b.isAi, paid: !b.isAi, joinedDay: 1, lastSeenDay: 1, inbox: [] })),
    businesses,
    officials: [{ id: 'off_ai_1', playerId: 'pl_off_ai_1', name: 'Inspector Reyes (AI)', isAi: true, role: 'inspector', points: 0, casesClosed: 0, bribesTaken: 0, bribesThisMonth: 0, exposed: false }],
    deals: [], cases: [], blockFunds: [], weather: [], events: [], feed: [], standings: [],
  };
}

/** Город для демо и тестов: моё кафе, ИИ-кафе по соседству, барбершоп рядом и кафе на тихой улице. */
export function sampleWorld(): WorldState {
  const me = makeBusiness({ id: 'b_me', name: 'Morning Ritual', placeId: 'p_bedford_212' });
  const luna = makeBusiness({ id: 'b_luna', name: 'Luna Coffee (AI)', placeId: 'p_bedford_230', isAi: true, orders: { price: 7.0 } });
  const fade: BusinessState = { ...makeBusiness({ id: 'b_fade', name: 'Fade Room (AI)', placeId: 'p_bedford_198', isAi: true }), niche: 'barbershop', items: [], setupSpent: 0 };
  const grand = makeBusiness({ id: 'b_grand', name: 'Grand Brew (AI)', placeId: 'p_grand_450', isAi: true, size: 30 });
  return makeWorld([me, luna, fade, grand], 0);
}
