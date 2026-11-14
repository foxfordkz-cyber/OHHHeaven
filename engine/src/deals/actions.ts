// Действия игроков: предложить, ответить, выйти из сделки.
import type { Action, ActionResult, BusinessState, Deal, DealTerms, WorldState } from '../../../shared/src/types';
import { RULES } from '../../../shared/src/rules';
import type { EngineCtx } from './ctx';
import { outstanding } from './loans';
import { addFeed, bizById, clone, dealTypeLabel, fmtMoney, notifyBusiness, playerBusiness, postLine, round2 } from './util';
import { checkDeal } from './validate';

const DPM = RULES.DAYS_PER_MONTH;

function fail(w: WorldState, error: string): ActionResult {
  return { world: w, error };
}

export function termsText(terms: DealTerms): string {
  switch (terms.type) {
    case 'joint_purchase': return `Joint purchase for ${terms.months} mo: supplies ${Math.round((1 - RULES.JOINT_PURCHASE_COGS_MULT) * 100)}% cheaper for both.`;
    case 'cross_promo': return `Cross-promo for ${terms.months} mo: +${Math.round((RULES.CROSS_PROMO_DEMAND_MULT - 1) * 100)}% customers, ${Math.round((1 - RULES.CROSS_PROMO_PRICE_MULT) * 100)}% partner discount.`;
    case 'loan': return `Loan of ${fmtMoney(terms.amount)} at ${terms.monthlyRatePct}% a month, repaid over ${terms.months} mo.`;
    case 'partnership': return `Investment of ${fmtMoney(terms.amount)} for a ${terms.sharePct}% stake: profit share and prize share.`;
  }
}

function propose(w: WorldState, ctx: EngineCtx, playerId: string, toBusinessId: string, terms: DealTerms): ActionResult {
  const from = playerBusiness(w, playerId);
  const to = bizById(w, toBusinessId);
  const err = checkDeal(w, ctx, from, to, terms, 'propose');
  if (err || !from || !to) return fail(w, err ?? 'Invalid deal.');
  const next = clone(w);
  const deal: Deal = {
    id: `deal-${w.day}-${w.deals.length + 1}`,
    fromBusinessId: from.id, toBusinessId: to.id, terms: clone(terms),
    status: 'proposed', proposedDay: w.day, expiresDay: w.day + RULES.DEAL_OFFER_DAYS,
  };
  next.deals.push(deal);
  const nf = bizById(next, from.id)!;
  const nt = bizById(next, to.id)!;
  notifyBusiness(next, nt, {
    id: `in-${deal.id}-proposed`, kind: 'deal', title: `${nf.name} offers a ${dealTypeLabel(deal)}`,
    text: `${termsText(terms)} Answer within ${RULES.DEAL_OFFER_DAYS} days.`, ref: { type: 'deal', id: deal.id },
  });
  addFeed(next, `feed-${deal.id}-proposed`, `${nf.name} offered ${nt.name} a ${dealTypeLabel(deal)}.`, nf.id);
  next.version += 1;
  return { world: next };
}

/** Деньги и доли при вступлении сделки в силу. Мир уже склонирован. */
function activate(next: WorldState, deal: Deal): void {
  const from = bizById(next, deal.fromBusinessId)!;
  const to = bizById(next, deal.toBusinessId)!;
  deal.status = 'active';
  deal.startDay = next.day + 1;
  const t = deal.terms;
  if (t.type === 'joint_purchase' || t.type === 'cross_promo') {
    deal.endDay = deal.startDay + t.months * DPM;
  }
  if (t.type === 'loan') {
    deal.paidBack = 0;
    postLine(next, from, { id: `deal:${deal.id}:loan_out`, label: `Loan to ${to.name}`, kind: 'deal', amount: -t.amount }, false);
    postLine(next, to, { id: `deal:${deal.id}:loan_in`, label: `Loan from ${from.name}`, kind: 'deal', amount: t.amount }, false);
  }
  if (t.type === 'partnership') {
    postLine(next, from, { id: `deal:${deal.id}:stake_out`, label: `${t.sharePct}% stake in ${to.name}`, kind: 'deal', amount: -t.amount }, false);
    postLine(next, to, { id: `deal:${deal.id}:stake_in`, label: `Investment from ${from.name}`, kind: 'deal', amount: t.amount }, false);
    addOwner(to, from.managerPlayerId, t.sharePct / 100);
  }
}

/** Новый владелец получает долю s; доли остальных уменьшаются пропорционально; сумма долей = 1. */
export function addOwner(b: BusinessState, playerId: string, s: number): void {
  const keep = 1 - s;
  const owners = b.owners.map((o) => ({ playerId: o.playerId, share: o.share * keep }));
  const existing = owners.find((o) => o.playerId === playerId);
  if (existing) existing.share += s;
  else owners.push({ playerId, share: s });
  const rounded = owners.map((o) => ({ playerId: o.playerId, share: Math.round(o.share * 1e6) / 1e6 }));
  const drift = 1 - rounded.reduce((sum, o) => sum + o.share, 0);
  const founder = rounded.find((o) => o.playerId === b.managerPlayerId) ?? rounded[0];
  founder.share = Math.round((founder.share + drift) * 1e6) / 1e6;
  b.owners = rounded;
}

function answer(w: WorldState, ctx: EngineCtx, playerId: string, dealId: string, accept: boolean): ActionResult {
  const deal = w.deals.find((d) => d.id === dealId);
  if (!deal) return fail(w, 'Deal not found.');
  if (deal.status !== 'proposed') return fail(w, 'This offer is no longer open.');
  const to = bizById(w, deal.toBusinessId);
  if (!to || to.managerPlayerId !== playerId) return fail(w, 'Only the business that got the offer can answer it.');
  if (w.day > deal.expiresDay) return fail(w, 'This offer has expired.');
  const from = bizById(w, deal.fromBusinessId);
  if (accept) {
    const err = checkDeal(w, ctx, from, to, deal.terms, 'accept', deal.id);
    if (err) return fail(w, err);
  }
  const next = clone(w);
  const d = next.deals.find((x) => x.id === dealId)!;
  const nf = bizById(next, d.fromBusinessId)!;
  const nt = bizById(next, d.toBusinessId)!;
  if (!accept) {
    d.status = 'declined';
    notifyBusiness(next, nf, { id: `in-${d.id}-declined`, kind: 'deal', title: `${nt.name} declined your ${dealTypeLabel(d)}`, text: termsText(d.terms), ref: { type: 'deal', id: d.id } });
  } else {
    activate(next, d);
    notifyBusiness(next, nf, { id: `in-${d.id}-accepted`, kind: 'deal', title: `${nt.name} accepted your ${dealTypeLabel(d)}`, text: termsText(d.terms), ref: { type: 'deal', id: d.id } });
    addFeed(next, `feed-${d.id}-accepted`, `${nf.name} and ${nt.name} started a ${dealTypeLabel(d)}.`, nf.id);
  }
  next.version += 1;
  return { world: next };
}

function cancel(w: WorldState, playerId: string, dealId: string): ActionResult {
  const deal = w.deals.find((d) => d.id === dealId);
  if (!deal) return fail(w, 'Deal not found.');
  const from = bizById(w, deal.fromBusinessId);
  const to = bizById(w, deal.toBusinessId);
  const isFrom = from?.managerPlayerId === playerId;
  const isTo = to?.managerPlayerId === playerId;
  if (!isFrom && !isTo) return fail(w, 'This is not your deal.');

  if (deal.status === 'proposed') {
    if (!isFrom) return fail(w, 'Decline the offer instead.');
    const next = clone(w);
    const d = next.deals.find((x) => x.id === dealId)!;
    d.status = 'cancelled';
    const nt = bizById(next, d.toBusinessId)!;
    notifyBusiness(next, nt, { id: `in-${d.id}-withdrawn`, kind: 'deal', title: `Offer withdrawn`, text: `${bizById(next, d.fromBusinessId)!.name} withdrew the ${dealTypeLabel(d)}.`, ref: { type: 'deal', id: d.id } });
    next.version += 1;
    return { world: next };
  }
  if (deal.status !== 'active') return fail(w, 'This deal is not active.');

  const t = deal.terms;
  if (t.type === 'partnership') return fail(w, 'A stake cannot be cancelled: it lasts the whole season.');
  if (t.type === 'loan') {
    if (!isTo) return fail(w, 'A lender cannot call a loan early.');
    const left = outstanding(deal);
    if ((to?.cash ?? 0) < left) return fail(w, `You need ${fmtMoney(left)} in cash to repay early.`);
    const next = clone(w);
    const d = next.deals.find((x) => x.id === dealId)!;
    const nf = bizById(next, d.fromBusinessId)!;
    const nt = bizById(next, d.toBusinessId)!;
    postLine(next, nt, { id: `deal:${d.id}:early`, label: `Loan repaid early to ${nf.name}`, kind: 'deal', amount: -left }, false);
    postLine(next, nf, { id: `deal:${d.id}:early`, label: `Loan repaid early by ${nt.name}`, kind: 'deal', amount: left }, false);
    d.paidBack = round2((d.paidBack ?? 0) + left);
    d.status = 'completed';
    d.endDay = next.day;
    nf.trust.kept += 1;
    nt.trust.kept += 1;
    notifyBusiness(next, nf, { id: `in-${d.id}-repaid`, kind: 'deal', title: `${nt.name} repaid your loan early`, text: `${fmtMoney(left)} came back.`, ref: { type: 'deal', id: d.id } });
    next.version += 1;
    return { world: next };
  }
  // Совместная закупка и кросс-промо: досрочный выход — сорванная сделка.
  const next = clone(w);
  const d = next.deals.find((x) => x.id === dealId)!;
  const quitter = bizById(next, isFrom ? d.fromBusinessId : d.toBusinessId)!;
  const other = bizById(next, isFrom ? d.toBusinessId : d.fromBusinessId)!;
  d.status = 'cancelled';
  d.endDay = next.day + 1;
  quitter.trust.broken += 1;
  notifyBusiness(next, other, { id: `in-${d.id}-quit`, kind: 'deal', title: `${quitter.name} quit your ${dealTypeLabel(d)}`, text: 'The deal ended early. Their trust score shows one broken deal.', ref: { type: 'deal', id: d.id } });
  addFeed(next, `feed-${d.id}-quit`, `${quitter.name} broke its ${dealTypeLabel(d)} with ${other.name}.`, quitter.id);
  next.version += 1;
  return { world: next };
}

export function dealActions(w: WorldState, ctx: EngineCtx, playerId: string, a: Action): ActionResult | null {
  switch (a.type) {
    case 'propose_deal': return propose(w, ctx, playerId, a.toBusinessId, a.terms);
    case 'answer_deal': return answer(w, ctx, playerId, a.dealId, a.accept);
    case 'cancel_deal': return cancel(w, playerId, a.dealId);
    default: return null;
  }
}
