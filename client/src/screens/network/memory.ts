// What this browser remembers about the neighborhood between visits: prices and places as I last saw them.
// A per-viewer convenience, not game state: when storage is blocked, the «since you last looked» lines just stay empty.
import { useEffect, useRef } from 'react';
import type { OwnerView } from '../../../../shared/src/types';
import { lastLook, snapshotOf, type Snapshot } from './rivals';

const keyOf = (view: OwnerView) => `nw-rivals:${view.world.config.id}:${view.business?.id ?? 'none'}`;

function load(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save(key: string, s: Snapshot) {
  try { window.localStorage.setItem(key, JSON.stringify(s)); } catch { /* private window or storage off */ }
}

/**
 * What I saw on my last visit (an earlier game day), fixed for this visit so the lines do not change under my eyes.
 * While I look, the stored snapshot follows the view: next visit compares with what I saw last.
 */
export function useLastLook(view: OwnerView): Snapshot | null {
  const key = keyOf(view);
  const ref = useRef<{ key: string; prev: Snapshot | null } | null>(null);
  if (!ref.current || ref.current.key !== key) {
    ref.current = { key, prev: typeof window === 'undefined' ? null : lastLook(load(key), view.world.day) };
  }
  useEffect(() => { if (view.business) save(key, snapshotOf(view)); }, [key, view]);
  return ref.current.prev;
}
