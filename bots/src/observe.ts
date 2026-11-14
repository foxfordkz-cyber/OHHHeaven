// What a human would see in the resident's seat (mirrors OwnerView / OfficialView of build/CONTRACT.md §6).
// Residents decide ONLY from these objects — never from other businesses' cash, trails or books.
import type { BusinessState, Case, CaseCard, CaseNotice, Deal, OfficialState, Player, PublicBusiness, WorldState } from '../../shared/src/types';
import { RULES } from '../../shared/src/rules';

const publicCache = new WeakMap<WorldState, PublicBusiness[]>();

export function publicBusinesses(w: WorldState): PublicBusiness[] {
  let list = publicCache.get(w);
  if (list) return list;
  const rank = new Map(w.standings.map((s) => [s.businessId, s.rank]));
  const partners = new Map<string, string[]>();
  for (const d of w.deals) {
    if (d.status !== 'active') continue;
    (partners.get(d.fromBusinessId) ?? partners.set(d.fromBusinessId, []).get(d.fromBusinessId)!).push(d.toBusinessId);
    (partners.get(d.toBusinessId) ?? partners.set(d.toBusinessId, []).get(d.toBusinessId)!).push(d.fromBusinessId);
  }
  const names = new Map(w.players.map((p) => [p.id, p.name]));
  list = w.businesses.map((b) => ({
    id: b.id, name: b.name, ownerName: names.get(b.managerPlayerId) ?? '', isAi: b.isAi, niche: b.niche, placeId: b.placeId,
    status: b.status, price: b.orders.price, reputation: Math.round(b.reputation * 100) / 100, rankInNiche: rank.get(b.id) ?? 0,
    trust: { ...b.trust }, partners: partners.get(b.id) ?? [],
  }));
  publicCache.set(w, list);
  return list;
}

export interface OwnerSight {
  day: number;
  me: Player;
  business: BusinessState | null;   // own business, full books
  neighbors: () => PublicBusiness[]; // everyone else, public card only (lazy: built when needed)
  offers: Deal[];                    // deals proposed to me and still open
  myDeals: Deal[];                   // active or proposed deals I am part of
  notices: CaseNotice[];             // fines waiting for my answer
  feed: WorldState['feed'];
  events: WorldState['events'];
}

/** Active and proposed deals by business, built once per world object (residents act on the same world many times a day). */
const dealIndexCache = new WeakMap<WorldState, Map<string, Deal[]>>();
function liveDealsOf(w: WorldState, businessId: string): Deal[] {
  let idx = dealIndexCache.get(w);
  if (!idx) {
    idx = new Map();
    for (const d of w.deals) {
      if (d.status !== 'active' && d.status !== 'proposed') continue;
      for (const id of [d.fromBusinessId, d.toBusinessId]) (idx.get(id) ?? idx.set(id, []).get(id)!).push(d);
    }
    dealIndexCache.set(w, idx);
  }
  return idx.get(businessId) ?? [];
}
/** Cases are appended in order of openedDay, so a bounded scan from the end is enough. */
function recentCases(w: WorldState, windowDays: number): Case[] {
  const out: Case[] = [];
  for (let i = w.cases.length - 1; i >= 0; i--) {
    const c = w.cases[i];
    if (c.openedDay < w.day - windowDays) break;
    out.push(c);
  }
  return out;
}

export function ownerSight(w: WorldState, playerId: string): OwnerSight | null {
  const me = w.players.find((p) => p.id === playerId);
  if (!me || me.kind !== 'owner') return null;
  const business = w.businesses.find((b) => b.managerPlayerId === playerId && b.status !== 'bankrupt') ?? null;
  const live = business ? liveDealsOf(w, business.id) : [];
  const notices: CaseNotice[] = business
    ? recentCases(w, 60).filter((c) => c.businessId === business.id && c.status === 'notice').map((c) => ({ caseId: c.id, role: c.role, found: c.found ?? [], fine: c.fine ?? 0, closureDays: c.closureDays ?? 0, answerByDay: c.answerByDay ?? w.day, status: c.status, outcome: c.outcome }))
    : [];
  return {
    day: w.day, me, business,
    neighbors: () => publicBusinesses(w).filter((p) => p.id !== business?.id),
    offers: live.filter((d) => d.status === 'proposed' && d.toBusinessId === business?.id && d.expiresDay >= w.day),
    myDeals: live,
    notices,
    feed: w.feed, events: w.events,
  };
}

export interface OfficialSight { day: number; me: Player; official: OfficialState; queue: CaseCard[]; mine: CaseCard[]; recentTargets: Set<string> }

export function officialSight(w: WorldState, playerId: string): OfficialSight | null {
  const me = w.players.find((p) => p.id === playerId);
  const official = w.officials.find((o) => o.playerId === playerId);
  if (!me || !official) return null;
  const cards = publicBusinesses(w);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const toCard = (c: Case): CaseCard => ({ caseId: c.id, business: byId.get(c.businessId)!, role: c.role, origin: c.origin, openedDay: c.openedDay, hints: c.hints, status: c.status, bribeAmount: c.bribeAmount, found: c.found });
  const queue: CaseCard[] = [], mine: CaseCard[] = [];
  const recentTargets = new Set<string>();
  for (const c of recentCases(w, 90)) {
    if (c.status === 'open' && c.role === official.role && byId.has(c.businessId)) queue.push(toCard(c));
    if (c.officialId === official.id) {
      if (c.status !== 'closed') mine.push(toCard(c));
      if ((c.takenDay ?? -999) > w.day - RULES.SAME_TARGET_COOLDOWN_DAYS) recentTargets.add(c.businessId);
    }
  }
  return { day: w.day, me, official, queue: queue.reverse(), mine, recentTargets };
}
