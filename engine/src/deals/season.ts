// Конец сезона: места, призы по нишам, доля госслужащих, доля платформы. Всё в центах: сумма = банк.
import type { BusinessState, NicheId, Payout, Player, Standing, WorldState } from '../../../shared/src/types';
import type { EngineCtx } from './ctx';
import { computeStandings, NICHE_ORDER } from './standings';
import { addFeed, addInbox, bizById, clone, fmtMoney, fromCents, toCents } from './util';

export const PLATFORM_ID = 'platform';

/** Делит целое число центов по весам методом наибольшего остатка. Нулевые веса — 0. */
export function splitCents(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, x) => s + Math.max(0, x), 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const exact = weights.map((x) => (Math.max(0, x) / sum) * total);
  const base = exact.map((x) => Math.floor(x));
  let left = total - base.reduce((s, x) => s + x, 0);
  const order = exact.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let j = 0; left > 0; j = (j + 1) % order.length) {
    if (weights[order[j].i] > 0) {
      base[order[j].i] += 1;
      left -= 1;
    }
  }
  return base;
}

const isHumanPaid = (p: Player | undefined): boolean => !!p && !p.isAi && p.paid;

/** Бизнес может взять приз: им управляет оплативший человек, он не ИИ и не банкрот. */
export function prizeEligible(w: WorldState, b: BusinessState): boolean {
  if (b.isAi || b.status === 'bankrupt') return false;
  return isHumanPaid(w.players.find((p) => p.id === b.managerPlayerId));
}

export interface SeasonSplit { payouts: Payout[]; nichePools: Partial<Record<NicheId, number>> }

export function computePayouts(w: WorldState, standings: Standing[]): SeasonSplit {
  const cfg = w.config;
  const bank = Math.max(0, toCents(w.bank));
  const [prizeC, officialsC, platformBase] = splitCents(bank, [cfg.prizeShare, cfg.officialsShare, cfg.platformShare]);
  let platformC = platformBase;
  const payouts: Payout[] = [];

  // Банк ниши — по числу оплативших владельцев (людей), чьи бизнесы в этой нише.
  const paidByNiche = new Map<NicheId, number>();
  for (const p of w.players) {
    if (p.kind !== 'owner' || !isHumanPaid(p)) continue;
    const b = w.businesses.find((x) => x.managerPlayerId === p.id);
    if (b) paidByNiche.set(b.niche, (paidByNiche.get(b.niche) ?? 0) + 1);
  }
  const winnersByNiche = new Map<NicheId, Standing[]>();
  for (const niche of NICHE_ORDER) {
    const rows = standings.filter((s) => s.niche === niche && !s.bankrupt && !s.isAi)
      .filter((s) => { const b = bizById(w, s.businessId); return !!b && prizeEligible(w, b); })
      .sort((a, b) => a.rank - b.rank)
      .slice(0, cfg.nichePrizeTable.length);
    if (rows.length > 0) winnersByNiche.set(niche, rows);
  }
  const niches = NICHE_ORDER.filter((n) => (paidByNiche.get(n) ?? 0) > 0);
  const pools = splitCents(prizeC, niches.map((n) => paidByNiche.get(n) ?? 0));
  const nichePools: Partial<Record<NicheId, number>> = {};
  // Ниша без призёров отдаёт свой банк нишам с призёрами пропорционально их числу владельцев.
  let orphan = 0;
  niches.forEach((n, i) => { if (winnersByNiche.has(n)) nichePools[n] = pools[i]; else orphan += pools[i]; });
  const withWinners = niches.filter((n) => winnersByNiche.has(n));
  if (orphan > 0) {
    if (withWinners.length === 0) platformC += orphan;
    else splitCents(orphan, withWinners.map((n) => paidByNiche.get(n) ?? 0)).forEach((c, i) => { nichePools[withWinners[i]] = (nichePools[withWinners[i]] ?? 0) + c; });
  }

  for (const niche of withWinners) {
    const rows = winnersByNiche.get(niche)!;
    // Меньше призёров, чем мест в таблице: неразыгранное делится между ними пропорционально их долям.
    const prizes = splitCents(nichePools[niche] ?? 0, rows.map((_, i) => cfg.nichePrizeTable[i]));
    rows.forEach((s, place) => {
      const b = bizById(w, s.businessId)!;
      const owners = b.owners.filter((o) => isHumanPaid(w.players.find((p) => p.id === o.playerId)));
      const parts = splitCents(prizes[place], owners.map((o) => o.share));
      owners.forEach((o, i) => {
        if (parts[i] > 0) payouts.push({ playerId: o.playerId, kind: 'owner', amount: fromCents(parts[i]), niche, rank: place + 1 });
      });
      const given = parts.reduce((x, y) => x + y, 0);
      platformC += prizes[place] - given;                      // у бизнеса нет владельцев-людей — не бывает, но центы не теряем
    });
  }

  // Госслужащие-люди по очкам; разоблачённый получает 0. Некому платить — доля уходит платформе.
  const officials = w.officials.filter((o) => !o.isAi && !o.exposed && o.points > 0);
  const offParts = splitCents(officialsC, officials.map((o) => o.points));
  officials.forEach((o, i) => { if (offParts[i] > 0) payouts.push({ playerId: o.playerId, kind: 'official', amount: fromCents(offParts[i]) }); });
  platformC += officialsC - offParts.reduce((x, y) => x + y, 0);

  payouts.push({ playerId: PLATFORM_ID, kind: 'platform', amount: fromCents(platformC) });
  return { payouts, nichePools };
}

export function finalizeSeason(w: WorldState, ctx: EngineCtx): WorldState {
  if (w.phase === 'ended') return w;
  const next = clone(w);
  // Сделки, дожившие до конца сезона, считаются выполненными.
  for (const d of next.deals) {
    if (d.status === 'proposed') { d.status = 'expired'; continue; }
    if (d.status !== 'active' || d.terms.type === 'loan') continue;
    const from = bizById(next, d.fromBusinessId);
    const to = bizById(next, d.toBusinessId);
    d.status = 'completed';
    d.endDay = next.day;
    if (from && from.status !== 'bankrupt') from.trust.kept += 1;
    if (to && to.status !== 'bankrupt') to.trust.kept += 1;
  }
  next.standings = computeStandings(next, ctx);
  const { payouts } = computePayouts(next, next.standings);
  next.payouts = payouts;
  next.phase = 'ended';
  for (const p of payouts) {
    if (p.kind === 'platform') continue;
    const text = p.kind === 'owner'
      ? `Place ${p.rank} in ${p.niche}: you get ${fmtMoney(p.amount)}.`
      : `Your share of the officials' pool: ${fmtMoney(p.amount)}.`;
    addInbox(next, p.playerId, { id: `in-season-${p.kind}-${p.niche ?? 'gov'}-${p.rank ?? 0}-${p.playerId}`, kind: 'money', title: 'Season prize', text });
  }
  for (const niche of NICHE_ORDER) {
    const top = next.standings.find((s) => s.niche === niche && s.rank === 1);
    if (!top) continue;
    const b = bizById(next, top.businessId)!;
    addFeed(next, `feed-season-${niche}`, `Season over: ${b.name} finished first among ${niche} businesses with ${fmtMoney(top.netWorth)}.`, b.id);
  }
  next.version += 1;
  return next;
}
