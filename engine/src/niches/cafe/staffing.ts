// Cafe model, part "staffing": roles and skill, cover of opening hours (build/FORMATS.md section 4, task B03).
// Closes hole 2 of the round-3 audit: a shift lead cost more than a barista and gave the same. Now each role has its
// own speed and quality, a team of three or more without a lead works slower, a new barista learns faster next to a
// lead, and the paid hours must cover the open hours.
// Pure: every number comes from pack.extra.staffing; without that section the part changes nothing in the game.
import type { BusinessState, DayReport, NicheKpi, Pack, PackStaffRole } from '@ohh/shared';
import { RULES } from '@ohh/shared';
import { defaultLeverOption, leverEffects } from '../../economy/effects';
import { defaultStaffPower, type CafeDay, type CafePart, type StaffPower } from './contract';
import { part as servicePart } from './service';

// ───────────── pack section ─────────────

export interface RoleCfg { speed: number; quality: number; lead?: boolean; trainee?: boolean; speedWithLead?: number }
export interface NewRoleCfg { id: string; name?: string; hourlyWage: number; hoursPerMonth: number }
export interface StaffingCfg {
  /** A role missing here works as a trained barista: { speed: 1, quality: 0 }. */
  roles: Record<string, RoleCfg>;
  /** Takeaway orders one trained barista makes in one paid hour, averaged over the month. */
  ordersPerPaidHour: number;
  /** Orders one person at the bar makes in one hour of the morning rush. */
  rushOrdersPerPersonHour: number;
  /** People at the bar in the rush = rushCrewOwner + rushCrewShare × workers. */
  rushCrewOwner: number;
  rushCrewShare: number;
  /** From this many workers a team without a lead pays noLead. */
  leadNeededFrom: number;
  withLead: { quality: number };
  noLead: { speedMult: number; quality: number };
  /** People who must be on the floor every open hour. */
  minOnFloor: number;
  /** Open hours a day by option of the lever `hours`. */
  openHoursPerDay: Record<string, number>;
  /** Paid hours a month that a lever option brings with it: leverPaidHours[leverId][optionId]. */
  leverPaidHours?: Record<string, Record<string, number>>;
  /** Hours a month the owner (or a hired manager) stands on the floor. */
  ownerHoursPerMonth: number;
  /** Share of an average hour's customers who come in the hours cut from the end of the day. */
  uncoveredHourWeight: number;
  /** Speed of the bar by lever option: leverSpeed[leverId][optionId]. */
  leverSpeed?: Record<string, Record<string, number>>;
  /** Roles the pack does not have yet (hours and wage are read from here until the integrator adds them to pack.staff). */
  newRoles?: NewRoleCfg[];
}

const HOURS_LEVER = 'hours';
const fin = (x: unknown, fallback: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : fallback);
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** The pack's `extra.staffing`, or null when the pack has none (then the part changes nothing). */
export function staffingCfg(pack: Pack): StaffingCfg | null {
  const cfg = (pack.extra as { staffing?: StaffingCfg } | undefined)?.staffing;
  return cfg && typeof cfg === 'object' && cfg.roles && typeof cfg.roles === 'object' ? cfg : null;
}

/** Hours and wage of a role: the pack's staff list first, then the section's new roles, then a plain barista. */
function roleDef(id: string, pack: Pack, cfg: StaffingCfg): { hoursPerMonth: number; hourlyWage: number; name: string } {
  const r: PackStaffRole | NewRoleCfg | undefined = pack.staff.find((s) => s.id === id) ?? cfg.newRoles?.find((s) => s.id === id);
  const base = pack.staff[0];
  return {
    hoursPerMonth: fin(r?.hoursPerMonth, fin(base?.hoursPerMonth, fin(cfg.ownerHoursPerMonth, 160))),
    hourlyWage: fin(r?.hourlyWage, fin(base?.hourlyWage, 0)),
    name: r?.name ?? id,
  };
}

const roleCfg = (id: string, cfg: StaffingCfg): RoleCfg => cfg.roles[id] ?? { speed: 1, quality: 0 };
const count = (n: unknown): number => Math.max(0, Math.floor(fin(n, 0)));
const optionOf = (b: BusinessState, pack: Pack, leverId: string): string | undefined =>
  b.orders.levers[leverId] ?? defaultLeverOption(pack.levers.find((l) => l.id === leverId)?.options ?? [])?.id;

// ───────────── the team ─────────────

export interface TeamPower extends StaffPower {
  heads: number;
  hasLead: boolean;
  /** Three or more people and nobody to run the shift. */
  noLead: boolean;
  /** Mean speed of a worker against a trained barista. */
  avgSpeed: number;
  /** Trainees on the team and the speed they work at today. */
  trainees: number;
  traineeSpeed: number | null;
  /** Wages a month without payroll taxes. */
  wagesMonth: number;
}

/** Speed and quality of a team (any staff map, so a screen can price a change before it is made). */
export function teamPower(staff: Record<string, number>, b: BusinessState, pack: Pack, cfg: StaffingCfg): TeamPower {
  const entries = Object.entries(staff).map(([id, n]) => [id, count(n)] as const).filter(([, n]) => n > 0);
  const heads = entries.reduce((s, [, n]) => s + n, 0);
  const wagesMonth = entries.reduce((s, [id, n]) => { const r = roleDef(id, pack, cfg); return s + n * r.hourlyWage * r.hoursPerMonth; }, 0);
  if (heads === 0) {
    return { ordersPerDay: 0, rushOrdersPerHour: 0, qualityDelta: 0, heads: 0, hasLead: false, noLead: false, avgSpeed: 0, trainees: 0, traineeSpeed: null, wagesMonth };
  }
  const hasLead = entries.some(([id]) => roleCfg(id, cfg).lead === true);
  const noLead = !hasLead && heads >= fin(cfg.leadNeededFrom, Infinity);
  const team = noLead ? fin(cfg.noLead?.speedMult, 1) : 1;
  let hourSpeed = 0, speedSum = 0, quality = 0, trainees = 0;
  let traineeSpeed: number | null = null;
  for (const [id, n] of entries) {
    const rc = roleCfg(id, cfg);
    const speed = rc.trainee && hasLead ? fin(rc.speedWithLead, fin(rc.speed, 1)) : fin(rc.speed, 1);
    if (rc.trainee) { trainees += n; traineeSpeed = speed; }
    hourSpeed += n * roleDef(id, pack, cfg).hoursPerMonth * speed;
    speedSum += n * speed;
    quality += n * fin(rc.quality, 0);
  }
  let lev = leverEffects({ ...b, orders: { ...b.orders, staff } }, pack).capacityMult;
  for (const [leverId, byOption] of Object.entries(cfg.leverSpeed ?? {})) {
    const opt = optionOf(b, pack, leverId);
    if (opt) lev *= fin(byOption[opt], 1);
  }
  const crew = fin(cfg.rushCrewOwner, 0) + fin(cfg.rushCrewShare, 1) * heads;
  return {
    ordersPerDay: (hourSpeed * fin(cfg.ordersPerPaidHour, 0) * team * lev) / RULES.DAYS_PER_MONTH,
    rushOrdersPerHour: fin(cfg.rushOrdersPerPersonHour, 0) * crew * (speedSum / heads) * team * lev,
    qualityDelta: quality / heads + (hasLead && heads >= 2 ? fin(cfg.withLead?.quality, 0) : 0) + (noLead ? fin(cfg.noLead?.quality, 0) : 0),
    heads, hasLead, noLead, avgSpeed: speedSum / heads, trainees, traineeSpeed, wagesMonth,
  };
}

/** How fast and how well today's team works. service.ts reads this; keep the name and the signature. */
export function staffPower(d: CafeDay): StaffPower {
  const cfg = staffingCfg(d.pack);
  if (!cfg) return defaultStaffPower(d.b, d.pack);
  const t = teamPower(d.b.orders.staff, d.b, d.pack, cfg);
  return { ordersPerDay: t.ordersPerDay, rushOrdersPerHour: t.rushOrdersPerHour, qualityDelta: t.qualityDelta };
}

// ───────────── cover of the open hours ─────────────

export interface TeamCoverage {
  openHours: number;      // open hours a day
  neededHours: number;    // floor hours a month: open × minOnFloor × 30
  paidHours: number;      // owner + lever + every worker's hours
  coveredShare: number;   // 0–1
  /** Share of the day's customers who find the door closed or the floor without a full crew. */
  lostDemandShare: number;
  /** Open hours a day without a full crew. */
  darkHours: number;
}

const FULL_COVER = (open: number): TeamCoverage => ({ openHours: open, neededHours: 0, paidHours: 0, coveredShare: 1, lostDemandShare: 0, darkHours: 0 });

/** Paid hours of a team against the hours the door is open. */
export function coverageOf(staff: Record<string, number>, b: BusinessState, pack: Pack, cfg: StaffingCfg): TeamCoverage {
  const hoursOpt = optionOf(b, pack, HOURS_LEVER) ?? 'standard';
  const open = fin(cfg.openHoursPerDay?.[hoursOpt], fin(cfg.openHoursPerDay?.standard, 12));
  const onFloor = Math.max(1, fin(cfg.minOnFloor, 1));
  const neededHours = open * onFloor * RULES.DAYS_PER_MONTH;
  if (neededHours <= 0) return FULL_COVER(open);
  let paidHours = fin(cfg.ownerHoursPerMonth, 0);
  for (const [leverId, byOption] of Object.entries(cfg.leverPaidHours ?? {})) {
    const opt = optionOf(b, pack, leverId);
    if (opt) paidHours += fin(byOption[opt], 0);
  }
  for (const [id, n] of Object.entries(staff)) paidHours += count(n) * roleDef(id, pack, cfg).hoursPerMonth;
  const coveredShare = clamp(paidHours / neededHours, 0, 1);
  return {
    openHours: open, neededHours, paidHours, coveredShare,
    lostDemandShare: clamp((1 - coveredShare) * fin(cfg.uncoveredHourWeight, 1), 0, 1),
    darkHours: ((1 - coveredShare) * neededHours) / RULES.DAYS_PER_MONTH / onFloor,
  };
}

/** Open hours against people's hours. service.ts calls this to cut the day before it counts the rush and the seats. */
export function coverage(d: CafeDay): TeamCoverage {
  const cfg = staffingCfg(d.pack);
  if (!cfg) return FULL_COVER(0);
  return coverageOf(d.b.orders.staff, d.b, d.pack, cfg);
}

// ───────────── what a change of team would do ─────────────

export interface TeamChange {
  from: string; to: string;
  ordersPerDay: number;     // change in orders the team can make a day (in the units capacityDay uses)
  qualityDelta: number;     // change in the quality target
  wagesMonth: number;       // change in wages a month, without payroll taxes
}

/** Swap one worker of role `from` for one of role `to` (or hire `to` when `from` is null). Null when it cannot be priced. */
export function teamChange(b: BusinessState, pack: Pack, from: string | null, to: string): TeamChange | null {
  const cfg = staffingCfg(pack);
  if (!cfg) return null;
  const staff = { ...b.orders.staff };
  if (from !== null) {
    if (count(staff[from]) < 1) return null;
    staff[from] = count(staff[from]) - 1;
  }
  staff[to] = count(staff[to]) + 1;
  const was = teamPower(b.orders.staff, b, pack, cfg), now = teamPower(staff, b, pack, cfg);
  const unit = ordersUnit(pack, cfg);
  const k = Number.isFinite(unit) ? unit : 1;
  return { from: from ?? '', to, ordersPerDay: (now.ordersPerDay - was.ordersPerDay) * k, qualityDelta: now.qualityDelta - was.qualityDelta, wagesMonth: now.wagesMonth - was.wagesMonth };
}

// ───────────── the day ─────────────

/** True when the service part sets the day's capacity (it then counts labor, the rush and the seats itself). */
function serviceAnswers(pack: Pack): boolean {
  return typeof servicePart?.capacityDay === 'function' && !!(pack.extra as { service?: unknown } | undefined)?.service;
}

/**
 * Orders capacityDay speaks in. With the service part: takeaway orders (service converts seated work itself).
 * Alone: the engine's mixed orders, so a team of trained baristas without a lead-free penalty keeps the pack's
 * unitsPerStaffMonth exactly: 1,700 / (160 h × 14.0) = 0.759 of a takeaway order.
 */
function ordersUnit(pack: Pack, cfg: StaffingCfg): number {
  if (serviceAnswers(pack)) return 1;
  const per = pack.capacity.unitsPerStaffMonth;
  const refHours = fin(pack.staff[0]?.hoursPerMonth, 0);
  const perHour = fin(cfg.ordersPerPaidHour, 0);
  return per == null ? Infinity : refHours > 0 && perHour > 0 ? per / (refHours * perHour) : 1;
}

/** The engine's room limit, kept while the service part does not answer (it is the one that fixes it). */
function roomCap(b: BusinessState, pack: Pack): number {
  const takeaway = clamp(fin(pack.sizing.takeawayShare, 0), 0, 0.95);
  return (Math.max(0, b.size) * fin(pack.sizing.unitsServedPerSizeMonth, Infinity)) / RULES.DAYS_PER_MONTH / (1 - takeaway);
}

/** Orders the team can make today in the units the engine counts (see ordersUnit). */
function teamOrdersDay(b: BusinessState, pack: Pack, cfg: StaffingCfg): number {
  const k = ordersUnit(pack, cfg);
  const t = teamPower(b.orders.staff, b, pack, cfg);
  return k === Infinity ? Infinity : t.ordersPerDay * k;
}

function capacityDay(d: CafeDay): number | null {
  const cfg = staffingCfg(d.pack);
  if (!cfg) return null;
  const cov = coverageOf(d.b.orders.staff, d.b, d.pack, cfg);
  const open = d.demand == null ? Infinity : Math.max(0, d.demand) * (1 - cov.lostDemandShare);
  // with the service part: it calls coverage() itself, so this answer only repeats the cut for closed hours
  if (serviceAnswers(d.pack)) return cov.coveredShare < 1 && Number.isFinite(open) ? open : null;
  // alone: this part replaces the engine's people limit, so it answers every day and keeps the engine's room limit
  return Math.min(open, teamOrdersDay(d.b, d.pack, cfg), roomCap(d.b, d.pack));
}

function qualityDelta(d: CafeDay): number {
  return staffingCfg(d.pack) ? staffPower(d).qualityDelta : 0;
}

// ───────────── what the owner sees ─────────────

const usd = (x: number): string => `$${Math.round(Math.abs(x)).toLocaleString('en-US')}`;
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const round1 = (x: number): number => Math.round(x * 10) / 10;

/** The role a lead promotion would come from: the most numerous plain role (not a lead, not a trainee). */
function plainRole(b: BusinessState, cfg: StaffingCfg): string | null {
  let best: string | null = null;
  for (const [id, n] of Object.entries(b.orders.staff)) {
    const rc = roleCfg(id, cfg);
    if (count(n) > 0 && !rc.lead && !rc.trainee && (best === null || count(n) > count(b.orders.staff[best]))) best = id;
  }
  return best;
}
const leadRole = (pack: Pack, cfg: StaffingCfg): string | null => pack.staff.find((s) => roleCfg(s.id, cfg).lead)?.id ?? null;

/**
 * The team's numbers for the owner. Not wired into the part yet: the engine's analytics show the niche hook's KPIs
 * instead of its defaults (average check, orders a day, sales per labor hour), so any answer here would hide those.
 * Ready for the lead to join to the defaults (agents/r3-B03.md, request 1); screens may call it directly.
 */
export function teamKpis(b: BusinessState, pack: Pack): NicheKpi[] {
  const cfg = staffingCfg(pack);
  if (!cfg) return [];
  const t = teamPower(b.orders.staff, b, pack, cfg);
  const cov = coverageOf(b.orders.staff, b, pack, cfg);
  const withService = serviceAnswers(pack);
  const out: NicheKpi[] = [
    { id: 'team_orders_day', label: withService ? 'Team can make (to-go orders)' : 'Team can make', value: Math.round(teamOrdersDay(b, pack, cfg)), unit: 'orders a day' },
    { id: 'open_hours_covered', label: 'Open hours covered', value: Math.round(cov.coveredShare * 1000) / 10, unit: '%' },
    { id: 'team_quality', label: 'Team adds to quality', value: Math.round(t.qualityDelta * 1000) / 10, unit: 'points' },
  ];
  if (withService) out.splice(1, 0, { id: 'rush_bar', label: 'Bar in the rush', value: Math.round(t.rushOrdersPerHour), unit: 'orders an hour' });
  return out;
}

function notes(b: BusinessState, r: DayReport, pack: Pack): string[] {
  const cfg = staffingCfg(pack);
  const withService = serviceAnswers(pack);
  const lostSize = Math.round(r.lost.size), lostStaff = Math.round(r.lost.staff);
  if (!cfg) {
    // the engine stays quiet about its own limits when the cafe has capacity and notes hooks; with neither this
    // section nor the service part answering, its limits applied today, so say what it would have said
    if (withService) return [];
    const out: string[] = [];
    if (lostSize > 0) out.push(`Line out the door: ${lostSize} customers walked away`);
    if (lostStaff > 0) out.push(`Short-staffed: ${lostStaff} customers left unserved`);
    return out;
  }
  const out: string[] = [];
  const t = teamPower(b.orders.staff, b, pack, cfg);
  const cov = coverageOf(b.orders.staff, b, pack, cfg);
  const darkToday = Math.min(lostStaff, Math.round(r.demandUnits * cov.lostDemandShare));

  // 1. what was lost today and why: closed hours first, then hands, then seats (seats only while service is silent)
  if (cov.coveredShare < 1) {
    const hire = pack.staff[0] ? roleDef(pack.staff[0].id, pack, cfg) : null;
    const fix = hire ? ` One more ${pack.staff[0].name.toLowerCase()} costs ${usd(hire.hourlyWage * hire.hoursPerMonth)} a month` : '';
    out.push(`Not enough people for ${cov.openHours} open hours: about ${round1(cov.darkHours)} hours a day run without a full crew, `
      + `${Math.round(cov.lostDemandShare * 100)}% of customers find the door closed${darkToday > 0 ? ` (${darkToday} today)` : ''}.${fix}`);
  }
  if (!withService) {
    const hands = lostStaff - darkToday;
    if (hands > 0) out.push(`Short-staffed: ${hands} customers left unserved — the team makes ${Math.round(teamOrdersDay(b, pack, cfg))} orders a day`);
    if (lostSize > 0) out.push(`Line out the door: ${lostSize} customers walked away`);
  }

  // 2. the decision waiting on the team: a lead, a trainee's speed
  if (t.noLead) {
    const from = plainRole(b, cfg), to = leadRole(pack, cfg);
    const swap = from && to ? teamChange(b, pack, from, to) : null;
    const offer = swap && swap.ordersPerDay > 0
      ? ` Make one of them a shift lead: +${Math.round(swap.ordersPerDay)} orders a day and better coffee for ${usd(swap.wagesMonth)} more a month`
      : '';
    out.push(`No shift lead on a team of ${t.heads}: the bar is ${Math.round((1 - fin(cfg.noLead.speedMult, 1)) * 100)}% slower and quality slips.${offer}`);
  }
  if (t.trainees > 0 && t.traineeSpeed !== null) {
    const who = t.trainees === 1 ? 'New barista works' : `${t.trainees} new baristas work`;
    const pctSpeed = Math.round(t.traineeSpeed * 100);
    if (t.hasLead) out.push(`${who} at ${pctSpeed}% speed while the shift lead trains them`);
    else {
      const withLead = Object.values(cfg.roles).find((rc) => rc.trainee)?.speedWithLead;
      out.push(`${who} at ${pctSpeed}% speed: nobody on the team can train them${withLead ? ` — next to a shift lead they would work at ${Math.round(withLead * 100)}%` : ''}`);
    }
  }
  return out;
}

export const part: CafePart = { capacityDay, qualityDelta, notes };
