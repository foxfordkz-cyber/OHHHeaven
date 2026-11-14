// Вспомогательные функции для хоста: уведомления владельцу и очередь госслужащего.
import type { Case, CaseCard, CaseNotice, WorldState } from '../../../shared/src/types';
import type { EngineCtx } from './ctx';
import { cooldownOk, isAvailable } from './cases';
import { findBusiness, publicOf } from './util';

/** Уведомления владельцу: дела по его бизнесу, где проверка что-то нашла. Свежие первыми. */
export function noticesFor(w: WorldState, businessId: string): CaseNotice[] {
  return w.cases
    .filter((c) => c.businessId === businessId && (c.found?.length ?? 0) > 0 && c.answerByDay !== undefined)
    .sort((a, b) => b.openedDay - a.openedDay || b.id.localeCompare(a.id))
    .map((c) => {
      const n: CaseNotice = {
        caseId: c.id, role: c.role, found: c.found ?? [], fine: c.fine ?? 0, closureDays: c.closureDays ?? 0,
        answerByDay: c.answerByDay as number, status: c.status,
      };
      if (c.outcome) n.outcome = c.outcome;
      return n;
    });
}

function cardOf(w: WorldState, c: Case, withPrivate: boolean): CaseCard | null {
  const b = findBusiness(w, c.businessId);
  if (!b) return null;
  const card: CaseCard = { caseId: c.id, business: publicOf(w, b), role: c.role, origin: c.origin, openedDay: c.openedDay, hints: c.hints, status: c.status };
  if (withPrivate) {
    if (c.found) card.found = c.found;
    if (c.bribeAmount !== undefined) card.bribeAmount = c.bribeAmount;
  }
  return card;
}

/** Очередь госслужащего: открытые дела его роли, которые ему можно взять. */
export function queueFor(w: WorldState, ctx: EngineCtx, officialId: string): CaseCard[] {
  void ctx;
  const o = w.officials.find((x) => x.id === officialId);
  if (!o || !isAvailable(o, w.day)) return [];
  return w.cases
    .filter((c) => c.status === 'open' && c.role === o.role && cooldownOk(w, o.id, c.businessId, c.id))
    .map((c) => cardOf(w, c, false))
    .filter((c): c is CaseCard => c !== null);
}

/** Дела, которые ведёт госслужащий: незакрытые и закрытые за последние 30 дней. */
export function mineFor(w: WorldState, ctx: EngineCtx, officialId: string): CaseCard[] {
  void ctx;
  return w.cases
    .filter((c) => c.officialId === officialId && (c.status !== 'closed' || (c.closedDay !== undefined && w.day - c.closedDay <= 30)))
    .sort((a, b) => (b.takenDay ?? 0) - (a.takenDay ?? 0))
    .map((c) => cardOf(w, c, true))
    .filter((c): c is CaseCard => c !== null);
}
