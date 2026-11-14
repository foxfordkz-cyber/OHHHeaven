// "You were promised X — here is what happened." The forecast shown at Apply is kept on this device;
// on the next game days Today compares it with the real day reports. Pure helpers plus localStorage.
import { dateOf, RULES } from '@ohh/shared/rules';
import type { DayReport } from '@ohh/shared/types';

export interface ForecastPromise {
  businessId: string;
  /** Game day the player pressed Apply; the new settings start the next day. */
  appliedDay: number;
  changes: string[];
  /** Forecast before the change (nothing changes) and with it, per day and per month. */
  before: { ordersPerDay: number; profit: number } | null;
  after: { ordersPerDay: number; profit: number } | null;
  /** Game day of the month report that shows the full effect. */
  reportDay: number;
}

export type PromiseCheck =
  | { status: 'waiting'; startDay: number }
  | { status: 'seen'; days: number; actualPerDay: number; promisedPerDay: number | null; gap: number | null; verdict: 'on_track' | 'above' | 'below' | 'no_forecast' };

/** A day counts as "close to the forecast" within this share: weather and events move single days. */
export const ON_TRACK_SHARE = 0.12;

/** Compare the days run on the new settings with the forecast. Days before the change are ignored. */
export function checkPromise(p: ForecastPromise, days: DayReport[], worldDay: number): PromiseCheck {
  const startDay = p.appliedDay + 1;
  const after = days.filter((d) => d.day >= startDay && d.day <= worldDay);
  if (!after.length) return { status: 'waiting', startDay };
  const actualPerDay = Math.round(after.reduce((a, d) => a + d.servedUnits, 0) / after.length);
  const promisedPerDay = p.after?.ordersPerDay ?? null;
  if (promisedPerDay === null) return { status: 'seen', days: after.length, actualPerDay, promisedPerDay, gap: null, verdict: 'no_forecast' };
  const gap = actualPerDay - promisedPerDay;
  const share = promisedPerDay > 0 ? Math.abs(gap) / promisedPerDay : Math.abs(gap) > 0 ? 1 : 0;
  const verdict = share <= ON_TRACK_SHARE ? 'on_track' : gap > 0 ? 'above' : 'below';
  return { status: 'seen', days: after.length, actualPerDay, promisedPerDay, gap, verdict };
}

/** The month report that holds the first day on new settings applied on `appliedDay`. */
export function reportDayFor(appliedDay: number): number {
  return dateOf(appliedDay + 1).month * RULES.DAYS_PER_MONTH;
}

/** A promise is shown until the month report that settles it has been out for a week. */
export function promiseExpired(p: ForecastPromise, worldDay: number): boolean {
  return worldDay > p.reportDay + 7;
}

const key = (businessId: string) => `ohh.biz.promise.${businessId}`;

export function savePromise(p: ForecastPromise): void {
  try { localStorage.setItem(key(p.businessId), JSON.stringify(p)); } catch { /* storage blocked: Today simply shows no comparison */ }
}

export function loadPromise(businessId: string): ForecastPromise | null {
  try {
    const raw = localStorage.getItem(key(businessId));
    if (!raw) return null;
    const p = JSON.parse(raw) as ForecastPromise;
    return p && p.businessId === businessId && Array.isArray(p.changes) ? p : null;
  } catch {
    return null;
  }
}

export function clearPromise(businessId: string): void {
  try { localStorage.removeItem(key(businessId)); } catch { /* ignore */ }
}
