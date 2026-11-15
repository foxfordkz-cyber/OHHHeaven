// Cafe model, part "segments": who comes to this door today and how well the offer suits them (build/FORMATS.md, section 2; task B02).
// Four groups — commuters, residents, students, visitors — come in shares set by what stands near the door (subway, college,
// museum, park) and by the day of the week and the month. Each group minds price, quality, seats and the line differently,
// so a low price pays off best by a college and a high one hurts least by a museum. Numbers: pack.extra.guestSegments.
// Pure: no state, no randomness. Without pack.extra.guestSegments the part changes nothing.
import { dateOf, type BusinessState, type DayReport, type GameDate, type NicheKpi, type Pack, type Place, type PlaceTier } from '@ohh/shared';
import { weekdayMult } from '../../economy/effects';
import { defaultGuestMix, type CafeDay, type CafePart, type GuestMix } from './contract';

// ───────────────────────── pack data ─────────────────────────

export type BlockType = 'residential' | 'office' | 'campus' | 'tourist';
export const BLOCK_TYPES: readonly BlockType[] = ['residential', 'office', 'campus', 'tourist'];

export interface SegmentCfg {
  id: string; name: string;
  sitShare: number; morningShare: number; dwellHours: number;
  priceShift: number; qualityShift: number; seatPull: number; waitPull: number;
  regularShare: number; week: number[]; months: number[];
}

export interface GuestSegmentsCfg {
  segments: SegmentCfg[];
  mixByBlock: Record<BlockType, Record<string, number>>;
  blockRules: {
    residentialBase: number;
    office: { anchor: string; reachM: number; ridersRef: number; maxWeight: number };
    campus: { anchor: string; reachM: number; weight: number };
    tourist: { reachM: number } & Record<string, number>;
  };
  tierPriceShift: Partial<Record<PlaceTier, number>>;
  tierQualityShift: Partial<Record<PlaceTier, number>>;
  refSeats: number; seatSpan: number; waitWindowDays: number; multBounds: [number, number];
}

/** The pack's guest groups, or null when the pack has none (then the part changes nothing). */
export function segmentsCfg(pack: Pack): GuestSegmentsCfg | null {
  const cfg = (pack.extra as { guestSegments?: GuestSegmentsCfg } | undefined)?.guestSegments;
  return cfg && Array.isArray(cfg.segments) && cfg.segments.length > 0 && cfg.mixByBlock ? cfg : null;
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const sum = (xs: readonly number[]): number => xs.reduce((a, x) => a + x, 0);
const near = (distM: number, reachM: number): number => (reachM > 0 ? Math.max(0, 1 - distM / reachM) : 0);
const at = (xs: readonly number[] | undefined, i: number): number => (xs && typeof xs[i] === 'number' ? xs[i] : 1);

// ───────────────────────── the block ─────────────────────────

/** Weights of the four block types at this place, adding up to 1. No place or no anchors: a residential block. */
export function blockWeights(place: Place | undefined, pack: Pack): Record<BlockType, number> {
  const cfg = segmentsCfg(pack);
  const w: Record<BlockType, number> = { residential: 1, office: 0, campus: 0, tourist: 0 };
  if (!cfg) return w;
  const r = cfg.blockRules;
  w.residential = r.residentialBase;
  for (const a of place?.anchors ?? []) {
    if (a.kind === r.office.anchor) w.office += ((a.ridersPerDay ?? r.office.ridersRef) / r.office.ridersRef) * near(a.distM, r.office.reachM);
    if (a.kind === r.campus.anchor) w.campus = Math.max(w.campus, r.campus.weight * near(a.distM, r.campus.reachM));
    const t = a.kind in r.tourist && (a.kind as string) !== 'reachM' ? (r.tourist as Record<string, number>)[a.kind] : undefined;
    if (typeof t === 'number') w.tourist = Math.max(w.tourist, t * near(a.distM, r.tourist.reachM));
  }
  w.office = Math.min(r.office.maxWeight, w.office);
  const total = sum(BLOCK_TYPES.map((k) => w[k]));
  if (total > 0) for (const k of BLOCK_TYPES) w[k] /= total;
  return w;
}

/** The block type with the largest weight: the label on the place card. */
export function blockTypeOf(place: Place | undefined, pack: Pack): BlockType {
  const w = blockWeights(place, pack);
  return BLOCK_TYPES.reduce((best, k) => (w[k] > w[best] ? k : best), 'residential' as BlockType);
}

// ───────────────────────── who comes ─────────────────────────

export interface DetailedGroup { id: string; share: number; cfg: SegmentCfg }

/** Each group's share of an average day at this place (before the week and the month). */
function baseShares(cfg: GuestSegmentsCfg, place: Place | undefined, pack: Pack): number[] {
  const w = blockWeights(place, pack);
  return cfg.segments.map((s) => sum(BLOCK_TYPES.map((k) => w[k] * (cfg.mixByBlock[k]?.[s.id] ?? 0))));
}

/**
 * Who comes on this date. `volume` is the size of the day against an average day of the year (the week and the
 * month of each group); shares add up to 1. Null without pack data.
 */
export function guestMixAt(pack: Pack, place: Place | undefined, date: Pick<GameDate, 'weekday' | 'month'>): { volume: number; groups: DetailedGroup[] } | null {
  const cfg = segmentsCfg(pack);
  if (!cfg) return null;
  const base = baseShares(cfg, place, pack);
  const raw = cfg.segments.map((s, i) => base[i] * at(s.week, ((date.weekday % 7) + 7) % 7) * at(s.months, (((date.month - 1) % 12) + 12) % 12));
  const volume = sum(raw);
  if (!(volume > 0)) return null;
  return { volume, groups: cfg.segments.map((s, i) => ({ id: s.id, share: raw[i] / volume, cfg: s })) };
}

/** Same as guestMix with each group's settings and the day's volume: for service.ts (dwellHours) and regulars.ts (regularShare). */
export function guestMixDetailed(d: CafeDay): { volume: number; groups: DetailedGroup[] } {
  const mix = guestMixAt(d.pack, d.place, d.date);
  if (mix) return mix;
  const g = defaultGuestMix(d.pack).groups[0];
  const cfg: SegmentCfg = {
    id: g.id, name: 'Everyone', sitShare: g.sitShare, morningShare: g.morningShare, dwellHours: 0.5,
    priceShift: 0, qualityShift: 0, seatPull: 0, waitPull: 0, regularShare: 0, week: [], months: [],
  };
  return { volume: 1, groups: [{ id: g.id, share: 1, cfg }] };
}

/** Who comes today. service.ts reads this; keep the name and the signature. */
export function guestMix(d: CafeDay): GuestMix {
  const mix = guestMixAt(d.pack, d.place, d.date);
  if (!mix) return defaultGuestMix(d.pack);
  return { groups: mix.groups.map((g) => ({ id: g.id, share: g.share, sitShare: g.cfg.sitShare, morningShare: g.cfg.morningShare })) };
}

// ───────────────────────── does the offer suit them ─────────────────────────

/** Share of guests who walked away (no seat, no one to serve them) over the last days; 0 without history. */
export function walkedShare(b: BusinessState, windowDays: number): number {
  const days = (b.days ?? []).slice(-Math.max(1, windowDays));
  const demand = sum(days.map((r) => r.demandUnits));
  return demand > 0 ? sum(days.map((r) => r.lost.size + r.lost.staff)) / demand : 0;
}

export interface GroupFit {
  id: string; name: string; share: number;
  /** exp(u): 1 is the average customer the engine already models; below 1 the group buys less than that. */
  fit: number;
  /** The four pieces of u, so a screen can say why. */
  price: number; quality: number; seats: number; line: number;
}

/** How one group answers this offer; independent of the block except for residents on a prime or cheap block. */
function groupFit(cfg: GuestSegmentsCfg, s: SegmentCfg, b: BusinessState, pack: Pack, tier: PlaceTier | undefined, walked: number): Omit<GroupFit, 'share'> {
  const lp = Math.log(Math.max(0.01, b.orders.price) / pack.unit.refPrice);
  const seatIdx = clamp((b.size - cfg.refSeats) / cfg.seatSpan, -1, 1);
  const tierOn = s.id === 'residents' && tier !== undefined;
  const priceShift = s.priceShift + (tierOn ? cfg.tierPriceShift[tier!] ?? 0 : 0);
  const qualityShift = s.qualityShift + (tierOn ? cfg.tierQualityShift[tier!] ?? 0 : 0);
  const price = -priceShift * lp;
  const quality = qualityShift * (b.quality - 0.5);
  const seats = s.seatPull * seatIdx;
  const line = -s.waitPull * walked;
  return { id: s.id, name: s.name, fit: Math.exp(price + quality + seats + line), price, quality, seats, line };
}

/** Does the offer suit today's guests. A cafe at the reference price, quality 0.5 and the reference room gets exactly 1. */
export function segmentFit(d: CafeDay): { mult: number; byGroup: GroupFit[] } {
  const cfg = segmentsCfg(d.pack);
  const mix = guestMixAt(d.pack, d.place, d.date);
  if (!cfg || !mix) return { mult: 1, byGroup: [] };
  const walked = walkedShare(d.b, cfg.waitWindowDays);
  const byGroup = mix.groups.map((g) => ({ ...groupFit(cfg, g.cfg, d.b, d.pack, d.place?.tier, walked), share: g.share }));
  const mult = clamp(sum(byGroup.map((g) => g.share * g.fit)), cfg.multBounds[0], cfg.multBounds[1]);
  return { mult, byGroup };
}

/**
 * Because this part answers demandMult, the engine applies `weekdayMult(pack, weekday, true)`: the pack's own week if
 * it has one, otherwise 1. With guest groups the week comes from the groups, so whatever the engine applies is divided
 * out instead of being counted twice. Without guest groups the engine's usual week is put back, so the part is neutral.
 */
export function segmentsDemandMult(d: CafeDay): number {
  const applied = weekdayMult(d.pack, d.date.weekday, true) || 1;
  const mix = guestMixAt(d.pack, d.place, d.date);
  if (!mix) return weekdayMult(d.pack, d.date.weekday, false) / applied;
  return (mix.volume * segmentFit(d).mult) / applied;
}

// ───────────────────────── what the owner sees ─────────────────────────

const BLOCK_LABEL: Record<BlockType, string> = {
  residential: 'Mostly residents',
  office: 'Commuters from the subway',
  campus: 'Students (term time)',
  tourist: 'Visitors',
};
const SHORT: Record<string, string> = { office: 'commuters', residents: 'residents', students: 'students', tourists: 'visitors' };
const shortName = (id: string, name: string): string => SHORT[id] ?? name.toLowerCase();
const pct = (x: number): string => `${Math.round(x * 100)}%`;
const money = (x: number): string => `$${x.toFixed(2).replace(/\.00$/, '')}`;

export interface PlaceGuests {
  blockType: BlockType;
  label: string;
  /** Shares of an average day of the year at this door, largest first; they add up to 1. */
  groups: { id: string; name: string; share: number }[];
}

/** "Who walks here" for the place card, before the lease is signed. Null without pack data. */
export function placeGuests(pack: Pack, place: Place | undefined): PlaceGuests | null {
  const cfg = segmentsCfg(pack);
  if (!cfg) return null;
  // an average day of the year: each group's week and months average out to its base share times its mean month
  const base = baseShares(cfg, place, pack);
  const raw = cfg.segments.map((s, i) => base[i] * (s.months.length ? sum(s.months) / s.months.length : 1));
  const total = sum(raw);
  if (!(total > 0)) return null;
  const groups = cfg.segments.map((s, i) => ({ id: s.id, name: s.name, share: raw[i] / total })).sort((a, b) => b.share - a.share);
  const blockType = blockTypeOf(place, pack);
  return { blockType, label: BLOCK_LABEL[blockType], groups };
}

/** One line for the day: "44% residents, 37% students, 13% commuters, 6% visitors". */
export function mixLine(groups: readonly { id: string; name: string; share: number }[]): string {
  return [...groups].sort((a, b) => b.share - a.share).map((g) => `${pct(g.share)} ${shortName(g.id, g.name)}`).join(', ');
}

/**
 * How each group answers the current offer, independent of the door (kpis and notes do not see the place yet:
 * build/FORMATS.md, request 1). Residents are counted on a mid-rent block.
 */
export function offerByGroup(b: BusinessState, pack: Pack): Omit<GroupFit, 'share'>[] {
  const cfg = segmentsCfg(pack);
  if (!cfg) return [];
  const walked = walkedShare(b, cfg.waitWindowDays);
  return cfg.segments.map((s) => groupFit(cfg, s, b, pack, undefined, walked));
}

type Piece = 'price' | 'quality' | 'seats' | 'line';

/**
 * Why a group stays away, as a sentence, or null when nothing costs it 10% or more. The price and quality pieces are
 * against an average coffee buyer at the same offer (the engine already charges everyone for price and pays for
 * quality), so they are said that way; the seats and line pieces are against the reference room and a calm week.
 * A price below the reference is never a reason: every group still buys more than at the reference price.
 * `share` is the group's part of the guests at this door, when the door is known.
 */
function reasonFor(g: Omit<GroupFit, 'share'>, b: BusinessState, pack: Pack, cfg: GuestSegmentsCfg, share?: number): string | null {
  const who = shortName(g.id, g.name);
  const Who = who.charAt(0).toUpperCase() + who.slice(1);
  const above = b.orders.price > pack.unit.refPrice;
  const pieces: Piece[] = (['price', 'quality', 'seats', 'line'] as const).filter((k) => k !== 'price' || above);
  if (!pieces.length) return null;
  const worst = pieces.reduce((w: Piece, k) => (g[k] < g[w] ? k : w), pieces[0]);
  const loss = 1 - Math.exp(g[worst]);
  if (g[worst] >= 0 || loss < 0.1) return null;
  const they = share === undefined ? 'They' : `They are ${pct(share)} of your guests and`;
  if (worst === 'price') return `${Who} find ${money(b.orders.price)} too much. ${they} buy ${pct(loss)} less than an average coffee buyer at that price.`;
  if (worst === 'quality') {
    return b.quality > 0.5
      ? `${Who} do not pay for the extra quality. ${they} buy ${pct(loss)} less of it than an average coffee buyer.`
      : `${Who} notice the drop in quality. ${they} buy ${pct(loss)} less than an average coffee buyer.`;
  }
  if (worst === 'seats') return `${Who} want a seat: ${b.size} seats is a counter to them. ${they} come ${pct(loss)} less than to ${cfg.refSeats} seats.`;
  return `${Who} walked away from the line last week. ${they} come ${pct(loss)} less this week.`;
}

/** Guests of an average day of one month at this door, per group (the week averaged out). */
function monthGuests(cfg: GuestSegmentsCfg, place: Place | undefined, pack: Pack, month: number): number[] {
  const base = baseShares(cfg, place, pack);
  const m = (((month - 1) % 12) + 12) % 12;
  return cfg.segments.map((s, i) => base[i] * (s.week.length ? sum(s.week) / s.week.length : 1) * at(s.months, m));
}

/**
 * The calendar ahead, said a week before it comes: next month's guests at this door against this month's. Declared
 * from the groups' months, not drawn: students leave in June and come back in September, commuters thin out in August.
 */
export function nextMonthChange(pack: Pack, place: Place | undefined, month: number): { change: number; groupId: string; groupName: string; groupChange: number } | null {
  const cfg = segmentsCfg(pack);
  if (!cfg) return null;
  const now = monthGuests(cfg, place, pack, month);
  const next = monthGuests(cfg, place, pack, (month % 12) + 1);
  const total = sum(now);
  if (!(total > 0)) return null;
  // the group that moves the door most (in guests, not in its own percent)
  let k = 0;
  for (let i = 1; i < now.length; i++) if (Math.abs(next[i] - now[i]) > Math.abs(next[k] - now[k])) k = i;
  return {
    change: sum(next) / total - 1,
    groupId: cfg.segments[k].id, groupName: cfg.segments[k].name,
    groupChange: now[k] > 0 ? next[k] / now[k] - 1 : 0,
  };
}

/** How big a change of next month is worth a line in the report. */
const HEADS_UP = 0.05;

/**
 * One number per group: how much of this offer the group buys against an average coffee buyer (100%).
 * Not wired into `part` yet: analytics replaces its own cafe numbers (avg ticket and the rest) with the hook's answer,
 * so wiring it would hide them.
 */
export function segmentKpis(b: BusinessState, pack: Pack): NicheKpi[] {
  return offerByGroup(b, pack).map((g) => {
    const who = shortName(g.id, g.name);
    return { id: `guest_fit_${g.id}`, label: `${who.charAt(0).toUpperCase()}${who.slice(1)} vs. an average buyer`, value: Math.round(g.fit * 100), unit: '%' };
  });
}

/**
 * Lines for the owner's report, on Mondays only so the report does not repeat itself every day.
 * `env` is optional: the engine does not pass the place to notes yet (build/FORMATS.md, request 1). Without it the
 * lines say only what does not depend on the door; once the engine passes it, they name the shares at this door and
 * warn a week ahead about next month's guests.
 */
export function notes(b: BusinessState, r: DayReport, pack: Pack, env?: { place?: Place }): string[] {
  const cfg = segmentsCfg(pack);
  if (!cfg) return [];
  const date = dateOf(r.day);
  if (date.weekday !== 0) return [];
  const out: string[] = [];
  const place = env?.place;

  // the last Monday of the month: what next month brings to this door
  if (place && date.dayOfMonth > 23) {
    const ahead = nextMonthChange(pack, place, date.month);
    if (ahead && Math.abs(ahead.change) >= HEADS_UP) {
      const who = shortName(ahead.groupId, ahead.groupName);
      out.push(ahead.change < 0
        ? `Next month about ${pct(-ahead.change)} fewer guests at this door: ${who} ${ahead.groupChange < 0 ? `drop by ${pct(-ahead.groupChange)}` : 'move'}. Plan staff and stock for it.`
        : `Next month about ${pct(ahead.change)} more guests at this door: ${who} ${ahead.groupChange > 0 ? `grow by ${pct(ahead.groupChange)}` : 'move'}. Check the team can serve them.`);
    }
  }

  // who stays away and why: with the door known, the groups that cost most guests come first
  if (place) {
    const fit = segmentFit({ b, pack, place, date, day: r.day });
    const ranked = [...fit.byGroup].filter((g) => g.fit < 0.9).sort((x, y) => (1 - y.fit) * y.share - (1 - x.fit) * x.share);
    for (const g of ranked) {
      if (g.share < 0.1) continue;
      const line = reasonFor(g, b, pack, cfg, g.share);
      if (line) out.push(line);
      if (out.length >= 2) break;
    }
    return out;
  }
  for (const g of offerByGroup(b, pack).sort((x, y) => x.fit - y.fit)) {
    if (g.fit >= 0.9 || out.length >= 2) break;
    const line = reasonFor(g, b, pack, cfg);
    if (line) out.push(line);
  }
  return out;
}

export const part: CafePart = {
  demandMult: segmentsDemandMult,
  notes,
};
