// STUB packs for agent 07's simulator. Replace with packs/cafe.json, packs/barbershop.json and
// packs/_common.json from agents 14–15 when they land in the main branch.
// Numbers are estimates for balance work unless a source is given; they are not facts for the game UI.
import type { CommonPack, Pack, PackSet } from '../../../shared/src/types';

const EST = { confidence: 'estimate' as const, note: 'agent 07 stub; replace with agent 14/15 pack' };
const MINWAGE_NYC_2026 = { confidence: 'estimate' as const, note: 'NYC minimum wage $17.00 from 2026-01-01 per NY Labor Law §652 schedule; link to be added by agent 14' };

export const commonPack: CommonPack = {
  id: '_common', version: 1, name: 'Common NYC rules (stub)',
  taxes: [
    { id: 'employer_payroll', name: 'Employer payroll taxes', base: 'payroll', rate: 0.1, due: 'monthly', ...EST, note: 'FICA 7.65% + NY SUI/FUTA/MCTMT/DBL/PFL ≈ 10% (estimate)' },
    { id: 'income_tax', name: 'Owner income taxes (SE + UBT, simplified)', base: 'profit', rate: 0.25, due: 'quarterly', ...EST },
  ],
  shortcuts: [
    { id: 'cash_wages', name: 'Pay staff in cash, off the books', what: 'No payroll taxes this month.', saves: { basis: 'pct_payroll', amount: 0.1 }, violation: 'off_books_payroll' },
    { id: 'underreport_sales', name: 'Under-report cash sales', what: 'Keep part of the sales tax you collected.', saves: { basis: 'pct_revenue', amount: 0.03 }, violation: 'sales_tax_fraud' },
    { id: 'no_workers_comp', name: 'Skip workers’ compensation insurance', what: 'No premium this month.', saves: { basis: 'per_staff', amount: 110 }, violation: 'no_wc_insurance' },
  ],
  violations: [
    { id: 'off_books_payroll', name: 'Unreported cash payroll', law: 'NY Tax Law §685; 26 U.S.C. §6672', official: 'tax_auditor', foundBy: ['audit', 'complaint'], fine: { base: 0, perMonth: 200, pctOfSaved: 1.5, max: null }, reputationHit: 0.05, ...EST },
    { id: 'sales_tax_fraud', name: 'Unremitted sales tax', law: 'NY Tax Law §1145', official: 'tax_auditor', foundBy: ['audit', 'complaint'], fine: { base: 1000, perMonth: 0, pctOfSaved: 2, max: null }, reputationHit: 0.05, ...EST },
    { id: 'no_wc_insurance', name: 'No workers’ compensation coverage', law: 'NY Workers’ Compensation Law §52', official: 'tax_auditor', foundBy: ['audit', 'complaint'], fine: { base: 0, perMonth: 2000, pctOfSaved: 0, max: 50000 }, reputationHit: 0.02, ...EST },
    { id: 'bribery', name: 'Bribing a public servant', law: 'NY Penal Law Art. 200', official: 'tax_auditor', foundBy: ['sting'], fine: { base: 5000, perMonth: 0, pctOfSaved: 0, max: null }, reputationHit: 0.2, ...EST },
  ],
  officials: [
    { id: 'tax_auditor', name: 'Tax auditor', agency: 'NYS DTF', role: 'tax_auditor', checks: ['off_books_payroll', 'sales_tax_fraud', 'no_wc_insurance', 'misclassification'] },
  ],
  reports: [
    { id: 'report_taxes', name: 'Report unpaid taxes or off-the-books wages', text: 'A tax auditor reviews the books.', role: 'tax_auditor', checks: ['off_books_payroll', 'sales_tax_fraud', 'no_wc_insurance', 'misclassification'] },
  ],
  ruleCards: [], roadmap: [], sources: [],
};

const common = <T>(xs: T[]): T[] => xs;

export const cafePack: Pack = {
  id: 'cafe', version: 1, name: 'Coffee shop', tagline: 'Espresso, pastries and a line at 8 am', startCapital: 75000,
  unit: { name: 'order', refPrice: 6.5, priceMin: 3, priceMax: 12, cogsPerUnit: 1.9, ...EST },
  market: { unitsPerSlotMonth: 6000, priceElasticity: -1.4, weights: { price: 0.35, quality: 0.25, reputation: 0.2, location: 0.2 }, ...EST },
  capacity: { unitsPerStaffMonth: 1800, minStaff: 1, maxStaff: 8, hardCapUnits: null },
  sizing: { unitName: 'seat', min: 6, max: 40, default: 18, sqftPerUnit: 18, unitsServedPerSizeMonth: 150, takeawayShare: 0.45, cleaningCostPerSizeMonth: 12, emptyPenaltyBelow: 0.3, crowdPenaltyAbove: 0.9, ...EST },
  setup: [
    { id: 'lease_deposit', name: 'Lease security deposit', kind: 'deposit', cost: 12000, required: true, ...EST },
    { id: 'buildout', name: 'Light build-out', kind: 'buildout', cost: 8000, required: true, lifespanMonths: 120, ...EST },
    { id: 'espresso_machine', name: 'Espresso machine (2 group)', kind: 'equipment', cost: 9000, required: true, lifespanMonths: 84, qualityBonus: 0.02, ...EST },
    { id: 'grinders', name: 'Grinders', kind: 'equipment', cost: 2500, required: true, lifespanMonths: 60, ...EST },
    { id: 'fridge_display', name: 'Refrigerated display', kind: 'equipment', cost: 4500, required: true, lifespanMonths: 96, ...EST },
    { id: 'dishwasher', name: 'Undercounter dishwasher', kind: 'equipment', cost: 3500, required: true, lifespanMonths: 96, ...EST },
    { id: 'pos', name: 'POS terminal', kind: 'equipment', cost: 1200, required: true, lifespanMonths: 60, ...EST },
    { id: 'chair', name: 'Dining chair', kind: 'furniture', cost: 85, required: true, scalesWithSize: true, lifespanMonths: 60, ...EST },
    { id: 'table_share', name: 'Table (per seat)', kind: 'furniture', cost: 120, required: true, scalesWithSize: true, lifespanMonths: 84, ...EST },
    { id: 'fse_permit', name: 'Food Service Establishment Permit', kind: 'permit', cost: 280, required: true, waitDays: 21, agency: 'NYC DOHMH', withoutItViolation: 'no_fse_permit', ...EST },
    { id: 'food_protection', name: 'Food Protection Certificate', kind: 'license', cost: 115, required: true, waitDays: 7, agency: 'NYC DOHMH', withoutItViolation: 'no_food_protection', ...EST },
    { id: 'initial_inventory', name: 'Opening inventory', kind: 'inventory', cost: 2500, required: true, ...EST },
    { id: 'premium_espresso', name: 'Premium espresso machine (3 group)', kind: 'equipment', cost: 16000, required: false, lifespanMonths: 96, qualityBonus: 0.08, ...EST },
  ],
  kits: [
    { id: 'lean', name: 'Lean start', size: 12, items: [], pitch: 'Cheapest way to open.' },
    { id: 'standard', name: 'Standard', size: 18, items: [], pitch: 'What most new shops open with.' },
    { id: 'premium', name: 'Premium', size: 24, items: [{ id: 'premium_espresso', qty: 1 }], pitch: 'Better machine, bigger room.' },
  ],
  monthlyCosts: [
    { id: 'utilities', name: 'Electricity and gas', kind: 'utilities', basis: 'fixed', amount: 1100, ...EST },
    { id: 'insurance', name: 'Liability and property insurance', kind: 'insurance', basis: 'fixed', amount: 300, ...EST },
    { id: 'card_fees', name: 'Card processing', kind: 'fees', basis: 'pct_revenue', amount: 0.029, ...EST },
    { id: 'supplies', name: 'Cups, lids, napkins', kind: 'supplies', basis: 'per_unit', amount: 0.15, ...EST },
    { id: 'accountant', name: 'Bookkeeper', kind: 'fees', basis: 'fixed', amount: 300, ...EST },
    { id: 'maintenance', name: 'Repairs and maintenance', kind: 'maintenance', basis: 'fixed', amount: 200, ...EST },
    { id: 'trash', name: 'Commercial carting', kind: 'other', basis: 'fixed', amount: 250, ...EST },
  ],
  staff: [{ id: 'barista', name: 'Barista', hourlyWage: 17, hoursPerMonth: 140, ...MINWAGE_NYC_2026 }],
  taxes: [{ id: 'sales_tax', name: 'Sales tax', base: 'taxable_revenue', rate: 0.08875, due: 'quarterly', confidence: 'estimate', note: '4% state + 4.5% city + 0.375% MCTD; link to be added by agent 14' }],
  levers: [
    { id: 'cleaning', name: 'Cleaning', options: [
      { id: 'standard', label: 'Daily clean', monthlyCost: 500 },
      { id: 'full', label: 'Daily deep clean', monthlyCost: 900, effects: { quality: 0.03 } },
      { id: 'minimal', label: 'Wipe and go', monthlyCost: 200, effects: { quality: -0.05 }, causes: 'dirty_surfaces' },
    ] },
    { id: 'beans', name: 'Coffee', options: [
      { id: 'house', label: 'House blend', monthlyCost: 0 },
      { id: 'specialty', label: 'Specialty roaster', monthlyCost: 600, effects: { quality: 0.06 } },
    ] },
    { id: 'marketing', name: 'Marketing', options: [
      { id: 'none', label: 'Word of mouth', monthlyCost: 0 },
      { id: 'local', label: 'Local ads', monthlyCost: 400, effects: { demand: 0.04 } },
      { id: 'heavy', label: 'Paid social + flyers', monthlyCost: 1200, effects: { demand: 0.08 } },
    ] },
  ],
  shortcuts: [
    { id: 'skip_pest_control', name: 'Skip pest control', what: 'No exterminator this month.', saves: { basis: 'fixed', amount: 250 }, violation: 'pests' },
    { id: 'expired_food', name: 'Sell past-date pastries', what: 'Less waste.', saves: { basis: 'pct_revenue', amount: 0.01 }, violation: 'expired_food' },
  ],
  violations: [
    { id: 'dirty_surfaces', name: 'Unsanitary food-contact surfaces', law: 'NYC Health Code §81.17', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 300, perMonth: 100, pctOfSaved: 0, max: 2000 }, reputationHit: 0.05, ...EST },
    { id: 'pests', name: 'Evidence of pests', law: 'NYC Health Code §81.23', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 600, perMonth: 200, pctOfSaved: 0, max: 4000 }, closureDays: 3, reputationHit: 0.1, ...EST },
    { id: 'expired_food', name: 'Adulterated or expired food', law: 'NYC Health Code §81.07', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 400, perMonth: 150, pctOfSaved: 0, max: 3000 }, reputationHit: 0.05, ...EST },
    { id: 'no_fse_permit', name: 'Operating without a food service permit', law: 'NYC Health Code §81.05', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 1000, perMonth: 500, pctOfSaved: 0, max: 5000 }, closureDays: 5, reputationHit: 0.05, ...EST },
    { id: 'no_food_protection', name: 'No certified food protection supervisor', law: 'NYC Health Code §81.15', official: 'health_inspector', foundBy: ['inspection'], fine: { base: 200, perMonth: 100, pctOfSaved: 0, max: 1000 }, ...EST },
  ],
  officials: [{ id: 'health_inspector', name: 'Health inspector', agency: 'NYC DOHMH', role: 'inspector', checks: ['dirty_surfaces', 'pests', 'expired_food', 'no_fse_permit', 'no_food_protection'] }],
  reports: [{ id: 'report_unsanitary', name: 'Report unsanitary conditions (311)', text: 'The Health Department sends an inspector.', role: 'inspector', checks: ['dirty_surfaces', 'pests', 'expired_food', 'no_fse_permit'] }],
  events: [], ruleCards: [],
  benchmarks: { cogsPct: 0.3, laborPct: 0.3, rentPct: 0.12, netMarginPct: 0.06, ...EST },
  suppliers: [], roadmap: [], manager: { monthlySalary: 5500, ...EST }, sources: [],
};

export const barbershopPack: Pack = {
  id: 'barbershop', version: 1, name: 'Barbershop', tagline: 'Fades, beards and Saturday lines', startCapital: 50000,
  unit: { name: 'haircut', refPrice: 35, priceMin: 15, priceMax: 80, cogsPerUnit: 2.5, ...EST },
  market: { unitsPerSlotMonth: 900, priceElasticity: -1.2, weights: { price: 0.3, quality: 0.3, reputation: 0.25, location: 0.15 }, ...EST },
  capacity: { unitsPerStaffMonth: 280, minStaff: 1, maxStaff: 8, hardCapUnits: null },
  sizing: { unitName: 'chair', min: 2, max: 10, default: 4, sqftPerUnit: 60, unitsServedPerSizeMonth: 300, takeawayShare: 0, cleaningCostPerSizeMonth: 25, emptyPenaltyBelow: 0.3, crowdPenaltyAbove: 0.92, ...EST },
  setup: [
    { id: 'lease_deposit', name: 'Lease security deposit', kind: 'deposit', cost: 10000, required: true, ...EST },
    { id: 'buildout', name: 'Plumbing and build-out', kind: 'buildout', cost: 6000, required: true, lifespanMonths: 120, ...EST },
    { id: 'barber_chair', name: 'Hydraulic barber chair', kind: 'furniture', cost: 900, required: true, scalesWithSize: true, lifespanMonths: 96, ...EST },
    { id: 'mirror_station', name: 'Mirror station', kind: 'furniture', cost: 450, required: true, scalesWithSize: true, lifespanMonths: 96, ...EST },
    { id: 'shampoo_station', name: 'Shampoo bowl', kind: 'equipment', cost: 1500, required: true, lifespanMonths: 96, ...EST },
    { id: 'sterilizer', name: 'Sterilizer and Barbicide set', kind: 'equipment', cost: 400, required: true, lifespanMonths: 48, ...EST },
    { id: 'pos', name: 'POS and booking', kind: 'equipment', cost: 1000, required: true, lifespanMonths: 60, ...EST },
    { id: 'shop_license', name: 'Barber Shop Owner license', kind: 'license', cost: 200, required: true, waitDays: 30, agency: 'NYS Department of State', withoutItViolation: 'no_shop_license', ...EST },
    { id: 'initial_inventory', name: 'Products and supplies', kind: 'inventory', cost: 1500, required: true, ...EST },
    { id: 'premium_fitout', name: 'Premium fit-out', kind: 'furniture', cost: 7000, required: false, lifespanMonths: 96, qualityBonus: 0.08, ...EST },
  ],
  kits: [
    { id: 'lean', name: 'Lean start', size: 3, items: [], pitch: 'Three chairs, used gear.' },
    { id: 'standard', name: 'Standard', size: 4, items: [], pitch: 'Four chairs.' },
    { id: 'premium', name: 'Premium', size: 6, items: [{ id: 'premium_fitout', qty: 1 }], pitch: 'Six chairs, lounge look.' },
  ],
  monthlyCosts: [
    { id: 'utilities', name: 'Electricity and water', kind: 'utilities', basis: 'fixed', amount: 600, ...EST },
    { id: 'insurance', name: 'Liability insurance', kind: 'insurance', basis: 'fixed', amount: 250, ...EST },
    { id: 'card_fees', name: 'Card processing', kind: 'fees', basis: 'pct_revenue', amount: 0.029, ...EST },
    { id: 'supplies', name: 'Blades, capes, products', kind: 'supplies', basis: 'per_unit', amount: 1, ...EST },
    { id: 'accountant', name: 'Bookkeeper', kind: 'fees', basis: 'fixed', amount: 250, ...EST },
    { id: 'maintenance', name: 'Repairs', kind: 'maintenance', basis: 'fixed', amount: 150, ...EST },
  ],
  staff: [{ id: 'barber', name: 'Licensed barber', hourlyWage: 19, hoursPerMonth: 160, ...EST }],
  taxes: [{ id: 'nyc_barbering_tax', name: 'NYC local sales tax on barbering', base: 'taxable_revenue', rate: 0.045, due: 'quarterly', ...EST }],
  levers: [
    { id: 'sterilization', name: 'Sterilization', options: [
      { id: 'standard', label: 'By the book', monthlyCost: 150 },
      { id: 'full', label: 'Autoclave and logs', monthlyCost: 300, effects: { quality: 0.03 } },
      { id: 'minimal', label: 'Rinse and reuse', monthlyCost: 50, effects: { quality: -0.05 }, causes: 'no_sterilization' },
    ] },
    { id: 'marketing', name: 'Marketing', options: [
      { id: 'none', label: 'Word of mouth', monthlyCost: 0 },
      { id: 'local', label: 'Booking app promos', monthlyCost: 300, effects: { demand: 0.04 } },
      { id: 'heavy', label: 'Instagram + influencers', monthlyCost: 900, effects: { demand: 0.08 } },
    ] },
  ],
  shortcuts: [
    { id: 'unlicensed_barbers', name: 'Hire unlicensed barbers', what: 'They work for less.', saves: { basis: 'per_staff', amount: 300 }, violation: 'unlicensed_barber' },
    { id: 'barbers_1099', name: 'Book barbers as contractors', what: 'No payroll taxes.', saves: { basis: 'pct_payroll', amount: 0.1 }, violation: 'misclassification' },
  ],
  violations: [
    { id: 'no_sterilization', name: 'Tools not disinfected', law: '19 NYCRR §161', official: 'dos_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 250, perMonth: 100, pctOfSaved: 0, max: 2000 }, closureDays: 2, reputationHit: 0.08, ...EST },
    { id: 'unlicensed_barber', name: 'Unlicensed barber at work', law: 'NY General Business Law §432', official: 'dos_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 500, perMonth: 250, pctOfSaved: 0, max: 5000 }, reputationHit: 0.05, ...EST },
    { id: 'no_shop_license', name: 'Operating without a shop license', law: 'NY General Business Law §434', official: 'dos_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 750, perMonth: 300, pctOfSaved: 0, max: 5000 }, closureDays: 5, reputationHit: 0.05, ...EST },
    { id: 'misclassification', name: 'Employees booked as contractors', law: 'NY Labor Law §861', official: 'tax_auditor', foundBy: ['audit', 'complaint'], fine: { base: 0, perMonth: 100, pctOfSaved: 1.5, max: null }, reputationHit: 0.03, ...EST },
  ],
  officials: [{ id: 'dos_inspector', name: 'Licensing inspector', agency: 'NYS Department of State', role: 'inspector', checks: ['no_sterilization', 'unlicensed_barber', 'no_shop_license'] }],
  reports: [{ id: 'report_unlicensed', name: 'Report unlicensed or unsanitary barbershop', text: 'A licensing inspector visits.', role: 'inspector', checks: ['no_sterilization', 'unlicensed_barber', 'no_shop_license'] }],
  events: [], ruleCards: [],
  benchmarks: { cogsPct: 0.08, laborPct: 0.45, rentPct: 0.15, netMarginPct: 0.1, ...EST },
  suppliers: [], roadmap: [], manager: { monthlySalary: 4500, ...EST }, sources: [],
};

// Kits: every required item is in every kit (PACK.md rule); scalesWithSize items take qty from size.
for (const p of [cafePack, barbershopPack]) {
  const req = p.setup.filter((s) => s.required).map((s) => ({ id: s.id, qty: 1 }));
  for (const k of p.kits) k.items = common([...req, ...k.items]);
}

export const stubPacks: PackSet = { common: commonPack, niches: { cafe: cafePack, barbershop: barbershopPack } };

/** Deep copy so experiments can tweak numbers (startCapital, fines) without touching the shared stub. */
export function clonePacks(p: PackSet = stubPacks): PackSet {
  return JSON.parse(JSON.stringify(p)) as PackSet;
}
