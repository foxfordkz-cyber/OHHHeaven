// /brief — the return screen. Three answers on one page:
//   what changed while I was away (cash then → now, the month report, what neighbors and the city did),
//   the one decision that waits today (with the price of each answer before the tap),
//   and when the next month report lands (in the live city a game month is one real day).
import { useEffect, useMemo, useState } from 'react';
import type { Ack, Action, OwnerView } from '@ohh/shared/types';
import { dateOf } from '@ohh/shared/rules';
import { Badge, Banner, Button, Card, List, ListRow, MoneyText, Stat, TopBar, formatMoney, formatNumber, useT, type IconName } from '../../ui';
import { readMemory, writeMemory, type BriefMemory } from './memory';
import { calendarFile } from './ics';
import {
  clockAt, happenings, inTime, lookNow, monthLength, monthName, monthNews, myStanding, nextReport, pickDecision, resolveSince, rival, round2, snapshotAway, upcoming,
  type Decision, type DecisionOption, type Happening,
} from './model';

export interface BriefDeps {
  view: OwnerView;
  /** storage key: one brief per mode, world and player */
  memoryKey: string;
  act(a: Action): Promise<Ack>;
  navigate(to: string): void;
  /** businesses that share my passers-by (from the map); null when the map data is not loaded */
  near?: Set<string> | null;
  /** now, for tests */
  now?: () => number;
}

const KIND_ICON: Record<Happening['kind'], IconName> = { money: 'money', deal: 'handshake', case: 'badge', event: 'bell', neighbor: 'store', summary: 'chart', system: 'info' };

export function BriefScreen({ deps }: { deps: BriefDeps }) {
  const tr = useT();
  const { view, memoryKey } = deps;
  const now = deps.now ?? Date.now;
  const [mem, setMem] = useState<BriefMemory>(() => readMemory(memoryKey));

  // The away summary comes once: keep it before the next poll replaces the view.
  useEffect(() => {
    const snap = snapshotAway(view);
    if (!snap) return;
    const cur = readMemory(memoryKey);
    if (cur.away?.toDay === snap.toDay && cur.away.fromDay === snap.fromDay) return;
    const next = { ...cur, away: snap };
    writeMemory(memoryKey, next);
    setMem(next);
  }, [view, memoryKey]);

  const since = useMemo(() => resolveSince(view, mem), [view, mem]);
  const b = view.business;

  if (!b) {
    return (
      <main className="screen stack">
        <TopBar title={tr('Your brief', 'Твоя сводка')} onBack={() => deps.navigate('/')} />
        <Card title={tr('No business yet', 'Бизнеса пока нет')} subtitle={tr('The brief tells you what changed while you were away. Open a coffee shop first.', 'Сводка рассказывает, что изменилось без тебя. Сначала открой кофейню.')}>
          <Button block size="lg" icon="store" onClick={() => deps.navigate('/start')}>{tr('Start my business', 'Открыть свой бизнес')}</Button>
        </Card>
      </main>
    );
  }

  const today = view.world.day;
  const days = Math.max(0, today - since.day);
  const items = happenings(view, since, deps.near ?? null, 12);
  const news = monthNews(view, since);
  const standing = myStanding(view);
  const board = view.leaderboards[b.niche] ?? [];
  const rv = rival(view);
  const next = nextReport(view);
  const ahead = upcoming(view);
  const decision = pickDecision(view);

  const finish = () => {
    const look = lookNow(view);
    if (!look) return;
    const m: BriefMemory = { look };
    writeMemory(memoryKey, m);
    setMem(m);
  };

  const sinceLine = since.source === 'away' || since.source === 'look'
    ? days > 0
      ? tr(`${days === 1 ? '1 day' : `${formatNumber(days)} days`} since you were here · ${dateOf(since.day).label} → ${view.world.date.label}`, `Прошло дней: ${formatNumber(days)} · ${dateOf(since.day).label} → ${view.world.date.label}`)
      : tr(`You are up to date · ${view.world.date.label}`, `Всё прочитано · ${view.world.date.label}`)
    : since.source === 'month'
      ? tr(`Since ${monthName(dateOf(since.day + 1).month)} began · ${view.world.date.label}`, `С начала месяца (${monthName(dateOf(since.day + 1).month)}) · ${view.world.date.label}`)
      : view.world.date.label;

  return (
    <main className="screen stack" aria-label={tr('Your brief', 'Твоя сводка')}>
      <TopBar title={tr('While you were away', 'Пока тебя не было')} onBack={() => deps.navigate('/')} />
      <p className="small muted" style={{ margin: 0 }}><strong>{b.name}</strong> · {sinceLine}</p>

      <CashCard cashThen={since.cash} cashNow={b.cash} rankThen={since.rank} rankNow={standing?.rank ?? null} boardSize={board.length} />

      {decision && <DecisionCard decision={decision} deps={deps} cash={b.cash} />}

      {news && <MonthCard news={news} />}

      <HappenedCard items={items} />

      {rv && standing && (
        <Card title={tr('Your rival', 'Твой соперник')} subtitle={rv.above
          ? tr(`${rv.name} is #${rv.rank}, ${formatMoney(rv.gap)} of net worth ahead of you.`, `${rv.name} — №${rv.rank}, впереди тебя на ${formatMoney(rv.gap)} стоимости.`)
          : tr(`You lead. ${rv.name} (#${rv.rank}) is ${formatMoney(-rv.gap)} behind.`, `Ты впереди. ${rv.name} (№${rv.rank}) отстаёт на ${formatMoney(-rv.gap)}.`)}>
          <div className="grid-2">
            <Stat label={tr('Your place', 'Твоё место')} value={`#${standing.rank} / ${formatNumber(board.length)}`} />
            <Stat label={tr('Prize forecast', 'Прогноз приза')} value={standing.prize ? <MoneyText value={standing.prize} /> : prizeLine(standing.rank, view.world.config.nichePrizeTable.length, tr)} />
          </div>
          <Button variant="secondary" icon="users" onClick={() => deps.navigate('/biz/network')}>{tr('See the neighbors', 'К соседям')}</Button>
        </Card>
      )}

      <NextCard next={next} ahead={ahead} length={monthLength(view)} now={now} onDone={finish} done={since.source === 'look' && days === 0} />
    </main>
  );
}

const SHOW_FIRST = 4;

function HappenedCard({ items }: { items: Happening[] }) {
  const tr = useT();
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, SHOW_FIRST);
  return (
    <Card title={tr('What happened', 'Что случилось')} subtitle={items.length ? undefined : tr('A quiet stretch: no letters, offers or inspections.', 'Тихо: ни писем, ни предложений, ни проверок.')}>
      {items.length > 0 && (
        <List>
          {shown.map((h) => (
            <ListRow key={h.id} icon={KIND_ICON[h.kind]} iconTone={h.tone} title={h.title} subtitle={`${dateOf(h.day).label}${h.text ? ` · ${h.text}` : ''}`} />
          ))}
        </List>
      )}
      {items.length > SHOW_FIRST && (
        <Button variant="ghost" onClick={() => setAll(!all)}>{all ? tr('Show less', 'Свернуть') : tr(`Show all ${items.length}`, `Показать все (${items.length})`)}</Button>
      )}
    </Card>
  );
}

/** No prize forecast for this place: say how far the prize places are. */
function prizeLine(rank: number, prizePlaces: number, tr: (en: string, ru: string) => string): string {
  if (rank <= prizePlaces) return tr('In the prizes', 'В призах');
  const gap = rank - prizePlaces;
  return tr(`${gap} ${gap === 1 ? 'place' : 'places'} to a prize`, `До приза мест: ${gap}`);
}

function CashCard({ cashThen, cashNow, rankThen, rankNow, boardSize }: { cashThen: number | null; cashNow: number; rankThen: number | null; rankNow: number | null; boardSize: number }) {
  const tr = useT();
  const delta = cashThen === null ? null : round2(cashNow - cashThen);
  const moved = rankThen !== null && rankNow !== null ? rankThen - rankNow : 0;
  return (
    <Card tone="accent" aria-label={tr('Cash then and now', 'Касса тогда и сейчас')}>
      <div className="grid-2">
        <Stat label={tr('Cash then', 'Касса тогда')} value={cashThen === null ? '—' : <MoneyText value={cashThen} tone="none" />} />
        <Stat label={tr('Cash now', 'Касса сейчас')} value={<MoneyText value={cashNow} tone="none" />} hint={delta === null ? undefined : <MoneyText value={delta} signed />} />
      </div>
      {rankNow !== null && (
        <p className="small" style={{ margin: 0 }}>
          {moved > 0
            ? tr(`Up ${moved} ${moved === 1 ? 'place' : 'places'}: now #${rankNow} of ${boardSize}.`, `Выше на ${moved}: теперь №${rankNow} из ${boardSize}.`)
            : moved < 0
              ? tr(`Down ${-moved} ${moved === -1 ? 'place' : 'places'}: now #${rankNow} of ${boardSize}.`, `Ниже на ${-moved}: теперь №${rankNow} из ${boardSize}.`)
              : tr(`#${rankNow} of ${boardSize} in your niche.`, `№${rankNow} из ${boardSize} в нише.`)}
        </p>
      )}
    </Card>
  );
}

function DecisionCard({ decision, deps, cash }: { decision: Decision; deps: BriefDeps; cash: number }) {
  const tr = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<{ option: DecisionOption; error?: string } | null>(null);

  const choose = async (o: DecisionOption) => {
    if (o.to) return deps.navigate(o.to);
    if (!o.action) return;
    setBusy(o.id);
    const ack = await deps.act(o.action);
    setBusy(null);
    setDone({ option: o, error: ack.ok ? undefined : ack.error ?? tr('That did not work. Try again.', 'Не получилось. Попробуй ещё раз.') });
  };

  if (done && !done.error) {
    return (
      <Card tone="profit" title={tr('Done', 'Готово')} subtitle={done.option.result} aria-label={tr('Decision made', 'Решение принято')}>
        <p className="small" style={{ margin: 0 }}>{tr(`Cash now: ${formatMoney(cash)}. The effect shows in the next day report.`, `В кассе: ${formatMoney(cash)}. Результат — в отчёте следующего дня.`)}</p>
        <Button variant="secondary" icon="store" onClick={() => deps.navigate('/biz/today')}>{tr('Open my business', 'Открыть мой бизнес')}</Button>
      </Card>
    );
  }

  const tone = decision.kind === 'restart' ? 'loss' : decision.kind === 'notice' || decision.kind === 'closed' ? 'warn' : 'default';
  const deadline = decision.deadlineDay !== undefined ? <Badge tone="warn" icon="clock">{tr(`by ${dateOf(decision.deadlineDay).label}`, `до ${dateOf(decision.deadlineDay).label}`)}</Badge> : undefined;
  return (
    <Card tone={tone} title={decision.title} subtitle={decision.text} action={deadline} aria-label={tr('Decision for today', 'Решение на сегодня')}>
      <p className="xsmall faint" style={{ margin: 0 }}>{tr('Your decision today', 'Твоё решение сегодня')}</p>
      <div className="stack-sm">
        {decision.options.map((o) => (
          <div key={o.id} className="stack-sm">
            <Button block variant={o.primary ? 'primary' : 'secondary'} loading={busy === o.id} disabled={busy !== null && busy !== o.id} onClick={() => void choose(o)}>{o.label}</Button>
            <p className="xsmall muted" style={{ margin: 0 }}>{o.result}</p>
          </div>
        ))}
      </div>
      {done?.error && <Banner>{done.error}</Banner>}
    </Card>
  );
}

function MonthCard({ news }: { news: NonNullable<ReturnType<typeof monthNews>> }) {
  const tr = useT();
  const r = news.report;
  const change = news.prev ? round2(r.profit - news.prev.profit) : null;
  const perDay = Math.round(r.servedUnits / 30);
  const lost = r.lost.size + r.lost.staff + r.lost.closure;
  return (
    <Card title={tr(`${monthName(r.month)} report`, `Отчёт за ${monthName(r.month)}`)} action={news.fresh ? <Badge tone="accent">{tr('New', 'Новый')}</Badge> : undefined} tone={r.profit >= 0 ? 'default' : 'loss'}>
      <div className="grid-3">
        <Stat small label={tr('Revenue', 'Выручка')} value={<MoneyText value={r.revenue} tone="none" />} />
        <Stat small label={tr('Profit', 'Прибыль')} value={<MoneyText value={r.profit} signed />} hint={change === null ? undefined : tr(`${formatMoney(change, { signed: true })} vs last month`, `${formatMoney(change, { signed: true })} к прошлому`)} />
        <Stat small label={tr('Orders a day', 'Заказов в день')} value={formatNumber(perDay)} />
      </div>
      {lost > 0 && (
        <p className="small muted" style={{ margin: 0 }}>
          {tr(`${formatNumber(lost)} customers walked away (${formatNumber(r.lost.size)} no seat, ${formatNumber(r.lost.staff)} no staff, ${formatNumber(r.lost.closure)} closed).`, `Ушли без покупки: ${formatNumber(lost)} (нет места — ${formatNumber(r.lost.size)}, не хватило персонала — ${formatNumber(r.lost.staff)}, закрыто — ${formatNumber(r.lost.closure)}).`)}
        </p>
      )}
    </Card>
  );
}

function NextCard({ next, ahead, length, now, onDone, done }: { next: ReturnType<typeof nextReport>; ahead: ReturnType<typeof upcoming>; length: string; now: () => number; onDone(): void; done: boolean }) {
  const tr = useT();
  const when = next.ms === null ? tr('when the city resumes', 'когда город снова пойдёт') : `${inTime(next.ms)} · ${clockAt(next.ms, now())}`;
  const ics = next.ms === null || next.seasonOver ? null : calendarFile(next, now());
  return (
    <Card title={next.seasonOver ? tr('The season is over', 'Сезон окончен') : tr(`Next: the ${monthName(next.month)} report`, `Дальше: отчёт за ${monthName(next.month)}`)} subtitle={next.seasonOver ? tr('See the final standings and your personal plan.', 'Смотри итоги и свой личный план.') : `${tr(`Lands ${when}.`, `Придёт ${when}.`)} ${length}`}>
      {ahead.length > 0 && (
        <List>
          {ahead.map((u) => (
            <ListRow key={u.id} icon="clock" iconTone="info" title={u.title} subtitle={`${dateOf(u.day).label}${u.ms === null ? '' : ` · ${inTime(u.ms)}`}`} />
          ))}
        </List>
      )}
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {!done && <Button icon="check" onClick={onDone}>{tr('Got it, see you tomorrow', 'Понятно, до завтра')}</Button>}
        {ics && <a className="btn btn--secondary" href={ics.href} download={ics.name}>{tr('Remind me', 'Напомнить')}</a>}
      </div>
      {done && <p className="small muted" style={{ margin: 0 }}>{tr('Saved. Next time this page starts from here.', 'Сохранено. В следующий раз сводка начнётся отсюда.')}</p>}
    </Card>
  );
}
