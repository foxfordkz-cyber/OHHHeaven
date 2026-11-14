// SVG charts for the Insights tab. Geometry comes from charts.ts; here it is only drawn. viewBox + width 100%
// keeps every chart readable at 390 px and sharp on any screen.
import { compactMoney, int, money, pct } from './format';
import { breakEvenGeometry, dayBars, trendGeometry, type BreakEvenInput, type Segment, type TrendMark, type TrendPoint } from './charts';

export function BreakEvenChart({ input, caption }: { input: BreakEvenInput; caption: string }) {
  const g = breakEvenGeometry(input);
  const { box } = g;
  const baseY = box.height - box.bottom;
  return (
    <figure className="ins-chart">
      <svg viewBox={`0 0 ${box.width} ${box.height}`} role="img" aria-label={caption}>
        {g.yTicks.map((t) => (
          <g key={`y${t}`}>
            <line className="ins-grid" x1={box.left} x2={box.width - box.right} y1={g.y(t)} y2={g.y(t)} />
            <text className="ins-axis" x={box.left - 6} y={g.y(t) + 3.5} textAnchor="end">{compactMoney(t)}</text>
          </g>
        ))}
        {g.xTicks.map((t) => (
          <text key={`x${t}`} className="ins-axis" x={g.x(t)} y={baseY + 16} textAnchor="middle">{int(t)}</text>
        ))}
        {g.lossArea && <path className="ins-area--loss" d={g.lossArea} />}
        {g.profitArea && <path className="ins-area--profit" d={g.profitArea} />}
        <path className="ins-line ins-line--fixed" d={g.fixed} />
        <path className="ins-line ins-line--cost" d={g.cost} />
        <path className="ins-line ins-line--revenue" d={g.revenue} />
        {g.breakEven && (
          <g>
            <line className="ins-guide" x1={g.breakEven.x} x2={g.breakEven.x} y1={g.breakEven.y} y2={baseY} />
            <circle className="ins-dot ins-dot--be" cx={g.breakEven.x} cy={g.breakEven.y} r={4} />
            <text className="ins-label" x={g.breakEven.x - 6} y={g.breakEven.y - 8} textAnchor="end">break-even {int(g.breakEven.value)}</text>
          </g>
        )}
        <line className="ins-guide ins-guide--here" x1={g.here.x} x2={g.here.x} y1={g.here.y} y2={baseY} />
        <circle className="ins-dot ins-dot--here" cx={g.here.x} cy={g.here.y} r={5} />
        <text className="ins-label ins-label--here" x={Math.min(g.here.x + 6, box.width - box.right - 2)} y={g.here.y + 16} textAnchor={g.here.x > box.width - 90 ? 'end' : 'start'}>
          you are here {int(g.here.value)}
        </text>
      </svg>
      <figcaption className="ins-legend">
        <span><i className="ins-key ins-key--revenue" />Sales</span>
        <span><i className="ins-key ins-key--cost" />All costs</span>
        <span><i className="ins-key ins-key--fixed" />Fixed costs</span>
        <span className="faint">per month</span>
      </figcaption>
    </figure>
  );
}

const SERIES_LABEL = { revenue: 'Sales', profit: 'Profit', cash: 'Cash' } as const;

export function TrendChart({ points, marks }: { points: TrendPoint[]; marks: TrendMark[] }) {
  if (points.length < 2) return <p className="muted small">The chart appears after your second month.</p>;
  const g = trendGeometry(points, marks);
  const { box } = g;
  const baseY = box.height - box.bottom;
  const markRows = new Map<number, number>();
  return (
    <figure className="ins-chart">
      <svg viewBox={`0 0 ${box.width} ${box.height}`} role="img" aria-label="Sales, profit and cash by month">
        {g.yTicks.map((t) => (
          <g key={`y${t}`}>
            <line className={t === 0 ? 'ins-zero' : 'ins-grid'} x1={box.left} x2={box.width - box.right} y1={g.y(t)} y2={g.y(t)} />
            <text className="ins-axis" x={box.left - 6} y={g.y(t) + 3.5} textAnchor="end">{compactMoney(t)}</text>
          </g>
        ))}
        {g.monthLabels.map((m) => (
          <text key={m.label + m.x} className="ins-axis" x={m.x} y={baseY + 16} textAnchor="middle">{m.label}</text>
        ))}
        {g.marks.map((m, i) => {
          const row = markRows.get(m.month) ?? 0;
          markRows.set(m.month, row + 1);
          return (
            <g key={`m${i}`}>
              <line className={`ins-mark ins-mark--${m.kind}`} x1={m.x} x2={m.x} y1={box.top} y2={baseY} />
              <circle className={`ins-markdot ins-markdot--${m.kind}`} cx={m.x} cy={box.top + 2 + row * 8} r={3}><title>{m.label}</title></circle>
            </g>
          );
        })}
        {g.series.map((s) => (
          <g key={s.key}>
            <path className={`ins-line ins-line--${s.key}`} d={s.path} />
            {s.points.map((p) => (
              <circle key={p.month} className={`ins-pt ins-pt--${s.key}${p.partial ? ' ins-pt--partial' : ''}`} cx={p.x} cy={p.y} r={p.partial ? 3.5 : 2.5}>
                <title>{`${SERIES_LABEL[s.key]} ${money(p.value)}${p.partial ? ' (forecast)' : ''}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <figcaption className="ins-legend">
        <span><i className="ins-key ins-key--revenue" />Sales</span>
        <span><i className="ins-key ins-key--profit" />Profit</span>
        <span><i className="ins-key ins-key--cash" />Cash</span>
        <span><i className="ins-key ins-key--event ins-key--dot" />Event</span>
        <span><i className="ins-key ins-key--inspection ins-key--dot" />Inspection</span>
        <span><i className="ins-key ins-key--fine ins-key--dot" />Fine</span>
      </figcaption>
    </figure>
  );
}

export function CostBar({ segments }: { segments: Segment[] }) {
  if (!segments.length) return <p className="muted small">No costs yet.</p>;
  return (
    <div className="ins-costbar">
      <svg viewBox="0 0 358 20" preserveAspectRatio="none" role="img" aria-label={segments.map((s) => `${s.label} ${pct(s.share)}`).join(', ')}>
        {segments.map((s) => <rect key={s.key} className={`ins-seg ins-seg--${s.key}`} x={s.x} y={0} width={s.width} height={20} />)}
      </svg>
      <ul className="ins-costlist">
        {segments.map((s) => (
          <li key={s.key}>
            <i className={`ins-key ins-seg--${s.key}`} />
            <span className="grow">{s.label}</span>
            <span className="num">{money(s.amount)}</span>
            <span className="num ins-share">{pct(s.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CapacityBars({ days, unit }: { days: { day: number; demandUnits: number; servedUnits: number }[]; unit: string }) {
  if (!days.length) return null;
  const { box, bars, y, yMax } = dayBars(days);
  const baseY = box.height - box.bottom;
  return (
    <figure className="ins-chart">
      <svg viewBox={`0 0 ${box.width} ${box.height}`} role="img" aria-label={`Last ${bars.length} days: ${unit} served and lost`}>
        {[0, yMax / 2, yMax].map((t) => (
          <g key={t}>
            <line className="ins-grid" x1={box.left} x2={box.width - box.right} y1={y(t)} y2={y(t)} />
            <text className="ins-axis" x={box.left - 6} y={y(t) + 3.5} textAnchor="end">{int(t)}</text>
          </g>
        ))}
        {bars.map((b) => (
          <g key={b.day}>
            <rect className="ins-bar--served" x={b.x} y={b.servedY} width={b.width} height={b.servedH} rx={1.5}><title>{`Day ${b.day}: ${int(b.served)} served`}</title></rect>
            {b.lostH > 0 && <rect className="ins-bar--lost" x={b.x} y={b.lostY} width={b.width} height={b.lostH} rx={1.5}><title>{`Day ${b.day}: ${int(b.lost)} lost`}</title></rect>}
          </g>
        ))}
        <text className="ins-axis" x={box.left} y={baseY + 16}>30 days ago</text>
        <text className="ins-axis" x={box.width - box.right} y={baseY + 16} textAnchor="end">today</text>
      </svg>
      <figcaption className="ins-legend">
        <span><i className="ins-key ins-key--served" />Served</span>
        <span><i className="ins-key ins-key--lost" />Walked away</span>
        <span className="faint">{unit} a day</span>
      </figcaption>
    </figure>
  );
}
