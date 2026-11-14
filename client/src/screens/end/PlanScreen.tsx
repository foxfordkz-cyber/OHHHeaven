import { useEffect, useState, type ReactNode } from 'react';
import type { PackRuleCard, Query, RealWorldPlan } from '@shared/types';
import { Button, Card, Icon, RuleCard, Skeleton } from '../../ui';
import { useGame } from '../../app/store';
import { int, money, nicheName, unitWord } from '../insights/format';
import { decodePlan, planLink, planTokenFromHash } from './plan-link';
import { useRuleCards } from './rulecards';
import { PLAN_PRINT_CSS } from './print';
import './plan.css';

type AskFn = (q: Query) => Promise<unknown>;
const unwrap = (res: unknown): RealWorldPlan | null => {
  const v = res && typeof res === 'object' && 'ok' in (res as object) ? (res as { data?: unknown }).data : res;
  return v && typeof v === 'object' && 'startupBudget' in (v as object) ? (v as RealWorldPlan) : null;
};

function MoneyTable({ rows, total, totalLabel }: { rows: { label: string; amount: number }[]; total: number; totalLabel: string }) {
  return (
    <table className="plan-table">
      <tbody>
        {rows.map((r) => <tr key={r.label} className="plan-row"><td>{r.label}</td><td className="num">{money(r.amount)}</td></tr>)}
      </tbody>
      <tfoot><tr className="plan-row plan-total"><td>{totalLabel}</td><td className="num">{money(total)}</td></tr></tfoot>
    </table>
  );
}

/** The reserve in months of the monthly costs shown above it ("2.8 months", "6 months"); null if there is nothing to divide by. */
export function reserveMonths(plan: Pick<RealWorldPlan, 'reserveAdvised' | 'monthlyTotal'>): string | null {
  if (plan.monthlyTotal <= 0 || plan.reserveAdvised <= 0) return null;
  const m = Math.round((plan.reserveAdvised / plan.monthlyTotal) * 10) / 10;
  return `${Number.isInteger(m) ? m : m.toFixed(1)} ${m === 1 ? 'month' : 'months'}`;
}

/** The page a person takes home. Pure: everything comes from the RealWorldPlan. */
export function PlanView({ plan, cards, actions }: { plan: RealWorldPlan; cards: Map<string, PackRuleCard>; actions?: ReactNode }) {
  const one = unitWord(plan.niche, 1);
  const many = unitWord(plan.niche, 2);
  return (
    <article className="plan" aria-label="Your real-world plan">
      <style data-plan-print="">{PLAN_PRINT_CSS}</style>
      <header className="plan-block plan-header">
        <div className="eyebrow">First Year · {nicheName(plan.niche)}</div>
        <h1 className="h1">Your real-world plan</h1>
        <p className="muted">{plan.businessName} — built from your season in a learning simulation of real New York rents, permits, wages and taxes.</p>
        {actions}
      </header>

      <section className="plan-block plan-half" aria-labelledby="plan-budget">
        <h2 id="plan-budget" className="h3">Money to start</h2>
        <MoneyTable rows={plan.startupBudget} total={plan.startupTotal} totalLabel="Total to open" />
      </section>

      <section className="plan-block plan-half" aria-labelledby="plan-monthly">
        <h2 id="plan-monthly" className="h3">Every month</h2>
        <MoneyTable rows={plan.monthlyCosts} total={plan.monthlyTotal} totalLabel="Monthly costs" />
        <p className="plan-note">
          <strong>Keep {money(plan.reserveAdvised)} in reserve</strong>{reserveMonths(plan) ? ` — about ${reserveMonths(plan)} of these costs —` : ''} so one slow season does not close you.
          All in, have <strong className="num">{money(plan.startupTotal + plan.reserveAdvised)}</strong> before you sign a lease.
        </p>
      </section>

      <section className="plan-block plan-grid" aria-label="Break-even and payback">
        <div><div className="plan-kicker">Break-even</div><div className="plan-big num">{plan.breakEvenUnitsMonth === null ? '—' : int(plan.breakEvenUnitsMonth)}</div><div className="small muted">{plan.breakEvenUnitsMonth === null ? `each ${one} lost money` : `${many} a month · about ${int(plan.breakEvenUnitsMonth / 30)} a day`}</div></div>
        <div><div className="plan-kicker">Payback</div><div className="plan-big num">{plan.paybackMonths === null ? 'not reached' : `${plan.paybackMonths} months`}</div><div className="small muted">at your season’s pace</div></div>
      </section>

      <section className="plan-block" aria-labelledby="plan-docs">
        <h2 id="plan-docs" className="h3">Documents, in this order</h2>
        <ol className="plan-steps">
          {plan.checklist.map((s, i) => (
            <li key={s.id} className="plan-row plan-step">
              <div className="plan-step__title"><span className="plan-num" aria-hidden="true">{i + 1}</span>{s.title}</div>
              <div className="plan-step__meta small">
                {s.agency && <span>{s.agency}</span>}
                {s.fee !== undefined && <span>{s.fee === 0 ? 'free' : money(s.fee, { cents: s.fee % 1 !== 0 })}</span>}
                {s.waitDays !== undefined && <span>{s.waitDays} days</span>}
              </div>
              <div className="small">{s.text}</div>
              {s.link && <a className="plan-link small" href={s.link} target="_blank" rel="noopener noreferrer" data-url={s.link}>Official page <Icon name="arrowRight" size={12} /></a>}
            </li>
          ))}
        </ol>
      </section>

      <section className="plan-block" aria-labelledby="plan-suppliers">
        <h2 id="plan-suppliers" className="h3">Where to find suppliers</h2>
        <ul className="plan-suppliers">
          {plan.suppliers.map((s) => (
            <li key={s.id} className="plan-row">
              <strong>{s.category}</strong> — {s.what}. <span className="muted">{s.whereToFind}{s.examples ? ` (${s.examples})` : ''}.</span>
              {s.link && <> <a className="plan-link small" href={s.link} target="_blank" rel="noopener noreferrer" data-url={s.link}>Link</a></>}
            </li>
          ))}
        </ul>
      </section>

      <section className="plan-block" aria-labelledby="plan-lessons">
        <h2 id="plan-lessons" className="h3">Three lessons from your season</h2>
        <ol className="plan-lessons">
          {plan.lessons.slice(0, 3).map((l, i) => {
            const card = l.ruleCardId ? cards.get(l.ruleCardId) : undefined;
            return (
              <li key={l.title} className="plan-row plan-lesson">
                <div className="plan-lesson__head"><span className="plan-num" aria-hidden="true">{i + 1}</span><strong className="grow">{l.title}</strong><span className="num plan-loss">{money(-Math.abs(l.amount))}</span></div>
                <div className="small">{l.lesson}</div>
                {card && <div className="plan-rule"><RuleCard title={card.title} text={card.text} source={card.source} /></div>}
              </li>
            );
          })}
        </ol>
      </section>

      <footer className="plan-block plan-disclaimer small" role="note">
        <Icon name="info" size={14} /> {plan.disclaimer}
      </footer>
    </article>
  );
}

/** Where the plan comes from: a shared link (#plan=…) first, otherwise the real_world_plan query. */
export function usePlan(ask: AskFn | null): { plan: RealWorldPlan | null; loading: boolean; fromLink: boolean } {
  const [state, setState] = useState<{ plan: RealWorldPlan | null; loading: boolean; fromLink: boolean }>({ plan: null, loading: true, fromLink: false });
  useEffect(() => {
    let live = true;
    const token = typeof location !== 'undefined' ? planTokenFromHash(location.hash) : null;
    (async () => {
      if (token) {
        const shared = await decodePlan(token);
        if (shared) return live && setState({ plan: shared, loading: false, fromLink: true });
      }
      if (!ask) return live && setState({ plan: null, loading: false, fromLink: false });
      try {
        const res = await ask({ type: 'real_world_plan' });
        if (live) setState({ plan: unwrap(res), loading: false, fromLink: false });
      } catch {
        if (live) setState({ plan: null, loading: false, fromLink: false });
      }
    })();
    return () => { live = false; };
  }, [ask]);
  return state;
}

export function PlanScreen({ ask, cards, toast }: { ask: AskFn | null; cards?: PackRuleCard[]; toast?: (text: string, tone?: 'info' | 'success' | 'error') => void }) {
  const { plan, loading, fromLink } = usePlan(ask);
  const ruleCards = useRuleCards(cards);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!plan) return;
    const link = await planLink(plan, location.origin);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast?.('Link copied. It opens on any device, no login needed.', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copy this link', link);
    }
  }

  if (loading) return <main className="screen plan-root stack" aria-busy="true"><Skeleton height={120} /><Skeleton height={200} /><Skeleton height={200} /></main>;
  if (!plan) {
    return (
      <main className="screen plan-root">
        <Card title="Your plan is not ready yet" subtitle="It is built from your own business: open one and run it for a month, then come back." />
      </main>
    );
  }
  const actions = (
    <div className="row wrap no-print plan-actions">
      <Button icon="doc" onClick={() => window.print()}>Print / Save as PDF</Button>
      <Button variant="secondary" icon={copied ? 'check' : 'arrowRight'} onClick={() => void copy()}>{copied ? 'Copied' : 'Copy link'}</Button>
      {fromLink && <span className="xsmall faint">Opened from a shared link</span>}
    </div>
  );
  return (
    <main className="screen plan-root">
      <PlanView plan={plan} cards={ruleCards} actions={actions} />
    </main>
  );
}

export function PlanConnected() {
  const { query, toast } = useGame();
  return <PlanScreen ask={query} toast={toast} />;
}
