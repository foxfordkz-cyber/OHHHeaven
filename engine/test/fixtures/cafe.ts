// Test pack for a small NYC coffee shop until agent 14's packs/cafe.json lands in the main branch.
// Market and capacity follow research/reports/43-economy-sim.md (section 7), scaled to a NYC storefront;
// money numbers are NYC 2026 estimates (confidence: 'estimate', reasoning in `note`). Not a source of truth for the game.
import type { Pack } from '@ohh/shared';

const EST = 'estimate' as const;
const DOL = 'https://dol.ny.gov/minimum-wage-0';
const DTF_SALES = 'https://www.tax.ny.gov/bus/st/stidx.htm';

export const cafePack: Pack = {
  id: 'cafe', version: 1, name: 'Coffee shop', tagline: 'Espresso, pastries and a line at 8 am',
  startCapital: 150_000,
  unit: { name: 'order', refPrice: 6.5, priceMin: 3, priceMax: 12, cogsPerUnit: 1.9, confidence: EST, note: 'Report 43: std cup $1.80 at index 1.0; +$0.10 for NYC milk and pastry mix' },
  market: {
    unitsPerSlotMonth: 6000, priceElasticity: -1.4,
    weights: { price: 0.35, quality: 0.25, reputation: 0.2, location: 0.2 },
    confidence: EST, note: 'About 200 orders a day for a small NYC cafe; elasticity and weights from build/PACK.md example',
  },
  capacity: { unitsPerStaffMonth: 1800, minStaff: 1, maxStaff: 8, hardCapUnits: null, note: 'Report 43: 1,400 per worker + 500 by the owner, rounded up for a two-person shift' },
  sizing: {
    unitName: 'seat', min: 6, max: 40, default: 18, sqftPerUnit: 18, unitsServedPerSizeMonth: 220, takeawayShare: 0.45,
    cleaningCostPerSizeMonth: 12, crowdPenaltyAbove: 0.9, emptyPenaltyBelow: 0.4,
    confidence: EST, note: '18 sq ft per seat with aisles; a seat turns about 7 times a day; 45% take-away',
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
    { id: 'opening_inventory', name: 'Opening stock (beans, milk, cups)', kind: 'inventory', cost: 3_000, required: true, confidence: EST },
    { id: 'fse_permit', name: 'Food Service Establishment Permit', kind: 'permit', cost: 280, required: true, waitDays: 21, agency: 'NYC DOHMH', link: 'https://www.nyc.gov/site/doh/business/permits-and-licenses/food-service-establishments.page', withoutItViolation: 'no_fse_permit', confidence: EST },
    { id: 'food_protection_cert', name: 'Food Protection Certificate', kind: 'license', cost: 115, required: true, waitDays: 7, agency: 'NYC DOHMH', withoutItViolation: 'no_food_protection', confidence: EST },
  ],
  kits: [
    { id: 'lean', name: 'Lean start', size: 12, pitch: 'Small room, one grinder, no pastry case.', items: [
      { id: 'lease_deposit', qty: 1 }, { id: 'buildout', qty: 1 }, { id: 'espresso_machine', qty: 1 }, { id: 'grinder', qty: 1 }, { id: 'refrigeration', qty: 1 },
      { id: 'dishwasher', qty: 1 }, { id: 'pos_system', qty: 1 }, { id: 'counter', qty: 1 }, { id: 'seat', qty: 12 }, { id: 'signage', qty: 1 },
      { id: 'opening_inventory', qty: 1 }, { id: 'fse_permit', qty: 1 }, { id: 'food_protection_cert', qty: 1 }] },
    { id: 'standard', name: 'Standard', size: 18, pitch: 'Two grinders, a pastry case, 18 seats.', items: [
      { id: 'lease_deposit', qty: 1 }, { id: 'buildout', qty: 1 }, { id: 'espresso_machine', qty: 1 }, { id: 'grinder', qty: 2 }, { id: 'refrigeration', qty: 1 },
      { id: 'pastry_case', qty: 1 }, { id: 'dishwasher', qty: 1 }, { id: 'pos_system', qty: 1 }, { id: 'counter', qty: 1 }, { id: 'seat', qty: 18 },
      { id: 'signage', qty: 1 }, { id: 'opening_inventory', qty: 1 }, { id: 'fse_permit', qty: 1 }, { id: 'food_protection_cert', qty: 1 }] },
    { id: 'premium', name: 'Premium', size: 24, pitch: 'Three grinders, a pastry case, 24 seats.', items: [
      { id: 'lease_deposit', qty: 1 }, { id: 'buildout', qty: 1 }, { id: 'espresso_machine', qty: 1 }, { id: 'grinder', qty: 3 }, { id: 'refrigeration', qty: 1 },
      { id: 'pastry_case', qty: 1 }, { id: 'dishwasher', qty: 1 }, { id: 'pos_system', qty: 1 }, { id: 'counter', qty: 1 }, { id: 'seat', qty: 24 },
      { id: 'signage', qty: 1 }, { id: 'opening_inventory', qty: 1 }, { id: 'fse_permit', qty: 1 }, { id: 'food_protection_cert', qty: 1 }] },
  ],
  monthlyCosts: [
    { id: 'rent', name: 'Rent (fallback when the place has no rent)', kind: 'rent', basis: 'fixed', amount: 6_000, confidence: EST },
    { id: 'utilities', name: 'Electricity, gas and water', kind: 'utilities', basis: 'fixed', amount: 950, confidence: EST },
    { id: 'insurance', name: 'General liability and property insurance', kind: 'insurance', basis: 'fixed', amount: 250, confidence: EST },
    { id: 'cups', name: 'Cups, lids and napkins', kind: 'supplies', basis: 'per_unit', amount: 0.12, confidence: EST },
    { id: 'card_fees', name: 'Card processing', kind: 'fees', basis: 'pct_revenue', amount: 0.029, confidence: EST, note: 'About 2.6% + 10 cents per swipe' },
    { id: 'pos_software', name: 'POS software', kind: 'fees', basis: 'fixed', amount: 120, confidence: EST },
    { id: 'carting', name: 'Commercial waste carting', kind: 'other', basis: 'fixed', amount: 250, confidence: EST },
    { id: 'pest_control', name: 'Pest control', kind: 'maintenance', basis: 'fixed', amount: 90, confidence: EST },
    { id: 'bookkeeping', name: 'Bookkeeper', kind: 'fees', basis: 'fixed', amount: 350, confidence: EST },
    { id: 'local_marketing', name: 'Listings and social media', kind: 'marketing', basis: 'fixed', amount: 200, confidence: EST },
    { id: 'equipment_service', name: 'Equipment service', kind: 'maintenance', basis: 'fixed', amount: 200, confidence: EST },
    { id: 'seat_upkeep', name: 'Table service and wear per seat', kind: 'maintenance', basis: 'per_size', amount: 15, confidence: EST },
  ],
  staff: [
    { id: 'barista', name: 'Barista', hourlyWage: 17, hoursPerMonth: 140, source: DOL, confidence: EST, note: 'NYC minimum wage 2026 is $17.00' },
    { id: 'shift_lead', name: 'Shift lead', hourlyWage: 21, hoursPerMonth: 160, confidence: EST },
  ],
  taxes: [
    { id: 'sales_tax', name: 'NYC sales tax', base: 'taxable_revenue', rate: 0.08875, due: 'quarterly', appliesIf: 'prepared food and drinks', source: DTF_SALES, confidence: EST, note: '4% state + 4.5% city + 0.375% MCTD' },
  ],
  levers: [
    { id: 'cleaning', name: 'Cleaning', options: [
      { id: 'nightly', label: 'Nightly crew', monthlyCost: 450 },
      { id: 'deep', label: 'Nightly crew + weekly deep clean', monthlyCost: 900, effects: { quality: 0.05 } },
      { id: 'minimal', label: 'Wipe and go', monthlyCost: 150, effects: { quality: -0.05 }, causes: 'dirty_surfaces' }] },
    { id: 'beans', name: 'Beans', options: [
      { id: 'house', label: 'House blend', monthlyCost: 0 },
      { id: 'specialty', label: 'Specialty roaster', monthlyCost: 600, effects: { quality: 0.06 } }] },
    { id: 'hours', name: 'Opening hours', options: [
      { id: 'standard', label: '7 am – 7 pm', monthlyCost: 0 },
      { id: 'extended', label: '6 am – 9 pm', monthlyCost: 700, effects: { demand: 0.07 } }] },
    { id: 'wifi', name: 'Wi-Fi', options: [
      { id: 'free', label: 'Free Wi-Fi', monthlyCost: 90, effects: { demand: 0.02 } },
      { id: 'none', label: 'No Wi-Fi', monthlyCost: 0 }] },
  ],
  shortcuts: [
    { id: 'skip_pest_control', name: 'Skip pest control', what: 'Saves the monthly visit. Mice find you first.', saves: { basis: 'fixed', amount: 90 }, violation: 'pests' },
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
  benchmarks: { cogsPct: 0.3, laborPct: 0.3, rentPct: 0.12, netMarginPct: 0.08, confidence: EST, note: 'Report 43 ranges: COGS 24–34%, labour 30–35%, rent 6–15%, margin 2.5–15%' },
  suppliers: [
    { id: 'coffee_beans', category: 'Coffee', what: 'Wholesale roasted beans', whereToFind: 'Local wholesale roasters', confidence: EST },
  ],
  roadmap: [
    { id: 'get_fse_permit', title: 'Get your Food Service Establishment Permit', text: 'Apply online before you build out.', kind: 'permit', setupItemId: 'fse_permit', fee: 280, waitDays: 21, agency: 'NYC DOHMH' },
  ],
  manager: { monthlySalary: 4_800, confidence: EST },
  sources: [
    { url: DOL, title: 'NY minimum wage', checked: '2026-11-14' },
    { url: DTF_SALES, title: 'NYS sales tax', checked: '2026-11-14' },
  ],
  extra: { taxableShare: 0.9, weekdayMult: [1, 1, 1, 1, 1, 1.15, 0.9] },
};
