// Leaderboards and prizes. CONTRACT §4: the prize fund is bank × prizeShare; it is split between niches by the
// number of paying owners, inside a niche by nichePrizeTable among human businesses that are not bankrupt.
// AI businesses get no prize. OwnerView carries no prize amounts yet, so the table shows the projected prize by
// these rules; when the season ends, final payouts from the server (if present) win.
import type { NicheId, OwnerView, Payout, PublicBusiness, Standing } from '../../../../shared/src/types';

export interface BoardRow {
  businessId: string; rank: number; name: string; owner: string; isAi: boolean; bankrupt: boolean; mine: boolean;
  netWorth: number; prize: number | null; podium: 1 | 2 | 3 | null;
}

export interface NicheBoard { niche: NicheId; pool: number; rows: BoardRow[]; mine: BoardRow | null }

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Prize fund of each niche: the bank's prize share, weighted by human (paying) owners in that niche. */
export function nichePools(v: Pick<OwnerView, 'world' | 'leaderboards'>): Partial<Record<NicheId, number>> {
  const fund = v.world.bank * v.world.config.prizeShare;
  const entries = Object.entries(v.leaderboards) as [NicheId, Standing[]][];
  const humans = entries.map(([n, s]) => [n, s.filter((x) => !x.isAi).length] as const);
  const total = humans.reduce((s, [, k]) => s + k, 0);
  const out: Partial<Record<NicheId, number>> = {};
  for (const [n, k] of humans) out[n] = total > 0 ? r2((fund * k) / total) : 0;
  return out;
}

/**
 * Prize for each place inside a niche. If fewer human businesses are eligible than there are prize places,
 * their shares are scaled up so the niche fund is still paid out in full.
 */
export function placePrizes(pool: number, table: number[], eligible: number): number[] {
  const places = table.slice(0, Math.max(0, eligible));
  const sum = places.reduce((s, x) => s + x, 0);
  if (sum <= 0) return [];
  const raw = places.map((x) => (pool * x) / sum);
  const rounded = raw.map(r2);
  const drift = r2(pool - rounded.reduce((s, x) => s + x, 0));     // keep the cents exact on the first place
  if (rounded.length) rounded[0] = r2(rounded[0] + drift);
  return rounded;
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
    const finalPrize = final?.find((p) => p.rank === s.rank)?.amount;
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
  const pool = r2(world.bank * world.config.officialsShare);
  const sorted = [...ranking].sort((a, b) => b.points - a.points);
  const paid = sorted.filter((r) => !r.isAi && r.points > 0);
  const totalPoints = paid.reduce((s, r) => s + r.points, 0);
  const rows: OfficialRow[] = sorted.map((r, i) => ({
    ...r, rank: i + 1,
    prize: !r.isAi && r.points > 0 && totalPoints > 0 ? r2((pool * r.points) / totalPoints) : null,
  }));
  const first = rows.find((r) => r.prize !== null);
  if (first) first.prize = r2(first.prize! + pool - rows.reduce((s, r) => s + (r.prize ?? 0), 0));   // keep the cents exact
  return { pool, rows };
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
