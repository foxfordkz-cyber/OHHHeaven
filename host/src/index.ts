// @ohh/host — мир, вход, действия, игровой день и картина для каждого игрока (CONTRACT §6).
// Чистый TypeScript без модулей Node: этот же пакет клиент запускает в браузере для игры без сервера.
import type {
  Action, ActionResult, BusinessState, CityView, ClientView, GameEvent, InboxItem, NicheId, OfficialRole, OfficialState,
  OfficialView, OwnerView, Player, Query, Standing, StandingOrders, WorldConfig, WorldState, EffectTarget, Analytics,
  RealWorldPlan, Pack, CommonPack, PackSet,
} from '@ohh/shared';
import { RULES, dateOf, isMonthEnd } from '@ohh/shared';
import { engine } from './deps';
import type { BotResident, EngineCtx, HostDeps, PlayerExtra } from './types';
import { publicBusiness, worldPublic } from './public';
import { checkAction, checkActionShape } from './validate';
import { clamp, formatMoney, isObj, round2, sum } from './util';

export type { EngineCtx, HostDeps, BotBrain, BotResident, EngineApi, AiApi, PlayerExtra } from './types';
export { publicBusiness, worldPublic } from './public';
export { checkAction, checkActionShape } from './validate';
export { engine, bots, ai, defaultDeps, usingStubs } from './deps';

export class HostError extends Error {}

const MAX_BOT_ACTIONS_PER_DAY = 6;
const VIEW_FEED = 40;
const VIEW_INBOX = 50;
const LEADERBOARD_SIZE = 20;
const EFFECT_TARGETS: EffectTarget[] = ['demand', 'cogs', 'staffAvailability', 'footTraffic', 'utilities', 'deliveryShare', 'rent'];

type ExtPlayer = Player & PlayerExtra;

/** Настройки мира по умолчанию: живой город и демо (CONTRACT §6, shared/src/rules.ts). */
export function defaultConfig(p: { id: string; name: string; demo: boolean; seed: number }): WorldConfig {
  return {
    id: p.id, name: p.name, city: 'nyc', seasonMonths: 12,
    dayMs: p.demo ? RULES.DAY_MS_DEMO : RULES.DAY_MS_LIVE, paused: false,
    maxOwners: 100, aiBusinessesTarget: 30, entryFee: 5,
    prizeShare: 0.9, officialsShare: 0.05, platformShare: 0.05, nichePrizeTable: [0.5, 0.3, 0.2],
    demo: p.demo, seed: p.seed,
  };
}

const bump = (prev: WorldState, next: WorldState): WorldState => ({ ...next, version: Math.max(prev.version + 1, next.version) });
const managedBy = (w: WorldState, playerId: string): BusinessState | undefined =>
  w.businesses.find((b) => b.managerPlayerId === playerId && b.status !== 'bankrupt')
  ?? [...w.businesses].reverse().find((b) => b.managerPlayerId === playerId);

function nextId(prefix: string, ids: string[]): string {
  let max = 0;
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue;
    const n = Number(id.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

function pushInbox(w: WorldState, playerId: string, item: Omit<InboxItem, 'id' | 'day' | 'read'>): WorldState {
  return {
    ...w,
    players: w.players.map((p) => {
      if (p.id !== playerId || p.isAi) return p;
      const id = `${p.id}_h${w.day}_${p.inbox.length}`;
      return { ...p, inbox: [...p.inbox, { ...item, id, day: w.day, read: false }].slice(-80) };
    }),
  };
}

function pushFeed(w: WorldState, kind: WorldState['feed'][number]['kind'], text: string, businessId?: string): WorldState {
  const n = w.feed.filter((f) => f.day === w.day).length;
  return { ...w, feed: [...w.feed, { id: `h${w.day}_${n}`, day: w.day, kind, text, businessId }].slice(-200) };
}

function addPlayer(w: WorldState, p: { name: string; kind: 'owner' | 'official'; role?: OfficialRole }, isAi: boolean, strategy?: string): { world: WorldState; playerId: string } {
  const playerId = nextId('p', w.players.map((x) => x.id));
  const paid = !isAi && p.kind === 'owner';
  const player: ExtPlayer = {
    id: playerId, name: p.name, kind: p.kind, isAi, paid, joinedDay: w.day, lastSeenDay: w.day, inbox: [],
    ...(p.kind === 'official' ? { role: p.role } : {}),
    ...(strategy ? { strategy } : {}),
  };
  let next: WorldState = { ...w, players: [...w.players, player], bank: paid ? round2(w.bank + w.config.entryFee) : w.bank };
  if (p.kind === 'official') {
    const off: OfficialState = {
      id: nextId('o', w.officials.map((o) => o.id)), playerId, name: p.name, isAi, role: p.role ?? 'inspector',
      points: 0, casesClosed: 0, bribesTaken: 0, bribesThisMonth: 0, exposed: false,
    };
    next = { ...next, officials: [...next.officials, off] };
  }
  return { world: next, playerId };
}

/** Заселение: житель открывает бизнес теми же Action. Заселённые при создании мира — давно работающие заведения, разрешения у них уже есть. */
function openResident(w: WorldState, ctx: EngineCtx, playerId: string, r: BotResident & { businessName?: string }): WorldState {
  if (!r.niche || !r.placeId) return w;
  const rec = engine.recommendOpening(r.niche, r.placeId, w, ctx)[0];
  const pack = ctx.packs.niches[r.niche];
  if (!rec || !pack) return w;
  const name = r.businessName ?? `${r.name.split(' ')[0]}'s ${pack.name.toLowerCase()}`;
  let x = engine.applyAction(w, ctx, playerId, { type: 'open_business', niche: r.niche, placeId: r.placeId, name, kitId: rec.kitId, size: rec.size, items: rec.items });
  if (x.error) return w;
  const ordered = engine.applyAction(x.world, ctx, playerId, { type: 'set_orders', orders: rec.orders });
  const opened = ordered.error ? x.world : ordered.world;
  const established: WorldState = {
    ...opened,
    businesses: opened.businesses.map((b) => (b.managerPlayerId === playerId ? { ...b, permits: b.permits.map((p) => ({ ...p, readyDay: Math.min(p.readyDay, opened.day) })) } : b)),
  };
  x = engine.applyAction(established, ctx, playerId, { type: 'launch' });
  return x.error ? established : x.world;
}

function withForecast(w: WorldState, deps: HostDeps, fromDay: number): WorldState {
  return { ...w, weather: deps.forecast(w.config.seed, fromDay, RULES.FORECAST_DAYS + 1) };
}

// ───────────── API контракта ─────────────

export function newWorld(config: WorldConfig, ctx: EngineCtx, deps: HostDeps): WorldState {
  let w = engine.createWorld(config);
  w = withForecast(w, deps, w.day);
  const residents = deps.bots.populate(w, ctx, config.seed) as (BotResident & { businessName?: string })[];
  for (const r of residents) {
    const j = addPlayer(w, { name: r.name, kind: r.kind, role: r.role }, true, r.strategy);
    w = j.world;
    if (r.kind === 'owner') w = openResident(w, ctx, j.playerId, r);
  }
  w = { ...w, standings: engine.computeStandings(w, ctx) };
  w = pushFeed(w, 'system', `${config.name} opens for the season: ${w.businesses.length} businesses on the map`);
  return { ...w, version: Math.max(1, w.version) + 1 };
}

export function join(w: WorldState, p: { name: string; kind: 'owner' | 'official'; role?: OfficialRole }): { world: WorldState; playerId: string; error?: string } {
  const fail = (error: string) => ({ world: w, playerId: '', error });
  if (!isObj(p)) return fail('Bad request');
  const name = typeof p.name === 'string' ? p.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40) : '';
  if (!name) return fail('Enter a name');
  if (p.kind !== 'owner' && p.kind !== 'official') return fail('kind must be owner or official');
  if (p.kind === 'official' && p.role !== 'inspector' && p.role !== 'tax_auditor') return fail('Pick a role: inspector or tax_auditor');
  if (w.phase !== 'running') return fail('The season is over');
  if (dateOf(w.day).month > RULES.JOIN_UNTIL_MONTH) return fail(`Joining closes after month ${RULES.JOIN_UNTIL_MONTH}`);
  if (p.kind === 'owner' && w.players.filter((x) => x.kind === 'owner' && !x.isAi).length >= w.config.maxOwners) return fail('The city is full');
  const j = addPlayer(w, { name, kind: p.kind, role: p.kind === 'official' ? p.role : undefined }, false);
  const joined = pushFeed(j.world, 'system', p.kind === 'owner' ? `${name} joined as a business owner` : `${name} joined as a city ${p.role === 'tax_auditor' ? 'tax auditor' : 'inspector'}`);
  return { world: bump(w, joined), playerId: j.playerId };
}

/** Проверка формы, роли и прав, затем движок. Отмечает, что игрок был в мире, и повышает версию. */
export function act(w: WorldState, ctx: EngineCtx, playerId: string, a: Action): ActionResult {
  const r = actInternal(w, ctx, playerId, a);
  if (r.error) return r;
  return { world: bump(w, touchSeen(r.world, playerId)) };
}

function actInternal(w: WorldState, ctx: EngineCtx, playerId: string, a: Action): ActionResult {
  const p = w.players.find((x) => x.id === playerId);
  if (!p) return { world: w, error: 'Unknown player' };
  if (w.phase !== 'running' && (a as { type?: string })?.type !== 'read_inbox') return { world: w, error: 'The season is over' };
  const err = checkAction(w, ctx, p, a);
  if (err) return { world: w, error: err };
  const r = engine.applyAction(w, ctx, playerId, a);
  if (r.error) return { world: w, error: r.error };
  return { world: r.world };
}

function touchSeen(w: WorldState, playerId: string): WorldState {
  const b = managedBy(w, playerId);
  return {
    ...w,
    players: w.players.map((p) => (p.id === playerId ? { ...p, lastSeenDay: w.day, seenDay: w.day, seenCash: b ? b.cash : undefined } as ExtPlayer : p)),
  };
}

/** Игрок открыл экран: запомнить, что он был в мире. Версию не трогает — опрос view не должен «менять» мир. */
export function markSeen(w: WorldState, playerId: string): WorldState {
  const p = w.players.find((x) => x.id === playerId) as ExtPlayer | undefined;
  if (!p || (p.lastSeenDay === w.day && p.seenDay === w.day)) return w;
  return touchSeen(w, playerId);
}

function sanitizeEvent(w: WorldState, ev: GameEvent): GameEvent | null {
  if (!isObj(ev) || typeof ev.title !== 'string' || !Array.isArray(ev.effects)) return null;
  const [lo, hi] = ev.origin === 'ai' ? [0.7, 1.3] : [0.5, 1.5];
  const effects = ev.effects
    .filter((e) => isObj(e) && EFFECT_TARGETS.includes(e.target) && typeof e.mult === 'number' && Number.isFinite(e.mult))
    .map((e) => ({ ...e, mult: round2(clamp(e.mult, lo, hi)) }));
  if (effects.length === 0) return null;
  const minStart = w.day + RULES.EVENT_NOTICE_DAYS;
  const length = clamp(Math.floor((ev.endDay ?? ev.startDay) - (ev.startDay ?? minStart)), 0, 29);
  const startDay = Math.max(minStart, Math.floor(ev.startDay ?? minStart));
  let id = String(ev.id || `event_${startDay}`).slice(0, 80);
  while (w.events.some((e) => e.id === id)) id = `${id}_x`;
  return { ...ev, id, title: ev.title.slice(0, 120), text: String(ev.text ?? '').slice(0, 400), announcedDay: w.day, startDay, endDay: startDay + length, effects };
}

function addEvent(w: WorldState, ev: GameEvent): WorldState {
  const e = sanitizeEvent(w, ev);
  if (!e) return w;
  let x: WorldState = { ...w, events: [...w.events, e] };
  x = pushFeed(x, 'event', `${dateOf(e.startDay).label}: ${e.title}`);
  for (const p of x.players.filter((pl) => !pl.isAi)) x = pushInbox(x, p.id, { kind: 'event', title: e.title, text: `${e.text} Starts ${dateOf(e.startDay).label}.` });
  return x;
}

function residentsMove(w: WorldState, ctx: EngineCtx, deps: HostDeps): WorldState {
  let x = w;
  for (const p of w.players.filter((pl) => pl.isAi)) {
    let actions: Action[] = [];
    try {
      actions = p.kind === 'owner' ? deps.bots.ownerActions(x, ctx, p.id) : deps.bots.officialActions(x, ctx, p.id);
    } catch {
      actions = [];
    }
    for (const a of actions.slice(0, MAX_BOT_ACTIONS_PER_DAY)) {
      const r = actInternal(x, ctx, p.id, a);
      if (!r.error) x = r.world;
    }
  }
  return x;
}

function managersReview(w: WorldState, ctx: EngineCtx): WorldState {
  let x = w;
  for (const b of w.businesses.filter((bb) => bb.orders.autopilot === 'manager' && bb.status !== 'bankrupt')) {
    const cur = x.businesses.find((bb) => bb.id === b.id);
    if (!cur) continue;
    const o: Partial<StandingOrders> = { ...engine.managerOrders(cur, x, ctx) };
    delete o.autopilot;
    if (o.shortcuts && o.shortcuts.length > 0) delete o.shortcuts;
    if (Object.keys(o).length === 0) continue;
    const r = actInternal(x, ctx, cur.managerPlayerId, { type: 'set_orders', orders: o });
    if (r.error) continue;
    x = pushInbox(r.world, cur.managerPlayerId, { kind: 'summary', title: 'Your manager adjusted the standing orders', text: describeOrders(cur.orders, o), ref: { type: 'business', id: cur.id } });
  }
  return x;
}

function describeOrders(before: StandingOrders, o: Partial<StandingOrders>): string {
  const parts: string[] = [];
  if (o.price !== undefined && o.price !== before.price) parts.push(`price ${formatMoney(before.price)} → ${formatMoney(o.price)}`);
  if (o.staff) parts.push(`staff ${sum(Object.values(before.staff))} → ${sum(Object.values(o.staff))}`);
  if (o.shortcuts) parts.push('stopped every shortcut');
  if (o.levers) parts.push('changed operations to safe options');
  if (o.blockFund !== undefined) parts.push(o.blockFund ? 'joined the block fund' : 'left the block fund');
  return parts.length ? `${parts.join('; ')}.` : 'Reviewed the business, no changes needed.';
}

function summaries(w: WorldState): WorldState {
  let x = w;
  const humans = w.players.filter((p) => p.kind === 'owner' && !p.isAi);
  const date = dateOf(w.day);
  for (const p of humans) {
    const b = managedBy(x, p.id);
    if (!b) continue;
    if (isMonthEnd(w.day)) {
      const r = b.history[b.history.length - 1];
      if (r && r.month === date.month) {
        x = pushInbox(x, p.id, { kind: 'summary', title: `Month ${r.month} closed: ${r.profit >= 0 ? 'profit' : 'loss'} ${formatMoney(r.profit)}`, text: `Sales ${formatMoney(r.revenue)}, cash ${formatMoney(r.cashEnd)}, rank #${r.rankInNiche} in your niche.`, ref: { type: 'business', id: b.id } });
      }
    }
    if (w.day % 7 === 0 && p.lastSeenDay < w.day - 1) {
      const week = b.days.filter((d) => d.day > w.day - 7);
      x = pushInbox(x, p.id, { kind: 'summary', title: `Week summary: sales ${formatMoney(sum(week.map((d) => d.revenue)))}`, text: `${Math.round(sum(week.map((d) => d.servedUnits)))} customers served, ${Math.round(sum(week.map((d) => d.lost.size + d.lost.staff)))} turned away. Cash ${formatMoney(b.cash)}.`, ref: { type: 'business', id: b.id } });
    }
  }
  return x;
}

/** Один игровой день: прогноз, событие недели, ходы жителей, управляющие, tickDay, сводки. */
export function step(w: WorldState, ctx: EngineCtx, deps: HostDeps): WorldState {
  if (w.phase !== 'running') return w;
  let x = withForecast(w, deps, w.day + 1);
  if ((Math.max(1, w.day) - 1) % 7 === 0) { // game Mondays: the event deck only answers on weekday 0
    const ev = deps.takeQueuedEvent?.(x) ?? deps.deckEvent(x, ctx);
    if (ev) x = addEvent(x, ev);
  }
  x = residentsMove(x, ctx, deps);
  if (w.day % RULES.MANAGER_REVIEW_DAYS === 0) x = managersReview(x, ctx);
  x = engine.tickDay(x, ctx);
  x = withForecast(x, deps, x.day);
  x = summaries(x);
  x = { ...x, events: x.events.filter((e) => e.endDay >= x.day - 14) };
  return bump(w, x);
}

// ───────────── что видит игрок ─────────────

function leaderboards(w: WorldState, focusBusinessId?: string): Partial<Record<NicheId, Standing[]>> {
  const out: Partial<Record<NicheId, Standing[]>> = {};
  for (const s of w.standings) {
    const list = (out[s.niche] ??= []);
    if (s.rank <= LEADERBOARD_SIZE || s.businessId === focusBusinessId) list.push({ ...s });
  }
  for (const k of Object.keys(out) as NicheId[]) out[k]!.sort((a, b) => a.rank - b.rank);
  return out;
}

function publicPlayer(p: Player): Player {
  const { strategy: _s, seenCash: _c, seenDay: _d, ...rest } = p as ExtPlayer;
  return { ...rest, inbox: p.inbox.slice(-VIEW_INBOX) };
}

function cityParts(w: WorldState) {
  return {
    weather: w.weather.filter((d) => d.day >= w.day).slice(0, RULES.FORECAST_DAYS + 1),
    events: w.events.filter((e) => e.endDay >= w.day),
    feed: w.feed.slice(-VIEW_FEED),
  };
}

function awayFor(w: WorldState, me: ExtPlayer, b: BusinessState | null): OwnerView['away'] {
  const days = w.day - me.lastSeenDay;
  if (days <= 1) return null;
  const items: InboxItem[] = me.inbox.filter((i) => i.day > me.lastSeenDay);
  if (b) {
    for (const d of w.deals.filter((x) => x.toBusinessId === b.id && x.status === 'proposed')) {
      if (items.some((i) => i.ref?.type === 'deal' && i.ref.id === d.id)) continue;
      const from = w.businesses.find((x) => x.id === d.fromBusinessId);
      items.push({ id: `pending_${d.id}`, day: d.proposedDay, kind: 'deal', title: `${from?.name ?? 'A neighbor'} is waiting for your answer`, text: `Offer expires on day ${d.expiresDay}.`, ref: { type: 'deal', id: d.id }, read: false });
    }
    for (const c of w.cases.filter((x) => x.businessId === b.id && x.status === 'notice')) {
      if (items.some((i) => i.ref?.type === 'case' && i.ref.id === c.id && i.day >= (c.inspectDay ?? 0))) continue;
      items.push({ id: `pending_${c.id}`, day: c.inspectDay ?? w.day, kind: 'case', title: `Fine notice waiting: ${formatMoney(c.fine ?? 0)}`, text: `Answer by day ${c.answerByDay}; silence means you pay.`, ref: { type: 'case', id: c.id }, read: false });
    }
  }
  const profit = b ? round2(b.cash - (me.seenCash ?? b.cash)) : 0;
  return { days, profit, items: items.sort((a, z) => a.day - z.day) };
}

export interface ViewOptions { msToNextDay?: number }

export function viewFor(w: WorldState, ctx: EngineCtx, playerId: string | null, opts: ViewOptions = {}): ClientView {
  const world = worldPublic(w, opts.msToNextDay);
  const parts = cityParts(w);
  const me = playerId ? (w.players.find((p) => p.id === playerId) as ExtPlayer | undefined) : undefined;
  if (!me) {
    const city: CityView = {
      kind: 'city', world,
      businesses: w.businesses.map((b) => publicBusiness(w, ctx, b)),
      ...parts, leaderboards: leaderboards(w),
    };
    return city;
  }
  if (me.kind === 'official') {
    const official = w.officials.find((o) => o.playerId === me.id)!;
    const mine = w.cases
      .filter((c) => c.officialId === official.id && (c.status !== 'closed' || (c.closedDay ?? 0) > w.day - 14))
      .flatMap((c) => {
        const b = w.businesses.find((x) => x.id === c.businessId);
        return b ? [{ caseId: c.id, business: publicBusiness(w, ctx, b), role: c.role, origin: c.origin, openedDay: c.openedDay, hints: c.hints, status: c.status, ...(c.bribeAmount !== undefined ? { bribeAmount: c.bribeAmount } : {}), ...(c.found ? { found: c.found } : {}) }] : [];
      });
    const view: OfficialView = {
      kind: 'official', me: publicPlayer(me), world, official: { ...official },
      queue: engine.queueFor(w, ctx, official.id), mine,
      ranking: [...w.officials].sort((a, b) => b.points - a.points).map((o) => ({ name: o.name, points: o.points, isAi: o.isAi })),
      ...parts,
    };
    return view;
  }
  const business = managedBy(w, me.id) ?? null;
  const stakes = w.businesses
    .filter((b) => b.id !== business?.id && b.owners.some((o) => o.playerId === me.id))
    .map((b) => ({ businessId: b.id, share: b.owners.find((o) => o.playerId === me.id)!.share }));
  const place = business ? ctx.places.find((p) => p.id === business.placeId) : undefined;
  const view: OwnerView = {
    kind: 'owner', me: publicPlayer(me), world,
    business: business ? structuredClone(business) : null,
    stakes,
    neighbors: w.businesses.filter((b) => b.id !== business?.id).map((b) => publicBusiness(w, ctx, b)),
    deals: business ? w.deals.filter((d) => d.fromBusinessId === business.id || d.toBusinessId === business.id).map((d) => ({ ...d })) : [],
    notices: business ? engine.noticesFor(w, business.id) : [],
    blockFund: place ? [...w.blockFunds].reverse().find((f) => f.block === place.block) ?? null : null,
    ...parts,
    analytics: business && business.status !== 'bankrupt' ? engine.analyze(business, w, ctx) : null,
    recommendations: business && business.status !== 'bankrupt' ? engine.recommend(business, w, ctx) : [],
    roadmap: business ? engine.roadmapFor(business.niche, business, w, ctx) : [],
    leaderboards: leaderboards(w, business?.id),
    away: awayFor(w, me, business),
  };
  return view;
}

// ───────────── запросы ─────────────

/** Синхронные запросы. Ошибка ввода — HostError. advisor, idea и debrief обслуживает сервер через @ohh/ai. */
export function answer(w: WorldState, ctx: EngineCtx, playerId: string | null, q: Query): unknown {
  if (!isObj(q) || typeof q.type !== 'string') throw new HostError('Query must have a type');
  if (playerId !== null && !w.players.some((x) => x.id === playerId)) throw new HostError('Unknown player');
  const b = playerId ? managedBy(w, playerId) ?? null : null;
  const needNiche = (n: unknown): NicheId => {
    if (typeof n !== 'string' || !ctx.packs.niches[n as NicheId]) throw new HostError('Unknown niche');
    return n as NicheId;
  };
  switch (q.type) {
    case 'recommend_opening': {
      const niche = needNiche(q.niche);
      if (typeof q.placeId !== 'string' || !ctx.places.some((pl) => pl.id === q.placeId)) throw new HostError('Unknown place');
      return engine.recommendOpening(niche, q.placeId, w, ctx);
    }
    case 'what_if': {
      if (!b) throw new HostError('Open a business first');
      if (!isObj(q.orders)) throw new HostError('orders must be an object');
      const err = checkActionShape({ type: 'set_orders', orders: q.orders });
      if (err) throw new HostError(err);
      return engine.whatIf(w, ctx, b.id, q.orders);
    }
    case 'roadmap': {
      const niche = needNiche(q.niche);
      return engine.roadmapFor(niche, b && b.niche === niche ? b : null, w, ctx);
    }
    case 'real_world_plan': {
      if (!b) throw new HostError('Open a business first');
      return engine.realWorldPlan(b, w, ctx);
    }
    case 'advisor': case 'idea': case 'debrief':
      throw new HostError(`Query ${q.type} is answered by the AI service`);
    default:
      throw new HostError('Unknown query');
  }
}

export type AiRequest =
  | { kind: 'advisor'; input: { question: string; business: BusinessState; analytics: Analytics; pack: Pack; common: CommonPack } }
  | { kind: 'idea'; input: { text: string; packs: PackSet } }
  | { kind: 'debrief'; input: { business: BusinessState; analytics: Analytics; plan: RealWorldPlan; rank: number } };

/** Собирает вход для асинхронных запросов к @ohh/ai из мира. */
export function aiRequest(w: WorldState, ctx: EngineCtx, playerId: string | null, q: Query): AiRequest {
  const b = playerId ? managedBy(w, playerId) ?? null : null;
  if (q.type === 'idea') {
    if (typeof q.text !== 'string' || !q.text.trim()) throw new HostError('Describe your idea');
    return { kind: 'idea', input: { text: q.text.slice(0, 500), packs: ctx.packs } };
  }
  if (!b) throw new HostError('Open a business first');
  const pack = ctx.packs.niches[b.niche];
  if (!pack) throw new HostError('Unknown niche');
  const analytics = engine.analyze(b, w, ctx);
  if (q.type === 'advisor') {
    if (typeof q.question !== 'string' || !q.question.trim()) throw new HostError('Ask a question');
    return { kind: 'advisor', input: { question: q.question.slice(0, 500), business: b, analytics, pack, common: ctx.packs.common } };
  }
  if (q.type === 'debrief') {
    const rank = w.standings.find((s) => s.businessId === b.id)?.rank ?? 0;
    return { kind: 'debrief', input: { business: b, analytics, plan: engine.realWorldPlan(b, w, ctx), rank } };
  }
  throw new HostError('Not an AI query');
}

/** Улицы и ниши мира — вход для planEvents. */
export function planInput(w: WorldState, ctx: EngineCtx) {
  return {
    date: dateOf(w.day), weather: w.weather, recent: w.events.slice(-6),
    niches: Object.keys(ctx.packs.niches) as NicheId[],
    blocks: [...new Set(ctx.places.map((p) => p.block))].sort(),
  };
}
