// Примеры пакетов для модуля закона, пока packs/_common.json и packs/cafe.json (агент 14) нет в основной ветке.
// Числа правдоподобные; где нет первоисточника под рукой — confidence: 'estimate' и расчёт в note.
import type { CommonPack, Pack } from '../../../shared/src/types';

export const lawCommonPack: CommonPack = {
  id: '_common', version: 1, name: 'Common NYC rules (law fixture)',
  taxes: [
    { id: 'fica_employer', name: 'Social Security and Medicare (employer)', base: 'payroll', rate: 0.0765, due: 'quarterly', source: 'https://www.irs.gov/taxtopics/tc751', confidence: 'verified', note: '6.2% + 1.45%' },
    { id: 'futa', name: 'Federal unemployment tax', base: 'payroll', rate: 0.006, due: 'quarterly', source: 'https://www.irs.gov/taxtopics/tc759', confidence: 'estimate', note: '6.0% minus 5.4% credit; really only on the first $7,000 per worker' },
    { id: 'ny_sui', name: 'NY unemployment insurance', base: 'payroll', rate: 0.041, due: 'quarterly', source: 'https://dol.ny.gov/unemployment-insurance-rate-information', confidence: 'estimate', note: 'new employer rate, about 4.1%' },
  ],
  shortcuts: [
    { id: 'cash_wages', name: 'Pay staff in cash, off the books', what: 'No payroll taxes this month. If anyone audits you, you owe it all back with penalties.', saves: { basis: 'pct_payroll', amount: 0.1235 }, violation: 'off_books_payroll' },
    { id: 'skim_cash_sales', name: 'Ring up some cash sales off the register', what: 'About a sixth of cash sales never hit the books, so no sales tax on them.', saves: { basis: 'pct_revenue', amount: 0.015 }, violation: 'unreported_sales' },
  ],
  violations: [
    {
      id: 'off_books_payroll', name: 'Unreported cash payroll', law: '26 U.S.C. §3111, §6656, §6672; NY Labor Law §575',
      official: 'nys_tax_auditor', foundBy: ['audit', 'complaint'], fine: { base: 500, perMonth: 0, pctOfSaved: 1.5, max: null },
      closureDays: 0, reputationHit: 0.05, criminal: 'Willful failure to pay over payroll taxes is a felony (26 U.S.C. §7202).',
      source: 'https://www.law.cornell.edu/uscode/text/26/6672', confidence: 'estimate', note: 'back taxes 1.0 + failure-to-deposit up to 0.1 + interest and NY penalties ≈ 1.5 × saved',
    },
    {
      id: 'unreported_sales', name: 'Unreported cash sales', law: 'NY Tax Law §1145',
      official: 'nys_tax_auditor', foundBy: ['audit', 'complaint'], fine: { base: 0, perMonth: 50, pctOfSaved: 2, max: null },
      closureDays: 0, reputationHit: 0.05, source: 'https://www.nysenate.gov/legislation/laws/TAX/1145', confidence: 'estimate', note: 'unpaid tax 1.0 + penalties up to 30% + fraud penalty; ≈ 2 × saved',
    },
    {
      id: 'bribery', name: 'Bribing a public servant', law: 'NY Penal Law §200.00; fine up to double the gain, §80.00',
      official: 'doi_investigator', foundBy: ['sting'], fine: { base: 5000, perMonth: 0, pctOfSaved: 2, max: null },
      closureDays: 0, reputationHit: 0.2, criminal: 'Bribery in the third degree is a class D felony.',
      source: 'https://www.nysenate.gov/legislation/laws/PEN/200.00', confidence: 'estimate', note: '$5,000 + double the bribe',
    },
  ],
  officials: [
    { id: 'nys_tax_auditor', name: 'Tax auditor', agency: 'NYS Department of Taxation and Finance', role: 'tax_auditor', checks: ['off_books_payroll', 'unreported_sales'] },
    { id: 'doi_investigator', name: 'Internal Affairs', agency: 'NYC Department of Investigation', role: 'inspector', checks: ['bribery'] },
  ],
  reports: [
    { id: 'report_cash_payroll', name: 'Report off-the-books payroll', text: 'The state sends a tax auditor. If you are wrong, you get a warning.', role: 'tax_auditor', checks: ['off_books_payroll'] },
    { id: 'report_unreported_sales', name: 'Report unreported cash sales', text: 'The state sends a tax auditor. If you are wrong, you get a warning.', role: 'tax_auditor', checks: ['unreported_sales'] },
  ],
  ruleCards: [{ id: 'payroll_taxes', title: 'Payroll taxes', text: 'Employers pay 7.65% Social Security and Medicare on wages, plus unemployment insurance.', source: 'https://www.irs.gov/taxtopics/tc751' }],
  roadmap: [{ id: 'get_ein', title: 'Get an EIN', text: 'Free from the IRS, takes minutes online.', kind: 'legal', fee: 0, agency: 'IRS', link: 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online' }],
  sources: [{ url: 'https://www.irs.gov/taxtopics/tc751', title: 'IRS Topic 751', checked: '2026-11-14' }],
};

export const lawCafePack: Pack = {
  id: 'cafe', version: 1, name: 'Coffee shop', tagline: 'Law fixture', startCapital: 60000,
  unit: { name: 'order', refPrice: 6.5, priceMin: 3, priceMax: 12, cogsPerUnit: 1.9, confidence: 'estimate' },
  market: { unitsPerSlotMonth: 5200, priceElasticity: -1.4, weights: { price: 0.35, quality: 0.25, reputation: 0.2, location: 0.2 }, confidence: 'estimate' },
  capacity: { unitsPerStaffMonth: 1800, minStaff: 1, maxStaff: 8, hardCapUnits: null },
  sizing: { unitName: 'seat', min: 6, max: 40, default: 18, sqftPerUnit: 18, unitsServedPerSizeMonth: 150, takeawayShare: 0.45, cleaningCostPerSizeMonth: 12, confidence: 'estimate' },
  setup: [
    { id: 'espresso_machine', name: 'Espresso machine', kind: 'equipment', cost: 9000, required: true, lifespanMonths: 84, confidence: 'estimate' },
    { id: 'chair', name: 'Dining chair', kind: 'furniture', cost: 85, required: true, scalesWithSize: true, confidence: 'estimate' },
    {
      id: 'fse_permit', name: 'Food Service Establishment Permit', kind: 'permit', cost: 280, required: true, waitDays: 21,
      agency: 'NYC DOHMH', link: 'https://nyc-business.nyc.gov/nycbusiness/description/food-service-establishment-permit',
      withoutItViolation: 'no_fse_permit', confidence: 'estimate',
    },
  ],
  kits: [
    { id: 'lean', name: 'Lean start', size: 12, items: [{ id: 'espresso_machine', qty: 1 }, { id: 'fse_permit', qty: 1 }], pitch: 'Cheapest way to open.' },
    { id: 'standard', name: 'Standard', size: 18, items: [{ id: 'espresso_machine', qty: 1 }, { id: 'fse_permit', qty: 1 }], pitch: 'The usual cafe.' },
    { id: 'premium', name: 'Premium', size: 24, items: [{ id: 'espresso_machine', qty: 1 }, { id: 'fse_permit', qty: 1 }], pitch: 'Bigger and nicer.' },
  ],
  monthlyCosts: [{ id: 'utilities', name: 'Utilities', kind: 'utilities', basis: 'fixed', amount: 900, confidence: 'estimate' }],
  staff: [{ id: 'barista', name: 'Barista', hourlyWage: 17, tipped: true, cashWage: 11.35, hoursPerMonth: 140, source: 'https://dol.ny.gov/minimum-wage-0', confidence: 'estimate', note: 'NYC minimum wage 2026' }],
  taxes: [{ id: 'sales_tax', name: 'Sales tax', base: 'taxable_revenue', rate: 0.08875, due: 'quarterly', source: 'https://www.tax.ny.gov/pdf/publications/sales/pub718.pdf', confidence: 'verified' }],
  levers: [{
    id: 'cleaning', name: 'Cleaning', options: [
      { id: 'full', label: 'Daily deep clean', monthlyCost: 900, effects: { quality: 0.05 } },
      { id: 'standard', label: 'Daily cleaning', monthlyCost: 500 },
      { id: 'minimal', label: 'Wipe and go', monthlyCost: 150, effects: { quality: -0.05 }, causes: 'dirty_surfaces' },
    ],
  }],
  shortcuts: [{ id: 'skip_pest_control', name: 'Skip pest control', what: 'Save the exterminator fee. Mice do not wait.', saves: { basis: 'fixed', amount: 180 }, violation: 'pest_evidence' }],
  violations: [
    {
      id: 'dirty_surfaces', name: 'Food contact surfaces not clean', law: 'NYC Health Code §81.17', official: 'health_inspector',
      foundBy: ['inspection', 'complaint'], fine: { base: 300, perMonth: 100, pctOfSaved: 0.5, max: 2000 }, closureDays: 0, reputationHit: 0.08,
      source: 'https://www.nyc.gov/site/doh/business/food-operators/letter-grading-for-restaurants.page', confidence: 'estimate', note: 'DOHMH penalties are roughly $200–$350 per condition; grows if it lasts',
    },
    {
      id: 'pest_evidence', name: 'Evidence of mice or roaches', law: 'NYC Health Code §81.23', official: 'health_inspector',
      foundBy: ['inspection', 'complaint'], fine: { base: 600, perMonth: 0, pctOfSaved: 0, max: 2000 }, closureDays: 3, reputationHit: 0.15,
      confidence: 'estimate', note: 'public health hazard: DOHMH can close until corrected',
    },
    {
      id: 'no_fse_permit', name: 'Operating without a Food Service Establishment Permit', law: 'NYC Health Code §81.05', official: 'health_inspector',
      foundBy: ['inspection', 'complaint'], fine: { base: 1000, perMonth: 500, pctOfSaved: 0, max: null }, closureDays: 7, reputationHit: 0.1,
      confidence: 'estimate', note: 'closed until the permit is issued',
    },
  ],
  officials: [{ id: 'health_inspector', name: 'Health inspector', agency: 'NYC DOHMH', role: 'inspector', checks: ['dirty_surfaces', 'pest_evidence', 'no_fse_permit'] }],
  reports: [
    { id: 'report_dirty_kitchen', name: 'Report unsanitary conditions (311)', text: 'The Health Department sends an inspector. If you are wrong, you get a warning.', role: 'inspector', checks: ['dirty_surfaces', 'pest_evidence'] },
    { id: 'report_no_permit', name: 'Report a cafe open without a permit (311)', text: 'The Health Department sends an inspector. If you are wrong, you get a warning.', role: 'inspector', checks: ['no_fse_permit'] },
  ],
  events: [],
  ruleCards: [],
  benchmarks: { cogsPct: 0.3, laborPct: 0.3, rentPct: 0.08, netMarginPct: 0.06, confidence: 'estimate' },
  suppliers: [],
  roadmap: [],
  manager: { monthlySalary: 4800, confidence: 'estimate' },
  sources: [],
};
