// The economy reads niche hooks only through this file (registry: engine/src/niches/index.ts, agent 01).
import type { NicheId } from '@ohh/shared';
import { nicheHooks, type NicheHooks } from '../niches/index';

export type { NicheHooks };

export function hooksFor(niche: NicheId): NicheHooks {
  return nicheHooks[niche] ?? {};
}
