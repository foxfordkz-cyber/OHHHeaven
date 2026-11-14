// Rule cards ("Real rule") live in the niche packs. Views do not carry packs, so the end screens fetch them once from
// GET /api/packs (CONTRACT §6) and fall back to the cards they were given (examples on /dev screens).
import { useEffect, useState } from 'react';
import type { PackRuleCard, PackSet } from '@shared/types';

let cache: Promise<PackRuleCard[]> | null = null;

export function cardsFromPacks(packs: PackSet): PackRuleCard[] {
  return [...(packs.common?.ruleCards ?? []), ...Object.values(packs.niches ?? {}).flatMap((p) => p?.ruleCards ?? [])];
}

function fetchCards(): Promise<PackRuleCard[]> {
  if (!cache) {
    cache = fetch('/api/packs')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => (p && typeof p === 'object' ? cardsFromPacks(((p as { data?: PackSet }).data ?? p) as PackSet) : []))
      .catch(() => []);
  }
  return cache;
}

export function useRuleCards(given?: PackRuleCard[]): Map<string, PackRuleCard> {
  const [cards, setCards] = useState<PackRuleCard[]>(given ?? []);
  useEffect(() => {
    if (given) return;
    let live = true;
    void fetchCards().then((c) => live && setCards(c));
    return () => { live = false; };
  }, [given]);
  return new Map(cards.map((c) => [c.id, c]));
}
