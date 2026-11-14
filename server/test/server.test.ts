import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import type { OpenRecommendation, OwnerView, Place } from '@ohh/shared';
import { defaultDeps } from '@ohh/host';
import { createApp, GameServer } from '../src/index';

const quiet = () => {};
const newGame = (over: ConstructorParameters<typeof GameServer>[0] = {}) => new GameServer({ snapshotDir: null, autoStart: false, log: quiet, ...over }).boot();
const tmp: string[] = [];
afterAll(() => { for (const d of tmp) rmSync(d, { recursive: true, force: true }); });

async function joinOwner(app: ReturnType<typeof createApp>, world = 'demo', name = 'Alice') {
  const r = await request(app).post(`/api/worlds/${world}/join`).send({ name, kind: 'owner' });
  expect(r.status).toBe(200);
  return r.body.data as { playerId: string; token: string };
}

async function openCafe(app: ReturnType<typeof createApp>, game: GameServer, token: string, world = 'demo') {
  const rt = game.runtimes.get(world)!;
  // the first free door a newcomer can afford: an operating shop for sale first (no months of construction)
  const free = (game.data.places as Place[]).filter((p) => p.suitableFor.includes('cafe') && !rt.world.businesses.some((b) => b.placeId === p.id));
  const ordered = [...free.filter((p) => p.forSale), ...free.filter((p) => !p.forSale)];
  // among the first affordable ones, the door that leaves the most cash: a shop bought with the last dollar is
  // bankrupt at the first month close, before its doors open
  let place: Place | undefined;
  let rec: OpenRecommendation | undefined;
  let seen = 0;
  for (const p of ordered) {
    const q = await request(app).post(`/api/worlds/${world}/query`).set('Authorization', `Bearer ${token}`).send({ type: 'recommend_opening', niche: 'cafe', placeId: p.id });
    expect(q.body.ok).toBe(true);
    const r = (q.body.data as OpenRecommendation[])[0];
    if (r.cashLeft < 0) continue;
    if (!rec || r.cashLeft > rec.cashLeft) { place = p; rec = r; }
    if (++seen >= 5) break;
  }
  if (!place || !rec) throw new Error('no affordable door in the test data');
  const auth = { Authorization: `Bearer ${token}` };
  const o = await request(app).post(`/api/worlds/${world}/action`).set(auth).send({ type: 'open_business', niche: 'cafe', placeId: place.id, name: 'Test Cafe', kitId: rec.kitId, size: rec.size, items: rec.items });
  expect(o.body).toMatchObject({ ok: true });
  await request(app).post(`/api/worlds/${world}/action`).set(auth).send({ type: 'set_orders', orders: rec.orders }).expect(200);
  return rec;
}

describe('http api', () => {
  const game = newGame();
  const app = createApp(game);

  it('health, packs, places and worlds', async () => {
    const h = await request(app).get('/api/health').expect(200);
    expect(h.body.ok).toBe(true);
    expect(h.body.worlds.map((w: { id: string }) => w.id)).toEqual(['nyc', 'demo']);
    const live = h.body.worlds.find((w: { id: string }) => w.id === 'nyc');
    const demo = h.body.worlds.find((w: { id: string }) => w.id === 'demo');
    expect(live.dayMs).toBe(2_880_000);
    expect(demo.dayMs).toBe(2_000);
    expect((await request(app).get('/api/packs').expect(200)).body.niches.cafe.id).toBe('cafe');
    expect((await request(app).get('/api/places').expect(200)).body.length).toBeGreaterThan(10);
    const worlds = (await request(app).get('/api/worlds').expect(200)).body;
    expect(worlds[0]).toMatchObject({ id: 'nyc', demo: false, owners: 0, day: 1 });
    await request(app).get('/api/worlds/nope/view').expect(404);
    await request(app).get('/api/nothing').expect(404);
  });

  it('join gives a token; actions need it; bad input is rejected', async () => {
    await request(app).post('/api/worlds/demo/join').send({ name: '' , kind: 'owner' }).expect(400);
    await request(app).post('/api/worlds/demo/join').send({ name: 'Olga', kind: 'official' }).expect(400);
    await request(app).post('/api/worlds/demo/join').set('Content-Type', 'application/json').send('{bad json').expect(400);
    const { playerId, token } = await joinOwner(app);
    expect(playerId).toMatch(/^p\d+$/);
    expect(token.length).toBeGreaterThan(20);
    await request(app).post('/api/worlds/demo/action').send({ type: 'launch' }).expect(401);
    await request(app).post('/api/worlds/demo/action').set('Authorization', 'Bearer wrong').send({ type: 'launch' }).expect(401);
    const bogus = await request(app).post('/api/worlds/demo/action').set('Authorization', `Bearer ${token}`).send({ type: 'take_over_the_city' }).expect(400);
    expect(bogus.body.error).toMatch(/Unknown action/);
    const foreign = await request(app).post('/api/worlds/demo/action').set('Authorization', `Bearer ${token}`).send({ type: 'take_case', caseId: 'c1' }).expect(400);
    expect(foreign.body.error).toMatch(/officials/i);
  });

  it('action, view and unchanged', async () => {
    const { playerId, token } = await joinOwner(app, 'demo', 'Bob');
    const opening = await openCafe(app, game, token);
    const auth = { Authorization: `Bearer ${token}` };
    const v1 = (await request(app).get('/api/worlds/demo/view').set(auth).expect(200)).body as OwnerView;
    expect(v1.kind).toBe('owner');
    expect(v1.me.id).toBe(playerId);
    expect(v1.business?.name).toBe('Test Cafe');
    expect(v1.world.msToNextDay).toBeGreaterThanOrEqual(0);
    const same = await request(app).get(`/api/worlds/demo/view?v=${v1.world.version}`).set(auth).expect(200);
    expect(same.body).toEqual({ unchanged: true });
    // the doors cannot open while the room is being built: the city runs on, rent is due, then the launch goes through
    const early = await request(app).post('/api/worlds/demo/action').set(auth).send({ type: 'launch' });
    if (opening.daysToOpen > 0) expect(early.body.ok).toBe(false);
    game.runtimes.get('demo')!.advance(opening.daysToOpen);
    await request(app).post('/api/worlds/demo/action').set(auth).send({ type: 'launch' }).expect(200);
    const v2 = (await request(app).get(`/api/worlds/demo/view?v=${v1.world.version}`).set(auth).expect(200)).body as OwnerView;
    expect(v2.world.version).toBeGreaterThan(v1.world.version);
    expect(v2.business?.status).toBe('open');
    const city = (await request(app).get('/api/worlds/demo/view').expect(200)).body;
    expect(city.kind).toBe('city');
    expect(JSON.stringify(city)).not.toContain('"cash"');
  });

  it('a token brings the player back after 40 game days; the world did not wait', async () => {
    const { playerId, token } = await joinOwner(app, 'demo', 'Carol');
    await openCafe(app, game, token);
    const rt = game.runtimes.get('demo')!;
    const day0 = rt.world.day;
    rt.advance(40);
    expect(rt.world.day).toBe(day0 + 40);
    const v = (await request(app).get('/api/worlds/demo/view').set('Authorization', `Bearer ${token}`).expect(200)).body as OwnerView;
    expect(v.me.id).toBe(playerId);
    expect(v.away?.days).toBe(40);
    expect(v.business?.history.length).toBeGreaterThanOrEqual(1);
    const again = (await request(app).get('/api/worlds/demo/view').set('Authorization', `Bearer ${token}`).expect(200)).body as OwnerView;
    expect(again.world.version).toBe(v.world.version);
  });

  it('queries: synchronous ones go to the host, advisor and idea to the AI service', async () => {
    const { token } = await joinOwner(app, 'demo', 'Dan');
    const anon = await request(app).post('/api/worlds/demo/query').send({ type: 'idea', text: 'a tiny espresso bar by the subway' }).expect(200);
    expect(anon.body.data.niche).toBe('cafe');
    await request(app).post('/api/worlds/demo/query').set('Authorization', `Bearer ${token}`).send({ type: 'advisor', question: 'Should I hire?' }).expect(400);
    await openCafe(app, game, token);
    const adv = await request(app).post('/api/worlds/demo/query').set('Authorization', `Bearer ${token}`).send({ type: 'advisor', question: 'Should I hire a third barista?' }).expect(200);
    expect(adv.body.data.origin).toBe('rules');
    const plan = await request(app).post('/api/worlds/demo/query').set('Authorization', `Bearer ${token}`).send({ type: 'real_world_plan' }).expect(200);
    expect(plan.body.data.startupTotal).toBeGreaterThan(0);
    await request(app).post('/api/worlds/demo/query').send({ type: 'nonsense' }).expect(400);
  });

  it('creates extra demo cities', async () => {
    const r = await request(app).post('/api/worlds').send({ name: 'Jury city' }).expect(201);
    expect(r.body.data.id).toMatch(/^demo-\d+$/);
    expect(game.runtimes.get(r.body.data.id)!.world.businesses.length).toBeGreaterThan(0);
  });
});

describe('clock', () => {
  it('runs by itself, pauses and changes speed only in demo worlds', async () => {
    const game = newGame({ autoStart: true });
    const app = createApp(game);
    const demo = game.runtimes.get('demo')!;
    await request(app).post('/api/worlds/nyc/clock').send({ paused: true }).expect(403);
    const fast = await request(app).post('/api/worlds/demo/clock').send({ dayMs: 20 }).expect(200);
    expect(fast.body.data.dayMs).toBe(100);
    const d0 = demo.world.day;
    await new Promise((r) => setTimeout(r, 650));
    expect(demo.world.day).toBeGreaterThanOrEqual(d0 + 4);
    const paused = await request(app).post('/api/worlds/demo/clock').send({ paused: true }).expect(200);
    expect(paused.body.data.paused).toBe(true);
    const d1 = demo.world.day;
    await new Promise((r) => setTimeout(r, 300));
    expect(demo.world.day).toBe(d1);
    const view = (await request(app).get('/api/worlds/demo/view').expect(200)).body;
    expect(view.world.config.paused).toBe(true);
    await request(app).post('/api/worlds/demo/clock').send({ paused: false, advanceDays: 5 }).expect(200);
    expect(demo.world.day).toBe(d1 + 5);
    await new Promise((r) => setTimeout(r, 350));
    expect(demo.world.day).toBeGreaterThan(d1 + 5);
    game.stopAll();
  });

  it('catches up missed days after a restart, at most 30 for a demo world', () => {
    let now = 1_000_000;
    const dir = mkdtempSync(join(tmpdir(), 'ohh-snap-')); tmp.push(dir);
    const g1 = newGame({ snapshotDir: dir, now: () => now });
    const rt = g1.runtimes.get('demo')!;
    const day = rt.world.day;
    g1.saveAllSync();
    now += 100 * 2_000;
    const g2 = new GameServer({ snapshotDir: dir, autoStart: true, log: quiet, now: () => now }).boot();
    expect(g2.runtimes.get('demo')!.world.day).toBe(day + 30);
    now += 3 * 2_880_000;
    g2.stopAll(); g2.saveAllSync();
    const g3 = new GameServer({ snapshotDir: dir, autoStart: true, log: quiet, now: () => now }).boot();
    expect(g3.runtimes.get('nyc')!.world.day).toBe(1 + 3);
    g3.stopAll();
  });
});

describe('reliability', () => {
  it('snapshots keep players and tokens across a restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ohh-snap-')); tmp.push(dir);
    const g1 = newGame({ snapshotDir: dir });
    const app1 = createApp(g1);
    const { token } = await joinOwner(app1, 'nyc', 'Eve');
    await openCafe(app1, g1, token, 'nyc');
    g1.saveAllSync();
    const g2 = newGame({ snapshotDir: dir });
    const app2 = createApp(g2);
    const v = (await request(app2).get('/api/worlds/nyc/view').set('Authorization', `Bearer ${token}`).expect(200)).body as OwnerView;
    expect(v.me.name).toBe('Eve');
    expect(v.business?.name).toBe('Test Cafe');
  });

  it('limits the request rate per player', async () => {
    const app = createApp(newGame({ rate: { perSec: 1, burst: 3 } }));
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await request(app).get('/api/worlds')).status);
    expect(codes.slice(0, 3)).toEqual([200, 200, 200]);
    expect(codes).toContain(429);
  });

  it('an error in one world does not stop the other or the process', () => {
    const base = defaultDeps();
    const broken = defaultDeps({ forecast: (seed, from, days) => { if (from > 1) throw new Error('boom'); return base.forecast(seed, from, days); } });
    const game = new GameServer({ snapshotDir: null, autoStart: false, log: quiet, deps: broken });
    const bad = game.open({ id: 'demo', name: 'Bad', demo: true, seed: 1 });
    expect(bad).toBeTruthy();
    expect(bad.stepOnce()).toBe(false);
    expect(bad.errors).toBe(1);
    const good = newGame().runtimes.get('demo')!;
    expect(good.stepOnce()).toBe(true);
  });
});

describe('a finished demo city', () => {
  it('starts a new season once its end screen has been up long enough; the live city is never restarted', () => {
    let t = 1_000_000;
    const game = newGame({ now: () => t });
    game.runtimes.get('demo')!.advance(400);
    expect(game.runtimes.get('demo')!.world.phase).not.toBe('running');
    expect(game.recycleDemos()).toEqual([]);          // first sight of the ended season: the timer starts
    t += 9 * 60_000;
    expect(game.recycleDemos()).toEqual([]);          // the end screen is still up
    t += 2 * 60_000;
    expect(game.recycleDemos()).toEqual(['demo']);
    const fresh = game.runtimes.get('demo')!.world;
    expect(fresh.phase).toBe('running');
    expect(fresh.day).toBeLessThan(5);
    expect(game.runtimes.get('nyc')!.world.phase).toBe('running');
  });
});
