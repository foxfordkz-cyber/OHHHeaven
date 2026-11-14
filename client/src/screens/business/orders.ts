// Manage tab form: a draft of StandingOrders and the set_orders action built from it.
// The screen does no game math; it only keeps the draft inside the pack's limits.
import type { Action, CommonPack, Pack, StandingOrders } from '../../../../shared/src/types';

export type Draft = StandingOrders;

export function draftFrom(orders: StandingOrders): Draft {
  return {
    price: orders.price,
    staff: { ...orders.staff },
    levers: { ...orders.levers },
    shortcuts: [...orders.shortcuts],
    blockFund: orders.blockFund,
    autopilot: orders.autopilot,
  };
}

const sameRecord = (a: Record<string, unknown>, b: Record<string, unknown>) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (a[k] !== b[k]) return false;
  return true;
};

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

/**
 * Only the fields that changed. Records and the shortcut list are sent whole, so the server
 * never has to guess whether a missing role means "zero" or "unchanged".
 */
export function diffOrders(base: StandingOrders, draft: Draft): Partial<StandingOrders> {
  const out: Partial<StandingOrders> = {};
  if (Math.round(base.price * 100) !== Math.round(draft.price * 100)) out.price = round2(draft.price);
  if (!sameRecord(base.staff, draft.staff)) out.staff = { ...draft.staff };
  if (!sameRecord(base.levers, draft.levers)) out.levers = { ...draft.levers };
  if (!sameSet(base.shortcuts, draft.shortcuts)) out.shortcuts = [...draft.shortcuts];
  if (base.blockFund !== draft.blockFund) out.blockFund = draft.blockFund;
  if (base.autopilot !== draft.autopilot) out.autopilot = draft.autopilot;
  return out;
}

export function hasChanges(base: StandingOrders, draft: Draft): boolean {
  return Object.keys(diffOrders(base, draft)).length > 0;
}

/** The action "Save settings" sends, or null when nothing changed. */
export function buildSetOrders(base: StandingOrders, draft: Draft): Extract<Action, { type: 'set_orders' }> | null {
  const orders = diffOrders(base, draft);
  return Object.keys(orders).length ? { type: 'set_orders', orders } : null;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function setPrice(d: Draft, price: number, pack: Pack | null): Draft {
  const min = pack?.unit.priceMin ?? 0;
  const max = pack?.unit.priceMax ?? Number.POSITIVE_INFINITY;
  return { ...d, price: round2(Math.min(max, Math.max(min, price))) };
}

export function totalStaff(staff: Record<string, number>): number {
  return Object.values(staff).reduce((a, b) => a + b, 0);
}

/** Set one role's headcount, keeping the total within the pack's minStaff..maxStaff. */
export function setStaff(d: Draft, roleId: string, n: number, pack: Pack | null): Draft {
  const want = Math.max(0, Math.floor(n));
  const others = totalStaff(d.staff) - (d.staff[roleId] ?? 0);
  const max = pack?.capacity.maxStaff ?? Number.POSITIVE_INFINITY;
  const min = pack?.capacity.minStaff ?? 0;
  const capped = Math.min(want, Math.max(0, max - others));
  const count = others + capped < min ? Math.max(capped, min - others) : capped;
  return { ...d, staff: { ...d.staff, [roleId]: count } };
}

export function setLever(d: Draft, leverId: string, optionId: string, pack: Pack | null): Draft {
  const lever = pack?.levers.find((l) => l.id === leverId);
  if (pack && (!lever || !lever.options.some((o) => o.id === optionId))) return d;
  return { ...d, levers: { ...d.levers, [leverId]: optionId } };
}

export function knownShortcutIds(pack: Pack | null, common: CommonPack | null): string[] {
  return [...(pack?.shortcuts ?? []), ...(common?.shortcuts ?? [])].map((s) => s.id);
}

export function toggleShortcut(d: Draft, id: string, on: boolean): Draft {
  const rest = d.shortcuts.filter((s) => s !== id);
  return { ...d, shortcuts: on ? [...rest, id] : rest };
}

export function setAutopilot(d: Draft, mode: StandingOrders['autopilot']): Draft {
  return { ...d, autopilot: mode };
}

export function setBlockFund(d: Draft, on: boolean): Draft {
  return { ...d, blockFund: on };
}

/** Apply a recommendation's partial orders on top of the draft (used to preview "Apply" in the form). */
export function mergeOrders(d: Draft, patch: Partial<StandingOrders>): Draft {
  return {
    price: patch.price ?? d.price,
    staff: patch.staff ? { ...patch.staff } : d.staff,
    levers: patch.levers ? { ...d.levers, ...patch.levers } : d.levers,
    shortcuts: patch.shortcuts ? [...patch.shortcuts] : d.shortcuts,
    blockFund: patch.blockFund ?? d.blockFund,
    autopilot: patch.autopilot ?? d.autopilot,
  };
}

// ── Draft survives a dropped connection or a reload ─────────────────────────────

const key = (businessId: string) => `ohh.biz.draft.${businessId}`;

export function saveDraft(businessId: string, base: StandingOrders, d: Draft): void {
  try {
    if (hasChanges(base, d)) localStorage.setItem(key(businessId), JSON.stringify({ base, draft: d }));
    else localStorage.removeItem(key(businessId));
  } catch {
    /* storage blocked: the draft lives in memory only */
  }
}

/** A stored draft is used only if it was made on top of the same orders the server has now. */
export function loadDraft(businessId: string, base: StandingOrders): Draft | null {
  try {
    const raw = localStorage.getItem(key(businessId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { base: StandingOrders; draft: Draft };
    return hasChanges(parsed.base, base) ? null : parsed.draft;
  } catch {
    return null;
  }
}

export function clearDraft(businessId: string): void {
  try {
    localStorage.removeItem(key(businessId));
  } catch {
    /* ignore */
  }
}
