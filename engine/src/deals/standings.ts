// Места внутри ниши: счёт = netWorth ± займы. Банкроты внизу: кто продержался дольше, тот выше.
import type { BusinessState, NicheId, Standing, WorldState } from '../../../shared/src/types';
import type { EngineCtx } from './ctx';
import { netWorth } from './deps';
import { outstanding } from './loans';
import { round2 } from './util';

export const NICHE_ORDER: NicheId[] = ['cafe', 'barbershop', 'bodega', 'guesthouse', 'rentals'];

/**
 * Счёт для мест. Кредитор считает невозвращённый остаток своим, должник — своим долгом.
 * Сорванный заём: кредитор его списал, а должник всё ещё должен — срыв не поднимает в таблице.
 */
export function scoreOf(w: WorldState, ctx: EngineCtx, b: BusinessState): number {
  let score = netWorth(b, ctx);
  for (const d of w.deals) {
    if (d.terms.type !== 'loan') continue;
    if (d.fromBusinessId === b.id && d.status === 'active') score += outstanding(d);
    if (d.toBusinessId === b.id && (d.status === 'active' || d.status === 'broken')) score -= outstanding(d);
  }
  return round2(score);
}

export function computeStandings(w: WorldState, ctx: EngineCtx): Standing[] {
  const out: Standing[] = [];
  const niches = [...NICHE_ORDER, ...new Set(w.businesses.map((b) => b.niche).filter((n) => !NICHE_ORDER.includes(n)))];
  for (const niche of niches) {
    const rows = w.businesses
      .filter((b) => b.niche === niche)
      .map((b) => ({ b, score: scoreOf(w, ctx, b), bankrupt: b.status === 'bankrupt' }));
    rows.sort((x, y) => {
      if (x.bankrupt !== y.bankrupt) return x.bankrupt ? 1 : -1;
      if (x.bankrupt && y.bankrupt) {
        const dx = x.b.bankruptDay ?? 0;
        const dy = y.b.bankruptDay ?? 0;
        if (dx !== dy) return dy - dx;
      }
      if (x.score !== y.score) return y.score - x.score;
      return x.b.id < y.b.id ? -1 : x.b.id > y.b.id ? 1 : 0;
    });
    rows.forEach((r, i) => out.push({ businessId: r.b.id, niche, rank: i + 1, netWorth: r.score, isAi: r.b.isAi, bankrupt: r.bankrupt }));
  }
  return out;
}
