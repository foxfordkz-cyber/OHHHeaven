import { useNavigate } from 'react-router-dom';
import type { OwnerView } from '@ohh/shared/types';
import { Badge, Button, Card, Icon, ProgressBar } from '../../ui';
import { useGame, useOwnerView } from '../../app/store';
import { LeaderboardCard } from '../end/Leaderboards';
import { usePackInfo, type PackInfo } from '../end/rulecards';
import { AdvisorCard, type AskFn } from './Advisor';
import { BreakEvenChart, CapacityBars, CostBar, TrendChart } from './Charts';
import { int, money, pct, unitWord } from './format';
import { breakEvenModel, capacityModel, costModel, headline, kpiValue, riskModel, taxModel, trendModel } from './model';
import { StatTile, Tip } from './Tip';
import './insights.css';

export interface InsightsLinks { plan: string; leaderboards: string }
/** Names from the packs (taxes, violations); without them ids are turned into words. */
export type PackNames = Partial<Pick<PackInfo, 'taxName' | 'violationName'>>;
const LINKS: InsightsLinks = { plan: '/end/plan', leaderboards: '/leaderboards' };

function TitleTip({ k, children }: { k: string; children: string }) {
  return <Tip k={k} className="ins-title-tip">{children} <Icon name="info" size={14} /></Tip>;
}

function PlanCta({ href }: { href: string }) {
  const navigate = useNavigate();
  return (
    <Card tone="accent" title="Your real-world plan" subtitle="Budget, documents in order, suppliers and the lessons of your season. Take it with you.">
      <Button block icon="doc" onClick={() => navigate(href)}>Open my plan</Button>
    </Card>
  );
}

/** The Insights tab of /biz: the business seen with an owner's eyes. Shows only numbers from the view. */
export function InsightsTab({ view, ask, links = LINKS, names = {} }: { view: OwnerView; ask: AskFn; links?: InsightsLinks; names?: PackNames }) {
  const navigate = useNavigate();
  const b = view.business;
  if (!b || !view.analytics) {
    return (
      <div className="stack ins">
        <Card title="Analytics start when your doors open" subtitle={b ? 'Rent is already running. Here you will see break-even, payback, costs against the industry and taxes ahead.' : 'Open a business to see its numbers.'} />
        <AdvisorCard view={view} ask={ask} />
        {b && <PlanCta href={links.plan} />}
      </div>
    );
  }
  const a = view.analytics;
  const stats = headline(view);
  const be = breakEvenModel(view);
  const costs = costModel(view);
  const trend = trendModel(view);
  const cap = capacityModel(view);
  const tax = taxModel(view, names.taxName);
  const risk = riskModel(view, names.violationName);
  const unit = unitWord(b.niche, 2);

  return (
    <div className="stack ins">
      <div className="grid-2">
        {stats.map((s) => <StatTile key={s.key} k={s.key} label={s.label} value={s.value} sub={s.sub} tone={s.tone} />)}
      </div>

      <AdvisorCard view={view} ask={ask} />

      {be && (
        <Card title={<TitleTip k="breakEven">Break-even</TitleTip>} subtitle={be.caption} tone={be.ahead === false ? 'warn' : 'default'}>
          <BreakEvenChart input={be.input} caption={be.caption} />
          <div className="ins-facts">
            <Tip k="fixedCostsMonth"><span className="faint">Fixed costs</span> <span className="num">{money(a.fixedCostsMonth)}</span><span className="faint"> a month</span></Tip>
            <Tip k="contributionPerUnit"><span className="faint">Each {unitWord(b.niche, 1)} adds</span> <span className="num">{money(a.contributionPerUnit, { cents: true })}</span></Tip>
            {a.breakEvenPrice !== null && <Tip k="breakEven"><span className="faint">Break-even price at this volume</span> <span className="num">{money(a.breakEvenPrice, { cents: true })}</span></Tip>}
            {a.paybackMonths !== null && <Tip k="payback"><span className="faint">Payback:</span> <span className="num">{a.paybackMonths} months</span><span className="faint"> at this pace</span></Tip>}
          </div>
        </Card>
      )}

      {costs && (
        <Card title={<TitleTip k="costMix">Where your money goes</TitleTip>} subtitle={`Share of all costs · ${costs.period}`}>
          <CostBar segments={costs.segments} />
          {costs.rows.length > 0 && (
            <Tip k="benchmarks" className="ins-bench">
              <span className="small faint">Against the industry, share of sales</span>
              {costs.rows.map((r) => (
                <span key={r.metric} className="ins-bench__row" aria-label={r.text}>
                  <span className="grow">{r.short}</span>
                  <Badge tone={r.tone === 'bad' ? 'loss' : r.tone === 'good' ? 'profit' : 'neutral'}>{r.word}</Badge>
                </span>
              ))}
            </Tip>
          )}
        </Card>
      )}

      <Card title={<TitleTip k="trend">Month by month</TitleTip>} subtitle="Sales, profit and cash at month end; the hollow dot is this month’s forecast">
        <TrendChart points={trend.points} marks={trend.marks} />
      </Card>

      {cap && (
        <Card title={<TitleTip k="lostSales">Capacity and lost sales</TitleTip>} subtitle={cap.headline} tone={cap.lostUnits > 0 ? 'warn' : 'default'}>
          <div className="stack-sm">
            <Tip k="utilization" className="ins-meter">
              <span className="row-between small"><span>Staff load</span><span className="num">{pct(cap.utilization)}</span></span>
              <ProgressBar value={Math.min(1, cap.utilization)} tone={cap.utilization > 0.95 ? 'loss' : 'info'} label={`Staff load ${pct(cap.utilization)}`} />
            </Tip>
            <Tip k="sizeUtilization" className="ins-meter">
              <span className="row-between small"><span>{b.niche === 'cafe' ? 'Seats in use' : 'Room in use'}</span><span className="num">{pct(cap.sizeUtilization)}</span></span>
              <ProgressBar value={Math.min(1, cap.sizeUtilization)} tone={cap.sizeUtilization > 0.9 ? 'warn' : 'info'} label={`Room in use ${pct(cap.sizeUtilization)}`} />
            </Tip>
            {cap.reasons.length > 0 && (
              <ul className="ins-reasons">
                {cap.reasons.map((r) => (
                  <li key={r.key}><span className="grow">{r.label}</span><span className="num">{int(r.units)} {unitWord(b.niche, r.units)}</span><span className="num loss-text">{money(r.money)}</span></li>
                ))}
              </ul>
            )}
            {cap.lastMonth && <span className="xsmall faint">Last month: room and staff could serve {int(cap.lastMonth.capacity)} {unit}; {int(cap.lastMonth.demand)} wanted to buy.</span>}
            <CapacityBars days={cap.days} unit={unit} />
          </div>
        </Card>
      )}

      {tax && (
        <Card title={<TitleTip k="taxes">Taxes ahead</TitleTip>} tone={tax.enough === false ? 'warn' : 'default'}
          subtitle={tax.next ? `${money(tax.next.amount)} due ${tax.next.label} · ${tax.next.inDays === 0 ? 'today' : tax.next.inDays === 1 ? 'tomorrow' : `in ${tax.next.inDays} days`}` : 'Nothing due right now'}>
          {tax.next && (
            <div className={`ins-taxline ${tax.enough ? 'ins-taxline--ok' : 'ins-taxline--short'}`}>
              <Icon name={tax.enough ? 'check' : 'alert'} size={16} />
              {tax.enough ? `Your cash (${money(b.cash)}) covers it.` : `You are ${money(tax.shortBy)} short. Keep the sales tax you collect apart from your cash.`}
            </div>
          )}
          {tax.items.length > 0 && (
            <ul className="ins-reasons">
              {tax.items.map((t) => <li key={t.id + t.due}><span className="grow">{t.label}</span><span className="faint small">{t.due}</span><span className="num">{money(t.amount)}</span></li>)}
            </ul>
          )}
        </Card>
      )}

      {risk && (
        <Card title={<TitleTip k="exposure">Risk</TitleTip>} subtitle={risk.verdict} tone={risk.tone === 'bad' ? 'loss' : 'default'}>
          <div className="grid-2">
            <StatTile k="exposure" label="Fines if found today" value={money(risk.exposure)} tone={risk.exposure > 0 ? 'bad' : 'good'} />
            <StatTile k="savings" label="Saved by cutting corners" value={money(risk.saved)} tone="neutral" sub={risk.open.length ? `${risk.open.length} open violation${risk.open.length > 1 ? 's' : ''}` : undefined} />
          </div>
          {risk.open.length > 0 && (
            <ul className="ins-reasons" aria-label="Open violations">
              {risk.open.map((t) => (
                <li key={t.violationId}>
                  <span className="grow">{t.name}</span>
                  <span className="faint small">{t.months} {t.months === 1 ? 'month' : 'months'}</span>
                  {t.saved > 0 && <span className="num">{money(t.saved)} saved</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {a.nicheKpis.length > 0 && (
        <Card title={<TitleTip k="nicheKpis">Your niche numbers</TitleTip>}>
          <div className="grid-2">
            {a.nicheKpis.map((kpi) => <StatTile key={kpi.id} k="nicheKpis" label={kpi.label} value={kpiValue(kpi.value, kpi.unit)} tone="neutral" />)}
          </div>
        </Card>
      )}

      <LeaderboardCard view={view} onOpen={() => navigate(links.leaderboards)} />
      <PlanCta href={links.plan} />
    </div>
  );
}

/** Bound to the app store: what /biz renders in its Insights tab. */
export function InsightsTabConnected({ links }: { links?: InsightsLinks }) {
  const view = useOwnerView();
  const { query } = useGame();
  const names = usePackInfo();
  if (!view) return <p className="muted">Join the city to see your analytics.</p>;
  return <InsightsTab view={view} ask={query} links={links} names={names} />;
}
