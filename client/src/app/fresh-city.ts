// A guest never lands in a demo city that will not take them (B04, round 3; docs/qa/BUGS.md #18).
// The shared demo city runs a 12-minute season and stops taking new players after month 9; after the season it stands
// finished for a while. A guest who arrived then went through idea, place and plan and was refused on the last step.
// Now: on the first look at the city, if this browser has no player there, the city is a demo one and it is late in its
// season (or over), the app opens a fresh demo city (POST /api/worlds — the server already does it) and moves the guest
// there before they type anything. A city named in the address (?world=…, e.g. a pitch link) is never swapped.
import { RULES } from '@ohh/shared/rules';
import type { WorldPublic } from '@ohh/shared/types';

/** After this month a guest gets a fresh city: they need a few minutes of play time to open and see a month's books. */
export const FRESH_AFTER_MONTH = Math.min(6, RULES.JOIN_UNTIL_MONTH);

export interface FreshCityInput {
  world: WorldPublic;
  /** This browser already plays in this city. */
  joined: boolean;
  /** The address names the city (?world=…). */
  explicit: boolean;
}

/** True when a guest should get a fresh demo city instead of this one. */
export function wantsFreshCity({ world, joined, explicit }: FreshCityInput): boolean {
  if (joined || explicit || !world.config.demo) return false;
  if (world.config.id === 'pitch' || world.config.id.startsWith('pitch')) return false;
  return world.phase !== 'running' || world.date.month > FRESH_AFTER_MONTH;
}

/** Opens a fresh demo city on the server. Null if the server refused (too many cities) or could not be reached. */
export async function openFreshCity(base = '', doFetch: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await doFetch(`${base}/api/worlds`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (res.status !== 201) return null;
    const body = (await res.json()) as { ok?: boolean; data?: { id?: unknown } };
    return body.ok && typeof body.data?.id === 'string' ? body.data.id : null;
  } catch {
    return null;
  }
}

/** The address names a city. */
export function addressNamesCity(search: string = typeof location === 'undefined' ? '' : location.search): boolean {
  return new URLSearchParams(search).has('world');
}
