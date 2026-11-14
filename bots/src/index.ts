// @ohh/bots — AI residents of the city (agent 07). Contract: build/CONTRACT.md §7.
export { createBotBrain, choosePlace, playableNiches, nicheFromName } from './brain';
export type { BotBrain, BrainOptions, PopulateEntry } from './brain';
export { ownerSight, officialSight, publicBusinesses } from './observe';
export type { OwnerSight, OfficialSight } from './observe';
export { PROFILES, OFFICIAL_PROFILES, OWNER_STRATEGIES, OFFICIAL_STRATEGIES, ALL_OWNER_STRATEGIES, ownerStrategyFromName, officialStrategyFromName } from './strategies';
export type { OwnerStrategy, OfficialStrategy, OwnerProfile, OfficialProfile } from './strategies';
export { mulberry32, hashStr, rngFor, seedFor, shuffle } from './rng';

import { createBotBrain } from './brain';
/** Default brain for the host (agent 06): `HostDeps.bots`. */
export const bots = createBotBrain();
/** Name used by agent 01's skeleton and the host: `import { botBrain } from '@ohh/bots'`. */
export const botBrain = bots;
