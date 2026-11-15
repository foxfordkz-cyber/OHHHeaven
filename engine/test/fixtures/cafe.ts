// Test pack for a small NYC coffee shop until agent 14's packs/cafe.json lands in the main branch.
// Money and volume follow the base month of the user's notes research/market/notes/Стоимость кофейни Нью Йорка 2026/economics.md
// (800 sq ft in Brooklyn, counter service: 200 checks a day × $8.50, COGS 28%, four baristas at $21 + owner-manager hours at $30,
// opex $3,459, card fees 4.14%, rent $6,000): an honest standard cafe earns about +$4,000 a month there.
// The notes call these numbers 2026 model assumptions, so every line stays confidence: 'estimate'. Not a source of truth for the game.
import type { Pack } from '@ohh/shared';

const EST = 'estimate' as const;
const NOTES = 'research/market/notes/Стоимость кофейни Нью Йорка 2026/economics.md';
const DOL = 'https://dol.ny.gov/minimum-wage-0';
const DTF_SALES = 'https://www.tax.ny.gov/bus/st/stidx.htm';
const SQUARE = 'https://squareup.com/us/en/pricing';

export const cafePack: Pack = {
  id: 'cafe', version: 2, name: 'Coffee shop', tagline: 'Espresso, pastries and a line at 8 am',
  startCapital: 150_000,
  unit: { name: 'order', refPrice: 8.5, priceMin: 3, priceMax: 15, cogsPerUnit: 2.21, source: NOTES, confidence: EST, note: 'Net check $8.50; ingredients, food and spoilage 26% of sales (cups are a separate 2% line)' },
  market: {
    unitsPerSlotMonth: 6000, priceElasticity: -1.4,
    weights: { price: 0.35, quality: 0.25, reputation: 0.2, location: 0.2 },
    source: NOTES, confidence: EST, note: '200 checks a day × 30 days on an average block; elasticity and weights from build/PACK.md example',
  },
  capacity: { unitsPerStaffMonth: 1500, minStaff: 1, maxStaff: 8, hardCapUnits: null, note: 'Five people on payroll (four baristas and a shift lead) cover 12 hours a day and about 250 orders; the notes staff for coverage, not speed' },
  sizing: {
    unitName: 'seat', min: 6, max: 40, default: 20, sqftPerUnit: 18, unitsServedPerSizeMonth: 150, takeawayShare: 0.6,
    cleaningCostPerSizeMonth: 10, crowdPenaltyAbove: 0.9, emptyPenaltyBelow: 0.4,
    source: NOTES, confidence: EST, note: '800 sq ft with 15–25 seats; counter service, most orders to go. $10 a seat a month (linens, supplies, wear) is $200 of the $400 cleaning line of the notes at 20 seats; the rest is the cleaning lever',
  },
  setup: [
    { id: 'lease_deposit', name: 'Security deposit (3 months)', kind: 'deposit', cost: 18_000, required: true, confidence: EST, note: '3 × $6,000 rent' },
    { id: 'buildout', name: 'Light build-out of a former food space', kind: 'buildout', cost: 45_000, required: true, confidence: EST, note: 'About $55 per sq ft for 800 sq ft' },
    { id: 'espresso_machine', name: 'Two-group espresso machine', kind: 'equipment', cost: 12_000, required: true, lifespanMonths: 84, qualityBonus: 0.04, confidence: EST },
    { id: 'grinder', name: 'Espresso grinder', kind: 'equipment', cost: 1_500, required: true, lifespanMonths: 60, qualityBonus: 0.01, confidence: EST },
    { id: 'refrigeration', name: 'Under-counter fridges', kind: 'equipment', cost: 3_500, required: true, lifespanMonths: 96, confidence: EST },
    { id: 'pastry_case', name: 'Refrigerated pastry case', kind: 'equipment', cost: 2_800, required: false, lifespanMonths: 96, qualityBonus: 0.02, confidence: EST },
    { id: 'dishwasher', name: 'Commercial dishwasher', kind: 'equipment', cost: 4_500, required: true, lifespanMonths: 84, confidence: EST },
    { id: 'pos_system', name: 'POS terminal and printer', kind: 'equipment', cost: 1_500, required: true, lifespanMonths: 48, confidence: EST },
    { id: 'counter', name: 'Service counter', kind: 'furniture', cost: 6_000, required: true, lifespanMonths: 120, confidence: EST },
    { id: 'seat', name: 'Seat with a share of a table', kind: 'furniture', cost: 220, required: true, scalesWithSize: true, lifespanMonths: 60, confidence: EST, note: 'Chair $85 + half of a two-top $270' },
    { id: 'signage', name: 'Storefront sign', kind: 'other', cost: 2_500, required: true, confidence: EST },
    { id: 'opening_inventory', name: 'Opening stock (beans, milk, cups)', kind: 'inventory', cost: 5_000, required: true, source: NOTES, confidence: EST, note: 'Beans $1,000, tea and syrups $600, milk and food $900, cups $1,200, chemicals $500, reserve $800' },
    { id: 'fse_permit', name: 'Food Service Establishment Permit', kind: 'permit', cost: 280, required: true, waitDays: 21, agency: 'NYC DOHMH', link: 'https://www.nyc.gov/site/doh/business/permits-and-licenses/food-service-establishments.page', withoutItViolation: 'no_fse_permit', confidence: EST },
    { id: 'food_protection_cert', name: 'Food Protection Certificate', kind: 'license', cost: 115, required: true, waitDays: 7, agency: 'NYC DOHMH', withoutItViolation: 'no_food_protection', confidence: EST },
  ],
  kits: [
    { id: 'lean', name: 'Lean start', size: 14, pitch: 'Small room, one grinder, no pastry case.', items: [
      { id: 'lease_deposit', qty: 1 }, { id: 'buildout', qty: 1 }, { id: 'espresso_machine', qty: 1 }, { id: 'grinder', qty: 1 }, { id: 'refrigeration', qty: 1 },
      { id: 'dishwasher', qty: 1 }, { id: 'pos_system', qty: 1 }, { id: 'counter', qty: 1 }, { id: 'seat', qty: 14 }, { id: 'signage', qty: 1 },
      { id: 'opening_inventory', qty: 1 }, { id: 'fse_permit', qty: 1 }, { id: 'food_protection_cert', qty: 1 }] },
    { id: 'standard', name: 'Standard', size: 20, pitch: 'Two grinders, a pastry case, 20 seats.', items: [
      { id: 'lease_deposit', qty: 1 }, { id: 'buildout', qty: 1 }, { id: 'espresso_machine', qty: 1 }, { id: 'grinder', qty: 2 }, { id: 'refrigeration', qty: 1 },
      { id: 'pastry_case', qty: 1 }, { id: 'dishwasher', qty: 1 }, { id: 'pos_system', qty: 1 }, { id: 'counter', qty: 1 }, { id: 'seat', qty: 20 },
      { id: 'signage', qty: 1 }, { id: 'opening_inventory', qty: 1 }, { id: 'fse_permit', qty: 1 }, { id: 'food_protection_cert', qty: 1 }] },
    { id: 'premium', name: 'Premium', size: 26, pitch: 'Three grinders, a pastry case, 26 seats.', items: [
      { id: 'lease_deposit', qty: 1 }, { id: 'buildout', qty: 1 }, { id: 'espresso_machine', qty: 1 }, { id: 'grinder', qty: 3 }, { id: 'refrigeration', qty: 1 },
      { id: 'pastry_case', qty: 1 }, { id: 'dishwasher', qty: 1 }, { id: 'pos_system', qty: 1 }, { id: 'counter', qty: 1 }, { id: 'seat', qty: 26 },
      { id: 'signage', qty: 1 }, { id: 'opening_inventory', qty: 1 }, { id: 'fse_permit', qty: 1 }, { id: 'food_protection_cert', qty: 1 }] },
  ],
  // Opex of the notes: $3,459 a month without rent, COGS, labour and card fees; their $400 chemicals and deep clean is the cleaning
  // lever ($200) plus $10 a seat (sizing.cleaningCostPerSizeMonth × 20 seats).
  monthlyCosts: [
    { id: 'rent', name: 'Rent (fallback when the place has no rent)', kind: 'rent', basis: 'fixed', amount: 6_000, source: NOTES, confidence: EST },
    { id: 'utilities', name: 'Electricity, gas and water', kind: 'utilities', basis: 'fixed', amount: 1_100, source: NOTES, confidence: EST },
    { id: 'insurance', name: 'Business owner policy (liability and property)', kind: 'insurance', basis: 'fixed', amount: 250, source: NOTES, confidence: EST },
    { id: 'cups', name: 'Cups, lids, napkins and bags', kind: 'supplies', basis: 'per_unit', amount: 0.17, source: NOTES, confidence: EST, note: '2% of an $8.50 check' },
    { id: 'card_fees', name: 'Card processing', kind: 'fees', basis: 'pct_revenue', amount: 0.0414, source: SQUARE, confidence: EST, note: '90% paid by card at 2.5% + 15 cents, on sales plus sales tax and card tips: 4.14% of net sales' },
    { id: 'internet', name: 'Internet and phone', kind: 'utilities', basis: 'fixed', amount: 100, source: NOTES, confidence: EST },
    { id: 'pest_control', name: 'Pest control', kind: 'maintenance', basis: 'fixed', amount: 175, source: NOTES, confidence: EST },
    { id: 'carting', name: 'Private waste and recycling', kind: 'other', basis: 'fixed', amount: 250, source: NOTES, confidence: EST },
    { id: 'pos_software', name: 'POS subscription', kind: 'fees', basis: 'fixed', amount: 49, source: SQUARE, confidence: EST },
    { id: 'bookkeeping', name: 'Bookkeeping and year-end CPA', kind: 'fees', basis: 'fixed', amount: 400, source: NOTES, confidence: EST },
    { id: 'payroll_software', name: 'Payroll software', kind: 'fees', basis: 'fixed', amount: 85, source: NOTES, confidence: EST },
    { id: 'local_marketing', name: 'Listings, website and printing', kind: 'marketing', basis: 'fixed', amount: 300, source: NOTES, confidence: EST },
    { id: 'equipment_service', name: 'Filters, descaling and equipment service', kind: 'maintenance', basis: 'fixed', amount: 300, source: NOTES, confidence: EST },
    { id: 'permit_fees', name: 'Annual permits and fees (monthly share)', kind: 'fees', basis: 'fixed', amount: 50, source: NOTES, confidence: EST },
  ],
  staff: [
    { id: 'barista', name: 'Barista', hourlyWage: 21, hoursPerMonth: 160, source: NOTES, confidence: EST, note: '640 barista hours × $21 in the notes; NYC minimum wage 2026 is $17.00 (' + DOL + ')' },
    { id: 'shift_lead', name: 'Shift lead', hourlyWage: 30, hoursPerMonth: 160, source: NOTES, confidence: EST, note: 'The owner-manager hours of the notes, 160 × $30, priced as a hired shift lead' },
  ],
  taxes: [
    { id: 'sales_tax', name: 'NYC sales tax', base: 'taxable_revenue', rate: 0.08875, due: 'quarterly', appliesIf: 'prepared food and drinks', source: DTF_SALES, confidence: EST, note: '4% state + 4.5% city + 0.375% MCTD' },
  ],
  levers: [
    { id: 'cleaning', name: 'Cleaning', options: [
      { id: 'standard', label: 'Staff cleans daily, deep clean monthly', monthlyCost: 200 },
      { id: 'deep', label: 'Professional deep clean every week', monthlyCost: 600, effects: { quality: 0.05 } },
      { id: 'minimal', label: 'Wipe and go', monthlyCost: 0, effects: { quality: -0.05 }, causes: 'dirty_surfaces' }] },
    { id: 'beans', name: 'Beans', options: [
      { id: 'house', label: 'House blend', monthlyCost: 0 },
      { id: 'specialty', label: 'Specialty roaster', monthlyCost: 600, effects: { quality: 0.06 } }] },
    { id: 'hours', name: 'Opening hours', options: [
      { id: 'standard', label: '7 am – 7 pm', monthlyCost: 0 },
      { id: 'extended', label: '6 am – 9 pm', monthlyCost: 700, effects: { demand: 0.07 } }] },
    { id: 'wifi', name: 'Wi-Fi', options: [
      { id: 'free', label: 'Free Wi-Fi for guests', monthlyCost: 0, effects: { demand: 0.02 } },
      { id: 'none', label: 'No Wi-Fi', monthlyCost: 0 }] },
  ],
  shortcuts: [
    { id: 'skip_pest_control', name: 'Skip pest control', what: 'Saves the monthly visit. Mice find you first.', saves: { basis: 'fixed', amount: 175 }, violation: 'pests' },
  ],
  violations: [
    { id: 'no_fse_permit', name: 'Operating without a food service permit', law: 'NYC Health Code §81.05', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 1000, perMonth: 0, pctOfSaved: 0, max: 2000 }, closureDays: 3, confidence: EST },
    { id: 'no_food_protection', name: 'No certified food protection supervisor', law: 'NYC Health Code §81.15', official: 'health_inspector', foundBy: ['inspection'], fine: { base: 300, max: 600 }, confidence: EST },
    { id: 'dirty_surfaces', name: 'Food contact surfaces not clean', law: 'NYC Health Code §81.17', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 300, perMonth: 50, max: 1000 }, confidence: EST },
    { id: 'pests', name: 'Evidence of mice or roaches', law: 'NYC Health Code §81.23', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 300, perMonth: 100, max: 2000 }, closureDays: 2, confidence: EST },
  ],
  officials: [
    { id: 'health_inspector', name: 'Health inspector', agency: 'NYC DOHMH', role: 'inspector', checks: ['no_fse_permit', 'no_food_protection', 'dirty_surfaces', 'pests'] },
  ],
  reports: [
    { id: 'report_dirty_kitchen', name: 'Report unsanitary conditions (311)', text: 'The Health Department sends an inspector.', role: 'inspector', checks: ['dirty_surfaces', 'pests'] },
  ],
  events: [
    { id: 'coffee_price_spike', name: 'Coffee beans up 15%', effect: { field: 'cogsPerUnit', mult: 1.15 }, months: 2, confidence: EST },
  ],
  ruleCards: [
    { id: 'letter_grade', title: 'Letter grades', text: 'NYC restaurants post an A, B or C after each inspection.', source: 'https://www.nyc.gov/site/doh/services/restaurant-grades.page' },
  ],
  benchmarks: { cogsPct: 0.28, laborPct: 0.41, rentPct: 0.12, netMarginPct: 0.08, source: NOTES, confidence: EST, note: 'Base month of the notes: COGS 28%, loaded labour 41%, rent 11.8%, cash operating surplus 8.1%' },
  suppliers: [
    { id: 'coffee_beans', category: 'Coffee', what: 'Wholesale roasted beans', whereToFind: 'Local wholesale roasters', confidence: EST },
  ],
  roadmap: [
    { id: 'get_fse_permit', title: 'Get your Food Service Establishment Permit', text: 'Apply online before you build out.', kind: 'permit', setupItemId: 'fse_permit', fee: 280, waitDays: 21, agency: 'NYC DOHMH' },
  ],
  manager: { monthlySalary: 4_800, source: NOTES, confidence: EST },
  sources: [
    { url: DOL, title: 'NY minimum wage', checked: '2026-11-14' },
    { url: DTF_SALES, title: 'NYS sales tax', checked: '2026-11-14' },
    { url: SQUARE, title: 'Square pricing', checked: '2026-11-14' },
  ],
  extra: { taxableShare: 0.9, weekdayMult: [1, 1, 1, 1, 1, 1.15, 0.9] },
};
