// One game day for every business: build/CONTRACT.md, section 3, step 4.
import type { BusinessState, DayReport, FeedItem, InboxItem, NicheId, Pack, Place, PnlLine, TaxLiability, WorldState } from '@ohh/shared';
import { dateOf, RULES } from '@ohh/shared';
import type { EngineCtx } from '../index';
import { monthlyDemand, marketParams, type DemandInput } from './demand';
import { activeEvents, eventMult, itemsQuality, leverEffects, MARKETING_DECAY_DAY, TRAINING_DECAY_DAY, trainingBoost, weekdayMult } from './effects';
import { dealModifiers } from './deps';
import { hooksFor } from './hooks';
import { accrue, applicableTaxes, dueDayFor, isSalesTax, taxableShare, taxDef, taxName } from './taxes';
import { addLine, clamp, econOf, placeOf, placeRentMonth, round2, staffCount, withEcon, type EconExtra } from './util';

interface Calc {
  b: BusinessState; pack: Pack; place: Place | undefined;
  demand: number; served: number; lost: { size: number; staff: number; closure: number };
  capacity: number; sizeCap: number; pull: number; spillIn: number;
  priceMult: number; cogsMult: number; staffN: number;
  rentMult: number; utilitiesMult: number; notes: string[];
}

const QUALITY_INERTIA = 0.1;      // share of the gap to target closed per day
const REPUTATION_INERTIA = 0.02;  // ≈ 0.45 of the gap per month, like report 43 (0.4 per round)
const SPILL = 0.5;                // report 43: half of the turned-away buyers try a neighbour

export function economyDay(w: WorldState, ctx: EngineCtx): WorldState {
  const day = w.day;
  const date = dateOf(day);
  const weather = w.weather.find((d) => d.day === day);
  const weatherMult = weather?.footTrafficMult ?? 1;
  const events = activeEvents(w, day);

  // closures that ended reopen the doors
  const start = w.businesses.map((b) => {
    if (b.status === 'closed' && (b.closedUntilDay ?? 0) < day) {
      const { closedUntilDay: _c, ...rest } = b;
      return { ...rest, status: 'open' as const };
    }
    return b;
  });

  // demand per niche: only businesses that are trading or temporarily closed compete
  const calcs = new Map<number, Calc>();
  const niches = new Map<NicheId, number[]>();
  start.forEach((b, i) => {
    if (b.status !== 'open' && b.status !== 'closed') return;
    const list = niches.get(b.niche);
    if (list) list.push(i); else niches.set(b.niche, [i]);
  });

  for (const [niche, idx] of niches) {
    const pack = ctx.packs.niches[niche];
    if (!pack) continue;
    const params = marketParams(pack);
    const inputs: DemandInput[] = idx.map((i) => {
      const b = start[i];
      return { id: b.id, price: b.orders.price, quality: b.quality, reputation: b.reputation, footTraffic: placeOf(ctx, b.placeId)?.footTraffic ?? 0.5, marketing: econOf(b).marketing };
    });
    const { demand, pull } = monthlyDemand(params, inputs);
    const wd = weekdayMult(pack, date.weekday);
    idx.forEach((i, k) => {
      const b = start[i];
      const place = placeOf(ctx, b.placeId);
      const hooks = hooksFor(b.niche);
      const mods = dealModifiers(w, ctx, b.id);
      const lev = leverEffects(b, pack);
      const dayMult = wd * weatherMult * eventMult(events, 'demand', niche, place) * eventMult(events, 'footTraffic', niche, place)
        * mods.demandMult * mods.footTrafficMult * (hooks.demandMult?.(b, date, pack) ?? 1) * lev.demandMult;
      const dem = Math.max(0, Math.round((demand[k] / RULES.DAYS_PER_MONTH) * dayMult));
      const staffN = staffCount(b.orders.staff);
      const perStaff = pack.capacity.unitsPerStaffMonth;
      const staffCap = perStaff == null ? Infinity : (staffN * perStaff / RULES.DAYS_PER_MONTH) * eventMult(events, 'staffAvailability', niche, place) * lev.capacityMult;
      const takeaway = clamp((pack.sizing.takeawayShare ?? 0) * eventMult(events, 'deliveryShare', niche, place), 0, 0.95);
      const hookCap = hooks.capacityDay?.(b, pack);
      const sizeCap = typeof hookCap === 'number' ? Math.max(0, hookCap)
        : (b.size * pack.sizing.unitsServedPerSizeMonth / RULES.DAYS_PER_MONTH) / (1 - takeaway);
      const hardCap = pack.capacity.hardCapUnits ? pack.capacity.hardCapUnits / RULES.DAYS_PER_MONTH : Infinity;
      const capacity = Math.min(staffCap, sizeCap, hardCap);
      const lost = { size: 0, staff: 0, closure: 0 };
      let served = 0;
      if (b.status === 'closed') {
        lost.closure = dem;
      } else {
        served = Math.floor(Math.min(dem, capacity));
        const gone = dem - served;
        if (gone > 0) {
          if (sizeCap <= staffCap || hardCap <= staffCap) lost.size = gone; else lost.staff = gone;
        }
      }
      calcs.set(i, {
        b, pack, place, demand: dem, served, lost, capacity, sizeCap, pull: pull[k], spillIn: 0,
        priceMult: mods.priceMult, cogsMult: eventMult(events, 'cogs', niche, place) * mods.cogsMult, staffN,
        rentMult: eventMult(events, 'rent', niche, place), utilitiesMult: eventMult(events, 'utilities', niche, place), notes: [],
      });
    });

    // half of the turned-away customers try a neighbour of the same niche with free capacity
    const group = idx.map((i) => calcs.get(i)).filter((c): c is Calc => !!c);
    const lostTotal = group.reduce((a, c) => a + c.lost.size + c.lost.staff + c.lost.closure, 0);
    const pool = Math.floor(SPILL * lostTotal);
    if (pool > 0) {
      const takers = group.filter((c) => c.b.status === 'open' && c.capacity - c.served >= 1);
      const tot = takers.reduce((a, c) => a + c.pull, 0);
      for (const c of takers) {
        const extra = Math.min(Math.floor(c.capacity - c.served), Math.floor((pool * c.pull) / tot));
        if (extra > 0) { c.served += extra; c.demand += extra; c.spillIn = extra; }
      }
    }
  }

  const feed: FeedItem[] = [];
  const inbox = new Map<string, InboxItem[]>();
  const businesses = start.map((b, i) => {
    if (b.status === 'bankrupt') return b;
    const pack = ctx.packs.niches[b.niche];
    if (!pack) return b;
    const c = calcs.get(i);
    const next = c ? tradeDay(c, w, ctx, day, date.month, events.map((e) => e.title), weather) : setupDay(b, pack, ctx, day, events, w);
    return payDue(next, ctx, pack, day, feed, inbox, w);
  });

  let players = w.players;
  if (inbox.size > 0) {
    players = w.players.map((p) => (inbox.has(p.id) ? { ...p, inbox: [...p.inbox, ...inbox.get(p.id)!] } : p));
  }
  return { ...w, businesses, players, feed: feed.length ? [...w.feed, ...feed] : w.feed };
}

function tradeDay(c: Calc, w: WorldState, ctx: EngineCtx, day: number, month: number, eventTitles: string[], weather: WorldState['weather'][number] | undefined): BusinessState {
  const { b, pack } = c;
  const econ = econOf(b);
  const price = b.orders.price;
  const revenue = round2(c.served * price * c.priceMult);
  const cogs = round2(c.served * pack.unit.cogsPerUnit * c.cogsMult);

  let lines: PnlLine[] = b.mtd.lines;
  let liabilities: TaxLiability[] = b.liabilities;
  let cash = b.cash;
  if (revenue !== 0) { lines = addLine(lines, { id: 'revenue', label: 'Sales', kind: 'revenue', amount: revenue }); cash = round2(cash + revenue); }
  if (cogs !== 0) { lines = addLine(lines, { id: 'cogs', label: `Cost of goods (${pack.unit.name}s)`, kind: 'cogs', amount: -cogs }); cash = round2(cash - cogs); }
  let salesTax = 0;
  if (revenue > 0) {
    const share = taxableShare(pack);
    for (const t of applicableTaxes(ctx, pack)) {
      if (!isSalesTax(t)) continue;
      const amt = round2(revenue * share * t.rate);
      if (amt <= 0) continue;
      salesTax = round2(salesTax + amt);
      liabilities = accrue(liabilities, t.id, amt, dueDayFor(t, month, ctx));
    }
    if (salesTax > 0) {
      lines = addLine(lines, { id: 'sales_tax_collected', label: 'Sales tax collected (owed to the state)', kind: 'tax', amount: salesTax });
      cash = round2(cash + salesTax);
    }
  }

  // quality and reputation drift toward today's targets
  const lev = leverEffects(b, pack);
  const util = c.sizeCap > 0 && Number.isFinite(c.sizeCap) ? c.served / c.sizeCap : 0;
  const crowded = util > (pack.sizing.crowdPenaltyAbove ?? 0.9);
  const empty = b.status === 'open' && util < (pack.sizing.emptyPenaltyBelow ?? 0);
  const qTarget = clamp(0.5 + itemsQuality(b, pack) + lev.quality + trainingBoost(econ.training, c.staffN) - (crowded ? 0.08 : 0) - (c.lost.staff > 0 ? 0.04 : 0), 0, 1);
  const quality = clamp(b.quality + QUALITY_INERTIA * (qTarget - b.quality), 0, 1);
  const fair = pack.unit.refPrice * (1 + 0.6 * (quality - 0.5));
  const lostN = c.lost.size + c.lost.staff + c.lost.closure;
  const lostShare = c.demand > 0 ? lostN / c.demand : 0;
  const rTarget = clamp(quality + lev.reputation - 0.6 * lostShare - 0.5 * Math.max(0, price / fair - 1.15) - (empty ? 0.1 : 0), 0, 1);
  const reputation = clamp(b.reputation + REPUTATION_INERTIA * (rTarget - b.reputation), 0, 1);

  const unit = pack.sizing.unitName;
  const notes: string[] = [];
  if (weather && Math.abs(weather.footTrafficMult - 1) >= 0.05) {
    const pct = Math.round((weather.footTrafficMult - 1) * 100);
    notes.push(`${weather.label}: foot traffic ${pct > 0 ? '+' : ''}${pct}%`);
  }
  for (const t of eventTitles) notes.push(`Event: ${t}`);
  if (c.lost.size > 0) notes.push(`Line out the door: ${c.lost.size} customers walked away`);
  if (c.lost.staff > 0) notes.push(`Short-staffed: ${c.lost.staff} customers left unserved`);
  if (c.lost.closure > 0) notes.push(`Closed by the city: ${c.lost.closure} customers turned away`);
  if (crowded && c.lost.size === 0) notes.push(`Packed: ${Math.round(util * 100)}% of ${unit}s in use, service slows down`);
  if (empty) notes.push(`Empty room: only ${Math.round(util * 100)}% of ${unit}s in use`);
  if (c.spillIn > 0) notes.push(`${c.spillIn} customers came over from a crowded neighbor`);

  const report: DayReport = {
    day, demandUnits: c.demand, servedUnits: c.served, lost: c.lost, revenue, variableCosts: cogs,
    sizeUtilization: Math.round(util * 1000) / 1000, weather: weather?.condition ?? 'clear', notes,
  };
  const extraNotes = hooksFor(b.niche).notes?.(b, report, pack) ?? [];
  if (extraNotes.length) report.notes = [...notes, ...extraNotes];

  const m = econ.mtd;
  const staffDays = { ...m.staffDays };
  for (const [role, n] of Object.entries(b.orders.staff)) if (n > 0) staffDays[role] = (staffDays[role] ?? 0) + n;
  const capUnits = Number.isFinite(c.capacity) ? c.capacity : c.demand;
  const econNext: EconExtra = {
    ...econ,
    marketing: econ.marketing * MARKETING_DECAY_DAY,
    training: econ.training * TRAINING_DECAY_DAY,
    mtd: {
      ...m, revenue: round2(m.revenue + revenue), cogs: round2(m.cogs + cogs), salesTax: round2(m.salesTax + salesTax),
      capacityUnits: m.capacityUnits + capUnits, utilSum: m.utilSum + util, utilDays: m.utilDays + 1,
      daysAlive: m.daysAlive + 1, daysOpen: m.daysOpen + 1, managerDays: m.managerDays + (b.orders.autopilot === 'manager' ? 1 : 0),
      rentMultSum: m.rentMultSum + c.rentMult, utilitiesMultSum: m.utilitiesMultSum + c.utilitiesMult, staffDays,
    },
  };
  return withEcon({
    ...b, cash, quality, reputation, liabilities,
    days: [...b.days, report].slice(-RULES.DAYS_PER_MONTH),
    mtd: {
      lines, demandUnits: b.mtd.demandUnits + c.demand, servedUnits: b.mtd.servedUnits + c.served,
      lost: { size: b.mtd.lost.size + c.lost.size, staff: b.mtd.lost.staff + c.lost.staff, closure: b.mtd.lost.closure + c.lost.closure },
    },
  }, econNext);
}

function setupDay(b: BusinessState, pack: Pack, ctx: EngineCtx, day: number, events: ReturnType<typeof activeEvents>, w: WorldState): BusinessState {
  void w;
  const econ = econOf(b);
  const place = placeOf(ctx, b.placeId);
  const rentMult = eventMult(events, 'rent', b.niche, place);
  const rentDay = place ? round2(placeRentMonth(place) / RULES.DAYS_PER_MONTH) : 0;
  const report: DayReport = {
    day, demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 }, revenue: 0, variableCosts: 0, sizeUtilization: 0,
    weather: w.weather.find((d) => d.day === day)?.condition ?? 'clear',
    notes: [`Not open yet: rent is running (about $${Math.round(rentDay)} a day)`],
  };
  const econNext: EconExtra = { ...econ, mtd: { ...econ.mtd, daysAlive: econ.mtd.daysAlive + 1, rentMultSum: econ.mtd.rentMultSum + rentMult } };
  void pack;
  return withEcon({ ...b, days: [...b.days, report].slice(-RULES.DAYS_PER_MONTH) }, econNext);
}

/** Pays every tax whose due day has come. Spending the tax you collected means bankruptcy on the day it is due. */
export function payDue(b: BusinessState, ctx: EngineCtx, pack: Pack, day: number, feed: FeedItem[], inbox: Map<string, InboxItem[]>, w: WorldState): BusinessState {
  if (b.status === 'bankrupt' || !b.liabilities.some((l) => !l.paid && l.dueDay <= day)) return b;
  let cash = b.cash;
  let lines = b.mtd.lines;
  let paid = 0;
  const unpaid: string[] = [];
  const liabilities = b.liabilities.map((l) => {
    if (l.paid || l.dueDay > day) return l;
    const def = taxDef(ctx, pack, l.taxId);
    const name = taxName(ctx, pack, l.taxId);
    cash = round2(cash - l.amount);
    paid = round2(paid + l.amount);
    lines = addLine(lines, { id: `tax_paid_${l.taxId}_d${l.dueDay}`, label: `${name} paid`, kind: def?.base === 'payroll' ? 'payroll_tax' : 'tax', amount: -l.amount });
    unpaid.push(`${name} (${'$' + Math.round(l.amount).toLocaleString('en-US')})`);
    return { ...l, paid: true };
  });
  const econ = econOf(b);
  let next: BusinessState = withEcon({ ...b, cash, liabilities, mtd: { ...b.mtd, lines } }, { ...econ, mtd: { ...econ.mtd, taxesPaid: round2(econ.mtd.taxesPaid + paid) } });
  if (cash < 0) {
    next = { ...next, status: 'bankrupt', bankruptDay: day };
    feed.push({ id: `feed-${day}-${w.feed.length + feed.length}`, day, kind: 'bankruptcy', text: `${b.name} went bankrupt: it could not pay ${unpaid.join(', ')}`, businessId: b.id });
    for (const o of b.owners) {
      const list = inbox.get(o.playerId) ?? [];
      const player = w.players.find((p) => p.id === o.playerId);
      list.push({ id: `inbox-${day}-${(player?.inbox.length ?? 0) + list.length}`, day, kind: 'money', title: 'Bankrupt: taxes were due', text: `${b.name} owed ${unpaid.join(', ')} and had only ${'$' + Math.round(cash + paid).toLocaleString('en-US')} in the bank. Sales tax you collect belongs to the state: keep it aside until it is due.`, ref: { type: 'business', id: b.id }, read: false });
      inbox.set(o.playerId, list);
    }
  }
  return next;
}
