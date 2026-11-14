import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PackRuleCard, Query, RealWorldPlan } from '@ohh/shared/types';
import { Button, Card, Icon, RuleCard, Skeleton, useT } from '../../ui';
import { useGame, useOwnerView } from '../../app/store';
import { int, money, nicheName, unitWord } from '../insights/format';
import { decodePlan, planLink, planTokenFromHash } from './plan-link';
import { useRuleCards } from './rulecards';
import { PLAN_PRINT_CSS } from './print';
import { loadProgress, personalOf, progressKey, saveProgress, type ReserveMonths } from './personal';
import { NextRealStep, PlanPlaceBlock, PlanRisks, PlanSummaryBlock, SavingsCheck, StepMine } from './PlanPersonal';
import './plan.css';

export type AskFn = (q: Query) => Promise<unknown>;
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

/** "Three lessons from your season", or as many as the books gave (the plan shows at most three). */
export function lessonsTitle(n: number): string {
  const k = Math.min(3, n);
  return k === 0 ? 'Lessons from your season' : `${['One lesson', 'Two lessons', 'Three lessons'][k - 1]} from your season`;
}

const idx = (order: string[], id: string) => { const i = order.indexOf(id); return i < 0 ? order.length : i; };

/** A text as a sentence: trimmed, with one full stop at the end. */
const sentence = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);

/** First sentence and the rest ("Apply 20 days before. No fee." → ["Apply 20 days before.", "No fee."]). */
export function splitLead(text: string): [string, string] {
  const m = /^(.+?[.!?])\s+(\S[\s\S]*)$/.exec(text.trim());
  return m ? [m[1], m[2]] : [text.trim(), ''];
}

/** A link as it is printed: no scheme, no "www.", no trailing slash. */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

/** "Official page" on screen; on paper the address itself, short, so the reader can type it. */
function PlanLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="plan-link small" href={href} target="_blank" rel="noopener noreferrer" data-url={shortUrl(href)}>
      <span className="plan-link__label">{children}</span>
    </a>
  );
}

/** On screen the whole text; on paper only its first sentence (.plan-more is hidden in print). */
function Lead({ text }: { text: string }) {
  const [lead, rest] = splitLead(text);
  return <>{lead}{rest && <span className="plan-more"> {rest}</span>}</>;
}

/** What the person decided on this page, kept on this device: steps done in real life, savings, months of reserve. */
export function usePlanProgress(plan: RealWorldPlan) {
  const me = useMemo(() => personalOf(plan), [plan]);
  const key = progressKey(plan, me);
  const [state, setState] = useState(() => loadProgress(key));
  useEffect(() => setState(loadProgress(key)), [key]);
  const update = (next: typeof state) => { setState(next); saveProgress(key, next); };
  const done = useMemo(() => new Set(state.done), [state.done]);
  return {
    me, done,
    savings: state.savings ?? null,
    reserveMonths: (state.reserveMonths ?? 6) as ReserveMonths,
    toggle: (id: string) => update({ ...state, done: done.has(id) ? state.done.filter((x) => x !== id) : [...state.done, id] }),
    setSavings: (n: number | null) => update({ ...state, savings: n ?? undefined }),
    setReserve: (m: ReserveMonths) => update({ ...state, reserveMonths: m }),
  };
}

/** The page a person takes home. Everything comes from the RealWorldPlan; the ticks and the savings stay on this device. */
export function PlanView({ plan, cards, actions, day }: { plan: RealWorldPlan; cards: Map<string, PackRuleCard>; actions?: ReactNode; day?: number }) {
  const one = unitWord(plan.niche, 1);
  const many = unitWord(plan.niche, 2);
  const tr = useT();
  const progress = usePlanProgress(plan);
  const { me, done } = progress;
  const suppliers = me && me.supplierOrder.length
    ? [...plan.suppliers].sort((a, b) => idx(me.supplierOrder, a.id) - idx(me.supplierOrder, b.id))
    : plan.suppliers;
  return (
    <article className="plan" aria-label="Your real-world plan">
      <style data-plan-print="">{PLAN_PRINT_CSS}</style>
      <header className="plan-block plan-header">
        <div className="eyebrow">First Year · {nicheName(plan.niche)}</div>
        <h1 className="h1">{tr('Your real-world plan', 'Ваш план для жизни')}</h1>
        <p className="muted">{plan.businessName}{me?.place ? ` at ${me.place.address}` : ''} — built from your season in a learning simulation of real New York rents, permits, wages and taxes.</p>
        {actions}
        <NextRealStep steps={plan.checklist} done={done} />
      </header>

      {me && <PlanSummaryBlock me={me} />}
      {me && <SavingsCheck me={me} savings={progress.savings} reserveMonths={progress.reserveMonths} onSavings={progress.setSavings} onReserve={progress.setReserve} />}
      {me && <PlanRisks me={me} />}
      {me && <PlanPlaceBlock me={me} />}

      <div className="plan-pair">
      <section className="plan-block plan-half" aria-labelledby="plan-budget">
        <h2 id="plan-budget" className="h3">{tr('Money to start', 'Деньги на открытие')}</h2>
        <MoneyTable rows={plan.startupBudget} total={plan.startupTotal} totalLabel={tr('Total to open', 'Всего на открытие')} />
      </section>

      <section className="plan-block plan-half" aria-labelledby="plan-monthly">
        <h2 id="plan-monthly" className="h3">{tr('Every month', 'Каждый месяц')}</h2>
        <MoneyTable rows={plan.monthlyCosts} total={plan.monthlyTotal} totalLabel={tr('Monthly costs', 'Расходы в месяц')} />
        <p className="plan-note">
          <strong>Keep {money(plan.reserveAdvised)} in reserve</strong>{reserveMonths(plan) ? ` — about ${reserveMonths(plan)} of these costs —` : ''} so one slow season does not close you.
          All in, have <strong className="num">{money(plan.startupTotal + plan.reserveAdvised)}</strong> before you sign a lease.
        </p>
      </section>
      </div>

      <section className="plan-block plan-grid" aria-label="Break-even and payback">
        <div><div className="plan-kicker">Break-even</div><div className="plan-big num">{plan.breakEvenUnitsMonth === null ? '—' : int(plan.breakEvenUnitsMonth)}</div><div className="small muted">{plan.breakEvenUnitsMonth === null ? `each ${one} lost money` : `${many} a month · about ${int(plan.breakEvenUnitsMonth / 30)} a day`}</div></div>
        <div><div className="plan-kicker">Payback</div><div className="plan-big num">{plan.paybackMonths === null ? 'not reached' : `${plan.paybackMonths} months`}</div><div className="small muted">at your season’s pace</div></div>
      </section>

      <section className="plan-block plan-long" aria-labelledby="plan-docs">
        <h2 id="plan-docs" className="h3">{tr('Documents, in this order', 'Документы — по порядку')}</h2>
        <ol className="plan-steps">
          {plan.checklist.map((s, i) => (
            <li key={s.id} className="plan-row plan-step" data-done={done.has(s.id) || undefined}>
              <div className="plan-step__title">
                <span className="plan-num" aria-hidden="true">{done.has(s.id) ? <Icon name="check" size={11} /> : i + 1}</span>
                <span className="grow">{s.title}</span>
                <label className="plan-tick no-print"><input type="checkbox" checked={done.has(s.id)} onChange={() => progress.toggle(s.id)} /> <span className="xsmall">{tr('Done in real life', 'Сделано в жизни')}</span></label>
              </div>
              <div className="plan-step__meta small">
                {s.agency && <span>{s.agency}</span>}
                {s.fee !== undefined && <span>{s.fee === 0 ? 'free' : money(s.fee, { cents: s.fee % 1 !== 0 })}</span>}
                {s.waitDays !== undefined && <span>{s.waitDays} {s.waitDays === 1 ? 'day' : 'days'}</span>}
              </div>
              <StepMine mine={me?.steps[s.id]} day={day} />
              {me?.steps[s.id]?.mine
                ? <div className="small muted plan-general"><span className="plan-general__tag">{tr('In general', 'В общем случае')}:</span> <Lead text={s.text} /></div>
                : <div className="small"><Lead text={s.text} /></div>}
              {s.link ? <PlanLink href={s.link}>{tr('Official page', 'Официальная страница')} <Icon name="arrowRight" size={12} /></PlanLink> : <span className="xsmall faint">{tr('No official page in our data yet: ask the agency.', 'Официальной страницы в наших данных пока нет: спросите ведомство.')}</span>}
            </li>
          ))}
        </ol>
      </section>

      <section className="plan-block plan-long" aria-labelledby="plan-suppliers">
        <h2 id="plan-suppliers" className="h3">{tr('Where to find suppliers', 'Где найти поставщиков')}</h2>
        {me && Object.keys(me.supplierWhy).length > 0 && <p className="small muted plan-sub">{tr('The ones your choices need come first.', 'Сначала — те, что нужны под ваши выборы.')}</p>}
        <ul className="plan-suppliers">
          {suppliers.map((s) => (
            <li key={s.id} className="plan-row plan-supplier" data-mine={me?.supplierWhy[s.id] ? '' : undefined}>
              <strong>{s.category}</strong> — {sentence(s.what)} <span className="muted"><Lead text={sentence(s.whereToFind)} />{s.examples && <span className="plan-examples"> Examples: {sentence(s.examples)}</span>}</span>
              {s.link && <> <PlanLink href={s.link}>Link</PlanLink></>}
              {me?.supplierWhy[s.id] && <div className="plan-for-you small"><strong>{tr('For you', 'Вам')}:</strong> {me.supplierWhy[s.id]}</div>}
            </li>
          ))}
        </ul>
      </section>

      <section className="plan-block" aria-labelledby="plan-lessons">
        <h2 id="plan-lessons" className="h3">{lessonsTitle(plan.lessons.length)}</h2>
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

export function PlanScreen({ ask, cards, toast, day }: { ask: AskFn | null; cards?: PackRuleCard[]; toast?: (text: string, tone?: 'info' | 'success' | 'error') => void; day?: number }) {
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
      <PlanView plan={plan} cards={ruleCards} actions={actions} day={fromLink ? undefined : day} />
    </main>
  );
}

export function PlanConnected() {
  const { query, toast } = useGame();
  const view = useOwnerView();
  return <PlanScreen ask={query} toast={toast} day={view?.world.day} />;
}
