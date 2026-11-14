// A one-card reminder of the plan for other screens (Today, the return brief): days left, autopilot, or nothing once paid.
import { useNavigate } from 'react-router-dom';
import { Button, Card, useT } from '../../ui';
import { useOwnerView } from '../../app/store';
import type { BillingApi, BillingStatus } from './billing';
import { plural, PRO_NAME, priceLabel, type Tr } from './logic';
import { useBilling } from './useBilling';

export interface Nudge { tone: 'warn' | 'accent'; title: string; text: string; cta: string }

/** What the nudge says, or null when there is nothing to sell right now. */
export function nudgeFor(s: BillingStatus | null, tr: Tr): Nudge | null {
  if (!s || s.plan === 'pro' || s.stage === 'open_world') return null;
  const price = priceLabel(s.prices.month, 'month', tr);
  if (s.stage === 'autopilot') {
    return {
      tone: 'warn',
      title: tr('Your cafe is on autopilot', 'Кофейня на автопилоте'),
      text: tr(`Your free month ended on day ${s.freeEndsDay}. Price, staff and hours stay as you left them until you take ${PRO_NAME}.`, `Бесплатный месяц кончился на ${s.freeEndsDay}-й день. Цена, штат и часы остаются как были, пока вы не возьмёте ${PRO_NAME}.`),
      cta: tr(`Get Pro — ${price}`, `Взять Pro — ${price}`),
    };
  }
  if (s.stage === 'free_month' && s.daysLeft !== null && s.daysLeft <= 20) {
    return {
      tone: 'accent',
      title: s.daysLeft === 0 ? tr('Free month: last day', 'Бесплатный месяц: последний день') : tr(`Free month: ${plural(s.daysLeft, 'day', 'days')} left`, `Бесплатный месяц: осталось ${s.daysLeft} дн.`),
      text: tr(`After day ${s.freeEndsDay} your cafe runs on its last orders. ${PRO_NAME} keeps every control for the rest of the year.`, `После ${s.freeEndsDay}-го дня кофейня работает по последним распоряжениям. ${PRO_NAME} сохраняет все рычаги до конца года.`),
      cta: tr('See what Pro keeps', 'Что сохраняет Pro'),
    };
  }
  return null;
}

export function ProNudge({ api }: { api?: BillingApi } = {}) {
  const tr = useT();
  const navigate = useNavigate();
  const view = useOwnerView();
  const { status } = useBilling({ api, day: view?.world.day });
  const n = nudgeFor(status, tr);
  if (!n) return null;
  return (
    <Card tone={n.tone} title={n.title} subtitle={n.text}>
      <Button block variant={n.tone === 'warn' ? 'primary' : 'secondary'} icon="sparkle" onClick={() => navigate('/pro')}>{n.cta}</Button>
    </Card>
  );
}
