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
import { PitchDirector, enterPage, joinBase, joinPage, type PitchCommand, type PitchHost } from './pitch';
import { qrSvg } from './qr';
import { deskPage } from './desk';

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

  /** Город показа жюри (scenario: "pitch"), если он поднят. */
  pitch: PitchDirector | null = null;

  private runtimeOpts(deps?: HostDeps) {
    const dir = this.opts.snapshotDir === undefined ? null : this.opts.snapshotDir;
    return { ctx: this.data.ctx, deps: deps ?? this.opts.deps ?? serverDeps(), ai: this.opts.ai ?? defaultAi, snapshotDir: dir, now: this.opts.now, log: this.log };
  }

  private pitchHost(): PitchHost {
    return {
      snapshotDir: this.opts.snapshotDir ?? null, log: this.log, ctx: this.data.ctx,
      baseDeps: () => this.opts.deps ?? serverDeps(),
      openPitch: (id, world, deps, onDay) => {
        const old = this.runtimes.get(id);
        if (old) { old.stop(); this.runtimes.delete(id); }
        const ro = { ...this.runtimeOpts(deps), aiEvents: false, onDay };
        const snap = world ? null : WorldRuntime.readSnapshot(ro.snapshotDir, id, this.log);
        if (!world && !snap) throw new Error(`${id}: no snapshot to restore the pitch city from`);
        const rt = snap ? new WorldRuntime(snap.world, ro, snap) : new WorldRuntime(world!, ro);
        this.runtimes.set(id, rt);
        if (this.opts.autoStart) rt.start();
        rt.saveSoon(true);
        return rt;
      },
    };
  }

  /** Собрать город показа (или вернуть уже собранный). Расчёт синхронный, около 20 секунд. */
  createPitch(fresh = false): PitchDirector {
    if (this.pitch && !fresh) return this.pitch;
    this.pitch = PitchDirector.create(this.pitchHost());
    return this.pitch;
  }

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
      // город показа возвращает в начало только ведущий (команда reset): у него стартовая копия и коды
      if (!w.config.demo || w.phase === 'running' || id === this.pitch?.id) { this.endedAt.delete(id); continue; }
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
    // город показа: из снимка, если он есть (быстро); PITCH=1 собирает новый уже после старта — см. startServer
    try {
      this.pitch = PitchDirector.restore(this.pitchHost());
    } catch (e) {
      this.log(`pitch: ${(e as Error).message}`);
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
  const clockOk = (req: Request): boolean => {
    const key = game.clockKey;
    return !key || req.headers['x-clock-key'] === key || req.query.key === key;
  };
  // город показа на публичном адресе без ключа часов: любой из зала мог бы сбросить город или войти за Maya
  const pitchKeyOk = (req: Request): boolean => (game.clockKey ? clockOk(req) : process.env.NODE_ENV !== 'production');
  const pitchKeyError = () => (game.clockKey ? 'Wrong clock key' : 'Set CLOCK_KEY on the server to control the pitch city');
  const baseOf = (req: Request) => joinBase(req.socket.localPort ?? Number(process.env.PORT ?? 8787), {
    host: String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').split(',')[0]!.trim(),
    proto: String(req.headers['x-forwarded-proto'] ?? req.protocol ?? 'http').split(',')[0]!.trim(),
  });

  app.post('/api/worlds', (req, res) => {
    if (req.body?.scenario === 'pitch') {
      if (!pitchKeyOk(req)) { res.status(403).json({ ok: false, error: pitchKeyError() }); return; }
      try {
        const d = game.createPitch(req.body?.fresh === true);
        res.status(201).json({ ok: true, data: { id: d.id, pitch: d.status({ base: baseOf(req), secrets: true }) } });
      } catch (e) {
        game.log(`pitch: ${(e as Error).stack ?? e}`);
        res.status(500).json({ ok: false, error: `The pitch city could not be built: ${(e as Error).message}` });
      }
      return;
    }
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

  // город показа: состояние и команды ведущего (тот же ключ, что у часов)
  const pitchOf = (req: Request, res: Response): PitchDirector | null => {
    const d = game.pitch;
    if (!d || d.id !== String(req.params.id)) { res.status(404).json({ ok: false, error: 'This world has no pitch scenario. POST /api/worlds { "scenario": "pitch" }' }); return null; }
    return d;
  };
  app.get('/api/worlds/:id/pitch', (req, res) => {
    const d = pitchOf(req, res);
    if (d) res.json({ ok: true, data: d.status({ base: baseOf(req), secrets: pitchKeyOk(req) }) });
  });
  app.post('/api/worlds/:id/pitch', (req, res) => {
    const d = pitchOf(req, res);
    if (!d) return;
    if (!pitchKeyOk(req)) { res.status(403).json({ ok: false, error: pitchKeyError() }); return; }
    const r = d.run((req.body ?? {}) as PitchCommand);
    if (!r.ok) { res.status(400).json(r); return; }
    res.json({ ok: true, data: d.status({ base: baseOf(req), secrets: true }) });
  });

  app.use('/api', (_req, res) => { res.status(404).json({ ok: false, error: 'Not found' }); });

  // вход по короткому коду: /p — поле для кода, /p/<код> — вход, /p/<код>/qr.svg — QR с адресом в локальной сети
  app.get('/p', (_req, res) => { res.type('html').send(enterPage()); });
  // пульт ведущего: кнопки паузы, перемотки, возврата, веток жюри и жалобы; команды всё равно требуют ключ часов
  app.get('/pitch', (_req, res) => { res.set('Cache-Control', 'no-store').type('html').send(deskPage()); });
  app.get('/p/:code/qr.svg', (req, res) => {
    const r = game.pitch?.resolve(String(req.params.code));
    if (!r) { res.status(404).type('text').send('Unknown code'); return; }
    res.type('image/svg+xml').set('Cache-Control', 'no-store').send(qrSvg(`${baseOf(req)}/p/${String(req.params.code).toUpperCase()}`));
  });
  app.get('/p/:code', (req, res) => {
    const r = game.pitch?.resolve(String(req.params.code));
    if (!r) { res.status(404).type('html').send(enterPage('Code not found. Check the letters on the screen.')); return; }
    res.set('Cache-Control', 'no-store').type('html').send(joinPage(r));
  });

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
    const server = app.listen(port, host, () => {
      ok(Object.assign(server, { game }));
      // PITCH=1: собрать город показа уже после старта — сборка считает ~20–25 с и не должна задерживать проверку здоровья
      if (process.env.PITCH === '1' && !game.pitch) {
        setTimeout(() => {
          try { game.createPitch(); } catch (e) { game.log(`pitch: ${(e as Error).message}`); }
        }, 50).unref?.();
      }
    });
    server.on('close', () => game.stopAll());
  });
}

export { WorldRuntime } from './runtime';
export { PitchDirector, joinBase, lanBase } from './pitch';
export { loadData } from './data';
export { RateLimiter } from './rate';
