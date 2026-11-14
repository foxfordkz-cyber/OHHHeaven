import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Debrief, OwnerView, PackRuleCard, Query } from '@ohh/shared/types';
import { Badge, Button, Card, Icon, MoneyText, RuleCard, Skeleton } from '../../ui';
import { useGame, useOwnerView } from '../../app/store';
import { money, nicheName, ordinal } from '../insights/format';
import { OriginBadge } from '../insights/Advisor';
import { Leaderboards } from './Leaderboards';
import { myResult } from './prizes';
import { useRuleCards } from './rulecards';
import './end.css';

export type AskFn = (q: Query) => Promise<unknown>;
const unwrap = <T,>(res: unknown): T | null => (res && typeof res === 'object' && 'ok' in (res as object) ? ((res as { data?: T }).data ?? null) : ((res as T) ?? null));

export function useDebrief(ask: AskFn): { debrief: Debrief | null; loading: boolean; failed: boolean } {
  const [state, setState] = useState<{ debrief: Debrief | null; loading: boolean; failed: boolean }>({ debrief: null, loading: true, failed: false });
  useEffect(() => {
    let live = true;
    ask({ type: 'debrief' })
      .then((res) => live && setState({ debrief: unwrap<Debrief>(res), loading: false, failed: !unwrap<Debrief>(res) }))
      .catch(() => live && setState({ debrief: null, loading: false, failed: true }));
    return () => { live = false; };
  }, [ask]);
  return state;
}

export function LostMoney({ items, cards }: { items: Debrief['lostMoneyOn']; cards: Map<string, PackRuleCard> }) {
  return (
    <div className="stack">
      {items.slice(0, 3).map((l, i) => {
        const card = l.ruleCardId ? cards.get(l.ruleCardId) : undefined;
        return (
          <div key={l.title + i} className="end-loss">
            <div className="end-loss__head"><span className="grow h3">{l.title}</span><MoneyText value={-Math.abs(l.amount)} signed /></div>
            <p className="small" style={{ margin: 0 }}>{l.lesson}</p>
            {card && <RuleCard title={card.title} text={card.text} source={card.source} />}
          </div>
        );
      })}
    </div>
  );
}

/** /end — place in the niche, the payout, and the debrief: where the money went, what worked, what to do next time. */
export function EndScreen({ view, ask, cards, planHref = '/end/plan' }: { view: OwnerView; ask: AskFn; cards?: PackRuleCard[]; planHref?: string }) {
  const navigate = useNavigate();
  const result = myResult(view);
  const { debrief, loading, failed } = useDebrief(ask);
  const ruleCards = useRuleCards(cards);
  const ended = view.world.phase === 'ended';
  const testMoney = view.world.config.demo;

  return (
    <main className="screen stack-lg">
      <Card tone="accent" className="end-hero">
        <div className="eyebrow">{ended ? 'Season over' : `Season in progress · ${view.world.date.label}`}</div>
        {result ? (
          <>
            <div className="end-place num" aria-label={`Place ${result.rank}`}>#{result.rank}</div>
            <div className="h3">of {result.of} {nicheName(result.niche).toLowerCase()}</div>
            {result.humans > 0 && result.humans < result.of && <div className="small muted">{ordinal(result.humanRank)} of {result.humans} run by players · prizes go to the top 3 of them</div>}
            <p className="muted" style={{ margin: 'var(--s-2) 0 0' }}>
              {result.payout > 0
                ? <>{result.final ? 'You won' : ended ? 'Your prize:' : 'Prize at this place'} <strong className="num">{money(result.payout, { cents: true })}</strong>{testMoney ? ' in test money' : ''}.</>
                : result.final ? 'No prize this season: only the top 3 human businesses of a niche win.' : 'Top 3 human businesses of each niche win a prize.'}
            </p>
            {!ended && <p className="xsmall faint" style={{ margin: 'var(--s-1) 0 0' }}>The table can still change until the last day of the season.</p>}
          </>
        ) : <p className="muted">You did not run a business this season.</p>}
      </Card>

      <section className="stack" aria-label="Debrief">
        <h2 className="h2" style={{ margin: 0 }}>Where you lost money</h2>
        {debrief && <div className="row"><OriginBadge origin={debrief.origin} /><span className="xsmall faint">Debrief of your season</span></div>}
        {loading && <div className="stack-sm" aria-busy="true"><Skeleton height={72} /><Skeleton height={72} /><Skeleton height={72} /></div>}
        {failed && <p className="muted small"><Icon name="alert" size={14} /> The debrief is not ready yet. Your plan lists the biggest losses from your own books.</p>}
        {debrief && (
          <>
            {debrief.headline && <p className="h3" style={{ margin: 0 }}>{debrief.headline}</p>}
            <LostMoney items={debrief.lostMoneyOn} cards={ruleCards} />
            {debrief.didWell.length > 0 && (
              <Card title="What worked">
                <ul className="end-list">{debrief.didWell.map((d) => <li key={d}>{d}</li>)}</ul>
              </Card>
            )}
            {debrief.nextTime.length > 0 && (
              <Card title="Next time">
                <ol className="end-list">{debrief.nextTime.map((d) => <li key={d}>{d}</li>)}</ol>
              </Card>
            )}
          </>
        )}
      </section>

      <Card tone="accent" title="Your real-world plan" subtitle="Budget, documents in order, suppliers and these lessons — to keep, print or send.">
        <Button block icon="doc" onClick={() => navigate(planHref)}>Open my plan</Button>
      </Card>

      <section className="stack" aria-label="Leaderboards">
        <div className="row-between"><h2 className="h2" style={{ margin: 0 }}>Leaderboards</h2>{testMoney && <Badge>test money</Badge>}</div>
        <Leaderboards view={view} />
      </section>
    </main>
  );
}

export function EndConnected() {
  const view = useOwnerView();
  const { query } = useGame();
  if (!view) return <main className="screen"><p className="muted">Join the city to see your season.</p></main>;
  return <EndScreen view={view} ask={query} />;
}
