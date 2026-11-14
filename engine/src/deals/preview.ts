// Предпросмотр сделки для клиента: можно ли и сколько денег в месяц она даст каждой стороне.
import type { BusinessState, DealTerms, Money, WorldState } from '../../../shared/src/types';
import { RULES, dateOf } from '../../../shared/src/rules';
import type { EngineCtx } from './ctx';
import { schedule } from './loans';
import { bizById, round2 } from './util';
import { checkDeal } from './validate';

export interface MonthBase { revenue: Money; cogs: Money; profit: Money }

/** Выручка, себестоимость и прибыль за месяц: последний отчёт или текущий месяц, растянутый на 30 дней. */
export function monthBase(b: BusinessState, day: number): MonthBase {
  const report = b.history[b.history.length - 1];
  if (report) {
    const cogs = -report.lines.filter((l) => l.kind === 'cogs').reduce((s, l) => s + l.amount, 0);
    return { revenue: report.revenue, cogs, profit: report.profit };
  }
  const days = dateOf(day).dayOfMonth;
  const lines = b.mtd.lines.filter((l) => l.kind !== 'deal');
  const scale = days > 0 ? RULES.DAYS_PER_MONTH / days : 0;
  const sum = (kind: string) => lines.filter((l) => l.kind === kind).reduce((s, l) => s + l.amount, 0);
  return {
    revenue: round2(sum('revenue') * scale),
    cogs: round2(-sum('cogs') * scale),
    profit: round2(lines.reduce((s, l) => s + l.amount, 0) * scale),
  };
}

export function dealPreview(
  w: WorldState, ctx: EngineCtx, fromBusinessId: string, toBusinessId: string, terms: DealTerms,
): { allowed: boolean; reason?: string; monthlyEffect: { from: Money; to: Money } } {
  const from = bizById(w, fromBusinessId);
  const to = bizById(w, toBusinessId);
  const reason = checkDeal(w, ctx, from, to, terms, 'propose');
  let eFrom = 0;
  let eTo = 0;
  if (from && to) {
    const bf = monthBase(from, w.day);
    const bt = monthBase(to, w.day);
    switch (terms.type) {
      case 'joint_purchase': {
        const save = 1 - RULES.JOINT_PURCHASE_COGS_MULT;
        eFrom = bf.cogs * save;
        eTo = bt.cogs * save;
        break;
      }
      case 'cross_promo': {
        const revMult = RULES.CROSS_PROMO_DEMAND_MULT * RULES.CROSS_PROMO_PRICE_MULT - 1;
        const unitsMult = RULES.CROSS_PROMO_DEMAND_MULT - 1;
        eFrom = bf.revenue * revMult - bf.cogs * unitsMult;
        eTo = bt.revenue * revMult - bt.cogs * unitsMult;
        break;
      }
      case 'loan': {
        const first = schedule(terms.amount, terms.monthlyRatePct, terms.months, w.day + 1)[0];
        eFrom = first?.payment ?? 0;
        eTo = -(first?.payment ?? 0);
        break;
      }
      case 'partnership': {
        const share = Math.max(0, bt.profit) * terms.sharePct / 100;
        eFrom = share;
        eTo = -share;
        break;
      }
    }
  }
  const out: { allowed: boolean; reason?: string; monthlyEffect: { from: Money; to: Money } } = {
    allowed: reason === null, monthlyEffect: { from: round2(eFrom), to: round2(eTo) },
  };
  if (reason) out.reason = reason;
  return out;
}
