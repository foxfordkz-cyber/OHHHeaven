import { useState } from 'react';
import type { DayReport, Recommendation } from '@ohh/shared/types';
import { Button, Card, Stat } from './__stubs__/ui';
import { applyAll, applyRecommendation, pendingNotices, type ApplyResult } from './actions';
import type { BizDeps, BizTabId } from './deps';
import { dayLabel, effectIsGood, effectText, multChange, num, relDay, shortDate, signedUsd, usd, WEATHER_ICON } from './format';
import { NoticeCard } from './NoticeCard';
import { chartSeries, lostReasons, lostTotal, pickDays, topRecommendations, upcomingEvents } from './today';
import { SetupPanel } from './StatusScreens';

export function TodayTab({ deps, onRule, onGo }: { deps: BizDeps; onRule(id: string): void; onGo(tab: BizTabId): void }) {
  const v = deps.view;
  const b = v.business!;
  const packs = { pack: deps.pack, common: deps.common };
  const today = v.world.day;
  const notices = v.notices;

  return (
    <div className="bz-pad">
      {b.status === 'closed' && (
        <Card tone="bad" title={`Closed until ${b.closedUntilDay ? dayLabel(b.closedUntilDay) : 'further notice'}`}>
          <p>The city closed you after an inspection. Rent and wages still run; every customer is turned away until you reopen.</p>
        </Card>
      )}
      {notices.map((n) => (
        <NoticeCard key={n.caseId} notice={n} packs={packs} today={today} onAnswer={deps.act} onRule={onRule} />
      ))}
      {b.status === 'setup' ? <SetupPanel deps={deps} onRule={onRule} /> : <Sales days={b.days} worldDay={today} unitName={deps.pack?.sizing.unitName ?? 'seat'} unit={deps.pack?.unit.name ?? 'order'} />}
      <Recommendations deps={deps} onRule={onRule} />
      <Ahead deps={deps} />
      {pendingNotices(notices).length === 0 && v.deals.some((d) => d.status === 'proposed' && d.toBusinessId === b.id) && (
        <Card title="An offer is waiting" aside="Network">
          <Button onClick={() => onGo('network')}>Answer the offer</Button>
        </Card>
      )}
    </div>
  );
}

function dayStats(d: DayReport | null, unit: string) {
  if (!d) return null;
  return (
    <div className="bz-stats">
      <Stat label={`${unit[0].toUpperCase()}${unit.slice(1)}s sold`} value={num(d.servedUnits)} />
      <Stat label="Sales" value={usd(d.revenue)} />
      <Stat label="Walked away" value={num(lostTotal(d.lost))} tone={lostTotal(d.lost) > 0 ? 'bad' : 'neutral'} />
    </div>
  );
}

function Sales({ days, worldDay, unitName, unit }: { days: DayReport[]; worldDay: number; unitName: string; unit: string }) {
  const { today, yesterday } = pickDays(days, worldDay);
  const main = today ?? yesterday;
  const reasons = main ? lostReasons(main.lost, { unitName }) : [];
  return (
    <>
      <Card title={today ? 'Today' : 'Latest day'} aside={main ? dayLabel(main.day) : undefined}>
        {main ? dayStats(main, unit) : <p className="bz-muted">No sales yet.</p>}
        {reasons.map((r) => (
          <p key={r.key} className="bz-bad-text"><b>{num(r.units)}</b> walked away: {r.text}</p>
        ))}
        {main?.notes.map((n, i) => <p key={i} className="bz-note">{n}</p>)}
        {today && yesterday && (
          <details className="bz-details">
            <summary className="bz-small bz-muted">Yesterday, {dayLabel(yesterday.day)}: {num(yesterday.servedUnits)} sold · {usd(yesterday.revenue)} · {num(lostTotal(yesterday.lost))} walked away</summary>
            {lostReasons(yesterday.lost, { unitName }).map((r) => <p key={r.key} className="bz-small">{num(r.units)} walked away: {r.text}</p>)}
            {yesterday.notes.map((n, i) => <p key={i} className="bz-note">{n}</p>)}
          </details>
        )}
      </Card>
      <Card title="Last 30 days" aside={<span className="bz-legend"><span><i className="bz-swatch" style={{ background: 'var(--bz-accent)' }} />sold</span><span><i className="bz-swatch" style={{ background: 'var(--bz-bad)' }} />walked away</span></span>}>
        <Chart30 days={days} />
      </Card>
    </>
  );
}

export function Chart30({ days }: { days: DayReport[] }) {
  const s = chartSeries(days);
  if (!s.length) return <p className="bz-muted">The chart fills up once you are open.</p>;
  const max = Math.max(1, ...s.map((x) => x.served + x.lost));
  const W = 300, H = 100, slot = W / 30, bw = slot - 2;
  return (
    <svg className="bz-chart" viewBox={`0 0 ${W} ${H + 14}`} role="img" aria-label="Sold and walked away, last 30 days" preserveAspectRatio="none">
      {s.map((x, i) => {
        const hs = (x.served / max) * H;
        const hl = (x.lost / max) * H;
        const left = (30 - s.length + i) * slot + 1;
        return (
          <g key={x.day}>
            <title>{`${dayLabel(x.day)}: ${x.served} sold, ${x.lost} walked away`}</title>
            <rect className="served" x={left} y={H - hs} width={bw} height={hs} rx={1.5} />
            {x.lost > 0 && <rect className="lost" x={left} y={H - hs - hl} width={bw} height={hl} rx={1.5} />}
          </g>
        );
      })}
      <text x={0} y={H + 12} fontSize={9} fill="currentColor" opacity={0.6}>{shortDate(s[0].day)}</text>
      <text x={W} y={H + 12} fontSize={9} fill="currentColor" opacity={0.6} textAnchor="end">{shortDate(s[s.length - 1].day)}</text>
    </svg>
  );
}

function Recommendations({ deps, onRule }: { deps: BizDeps; onRule(id: string): void }) {
  const recs = topRecommendations(deps.view.recommendations);
  const [results, setResults] = useState<Record<string, ApplyResult>>({});
  const [busy, setBusy] = useState(false);
  if (!recs.length) return null;
  const record = (rs: ApplyResult[]) => setResults((old) => ({ ...old, ...Object.fromEntries(rs.map((r) => [r.id, r])) }));
  const pending = recs.filter((r) => r.suggested && !results[r.id]?.ok);

  const one = async (r: Recommendation) => { setBusy(true); record([await applyRecommendation(deps, r)]); setBusy(false); };
  const all = async () => { setBusy(true); record(await applyAll(deps, pending)); setBusy(false); };

  return (
    <Card title="What to change" aside={pending.length > 1 ? <Button variant="primary" disabled={busy || !deps.online} onClick={all}>Apply all</Button> : undefined}>
      {recs.map((r) => {
        const res = results[r.id];
        return (
          <div key={r.id} className={`bz-card bz-tone-${r.severity === 'critical' ? 'bad' : r.severity === 'warn' ? 'warn' : 'info'}`}>
            <div className="bz-between">
              <b>{r.title}</b>
              {r.impact && <span className={`bz-amt ${r.impact.profitDeltaMonth >= 0 ? 'bz-good-text' : 'bz-bad-text'}`}>{signedUsd(r.impact.profitDeltaMonth)}/mo</span>}
            </div>
            <p className="bz-small">{r.text}</p>
            <div className="bz-row bz-wrap">
              {r.suggested && (res?.ok
                ? <span className="bz-good-text bz-small">Applied ✓ {r.suggested.type === 'set_orders' ? 'from tomorrow' : ''}</span>
                : <Button disabled={busy || !deps.online} onClick={() => one(r)}>Apply</Button>)}
              {r.ruleCardId && <Button variant="ghost" onClick={() => onRule(r.ruleCardId!)}>The rule</Button>}
              {res && !res.ok && <span className="bz-bad-text bz-small" role="alert">{res.error}</span>}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function Ahead({ deps }: { deps: BizDeps }) {
  const v = deps.view;
  const b = v.business!;
  const today = v.world.day;
  const week = v.weather.filter((w) => w.day > today).slice(0, 7);
  const events = upcomingEvents(v.events, b.niche, today);
  return (
    <Card title="What's ahead">
      {week.length > 0 && (
        <div className="bz-week" aria-label="Weather this week">
          {week.map((w) => (
            <div key={w.day} title={w.label}>
              <div className="bz-muted">{dayLabel(w.day).slice(0, 3)}</div>
              <div>{WEATHER_ICON[w.condition]}</div>
              <div className="bz-num">{w.tempF}°</div>
              {multChange(w.footTrafficMult) !== '0%' && <div className={w.footTrafficMult > 1 ? 'bz-good-text' : 'bz-bad-text'}>{multChange(w.footTrafficMult)}</div>}
            </div>
          ))}
        </div>
      )}
      {week.length > 0 && <p className="bz-small bz-muted">% — people walking by compared with a normal day.</p>}
      {events.length === 0 && <p className="bz-muted">No city events announced.</p>}
      <div className="bz-list">
        {events.map((e) => (
          <div className="bz-li" key={e.id}>
            <div className="bz-li-main">
              <span className="bz-li-title">{e.title}</span>
              <span className="bz-li-sub">
                {e.startDay <= today ? `Now, until ${dayLabel(e.endDay)}` : `${dayLabel(e.startDay)} (${relDay(e.startDay, today)})${e.endDay > e.startDay ? ` – ${dayLabel(e.endDay)}` : ''}`}
                {e.block ? ` · ${e.block}` : ''}
              </span>
              <span className="bz-small">{e.text}</span>
              <span className="bz-small">
                For you: {e.effects.filter((f) => !f.niches || f.niches.includes(b.niche)).map((f, i) => (
                  <span key={i} className={effectIsGood(f) ? 'bz-good-text' : 'bz-bad-text'}>{i ? ', ' : ''}{effectText(f)}</span>
                ))}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
