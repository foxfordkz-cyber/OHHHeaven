import { useState } from 'react';
import { dateOf, RULES } from '@ohh/shared/rules';
import type { DayReport, NicheKpi, Recommendation } from '@ohh/shared/types';
import { Button, Card, Stat } from './__stubs__/ui';
import { applyAll, applyRecommendation, pendingNotices, type ApplyResult } from './actions';
import { nextDecision, type Decision } from './decision';
import type { BizDeps, BizTabId } from './deps';
import { signedCount } from './forecast';
import { dayLabel, effectIsGood, effectText, multChange, num, plural, realWait, relDay, shortDate, signedUsd, usd, WEATHER_ICON } from './format';
import { NoticeCard } from './NoticeCard';
import { checkPromise, clearPromise, loadPromise, promiseExpired, type ForecastPromise, type PromiseCheck } from './promise';
import { chartSeries, kpiText, lostReasons, lostTotal, pickDays, topRecommendations, upcomingEvents } from './today';
import { SetupPanel } from './StatusScreens';
import { pick } from '../../ui/i18n';

export function TodayTab({ deps, onRule, onGo }: { deps: BizDeps; onRule(id: string): void; onGo(tab: BizTabId): void }) {
  const v = deps.view;
  const b = v.business!;
  const packs = { pack: deps.pack, common: deps.common };
  const today = v.world.day;
  const notices = v.notices;
  const [promise, setPromise] = useState<ForecastPromise | null>(() => loadPromise(b.id));
  const live = promise && promise.businessId === b.id && !promiseExpired(promise, today) ? promise : null;
  const check = live ? checkPromise(live, b.days, today) : null;
  const decision = nextDecision(v, check);
  const adviceOnTop = decision?.kind === 'advice';
  const open = b.status !== 'setup';

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
      {!open && <SetupPanel deps={deps} onRule={onRule} />}
      {open && live && check && (
        <PromiseCard promise={live} check={check} onGo={onGo} onHide={() => { clearPromise(b.id); setPromise(null); }} />
      )}
      {open && <DayCard deps={deps} kpis={v.analytics?.nicheKpis ?? []} />}
      {decision && (adviceOnTop
        ? <Recommendations deps={deps} onRule={onRule} waiting />
        : <DecisionCard decision={decision} deps={deps} onGo={onGo} />)}
      {open && (
        <Card title="Last 30 days" aside={<span className="bz-legend"><span><i className="bz-swatch" style={{ background: 'var(--bz-accent)' }} />sold</span><span><i className="bz-swatch" style={{ background: 'var(--bz-bad)' }} />walked away</span></span>}>
          <Chart30 days={b.days} />
        </Card>
      )}
      {!adviceOnTop && <Recommendations deps={deps} onRule={onRule} />}
      <Ahead deps={deps} />
      {decision?.kind !== 'offer' && pendingNotices(notices).length === 0 && v.deals.some((d) => d.status === 'proposed' && d.toBusinessId === b.id) && (
        <Card title="An offer is waiting" aside="Network">
          <Button onClick={() => onGo('network')}>Answer the offer</Button>
        </Card>
      )}
    </div>
  );
}

/** When the next game day and the next month report come: the reason to look again tomorrow. */
function NextUp({ deps }: { deps: BizDeps }) {
  const w = deps.view.world;
  const monthEnd = dateOf(w.day).month * RULES.DAYS_PER_MONTH;
  const running = w.phase === 'running' && !w.config.paused;
  return (
    <p className="bz-small bz-muted">
      {running && w.msToNextDay > 0 ? pick(`Next game day ${realWait(w.msToNextDay)}. `, `Следующий игровой день ${realWait(w.msToNextDay).replace('in ', 'через ')}. `) : ''}
      {pick(`Month report on ${shortDate(monthEnd)} (${relDay(monthEnd, w.day)}).`, `Отчёт месяца ${shortDate(monthEnd)} (${relDay(monthEnd, w.day)}).`)}
    </p>
  );
}

/** Today's result and why: sold, sales, walked away with reasons, the niche's own numbers and notes. */
function DayCard({ deps, kpis }: { deps: BizDeps; kpis: NicheKpi[] }) {
  const b = deps.view.business!;
  const worldDay = deps.view.world.day;
  const unitName = deps.pack?.sizing.unitName ?? 'seat';
  const unit = deps.pack?.unit.name ?? 'order';
  const { today, yesterday } = pickDays(b.days, worldDay);
  const main = today ?? yesterday;
  const reasons = main ? lostReasons(main.lost, { unitName }) : [];
  return (
    <Card title={today ? 'Today' : 'Latest day'} aside={main ? dayLabel(main.day) : undefined}>
      {main ? dayStats(main, unit) : <p className="bz-muted">{pick('No sales yet. The first day shows up here.', 'Продаж пока нет. Первый день появится здесь.')}</p>}
      {reasons.map((r) => (
        <p key={r.key} className="bz-bad-text"><b>{num(r.units)}</b> walked away: {r.text}</p>
      ))}
      {main?.notes.map((n, i) => <p key={i} className="bz-note">{n}</p>)}
      {kpis.length > 0 && (
        <div className="bz-stats" aria-label={pick('Numbers of your kind of business', 'Показатели твоего вида бизнеса')}>
          {kpis.map((k) => <Stat key={k.id} label={k.label} value={kpiText(k)} />)}
        </div>
      )}
      {today && yesterday && (
        <details className="bz-details">
          <summary className="bz-small bz-muted">Yesterday, {dayLabel(yesterday.day)}: {num(yesterday.servedUnits)} sold · {usd(yesterday.revenue)} · {num(lostTotal(yesterday.lost))} walked away</summary>
          {lostReasons(yesterday.lost, { unitName }).map((r) => <p key={r.key} className="bz-small">{num(r.units)} walked away: {r.text}</p>)}
          {yesterday.notes.map((n, i) => <p key={i} className="bz-note">{n}</p>)}
        </details>
      )}
      <NextUp deps={deps} />
    </Card>
  );
}

/** The forecast the owner saw at Apply, against the days that ran on the new settings. */
export function PromiseCard({ promise, check, onGo, onHide }: { promise: ForecastPromise; check: PromiseCheck; onGo(tab: BizTabId): void; onHide(): void }) {
  const before = promise.before, after = promise.after;
  const report = shortDate(promise.reportDay);
  const tone = check.status === 'waiting' ? 'info' : check.verdict === 'below' ? 'warn' : check.verdict === 'no_forecast' ? 'neutral' : 'good';
  return (
    <Card tone={tone} title={pick('Your change', 'Твоё изменение')} aside={pick(`applied ${shortDate(promise.appliedDay)}`, `применено ${shortDate(promise.appliedDay)}`)}>
      <p className="bz-small">{promise.changes.join(' · ')}</p>
      {check.status === 'waiting' ? (
        <p>
          {pick(`First day on the new settings: ${dayLabel(check.startDay)}.`, `Первый день на новых настройках: ${dayLabel(check.startDay)}.`)}
          {after ? pick(` Forecast: about ${after.ordersPerDay} a day`, ` Прогноз: около ${after.ordersPerDay} в день`) : ''}
          {after && before ? pick(` (was ${before.ordersPerDay})`, ` (было ${before.ordersPerDay})`) : ''}
          {after && before ? <>, {pick('profit', 'прибыль')} <span className={after.profit - before.profit >= 0 ? 'bz-good-text' : 'bz-bad-text'}>{signedUsd(after.profit - before.profit)}</span>{pick(' per 30 days', ' за 30 дней')}</> : ''}
          {pick('. Come back tomorrow to see if it held.', '. Загляни завтра — сбылось ли.')}
        </p>
      ) : (
        <>
          <p>
            <b>{pick(`${plural(check.days, 'day')} on the new settings: ${num(check.actualPerDay)} a day.`, `Дней на новых настройках: ${check.days}. В среднем ${num(check.actualPerDay)} в день.`)}</b>
            {check.promisedPerDay !== null && <>{' '}{pick(`Forecast was ${num(check.promisedPerDay)}`, `Прогноз был ${num(check.promisedPerDay)}`)} (<span className={check.gap! >= 0 ? 'bz-good-text' : 'bz-bad-text'}>{signedCount(check.gap!)}</span>).</>}
          </p>
          <p className={`bz-small ${check.verdict === 'below' ? 'bz-bad-text' : check.verdict === 'no_forecast' ? 'bz-muted' : 'bz-good-text'}`}>
            {check.verdict === 'on_track' ? pick('On track ✓', 'Идёт по прогнозу ✓')
              : check.verdict === 'above' ? pick('Better than the forecast ✓', 'Лучше прогноза ✓')
                : check.verdict === 'below' ? pick('Below the forecast. Look at the limit in Manage.', 'Ниже прогноза. Посмотри узкое место в «Управлении».')
                  : pick('No forecast was ready when you applied it.', 'Когда ты применил, прогноз ещё не был готов.')}
          </p>
        </>
      )}
      <p className="bz-small bz-muted">{pick(`Weather and city events move single days; the whole month is in the report on ${report}.`, `Погода и события города двигают отдельные дни; весь месяц — в отчёте ${report}.`)}</p>
      <div className="bz-row bz-wrap">
        <Button onClick={() => onGo('manage')}>{pick('Adjust in Manage', 'Поправить в «Управлении»')}</Button>
        <Button variant="ghost" onClick={onHide}>{pick('Hide', 'Скрыть')}</Button>
      </div>
    </Card>
  );
}

/** The one decision waiting today (when it is not a fine notice or a piece of advice: those have their own cards). */
export function DecisionCard({ decision, deps, onGo }: { decision: Exclude<Decision, { kind: 'advice' }>; deps: BizDeps; onGo(tab: BizTabId): void }) {
  const unitName = deps.pack?.sizing.unitName ?? 'seat';
  const role = deps.pack?.staff[0]?.name ?? 'worker';
  const title = pick('Waiting for you', 'Ждёт тебя');
  switch (decision.kind) {
    case 'offer':
      return (
        <Card tone="info" title={title} aside="Network">
          <p>{pick(`${decision.count === 1 ? 'A neighbor sent you an offer' : `${decision.count} offers from neighbors`}. A deal changes your costs or customers for months; an unanswered offer expires.`, `${decision.count === 1 ? 'Сосед прислал предложение' : `Предложений от соседей: ${decision.count}`}. Сделка меняет расходы или поток гостей на месяцы; без ответа предложение сгорает.`)}</p>
          <Button variant="primary" onClick={() => onGo('network')}>{pick('Answer the offer', 'Ответить на предложение')}</Button>
        </Card>
      );
    case 'promise':
      return (
        <Card tone="warn" title={title}>
          <p>{pick(`Your change brought ${num(decision.check.actualPerDay)} a day, the forecast said ${num(decision.check.promisedPerDay ?? 0)}. Find what limits sales and try again.`, `Изменение дало ${num(decision.check.actualPerDay)} в день, прогноз обещал ${num(decision.check.promisedPerDay ?? 0)}. Найди, что ограничивает продажи, и попробуй снова.`)}</p>
          <Button variant="primary" onClick={() => onGo('manage')}>{pick('Open Manage', 'Открыть «Управление»')}</Button>
        </Card>
      );
    case 'lost':
      return (
        <Card tone="warn" title={title}>
          <p>
            <b className="bz-bad-text">{num(decision.units)}</b>{' '}
            {decision.reason === 'staff'
              ? pick(`customers walked away on ${shortDate(decision.day)}: nobody free to serve them. See what one more ${role.toLowerCase()} does to profit before you hire.`, `гостей ушли ${shortDate(decision.day)}: некому было обслужить. Посмотри, что ещё один сотрудник сделает с прибылью, прежде чем нанимать.`)
              : pick(`customers walked away on ${shortDate(decision.day)}: no free ${unitName}. See what more ${unitName}s or a higher price do before you change.`, `гостей ушли ${shortDate(decision.day)}: не было свободного места. Посмотри, что дадут лишние места или цена выше, прежде чем менять.`)}
          </p>
          <Button variant="primary" onClick={() => onGo('manage')}>{decision.reason === 'staff' ? pick('Try more staff', 'Попробовать больше персонала') : pick('Try a change', 'Попробовать изменение')}</Button>
        </Card>
      );
    case 'try':
      return (
        <Card tone="info" title={title}>
          <p>{pick('Nothing urgent today. Try a price or a shift change: every change shows its forecast before you apply it.', 'Сегодня ничего срочного. Попробуй цену или смену: каждое изменение показывает прогноз до того, как ты его применишь.')}</p>
          <Button variant="primary" onClick={() => onGo('manage')}>{pick('Try a change', 'Попробовать изменение')}</Button>
        </Card>
      );
  }
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

function Recommendations({ deps, onRule, waiting = false }: { deps: BizDeps; onRule(id: string): void; waiting?: boolean }) {
  const recs = topRecommendations(deps.view.recommendations);
  const [results, setResults] = useState<Record<string, ApplyResult>>({});
  const [busy, setBusy] = useState(false);
  if (!recs.length) return null;
  const record = (rs: ApplyResult[]) => setResults((old) => ({ ...old, ...Object.fromEntries(rs.map((r) => [r.id, r])) }));
  const pending = recs.filter((r) => r.suggested && !results[r.id]?.ok);

  const one = async (r: Recommendation) => { setBusy(true); record([await applyRecommendation(deps, r)]); setBusy(false); };
  const all = async () => { setBusy(true); record(await applyAll(deps, pending)); setBusy(false); };

  return (
    <Card title={waiting ? pick('What to change — waiting for you', 'Что поменять — ждёт тебя') : 'What to change'} aside={pending.length > 1 ? <Button variant="primary" disabled={busy || !deps.online} onClick={all}>Apply all</Button> : undefined}>
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
