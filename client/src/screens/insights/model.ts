// Insights view-model: turns an OwnerView into what each card shows. Pure functions, no React.
// The engine (agent 04) computes the numbers; here they are only grouped, labelled and compared.
import type { Benchmark, DayReport, OwnerView, PnlKind, PnlLine } from '@shared/types';
import { dateOf, RULES } from '@shared/rules';
import { compactMoney, int, money, pct, toFraction, unitWord } from './format';
import { monthAbbr, stackBar, type BreakEvenInput, type Segment, type TrendMark, type TrendPoint } from './charts';

export type Tone = 'good' | 'bad' | 'neutral';

// ───────────── headline numbers ─────────────
export interface Stat { key: string; label: string; value: string; sub?: string; tone: Tone; sentence?: string }

export function headline(v: OwnerView): Stat[] {
  const a = v.analytics;
  const b = v.business;
  if (!a || !b) return [];
  const owed = b.liabilities.filter((l) => !l.paid).reduce((s, l) => s + l.amount, 0);
  const fixed = a.fixedCostsMonth;
  return [
    {
      key: 'profit', label: 'Profit this month', value: money(a.profit, { sign: true }), tone: a.profit >= 0 ? 'good' : 'bad',
      sub: `forecast · day ${a.daysIntoMonth} of ${RULES.DAYS_PER_MONTH}`,
    },
    { key: 'cash', label: 'Cash', value: money(b.cash), tone: b.cash > owed ? 'neutral' : 'bad', sub: owed > 0 ? `${money(owed)} of it is tax you owe` : undefined },
    a.cashRunwayMonths === null
      ? { key: 'runway', label: 'Cash runway', value: 'In profit', tone: 'good', sub: fixed > 0 ? `cash covers ${(b.cash / fixed).toFixed(1)} months of fixed costs` : undefined }
      : { key: 'runway', label: 'Cash runway', value: `${a.cashRunwayMonths.toFixed(1)} months`, tone: a.cashRunwayMonths < 2 ? 'bad' : 'neutral', sub: 'until cash runs out at this loss' },
    a.paybackMonths === null
      ? { key: 'payback', label: 'Payback', value: 'Not yet', tone: 'bad', sub: `at this pace the ${compactMoney(a.setupInvested)} you put in does not come back` }
      : { key: 'payback', label: 'Payback', value: `${a.paybackMonths} months`, tone: a.paybackMonths <= 24 ? 'good' : 'neutral', sub: 'at this pace', sentence: `Payback: ${a.paybackMonths} months at this pace` },
  ];
}

// ───────────── break-even ─────────────
export interface BreakEvenModel { input: BreakEvenInput; caption: string; unit: string; ahead: boolean | null }

export function breakEvenModel(v: OwnerView): BreakEvenModel | null {
  const a = v.analytics;
  const b = v.business;
  if (!a || !b) return null;
  const price = a.variableCostPerUnit + a.contributionPerUnit;
  const onTrack = price > 0 ? a.revenue / price : 0;
  const be = a.breakEvenUnitsMonth;
  const unit = unitWord(b.niche, 2);
  const caption = be === null
    ? `Each ${unitWord(b.niche, 1)} costs more than it brings in, so no volume breaks even. Raise the price or cut the cost of a sale.`
    : `You need ${int(be)} ${unit} a month to break even. You are on track for ${int(onTrack)}.`;
  return {
    input: { fixed: a.fixedCostsMonth, variable: a.variableCostPerUnit, price, breakEven: be, onTrack },
    caption, unit, ahead: be === null ? null : onTrack >= be,
  };
}

// ───────────── where the money goes ─────────────
export const COST_GROUPS: { key: string; label: string; kinds: PnlKind[] }[] = [
  { key: 'cogs', label: 'Cost of sales', kinds: ['cogs'] },
  { key: 'labor', label: 'Labor', kinds: ['payroll', 'payroll_tax'] },
  { key: 'rent', label: 'Rent', kinds: ['rent'] },
  { key: 'other', label: 'Other', kinds: ['opex', 'other', 'deal'] },
  { key: 'taxes', label: 'Taxes', kinds: ['tax'] },
  { key: 'fines', label: 'Fines', kinds: ['fine'] },
];

/** Sales tax only passes through the till: the customer pays it, the state gets it. It is not a cost. */
export const isPassThrough = (l: PnlLine): boolean => l.kind === 'setup' || /sales_tax/.test(l.id);

/** Costs of a period by group, as positive dollars. Inflows, setup and pass-through tax are left out. */
export function costGroups(lines: PnlLine[]): { key: string; label: string; amount: number }[] {
  return COST_GROUPS.map((g) => ({
    key: g.key, label: g.label,
    amount: Math.round(lines.filter((l) => g.kinds.includes(l.kind) && l.amount < 0 && !isPassThrough(l)).reduce((s, l) => s - l.amount, 0) * 100) / 100,
  }));
}

const METRIC_LABELS: Record<string, string> = {
  cogsPct: 'Cost of sales', laborPct: 'Labor', rentPct: 'Rent', primeCostPct: 'Prime cost', netMarginPct: 'Net margin',
};
const HIGHER_IS_BETTER = new Set(['netMarginPct']);

export interface BenchmarkRow { metric: string; text: string; short: string; you: string; industry: string; word: string; tone: Tone }

export function benchmarkRow(bm: Benchmark): BenchmarkRow {
  const better = HIGHER_IS_BETTER.has(bm.metric);
  const word = bm.verdict === 'ok' ? 'normal' : (bm.verdict === 'good') === better ? 'high' : 'low';
  const tone: Tone = bm.verdict === 'good' ? 'good' : bm.verdict === 'bad' ? 'bad' : 'neutral';
  const label = METRIC_LABELS[bm.metric] ?? bm.metric;
  const short = `${label} ${pct(bm.you)} · industry ${pct(bm.industry)}`;
  return { metric: bm.metric, you: pct(bm.you), industry: pct(bm.industry), word, tone, short, text: `${short} · ${word}` };
}

export interface CostModel { period: string; segments: Segment[]; total: number; rows: BenchmarkRow[] }

export function costModel(v: OwnerView, width = 358): CostModel | null {
  const b = v.business;
  if (!b) return null;
  const last = b.history[b.history.length - 1];
  const lines = last ? last.lines : b.mtd.lines;
  const groups = costGroups(lines);
  const total = groups.reduce((s, g) => s + g.amount, 0);
  return {
    period: last ? `${monthAbbr(last.month)}, last full month` : 'this month so far',
    segments: stackBar(groups, width), total, rows: (v.analytics?.benchmarks ?? []).map(benchmarkRow),
  };
}

// ───────────── trend ─────────────
export function trendModel(v: OwnerView): { points: TrendPoint[]; marks: TrendMark[] } {
  const b = v.business;
  if (!b) return { points: [], marks: [] };
  const points: TrendPoint[] = b.history.map((m) => ({ month: m.month, revenue: m.revenue, profit: m.profit, cash: m.cashEnd }));
  const a = v.analytics;
  if (a && v.world.phase === 'running' && !b.history.some((m) => m.month === a.month)) {
    points.push({ month: a.month, revenue: a.revenue, profit: a.profit, cash: b.cash, partial: true });
  }
  const monthOf = (day: number) => dateOf(day).month;
  const marks: TrendMark[] = [
    ...v.events.map((e) => ({ month: monthOf(e.startDay), kind: 'event' as const, label: e.title })),
    ...v.feed.filter((f) => f.kind === 'inspection' && f.businessId === b.id).map((f) => ({ month: monthOf(f.day), kind: 'inspection' as const, label: f.text })),
    ...b.history.filter((m) => m.fines > 0).map((m) => ({ month: m.month, kind: 'fine' as const, label: `Fine ${money(m.fines)}` })),
  ];
  return { points, marks };
}

// ───────────── capacity and lost sales ─────────────
const SIZE_REASON: Record<string, string> = {
  cafe: 'Not enough seats', barbershop: 'Not enough chairs', bodega: 'Not enough shelf space', guesthouse: 'No free rooms', rentals: 'No free apartments',
};

export interface CapacityModel {
  headline: string; utilization: number; sizeUtilization: number; lostUnits: number; lostMoney: number;
  reasons: { key: 'size' | 'staff' | 'closure'; label: string; units: number; money: number }[];
  days: DayReport[]; lastMonth: { capacity: number; demand: number } | null;
}

export function capacityModel(v: OwnerView): CapacityModel | null {
  const a = v.analytics;
  const b = v.business;
  if (!a || !b) return null;
  const price = b.orders.price;
  const sum = (k: 'size' | 'staff' | 'closure') => b.days.reduce((s, d) => s + d.lost[k], 0);
  const reasons = ([
    { key: 'size', label: SIZE_REASON[b.niche] ?? 'Not enough room', units: sum('size') },
    { key: 'staff', label: 'Not enough staff', units: sum('staff') },
    { key: 'closure', label: 'Closed after an inspection', units: sum('closure') },
  ] as const).map((r) => ({ ...r, money: Math.round(r.units * price) })).filter((r) => r.units > 0);
  const lostUnits = reasons.reduce((s, r) => s + r.units, 0);
  const lostMoney = reasons.reduce((s, r) => s + r.money, 0);
  const last = b.history[b.history.length - 1];
  const word = unitWord(b.niche, lostUnits);
  return {
    headline: lostUnits > 0 ? `${int(lostUnits)} ${word} lost in the last ${b.days.length} days · ${money(lostMoney)}` : `Nobody was turned away in the last ${b.days.length} days`,
    utilization: a.utilization, sizeUtilization: a.sizeUtilization, lostUnits, lostMoney, reasons, days: b.days,
    lastMonth: last ? { capacity: last.capacityUnits, demand: last.demandUnits } : null,
  };
}

// ───────────── taxes ─────────────
const TAX_LABELS: Record<string, string> = {
  sales_tax: 'Sales tax', income_tax_estimate: 'Estimated income tax', payroll_tax: 'Payroll taxes', ubt: 'NYC unincorporated business tax',
};
export const taxLabel = (id: string): string => TAX_LABELS[id] ?? id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export interface TaxModel {
  owed: number; enough: boolean | null; shortBy: number;
  next: { amount: number; day: number; label: string; inDays: number } | null;
  items: { id: string; label: string; amount: number; due: string }[];
}

export function taxModel(v: OwnerView): TaxModel | null {
  const b = v.business;
  if (!b) return null;
  const unpaid = b.liabilities.filter((l) => !l.paid).sort((x, y) => x.dueDay - y.dueDay);
  const owed = unpaid.reduce((s, l) => s + l.amount, 0);
  const nextRaw = v.analytics?.taxDueNext ?? (unpaid[0] ? { amount: unpaid[0].amount, day: unpaid[0].dueDay } : null);
  const next = nextRaw ? { ...nextRaw, label: dateOf(nextRaw.day).label, inDays: Math.max(0, nextRaw.day - v.world.day) } : null;
  const enough = next ? b.cash >= next.amount : null;
  return {
    owed, next, enough, shortBy: next && !enough ? Math.round(next.amount - b.cash) : 0,
    items: unpaid.map((l) => ({ id: l.taxId, label: taxLabel(l.taxId), amount: l.amount, due: dateOf(l.dueDay).label })),
  };
}

// ───────────── risk ─────────────
export interface RiskModel { exposure: number; saved: number; open: { violationId: string; months: number; saved: number }[]; verdict: string; tone: Tone }

export function riskModel(v: OwnerView): RiskModel | null {
  const a = v.analytics;
  const b = v.business;
  if (!a || !b) return null;
  const open = b.trails.filter((t) => !t.discovered).map((t) => ({ violationId: t.violationId, months: t.months, saved: t.saved }));
  const saved = open.reduce((s, t) => s + t.saved, 0);
  const exposure = a.exposure;
  if (exposure <= 0 && open.length === 0) return { exposure: 0, saved: 0, open, verdict: 'No open violations: an inspection would find nothing.', tone: 'good' };
  const verdict = exposure > saved
    ? `If they find it today you pay ${money(exposure)}: ${money(exposure - saved)} more than you saved.`
    : `You saved ${money(saved)}; fines today would be ${money(exposure)}. The fine grows every month you keep going.`;
  return { exposure, saved, open, verdict, tone: exposure > saved ? 'bad' : 'neutral' };
}

// ───────────── niche KPIs ─────────────
export function kpiValue(value: number, unit: string): string {
  if (unit === '$') return money(value, { cents: value < 100 });
  if (unit === '%') return pct(value);
  return `${Number.isInteger(value) ? int(value) : value.toFixed(1)} ${unit}`;
}

// ───────────── questions for the advisor ─────────────
const SUPPLIER_QUESTION: Record<string, string> = {
  cafe: 'Where do I find a coffee supplier in real life?',
  barbershop: 'Where do I buy barber supplies in real life?',
  bodega: 'Where do corner stores buy wholesale in real life?',
  guesthouse: 'Where do small hotels buy linen and supplies in real life?',
  rentals: 'Where do landlords find contractors in real life?',
};

/** Three questions that fit the player's situation right now, most urgent first. */
export function advisorPresets(v: OwnerView): string[] {
  const b = v.business;
  const a = v.analytics;
  const out: { q: string; score: number }[] = [];
  const add = (q: string, score: number) => out.push({ q, score });
  if (!b) return ['What do I need to open a business in New York?', 'How much money do I need to start?', 'Which permits take the longest?'];
  if (b.status === 'setup') {
    add('What permits do I need before I open?', 3);
    add('Can I open before my permit is ready?', 2);
  }
  const yesterday = b.days[b.days.length - 1];
  if (yesterday && yesterday.lost.size + yesterday.lost.staff + yesterday.lost.closure > 0) add('Why did I lose customers yesterday?', 3);
  if (b.orders.shortcuts.includes('cash_wages')) add('Is paying cash wages worth the risk?', 3);
  else if (b.orders.shortcuts.length > 0) add('Is cutting this corner worth the risk?', 3);
  if (a && a.profit < 0) add('How do I stop losing money?', 3);
  const tax = taxModel(v);
  if (tax?.next && tax.enough === false) add(`How do I pay ${money(tax.next.amount)} of tax due ${tax.next.label}?`, 3);
  add(SUPPLIER_QUESTION[b.niche] ?? 'Where do I find suppliers in real life?', 2);
  if (a?.benchmarks.some((bm) => bm.metric === 'rentPct' && bm.verdict === 'bad')) add('Is my rent too high for this space?', 1);
  add('How can I reach break-even faster?', 0);
  add('What permits do I need in real life?', 0);
  const seen = new Set<string>();
  return out
    .map((x, i) => ({ ...x, i }))
    .sort((x, y) => y.score - x.score || x.i - y.i)
    .filter((x) => !seen.has(x.q) && seen.add(x.q))
    .slice(0, 3)
    .map((x) => x.q);
}

/** Fraction helper re-exported for screens that compare shares. */
export { toFraction };
