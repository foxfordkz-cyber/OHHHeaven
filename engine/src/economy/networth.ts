import type { BusinessState, Money, Pack } from '../../../shared/src/types';
import { RULES } from '../../../shared/src/rules';
import type { EngineCtx } from '../index';
import { round2 } from './util';

/** Purchase value of furniture and equipment the business owns. */
export function itemsValue(b: BusinessState, pack: Pack | undefined): Money {
  if (!pack) return 0;
  let v = 0;
  for (const it of b.items) {
    const def = pack.setup.find((s) => s.id === it.id);
    if (!def || (def.kind !== 'equipment' && def.kind !== 'furniture')) continue;
    v += def.cost * it.qty;
  }
  return round2(v);
}

export function unpaidLiabilities(b: BusinessState): Money {
  return round2(b.liabilities.reduce((a, l) => a + (l.paid ? 0 : l.amount), 0));
}

/**
 * Score of a business (build/CONTRACT.md, section 4): cash + NET_WORTH_ITEMS_SHARE × furniture and equipment
 * − unpaid taxes. Loan balances live in deals; the deals module subtracts them in its standings.
 */
export function netWorthOf(b: BusinessState, ctx: EngineCtx): Money {
  const pack = ctx.packs.niches[b.niche];
  return round2(b.cash + RULES.NET_WORTH_ITEMS_SHARE * itemsValue(b, pack) - unpaidLiabilities(b));
}
