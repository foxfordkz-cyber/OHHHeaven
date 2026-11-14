import type { Action, OfficialView, PackSet } from '../../../../shared/src/types';
import { RULES } from '../../../../shared/src/rules';
import { AiBadge, Badge, Banner, Button, Card, Clock, Feed, MoneyText, RuleCard, Skeleton, Stat } from '../network/ui';
import { useCatalog, useGame, useView } from '../network/deps';
import { NICHE_LABEL } from '../network/logic';
import {
  aiTakeoverText, bribeFacts, bribeWarning, closedText, closureOf, deskAct, EMPTY_QUEUE_NEXT, EMPTY_QUEUE_TEXT, earningsEstimate,
  foundLines, noticeText, officialFor, ORIGIN_LABEL, ORIGIN_TEXT, POINTS_RULES, rankOf, ROLE_LABEL, stageOf, STAGE_LABEL,
  suspension, takeAvailability, totalFine, waitingText, type CaseCardMaybe,
} from './logic';
import './desk.css';

export interface DeskProps {
  view: OfficialView;
  packs: PackSet | null;
  onAct: (a: Action) => unknown;
}

/** /desk wired to the app store and the catalog. Dev pages and tests pass their own packs. */
export function DeskScreen(props: { packs?: PackSet | null }) {
  const view = useView();
  const game = useGame();
  const catalog = useCatalog();
  const packs = props.packs !== undefined ? props.packs : catalog?.packs ?? null;
  if (!view) {
    return (
      <main className="screen stack" aria-busy="true">
        <Skeleton height={140} />
        <Skeleton height={260} />
      </main>
    );
  }
  if (view.kind !== 'official') {
    return (
      <main className="screen stack">
        <h1 className="h2">City official desk</h1>
        <Card title="This desk is for city officials" subtitle="Officials play free: they take cases, find real violations and split part of the bank by points.">
          <a className="btn btn--secondary btn--block" href="/start?as=official">Work for the city</a>
        </Card>
      </main>
    );
  }
  return <Desk view={view} packs={packs} onAct={(a) => void game.act(a)} />;
}

/** The second side of the game: work for the city. Reads only OfficialView; every change is an Action. */
export function Desk({ view, packs, onAct }: DeskProps) {
  const o = view.official;
  const rank = rankOf(view);
  const pay = earningsEstimate(view);
  const agency = officialFor(packs, o.role)?.agency;
  const blocked = suspension(view);
  const feed = [...view.feed].sort((a, b) => b.day - a.day);

  return (
    <main className="screen stack" data-screen="desk">
      <Card title={`${ROLE_LABEL[o.role]} · ${o.name}`} subtitle={agency ?? 'City of New York'} aria-label="My desk">
        <div className="stack">
          <div className="dk-head">
            <Stat label="Points" value={<span className="num">{o.points}</span>} hint={`${o.casesClosed} cases closed`} />
            <Stat label="Rank" value={rank.place ? `#${rank.place}` : '—'} hint={`of ${rank.of} officials`} />
            <Stat label="Earnings" value={<MoneyText value={pay.amount} />} hint="if the season ended today" />
          </div>
          <p className="xsmall muted dk-pay">
            Officials share {Math.round(view.world.config.officialsShare * 100)}% of the bank (<MoneyText value={pay.pool} /> now) by points at the end of the season{pay.sharePct > 0 ? `; yours is ${pay.sharePct}%` : ''}.
          </p>
          <Clock world={view.world} weather={view.weather[0]} />
        </div>
      </Card>

      {blocked.blocked && (
        <Banner icon="alert">
          <strong>{blocked.title}.</strong> {blocked.text}
        </Banner>
      )}

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
            {view.queue.map((c) => <QueueCase key={c.caseId} card={c} view={view} onAct={onAct} />)}
          </div>
        )}
      </Card>

      <Card title="My cases" subtitle={view.mine.length ? `${view.mine.filter((c) => c.status !== 'closed').length} open` : undefined} aria-label="My cases">
        {view.mine.length === 0 ? (
          <div className="empty">No cases yet. Take one from the queue: the inspection takes {RULES.INSPECTION_DAYS} game day.</div>
        ) : (
          <div className="dk-cases">
            {view.mine.map((c) => <MyCase key={c.caseId} card={c} view={view} packs={packs} onAct={onAct} />)}
          </div>
        )}
      </Card>

      <Card title="How you earn points" tone="flat" aria-label="How you earn points">
        <ul className="dk-hints">{POINTS_RULES.map((t) => <li key={t}>{t}</li>)}</ul>
      </Card>

      <Card title="Officials ranking" aria-label="Officials ranking">
        <ol className="dk-ranking">
          {[...view.ranking].sort((a, b) => b.points - a.points).map((r, i) => (
            <li key={`${r.name}-${i}`} className={`dk-rank${!r.isAi && r.name === o.name ? ' is-me' : ''}`}>
              <span className="num">#{i + 1}</span>
              <span className="dk-name">{r.name}{r.isAi && <AiBadge />}</span>
              <span className="num">{r.points} pts</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="City feed" aria-label="City feed">
        <Feed items={feed} max={8} emptyText="Nothing happened in the city yet." />
      </Card>
    </main>
  );
}

function CaseHead({ card }: { card: CaseCardMaybe }) {
  const b = card.business;
  return (
    <div className="dk-case__head">
      <strong>{b.name}</strong>
      {b.isAi && <AiBadge />}
      <Badge>{NICHE_LABEL[b.niche]}</Badge>
      <Badge tone={card.origin === 'report' ? 'warn' : card.origin === 'flag' ? 'info' : 'neutral'} title={ORIGIN_TEXT[card.origin]}>{ORIGIN_LABEL[card.origin]}</Badge>
    </div>
  );
}

function Hints({ hints }: { hints: string[] }) {
  if (!hints.length) return null;
  return <ul className="dk-hints">{hints.map((h) => <li key={h}>{h}</li>)}</ul>;
}

function QueueCase({ card, view, onAct }: { card: CaseCardMaybe; view: OfficialView; onAct: (a: Action) => unknown }) {
  const can = takeAvailability(card, view);
  return (
    <div className="dk-case" data-case={card.caseId}>
      <CaseHead card={card} />
      <div className="xsmall muted">{waitingText(card, view.world.day)} · {aiTakeoverText(card, view.world.day)}</div>
      <Hints hints={card.hints} />
      <div className="row-between">
        <span className="xsmall muted">{can.allowed ? ORIGIN_TEXT[card.origin] : can.reason}</span>
        <Button size="sm" icon="badge" disabled={!can.allowed} title={can.reason} onClick={() => onAct(deskAct.takeCase(card.caseId))}>Take case</Button>
      </div>
    </div>
  );
}

function MyCase({ card, view, packs, onAct }: { card: CaseCardMaybe; view: OfficialView; packs: PackSet | null; onAct: (a: Action) => unknown }) {
  const stage = stageOf(card);
  const lines = foundLines(card, packs);
  const official = officialFor(packs, card.role);
  const closure = closureOf(card);
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
      {stage === 'bribe' && <BribeOffer card={card} view={view} packs={packs} onAct={onAct} />}
      {(stage === 'notice' || stage === 'bribe') && official?.realProcess && (
        <RuleCard title={`How it works in real life: ${official.name}`} text={official.realProcess} source={official.source} />
      )}
    </div>
  );
}

function BribeOffer({ card, view, packs, onAct }: { card: CaseCardMaybe; view: OfficialView; packs: PackSet | null; onAct: (a: Action) => unknown }) {
  const f = bribeFacts(card);
  const amount = <MoneyText value={f.amount} />;
  return (
    <div className="dk-bribe" role="group" aria-label="Offer from the owner">
      <p className="small"><strong>{card.business.name}</strong> offers you {amount} to make the <MoneyText value={f.fine} /> fine go away.</p>
      <ul className="dk-hints">{bribeWarning(card, view, packs).map((t) => <li key={t}>{t}</li>)}</ul>
      <p className="xsmall muted">Answer within {RULES.BRIBE_ANSWER_DAYS} game day; no answer means you refuse.</p>
      <div className="grid-2">
        <Button variant="danger" onClick={() => onAct(deskAct.answerBribe(card.caseId, true))}>Take {formatAmount(f.amount)}</Button>
        <Button onClick={() => onAct(deskAct.answerBribe(card.caseId, false))}>Refuse</Button>
      </div>
    </div>
  );
}

const formatAmount = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
