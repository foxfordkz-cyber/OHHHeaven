// Общие помощники модуля сделок. Только чистые функции и правки уже склонированного мира.
import type { BusinessState, Deal, FeedItem, InboxItem, Money, PnlLine, Place, WorldState } from '../../../shared/src/types';
import { dateOf } from '../../../shared/src/rules';
import type { EngineCtx } from './ctx';

export const clone = <T>(x: T): T => structuredClone(x);

export const round2 = (x: number): Money => Math.round(x * 100) / 100;
export const toCents = (x: Money): number => Math.round(x * 100);
export const fromCents = (c: number): Money => c / 100;

export function fmtMoney(x: Money): string {
  const s = Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${x < 0 ? '-' : ''}$${s}`;
}

export const bizById = (w: WorldState, id: string): BusinessState | undefined => w.businesses.find((b) => b.id === id);

export const placeOf = (ctx: EngineCtx, b: BusinessState): Place | undefined => ctx.places.find((p) => p.id === b.placeId);

/** Бизнес, которым управляет игрок: сначала живой, иначе любой. */
export function playerBusiness(w: WorldState, playerId: string): BusinessState | undefined {
  const mine = w.businesses.filter((b) => b.managerPlayerId === playerId);
  return mine.find((b) => b.status !== 'bankrupt') ?? mine[0];
}

/** Расстояние по прямой между двумя точками, метры (формула гаверсинуса). */
export function distanceMeters(a: Place, b: Place): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function addFeed(w: WorldState, id: string, text: string, businessId?: string): void {
  if (w.feed.some((f) => f.id === id)) return;
  const item: FeedItem = { id, day: w.day, kind: 'deal', text };
  if (businessId) item.businessId = businessId;
  w.feed.push(item);
}

export function addInbox(w: WorldState, playerId: string, item: Omit<InboxItem, 'day' | 'read'>): void {
  const p = w.players.find((x) => x.id === playerId);
  if (!p || p.inbox.some((i) => i.id === item.id)) return;
  p.inbox.push({ ...item, day: w.day, read: false });
}

export function notifyBusiness(w: WorldState, b: BusinessState, item: Omit<InboxItem, 'day' | 'read'>): void {
  addInbox(w, b.managerPlayerId, item);
}

/**
 * Проводка денег: касса меняется, строка ложится в отчёт.
 * В закрытии месяца строка дописывается в отчёт этого месяца (если экономика его уже создала),
 * иначе — в строки текущего месяца `mtd`. Так сумма строк месяца остаётся равной изменению кассы.
 */
export function postLine(w: WorldState, b: BusinessState, line: PnlLine, atMonthClose: boolean): void {
  b.cash = round2(b.cash + line.amount);
  const month = dateOf(w.day).month;
  const report = b.history[b.history.length - 1];
  if (atMonthClose && report && report.month === month) {
    report.lines.push(line);
    report.cashEnd = round2(report.cashEnd + line.amount);
  } else {
    b.mtd.lines.push(line);
  }
}

export const isLaunched = (b: BusinessState): boolean => b.status === 'open' || b.status === 'closed';

export const dealParties = (d: Deal): [string, string] => [d.fromBusinessId, d.toBusinessId];

export const involves = (d: Deal, businessId: string): boolean => d.fromBusinessId === businessId || d.toBusinessId === businessId;

export function dealTypeLabel(d: Pick<Deal, 'terms'>): string {
  switch (d.terms.type) {
    case 'joint_purchase': return 'joint purchase';
    case 'cross_promo': return 'cross-promo';
    case 'loan': return 'loan';
    case 'partnership': return 'partnership';
  }
}

/** Таймерные сделки действуют с startDay включительно до endDay не включая. */
export function inEffect(d: Deal, day: number): boolean {
  if (d.status !== 'active') return false;
  if (d.startDay !== undefined && day < d.startDay) return false;
  if (d.endDay !== undefined && day >= d.endDay) return false;
  return true;
}
