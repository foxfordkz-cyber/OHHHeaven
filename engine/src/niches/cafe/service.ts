// Cafe model, part "service": seats and takeaway, the morning rush, the queue (build/FORMATS.md, section 3; task B01).
// Seats limit only the guests who sit down; takeaway is limited by the team's speed; in the morning rush the guests
// who see a long line walk on. All numbers come from pack.extra.service; without it this part changes nothing.
// Pure: no state between calls, no clock, no randomness. Shares of guests are shares of the flow, not chances.
import type { BusinessState, DayReport, NicheKpi, Pack, Place } from '@ohh/shared';
import { dateOf } from '@ohh/shared';
import type { CafeDay, CafePart, GuestGroup, StaffPower } from './contract';
import { guestMix } from './segments';
import * as staffingPart from './staffing';

// ───────────── pack section ─────────────

export interface WalkAwayPoint { line: number; share: number }

/** pack.extra.service (packs/parts/cafe/B01-service.json; numbers and sources: build/FORMATS.md, table 3.2). */
export interface ServiceCfg {
  rushHours: number[];             // clock hours of the morning rush, e.g. [7, 8, 9]
  rushHourWeights: number[];       // share of the rush in each of those hours, sum 1
  peak15Factor: number;            // share of an hour's orders that the busiest quarter-hour would carry ×4
  machineOrdersPerHour: number;    // ceiling of the espresso machine, orders an hour
  walkAwayByLine: WalkAwayPoint[]; // share of arriving guests who walk on at this many people in line
  seatPeakHourShare: number;       // share of the day's seated guests who arrive in the busiest hour
  seatFill: number;                // share of seats that can be filled at once
  seatBusyHours: number;           // hours a day a full room stays full
  noSeatTakesAway: number;         // of the guests who find no seat, share who take the order to go
  sitInLaborMult: number;          // work for a seated order against a to-go order
  fixedCoreSqft: number;           // bar, line, restroom, back of house
  sqftPerSeat: number;
  crowdAbove: number;              // seats in use at the busiest hour above this share read as packed
  crowdQualityDrop: number;
  /** Fallbacks while segments.ts gives the plain one-group mix (morningShare 0, no dwell time). */
  defaultMorningShare?: number;
  defaultDwellHours?: number;
  /**
   * The engine still judges "packed" by its old room limit (served ÷ size × 170 / 30 / 0.4), so a to-go counter with
   * 8 seats and 250 orders is always "packed" and loses 0.08 quality. While true, this part gives those 0.08 back
   * on days its own seat count says the room is not packed. Turn off when day.ts reads seat use from the part.
   */
  offsetEngineCrowd?: boolean;
}

export function serviceCfg(pack: Pack): ServiceCfg | null {
  const cfg = (pack.extra as { service?: ServiceCfg } | undefined)?.service;
  if (!cfg || !Array.isArray(cfg.rushHourWeights) || !Array.isArray(cfg.walkAwayByLine) || !cfg.walkAwayByLine.length) return null;
  return cfg;
}

// ───────────── what the part reads from the other parts ─────────────

export interface Group extends GuestGroup { dwellHours: number }
interface SegmentCfg { id: string; dwellHours?: number }

/** Today's guest groups with the hours a seated guest stays. dwellHours: from segments.ts if it gives one, else the pack. */
function groupsOf(d: CafeDay, cfg: ServiceCfg): Group[] {
  const segs = (d.pack.extra as { guestSegments?: { segments?: SegmentCfg[] } } | undefined)?.guestSegments?.segments ?? [];
  const mix = guestMix(d).groups;
  const plain = mix.every((g) => !(g.morningShare > 0));
  return mix.map((g) => {
    const own = (g as GuestGroup & { dwellHours?: number }).dwellHours;
    const dwell = own ?? segs.find((s) => s.id === g.id)?.dwellHours ?? cfg.defaultDwellHours ?? 0.85;
    const morningShare = plain ? (cfg.defaultMorningShare ?? 0) : g.morningShare;
    return { ...g, morningShare, dwellHours: Math.max(0, dwell) };
  });
}

type Coverage = (d: CafeDay) => { lostDemandShare: number };
/** Share of demand lost to opening hours nobody covers. staffing.ts exports coverage(d) once B03 is in; until then 0. */
function hoursLostShare(d: CafeDay): number {
  const cov = (staffingPart as unknown as { coverage?: Coverage }).coverage;
  if (typeof cov !== 'function') return 0;
  const s = cov(d)?.lostDemandShare;
  return typeof s === 'number' && Number.isFinite(s) ? Math.min(1, Math.max(0, s)) : 0;
}

function teamOf(d: CafeDay): StaffPower {
  return staffingPart.staffPower(d);
}

// ───────────── the day ─────────────

export type ServiceBound = 'none' | 'hours' | 'rush' | 'seats' | 'labor';

export interface ServiceDay {
  demand: number;          // orders that want to be served, after hours nobody covers
  served: number;
  rush: { orders: number; capPerHour: number; line: number; lineHour: number; waitMin: number; walked: number; servedShare: number };
  seats: { count: number; fit: number; wanted: number; seated: number; tookAway: number; left: number; turns: number; peakUse: number; crowded: boolean };
  lost: { hours: number; queue: number; seats: number; labor: number };
  labor: number;           // work per order against a to-go order
  teamPerDay: number;      // orders the team can make today
  spare: number;           // orders the team could still make today
  bound: ServiceBound;
}

const sum = (xs: number[]): number => xs.reduce((a, x) => a + x, 0);

/** Seats that fit: bar, line, restroom and back of house take fixedCoreSqft. Without a place, every seat fits. */
export function seatsThatFit(place: Place | undefined, cfg: ServiceCfg, size = Infinity): number {
  if (!place || !(place.sqft > 0)) return size;
  return Math.max(0, Math.floor((place.sqft - cfg.fixedCoreSqft) / cfg.sqftPerSeat));
}

/** Share of arriving guests who walk on at this many people in line: straight lines between the pack's points. */
export function walkAway(line: number, pts: readonly WalkAwayPoint[]): number {
  if (!pts.length) return 0;
  if (line <= pts[0].line) return pts[0].share;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], z = pts[i];
    if (line <= z.line) return a.share + ((z.share - a.share) * (line - a.line)) / (z.line - a.line);
  }
  return pts[pts.length - 1].share;
}

/** What the day is computed from: who comes (segments.ts), how fast the team is (staffing.ts), hours nobody covers. */
export interface ServiceInputs { groups: Group[]; team: StaffPower; hoursLostShare: number }

/** The inputs as the other parts give them today. */
export function serviceInputs(d: CafeDay, cfg: ServiceCfg): ServiceInputs {
  return { groups: groupsOf(d, cfg), team: teamOf(d), hoursLostShare: hoursLostShare(d) };
}

/** The whole day step by step: rush and its line, seats, the day's labor. null — no extra.service in the pack. */
export function serviceDay(d: CafeDay, inputs?: ServiceInputs): ServiceDay | null {
  const cfg = serviceCfg(d.pack);
  if (!cfg) return null;
  return serviceDayWith(d, cfg, inputs ?? serviceInputs(d, cfg));
}

/** The same day from explicit inputs: the pure arithmetic of build/FORMATS.md, section 3.3. */
export function serviceDayWith(d: CafeDay, cfg: ServiceCfg, inputs: ServiceInputs): ServiceDay {
  const want = Math.max(0, d.demand ?? 0);
  const lostHours = want * Math.min(1, Math.max(0, inputs.hoursLostShare));
  const dem = want - lostHours;
  const { groups, team } = inputs;
  const fit = seatsThatFit(d.place, cfg, d.b.size);
  const seats = Math.max(0, Math.min(d.b.size, fit));

  const morning = sum(groups.map((g) => g.share * g.morningShare));
  const sit = sum(groups.map((g) => g.share * g.sitShare));
  const seatHours = sum(groups.map((g) => g.share * g.sitShare * g.dwellHours)) * cfg.seatPeakHourShare; // per order
  const avail = seats * cfg.seatFill;
  const present0 = dem * seatHours;
  const seatRoom = present0 > 0 ? Math.min(1, avail / present0) : 1;
  const labor = 1 + sit * seatRoom * (cfg.sitInLaborMult - 1);
  const cap = Math.min(cfg.machineOrdersPerHour, team.rushOrdersPerHour) / labor;

  // 1. the morning rush, hour by hour; those who stay in line are served later
  const rushOrders = dem * morning;
  let carry = 0, walked = 0, line = 0, lineHour = cfg.rushHours[0] ?? 8;
  cfg.rushHourWeights.forEach((w, i) => {
    const a = rushOrders * w;
    const lineNow = carry + Math.max(0, (a / cfg.peak15Factor - cap) / 4);
    const over = carry + a > cap;
    const gone = Math.min(a, walkAway(lineNow, cfg.walkAwayByLine) * a * (over ? 1 : 1 / (4 * cfg.peak15Factor)));
    walked += gone;
    carry = Math.max(0, carry + a - gone - cap);
    if (lineNow > line) { line = lineNow; lineHour = cfg.rushHours[i] ?? lineHour; }
  });
  const afterQueue = dem - walked;

  // 2. seats: only the guests who sit; what counts is the busiest hour
  const wanted = afterQueue * sit;
  const present = afterQueue * seatHours;
  let unseated = 0;
  if (present > avail && wanted > 0) {
    unseated = avail <= 0 ? wanted : Math.min(wanted, wanted * cfg.seatPeakHourShare * (1 - avail / present) * cfg.seatBusyHours);
  }
  const tookAway = unseated * cfg.noSeatTakesAway;
  const left = unseated - tookAway;
  const seated = wanted - unseated;
  const afterSeats = afterQueue - left;

  // 3. the day's labor: a seated order costs sitInLaborMult times a to-go order
  const work = (afterSeats - seated) + seated * cfg.sitInLaborMult;
  const perDay = Math.max(0, team.ordersPerDay);
  const lostLabor = work > perDay && work > 0 ? afterSeats * (1 - perDay / work) : 0;
  const served = Math.max(0, afterSeats - lostLabor);
  const spareRaw = perDay / labor - served;
  const spare = Number.isFinite(spareRaw) ? Math.max(0, spareRaw) : Math.max(dem, 1);

  const lost = { hours: lostHours, queue: walked, seats: left, labor: lostLabor };
  const top = Math.max(lost.hours, lost.queue, lost.seats, lost.labor);
  const bound: ServiceBound = top < 0.5 ? 'none'
    : top === lost.labor ? 'labor' : top === lost.queue ? 'rush' : top === lost.seats ? 'seats' : 'hours';
  return {
    demand: dem, served, lost, labor, bound, spare,
    teamPerDay: Number.isFinite(perDay) ? perDay / labor : Infinity,
    rush: { orders: rushOrders, capPerHour: cap, line, lineHour, waitMin: cap > 0 ? (60 * line) / cap : 0, walked, servedShare: rushOrders > 0 ? 1 - walked / rushOrders : 1 },
    seats: {
      count: seats, fit: Number.isFinite(fit) ? fit : seats, wanted, seated, tookAway, left,
      turns: seats > 0 ? seated / seats : 0,
      peakUse: seats > 0 ? Math.min(present, avail) / seats : 0,
      crowded: seats > 0 ? present / seats > cfg.crowdAbove : false,
    },
  };
}

/** The engine's old room limit and its "packed" test, to know when it would take 0.08 off for no reason. */
function engineWouldCrowd(b: BusinessState, pack: Pack, served: number): boolean {
  const takeaway = Math.min(0.95, Math.max(0, pack.sizing.takeawayShare ?? 0));
  const sizeCap = (b.size * pack.sizing.unitsServedPerSizeMonth / 30) / (1 - takeaway);
  return sizeCap > 0 && Number.isFinite(sizeCap) && served / sizeCap > (pack.sizing.crowdPenaltyAbove ?? 0.9);
}

// ───────────── what the player sees ─────────────

const r0 = (x: number): number => Math.round(x);
const hourLabel = (h: number): string => (h === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 pm' : `${h - 12} pm`);
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** The same day with one more person of this role: how many more orders it would serve. */
function withOneMore(d: CafeDay, role: string): number {
  const staff = { ...d.b.orders.staff, [role]: (d.b.orders.staff[role] ?? 0) + 1 };
  const b = { ...d.b, orders: { ...d.b.orders, staff } };
  return serviceDay({ ...d, b })?.served ?? 0;
}
/** The same day with more seats (up to what fits): how many more orders it would serve. */
function withSeats(d: CafeDay, size: number): number {
  return serviceDay({ ...d, b: { ...d.b, size } })?.served ?? 0;
}
/** The role a cafe hires most: the one with the most people now, else the first in the pack. */
function mainRole(b: BusinessState, pack: Pack): string {
  const own = Object.entries(b.orders.staff).filter(([, n]) => n > 0).sort((a, z) => z[1] - a[1])[0]?.[0];
  return own ?? pack.staff[0]?.id ?? 'barista';
}

/** Sentences for the day report, the biggest cause first. The first line is the morning's result, every open day. */
export function serviceNotes(d: CafeDay, s: ServiceDay): string[] {
  const out: { size: number; text: string }[] = [];
  const price = d.b.orders.price;
  const money = (orders: number): string => `about $${r0(orders * price).toLocaleString('en-US')} a day`;
  const role = mainRole(d.b, d.pack);
  const roleName = (d.pack.staff.find((x) => x.id === role)?.name ?? role).toLowerCase();

  if (s.rush.orders >= 1) {
    const walked = r0(s.rush.walked);
    const head = `Morning rush: served ${Math.round(s.rush.servedShare * 100)}% of ${r0(s.rush.orders)}`;
    if (walked > 0) {
      const gain = r0(withOneMore(d, role) - s.served);
      const fix = gain > 0 ? ` One more ${roleName} would keep about ${gain} (${money(gain)}).` : ' The bar is at its ceiling: a faster line, not more hands, would help.';
      out.push({ size: s.lost.queue, text: `${head}: ${r0(s.rush.line)} in line at ${hourLabel(s.rush.lineHour)}, ${r0(s.rush.waitMin)}-minute wait, ${walked} walked on.${fix}` });
    } else {
      const wait = r0(s.rush.waitMin);
      out.push({ size: 0.1, text: `${head}, ${wait > 0 ? `longest wait ${wait} min at ${hourLabel(s.rush.lineHour)}` : 'no line'}. The bar makes ${r0(s.rush.capPerHour)} orders an hour.` });
    }
  }
  const labor = r0(s.lost.labor);
  if (labor > 0) {
    const gain = r0(withOneMore(d, role) - s.served);
    out.push({ size: s.lost.labor, text: `Out of hands: ${plural(labor, 'order')} not made today — the team makes ${r0(s.teamPerDay)} a day.${gain > 0 ? ` One more ${roleName}: +${gain} (${money(gain)}).` : ''}` });
  }
  const left = r0(s.lost.seats);
  if (left > 0) {
    const room = s.seats.fit - s.seats.count;
    const more = Math.min(room, Math.max(2, Math.round(s.seats.count * 0.25)));
    const gain = more > 0 ? r0(withSeats(d, s.seats.count + more) - s.served) : 0;
    const fix = gain > 0 ? ` ${more} more seats would keep about ${gain}.` : room <= 0 ? ' The floor is full: these guests are the price of a small room.' : '';
    out.push({ size: s.lost.seats, text: `No free seat: ${plural(left, 'guest')} left, ${r0(s.seats.tookAway)} took it to go.${fix}` });
  }
  if (d.place && s.seats.fit < d.b.size) {
    const none = d.b.size - s.seats.fit;
    out.push({ size: none, text: `Only ${plural(s.seats.fit, 'seat')} fit in ${r0(d.place.sqft)} sq ft: ${none} of your ${d.b.size} seats have no floor.` });
  }
  return out.sort((a, z) => z.size - a.size).map((x) => x.text);
}

/** The engine's own notes on lost guests, said the same way while the pack has no extra.service. */
function engineNotes(r: DayReport): string[] {
  const out: string[] = [];
  if (r.lost.size > 0) out.push(`Line out the door: ${r.lost.size} customers walked away`);
  if (r.lost.staff > 0) out.push(`Short-staffed: ${r.lost.staff} customers left unserved`);
  return out;
}

const dayOf = (b: BusinessState, pack: Pack, r: DayReport, place?: Place): CafeDay =>
  ({ b, pack, place, date: dateOf(r.day), day: r.day, demand: r.demandUnits });

/**
 * Numbers for the business screen. Not wired as part.kpis yet: a niche kpis hook replaces the engine's default numbers
 * (average ticket, sales a day) in analyze(), even when it returns []. Wired once the lead appends niche numbers to
 * the default ones (journal agents/r3-B01.md, request 2).
 */
export function serviceKpis(b: BusinessState, pack: Pack): NicheKpi[] {
  if (!serviceCfg(pack)) return [];
  const days = b.days.filter((r) => r.demandUnits > 0).slice(-7);
  const ss = days.map((r) => serviceDay(dayOf(b, pack, r))).filter((s): s is ServiceDay => !!s);
  if (!ss.length) return [];
  const avg = (f: (s: ServiceDay) => number): number => sum(ss.map(f)) / ss.length;
  const rushOrders = sum(ss.map((s) => s.rush.orders));
  const rushServed = rushOrders > 0 ? 1 - sum(ss.map((s) => s.rush.walked)) / rushOrders : 1;
  const out: NicheKpi[] = [
    { id: 'rush_served', label: 'Rush served', value: Math.round(rushServed * 1000) / 10, unit: '%' },
    { id: 'bar_in_rush', label: 'Bar in the rush', value: r0(avg((s) => s.rush.capPerHour)), unit: 'orders/h' },
  ];
  if (b.size > 0) {
    out.push({ id: 'seat_turns', label: 'Seat turns', value: Math.round(avg((s) => s.seats.turns) * 10) / 10, unit: 'a day' });
    out.push({ id: 'seats_in_use_peak', label: 'Seats in use at the busiest hour', value: Math.round(avg((s) => s.seats.peakUse) * 1000) / 10, unit: '%' });
  }
  return out;
}

export const part: CafePart = {
  capacityDay(d) {
    const s = serviceDay(d);
    if (!s) return null;
    const lostAny = s.lost.queue + s.lost.seats + s.lost.labor + s.lost.hours >= 0.5;
    return lostAny ? s.served : s.served + s.spare;
  },

  qualityDelta(d) {
    const cfg = serviceCfg(d.pack);
    const s = serviceDay(d);
    if (!cfg || !s) return 0;
    if (s.seats.crowded) return engineWouldCrowd(d.b, d.pack, Math.floor(s.served)) ? 0 : -cfg.crowdQualityDrop;
    return cfg.offsetEngineCrowd && engineWouldCrowd(d.b, d.pack, Math.floor(s.served)) ? 0.08 : 0;
  },

  notes(b, r, pack, place?: Place) {
    if (!serviceCfg(pack)) return engineNotes(r);
    if (b.status !== 'open' || r.demandUnits <= 0) return [];
    const d = dayOf(b, pack, r, place);
    const s = serviceDay(d);
    return s ? serviceNotes(d, s) : [];
  },
};
