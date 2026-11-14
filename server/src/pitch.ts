// Город для показа жюри на сервере (build/ROUND3.md, A5): сценарий `pitch`, управление показом одной командой,
// вход по короткому коду и QR с адресом в локальной сети. Сам город собирает хост (host/src/pitch.ts).
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import type { WorldState } from '@ohh/shared';
import { dateOf } from '@ohh/shared';
import type { HostDeps } from '@ohh/host';
import {
  BRANCH_LABEL, PITCH_WORLD_ID, applyBranch, buildPitch, caseProgress, fileComplaint, pitchDeps, pitchSummary,
  type CaseProgress, type PitchBranchId, type PitchRole, type PitchSetup,
} from '@ohh/host/pitch';
import type { WorldRuntime } from './runtime';

/** Буквы кода без похожих (нет I, O, 0, 1): код читают со слайда и набирают на телефоне. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const GUEST_CODE_LENGTH = 4;
export const OWNER_CODE_LENGTH = 6;
/** Скорость по умолчанию, когда ведущий снимает паузу после жалобы: игровой день за секунду. */
export const PITCH_RUN_DAY_MS = 1000;
const SETUP_FORMAT = 1;

export function makeCode(length: number, taken: ReadonlySet<string> = new Set()): string {
  for (;;) {
    const bytes = randomBytes(length);
    let s = '';
    for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
    if (!taken.has(s)) return s;
  }
}

export const normalizeCode = (raw: string): string => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

export interface PitchCodes { guest: string; maya: string; viktor: string }

/** Что лежит на диске рядом со снимком мира: стартовая копия, проверки, коды. */
export interface PitchFile { format: number; setup: PitchSetup; codes: PitchCodes; complaintCaseId: string | null; autoPause: boolean }

export type PitchCommand =
  | { command: 'status' }
  | { command: 'pause' }
  | { command: 'resume'; dayMs?: number }
  | { command: 'advance'; days: number }
  | { command: 'speed'; dayMs: number }
  | { command: 'reset' }
  | { command: 'branch'; branch: PitchBranchId }
  | { command: 'complaint'; run?: boolean; dayMs?: number };

/** Адрес, который телефон в той же сети откроет: PUBLIC_URL, иначе первый внешний IPv4 этой машины. */
export function lanBase(port: number, env: NodeJS.ProcessEnv = process.env): string {
  if (env.PUBLIC_URL) return env.PUBLIC_URL.replace(/\/$/, '');
  const all = Object.values(networkInterfaces()).flat().filter((i): i is NonNullable<typeof i> => !!i && i.family === 'IPv4' && !i.internal);
  const rank = (a: string) => (a.startsWith('192.168.') ? 0 : a.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(a) ? 2 : 3);
  const ip = all.map((i) => i.address).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))[0];
  return `http://${ip ?? '127.0.0.1'}:${port}`;
}

export interface PitchHost {
  snapshotDir: string | null;
  log: (m: string) => void;
  /** Открыть мир на сервере с этими зависимостями хоста и стартовым миром (или из снимка). */
  openPitch(id: string, world: WorldState | null, deps: HostDeps, onDay: (rt: WorldRuntime) => void): WorldRuntime;
  baseDeps(): HostDeps;
  ctx: Parameters<typeof buildPitch>[0];
}

/** Ведущий показа: держит стартовую копию, коды и дело по жалобе; всё остальное — обычный мир на сервере. */
export class PitchDirector {
  rt: WorldRuntime;
  file: PitchFile;

  private constructor(private readonly host: PitchHost, rt: WorldRuntime, file: PitchFile) {
    this.rt = rt;
    this.file = file;
  }

  get id(): string { return this.file.setup.worldId; }
  get setup(): PitchSetup { return this.file.setup; }

  /** Собрать город показа заново: ~20 секунд расчёта (открытие кафе на новом движке занимает месяцы игры). */
  static create(host: PitchHost, id = PITCH_WORLD_ID): PitchDirector {
    const t0 = Date.now();
    const setup = buildPitch(host.ctx, host.baseDeps(), { id });
    const taken = new Set<string>();
    const code = (n: number) => { const c = makeCode(n, taken); taken.add(c); return c; };
    const file: PitchFile = { format: SETUP_FORMAT, setup, codes: { guest: code(GUEST_CODE_LENGTH), maya: code(OWNER_CODE_LENGTH), viktor: code(OWNER_CODE_LENGTH) }, complaintCaseId: null, autoPause: false };
    let director: PitchDirector | null = null;
    const rt = host.openPitch(id, setup.start, pitchDeps(host.baseDeps()), (r) => director?.onDay(r));
    rt.replaceWorld(setup.start);
    director = new PitchDirector(host, rt, file);
    for (const role of ['maya', 'viktor'] as const) rt.issueToken(setup.players[role]);
    director.save();
    host.log(`${id}: pitch city built in ${Date.now() - t0} ms on day ${setup.preparedDay}; checks ${setup.checks.filter((c) => c.ok).length}/${setup.checks.length}`);
    return director;
  }

  /** Поднять город показа из снимка после перезапуска сервера. */
  static restore(host: PitchHost, id = PITCH_WORLD_ID): PitchDirector | null {
    const file = PitchDirector.read(host.snapshotDir, id, host.log);
    if (!file) return null;
    let director: PitchDirector | null = null;
    const rt = host.openPitch(id, null, pitchDeps(host.baseDeps()), (r) => director?.onDay(r));
    director = new PitchDirector(host, rt, file);
    for (const role of ['maya', 'viktor'] as const) rt.issueToken(file.setup.players[role]);
    host.log(`${id}: pitch city restored at day ${rt.world.day}`);
    return director;
  }

  static fileOf(dir: string | null, id: string): string | null {
    return dir ? join(dir, `${id}.setup.json`) : null;
  }

  static read(dir: string | null, id: string, log: (m: string) => void): PitchFile | null {
    const f = PitchDirector.fileOf(dir, id);
    if (!f || !existsSync(f)) return null;
    try {
      const x = JSON.parse(readFileSync(f, 'utf8')) as PitchFile;
      if (x.format !== SETUP_FORMAT || x.setup?.worldId !== id || !x.setup.start) { log(`${id}: ${f} is not usable`); return null; }
      return x;
    } catch (e) {
      log(`${id}: cannot read ${f}: ${(e as Error).message}`);
      return null;
    }
  }

  save(): void {
    const f = PitchDirector.fileOf(this.host.snapshotDir, this.id);
    if (!f) return;
    try {
      mkdirSync(this.host.snapshotDir!, { recursive: true });
      const tmp = `${f}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.file));
      renameSync(tmp, f);
    } catch (e) {
      this.host.log(`${this.id}: cannot save the pitch setup: ${(e as Error).message}`);
    }
  }

  /** После каждого дня: если включена автопауза и по жалобе пришло уведомление — пауза. */
  private onDay(rt: WorldRuntime): void {
    if (!this.file.autoPause || !this.file.complaintCaseId) return;
    const p = caseProgress(rt.world, this.file.complaintCaseId);
    if (p && p.status !== 'open' && p.status !== 'taken') {
      this.file.autoPause = false;
      rt.setClock({ paused: true });
      this.save();
      this.host.log(`${this.id}: the complaint reached "${p.status}" on day ${rt.world.day}; paused`);
    }
  }

  // ───────────── вход по коду ─────────────

  /** Кто входит по коду: гость (вид города) или владелец со своим токеном. */
  resolve(raw: string): { role: 'guest' | PitchRole; worldId: string; playerId?: string; token?: string; name?: string } | null {
    const code = normalizeCode(raw);
    const c = this.file.codes;
    if (code === c.guest) return { role: 'guest', worldId: this.id };
    for (const role of ['maya', 'viktor'] as const) {
      if (code !== c[role]) continue;
      const playerId = this.setup.players[role];
      const p = this.rt.world.players.find((x) => x.id === playerId);
      return { role, worldId: this.id, playerId, token: this.rt.issueToken(playerId), name: p?.name };
    }
    return null;
  }

  // ───────────── команды ─────────────

  run(cmd: PitchCommand): { ok: true; data: PitchStatus } | { ok: false; error: string } {
    const rt = this.rt;
    switch (cmd.command) {
      case 'status': break;
      case 'pause': rt.setClock({ paused: true }); break;
      case 'resume': {
        const r = rt.setClock({ paused: false, ...(cmd.dayMs !== undefined ? { dayMs: cmd.dayMs } : {}) });
        if (!r.ok) return r;
        break;
      }
      case 'speed': {
        const r = rt.setClock({ dayMs: cmd.dayMs });
        if (!r.ok) return r;
        break;
      }
      case 'advance': {
        const r = rt.setClock({ advanceDays: cmd.days });
        if (!r.ok) return r;
        break;
      }
      case 'reset':
        rt.replaceWorld(this.setup.start);
        this.file.complaintCaseId = null;
        this.file.autoPause = false;
        this.save();
        break;
      case 'branch': {
        if (cmd.branch !== 'price' && cmd.branch !== 'seats') return { ok: false, error: 'branch must be "price" or "seats"' };
        const r = applyBranch(rt.world, rt.ctx, this.setup, cmd.branch);
        if (r.error) return { ok: false, error: r.error };
        rt.update(r.world);
        break;
      }
      case 'complaint': {
        const r = fileComplaint(rt.world, rt.ctx, this.setup);
        if (r.error) return { ok: false, error: r.error };
        rt.update(r.world);
        this.file.complaintCaseId = r.caseId ?? null;
        if (cmd.run) {
          this.file.autoPause = true;
          const s = rt.setClock({ paused: false, dayMs: cmd.dayMs ?? PITCH_RUN_DAY_MS });
          if (!s.ok) return s;
        }
        this.save();
        break;
      }
      default: return { ok: false, error: 'Unknown command: status, pause, resume, speed, advance, reset, branch, complaint' };
    }
    return { ok: true, data: this.status() };
  }

  status(opts: { base?: string; secrets?: boolean } = {}): PitchStatus {
    const w = this.rt.world;
    const base = opts.base ?? '';
    const codes = this.file.codes;
    const owner = (role: PitchRole) => (opts.secrets ? { code: codes[role], url: `${base}/p/${codes[role]}` } : null);
    return {
      worldId: this.id, day: w.day, date: dateOf(w.day).label, paused: w.config.paused, dayMs: w.config.dayMs,
      preparedDay: this.setup.preparedDay, atStart: w.day === this.setup.preparedDay && this.file.complaintCaseId === null,
      summary: pitchSummary(w, this.setup),
      checks: this.setup.checks,
      branches: (['price', 'seats'] as const).map((id) => ({ id, label: BRANCH_LABEL[id], ok: this.setup.branches[id].ok, error: this.setup.branches[id].error, week: this.setup.branches[id].week })),
      shortcut: this.setup.shortcut,
      dryComplaint: this.setup.complaint,
      complaint: caseProgress(w, this.file.complaintCaseId ?? undefined),
      autoPause: this.file.autoPause,
      log: this.setup.log,
      join: { base, guest: { code: codes.guest, url: `${base}/p/${codes.guest}`, qr: `${base}/p/${codes.guest}/qr.svg` }, maya: owner('maya'), viktor: owner('viktor'), enter: `${base}/p` },
    };
  }
}

export interface PitchStatus {
  worldId: string; day: number; date: string; paused: boolean; dayMs: number; preparedDay: number; atStart: boolean;
  summary: ReturnType<typeof pitchSummary>;
  checks: PitchSetup['checks'];
  branches: { id: PitchBranchId; label: string; ok: boolean; error?: string; week?: PitchSetup['branches']['price']['week'] }[];
  shortcut: PitchSetup['shortcut'];
  dryComplaint: PitchSetup['complaint'];
  complaint: CaseProgress | null;
  autoPause: boolean;
  log: string[];
  join: { base: string; guest: { code: string; url: string; qr: string }; maya: { code: string; url: string } | null; viktor: { code: string; url: string } | null; enter: string };
}

// ───────────── страницы входа ─────────────

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const PAGE_STYLE = `:root{color-scheme:light dark;--bg:#f7f5f0;--fg:#1d1b18;--muted:#6b665d;--accent:#1f6f5c;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#141311;--fg:#f1eee8;--muted:#a59f94;--accent:#5fc4a8;--card:#1f1d1a}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}
main{background:var(--card);border-radius:16px;padding:24px;max-width:420px;width:100%;box-shadow:0 1px 3px rgba(0,0,0,.08)}
h1{font-size:22px;margin:0 0 8px}p{color:var(--muted);margin:0 0 16px}
input{font:600 28px/1 ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase;width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid var(--muted);background:transparent;color:var(--fg)}
button{margin-top:12px;width:100%;padding:14px;border:0;border-radius:10px;background:var(--accent);color:#fff;font:600 17px system-ui}`;

export function page(title: string, body: string, script = ''): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${PAGE_STYLE}</style></head><body><main>${body}</main>${script ? `<script>${script}</script>` : ''}</body></html>`;
}

/** Страница ввода кода: телефон в той же сети открывает адрес и набирает четыре или шесть букв. */
export function enterPage(error?: string): string {
  return page('First Year — enter code', `<h1>First Year</h1><p>${error ? esc(error) : 'Type the code from the screen.'}</p>
<form method="get" onsubmit="location.href='/p/'+encodeURIComponent(this.code.value.trim());return false"><input name="code" autocomplete="off" autocapitalize="characters" maxlength="8" autofocus aria-label="Code"><button type="submit">Enter the city</button></form>`);
}

/**
 * Страница входа по коду: кладёт сессию туда же, где её ищет клиент (client/src/app/session.ts: `ohh.sessions.v1`,
 * ключ `remote:<world>`), запоминает город и ведёт в игру. Гость — без сессии, в вид города.
 */
export function joinPage(r: NonNullable<ReturnType<PitchDirector['resolve']>>): string {
  const session = r.role === 'guest' ? null : { worldId: r.worldId, playerId: r.playerId, token: r.token, name: r.name ?? r.role, kind: 'owner' };
  const next = r.role === 'guest' ? `/?world=${encodeURIComponent(r.worldId)}` : `/biz?world=${encodeURIComponent(r.worldId)}`;
  const payload = JSON.stringify({ world: r.worldId, session, next }).replace(/</g, '\\u003c');
  const script = `(function(){var s=${payload};try{var k='ohh.sessions.v1';var all=JSON.parse(localStorage.getItem(k)||'{}');if(!all||typeof all!=='object')all={};if(s.session){all['remote:'+s.world]=s.session}else{delete all['remote:'+s.world]}localStorage.setItem(k,JSON.stringify(all));localStorage.setItem('ohh.world.v1',s.world);localStorage.setItem('ohh.mode.v1','remote')}catch(e){}location.replace(s.next)})();`;
  const who = r.role === 'guest' ? 'the city as a guest' : `${r.name ?? r.role}'s cafe`;
  return page('First Year — opening', `<h1>Opening ${esc(who)}…</h1><p>If nothing happens, <a href="${esc(next)}">tap here</a>.</p>`, script);
}
