// What the plan screen says, from the player's own game: stakes, the decision and the next reason to come back.
import type { OwnerView, Standing } from '@ohh/shared/types';
import { RULES } from '@ohh/shared/rules';
import { formatMoney } from '../../ui/format';
import type { BillingStatus, Stage } from './billing';

export type Tr = (en: string, ru: string) => string;

export const PRO_NAME = 'First Year Pro';

export interface Row { id: string; label: string; free: string | null; pro: string; /** closed for this player right now */ lockedNow: boolean }

/** Free vs Pro. `free: null` means not in the free plan. */
const LOCK_OF: Record<string, BillingStatus['locked'][number]> = { year: 'decisions', plan: 'plan', advisor: 'advisor', niches: 'niches' };

export function compareRows(tr: Tr, s: Pick<BillingStatus, 'advisorLeft'> & Partial<Pick<BillingStatus, 'locked' | 'plan'>> | null, monthsLeft: number): Row[] {
  const yes = tr('Yes', 'Да');
  const rows: Omit<Row, 'lockedNow'>[] = [
    { id: 'city', label: tr('City, idea, place and your opening plan', 'Город, идея, место и план открытия'), free: yes, pro: yes },
    { id: 'month', label: tr('Your cafe: the first full month after you open', 'Своя кофейня: первый полный месяц после открытия'), free: yes, pro: yes },
    {
      id: 'year',
      label: tr('Change price, staff, hours and equipment for the rest of the year', 'Менять цену, штат, часы и оборудование весь оставшийся год'),
      free: null,
      pro: monthsLeft > 0 ? tr(`${monthsLeft} months`, `${monthsLeft} мес.`) : yes,
    },
    { id: 'plan', label: tr('Personal plan: your costs, every permit step with its official link', 'Личный план: ваши суммы, каждое разрешение со ссылкой на ведомство'), free: tr('first month', 'первый месяц'), pro: tr('Keep it', 'Навсегда') },
    {
      id: 'advisor',
      label: tr('Advisor on your own numbers', 'Советник по вашим цифрам'),
      free: s?.advisorLeft === null || s?.advisorLeft === undefined ? tr('3 questions', '3 вопроса') : tr(`${s.advisorLeft} of 3 questions left`, `осталось ${s.advisorLeft} из 3 вопросов`),
      pro: tr('Unlimited', 'Без лимита'),
    },
    { id: 'niches', label: tr('Every kind of business, not only coffee', 'Все виды бизнеса, не только кофейня'), free: null, pro: yes },
  ];
  return rows.map((r) => ({
    ...r,
    lockedNow: s?.plan === 'pro' ? false : r.free === null || (LOCK_OF[r.id] !== undefined && (s?.locked ?? []).includes(LOCK_OF[r.id])),
  }));
}

export function priceLabel(cents: number, interval: 'month' | 'year', tr: Tr): string {
  const amount = `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
  return interval === 'month' ? tr(`${amount} / month`, `${amount} в месяц`) : tr(`${amount} / year`, `${amount} в год`);
}

/** Months of the season still ahead, counting the current one. */
export function monthsLeft(view: Pick<OwnerView, 'world'>): number {
  const total = view.world.config.seasonMonths;
  const current = Math.floor((view.world.day - 1) / RULES.DAYS_PER_MONTH) + 1;
  return Math.max(0, total - current + 1);
}

/** Day of the next monthly report and how long that is in real time in this city. */
export function nextReport(view: Pick<OwnerView, 'world'>): { day: number; inDays: number; ms: number } {
  const d = view.world.day;
  const day = Math.ceil(d / RULES.DAYS_PER_MONTH) * RULES.DAYS_PER_MONTH;
  const inDays = Math.max(0, day - d);
  const ms = Math.max(0, view.world.msToNextDay + Math.max(0, inDays - 1) * view.world.config.dayMs);
  return { day, inDays, ms };
}

export function humanTime(ms: number, tr: Tr): string {
  const min = Math.round(ms / 60_000);
  if (min < 1) return tr('under a minute', 'меньше минуты');
  if (min < 60) return tr(`${min} min`, `${min} мин`);
  const h = Math.round(min / 60);
  if (h < 36) return tr(`${h} h`, `${h} ч`);
  return tr(`${Math.round(h / 24)} days`, `${Math.round(h / 24)} дн.`);
}

/** The business right above me in my niche, and the gap in net worth. */
export function rivalAbove(view: Pick<OwnerView, 'business' | 'leaderboards'> & Partial<Pick<OwnerView, 'neighbors'>>): { me: Standing; above: Standing | null; gap: number } | null {
  const b = view.business;
  if (!b) return null;
  const list = view.leaderboards[b.niche] ?? [];
  const me = list.find((s) => s.businessId === b.id);
  if (!me) return null;
  const found = list.filter((s) => s.rank < me.rank && !s.bankrupt).sort((x, y) => y.rank - x.rank)[0] ?? null;
  const name = found ? found.name ?? view.neighbors?.find((n) => n.id === found.businessId)?.name : undefined;
  const above = found ? { ...found, name } : null;
  return { me, above, gap: above ? Math.max(0, above.netWorth - me.netWorth) : 0 };
}

export interface Stakes { cash: number | null; lastProfit: number | null; lastMonth: number | null; price: number | null; staff: number | null }

export function stakesOf(view: Pick<OwnerView, 'business'>): Stakes {
  const b = view.business;
  if (!b) return { cash: null, lastProfit: null, lastMonth: null, price: null, staff: null };
  const last = b.history.at(-1) ?? null;
  return {
    cash: b.cash,
    lastProfit: last ? last.profit : null,
    lastMonth: last ? last.month : null,
    price: b.orders.price,
    staff: Object.values(b.orders.staff).reduce((a, n) => a + n, 0),
  };
}

export interface Hero { tone: 'info' | 'warn' | 'profit'; title: string; text: string }

/** The headline: where the player is in the free plan and what is at stake now. */
export function heroFor(stage: Stage, s: Pick<BillingStatus, 'freeEndsDay' | 'daysLeft' | 'pro'> | null, view: Pick<OwnerView, 'business' | 'world'>, tr: Tr): Hero {
  const st = stakesOf(view);
  const orders = st.price !== null
    ? tr(`price ${formatMoney(st.price, { cents: true })}, ${st.staff} on staff`, `цена ${formatMoney(st.price, { cents: true })}, в штате ${st.staff}`)
    : '';
  switch (stage) {
    case 'before_opening':
      return {
        tone: 'info',
        title: tr('Your first month is free', 'Первый месяц — бесплатно'),
        text: tr(
          'It starts the day your doors open and lasts to the end of your first full month. Build-out, permits and hiring are free too.',
          'Он начинается в день открытия дверей и длится до конца первого полного месяца. Ремонт, разрешения и найм — тоже бесплатно.',
        ),
      };
    case 'free_month':
      if (s?.daysLeft === null || s?.daysLeft === undefined) {
        return {
          tone: 'info',
          title: tr('Your first full month is free', 'Первый полный месяц — бесплатно'),
          text: tr('After it, the cafe keeps running on your last orders unless you take Pro.', 'После него кофейня работает по последним распоряжениям, если не взять Pro.'),
        };
      }
      return {
        tone: 'warn',
        title: s?.daysLeft === 0
          ? tr('Your free month ends today', 'Бесплатный месяц заканчивается сегодня')
          : tr(`Free month: ${s?.daysLeft} days left`, `Бесплатный месяц: осталось ${s?.daysLeft} дн.`),
        text: tr(
          `On day ${s?.freeEndsDay} your controls lock. The cafe keeps running on your last orders${orders ? ` (${orders})` : ''} while the neighbours keep moving.`,
          `На ${s?.freeEndsDay}-й день решения закроются. Кофейня продолжит работать по последним распоряжениям${orders ? ` (${orders})` : ''}, а соседи — двигаться.`,
        ),
      };
    case 'autopilot':
      return {
        tone: 'warn',
        title: tr('Your cafe is on autopilot', 'Кофейня работает на автопилоте'),
        text: tr(
          `Since day ${s?.freeEndsDay} it runs on the orders you left${orders ? ` (${orders})` : ''}. Rent, wages and rivals do not wait.`,
          `С ${s?.freeEndsDay}-го дня она работает по оставленным распоряжениям${orders ? ` (${orders})` : ''}. Аренда, зарплаты и соперники не ждут.`,
        ),
      };
    case 'pro':
      return {
        tone: 'profit',
        title: tr(`You have ${PRO_NAME}`, `У вас ${PRO_NAME}`),
        text: s?.pro?.via === 'stripe-test'
          ? tr(`Paid with a Stripe test card on day ${s.pro.sinceDay}. No real money moved.`, `Оплачено тестовой картой Stripe на ${s.pro.sinceDay}-й день. Настоящие деньги не списывались.`)
          : tr(`Opened in test mode on day ${s?.pro?.sinceDay ?? view.world.day}: this server takes no payments.`, `Открыто в тестовом режиме на ${s?.pro?.sinceDay ?? view.world.day}-й день: этот сервер платежи не принимает.`),
      };
    case 'open_world':
      return {
        tone: 'info',
        title: tr('Everything is open in this city', 'В этом городе открыто всё'),
        text: tr('This is the show city: no plan limits here.', 'Это город для показа: ограничений тарифа здесь нет.'),
      };
  }
}
