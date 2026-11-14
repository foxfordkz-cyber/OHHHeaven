import type { NicheId, WorldState } from '../../shared/src/types';
import { stubApi } from '../../sim/engine';
import { mixedOwners, runSeason, DEFAULT_OFFICIALS, seasonConfig, type SeasonSetup } from '../../sim/run';
import { stubPacks } from '../src/__stubs__/packs';
import { stubPlaces } from '../src/__stubs__/places';
import { ALL_OWNER_STRATEGIES, type OwnerStrategy } from '../src/strategies';

export const ctx = { packs: stubPacks, places: stubPlaces };
export const NICHES: NicheId[] = ['cafe', 'barbershop'];
export { stubApi, runSeason, mixedOwners, DEFAULT_OFFICIALS, seasonConfig };

export function setup(seed: number, extra: Partial<SeasonSetup> = {}, strategies: OwnerStrategy[] = ALL_OWNER_STRATEGIES, owners = 40): SeasonSetup {
  return { seed, owners: mixedOwners(owners, strategies, NICHES), officials: DEFAULT_OFFICIALS, packs: stubPacks, places: stubPlaces, ...extra };
}

/** A small hand-made world: n AI owners already joined (businesses not yet opened). */
export function emptyWorld(seed = 1): WorldState {
  return stubApi.createWorld({ ...seasonConfig(seed), aiBusinessesTarget: 30 });
}
