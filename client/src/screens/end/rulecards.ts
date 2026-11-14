// Rule cards ("Real rule") and the names of taxes and violations live in the niche packs. Views do not carry packs,
// so the screens take them from the app's catalog (agent 08, app/catalog.ts: the server's GET /api/packs, the
// in-browser city or the examples). Cards passed in win: the /dev screens show sample cards.
import { useMemo } from 'react';
import type { PackRuleCard, PackSet } from '@ohh/shared/types';
import { useCatalog } from '../../app/catalog';

export interface PackInfo {
  cards: Map<string, PackRuleCard>;
  taxName: (taxId: string) => string | undefined;
  violationName: (violationId: string) => string | undefined;
}

export function cardsFromPacks(packs: PackSet): PackRuleCard[] {
  return [...(packs.common?.ruleCards ?? []), ...Object.values(packs.niches ?? {}).flatMap((p) => p?.ruleCards ?? [])];
}

/** Rule cards and names from a pack set (the common pack first, then every niche). */
export function packInfo(packs: PackSet | null | undefined, given?: PackRuleCard[]): PackInfo {
  const niches = Object.values(packs?.niches ?? {}).filter((p) => !!p);
  const taxes = new Map([...(packs?.common?.taxes ?? []), ...niches.flatMap((p) => p!.taxes ?? [])].map((t) => [t.id, t.name]));
  const violations = new Map([...(packs?.common?.violations ?? []), ...niches.flatMap((p) => p!.violations ?? [])].map((v) => [v.id, v.name]));
  const cards = given ?? (packs ? cardsFromPacks(packs) : []);
  return {
    cards: new Map(cards.map((c) => [c.id, c])),
    taxName: (id) => taxes.get(id),
    violationName: (id) => violations.get(id),
  };
}

export function usePackInfo(given?: PackRuleCard[]): PackInfo {
  const catalog = useCatalog();
  return useMemo(() => packInfo(catalog?.packs, given), [catalog, given]);
}

export function useRuleCards(given?: PackRuleCard[]): Map<string, PackRuleCard> {
  return usePackInfo(given).cards;
}
