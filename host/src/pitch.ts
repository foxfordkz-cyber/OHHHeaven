// Город для показа жюри (build/ROUND3.md, A5; docs/pitch/LIVE-SHOW.md, «Что подготовить в городе»).
// Город собирается только обычными действиями игры и игровыми днями: вход, открытие, распоряжения, двери, срезанный угол.
// Сумм здесь нет: сценарий проверяет условия (обе ветки жюри принимаются, у Viktor копится нарушение,
// жалоба даёт новое дело по зарплате), а деньги на экране — те, что посчитал движок в момент прогона.
import type { Action, BusinessState, NicheId, OpenRecommendation, Place, StandingOrders, WorldState } from '@ohh/shared';
import { RULES, dateOf, distanceM } from '@ohh/shared';
import { createBotBrain, type OfficialStrategy, type OwnerStrategy } from '@ohh/bots';
import { engine } from './deps';
import { act, defaultConfig, join, markSeen, newWorld, step } from './index';
import type { BotBrain, BotResident, EngineCtx, HostDeps, PlayerExtra } from './types';

export const PITCH_WORLD_ID = 'pitch';

/** Кто живёт в городе показа. Люди — Maya и Viktor; остальные — жители под управлением ИИ с явной меткой isAi. */
export const PITCH_CAST = {
  maya: { name: 'Maya', business: "Maya's Coffee" },
  viktor: { name: 'Viktor', business: "Viktor's Coffee" },
  // характеры без жалоб и без срезанных углов: налоговый инспектор свободен, когда придёт жалоба Maya
  ai: [
    { name: 'Alba', strategy: 'honest' }, { name: 'Noor', strategy: 'premium' }, { name: 'June', strategy: 'social' },
    { name: 'Luca', strategy: 'dumper' }, { name: 'Hana', strategy: 'honest' }, { name: 'Eli', strategy: 'premium' },
    { name: 'Rosa', strategy: 'social' }, { name: 'Theo', strategy: 'unreliable' },
  ],
  officials: [
    { name: 'Sam', role: 'tax_auditor' as const, strategy: 'complaint_chaser', title: 'Tax Auditor' },
    { name: 'Dana', role: 'inspector' as const, strategy: 'complaint_chaser', title: 'Health Inspector' },
  ],
} as const;

/** Насколько соседи рядом: радиус общего пешеходного потока из shared/src/place.ts (250 м). */
export const NEIGHBOR_RADIUS_M = 250;
/** Сколько дней обе кофейни работают до подготовленного момента (первый месяц закрыт, второй идёт). */
export const PITCH_OPEN_DAYS = 38;
/** Сколько дней Viktor уже срезает угол к подготовленному моменту: «накопленная история нарушения». */
export const PITCH_SHORTCUT_DAYS = 30;
/** Сколько игровых дней даём жалобе дойти до уведомления о штрафе в пробном прогоне. */
export const PITCH_CASE_DAYS = 14;
/** Шаг цены в ветке «выше цены» и шаг мест в ветке «больше мест». Это решение жюри, а не число модели. */
export const PRICE_STEP = 0.1;
/** Сколько игровых дней сборка ждёт разрешений и ремонта. Дольше — место выбрано неудачно, сборка падает с причиной. */
export const OPEN_GUARD_DAYS = 240;
/** Двери, которые открываются дольше (полный ремонт под кафе), для показа не берём: сезон не ждёт. */
export const MAX_OPEN_DAYS = 120;
export const SEATS_STEP = 6;
/** С какой средней загрузки зала вопрос «больше мест?» честный: зал почти полон, рядом с порогом тесноты пакета кафе (crowdPenaltyAbove 0.9). Это порог сцены, не число модели. */
export const ROOM_FULL = 0.8;

export type PitchRole = 'maya' | 'viktor';
export type PitchBranchId = 'price' | 'seats';

export interface PitchBranch {
  id: PitchBranchId; label: string; actions: Action[]; ok: boolean; error?: string;
  /** Что изменилось за неделю после решения против недели без него — пробный прогон на копии города. */
  week?: { servedUnits: number; lostSize: number; revenue: number; cash: number; baseline: { servedUnits: number; lostSize: number; revenue: number; cash: number } };
}

/** must — без этого сцена не идёт; should — сцена идёт, но реплику надо поправить по RUNBOOK. */
export interface PitchCheck { id: string; ok: boolean; level: 'must' | 'should'; text: string }

export interface PitchShortcut { id: string; name: string; violationId: string; reportId: string; reportName: string; role: 'inspector' | 'tax_auditor' }

export interface PitchSetup {
  worldId: string;
  /** Стартовая копия: в неё возвращает команда reset. */
  start: WorldState;
  players: Record<PitchRole, string>;
  businesses: Record<PitchRole, string>;
  places: Record<PitchRole, string> & { distanceM: number };
  shortcut: PitchShortcut;
  branches: Record<PitchBranchId, PitchBranch>;
  /** Пробный прогон жалобы: через сколько игровых дней приходит уведомление и что нашли. */
  complaint: { ok: boolean; days: number | null; caseId?: string; found: string[]; fine?: number; official?: string; error?: string };
  checks: PitchCheck[];
  /** Как готовили город: по строке на действие или отрезок времени. Для RUNBOOK и вопроса жюри «это постановка?». */
  log: string[];
  preparedDay: number;
}

type ExtPlayer = WorldState['players'][number] & PlayerExtra;

// ───────────── жители города показа ─────────────

const cafeOnly = (ctx: EngineCtx): EngineCtx => ({ ...ctx, packs: { ...ctx.packs, niches: { cafe: ctx.packs.niches.cafe } } });

/**
 * Мозг жителей для города показа: характер берётся из поля `strategy` игрока (хост его хранит),
 * а заселение — восемь кафе и два чиновника с именами из LIVE-SHOW. Места выбирает тот же populate, что и в обычном городе.
 */
export function pitchBrain(): BotBrain {
  const brain = createBotBrain({
    recommendOpening: (niche, placeId, w, ctx) => engine.recommendOpening(niche, placeId, w, ctx),
    strategyOf: (p) => (p as ExtPlayer).strategy as OwnerStrategy | OfficialStrategy | undefined,
  });
  const populate = (w: WorldState, ctx: EngineCtx, seed: number): BotResident[] => {
    const cafes = brain.populate({ ...w, config: { ...w.config, aiBusinessesTarget: PITCH_CAST.ai.length } }, cafeOnly(ctx), seed)
      .filter((r) => r.kind === 'owner' && r.niche === 'cafe' && r.placeId);
    const owners = cafes.slice(0, PITCH_CAST.ai.length).map((r, i) => ({
      ...r, name: PITCH_CAST.ai[i]!.name, strategy: PITCH_CAST.ai[i]!.strategy, businessName: `${PITCH_CAST.ai[i]!.name}'s Coffee`,
    }));
    const officials = PITCH_CAST.officials.map((o) => ({ name: o.name, kind: 'official' as const, role: o.role, strategy: o.strategy }));
    return [...owners, ...officials];
  };
  return { ...brain, populate };
}

/** Зависимости хоста для города показа: свой мозг жителей; погода и колода — обычные. */
export function pitchDeps(base: HostDeps): HostDeps {
  return { ...base, bots: pitchBrain() };
}

export const isPitchWorld = (w: WorldState): boolean => w.config.id === PITCH_WORLD_ID || w.config.id.startsWith(`${PITCH_WORLD_ID}-`);

// ───────────── выбор места ─────────────

function maxSeats(ctx: EngineCtx, niche: NicheId, p: Place): number {
  const pack = ctx.packs.niches[niche];
  if (!pack) return 0;
  return Math.min(pack.sizing.max, Math.floor((p.sqft * RULES.USABLE_FLOOR_SHARE) / pack.sizing.sqftPerUnit));
}

interface PlacePair { maya: Place; viktor: Place; distanceM: number }

/** Две свободные соседние двери: у Maya помещение позволяет добавить места, обе по карману по совету открытия. */
export function choosePitchPlaces(w: WorldState, ctx: EngineCtx, exclude: ReadonlySet<string> = new Set()): PlacePair | null {
  const pack = ctx.packs.niches.cafe;
  if (!pack) return null;
  const taken = new Set(w.businesses.filter((b) => b.status !== 'bankrupt').map((b) => b.placeId));
  const free = ctx.places.filter((p) => !taken.has(p.id) && !exclude.has(p.id) && (p.suitableFor.length === 0 || p.suitableFor.includes('cafe')));
  const people = (p: Place) => p.pedestriansPerDay ?? p.footTraffic * 10_000;
  // совет открытия на каждую дверь — один раз; тот же выбор набора, что сделает openNeighbors
  const memo = new Map<string, { maya?: OpenRecommendation; viktor?: OpenRecommendation }>();
  const recs = (p: Place) => {
    let r = memo.get(p.id);
    if (!r) { const all = engine.recommendOpening('cafe', p.id, w, ctx); r = { maya: mayaPick(all), viktor: viktorPick(all) }; memo.set(p.id, r); }
    return r;
  };
  const quick = (r: OpenRecommendation | undefined): r is OpenRecommendation => !!r && r.daysToOpen <= MAX_OPEN_DAYS;
  // Maya: своё помещение (не покупка работающего кафе — у него места уже стоят), есть куда добавить SEATS_STEP мест; больше прохожих — лучше
  const mayas = free
    .filter((p) => !p.forSale && quick(recs(p).maya) && maxSeats(ctx, 'cafe', p) >= recs(p).maya!.size + SEATS_STEP)
    .sort((a, b) => people(b) - people(a) || recs(a).maya!.daysToOpen - recs(b).maya!.daysToOpen || a.id.localeCompare(b.id));
  for (const m of mayas) {
    // Viktor: в радиусе общего потока, открывается быстрее; при равенстве — ближе
    const v = free
      .filter((x) => x.id !== m.id && distanceM(m, x) < NEIGHBOR_RADIUS_M && quick(recs(x).viktor))
      .sort((a, b) => recs(a).viktor!.daysToOpen - recs(b).viktor!.daysToOpen || distanceM(m, a) - distanceM(m, b) || a.id.localeCompare(b.id))[0];
    if (v) return { maya: m, viktor: v, distanceM: Math.round(distanceM(m, v)) };
  }
  return null;
}

/** Набор Maya: самый маленький из советов, после которого остаются деньги (места кончаются раньше, чем гости). */
const mayaPick = (all: OpenRecommendation[]) => [...all].filter((r) => r.cashLeft > 0).sort((a, b) => a.size - b.size || b.cashLeft - a.cashLeft)[0];
/** Набор Viktor: первый совет, после которого остаются деньги. */
const viktorPick = (all: OpenRecommendation[]) => all.find((r) => r.cashLeft > 0);

// ───────────── нарушение Viktor ─────────────

/**
 * Срезанный угол Viktor — тот, что находит жалоба налоговому инспектору (зарплата и чаевые).
 * Если в пакете есть `cash_wages` (зарплата наличными мимо налогов) — берём его: это реплика из LIVE-SHOW.
 */
export function pitchShortcut(ctx: EngineCtx): PitchShortcut | null {
  const pack = ctx.packs.niches.cafe;
  if (!pack) return null;
  const reports = [...pack.reports, ...ctx.packs.common.reports].filter((r) => r.role === 'tax_auditor');
  const prefer = ['cash_wages', 'no_spread_of_hours', 'unpaid_trial_shifts', 'keep_tips'];
  const all = [...pack.shortcuts, ...ctx.packs.common.shortcuts];
  const ranked = [...all].sort((a, b) => rank(a.id) - rank(b.id));
  function rank(id: string) { const i = prefer.indexOf(id); return i < 0 ? prefer.length : i; }
  for (const s of ranked) {
    const r = reports.find((x) => x.checks.includes(s.violation));
    if (r) return { id: s.id, name: s.name, violationId: s.violation, reportId: r.id, reportName: r.name, role: r.role };
  }
  return null;
}

// ───────────── сборка ─────────────

const bizOf = (w: WorldState, playerId: string): BusinessState | undefined =>
  w.businesses.find((b) => b.managerPlayerId === playerId && b.status !== 'bankrupt');

function must(r: { world: WorldState; error?: string }, what: string): WorldState {
  if (r.error) throw new Error(`pitch: ${what}: ${r.error}`);
  return r.world;
}

const permitsReady = (b: BusinessState, day: number) => b.permits.every((p) => p.readyDay <= day);

function weekSum(b: BusinessState | undefined, fromDay: number) {
  const days = (b?.days ?? []).filter((d) => d.day > fromDay);
  const s = (f: (d: (typeof days)[number]) => number) => Math.round(days.reduce((a, d) => a + f(d), 0) * 100) / 100;
  return { servedUnits: s((d) => d.servedUnits), lostSize: s((d) => d.lost.size), revenue: s((d) => d.revenue), cash: Math.round((b?.cash ?? 0) * 100) / 100 };
}

function runDays(w: WorldState, ctx: EngineCtx, deps: HostDeps, n: number): WorldState {
  let x = w;
  for (let i = 0; i < n && x.phase === 'running'; i++) x = step(x, ctx, deps);
  return x;
}

/** Сколько пар дверей сборка пробует, прежде чем сдаться. */
export const PLACE_ATTEMPTS = 6;

interface Opening { world: WorldState; players: Record<PitchRole, string>; opened: Record<PitchRole, number>; log: string[] }

/** Maya и Viktor входят, открывают кафе по совету открытия, ждут ремонта и разрешений и открывают двери без нарушения. */
function openNeighbors(w0: WorldState, ctx: EngineCtx, deps: HostDeps, pair: PlacePair): Opening | { failed: string; place: string } {
  let w = w0;
  const log: string[] = [];
  const players = {} as Record<PitchRole, string>;
  for (const role of ['maya', 'viktor'] as const) {
    const j = join(w, { name: PITCH_CAST[role].name, kind: 'owner' });
    if (j.error) throw new Error(`pitch: ${role} cannot join: ${j.error}`);
    w = j.world;
    players[role] = j.playerId;
  }
  const place = { maya: pair.maya, viktor: pair.viktor };
  // Maya — самый маленький набор совета (места кончаются раньше, чем гости); Viktor — первый совет, после которого остаются деньги
  const picks = { maya: mayaPick(engine.recommendOpening('cafe', pair.maya.id, w, ctx)), viktor: viktorPick(engine.recommendOpening('cafe', pair.viktor.id, w, ctx)) };
  for (const role of ['maya', 'viktor'] as const) {
    const rec = picks[role];
    if (!rec) return { failed: `no affordable opening at ${place[role].address}`, place: place[role].id };
    const r = act(w, ctx, players[role], { type: 'open_business', niche: 'cafe', placeId: place[role].id, name: PITCH_CAST[role].business, kitId: rec.kitId, size: rec.size, items: rec.items });
    if (r.error) return { failed: `${PITCH_CAST[role].name} cannot open at ${place[role].address}: ${r.error}`, place: place[role].id };
    w = must(act(r.world, ctx, players[role], { type: 'set_orders', orders: rec.orders }), `${role} sets orders`);
    log.push(`Day ${w.day}: ${PITCH_CAST[role].name} opens ${PITCH_CAST[role].business} at ${place[role].address}: ${rec.kitId} kit, ${rec.size} seats, recommended orders; about ${rec.daysToOpen} days to open.`);
  }
  // двери — в тот день, когда готовы ремонт и все разрешения: без нарушения
  const opened: Partial<Record<PitchRole, number>> = {};
  for (let guard = 0; guard <= OPEN_GUARD_DAYS; guard++) {
    for (const role of ['maya', 'viktor'] as const) {
      if (opened[role] !== undefined) continue;
      const b = bizOf(w, players[role]);
      if (!b) return { failed: `${PITCH_CAST[role].business} went bankrupt on day ${w.day} before opening at ${place[role].address}`, place: place[role].id };
      if (b.status === 'setup' && permitsReady(b, w.day)) {
        w = must(act(w, ctx, players[role], { type: 'launch' }), `${role} launches`);
        opened[role] = w.day;
        log.push(`Day ${w.day}: ${PITCH_CAST[role].business} opens its doors with every permit ready.`);
      }
    }
    if (opened.maya !== undefined && opened.viktor !== undefined) return { world: w, players, opened: opened as Record<PitchRole, number>, log };
    w = runDays(w, ctx, deps, 1);
  }
  const slow: PitchRole = opened.maya === undefined ? 'maya' : 'viktor';
  return { failed: `${PITCH_CAST[slow].business} did not open in ${OPEN_GUARD_DAYS} days`, place: place[slow].id };
}

export interface BuildPitchOptions { id?: string; name?: string; seed?: number; openDays?: number; shortcutDays?: number }

/**
 * Готовит город показа: Maya и Viktor входят, открывают соседние кофейни по совету открытия, ждут разрешений,
 * открывают двери; Viktor включает срезанный угол; город идёт до подготовленного дня и встаёт на паузу.
 * Затем на копиях проверяет обе ветки жюри и жалобу.
 */
export function buildPitch(ctx: EngineCtx, baseDeps: HostDeps, opts: BuildPitchOptions = {}): PitchSetup {
  const deps = pitchDeps(baseDeps);
  const id = opts.id ?? PITCH_WORLD_ID;
  const openDays = opts.openDays ?? PITCH_OPEN_DAYS;
  const shortcutDays = Math.min(opts.shortcutDays ?? PITCH_SHORTCUT_DAYS, openDays);
  const log: string[] = [];
  const pack = ctx.packs.niches.cafe;
  if (!pack) throw new Error('pitch: the cafe pack is not playable');
  const shortcut = pitchShortcut(ctx);
  if (!shortcut) throw new Error('pitch: no shortcut that a tax auditor report can find');

  const config = { ...defaultConfig({ id, name: opts.name ?? 'Pitch City', demo: true, seed: opts.seed ?? 2611 }), aiBusinessesTarget: PITCH_CAST.ai.length };
  let w = newWorld(config, ctx, deps);
  log.push(`Day ${w.day}: ${config.name} created with ${w.businesses.length} AI cafes (${PITCH_CAST.ai.map((a) => a.name).join(', ')}) and AI officials ${PITCH_CAST.officials.map((o) => `${o.name} (${o.title})`).join(', ')}.`);

  // Пара соседних дверей. Если кто-то разорился, не дождавшись дверей, — та же сборка с другой парой (детерминированно).
  const city = w;
  const excluded = new Set<string>();
  let opening: Opening | null = null;
  let pair: PlacePair | null = null;
  for (let attempt = 1; attempt <= PLACE_ATTEMPTS && !opening; attempt++) {
    pair = choosePitchPlaces(city, ctx, excluded);
    if (!pair) break;
    const r = openNeighbors(city, ctx, deps, pair);
    if ('failed' in r) {
      log.push(`Try ${attempt}: ${r.failed}; choosing another pair of doors.`);
      excluded.add(r.place);
      continue;
    }
    opening = r;
  }
  if (!opening || !pair) throw new Error(`pitch: no two neighboring cafes could open (${log.slice(1).join(' ') || 'no free neighboring places'})`);
  w = opening.world;
  const players = opening.players;
  const opened = opening.opened;
  log.push(...opening.log);

  // город идёт; Viktor включает срезанный угол за shortcutDays до подготовленного дня
  const lastOpen = Math.max(opened.maya, opened.viktor);
  const target = lastOpen + openDays;
  const shortcutDay = target - shortcutDays;
  if (w.day < shortcutDay) w = runDays(w, ctx, deps, shortcutDay - w.day);
  const vb = bizOf(w, players.viktor);
  if (!vb) throw new Error('pitch: Viktor has no business');
  w = must(act(w, ctx, players.viktor, { type: 'set_orders', orders: { shortcuts: [...new Set([...vb.orders.shortcuts, shortcut.id])] } }), 'Viktor cuts a corner');
  log.push(`Day ${w.day}: Viktor turns on the shortcut "${shortcut.name}".`);
  if (w.day < target) w = runDays(w, ctx, deps, target - w.day);
  log.push(`Day ${w.day} (${dateOf(w.day).label}): the city is paused. This is the prepared moment.`);

  // владельцы смотрели на свои телефоны в подготовленный день: без окна «While you were away» на сцене (то же делает обычный view)
  for (const role of ['maya', 'viktor'] as const) w = markSeen(w, players[role]);
  w = { ...w, config: { ...w.config, paused: true }, version: w.version + 1 };
  const businesses = { maya: bizOf(w, players.maya)?.id ?? '', viktor: bizOf(w, players.viktor)?.id ?? '' };
  const places = { maya: pair.maya.id, viktor: pair.viktor.id, distanceM: pair.distanceM };
  const setup: PitchSetup = {
    worldId: id, start: w, players, businesses, places, shortcut,
    branches: { price: branchOf(w, ctx, deps, players.maya, 'price'), seats: branchOf(w, ctx, deps, players.maya, 'seats') },
    complaint: { ok: false, days: null, found: [] }, checks: [], log, preparedDay: w.day,
  };
  setup.complaint = dryComplaint(setup, ctx, deps);
  setup.checks = pitchChecks(setup, ctx);
  return setup;
}

// ───────────── ветки жюри ─────────────

interface SeatRule { seats: number; setupItemId: string }

/**
 * Действия ветки для текущего мира: цена выше на PRICE_STEP или на SEATS_STEP мест больше.
 * Если новые места переходят порог из `extra.seatThresholds` пакета (туалет для гостей от 20 мест) — сначала покупка этого пункта.
 */
export function branchActions(w: WorldState, ctx: EngineCtx, mayaPlayerId: string, id: PitchBranchId): Action[] | null {
  const b = bizOf(w, mayaPlayerId);
  const pack = ctx.packs.niches.cafe;
  if (!b || !pack) return null;
  if (id === 'price') {
    const price = Math.round(Math.min(pack.unit.priceMax, b.orders.price * (1 + PRICE_STEP)) * 4) / 4;
    return [{ type: 'set_orders', orders: { price } as Partial<StandingOrders> }];
  }
  const place = ctx.places.find((p) => p.id === b.placeId);
  const size = Math.min(place ? maxSeats(ctx, 'cafe', place) : b.size, b.size + SEATS_STEP);
  const rules = ((pack.extra as { seatThresholds?: unknown } | undefined)?.seatThresholds ?? []) as SeatRule[];
  const buys: Action[] = (Array.isArray(rules) ? rules : [])
    .filter((t) => t && typeof t.seats === 'number' && t.setupItemId && size >= t.seats && !b.items.some((i) => i.id === t.setupItemId && i.qty > 0))
    .map((t) => ({ type: 'buy_item', itemId: t.setupItemId, qty: 1 }));
  return [...buys, { type: 'resize', size }];
}

export const BRANCH_LABEL: Record<PitchBranchId, string> = { price: 'Raise the price', seats: 'Add seats' };

/** Применяет действия по очереди; первая ошибка отменяет всю ветку. */
function actAll(w: WorldState, ctx: EngineCtx, playerId: string, actions: Action[]): { world: WorldState; error?: string } {
  let x = w;
  for (const a of actions) {
    const r = act(x, ctx, playerId, a);
    if (r.error) return { world: w, error: r.error };
    x = r.world;
  }
  return { world: x };
}

function branchOf(w: WorldState, ctx: EngineCtx, deps: HostDeps, maya: string, id: PitchBranchId): PitchBranch {
  const actions = branchActions(w, ctx, maya, id);
  if (!actions) return { id, label: BRANCH_LABEL[id], actions: [], ok: false, error: 'Maya has no business' };
  const live = { ...w, config: { ...w.config, paused: false } };
  const r = actAll(live, ctx, maya, actions);
  if (r.error) return { id, label: BRANCH_LABEL[id], actions, ok: false, error: r.error };
  const from = w.day;
  const after = runDays(r.world, ctx, deps, 7);
  const base = runDays(live, ctx, deps, 7);
  return {
    id, label: BRANCH_LABEL[id], actions, ok: true,
    week: { ...weekSum(bizOf(after, maya), from), baseline: weekSum(bizOf(base, maya), from) },
  };
}

/** Применяет ветку жюри от имени Maya обычными действиями. */
export function applyBranch(w: WorldState, ctx: EngineCtx, setup: Pick<PitchSetup, 'players'>, id: PitchBranchId): { world: WorldState; error?: string; actions?: Action[] } {
  const actions = branchActions(w, ctx, setup.players.maya, id);
  if (!actions) return { world: w, error: 'Maya has no business' };
  const r = actAll(w, ctx, setup.players.maya, actions);
  return r.error ? { world: w, error: r.error, actions } : { world: r.world, actions };
}

// ───────────── жалоба ─────────────

/** Жалоба Maya на Viktor — обычное действие report с шаблоном, который ищет срезанный угол Viktor. */
export function fileComplaint(w: WorldState, ctx: EngineCtx, setup: Pick<PitchSetup, 'players' | 'businesses' | 'shortcut'>): { world: WorldState; error?: string; caseId?: string } {
  const before = new Set(w.cases.map((c) => c.id));
  const r = act(w, ctx, setup.players.maya, { type: 'report', targetBusinessId: setup.businesses.viktor, reportId: setup.shortcut.reportId });
  if (r.error) return { world: w, error: r.error };
  const c = r.world.cases.find((x) => !before.has(x.id) && x.businessId === setup.businesses.viktor);
  return { world: r.world, caseId: c?.id };
}

export interface CaseProgress { caseId: string; status: string; official?: string; found: string[]; fine?: number; answerByDay?: number; openedDay: number; day: number }

/** Где сейчас дело по жалобе: открыто, взято, проверка, уведомление, закрыто. */
export function caseProgress(w: WorldState, caseId: string | undefined): CaseProgress | null {
  const c = caseId ? w.cases.find((x) => x.id === caseId) : undefined;
  if (!c) return null;
  const off = w.officials.find((o) => o.id === c.officialId);
  return {
    caseId: c.id, status: c.status, official: off ? `${off.name}${off.isAi ? ' (AI)' : ''}` : undefined,
    found: (c.found ?? []).map((f) => f.violationId), fine: c.fine, answerByDay: c.answerByDay, openedDay: c.openedDay, day: w.day,
  };
}

const DONE = new Set(['notice', 'bribe_offered', 'closed']);

function dryComplaint(setup: PitchSetup, ctx: EngineCtx, deps: HostDeps): PitchSetup['complaint'] {
  const live = { ...setup.start, config: { ...setup.start.config, paused: false } };
  const f = fileComplaint(live, ctx, setup);
  if (f.error || !f.caseId) return { ok: false, days: null, found: [], error: f.error ?? 'No case was opened' };
  let w = f.world;
  for (let d = 1; d <= PITCH_CASE_DAYS; d++) {
    w = step(w, ctx, deps);
    const p = caseProgress(w, f.caseId);
    if (p && DONE.has(p.status)) {
      return { ok: p.status === 'notice' && p.found.includes(setup.shortcut.violationId), days: d, caseId: f.caseId, found: p.found, fine: p.fine, official: p.official };
    }
  }
  const p = caseProgress(w, f.caseId);
  return { ok: false, days: null, caseId: f.caseId, found: p?.found ?? [], official: p?.official, error: `No notice after ${PITCH_CASE_DAYS} days (status ${p?.status ?? 'unknown'})` };
}

// ───────────── проверки готовности ─────────────

export function pitchChecks(setup: PitchSetup, ctx: EngineCtx): PitchCheck[] {
  const w = setup.start;
  const maya = w.businesses.find((b) => b.id === setup.businesses.maya);
  const viktor = w.businesses.find((b) => b.id === setup.businesses.viktor);
  const out: PitchCheck[] = [];
  const add = (id: string, ok: boolean, text: string, level: PitchCheck['level'] = 'must') => out.push({ id, ok, level, text });
  add('open', maya?.status === 'open' && viktor?.status === 'open', `Both cafes are open: Maya ${maya?.status ?? 'missing'}, Viktor ${viktor?.status ?? 'missing'}`);
  add('neighbors', setup.places.distanceM < NEIGHBOR_RADIUS_M, `The cafes are neighbors: ${setup.places.distanceM} m apart (shared foot traffic under ${NEIGHBOR_RADIUS_M} m)`);
  add('permits', !!maya && !!viktor && permitsReady(maya, w.day) && permitsReady(viktor, w.day), 'Both have every permit, so an inspection cannot find a permit violation first');
  const week = (maya?.days ?? []).slice(-7);
  const lostSize = Math.round(week.reduce((a, d) => a + d.lost.size, 0));
  const lostStaff = Math.round(week.reduce((a, d) => a + d.lost.staff, 0));
  add('customers_lost', lostSize + lostStaff > 0, `Maya turned away customers in the last 7 days: ${lostSize} for lack of seats, ${lostStaff} for lack of staff`, 'should');
  const busy = week.length ? week.reduce((a, d) => a + d.sizeUtilization, 0) / week.length : 0;
  add('room_full', busy >= ROOM_FULL, `Maya's seats are ${Math.round(busy * 100)}% busy on average over the last 7 days (the "more seats" question needs ${Math.round(ROOM_FULL * 100)}%+)`, 'should');
  add('branch_price', setup.branches.price.ok, `Jury branch "${BRANCH_LABEL.price}": ${setup.branches.price.ok ? 'accepted' : setup.branches.price.error}`);
  add('branch_seats', setup.branches.seats.ok, `Jury branch "${BRANCH_LABEL.seats}": ${setup.branches.seats.ok ? 'accepted' : setup.branches.seats.error}`);
  const on = viktor?.orders.shortcuts.includes(setup.shortcut.id) ?? false;
  const openCases = w.cases.filter((c) => c.businessId === setup.businesses.viktor && !DONE.has(c.status));
  add('violation', on && openCases.length === 0, `Viktor runs "${setup.shortcut.name}" with no open case against him yet`);
  const a = viktor ? engine.analyze(viktor, w, ctx) : null;
  add('can_pay', !!viktor && !!a && viktor.cash > a.exposure, `Viktor can pay what an inspector would find: cash ${Math.round(viktor?.cash ?? 0)} vs exposure ${Math.round(a?.exposure ?? 0)}`);
  const c = setup.complaint;
  add('complaint', c.ok, c.ok
    ? `Maya's complaint leads to a new ${setup.shortcut.role === 'tax_auditor' ? 'tax' : 'health'} case and a fine notice in ${c.days} game days (${c.official ?? 'official'})`
    : `The complaint did not reach a notice for "${setup.shortcut.violationId}": ${c.error ?? `found ${c.found.join(', ') || 'nothing'}`}`);
  add('paused', w.config.paused, 'The city waits on pause');
  return out;
}

export interface PitchSummary {
  worldId: string; day: number; date: string; paused: boolean;
  maya: { business: string; cash: number; price: number; seats: number } | null;
  viktor: { business: string; cash: number; shortcuts: string[] } | null;
}

/** Короткая сводка для RUNBOOK и скрипта: что на экране сейчас. */
export function pitchSummary(w: WorldState, setup: Pick<PitchSetup, 'businesses' | 'worldId'>): PitchSummary {
  const m = w.businesses.find((b) => b.id === setup.businesses.maya);
  const v = w.businesses.find((b) => b.id === setup.businesses.viktor);
  return {
    worldId: setup.worldId, day: w.day, date: dateOf(w.day).label, paused: w.config.paused,
    maya: m ? { business: m.name, cash: Math.round(m.cash), price: m.orders.price, seats: m.size } : null,
    viktor: v ? { business: v.name, cash: Math.round(v.cash), shortcuts: v.orders.shortcuts } : null,
  };
}
