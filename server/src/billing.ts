// Тариф First Year Pro: что бесплатно, что платно, оплата через Stripe Checkout (только тестовый режим).
// Подключение — одна строка в createApp (index.ts): mountBilling(app, game). Признак тарифа живёт у игрока
// в `extra.billing` внутри мира, поэтому переживает перезапуск вместе со снимком.
//
// Бесплатно: город, идея, место, план открытия и первый полный месяц своей кофейни (в этот месяц открыт и личный план).
// Pro: весь год (решения после первого месяца), личный план с источниками, советник без лимита, все виды бизнеса.
import type { Express, NextFunction, Request, Response } from 'express';
import type { Action, BusinessState, NicheId, Player, Query, RealWorldPlan, WorldState } from '@ohh/shared';
import { RULES } from '@ohh/shared';
import { answer, type EngineCtx } from '@ohh/host';
import type { WorldRuntime } from './runtime';

// ───────────── что продаём ─────────────

export const PRO_NAME = 'First Year Pro';
/** Цена в центах. Годовая — из docs/pitch/MONEY.md, пока её нет — null (продаём только помесячно). */
export const PRICES: { month: number; year: number | null } = { month: 1900, year: null };
/** Сколько вопросов советнику даём попробовать бесплатно. */
export const FREE_ADVISOR_QUESTIONS = 3;
/** Ниша, которая открыта бесплатно. */
export const FREE_NICHE: NicheId = 'cafe';
/** Решения, которые после бесплатного месяца становятся платными. Соседские ходы (сделки, жалобы, ответы) остаются у всех:
 *  в них участвует второй игрок, и платный не должен ждать бесплатного. */
export const PRO_ACTIONS: ReadonlySet<Action['type']> = new Set(['set_orders', 'buy_item', 'sell_item', 'resize', 'spend']);

export type Interval = 'month' | 'year';
export type Via = 'stripe-test' | 'test-unlock';

/** То, что лежит у игрока в extra.billing. */
export interface BillingRecord {
  plan: 'pro';
  via: Via;
  interval: Interval;
  sinceDay: number;
  sessionId?: string;
}

export interface BillingUsage { advisorUsed: number }

type BilledPlayer = Player & { extra?: Record<string, unknown> };

export interface BillingEnv {
  /** BILLING_GATE=off — ничего не закрываем (запасной выключатель для показа). */
  gate: boolean;
  /** Миры без ограничений: город показа жюри. BILLING_OPEN_WORLDS, по умолчанию `pitch`. */
  openWorlds: Set<string>;
  /** Только тестовый ключ Stripe (sk_test_ / rk_test_). Боевой ключ не принимаем. */
  stripeKey: string | null;
  stripeKeyRejected: boolean;
  /** Готовая цена из кабинета Stripe (price_...). Без неё цена задаётся в запросе (price_data). */
  stripePriceMonth: string | null;
  stripePriceYear: string | null;
}

export function billingEnv(env: NodeJS.ProcessEnv = process.env): BillingEnv {
  const raw = (env.STRIPE_SECRET_KEY ?? '').trim();
  const isTest = /^(sk|rk)_test_[A-Za-z0-9]+$/.test(raw);
  return {
    gate: (env.BILLING_GATE ?? 'on').toLowerCase() !== 'off',
    openWorlds: new Set((env.BILLING_OPEN_WORLDS ?? 'pitch').split(',').map((s) => s.trim()).filter(Boolean)),
    stripeKey: isTest ? raw : null,
    stripeKeyRejected: raw.length > 0 && !isTest,
    stripePriceMonth: env.STRIPE_PRICE_MONTH?.trim() || null,
    stripePriceYear: env.STRIPE_PRICE_YEAR?.trim() || null,
  };
}

// ───────────── чистые функции: кто что может ─────────────

function playerOf(w: WorldState, playerId: string): BilledPlayer | undefined {
  return w.players.find((p) => p.id === playerId) as BilledPlayer | undefined;
}

export function billingOf(p: Player | undefined): BillingRecord | null {
  const b = (p as BilledPlayer | undefined)?.extra?.billing as BillingRecord | undefined;
  return b && b.plan === 'pro' ? b : null;
}

export function usageOf(p: Player | undefined): BillingUsage {
  const u = (p as BilledPlayer | undefined)?.extra?.billingUsage as Partial<BillingUsage> | undefined;
  return { advisorUsed: Math.max(0, Number(u?.advisorUsed ?? 0) || 0) };
}

const monthEnd = (day: number): number => Math.ceil(day / RULES.DAYS_PER_MONTH) * RULES.DAYS_PER_MONTH;

/** Бизнесы, которыми игрок управлял за сезон (и текущий, и разорившиеся). */
function businessesOf(w: WorldState, playerId: string): BusinessState[] {
  return w.businesses.filter((b) => b.managerPlayerId === playerId && !b.isAi);
}

/**
 * Последний бесплатный день: конец первого полного месяца после открытия дверей.
 * Открылся на 82-й день → месяц 3 закрывается на 90-м, первый полный месяц — 91–120, бесплатно до 120-го включительно.
 * Пока двери не открыты — null: стройка и разрешения бесплатны целиком.
 */
export function freeEndsDay(w: WorldState, playerId: string): number | null {
  const opened = businessesOf(w, playerId).map((b) => b.openedDay).filter((d): d is number => typeof d === 'number');
  if (opened.length === 0) return null;
  return monthEnd(Math.min(...opened)) + RULES.DAYS_PER_MONTH;
}

export type Stage = 'before_opening' | 'free_month' | 'autopilot' | 'pro' | 'open_world';

export interface Entitlement {
  plan: 'free' | 'pro';
  stage: Stage;
  /** игрок может менять решения сегодня */
  canManage: boolean;
  freeEndsDay: number | null;
  daysLeft: number | null;
  advisorLeft: number | null;     // null — без лимита
  pro: BillingRecord | null;
  checkout: 'stripe-test' | 'test-unlock';
  prices: { month: number; year: number | null; currency: 'usd' };
  /** что закрыто прямо сейчас: id для экрана */
  locked: ('decisions' | 'plan' | 'advisor' | 'niches')[];
}

export function entitlement(w: WorldState, playerId: string, env: BillingEnv): Entitlement {
  const p = playerOf(w, playerId);
  const pro = billingOf(p);
  const open = !env.gate || env.openWorlds.has(w.config.id) || p?.kind !== 'owner';
  const ends = freeEndsDay(w, playerId);
  const daysLeft = ends === null ? null : Math.max(0, ends - w.day);
  const pastFree = ends !== null && w.day > ends;
  const advisorLeft = pro || open ? null : Math.max(0, FREE_ADVISOR_QUESTIONS - usageOf(p).advisorUsed);
  const stage: Stage = open ? 'open_world' : pro ? 'pro' : ends === null ? 'before_opening' : pastFree ? 'autopilot' : 'free_month';
  const locked: Entitlement['locked'] = [];
  if (!pro && !open) {
    // Первый месяц игрок пробует всё, включая личный план: решения и план закрываются вместе, когда месяц кончился.
    if (pastFree) locked.push('decisions', 'plan');
    if (advisorLeft === 0) locked.push('advisor');
    locked.push('niches');
  }
  return {
    plan: pro ? 'pro' : 'free', stage, canManage: !locked.includes('decisions'), freeEndsDay: ends, daysLeft, advisorLeft, pro,
    checkout: env.stripeKey ? 'stripe-test' : 'test-unlock',
    prices: { month: PRICES.month, year: PRICES.year, currency: 'usd' },
    locked,
  };
}

export const PAYWALL_PATH = '/pro';

/** Ошибка для действия, которое закрыто тарифом; null — пропускаем. */
export function gateAction(w: WorldState, playerId: string, a: Action, env: BillingEnv): string | null {
  const e = entitlement(w, playerId, env);
  if (e.plan === 'pro' || e.stage === 'open_world') return null;
  if (a.type === 'open_business' && a.niche !== FREE_NICHE) {
    return `Opening a ${a.niche} is part of ${PRO_NAME}. The coffee shop is free — or unlock every kind of business on ${PAYWALL_PATH}.`;
  }
  if (PRO_ACTIONS.has(a.type) && e.locked.includes('decisions')) {
    return `Your free month ended on day ${e.freeEndsDay}. Your cafe keeps running on your last orders; to change them, open ${PRO_NAME} on ${PAYWALL_PATH}.`;
  }
  return null;
}

/** Ошибка для запроса, который закрыт тарифом; null — пропускаем. */
export function gateQuery(w: WorldState, playerId: string | null, q: Query, env: BillingEnv): string | null {
  if (!playerId) return null;
  const e = entitlement(w, playerId, env);
  if (e.plan === 'pro' || e.stage === 'open_world') return null;
  if (q.type === 'real_world_plan' && e.locked.includes('plan')) {
    return `Your free month ended on day ${e.freeEndsDay}: your personal plan with official links and sources stays in ${PRO_NAME}. See what it holds for you on ${PAYWALL_PATH}.`;
  }
  if (q.type === 'advisor' && e.advisorLeft === 0) {
    return `You have used your ${FREE_ADVISOR_QUESTIONS} free questions to the advisor. ${PRO_NAME} answers without a limit: ${PAYWALL_PATH}.`;
  }
  return null;
}

function patchPlayer(w: WorldState, playerId: string, patch: Record<string, unknown>): WorldState {
  return {
    ...w,
    version: w.version + 1,
    players: w.players.map((p) => (p.id === playerId ? ({ ...p, extra: { ...((p as BilledPlayer).extra ?? {}), ...patch } } as Player) : p)),
  };
}

export function grantPro(w: WorldState, playerId: string, rec: Omit<BillingRecord, 'plan' | 'sinceDay'>): WorldState {
  const record: BillingRecord = { plan: 'pro', sinceDay: w.day, ...rec };
  return patchPlayer(w, playerId, { billing: record });
}

export function countAdvisorQuestion(w: WorldState, playerId: string): WorldState {
  const used = usageOf(playerOf(w, playerId)).advisorUsed + 1;
  return patchPlayer(w, playerId, { billingUsage: { advisorUsed: used } });
}

/** Что игрок получит в личном плане — только заголовки и счёт строк, без самих шагов и ссылок. */
export interface PlanTeaser {
  businessName: string;
  startupTotal: number;
  monthlyTotal: number;
  reserveAdvised: number;
  paybackMonths: number | null;
  steps: number;
  stepsWithLinks: number;
  suppliers: number;
  lessons: number;
}

export function planTeaser(plan: RealWorldPlan): PlanTeaser {
  const link = (s: unknown) => typeof (s as { url?: unknown }).url === 'string' || typeof (s as { link?: unknown }).link === 'string' || Array.isArray((s as { sources?: unknown }).sources);
  return {
    businessName: plan.businessName, startupTotal: plan.startupTotal, monthlyTotal: plan.monthlyTotal, reserveAdvised: plan.reserveAdvised,
    paybackMonths: plan.paybackMonths, steps: plan.checklist.length, stepsWithLinks: plan.checklist.filter(link).length,
    suppliers: plan.suppliers.length, lessons: plan.lessons.length,
  };
}

// ───────────── Stripe Checkout (тестовый режим) ─────────────
// POST https://api.stripe.com/v1/checkout/sessions, тело — application/x-www-form-urlencoded, ключ — Bearer.
// mode=subscription; цена — line_items[0][price] (готовая) или line_items[0][price_data] с recurring[interval].
// Возврат: success_url с {CHECKOUT_SESSION_ID}; проверка — GET /v1/checkout/sessions/{id}: status=complete.

const STRIPE_API = 'https://api.stripe.com/v1';
const STRIPE_TIMEOUT_MS = 8_000;

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function formEncode(obj: Record<string, string | number | undefined>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

export function checkoutForm(p: { worldId: string; playerId: string; interval: Interval; origin: string; env: BillingEnv }): Record<string, string | number | undefined> {
  const cents = p.interval === 'year' ? PRICES.year : PRICES.month;
  const priceId = p.interval === 'year' ? p.env.stripePriceYear : p.env.stripePriceMonth;
  const back = `${p.origin}${PAYWALL_PATH}?world=${encodeURIComponent(p.worldId)}`;
  const form: Record<string, string | number | undefined> = {
    mode: 'subscription',
    client_reference_id: `${p.worldId}:${p.playerId}`,
    success_url: `${back}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${back}&canceled=1`,
    'line_items[0][quantity]': 1,
    'metadata[world]': p.worldId,
    'metadata[player]': p.playerId,
    'subscription_data[metadata][world]': p.worldId,
    'subscription_data[metadata][player]': p.playerId,
  };
  if (priceId) form['line_items[0][price]'] = priceId;
  else {
    form['line_items[0][price_data][currency]'] = 'usd';
    form['line_items[0][price_data][unit_amount]'] = cents ?? PRICES.month;
    form['line_items[0][price_data][recurring][interval]'] = p.interval;
    form['line_items[0][price_data][product_data][name]'] = PRO_NAME;
    form['line_items[0][price_data][product_data][description]'] = 'The whole first year of your business, your personal plan with sources, the advisor, every kind of business.';
  }
  return form;
}

async function stripe(fetchImpl: FetchLike, key: string, method: 'GET' | 'POST', path: string, form?: Record<string, string | number | undefined>): Promise<Record<string, unknown>> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), STRIPE_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${STRIPE_API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
      body: form ? formEncode(form) : undefined,
      signal: ctl.signal,
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg = (body.error as { message?: string } | undefined)?.message ?? `Stripe answered ${res.status}`;
      throw new Error(msg);
    }
    return body;
  } finally {
    clearTimeout(t);
  }
}

// ───────────── HTTP ─────────────

export interface BillingHost {
  runtimes: Map<string, WorldRuntime>;
  data: { ctx: EngineCtx };
  log: (m: string) => void;
}

export interface BillingOptions { env?: BillingEnv; fetchImpl?: FetchLike }

type BReq = Request & { billingRt?: WorldRuntime; billingPlayer?: string };

const bearer = (req: Request): string | undefined => {
  const h = req.headers.authorization;
  return h && h.startsWith('Bearer ') ? h.slice(7).trim() : undefined;
};

function originOf(req: Request): string {
  const fromEnv = process.env.PUBLIC_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const o = req.get('origin');
  if (o && /^https?:\/\/[^/\s]+$/.test(o)) return o;
  return `${req.protocol}://${req.get('host')}`;
}

/** Ставит тариф: проверки перед /action и /query и маршруты /billing. Вызывать до маршрутов мира в createApp. */
export function mountBilling(app: Express, host: BillingHost, opts: BillingOptions = {}): void {
  const env = opts.env ?? billingEnv();
  const fetchImpl: FetchLike = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  if (env.stripeKeyRejected) host.log('billing: STRIPE_SECRET_KEY is not a test key — ignored, the button unlocks in test mode');
  else host.log(`billing: ${env.stripeKey ? 'Stripe Checkout (test mode)' : 'no Stripe key, test-mode unlock'}; gate ${env.gate ? 'on' : 'off'}; open worlds: ${[...env.openWorlds].join(', ') || 'none'}`);

  const who = (req: BReq, _res: Response, next: NextFunction) => {
    const rt = host.runtimes.get(String(req.params.id));
    req.billingRt = rt;
    req.billingPlayer = rt?.playerFor(bearer(req));
    next();
  };
  const needPlayer = (req: BReq, res: Response): req is BReq & { billingRt: WorldRuntime; billingPlayer: string } => {
    if (!req.billingRt) { res.status(404).json({ ok: false, error: 'Unknown world' }); return false; }
    if (!req.billingPlayer) { res.status(401).json({ ok: false, error: 'Join the city first' }); return false; }
    return true;
  };
  const refuse = (res: Response, error: string) => res.status(402).json({ ok: false, error, data: { paywall: PAYWALL_PATH } });

  app.post('/api/worlds/:id/action', who, (req: BReq, res: Response, next: NextFunction) => {
    if (!req.billingRt || !req.billingPlayer) { next(); return; }
    const body = req.body as { action?: unknown } | undefined;
    const a = (body && typeof body === 'object' && 'action' in body ? body.action : body) as Action | undefined;
    if (!a || typeof a !== 'object' || typeof a.type !== 'string') { next(); return; }
    const err = gateAction(req.billingRt.world, req.billingPlayer, a, env);
    if (err) { refuse(res, err); return; }
    next();
  });

  app.post('/api/worlds/:id/query', who, (req: BReq, res: Response, next: NextFunction) => {
    if (!req.billingRt || !req.billingPlayer) { next(); return; }
    const body = req.body as { query?: unknown } | undefined;
    const q = (body && typeof body === 'object' && 'query' in body ? body.query : body) as Query | undefined;
    if (!q || typeof q !== 'object' || typeof q.type !== 'string') { next(); return; }
    const rt = req.billingRt;
    const err = gateQuery(rt.world, req.billingPlayer, q, env);
    if (err) { refuse(res, err); return; }
    const pid = req.billingPlayer;
    if (q.type === 'advisor' && entitlement(rt.world, pid, env).advisorLeft !== null) {
      // считаем только отвеченные вопросы: отказ хоста («сначала откройте бизнес») бесплатный вопрос не съедает
      res.on('finish', () => {
        if (res.statusCode !== 200) return;
        rt.world = countAdvisorQuestion(rt.world, pid);
        rt.saveSoon();
      });
    }
    next();
  });

  const status = (rt: WorldRuntime, playerId: string) => {
    const e = entitlement(rt.world, playerId, env);
    let teaser: PlanTeaser | null = null;
    try {
      teaser = planTeaser(answer(rt.world, host.data.ctx, playerId, { type: 'real_world_plan' }) as RealWorldPlan);
    } catch {
      teaser = null;
    }
    return { ...e, teaser, stripeConfigured: Boolean(env.stripeKey) };
  };

  app.get('/api/worlds/:id/billing', who, (req: BReq, res: Response) => {
    if (!needPlayer(req, res)) return;
    res.json({ ok: true, data: status(req.billingRt, req.billingPlayer) });
  });

  app.post('/api/worlds/:id/billing/checkout', who, async (req: BReq, res: Response) => {
    if (!needPlayer(req, res)) return;
    const rt = req.billingRt;
    const pid = req.billingPlayer;
    const interval: Interval = (req.body as { interval?: unknown } | undefined)?.interval === 'year' && PRICES.year !== null ? 'year' : 'month';
    if (billingOf(rt.world.players.find((p) => p.id === pid))) { res.json({ ok: true, data: { unlocked: true, mode: 'already', status: status(rt, pid) } }); return; }
    if (!env.stripeKey) {
      rt.world = grantPro(rt.world, pid, { via: 'test-unlock', interval });
      rt.saveSoon();
      host.log(`billing: ${rt.id}/${pid} unlocked in test mode (no Stripe key)`);
      res.json({ ok: true, data: { unlocked: true, mode: 'test-unlock', status: status(rt, pid) } });
      return;
    }
    try {
      const s = await stripe(fetchImpl, env.stripeKey, 'POST', '/checkout/sessions', checkoutForm({ worldId: rt.id, playerId: pid, interval, origin: originOf(req), env }));
      if (typeof s.url !== 'string') throw new Error('Stripe returned no checkout URL');
      res.json({ ok: true, data: { unlocked: false, mode: 'stripe-test', url: s.url, sessionId: s.id } });
    } catch (e) {
      host.log(`billing: checkout failed: ${(e as Error).message}`);
      res.status(502).json({ ok: false, error: `Stripe test checkout is not available right now: ${(e as Error).message}` });
    }
  });

  app.post('/api/worlds/:id/billing/confirm', who, async (req: BReq, res: Response) => {
    if (!needPlayer(req, res)) return;
    const rt = req.billingRt;
    const pid = req.billingPlayer;
    const sessionId = (req.body as { sessionId?: unknown } | undefined)?.sessionId;
    if (typeof sessionId !== 'string' || !/^cs_(test_)?[A-Za-z0-9_]+$/.test(sessionId)) { res.status(400).json({ ok: false, error: 'Send { sessionId: "cs_test_..." }' }); return; }
    if (!env.stripeKey) { res.status(400).json({ ok: false, error: 'Stripe is not configured on this server' }); return; }
    try {
      const s = await stripe(fetchImpl, env.stripeKey, 'GET', `/checkout/sessions/${encodeURIComponent(sessionId)}`);
      if (s.client_reference_id !== `${rt.id}:${pid}`) { res.status(403).json({ ok: false, error: 'This checkout belongs to another player' }); return; }
      const paid = s.status === 'complete' && (s.payment_status === 'paid' || s.payment_status === 'no_payment_required');
      if (!paid) { res.json({ ok: true, data: { unlocked: false, stripeStatus: s.status, status: status(rt, pid) } }); return; }
      if (!billingOf(rt.world.players.find((p) => p.id === pid))) {
        const interval: Interval = s.mode === 'subscription' && typeof s.metadata === 'object' ? (checkoutInterval(s) ?? 'month') : 'month';
        rt.world = grantPro(rt.world, pid, { via: 'stripe-test', interval, sessionId });
        rt.saveSoon();
        host.log(`billing: ${rt.id}/${pid} paid in Stripe test mode (${sessionId})`);
      }
      res.json({ ok: true, data: { unlocked: true, mode: 'stripe-test', status: status(rt, pid) } });
    } catch (e) {
      res.status(502).json({ ok: false, error: `Could not check the payment with Stripe: ${(e as Error).message}` });
    }
  });
}

function checkoutInterval(s: Record<string, unknown>): Interval | null {
  const amount = typeof s.amount_total === 'number' ? s.amount_total : null;
  if (amount !== null && PRICES.year !== null && amount === PRICES.year) return 'year';
  return amount === null ? null : 'month';
}
