import { useEffect, useState } from 'react';
import type { NicheId, PackSet, Place } from '@ohh/shared/types';
import { fixturePacks, fixturePlaces } from './fixtures';
import { localRuntime } from './local-host';
import { useStoreState } from './store';
import type { Mode } from './session';

/** Niche packs and map places: what the opening path and niche cards need besides the view. */
export interface Catalog { packs: PackSet; places: Place[]; source: 'server' | 'local' | 'fixture' }

export const fixtureCatalog: Catalog = { packs: fixturePacks, places: fixturePlaces, source: 'fixture' };

const cache: Partial<Record<Mode, Promise<Catalog>>> = {};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  const body = (await res.json()) as T | { ok: boolean; data: T };
  return body && typeof body === 'object' && 'ok' in body && 'data' in body ? (body as { data: T }).data : (body as T);
}

export function loadCatalog(mode: Mode): Promise<Catalog> {
  cache[mode] ??= (async (): Promise<Catalog> => {
    if (mode === 'local') return { packs: localRuntime.ctx.packs, places: localRuntime.ctx.places, source: 'local' };
    try {
      const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
      const [packs, places] = await Promise.all([getJson<PackSet>(`${base}/api/packs`), getJson<Place[]>(`${base}/api/places`)]);
      if (!packs?.niches || !Array.isArray(places) || !places.length) throw new Error('empty catalog');
      return { packs, places, source: 'server' };
    } catch {
      return { ...fixtureCatalog };
    }
  })();
  return cache[mode]!;
}

/** Catalog for the current store: example data on /dev screens, otherwise server or the in-browser city. */
export function useCatalog(): Catalog | null {
  const { mode, fixture } = useStoreState();
  const [catalog, setCatalog] = useState<Catalog | null>(fixture ? fixtureCatalog : null);
  useEffect(() => {
    if (fixture) {
      setCatalog(fixtureCatalog);
      return;
    }
    let alive = true;
    void loadCatalog(mode).then((c) => alive && setCatalog(c));
    return () => {
      alive = false;
    };
  }, [mode, fixture]);
  return catalog;
}

/** Display names for all five niches, also those without a pack yet. */
export const NICHE_META: Record<NicheId, { name: string; plural: string; soon: string }> = {
  cafe: { name: 'Coffee shop', plural: 'coffee shops', soon: 'Espresso, pastries and the 8 am rush.' },
  barbershop: { name: 'Barbershop', plural: 'barbershops', soon: 'Chairs, regulars and a license on the wall.' },
  bodega: { name: 'Corner store', plural: 'corner stores', soon: 'Long hours, thin margins, every block needs one.' },
  guesthouse: { name: 'Guesthouse', plural: 'guesthouses', soon: 'Rooms for visitors under strict city rules.' },
  rentals: { name: 'Apartment rentals', plural: 'rental landlords', soon: 'Leases, repairs and tenant law.' },
};

export const NICHE_ORDER: NicheId[] = ['cafe', 'barbershop', 'bodega', 'guesthouse', 'rentals'];
