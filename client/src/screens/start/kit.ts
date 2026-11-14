// Display helpers for the opening path. They only arrange pack data for the screen;
// the real money is decided by the engine when `open_business` arrives.
import type { BusinessState, CommonPack, NicheId, Pack, PackSetupItem, PackViolation, Place, PublicBusiness, SetupKind } from '@ohh/shared/types';
import { RULES } from '@ohh/shared/rules';
import type { IconName } from '../../ui';

export type KitItems = { id: string; qty: number }[];

export interface KitLine { item: PackSetupItem; qty: number; units: number; cost: number }

export interface KitGroup { id: string; label: string; icon: IconName; kinds: SetupKind[] }

export const KIT_GROUPS: KitGroup[] = [
  { id: 'legal', label: 'Permits and licenses', icon: 'doc', kinds: ['permit', 'license'] },
  { id: 'space', label: 'Space', icon: 'building', kinds: ['deposit', 'buildout'] },
  { id: 'equipment', label: 'Equipment', icon: 'store', kinds: ['equipment'] },
  { id: 'furniture', label: 'Furniture', icon: 'users', kinds: ['furniture'] },
  { id: 'stock', label: 'Opening stock and other', icon: 'truck', kinds: ['inventory', 'other'] },
];

/** Lines of a setup: price × quantity, or × size for items that scale with size (seats, chairs). */
export function kitLines(pack: Pack, items: KitItems, size: number): KitLine[] {
  return items.flatMap(({ id, qty }) => {
    const item = pack.setup.find((s) => s.id === id);
    if (!item || qty <= 0) return [];
    const units = item.scalesWithSize ? size : qty;
    return [{ item, qty, units, cost: item.cost * units }];
  });
}

export function kitTotal(pack: Pack, items: KitItems, size: number): number {
  return kitLines(pack, items, size).reduce((s, l) => s + l.cost, 0);
}

export function groupLines(lines: KitLine[]): { group: KitGroup; lines: KitLine[]; subtotal: number }[] {
  return KIT_GROUPS.map((group) => {
    const ls = lines.filter((l) => group.kinds.includes(l.item.kind));
    return { group, lines: ls, subtotal: ls.reduce((s, l) => s + l.cost, 0) };
  }).filter((g) => g.lines.length > 0);
}

/** How big the business can be in this place: usable floor share ÷ square feet per unit, within the pack limits. */
export function maxSizeFor(pack: Pack, place: Place | undefined): number {
  const { min, max, sqftPerUnit } = pack.sizing;
  if (!place || !sqftPerUnit) return max;
  const fit = Math.floor((place.sqft * RULES.USABLE_FLOOR_SHARE) / sqftPerUnit);
  return Math.max(min, Math.min(max, fit));
}

export const rentPerMonth = (place: Place): number => Math.round((place.sqft * place.rentPerSqftYear) / 12);

/** Great-circle distance in meters. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function competitorsNear(place: Place, niche: NicheId, businesses: PublicBusiness[], places: Place[], radiusM = 400): number {
  const byId = new Map(places.map((p) => [p.id, p]));
  return businesses.filter((b) => {
    if (b.niche !== niche || b.status === 'bankrupt') return false;
    const p = byId.get(b.placeId);
    return Boolean(p && p.id !== place.id && distanceM(p, place) <= radiusM);
  }).length;
}

/** Free places that suit the niche, busiest first. */
export function freePlaces(places: Place[], niche: NicheId, businesses: PublicBusiness[]): Place[] {
  const taken = new Set(businesses.filter((b) => b.status !== 'bankrupt').map((b) => b.placeId));
  return places.filter((p) => p.suitableFor.includes(niche) && !taken.has(p.id)).sort((a, b) => b.footTraffic - a.footTraffic);
}

export function trafficLabel(f: number): string {
  return f >= 0.75 ? 'Very busy' : f >= 0.55 ? 'Busy' : f >= 0.35 ? 'Moderate' : 'Quiet';
}

/** Longest wait among chosen items: you cannot legally open before the slowest permit. */
export function daysToOpen(pack: Pack, items: KitItems): number {
  return items.reduce((m, { id }) => Math.max(m, pack.setup.find((s) => s.id === id)?.waitDays ?? 0), 0);
}

export const requiredIds = (pack: Pack): Set<string> => new Set(pack.setup.filter((s) => s.required).map((s) => s.id));

/** Optional items that can be switched on or off in "Customize" (scaling items keep qty 1). */
export function toggleItem(items: KitItems, id: string, on: boolean): KitItems {
  const has = items.some((i) => i.id === id);
  if (on && !has) return [...items, { id, qty: 1 }];
  if (!on && has) return items.filter((i) => i.id !== id);
  return items;
}

/** The violation you commit by working without this item, from the niche pack or the common rules. */
export function violationFor(item: PackSetupItem, pack: Pack, common?: CommonPack): PackViolation | undefined {
  if (!item.withoutItViolation) return undefined;
  return pack.violations.find((v) => v.id === item.withoutItViolation) ?? common?.violations.find((v) => v.id === item.withoutItViolation);
}

export function fineLabel(v: PackViolation): string {
  const f = v.fine;
  const parts: string[] = [];
  if (f.base) parts.push(`$${f.base.toLocaleString('en-US')}`);
  if (f.perMonth) parts.push(`+$${f.perMonth.toLocaleString('en-US')}/month`);
  if (f.pctOfSaved) parts.push(`+${Math.round(f.pctOfSaved * 100)}% of what you saved`);
  const capped = f.max ? ` (up to $${f.max.toLocaleString('en-US')})` : '';
  const closure = v.closureDays ? ` · closed ${v.closureDays} days` : '';
  return `Fine ${parts.join(' ') || 'set by the agency'}${capped}${closure}`;
}

export interface PermitProgress { itemId: string; name: string; agency?: string; appliedDay: number; readyDay: number; daysLeft: number; ready: boolean; progress: number }

export function permitsProgress(b: BusinessState, day: number, pack: Pack | undefined): PermitProgress[] {
  return b.permits.map((p) => {
    const item = pack?.setup.find((s) => s.id === p.itemId);
    const total = Math.max(1, p.readyDay - p.appliedDay);
    const daysLeft = Math.max(0, p.readyDay - day);
    return { itemId: p.itemId, name: item?.name ?? p.itemId, agency: item?.agency, appliedDay: p.appliedDay, readyDay: p.readyDay, daysLeft, ready: daysLeft === 0, progress: Math.min(1, (total - daysLeft) / total) };
  });
}

/** Money already gone before the first customer: setup plus rent and other costs booked while waiting. */
export function spentSoFar(b: BusinessState): number {
  const booked = [...b.mtd.lines, ...b.history.flatMap((m) => m.lines)].filter((l) => l.amount < 0 && l.kind !== 'setup').reduce((s, l) => s - l.amount, 0);
  return b.setupSpent + booked;
}
