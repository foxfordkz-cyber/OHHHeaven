// Множители для экономики от активных сделок и фонда квартала. Одинаковые сделки не складываются.
import type { WorldState } from '../../../shared/src/types';
import { RULES, dateOf } from '../../../shared/src/rules';
import type { EngineCtx } from './ctx';
import { bizById, inEffect, involves, placeOf } from './util';

export interface DealModifiers { cogsMult: number; demandMult: number; priceMult: number; footTrafficMult: number }

export const NEUTRAL: DealModifiers = { cogsMult: 1, demandMult: 1, priceMult: 1, footTrafficMult: 1 };

export function blockFundActive(w: WorldState, block: string, month: number): boolean {
  return w.blockFunds.some((f) => f.block === block && f.month === month && f.active);
}

export function dealModifiers(w: WorldState, ctx: EngineCtx, businessId: string): DealModifiers {
  const b = bizById(w, businessId);
  if (!b) return { ...NEUTRAL };
  const live = w.deals.filter((d) => involves(d, businessId) && inEffect(d, w.day));
  const m: DealModifiers = { ...NEUTRAL };
  if (live.some((d) => d.terms.type === 'joint_purchase')) m.cogsMult = RULES.JOINT_PURCHASE_COGS_MULT;
  if (live.some((d) => d.terms.type === 'cross_promo')) {
    m.demandMult = RULES.CROSS_PROMO_DEMAND_MULT;
    m.priceMult = RULES.CROSS_PROMO_PRICE_MULT;
  }
  const place = placeOf(ctx, b);
  if (place && blockFundActive(w, place.block, dateOf(w.day).month)) m.footTrafficMult = RULES.BLOCK_FUND_TRAFFIC_MULT;
  return m;
}
