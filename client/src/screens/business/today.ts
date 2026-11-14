// Today tab helpers: pick days, name the reasons for lost customers, order recommendations and events.
import type { DayReport, GameEvent, NicheId, PackSizing, Recommendation } from '@ohh/shared/types';

export function pickDays(days: DayReport[], worldDay: number): { today: DayReport | null; yesterday: DayReport | null } {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const today = byDay.get(worldDay) ?? null;
  const yesterday = byDay.get(worldDay - 1) ?? null;
  if (today || yesterday) return { today, yesterday };
  const last = days.length ? days[days.length - 1] : null;
  return { today: last, yesterday: days.length > 1 ? days[days.length - 2] : null };
}

export const lostTotal = (lost: DayReport['lost']): number => lost.size + lost.staff + lost.closure;

export interface LostReason { key: keyof DayReport['lost']; units: number; text: string }

/** "41 walked away: not enough seats" — biggest reason first, zeros dropped. */
export function lostReasons(lost: DayReport['lost'], sizing: Pick<PackSizing, 'unitName'> | null): LostReason[] {
  const unit = sizing?.unitName ?? 'seat';
  const reasons: LostReason[] = [
    { key: 'size', units: lost.size, text: `not enough ${unit}s` },
    { key: 'staff', units: lost.staff, text: 'not enough staff' },
    { key: 'closure', units: lost.closure, text: 'closed by an inspector' },
  ];
  return reasons.filter((x) => x.units > 0).sort((a, b) => b.units - a.units);
}

const SEVERITY_RANK: Record<Recommendation['severity'], number> = { critical: 0, warn: 1, info: 2 };

/** At most `n` cards: critical first, then by size of the effect. Order from the engine is kept for ties. */
export function topRecommendations(recs: Recommendation[], n = 3): Recommendation[] {
  return recs
    .map((r, i) => ({ r, i }))
    .sort((a, b) => SEVERITY_RANK[a.r.severity] - SEVERITY_RANK[b.r.severity]
      || Math.abs(b.r.impact?.profitDeltaMonth ?? 0) - Math.abs(a.r.impact?.profitDeltaMonth ?? 0)
      || a.i - b.i)
    .slice(0, n)
    .map((x) => x.r);
}

/** Events that are announced or running and that touch this niche. */
export function upcomingEvents(events: GameEvent[], niche: NicheId, today: number): GameEvent[] {
  return events
    .filter((e) => e.endDay >= today)
    .filter((e) => e.effects.some((f) => !f.niches || f.niches.includes(niche)))
    .sort((a, b) => a.startDay - b.startDay);
}

/** Bar chart data: last 30 days, served and lost. */
export function chartSeries(days: DayReport[]): { day: number; served: number; lost: number }[] {
  return days.slice(-30).map((d) => ({ day: d.day, served: d.servedUnits, lost: lostTotal(d.lost) }));
}
