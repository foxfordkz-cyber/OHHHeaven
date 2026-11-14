// Pure helpers for the city screen: shaping a CityView for display. No game math here.
import type { CityView, FeedItem, FeedKind, NicheId, WorldPublic } from '@ohh/shared/types';
import { RULES } from '@ohh/shared/rules';

export const NICHE_ORDER: NicheId[] = ['cafe', 'barbershop', 'bodega', 'guesthouse', 'rentals'];
export const NICHE_LABEL: Record<NicheId, string> = { cafe: 'Cafés', barbershop: 'Barbershops', bodega: 'Bodegas', guesthouse: 'Guesthouses', rentals: 'Rentals' };

export interface LeaderRow { rank: number; businessId: string; name: string; owner: string; netWorth: number; isAi: boolean; bankrupt: boolean }
export interface NicheBoard { niche: NicheId; label: string; rows: LeaderRow[] }

/** Top `top` of every niche that has standings, in a fixed niche order. */
export function leaderBoards(view: CityView, top = 3): NicheBoard[] {
  const byId = new Map(view.businesses.map((b) => [b.id, b]));
  const out: NicheBoard[] = [];
  for (const niche of NICHE_ORDER) {
    const standings = view.leaderboards[niche];
    if (!standings?.length) continue;
    const rows = [...standings].sort((a, b) => a.rank - b.rank).slice(0, top).map((s) => {
      const b = byId.get(s.businessId);
      return { rank: s.rank, businessId: s.businessId, name: b?.name ?? s.businessId, owner: b?.ownerName ?? '', netWorth: s.netWorth, isAi: s.isAi, bankrupt: s.bankrupt };
    });
    out.push({ niche, label: NICHE_LABEL[niche], rows });
  }
  return out;
}

export interface Race { niche: NicheId; label: string; leader: string; chaser: string; gap: number; prize?: number }

/**
 * The tightest fights for first place, for the projector: in each niche, how much net worth separates #1 from #2,
 * and the prize forecast for #1 when the server sends it. Closest (smallest share of the leader's worth) first.
 */
export function closestRaces(view: CityView, n = 2): Race[] {
  const byId = new Map(view.businesses.map((b) => [b.id, b]));
  const out: (Race & { rel: number })[] = [];
  for (const niche of NICHE_ORDER) {
    const live = [...(view.leaderboards[niche] ?? [])].filter((s) => !s.bankrupt).sort((a, b) => a.rank - b.rank);
    if (live.length < 2) continue;
    const [a, b] = live;
    const gap = Math.max(0, a.netWorth - b.netWorth);
    out.push({
      niche, label: NICHE_LABEL[niche], leader: byId.get(a.businessId)?.name ?? a.name ?? a.businessId,
      chaser: byId.get(b.businessId)?.name ?? b.name ?? b.businessId, gap, prize: a.prize,
      rel: gap / Math.max(1, Math.abs(a.netWorth)),
    });
  }
  return out.sort((x, y) => x.rel - y.rel).slice(0, n).map(({ rel: _rel, ...r }) => r);
}

/** Game days until the next month's reports land (the books close on the last day of every month). */
export function daysToReports(day: number): number {
  const into = ((Math.max(1, day) - 1) % RULES.DAYS_PER_MONTH) + 1;
  return RULES.DAYS_PER_MONTH - into;
}

/** Newest first; items of the same day keep the server's order (later item = newer). */
export function feedRows(feed: FeedItem[], n = 8): FeedItem[] {
  return feed.map((f, i) => ({ f, i })).sort((a, b) => b.f.day - a.f.day || b.i - a.i).slice(0, n).map((x) => x.f);
}

export const FEED_ICON: Record<FeedKind, string> = {
  event: '📣', inspection: '🔎', report: '⚠', bankruptcy: '💥', deal: '🤝', opening: '🎉', bribe: '💸', system: '•',
};

export interface ClockState { demo: boolean; paused: boolean; speed: number }

/** Demo speed relative to the base demo tempo: dayMs 2000 → ×1, 400 → ×5. */
export function clockState(world: WorldPublic): ClockState {
  const { demo, paused, dayMs } = world.config;
  const speed = demo && dayMs > 0 ? Math.max(1, Math.round(RULES.DAY_MS_DEMO / dayMs)) : 1;
  return { demo, paused, speed };
}

/** Milliseconds left until the next game day, counting down locally since the view arrived. */
export function msLeft(world: WorldPublic, sinceViewMs: number): number {
  if (world.config.paused) return world.msToNextDay;
  return Math.max(0, world.msToNextDay - sinceViewMs);
}

export function dayProgress(world: WorldPublic, sinceViewMs: number): number {
  const total = world.config.dayMs;
  if (!(total > 0)) return 0;
  return Math.min(1, Math.max(0, 1 - msLeft(world, sinceViewMs) / total));
}

export function formatCountdown(ms: number): string {
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)} s`;
  const min = Math.round(ms / 60_000);
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`;
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

export const seasonDays = (world: WorldPublic): number => world.config.seasonMonths * RULES.DAYS_PER_MONTH;

export const money = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;
