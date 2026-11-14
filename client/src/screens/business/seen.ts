// "Real rule" cards are shown once per rule; the set of seen ids lives in localStorage.
const KEY = 'ohh.rules.seen';

export function seenRules(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function markRuleSeen(id: string): void {
  try {
    const s = seenRules();
    s.add(id);
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* storage blocked: the card may show again next time */
  }
}

/** First rule id from the list that has not been shown yet. */
export function firstUnseen(ids: string[], seen = seenRules()): string | null {
  for (const id of ids) if (!seen.has(id)) return id;
  return null;
}
