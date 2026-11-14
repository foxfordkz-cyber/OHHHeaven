// The return brief as pure functions of OwnerView: what changed since the last look, the one decision
// that waits today and when the next month report lands. No new fields: everything comes from the view.
import type { Action, CaseNotice, Deal, DealTerms, FeedItem, InboxItem, MonthReport, Money, OwnerView, Place, Standing } from '@ohh/shared/types';
import { RULES, dateOf } from '@ohh/shared/rules';
import { distanceM } from '@ohh/shared/place';
import { formatMoney, formatNumber, pick } from '../../ui';
import type { AwaySnapshot, BriefMemory, LastLook } from './memory';

// ───────────── where "then" comes from ─────────────

/** away — the server's summary of the gap; look — the last time this browser finished the brief; month — start of this month. */
export type SinceSource = 'away' | 'look' | 'month' | 'none';

export interface Since {
  source: SinceSource;
  day: number;
  cash: Money | null;
  rank: number | null;
  items: InboxItem[];
}

/** Freeze the server's away summary: it is sent once, the next poll replaces it. */
export function snapshotAway(view: OwnerView): AwaySnapshot | null {
  if (!view.away || !view.business) return null;
  const toDay = view.world.day;
  return {
    fromDay: Math.max(1, toDay - view.away.days),
    toDay,
    cashThen: round2(view.business.cash - view.away.profit),
    cashNow: view.business.cash,
    items: view.away.items,
  };
}

/** The freshest reference point for "then". */
export function resolveSince(view: OwnerView, mem: BriefMemory): Since {
  const b = view.business;
  const today = view.world.day;
  const look = mem.look && mem.look.day <= today ? mem.look : undefined;
  const away = snapshotAway(view) ?? (mem.away && mem.away.toDay <= today ? mem.away : undefined);
  // The server's summary arrived after the last look: it knows the real gap (any screen counts as a visit).
  if (away && (!look || away.toDay > look.day)) {
    const rank = look && look.day <= away.fromDay ? look.rank : null;
    return { source: 'away', day: away.fromDay, cash: away.cashThen, rank, items: away.items };
  }
  if (look) return { source: 'look', day: look.day, cash: look.cash, rank: look.rank, items: [] };
  if (!b) return { source: 'none', day: today, cash: null, rank: null, items: [] };
  const last = b.history[b.history.length - 1];
  const monthStart = (dateOf(today).month - 1) * RULES.DAYS_PER_MONTH;
  return { source: last ? 'month' : 'none', day: last ? monthStart : today, cash: last ? last.cashEnd : null, rank: null, items: [] };
}

/** What to save when the player finishes reading. */
export function lookNow(view: OwnerView): LastLook | null {
  const b = view.business;
  if (!b) return null;
  return { day: view.world.day, cash: b.cash, rank: myStanding(view)?.rank ?? null, months: b.history.length };
}

// ───────────── what happened ─────────────

export type HappeningKind = 'money' | 'deal' | 'case' | 'event' | 'neighbor' | 'summary' | 'system';

export interface Happening {
  id: string;
  day: number;
  kind: HappeningKind;
  title: string;
  text: string;
  tone: 'profit' | 'loss' | 'warn' | 'info';
}

const FEED_NEIGHBOR: FeedItem['kind'][] = ['opening', 'inspection', 'bankruptcy', 'deal', 'report'];

/** Used when the niche pack has no `extra.footfall.radiusM`: ROUND3 — neighbors within 250 m share one stream of passers-by. */
export const NEAR_RADIUS_FALLBACK_M = 250;

/** Businesses whose place is within the radius of mine: they share my passers-by. */
export function nearbyIds(view: OwnerView, places: Place[], radiusM: number): Set<string> {
  const byId = new Map(places.map((p) => [p.id, p]));
  const mine = view.business ? byId.get(view.business.placeId) : undefined;
  const out = new Set<string>();
  if (!mine) return out;
  for (const n of view.neighbors) {
    const p = byId.get(n.placeId);
    if (p && distanceM(mine, p) < radiusM) out.add(n.id);
  }
  return out;
}

/**
 * Inbox since the last look, events that were announced or started, and what neighbors did. Newest first.
 * `near` — businesses that share my passers-by; without it (no map data) only rivals in my niche are listed,
 * and nothing claims they are on my street.
 */
export function happenings(view: OwnerView, since: Since, near: Set<string> | null = null, max = 6): Happening[] {
  const today = view.world.day;
  const out: Happening[] = [];
  const seen = new Set<string>();
  const add = (h: Happening) => {
    const key = h.title.toLowerCase();
    if (seen.has(h.id) || seen.has(key)) return;
    seen.add(h.id);
    seen.add(key);
    out.push(h);
  };
  // same-day letters count while unread: the look may have come before them
  const fresh = (i: InboxItem) => i.day > since.day || (i.day === since.day && !i.read);
  const inbox = [...since.items, ...view.me.inbox].filter((i) => i.day <= today && (fresh(i) || since.items.includes(i)));
  for (const i of inbox) {
    add({ id: `in:${i.id}`, day: i.day, kind: i.kind, title: i.title, text: i.text, tone: inboxTone(i) });
  }
  for (const e of view.events) {
    const started = e.startDay > since.day && e.startDay <= today;
    const announced = e.announcedDay > since.day;
    if (!started && !announced) continue;
    const when = e.startDay > today
      ? pick(`Starts ${dateOf(e.startDay).label}`, `Начнётся ${dateOf(e.startDay).label}`)
      : pick(`Running until ${dateOf(e.endDay).label}`, `Идёт до ${dateOf(e.endDay).label}`);
    add({ id: `ev:${e.id}`, day: started ? e.startDay : e.announcedDay, kind: 'event', title: e.title, text: `${when}. ${e.text}`, tone: 'info' });
  }
  for (const h of dealNews(view, since)) add(h);
  // My own business is in the inbox already; the feed adds what others did.
  const niche = view.business?.niche;
  const sameNiche = new Set(view.neighbors.filter((n) => n.niche === niche).map((n) => n.id));
  for (const f of view.feed) {
    if (f.day <= since.day || f.day > today || !f.businessId || !FEED_NEIGHBOR.includes(f.kind)) continue;
    const close = near?.has(f.businessId) ?? false;
    if (!close && !(near === null && sameNiche.has(f.businessId))) continue;
    add({ id: `fd:${f.id}`, day: f.day, kind: 'neighbor', title: f.text, text: neighborMeaning(f, close), tone: f.kind === 'bankruptcy' || f.kind === 'opening' ? 'warn' : 'info' });
  }
  return out.sort((a, z) => z.day - a.day).slice(0, max);
}

function inboxTone(i: InboxItem): Happening['tone'] {
  if (i.kind === 'case') return /fine|closed|violation/i.test(i.title) ? 'loss' : 'info';
  if (i.kind === 'deal') return /declin|broke|expired/i.test(i.title) ? 'warn' : 'profit';
  if (i.kind === 'money') return /-\$|loss|tax/i.test(i.title + i.text) ? 'warn' : 'profit';
  return 'info';
}

/** Offers that expired unanswered while I was away, and neighbors' answers to my offers. */
export function dealNews(view: OwnerView, since: Since): Happening[] {
  const b = view.business;
  if (!b) return [];
  const today = view.world.day;
  const out: Happening[] = [];
  for (const d of view.deals) {
    if (d.toBusinessId === b.id && d.status === 'expired' && d.expiresDay > since.day && d.expiresDay <= today) {
      const who = nameOf(view, d.fromBusinessId);
      out.push({
        id: `missed:${d.id}`, day: d.expiresDay, kind: 'deal', tone: 'warn',
        title: pick(`Missed: ${who} offered ${termsTitle(d.terms)}`, `Упущено: ${who} предлагал ${termsTitle(d.terms)}`),
        text: pick(`The offer expired before you answered. An offer waits ${plural(RULES.DEAL_OFFER_DAYS, 'game day')}: check in daily.`, `Предложение истекло без ответа. Предложение ждёт ${RULES.DEAL_OFFER_DAYS} игровых дня: заходи каждый день.`),
      });
    }
    if (d.fromBusinessId !== b.id) continue;
    const who = nameOf(view, d.toBusinessId);
    if (d.status === 'active' && d.startDay !== undefined && d.startDay > since.day) {
      out.push({ id: `yes:${d.id}`, day: d.startDay, kind: 'deal', tone: 'profit', title: pick(`${who} accepted your ${termsTitle(d.terms)}`, `${who} принял твоё предложение: ${termsTitle(d.terms)}`), text: termsResult(d.terms) });
    }
    if (d.status === 'declined' && d.expiresDay > since.day) {
      out.push({ id: `no:${d.id}`, day: Math.min(d.expiresDay, today), kind: 'deal', tone: 'warn', title: pick(`${who} declined your ${termsTitle(d.terms)}`, `${who} отказал: ${termsTitle(d.terms)}`), text: pick('Try another neighbor or other terms.', 'Попробуй другого соседа или другие условия.') });
    }
  }
  return out;
}

/** One line on what a neighbor's move means for me. `close` — they share my passers-by. */
function neighborMeaning(f: FeedItem, close: boolean): string {
  switch (f.kind) {
    case 'opening': return close
      ? pick('Within a block of you: your passers-by are now split one way more.', 'В квартале от тебя: прохожих теперь делят на одно заведение больше.')
      : pick('One more rival in your niche: the prize places get harder.', 'Ещё один соперник в нише: призовые места даются труднее.');
    case 'bankruptcy': return close
      ? pick('Their share of passers-by on your block is free now.', 'Их доля прохожих в твоём квартале освободилась.')
      : pick('One rival fewer in your niche.', 'В нише на одного соперника меньше.');
    case 'inspection': return pick('Inspectors are busy nearby: check your own risks in Today.', 'Проверяющие работают рядом: проверь свои риски в «Сегодня».');
    case 'deal': return pick('Neighbors are teaming up: you can offer a deal too.', 'Соседи объединяются: ты тоже можешь предложить сделку.');
    case 'report': return pick('Someone filed a report: inspections follow reports.', 'Кто-то подал жалобу: за жалобой приходит проверка.');
    default: return '';
  }
}

// ───────────── the one decision that waits ─────────────

export interface DecisionOption {
  id: string;
  label: string;
  /** what happens, in numbers, before the player taps */
  result: string;
  action?: Action;
  /** or a screen to go to */
  to?: string;
  primary?: boolean;
  tone?: 'profit' | 'loss' | 'neutral';
}

export interface Decision {
  id: string;
  kind: 'notice' | 'deal' | 'advice' | 'launch' | 'closed' | 'restart' | 'calm';
  title: string;
  text: string;
  deadlineDay?: number;
  options: DecisionOption[];
}

/** Notices first (silence costs money), then offers from neighbors, then advice that moves profit. */
export function pickDecision(view: OwnerView): Decision | null {
  const b = view.business;
  if (!b) return null;
  if (b.status === 'bankrupt') {
    const day = b.bankruptDay ?? view.world.day;
    return {
      id: 'bankrupt', kind: 'restart',
      title: pick(`${b.name} went bankrupt on ${dateOf(day).label}`, `${b.name} обанкротился ${dateOf(day).label}`),
      text: pick(`Cash fell to ${formatMoney(b.cash)}. A business that cannot pay its bills closes.`, `Касса упала до ${formatMoney(b.cash)}. Бизнес, который не может платить по счетам, закрывается.`),
      options: [
        { id: 'why', label: pick('See what went wrong', 'Разобрать, что пошло не так'), to: '/end', primary: true, result: pick('Where the money went, month by month, and what to change in real life.', 'Куда ушли деньги по месяцам и что поменять в жизни.') },
        { id: 'again', label: pick('Start again', 'Начать заново'), to: '/start', result: pick('A new business starts with what this one was worth, not with fresh savings.', 'Новый бизнес начинается с того, что стоил этот, а не со свежих сбережений.') },
      ],
    };
  }
  const notice = view.notices.find((n) => n.status === 'notice');
  if (notice) return noticeDecision(notice);
  const offer = view.deals.filter((d) => d.status === 'proposed' && d.toBusinessId === b.id).sort((a, z) => a.expiresDay - z.expiresDay)[0];
  if (offer) return dealDecision(view, offer);
  if (b.status === 'closed' && b.closedUntilDay && b.closedUntilDay > view.world.day) {
    const left = b.closedUntilDay - view.world.day;
    return {
      id: 'closed', kind: 'closed', deadlineDay: b.closedUntilDay,
      title: pick(`Closed by inspection until ${dateOf(b.closedUntilDay).label}`, `Закрыт проверкой до ${dateOf(b.closedUntilDay).label}`),
      text: pick(`${plural(left, 'more day')} with rent and wages and no sales. Fix what was found so the next visit is clean.`, `Ещё дней без продаж, но с арендой и зарплатой: ${left}. Исправь найденное, чтобы следующая проверка прошла чисто.`),
      options: [{ id: 'today', label: pick('See what was found', 'Что нашли'), to: '/biz/today', primary: true, result: pick('Opens Today with the violations and the shortcuts you run.', 'Откроет «Сегодня» с нарушениями и срезанными углами.') }],
    };
  }
  if (b.status === 'setup') {
    const waiting = view.roadmap.filter((s) => s.status === 'waiting');
    const ready = view.roadmap.length > 0 && waiting.length === 0 && view.roadmap.every((s) => s.status === 'done' || s.kind === 'launch');
    return {
      id: 'launch', kind: 'launch',
      title: ready ? pick('Your permits are ready', 'Разрешения готовы') : pick('You are not open yet', 'Ты ещё не открылся'),
      text: ready
        ? pick('Every day closed costs rent and earns nothing.', 'Каждый закрытый день — аренда без выручки.')
        : pick(`${formatNumber(waiting.length)} steps are still waiting. Opening before the permits arrive is a violation.`, `Ждут шагов: ${formatNumber(waiting.length)}. Открыться без разрешений — нарушение.`),
      options: [{ id: 'go', label: ready ? pick('Open the doors', 'Открыть двери') : pick('See the steps', 'Посмотреть шаги'), result: pick('Opens your business screen.', 'Откроет экран бизнеса.'), to: '/biz/today', primary: true }],
    };
  }
  const advice = [...view.recommendations]
    .filter((r) => r.suggested && r.suggested.type !== 'answer_notice' && r.suggested.type !== 'answer_deal')
    .sort((a, z) => sev(z.severity) - sev(a.severity) || (z.impact?.profitDeltaMonth ?? 0) - (a.impact?.profitDeltaMonth ?? 0))[0];
  if (advice?.suggested) {
    const delta = advice.impact?.profitDeltaMonth;
    return {
      id: `rec:${advice.id}`, kind: 'advice', title: advice.title, text: advice.text,
      options: [
        {
          id: 'apply', label: pick('Apply', 'Применить'), action: advice.suggested, primary: true, tone: delta && delta > 0 ? 'profit' : 'neutral',
          result: delta ? pick(`Forecast: ${formatMoney(delta, { signed: true })} a month. You see it in tomorrow's day report.`, `Прогноз: ${formatMoney(delta, { signed: true })} в месяц. Увидишь в отчёте завтрашнего дня.`) : pick('Takes effect from the next game day.', 'Действует со следующего игрового дня.'),
        },
        { id: 'manage', label: pick('Change it myself', 'Настроить самому'), to: '/biz/manage', result: pick('Opens Manage with a forecast for every change.', 'Откроет «Управление» с прогнозом каждого изменения.') },
      ],
    };
  }
  return {
    id: 'calm', kind: 'calm', title: pick('Nothing urgent today', 'Сегодня ничего срочного'),
    text: pick('Your standing orders keep running. Try a price change and watch the forecast.', 'Распоряжения работают сами. Попробуй сменить цену и посмотри прогноз.'),
    options: [{ id: 'manage', label: pick('Try a new price', 'Попробовать другую цену'), to: '/biz/manage', primary: true, result: pick('Manage shows the month forecast before you apply.', '«Управление» покажет прогноз месяца до применения.') }],
  };
}

const sev = (s: 'info' | 'warn' | 'critical') => (s === 'critical' ? 2 : s === 'warn' ? 1 : 0);

function noticeDecision(n: CaseNotice): Decision {
  const contestCost = round2(RULES.CONTEST_FEE + n.fine * RULES.CONTEST_FINE_MULT);
  const closed = n.closureDays > 0 ? pick(` and close for ${plural(n.closureDays, 'day')}`, ` и закрыться на ${n.closureDays} дн.`) : '';
  const cheaper = contestCost < n.fine;
  return {
    id: `notice:${n.caseId}`, kind: 'notice', deadlineDay: n.answerByDay,
    title: pick(`Fine notice: ${formatMoney(n.fine)}`, `Предписание: штраф ${formatMoney(n.fine)}`),
    text: pick(
      `${plural(n.found.length, 'violation')} found. No answer by the deadline means you pay in full.`,
      `Нарушений: ${n.found.length}. Нет ответа к сроку — платишь полностью.`,
    ),
    options: [
      { id: 'pay', label: pick(`Pay ${formatMoney(n.fine)}`, `Заплатить ${formatMoney(n.fine)}`), action: { type: 'answer_notice', caseId: n.caseId, response: 'pay' }, primary: !cheaper, tone: 'loss', result: pick(`−${formatMoney(n.fine)} today${closed}.`, `−${formatMoney(n.fine)} сегодня${closed}.`) },
      { id: 'contest', label: pick('Contest with a lawyer', 'Оспорить с юристом'), action: { type: 'answer_notice', caseId: n.caseId, response: 'contest' }, primary: cheaper, tone: 'loss', result: pick(`Lawyer ${formatMoney(RULES.CONTEST_FEE)} + ${Math.round(RULES.CONTEST_FINE_MULT * 100)}% of the fine = −${formatMoney(contestCost)}${closed}.`, `Юрист ${formatMoney(RULES.CONTEST_FEE)} + ${Math.round(RULES.CONTEST_FINE_MULT * 100)}% штрафа = −${formatMoney(contestCost)}${closed}.`) },
    ],
  };
}

function dealDecision(view: OwnerView, d: Deal): Decision {
  const from = view.neighbors.find((n) => n.id === d.fromBusinessId);
  const who = from?.name ?? pick('A neighbor', 'Сосед');
  return {
    id: `deal:${d.id}`, kind: 'deal', deadlineDay: d.expiresDay,
    title: pick(`${who} offers: ${termsTitle(d.terms)}`, `${who} предлагает: ${termsTitle(d.terms)}`),
    text: pick(`The offer expires ${dateOf(d.expiresDay).label}.`, `Предложение действует до ${dateOf(d.expiresDay).label}.`),
    options: [
      { id: 'accept', label: pick('Accept', 'Принять'), action: { type: 'answer_deal', dealId: d.id, accept: true }, primary: true, tone: 'profit', result: termsResult(d.terms) },
      { id: 'decline', label: pick('Decline', 'Отказать'), action: { type: 'answer_deal', dealId: d.id, accept: false }, tone: 'neutral', result: pick(`Nothing changes. ${who} sees your answer.`, `Ничего не меняется. ${who} увидит ответ.`) },
    ],
  };
}

export function termsTitle(t: DealTerms): string {
  switch (t.type) {
    case 'joint_purchase': return pick(`joint purchase for ${plural(t.months, 'month')}`, `совместная закупка на ${t.months} мес.`);
    case 'cross_promo': return pick(`cross-promo for ${plural(t.months, 'month')}`, `кросс-промо на ${t.months} мес.`);
    case 'loan': return pick(`a loan of ${formatMoney(t.amount)}`, `заём ${formatMoney(t.amount)}`);
    case 'partnership': return pick(`${formatMoney(t.amount)} for ${t.sharePct}% of your business`, `${formatMoney(t.amount)} за ${t.sharePct}% бизнеса`);
  }
}

function termsResult(t: DealTerms): string {
  switch (t.type) {
    case 'joint_purchase': return pick(`Both shops buy supplies together for ${plural(t.months, 'month')}: lower ingredient costs.`, `Оба заведения закупаются вместе ${t.months} мес.: сырьё дешевле.`);
    case 'cross_promo': return pick(`Each shop sends customers to the other for ${plural(t.months, 'month')}.`, `Заведения ${t.months} мес. отправляют гостей друг к другу.`);
    case 'loan': {
      const monthly = round2((t.amount / Math.max(1, t.months)) * (1 + t.monthlyRatePct / 100));
      return pick(`+${formatMoney(t.amount)} now, then about ${formatMoney(monthly)} a month for ${plural(t.months, 'month')} (${t.monthlyRatePct}% a month).`, `+${formatMoney(t.amount)} сейчас, затем около ${formatMoney(monthly)} в месяц ${t.months} мес. (${t.monthlyRatePct}% в месяц).`);
    }
    case 'partnership': return pick(`+${formatMoney(t.amount)} cash now; they own ${t.sharePct}% of your net worth at the end.`, `+${formatMoney(t.amount)} сейчас; им достаётся ${t.sharePct}% стоимости бизнеса в конце.`);
  }
}

// ───────────── month report, standing, what's ahead ─────────────

export interface MonthNews {
  report: MonthReport;
  prev: MonthReport | null;
  /** closed after the last look */
  fresh: boolean;
}

export function monthNews(view: OwnerView, since: Since): MonthNews | null {
  const h = view.business?.history ?? [];
  const report = h[h.length - 1];
  if (!report) return null;
  return { report, prev: h[h.length - 2] ?? null, fresh: report.month * RULES.DAYS_PER_MONTH >= since.day };
}

export function myStanding(view: OwnerView): Standing | null {
  const b = view.business;
  if (!b) return null;
  return view.leaderboards[b.niche]?.find((s) => s.businessId === b.id) ?? null;
}

export interface Rival {
  name: string;
  /** > 0: they are ahead by this much net worth; < 0: my lead over the one below */
  gap: Money;
  above: boolean;
  rank: number;
}

/** The business right above me in my niche (or right below, if I lead). */
export function rival(view: OwnerView): Rival | null {
  const me = myStanding(view);
  const b = view.business;
  if (!me || !b) return null;
  const board = (view.leaderboards[b.niche] ?? []).filter((s) => !s.bankrupt);
  const above = board.find((s) => s.rank === me.rank - 1);
  const below = board.find((s) => s.rank === me.rank + 1);
  const other = above ?? below;
  if (!other) return null;
  return { name: other.name ?? nameOf(view, other.businessId), gap: round2(other.netWorth - me.netWorth), above: Boolean(above), rank: other.rank };
}

function nameOf(view: OwnerView, id: string): string {
  return view.neighbors.find((n) => n.id === id)?.name ?? pick('a rival', 'соперник');
}

export interface NextReport {
  month: number;
  monthLabel: string;
  gameDays: number;
  /** real milliseconds until the report; null while the city is paused */
  ms: number | null;
  seasonOver: boolean;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_NAMES_RU = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

export const monthName = (m: number) => pick(MONTH_NAMES[(m - 1) % 12], MONTH_NAMES_RU[(m - 1) % 12]);

/** The month report closes at the end of the last day of the month. In the live city a month is one real day. */
export function nextReport(view: OwnerView): NextReport {
  const w = view.world;
  const date = w.date ?? dateOf(w.day);
  const gameDays = RULES.DAYS_PER_MONTH - date.dayOfMonth;
  const seasonOver = w.phase === 'ended' || date.month > w.config.seasonMonths;
  const ms = w.config.paused || seasonOver ? null : Math.max(0, w.msToNextDay) + gameDays * w.config.dayMs;
  return { month: date.month, monthLabel: monthName(date.month), gameDays, ms, seasonOver };
}

/** "In this city a month passes in one real day" — from the real length of a game day. */
export function monthLength(view: OwnerView): string {
  const ms = RULES.DAYS_PER_MONTH * view.world.config.dayMs;
  const hours = ms / 3_600_000;
  if (Math.abs(hours - 24) < 0.01) return pick('In this city a month passes in one real day.', 'В этом городе месяц идёт одни сутки.');
  if (hours >= 1) return pick(`In this city a month lasts ${formatNumber(hours, hours % 1 ? 1 : 0)} real hours.`, `В этом городе месяц длится ${formatNumber(hours, hours % 1 ? 1 : 0)} ч.`);
  const min = Math.max(1, Math.round(ms / 60_000));
  return pick(`In this demo city a month lasts ${min} min.`, `В этом демо-городе месяц длится ${min} мин.`);
}

export interface Upcoming {
  id: string;
  day: number;
  title: string;
  /** real ms from now, null when paused */
  ms: number | null;
}

/** Dated things in the next days: why tomorrow is different from today. */
export function upcoming(view: OwnerView, max = 5): Upcoming[] {
  const w = view.world;
  const b = view.business;
  const today = w.day;
  const inMs = (day: number) => (w.config.paused ? null : Math.max(0, w.msToNextDay) + Math.max(0, day - today - 1) * w.config.dayMs);
  const out: Upcoming[] = [];
  for (const e of view.events) if (e.startDay > today) out.push({ id: `ev:${e.id}`, day: e.startDay, title: e.title, ms: inMs(e.startDay) });
  if (b) {
    for (const d of view.deals) {
      if (d.status === 'proposed' && d.toBusinessId === b.id) out.push({ id: `deal:${d.id}`, day: d.expiresDay, title: pick('An offer from a neighbor expires', 'Истекает предложение соседа'), ms: inMs(d.expiresDay) });
      if (d.status === 'proposed' && d.fromBusinessId === b.id) out.push({ id: `mydeal:${d.id}`, day: d.expiresDay, title: pick(`${nameOf(view, d.toBusinessId)} answers your offer by this day`, `${nameOf(view, d.toBusinessId)} ответит на твоё предложение до этого дня`), ms: inMs(d.expiresDay) });
    }
    for (const n of view.notices) if (n.status === 'notice') out.push({ id: `nt:${n.caseId}`, day: n.answerByDay, title: pick(`Last day to answer the ${formatMoney(n.fine)} fine`, `Последний день ответить на штраф ${formatMoney(n.fine)}`), ms: inMs(n.answerByDay) });
    const tax = view.analytics?.taxDueNext;
    if (tax && tax.day > today) out.push({ id: 'tax', day: tax.day, title: pick(`Tax payment ${formatMoney(tax.amount)}`, `Налог ${formatMoney(tax.amount)}`), ms: inMs(tax.day) });
    if (b.status === 'closed' && b.closedUntilDay && b.closedUntilDay > today) out.push({ id: 'reopen', day: b.closedUntilDay, title: pick('You can reopen', 'Можно снова открыться'), ms: inMs(b.closedUntilDay) });
    for (const p of b.permits) if (p.readyDay > today) out.push({ id: `pm:${p.itemId}`, day: p.readyDay, title: pick('A permit arrives', 'Приходит разрешение'), ms: inMs(p.readyDay) });
  }
  return out.sort((a, z) => a.day - z.day).slice(0, max);
}

// ───────────── helpers ─────────────

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

/** "in 3h 20m" / "in 14 min", in the viewer's language. */
export function inTime(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return pick(`in ${m} min`, `через ${m} мин`);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h < 48) return pick(`in ${h}h${rest ? ` ${rest}m` : ''}`, `через ${h} ч${rest ? ` ${rest} мин` : ''}`);
  return pick(`in ${Math.round(h / 24)} days`, `через ${Math.round(h / 24)} дн.`);
}

/** Wall-clock time of a moment `ms` from `now`, e.g. "Sun 9:40 AM". */
export function clockAt(ms: number, now = Date.now()): string {
  const d = new Date(now + ms);
  const sameDay = new Date(now).toDateString() === d.toDateString();
  return d.toLocaleString(undefined, sameDay ? { hour: 'numeric', minute: '2-digit' } : { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}
