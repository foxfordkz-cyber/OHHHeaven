// Practice offline: the game runs in the browser on @ohh/host (agent 06).
// Until @ohh/host is in the main branch, the stub in ./__stubs__/host.ts plays the city.
// To switch to the real host, replace the stub import below with: import * as host from '@ohh/host';
import type { Pack, PackSet, Place } from '@ohh/shared/types';
import * as host from './__stubs__/host';
import type { EngineCtx, HostDeps, HostModule } from './host-types';
import { fixtureCommon, fixturePacks, fixturePlaces } from './fixtures';

export interface LocalRuntime { host: HostModule; ctx: EngineCtx; deps: HostDeps }

// Real data files are picked up when they exist (JSON has no imports, so a missing file cannot break the build).
const placeFiles = import.meta.glob<Place[]>('../../../data/places.json', { eager: true, import: 'default' });
const packFiles = import.meta.glob<Pack | PackSet['common']>('../../../packs/*.json', { eager: true, import: 'default' });

export function realCtx(): EngineCtx {
  const places = Object.values(placeFiles)[0];
  const packs: PackSet = { common: fixtureCommon, niches: { ...fixturePacks.niches } };
  for (const p of Object.values(packFiles)) {
    if (!p || typeof p !== 'object' || !('id' in p)) continue;
    if (p.id === '_common') packs.common = p as PackSet['common'];
    else if ('kits' in p && 'setup' in p) packs.niches[(p as Pack).id] = p as Pack;
  }
  return { packs, places: Array.isArray(places) && places.length ? places : fixturePlaces };
}

export const localRuntime: LocalRuntime = { host, ctx: realCtx(), deps: host.stubDeps };
