// Chart geometry for the Insights tab: pure functions, no React, no DOM. Everything is in SVG
// user units of a viewBox, so a chart drawn for width 358 scales to any phone width.

export interface Scale {
  (v: number): number;
  domain: [number, number];
  range: [number, number];
}

export function linear(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const f = ((v: number) => round1(r0 + ((v - d0) / span) * (r1 - r0))) as Scale;
  f.domain = domain;
  f.range = range;
  return f;
}

export const round1 = (v: number): number => Math.round(v * 10) / 10;

/** Round up to a tidy axis end (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8 × 10^k) so a chart wastes little width. */
export function niceCeil(v: number): number {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10]) if (v <= m * p + 1e-9) return m * p;
  return 10 * p;
}

/** Tick step: 1, 2, 2.5 or 5 × 10^k. */
function niceStep(v: number): number {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p + 1e-9) return m * p;
  return 10 * p;
}

export function ticks(max: number, count = 4): number[] {
  const step = niceStep(max / count);
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(round1(v));
  return out;
}

export interface Box { width: number; height: number; left: number; right: number; top: number; bottom: number }

export const DEFAULT_BOX: Box = { width: 358, height: 200, left: 44, right: 12, top: 14, bottom: 26 };

const inner = (b: Box) => ({ x0: b.left, x1: b.width - b.right, y0: b.height - b.bottom, y1: b.top });

// ───────────── Break-even: sales a month against fixed costs ─────────────

export interface BreakEvenInput {
  fixed: number;          // fixed costs a month
  variable: number;       // variable cost of one sale
  price: number;          // price of one sale
  breakEven: number | null;
  onTrack: number;        // sales this month at the current pace
}

export interface Marker { x: number; y: number; value: number; label: string }

export interface BreakEvenGeometry {
  box: Box;
  x: Scale; y: Scale;
  xTicks: number[]; yTicks: number[];
  revenue: string; cost: string; fixed: string;      // SVG path data
  profitArea: string | null;                          // polygon between the lines right of break-even
  lossArea: string | null;                            // polygon left of break-even
  breakEven: Marker | null;
  here: Marker;
}

export function breakEvenGeometry(input: BreakEvenInput, box: Box = DEFAULT_BOX): BreakEvenGeometry {
  const { fixed, variable, price } = input;
  const be = input.breakEven !== null && Number.isFinite(input.breakEven) && input.breakEven > 0 ? input.breakEven : null;
  const here = Math.max(0, input.onTrack);
  const xMax = niceCeil(Math.max(be ?? 0, here, 1) * 1.25);
  const revenueAt = (u: number) => price * u;
  const costAt = (u: number) => fixed + variable * u;
  const yMax = niceCeil(Math.max(revenueAt(xMax), costAt(xMax), fixed * 1.2, 1));
  const { x0, x1, y0, y1 } = inner(box);
  const x = linear([0, xMax], [x0, x1]);
  const y = linear([0, yMax], [y0, y1]);
  const line = (a: [number, number], b: [number, number]) => `M${x(a[0])},${y(a[1])} L${x(b[0])},${y(b[1])}`;
  let profitArea: string | null = null;
  let lossArea: string | null = null;
  if (be !== null && be < xMax) {
    profitArea = `M${x(be)},${y(revenueAt(be))} L${x(xMax)},${y(revenueAt(xMax))} L${x(xMax)},${y(costAt(xMax))} Z`;
    lossArea = `M${x(0)},${y(0)} L${x(be)},${y(revenueAt(be))} L${x(0)},${y(costAt(0))} Z`;
  } else {
    lossArea = `M${x(0)},${y(0)} L${x(xMax)},${y(revenueAt(xMax))} L${x(xMax)},${y(costAt(xMax))} L${x(0)},${y(costAt(0))} Z`;
  }
  return {
    box, x, y,
    xTicks: ticks(xMax), yTicks: ticks(yMax),
    revenue: line([0, 0], [xMax, revenueAt(xMax)]),
    cost: line([0, costAt(0)], [xMax, costAt(xMax)]),
    fixed: line([0, fixed], [xMax, fixed]),
    profitArea, lossArea,
    breakEven: be === null ? null : { x: x(be), y: y(revenueAt(be)), value: be, label: 'break-even' },
    here: { x: x(here), y: y(revenueAt(here)), value: here, label: 'you are here' },
  };
}

// ───────────── Trend: revenue, profit and cash by month ─────────────

export interface TrendPoint { month: number; revenue: number; profit: number; cash: number; partial?: boolean }
export interface TrendMark { month: number; kind: 'event' | 'inspection' | 'fine'; label: string }

export interface TrendGeometry {
  box: Box; x: Scale; y: Scale; yTicks: number[];
  series: { key: 'revenue' | 'profit' | 'cash'; path: string; points: { x: number; y: number; value: number; month: number; partial: boolean }[] }[];
  zeroY: number;
  marks: { x: number; kind: TrendMark['kind']; label: string; month: number }[];
  monthLabels: { x: number; label: string }[];
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthAbbr = (m: number): string => MONTH_ABBR[(Math.max(1, m) - 1) % 12];

export function trendGeometry(points: TrendPoint[], marks: TrendMark[] = [], box: Box = DEFAULT_BOX): TrendGeometry {
  const pts = [...points].sort((a, b) => a.month - b.month);
  const values = pts.flatMap((p) => [p.revenue, p.profit, p.cash]);
  const lo = Math.min(0, ...values);
  const hi = Math.max(1, ...values);
  const yMax = niceCeil(hi);
  const yMin = lo < 0 ? -niceCeil(-lo) : 0;
  const { x0, x1, y0, y1 } = inner(box);
  const first = pts[0]?.month ?? 1;
  const last = Math.max(pts[pts.length - 1]?.month ?? 1, first + 1);
  const x = linear([first, last], [x0 + 6, x1 - 6]);
  const y = linear([yMin, yMax], [y0, y1]);
  const keys = ['revenue', 'profit', 'cash'] as const;
  const series = keys.map((key) => {
    const ps = pts.map((p) => ({ x: x(p.month), y: y(p[key]), value: p[key], month: p.month, partial: !!p.partial }));
    return { key, path: ps.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '), points: ps };
  });
  const yTicks = [...new Set([yMin, ...ticks(yMax, 3), ...(yMin < 0 ? [round1(yMin / 2)] : [])])].sort((a, b) => a - b);
  return {
    box, x, y, yTicks, series, zeroY: y(0),
    marks: marks.filter((m) => m.month >= first && m.month <= last).map((m) => ({ x: x(m.month), kind: m.kind, label: m.label, month: m.month })),
    monthLabels: pts.map((p) => ({ x: x(p.month), label: monthAbbr(p.month) })),
  };
}

// ───────────── Cost mix: a 100% bar ─────────────

export interface Segment { key: string; label: string; amount: number; share: number; x: number; width: number }

/** Lay out amounts as one bar of `width`; shares add up to exactly 1 and widths to exactly `width`. */
export function stackBar(parts: { key: string; label: string; amount: number }[], width = 358): Segment[] {
  const positive = parts.filter((p) => p.amount > 0);
  const total = positive.reduce((s, p) => s + p.amount, 0);
  if (total <= 0) return [];
  let x = 0;
  return positive.map((p, i) => {
    const last = i === positive.length - 1;
    const w = last ? round1(width - x) : round1((p.amount / total) * width);
    const seg = { key: p.key, label: p.label, amount: p.amount, share: p.amount / total, x: round1(x), width: w };
    x += w;
    return seg;
  });
}

// ───────────── Capacity: demand against what was served, by day ─────────────

export interface DayBar { day: number; x: number; width: number; servedY: number; servedH: number; lostY: number; lostH: number; demand: number; served: number; lost: number }

export function dayBars(days: { day: number; demandUnits: number; servedUnits: number }[], box: Box = { ...DEFAULT_BOX, height: 120, left: 34 }): { box: Box; y: Scale; bars: DayBar[]; yMax: number } {
  const ds = [...days].sort((a, b) => a.day - b.day).slice(-30);
  const yMax = niceCeil(Math.max(1, ...ds.map((d) => Math.max(d.demandUnits, d.servedUnits))));
  const { x0, x1, y0, y1 } = inner(box);
  const y = linear([0, yMax], [y0, y1]);
  const slot = (x1 - x0) / Math.max(ds.length, 1);
  const width = round1(Math.max(1, slot * 0.72));
  const bars = ds.map((d, i) => {
    const served = Math.min(d.servedUnits, d.demandUnits);
    const lost = Math.max(0, d.demandUnits - served);
    const servedY = y(served);
    const lostY = y(served + lost);
    return {
      day: d.day, x: round1(x0 + i * slot + (slot - width) / 2), width,
      servedY, servedH: round1(y0 - servedY), lostY, lostH: round1(servedY - lostY),
      demand: d.demandUnits, served, lost,
    };
  });
  return { box, y, bars, yMax };
}
