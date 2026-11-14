// Один мир на сервере: часы на setTimeout, вход по токену, кэш картины, очередь событий от ИИ, снимки на диск.
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { Ack, Action, ClientView, GameEvent, OfficialRole, Query, WorldState } from '@ohh/shared';
import { RULES } from '@ohh/shared';
import {
  act, aiRequest, answer, HostError, join as hostJoin, markSeen, planInput, step, viewFor,
  type AiApi, type EngineCtx, type HostDeps,
} from '@ohh/host';
import { withTimeout } from './deps';

export const MAX_CATCHUP_BATCH = 30;
export const MAX_DEMO_CATCHUP = 30;
export const AI_TIMEOUT_MS = 8_000;
const SNAPSHOT_FORMAT = 1;

export interface RuntimeOptions {
  ctx: EngineCtx;
  deps: HostDeps;
  ai: AiApi;
  snapshotDir: string | null;
  now?: () => number;
  log?: (m: string) => void;
  /** false — не просить у ИИ события раз в неделю (город показа должен повторяться день в день). */
  aiEvents?: boolean;
  /** Вызывается после каждого посчитанного дня (город показа ставит себя на паузу, когда пришло уведомление). */
  onDay?: (rt: WorldRuntime) => void;
}

export interface Snapshot {
  format: number; savedAt: number; lastDayAt: number; pausedRemaining: number | null;
  world: WorldState; tokens: [string, string][]; queue: GameEvent[];
}

export class WorldRuntime {
  world: WorldState;
  readonly tokens = new Map<string, string>();
  queue: GameEvent[] = [];
  lastDayAt: number;
  pausedRemaining: number | null = null;
  errors = 0;
  lastError: string | null = null;
  stepsTaken = 0;
  stepMsTotal = 0;
  stepMsMax = 0;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private planning = false;
  private viewCache = new Map<string, { version: number; view: ClientView }>();
  private readonly now: () => number;
  private readonly log: (m: string) => void;

  constructor(world: WorldState, private readonly opts: RuntimeOptions, restored?: Snapshot) {
    this.world = world;
    this.now = opts.now ?? Date.now;
    this.log = opts.log ?? (() => {});
    this.lastDayAt = restored?.lastDayAt ?? this.now();
    if (restored) {
      for (const [t, p] of restored.tokens) this.tokens.set(t, p);
      this.queue = restored.queue ?? [];
      this.pausedRemaining = restored.pausedRemaining ?? null;
    }
  }

  get id(): string { return this.world.config.id; }
  get ctx(): EngineCtx { return this.opts.ctx; }

  // ───────────── часы ─────────────

  start(): void {
    this.running = true;
    this.catchUp();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  msToNextDay(): number {
    if (this.world.phase !== 'running') return 0;
    if (this.world.config.paused) return Math.max(0, Math.round(this.pausedRemaining ?? this.world.config.dayMs));
    return Math.max(0, Math.round(this.lastDayAt + this.world.config.dayMs - this.now()));
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.running || this.world.config.paused || this.world.phase !== 'running') return;
    this.timer = setTimeout(() => { this.timer = null; this.catchUp(); }, this.msToNextDay());
    this.timer.unref?.();
  }

  /** Считает все наступившие дни: пачками по MAX_CATCHUP_BATCH, чтобы не держать процесс. Демо-мир догоняет не больше MAX_DEMO_CATCHUP. */
  private catchUp(): void {
    const dayMs = this.world.config.dayMs;
    if (this.world.config.paused || this.world.phase !== 'running') { this.schedule(); return; }
    let due = Math.floor((this.now() - this.lastDayAt) / dayMs);
    if (this.world.config.demo && due > MAX_DEMO_CATCHUP) {
      this.log(`${this.id}: demo world slept ${due} days, catching up ${MAX_DEMO_CATCHUP}`);
      this.lastDayAt = this.now() - MAX_DEMO_CATCHUP * dayMs;
      due = MAX_DEMO_CATCHUP;
    }
    const n = Math.min(due, MAX_CATCHUP_BATCH);
    for (let i = 0; i < n && this.world.phase === 'running' && !this.world.config.paused; i++) {
      this.stepOnce();
      this.lastDayAt += dayMs;
    }
    if (n > 0) this.saveSoon(true);
    if (due > n && this.running) {
      setImmediate(() => this.catchUp());
      return;
    }
    this.schedule();
  }

  /** Один игровой день. Ошибка дня не роняет процесс: мир остаётся прежним, ошибка в счётчике. */
  stepOnce(): boolean {
    const t0 = performance.now();
    try {
      const deps: HostDeps = { ...this.opts.deps, takeQueuedEvent: (w) => this.takeQueued(w) };
      this.world = step(this.world, this.ctx, deps);
      if (this.world.day % 7 === 0 && this.opts.aiEvents !== false) this.planInBackground();
      this.opts.onDay?.(this);
      return true;
    } catch (e) {
      this.errors += 1;
      this.lastError = (e as Error).message;
      this.log(`${this.id}: day ${this.world.day} failed: ${(e as Error).stack ?? e}`);
      return false;
    } finally {
      const ms = performance.now() - t0;
      this.stepsTaken += 1;
      this.stepMsTotal += ms;
      this.stepMsMax = Math.max(this.stepMsMax, ms);
    }
  }

  /** Сразу посчитать n дней (тесты, перемотка демо). */
  advance(days: number): number {
    let n = 0;
    const wasPaused = this.world.config.paused;
    for (let i = 0; i < days && this.world.phase === 'running'; i++) {
      if (this.stepOnce()) n++;
      if (!wasPaused && this.world.config.paused) break; // день сам поставил паузу (автопауза города показа)
    }
    this.lastDayAt = this.now();
    if (n) this.saveSoon(true);
    this.schedule();
    return n;
  }

  setClock(p: { paused?: boolean; dayMs?: number; advanceDays?: number }): { ok: true } | { ok: false; error: string } {
    if (!this.world.config.demo) return { ok: false, error: 'The clock can be changed only in demo worlds' };
    const cfg = { ...this.world.config };
    if (p.dayMs !== undefined) {
      if (typeof p.dayMs !== 'number' || !Number.isFinite(p.dayMs)) return { ok: false, error: 'dayMs must be a number' };
      const dayMs = Math.round(Math.min(RULES.DAY_MS_LIVE, Math.max(100, p.dayMs)));
      const progress = cfg.paused ? 0 : Math.min(1, Math.max(0, (this.now() - this.lastDayAt) / cfg.dayMs));
      if (cfg.paused && this.pausedRemaining !== null) this.pausedRemaining = Math.min(dayMs, this.pausedRemaining * (dayMs / cfg.dayMs));
      this.lastDayAt = this.now() - progress * dayMs;
      cfg.dayMs = dayMs;
    }
    if (p.paused === true && !cfg.paused) {
      this.pausedRemaining = Math.max(0, this.lastDayAt + cfg.dayMs - this.now());
      cfg.paused = true;
    } else if (p.paused === false && cfg.paused) {
      this.lastDayAt = this.now() - (cfg.dayMs - (this.pausedRemaining ?? cfg.dayMs));
      this.pausedRemaining = null;
      cfg.paused = false;
    }
    this.world = { ...this.world, config: cfg, version: this.world.version + 1 };
    if (p.advanceDays !== undefined) {
      if (typeof p.advanceDays !== 'number' || p.advanceDays < 0) return { ok: false, error: 'advanceDays must be a positive number' };
      this.advance(Math.min(60, Math.floor(p.advanceDays)));
    }
    this.saveSoon();
    this.schedule();
    return { ok: true };
  }

  /** Подменить мир целиком (возврат города показа в стартовую копию). Токены остаются: телефоны не входят заново. */
  replaceWorld(next: WorldState): void {
    this.world = { ...next, version: Math.max(this.world.version, next.version) + 1 };
    this.queue = [];
    this.viewCache.clear();
    this.pausedRemaining = this.world.config.paused ? this.world.config.dayMs : null;
    this.lastDayAt = this.now();
    this.saveSoon(true);
    this.schedule();
  }

  /** Поменять мир действием сервера (ветка жюри, жалоба): версия растёт, кэш картины сбрасывается сам. */
  update(next: WorldState): void {
    this.world = { ...next, version: Math.max(this.world.version + 1, next.version) };
    this.saveSoon();
  }

  /** Токен для заранее созданного игрока (вход по короткому коду). */
  issueToken(playerId: string): string {
    for (const [t, p] of this.tokens) if (p === playerId) return t;
    const token = randomBytes(24).toString('base64url');
    this.tokens.set(token, playerId);
    this.saveSoon();
    return token;
  }

  // ───────────── события от ИИ ─────────────

  private takeQueued(w: WorldState): GameEvent | null {
    this.queue = this.queue.filter((e) => e.endDay >= w.day + RULES.EVENT_NOTICE_DAYS);
    return this.queue.shift() ?? null;
  }

  /** Раз в игровую неделю — фоновой запрос событий у ИИ. День его никогда не ждёт. */
  private planInBackground(): void {
    if (this.planning) return;
    this.planning = true;
    const input = planInput(this.world, this.ctx);
    withTimeout(this.opts.ai.planEvents(input), AI_TIMEOUT_MS, () => [] as GameEvent[])
      .then((evs) => {
        const ok = (Array.isArray(evs) ? evs : []).filter((e) => e && typeof e.title === 'string' && Array.isArray(e.effects));
        this.queue = [...this.queue, ...ok].slice(-10);
      })
      .catch((e) => this.log(`${this.id}: planEvents failed: ${(e as Error).message}`))
      .finally(() => { this.planning = false; });
  }

  // ───────────── игроки ─────────────

  join(p: { name: string; kind: 'owner' | 'official'; role?: OfficialRole }): Ack<{ playerId: string; token: string }> {
    const r = hostJoin(this.world, p);
    if (r.error) return { ok: false, error: r.error };
    this.world = r.world;
    const token = randomBytes(24).toString('base64url');
    this.tokens.set(token, r.playerId);
    this.saveSoon();
    return { ok: true, data: { playerId: r.playerId, token } };
  }

  playerFor(token: string | undefined): string | undefined {
    return token ? this.tokens.get(token) : undefined;
  }

  act(playerId: string, a: Action): Ack<{ version: number }> {
    const r = act(this.world, this.ctx, playerId, a);
    if (r.error) return { ok: false, error: r.error };
    this.world = r.world;
    this.saveSoon();
    return { ok: true, data: { version: this.world.version } };
  }

  view(playerId: string | null, knownVersion?: number): ClientView | { unchanged: true } {
    const w = this.world;
    if (knownVersion !== undefined && knownVersion === w.version) {
      if (playerId) this.world = markSeen(this.world, playerId);
      return { unchanged: true };
    }
    const key = playerId ?? '_city';
    const cached = this.viewCache.get(key);
    let view: ClientView;
    if (cached && cached.version === w.version) view = cached.view;
    else {
      view = viewFor(w, this.ctx, playerId);
      this.viewCache.set(key, { version: w.version, view });
      if (this.viewCache.size > 2000) this.viewCache.clear();
    }
    if (playerId) this.world = markSeen(this.world, playerId);
    return { ...view, world: { ...view.world, msToNextDay: this.msToNextDay() } } as ClientView;
  }

  async query(playerId: string | null, q: Query): Promise<Ack<unknown>> {
    if (!q || typeof q !== 'object' || typeof (q as { type?: unknown }).type !== 'string') return { ok: false, error: 'Query must have a type' };
    try {
      if (q.type === 'advisor' || q.type === 'idea' || q.type === 'debrief') {
        const req = aiRequest(this.world, this.ctx, playerId, q);
        const ai = this.opts.ai;
        const data = req.kind === 'advisor'
          ? await withTimeout(ai.askAdvisor(req.input), AI_TIMEOUT_MS + 1000, () => ({ answer: 'The advisor is busy. Try again in a minute.', sources: [], origin: 'rules' as const }))
          : req.kind === 'idea'
            ? await withTimeout(ai.interpretIdea(req.input), AI_TIMEOUT_MS + 1000, () => null)
            : await withTimeout(ai.writeDebrief(req.input), AI_TIMEOUT_MS + 1000, () => null);
        return data === null ? { ok: false, error: 'The AI service did not answer' } : { ok: true, data };
      }
      return { ok: true, data: answer(this.world, this.ctx, playerId, q) };
    } catch (e) {
      if (e instanceof HostError) return { ok: false, error: e.message };
      this.log(`${this.id}: query ${q.type} failed: ${(e as Error).stack ?? e}`);
      return { ok: false, error: 'Something went wrong' };
    }
  }

  // ───────────── снимки ─────────────

  snapshot(): Snapshot {
    return { format: SNAPSHOT_FORMAT, savedAt: this.now(), lastDayAt: this.lastDayAt, pausedRemaining: this.pausedRemaining, world: this.world, tokens: [...this.tokens], queue: this.queue };
  }

  private file(): string | null {
    return this.opts.snapshotDir ? join(this.opts.snapshotDir, `${this.id}.json`) : null;
  }

  /** Запись снимка: сразу после игрового дня, иначе не чаще раза в секунду. */
  saveSoon(immediate = false): void {
    if (!this.file()) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.saveTimer = null; void this.save(); }, immediate ? 0 : 1000);
    this.saveTimer.unref?.();
  }

  async save(): Promise<void> {
    const file = this.file();
    if (!file) return;
    try {
      mkdirSync(this.opts.snapshotDir!, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(this.snapshot()));
      await rename(tmp, file);
    } catch (e) {
      this.log(`${this.id}: snapshot failed: ${(e as Error).message}`);
    }
  }

  saveSync(): void {
    const file = this.file();
    if (!file) return;
    try {
      mkdirSync(this.opts.snapshotDir!, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.snapshot()));
      renameSync(tmp, file);
    } catch (e) {
      this.log(`${this.id}: snapshot failed: ${(e as Error).message}`);
    }
  }

  static readSnapshot(dir: string | null, id: string, log: (m: string) => void = () => {}): Snapshot | null {
    if (!dir) return null;
    const file = join(dir, `${id}.json`);
    if (!existsSync(file)) return null;
    try {
      const s = JSON.parse(readFileSync(file, 'utf8')) as Snapshot;
      if (s.format !== SNAPSHOT_FORMAT || s.world?.config?.id !== id || typeof s.world.day !== 'number') {
        log(`${id}: snapshot ${file} is not usable, starting fresh`);
        return null;
      }
      return s;
    } catch (e) {
      log(`${id}: cannot read snapshot ${file}: ${(e as Error).message}`);
      return null;
    }
  }

  stats() {
    const w = this.world;
    return {
      id: w.config.id, name: w.config.name, demo: w.config.demo, day: w.day, version: w.version, phase: w.phase,
      paused: w.config.paused, dayMs: w.config.dayMs, msToNextDay: this.msToNextDay(),
      players: w.players.filter((p) => !p.isAi).length, businesses: w.businesses.length, queue: this.queue.length,
      errors: this.errors, lastError: this.lastError,
      stepMsAvg: this.stepsTaken ? Math.round((this.stepMsTotal / this.stepsTaken) * 10) / 10 : 0, stepMsMax: Math.round(this.stepMsMax * 10) / 10,
    };
  }
}
