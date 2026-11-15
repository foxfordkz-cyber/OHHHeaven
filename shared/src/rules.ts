// Числа правил игры, общие для всех частей. Меняет только ведущий.
// Это оценки для первой сборки; баланс проверяет агент 07 и просит правки через журнал.
import type { GameDate } from './types';

export const RULES = {
  // Время
  DAYS_PER_MONTH: 30,
  DAY_MS_LIVE: 2_880_000,          // 48 минут: игровой месяц = сутки
  DAY_MS_DEMO: 2_000,              // игровой месяц = минута
  EVENT_NOTICE_DAYS: 3,            // событие объявляется минимум за столько дней
  FORECAST_DAYS: 7,

  // Размер зала
  USABLE_FLOOR_SHARE: 0.6,         // доля площади места под зал
  RESALE_SHARE: 0.3,               // за сколько от цены продаётся мебель и оборудование
  NET_WORTH_ITEMS_SHARE: 0.5,      // доля стоимости мебели и оборудования в счёте

  // Сделки
  DEAL_OFFER_DAYS: 3,              // сколько предложение ждёт ответа
  JOINT_PURCHASE_COGS_MULT: 0.94,
  CROSS_PROMO_DEMAND_MULT: 1.06,
  CROSS_PROMO_PRICE_MULT: 0.98,    // цена скидки: средний чек чуть ниже
  MAX_ACTIVE_DEALS: 4,
  LOAN_MAX_RATE_PCT: 5,            // в месяц
  BLOCK_FUND_FEE_MONTH: 300,
  BLOCK_FUND_THRESHOLD: 0.6,       // доля открытых бизнесов улицы, которая должна скинуться
  BLOCK_FUND_TRAFFIC_MULT: 1.1,

  // Жалобы и дела
  REPORTS_PER_WEEK: 1,
  CASE_GRACE_DAYS: 3,              // через столько дней ничьё дело берёт госслужащий под управлением ИИ
  INSPECTION_DAYS: 1,              // сколько длится проверка
  NOTICE_ANSWER_DAYS: 2,           // сколько дней у владельца на ответ; затем «оплатить»
  BRIBE_ANSWER_DAYS: 1,            // сколько дней у госслужащего на ответ; затем «отказ»
  CONTEST_FEE: 1_500,              // юрист
  CONTEST_FINE_MULT: 0.7,
  REFUSED_BRIBE_FINE_MULT: 1.5,
  FALSE_REPORT_FINE: 500,          // со второй ложной жалобы; первая — предупреждение
  TRAIL_EXPIRY_MONTHS: 6,
  ROUTINE_INSPECTION_EVERY_MONTHS: 6,
  SAME_TARGET_COOLDOWN_DAYS: 30,   // один госслужащий не проверяет один бизнес чаще
  POINTS_PER_VIOLATION: 10,
  POINTS_EMPTY_INSPECTION: -5,
  POINTS_PER_BRIBE: 15,

  // Управляющий
  MANAGER_REVIEW_DAYS: 7,          // как часто нанятый управляющий пересматривает распоряжения

  // Вход
  JOIN_UNTIL_MONTH: 9,
} as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Игровой календарь: 12 месяцев по 30 дней, день 1 — понедельник, 1 января. */
export function dateOf(day: number): GameDate {
  const d = Math.max(1, Math.floor(day));
  const month = Math.floor((d - 1) / RULES.DAYS_PER_MONTH) + 1;
  const dayOfMonth = ((d - 1) % RULES.DAYS_PER_MONTH) + 1;
  const weekday = (d - 1) % 7;
  return { day: d, month, dayOfMonth, weekday, label: `${WEEKDAYS[weekday]}, ${MONTHS[(month - 1) % 12]} ${calendarDay(month, dayOfMonth)}` };
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * The day of a real month a game day is shown as. Game months have 30 days; the label scales them onto the real
 * month, so the month ends on Feb 28 and Jan 31, never on "Feb 30" (docs/qa/BUGS.md #3). Only the label: every count
 * of days (dayOfMonth, month ends, rent, reports) stays on the 30-day month.
 */
export function calendarDay(month: number, dayOfMonth: number): number {
  const len = MONTH_DAYS[(month - 1) % 12];
  return Math.min(len, Math.max(1, Math.round((dayOfMonth * len) / RULES.DAYS_PER_MONTH)));
}

export const isMonthEnd = (day: number): boolean => day % RULES.DAYS_PER_MONTH === 0;
