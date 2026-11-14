import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { OwnerView } from '@ohh/shared/types';
import { dateOf } from '@ohh/shared/rules';
import { buildoutRules } from '@ohh/shared/place';
import type { Catalog } from '../../app/catalog';
import { useGame } from '../../app/store';
import { Banner, Button, Card, Clock, ProgressBar, RuleCard, Sheet, formatMoney, useT } from '../../ui';
import { fineLabel, permitsProgress, rentPerMonth, spentSoFar, violationFor } from './kit';
import { WalkedPath } from './Path';

/**
 * The lease is signed: the room is being built and the permits are on their way while rent runs.
 * The decision here: wait for the last permit, or open early and break the law. What changed since yesterday is on
 * top — days left, the next thing the city finishes, and the cash the wait is eating.
 */
export function WaitStep({ view, catalog }: { view: OwnerView; catalog: Catalog }) {
  const tr = useT();
  const navigate = useNavigate();
  const { act } = useGame();
  const b = view.business!;
  const today = view.world.day;
  const pack = catalog.packs.niches[b.niche];
  const place = catalog.places.find((p) => p.id === b.placeId);
  const buildId = pack ? buildoutRules(pack)?.itemId : undefined;
  // the doors wait for the room and for the required permits only; an optional license (sidewalk tables) arrives later
  const holdsOpening = (itemId: string) => itemId === buildId || Boolean(pack?.setup.find((s) => s.id === itemId)?.required);
  const all = permitsProgress(b, today, pack);
  const permits = all.filter((p) => holdsOpening(p.itemId));
  const later = all.filter((p) => !holdsOpening(p.itemId) && !p.ready);
  const pending = permits.filter((p) => !p.ready).sort((x, y) => x.readyDay - y.readyDay);
  const allReady = pending.length === 0;
  const lastReady = permits.reduce((m, p) => Math.max(m, p.readyDay), today);
  const daysLeft = Math.max(0, lastReady - today);
  const total = Math.max(1, lastReady - b.createdDay);
  const building = pending.find((p) => p.itemId === buildId);
  const next = pending[0];
  const rentDay = place ? rentPerMonth(place) / 30 : 0;
  const cashAtOpening = b.cash - rentDay * daysLeft;
  const team = pack ? pack.staff.filter((r) => (b.orders.staff[r.id] ?? 0) > 0).map((r) => `${b.orders.staff[r.id]} × ${r.name.toLowerCase()}`).join(', ') : '';
  const [warn, setWarn] = useState(false);
  const [busy, setBusy] = useState(false);

  async function launch() {
    setBusy(true);
    const ack = await act({ type: 'launch' });
    setBusy(false);
    if (ack.ok) navigate('/biz');
  }

  return (
    <div className="stack-lg">
      <div className="stack-sm">
        <h1 className="h2" data-testid="wait-headline">
          {allReady ? tr('Everything is ready: open your doors', 'Всё готово: открывайте двери')
            : building ? tr(`Your room is being made ready: ${daysLeft} days to open doors`, `Зал готовят: до открытия ${daysLeft} дн.`)
            : tr(`Waiting for permits: ${daysLeft} days to open doors`, `Ждём разрешения: до открытия ${daysLeft} дн.`)}
        </h1>
        <p className="muted">
          {allReady
            ? tr(`${b.name} can serve its first guest today.`, `${b.name} может принять первого гостя сегодня.`)
            : tr(`${b.name} signed the lease${place ? ` at ${place.address}` : ''}. The city works at its own pace; the first legal day to open is ${dateOf(lastReady).label}.`, `${b.name}: аренда подписана${place ? `, ${place.address}` : ''}. Город работает в своём темпе; первый законный день открытия — ${dateOf(lastReady).label}.`)}
        </p>
      </div>

      <Card>
        <Clock world={view.world} weather={view.weather[0]} />
        {!allReady && <ProgressBar value={Math.min(1, (total - daysLeft) / total)} label={tr('Days until the doors can open', 'Дней до открытия')} />}
        <ul className="dx-facts">
          {next && (
            <li>
              <span>{tr('Next the city finishes', 'Следующее, что закончит город')}: {next.name}</span>
              <span className="num" data-testid="wait-next">{next.daysLeft === 1 ? tr('tomorrow', 'завтра') : tr(`in ${next.daysLeft} days`, `через ${next.daysLeft} дн.`)}</span>
            </li>
          )}
          <li><span>{tr('Cash in the bank today', 'В банке сегодня')}</span><span className="num">{formatMoney(Math.round(b.cash))}</span></li>
          {!allReady && rentDay > 0 && (
            <li>
              <span>{tr(`Rent takes ${formatMoney(Math.round(rentDay))} a day. On opening day you will have`, `Аренда забирает ${formatMoney(Math.round(rentDay))} в день. В день открытия у вас будет`)}</span>
              <span className={cashAtOpening < 0 ? 'num loss' : 'num'} data-testid="wait-cash-open">{formatMoney(Math.round(cashAtOpening))}</span>
            </li>
          )}
          <li><span>{tr('Spent before a single sale', 'Потрачено до первой продажи')}</span><span className="num">{formatMoney(Math.round(spentSoFar(b)))}</span></li>
          {later.map((p) => (
            <li key={p.itemId}><span>{p.name}: {tr('your doors do not wait for it', 'открытие этого не ждёт')}</span><span className="num">{tr(`in ${p.daysLeft} days`, `через ${p.daysLeft} дн.`)}</span></li>
          ))}
        </ul>
      </Card>

      <div className="stack-sm">
        <Button block size="lg" icon="store" disabled={!allReady} loading={busy && allReady} onClick={launch}>
          {allReady ? tr('Open doors', 'Открыть двери') : tr(`Open doors — ready ${dateOf(lastReady).label.replace(/^\w+, /, '')}`, `Открыть двери — можно ${dateOf(lastReady).label.replace(/^\w+, /, '')}`)}
        </Button>
        {!allReady && !building && (
          <Button block variant="danger" icon="alert" onClick={() => setWarn(true)}>
            {tr(`Open ${daysLeft} days early and break the law`, `Открыться на ${daysLeft} дн. раньше и нарушить закон`)}
          </Button>
        )}
        {building && <Banner tone="info" icon="hourglass">{tr(`Nothing can be sold in a room that is not finished: ${building.daysLeft} more days of work. After that the choice is yours — wait for the permits or open early.`, `В неготовом зале продавать нельзя: ещё ${building.daysLeft} дн. работ. После этого выбор за вами — ждать разрешений или открыться раньше.`)}</Banner>}
      </div>

      <Card title={tr('Your opening plan', 'Ваш план открытия')} subtitle={tr('Tap a step to see the agency, the fee and the official page.', 'Нажмите на шаг: ведомство, сбор и официальная страница.')}>
        <WalkedPath steps={view.roadmap} today={today} />
      </Card>

      <Card tone="flat" title={tr('What opens with you', 'С чем вы открываетесь')} subtitle={tr('You can change any of it before the first guest walks in.', 'Всё это можно изменить до первого гостя.')}>
        <ul className="dx-facts">
          <li><span>{tr('Room', 'Зал')}</span><span className="num">{b.size} {pack?.sizing.unitName ?? 'seat'}s</span></li>
          {team && <li><span>{tr('Team from opening day', 'Команда со дня открытия')}</span><span>{team}</span></li>}
          <li><span>{tr('Price', 'Цена')}</span><span className="num">{formatMoney(b.orders.price, { cents: true })}</span></li>
        </ul>
        <Button block variant="secondary" icon="edit" onClick={() => navigate('/biz')}>{tr('Change team, hours or price', 'Изменить команду, часы или цену')}</Button>
      </Card>

      <Sheet
        open={warn}
        onClose={() => setWarn(false)}
        title={tr('Open before the permits arrive?', 'Открыться до разрешений?')}
        footer={
          <>
            <Button block variant="danger" loading={busy} onClick={launch}>{tr('Open anyway — I accept the risk', 'Открыться — я принимаю риск')}</Button>
            <Button block variant="secondary" onClick={() => setWarn(false)}>{tr('Wait for the permits', 'Ждать разрешений')}</Button>
          </>
        }
      >
        <p className="muted">
          {tr(`You gain ${daysLeft} days of sales and stop paying rent on an empty room. Every day you sell without the permit is a violation: an inspection or a neighbor's report can find it.`,
            `Вы получаете ${daysLeft} дн. продаж и перестаёте платить аренду за пустой зал. Каждый день продаж без разрешения — нарушение: его может найти проверка или жалоба соседа.`)}
        </p>
        {pending.map((p) => {
          const item = pack?.setup.find((s) => s.id === p.itemId);
          const v = item && pack ? violationFor(item, pack, catalog.packs.common) : undefined;
          const days = `${p.daysLeft} ${p.daysLeft === 1 ? 'day' : 'days'}`;
          return v ? (
            <RuleCard key={p.itemId} title={v.name} text={tr(`${p.name} arrives in ${days}. Selling before that breaks the law.`, `${p.name}: придёт через ${p.daysLeft} дн. Продавать до этого — нарушение.`)} law={v.law} penalty={fineLabel(v)} source={item?.link ?? v.source} />
          ) : (
            <RuleCard key={p.itemId} title={tr(`No ${p.name.toLowerCase()} yet`, `Пока нет: ${p.name}`)} text={tr(`It arrives in ${days}.`, `Придёт через ${p.daysLeft} дн.`)} source={item?.link} />
          );
        })}
      </Sheet>
    </div>
  );
}
