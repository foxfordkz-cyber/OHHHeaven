// Month close: build/CONTRACT.md, section 3, step 5 (economy part). Every dollar is a PnlLine;
// the lines of a month add up to the change of cash over that month.
import type { BusinessState, FeedItem, InboxItem, MonthReport, Pack, PnlLine, ViolationTrail, WorldState } from '@ohh/shared';
import { dateOf, RULES } from '@ohh/shared';
import type { EngineCtx } from '../index';
import { payDue } from './day';
import { shortcutSavings } from './deps';
import { defaultLeverOption } from './effects';
import { hooksFor } from './hooks';
import { netWorthOf } from './networth';
import { accrue, applicableTaxes, dueDayFor, isSalesTax, wageBase } from './taxes';
import { addLine, econOf, emptyMtd, placeOf, placeRentMonth, round2, withEcon, type EconExtra } from './util';

const BOOK_KINDS = new Set<PnlLine['kind']>(['revenue', 'cogs', 'payroll', 'rent', 'opex', 'deal', 'other']);
/**
 * Money that changes hands as financing is neither income nor expense: loan principal either way, a stake bought or
 * sold, an early payoff. It moves cash and stays out of profit and of the profit tax.
 */
const FINANCING_LINE = /^deal:.+:(loan_in|loan_out|stake_in|stake_out|early|p\d+:principal)$/;
export const isFinancingLine = (l: PnlLine): boolean => l.kind === 'deal' && FINANCING_LINE.test(l.id);

export function economyMonthClose(w: WorldState, ctx: EngineCtx): WorldState {
  const day = w.day;
  const month = dateOf(day).month;
  const feed: FeedItem[] = [];
  const inbox = new Map<string, InboxItem[]>();
  const businesses = w.businesses.map((b) => {
    if (b.status === 'bankrupt') return b;
    const pack = ctx.packs.niches[b.niche];
    if (!pack) return b;
    return closeBusiness(b, pack, ctx, day, month, feed, inbox, w);
  });
  let players = w.players;
  if (inbox.size > 0) players = w.players.map((p) => (inbox.has(p.id) ? { ...p, inbox: [...p.inbox, ...inbox.get(p.id)!] } : p));
  return { ...w, businesses, players, feed: feed.length ? [...w.feed, ...feed] : w.feed };
}

export function monthlyRentOf(b: BusinessState, pack: Pack, ctx: EngineCtx): number {
  const place = placeOf(ctx, b.placeId);
  if (place && place.rentPerSqftYear > 0 && place.sqft > 0) return placeRentMonth(place);
  return pack.monthlyCosts.filter((c) => c.kind === 'rent' && c.basis === 'fixed').reduce((a, c) => a + c.amount, 0);
}

function closeBusiness(b: BusinessState, pack: Pack, ctx: EngineCtx, day: number, month: number, feed: FeedItem[], inbox: Map<string, InboxItem[]>, w: WorldState): BusinessState {
  const econ = econOf(b);
  const m = econ.mtd;
  const D = RULES.DAYS_PER_MONTH;
  const openShare = m.daysOpen / D;
  let lines = b.mtd.lines;
  let cash = b.cash;
  const add = (line: PnlLine): void => {
    const amount = round2(line.amount);
    if (amount === 0) return;
    lines = addLine(lines, { ...line, amount });
    cash = round2(cash + amount);
  };

  // rent runs from the day the lease is signed (the business is created), open or not
  const monthStart = (month - 1) * D + 1;
  const rentDays = Math.max(0, day - Math.max(b.createdDay, monthStart) + 1);
  const rentMult = m.daysAlive > 0 ? m.rentMultSum / m.daysAlive : 1;
  const rent = round2(monthlyRentOf(b, pack, ctx) * rentMult * (rentDays / D));
  add({ id: 'rent', label: 'Rent', kind: 'rent', amount: -rent });

  // payroll from worker-days actually employed this month; a 'wages' event raises or lowers hourly pay (not the manager's salary)
  let payroll = 0;
  let staffDaysTotal = 0;
  for (const role of pack.staff) staffDaysTotal += Math.max(0, m.staffDays[role.id] ?? 0);
  const wagesMult = staffDaysTotal > 0 ? Math.max(0, 1 + (m.wagesExtra ?? 0) / staffDaysTotal) : 1;
  for (const role of pack.staff) {
    const days = m.staffDays[role.id] ?? 0;
    if (days <= 0) continue;
    const wage = role.tipped && role.cashWage != null ? role.cashWage : role.hourlyWage;
    const amt = round2((days / D) * wage * role.hoursPerMonth * wagesMult);
    payroll = round2(payroll + amt);
    const avg = Math.round((days / Math.max(1, m.daysOpen)) * 10) / 10;
    add({ id: `payroll_${role.id}`, label: `${role.name} wages (${avg} on staff)`, kind: 'payroll', amount: -amt });
  }
  if (m.managerDays > 0) {
    const amt = round2(pack.manager.monthlySalary * (m.managerDays / D));
    payroll = round2(payroll + amt);
    add({ id: 'payroll_manager', label: 'Manager salary', kind: 'payroll', amount: -amt });
  }
  const avgStaff = staffDaysTotal / D;

  // monthly costs (rent comes from the place, not from the pack line)
  const utilitiesMult = m.daysOpen > 0 ? m.utilitiesMultSum / m.daysOpen : 1;
  for (const c of pack.monthlyCosts) {
    if (c.kind === 'rent') continue;
    let amt =
      c.basis === 'fixed' ? c.amount * openShare
      : c.basis === 'per_staff' ? c.amount * avgStaff
      : c.basis === 'per_unit' ? c.amount * b.mtd.servedUnits
      : c.basis === 'pct_revenue' ? c.amount * m.revenue
      : c.amount * b.size * openShare;
    if (c.kind === 'utilities') amt *= utilitiesMult;
    add({ id: `cost_${c.id}`, label: c.name, kind: 'opex', amount: -amt });
  }
  if (pack.sizing.cleaningCostPerSizeMonth > 0 && m.daysOpen > 0) {
    add({ id: 'cleaning_size', label: `Cleaning (${b.size} ${pack.sizing.unitName}s)`, kind: 'opex', amount: -pack.sizing.cleaningCostPerSizeMonth * b.size * openShare });
  }
  for (const lever of pack.levers) {
    const opt = lever.options.find((o) => o.id === b.orders.levers[lever.id]) ?? defaultLeverOption(lever.options);
    if (m.daysOpen === 0) continue;
    // charged for the days each option was on (accrued in day.ts): switching to the free option before the close saves nothing
    const atClose = opt && opt.monthlyCost > 0 ? opt.monthlyCost * openShare : 0;
    const due = m.leverCost ? m.leverCost[lever.id] ?? 0 : atClose;
    if (due <= 0) continue;
    const sameAllMonth = opt !== undefined && Math.abs(due - atClose) < 0.005;
    add({ id: `lever_${lever.id}`, label: sameAllMonth ? `${lever.name}: ${opt.label}` : `${lever.name}: charged for the days each option was on`, kind: 'opex', amount: -due });
  }
  // block fund fee (contract §3 step 5); the id contains "blockfund" so the deals module does not charge it twice
  if (b.orders.blockFund && m.daysOpen > 0 && cash >= RULES.BLOCK_FUND_FEE_MONTH) {
    add({ id: 'blockfund', label: 'Block fund fee (cleaning and lights)', kind: 'deal', amount: -RULES.BLOCK_FUND_FEE_MONTH });
  }
  for (const l of hooksFor(b.niche).extraLines?.(b, pack, month) ?? []) add(l);

  // shortcuts: savings now, trails for the law module
  const saving = shortcutSavings({ ...b, cash, mtd: { ...b.mtd, lines } }, ctx, { payroll, revenue: m.revenue, rent, staffCount: avgStaff }, month);
  for (const l of saving.lines) add({ ...l, kind: 'saving' });
  const trails = mergeTrails(b.trails, saving.trails);

  // taxes accrue into liabilities; profit tax uses the books (no savings, no fines) and carries losses forward
  let liabilities = b.liabilities;
  const books = lines.filter((l) => BOOK_KINDS.has(l.kind) && !isFinancingLine(l)).reduce((a, l) => a + l.amount, 0);
  let accruedOther = 0;
  const taxes = applicableTaxes(ctx, pack);
  const taxYtd = { ...(econ.taxYtd ?? {}) };
  const maxStaff = Math.max(econ.maxStaff ?? 0, peakStaff(b, m));
  for (const t of taxes) {
    if (isSalesTax(t) || t.base === 'profit') continue;
    const periods = t.due === 'monthly' ? 1 : t.due === 'quarterly' ? 3 : 12;
    const base = t.base === 'payroll' ? payroll : t.base === 'rent' ? rent : t.base === 'revenue' ? m.revenue : 0;
    let amt = round2(t.base === 'fixed' ? (m.daysOpen > 0 ? t.rate / periods : 0) : t.rate * base);
    const wb = t.base === 'payroll' ? wageBase(ctx, t.id) : null;
    if (wb !== null) amt = round2(Math.max(0, Math.min(amt, t.rate * wb * maxStaff - (taxYtd[t.id] ?? 0))));
    if (amt <= 0) continue;
    taxYtd[t.id] = round2((taxYtd[t.id] ?? 0) + amt);
    accruedOther = round2(accruedOther + amt);
    liabilities = accrue(liabilities, t.id, amt, dueDayFor(t, month, ctx));
  }
  const preTax = books - accruedOther;
  let carry = econ.lossCarry;
  let taxable = 0;
  if (preTax > 0) { taxable = Math.max(0, preTax - carry); carry = Math.max(0, carry - preTax); } else carry = round2(carry - preTax);
  let accruedProfit = 0;
  for (const t of taxes) {
    if (t.base !== 'profit' || taxable <= 0) continue;
    const amt = round2(t.rate * taxable);
    accruedProfit = round2(accruedProfit + amt);
    liabilities = accrue(liabilities, t.id, amt, dueDayFor(t, month, ctx));
  }

  // pay what is due today (monthly taxes and anything overdue)
  const before: BusinessState = withEcon({ ...b, cash, trails, liabilities, mtd: { ...b.mtd, lines } }, econ);
  const paidState = payDue(before, ctx, pack, day, feed, inbox, w);
  const paidNow = round2(econOf(paidState).mtd.taxesPaid - m.taxesPaid);
  lines = paidState.mtd.lines;
  cash = paidState.cash;

  const sumKinds = (k: PnlLine['kind']): number => lines.filter((l) => l.kind === k).reduce((a, l) => a + l.amount, 0);
  const profit = round2(books + sumKinds('saving') + sumKinds('fine') - accruedOther - accruedProfit);
  const report: MonthReport = {
    month,
    avgPrice: b.mtd.servedUnits > 0 ? round2(m.revenue / b.mtd.servedUnits) : b.orders.price,
    demandUnits: b.mtd.demandUnits, servedUnits: b.mtd.servedUnits, lost: { ...b.mtd.lost },
    capacityUnits: Math.round(m.capacityUnits),
    sizeUtilization: m.utilDays > 0 ? Math.round((m.utilSum / m.utilDays) * 1000) / 1000 : 0,
    lines, revenue: round2(m.revenue), profit, cashStart: econ.cashStart, cashEnd: cash,
    taxesAccrued: round2(m.salesTax + accruedOther + accruedProfit), taxesPaid: round2(m.taxesPaid + paidNow),
    fines: round2(-sumKinds('fine')), quality: b.quality, reputation: b.reputation, netWorth: 0, rankInNiche: 0,
  };
  const econNext: EconExtra = { ...econ, lossCarry: carry, cashStart: cash, mtd: emptyMtd(), taxYtd, maxStaff };
  const closed: BusinessState = withEcon({
    ...paidState,
    staffPrev: { ...b.orders.staff },   // headcount at the end of the month, for niche hooks (e.g. a barber who left)
    history: [...b.history, report],
    mtd: { lines: [], demandUnits: 0, servedUnits: 0, lost: { size: 0, staff: 0, closure: 0 } },
  }, econNext);
  report.netWorth = netWorthOf(closed, ctx);
  return closed;
}

/**
 * After the whole month close (deals and law may add lines and move cash), the next month starts from the cash that
 * is left minus the lines already written into the new month: then the lines of every month add up to its change of cash.
 */
export function syncMonthStart(w: WorldState): WorldState {
  return {
    ...w,
    businesses: w.businesses.map((b) => {
      const econ = econOf(b);
      const start = round2(b.cash - b.mtd.lines.reduce((a, l) => a + l.amount, 0));
      return econ.cashStart === start ? b : withEcon(b, { ...econ, cashStart: start });
    }),
  };
}

/** Most workers on staff at once this month: the orders now, or the average if it was higher. */
function peakStaff(b: BusinessState, m: EconExtra['mtd']): number {
  const now = Object.values(b.orders.staff).reduce((a, n) => a + Math.max(0, n), 0);
  const avg = m.daysOpen > 0 ? Object.values(m.staffDays).reduce((a, n) => a + n, 0) / m.daysOpen : 0;
  return m.daysOpen > 0 ? Math.max(now, Math.ceil(avg)) : 0;
}

function mergeTrails(old: readonly ViolationTrail[], updated: readonly ViolationTrail[]): ViolationTrail[] {
  const out = old.slice();
  for (const t of updated) {
    const i = out.findIndex((x) => x.violationId === t.violationId);
    if (i < 0) out.push(t); else out[i] = t;
  }
  return out;
}
