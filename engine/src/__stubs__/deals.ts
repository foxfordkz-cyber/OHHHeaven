// Stub of engine/src/deals/index.ts (agent 13). Same signatures as build/CONTRACT.md, section 3.
// Multipliers are 1, no deals, standings by net worth inside a niche, the season simply ends.
import type { Action, ActionResult, Standing, WorldState } from '../../../shared/src/types';
import type { EngineCtx } from '../index';
import { netWorthOf } from '../economy/networth';

export function dealActions(_w: WorldState, _ctx: EngineCtx, _playerId: string, a: Action): ActionResult | null {
  void a;
  return null;
}

export function dealModifiers(_w: WorldState, _ctx: EngineCtx, _businessId: string): { cogsMult: number; demandMult: number; priceMult: number; footTrafficMult: number } {
  return { cogsMult: 1, demandMult: 1, priceMult: 1, footTrafficMult: 1 };
}

export function dealsDay(w: WorldState, _ctx: EngineCtx): WorldState {
  return w;
}

export function dealsMonthClose(w: WorldState, _ctx: EngineCtx): WorldState {
  return w;
}

export function computeStandings(w: WorldState, ctx: EngineCtx): Standing[] {
  const out: Standing[] = [];
  const niches = [...new Set(w.businesses.map((b) => b.niche))];
  for (const niche of niches) {
    const list = w.businesses
      .filter((b) => b.niche === niche)
      .map((b) => ({ b, nw: netWorthOf(b, ctx) }))
      .sort((x, y) => {
        const bx = x.b.status === 'bankrupt', by = y.b.status === 'bankrupt';
        if (bx !== by) return bx ? 1 : -1;
        if (bx && by) return (y.b.bankruptDay ?? 0) - (x.b.bankruptDay ?? 0);
        return y.nw - x.nw || x.b.id.localeCompare(y.b.id);
      });
    list.forEach(({ b, nw }, i) => out.push({ businessId: b.id, niche, rank: i + 1, netWorth: nw, isAi: b.isAi, bankrupt: b.status === 'bankrupt' }));
  }
  return out;
}

export function finalizeSeason(w: WorldState, _ctx: EngineCtx): WorldState {
  return { ...w, phase: 'ended', payouts: w.payouts ?? [] };
}
