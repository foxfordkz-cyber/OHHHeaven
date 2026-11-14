// Shared pieces of the browser checks: options, the HTTP API of the game and a private server for one run.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const { chromium } = createRequire(import.meta.url)('playwright');
export const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

const argv = process.argv.slice(2);
/** `--name value` from the command line, or the default. */
export const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt; };
export const flag = (name) => argv.includes(`--${name}`);
export const stamp = () => new Date().toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-');

/** The game's HTTP API (build/CONTRACT.md §6) at `base`. */
export function api(base) {
  const call = async (method, path, body, token) => {
    const r = await fetch(base.url + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    try { return JSON.parse(text); } catch { return { ok: false, error: `HTTP ${r.status}: ${text.slice(0, 120)}` }; }
  };
  return { call };
}
export const ack = (j, what) => { if (!j || !j.ok) throw new Error(`${what}: ${j?.error ?? JSON.stringify(j).slice(0, 200)}`); return j.data; };
export const unwrap = (j) => (j && typeof j === 'object' && 'ok' in j && 'data' in j ? j.data : j);

async function freePort() {
  return new Promise((ok, bad) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); s.on('error', bad); });
}

/**
 * Starts the game from `root` on a free port with an empty snapshot folder (builds the client when client/dist is missing).
 * `env` adds variables (e.g. PITCH=1, CLOCK_KEY). Returns { url, stop }. The server is stopped when the process exits.
 */
export async function startServer(root, log = console.log, env = {}) {
  if (!existsSync(join(root, 'client/dist/index.html'))) {
    log('client/dist is missing: npm run build');
    const b = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
    if (b.status !== 0) throw new Error('client build failed');
  }
  const port = await freePort();
  const snap = mkdtempSync(join(tmpdir(), 'ohh-e2e-'));
  const child = spawn(process.execPath, [join(root, 'node_modules/tsx/dist/cli.mjs'), 'server/src/main.ts'], {
    cwd: root, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', SNAPSHOT_DIR: snap, DEMO_RESTART_MIN: '0', ...env }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let errOut = '';
  child.stderr.on('data', (d) => { errOut += d; });
  const stop = () => { if (child.exitCode === null) child.kill('SIGTERM'); };
  process.on('exit', stop);
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) {
    try { const h = await fetch(`${url}/api/health`); if (h.ok) return { url, stop }; } catch { /* not yet */ }
    if (child.exitCode !== null) throw new Error(`server exited: ${errOut.slice(-400)}`);
    await sleep(500);
  }
  stop();
  throw new Error('server did not start in 60 s');
}
