// Cafe model, part "service": seats and takeaway, the morning rush, the queue (build/FORMATS.md, section 3; task B01).
// Seats limit only the guests who sit; takeaway is limited by how fast the team works; in the morning rush the guests
// who see a long line walk on. Numbers come from packs/cafe.json → extra.service (data: packs/parts/cafe/D20-formats.json).
// Without extra.service in the pack this part answers nothing and the game is unchanged.
// Pure: no network, no files, no Date, no Math.random. Shares of guests who walk away are shares of the flow, not chances.
import type { BusinessState, DayReport, NicheKpi, Pack, Place } from '@ohh/shared';
import { dateOf } from '@ohh/shared';
import type { NicheEnv } from '../index';
import type { CafeDay, CafePart, GuestGroup, StaffPower } from './contract';
import { guestMix } from './segments';
import * as staffingModule from './staffing';
import { staffPower } from './staffing';

// staffing.ts (B03) adds coverage(); until it does, no hours are lost. The type is checked: if coverage arrives with
// another signature, this file stops compiling instead of guessing.
interface StaffingApi { part: CafePart; coverage?(d: CafeDay): { lostDemandShare: number } }
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

/** Hours a seated guest of each group stays, from extra.guestSegments (the data of segments.ts). */
function dwellById(pack: Pack): Map<string, number> {
  const g = (pack.extra as { guestSegments?: { segments?: { id?: unknown; dwellHours?: unknown }[] } } | undefined)?.guestSegments;
  const rows = Array.isArray(g?.segments) ? g!.segments : [];
  return new Map(rows.filter((r) => typeof r?.id === 'string' && isNum(r.dwellHours)).map((r) => [r.id as string, r.dwellHours as number]));
}

/**
 * Hours a guest of a group the pack does not describe (the contract's 'everyone') stays: as long as the pack's own seat
 * turnover implies. A seat holds seatFill guests at the busiest hour, which carries seatPeakHourShare of the day, and
 * turns unitsServedPerSizeMonth / 30 seated orders a day: dwell = seatFill / (seatPeakHourShare × turns). With the cafe
 * pack (170 a month) that is 1.07 hours, and the old seat limit and this part agree for that guest.
 */
function packDwell(pack: Pack, cfg: ServiceCfg): number {
  const turns = pack.sizing.unitsServedPerSizeMonth / 30;
  return turns > 0 ? cfg.seatFill / (cfg.seatPeakHourShare * turns) : 0;
}

// ───────────── today's guests and team ─────────────

export interface Guests { groups: (GuestGroup & { dwellHours: number })[] }

/** Who comes today (segments.guestMix) with how long each group sits. */
function guestsOf(d: CafeDay, cfg: ServiceCfg): Guests {
  const dwell = dwellById(d.pack);
  const fallback = packDwell(d.pack, cfg);
  return { groups: guestMix(d).groups.map((g) => ({ ...g, dwellHours: dwell.get(g.id) ?? fallback })) };
}

/**
 * How fast the team works, in takeaway orders (FORMATS.md 4.3). Without extra.staffing in the pack, staffing.staffPower
 * can only answer the contract's fallback, which counts the pack's orders per worker: those already mix seated and
 * takeaway orders. They are converted with the pack's own takeaway share, the same conversion FORMATS.md 4.2 uses
 * for ordersPerPaidHour; otherwise a team the old engine called enough would lose orders here.
 */
function powerOf(d: CafeDay, cfg: ServiceCfg): StaffPower {
  const sp = staffPower(d);
  if ((d.pack.extra as { staffing?: unknown } | undefined)?.staffing) return sp;
  const sitRef = 1 - Math.min(0.95, Math.max(0, d.pack.sizing.takeawayShare ?? 0));
  return { ...sp, ordersPerDay: sp.ordersPerDay * (1 + sitRef * (cfg.sitInLaborMult - 1)) };
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
  seats: { count: number; fit: number; wanted: number; seated: number; tookAway: number; left: number; turns: number; present: number; peakUse: number; crowded: boolean };
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
    demand: d.demand, hoursShare: lostToHours(d), guests: guestsOf(d, cfg), power: powerOf(d, cfg), seatsOwned: d.b.size, place: d.place,
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
      present,
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

/**
 * How full the room is at the busiest hour: guests who want a seat then, per seat (above 1 — some find none).
 * For the engine's crowded / empty-room judgement when this part sets the day's capacity (agents/r3-B01.md, request 4):
 * today the engine judges it by the old seat limit, which calls every busy counter "packed".
 */
export function seatUseDay(d: CafeDay): number | null {
  const cfg = serviceCfg(d.pack);
  const s = cfg ? serviceDay(d) : null;
  return s && s.seats.count > 0 ? s.seats.present / s.seats.count : null;
}

/** The owner's sentences for one day report: why orders were lost today. */
export function serviceDayNotes(b: BusinessState, r: DayReport, pack: Pack, env?: NicheEnv): string[] {
  const s = dayFromReport(b, r, pack, env?.place);
  return s ? serviceNotes(s, b.size, env?.place?.sqft) : [];
}

/**
 * Without extra.service the engine's own limits applied today, and the engine keeps quiet about them because the cafe
 * has capacity and notes hooks (economy/day.ts, nicheExplainsCapacity). Then someone has to say what it would have
 * said. staffing.ts says it when it has notes (B03 does, in the same words); otherwise this part does, so the owner
 * hears it exactly once.
 */
function engineLimitNotes(r: DayReport): string[] {
  if (typeof staffing.part.notes === 'function') return [];
  const out: string[] = [];
  const size = Math.round(r.lost.size), staff = Math.round(r.lost.staff);
  if (size > 0) out.push(`Line out the door: ${size} customers walked away`);
  if (staff > 0) out.push(`Short-staffed: ${staff} customers left unserved`);
  return out;
}

/**
 * The part the cafe glue reads. kpis are not in it yet: today a niche's kpis hook replaces the default key numbers
 * (analytics/analyze.ts) instead of adding to them, and the average ticket would disappear. Once the lead changes that
 * (agents/r3-B01.md, request 2), add `kpis: serviceKpis` here.
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
  notes(b, r, pack, env?: NicheEnv) {
    return serviceCfg(pack) ? serviceDayNotes(b, r, pack, env) : engineLimitNotes(r);
  },
};
