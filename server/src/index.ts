// @ohh/server — HTTP по build/CONTRACT.md §6. Два мира при старте: живой `nyc` и быстрый `demo`.
import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync, readdirSync } from 'node:fs';
import type { Server } from 'node:http';
import { join, resolve } from 'node:path';
import type { Action, OfficialRole, Query } from '@ohh/shared';
import { checkActionShape, defaultConfig, newWorld, type AiApi, type HostDeps } from '@ohh/host';
import { loadData, REPO_ROOT, SERVER_DIR, type GameData } from './data';
import { ai as defaultAi, serverDeps, usingStubs } from './deps';
import { RateLimiter } from './rate';
import { mountBilling } from './billing';
import { WorldRuntime } from './runtime';

export const CLIENT_DIST = resolve(REPO_ROOT, 'client/dist');
export const DEFAULT_SNAPSHOT_DIR = join(SERVER_DIR, '.snapshots');
const MAX_DEMO_WORLDS = 20;

export interface GameServerOptions {
  data?: GameData;
  snapshotDir?: string | null;
  autoStart?: boolean;
  now?: () => number;
  log?: (m: string) => void;
  ai?: AiApi;
  deps?: HostDeps;
  /** Ключ для POST /clock; без ключа часами демо управляет любой. */
  clockKey?: string;
  rate?: { perSec: number; burst: number };
}

export class GameServer {
  readonly runtimes = new Map<string, WorldRuntime>();
  readonly data: GameData;
  readonly startedAt: number;
  private readonly opts: Required<Pick<GameServerOptions, 'autoStart'>> & GameServerOptions;

  constructor(opts: GameServerOptions = {}) {
    this.opts = { autoStart: true, ...opts };
    this.data = opts.data ?? loadData({ log: this.log });
    this.startedAt = (opts.now ?? Date.now)();
  }

  readonly log = (m: string): void => { (this.opts.log ?? ((x: string) => console.log(`[server] ${x}`)))(m); };

  /** Поднимает мир: из снимка, если он есть, иначе новый. */
  open(p: { id: string; name: string; demo: boolean; seed: number }): WorldRuntime {
    const existing = this.runtimes.get(p.id);
    if (existing) return existing;
    const dir = this.opts.snapshotDir === undefined ? null : this.opts.snapshotDir;
    const runtimeOpts = { ctx: this.data.ctx, deps: this.opts.deps ?? serverDeps(), ai: this.opts.ai ?? defaultAi, snapshotDir: dir, now: this.opts.now, log: this.log };
    let snap = WorldRuntime.readSnapshot(dir, p.id, this.log);
    // A demo city whose season is over starts again: nobody can join a finished season, and a visitor must not meet a dead city.
    if (snap && p.demo && snap.world.phase !== 'running') { this.log(`${p.id}: the saved season is over, starting a new one`); snap = null; }
    const rt = snap
      ? new WorldRuntime(snap.world, runtimeOpts, snap)
      : new WorldRuntime(newWorld(defaultConfig(p), this.data.ctx, runtimeOpts.deps), runtimeOpts);
    if (snap) this.log(`${p.id}: restored from snapshot at day ${snap.world.day}`);
    this.runtimes.set(p.id, rt);
    if (this.opts.autoStart) rt.start();
    if (!snap) rt.saveSoon(true);
    return rt;
  }

  private snapshotIds(): string[] {
    const dir = this.opts.snapshotDir;
    if (!dir || !existsSync(dir)) return [];
    return readdirSync(dir).filter((f) => /^[a-z0-9-]+\.json$/.test(f)).map((f) => f.slice(0, -5));
  }

  /** Demo cities whose season ended are started again after this many ms (the end screen stays readable meanwhile). 0 = never. */
  private readonly demoRestartMs = Math.max(0, Number(process.env.DEMO_RESTART_MIN ?? 10)) * 60_000;
  private readonly endedAt = new Map<string, number>();
  private recycleTimer: ReturnType<typeof setInterval> | null = null;

  /** Restarts finished demo cities once their end screen has been up long enough. */
  recycleDemos(now: number = (this.opts.now ?? Date.now)()): string[] {
    const restarted: string[] = [];
    for (const [id, rt] of [...this.runtimes]) {
      const w = rt.world;
      if (!w.config.demo || w.phase === 'running') { this.endedAt.delete(id); continue; }
      const since = this.endedAt.get(id);
      if (since === undefined) { this.endedAt.set(id, now); continue; }
      if (!this.demoRestartMs || now - since < this.demoRestartMs) continue;
      rt.stop();
      this.runtimes.delete(id);
      this.endedAt.delete(id);
      this.open({ id, name: w.config.name, demo: true, seed: w.config.seed + 1 });
      restarted.push(id);
    }
    return restarted;
  }

  /** Живой `nyc`, быстрый `demo` и все демо-города из снимков. */
  boot(): this {
    if (this.opts.autoStart && this.demoRestartMs && !this.recycleTimer) {
      this.recycleTimer = setInterval(() => { for (const id of this.recycleDemos()) this.log(`${id}: season over, a new one started`); }, 20_000);
      this.recycleTimer.unref?.();
    }
    this.open({ id: 'nyc', name: 'New York (live)', demo: false, seed: 2026 });
    this.open({ id: 'demo', name: 'Demo City', demo: true, seed: 7 });
    for (const id of this.snapshotIds()) {
      if (this.runtimes.has(id) || !/^demo-\d+$/.test(id)) continue;
      const n = Number(id.slice(5));
      this.open({ id, name: `Demo City ${n}`, demo: true, seed: 7 + n });
    }
    return this;
  }

  createDemo(name: string): WorldRuntime | null {
    const demos = [...this.runtimes.values()].filter((r) => r.world.config.demo && r.world.phase === 'running').length;
    if (demos >= MAX_DEMO_WORLDS) return null;
    const taken = new Set([...this.runtimes.keys(), ...this.snapshotIds()]);
    let n = 2;
    while (taken.has(`demo-${n}`)) n++;
    return this.open({ id: `demo-${n}`, name: name || `Demo City ${n}`, demo: true, seed: 7 + n });
  }

  stopAll(): void {
    if (this.recycleTimer) { clearInterval(this.recycleTimer); this.recycleTimer = null; }
    for (const r of this.runtimes.values()) r.stop();
  }

  saveAllSync(): void {
    for (const r of this.runtimes.values()) r.saveSync();
  }

  rateOptions() { return this.opts.rate ?? { perSec: 8, burst: 40 }; }
  get clockKey() { return this.opts.clockKey ?? process.env.CLOCK_KEY; }
}

type Req = Request & { rt?: WorldRuntime; playerId?: string };

const bearer = (req: Request): string | undefined => {
  const h = req.headers.authorization;
  return h && h.startsWith('Bearer ') ? h.slice(7).trim() : undefined;
};

export function createApp(game: GameServer = new GameServer({ snapshotDir: null, autoStart: false }).boot()): express.Express {
  const app = express();
  const r = game.rateOptions();
  const limiter = new RateLimiter(r.perSec, r.burst);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.use('/api', (req: Req, res: Response, next: NextFunction) => {
    const token = bearer(req);
    const key = token ? `t:${token}` : `ip:${req.ip}`;
    if (!limiter.take(key)) { res.status(429).set('Retry-After', '1').json({ ok: false, error: 'Too many requests' }); return; }
    next();
  });
  mountBilling(app, game); // тариф Pro: проверки перед /action и /query, маршруты /billing (server/src/billing.ts)

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, name: 'First Year', stubs: usingStubs, uptimeS: Math.round((Date.now() - game.startedAt) / 1000), worlds: [...game.runtimes.values()].map((x) => x.stats()), data: game.data.sources });
  });
  app.get('/api/packs', (_req, res) => { res.json(game.data.packs); });
  app.get('/api/places', (_req, res) => { res.json(game.data.places); });
  app.get('/api/worlds', (_req, res) => {
    res.json([...game.runtimes.values()].map((x) => ({
      id: x.world.config.id, name: x.world.config.name, demo: x.world.config.demo,
      owners: x.world.players.filter((p) => p.kind === 'owner' && !p.isAi).length, day: x.world.day,
    })));
  });
  app.post('/api/worlds', (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 40) : '';
    const rt = game.createDemo(name);
    if (!rt) { res.status(429).json({ ok: false, error: 'Too many demo cities' }); return; }
    res.status(201).json({ ok: true, data: { id: rt.id } });
  });

  const world = (req: Req, res: Response, next: NextFunction) => {
    const rt = game.runtimes.get(String(req.params.id));
    if (!rt) { res.status(404).json({ ok: false, error: 'Unknown world' }); return; }
    req.rt = rt;
    const token = bearer(req);
    if (token !== undefined) {
      const pid = rt.playerFor(token);
      if (!pid) { res.status(401).json({ ok: false, error: 'Unknown token: join again' }); return; }
      req.playerId = pid;
    }
    next();
  };
  const needPlayer = (req: Req, res: Response, next: NextFunction) => {
    if (!req.playerId) { res.status(401).json({ ok: false, error: 'Send Authorization: Bearer <token>' }); return; }
    next();
  };

  app.post('/api/worlds/:id/join', world, (req: Req, res) => {
    const b = (req.body ?? {}) as { name?: unknown; kind?: unknown; role?: unknown };
    if (typeof b.name !== 'string' || (b.kind !== 'owner' && b.kind !== 'official')) { res.status(400).json({ ok: false, error: 'Send { name, kind: "owner" | "official", role? }' }); return; }
    const ack = req.rt!.join({ name: b.name, kind: b.kind, role: b.role as OfficialRole | undefined });
    res.status(ack.ok ? 200 : 400).json(ack);
  });

  app.get('/api/worlds/:id/view', world, (req: Req, res) => {
    const v = req.query.v;
    const known = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : undefined;
    res.json(req.rt!.view(req.playerId ?? null, known));
  });

  app.post('/api/worlds/:id/action', world, needPlayer, (req: Req, res) => {
    const body = req.body as { action?: unknown } | undefined;
    const a = (body && typeof body === 'object' && 'action' in body ? body.action : body) as Action;
    const err = checkActionShape(a);
    if (err) { res.status(400).json({ ok: false, error: err }); return; }
    const ack = req.rt!.act(req.playerId!, a);
    res.status(ack.ok ? 200 : 400).json(ack);
  });

  app.post('/api/worlds/:id/query', world, async (req: Req, res) => {
    const body = req.body as { query?: unknown } | undefined;
    const q = (body && typeof body === 'object' && 'query' in body ? body.query : body) as Query;
    const ack = await req.rt!.query(req.playerId ?? null, q);
    res.status(ack.ok ? 200 : 400).json(ack);
  });

  app.post('/api/worlds/:id/clock', world, (req: Req, res) => {
    const key = game.clockKey;
    if (key && req.headers['x-clock-key'] !== key) { res.status(403).json({ ok: false, error: 'Wrong clock key' }); return; }
    const b = (req.body ?? {}) as { paused?: boolean; dayMs?: number; advanceDays?: number };
    const r2 = req.rt!.setClock(b);
    if (!r2.ok) { res.status(req.rt!.world.config.demo ? 400 : 403).json(r2); return; }
    res.json({ ok: true, data: req.rt!.stats() });
  });

  app.use('/api', (_req, res) => { res.status(404).json({ ok: false, error: 'Not found' }); });

  if (existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(resolve(CLIENT_DIST, 'index.html')));
  }

  app.use((err: Error & { type?: string; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.parse.failed') { res.status(400).json({ ok: false, error: 'Body is not valid JSON' }); return; }
    if (err.type === 'entity.too.large') { res.status(413).json({ ok: false, error: 'Body is too large' }); return; }
    game.log(`request failed: ${err.stack ?? err.message}`);
    res.status(500).json({ ok: false, error: 'Something went wrong' });
  });
  return app;
}

export interface StartOptions extends GameServerOptions { game?: GameServer }

export function startServer(port = Number(process.env.PORT ?? 8787), host = process.env.HOST ?? '0.0.0.0', opts: StartOptions = {}): Promise<Server & { game: GameServer }> {
  const snapshotDir = opts.snapshotDir !== undefined ? opts.snapshotDir : process.env.VITEST ? null : process.env.SNAPSHOT_DIR ?? DEFAULT_SNAPSHOT_DIR;
  const game = opts.game ?? new GameServer({ ...opts, snapshotDir }).boot();
  const app = createApp(game);
  return new Promise((ok) => {
    const server = app.listen(port, host, () => ok(Object.assign(server, { game })));
    server.on('close', () => game.stopAll());
  });
}

export { WorldRuntime } from './runtime';
export { loadData } from './data';
export { RateLimiter } from './rate';
