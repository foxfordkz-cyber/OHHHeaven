// One place where the economy reads niche hooks. When agent 01's engine/src/niches/index.ts lands,
// switch this import to it; everything else stays.
import type { NicheId } from '../../../shared/src/types';
import { nicheHooks, type NicheHooks } from '../__stubs__/niches';

export type { NicheHooks };

export function hooksFor(niche: NicheId): NicheHooks {
  return nicheHooks[niche] ?? {};
}
