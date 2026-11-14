// Rivals and prizes in plain sight (task B18): what needs my answer, who my main rival is, where I stand and how far
// the prize is, and what changed next door with one line on what it means for me. Behavior and data only: the look
// comes from the shared components of client/src/ui.
import { Fragment, useState, type ReactNode } from 'react';
import type { Action, CaseNotice, Deal, OwnerView, PackSet, Place, PublicBusiness } from '../../../../shared/src/types';
import { dateOf } from '../../../../shared/src/rules';
import { AiBadge, Badge, Button, Card, formatDuration, List, ListRow, MoneyText, useT } from './ui';
import { act, formatDistance, money, NICHE_LABEL, termsSummary, trustLabel, type MyReport, type NetworkExtra } from './logic';
import {
  ladderLine, msToMonthClose, nextMonthCloseDay, noticeChoices, offerChoices, reportMove, revealedReporters, teamUpMove,
  type Ladder, type ReportMove, type Rival, type RivalNews, type TeamUpMove,
} from './rivals';
import type { DealKind } from './logic';

type View = OwnerView & { extra?: Partial<NetworkExtra>; myReports?: MyReport[] };

const TONE = { good: 'profit', bad: 'loss', info: 'info' } as const;

/** Real time until the month closes, or the game date when the city is paused. */
function useMonthClose(view: OwnerView): string {
  const tr = useT();
  const ms = msToMonthClose(view);
  const date = dateOf(nextMonthCloseDay(view)).label;
  return ms === null ? tr(`Month closes on ${date}`, `Месяц закроется ${date}`) : tr(`Month closes in ${formatDuration(ms)}`, `Месяц закроется через ${formatDuration(ms)}`);
}

// ───────────── incoming: offers and fine notices, with what each answer does ─────────────

/** Answers shown before «Show all»: the rival card stays on the first phone screen. */
export const INCOMING_FIRST = 1;

export function IncomingCard(props: {
  view: View; packs: PackSet | null; offers: Deal[]; nameOf: (id: string) => PublicBusiness | undefined; onAct: (a: Action) => unknown;
  distanceOf: (id: string) => number | null; onTeamUp: (id: string, kind: DealKind | null) => void; onReport: (id: string) => void;
}) {
  const tr = useT();
  const [all, setAll] = useState(false);
  const { view, offers } = props;
  // the most urgent first: fine notices (silence means you pay), then who reported me, then offers by deadline
  const items: { key: string; node: ReactNode }[] = [
    ...view.notices.filter((n) => n.status === 'notice').map((n) => ({ key: n.caseId, node: <NoticeCard notice={n} view={view} packs={props.packs} onAct={props.onAct} /> })),
    ...revealedReporters(view).flatMap((r) => {
      const biz = props.nameOf(r.businessId);
      if (!biz) return [];
      const team = teamUpMove(view, biz, props.distanceOf(biz.id));
      return [{
        key: r.id,
        node: (
          <div className="nw-offer nw-offer--loss" data-reveal={r.businessId}>
            <div className="nw-offer__head"><strong>{r.title}</strong><span className="xsmall faint nw-push">{dateOf(r.day).label}</span></div>
            <p className="small muted nw-why">{r.text} {tr('Strike back with a report, or turn them into a partner.', 'Ответьте жалобой или сделайте их партнёром.')}</p>
            <TwoMoves team={team} report={reportMove(view, props.packs, biz)} onTeamUp={() => props.onTeamUp(biz.id, team.kind)} onReport={() => props.onReport(biz.id)} />
          </div>
        ),
      }];
    }),
    ...[...offers].sort((x, y) => x.expiresDay - y.expiresDay).map((d) => ({ key: d.id, node: <OfferCard deal={d} view={view} author={props.nameOf(d.fromBusinessId)} onAct={props.onAct} /> })),
  ];
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, INCOMING_FIRST);
  return (
    <Card
      title={tr('Waiting for your answer', 'Ждёт вашего ответа')} tone="accent" aria-label="Waiting for your answer"
      subtitle={tr(`${items.length} to decide`, `Решений: ${items.length}`)}
    >
      <div className="stack">
        {shown.map((x) => <Fragment key={x.key}>{x.node}</Fragment>)}
        {items.length > INCOMING_FIRST && (
          <Button block variant="ghost" onClick={() => setAll((v) => !v)}>
            {all ? tr('Show only the most urgent', 'Только самое срочное') : tr(`Show all ${items.length}`, `Показать все: ${items.length}`)}
          </Button>
        )}
      </div>
    </Card>
  );
}

function OfferCard(props: { deal: Deal; view: OwnerView; author?: PublicBusiness; onAct: (a: Action) => unknown }) {
  const tr = useT();
  const { deal, view, author } = props;
  const [accept, decline] = offerChoices(deal, view);
  const left = deal.expiresDay - view.world.day;
  return (
    <div className="nw-offer" data-deal={deal.id}>
      <div className="nw-offer__head">
        <strong>{author?.name ?? tr('A neighbor', 'Сосед')}</strong>
        {author?.isAi && <AiBadge />}
        <span className="xsmall faint nw-push">{author ? trustLabel(author.trust) : ''}</span>
      </div>
      <div className="nw-offer__terms">{termsSummary(deal.terms)}</div>
      <Choices choices={[accept, decline]} />
      <div className="row-between">
        <Badge tone="warn" icon="hourglass">{left <= 0 ? tr('Expires today', 'Истекает сегодня') : tr(`${left} game ${left === 1 ? 'day' : 'days'} to answer`, `Дней на ответ: ${left}`)}</Badge>
        <div className="row">
          <Button size="sm" variant="secondary" onClick={() => props.onAct(act.answerDeal(deal.id, false))}>{tr('Decline', 'Отказать')}</Button>
          <Button size="sm" onClick={() => props.onAct(act.answerDeal(deal.id, true))}>{tr('Accept', 'Принять')}</Button>
        </div>
      </div>
    </div>
  );
}

function NoticeCard(props: { notice: CaseNotice; view: OwnerView; packs: PackSet | null; onAct: (a: Action) => unknown }) {
  const tr = useT();
  const n = props.notice;
  const [pay, contest] = noticeChoices(n.fine, n.closureDays);
  const left = n.answerByDay - props.view.world.day;
  return (
    <div className="nw-offer nw-offer--loss" data-case={n.caseId}>
      <div className="nw-offer__head">
        <strong>{tr('Fine notice from the city', 'Штраф от города')}</strong>
        <span className="nw-push"><MoneyText value={-n.fine} /></span>
      </div>
      {n.found.length > 0 && <div className="xsmall muted">{n.found.map((f) => violationName(props.packs, f.violationId)).join(' · ')}</div>}
      <Choices choices={[pay, contest]} />
      <div className="row-between">
        <Badge tone="warn" icon="hourglass">{left <= 0 ? tr('Answer today: silence means you pay', 'Ответьте сегодня: молчание — оплата') : tr(`${left} game ${left === 1 ? 'day' : 'days'}; silence means you pay`, `Дней: ${left}; молчание — оплата`)}</Badge>
        <div className="row">
          <Button size="sm" variant="secondary" onClick={() => props.onAct({ type: 'answer_notice', caseId: n.caseId, response: 'contest' })}>{tr('Contest', 'Оспорить')}</Button>
          <Button size="sm" onClick={() => props.onAct({ type: 'answer_notice', caseId: n.caseId, response: 'pay' })}>{tr('Pay', 'Оплатить')}</Button>
        </div>
      </div>
    </div>
  );
}

/** Violation name from the packs (any niche, then common); the id when the packs are not loaded. */
function violationName(packs: PackSet | null, id: string): string {
  const all = packs ? [...Object.values(packs.niches).flatMap((p) => p?.violations ?? []), ...packs.common.violations] : [];
  return all.find((v) => v.id === id)?.name ?? id;
}

function Choices({ choices }: { choices: { label: string; outcome: string }[] }) {
  return (
    <dl className="nw-choices">
      {choices.map((c) => (
        <div key={c.label}><dt>{c.label}</dt><dd>{c.outcome}</dd></div>
      ))}
    </dl>
  );
}

// ───────────── the main rival and the two moves ─────────────

export function RivalCard(props: {
  view: View; packs: PackSet | null; rival: Rival | null; places: Place[]; myNetWorth: number | null;
  onTeamUp: (id: string, kind: DealKind | null) => void; onReport: (id: string) => void; onOpen: (id: string) => void;
}) {
  const tr = useT();
  const { view, rival } = props;
  const me = view.business;
  if (!me) return null;
  if (!rival) {
    return (
      <Card title={tr('Your rival', 'Ваш соперник')} aria-label="Your rival">
        <p className="small muted">{tr(`No other ${NICHE_LABEL[me.niche].toLowerCase()} in the city yet. The first one to open near you shows up here.`, 'Других заведений вашего вида пока нет. Первое, что откроется рядом, появится здесь.')}</p>
      </Card>
    );
  }
  const b = rival.biz;
  const team = teamUpMove(view, b, rival.distanceM);
  const report = reportMove(view, props.packs, b);
  return (
    <Card
      title={tr('Your rival', 'Ваш соперник')} aria-label="Your rival" tone={rival.sharesStreet ? 'warn' : 'default'}
      subtitle={rival.sharesStreet ? tr('Shares your street', 'Делит с вами улицу') : tr('Closest in the table', 'Ближе всех в таблице')}
    >
      <div className="stack">
        <button type="button" className="nw-rival" onClick={() => props.onOpen(b.id)}>
          <span className="nw-rival__name">{b.name}{b.isAi && <AiBadge />}</span>
          <span className="small muted">
            {b.isAi ? tr('Run by AI', 'Ведёт ИИ') : tr(`Run by ${b.ownerName}`, `Владелец: ${b.ownerName}`)} · {formatDistance(rival.distanceM)} {tr('from you', 'от вас')}
          </span>
        </button>
        <HeadToHead view={view} rival={rival} myNetWorth={props.myNetWorth} />
        <p className="small nw-why">{rival.why}</p>
        <TwoMoves team={team} report={report} onTeamUp={() => props.onTeamUp(b.id, team.kind)} onReport={() => props.onReport(b.id)} />
      </div>
    </Card>
  );
}

/** You against them on the four things the city compares: price, reputation, net worth and place. */
function HeadToHead(props: { view: OwnerView; rival: Rival; myNetWorth: number | null }) {
  const tr = useT();
  const me = props.view.business!;
  const b = props.rival.biz;
  const myRank = (props.view.leaderboards[me.niche] ?? []).find((s) => s.businessId === me.id)?.rank ?? null;
  const theirs = props.rival.gap !== null && props.myNetWorth !== null ? props.myNetWorth + props.rival.gap : null;
  const stars = (r: number) => `★ ${(Math.round(Math.max(0, Math.min(1, r)) * 50) / 10).toFixed(1)}`;
  // last value: above 0 — they lead on this line, below 0 — I lead (on price the cheaper one wins walk-ins)
  const rows: [string, string, string, number | null][] = [
    [tr('Price', 'Цена'), `$${me.orders.price.toFixed(2)}`, `$${b.price.toFixed(2)}`, me.orders.price - b.price],
    [tr('Reputation', 'Репутация'), stars(me.reputation), stars(b.reputation), b.reputation - me.reputation],
    [tr('Net worth', 'Стоимость'), props.myNetWorth !== null ? money(props.myNetWorth) : '—', theirs !== null ? money(theirs) : '—', props.rival.gap],
    [tr('Place', 'Место'), myRank ? `#${myRank}` : '—', props.rival.rank ? `#${props.rival.rank}` : '—', myRank && props.rival.rank ? myRank - props.rival.rank : null],
  ];
  const lead = (d: number | null, mine: boolean) => (d === null || Math.abs(d) < 1e-6 ? undefined : (d > 0) !== mine ? 'nw-lead' : undefined);
  return (
    <table className="nw-table nw-h2h" aria-label="You against your rival">
      <thead><tr><th><span className="sr-only">{tr('Line', 'Строка')}</span></th><th>{tr('You', 'Вы')}</th><th>{tr('Them', 'Они')}</th></tr></thead>
      <tbody>
        {rows.map(([label, mine, them, d]) => (
          <tr key={label}><td>{label}</td><td className={lead(d, true)}>{mine}</td><td className={lead(d, false)}>{them}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

/** «Team up» and «Report» side by side, each with what it gives or costs before the tap. */
export function TwoMoves(props: { team: TeamUpMove; report: ReportMove; onTeamUp: () => void; onReport: () => void }) {
  const tr = useT();
  const { team, report } = props;
  return (
    <div className="nw-moves">
      <div className="nw-move">
        <Button block icon="handshake" onClick={props.onTeamUp} disabled={!team.allowed}>{tr('Team up', 'Объединиться')}</Button>
        <div className="xsmall">{team.allowed ? <><strong>{team.name}</strong> · {team.value}</> : <span className="muted">{team.reason}</span>}</div>
      </div>
      <div className="nw-move">
        <Button block variant="danger" icon="flag" onClick={props.onReport} disabled={!report.allowed}>{tr('Report', 'Пожаловаться')}</Button>
        <div className="xsmall">
          {report.allowed ? <><div>{report.ifRight}</div><div className="muted">{report.ifWrong}</div></> : <span className="muted">{report.reason}</span>}
        </div>
      </div>
    </div>
  );
}

// ───────────── the ladder: my place, the prize and who is right above and below ─────────────

export function LadderCard(props: { view: OwnerView; ladder: Ladder | null; onOpen: (id: string) => void }) {
  const tr = useT();
  const { view, ladder } = props;
  const close = useMonthClose(view);
  if (!view.business || !ladder) return null;
  const me = ladder.me;
  const rows = [ladder.cutoff && ladder.above?.businessId !== ladder.cutoff.businessId ? { r: ladder.cutoff, gapTo: true } : null, ladder.above ? { r: ladder.above, gapTo: false } : null, me ? { r: me, gapTo: false } : null, ladder.below ? { r: ladder.below, gapTo: false } : null]
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const niche = NICHE_LABEL[ladder.niche].toLowerCase();
  return (
    <Card
      title={tr('Your place', 'Ваше место')} aria-label="Your place" tone={ladder.toPrize === 0 ? 'profit' : 'default'}
      subtitle={me ? tr(`#${me.rank} of ${ladder.total} ${niche}s`, `#${me.rank} из ${ladder.total}`) : tr('Not ranked yet', 'Пока без места')}
      action={me?.prize !== null && me?.prize !== undefined ? <Badge tone="profit" icon="trophy">{tr('Prize today', 'Приз сегодня')} {money(me.prize, { cents: me.prize < 100 })}</Badge> : undefined}
    >
      <div className="stack">
        <p className="nw-ladderline" role="status">{ladderLine(ladder)}</p>
        {rows.length > 0 && (
          <List>
            {rows.map(({ r }) => (
              <ListRow
                key={r.businessId} onClick={r.mine ? undefined : () => props.onOpen(r.businessId)}
                icon={r.prize !== null ? 'trophy' : undefined} iconTone={r.prize !== null ? 'profit' : undefined}
                title={<span className="nw-name">#{r.rank} {r.mine ? tr(`${r.name} (you)`, `${r.name} (вы)`) : r.name}{r.isAi && <AiBadge />}</span>}
                subtitle={r.mine ? tr('Net worth', 'Стоимость') + ` ${money(r.netWorth)}` : me ? diffText(r.netWorth - me.netWorth, tr) : money(r.netWorth)}
                value={r.prize !== null ? <span className="num small">{money(r.prize, { cents: r.prize < 100 })}</span> : <span className="xsmall faint">{r.isAi ? tr('no prize', 'без приза') : '—'}</span>}
              />
            ))}
          </List>
        )}
        <p className="xsmall muted">
          {tr(`Prize fund for ${niche}s today: ${money(ladder.pool, { cents: ladder.pool < 100 })}, top ${ladder.prizePlaces} owners who are people. Forecast: it grows as people join. `, `Призовой фонд сегодня: ${money(ladder.pool, { cents: ladder.pool < 100 })}, первые ${ladder.prizePlaces} владельца-человека. Прогноз: растёт с каждым новым игроком. `)}
          <strong>{close}</strong>{tr(': net worth and places move most then.', ': тогда места меняются сильнее всего.')}
        </p>
      </div>
    </Card>
  );
}

function diffText(d: number, tr: (en: string, ru: string) => string): string {
  if (Math.abs(d) < 0.5) return tr('Level with you', 'Вровень с вами');
  return d > 0 ? tr(`${money(d)} ahead of you`, `на ${money(d)} впереди`) : tr(`${money(-d)} behind you`, `на ${money(-d)} позади`);
}

// ───────────── the neighbors' feed ─────────────

export function NewsCard(props: { changes: RivalNews[]; news: RivalNews[]; lastDay: number | null; onOpen: (id: string) => void }) {
  const tr = useT();
  const { changes, news } = props;
  return (
    <Card title={tr('Next door', 'По соседству')} subtitle={tr('What happened and what it means for you', 'Что случилось и что это значит для вас')} aria-label="Next door">
      <div className="stack">
        {changes.length > 0 && (
          <>
            <div className="eyebrow">{tr(`Since you last looked (${dateOf(props.lastDay ?? 1).label})`, `С прошлого визита (${dateOf(props.lastDay ?? 1).label})`)}</div>
            <NewsList items={changes} onOpen={props.onOpen} />
          </>
        )}
        {news.length > 0 ? (
          <>
            {changes.length > 0 && <div className="eyebrow">{tr('Neighborhood news', 'Новости района')}</div>}
            <NewsList items={news} onOpen={props.onOpen} />
          </>
        ) : changes.length === 0 && (
          <div className="empty">{tr('Quiet so far. Openings, price changes, inspections and closings near you show up here.', 'Пока тихо. Здесь появятся открытия, смены цен, проверки и закрытия рядом с вами.')}</div>
        )}
        <p className="xsmall muted">{tr('Prices and places are compared with what you saw on your last visit.', 'Цены и места сравниваются с тем, что вы видели в прошлый раз.')}</p>
      </div>
    </Card>
  );
}

function NewsList({ items, onOpen }: { items: RivalNews[]; onOpen: (id: string) => void }) {
  return (
    <List>
      {items.map((n) => (
        <ListRow
          key={n.id} icon={n.icon} iconTone={TONE[n.tone]}
          onClick={n.businessId ? () => onOpen(n.businessId!) : undefined}
          title={n.count && n.count > 1 ? `${n.text} · ${n.count} times` : n.text}
          subtitle={<><span className={`nw-meaning nw-meaning--${n.tone}`}>{n.meaning}</span> <span className="faint">· {dateOf(n.day).label}</span></>}
        />
      ))}
    </List>
  );
}
