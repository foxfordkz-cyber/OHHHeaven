// D20 — reference arithmetic for build/FORMATS.md (task A1, round 3). Not engine code: a calculator that
// re-runs every number in the spec from packs/cafe.json, packs/_common.json, data/places.json and D20-formats.json.
// The four mechanics are written here the way the spec asks wave B to write them in engine/src/niches/cafe/*.ts.
// Usage: node packs/parts/cafe/D20-examples.mjs            (prints markdown)
//        node packs/parts/cafe/D20-examples.mjs --json     (prints the table of expectations as JSON)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'));
const pack = read('../../cafe.json');
const common = read('../../_common.json');
const places = read('../../../data/places.json');
const X = read('D20-formats.json').extra;
const G = X.guestSegments, S = X.service, T = X.staffing, R = X.regulars;
const F = pack.extra.footfall;

const D = 30;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const r0 = (x) => Math.round(x);
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const pct = (x) => `${Math.round(x * 100)}%`;
const usd = (x) => (x < 0 ? '−$' : '$') + Math.abs(r0(x)).toLocaleString('en-US');
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

// ───────────────────────── segments ─────────────────────────

const BLOCKS = ['residential', 'office', 'campus', 'tourist'];
const near = (a, reach) => Math.max(0, 1 - a.distM / reach);

export function blockWeights(place) {
  const w = { residential: G.blockRules.residentialBase, office: 0, campus: 0, tourist: 0 };
  const anchors = place?.anchors ?? [];
  const o = G.blockRules.office, c = G.blockRules.campus, t = G.blockRules.tourist;
  for (const a of anchors) {
    if (a.kind === o.anchor) w.office += ((a.ridersPerDay ?? o.ridersRef) / o.ridersRef) * near(a, o.reachM);
    if (a.kind === c.anchor) w.campus = Math.max(w.campus, c.weight * near(a, c.reachM));
    if (typeof t[a.kind] === 'number') w.tourist = Math.max(w.tourist, t[a.kind] * near(a, t.reachM));
  }
  w.office = Math.min(o.maxWeight, w.office);
  const tot = sum(Object.values(w));
  for (const k of BLOCKS) w[k] /= tot;
  return w;
}
export const blockTypeOf = (place) => { const w = blockWeights(place); return BLOCKS.reduce((best, k) => (w[k] > w[best] ? k : best), 'residential'); };

/** Guest groups today: shares add up to 1; `volume` is the day's size against an average day of the year. */
export function guestMixDetailed(place, date) {
  const w = blockWeights(place);
  const rows = G.segments.map((cfg) => {
    const base = sum(BLOCKS.map((k) => w[k] * (G.mixByBlock[k][cfg.id] ?? 0)));
    return { id: cfg.id, cfg, base, raw: base * cfg.week[date.weekday] * cfg.months[date.month - 1] };
  });
  const volume = sum(rows.map((r) => r.raw));
  return { volume, groups: rows.map((r) => ({ id: r.id, cfg: r.cfg, share: r.raw / volume })) };
}

/** Share of customers who walked away or found the door understaffed over the last days (0 when there is no history). */
const walkedShare = (b) => {
  const days = (b.days ?? []).slice(-G.waitWindowDays);
  const dem = sum(days.map((d) => d.demand));
  return dem > 0 ? sum(days.map((d) => d.lostQueue + d.lostLabor)) / dem : 0;
};

export function segmentFit(b, place, date) {
  const { groups } = guestMixDetailed(place, date);
  const lp = Math.log(Math.max(0.01, b.price) / pack.unit.refPrice);
  const seatIdx = clamp((b.size - G.refSeats) / G.seatSpan, -1, 1);
  const walked = walkedShare(b);
  const byGroup = groups.map((g) => {
    const priceShift = g.cfg.priceShift + (g.id === 'residents' ? (G.tierPriceShift[place?.tier] ?? 0) : 0);
    const qualityShift = g.cfg.qualityShift + (g.id === 'residents' ? (G.tierQualityShift[place?.tier] ?? 0) : 0);
    const u = -priceShift * lp + qualityShift * (b.quality - 0.5) + g.cfg.seatPull * seatIdx - g.cfg.waitPull * walked;
    return { id: g.id, share: g.share, fit: Math.exp(u) };
  });
  return { mult: clamp(sum(byGroup.map((g) => g.share * g.fit)), G.multBounds[0], G.multBounds[1]), byGroup };
}

// ───────────────────────── staffing ─────────────────────────

const roleDef = (id) => pack.staff.find((s) => s.id === id) ?? T.newRoles.find((s) => s.id === id);
const heads = (b) => sum(Object.values(b.staff));

export function staffPower(b) {
  const n = heads(b);
  if (n <= 0) return { ordersPerDay: 0, rushOrdersPerHour: 0, qualityDelta: 0, hasLead: false, noLead: false, avgSpeed: 0 };
  const hasLead = Object.entries(b.staff).some(([id, k]) => k > 0 && T.roles[id]?.lead);
  const noLead = !hasLead && n >= T.leadNeededFrom;
  const team = noLead ? T.noLead.speedMult : 1;
  let hoursSpeed = 0, speedSum = 0, q = 0;
  for (const [id, k] of Object.entries(b.staff)) {
    if (k <= 0) continue;
    const cfg = T.roles[id] ?? { speed: 1, quality: 0 };
    const speed = cfg.trainee && hasLead ? (cfg.speedWithLead ?? cfg.speed) : cfg.speed;
    hoursSpeed += k * roleDef(id).hoursPerMonth * speed;
    speedSum += k * speed;
    q += k * cfg.quality;
  }
  const lev = leverCapacity(b);
  const crew = T.rushCrewOwner + T.rushCrewShare * n;
  return {
    ordersPerDay: (hoursSpeed * T.ordersPerPaidHour * team * lev) / D,
    rushOrdersPerHour: T.rushOrdersPerPersonHour * crew * (speedSum / n) * team * lev,
    qualityDelta: q / n + (hasLead && n >= 2 ? T.withLead.quality : 0) + (noLead ? T.noLead.quality : 0),
    hasLead, noLead, avgSpeed: speedSum / n,
  };
}

export function coverage(b) {
  const hoursOpt = b.levers.hours ?? 'standard';
  const open = T.openHoursPerDay[hoursOpt] ?? T.openHoursPerDay.standard;
  const neededHours = open * T.minOnFloor * D;
  let paidHours = T.ownerHoursPerMonth + (T.leverPaidHours.hours?.[hoursOpt] ?? 0);
  for (const [id, k] of Object.entries(b.staff)) if (k > 0) paidHours += k * roleDef(id).hoursPerMonth;
  const coveredShare = Math.min(1, paidHours / neededHours);
  return { neededHours, paidHours, coveredShare, lostDemandShare: (1 - coveredShare) * T.uncoveredHourWeight };
}

// ───────────────────────── service ─────────────────────────

function walkAway(line) {
  const pts = S.walkAwayByLine;
  if (line <= pts[0].line) return pts[0].share;
  for (let i = 1; i < pts.length; i++) {
    if (line <= pts[i].line) { const a = pts[i - 1], z = pts[i]; return a.share + ((z.share - a.share) * (line - a.line)) / (z.line - a.line); }
  }
  return pts[pts.length - 1].share;
}

/** One day: the rush and its line, seats, the day's labor. `demand` is orders that want to be served. */
export function serviceDay(b, place, date, demand) {
  const { groups } = guestMixDetailed(place, date);
  const sp = staffPower(b);
  const morning = sum(groups.map((g) => g.share * g.cfg.morningShare));
  const sit = sum(groups.map((g) => g.share * g.cfg.sitShare));
  const seatRoom = Math.min(1, (b.size * S.seatFill) / Math.max(1e-9, sum(groups.map((g) => demand * g.share * g.cfg.sitShare * g.cfg.dwellHours)) * S.seatPeakHourShare));
  const labor = 1 + sit * seatRoom * (S.sitInLaborMult - 1);           // work per order against a takeaway order; only seated orders cost more
  const cap = Math.min(S.machineOrdersPerHour, sp.rushOrdersPerHour) / labor;

  // 1. the morning rush, hour by hour; those who stay in line are served later
  const rushOrders = demand * morning;
  let carry = 0, walked = 0, line = 0;
  for (const w of S.rushHourWeights) {
    const a = rushOrders * w;
    const over = carry + a - cap;
    const lineNow = carry + Math.max(0, (a / S.peak15Factor - cap) / 4);
    const gone = Math.min(a, walkAway(lineNow) * a * (over > 0 ? 1 : 1 / (4 * S.peak15Factor)));
    walked += gone;
    carry = Math.max(0, carry + a - gone - cap);
    line = Math.max(line, lineNow);
  }
  const afterQueue = demand - walked;

  // 2. seats: only those who sit; seats in use at the busiest hour
  const wanted = afterQueue * sit;
  const present = sum(groups.map((g) => afterQueue * g.share * g.cfg.sitShare * g.cfg.dwellHours)) * S.seatPeakHourShare;
  const avail = b.size * S.seatFill;
  let unseated = 0;
  if (present > avail && wanted > 0) unseated = Math.min(wanted, wanted * S.seatPeakHourShare * (1 - avail / present) * S.seatBusyHours);
  const tookAway = unseated * S.noSeatTakesAway, left = unseated - tookAway;
  const seated = wanted - unseated;
  const afterSeats = afterQueue - left;

  // 3. the day's labor
  const work = (afterSeats - seated) + seated * S.sitInLaborMult;
  const lostLabor = work > sp.ordersPerDay ? afterSeats * (1 - sp.ordersPerDay / work) : 0;
  const served = afterSeats - lostLabor;
  const peakUse = b.size > 0 ? Math.min(present, avail) / b.size : 0;
  const lost = { queue: walked, seats: left, labor: lostLabor };
  const bound = lostLabor >= walked && lostLabor >= left && lostLabor > 0.5 ? 'labor' : walked >= left && walked > 0.5 ? 'rush' : left > 0.5 ? 'seats' : 'none';
  return {
    demand, served, lost, bound, labor,
    rush: { orders: rushOrders, capPerHour: cap, line, waitMin: cap > 0 ? (60 * line) / cap : 0, walked, servedShare: rushOrders > 0 ? 1 - walked / rushOrders : 1 },
    seats: { wanted, seated, tookAway, left, turns: b.size > 0 ? seated / b.size : 0, peakUse, crowded: present / Math.max(1, b.size) > S.crowdAbove },
    spare: Math.max(0, sp.ordersPerDay / labor - served),
  };
}

// ───────────────────────── regulars ─────────────────────────

/** b.history: closed months [{ avgPrice, closureDays }]; b.monthsOpen: months since the doors opened. */
export function regularsState(b, place, date) {
  const { groups } = guestMixDetailed(place, date);
  const potential = sum(groups.map((g) => g.share * g.cfg.regularShare));
  const tenure = 1 - Math.exp(-Math.max(0, b.monthsOpen) / R.tenureMonths);
  const lift = potential * R.maxLift * tenure * clamp(((b.quality - 0.5) + (b.reputation - 0.5)) / (2 * R.qualitySpan), -1, 1);
  const prices = [...(b.history ?? []).map((m) => m.avgPrice), b.price];
  let priceLoss = 0;
  for (let i = prices.length - 1; i >= 1; i--) {
    const age = prices.length - 1 - i;
    if (age >= R.priceMemoryMonths) break;
    const over = prices[i] / prices[i - 1] - 1 - R.priceStepFree;
    if (over > 0) priceLoss += Math.min(R.priceLossMax, R.priceLossPerPoint * over) * (1 - age / R.priceMemoryMonths);
  }
  priceLoss = Math.min(R.priceLossMax, priceLoss);
  const closed = [...(b.history ?? []).map((m) => m.closureDays ?? 0), b.closureDaysThisMonth ?? 0];
  let closureLoss = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    const age = closed.length - 1 - i;
    if (age >= R.closureMemoryMonths) break;
    closureLoss += R.closureLossPerDay * closed[i] * (1 - age / R.closureMemoryMonths);
  }
  closureLoss = Math.min(R.closureLossMax, closureLoss);
  const mult = clamp(1 + lift - potential * tenure * (priceLoss + closureLoss), R.multBounds[0], R.multBounds[1]);
  const share = potential * tenure * (1 - priceLoss - closureLoss) * (1 + lift) / mult;
  return { potential, tenure, share: clamp(share, 0, 1), lift, priceLoss, closureLoss, mult };
}

// ───────────────────────── the engine around the parts (ported) ─────────────────────────

const WEIGHTS = pack.market.weights, K = Math.abs(pack.market.priceElasticity), WP = Math.max(0.05, WEIGHTS.price);
const KQ = K * (WEIGHTS.quality / WP), KR = K * (WEIGHTS.reputation / WP);
const fairPrice = (q) => pack.unit.refPrice * (1 + 0.6 * (q - 0.5));
const awarenessAt = (days) => F.awarenessStart + (1 - F.awarenessStart) * (1 - Math.exp(-Math.max(0, days) / F.rampDays));

/** engine/src/economy/demand.ts footfallDemand for one shop with only the real rivals around it; orders a day. */
function baseDemandDay(b, place, awareness = 1, extraRivals = 0) {
  const strength = Math.exp(-F.priceSensitivity * Math.log(b.price / pack.unit.refPrice) + KQ * (b.quality - 0.5) + KR * (b.reputation - 0.5));
  const rivals = (place.rivals?.find((r) => r.niche === 'cafe')?.weight ?? 0) * F.staticWeight + extraRivals;
  return place.pedestriansPerDay * F.captureRate * (1 + F.outside) * (strength / (strength + rivals + F.outside)) * awareness;
}

const REACH = { subway: 250, college: 400, school: 200, park: 200, hospital: 250, library: 150, museum: 150, plaza: 150 };
/** shared/src/place.ts anchorDayMult. */
function anchorDayMult(place, weekday, month) {
  const has = (k) => (place.anchors ?? []).some((a) => a.kind === k && a.distM <= REACH[k]);
  const weekend = weekday >= 5, summer = month >= 6 && month <= 8, winter = month === 12 || month <= 2;
  let m = 1;
  if (has('subway')) m *= weekend ? 0.93 : 1.06;
  if (has('college')) m *= summer ? 0.88 : 1.06;
  if (has('school')) m *= summer ? 0.97 : weekend ? 1 : 1.03;
  if (has('park')) m *= winter ? 0.97 : weekend ? 1.1 : 1.02;
  if (has('hospital')) m *= 1.03;
  if (has('museum') || has('library') || has('plaza')) m *= weekend ? 1.03 : 1;
  return clamp(m, 0.8, 1.25);
}

const leverOpt = (b, id) => {
  const lever = pack.levers.find((l) => l.id === id);
  const extra = T.newLeverOptions.filter((o) => o.leverId === id).map((o) => o.option);
  const all = [...lever.options, ...extra];
  return all.find((o) => o.id === b.levers[id]) ?? all.find((o) => !o.causes) ?? all[0];
};
const leverSum = (b, key) => sum(pack.levers.map((l) => leverOpt(b, l.id).effects?.[key] ?? 0));
function leverCapacity(b) {
  let m = 1 + leverSum(b, 'capacity');
  for (const [lever, byOpt] of Object.entries(T.leverSpeed ?? {})) m *= byOpt[b.levers?.[lever]] ?? 1;
  return m;
}
const kitQuality = (kitId) => {
  const bonus = (id) => sum(pack.kits.find((k) => k.id === id).items.map((i) => (pack.setup.find((s) => s.id === i.id)?.qualityBonus ?? 0)));
  return bonus(kitId) - bonus('standard');
};

const payrollTaxRate = sum(common.taxes.filter((t) => t.base === 'payroll').map((t) => t.rate));
const rentMonth = (place) => (place.sqft * place.rentPerSqftYear) / 12;
/** Seats that fit once the bar, the line, the restroom and the back of house have their floor (D02 floor plan). */
export const seatsThatFit = (place) => Math.max(0, Math.floor(((place?.sqft ?? 1e9) - S.fixedCoreSqft) / S.sqftPerSeat));
const maxSeats = seatsThatFit;

/** One month's profit before the owner's taxes, like economyMonthClose (D14-examples.mjs month()). */
function monthPnl(b, place, orders) {
  const revenue = orders * b.price;
  let cost = orders * pack.unit.cogsPerUnit + rentMonth(place);
  let wages = 0;
  for (const [id, k] of Object.entries(b.staff)) wages += k * roleDef(id).hourlyWage * roleDef(id).hoursPerMonth;
  cost += wages * (1 + payrollTaxRate);
  const n = heads(b);
  for (const c of pack.monthlyCosts) {
    if (c.kind === 'rent') continue;
    cost += c.basis === 'fixed' ? c.amount : c.basis === 'per_staff' ? c.amount * n : c.basis === 'per_unit' ? c.amount * orders : c.basis === 'pct_revenue' ? c.amount * revenue : c.amount * b.size;
  }
  cost += pack.sizing.cleaningCostPerSizeMonth * b.size;
  for (const l of pack.levers) cost += leverOpt(b, l.id).monthlyCost;
  return { revenue, wages, rent: rentMonth(place), profit: revenue - cost };
}

const dateOf = (day) => ({ day, month: Math.floor(day / D) % 12 + 1, weekday: day % 7 });

/** Shop from a profile at a place. Quality sits at its target: kit + levers + team. */
function shopOf(profile, place, over = {}) {
  const b = { ...profile, staff: { ...profile.staff }, levers: { ...profile.levers }, ...over };
  b.size = Math.min(b.size, maxSeats(place));
  b.quality = clamp(0.5 + kitQuality(b.kit) + leverSum(b, 'quality') + staffPower(b).qualityDelta, 0, 1);
  b.reputation = b.reputation ?? b.quality;
  b.monthsOpen = b.monthsOpen ?? 24;
  b.days = [];
  return b;
}

/** Runs `months` game months from day `startDay`; the shop opened `openedDaysAgo` days before. Returns one row per month. */
function run(b, place, { months = 12, startDay = 0, openedDaysAgo = 720, steadyRep = true, extraRivals = 0, onMonth } = {}) {
  const out = [];
  for (let m = 0; m < months; m++) {
    if (onMonth) onMonth(b, m);
    const acc = { demand: 0, served: 0, queue: 0, seats: 0, labor: 0, hours: 0, seg: 0, reg: 0, turns: 0, rushServed: 0, regShare: 0, peakUse: 0 };
    b.closureDaysThisMonth = b.closureDaysThisMonth ?? 0;
    for (let i = 0; i < D; i++) {
      const day = startDay + m * D + i, date = dateOf(day);
      const mix = guestMixDetailed(place, date);
      const fit = segmentFit(b, place, date);
      b.monthsOpen = (openedDaysAgo + m * D + i) / D;
      const reg = regularsState(b, place, date);
      const base = baseDemandDay(b, place, awarenessAt(openedDaysAgo + m * D + i), extraRivals);
      const dem = base * anchorDayMult(place, date.weekday, date.month) * mix.volume * fit.mult * reg.mult * (1 + leverSum(b, 'demand'));
      const cov = coverage(b);
      const demCovered = dem * (1 - cov.lostDemandShare);
      const s = serviceDay(b, place, date, demCovered);
      const closed = i < (b.closureDaysThisMonth ?? 0);
      const served = closed ? 0 : s.served;
      b.days.push({ demand: dem, lostQueue: closed ? 0 : s.lost.queue, lostLabor: closed ? 0 : s.lost.labor + (dem - demCovered) });
      acc.demand += dem; acc.served += served; acc.queue += s.lost.queue; acc.seats += s.lost.seats; acc.labor += s.lost.labor; acc.hours += dem - demCovered;
      acc.seg += fit.mult; acc.reg += reg.mult; acc.turns += s.seats.turns; acc.rushServed += s.rush.servedShare; acc.regShare += reg.share; acc.peakUse += s.seats.peakUse;
      if (steadyRep) {
        const lostShare = dem > 0 ? (dem - served) / dem : 0;
        const target = clamp(b.quality - 0.6 * lostShare - 0.5 * Math.max(0, b.price / fairPrice(b.quality) - 1.15), 0, 1);
        b.reputation += 0.02 * (target - b.reputation);
      }
    }
    const pnl = monthPnl(b, place, acc.served);
    out.push({
      month: m + 1, demandDay: acc.demand / D, servedDay: acc.served / D, lostQueueDay: acc.queue / D, lostSeatsDay: acc.seats / D, lostLaborDay: acc.labor / D, lostHoursDay: acc.hours / D,
      segMult: acc.seg / D, regMult: acc.reg / D, turns: acc.turns / D, rushServed: acc.rushServed / D, regShare: acc.regShare / D, peakUse: acc.peakUse / D,
      quality: b.quality, reputation: b.reputation, ...pnl,
    });
    b.history = [...(b.history ?? []), { avgPrice: b.price, closureDays: b.closureDaysThisMonth ?? 0 }];
    b.closureDaysThisMonth = 0;
  }
  return out;
}
const yearAvg = (rows) => Object.fromEntries(Object.keys(rows[0]).map((k) => [k, sum(rows.map((r) => r[k])) / rows.length]));

// ───────────────────────── output ─────────────────────────

const out = [];
const P = (s = '') => out.push(s);
const table = (head, rows) => { P(`| ${head.join(' | ')} |`); P(`|${head.map(() => '---').join('|')}|`); for (const r of rows) P(`| ${r.join(' | ')} |`); P(); };
const profiles = Object.fromEntries(X.profiles.map((p) => [p.id, p]));

// reference check
{
  const refShop = { price: 8.5, size: 18, staff: { barista: 4 }, levers: {}, kit: 'standard' };
  const p = monthPnl(refShop, { sqft: 800, rentPerSqftYear: 90 }, 6000);
  P(`Reference month (4 baristas, 18 seats, 6,000 orders, $6,000 rent): profit before owner taxes ${usd(p.profit)}; pack.extra.referenceMonth says $9,719.`);
  P();
}

// A. block types on the real map
const typed = places.filter((p) => p.pedestriansPerDay && p.suitableFor.includes('cafe')).map((p) => ({ p, w: blockWeights(p), type: blockTypeOf(p) }));
{
  P('## A. Block types on the East Village map');
  const rows = BLOCKS.map((k) => {
    const of = typed.filter((t) => t.type === k);
    const peds = of.map((t) => t.p.pedestriansPerDay).sort((a, b) => a - b);
    return [k, of.length, peds.length ? `${peds[0]}–${peds[peds.length - 1]}` : '—', peds.length ? peds[Math.floor(peds.length / 2)] : '—'];
  });
  table(['Type', 'Places', 'Passers-by a day', 'Median'], rows);
}

// four real places, one per type: the place whose own type weight is the largest among doors of a comparable size
const pick = (type) => typed.filter((t) => t.type === type && t.p.sqft >= 600 && t.p.sqft <= 1400 && t.p.pedestriansPerDay >= 4000)
  .sort((a, b) => b.w[type] - a.w[type] || a.p.id.localeCompare(b.p.id))[0] ?? typed.filter((t) => t.type === type).sort((a, b) => b.w[type] - a.w[type])[0];
const chosen = Object.fromEntries(BLOCKS.map((k) => [k, pick(k)]));
{
  P('## B. Four real places');
  table(['Type', 'Place', 'Address', 'sq ft', 'Tier', 'Rent a month', 'Passers-by', 'Rival weight', 'Weights res/office/campus/tourist', 'Guests on an average day: office/residents/students/tourists'],
    BLOCKS.map((k) => {
      const { p, w } = chosen[k];
      const shares = G.segments.map((s) => sum(BLOCKS.map((t) => w[t] * (G.mixByBlock[t][s.id] ?? 0))));
      return [k, p.id, p.address, p.sqft, p.tier, usd(rentMonth(p)), p.pedestriansPerDay, p.rivals?.find((r) => r.niche === 'cafe')?.weight ?? 0,
        BLOCKS.map((t) => pct(w[t])).join(' / '), shares.map(pct).join(' / ')];
    }));
}

// C. table of expectations: three profiles on the four places, an established shop, average month of a year.
// Each profile keeps its price, seats, kit and levers; the number of baristas is the one a careful owner would
// settle on at this door (the count from 1 to 7 with the best profit), because a fixed team on a door three times
// busier says nothing about the format.
const expect = {};
function settle(prof, p, staff) {
  const b = shopOf(prof, p, staff ? { staff } : {});
  run(b, p, { months: 12 });                       // settle reputation
  return { b, y: yearAvg(run(b, p, { months: 12 })) };
}
function bestTeam(prof, p) {
  let best = null;
  for (let n = 1; n <= 7; n++) {
    const staff = { ...prof.staff, barista: n };
    const r = settle(prof, p, staff);
    if (!best || r.y.profit > best.y.profit) best = { ...r, staff };
  }
  return best;
}
{
  P('## C. Table of expectations: established shop, average month of a year, baristas fitted to the door');
  const rows = [];
  const small = typed.filter((t) => seatsThatFit(t.p) < 12 && t.p.tier !== 'prime').sort((a, b) => b.p.pedestriansPerDay - a.p.pedestriansPerDay)[0];
  const doors = [...BLOCKS.map((k) => [k, chosen[k].p]), [`small door (${small.type})`, small.p]];
  for (const [k, p] of doors) {
    expect[k] = {};
    for (const prof of X.profiles) {
      const r = bestTeam(prof, p);
      expect[k][prof.id] = { placeId: p.id, staff: r.staff, asIs: settle(prof, p).y.profit, ...r.y };
    }
    const best = X.profiles.map((pr) => pr.id).sort((a, b) => expect[k][b].profit - expect[k][a].profit)[0];
    for (const prof of X.profiles) {
      const y = expect[k][prof.id];
      rows.push([k, `${p.id}, ${p.sqft} sq ft, ${p.tier}, fits ${seatsThatFit(p)} seats`, prof.id + (prof.id === best ? ' ★' : ''), Object.entries(y.staff).map(([id, n]) => `${n} ${id}`).join(' + '), r0(y.demandDay), r0(y.servedDay), r1(y.lostQueueDay), r1(y.lostSeatsDay), r1(y.lostLaborDay + y.lostHoursDay),
        r2(y.segMult), r2(y.regMult), r2(y.quality), usd(y.revenue), usd(y.profit), usd(y.asIs)]);
    }
    expect[k].best = best;
  }
  table(['Type', 'Place', 'Profile', 'Team', 'Want a day', 'Served a day', 'Lost: line', 'Lost: seats', 'Lost: labor and hours', 'Segments ×', 'Regulars ×', 'Quality', 'Sales a month', 'Profit a month', 'Profit with the profile team as written'], rows);
}

// D. segments: fit by block type, pure types
{
  P('## D. segments: how well an offer fits each pure block type (Wednesday, October)');
  const date = { weekday: 2, month: 10 };
  const offers = [
    ['Reference: $8.50, quality 0.50, 18 seats', { price: 8.5, quality: 0.5, size: 18 }],
    ['Cheap: $6.50, quality 0.45, 18 seats', { price: 6.5, quality: 0.45, size: 18 }],
    ['Specialty: $11, quality 0.72, 18 seats', { price: 11, quality: 0.72, size: 18 }],
    ['Reference with 30 seats', { price: 8.5, quality: 0.5, size: 30 }],
    ['Reference with 6 seats', { price: 8.5, quality: 0.5, size: 6 }],
  ];
  const pure = (k, tier = 'mid') => ({ tier, anchors: [], __pure: k });
  const fitPure = (b, k, tier) => {
    const lp = Math.log(b.price / pack.unit.refPrice), seatIdx = clamp((b.size - G.refSeats) / G.seatSpan, -1, 1);
    const raw = G.segments.map((s) => ({ s, x: G.mixByBlock[k][s.id] * s.week[date.weekday] * s.months[date.month - 1] }));
    const tot = sum(raw.map((r) => r.x));
    return clamp(sum(raw.map(({ s, x }) => (x / tot) * Math.exp(-(s.priceShift + (s.id === 'residents' ? G.tierPriceShift[tier] : 0)) * lp + (s.qualityShift + (s.id === 'residents' ? G.tierQualityShift[tier] : 0)) * (b.quality - 0.5) + s.seatPull * seatIdx))), G.multBounds[0], G.multBounds[1]);
  };
  void pure;
  table(['Offer', ...BLOCKS, 'residential, prime tier'], offers.map(([name, b]) => [name, ...BLOCKS.map((k) => r2(fitPure(b, k, 'mid'))), r2(fitPure(b, 'residential', 'prime'))]));

  P('### Three months on the campus place: the same shop in May, June and July');
  const { p } = chosen.campus;
  const b = shopOf(profiles.neighborhood, p);
  run(b, p, { months: 12 });
  const rows = run(b, p, { months: 3, startDay: 4 * D });
  table(['Month', 'Students in the mix', 'Want a day', 'Served a day', 'Sales', 'Profit'], rows.map((r, i) => {
    const mix = guestMixDetailed(p, { weekday: 2, month: 5 + i });
    return [['May', 'June', 'July'][i], pct(mix.groups.find((g) => g.id === 'students').share), r0(r.demandDay), r0(r.servedDay), usd(r.revenue), usd(r.profit)];
  }));
}

// E. service
{
  P('## E. service');
  P('### One day, office place, Wednesday in October: the same team of four with 6 seats and with 30 seats');
  const date = { weekday: 2, month: 10, day: 0 };
  const rows = [];
  for (const [type, demands] of [['office', [250, 400, 550]], ['residential', [250, 400]]]) {
    const { p } = chosen[type];
    for (const dem of demands) for (const size of [6, 30]) {
      const b = { size, staff: { barista: 3, shift_lead: 1 }, levers: {}, price: 8.5 };
      const s = serviceDay(b, p, date, dem);
      rows.push([type, dem, size, r0(s.rush.orders), r0(s.rush.capPerHour), r1(s.rush.line), r1(s.rush.waitMin), r1(s.lost.queue), r0(s.seats.wanted), r1(s.seats.tookAway), r1(s.lost.seats), r1(s.lost.labor), r0(s.served), r1(s.seats.turns), pct(s.seats.peakUse)]);
    }
  }
  table(['Place', 'Orders wanted', 'Seats', 'Rush orders', 'Bar, orders an hour', 'Longest line', 'Wait, min', 'Walked from the line', 'Want a seat', 'No seat, took away', 'No seat, left', 'Lost to labor', 'Served', 'Seat turns', 'Seats in use at peak'], rows);

  P('### Three months, office place: takeaway profile; month 2 loses the shift lead, month 3 adds a barista');
  const { p } = chosen.office;
  const b = shopOf(profiles.takeaway, p);
  run(b, p, { months: 12 });
  const steps = [{ barista: 3, shift_lead: 1 }, { barista: 4 }, { barista: 4, shift_lead: 1 }];
  const rows3 = run(b, p, { months: 3, startDay: 8 * D, onMonth: (shop, m) => { shop.staff = steps[m]; shop.quality = clamp(0.5 + kitQuality(shop.kit) + leverSum(shop, 'quality') + staffPower(shop).qualityDelta, 0, 1); } });
  table(['Month', 'Team', 'Bar in the rush, orders an hour', 'Want a day', 'Walked from the line a day', 'Lost to labor a day', 'Served a day', 'Rush served', 'Wages', 'Profit'],
    rows3.map((r, i) => [i + 1, JSON.stringify(steps[i]), r0(staffPower({ ...b, staff: steps[i] }).rushOrdersPerHour), r0(r.demandDay), r1(r.lostQueueDay), r1(r.lostLaborDay), r0(r.servedDay), pct(r.rushServed), usd(r.wages), usd(r.profit)]));
}

// F. staffing
{
  P('## F. staffing');
  P('### Teams side by side (standard hours, 12 open hours a day)');
  const teams = [
    { barista: 2 }, { barista: 3 }, { barista: 2, shift_lead: 1 }, { barista: 4 }, { barista: 3, shift_lead: 1 },
    { barista: 2, shift_lead: 1, trainee_barista: 1 }, { barista: 2, trainee_barista: 2 }, { barista: 5, shift_lead: 1 },
  ];
  table(['Team', 'Wages a month', 'Orders a day', 'Bar in the rush, orders an hour', 'Quality', 'Hours covered', 'Demand lost to closed hours'], teams.map((staff) => {
    const b = { staff, levers: {} };
    const sp = staffPower(b), cov = coverage(b);
    const wages = sum(Object.entries(staff).map(([id, k]) => k * roleDef(id).hourlyWage * roleDef(id).hoursPerMonth));
    return [JSON.stringify(staff), usd(wages), r0(sp.ordersPerDay), r0(sp.rushOrdersPerHour), (sp.qualityDelta >= 0 ? '+' : '') + r2(sp.qualityDelta), pct(cov.coveredShare), pct(cov.lostDemandShare)];
  }));

  P('### Which team earns most at each load (residential place, neighborhood profile, price and seats fixed)');
  const { p } = chosen.residential;
  const rows = [];
  for (const mult of [0.5, 1, 1.6]) {
    const place = { ...p, pedestriansPerDay: p.pedestriansPerDay * mult };
    const res = teams.map((staff) => {
      const b = shopOf(profiles.neighborhood, place, { staff });
      run(b, place, { months: 12 });
      return { staff, y: yearAvg(run(b, place, { months: 12 })) };
    }).sort((a, b) => b.y.profit - a.y.profit);
    rows.push([`${r0(place.pedestriansPerDay)} passers-by`, JSON.stringify(res[0].staff), r0(res[0].y.servedDay), usd(res[0].y.profit), JSON.stringify(res[1].staff), usd(res[1].y.profit), JSON.stringify(res[res.length - 1].staff), usd(res[res.length - 1].y.profit)]);
  }
  table(['Load', 'Best team', 'Served a day', 'Profit', 'Second', 'Profit', 'Worst', 'Profit'], rows);

  P('### Three months: four baristas, then a shift lead replaces one, then a trainee replaces another (office place, takeaway profile)');
  const o = chosen.office.p;
  const b = shopOf(profiles.takeaway, o);
  run(b, o, { months: 12 });
  const steps = [{ barista: 4 }, { barista: 3, shift_lead: 1 }, { barista: 2, shift_lead: 1, trainee_barista: 1 }];
  const rows3 = run(b, o, { months: 3, startDay: 8 * D, onMonth: (shop, m) => { shop.staff = steps[m]; shop.quality = clamp(0.5 + kitQuality(shop.kit) + leverSum(shop, 'quality') + staffPower(shop).qualityDelta, 0, 1); } });
  table(['Month', 'Team', 'Quality target', 'Served a day', 'Lost a day', 'Wages', 'Profit'], rows3.map((r, i) => [i + 1, JSON.stringify(steps[i]), r2(r.quality), r0(r.servedDay), r1(r.demandDay - r.servedDay), usd(r.wages), usd(r.profit)]));
}

// G. regulars
{
  P('## G. regulars');
  const { p } = chosen.residential;
  P(`Residential place ${p.id}. Regulars possible among today's guests: ${pct(regularsState({ price: 8.5, quality: 0.5, reputation: 0.5, monthsOpen: 24 }, p, { weekday: 2, month: 10 }).potential)}; tourist place ${chosen.tourist.p.id}: ${pct(regularsState({ price: 8.5, quality: 0.5, reputation: 0.5, monthsOpen: 24 }, chosen.tourist.p, { weekday: 2, month: 10 }).potential)}.`);
  P();
  P('### Price: +15% in one month against +3% five months in a row (both end at about +15%)');
  const mk = () => { const b = shopOf(profiles.neighborhood, p); run(b, p, { months: 12 }); b.history = [{ avgPrice: 8.5 }, { avgPrice: 8.5 }]; return b; };
  const jump = mk(), steps = mk(), flat = mk();
  const rj = run(jump, p, { months: 6, startDay: 0, onMonth: (s, m) => { if (m === 0) s.price = r2(8.5 * 1.15); } });
  const rs = run(steps, p, { months: 6, startDay: 0, onMonth: (s, m) => { if (m < 5) s.price = r2(s.price * 1.03); } });
  const rf = run(flat, p, { months: 6, startDay: 0 });
  table(['Month', 'Jump: price', 'Regulars ×', 'Served a day', 'Profit', 'Steps: price', 'Regulars ×', 'Served a day', 'Profit', 'No change: served a day', 'Profit'],
    rj.map((r, i) => [i + 1, `$${r2(r.revenue / (r.servedDay * D)).toFixed(2)}`, r2(r.regMult), r0(r.servedDay), usd(r.profit), `$${r2(rs[i].revenue / (rs[i].servedDay * D)).toFixed(2)}`, r2(rs[i].regMult), r0(rs[i].servedDay), usd(rs[i].profit), r0(rf[i].servedDay), usd(rf[i].profit)]));
  P(`Six months: jump ${usd(sum(rj.map((r) => r.profit)))}, steps ${usd(sum(rs.map((r) => r.profit)))}, no change ${usd(sum(rf.map((r) => r.profit)))}.`);
  P();

  P('### Three months after a five-day closure by the Health Department');
  const c = mk();
  const rc = run(c, p, { months: 4, onMonth: (s, m) => { s.closureDaysThisMonth = m === 0 ? 5 : 0; } });
  table(['Month', 'Days closed', 'Regulars ×', 'Share of regulars', 'Served a day', 'Profit'], rc.map((r, i) => [i + 1, i === 0 ? 5 : 0, r2(r.regMult), pct(r.regShare), r0(r.servedDay), usd(r.profit)]));

  P('### A new shop, first twelve months: specialty against a shop with quality 0.5 (residential place)');
  const good = shopOf(profiles.specialty, p, { reputation: 0.5 }), avg = shopOf(profiles.neighborhood, p, { reputation: 0.5, staff: { barista: 4 } });
  avg.quality = 0.5;
  const rg = run(good, p, { months: 12, openedDaysAgo: 0 }), ra = run(avg, p, { months: 12, openedDaysAgo: 0, steadyRep: false });
  table(['Month', 'Awareness (engine)', 'Specialty: regulars ×', 'Share of regulars', 'Average shop: regulars ×', 'Share of regulars'],
    [1, 3, 6, 12].map((m) => [m, pct(awarenessAt(m * D - 15)), r2(rg[m - 1].regMult), pct(rg[m - 1].regShare), r2(ra[m - 1].regMult), pct(ra[m - 1].regShare)]));
}

// H. census: the best of the three profiles on every door of the map
{
  P('## H. Census: which profile earns most on each of the map\'s doors (baristas fitted to the door)');
  const tally = {};
  for (const t of typed) {
    const res = X.profiles.map((prof) => ({ id: prof.id, y: bestTeam(prof, t.p).y })).sort((a, b) => b.y.profit - a.y.profit);
    const key = `${t.type} | ${seatsThatFit(t.p) < 12 ? 'small (fewer than 12 seats fit)' : 'regular'} | ${t.p.tier}`;
    tally[key] = tally[key] ?? { n: 0, takeaway: 0, neighborhood: 0, specialty: 0, profitable: 0 };
    tally[key].n++; tally[key][res[0].id]++; if (res[0].y.profit > 0) tally[key].profitable++;
  }
  table(['Block type', 'Door', 'Tier', 'Doors', 'takeaway wins', 'neighborhood wins', 'specialty wins', 'Best profile is profitable'],
    Object.keys(tally).sort().map((k) => [...k.split(' | '), tally[k].n, tally[k].takeaway, tally[k].neighborhood, tally[k].specialty, tally[k].profitable]));
}

if (process.argv.includes('--json')) {
  const slim = Object.fromEntries(Object.keys(expect).map((k) => [k, { placeId: expect[k].takeaway.placeId, best: expect[k].best, profit: Object.fromEntries(X.profiles.map((pr) => [pr.id, r0(expect[k][pr.id].profit)])) }]));
  console.log(JSON.stringify(slim, null, 1));
} else {
  console.log(out.join('\n'));
}

if (process.argv.includes('--probe')) {
  for (const k of BLOCKS) {
    const { p } = chosen[k];
    for (const prof of X.profiles) {
      const res = [];
      for (const price of [6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 11, 12]) {
        const r = bestTeam({ ...prof, price }, p);
        res.push(`${price}:${r0(r.y.profit / 100) / 10}k/${r0(r.y.servedDay)}`);
      }
      console.error(k, prof.id, res.join('  '));
    }
  }
}

