// Sample data for /dev/network and tests. Not game data: real places come from agent 09 (data/places.json),
// real reports, violations and officials from agent 14 (packs/_common.json, packs/cafe.json).
// Fines and law names below are placeholders marked `estimate`; the screens never invent numbers themselves.
import type {
  Analytics, BlockFundStatus, BusinessState, CommonPack, Deal, DayWeather, FeedItem, GameEvent, InboxItem,
  MonthReport, OwnerView, PackSet, Place, Player, PublicBusiness, Standing, WorldPublic,
} from '../../../../shared/src/types';
import { dateOf } from '../../../../shared/src/rules';
import type { NetworkExtra } from './logic';

export const TODAY = 47; // Fri, Feb 17

const BLOCK_E7 = 'E 7th St, 1st–2nd Ave';

/** A few storefronts around E 7th St in the East Village. Coordinates are approximate. */
export const places: Place[] = [
  { id: 'p_e7_01', address: '112 E 7th St', block: BLOCK_E7, lat: 40.72690, lng: -73.98600, kind: 'storefront', sqft: 650, tier: 'mid', rentPerSqftYear: 60, footTraffic: 0.62, suitableFor: ['cafe', 'barbershop', 'bodega'], note: 'fixture' },
  { id: 'p_e7_02', address: '118 E 7th St', block: BLOCK_E7, lat: 40.72676, lng: -73.98568, kind: 'storefront', sqft: 520, tier: 'mid', rentPerSqftYear: 58, footTraffic: 0.6, suitableFor: ['cafe', 'barbershop'], note: 'fixture' },
  { id: 'p_e7_03', address: '124 E 7th St', block: BLOCK_E7, lat: 40.72662, lng: -73.98536, kind: 'storefront', sqft: 480, tier: 'mid', rentPerSqftYear: 57, footTraffic: 0.58, suitableFor: ['cafe', 'barbershop', 'bodega'], note: 'fixture' },
  { id: 'p_ava_7', address: '101 Avenue A', block: 'Avenue A, 6th–7th St', lat: 40.72525, lng: -73.98330, kind: 'storefront', sqft: 700, tier: 'prime', rentPerSqftYear: 95, footTraffic: 0.8, suitableFor: ['cafe', 'bodega'], note: 'fixture' },
  { id: 'p_ava_9', address: '125 Avenue A', block: 'Avenue A, 8th–9th St', lat: 40.72640, lng: -73.98262, kind: 'storefront', sqft: 600, tier: 'prime', rentPerSqftYear: 92, footTraffic: 0.78, suitableFor: ['bodega', 'cafe'], note: 'fixture' },
  { id: 'p_2av_10', address: '140 2nd Ave', block: '2nd Ave, 9th–10th St', lat: 40.72940, lng: -73.98790, kind: 'storefront', sqft: 900, tier: 'prime', rentPerSqftYear: 110, footTraffic: 0.86, suitableFor: ['cafe', 'barbershop'], note: 'fixture' },
  { id: 'p_stm_1', address: '24 St Marks Pl', block: 'St Marks Pl, 2nd–3rd Ave', lat: 40.72880, lng: -73.98860, kind: 'storefront', sqft: 450, tier: 'prime', rentPerSqftYear: 105, footTraffic: 0.9, suitableFor: ['barbershop', 'cafe'], note: 'fixture' },
  { id: 'p_e4_bow', address: '330 Bowery', block: 'Bowery, 2nd–3rd St', lat: 40.72560, lng: -73.99230, kind: 'storefront', sqft: 550, tier: 'mid', rentPerSqftYear: 75, footTraffic: 0.7, suitableFor: ['barbershop', 'cafe'], note: 'fixture' },
  { id: 'p_e6_01', address: '305 E 6th St', block: 'E 6th St, 1st–2nd Ave', lat: 40.72600, lng: -73.98690, kind: 'storefront', sqft: 500, tier: 'mid', rentPerSqftYear: 62, footTraffic: 0.6, suitableFor: ['cafe', 'barbershop'], note: 'fixture' },
];

const config: WorldPublic['config'] = {
  id: 'demo', name: 'Demo City', city: 'nyc', seasonMonths: 12, dayMs: 2000, paused: false, maxOwners: 100,
  aiBusinessesTarget: 60, entryFee: 5, prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05,
  nichePrizeTable: [0.5, 0.3, 0.2], demo: true, seed: 42,
};

export const world: WorldPublic = {
  config, phase: 'running', day: TODAY, date: dateOf(TODAY), version: 312, bank: 410, msToNextDay: 1200,
  stats: { owners: 14, aiBusinesses: 58, officials: 6, open: 66, bankrupt: 2 },
};

const pb = (p: Partial<PublicBusiness> & Pick<PublicBusiness, 'id' | 'name' | 'niche' | 'placeId'>): PublicBusiness => ({
  ownerName: 'AI owner', isAi: false, status: 'open', price: 5, reputation: 0.6, rankInNiche: 5,
  trust: { kept: 0, broken: 0 }, partners: [], ...p,
});

export const MY_ID = 'b_luna';

export const neighbors: PublicBusiness[] = [
  pb({ id: MY_ID, name: 'Luna Cafe', ownerName: 'You', niche: 'cafe', placeId: 'p_e7_01', price: 5.25, reputation: 0.66, rankInNiche: 3, trust: { kept: 2, broken: 1 }, partners: ['b_cuppa', 'b_avea'] }),
  pb({ id: 'b_cuppa', name: 'Cuppa Joe East', ownerName: 'Maya R.', niche: 'cafe', placeId: 'p_e7_02', price: 4.95, reputation: 0.71, rankInNiche: 2, trust: { kept: 3, broken: 0 }, partners: ['b_luna'], grade: 'A' }),
  pb({ id: 'b_fade', name: 'Fade Factory', ownerName: 'Andre P.', niche: 'barbershop', placeId: 'p_e7_03', price: 38, reputation: 0.64, rankInNiche: 2, trust: { kept: 1, broken: 0 } }),
  pb({ id: 'b_tompkins', name: 'Tompkins Grind', isAi: true, niche: 'cafe', placeId: 'p_ava_7', price: 5.5, reputation: 0.58, rankInNiche: 6, trust: { kept: 4, broken: 1 } }),
  pb({ id: 'b_avea', name: 'Avenue A Deli & Grocery', isAi: true, niche: 'bodega', placeId: 'p_ava_9', price: 9, reputation: 0.55, rankInNiche: 1, trust: { kept: 2, broken: 0 }, partners: ['b_luna'] }),
  pb({ id: 'b_ninth', name: 'Ninth & Second Coffee', ownerName: 'Jordan L.', niche: 'cafe', placeId: 'p_2av_10', status: 'closed', price: 6.1, reputation: 0.49, rankInNiche: 1, trust: { kept: 5, broken: 1 }, grade: 'B' }),
  pb({ id: 'b_stmarks', name: 'St Marks Shave', isAi: true, niche: 'barbershop', placeId: 'p_stm_1', price: 42, reputation: 0.61, rankInNiche: 1, trust: { kept: 0, broken: 0 } }),
  pb({ id: 'b_bowery', name: 'Bowery Cuts', ownerName: 'Lena S.', niche: 'barbershop', placeId: 'p_e4_bow', price: 35, reputation: 0.59, rankInNiche: 3, trust: { kept: 1, broken: 2 } }),
  pb({ id: 'b_les', name: 'Lower East Brew', ownerName: 'Chris W.', niche: 'cafe', placeId: 'p_e6_01', status: 'bankrupt', price: 4.5, reputation: 0.3, rankInNiche: 9, trust: { kept: 0, broken: 1 } }),
];

const line = (id: string, label: string, kind: MonthReport['lines'][number]['kind'], amount: number) => ({ id, label, kind, amount });

// Sample month for a 24-seat cafe; profit = sum of lines (sample numbers, estimate).
const month1Lines = [
  line('rev', 'Sales', 'revenue', 24_600), line('cogs', 'Coffee, milk, food', 'cogs', -7_380),
  line('pay', 'Wages', 'payroll', -9_900), line('ptax', 'Payroll taxes', 'payroll_tax', -990),
  line('rent', 'Rent', 'rent', -3_250), line('opex', 'Utilities, insurance, supplies', 'opex', -1_350),
  line('deal_d5', 'Cross-promo with Avenue A Deli & Grocery', 'deal', 0),
];
const month1Profit = month1Lines.reduce((s, l) => s + l.amount, 0);

const month1: MonthReport = {
  month: 1, avgPrice: 5.25, demandUnits: 5_100, servedUnits: 4_686, lost: { size: 220, staff: 194, closure: 0 },
  capacityUnits: 4_700, sizeUtilization: 0.82, lines: month1Lines, revenue: 24_600, profit: month1Profit,
  cashStart: 16_000, cashEnd: 16_000 + month1Profit, taxesAccrued: 410, taxesPaid: 0, fines: 0,
  quality: 0.68, reputation: 0.64, netWorth: 24_100, rankInNiche: 3,
};

export const myBusiness: BusinessState = {
  id: MY_ID, name: 'Luna Cafe', niche: 'cafe', placeId: 'p_e7_01', isAi: false,
  owners: [{ playerId: 'pl_me', share: 1 }], managerPlayerId: 'pl_me', status: 'open',
  createdDay: 1, openedDay: 9, cash: 18_400, size: 24, items: [], setupSpent: 61_000, permits: [],
  quality: 0.68, reputation: 0.66, trust: { kept: 2, broken: 1 },
  orders: { price: 5.25, staff: { barista: 3 }, levers: { cleaning: 'full' }, shortcuts: [], blockFund: false, autopilot: 'hold' },
  trails: [], liabilities: [],
  mtd: { lines: [line('rev', 'Sales', 'revenue', 13_100), line('cogs', 'Coffee, milk, food', 'cogs', -3_930)], demandUnits: 2_700, servedUnits: 2_495, lost: { size: 110, staff: 95, closure: 0 } },
  days: [], history: [month1],
};

export const analytics: Analytics = {
  month: 2, daysIntoMonth: 17, revenue: 24_600, profit: month1Profit, cumulativeProfit: month1Profit, netWorth: 24_100,
  cogsPct: 0.3, laborPct: 0.44, rentPct: 0.13, primeCostPct: 0.74, netMarginPct: 0.07,
  fixedCostsMonth: 15_490, variableCostPerUnit: 1.58, contributionPerUnit: 3.67,
  breakEvenUnitsMonth: 4_221, breakEvenRevenueMonth: 22_160, breakEvenPrice: 4.88,
  utilization: 0.92, sizeUtilization: 0.82, lostSalesUnits: 414, lostSalesMoney: 2_174,
  cashRunwayMonths: null, setupInvested: 61_000, paybackMonths: 30, taxDueNext: { amount: 1_240, day: 90 },
  exposure: 0, benchmarks: [], nicheKpis: [],
};

export const deals: Deal[] = [
  // incoming offers
  { id: 'd1', fromBusinessId: 'b_fade', toBusinessId: MY_ID, terms: { type: 'cross_promo', months: 3 }, status: 'proposed', proposedDay: 46, expiresDay: 49 },
  { id: 'd2', fromBusinessId: 'b_bowery', toBusinessId: MY_ID, terms: { type: 'partnership', amount: 5_000, sharePct: 10 }, status: 'proposed', proposedDay: 45, expiresDay: 48 },
  // my offer waiting for an answer
  { id: 'd7', fromBusinessId: MY_ID, toBusinessId: 'b_stmarks', terms: { type: 'cross_promo', months: 2 }, status: 'proposed', proposedDay: 47, expiresDay: 50 },
  // active
  { id: 'd3', fromBusinessId: 'b_cuppa', toBusinessId: MY_ID, terms: { type: 'joint_purchase', months: 3 }, status: 'active', proposedDay: 29, expiresDay: 32, startDay: 31 },
  { id: 'd4', fromBusinessId: MY_ID, toBusinessId: 'b_avea', terms: { type: 'loan', amount: 3_000, monthlyRatePct: 3, months: 6 }, status: 'active', proposedDay: 18, expiresDay: 21, startDay: 20, paidBack: 553.79 },
  // history
  { id: 'd5', fromBusinessId: 'b_avea', toBusinessId: MY_ID, terms: { type: 'cross_promo', months: 1 }, status: 'completed', proposedDay: 1, expiresDay: 4, startDay: 2, endDay: 31 },
  { id: 'd6', fromBusinessId: MY_ID, toBusinessId: 'b_tompkins', terms: { type: 'joint_purchase', months: 3 }, status: 'broken', proposedDay: 10, expiresDay: 13, startDay: 11, endDay: 25 },
  { id: 'd8', fromBusinessId: MY_ID, toBusinessId: 'b_cuppa', terms: { type: 'partnership', amount: 4_000, sharePct: 15 }, status: 'declined', proposedDay: 40, expiresDay: 43 },
];

export const blockFund: BlockFundStatus = { block: BLOCK_E7, month: 2, contributors: 2, eligible: 7, active: false, feeMonth: 300 };
export const blockFundActive: BlockFundStatus = { block: BLOCK_E7, month: 2, contributors: 5, eligible: 7, active: true, feeMonth: 300 };

const inbox: InboxItem[] = [
  { id: 'i1', day: 22, kind: 'case', title: 'Your report: no violation found', text: 'The inspector found nothing at Tompkins Grind. This is a warning: a second false report costs $500 and the business learns your name.', ref: { type: 'case', id: 'c3' }, read: true },
  { id: 'i2', day: 46, kind: 'deal', title: 'Fade Factory offers a cross-promo', text: 'Answer within 3 days.', ref: { type: 'deal', id: 'd1' }, read: false },
];

export const me: Player = { id: 'pl_me', name: 'Alex M.', kind: 'owner', isAi: false, paid: true, joinedDay: 1, lastSeenDay: TODAY, inbox };

const weather: DayWeather[] = [
  { day: TODAY, tempF: 38, condition: 'cloudy', footTrafficMult: 0.97, label: 'Cloudy 38°F' },
  { day: TODAY + 1, tempF: 41, condition: 'rain', footTrafficMult: 0.88, label: 'Rain 41°F' },
];

const events: GameEvent[] = [
  { id: 'e1', kind: 'city', title: 'Street fair on Avenue A', text: 'Saturday street fair brings more people to Avenue A.', announcedDay: 44, startDay: 50, endDay: 50, effects: [{ target: 'footTraffic', mult: 1.2 }], origin: 'deck', block: 'Avenue A, 6th–7th St' },
];

/** Feed lines in the engine's own words (engine/src/economy, law, deals), so the meaning lines of the Network tab show. */
export const feed: FeedItem[] = [
  { id: 'f1', day: 46, kind: 'inspection', text: 'Ninth & Second Coffee is closed for 2 days by city order', businessId: 'b_ninth' },
  { id: 'f2', day: 45, kind: 'deal', text: 'Tompkins Grind and Ninth & Second Coffee started a joint purchasing deal.', businessId: 'b_tompkins' },
  { id: 'f5', day: 44, kind: 'report', text: 'Someone reported Fade Factory to the city', businessId: 'b_fade' },
  { id: 'f3', day: 43, kind: 'bankruptcy', text: "Lower East Brew went bankrupt: it could not cover the month's bills", businessId: 'b_les' },
  { id: 'f6', day: 42, kind: 'inspection', text: 'City inspector inspected Tompkins Grind: no violations', businessId: 'b_tompkins' },
  { id: 'f4', day: 41, kind: 'opening', text: 'Bowery Cuts opened its doors at 330 Bowery', businessId: 'b_bowery' },
  { id: 'f7', day: 12, kind: 'opening', text: 'Cuppa Joe East opened its doors at 118 E 7th St', businessId: 'b_cuppa' },
];

const cafeBoard: Standing[] = [
  { businessId: 'b_ninth', niche: 'cafe', rank: 1, netWorth: 31_200, isAi: false, bankrupt: false },
  { businessId: 'b_cuppa', niche: 'cafe', rank: 2, netWorth: 27_900, isAi: false, bankrupt: false },
  { businessId: MY_ID, niche: 'cafe', rank: 3, netWorth: 24_100, isAi: false, bankrupt: false },
];

export const networkExtra: NetworkExtra = {
  myReports: [
    { caseId: 'c3', targetBusinessId: 'b_tompkins', reportId: 'report_unsanitary', day: 20, status: 'closed', outcome: 'clean' },
  ],
};

export type OwnerViewWithExtra = OwnerView & { extra?: NetworkExtra };

export const ownerView: OwnerViewWithExtra = {
  kind: 'owner', me, world, business: myBusiness, stakes: [], neighbors, deals, notices: [], blockFund,
  weather, events, feed, analytics, recommendations: [], roadmap: [], leaderboards: { cafe: cafeBoard }, away: null,
  extra: networkExtra,
};

/** Same owner, but the block fund is running and a report was filed this week. */
export const ownerViewBusyWeek: OwnerViewWithExtra = {
  ...ownerView,
  blockFund: blockFundActive,
  business: { ...myBusiness, orders: { ...myBusiness.orders, blockFund: true } },
  extra: { myReports: [...networkExtra.myReports, { caseId: 'c9', targetBusinessId: 'b_ninth', reportId: 'report_unsanitary', day: 44, status: 'notice' }] },
};

/** Owner with a business that has not opened its doors yet. */
export const ownerViewSetup: OwnerViewWithExtra = {
  ...ownerView,
  business: { ...myBusiness, status: 'setup', openedDay: undefined, cash: 9_000, history: [] },
  analytics: null,
};

export const common: CommonPack = {
  id: '_common', version: 1, name: 'Common NYC rules (fixture)',
  taxes: [], shortcuts: [], ruleCards: [], roadmap: [], sources: [],
  reports: [
    { id: 'report_unsanitary', name: 'Report unsanitary conditions (311)', text: 'The Health Department sends an inspector to check cleanliness and pests.', role: 'inspector', checks: ['dirty_surfaces', 'pests'] },
    { id: 'report_cash_wages', name: 'Report off-the-books wages', text: 'A tax auditor checks payroll records against the staff on site.', role: 'tax_auditor', checks: ['off_books_payroll'] },
    { id: 'report_no_permit', name: 'Report operating without a permit', text: 'A city inspector checks that the required permits are posted and current.', role: 'inspector', checks: ['no_permit'] },
  ],
  violations: [
    { id: 'dirty_surfaces', name: 'Unsanitary food contact surfaces', law: 'NYC Health Code, Article 81', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 300, perMonth: 100, max: 2_000 }, reputationHit: 0.05, confidence: 'estimate', note: 'fixture' },
    { id: 'pests', name: 'Evidence of mice or roaches', law: 'NYC Health Code, Article 81', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 400, perMonth: 150, max: 2_000 }, closureDays: 2, reputationHit: 0.1, confidence: 'estimate', note: 'fixture' },
    { id: 'off_books_payroll', name: 'Unreported cash payroll', law: 'NY Tax Law, Article 22 (withholding)', official: 'tax_auditor', foundBy: ['audit', 'complaint'], fine: { pctOfSaved: 1.5, max: null }, reputationHit: 0.05, confidence: 'estimate', note: 'fixture' },
    { id: 'no_permit', name: 'Operating without a required permit', law: 'NYC Health Code, Article 81', official: 'health_inspector', foundBy: ['inspection', 'complaint'], fine: { base: 1_000, max: 2_000 }, closureDays: 3, reputationHit: 0.1, confidence: 'estimate', note: 'fixture' },
  ],
  officials: [
    { id: 'health_inspector', name: 'Health inspector', agency: 'NYC Department of Health and Mental Hygiene', role: 'inspector', checks: ['dirty_surfaces', 'pests', 'no_permit'], realProcess: 'Inspections are unannounced. The inspector walks the kitchen, scores each violation in points and leaves a written report. In NYC, 0–13 points earns an A grade that must be posted at the door.', source: 'https://www.nyc.gov/site/doh/business/food-operators/letter-grading-for-restaurants.page' },
    { id: 'tax_auditor', name: 'Tax auditor', agency: 'NYS Department of Taxation and Finance', role: 'tax_auditor', checks: ['off_books_payroll'], realProcess: 'An audit starts with a letter asking for payroll and sales tax records. The auditor compares reported wages and sales with the staff, bank deposits and foot traffic.', confidence: 'estimate' },
  ],
};

export const packs: PackSet = { common, niches: {} };
