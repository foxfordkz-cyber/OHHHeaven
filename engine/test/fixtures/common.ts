// Test _common pack until agent 14's packs/_common.json lands. Employer payroll taxes and owner profit taxes,
// simplified to flat rates (confidence: 'estimate'); the real scheme comes from _common.extra.simplifiedScheme.
import type { CommonPack, PackSet } from '@ohh/shared';
import { cafePack } from './cafe';

const EST = 'estimate' as const;

export const commonPack: CommonPack = {
  id: '_common', version: 1, name: 'NYC rules for every business',
  taxes: [
    { id: 'social_security_er', name: 'Social Security (employer)', base: 'payroll', rate: 0.062, due: 'monthly', source: 'https://www.ssa.gov/cola/factsheets/2026.html', confidence: EST, note: '6.2% up to $184,500 per person in 2026 (research_notes: labor_tax.md)' },
    { id: 'medicare_er', name: 'Medicare (employer)', base: 'payroll', rate: 0.0145, due: 'monthly', source: 'https://www.irs.gov/publications/p15', confidence: EST },
    { id: 'futa', name: 'Federal unemployment (FUTA)', base: 'payroll', rate: 0.006, due: 'quarterly', source: 'https://www.irs.gov/publications/p15', confidence: EST, note: '0.6% net on the first $7,000 per person (labor_tax.md)' },
    { id: 'ny_sui', name: 'NY unemployment insurance (new employer, incl. RSF)', base: 'payroll', rate: 0.041, due: 'quarterly', source: 'https://dol.ny.gov/bizserve/ui/prg/rate', confidence: EST, note: '4.1% on the first $17,600 per person in 2026 (labor_tax.md)' },
    { id: 'workers_comp', name: "Workers' compensation insurance", base: 'payroll', rate: 0.025, due: 'monthly', confidence: EST, note: 'Needs a quote by payroll and class code; 2.5% of payroll is a placeholder' },
    { id: 'self_employment_tax', name: 'Self-employment tax (owner)', base: 'profit', rate: 0.1413, due: 'quarterly', source: 'https://www.irs.gov/businesses/small-businesses-self-employed/self-employment-tax-social-security-and-medicare-taxes', confidence: EST, note: '15.3% × 92.35% of net earnings' },
    { id: 'nyc_ubt', name: 'NYC Unincorporated Business Tax', base: 'profit', rate: 0.04, due: 'quarterly', confidence: EST, note: 'Before small-business credits' },
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
  extra: { wageBases: { social_security_er: 184_500, futa: 7_000, ny_sui: 17_600 } },
};

export const packs: PackSet = { common: commonPack, niches: { cafe: cafePack } };
