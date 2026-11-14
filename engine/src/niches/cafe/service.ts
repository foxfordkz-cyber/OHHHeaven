// Cafe model, part "service": seats and takeaway, the morning rush, the queue (build/FORMATS.md, section 3; task B01).
// Seats limit only the guests who sit; takeaway is limited by how fast the team works; in the morning rush the guests
// who see a long line walk on. Numbers come from packs/cafe.json → extra.service (data: packs/parts/cafe/D20-formats.json).
// Without extra.service in the pack this part answers nothing and the game is unchanged.
// Pure: no network, no files, no Date, no Math.random. Shares of guests who walk away are shares of the flow, not chances.
import type { BusinessState, DayReport, NicheKpi, Pack, Place } from '@ohh/shared';
import { dateOf } from '@ohh/shared';
import type { NicheEnv } from '../index';
import {
  defaultGuestMix, defaultStaffPower,
  type CafeDay, type CafePart, type GuestGroup, type GuestMix, type StaffPower,
} from './contract';
import * as segmentsModule from './segments';
import * as staffingModule from './staffing';

// ───────────── what this part reads from its neighbours ─────────────
// segments.ts (B02) and staffing.ts (B03) are written at the same time as this file. FORMATS.md fixes the names and
// signatures below; until a neighbour exports them, the contract's fallbacks answer. The types are checked: if a
// neighbour exports one of these names with another signature, this file stops compiling instead of guessing.
interface SegmentsApi { part: CafePart; guestMix?(d: CafeDay): GuestMix }
interface StaffingApi { part: CafePart; staffPower?(d: CafeDay): StaffPower; coverage?(d: CafeDay): { lostDemandShare: number } }
const segments: SegmentsApi = segmentsModule;
const staffing: StaffingApi = staffingModule;

// ───────────── pack ─────────────

export interface WalkAwayPoint { line: number; share: number }
export interface ServiceCfg {
  rushHours: number[];
  rushHourWeights: number[];
  peak15Factor: number;
  machineOrdersPerHour: number;
  walkAwayByLine: WalkAwayPoint[];
  seatPeakHourShare: number;
  seatFill: number;
  seatBusyHours: number;
  noSeatTakesAway: number;
  sitInLaborMult: number;
  crowdAbove: number;
  crowdQualityDrop: number;
  fixedCoreSqft: number;
  sqftPerSeat: number;
}

const NUM_FIELDS = [
  'peak15Factor', 'machineOrdersPerHour', 'seatPeakHourShare', 'seatFill', 'seatBusyHours', 'noSeatTakesAway',
  'sitInLaborMult', 'crowdAbove', 'crowdQualityDrop', 'fixedCoreSqft', 'sqftPerSeat',
] as const;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** extra.service, or null when the pack has none or it is malformed (then the part changes nothing). */
export function serviceCfg(pack: Pack): ServiceCfg | null {
  const raw = (pack.extra as { service?: Partial<ServiceCfg> } | undefined)?.service;
  if (!raw || typeof raw !== 'object') return null;
  if (!NUM_FIELDS.every((k) => isNum(raw[k]))) return null;
  if (!Array.isArray(raw.rushHourWeights) || !raw.rushHourWeights.every(isNum)) return null;
  if (!Array.isArray(raw.rushHours) || raw.rushHours.length !== raw.rushHourWeights.length) return null;
  const pts = raw.walkAwayByLine;
  if (!Array.isArray(pts) || pts.length === 0 || !pts.every((p) => isNum(p?.line) && isNum(p?.share))) return null;
  return { ...(raw as ServiceCfg), walkAwayByLine: [...pts].sort((a, b) => a.line - b.line) };
}

/** Hours a seated guest of this group stays, from extra.guestSegments (the data of segments.ts). */
interface SegmentData { id: string; sitShare: number; morningShare: number; dwellHours: number }
function segmentData(pack: Pack): { segments: SegmentData[]; residential?: Record<string, number> } {
  const g = (pack.extra as { guestSegments?: { segments?: SegmentData[]; mixByBlock?: { residential?: Record<string, number> } } } | undefined)?.guestSegments;
  const segs = Array.isArray(g?.segments) ? g!.segments.filter((s) => s && typeof s.id === 'string' && isNum(s.dwellHours)) : [];
  return { segments: segs, residential: g?.mixByBlock?.residential };
}

// ───────────── today's guests and team ─────────────

export interface Guests { groups: (GuestGroup & { dwellHours: number })[] }

/**
 * Who comes today. segments.guestMix when B02's part is in; otherwise the residential mix of extra.guestSegments
 * (FORMATS.md 1.4: the mix to use where the place is unknown); otherwise the contract's one group.
 */
function guestsOf(d: CafeDay): Guests {
  const data = segmentData(d.pack);
  const byId = new Map(data.segments.map((s) => [s.id, s]));
  let mix: GuestMix;
  if (segments.guestMix) mix = segments.guestMix(d);
  else if (data.residential && data.segments.length) {
    const rows = data.segments.map((s) => ({ s, w: Math.max(0, data.residential![s.id] ?? 0) }));
    const tot = rows.reduce((a, r) => a + r.w, 0);
    mix = tot > 0
      ? { groups: rows.map(({ s, w }) => ({ id: s.id, share: w / tot, sitShare: s.sitShare, morningShare: s.morningShare })) }
      : defaultGuestMix(d.pack);
  } else mix = defaultGuestMix(d.pack);
  // A group the pack does not describe (the contract's 'everyone') stays the average seated time of the known groups.
  const avgDwell = data.segments.length ? data.segments.reduce((a, s) => a + s.dwellHours, 0) / data.segments.length : 1;
  return { groups: mix.groups.map((g) => ({ ...g, dwellHours: byId.get(g.id)?.dwellHours ?? avgDwell })) };
}

/**
 * How fast the team works. staffing.staffPower when B03's part is in. The contract's fallback counts the pack's
 * orders per worker, which already mix seated and takeaway orders; this part counts work in takeaway orders, so the
 * fallback is converted with the pack's own takeaway share (the same conversion FORMATS.md 4.2 uses for ordersPerPaidHour).
 */
function powerOf(d: CafeDay, cfg: ServiceCfg): StaffPower {
  if (staffing.staffPower) return staffing.staffPower(d);
  const base = defaultStaffPower(d.b, d.pack);
  const sitRef = 1 - Math.min(0.95, Math.max(0, d.pack.sizing.takeawayShare ?? 0));
  return { ...base, ordersPerDay: base.ordersPerDay * (1 + sitRef * (cfg.sitInLaborMult - 1)) };
}

const lostToHours = (d: CafeDay): number => Math.min(1, Math.max(0, staffing.coverage?.(d).lostDemandShare ?? 0));

// ───────────── the day ─────────────

export interface ServiceDay {
  /** Orders that wanted to be served, before the hours nobody covered. */
  wanted: number;
  /** Orders left after the hours nobody covered: what the rush, the seats and the team work with. */
  demand: number;
  served: number;
  rush: { orders: number; capPerHour: number; line: number; waitMin: number; walked: number; servedShare: number; peakHour: number };
  seats: { count: number; fit: number; wanted: number; seated: number; tookAway: number; left: number; turns: number; peakUse: number; crowded: boolean };
  lost: { hours: number; queue: number; seats: number; labor: number };
  /** Orders the team could still make today on top of `served`. */
  spare: number;
  /** Work per order against a takeaway order. */
  labor: number;
  /** What the team makes in a day, in today's mix of orders. */
  teamPerDay: number;
  bound: 'none' | 'hours' | 'rush' | 'seats' | 'labor';
}

/** Share of arriving guests who walk on when `line` people stand ahead: straight lines between the pack's points. */
export function walkAway(line: number, pts: readonly WalkAwayPoint[]): number {
  if (line <= pts[0].line) return pts[0].share;
  for (let i = 1; i < pts.length; i++) {
    if (line <= pts[i].line) {
      const a = pts[i - 1], z = pts[i];
      return a.share + ((z.share - a.share) * (line - a.line)) / (z.line - a.line);
    }
  }
  return pts[pts.length - 1].share;
}

/** Seats the floor holds: the bar, the line, the restroom and the back take fixedCoreSqft. Without a place — no limit. */
export function seatsThatFit(place: Place | undefined, cfg: ServiceCfg): number {
  if (!place || !isNum(place.sqft)) return Infinity;
  return Math.max(0, Math.floor((place.sqft - cfg.fixedCoreSqft) / cfg.sqftPerSeat));
}

/** What one day of service works with. serviceDay gathers it from the neighbours; tests pass it directly. */
export interface ServiceInputs {
  /** Orders that want to be served today, after every demand multiplier. */
  demand: number;
  /** Share of the day's orders that fall into hours nobody covers (staffing.coverage). */
  hoursShare: number;
  guests: Guests;
  power: StaffPower;
  seatsOwned: number;
  place?: Place;
}

/** The whole day step by step (FORMATS.md 3.3). null when the pack has no extra.service or the day has no demand. */
export function serviceDay(d: CafeDay): ServiceDay | null {
  const cfg = serviceCfg(d.pack);
  if (!cfg || d.demand == null || !isNum(d.demand)) return null;
  return serviceDayWith(cfg, {
    demand: d.demand, hoursShare: lostToHours(d), guests: guestsOf(d), power: powerOf(d, cfg), seatsOwned: d.b.size, place: d.place,
  });
}

/** The same day from explicit inputs. */
export function serviceDayWith(cfg: ServiceCfg, inp: ServiceInputs): ServiceDay {
  const wanted = Math.max(0, inp.demand);
  const dem = wanted * (1 - Math.min(1, Math.max(0, inp.hoursShare)));
  const { groups } = inp.guests;
  const sp = inp.power;

  const fit = seatsThatFit(inp.place, cfg);
  const seats = Math.max(0, Math.min(inp.seatsOwned, fit));
  const avail = seats * cfg.seatFill;
  const morning = groups.reduce((a, g) => a + g.share * g.morningShare, 0);
  const sit = groups.reduce((a, g) => a + g.share * g.sitShare, 0);
  const seatHours = groups.reduce((a, g) => a + g.share * g.sitShare * g.dwellHours, 0) * cfg.seatPeakHourShare;  // per order

  // Work per order: a seated order costs sitInLaborMult takeaway orders, but only guests who find a seat sit.
  const present0 = dem * seatHours;
  const seatRoom = present0 > 0 ? Math.min(1, avail / present0) : 1;
  const labor = 1 + sit * seatRoom * (cfg.sitInLaborMult - 1);
  const cap = Math.max(0, Math.min(cfg.machineOrdersPerHour, sp.rushOrdersPerHour)) / labor;

  // 1. The morning rush, hour by hour. Who stays in line is served later; who sees a long line walks on.
  const rushOrders = dem * morning;
  let carry = 0, walked = 0, line = 0, peakHour = cfg.rushHours[0];
  cfg.rushHourWeights.forEach((w, i) => {
    const a = rushOrders * w;
    const over = carry + a - cap;
    const lineNow = carry + Math.max(0, (a / cfg.peak15Factor - cap) / 4);  // people in line in the busiest quarter-hour
    const gone = Math.min(a, walkAway(lineNow, cfg.walkAwayByLine) * a * (over > 0 ? 1 : 1 / (4 * cfg.peak15Factor)));
    walked += gone;
    carry = Math.max(0, carry + a - gone - cap);
    if (lineNow > line) { line = lineNow; peakHour = cfg.rushHours[i]; }
  });
  const afterQueue = dem - walked;

  // 2. Seats: only for those who sit, judged at the busiest hour.
  const seatWanted = afterQueue * sit;
  const present = afterQueue * seatHours;
  let unseated = 0;
  if (present > avail && seatWanted > 0) {
    unseated = Math.min(seatWanted, seatWanted * cfg.seatPeakHourShare * (1 - avail / present) * cfg.seatBusyHours);
  }
  const tookAway = unseated * cfg.noSeatTakesAway;
  const left = unseated - tookAway;
  const seated = seatWanted - unseated;
  const afterSeats = afterQueue - left;

  // 3. The day's labor: a seated order is more work than a takeaway one.
  const work = (afterSeats - seated) + seated * cfg.sitInLaborMult;
  const lostLabor = work > sp.ordersPerDay && work > 0 ? afterSeats * (1 - sp.ordersPerDay / work) : 0;
  const served = Math.max(0, afterSeats - lostLabor);

  const lost = { hours: wanted - dem, queue: walked, seats: left, labor: lostLabor };
  const top = Math.max(lost.hours, lost.queue, lost.seats, lost.labor);
  const bound: ServiceDay['bound'] = top <= 0.5 ? 'none'
    : top === lost.labor ? 'labor' : top === lost.queue ? 'rush' : top === lost.seats ? 'seats' : 'hours';
  const teamPerDay = sp.ordersPerDay / labor;
  return {
    wanted, demand: dem, served, lost, labor, teamPerDay, bound,
    spare: Math.max(0, teamPerDay - served),
    rush: {
      orders: rushOrders, capPerHour: cap, line, waitMin: cap > 0 ? (60 * line) / cap : 0, walked,
      servedShare: rushOrders > 0 ? 1 - walked / rushOrders : 1, peakHour,
    },
    seats: {
      count: seats, fit, wanted: seatWanted, seated, tookAway, left,
      turns: seats > 0 ? seated / seats : 0,
      peakUse: seats > 0 ? Math.min(present, avail) / seats : 0,
      crowded: seats > 0 && present / seats > cfg.crowdAbove,
    },
  };
}

// ───────────── what the owner sees ─────────────

const whole = (x: number): number => Math.round(x);
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const clock = (h: number): string => (h === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 pm' : `${h - 12} pm`);

/** One sentence per cause of lost orders, the biggest first; plus the floor that has no room for the seats. */
export function serviceNotes(s: ServiceDay, size?: number, sqft?: number): string[] {
  const out: { n: number; text: string }[] = [];
  const walked = whole(s.rush.walked);
  if (walked > 0) {
    out.push({ n: s.rush.walked, text: `Morning rush: ${whole(s.rush.line)} in line at ${clock(s.rush.peakHour)}, ${whole(s.rush.waitMin)}-minute wait, ${walked} walked on` });
  }
  const labor = whole(s.lost.labor);
  if (labor > 0) {
    out.push({ n: s.lost.labor, text: `Out of hands: ${plural(labor, 'order', 'orders')} not made today — the team makes ${whole(s.teamPerDay)} a day` });
  }
  const left = whole(s.seats.left);
  if (left > 0) {
    out.push({ n: s.seats.left, text: `No free seat: ${plural(left, 'guest', 'guests')} left, ${whole(s.seats.tookAway)} took it to go` });
  }
  const hours = whole(s.lost.hours);
  if (hours > 0) {
    out.push({ n: s.lost.hours, text: `Nobody on the floor for part of the day: ${plural(hours, 'order', 'orders')} missed` });
  }
  const notes = out.sort((a, b) => b.n - a.n).map((o) => o.text);
  if (size != null && Number.isFinite(s.seats.fit) && size > s.seats.fit) {
    const where = sqft != null ? `in ${Math.round(sqft)} sq ft` : 'on this floor';
    notes.push(`Only ${plural(s.seats.fit, 'seat fits', 'seats fit')} ${where}: ${size - s.seats.fit} of your ${size} seats have no floor`);
  }
  return notes;
}

/** Recompute the day from its report: parts keep no state (FORMATS.md 3.4). */
function dayFromReport(b: BusinessState, r: DayReport, pack: Pack, place?: Place): ServiceDay | null {
  if (b.status === 'closed' || r.demandUnits <= 0) return null;
  return serviceDay({ b, pack, place, date: dateOf(r.day), day: r.day, demand: r.demandUnits });
}

/** Key numbers of the last day: rush served, the bar's speed in the rush, seat turns, seats in use at the busiest hour. */
export function serviceKpis(b: BusinessState, pack: Pack): NicheKpi[] {
  const r = b.days[b.days.length - 1];
  const s = r ? dayFromReport(b, r, pack) : null;
  if (!s) return [];
  const k: NicheKpi[] = [
    { id: 'rush_served', label: 'Rush served', value: Math.round(s.rush.servedShare * 100), unit: '%' },
    { id: 'bar_rush_per_hour', label: 'Bar in the rush', value: whole(s.rush.capPerHour), unit: 'orders an hour' },
  ];
  if (s.seats.count > 0) {
    k.push(
      { id: 'seat_turns', label: 'Seat turns', value: Math.round(s.seats.turns * 10) / 10, unit: 'a day' },
      { id: 'seats_peak_use', label: 'Seats in use at the busiest hour', value: Math.round(s.seats.peakUse * 100), unit: '%' },
    );
  }
  return k;
}

/** The owner's sentences for one day report: why orders were lost today. */
export function serviceDayNotes(b: BusinessState, r: DayReport, pack: Pack, env?: NicheEnv): string[] {
  const s = dayFromReport(b, r, pack, env?.place);
  return s ? serviceNotes(s, b.size, env?.place?.sqft) : [];
}

/**
 * The part the cafe glue reads. kpis and notes are not in it yet: today the engine treats the mere presence of a
 * niche's notes hook as "the niche explains its limits" (economy/day.ts, nicheExplainsCapacity) and a kpis hook as
 * "replace the default key numbers" (analytics/analyze.ts), even on days and packs where this part has nothing to say.
 * Once the lead changes those two places (agents/r3-B01.md, requests 1 and 2), add `kpis: serviceKpis,
 * notes: serviceDayNotes` here.
 */
export const part: CafePart = {
  capacityDay(d) {
    const s = serviceDay(d);
    if (!s) return null;
    // Someone lost today: the day is full. Nobody lost: the team could make more, which a crowded neighbour can use.
    const anyLost = s.lost.hours + s.lost.queue + s.lost.seats + s.lost.labor > 1e-9;
    return anyLost ? s.served : s.served + s.spare;
  },
  qualityDelta(d) {
    const cfg = serviceCfg(d.pack);
    const s = cfg ? serviceDay(d) : null;
    return s && cfg && s.seats.crowded ? -cfg.crowdQualityDrop : 0;
  },
};
