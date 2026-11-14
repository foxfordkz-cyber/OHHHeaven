// Stand-in for packs/cafe.json and packs/_common.json (agents 14 and 01) so /dev/biz works today.
// Numbers here only drive the screen. Real values, sources and confidence come from the packs.
// Law citations and the letter-grade bands are real; money amounts are marked estimate.
import type { CommonPack, Pack } from '../../../../../shared/src/types';

const FIXTURE = { confidence: 'estimate' as const, note: 'fixture for /dev/biz; real value in packs/cafe.json' };

export const cafePack: Pack = {
  id: 'cafe',
  version: 0,
  name: 'Coffee shop',
  tagline: 'Espresso, pastries and a few tables',
  startCapital: 60000,
  unit: { name: 'order', refPrice: 6.5, priceMin: 3, priceMax: 12, cogsPerUnit: 1.9, ...FIXTURE },
  market: {
    unitsPerSlotMonth: 5200,
    priceElasticity: -1.4,
    weights: { price: 0.35, quality: 0.25, reputation: 0.2, location: 0.2 },
    ...FIXTURE,
  },
  capacity: { unitsPerStaffMonth: 1800, minStaff: 1, maxStaff: 8 },
  sizing: {
    unitName: 'seat',
    min: 6,
    max: 40,
    default: 18,
    sqftPerUnit: 18,
    unitsServedPerSizeMonth: 150,
    takeawayShare: 0.45,
    cleaningCostPerSizeMonth: 12,
    crowdPenaltyAbove: 0.9,
    emptyPenaltyBelow: 0.3,
    ...FIXTURE,
  },
  setup: [
    { id: 'espresso_machine', name: 'Espresso machine', kind: 'equipment', cost: 9000, required: true, lifespanMonths: 84, qualityBonus: 0.03, ...FIXTURE },
    { id: 'grinder', name: 'Burr grinder', kind: 'equipment', cost: 1400, required: true, lifespanMonths: 60, ...FIXTURE },
    { id: 'pastry_case', name: 'Refrigerated pastry case', kind: 'equipment', cost: 3200, required: false, lifespanMonths: 96, qualityBonus: 0.02, ...FIXTURE },
    { id: 'chair', name: 'Dining chair', kind: 'furniture', cost: 85, required: true, scalesWithSize: true, lifespanMonths: 60, ...FIXTURE },
    { id: 'table_share', name: 'Table (per seat)', kind: 'furniture', cost: 110, required: true, scalesWithSize: true, lifespanMonths: 84, ...FIXTURE },
    {
      id: 'fse_permit', name: 'Food Service Establishment Permit', kind: 'permit', cost: 280, required: true,
      waitDays: 21, agency: 'NYC DOHMH', withoutItViolation: 'no_fse_permit', ...FIXTURE,
    },
  ],
  kits: [
    { id: 'lean', name: 'Lean start', size: 12, items: [{ id: 'espresso_machine', qty: 1 }, { id: 'grinder', qty: 1 }], pitch: 'Cheapest way to open. Small room, used equipment.' },
    { id: 'standard', name: 'Standard', size: 18, items: [{ id: 'espresso_machine', qty: 1 }, { id: 'grinder', qty: 1 }], pitch: 'What most neighborhood cafes look like.' },
    { id: 'premium', name: 'Premium', size: 24, items: [{ id: 'espresso_machine', qty: 1 }, { id: 'grinder', qty: 1 }, { id: 'pastry_case', qty: 1 }], pitch: 'Bigger room and a pastry case.' },
  ],
  monthlyCosts: [
    { id: 'rent', name: 'Rent', kind: 'rent', basis: 'fixed', amount: 9500, ...FIXTURE },
    { id: 'utilities', name: 'Electricity and gas', kind: 'utilities', basis: 'fixed', amount: 900, ...FIXTURE },
    { id: 'insurance', name: 'General liability insurance', kind: 'insurance', basis: 'fixed', amount: 250, ...FIXTURE },
  ],
  staff: [
    { id: 'barista', name: 'Barista', hourlyWage: 17, tipped: true, cashWage: 11.35, hoursPerMonth: 140, licenseRequired: null, ...FIXTURE },
    { id: 'shift_lead', name: 'Shift lead', hourlyWage: 21, hoursPerMonth: 160, licenseRequired: 'food_protection_cert', ...FIXTURE },
  ],
  taxes: [
    { id: 'sales_tax', name: 'Sales tax', base: 'taxable_revenue', rate: 0.08875, due: 'quarterly', appliesIf: 'prepared food and drinks', ...FIXTURE },
  ],
  levers: [
    {
      id: 'cleaning', name: 'Cleaning', options: [
        { id: 'full', label: 'Daily deep clean', monthlyCost: 900, effects: { quality: 0.05 } },
        { id: 'standard', label: 'Close-of-day clean', monthlyCost: 500 },
        { id: 'minimal', label: 'Wipe and go', monthlyCost: 250, effects: { quality: -0.05 }, causes: 'dirty_surfaces' },
      ],
    },
    {
      id: 'beans', name: 'Coffee beans', options: [
        { id: 'commodity', label: 'Commodity blend', monthlyCost: 0, effects: { quality: -0.04 } },
        { id: 'standard', label: 'Local roaster', monthlyCost: 300 },
        { id: 'specialty', label: 'Single origin', monthlyCost: 900, effects: { quality: 0.06, demand: 0.03 } },
      ],
    },
    {
      id: 'hours', name: 'Opening hours', options: [
        { id: 'short', label: '7am–3pm', monthlyCost: 0, effects: { capacity: -0.15 } },
        { id: 'standard', label: '7am–7pm', monthlyCost: 200 },
        { id: 'long', label: '6am–10pm', monthlyCost: 650, effects: { capacity: 0.2, demand: 0.05 } },
      ],
    },
  ],
  shortcuts: [
    {
      id: 'skip_pest_control', name: 'Skip pest control', what: 'Cancel the monthly exterminator visit. Nobody notices until somebody does.',
      saves: { basis: 'fixed', amount: 350 }, violation: 'no_pest_control',
    },
    {
      id: 'underreport_sales', name: 'Ring up some sales off the register', what: 'Less sales tax this quarter. Auditors compare your card sales and supplier invoices.',
      saves: { basis: 'pct_revenue', amount: 0.04 }, violation: 'sales_tax_underreport',
    },
  ],
  violations: [
    {
      id: 'dirty_surfaces', name: 'Unsanitary food-contact surfaces', law: 'NYC Health Code, Article 81', official: 'health_inspector',
      foundBy: ['inspection', 'complaint'], fine: { base: 300, perMonth: 100, max: 2000 }, reputationHit: 0.05, ...FIXTURE,
    },
    {
      id: 'no_pest_control', name: 'No pest management', law: 'NYC Health Code, Article 81', official: 'health_inspector',
      foundBy: ['inspection', 'complaint'], fine: { base: 300, perMonth: 100, max: 2000 }, closureDays: 2, reputationHit: 0.08, ...FIXTURE,
    },
    {
      id: 'no_fse_permit', name: 'Operating without a Food Service Establishment Permit', law: 'NYC Health Code, Article 81', official: 'health_inspector',
      foundBy: ['inspection', 'complaint'], fine: { base: 1000, perMonth: 500, max: 5000 }, closureDays: 7, reputationHit: 0.1, ...FIXTURE,
    },
    {
      id: 'sales_tax_underreport', name: 'Underreported sales tax', law: 'NY Tax Law § 1145', official: 'tax_auditor',
      foundBy: ['audit', 'complaint'], fine: { pctOfSaved: 1.5, max: null }, reputationHit: 0.05, ...FIXTURE,
    },
  ],
  officials: [
    { id: 'health_inspector', name: 'Health inspector', agency: 'NYC DOHMH', role: 'inspector', checks: ['dirty_surfaces', 'no_pest_control', 'no_fse_permit'] },
  ],
  reports: [],
  events: [],
  ruleCards: [
    {
      id: 'letter_grade', title: 'Letter grades',
      text: 'NYC inspectors score violations in points. 0–13 points is an A, 14–27 a B, 28 or more a C. The grade card must be posted near the entrance.',
      source: 'NYC DOHMH restaurant letter grading',
    },
    {
      id: 'dirty_surfaces', title: 'Food-contact surfaces',
      text: 'Surfaces that touch food must be washed, rinsed and sanitized. Each condition found adds points to your inspection score and a fine.',
      source: 'NYC Health Code, Article 81',
    },
  ],
  benchmarks: { cogsPct: 0.3, laborPct: 0.3, rentPct: 0.08, netMarginPct: 0.06, ...FIXTURE },
  suppliers: [],
  roadmap: [],
  manager: { monthlySalary: 4800, ...FIXTURE },
  sources: [],
};

export const commonPack: CommonPack = {
  id: '_common',
  version: 0,
  name: 'Rules for every business',
  taxes: [
    { id: 'fica_employer', name: 'Social Security and Medicare (employer)', base: 'payroll', rate: 0.0765, due: 'monthly', source: 'IRS Publication 15', confidence: 'verified' },
  ],
  shortcuts: [
    {
      id: 'cash_wages', name: 'Pay staff in cash, off the books', what: 'No payroll taxes this month. If anyone audits you, you owe it all back with penalties.',
      saves: { basis: 'pct_payroll', amount: 0.18 }, violation: 'off_books_payroll',
    },
  ],
  violations: [
    {
      id: 'off_books_payroll', name: 'Unreported cash payroll', law: '26 U.S.C. § 7202', official: 'tax_auditor',
      foundBy: ['audit', 'complaint'], fine: { pctOfSaved: 1.5, max: null }, reputationHit: 0.1,
      criminal: 'Willful failure to pay over payroll taxes is a felony: up to $10,000 and 5 years.', ...FIXTURE,
    },
  ],
  officials: [
    { id: 'tax_auditor', name: 'Tax auditor', agency: 'NYS Department of Taxation and Finance', role: 'tax_auditor', checks: ['off_books_payroll', 'sales_tax_underreport'] },
  ],
  reports: [],
  ruleCards: [
    {
      id: 'off_books_payroll', title: 'Payroll taxes are not optional',
      text: 'Employers withhold and pay over payroll taxes. Willful failure is a felony under 26 U.S.C. § 7202: a fine up to $10,000 and up to 5 years in prison.',
      source: '26 U.S.C. § 7202',
    },
    {
      id: 'bribery', title: 'Bribing an inspector',
      text: 'Offering a benefit to a public servant to influence an official action is bribery in the third degree, a class D felony in New York.',
      source: 'NY Penal Law § 200.00',
    },
  ],
  roadmap: [],
  sources: [],
};
