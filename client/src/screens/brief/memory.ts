// What the player saw the last time they read the brief. Kept in this browser only (a per-viewer
// convenience): the server already remembers cash and day of the last visit (`seenCash`, `seenDay`),
// but it sends the "while you were away" summary once, in the first view after the gap. The brief
// keeps that summary here so the player can read it after the next poll replaces the view.
import type { InboxItem, Money } from '@ohh/shared/types';

/** One look at the business, saved when the player finishes reading the brief. */
export interface LastLook {
  day: number;
  cash: Money;
  rank: number | null;
  months: number;            // business.history.length at that moment
}

/** The server's "while you were away" summary, frozen at the moment it arrived. */
export interface AwaySnapshot {
  fromDay: number;
  toDay: number;
  cashThen: Money;
  cashNow: Money;
  items: InboxItem[];
}

export interface BriefMemory {
  look?: LastLook;
  away?: AwaySnapshot;
}

const PREFIX = 'ohh.brief.v1:';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readMemory(key: string): BriefMemory {
  try {
    const raw = storage()?.getItem(PREFIX + key);
    const parsed = raw ? (JSON.parse(raw) as BriefMemory) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeMemory(key: string, m: BriefMemory): void {
  try {
    storage()?.setItem(PREFIX + key, JSON.stringify(m));
  } catch {
    /* storage blocked: the brief falls back to "since the month began" next time */
  }
}
