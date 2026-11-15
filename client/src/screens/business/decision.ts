// The one decision Today puts in front of the owner. Pure: it only ranks what the view already holds.
import type { DayReport, OwnerView, Recommendation } from '@ohh/shared/types';
import { LOSS_MATTERS } from './forecast';
import type { PromiseCheck } from './promise';
import { pendingNotices } from './actions';
import { pickDays, topRecommendations } from './today';

export type Decision =
  | { kind: 'advice'; rec: Recommendation }
  | { kind: 'offer'; count: number }
  | { kind: 'promise'; check: Extract<PromiseCheck, { status: 'seen' }> }
  | { kind: 'lost'; reason: 'staff' | 'seats'; units: number; day: number }
  | { kind: 'try' };

/**
 * null when another card already is the decision: a fine notice waits for an answer, or the shop is not open yet.
 * Order: critical advice, an offer from a neighbor, a change that fell short of its forecast, customers lost today,
 * any other advice, and when nothing waits — try a change and see its forecast.
 */
export function nextDecision(v: OwnerView, check: PromiseCheck | null): Decision | null {
  const b = v.business;
  if (!b || b.status === 'setup' || b.status === 'bankrupt') return null;
  if (pendingNotices(v.notices).length > 0) return null;
  const recs = topRecommendations(v.recommendations).filter((r) => r.suggested);
  const critical = recs.find((r) => r.severity === 'critical');
  if (critical) return { kind: 'advice', rec: critical };
  const offers = v.deals.filter((d) => d.status === 'proposed' && d.toBusinessId === b.id).length;
  if (offers > 0) return { kind: 'offer', count: offers };
  if (check?.status === 'seen' && check.verdict === 'below') return { kind: 'promise', check };
  const lost = lostToday(b.days, v.world.day);
  if (lost) return { kind: 'lost', ...lost };
  if (recs.length) return { kind: 'advice', rec: recs[0] };
  return { kind: 'try' };
}

/** The latest day's biggest loss of customers that the owner can fix in Manage (staff or seats). */
export function lostToday(days: DayReport[], worldDay: number): { reason: 'staff' | 'seats'; units: number; day: number } | null {
  const { today, yesterday } = pickDays(days, worldDay);
  const d = today ?? yesterday;
  if (!d || d.demandUnits <= 0) return null;
  const reason = d.lost.staff >= d.lost.size ? 'staff' : 'seats';
  const units = reason === 'staff' ? d.lost.staff : d.lost.size;
  return units / d.demandUnits >= LOSS_MATTERS ? { reason, units, day: d.day } : null;
}
