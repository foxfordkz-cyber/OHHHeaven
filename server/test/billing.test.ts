// Тариф Pro (server/src/billing.ts): бесплатный первый месяц, автопилот после него, тестовое открытие и Stripe Checkout.
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OpenRecommendation, Place } from '@ohh/shared';
import { billingEnv, checkoutForm, entitlement, freeEndsDay, formEncode, FREE_ADVISOR_QUESTIONS, gateAction, grantPro, PRICES } from '../src/billing';
import { createApp, GameServer } from '../src/index';

const quiet = () => {};
const newGame = () => new GameServer({ snapshotDir: null, autoStart: false, log: quiet }).boot();
type App = ReturnType<typeof createApp>;

const ENV_KEYS = ['STRIPE_SECRET_KEY', 'BILLING_GATE', 'BILLING_OPEN_WORLDS', 'PUBLIC_URL'] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  vi.unstubAllGlobals();
});

async function joinOwner(app: App, name: string, world = 'demo') {
  const r = await request(app).post(`/api/worlds/${world}/join`).send({ name, kind: 'owner' });
  expect(r.status).toBe(200);
  return r.body.data as { playerId: string; token: string };
}

/** Opens a cafe on the first affordable free door and launches it once the build-out is over. */
async function openAndLaunch(app: App, game: GameServer, token: string, world = 'demo') {
  const rt = game.runtimes.get(world)!;
  const free = (game.data.places as Place[]).filter((p) => p.suitableFor.includes('cafe') && !rt.world.businesses.some((b) => b.placeId === p.id));
  const ordered = [...free.filter((p) => p.forSale), ...free.filter((p) => !p.forSale)];
  let place: Place | undefined;
  let rec: OpenRecommendation | undefined;
  let seen = 0;
  for (const p of ordered) {
    const q = await request(app).post(`/api/worlds/${world}/query`).set('Authorization', `Bearer ${token}`).send({ type: 'recommend_opening', niche: 'cafe', placeId: p.id });
    const r = (q.body.data as OpenRecommendation[])[0];
    if (r.cashLeft < 0) continue;
    if (!rec || r.cashLeft > rec.cashLeft) { place = p; rec = r; }
    if (++seen >= 5) break;
  }
  if (!place || !rec) throw new Error('no affordable door in the test data');
  const auth = { Authorization: `Bearer ${token}` };
  await request(app).post(`/api/worlds/${world}/action`).set(auth).send({ type: 'open_business', niche: 'cafe', placeId: place.id, name: 'Pro Test Cafe', kitId: rec.kitId, size: rec.size, items: rec.items }).expect(200);
  await request(app).post(`/api/worlds/${world}/action`).set(auth).send({ type: 'set_orders', orders: rec.orders }).expect(200);
  rt.advance(rec.daysToOpen);
  await request(app).post(`/api/worlds/${world}/action`).set(auth).send({ type: 'launch' }).expect(200);
  return rec;
}

const billing = (app: App, token: string, world = 'demo') => request(app).get(`/api/worlds/${world}/billing`).set('Authorization', `Bearer ${token}`);

describe('billing env', () => {
  it('takes only Stripe test keys; the gate is on and the show city is open by default', () => {
    expect(billingEnv({}).stripeKey).toBeNull();
    expect(billingEnv({}).gate).toBe(true);
    expect([...billingEnv({}).openWorlds]).toEqual(['pitch']);
    expect(billingEnv({ STRIPE_SECRET_KEY: 'sk_test_abc123' }).stripeKey).toBe('sk_test_abc123');
    const live = billingEnv({ STRIPE_SECRET_KEY: 'sk_live_abc123' });
    expect(live.stripeKey).toBeNull();
    expect(live.stripeKeyRejected).toBe(true);
    expect(billingEnv({ BILLING_GATE: 'off' }).gate).toBe(false);
  });

  it('builds a subscription checkout at $19 a month for this player', () => {
    const form = checkoutForm({ worldId: 'demo', playerId: 'p7', interval: 'month', origin: 'https://fy.example', env: billingEnv({}) });
    expect(form.mode).toBe('subscription');
    expect(form.client_reference_id).toBe('demo:p7');
    expect(form['line_items[0][price_data][unit_amount]']).toBe(PRICES.month);
    expect(form['line_items[0][price_data][recurring][interval]']).toBe('month');
    expect(String(form.success_url)).toContain('session_id={CHECKOUT_SESSION_ID}');
    expect(formEncode({ a: 'x y', b: undefined, 'c[d]': 1 })).toBe('a=x%20y&c%5Bd%5D=1');
    const yearly = checkoutForm({ worldId: 'demo', playerId: 'p7', interval: 'year', origin: 'https://fy.example', env: billingEnv({}) });
    expect(yearly['line_items[0][price_data][unit_amount]']).toBe(14_900);
    expect(yearly['line_items[0][price_data][recurring][interval]']).toBe('year');
    const fixed = checkoutForm({ worldId: 'demo', playerId: 'p7', interval: 'month', origin: 'https://fy.example', env: { ...billingEnv({}), stripePriceMonth: 'price_123' } });
    expect(fixed['line_items[0][price]']).toBe('price_123');
    expect(fixed['line_items[0][price_data][unit_amount]']).toBeUndefined();
  });
});

let sharedGame: GameServer | null = null;
const shared = () => (sharedGame ??= newGame());

describe('the free month, then autopilot', () => {
  it('free until the end of the first full month after opening; then decisions and the plan need Pro, neighbour moves do not', async () => {
    const game = newGame();
    const app = createApp(game);
    const rt = game.runtimes.get('demo')!;
    const { playerId, token } = await joinOwner(app, 'Paula');
    const auth = { Authorization: `Bearer ${token}` };

    const before = (await billing(app, token).expect(200)).body.data;
    expect(before).toMatchObject({ plan: 'free', stage: 'before_opening', canManage: true, freeEndsDay: null, checkout: 'test-unlock' });

    await openAndLaunch(app, game, token);
    const biz = rt.world.businesses.find((b) => b.managerPlayerId === playerId)!;
    const ends = Math.ceil(biz.openedDay! / 30) * 30 + 30;
    expect(freeEndsDay(rt.world, playerId)).toBe(ends);
    const during = (await billing(app, token).expect(200)).body.data;
    expect(during).toMatchObject({ stage: 'free_month', canManage: true, freeEndsDay: ends, daysLeft: ends - rt.world.day });
    expect(during.teaser.startupTotal).toBeGreaterThan(0);
    await request(app).post('/api/worlds/demo/action').set(auth).send({ type: 'set_orders', orders: { price: biz.orders.price + 0.25 } }).expect(200);
    await request(app).post('/api/worlds/demo/query').set(auth).send({ type: 'real_world_plan' }).expect(200);

    const inbox = async () => ((await request(app).get('/api/worlds/demo/view').set(auth).expect(200)).body as { me: { inbox: { id: string; title: string; text: string }[] } }).me.inbox;
    const freeMail = (await inbox()).filter((i) => i.id.startsWith('billing:'));
    expect(freeMail.map((i) => i.title)).toEqual([`Free until day ${ends}`]);
    expect(freeMail[0].text).toContain('/pro');

    rt.advance(ends - rt.world.day + 1);
    expect(rt.world.day).toBe(ends + 1);
    await inbox();
    const mail = (await inbox()).filter((i) => i.id.startsWith('billing:'));
    expect(mail.map((i) => i.id)).toEqual([`billing:free:${playerId}`, `billing:autopilot:${playerId}`]);
    expect(mail[1].text).toContain('/pro');
    const after = (await billing(app, token).expect(200)).body.data;
    expect(after).toMatchObject({ stage: 'autopilot', canManage: false });
    expect(after.locked).toEqual(expect.arrayContaining(['decisions', 'plan']));
    const refused = await request(app).post('/api/worlds/demo/action').set(auth).send({ type: 'set_orders', orders: { price: biz.orders.price } });
    expect(refused.status).toBe(402);
    expect(refused.body.error).toContain('/pro');
    await request(app).post('/api/worlds/demo/action').set(auth).send({ type: 'resize', size: biz.size + 2 }).expect(402);
    await request(app).post('/api/worlds/demo/query').set(auth).send({ type: 'real_world_plan' }).expect(402);
    await request(app).post('/api/worlds/demo/action').set(auth).send({ type: 'read_inbox', ids: [] }).expect(200);
    // the cafe keeps running on its last orders: the day goes on, the business is still there
    rt.advance(3);
    expect(rt.world.businesses.find((b) => b.id === biz.id)?.status).not.toBe('setup');

    // test-mode unlock (no Stripe key): Pro at once, nothing charged, controls back
    const buy = await request(app).post('/api/worlds/demo/billing/checkout').set(auth).send({ interval: 'month' }).expect(200);
    expect(buy.body.data).toMatchObject({ unlocked: true, mode: 'test-unlock' });
    expect(buy.body.data.status).toMatchObject({ plan: 'pro', stage: 'pro', canManage: true, locked: [] });
    await request(app).post('/api/worlds/demo/action').set(auth).send({ type: 'set_orders', orders: { price: biz.orders.price } }).expect(200);
    await request(app).post('/api/worlds/demo/query').set(auth).send({ type: 'real_world_plan' }).expect(200);
    // Pro survives the days that follow (the engine copies players with their extra)
    rt.advance(5);
    expect((await billing(app, token).expect(200)).body.data.plan).toBe('pro');
    // the mark lives with the player inside the world, so it is in every snapshot
    const snap = rt.snapshot();
    const me = snap.world.players.find((p) => p.id === playerId) as { extra?: { billing?: { plan: string; via: string } } };
    expect(me.extra?.billing).toMatchObject({ plan: 'pro', via: 'test-unlock' });
  });

  it('other kinds of business are Pro; the coffee shop is free', async () => {
    const w = shared().runtimes.get('demo')!.world;
    const env = billingEnv({});
    const owner = w.players.find((p) => p.kind === 'owner' && p.isAi)!;
    const free = { ...w, players: w.players.map((p) => (p.id === owner.id ? { ...p, isAi: false } : p)), businesses: w.businesses.filter((b) => b.managerPlayerId !== owner.id) };
    const barber = gateAction(free, owner.id, { type: 'open_business', niche: 'barbershop', placeId: 'x', name: 'Cuts', kitId: 'standard', size: 4 }, env);
    expect(barber).toContain('/pro');
    expect(gateAction(free, owner.id, { type: 'open_business', niche: 'cafe', placeId: 'x', name: 'Cup', kitId: 'standard', size: 20 }, env)).toBeNull();
    const pro = grantPro(free, owner.id, { via: 'test-unlock', interval: 'month' });
    expect(pro.version).toBe(free.version + 1);
    expect(gateAction(pro, owner.id, { type: 'open_business', niche: 'barbershop', placeId: 'x', name: 'Cuts', kitId: 'standard', size: 4 }, env)).toBeNull();
  });

  it('the show city and BILLING_GATE=off lock nothing', async () => {
    const w0 = shared().runtimes.get('demo')!.world;
    const biz = w0.businesses.find((b) => b.isAi)!;
    const owner = w0.players.find((p) => p.id === biz.managerPlayerId)!;
    // an AI resident made human for the check: opened on day 1, now day 100 — long past the free month
    const w = { ...w0, day: 100, businesses: w0.businesses.map((b) => (b.id === biz.id ? { ...b, isAi: false, openedDay: 1 } : b)), players: w0.players.map((p) => (p.id === owner.id ? { ...p, isAi: false } : p)) };
    expect(entitlement(w, owner.id, billingEnv({})).stage).toBe('autopilot');
    expect(entitlement(w, owner.id, billingEnv({ BILLING_GATE: 'off' })).stage).toBe('open_world');
    const pitch = { ...w, config: { ...w.config, id: 'pitch' } };
    expect(entitlement(pitch, owner.id, billingEnv({})).canManage).toBe(true);
  });
});

describe('advisor', () => {
  it(`gives ${FREE_ADVISOR_QUESTIONS} answered questions free; a refusal does not use one up`, async () => {
    const game = newGame();
    const app = createApp(game);
    const { token } = await joinOwner(app, 'Quinn');
    const ask = (question: string) => request(app).post('/api/worlds/demo/query').set('Authorization', `Bearer ${token}`).send({ type: 'advisor', question });
    await ask('Before I open?').expect(400);
    expect((await billing(app, token)).body.data.advisorLeft).toBe(FREE_ADVISOR_QUESTIONS);
    await openAndLaunch(app, game, token);
    for (let i = 0; i < FREE_ADVISOR_QUESTIONS; i++) await ask(`Question ${i}?`).expect(200);
    expect((await billing(app, token)).body.data).toMatchObject({ advisorLeft: 0 });
    const over = await ask('One more?');
    expect(over.status).toBe(402);
    expect(over.body.error).toContain('/pro');
  });
});

describe('Stripe test checkout', () => {
  it('sends the player to Stripe and opens Pro only after Stripe says the session is complete and paid', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake123';
    process.env.PUBLIC_URL = 'https://fy.example';
    const calls: { url: string; method: string; body?: string; auth?: string }[] = [];
    const sessions = new Map<string, Record<string, unknown>>();
    vi.stubGlobal('fetch', async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
      calls.push({ url, method: init.method, body: init.body, auth: init.headers.Authorization });
      if (init.method === 'POST') {
        const form = new URLSearchParams(init.body);
        const id = `cs_test_${calls.length}`;
        sessions.set(id, { id, object: 'checkout.session', mode: 'subscription', status: 'open', payment_status: 'unpaid', client_reference_id: form.get('client_reference_id'), amount_total: Number(form.get('line_items[0][price_data][unit_amount]')), metadata: { world: form.get('metadata[world]'), player: form.get('metadata[player]'), interval: form.get('metadata[interval]') } });
        return { ok: true, status: 200, json: async () => ({ ...sessions.get(id), url: `https://checkout.stripe.com/c/pay/${id}` }) };
      }
      const id = decodeURIComponent(url.split('/').pop()!);
      const s = sessions.get(id);
      return s ? { ok: true, status: 200, json: async () => s } : { ok: false, status: 404, json: async () => ({ error: { message: 'No such checkout.session' } }) };
    });
    const game = newGame();
    const app = createApp(game);
    const { token } = await joinOwner(app, 'Riya');
    const other = await joinOwner(app, 'Sam');
    const auth = { Authorization: `Bearer ${token}` };
    expect((await billing(app, token)).body.data).toMatchObject({ checkout: 'stripe-test', stripeConfigured: true });

    const start = await request(app).post('/api/worlds/demo/billing/checkout').set(auth).send({ interval: 'year' }).expect(200);
    expect(start.body.data).toMatchObject({ unlocked: false, mode: 'stripe-test' });
    expect(start.body.data.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    expect(calls[0].url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(calls[0].auth).toBe('Bearer sk_test_fake123');
    const form = new URLSearchParams(calls[0].body);
    expect(form.get('mode')).toBe('subscription');
    expect(form.get('success_url')).toBe('https://fy.example/pro?world=demo&session_id={CHECKOUT_SESSION_ID}');
    const sessionId = start.body.data.sessionId as string;

    // not paid yet: nothing opens
    const early = await request(app).post('/api/worlds/demo/billing/confirm').set(auth).send({ sessionId }).expect(200);
    expect(early.body.data.unlocked).toBe(false);
    // somebody else's session cannot open my Pro, mine cannot open theirs
    await request(app).post('/api/worlds/demo/billing/confirm').set('Authorization', `Bearer ${other.token}`).send({ sessionId }).expect(403);
    await request(app).post('/api/worlds/demo/billing/confirm').set(auth).send({ sessionId: 'not-a-session' }).expect(400);

    sessions.set(sessionId, { ...sessions.get(sessionId)!, status: 'complete', payment_status: 'paid' });
    const done = await request(app).post('/api/worlds/demo/billing/confirm').set(auth).send({ sessionId }).expect(200);
    expect(done.body.data).toMatchObject({ unlocked: true, mode: 'stripe-test' });
    expect(done.body.data.status.pro).toMatchObject({ via: 'stripe-test', interval: 'year' });
    expect(new URLSearchParams(calls[0].body).get('line_items[0][price_data][unit_amount]')).toBe('14900');
    expect((await billing(app, other.token)).body.data.plan).toBe('free');
  });

  it('a Stripe error is a clear 502, not a crash', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake123';
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'Invalid API Key provided' } }) }));
    const game = newGame();
    const app = createApp(game);
    const { token } = await joinOwner(app, 'Tess');
    const r = await request(app).post('/api/worlds/demo/billing/checkout').set('Authorization', `Bearer ${token}`).send({}).expect(502);
    expect(r.body.error).toContain('Invalid API Key');
    expect((await billing(app, token)).body.data.plan).toBe('free');
  });

  it('billing needs a player and a known world', async () => {
    const app = createApp(newGame());
    await request(app).get('/api/worlds/demo/billing').expect(401);
    await request(app).get('/api/worlds/demo/billing').set('Authorization', 'Bearer nope').expect(401);
    const { token } = await joinOwner(app, 'Uma');
    await request(app).get('/api/worlds/nowhere/billing').set('Authorization', `Bearer ${token}`).expect(404);
  });
});
