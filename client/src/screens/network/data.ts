// Places and packs are not part of OwnerView: the server gives them at GET /api/places and GET /api/packs (CONTRACT §6).
// The app shell of agent 08 has no hook for them yet (request in agents/12.md), so the screens load them here once
// and share the answer. Screens also accept them as props: dev pages and tests pass fixtures and never fetch.
import { useEffect, useState } from 'react';
import type { PackSet, Place } from '../../../../shared/src/types';

let placesOnce: Promise<Place[]> | null = null;
let packsOnce: Promise<PackSet | null> | null = null;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export function loadPlaces(): Promise<Place[]> {
  placesOnce ??= getJson('/api/places')
    .then((d) => (Array.isArray(d) ? d : Array.isArray((d as { places?: unknown }).places) ? (d as { places: Place[] }).places : []) as Place[])
    .catch(() => {
      placesOnce = null;
      return [];
    });
  return placesOnce;
}

export function loadPacks(): Promise<PackSet | null> {
  packsOnce ??= getJson('/api/packs')
    .then((d) => {
      const p = d as Partial<PackSet>;
      return p && p.common && Array.isArray(p.common.reports) ? ({ common: p.common, niches: p.niches ?? {} } as PackSet) : null;
    })
    .catch(() => {
      packsOnce = null;
      return null;
    });
  return packsOnce;
}

/** Places for distances and the map. `given` (fixtures) wins and skips the request. */
export function usePlaces(given?: Place[]): Place[] {
  const [places, setPlaces] = useState<Place[]>(given ?? []);
  useEffect(() => {
    if (given) return;
    let alive = true;
    void loadPlaces().then((p) => alive && setPlaces(p));
    return () => {
      alive = false;
    };
  }, [given]);
  return given ?? places;
}

/** Report kinds and officials come from the packs. `given` (fixtures) wins and skips the request. */
export function usePacks(given?: PackSet | null): PackSet | null {
  const [packs, setPacks] = useState<PackSet | null>(given ?? null);
  useEffect(() => {
    if (given !== undefined) return;
    let alive = true;
    void loadPacks().then((p) => alive && setPacks(p));
    return () => {
      alive = false;
    };
  }, [given]);
  return given !== undefined ? given : packs;
}
