// Rules that depend on the place: build-out by the condition of the space, deposit from the real rent,
// buying an operating business, and demand from the people who walk past the door.
// Pure functions: the engine, the analytics, the client and data/build-footfall.ts all use these, so the
// number the player sees on the map is the number the engine charges.
import type { AnchorKind, Money, NicheId, Pack, PackSetupItem, Place, PlaceRivals } from './types';

// ───────────────────────── geometry ─────────────────────────

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** How much two shops share the same passers-by: 1 next door, 0 at the radius and beyond. */
export const overlap = (distM: number, radiusM: number): number => (distM >= radiusM ? 0 : 1 - distM / radiusM);

const round2 = (x: number): number => Math.round((x + Number.EPSILON) * 100) / 100;

export const rentMonthOf = (place: Place): Money => round2((place.sqft * place.rentPerSqftYear) / 12);

// ───────────────────────── build-out ─────────────────────────

export type BuildoutClassId = 'light' | 'standard' | 'heavy';
export interface BuildoutClass { label: string; perSqft: Money; days: number }
export interface BuildoutRules {
  itemId: string;                                       // the setup item this prices
  classes: Record<BuildoutClassId, BuildoutClass>;
  byFormerUse: Record<string, BuildoutClassId>;
}
export interface TakeoverRules {
  multipleOfAnnualSales: number;   // asking price as a share of a year of sales at this address
  min: Money; max: Money;
  awareness: number;               // share of the regulars who stay with the new owner
  refreshDays: number;             // cleaning, re-training and handover before the doors reopen
}
export interface Buildout { classId: BuildoutClassId; label: string; perSqft: Money; days: number; cost: Money }

export function buildoutRules(pack: Pack): BuildoutRules | null {
  const r = (pack.extra as { buildout?: BuildoutRules } | undefined)?.buildout;
  return r && r.classes && r.byFormerUse ? r : null;
}
export function takeoverRules(pack: Pack): TakeoverRules | null {
  const r = (pack.extra as { takeover?: TakeoverRules } | undefined)?.takeover;
  return r && typeof r.multipleOfAnnualSales === 'number' ? r : null;
}

/** Is this place an operating business of this niche that the player buys as it stands? */
export function isTakeover(pack: Pack, place: Place | undefined): boolean {
  return !!place?.forSale && place.forSale.niche === pack.id && !!takeoverRules(pack);
}

/** Build-out of this place for this niche, or null when the pack or the place carries no such data (flat `cost`). */
export function buildoutOf(pack: Pack, place: Place | undefined): Buildout | null {
  const rules = buildoutRules(pack);
  if (!rules || !place || !place.formerUse) return null;
  if (isTakeover(pack, place)) {
    const t = takeoverRules(pack)!;
    return { classId: 'light', label: 'Operating business: handover and deep clean', perSqft: 0, days: t.refreshDays, cost: 0 };
  }
  const classId = rules.byFormerUse[place.formerUse] ?? 'heavy';
  const c = rules.classes[classId];
  return { classId, label: c.label, perSqft: c.perSqft, days: c.days, cost: round2(c.perSqft * place.sqft) };
}

/**
 * The same place as a long-established business sees it: the room was fitted out years ago (priced as the lightest
 * renovation) and nothing is for sale. Used for the residents who populate the city when the world is created.
 */
export function asEstablishedPlace(pack: Pack, place: Place): Place {
  const rules = buildoutRules(pack);
  const lightUse = rules ? Object.keys(rules.byFormerUse).find((k) => rules.byFormerUse[k] === 'light') : undefined;
  return { ...place, forSale: undefined, formerUse: (lightUse as Place['formerUse']) ?? place.formerUse };
}

/** Price of one setup item at this place (for items that scale with size: per unit of size). */
export function setupItemCost(pack: Pack, def: PackSetupItem, place: Place | undefined): Money {
  if (!place) return def.cost;
  if (isTakeover(pack, place) && (def.includedInTakeover || def.kind === 'buildout' || def.kind === 'equipment' || def.kind === 'furniture')) return 0;
  const basis = def.costBasis ?? 'fixed';
  if (basis === 'months_rent') return round2((def.rate ?? 0) * rentMonthOf(place));
  const b = buildoutOf(pack, place);
  if (basis === 'per_sqft') return b ? b.cost : def.cost;
  if (basis === 'pct_of_buildout') return b ? round2((def.rate ?? 0) * b.cost) : def.cost;
  return def.cost;
}

/** Cost of a list of setup items at this place. The asking price of an operating business is added by `openingCost`. */
export function setupItemsCost(pack: Pack, items: readonly { id: string; qty: number }[], size: number, place: Place | undefined): Money {
  let total = 0;
  for (const it of items) {
    const def = pack.setup.find((s) => s.id === it.id);
    if (!def) continue;
    total += setupItemCost(pack, def, place) * (def.scalesWithSize ? size : it.qty);
  }
  return round2(total);
}

/** Everything paid on the day the lease is signed: the items plus, for an operating business, its asking price. */
export function openingCost(pack: Pack, items: readonly { id: string; qty: number }[], size: number, place: Place | undefined): Money {
  const takeover = isTakeover(pack, place) ? place!.forSale!.askingPrice : 0;
  return round2(setupItemsCost(pack, items, size, place) + takeover);
}

/** Days from signing the lease until the doors may legally open with this list of items. */
export function daysToOpenOf(pack: Pack, items: readonly { id: string; qty: number }[], place: Place | undefined): number {
  const build = buildoutOf(pack, place)?.days ?? 0;
  let days = build;
  for (const it of items) {
    const def = pack.setup.find((s) => s.id === it.id);
    if (!def || !def.waitDays || !def.required) continue;
    if (def.kind !== 'permit' && def.kind !== 'license') continue;
    days = Math.max(days, (def.afterBuildout ? build : 0) + def.waitDays);
  }
  return days;
}

// ───────────────────────── demand from passers-by ─────────────────────────

export interface FootfallParams {
  captureRate: number;        // orders per passer-by for a known, average shop with no rival in sight, at the reference price
  outside: number;            // weight of "not here": chains, the office machine, coffee at home (one average shop = 1)
  priceSensitivity: number;   // utility −e · ln(price / refPrice)
  radiusM: number;            // shops closer than this share the same passers-by
  staticWeight: number;       // weight of one real, non-playing rival next door (a playing shop = 1)
  rampDays: number;           // time constant of the climb from the opening day to the full regular crowd
  awarenessStart: number;     // share of the full demand on the first day of a brand-new shop
}

export function footfallParams(pack: Pack): FootfallParams | null {
  const f = (pack.extra as { footfall?: FootfallParams } | undefined)?.footfall;
  return f && f.captureRate > 0 && f.radiusM > 0 ? f : null;
}

export function rivalsOf(place: Place, niche: NicheId): PlaceRivals | undefined {
  return place.rivals?.find((r) => r.niche === niche);
}

/** Share of the regular crowd a shop has `daysOpen` days after opening. */
export function awarenessAt(daysOpen: number, start: number, rampDays: number): number {
  if (start >= 1 || rampDays <= 0) return 1;
  return start + (1 - start) * (1 - Math.exp(-Math.max(0, daysOpen) / rampDays));
}

/**
 * Orders a day at this place for an average, fully known shop at the reference price, counting only the real
 * rivals around it (no playing businesses). This is the number shown on the map before anyone opens there.
 */
export function baselineOrdersDay(pack: Pack, place: Place): number | null {
  const f = footfallParams(pack);
  if (!f || !place.pedestriansPerDay) return null;
  const rivals = (rivalsOf(place, pack.id)?.weight ?? 0) * f.staticWeight;
  const share = 1 / (1 + rivals + f.outside);
  return place.pedestriansPerDay * f.captureRate * (1 + f.outside) * share;
}

/** Asking price of an operating business at this place: a share of a year of sales at the reference price. */
export function askingPriceFor(pack: Pack, place: Place): Money | null {
  const t = takeoverRules(pack);
  const orders = baselineOrdersDay(pack, place);
  if (!t || orders == null) return null;
  const annualSales = orders * pack.unit.refPrice * 360;
  return Math.round(Math.min(t.max, Math.max(t.min, t.multipleOfAnnualSales * annualSales)) / 1000) * 1000;
}

// ───────────────────────── what stands nearby ─────────────────────────

/** How far each kind of neighbour still matters, in metres. */
export const ANCHOR_REACH_M: Record<AnchorKind, number> = { subway: 250, college: 400, school: 200, park: 200, hospital: 250, library: 150, museum: 150, plaza: 150 };

/**
 * Day pattern from the neighbours: commuters on weekdays, students in term, the park on warm weekends.
 * The neighbours and distances come from city data; the size of each effect is a planning assumption.
 */
export function anchorDayMult(place: Place, weekday: number, month: number): number {
  const anchors = place.anchors;
  if (!anchors || anchors.length === 0) return 1;
  const has = (k: AnchorKind): boolean => anchors.some((a) => a.kind === k && a.distM <= ANCHOR_REACH_M[k]);
  const weekend = weekday >= 5;
  const summer = month >= 6 && month <= 8;
  const winter = month === 12 || month <= 2;
  let m = 1;
  if (has('subway')) m *= weekend ? 0.93 : 1.06;
  if (has('college')) m *= summer ? 0.88 : 1.06;
  if (has('school')) m *= summer ? 0.97 : weekend ? 1 : 1.03;
  if (has('park')) m *= winter ? 0.97 : weekend ? 1.1 : 1.02;
  if (has('hospital')) m *= 1.03;
  if (has('museum') || has('library') || has('plaza')) m *= weekend ? 1.03 : 1;
  return Math.min(1.25, Math.max(0.8, m));
}

/** One line per neighbour for the place card: what it is and what it does to the day. */
export function anchorEffects(place: Place): { kind: AnchorKind; name: string; distM: number; effect: string }[] {
  const text: Record<AnchorKind, string> = {
    subway: 'weekday commuters: +6% on weekdays, −7% on weekends',
    college: 'students: +6% in term, −12% in summer',
    school: 'parents and staff: +3% on school days',
    park: 'weekend crowd: +10% on warm weekends',
    hospital: 'staff and visitors: +3% every day',
    library: 'weekend visitors: +3%',
    museum: 'weekend visitors: +3%',
    plaza: 'weekend visitors: +3%',
  };
  return (place.anchors ?? []).filter((a) => a.distM <= ANCHOR_REACH_M[a.kind]).map((a) => ({ kind: a.kind, name: a.name, distM: a.distM, effect: text[a.kind] }));
}
