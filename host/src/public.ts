// Что о бизнесе и мире видно всем. Единственный источник PublicBusiness и WorldPublic.
import type { BusinessState, PublicBusiness, WorldPublic, WorldState } from '../../shared/src/types';
import { dateOf } from '../../shared/src/rules';
import type { EngineCtx } from './types';

export function publicBusiness(w: WorldState, _ctx: EngineCtx, b: BusinessState): PublicBusiness {
  const owner = w.players.find((p) => p.id === b.managerPlayerId);
  const partners = w.deals
    .filter((d) => d.status === 'active' && (d.fromBusinessId === b.id || d.toBusinessId === b.id))
    .map((d) => (d.fromBusinessId === b.id ? d.toBusinessId : d.fromBusinessId));
  const extra = b as BusinessState & { grade?: string };
  return {
    id: b.id, name: b.name, ownerName: owner?.name ?? 'Unknown', isAi: b.isAi, niche: b.niche, placeId: b.placeId,
    status: b.status, price: b.orders.price, reputation: b.reputation,
    rankInNiche: w.standings.find((s) => s.businessId === b.id)?.rank ?? 0,
    trust: { kept: b.trust.kept, broken: b.trust.broken },
    ...(typeof extra.grade === 'string' ? { grade: extra.grade } : {}),
    partners: [...new Set(partners)],
  };
}

export function worldPublic(w: WorldState, msToNextDay?: number): WorldPublic {
  const humanOwners = w.players.filter((p) => p.kind === 'owner' && !p.isAi).length;
  return {
    config: w.config, phase: w.phase, day: w.day, date: dateOf(w.day), version: w.version, bank: w.bank,
    msToNextDay: msToNextDay ?? (w.config.paused || w.phase === 'ended' ? 0 : w.config.dayMs),
    stats: {
      owners: humanOwners,
      aiBusinesses: w.businesses.filter((b) => b.isAi && b.status !== 'bankrupt').length,
      officials: w.officials.length,
      open: w.businesses.filter((b) => b.status === 'open').length,
      bankrupt: w.businesses.filter((b) => b.status === 'bankrupt').length,
    },
  };
}
