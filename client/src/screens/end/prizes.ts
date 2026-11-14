// Leaderboards and prizes. CONTRACT §4: the prize fund is bank × prizeShare; it is split between niches by the
// number of paying owners, inside a niche by nichePrizeTable among human businesses that are not bankrupt.
// AI businesses get no prize. OwnerView carries no prize amounts yet, so the table shows the projected prize by
// these rules; when the season ends, final payouts from the server (if present) win.
import type { NicheId, OwnerView, Payout, PublicBusiness, Standing } from '@shared/types';

export interface BoardRow {
  businessId: string; rank: number; name: string; owner: string; isAi: boolean; bankrupt: boolean; mine: boolean;
  netWorth: number; prize: number | null; podium: 1 | 2 | 3 | null;
}

export interface NicheBoard { niche: NicheId; pool: number; rows: BoardRow[]; mine: BoardRow | null }

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

/**
 * Prize fund of each niche, as finalizeSeason would split it today: the bank's prize share by paying human owners
 * in the niche (human businesses stand in for them), and a niche with nobody who can win hands its part to the others.
 */
export function nichePools(v: Pick<OwnerView, 'world' | 'leaderboards'>): Partial<Record<NicheId, number>> {
  const cfg = v.world.config;
  const [prizeC] = splitCents(toCents(v.world.bank), [cfg.prizeShare, cfg.officialsShare, cfg.platformShare]);
  const entries = (Object.entries(v.leaderboards) as [NicheId, Standing[]][]).filter(([, s]) => s.some((x) => !x.isAi));
  const weights = entries.map(([, s]) => s.filter((x) => !x.isAi).length);
  const pools = splitCents(prizeC, weights);
  const canWin = entries.map(([, s]) => s.some((x) => !x.isAi && !x.bankrupt));
  const orphan = pools.reduce((sum, c, i) => sum + (canWin[i] ? 0 : c), 0);
  const winners = entries.map((_, i) => i).filter((i) => canWin[i]);
  const extra = orphan > 0 && winners.length ? splitCents(orphan, winners.map((i) => weights[i])) : [];
  const out: Partial<Record<NicheId, number>> = {};
  entries.forEach(([n], i) => {
    const plus = winners.indexOf(i) >= 0 && extra.length ? extra[winners.indexOf(i)] : 0;
    out[n] = canWin[i] ? (pools[i] + plus) / 100 : 0;
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

export function nicheBoard(v: OwnerView & { extra?: { payouts?: Payout[] } }, niche: NicheId): NicheBoard {
  const standings = [...(v.leaderboards[niche] ?? [])].sort((a, b) => a.rank - b.rank);
  const pool = nichePools(v)[niche] ?? 0;
  const eligible = standings.filter((s) => !s.isAi && !s.bankrupt);
  const prizes = placePrizes(pool, v.world.config.nichePrizeTable, eligible.length);
  const byId = new Map<string, PublicBusiness>(v.neighbors.map((n) => [n.id, n]));
  const myId = v.business?.id;
  const final = v.world.phase === 'ended' ? v.extra?.payouts?.filter((p) => p.kind === 'owner' && p.niche === niche) : undefined;
  const rows = standings.map((s) => {
    const place = eligible.findIndex((e) => e.businessId === s.businessId);
    const projected = place >= 0 && place < prizes.length ? prizes[place] : null;
    // Payout.rank is the place among prize winners (1–3), not the row in the table; co-owners split one prize
    const finalPrize = final && place >= 0 && place < 3 ? r2(final.filter((p) => p.rank === place + 1).reduce((sum, p) => sum + p.amount, 0)) || undefined : undefined;
    const pub = byId.get(s.businessId);
    const mine = s.businessId === myId;
    return {
      businessId: s.businessId, rank: s.rank,
      name: mine ? v.business!.name : pub?.name ?? `Business ${s.rank}`,
      owner: mine ? v.me.name : pub?.ownerName ?? '',
      isAi: s.isAi, bankrupt: s.bankrupt, mine, netWorth: s.netWorth,
      prize: final ? (finalPrize ?? null) : projected,
      podium: (place >= 0 && place < 3 ? ((place + 1) as 1 | 2 | 3) : null),
    };
  });
  return { niche, pool, rows, mine: rows.find((r) => r.mine) ?? null };
}

export function allBoards(v: OwnerView): NicheBoard[] {
  return (Object.keys(v.leaderboards) as NicheId[]).filter((n) => (v.leaderboards[n]?.length ?? 0) > 0).map((n) => nicheBoard(v, n));
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

/** My result at the end: place among all businesses of the niche and the payout (final if known). */
export function myResult(v: OwnerView & { extra?: { payouts?: Payout[] } }): { niche: NicheId; rank: number; of: number; payout: number; final: boolean } | null {
  const b = v.business;
  if (!b) return null;
  const board = nicheBoard(v, b.niche);
  const me = board.mine;
  if (!me) return null;
  const share = b.owners.find((o) => o.playerId === v.me.id)?.share ?? 1;
  const finalPayout = v.extra?.payouts?.filter((p) => p.playerId === v.me.id && p.kind === 'owner').reduce((s, p) => s + p.amount, 0);
  const final = v.world.phase === 'ended' && finalPayout !== undefined && v.extra?.payouts !== undefined;
  return { niche: b.niche, rank: me.rank, of: board.rows.length, payout: final ? finalPayout! : r2((me.prize ?? 0) * share), final };
}
