// @ohh-stub — walking-skeleton server by agent 01 (HTTP from build/CONTRACT.md §6). Owner: agent 06 replaces this file.
import express from 'express';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { dirname, join as pjoin, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Action, CommonPack, NicheId, OwnerView, Pack, PackSet, Place, Query, RealWorldPlan, WorldConfig, WorldState } from '@ohh/shared';
import { STUB_PACKS, STUB_PLACES, defaultConfig } from '@ohh/shared/stubs';
import { act, answer, defaultDeps, join, markSeen, newWorld, step, viewFor, type HostDeps } from '@ohh/host';
import type { EngineCtx } from '@ohh/engine';
import { askAdvisor, interpretIdea, writeDebrief } from '@ohh/ai';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, '../..');
export const CLIENT_DIST = resolve(ROOT, 'client/dist');
const NICHES: NicheId[] = ['cafe', 'barbershop', 'bodega', 'guesthouse', 'rentals'];

function readJson<T>(path: string): T | null {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; } catch { return null; }
}

/** packs/*.json → server/fixtures/*.json (agent 06 examples) → shared stubs. `stub` lists what is not real data. */
export function loadPacks(root = ROOT): { packs: PackSet; stub: string[] } {
  const stub: string[] = [];
  const pick = <T>(name: string): T | null => readJson<T>(pjoin(root, `packs/${name}.json`)) ?? ((): T | null => { const f = readJson<T>(pjoin(root, `server/fixtures/${name}.json`)); if (f) stub.push(name); return f; })();
  const common = pick<CommonPack>('_common') ?? (stub.push('_common'), STUB_PACKS.common);
  const niches: Partial<Record<NicheId, Pack>> = {};
  for (const n of NICHES) { const p = pick<Pack>(n); if (p) niches[n] = p; }
  if (!niches.cafe) { stub.push('cafe'); niches.cafe = STUB_PACKS.niches.cafe; }
  return { packs: { common, niches }, stub: [...new Set(stub)] };
}

/** data/places.json → server/fixtures/places.json → shared stubs (an array or { places: [...] }). */
export function loadPlaces(root = ROOT): { places: Place[]; stub: boolean } {
  const list = (rel: string) => { const raw = readJson<Place[] | { places: Place[] }>(pjoin(root, rel)); return Array.isArray(raw) ? raw : raw?.places; };
  const real = list('data/places.json');
  if (real?.length) return { places: real, stub: false };
  const fixture = list('server/fixtures/places.json');
  return { places: fixture?.length ? fixture : STUB_PLACES, stub: true };
}

interface Room { world: WorldState; tokens: Map<string, string>; timer?: ReturnType<typeof setTimeout>; nextTickAt: number; dirty: boolean }

export interface GameOptions { dataDir?: string; tick?: boolean; root?: string }

const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p.catch(() => fallback), new Promise<T>((ok) => setTimeout(() => ok(fallback), ms))]);

export function createGame(opts: GameOptions = {}) {
  const { packs, stub: stubPacks } = loadPacks(opts.root);
  const { places, stub: stubPlaces } = loadPlaces(opts.root);
  const ctx: EngineCtx = { packs, places };
  const deps: HostDeps = defaultDeps();
  const dataDir = opts.dataDir ?? process.env.DATA_DIR ?? resolve(ROOT, '.data');
  const rooms = new Map<string, Room>();
  const tick = opts.tick ?? true;

  const save = (id: string, room: Room) => {
    try {
      mkdirSync(dataDir, { recursive: true });
      const file = pjoin(dataDir, `${id}.json`);
      writeFileSync(`${file}.tmp`, JSON.stringify({ world: room.world, tokens: [...room.tokens] }));
      renameSync(`${file}.tmp`, file);
      room.dirty = false;
    } catch (e) { console.error('snapshot failed', e); }
  };
  const saver = setInterval(() => { for (const [id, r] of rooms) if (r.dirty) save(id, r); }, 1_000);
  saver.unref?.();

  const schedule = (id: string, room: Room) => {
    if (room.timer) clearTimeout(room.timer);
    if (!tick) return;
    const cfg = room.world.config;
    const wait = cfg.paused ? 500 : Math.max(5, room.nextTickAt - Date.now());
    room.timer = setTimeout(() => {
      if (!room.world.config.paused && room.world.phase === 'running') {
        room.world = step(room.world, ctx, deps);
        room.dirty = true;
        room.nextTickAt = Date.now() + room.world.config.dayMs;
      } else room.nextTickAt = Date.now() + room.world.config.dayMs;
      schedule(id, room);
    }, wait);
    room.timer.unref?.();
  };

  const addRoom = (world: WorldState, tokens: [string, string][] = []) => {
    const room: Room = { world, tokens: new Map(tokens), nextTickAt: Date.now() + world.config.dayMs, dirty: true };
    rooms.set(world.config.id, room);
    schedule(world.config.id, room);
    return room;
  };

  if (existsSync(dataDir)) {
    for (const f of readdirSync(dataDir).filter((x) => x.endsWith('.json'))) {
      const snap = readJson<{ world: WorldState; tokens: [string, string][] }>(pjoin(dataDir, f));
      if (snap?.world?.config?.id) addRoom(snap.world, snap.tokens);
    }
  }
  for (const cfg of [defaultConfig('nyc', false), defaultConfig('demo', true)]) if (!rooms.has(cfg.id)) addRoom(newWorld(cfg, ctx, deps));

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  const room = (req: express.Request, res: express.Response): Room | null => {
    const r = rooms.get(String(req.params.id));
    if (!r) { res.status(404).json({ ok: false, error: 'unknown world' }); return null; }
    return r;
  };
  const playerOf = (req: express.Request, r: Room): string | null => {
    const m = /^Bearer\s+(.+)$/i.exec(req.get('authorization') ?? '');
    return m ? r.tokens.get(m[1]) ?? null : null;
  };

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, name: 'First Year', stub: true, stubData: { packs: stubPacks, places: stubPlaces }, worlds: [...rooms.keys()] });
  });
  app.get('/api/packs', (_req, res) => res.json(packs));
  app.get('/api/places', (_req, res) => res.json(places));
  app.get('/api/worlds', (_req, res) => {
    res.json([...rooms.values()].map(({ world: w }) => ({ id: w.config.id, name: w.config.name, demo: w.config.demo, owners: w.players.filter((p) => p.kind === 'owner' && !p.isAi).length, day: w.day })));
  });
  app.post('/api/worlds', (req, res) => {
    const n = [...rooms.keys()].filter((k) => k.startsWith('demo')).length + 1;
    const cfg: WorldConfig = { ...defaultConfig(`demo-${n}`, true, Number(req.body?.seed ?? 2026 + n)), name: String(req.body?.name ?? `Demo city ${n}`) };
    addRoom(newWorld(cfg, ctx, deps));
    res.json({ ok: true, data: { id: cfg.id, name: cfg.name } });
  });
  app.post('/api/worlds/:id/join', (req, res) => {
    const r = room(req, res); if (!r) return;
    const { name, kind, role } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim() || (kind !== 'owner' && kind !== 'official')) { res.status(400).json({ ok: false, error: 'name and kind are required' }); return; }
    const out = join(r.world, { name: name.trim().slice(0, 40), kind, role }) as { world: WorldState; playerId: string; error?: string };
    if (out.error) { res.json({ ok: false, error: out.error }); return; }
    r.world = out.world; r.dirty = true;
    const token = randomBytes(16).toString('hex');
    r.tokens.set(token, out.playerId);
    res.json({ ok: true, data: { playerId: out.playerId, token } });
  });
  app.get('/api/worlds/:id/view', (req, res) => {
    const r = room(req, res); if (!r) return;
    const me = playerOf(req, r);
    if (me) r.world = markSeen(r.world, me);
    if (req.query.v !== undefined && Number(req.query.v) === r.world.version) { res.json({ unchanged: true }); return; }
    const view = viewFor(r.world, ctx, me);
    view.world.msToNextDay = r.world.config.paused ? r.world.config.dayMs : Math.max(0, r.nextTickAt - Date.now());
    res.json(view);
  });
  app.post('/api/worlds/:id/action', (req, res) => {
    const r = room(req, res); if (!r) return;
    const playerId = playerOf(req, r);
    if (!playerId) { res.status(401).json({ ok: false, error: 'join first' }); return; }
    const action = (req.body?.action ?? req.body) as Action;
    if (!action || typeof action.type !== 'string') { res.status(400).json({ ok: false, error: 'action.type is required' }); return; }
    const out = act(r.world, ctx, playerId, action);
    if (out.error) { res.json({ ok: false, error: out.error }); return; }
    r.world = out.world; r.dirty = true;
    res.json({ ok: true });
  });
  app.post('/api/worlds/:id/query', async (req, res) => {
    const r = room(req, res); if (!r) return;
    const playerId = playerOf(req, r);
    const q = (req.body?.query ?? req.body) as Query;
    if (!q || typeof q.type !== 'string') { res.status(400).json({ ok: false, error: 'query.type is required' }); return; }
    if (q.type === 'idea') { res.json({ ok: true, data: await withTimeout(interpretIdea({ text: q.text, packs }), 8_000, { niche: 'cafe', businessName: 'Corner Cafe', tier: 'mid', kitId: 'standard', notes: [], origin: 'rules' as const }) }); return; }
    if (!playerId) { res.status(401).json({ ok: false, error: 'join first' }); return; }
    if (q.type === 'advisor' || q.type === 'debrief') {
      const view = viewFor(r.world, ctx, playerId) as OwnerView;
      const b = view.kind === 'owner' ? view.business : null;
      const pack = b ? packs.niches[b.niche] : undefined;
      if (!b || !pack || !view.analytics) { res.json({ ok: false, error: 'open a business first' }); return; }
      if (q.type === 'advisor') {
        res.json({ ok: true, data: await withTimeout(askAdvisor({ question: q.question, business: b, analytics: view.analytics, pack, common: packs.common }), 8_000, { answer: 'The advisor is busy. Try again in a moment.', sources: [], origin: 'rules' as const }) });
        return;
      }
      const plan = answer(r.world, ctx, playerId, { type: 'real_world_plan' }) as RealWorldPlan;
      const rank = r.world.standings.find((s) => s.businessId === b.id)?.rank ?? 0;
      res.json({ ok: true, data: await withTimeout(writeDebrief({ business: b, analytics: view.analytics, plan, rank }), 8_000, { headline: `${b.name}: season summary`, lostMoneyOn: [], didWell: [], nextTime: [], origin: 'rules' as const }) });
      return;
    }
    const data = answer(r.world, ctx, playerId, q) as { error?: string } | unknown;
    if (data && typeof data === 'object' && 'error' in (data as object) && !Array.isArray(data)) { res.json({ ok: false, error: (data as { error: string }).error }); return; }
    res.json({ ok: true, data });
  });
  app.post('/api/worlds/:id/clock', (req, res) => {
    const r = room(req, res); if (!r) return;
    if (!r.world.config.demo) { res.status(403).json({ ok: false, error: 'only the demo city has a clock' }); return; }
    const { paused, dayMs } = req.body ?? {};
    const config = { ...r.world.config };
    if (typeof paused === 'boolean') config.paused = paused;
    if (typeof dayMs === 'number' && dayMs >= 10) config.dayMs = Math.round(dayMs);
    r.world = { ...r.world, config, version: r.world.version + 1 };
    r.nextTickAt = Date.now() + config.dayMs; r.dirty = true;
    schedule(config.id, r);
    res.json({ ok: true, data: { paused: config.paused, dayMs: config.dayMs } });
  });

  if (existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(resolve(CLIENT_DIST, 'index.html')));
  }

  const stop = () => {
    clearInterval(saver);
    for (const [id, r] of rooms) { if (r.timer) clearTimeout(r.timer); if (r.dirty) save(id, r); }
  };
  return { app, rooms, ctx, stop };
}

export function createApp(opts: GameOptions = {}): express.Express {
  return createGame(opts).app;
}

export function startServer(port = Number(process.env.PORT ?? 8787), host = process.env.HOST ?? '0.0.0.0', opts: GameOptions = {}): Promise<Server> {
  const game = createGame(opts);
  return new Promise((ok) => {
    const server = game.app.listen(port, host, () => ok(server));
    server.on('close', game.stop);
  });
}
