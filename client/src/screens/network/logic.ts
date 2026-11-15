// Pure helpers for the Network tab: no React, no network, no Date. Every number comes from the view or RULES.
import type {
  Action, Analytics, BlockFundStatus, BusinessState, Case, CommonPack, Deal, DealTerms, Money, NicheId,
  OwnerView, PackReport, PackSet, Place, PublicBusiness,
} from '../../../../shared/src/types';
import { RULES, dateOf } from '../../../../shared/src/rules';

/** build/CONTRACT.md §4: cross-promo only between different niches within this distance. Not in RULES yet. */
export const CROSS_PROMO_MAX_METERS = 400;
/** Partnership share bounds. */
export const PARTNER_SHARE_MIN_PCT = 5;
export const PARTNER_SHARE_MAX_PCT = 49;
/** engine/src/deals/validate.ts DEAL_MAX_MONTHS (agent 13); the sheet also caps it by the months left in the season. */
export const TIMED_DEAL_MAX_MONTHS = 12;
export const LOAN_MAX_MONTHS = 12;

export type DealKind = DealTerms['type'];
export const DEAL_KINDS: DealKind[] = ['joint_purchase', 'cross_promo', 'loan', 'partnership'];

/** Fields the Network tab needs that OwnerView does not have yet. */
export interface MyReport {
  caseId?: string; targetBusinessId: string; reportId: string; day: number;
  status?: Case['status']; outcome?: Case['outcome'];
}
export interface NetworkExtra { myReports: MyReport[] }

// ───────────── formatting ─────────────

export const money = (n: Money, opts: { cents?: boolean; signed?: boolean } = {}): string => {
  const abs = Math.abs(n);
  const digits = opts.cents ? 2 : 0;
  const s = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (n < 0) return '−' + s;
  return opts.signed && n > 0 ? '+' + s : s;
};

export const pct = (fraction: number, digits = 0): string => `${(fraction * 100).toFixed(digits).replace(/\.0+$/, '')}%`;

export const NICHE_LABEL: Record<NicheId, string> = {
  cafe: 'Cafe', barbershop: 'Barbershop', bodega: 'Corner store', guesthouse: 'Guesthouse', rentals: 'Rentals',
};
const NICHE_PLURAL: Record<NicheId, string> = {
  cafe: 'cafes', barbershop: 'barbershops', bodega: 'corner stores', guesthouse: 'guesthouses', rentals: 'rentals',
};

/** "#2 in cafes"; a business without a place yet (rank 0, just opened) is "new in cafes". */
export const rankText = (b: Pick<PublicBusiness, 'rankInNiche' | 'niche'>): string =>
  b.rankInNiche > 0 ? `#${b.rankInNiche} in ${NICHE_PLURAL[b.niche]}` : `new in ${NICHE_PLURAL[b.niche]}`;

export const trustLabel = (t: { kept: number; broken: number }): string => `kept ${t.kept} · broke ${t.broken}`;

export function formatDistance(m: number | null): string {
  if (m === null) return '—';
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

// ───────────── places and neighbors ─────────────

/** Great-circle distance in meters. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceBetween(places: Place[], placeA: string | undefined, placeB: string | undefined): number | null {
  const a = places.find((p) => p.id === placeA);
  const b = places.find((p) => p.id === placeB);
  return a && b ? distanceMeters(a, b) : null;
}

export interface NeighborRow { biz: PublicBusiness; distanceM: number | null; partnerNames: string[] }

/** Everyone except me, nearest first; businesses with unknown places go last. */
export function neighborRows(view: OwnerView, places: Place[]): NeighborRow[] {
  const myId = view.business?.id;
  const myPlace = view.business?.placeId;
  const nameOf = (id: string) => view.neighbors.find((n) => n.id === id)?.name ?? (id === myId ? view.business?.name : undefined) ?? 'a business';
  return view.neighbors
    .filter((n) => n.id !== myId)
    .map((biz) => ({ biz, distanceM: distanceBetween(places, myPlace, biz.placeId), partnerNames: biz.partners.map(nameOf) }))
    .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity) || a.biz.name.localeCompare(b.biz.name));
}

// ───────────── deals: availability ─────────────

export interface KindAvailability { kind: DealKind; allowed: boolean; reason?: string }

const isLive = (d: Deal) => d.status === 'active' || d.status === 'proposed';
const between = (d: Deal, x: string, y: string) =>
  (d.fromBusinessId === x && d.toBusinessId === y) || (d.fromBusinessId === y && d.toBusinessId === x);

export const KIND_NAME: Record<DealKind, string> = {
  joint_purchase: 'Joint purchasing', cross_promo: 'Cross-promo', loan: 'Loan', partnership: 'Partner up',
};
const KIND_NOUN: Record<DealKind, string> = {
  joint_purchase: 'joint purchasing deal', cross_promo: 'cross-promo', loan: 'loan', partnership: 'partnership',
};

/** Which of the four deal kinds I can offer this neighbor, by build/CONTRACT.md §4 and task 13 §1. The engine re-checks. */
export function dealAvailability(args: {
  me: BusinessState | null; target: PublicBusiness; deals: Deal[]; distanceM: number | null;
}): Record<DealKind, KindAvailability> {
  const { me, target, deals, distanceM } = args;
  const result = {} as Record<DealKind, KindAvailability>;
  const blockAll = commonBlock(me, target, deals);
  for (const kind of DEAL_KINDS) {
    if (blockAll) { result[kind] = { kind, allowed: false, reason: blockAll }; continue; }
    result[kind] = { kind, ...kindRule(kind, me as BusinessState, target, deals, distanceM) };
  }
  return result;
}

function commonBlock(me: BusinessState | null, target: PublicBusiness, deals: Deal[]): string | null {
  if (!me) return 'Open a business first';
  if (me.id === target.id) return 'This is your business';
  if (me.status === 'setup') return 'Open your doors first';
  if (me.status === 'closed') return 'Your business is closed by the city right now';
  if (me.status === 'bankrupt') return 'Your business is bankrupt';
  if (target.status === 'setup') return 'They have not opened yet';
  if (target.status === 'closed') return 'They are closed by the city right now';
  if (target.status === 'bankrupt') return 'They are bankrupt';
  const myActive = deals.filter((d) => d.status === 'active' && (d.fromBusinessId === me.id || d.toBusinessId === me.id)).length;
  if (myActive >= RULES.MAX_ACTIVE_DEALS) return `You already have ${RULES.MAX_ACTIVE_DEALS} active deals, the maximum`;
  if (target.partners.length >= RULES.MAX_ACTIVE_DEALS) return `They already have ${RULES.MAX_ACTIVE_DEALS} active deals, the maximum`;
  return null;
}

function kindRule(kind: DealKind, me: BusinessState, target: PublicBusiness, deals: Deal[], distanceM: number | null): { allowed: boolean; reason?: string } {
  const same = deals.find((d) => isLive(d) && d.terms.type === kind && between(d, me.id, target.id));
  if (same) return { allowed: false, reason: same.status === 'proposed' ? `A ${KIND_NOUN[kind]} offer is already waiting` : `You already have a ${KIND_NOUN[kind]} with them` };
  switch (kind) {
    case 'joint_purchase':
      return target.niche === me.niche ? { allowed: true } : { allowed: false, reason: `Joint purchasing needs the same niche (they are a ${NICHE_LABEL[target.niche].toLowerCase()})` };
    case 'cross_promo': {
      const base = `Cross-promo needs a different niche within ${CROSS_PROMO_MAX_METERS} m`;
      if (target.niche === me.niche) return { allowed: false, reason: base };
      if (distanceM !== null && distanceM > CROSS_PROMO_MAX_METERS) return { allowed: false, reason: `${base} — they are ${formatDistance(distanceM)} away` };
      return { allowed: true };
    }
    case 'loan':
      return me.cash > 0 ? { allowed: true } : { allowed: false, reason: 'You need cash to lend' };
    case 'partnership':
      return me.cash > 0 ? { allowed: true } : { allowed: false, reason: 'You need cash to invest' };
  }
}

// ───────────── deals: terms, validation, money ─────────────

export function defaultTerms(kind: DealKind, me: BusinessState | null): DealTerms {
  const cash = Math.max(0, Math.floor(me?.cash ?? 0));
  switch (kind) {
    case 'joint_purchase': return { type: 'joint_purchase', months: 3 };
    case 'cross_promo': return { type: 'cross_promo', months: 3 };
    case 'loan': return { type: 'loan', amount: Math.min(2_000, cash), monthlyRatePct: 2, months: 6 };
    case 'partnership': return { type: 'partnership', amount: Math.min(5_000, cash), sharePct: 10 };
  }
}

/** Months left in the season including the current one; timed deals should not outlive the season. */
export function monthsLeftInSeason(view: Pick<OwnerView, 'world'>): number {
  return Math.max(1, view.world.config.seasonMonths - view.world.date.month + 1);
}

/** null — terms are fine; otherwise the reason shown under the form. */
export function validateTerms(terms: DealTerms, me: BusinessState | null): string | null {
  const cash = me?.cash ?? 0;
  const int = (n: number) => Number.isFinite(n) && Math.round(n) === n;
  switch (terms.type) {
    case 'joint_purchase':
    case 'cross_promo':
      return int(terms.months) && terms.months >= 1 && terms.months <= TIMED_DEAL_MAX_MONTHS ? null : `Pick 1–${TIMED_DEAL_MAX_MONTHS} months`;
    case 'loan':
      if (!(terms.amount > 0)) return 'Enter an amount to lend';
      if (terms.amount > cash) return `You only have ${money(cash)} in cash`;
      if (!(terms.monthlyRatePct >= 0) || terms.monthlyRatePct > RULES.LOAN_MAX_RATE_PCT) return `Interest is 0–${RULES.LOAN_MAX_RATE_PCT}% a month`;
      if (!int(terms.months) || terms.months < 1 || terms.months > LOAN_MAX_MONTHS) return `Term is 1–${LOAN_MAX_MONTHS} months`;
      return null;
    case 'partnership':
      if (!(terms.amount > 0)) return 'Enter an amount to invest';
      if (terms.amount > cash) return `You only have ${money(cash)} in cash`;
      if (!(terms.sharePct >= PARTNER_SHARE_MIN_PCT) || terms.sharePct > PARTNER_SHARE_MAX_PCT) return `Share is ${PARTNER_SHARE_MIN_PCT}–${PARTNER_SHARE_MAX_PCT}%`;
      return null;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface LoanRow { month: number; payment: Money; interest: Money; principal: Money; balance: Money }
/** Equal monthly payments (annuity). Must match agent 13's loan math. */
export function loanSchedule(amount: Money, monthlyRatePct: number, months: number): { payment: Money; total: Money; interest: Money; rows: LoanRow[] } {
  const n = Math.max(1, Math.round(months));
  const r = monthlyRatePct / 100;
  const payment = r === 0 ? amount / n : (amount * r) / (1 - (1 + r) ** -n);
  const rows: LoanRow[] = [];
  let balance = amount;
  for (let m = 1; m <= n; m++) {
    const interest = balance * r;
    const principal = m === n ? balance : payment - interest;
    balance = Math.max(0, balance - principal);
    rows.push({ month: m, payment: round2(m === n ? principal + interest : payment), interest: round2(interest), principal: round2(principal), balance: round2(balance) });
  }
  const total = round2(rows.reduce((s, x) => s + x.payment, 0));
  return { payment: round2(payment), total, interest: round2(total - amount), rows };
}

/** A month of my own numbers: last closed month, else the analytics forecast. */
export interface MonthBase { revenue: Money; cogs: Money; profit: Money; source: 'last_month' | 'forecast' | 'none' }
export function monthBase(me: BusinessState | null, analytics: Analytics | null): MonthBase {
  const last = me?.history[me.history.length - 1];
  if (last) {
    const cogs = -last.lines.filter((l) => l.kind === 'cogs').reduce((s, l) => s + l.amount, 0);
    return { revenue: last.revenue, cogs, profit: last.profit, source: 'last_month' };
  }
  if (analytics) return { revenue: analytics.revenue, cogs: analytics.revenue * normalizePct(analytics.cogsPct), profit: analytics.profit, source: 'forecast' };
  return { revenue: 0, cogs: 0, profit: 0, source: 'none' };
}
const normalizePct = (x: number) => (x > 1 ? x / 100 : x);

export const DEAL_COPY: Record<DealKind, { title: string; life: string; promise: string }> = {
  joint_purchase: {
    title: 'Joint purchasing',
    life: 'Two cafes order beans and milk together and get the wholesale price.',
    promise: `Ingredients −${pct(1 - RULES.JOINT_PURCHASE_COGS_MULT)} for both while the deal lasts`,
  },
  cross_promo: {
    title: 'Cross-promo',
    life: 'The barbershop next door hands out your coupons; you keep their flyers at your register.',
    promise: `About +${pct(RULES.CROSS_PROMO_DEMAND_MULT - 1)} customers for both, small discount (−${pct(1 - RULES.CROSS_PROMO_PRICE_MULT)} on the average check)`,
  },
  loan: {
    title: 'Loan',
    life: 'You lend a neighbor cash; they pay it back in equal monthly payments with interest.',
    promise: `Up to ${RULES.LOAN_MAX_RATE_PCT}% a month. If they go bankrupt, what is left is lost.`,
  },
  partnership: {
    title: 'Partner up',
    life: 'You put money into their business for a share, like a small investor.',
    promise: 'Your share of their profit every month, and your share of their prize.',
  },
};

export interface DealEffect { monthly: Money | null; lines: string[] }

/** What a deal is worth to me per month. `side` — am I the deal's `from` or its `to`. Estimates are labelled in the text. */
export function dealEffect(terms: DealTerms, side: 'from' | 'to', base: MonthBase): DealEffect {
  const known = base.source !== 'none';
  switch (terms.type) {
    case 'joint_purchase': {
      const v = base.cogs * (1 - RULES.JOINT_PURCHASE_COGS_MULT);
      return { monthly: known ? round2(v) : null, lines: known ? [`≈ ${money(v, { signed: true })} a month for you: −${pct(1 - RULES.JOINT_PURCHASE_COGS_MULT)} on ${money(base.cogs)} of ingredients`] : ['Your saving is 6% of your monthly ingredient bill'] };
    }
    case 'cross_promo': {
      const extraRevenue = base.revenue * (RULES.CROSS_PROMO_DEMAND_MULT * RULES.CROSS_PROMO_PRICE_MULT - 1);
      const extraCogs = base.cogs * (RULES.CROSS_PROMO_DEMAND_MULT - 1);
      const v = extraRevenue - extraCogs;
      return { monthly: known ? round2(v) : null, lines: known ? [`≈ ${money(v, { signed: true })} a month for you if you have room for ${pct(RULES.CROSS_PROMO_DEMAND_MULT - 1)} more customers`] : ['More customers if you have free seats and staff'] };
    }
    case 'loan': {
      const s = loanSchedule(terms.amount, terms.monthlyRatePct, terms.months);
      return side === 'from'
        ? { monthly: s.payment, lines: [`They pay you ${money(s.payment, { cents: true })} a month for ${terms.months} months`, `You earn ${money(s.interest, { cents: true })} interest on ${money(terms.amount)}`, 'If they go bankrupt, the unpaid rest is lost'] }
        : { monthly: -s.payment, lines: [`You get ${money(terms.amount)} now`, `You pay ${money(s.payment, { cents: true })} a month for ${terms.months} months, ${money(s.total, { cents: true })} in total`, 'Miss a payment and the deal counts as broken'] };
    }
    case 'partnership': {
      const share = terms.sharePct / 100;
      if (side === 'from') {
        const lines = [`They get ${money(terms.amount)} for ${terms.sharePct}% of their business`, `You get ${terms.sharePct}% of their profit every month it is positive, and ${terms.sharePct}% of their prize`];
        if (known && base.profit > 0) lines.push(`If they earn what you earn (${money(base.profit)} a month), that is ${money(base.profit * share)} a month — an estimate`);
        lines.push('If they go bankrupt, your money is gone');
        return { monthly: null, lines };
      }
      const v = known ? -Math.max(0, base.profit) * share : null;
      return { monthly: v === null ? null : round2(v), lines: [`You get ${money(terms.amount)} in cash now`, `They get ${terms.sharePct}% of your profit every month it is positive${known && base.profit > 0 ? ` (≈ ${money(base.profit * share)} at your current profit)` : ''} and ${terms.sharePct}% of your prize`] };
    }
  }
}

export function termsSummary(terms: DealTerms): string {
  switch (terms.type) {
    case 'joint_purchase': return `Joint purchasing · ${terms.months} mo`;
    case 'cross_promo': return `Cross-promo · ${terms.months} mo`;
    case 'loan': return `Loan ${money(terms.amount)} · ${terms.monthlyRatePct}%/mo · ${terms.months} mo`;
    case 'partnership': return `Partner up · ${money(terms.amount)} for ${terms.sharePct}%`;
  }
}

// ───────────── deals: my lists ─────────────

export interface DealGroups { incoming: Deal[]; outgoing: Deal[]; active: Deal[]; completed: Deal[]; broken: Deal[]; closed: Deal[] }
export function groupDeals(deals: Deal[], myId: string | undefined): DealGroups {
  const g: DealGroups = { incoming: [], outgoing: [], active: [], completed: [], broken: [], closed: [] };
  if (!myId) return g;
  for (const d of deals) {
    if (d.fromBusinessId !== myId && d.toBusinessId !== myId) continue;
    if (d.status === 'proposed') (d.toBusinessId === myId ? g.incoming : g.outgoing).push(d);
    else if (d.status === 'active') g.active.push(d);
    else if (d.status === 'completed') g.completed.push(d);
    else if (d.status === 'broken' || d.status === 'cancelled') g.broken.push(d);
    else g.closed.push(d);
  }
  const byDay = (a: Deal, b: Deal) => (b.startDay ?? b.proposedDay) - (a.startDay ?? a.proposedDay);
  for (const k of Object.keys(g) as (keyof DealGroups)[]) g[k].sort(byDay);
  return g;
}

export const sideOf = (d: Deal, myId: string): 'from' | 'to' => (d.fromBusinessId === myId ? 'from' : 'to');
export const otherId = (d: Deal, myId: string): string => (d.fromBusinessId === myId ? d.toBusinessId : d.fromBusinessId);

export function daysLeftText(expiresDay: number, today: number): string {
  const left = expiresDay - today;
  if (left <= 0) return 'expires today';
  return left === 1 ? '1 day left' : `${left} days left`;
}

/** Day a timed deal ends; loans end after their last payment month. Partnerships have no end. */
export function dealEndDay(d: Deal): number | null {
  if (d.startDay === undefined) return null;
  const months = d.terms.type === 'partnership' ? null : d.terms.months;
  return months === null ? null : d.startDay + months * RULES.DAYS_PER_MONTH;
}

/** Money this deal moved for me last month, from my P&L lines whose id mentions the deal id. */
export function lastMonthDealMoney(me: BusinessState | null, dealId: string): Money | null {
  const last = me?.history[me.history.length - 1];
  if (!last) return null;
  const lines = last.lines.filter((l) => l.kind === 'deal' && l.id.includes(dealId));
  return lines.length ? round2(lines.reduce((s, l) => s + l.amount, 0)) : null;
}

export const endEarlyWarning = (trust: { kept: number; broken: number }): string =>
  `Ending early counts as a broken deal. Your record becomes ${trustLabel({ kept: trust.kept, broken: trust.broken + 1 })}, and every neighbor sees it.`;

// ───────────── block fund ─────────────

export interface BlockFundInfo { needed: number; required: number; active: boolean; line: string; gives: string; fee: Money }
export function blockFundInfo(bf: BlockFundStatus): BlockFundInfo {
  const required = Math.ceil(RULES.BLOCK_FUND_THRESHOLD * bf.eligible);
  const needed = Math.max(0, required - bf.contributors);
  const gives = `+${pct(RULES.BLOCK_FUND_TRAFFIC_MULT - 1)} foot traffic for the whole block`;
  const line = bf.active
    ? `Active this month: ${gives}`
    : needed > 0
      ? `${needed} more ${needed === 1 ? 'neighbor' : 'neighbors'} needed`
      : 'Enough neighbors: the bonus starts next month';
  return { needed, required, active: bf.active, line, gives, fee: bf.feeMonth };
}

/**
 * The host sends no block fund status for a block until its first month close (engine/src/deals/month.ts writes it then).
 * Until that, the card still lets the owner chip in: the block comes from my place and the count of businesses from
 * neighbors on the same block that are open or closed by the city (engine rule `isLaunched`). Nobody has been counted yet.
 */
export function pendingBlockFund(view: OwnerView, places: Place[]): BlockFundStatus | null {
  const me = view.business;
  if (!me || (me.status !== 'open' && me.status !== 'closed')) return null;
  const blockOf = new Map(places.map((p) => [p.id, p.block]));
  const block = blockOf.get(me.placeId);
  if (!block) return null;
  const others = view.neighbors.filter((n) => n.id !== me.id && blockOf.get(n.placeId) === block && (n.status === 'open' || n.status === 'closed')).length;
  return { block, month: view.world.date.month, contributors: 0, eligible: others + 1, active: false, feeMonth: RULES.BLOCK_FUND_FEE_MONTH };
}

// ───────────── report to the city ─────────────

/** Reports that apply to a business of this niche: the niche pack's first (the most specific), then the common ones. */
export function reportOptions(packs: PackSet | null, niche: NicheId): PackReport[] {
  if (!packs) return [];
  const all = [...(packs.niches[niche]?.reports ?? []), ...packs.common.reports];
  return all.filter((r, i) => all.findIndex((x) => x.id === r.id) === i);
}

/** My reports and their outcomes: `myReports` (requested contract field) or `extra.myReports`, when the host sends one. */
export function myReports(view: OwnerView & { extra?: Partial<NetworkExtra>; myReports?: MyReport[] }): MyReport[] {
  const list = view.myReports ?? view.extra?.myReports;
  return Array.isArray(list) ? [...list].sort((a, b) => b.day - a.day) : [];
}

/** Report-related inbox items, for hosts that do not send `extra.myReports` yet. */
export function reportInboxItems(view: OwnerView) {
  return view.me.inbox.filter((i) => i.kind === 'case' && /report/i.test(i.title)).sort((a, b) => b.day - a.day);
}

/** Days I filed reports on: the structured history, or else the engine's «Report filed» inbox items (law:<case>:filed). */
export function reportFiledDays(view: OwnerView & { extra?: Partial<NetworkExtra>; myReports?: MyReport[] }): number[] {
  const structured = myReports(view);
  if (structured.length) return structured.map((r) => r.day);
  return view.me.inbox.filter((i) => i.kind === 'case' && (/:filed$/.test(i.id) || /^Report filed/i.test(i.title))).map((i) => i.day);
}

/** Same rule as the engine (engine/src/law/actions.ts): REPORTS_PER_WEEK reports in any 7 game days. */
export function reportLimit(view: OwnerView & { extra?: Partial<NetworkExtra>; myReports?: MyReport[] }): { allowed: boolean; reason?: string; nextDay?: number } {
  const recent = reportFiledDays(view).filter((d) => d > view.world.day - 7);
  if (recent.length < RULES.REPORTS_PER_WEEK) return { allowed: true };
  const nextDay = Math.min(...recent) + 7;
  return { allowed: false, reason: `One report a week. Your next report: ${dateOf(nextDay).label}`, nextDay };
}

export function reportEligibility(me: BusinessState | null, target: PublicBusiness, limit: { allowed: boolean; reason?: string }): { allowed: boolean; reason?: string } {
  if (!me) return { allowed: false, reason: 'Open a business first' };
  if (me.id === target.id) return { allowed: false, reason: 'You cannot report your own business' };
  if (target.status === 'closed') return { allowed: false, reason: 'The city has already closed them for now' };
  if (target.status === 'bankrupt') return { allowed: false, reason: 'This business is bankrupt' };
  if (!limit.allowed) return limit;
  return { allowed: true };
}

export function falseReports(reports: MyReport[]): number {
  return reports.filter((r) => r.outcome === 'clean').length;
}

/** The honest consequences shown before sending a report. */
export function reportConsequences(reports: MyReport[]): string[] {
  const warned = falseReports(reports) > 0;
  return [
    'If they really break the rules, an official inspects them and they pay the fine the law sets.',
    warned
      ? `You already have a warning: if nothing is found this time, you pay ${money(RULES.FALSE_REPORT_FINE)} and they learn your name.`
      : `If nothing is found, you get a warning. The next false report costs ${money(RULES.FALSE_REPORT_FINE)} and they learn your name.`,
    `One report a week (${RULES.REPORTS_PER_WEEK} per 7 game days).`,
  ];
}

export function reportOutcomeText(r: MyReport): string {
  if (r.outcome === 'clean') return 'Nothing found — warning';
  if (r.outcome === 'fined') return 'Violation found — fined';
  if (r.outcome === 'bribed') return 'Closed without a fine';
  if (r.outcome === 'dismissed') return 'Dismissed';
  if (r.status === 'open') return 'Waiting for an official';
  if (r.status === 'taken') return 'Inspection in progress';
  if (r.status === 'notice' || r.status === 'bribe_offered') return 'Violation found — owner is answering';
  return 'Filed';
}

export function reportName(packs: PackSet | null, reportId: string): string {
  if (!packs) return 'Report';
  const all: PackReport[] = [...packs.common.reports, ...Object.values(packs.niches).flatMap((p) => p?.reports ?? [])];
  return all.find((r) => r.id === reportId)?.name ?? reportId;
}

/** Who checks a report in real life: the officials named by the violations it checks (niche pack first, then common). */
export function reportCheckers(packs: PackSet | null, niche: NicheId, report: PackReport): string[] {
  if (!packs) return [];
  const violations = [...(packs.niches[niche]?.violations ?? []), ...packs.common.violations];
  const officials = [...(packs.niches[niche]?.officials ?? []), ...packs.common.officials];
  const names: string[] = [];
  for (const id of report.checks) {
    const v = violations.find((x) => x.id === id);
    const o = v ? officials.find((x) => x.id === v.official) : undefined;
    if (o && !names.includes(o.name)) names.push(o.name);
  }
  return names;
}

export const reportCatalogEmpty =(c: Pick<CommonPack, 'reports'>): boolean => c.reports.length === 0;

// ───────────── actions: the only thing the screens send ─────────────

export const act = {
  proposeDeal: (toBusinessId: string, terms: DealTerms): Action => ({ type: 'propose_deal', toBusinessId, terms }),
  answerDeal: (dealId: string, accept: boolean): Action => ({ type: 'answer_deal', dealId, accept }),
  cancelDeal: (dealId: string): Action => ({ type: 'cancel_deal', dealId }),
  report: (targetBusinessId: string, reportId: string): Action => ({ type: 'report', targetBusinessId, reportId }),
  blockFund: (on: boolean): Action => ({ type: 'set_orders', orders: { blockFund: on } }),
};
