// managerOrders: что сделал бы осторожный нанятый управляющий. Применяет советы уровней warn и critical,
// которые меняют распоряжения; никогда не включает нарушения, не трогает фонд квартала и не заключает сделок.
import type { BusinessState, StandingOrders, WorldState } from '../../../shared/src/types';
import type { EngineCtx } from './link';
import { recommend } from './recommend';
import { legalOptions, packOf } from './model';

export function managerOrders(b: BusinessState, w: WorldState, ctx: EngineCtx): Partial<StandingOrders> {
  const pack = packOf(ctx, b.niche);
  const out: Partial<StandingOrders> = {};
  const taken = new Set<string>();
  // советы уже отсортированы: critical → warn → info; более важный совет занимает поле первым
  for (const r of recommend(b, w, ctx)) {
    if (r.severity === 'info' || r.suggested?.type !== 'set_orders') continue;
    const o = r.suggested.orders;
    if (o.price != null && !taken.has('price')) { out.price = o.price; taken.add('price'); }
    if (o.staff && !taken.has('staff')) { out.staff = { ...o.staff }; taken.add('staff'); }
    if (o.levers) {
      for (const [lever, option] of Object.entries(o.levers)) {
        if (taken.has(`lever:${lever}`) || option === b.orders.levers[lever]) continue;
        out.levers = { ...(out.levers ?? b.orders.levers), [lever]: option };
        taken.add(`lever:${lever}`);
      }
    }
    if (o.shortcuts && o.shortcuts.length === 0) out.shortcuts = [];   // убрать срезанные углы можно, добавить — никогда
  }
  if (out.levers) {
    for (const lever of pack.levers) {
      const opt = lever.options.find((x) => x.id === out.levers![lever.id]);
      if (opt?.causes) out.levers[lever.id] = [...legalOptions(lever)].sort((x, y) => x.monthlyCost - y.monthlyCost)[0]?.id ?? out.levers[lever.id];
    }
  }
  return out;
}
