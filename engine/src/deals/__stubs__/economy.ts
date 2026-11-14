// Заглушка netWorth агента 02 по формуле контракта (раздел 4), без долгов по займам —
// займы знает только модуль сделок и учитывает их в computeStandings.
// Заменить импортом из engine/src/index.ts, когда он появится в основной ветке.
import type { BusinessState, Money } from '../../../../shared/src/types';
import { RULES } from '../../../../shared/src/rules';
import type { EngineCtx } from '../ctx';

export function netWorth(b: BusinessState, ctx: EngineCtx): Money {
  const pack = ctx.packs.niches[b.niche];
  let items = 0;
  for (const it of b.items) {
    const s = pack?.setup.find((x) => x.id === it.id);
    if (s && (s.kind === 'equipment' || s.kind === 'furniture')) items += s.cost * it.qty;
  }
  const unpaid = b.liabilities.filter((l) => !l.paid).reduce((sum, l) => sum + l.amount, 0);
  return Math.round((b.cash + RULES.NET_WORTH_ITEMS_SHARE * items - unpaid) * 100) / 100;
}
