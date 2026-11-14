// Characters of AI residents. Base: research/reports/52-bots-spec.md and 28-bots-ghosts.md —
// one brain, characters are presets of the same knobs.
import { hashStr } from './rng';

export type OwnerStrategy =
  | 'honest' | 'cut_all' | 'cut_taxes' | 'cut_bribe' | 'complainer' | 'dumper' | 'premium' | 'social' | 'unreliable'
  // simulator-only stand-ins for human play styles and isolated experiments
  | 'newbie' | 'manager' | 'cash_wages' | 'loner';
export type OfficialStrategy = 'complaint_chaser' | 'hint_hunter' | 'bribe_taker';

/** Characters populate() hands out to AI businesses. */
export const OWNER_STRATEGIES: OwnerStrategy[] = ['honest', 'cut_all', 'cut_taxes', 'cut_bribe', 'complainer', 'dumper', 'premium', 'social', 'unreliable'];
export const OFFICIAL_STRATEGIES: OfficialStrategy[] = ['complaint_chaser', 'hint_hunter', 'bribe_taker'];
export const ALL_OWNER_STRATEGIES: OwnerStrategy[] = [...OWNER_STRATEGIES, 'newbie', 'manager'];

export interface OwnerProfile {
  kit: 'lean' | 'standard' | 'premium' | 'random';
  tier: 'prime' | 'mid' | 'cheap' | 'any';
  price: 'adaptive' | 'dump' | 'premium' | 'fixed_random';
  shortcuts: 'none' | 'wages' | 'taxes' | 'all';
  notice: 'pay' | 'contest_if_big' | 'bribe';
  complains: boolean;
  proposesDeals: boolean;
  breaksDeals: boolean;
  blockFund: boolean;
  launchEarly: boolean;
  /** Days between reviews of standing orders; 0 = never (holds the opening orders). */
  reviewEvery: number;
  /** Logs in only every N days (manager-run shop). 1 = every day. */
  loginEvery: number;
  quality: 'basic' | 'high';
}

export const PROFILES: Record<OwnerStrategy, OwnerProfile> = {
  honest:     { kit: 'standard', tier: 'any',   price: 'adaptive', shortcuts: 'none',  notice: 'pay',            complains: false, proposesDeals: false, breaksDeals: false, blockFund: false, launchEarly: false, reviewEvery: 7, loginEvery: 1, quality: 'basic' },
  cut_all:    { kit: 'lean',     tier: 'any',   price: 'adaptive', shortcuts: 'all',   notice: 'contest_if_big', complains: false, proposesDeals: false, breaksDeals: false, blockFund: false, launchEarly: true,  reviewEvery: 7, loginEvery: 1, quality: 'basic' },
  cut_taxes:  { kit: 'standard', tier: 'any',   price: 'adaptive', shortcuts: 'taxes', notice: 'contest_if_big', complains: false, proposesDeals: false, breaksDeals: false, blockFund: false, launchEarly: false, reviewEvery: 7, loginEvery: 1, quality: 'basic' },
  cut_bribe:  { kit: 'lean',     tier: 'any',   price: 'adaptive', shortcuts: 'all',   notice: 'bribe',          complains: false, proposesDeals: false, breaksDeals: false, blockFund: false, launchEarly: true,  reviewEvery: 7, loginEvery: 1, quality: 'basic' },
  complainer: { kit: 'standard', tier: 'any',   price: 'adaptive', shortcuts: 'none',  notice: 'pay',            complains: true,  proposesDeals: false, breaksDeals: false, blockFund: false, launchEarly: false, reviewEvery: 7, loginEvery: 1, quality: 'basic' },
  dumper:     { kit: 'standard', tier: 'cheap', price: 'dump',     shortcuts: 'none',  notice: 'pay',            complains: false, proposesDeals: false, breaksDeals: false, blockFund: false, launchEarly: false, reviewEvery: 7, loginEvery: 1, quality: 'basic' },
  premium:    { kit: 'premium',  tier: 'prime', price: 'premium',  shortcuts: 'none',  notice: 'pay',            complains: false, proposesDeals: false, breaksDeals: false, blockFund: false, launchEarly: false, reviewEvery: 7, loginEvery: 1, quality: 'high' },
  social:     { kit: 'standard', tier: 'any',   price: 'adaptive', shortcuts: 'none',  notice: 'pay',            complains: false, proposesDeals: true,  breaksDeals: false, blockFund: true,  launchEarly: false, reviewEvery: 7, loginEvery: 1, quality: 'basic' },
  unreliable: { kit: 'standard', tier: 'any',   price: 'adaptive', shortcuts: 'none',  notice: 'pay',            complains: false, proposesDeals: true,  breaksDeals: true,  blockFund: false, launchEarly: false, reviewEvery: 7, loginEvery: 1, quality: 'basic' },
  newbie:     { kit: 'random',   tier: 'any',   price: 'fixed_random', shortcuts: 'none', notice: 'pay',         complains: false, proposesDeals: false, breaksDeals: false, blockFund: false, launchEarly: true,  reviewEvery: 0, loginEvery: 1, quality: 'basic' },
  manager:    { kit: 'standard', tier: 'any',   price: 'adaptive', shortcuts: 'none',  notice: 'pay',            complains: false, proposesDeals: false, breaksDeals: false, blockFund: false, launchEarly: false, reviewEvery: 0, loginEvery: 30, quality: 'basic' },
  loner:      { kit: 'standard', tier: 'any',   price: 'adaptive', shortcuts: 'none',  notice: 'pay',            complains: false, proposesDeals: false, breaksDeals: false, blockFund: false, launchEarly: false, reviewEvery: 7, loginEvery: 1, quality: 'basic' },
  cash_wages: { kit: 'standard', tier: 'any',   price: 'adaptive', shortcuts: 'wages', notice: 'pay',            complains: false, proposesDeals: false, breaksDeals: false, blockFund: false, launchEarly: false, reviewEvery: 7, loginEvery: 1, quality: 'basic' },
};

export interface OfficialProfile { priority: ('report' | 'flag' | 'routine')[]; bribeThreshold: number | null }
export const OFFICIAL_PROFILES: Record<OfficialStrategy, OfficialProfile> = {
  complaint_chaser: { priority: ['report', 'flag', 'routine'], bribeThreshold: null },
  hint_hunter:      { priority: ['flag', 'report', 'routine'], bribeThreshold: null },
  bribe_taker:      { priority: ['report', 'flag', 'routine'], bribeThreshold: 1000 },
};

/** Character of an AI resident, derived from its name so it survives a server restart without extra fields. */
export const ownerStrategyFromName = (name: string): OwnerStrategy => OWNER_STRATEGIES[hashStr(`owner:${name}`) % OWNER_STRATEGIES.length];
export const officialStrategyFromName = (name: string): OfficialStrategy => OFFICIAL_STRATEGIES[hashStr(`official:${name}`) % OFFICIAL_STRATEGIES.length];
