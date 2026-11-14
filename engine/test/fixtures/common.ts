// Test _common pack until agent 14's packs/_common.json lands. Employer payroll taxes and owner profit taxes,
// simplified to flat rates (confidence: 'estimate'); the real scheme comes from _common.extra.simplifiedScheme.
import type { CommonPack, PackSet } from '@ohh/shared';
import { cafePack } from './cafe';

const EST = 'estimate' as const;

export const commonPack: CommonPack = {
  id: '_common', version: 1, name: 'NYC rules for every business',
  taxes: [
    { id: 'social_security_er', name: 'Social Security (employer)', base: 'payroll', rate: 0.062, due: 'monthly', source: 'https://www.irs.gov/taxtopics/tc751', confidence: EST },
    { id: 'medicare_er', name: 'Medicare (employer)', base: 'payroll', rate: 0.0145, due: 'monthly', source: 'https://www.irs.gov/taxtopics/tc751', confidence: EST },
    { id: 'futa', name: 'Federal unemployment (FUTA)', base: 'payroll', rate: 0.006, due: 'quarterly', source: 'https://www.irs.gov/taxtopics/tc759', confidence: EST, note: 'Flat over the year instead of the $7,000 wage base' },
    { id: 'ny_sui', name: 'NY unemployment insurance (new employer)', base: 'payroll', rate: 0.041, due: 'quarterly', confidence: EST, note: 'Flat instead of the wage base' },
    { id: 'workers_comp', name: "Workers' compensation insurance", base: 'payroll', rate: 0.025, due: 'monthly', confidence: EST },
    { id: 'self_employment_tax', name: 'Self-employment tax (owner)', base: 'profit', rate: 0.1413, due: 'quarterly', confidence: EST, note: '15.3% × 92.35% of net earnings' },
    { id: 'nyc_ubt', name: 'NYC Unincorporated Business Tax', base: 'profit', rate: 0.04, due: 'quarterly', confidence: EST },
  ],
  shortcuts: [
    { id: 'cash_wages', name: 'Pay staff in cash, off the books', what: 'No payroll taxes this month.', saves: { basis: 'pct_payroll', amount: 0.1485 }, violation: 'off_books_payroll' },
  ],
  violations: [
    { id: 'off_books_payroll', name: 'Unreported cash payroll', law: 'NY Tax Law §685; 26 U.S.C. §6672', official: 'tax_auditor', foundBy: ['audit', 'complaint'], fine: { base: 0, pctOfSaved: 1.5, max: null }, confidence: EST },
    { id: 'bribery', name: 'Bribing a public servant', law: 'NY Penal Law Art. 200', official: 'tax_auditor', foundBy: ['sting'], fine: { base: 5000 }, confidence: EST },
  ],
  officials: [{ id: 'tax_auditor', name: 'Tax auditor', agency: 'NYS DTF', role: 'tax_auditor', checks: ['off_books_payroll'] }],
  reports: [{ id: 'report_off_books', name: 'Report unpaid taxes or off-the-books wages', text: 'The state sends an auditor.', role: 'tax_auditor', checks: ['off_books_payroll'] }],
  ruleCards: [], roadmap: [], sources: [],
};

export const packs: PackSet = { common: commonPack, niches: { cafe: cafePack } };
