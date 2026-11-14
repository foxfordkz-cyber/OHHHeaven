// Проверка условий сделки: одна функция для предложения, принятия и предпросмотра на клиенте.
import type { BusinessState, DealTerms, WorldState } from '../../../shared/src/types';
import { RULES } from '../../../shared/src/rules';
import type { EngineCtx } from './ctx';
import { distanceMeters, involves, isLaunched, placeOf } from './util';

export const CROSS_PROMO_MAX_METERS = 400;
export const PARTNERSHIP_MIN_PCT = 5;
export const PARTNERSHIP_MAX_PCT = 49;
export const DEAL_MAX_MONTHS = 12;

export function activeDealsOf(w: WorldState, businessId: string, ignoreDealId?: string): number {
  return w.deals.filter((d) => d.status === 'active' && d.id !== ignoreDealId && involves(d, businessId)).length;
}

/** Доля всех внешних владельцев бизнеса (всех, кроме управляющего основателя). */
export function outsideShare(b: BusinessState): number {
  return b.owners.filter((o) => o.playerId !== b.managerPlayerId).reduce((s, o) => s + o.share, 0);
}

const isInt = (x: number) => Number.isInteger(x);

/** Возвращает текст ошибки для игрока или null, если сделку можно заключить. */
export function checkDeal(
  w: WorldState, ctx: EngineCtx,
  from: BusinessState | undefined, to: BusinessState | undefined,
  terms: DealTerms, stage: 'propose' | 'accept', ignoreDealId?: string,
): string | null {
  if (w.phase === 'ended') return 'The season is over.';
  if (!from) return 'You need a business to make deals.';
  if (!to) return 'That business does not exist.';
  if (from.id === to.id) return 'You cannot make a deal with yourself.';
  if (from.status === 'bankrupt' || to.status === 'bankrupt') return 'A bankrupt business cannot make deals.';

  const operating = terms.type === 'joint_purchase' || terms.type === 'cross_promo';
  if (operating && (!isLaunched(from) || !isLaunched(to))) return 'Both businesses must be open to run this deal.';

  for (const b of [from, to]) {
    if (activeDealsOf(w, b.id, ignoreDealId) >= RULES.MAX_ACTIVE_DEALS) {
      return `${b.name} already has ${RULES.MAX_ACTIVE_DEALS} active deals.`;
    }
  }
  const same = w.deals.find((d) => d.id !== ignoreDealId && d.terms.type === terms.type
    && (d.status === 'active' || (stage === 'propose' && d.status === 'proposed'))
    && ((d.fromBusinessId === from.id && d.toBusinessId === to.id) || (d.fromBusinessId === to.id && d.toBusinessId === from.id)));
  if (same) return same.status === 'active' ? 'You already have this kind of deal with them.' : 'An offer of this kind is already waiting.';

  switch (terms.type) {
    case 'joint_purchase': {
      if (!isInt(terms.months) || terms.months < 1 || terms.months > DEAL_MAX_MONTHS) return `Length must be 1 to ${DEAL_MAX_MONTHS} months.`;
      if (from.niche !== to.niche) return 'Joint purchasing works only between businesses of the same kind.';
      return null;
    }
    case 'cross_promo': {
      if (!isInt(terms.months) || terms.months < 1 || terms.months > DEAL_MAX_MONTHS) return `Length must be 1 to ${DEAL_MAX_MONTHS} months.`;
      if (from.niche === to.niche) return 'Cross-promo works only between different kinds of business.';
      const pa = placeOf(ctx, from);
      const pb = placeOf(ctx, to);
      if (!pa || !pb) return 'Location unknown.';
      if (distanceMeters(pa, pb) > CROSS_PROMO_MAX_METERS) return `Too far apart: cross-promo needs neighbors within ${CROSS_PROMO_MAX_METERS} m.`;
      return null;
    }
    case 'loan': {
      if (!Number.isFinite(terms.amount) || terms.amount <= 0) return 'Loan amount must be positive.';
      if (!Number.isFinite(terms.monthlyRatePct) || terms.monthlyRatePct < 0 || terms.monthlyRatePct > RULES.LOAN_MAX_RATE_PCT) {
        return `Interest must be 0 to ${RULES.LOAN_MAX_RATE_PCT}% a month.`;
      }
      if (!isInt(terms.months) || terms.months < 1 || terms.months > DEAL_MAX_MONTHS) return `Term must be 1 to ${DEAL_MAX_MONTHS} months.`;
      if (terms.amount > from.cash) return 'The lender does not have that much cash.';
      return null;
    }
    case 'partnership': {
      if (!Number.isFinite(terms.amount) || terms.amount <= 0) return 'Investment must be positive.';
      if (!Number.isFinite(terms.sharePct) || terms.sharePct < PARTNERSHIP_MIN_PCT || terms.sharePct > PARTNERSHIP_MAX_PCT) {
        return `Stake must be ${PARTNERSHIP_MIN_PCT} to ${PARTNERSHIP_MAX_PCT}%.`;
      }
      if (from.managerPlayerId === to.managerPlayerId) return 'You cannot buy a stake in your own business.';
      if (terms.amount > from.cash) return 'The investor does not have that much cash.';
      if (outsideShare(to) + terms.sharePct / 100 > PARTNERSHIP_MAX_PCT / 100 + 1e-9) {
        return `Outside partners can own at most ${PARTNERSHIP_MAX_PCT}% of a business.`;
      }
      return null;
    }
  }
}
