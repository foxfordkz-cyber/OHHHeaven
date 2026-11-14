// Общие помощники модуля закона: поиск в пакетах и неизменяемые правки мира.
import type {
  BusinessState, Case, FeedItem, FeedKind, InboxItem, NicheId, OfficialRole, OfficialState, Pack,
  PackOfficial, PackReport, PackShortcut, PackViolation, PnlLine, PublicBusiness, WorldState,
} from '../../../shared/src/types';
import { RULES, dateOf } from '../../../shared/src/rules';
import type { EngineCtx } from './ctx';

export const monthOfDay = (day: number): number => dateOf(day).month;
export const monthStartDay = (month: number): number => (month - 1) * RULES.DAYS_PER_MONTH + 1;
export const monthEndDay = (month: number): number => month * RULES.DAYS_PER_MONTH;
export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
export const money = (x: number): number => Math.round(x);
export const usd = (x: number): string => `$${Math.round(x).toLocaleString('en-US')}`;

// ───────────── пакеты ─────────────

export function packOf(ctx: EngineCtx, niche: NicheId): Pack | undefined {
  return ctx.packs.niches[niche];
}

/** Нарушения ниши и общие; при совпадении id побеждает нишевое. */
export function violationsFor(ctx: EngineCtx, niche: NicheId): PackViolation[] {
  const own = packOf(ctx, niche)?.violations ?? [];
  const common = (ctx.packs.common.violations ?? []).filter((v) => !own.some((o) => o.id === v.id));
  return [...own, ...common];
}

export function findViolation(ctx: EngineCtx, niche: NicheId, id: string): PackViolation | undefined {
  return violationsFor(ctx, niche).find((v) => v.id === id);
}

export function officialsFor(ctx: EngineCtx, niche: NicheId): PackOfficial[] {
  return [...(packOf(ctx, niche)?.officials ?? []), ...(ctx.packs.common.officials ?? [])];
}

export function shortcutsFor(ctx: EngineCtx, niche: NicheId): PackShortcut[] {
  const own = packOf(ctx, niche)?.shortcuts ?? [];
  const common = (ctx.packs.common.shortcuts ?? []).filter((s) => !own.some((o) => o.id === s.id));
  return [...own, ...common];
}

export function reportsFor(ctx: EngineCtx, niche: NicheId): PackReport[] {
  const own = packOf(ctx, niche)?.reports ?? [];
  const common = (ctx.packs.common.reports ?? []).filter((r) => !own.some((o) => o.id === r.id));
  return [...own, ...common];
}

/** Роль проверяющего для нарушения: роль госслужащего из поля `official`. */
export function roleOfViolation(ctx: EngineCtx, niche: NicheId, v: PackViolation): OfficialRole {
  const official = officialsFor(ctx, niche).find((o) => o.id === v.official);
  if (official) return official.role;
  if (v.official === 'inspector' || v.official === 'tax_auditor') return v.official;
  return (v.foundBy ?? []).includes('audit') ? 'tax_auditor' : 'inspector';
}

/** Нарушения, которые бывают от работы без разрешения (поле withoutItViolation в setup). */
export function permitViolationIds(ctx: EngineCtx, niche: NicheId): Set<string> {
  const ids = new Set<string>();
  for (const item of packOf(ctx, niche)?.setup ?? []) if (item.withoutItViolation) ids.add(item.withoutItViolation);
  return ids;
}

export const ROLE_LABEL: Record<OfficialRole, string> = { inspector: 'City inspector', tax_auditor: 'Tax auditor' };

// ───────────── мир ─────────────

export function findBusiness(w: WorldState, id: string | undefined): BusinessState | undefined {
  return id === undefined ? undefined : w.businesses.find((b) => b.id === id);
}

/** Бизнес, которым управляет игрок; если такого нет — первый, где он совладелец. */
export function businessOf(w: WorldState, playerId: string): BusinessState | undefined {
  const alive = w.businesses.filter((b) => b.status !== 'bankrupt');
  return alive.find((b) => b.managerPlayerId === playerId) ?? alive.find((b) => b.owners.some((o) => o.playerId === playerId));
}

export function ownsBusiness(b: BusinessState, playerId: string): boolean {
  return b.managerPlayerId === playerId || b.owners.some((o) => o.playerId === playerId);
}

export function ownerPlayerIds(b: BusinessState): string[] {
  return [...new Set([b.managerPlayerId, ...b.owners.map((o) => o.playerId)])];
}

export function officialOfPlayer(w: WorldState, playerId: string): OfficialState | undefined {
  return w.officials.find((o) => o.playerId === playerId);
}

export function mapBusiness(w: WorldState, id: string, fn: (b: BusinessState) => BusinessState): WorldState {
  return { ...w, businesses: w.businesses.map((b) => (b.id === id ? fn(b) : b)) };
}

export function mapCase(w: WorldState, id: string, fn: (c: Case) => Case): WorldState {
  return { ...w, cases: w.cases.map((c) => (c.id === id ? fn(c) : c)) };
}

export function mapOfficial(w: WorldState, id: string, fn: (o: OfficialState) => OfficialState): WorldState {
  return { ...w, officials: w.officials.map((o) => (o.id === id ? fn(o) : o)) };
}

/** Деньги закона идут строкой в mtd и сразу меняют кассу: сумма строк месяца = изменение кассы. */
export function charge(b: BusinessState, line: PnlLine): BusinessState {
  return { ...b, cash: b.cash + line.amount, mtd: { ...b.mtd, lines: [...b.mtd.lines, line] } };
}

export function addInbox(
  w: WorldState, playerIds: string[], item: { id: string; title: string; text: string; ref?: InboxItem['ref']; kind?: InboxItem['kind'] },
): WorldState {
  const targets = new Set(playerIds);
  if (targets.size === 0) return w;
  return {
    ...w,
    players: w.players.map((p) => (targets.has(p.id)
      ? { ...p, inbox: [...p.inbox, { id: `${item.id}:${p.id}`, day: w.day, kind: item.kind ?? 'case', title: item.title, text: item.text, ref: item.ref, read: false }] }
      : p)),
  };
}

export function addFeed(w: WorldState, item: { id: string; kind: FeedKind; text: string; businessId?: string }): WorldState {
  if (w.feed.some((f) => f.id === item.id)) return w;
  const entry: FeedItem = { id: item.id, day: w.day, kind: item.kind, text: item.text, businessId: item.businessId };
  return { ...w, feed: [...w.feed, entry] };
}

export function bump(w: WorldState): WorldState {
  return { ...w, version: w.version + 1 };
}

export function ownerName(w: WorldState, b: BusinessState): string {
  return w.players.find((p) => p.id === b.managerPlayerId)?.name ?? 'Unknown';
}

export function publicOf(w: WorldState, b: BusinessState): PublicBusiness {
  const partners = w.deals
    .filter((d) => d.status === 'active' && (d.fromBusinessId === b.id || d.toBusinessId === b.id))
    .map((d) => (d.fromBusinessId === b.id ? d.toBusinessId : d.fromBusinessId));
  return {
    id: b.id, name: b.name, ownerName: ownerName(w, b), isAi: b.isAi, niche: b.niche, placeId: b.placeId,
    status: b.status, price: b.orders.price, reputation: b.reputation,
    rankInNiche: w.standings.find((s) => s.businessId === b.id)?.rank ?? 0,
    trust: b.trust, partners: [...new Set(partners)],
  };
}

/** День последней проведённой проверки этой роли (дело дошло до проверки). */
export function lastInspectionDay(w: WorldState, businessId: string, role: OfficialRole): number | undefined {
  let last: number | undefined;
  for (const c of w.cases) {
    if (c.businessId !== businessId || c.role !== role || c.inspectDay === undefined) continue;
    const inspected = c.status === 'notice' || c.status === 'bribe_offered' || (c.status === 'closed' && c.outcome !== 'dismissed');
    if (inspected && c.inspectDay <= w.day && (last === undefined || c.inspectDay > last)) last = c.inspectDay;
  }
  return last;
}

export function staffCount(b: BusinessState): number {
  return Object.values(b.orders.staff).reduce((s, n) => s + n, 0);
}
