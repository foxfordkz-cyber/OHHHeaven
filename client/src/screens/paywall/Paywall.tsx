// The plan screen: what Pro holds for this player, what the free plan leaves, one decision and its effect.
import type { OwnerView } from '@ohh/shared/types';
import { Badge, Banner, Button, Card, List, ListRow, MoneyText, Stat, TopBar, useT } from '../../ui';
import { formatMoney } from '../../ui/format';
import type { BillingStatus, Interval } from './billing';
import { compareRows, heroFor, humanTime, monthsLeft, nextReport, priceLabel, PRO_NAME, rivalAbove, stakesOf } from './logic';

export interface PaywallProps {
  view: OwnerView;
  status: BillingStatus | null;
  /** the status request failed: explains why and still shows what is sold */
  statusError?: string | null;
  busy?: boolean;
  /** what happened after the last button press */
  result?: { tone: 'profit' | 'warn'; text: string } | null;
  /** offline practice in the browser: nothing is sold there */
  offline?: boolean;
  /** inside the Pro tab of /biz: no top bar */
  embedded?: boolean;
  onBuy(interval: Interval): void;
  onBack(): void;
  onManage(): void;
  onPlan(): void;
}

export function Paywall({ view, status, statusError, busy, result, offline, embedded, onBuy, onBack, onManage, onPlan }: PaywallProps) {
  const tr = useT();
  const stage = status?.stage ?? (view.business?.openedDay ? 'free_month' : 'before_opening');
  const hero = offline
    ? { tone: 'info' as const, title: tr('Offline practice: everything is open', 'Практика офлайн: открыто всё'), text: tr('This city runs in your browser and sells nothing. In the online city the first full month is free, then Pro keeps every control for the rest of the year.', 'Этот город работает в браузере и ничего не продаёт. В городе онлайн первый полный месяц бесплатный, дальше Pro сохраняет все рычаги на весь год.') }
    : heroFor(stage, status, view, tr);
  const st = stakesOf(view);
  const rival = rivalAbove(view);
  const left = monthsLeft(view);
  const next = nextReport(view);
  const isPro = stage === 'pro' || stage === 'open_world';
  const prices = status?.prices ?? { month: 1900, year: null, currency: 'usd' as const };
  const testUnlock = (status?.checkout ?? 'test-unlock') === 'test-unlock';
  const Root = embedded ? 'div' : 'main';

  return (
    <Root className={embedded ? 'stack bz-pad' : 'screen stack'}>
      {!embedded && <TopBar title={PRO_NAME} onBack={onBack} right={<Badge tone={isPro ? 'profit' : 'accent'}>{stage === 'open_world' ? tr('Open', 'Открыто') : isPro ? 'Pro' : tr('Free plan', 'Бесплатно')}</Badge>} />}

      <Card tone={hero.tone === 'profit' ? 'profit' : hero.tone === 'warn' ? 'warn' : 'accent'} title={hero.title} subtitle={hero.text}>
        {view.business && (
          <div className="grid-3">
            {st.cash !== null && <Stat small label={tr('Cash now', 'В кассе')} value={<MoneyText value={st.cash} />} />}
            {st.lastProfit !== null && <Stat small label={tr(`Month ${st.lastMonth} profit`, `Прибыль, месяц ${st.lastMonth}`)} value={<MoneyText value={st.lastProfit} signed />} />}
            <Stat small label={tr('Months left', 'Месяцев впереди')} value={left} />
          </div>
        )}
        {rival?.above && (
          <p className="small">
            {tr(
              `${rival.above.name ?? 'The cafe above you'} is #${rival.above.rank}, ${formatMoney(rival.gap)} ahead of you (#${rival.me.rank}).`,
              `${rival.above.name ?? 'Кофейня выше'} — №${rival.above.rank}, впереди на ${formatMoney(rival.gap)} (вы — №${rival.me.rank}).`,
            )}
          </p>
        )}
        {rival && !rival.above && rival.me.rank === 1 && (
          <p className="small">{tr('You are #1 in your niche. Holding it takes decisions every month.', 'Вы №1 в своей нише. Удержать место — это решения каждый месяц.')}</p>
        )}
      </Card>

      {result && <Banner tone={result.tone === 'profit' ? 'info' : 'warn'} icon={result.tone === 'profit' ? 'check' : 'alert'}>{result.text}</Banner>}
      {statusError && <Banner tone="warn">{statusError}</Banner>}

      {!isPro && (
        <Card title={tr('Keep steering all year', 'Управлять весь год')} subtitle={tr('Your decision: pay to keep every control, or let the cafe run on its last orders.', 'Ваше решение: оплатить и сохранить все рычаги — или оставить кофейню на последних распоряжениях.')}>
          <div className="stack-sm">
            <Button block loading={busy} disabled={busy} onClick={() => onBuy('month')} icon="sparkle">
              {tr(`Get Pro — ${priceLabel(prices.month, 'month', tr)}`, `Взять Pro — ${priceLabel(prices.month, 'month', tr)}`)}
            </Button>
            {prices.year !== null && (
              <Button block variant="secondary" disabled={busy} onClick={() => onBuy('year')}>
                {tr(`Yearly — ${priceLabel(prices.year, 'year', tr)}`, `На год — ${priceLabel(prices.year, 'year', tr)}`)}
              </Button>
            )}
          </div>
          <p className="xsmall muted">
            {testUnlock
              ? tr('Test mode: this server takes no payments. The button opens Pro right away and charges nothing.', 'Тестовый режим: этот сервер не принимает платежи. Кнопка сразу открывает Pro и ничего не списывает.')
              : tr('Stripe test mode: pay with the test card 4242 4242 4242 4242, any future date, any CVC. No real money moves.', 'Тестовый режим Stripe: карта 4242 4242 4242 4242, любая будущая дата, любой CVC. Настоящие деньги не списываются.')}
          </p>
        </Card>
      )}

      {isPro && (
        <Card title={tr('Your controls are open', 'Рычаги открыты')} subtitle={tr('Change price, staff and hours now — the forecast shows the effect before you apply.', 'Меняйте цену, штат и часы — прогноз покажет эффект до применения.')}>
          <div className="stack-sm">
            <Button block onClick={onManage} icon="edit">{tr('Open Manage', 'Открыть управление')}</Button>
            <Button block variant="secondary" onClick={onPlan} icon="doc">{tr('My personal plan', 'Мой личный план')}</Button>
          </div>
        </Card>
      )}

      {status?.teaser && (
        <Card title={tr('Your personal plan, from your game', 'Ваш личный план — из вашей игры')} subtitle={isPro ? undefined : tr('In Pro: every line with its source and official link.', 'В Pro: каждая строка с источником и ссылкой на ведомство.')}>
          <div className="grid-3">
            <Stat small label={tr('Before the first sale', 'До первой продажи')} value={<MoneyText value={status.teaser.startupTotal} tone="none" />} />
            <Stat small label={tr('Every month', 'Каждый месяц')} value={<MoneyText value={status.teaser.monthlyTotal} tone="none" />} />
            <Stat small label={tr('Keep in reserve', 'Держать в запасе')} value={<MoneyText value={status.teaser.reserveAdvised} tone="none" />} />
          </div>
          <p className="small muted">
            {tr(
              `${status.teaser.steps} permit and setup steps, ${status.teaser.suppliers} suppliers, ${status.teaser.lessons} lessons from your own months.`,
              `${status.teaser.steps} шагов по разрешениям и запуску, ${status.teaser.suppliers} поставщиков, ${status.teaser.lessons} уроков из ваших месяцев.`,
            )}
          </p>
        </Card>
      )}

      <Card title={tr('What is in each plan', 'Что входит в тарифы')}>
        <List>
          {compareRows(tr, status, left).map((r) => (
            <ListRow
              key={r.id}
              icon={r.lockedNow ? 'lock' : 'check'}
              iconTone={r.lockedNow ? 'accent' : 'profit'}
              title={r.label}
              subtitle={r.free ? tr(`Free: ${r.free}`, `Бесплатно: ${r.free}`) : tr('Pro only', 'Только в Pro')}
              value={r.pro}
            />
          ))}
        </List>
      </Card>

      <Card tone="flat" title={tr('Come back for the next report', 'Возвращайтесь к следующему отчёту')}>
        <p className="small">
          {next.inDays === 0
            ? tr('Your monthly report closes today.', 'Месячный отчёт закрывается сегодня.')
            : tr(
              `Month closes on day ${next.day}: in ${next.inDays} game days, about ${humanTime(next.ms, tr)} in this city.`,
              `Месяц закроется на ${next.day}-й день: через ${next.inDays} игровых дн., около ${humanTime(next.ms, tr)} в этом городе.`,
            )}
        </p>
      </Card>
    </Root>
  );
}
