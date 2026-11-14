// /desk — the city official's desk. Reads only OfficialView; every change is an Action.
// Decision here: take a case, take or refuse an owner's money. Answer right away: a line on the case card and the
// points it brings. Why come back tomorrow: inspection results arrive, unclaimed cases go to an AI official, and the
// official right above in the ranking is a few found violations away.
import { useState } from 'react';
import type { Ack, Action, OfficialView, PackSet } from '../../../../shared/src/types';
import { RULES } from '../../../../shared/src/rules';
import { AiBadge, Badge, Banner, Button, Card, Clock, Feed, MoneyText, ProgressBar, RuleCard, Skeleton, Stat } from '../../ui';
import { useCatalog } from '../../app/catalog';
import { useGame, useStoreState, useView } from '../../app/store';
import {
  afterActText, aiTakeoverText, bribeFacts, briberyRule, bribeWarning, closedText, closureOf, deskAct, deskDecision, EMPTY_QUEUE_NEXT,
  EMPTY_QUEUE_TEXT, earningsEstimate, foundLines, NICHE_NAME, noticeText, officialsForCase, ORIGIN_LABEL, ORIGIN_TEXT, POINTS_RULES,
  rankRace, rankRaceText, ROLE_LABEL, ROLE_SCOPE, stageOf, STAGE_LABEL, suspension, takeAvailability, tomorrowLines, totalFine,
  waitingText, type CaseCardMaybe,
} from './logic';
import './desk.css';

export interface DeskConnection {
  /** The last request to the city failed: the picture may be old and actions are paused. */
  offline: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export interface DeskProps {
  view: OfficialView;
  packs: PackSet | null;
  onAct: (a: Action) => unknown;
  connection?: DeskConnection;
}

/** /desk wired to the app store and the catalog. Dev pages and tests pass their own packs. */
export function DeskScreen(props: { packs?: PackSet | null }) {
  const view = useView();
  const state = useStoreState();
  const game = useGame();
  const catalog = useCatalog();
  const packs = props.packs !== undefined ? props.packs : catalog?.packs ?? null;
  const offline = state.status === 'offline';
  if (!view) {
    if (offline) {
      return (
        <main className="screen dk-root" data-screen="desk">
          <Card tone="warn" title="Can't reach the city" subtitle="The desk needs the city's server to show your cases." aria-label="Connection error">
            <div className="stack-sm">
              {state.error && <p className="xsmall muted dk-err">{state.error}</p>}
              <Button onClick={() => void game.refresh()}>Try again</Button>
            </div>
          </Card>
        </main>
      );
    }
    return (
      <main className="screen dk-root" aria-busy="true" data-screen="desk">
        <Skeleton height={140} />
        <div className="dk-grid"><Skeleton height={260} /><Skeleton height={260} /><Skeleton height={260} /></div>
      </main>
    );
  }
  if (view.kind !== 'official') {
    return (
      <main className="screen dk-root" data-screen="desk">
        <h1 className="h2">City official desk</h1>
        <Card title="This desk is for city officials" subtitle="Officials play free: they take cases, find real violations and split part of the bank by points.">
          <a className="btn btn--secondary btn--block" href="/start?as=official">Work for the city</a>
        </Card>
      </main>
    );
  }
  return (
    <Desk
      view={view} packs={packs} onAct={(a) => game.act(a)}
      connection={{ offline, error: state.error, onRetry: () => void game.refresh() }}
    />
  );
}

type Outcome = { ok: boolean; text: string };

/** Sends an action, keeps the button busy while it flies and leaves a line on the case: what happened, or why not. */
function useDeskActions(onAct: (a: Action) => unknown) {
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [outcome, setOutcome] = useState<Record<string, Outcome>>({});
  const run = async (a: Action, caseId: string, card?: CaseCardMaybe) => {
    setBusy((b) => ({ ...b, [caseId]: true }));
    try {
      const ack = (await onAct(a)) as Ack | undefined | unknown;
      const failed = !!ack && typeof ack === 'object' && 'ok' in ack && (ack as Ack).ok === false;
      setOutcome((o) => ({ ...o, [caseId]: failed ? { ok: false, text: `That did not go through: ${(ack as Ack).error ?? 'try again'}.` } : { ok: true, text: afterActText(a, card) } }));
    } catch (e) {
      setOutcome((o) => ({ ...o, [caseId]: { ok: false, text: `That did not go through: ${e instanceof Error ? e.message : String(e)}.` } }));
    } finally {
      setBusy((b) => ({ ...b, [caseId]: false }));
    }
  };
  return { busy, outcome, run };
}

interface Ctx { view: OfficialView; packs: PackSet | null; run: (a: Action, caseId: string, card?: CaseCardMaybe) => void; busy: Record<string, boolean>; outcome: Record<string, Outcome>; frozen: boolean }

/** The second side of the game: work for the city. */
export function Desk({ view, packs, onAct, connection }: DeskProps) {
  const o = view.official;
  const race = rankRace(view);
  const pay = earningsEstimate(view);
  const blocked = suspension(view);
  const feed = [...view.feed].sort((a, b) => b.day - a.day);
  const { busy, outcome, run } = useDeskActions(onAct);
  const frozen = !!connection?.offline;
  const ctx: Ctx = { view, packs, run: (a, id, card) => void run(a, id, card), busy, outcome, frozen };
  const ranking = [...view.ranking].sort((a, b) => b.points - a.points);

  return (
    <main className="screen dk-root" data-screen="desk">
      <div className="dk-top">
        <Card title={`${ROLE_LABEL[o.role]} · ${o.name}`} subtitle={ROLE_SCOPE[o.role]} aria-label="My desk">
          <div className="stack">
            <div className="dk-head">
              <Stat label="Points" value={<span className="num">{o.points}</span>} hint={`${o.casesClosed} cases closed`} />
              <Stat label="Rank" value={race.place ? `#${race.place}` : '—'} hint={`of ${race.of} officials`} />
              <Stat label="Earnings" value={<MoneyText value={pay.amount} />} hint="if the season ended today" />
            </div>
            <p className="xsmall muted dk-pay">
              Officials share {Math.round(view.world.config.officialsShare * 100)}% of the bank (<MoneyText value={pay.pool} /> now) by points at the end of the season{pay.sharePct > 0 ? `; yours is ${pay.sharePct}%` : ''}.
            </p>
            <Clock world={view.world} weather={view.weather[0]} live={!frozen} />
          </div>
        </Card>
        <Today ctx={ctx} />
      </div>

      {frozen && (
        <Banner icon="alert">
          <strong>Connection lost.</strong> Showing the last picture of the city; taking cases and answering offers are paused until it is back.
          {connection?.onRetry && <> <button type="button" className="dk-link" onClick={connection.onRetry}>Try again</button></>}
        </Banner>
      )}
      {!frozen && blocked.blocked && (
        <Banner icon="alert">
          <strong>{blocked.title}.</strong> {blocked.text}
        </Banner>
      )}

      <div className="dk-grid">
        <Card title="Case queue" subtitle={view.queue.length ? `${view.queue.length} waiting` : 'Empty right now'} aria-label="Case queue">
          {view.queue.length === 0 ? (
            <div className="stack-sm dk-empty">
              <p className="small">{blocked.blocked ? 'No cases for you while this lasts.' : 'No cases right now. Cases come from three places:'}</p>
              {!blocked.blocked && (
                <>
                  <ul className="dk-hints">{EMPTY_QUEUE_TEXT.map((t) => <li key={t}>{t}</li>)}</ul>
                  <p className="xsmall muted">{EMPTY_QUEUE_NEXT}</p>
                </>
              )}
            </div>
          ) : (
            <div className="dk-cases">
              {view.queue.map((c) => <QueueCase key={c.caseId} card={c} ctx={ctx} />)}
            </div>
          )}
        </Card>

        <Card title="My cases" subtitle={view.mine.length ? `${view.mine.filter((c) => c.status !== 'closed').length} open` : undefined} aria-label="My cases">
          {view.mine.length === 0 ? (
            <div className="empty">No cases yet. Take one from the queue: the inspection takes {RULES.INSPECTION_DAYS} game day.</div>
          ) : (
            <div className="dk-cases">
              {!packs && view.mine.some((c) => (c.found?.length ?? 0) > 0) && (
                <p className="xsmall muted dk-err">Law names did not load. Fines and points are still the city's numbers.</p>
              )}
              {view.mine.map((c) => <MyCase key={c.caseId} card={c} ctx={ctx} />)}
            </div>
          )}
        </Card>

        <div className="dk-side">
          <Card title="Officials ranking" aria-label="Officials ranking">
            {ranking.length === 0 ? (
              <div className="empty">No officials in the ranking yet. Close a case to get on it.</div>
            ) : (
              <ol className="dk-ranking">
                {ranking.map((r, i) => (
                  <li key={`${r.name}-${i}`} className={`dk-rank${!r.isAi && r.name === o.name ? ' is-me' : ''}`}>
                    <span className="num">#{i + 1}</span>
                    <span className="dk-name">{r.name}{r.isAi && <AiBadge />}</span>
                    <span className="num">{r.points} pts</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="How you earn points" tone="flat" aria-label="How you earn points">
            <ul className="dk-hints">{POINTS_RULES.map((t) => <li key={t}>{t}</li>)}</ul>
          </Card>

          <Card title="City feed" aria-label="City feed">
            <Feed items={feed} max={8} emptyText="Nothing happened in the city yet." />
          </Card>
        </div>
      </div>
    </main>
  );
}

/** Today at the desk: the one decision, the race in the ranking and what tomorrow brings. */
function Today({ ctx }: { ctx: Ctx }) {
  const { view, run, busy, outcome, frozen } = ctx;
  const d = deskDecision(view);
  const race = rankRace(view);
  const card = 'caseId' in d && d.caseId ? ([...view.mine, ...view.queue].find((c) => c.caseId === d.caseId) as CaseCardMaybe | undefined) : undefined;
  const done = card ? outcome[card.caseId] : undefined;
  const f = d.kind === 'bribe' && card ? bribeFacts(card) : null;
  const progress = race.above && race.above.points > 0 ? Math.max(0, Math.min(1, race.points / race.above.points)) : 1;
  return (
    <Card title="Today at the desk" tone="accent" aria-label="Today at the desk">
      <div className="stack dk-today">
        <div className="dk-today__decision">
          <div className="dk-today__k">{d.kind === 'none' ? 'Nothing to decide' : d.kind === 'wait' ? 'Waiting on the city' : 'Your decision'}</div>
          <div className="dk-today__title">{d.title}</div>
          <p className="small muted dk-today__detail">{d.detail}</p>
          {d.kind === 'take' && card && !done && (
            <Button icon="badge" loading={busy[card.caseId]} disabled={frozen || busy[card.caseId]} onClick={() => run(deskAct.takeCase(card.caseId), card.caseId, card)}>Take this case</Button>
          )}
          {d.kind === 'bribe' && card && f && !done && (
            <div className="grid-2">
              <Button variant="danger" disabled={frozen || busy[card.caseId]} onClick={() => run(deskAct.answerBribe(card.caseId, true), card.caseId, card)}>Take {money(f.amount)}</Button>
              <Button disabled={frozen || busy[card.caseId]} onClick={() => run(deskAct.answerBribe(card.caseId, false), card.caseId, card)}>Refuse</Button>
            </div>
          )}
          {done && <Outcome o={done} />}
        </div>
        <div className="dk-today__race">
          <div className="dk-today__k">The race</div>
          <p className="small">{rankRaceText(race)}</p>
          {race.above && <ProgressBar value={progress} label={`${race.points} of ${race.above.points} points`} />}
        </div>
        <div>
          <div className="dk-today__k">Tomorrow</div>
          <ul className="dk-hints">{tomorrowLines(view).map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
    </Card>
  );
}

function Outcome({ o }: { o: Outcome }) {
  return <p className={`small dk-outcome${o.ok ? '' : ' dk-outcome--err'}`} role="note">{o.text}</p>;
}

function CaseHead({ card }: { card: CaseCardMaybe }) {
  const b = card.business;
  return (
    <div className="dk-case__head">
      <strong>{b.name}</strong>
      {b.isAi && <AiBadge />}
      <Badge>{NICHE_NAME[b.niche]}</Badge>
      <Badge tone={card.origin === 'report' ? 'warn' : card.origin === 'flag' ? 'info' : 'neutral'} title={ORIGIN_TEXT[card.origin]}>{ORIGIN_LABEL[card.origin]}</Badge>
    </div>
  );
}

function Hints({ hints }: { hints: string[] }) {
  if (!hints.length) return null;
  return <ul className="dk-hints">{hints.map((h) => <li key={h}>{h}</li>)}</ul>;
}

function QueueCase({ card, ctx }: { card: CaseCardMaybe; ctx: Ctx }) {
  const { view, run, busy, outcome, frozen } = ctx;
  const can = takeAvailability(card, view);
  const done = outcome[card.caseId];
  return (
    <div className="dk-case" data-case={card.caseId}>
      <CaseHead card={card} />
      <div className="xsmall muted">{waitingText(card, view.world.day)} · {aiTakeoverText(card, view.world.day)}</div>
      <Hints hints={card.hints} />
      <div className="row-between">
        <span className="xsmall muted">{can.allowed ? ORIGIN_TEXT[card.origin] : can.reason}</span>
        <Button size="sm" icon="badge" loading={busy[card.caseId]} disabled={!can.allowed || frozen || busy[card.caseId]} title={can.reason} onClick={() => run(deskAct.takeCase(card.caseId), card.caseId, card)}>Take case</Button>
      </div>
      {done && <Outcome o={done} />}
    </div>
  );
}

function MyCase({ card, ctx }: { card: CaseCardMaybe; ctx: Ctx }) {
  const { packs, outcome } = ctx;
  const stage = stageOf(card);
  const lines = foundLines(card, packs);
  const officials = officialsForCase(card, packs).filter((x) => x.realProcess).slice(0, 2);
  const closure = closureOf(card);
  const done = outcome[card.caseId];
  return (
    <div className="dk-case" data-case={card.caseId}>
      <CaseHead card={card} />
      <div>
        <Badge tone={stage === 'bribe' ? 'warn' : stage === 'notice' ? 'accent' : stage === 'closed' ? 'neutral' : 'info'} icon={stage === 'inspecting' ? 'hourglass' : undefined}>
          {stage === 'closed' ? closedText(card) : STAGE_LABEL[stage]}
        </Badge>
      </div>
      {stage === 'inspecting' && (
        <>
          <Hints hints={card.hints} />
          <p className="xsmall muted">The inspection takes {RULES.INSPECTION_DAYS} game day. The result comes to this desk and, if something is found, a fine notice goes to the owner.</p>
        </>
      )}
      {lines.length > 0 && (
        <div className="dk-found" aria-label="What was found">
          {lines.map((l) => (
            <div key={l.id} className="dk-found__row">
              <div className="grow">
                <div className="dk-found__name">{l.name}</div>
                <div className="xsmall muted">{l.law}{l.months > 0 ? ` · ${l.months} mo` : ''}{l.closureDays > 0 ? ` · closed ${l.closureDays} days` : ''}</div>
              </div>
              <MoneyText value={l.fine} />
            </div>
          ))}
          <div className="row-between small">
            <span className="muted">Fine{closure > 0 ? ` · closed for ${closure} days` : ''}</span>
            <strong><MoneyText value={totalFine(card)} /></strong>
          </div>
        </div>
      )}
      {stage === 'notice' && <p className="xsmall muted">{noticeText(card)}</p>}
      {stage === 'bribe' && <BribeOffer card={card} ctx={ctx} />}
      {(stage === 'notice' || stage === 'bribe') && officials.map((x) => (
        <RuleCard key={x.id} title={`How it works in real life: ${x.name}`} text={x.realProcess} source={x.source} />
      ))}
      {done && stage !== 'bribe' && <Outcome o={done} />}
    </div>
  );
}

function BribeOffer({ card, ctx }: { card: CaseCardMaybe; ctx: Ctx }) {
  const { view, packs, run, busy, outcome, frozen } = ctx;
  const f = bribeFacts(card);
  const amount = <MoneyText value={f.amount} />;
  const watchdog = briberyRule(packs).official;
  const done = outcome[card.caseId];
  return (
    <div className="dk-bribe" role="group" aria-label="Offer from the owner">
      <p className="small"><strong>{card.business.name}</strong> offers you {amount} to make the <MoneyText value={f.fine} /> fine go away.</p>
      <ul className="dk-hints">{bribeWarning(card, view, packs).map((t) => <li key={t}>{t}</li>)}</ul>
      <p className="xsmall muted">Answer within {RULES.BRIBE_ANSWER_DAYS} game day; no answer means you refuse.</p>
      <div className="grid-2">
        <Button variant="danger" disabled={frozen || busy[card.caseId]} onClick={() => run(deskAct.answerBribe(card.caseId, true), card.caseId, card)}>Take {money(f.amount)}</Button>
        <Button disabled={frozen || busy[card.caseId]} onClick={() => run(deskAct.answerBribe(card.caseId, false), card.caseId, card)}>Refuse</Button>
      </div>
      {done && <Outcome o={done} />}
      {watchdog?.realProcess && (
        <RuleCard title={`Who catches it in real life: ${watchdog.name}`} text={watchdog.realProcess} source={watchdog.source} law={briberyRule(packs).law} />
      )}
    </div>
  );
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
