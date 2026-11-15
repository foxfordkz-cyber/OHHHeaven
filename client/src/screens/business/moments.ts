// The three moments a player comes back for: the month report opens, an inspection lands, the place in the table moves.
// Logic and what the browser remembers between visits; the look is in MonthReveal.tsx, NoticeCard.tsx and Header.tsx.
import type { MonthReport } from '@ohh/shared/types';

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const monthFull = (m: number): [string, string] => [MONTHS_EN[(m - 1) % 12], MONTHS_RU[(m - 1) % 12]];

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // storage blocked: the moment simply shows again
  }
}
function write(key: string, value: unknown): void {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

// ───────────────────────── month report ─────────────────────────

const monthKey = (bizId: string) => `fy.month.seen.${bizId}`;
export const seenMonth = (bizId: string): number => read<number>(monthKey(bizId)) ?? 0;
export const markMonthSeen = (bizId: string, month: number): void => write(monthKey(bizId), month);

/** The latest closed month the owner has not opened yet. */
export function unseenReport(history: MonthReport[], seen: number): MonthReport | null {
  const last = history[history.length - 1];
  return last && last.month > seen ? last : null;
}

export interface MonthStory {
  month: number;
  revenue: number;
  costs: number;            // everything paid that month: revenue − profit
  profit: number;
  cashEnd: number;
  cashDelta: number;
  rank: number;
  rankBefore: number | null;
  /** places gained: +2 means two places up, −1 one place down */
  rankMove: number;
  /** months the cash lasts if every month repeats this loss; null when the month made money */
  monthsOfCash: number | null;
  verdict: [string, string];
}

const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;

/** What one closed month says in plain words, against the month before it. */
export function monthStory(history: MonthReport[], report: MonthReport): MonthStory {
  const earlier = history.filter((m) => m.month < report.month);
  const prev = earlier[earlier.length - 1] ?? null;
  const [prevEn, prevRu] = prev ? monthFull(prev.month) : ['', ''];
  const p = report.profit;
  let verdict: [string, string];
  if (p > 0 && !earlier.some((m) => m.profit > 0)) {
    verdict = earlier.length ? ['Your first month in the black.', 'Первый месяц в плюсе.'] : ['A profit in your very first month.', 'Прибыль в первый же месяц.'];
  } else if (p > 0 && earlier.every((m) => m.profit < p)) {
    verdict = ['Your best month so far.', 'Твой лучший месяц.'];
  } else if (p > 0 && prev) {
    verdict = p >= prev.profit
      ? [`${money(p - prev.profit)} more than in ${prevEn}.`, `На ${money(p - prev.profit)} больше, чем за ${prevRu.toLowerCase()}.`]
      : [`Still a profit, but ${money(prev.profit - p)} less than in ${prevEn}.`, `Всё ещё прибыль, но на ${money(prev.profit - p)} меньше, чем за ${prevRu.toLowerCase()}.`];
  } else if (p < 0 && prev && prev.profit < 0) {
    verdict = p > prev.profit
      ? [`A loss, but ${money(p - prev.profit)} smaller than in ${prevEn}.`, `Убыток, но на ${money(p - prev.profit)} меньше, чем за ${prevRu.toLowerCase()}.`]
      : [`The loss grew by ${money(prev.profit - p)} against ${prevEn}.`, `Убыток вырос на ${money(prev.profit - p)} против прошлого месяца.`];
  } else if (p < 0 && prev) {
    verdict = [`A loss after a profit in ${prevEn}.`, 'Убыток после прибыльного месяца.'];
  } else if (p < 0) {
    verdict = ['A loss in the first month. Most real shops start this way: what matters is how long the cash lasts.', 'Убыток в первый месяц. Так начинает большинство настоящих заведений: важно, на сколько хватит денег.'];
  } else {
    verdict = ['You broke even.', 'Вышел в ноль.'];
  }
  const rankBefore = prev ? prev.rankInNiche : null;
  return {
    month: report.month, revenue: report.revenue, costs: report.revenue - p, profit: p,
    cashEnd: report.cashEnd, cashDelta: report.cashEnd - report.cashStart,
    rank: report.rankInNiche, rankBefore, rankMove: rankBefore === null ? 0 : rankBefore - report.rankInNiche,
    monthsOfCash: p < 0 && report.cashEnd > 0 ? Math.floor(report.cashEnd / -p) : null,
    verdict,
  };
}

// ───────────────────────── place in the table ─────────────────────────

/** The place the owner saw last, the one before it, and the game day it changed. */
export interface RankMemory { rank: number; before: number; day: number }

const rankKey = (bizId: string) => `fy.rank.${bizId}`;
export const readRank = (bizId: string): RankMemory | null => read<RankMemory>(rankKey(bizId));
export const writeRank = (bizId: string, m: RankMemory): void => write(rankKey(bizId), m);

/** Memory after seeing `rank` on `day`: unchanged while the place holds, a new record the day it moves. */
export function nextRank(mem: RankMemory | null, rank: number, day: number): RankMemory {
  if (!mem) return { rank, before: rank, day };
  return mem.rank === rank ? mem : { rank, before: mem.rank, day };
}

/** How long a change of place stays on screen: one game week. */
export const RANK_NEWS_DAYS = 7;

/** Places gained (+) or lost (−) in the last game week; 0 when nothing moved or the news is old. */
export function rankMove(mem: RankMemory | null, rank: number, day: number): number {
  if (!mem || mem.rank !== rank || day - mem.day >= RANK_NEWS_DAYS) return 0;
  return mem.before - mem.rank;
}
