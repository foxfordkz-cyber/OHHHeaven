import { describe, expect, it } from 'vitest';
import { RULES } from '../../../../shared/src/rules';
import type { BusinessState, Deal, PublicBusiness } from '../../../../shared/src/types';
import {
  act, blockFundInfo, dealAvailability, dealEffect, dealEndDay, defaultTerms, distanceBetween, distanceMeters,
  endEarlyWarning, formatDistance, groupDeals, lastMonthDealMoney, loanSchedule, monthBase, monthsLeftInSeason,
  myReports, neighborRows, reportConsequences, reportEligibility, reportInboxItems, reportLimit, reportName,
  reportOptions, reportOutcomeText, termsSummary, trustLabel, validateTerms, money, pct, falseReports,
  DEAL_COPY, sideOf, otherId, daysLeftText, rankText, reportFiledDays, pendingBlockFund, reportCheckers,
} from './logic';
import {
  analytics, blockFund, blockFundActive, deals, MY_ID, myBusiness, neighbors, ownerView, ownerViewBusyWeek, packs, places,
} from './fixtures';

const nb = (id: string) => neighbors.find((n) => n.id === id) as PublicBusiness;
const avail = (id: string, me: BusinessState | null = myBusiness, ds: Deal[] = deals) =>
  dealAvailability({ me, target: nb(id), deals: ds, distanceM: distanceBetween(places, me?.placeId, nb(id).placeId) });

describe('formatting', () => {
  it('formats money, percents, trust and distance', () => {
    expect(money(1234.5)).toBe('$1,235');
    expect(money(-50)).toBe('−$50');
    expect(money(12, { signed: true })).toBe('+$12');
    expect(money(553.79, { cents: true })).toBe('$553.79');
    expect(pct(0.06)).toBe('6%');
    expect(pct(0.0388, 1)).toBe('3.9%');
    expect(trustLabel({ kept: 5, broken: 1 })).toBe('kept 5 · broke 1');
    expect(formatDistance(null)).toBe('—');
    expect(formatDistance(3)).toBe('10 m');
    expect(formatDistance(347)).toBe('350 m');
    expect(formatDistance(1530)).toBe('1.5 km');
  });
});

describe('distance and neighbors', () => {
  it('measures distance between places in meters', () => {
    const d = distanceMeters({ lat: 40.7269, lng: -73.986 }, { lat: 40.7269, lng: -73.9848 });
    expect(d).toBeGreaterThan(95);
    expect(d).toBeLessThan(110);
    expect(distanceBetween(places, 'p_e7_01', 'nope')).toBeNull();
  });

  it('lists neighbors nearest first, without me, with partner names', () => {
    const rows = neighborRows(ownerView, places);
    expect(rows.find((r) => r.biz.id === MY_ID)).toBeUndefined();
    expect(rows[0].biz.id).toBe('b_cuppa');
    for (let i = 1; i < rows.length; i++) expect((rows[i].distanceM ?? Infinity) >= (rows[i - 1].distanceM ?? Infinity)).toBe(true);
    expect(rows.find((r) => r.biz.id === 'b_cuppa')?.partnerNames).toEqual(['Luna Cafe']);
  });
});

describe('deal availability (build/CONTRACT.md §4)', () => {
  it('joint purchasing only within the same niche', () => {
    expect(avail('b_tompkins').joint_purchase.allowed).toBe(true);
    const a = avail('b_fade').joint_purchase;
    expect(a.allowed).toBe(false);
    expect(a.reason).toMatch(/same niche/);
  });

  it('cross-promo only for a different niche within 400 m', () => {
    expect(avail('b_avea').cross_promo.allowed).toBe(true); // corner store about 290 m away; their live deal is a loan
    const fade = avail('b_fade').cross_promo;
    expect(fade.allowed).toBe(false); // an offer from Fade Factory is already waiting
    expect(fade.reason).toMatch(/already waiting/);
    const sameNiche = avail('b_tompkins').cross_promo;
    expect(sameNiche.allowed).toBe(false);
    expect(sameNiche.reason).toBe('Cross-promo needs a different niche within 400 m');
    const far = avail('b_bowery').cross_promo;
    expect(far.allowed).toBe(false);
    expect(far.reason).toMatch(/within 400 m — they are .* away/);
  });

  it('cross-promo is allowed for a near business of another niche', () => {
    const noDeals = avail('b_fade', myBusiness, []).cross_promo;
    expect(noDeals.allowed).toBe(true);
  });

  it('blocks everything for closed, bankrupt, setup, self and the deal limit', () => {
    expect(avail('b_ninth').loan).toMatchObject({ allowed: false, reason: 'They are closed by the city right now' });
    expect(avail('b_les').partnership).toMatchObject({ allowed: false, reason: 'They are bankrupt' });
    expect(avail('b_cuppa', { ...myBusiness, status: 'setup' }).loan).toMatchObject({ allowed: false, reason: 'Open your doors first' });
    expect(avail('b_cuppa', null).loan).toMatchObject({ allowed: false, reason: 'Open a business first' });
    expect(dealAvailability({ me: myBusiness, target: nb('b_cuppa'), deals, distanceM: 1 }).loan.allowed).toBe(true);
    const many: Deal[] = ['x1', 'x2', 'x3', 'x4'].map((id) => ({ id, fromBusinessId: MY_ID, toBusinessId: id, terms: { type: 'cross_promo', months: 1 }, status: 'active', proposedDay: 1, expiresDay: 4 }));
    expect(avail('b_fade', myBusiness, many).cross_promo.reason).toMatch(`${RULES.MAX_ACTIVE_DEALS} active deals`);
    const busy = { ...nb('b_fade'), partners: ['a', 'b', 'c', 'd'] };
    expect(dealAvailability({ me: myBusiness, target: busy, deals: [], distanceM: 50 }).loan.reason).toMatch(/They already have/);
    const self = { ...nb('b_cuppa'), id: MY_ID };
    expect(dealAvailability({ me: myBusiness, target: self, deals: [], distanceM: 0 }).loan.reason).toBe('This is your business');
  });

  it('does not offer a second live deal of the same kind with the same neighbor', () => {
    expect(avail('b_cuppa').joint_purchase).toMatchObject({ allowed: false, reason: 'You already have a joint purchasing deal with them' });
    expect(avail('b_avea').loan).toMatchObject({ allowed: false });
  });

  it('needs cash for loans and partnerships', () => {
    const broke = { ...myBusiness, cash: 0 };
    expect(avail('b_cuppa', broke).loan.reason).toBe('You need cash to lend');
    expect(avail('b_cuppa', broke).partnership.reason).toBe('You need cash to invest');
  });
});

describe('terms', () => {
  it('validates each kind', () => {
    expect(validateTerms({ type: 'cross_promo', months: 3 }, myBusiness)).toBeNull();
    expect(validateTerms({ type: 'joint_purchase', months: 0 }, myBusiness)).toMatch(/months/);
    expect(validateTerms({ type: 'loan', amount: 2000, monthlyRatePct: 2, months: 6 }, myBusiness)).toBeNull();
    expect(validateTerms({ type: 'loan', amount: 2000, monthlyRatePct: RULES.LOAN_MAX_RATE_PCT + 1, months: 6 }, myBusiness)).toMatch(/0–5%/);
    expect(validateTerms({ type: 'loan', amount: 99_999, monthlyRatePct: 2, months: 6 }, myBusiness)).toMatch(/only have/);
    expect(validateTerms({ type: 'loan', amount: 0, monthlyRatePct: 2, months: 6 }, myBusiness)).toMatch(/amount/);
    expect(validateTerms({ type: 'partnership', amount: 5000, sharePct: 10 }, myBusiness)).toBeNull();
    expect(validateTerms({ type: 'partnership', amount: 5000, sharePct: 50 }, myBusiness)).toMatch(/5–49%/);
    expect(validateTerms({ type: 'partnership', amount: 5000, sharePct: 4 }, myBusiness)).toMatch(/5–49%/);
  });

  it('gives sensible defaults that pass validation', () => {
    for (const kind of ['joint_purchase', 'cross_promo', 'loan', 'partnership'] as const) {
      expect(validateTerms(defaultTerms(kind, myBusiness), myBusiness)).toBeNull();
    }
    expect(monthsLeftInSeason(ownerView)).toBe(11);
  });

  it('summarizes terms', () => {
    expect(termsSummary({ type: 'loan', amount: 3000, monthlyRatePct: 3, months: 6 })).toBe('Loan $3,000 · 3%/mo · 6 mo');
    expect(termsSummary({ type: 'partnership', amount: 5000, sharePct: 10 })).toBe('Partner up · $5,000 for 10%');
  });
});

describe('loan schedule', () => {
  it('pays back with equal payments and interest', () => {
    const s = loanSchedule(3000, 3, 6);
    expect(s.payment).toBeCloseTo(553.79, 2);
    expect(s.rows).toHaveLength(6);
    expect(s.rows[5].balance).toBe(0);
    expect(s.total).toBeCloseTo(s.interest + 3000, 2);
    expect(s.interest).toBeGreaterThan(0);
  });

  it('handles zero interest', () => {
    const s = loanSchedule(1200, 0, 4);
    expect(s.payment).toBe(300);
    expect(s.interest).toBe(0);
  });
});

describe('deal money', () => {
  const base = monthBase(myBusiness, analytics);

  it('uses the last closed month', () => {
    expect(base.source).toBe('last_month');
    expect(base.cogs).toBe(7380);
    expect(monthBase({ ...myBusiness, history: [] }, analytics).source).toBe('forecast');
    expect(monthBase(null, null).source).toBe('none');
  });

  it('prices each kind for me', () => {
    expect(dealEffect({ type: 'joint_purchase', months: 3 }, 'from', base).monthly).toBeCloseTo(7380 * (1 - RULES.JOINT_PURCHASE_COGS_MULT), 2);
    const cross = dealEffect({ type: 'cross_promo', months: 3 }, 'to', base).monthly as number;
    expect(cross).toBeCloseTo(24600 * (RULES.CROSS_PROMO_DEMAND_MULT * RULES.CROSS_PROMO_PRICE_MULT - 1) - 7380 * (RULES.CROSS_PROMO_DEMAND_MULT - 1), 2);
    expect(dealEffect({ type: 'loan', amount: 3000, monthlyRatePct: 3, months: 6 }, 'from', base).monthly).toBeCloseTo(553.79, 2);
    expect(dealEffect({ type: 'loan', amount: 3000, monthlyRatePct: 3, months: 6 }, 'to', base).monthly).toBeCloseTo(-553.79, 2);
    expect(dealEffect({ type: 'partnership', amount: 5000, sharePct: 10 }, 'from', base).monthly).toBeNull();
    expect(dealEffect({ type: 'partnership', amount: 5000, sharePct: 10 }, 'to', base).monthly).toBeCloseTo(-base.profit * 0.1, 2);
    expect(dealEffect({ type: 'partnership', amount: 5000, sharePct: 10 }, 'from', base).lines.join(' ')).toMatch(/estimate/);
    expect(dealEffect({ type: 'cross_promo', months: 3 }, 'to', monthBase(null, null)).monthly).toBeNull();
  });

  it('copy derives its numbers from RULES', () => {
    expect(DEAL_COPY.joint_purchase.promise).toBe('Ingredients −6% for both while the deal lasts');
    expect(DEAL_COPY.cross_promo.promise).toMatch(/^About \+6% customers for both, small discount/);
  });
});

describe('my deals', () => {
  it('groups deals by where they stand', () => {
    const g = groupDeals(deals, MY_ID);
    expect(g.incoming.map((d) => d.id).sort()).toEqual(['d1', 'd2']);
    expect(g.outgoing.map((d) => d.id)).toEqual(['d7']);
    expect(g.active.map((d) => d.id).sort()).toEqual(['d3', 'd4']);
    expect(g.completed.map((d) => d.id)).toEqual(['d5']);
    expect(g.broken.map((d) => d.id)).toEqual(['d6']);
    expect(g.closed.map((d) => d.id)).toEqual(['d8']);
    expect(groupDeals(deals, undefined).active).toEqual([]);
  });

  it('knows sides, ends, days left and last month money', () => {
    const d4 = deals.find((d) => d.id === 'd4') as Deal;
    expect(sideOf(d4, MY_ID)).toBe('from');
    expect(otherId(d4, MY_ID)).toBe('b_avea');
    expect(dealEndDay(d4)).toBe(20 + 6 * RULES.DAYS_PER_MONTH);
    expect(dealEndDay({ ...d4, terms: { type: 'partnership', amount: 1, sharePct: 10 } })).toBeNull();
    expect(daysLeftText(49, 47)).toBe('2 days left');
    expect(daysLeftText(48, 47)).toBe('1 day left');
    expect(daysLeftText(47, 47)).toBe('expires today');
    expect(lastMonthDealMoney(myBusiness, 'd5')).toBe(0);
    expect(lastMonthDealMoney(myBusiness, 'd3')).toBeNull();
    expect(endEarlyWarning({ kept: 2, broken: 1 })).toMatch('kept 2 · broke 2');
  });
});

describe('block fund', () => {
  it('counts neighbors still needed against the threshold', () => {
    const info = blockFundInfo(blockFund);
    expect(info.required).toBe(Math.ceil(RULES.BLOCK_FUND_THRESHOLD * 7));
    expect(info.needed).toBe(3);
    expect(info.line).toBe('3 more neighbors needed');
    expect(blockFundInfo({ ...blockFund, contributors: 4 }).line).toBe('1 more neighbor needed');
    expect(blockFundInfo({ ...blockFund, contributors: 5 }).line).toMatch(/starts next month/);
    expect(blockFundInfo(blockFundActive).line).toBe('Active this month: +10% foot traffic for the whole block');
  });
});

describe('report to the city', () => {
  it('lists reports for the niche and names them', () => {
    expect(reportOptions(packs, 'cafe').map((r) => r.id)).toEqual(['report_unsanitary', 'report_cash_wages', 'report_no_permit']);
    expect(reportName(packs, 'report_unsanitary')).toBe('Report unsanitary conditions (311)');
    expect(reportName(packs, 'unknown')).toBe('unknown');
  });

  it('allows one report a week', () => {
    expect(reportLimit(ownerView).allowed).toBe(true);
    const busy = reportLimit(ownerViewBusyWeek);
    expect(busy.allowed).toBe(false);
    expect(busy.nextDay).toBe(51);
    expect(busy.reason).toMatch(/One report a week/);
  });

  it('refuses self, closed and bankrupt targets', () => {
    const ok = { allowed: true };
    expect(reportEligibility(myBusiness, nb('b_cuppa'), ok).allowed).toBe(true);
    expect(reportEligibility(myBusiness, nb('b_ninth'), ok).reason).toMatch(/already closed/);
    expect(reportEligibility(myBusiness, nb('b_les'), ok).reason).toMatch(/bankrupt/);
    expect(reportEligibility(myBusiness, { ...nb('b_cuppa'), id: MY_ID }, ok).reason).toMatch(/own business/);
    expect(reportEligibility(null, nb('b_cuppa'), ok).reason).toMatch(/Open a business/);
    expect(reportEligibility(myBusiness, nb('b_cuppa'), { allowed: false, reason: 'limit' }).reason).toBe('limit');
  });

  it('tells the honest consequences and the history', () => {
    const history = myReports(ownerView);
    expect(history).toHaveLength(1);
    expect(falseReports(history)).toBe(1);
    expect(reportConsequences(history).join(' ')).toMatch(/already have a warning: .*\$500/);
    expect(reportConsequences([]).join(' ')).toMatch(/you get a warning/);
    expect(reportOutcomeText(history[0])).toBe('Nothing found — warning');
    expect(reportOutcomeText({ targetBusinessId: 'x', reportId: 'r', day: 1, status: 'taken' })).toBe('Inspection in progress');
    expect(reportInboxItems(ownerView).map((i) => i.id)).toEqual(['i1']);
  });

  it('without a structured history, counts the engine «Report filed» inbox items for the weekly limit', () => {
    const filed = { id: 'law:case-1:filed', day: ownerView.world.day - 2, kind: 'case' as const, title: 'Report filed: Fade Factory', text: '', read: false };
    const view = { ...ownerView, extra: undefined, me: { ...ownerView.me, inbox: [filed] } };
    expect(reportFiledDays(view)).toEqual([ownerView.world.day - 2]);
    expect(reportLimit(view)).toMatchObject({ allowed: false, nextDay: ownerView.world.day + 5 });
    expect(reportLimit({ ...view, me: { ...view.me, inbox: [{ ...filed, day: ownerView.world.day - 7 }] } }).allowed).toBe(true);
  });

  it('before the first month close of a block, builds a pending block fund from places and neighbors', () => {
    const pending = pendingBlockFund({ ...ownerView, blockFund: null }, places);
    expect(pending).toMatchObject({ block: 'E 7th St, 1st–2nd Ave', contributors: 0, eligible: 3, active: false, feeMonth: RULES.BLOCK_FUND_FEE_MONTH });
    expect(pendingBlockFund({ ...ownerView, business: { ...myBusiness, status: 'setup' } }, places)).toBeNull();
    expect(pendingBlockFund(ownerView, [])).toBeNull();
  });

  it('names who checks a report from the violations it checks', () => {
    const [unsanitary, wages] = packs.common.reports;
    expect(reportCheckers(packs, 'cafe', unsanitary)).toEqual(['Health inspector']);
    expect(reportCheckers(packs, 'cafe', wages)).toEqual(['Tax auditor']);
    expect(reportCheckers(packs, 'cafe', { ...wages, checks: ['not_in_the_pack'] })).toEqual([]);
    expect(reportCheckers(null, 'cafe', wages)).toEqual([]);
  });

  it('says "new" instead of place 0 for a business that has no rank yet', () => {
    expect(rankText({ rankInNiche: 2, niche: 'bodega' })).toBe('#2 in corner stores');
    expect(rankText({ rankInNiche: 0, niche: 'barbershop' })).toBe('new in barbershops');
  });

  it('reads a top-level myReports field first, if the host sends one', () => {
    const top = { ...ownerView, myReports: [{ targetBusinessId: 'b_fade', reportId: 'report_unsanitary', day: 40, outcome: 'fined' as const }] };
    expect(myReports(top).map((r) => r.targetBusinessId)).toEqual(['b_fade']);
    expect(myReports({ ...ownerView, extra: undefined })).toEqual([]);
  });
});

describe('actions', () => {
  it('builds the contract actions', () => {
    expect(act.proposeDeal('b_fade', { type: 'cross_promo', months: 3 })).toEqual({ type: 'propose_deal', toBusinessId: 'b_fade', terms: { type: 'cross_promo', months: 3 } });
    expect(act.answerDeal('d1', true)).toEqual({ type: 'answer_deal', dealId: 'd1', accept: true });
    expect(act.cancelDeal('d3')).toEqual({ type: 'cancel_deal', dealId: 'd3' });
    expect(act.report('b_cuppa', 'report_unsanitary')).toEqual({ type: 'report', targetBusinessId: 'b_cuppa', reportId: 'report_unsanitary' });
    expect(act.blockFund(true)).toEqual({ type: 'set_orders', orders: { blockFund: true } });
  });
});
