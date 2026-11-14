// Stub data for wiring only (owner: agent 01). Not real numbers: the real packs are packs/*.json (agents 14–16)
// and the real places are data/places.json (agent 09). The server falls back to these only when those files are missing.
import type { CommonPack, Pack, PackSet, Place, WorldConfig } from '../types';
import { RULES } from '../rules';

const NOTE = 'stub for wiring only — replaced by packs/cafe.json (agent 14)';
const est = { confidence: 'estimate' as const, note: NOTE };

export const STUB_CAFE: Pack = {
  id: 'cafe', version: 0, name: 'Coffee shop (stub data)', tagline: 'Placeholder niche until packs/cafe.json arrives', startCapital: 60_000,
  unit: { name: 'order', refPrice: 6.5, priceMin: 3, priceMax: 12, cogsPerUnit: 1.9, ...est },
  market: { unitsPerSlotMonth: 4_500, priceElasticity: -1.4, weights: { price: 0.35, quality: 0.25, reputation: 0.2, location: 0.2 }, ...est },
  capacity: { unitsPerStaffMonth: 1_800, minStaff: 1, maxStaff: 8, hardCapUnits: null },
  sizing: { unitName: 'seat', min: 6, max: 40, default: 18, sqftPerUnit: 18, unitsServedPerSizeMonth: 150, takeawayShare: 0.45, cleaningCostPerSizeMonth: 12, crowdPenaltyAbove: 0.9, emptyPenaltyBelow: 0.3, ...est },
  setup: [
    { id: 'espresso_machine', name: 'Espresso machine', kind: 'equipment', cost: 9_000, required: true, lifespanMonths: 84, ...est },
    { id: 'chair', name: 'Dining chair', kind: 'furniture', cost: 85, required: true, scalesWithSize: true, lifespanMonths: 60, ...est },
    { id: 'buildout', name: 'Light build-out', kind: 'buildout', cost: 15_000, required: true, ...est },
    { id: 'deposit', name: 'Security deposit', kind: 'deposit', cost: 19_000, required: true, ...est },
    { id: 'fse_permit', name: 'Food Service Establishment Permit', kind: 'permit', cost: 280, required: true, waitDays: 21, agency: 'NYC DOHMH', withoutItViolation: 'no_fse_permit', ...est },
  ],
  kits: (['lean', 'standard', 'premium'] as const).map((id, i) => {
    const size = [12, 18, 24][i];
    return {
      id, name: ['Lean start', 'Standard', 'Premium'][i], size, pitch: 'Stub kit',
      items: [{ id: 'espresso_machine', qty: 1 }, { id: 'chair', qty: size }, { id: 'buildout', qty: 1 }, { id: 'deposit', qty: 1 }, { id: 'fse_permit', qty: 1 }],
    };
  }),
  monthlyCosts: [
    { id: 'rent', name: 'Rent', kind: 'rent', basis: 'fixed', amount: 9_500, ...est },
    { id: 'utilities', name: 'Utilities', kind: 'utilities', basis: 'fixed', amount: 900, ...est },
  ],
  staff: [
    { id: 'barista', name: 'Barista', hourlyWage: 17, hoursPerMonth: 140, ...est },
    { id: 'shift_lead', name: 'Shift lead', hourlyWage: 21, hoursPerMonth: 160, ...est },
  ],
  taxes: [{ id: 'sales_tax', name: 'Sales tax', base: 'taxable_revenue', rate: 0.08875, due: 'quarterly', ...est }],
  levers: [{ id: 'cleaning', name: 'Cleaning', options: [
    { id: 'full', label: 'Daily deep clean', monthlyCost: 900, effects: { quality: 0.05 } },
    { id: 'minimal', label: 'Wipe and go', monthlyCost: 250, effects: { quality: -0.05 }, causes: 'dirty_surfaces' },
  ] }],
  shortcuts: [
    { id: 'skip_pest_control', name: 'Skip pest control', what: 'Saves the monthly contract. A health inspector will notice.', saves: { basis: 'fixed', amount: 200 }, violation: 'dirty_surfaces' },
    { id: 'cash_wages', name: 'Pay staff in cash, off the books', what: 'No payroll taxes this month.', saves: { basis: 'pct_payroll', amount: 0.18 }, violation: 'off_books_payroll' },
  ],
  violations: [
    { id: 'dirty_surfaces', name: 'Unsanitary food-contact surfaces', law: 'stub', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 300, perMonth: 100, max: 2_000 }, closureDays: 0, reputationHit: 0.05, ...est },
    { id: 'no_fse_permit', name: 'Operating without a food service permit', law: 'stub', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 1_000, perMonth: 0, max: 1_000 }, closureDays: 3, ...est },
    { id: 'off_books_payroll', name: 'Unreported cash payroll', law: 'stub', official: 'tax_auditor', foundBy: ['audit', 'complaint'], fine: { base: 0, perMonth: 0, pctOfSaved: 1.5, max: null }, ...est },
  ],
  officials: [
    { id: 'health_inspector', name: 'Health inspector', agency: 'NYC DOHMH', role: 'inspector', checks: ['dirty_surfaces', 'no_fse_permit'] },
    { id: 'tax_auditor', name: 'Tax auditor', agency: 'NYS DTF', role: 'tax_auditor', checks: ['off_books_payroll'] },
  ],
  reports: [
    { id: 'report_dirty_kitchen', name: 'Report unsanitary conditions (311)', text: 'An inspector visits. If you are wrong, you get a warning.', role: 'inspector', checks: ['dirty_surfaces', 'no_fse_permit'] },
    { id: 'report_cash_wages', name: 'Report off-the-books wages', text: 'A tax auditor looks at the books.', role: 'tax_auditor', checks: ['off_books_payroll'] },
  ],
  events: [], ruleCards: [],
  benchmarks: { cogsPct: 0.3, laborPct: 0.3, rentPct: 0.08, netMarginPct: 0.06, ...est },
  suppliers: [],
  roadmap: [{ id: 'get_fse_permit', title: 'Get your Food Service Establishment Permit', text: 'Stub step', kind: 'permit', setupItemId: 'fse_permit', fee: 280, waitDays: 21, agency: 'NYC DOHMH' }],
  manager: { monthlySalary: 4_800, ...est },
  sources: [],
};

export const STUB_COMMON: CommonPack = {
  id: '_common', version: 0, name: 'Common NYC rules (stub data)',
  taxes: [], shortcuts: [], violations: [], officials: [], reports: [], ruleCards: [],
  roadmap: [{ id: 'form_llc', title: 'Form an LLC', text: 'Stub step', kind: 'legal' }],
  sources: [],
};

export const STUB_PACKS: PackSet = { common: STUB_COMMON, niches: { cafe: STUB_CAFE } };

const stubPlace = (i: number): Place => ({
  id: `stub_place_${i}`, address: `${100 + i * 2} Placeholder St (stub)`, block: 'stub_block_1',
  lat: 40.7194 + i * 0.0003, lng: -73.9845, kind: 'storefront', sqft: 900, tier: 'mid', rentPerSqftYear: 90, footTraffic: 0.6,
  suitableFor: ['cafe', 'barbershop', 'bodega'], note: 'stub for wiring only — replaced by data/places.json (agent 09)',
});

export const STUB_PLACES: Place[] = [1, 2, 3, 4, 5, 6].map(stubPlace);

/** World configs the server starts with: the live city (48 min per day) and the fast demo city. */
export function defaultConfig(id: string, demo: boolean, seed = 2026): WorldConfig {
  return {
    id, name: demo ? 'Demo city' : 'New York', city: 'nyc', seasonMonths: 12,
    dayMs: demo ? RULES.DAY_MS_DEMO : RULES.DAY_MS_LIVE, paused: false, maxOwners: 100,
    aiBusinessesTarget: demo ? 4 : 30, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05,
    nichePrizeTable: [0.5, 0.3, 0.2], demo, seed,
  };
}
