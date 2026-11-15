// Проверка формы действия, роли и прав. Движок проверяет правила игры; здесь — кто и что вообще может прислать.
import type { Action, DealTerms, NicheId, Player, StandingOrders, WorldState } from '@ohh/shared';
import type { EngineCtx } from './types';
import { isObj } from './util';

const NICHES: NicheId[] = ['cafe', 'barbershop', 'bodega', 'guesthouse', 'rentals'];
const KITS = ['lean', 'standard', 'premium'];
const OWNER_ACTIONS = new Set(['open_business', 'launch', 'set_orders', 'buy_item', 'sell_item', 'resize', 'spend', 'propose_deal', 'answer_deal', 'cancel_deal', 'report', 'answer_notice']);
const OFFICIAL_ACTIONS = new Set(['take_case', 'dismiss_case', 'answer_bribe']);

const str = (x: unknown, max = 80): x is string => typeof x === 'string' && x.length > 0 && x.length <= max;
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const int = (x: unknown, lo: number, hi: number): x is number => num(x) && Number.isInteger(x) && x >= lo && x <= hi;
/** Money in whole cents: 1500 and 1500.25 pass, 1500.255 does not (a loan or a stake is paid to the cent). */
const cents = (x: unknown): x is number => num(x) && Math.abs(x * 100 - Math.round(x * 100)) < 1e-6;
const bool = (x: unknown): x is boolean => typeof x === 'boolean';

function ordersError(o: unknown): string | null {
  if (!isObj(o)) return 'orders must be an object';
  const allowed = new Set(['price', 'staff', 'levers', 'shortcuts', 'blockFund', 'autopilot']);
  for (const k of Object.keys(o)) if (!allowed.has(k)) return `Unknown order: ${k}`;
  const p = o as Partial<StandingOrders>;
  if (p.price !== undefined && !(num(p.price) && p.price > 0)) return 'price must be a positive number';
  if (p.staff !== undefined && !(isObj(p.staff) && Object.values(p.staff).every((v) => int(v, 0, 100)))) return 'staff must map roles to whole numbers';
  if (p.levers !== undefined && !(isObj(p.levers) && Object.values(p.levers).every((v) => str(v)))) return 'levers must map lever ids to option ids';
  if (p.shortcuts !== undefined && !(Array.isArray(p.shortcuts) && p.shortcuts.length <= 20 && p.shortcuts.every((s) => str(s)))) return 'shortcuts must be a list of ids';
  if (p.blockFund !== undefined && !bool(p.blockFund)) return 'blockFund must be true or false';
  if (p.autopilot !== undefined && p.autopilot !== 'hold' && p.autopilot !== 'manager') return 'autopilot must be hold or manager';
  return null;
}

function termsError(t: unknown): string | null {
  if (!isObj(t)) return 'terms must be an object';
  const d = t as DealTerms;
  switch (d.type) {
    case 'joint_purchase': case 'cross_promo': return int(d.months, 1, 12) ? null : 'months must be 1-12';
    case 'loan': return num(d.amount) && d.amount > 0 && num(d.monthlyRatePct) && int(d.months, 1, 12) ? (cents(d.amount) ? null : 'loan amount must be in whole cents') : 'loan needs amount, monthlyRatePct and months';
    case 'partnership': return num(d.amount) && d.amount > 0 && num(d.sharePct) ? (cents(d.amount) ? null : 'partnership amount must be in whole cents') : 'partnership needs amount and sharePct';
    default: return 'Unknown deal type';
  }
}

/** Только форма: типы полей и границы. Возвращает текст ошибки или null. */
export function checkActionShape(a: unknown): string | null {
  if (!isObj(a) || typeof a.type !== 'string') return 'Action must be an object with a type';
  const x = a as Record<string, unknown>;
  switch (x.type) {
    case 'open_business':
      if (!NICHES.includes(x.niche as NicheId)) return 'Unknown niche';
      if (!str(x.placeId) || !str(x.name, 60) || !KITS.includes(x.kitId as string) || !int(x.size, 1, 500)) return 'open_business needs placeId, name, kitId and size';
      if (x.items !== undefined && !(Array.isArray(x.items) && x.items.length <= 100 && x.items.every((it) => isObj(it) && str(it.id) && int(it.qty, 1, 1000)))) return 'items must be a list of { id, qty }';
      return null;
    case 'launch': return null;
    case 'set_orders': return ordersError(x.orders);
    case 'buy_item': case 'sell_item': return str(x.itemId) && int(x.qty, 1, 1000) ? null : 'itemId and qty are required';
    case 'resize': return int(x.size, 1, 500) ? null : 'size must be a whole number';
    case 'spend':
      if (!['marketing', 'training', 'deep_clean', 'accountant'].includes(x.kind as string)) return 'Unknown spend kind';
      return x.amount === undefined || (num(x.amount) && x.amount >= 0 && x.amount <= 1_000_000) ? null : 'Bad amount';
    case 'propose_deal': return str(x.toBusinessId) ? termsError(x.terms) : 'toBusinessId is required';
    case 'answer_deal': return str(x.dealId) && bool(x.accept) ? null : 'dealId and accept are required';
    case 'cancel_deal': return str(x.dealId) ? null : 'dealId is required';
    case 'report': return str(x.targetBusinessId) && str(x.reportId) ? null : 'targetBusinessId and reportId are required';
    case 'answer_notice':
      if (!str(x.caseId) || !['pay', 'contest', 'bribe'].includes(x.response as string)) return 'caseId and response are required';
      return x.bribeAmount === undefined || (num(x.bribeAmount) && x.bribeAmount >= 0) ? null : 'Bad bribe amount';
    case 'read_inbox': return Array.isArray(x.ids) && x.ids.length <= 500 && x.ids.every((i) => str(i, 200)) ? null : 'ids must be a list';
    case 'take_case': case 'dismiss_case': return str(x.caseId) ? null : 'caseId is required';
    case 'answer_bribe': return str(x.caseId) && bool(x.accept) ? null : 'caseId and accept are required';
    default: return `Unknown action: ${String(x.type)}`;
  }
}

/** Роль и права: владелец управляет только своим бизнесом, госслужащий — только делами своей роли. */
export function checkAction(w: WorldState, _ctx: EngineCtx, p: Player, a: Action): string | null {
  const shape = checkActionShape(a);
  if (shape) return shape;
  if (a.type === 'read_inbox') return null;
  if (p.kind === 'owner' && OFFICIAL_ACTIONS.has(a.type)) return 'Only officials can do that';
  if (p.kind === 'official' && OWNER_ACTIONS.has(a.type)) return 'Officials cannot run a business';
  if (p.kind === 'official') {
    const off = w.officials.find((o) => o.playerId === p.id);
    if (!off) return 'Official not found';
    const c = w.cases.find((x) => x.id === (a as { caseId: string }).caseId);
    if (!c) return 'Unknown case';
    if (a.type === 'take_case' && c.role !== off.role) return 'This case belongs to another service';
    if ((a.type === 'dismiss_case' || a.type === 'answer_bribe') && c.officialId !== off.id) return 'Not your case';
    return null;
  }
  const mine = w.businesses.find((b) => b.managerPlayerId === p.id && b.status !== 'bankrupt');
  if (a.type === 'open_business') return mine ? 'You already run a business' : null;
  if (!mine) return 'Open a business first';
  switch (a.type) {
    case 'propose_deal':
    case 'report': {
      const target = a.type === 'report' ? a.targetBusinessId : a.toBusinessId;
      if (target === mine.id) return 'Pick another business';
      return w.businesses.some((b) => b.id === target) ? null : 'Unknown business';
    }
    case 'answer_deal': {
      const d = w.deals.find((x) => x.id === a.dealId);
      return d && d.toBusinessId === mine.id ? null : 'This offer is not addressed to you';
    }
    case 'cancel_deal': {
      const d = w.deals.find((x) => x.id === a.dealId);
      return d && (d.fromBusinessId === mine.id || d.toBusinessId === mine.id) ? null : 'Not your deal';
    }
    case 'answer_notice': {
      const c = w.cases.find((x) => x.id === a.caseId);
      return c && c.businessId === mine.id ? null : 'Not your notice';
    }
    default:
      return null;
  }
}
