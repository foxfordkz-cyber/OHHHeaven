// Leaderboards and prizes. CONTRACT §4: the prize fund is bank × prizeShare; it is split between niches by the
// number of paying owners, inside a niche by nichePrizeTable among human businesses that are not bankrupt.
// AI businesses get no prize. While the season runs the table shows the prize each place would get today, by the
// same rule as finalizeSeason (engine/src/deals/season.ts); Standing.prize from the server wins when it is sent,
// and after the end OwnerView.payouts gives the money actually paid.
import type { NicheId, OwnerView, Payout, PublicBusiness, Standing } from '@ohh/shared/types';

export interface BoardRow {
  businessId: string; rank: number; name: string; owner: string; isAi: boolean; bankrupt: boolean; mine: boolean;
  netWorth: number; prize: number | null; podium: 1 | 2 | 3 | null;
}

export interface NicheBoard {
  niche: NicheId; pool: number; rows: BoardRow[]; mine: BoardRow | null;
  /** How the fund is split today, in percent per prize place: 50/30/20, or 62.5/37.5 when only two can win. */
  split: number[];
}

/** Niche order of the engine (engine/src/deals/standings.ts): leftover cents go to the first niches. */
export const NICHE_ORDER: NicheId[] = ['cafe', 'barbershop', 'bodega', 'guesthouse', 'rentals'];

const r2 = (v: number) => Math.round(v * 100) / 100;
const toCents = (v: number) => Math.round(v * 100);

/** Split whole cents by weights, largest remainder first — the same rule as finalizeSeason (agent 13). */
export function splitCents(totalCents: number, weights: number[]): number[] {
  const sum = weights.reduce((s, x) => s + Math.max(0, x), 0);
  if (totalCents <= 0 || sum <= 0) return weights.map(() => 0);
  const exact = weights.map((x) => (Math.max(0, x) / sum) * totalCents);
  const base = exact.map((x) => Math.floor(x));
  let left = totalCents - base.reduce((s, x) => s + x, 0);
  const order = exact.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let j = 0; left > 0; j = (j + 1) % order.length) {
    if (weights[order[j].i] > 0) { base[order[j].i] += 1; left -= 1; }
  }
  return base;
}

type PoolView = Pick<OwnerView, 'world' | 'leaderboards'> & Partial<Pick<OwnerView, 'neighbors' | 'business'>>;

/** Businesses of a niche seen by this player: the city list when there is one (the table holds only the top 20). */
function nicheMembers(v: PoolView, niche: NicheId): { humans: number; humansAlive: number; total: number } {
  const table = v.leaderboards[niche] ?? [];
  const city: Pick<PublicBusiness, 'isAi' | 'status'>[] = (v.neighbors ?? []).filter((n) => n.niche === niche);
  if (v.business && v.business.niche === niche) city.push({ isAi: v.business.isAi, status: v.business.status });
  const tableHumans = table.filter((s) => !s.isAi);
  return {
    humans: Math.max(city.filter((b) => !b.isAi).length, tableHumans.length),
    humansAlive: Math.max(city.filter((b) => !b.isAi && b.status !== 'bankrupt').length, tableHumans.filter((s) => !s.bankrupt).length),
    total: Math.max(city.length, table.length),
  };
}

/**
 * Prize fund of each niche, as finalizeSeason would split it today: the bank's prize share by human owners in the
 * niche (human businesses stand in for paying owners), and a niche with nobody who can win hands its part to the others.
 */
export function nichePools(v: PoolView): Partial<Record<NicheId, number>> {
  const cfg = v.world.config;
  const [prizeC] = splitCents(toCents(v.world.bank), [cfg.prizeShare, cfg.officialsShare, cfg.platformShare]);
  const known = Object.keys(v.leaderboards) as NicheId[];
  const niches = [...NICHE_ORDER.filter((n) => known.includes(n)), ...known.filter((n) => !NICHE_ORDER.includes(n))]
    .filter((n) => nicheMembers(v, n).humans > 0);
  const weights = niches.map((n) => nicheMembers(v, n).humans);
  const pools = splitCents(prizeC, weights);
  const canWin = niches.map((n) => nicheMembers(v, n).humansAlive > 0);
  const orphan = pools.reduce((sum, c, i) => sum + (canWin[i] ? 0 : c), 0);
  const winners = niches.map((_, i) => i).filter((i) => canWin[i]);
  const extra = orphan > 0 && winners.length ? splitCents(orphan, winners.map((i) => weights[i])) : [];
  const out: Partial<Record<NicheId, number>> = {};
  niches.forEach((n, i) => {
    const k = winners.indexOf(i);
    out[n] = canWin[i] ? (pools[i] + (k >= 0 && extra.length ? extra[k] : 0)) / 100 : 0;
  });
  return out;
}

/**
 * Prize for each place inside a niche. If fewer human businesses are eligible than there are prize places,
 * their shares are scaled up so the niche fund is still paid out in full (as in finalizeSeason).
 */
export function placePrizes(pool: number, table: number[], eligible: number): number[] {
  const places = table.slice(0, Math.max(0, eligible));
  if (places.reduce((s, x) => s + x, 0) <= 0) return [];
  return splitCents(toCents(pool), places).map((c) => c / 100);
}

/** Owner payouts of a niche after the end. OwnerView.payouts may hold only this player's own payouts. */
function finalOwnerPayouts(v: OwnerView, niche: NicheId): Payout[] | null {
  if (v.world.phase !== 'ended' || !v.payouts) return null;
  return v.payouts.filter((p) => p.kind === 'owner' && p.niche === niche);
}

export function nicheBoard(v: OwnerView, niche: NicheId): NicheBoard {
  const standings: Standing[] = [...(v.leaderboards[niche] ?? [])].sort((a, b) => a.rank - b.rank);
  const pool = nichePools(v)[niche] ?? 0;
  const eligible = standings.filter((s) => !s.isAi && !s.bankrupt);
  const prizes = placePrizes(pool, v.world.config.nichePrizeTable, eligible.length);
  const byId = new Map<string, PublicBusiness>(v.neighbors.map((n) => [n.id, n]));
  const myId = v.business?.id;
  const paid = finalOwnerPayouts(v, niche);
  // The server sent everyone's payouts, not only mine: then every winner row shows the money actually paid
  const everyone = !!paid && paid.some((p) => p.playerId !== v.me.id);
  const rows = standings.map((s) => {
    const place = eligible.findIndex((e) => e.businessId === s.businessId);
    const winner = place >= 0 && place < prizes.length;
    const projected = winner ? prizes[place] : null;
    // Payout.rank is the place among prize winners (1–3), not the row in the table; co-owners split one prize
    const actual = everyone && winner ? r2(paid!.filter((p) => p.rank === place + 1).reduce((sum, p) => sum + p.amount, 0)) : null;
    const pub = byId.get(s.businessId);
    const mine = s.businessId === myId;
    return {
      businessId: s.businessId, rank: s.rank,
      name: mine ? v.business!.name : s.name ?? pub?.name ?? `Business ${s.rank}`,
      owner: mine ? v.me.name : pub?.ownerName ?? '',
      isAi: s.isAi, bankrupt: s.bankrupt, mine, netWorth: s.netWorth,
      prize: actual !== null ? actual : s.prize !== undefined && !s.isAi ? s.prize : projected,
      podium: (place >= 0 && place < 3 ? ((place + 1) as 1 | 2 | 3) : null),
    };
  });
  const split = pool > 0 ? prizes.map((p) => Math.round((p / pool) * 1000) / 10) : [];
  return { niche, pool, rows, mine: rows.find((r) => r.mine) ?? null, split };
}

export function allBoards(v: OwnerView): NicheBoard[] {
  const known = (Object.keys(v.leaderboards) as NicheId[]).filter((n) => (v.leaderboards[n]?.length ?? 0) > 0);
  return [...NICHE_ORDER.filter((n) => known.includes(n)), ...known.filter((n) => !NICHE_ORDER.includes(n))].map((n) => nicheBoard(v, n));
}

export interface OfficialRow { name: string; points: number; isAi: boolean; rank: number; prize: number | null }

/** Officials share bank × officialsShare by points; AI officials and non-positive points get nothing. */
export function officialsBoard(world: OwnerView['world'], ranking: { name: string; points: number; isAi: boolean }[]): { pool: number; rows: OfficialRow[] } {
  const cfg = world.config;
  const [, officialsC] = splitCents(toCents(world.bank), [cfg.prizeShare, cfg.officialsShare, cfg.platformShare]);
  const sorted = [...ranking].sort((a, b) => b.points - a.points);
  const paidIdx = sorted.map((r, i) => (!r.isAi && r.points > 0 ? i : -1)).filter((i) => i >= 0);
  const parts = splitCents(officialsC, paidIdx.map((i) => sorted[i].points));
  const rows: OfficialRow[] = sorted.map((r, i) => {
    const k = paidIdx.indexOf(i);
    return { ...r, rank: i + 1, prize: k >= 0 && officialsC > 0 ? parts[k] / 100 : null };
  });
  return { pool: officialsC / 100, rows };
}

export interface MyResult {
  niche: NicheId; rank: number; of: number; payout: number; final: boolean;
  /** Place among the businesses run by people, and how many there are: prizes go by this place. */
  humanRank: number; humans: number;
}

/** My result: place among all businesses of the niche and my payout (the money paid, once the season is over). */
export function myResult(v: OwnerView): MyResult | null {
  const b = v.business;
  if (!b) return null;
  const board = nicheBoard(v, b.niche);
  const me = board.mine;
  if (!me) return null;
  const members = nicheMembers(v, b.niche);
  const of = Math.max(board.rows.length, members.total, me.rank);
  const humanRank = board.rows.filter((r) => !r.isAi && r.rank <= me.rank).length;
  const place = { niche: b.niche, rank: me.rank, of, humanRank, humans: Math.max(members.humans, humanRank) };
  const paid = v.world.phase === 'ended' && v.payouts ? v.payouts.filter((p) => p.playerId === v.me.id && p.kind === 'owner') : null;
  if (paid) return { ...place, payout: r2(paid.reduce((s, p) => s + p.amount, 0)), final: true };
  const share = b.owners.find((o) => o.playerId === v.me.id)?.share ?? 1;
  return { ...place, payout: r2((me.prize ?? 0) * share), final: false };
}
