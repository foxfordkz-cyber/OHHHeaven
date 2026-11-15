#!/usr/bin/env node
// Прогон показа жюри (docs/pitch/LIVE-SHOW.md): обе ветки выбора жюри — «выше цены» и «больше мест» —
// по HTTP, как их нажимают на сцене, с замером времени каждого шага против окна в сценарии.
// Поднимает свой сервер на свободном порту (или берёт PITCH_URL). Код возврата 1 — если не прошла обязательная
// проверка города или шаг не уложился в своё окно.
//
//   node scripts/pitch.mjs                 — собрать город, прогнать обе ветки, вернуть город в исходное состояние
//   PITCH_URL=http://192.168.1.5:8787 node scripts/pitch.mjs   — то же на уже запущенном сервере показа
//   CLOCK_KEY=... — если сервер показа запущен с ключом часов
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = process.env.CLOCK_KEY ?? '';
/** Окна сценария, секунды (LIVE-SHOW, раздел 2). Шаг дольше окна — красный. */
const WINDOW = {
  build: 180,      // сборка города перед показом: не на сцене, но должна уложиться в подготовку
  openOwner: 5,    // телефон открывает кофейню по коду: «не более пяти секунд ожидания»
  forecast: 5,     // 1:40–2:00 «The forecast updates before we commit»
  decide: 5,       // А сохраняет выбранное изменение
  inspection: 20,  // 2:40–3:00: жалоба → уведомление о штрафе, «крайний срок ожидания — 3:00»
  pay: 5,          // 3:00–3:20 Б оплачивает на телефоне
  reset: 10,       // между репетициями: «возвращает исходное состояние»
};

let BASE = process.env.PITCH_URL?.replace(/\/$/, '') ?? '';
let child = null;
let dataDir = null;

async function call(method, path, body, token) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(KEY ? { 'x-clock-key': KEY } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  try { return { status: r.status, ...JSON.parse(text) }; } catch { return { status: r.status, ok: false, raw: text }; }
}

const freePort = () => new Promise((ok, fail) => {
  const s = createServer();
  s.once('error', fail);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => ok(port)); });
});

async function startServer() {
  const port = await freePort();
  dataDir = mkdtempSync(join(tmpdir(), 'ohh-pitch-'));
  child = spawn(process.execPath, [join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join('server', 'src', 'main.ts')], {
    cwd: ROOT, env: { ...process.env, PORT: String(port), HOST: '0.0.0.0', SNAPSHOT_DIR: dataDir, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  BASE = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 300; i++) {
    if (child.exitCode !== null) throw new Error(`server exited:\n${out}`);
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server did not start in 30 s:\n${out}`);
}

async function stop() {
  if (child && child.exitCode === null) {
    const exited = new Promise((ok) => child.once('exit', ok));
    child.kill('SIGTERM');
    await Promise.race([exited, new Promise((ok) => setTimeout(ok, 3000))]);
  }
  // сервер пишет снимки при выходе: папку убираем после него, а неудачу уборки не считаем провалом показа
  if (dataDir) { try { rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* temp dir stays */ } }
}

const rows = [];
let red = false;
async function timed(branch, step, window, fn) {
  const t0 = performance.now();
  let note = '';
  let ok = true;
  try { note = (await fn()) ?? ''; } catch (e) { ok = false; note = e.message; }
  const s = (performance.now() - t0) / 1000;
  if (s > window) ok = false;
  if (!ok) red = true;
  rows.push({ branch, step, s, window, ok, note });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${branch.padEnd(6)} ${step.padEnd(11)} ${s.toFixed(2).padStart(6)} s / ${String(window).padStart(3)} s  ${note}`);
  return ok;
}

const must = (r, what) => { if (!r.ok) throw new Error(`${what}: ${r.error ?? r.raw ?? r.status}`); return r.data; };
const money = (n) => (typeof n === 'number' ? `$${Math.round(n).toLocaleString('en-US')}` : '—');
const price = (n) => (typeof n === 'number' ? `$${n.toFixed(2)}` : '—');

async function waitFor(fn, seconds) {
  const until = performance.now() + seconds * 1000;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (performance.now() > until) return null;
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function main() {
  if (!BASE) await startServer();
  console.log(`Pitch run on ${BASE}${process.env.PITCH_URL ? '' : ' (own server)'}\n`);

  // 0. город: собрать или взять уже собранный
  let st;
  await timed('city', 'build', WINDOW.build, async () => {
    const r = await call('POST', '/api/worlds', { scenario: 'pitch' });
    st = must(r, 'create the pitch city').pitch;
    return `day ${st.day} (${st.date}), ${st.paused ? 'paused' : 'RUNNING'}`;
  });
  if (!st) return finish();
  console.log('\nHow the city was prepared (normal actions and game days):');
  for (const line of st.log) console.log(`  ${line}`);
  console.log('\nCity checks:');
  for (const c of st.checks) {
    console.log(`  ${c.ok ? 'PASS' : c.level === 'must' ? 'FAIL' : 'WARN'}  ${c.id}: ${c.text}`);
    if (!c.ok && c.level === 'must') red = true;
  }
  console.log(`\nJoin: guest ${st.join.guest.url}  ·  enter a code at ${st.join.enter}`);
  if (!st.join.maya) throw new Error('owner codes are hidden: set CLOCK_KEY to the server clock key');
  console.log(`      Maya ${st.join.maya.url}  ·  Viktor ${st.join.viktor.url}\n`);

  for (const branch of ['price', 'seats']) {
    const label = st.branches.find((b) => b.id === branch)?.label ?? branch;
    console.log(`── Branch "${label}" ──`);
    await timed(branch, 'reset', WINDOW.reset, async () => {
      const d = must(await call('POST', '/api/worlds/pitch/pitch', { command: 'reset' }), 'reset');
      if (!d.atStart || !d.paused) throw new Error(`not at the prepared moment: day ${d.day}, paused ${d.paused}`);
      return `day ${d.day}, paused`;
    });
    const tokens = {};
    for (const role of ['maya', 'viktor']) {
      await timed(branch, `open ${role}`, WINDOW.openOwner, async () => {
        const page = await fetch(`${BASE}/p/${st.join[role].code}`).then((r) => r.text());
        tokens[role] = /"token":"([^"]+)"/.exec(page)?.[1];
        if (!tokens[role]) throw new Error('the code page carries no session');
        const v = await call('GET', '/api/worlds/pitch/view', undefined, tokens[role]);
        if (!v.me || !v.business) throw new Error('no business in the owner view');
        return `${v.business.name}: cash ${money(v.business.cash)}, price ${price(v.business.orders.price)}, ${v.business.size} seats`;
      });
    }
    const view = await call('GET', '/api/worlds/pitch/view', undefined, tokens.maya);
    const b = view.business;
    await timed(branch, 'forecast', WINDOW.forecast, async () => {
      const q = branch === 'price'
        ? { type: 'what_if', orders: { price: Math.round(b.orders.price * 1.1 * 4) / 4 } }
        : { type: 'what_if', orders: {}, size: b.size + 6 };
      const d = must(await call('POST', '/api/worlds/pitch/query', q, tokens.maya), 'what_if');
      return `forecast month: sales ${money(d.projected?.revenue)}, profit ${money(d.projected?.profit)}`;
    });
    await timed(branch, 'decide', WINDOW.decide, async () => {
      const d = must(await call('POST', '/api/worlds/pitch/pitch', { command: 'branch', branch }), branch);
      return `Maya now: price ${price(d.summary.maya.price)}, ${d.summary.maya.seats} seats, cash ${money(d.summary.maya.cash)}`;
    });
    let caseId = null;
    await timed(branch, 'inspection', WINDOW.inspection, async () => {
      const d = must(await call('POST', '/api/worlds/pitch/pitch', { command: 'complaint', run: true }), 'complaint');
      caseId = d.complaint?.caseId;
      const done = await waitFor(async () => {
        const s = (await call('GET', '/api/worlds/pitch/pitch')).data;
        return s?.complaint && s.complaint.status !== 'open' && s.complaint.status !== 'taken' && s.paused ? s : null;
      }, WINDOW.inspection);
      if (!done) throw new Error('no notice before the deadline');
      if (!done.complaint.found.includes(st.shortcut.violationId)) throw new Error(`found ${done.complaint.found.join(', ') || 'nothing'}, not ${st.shortcut.violationId}`);
      return `${done.complaint.official ?? 'official'}: ${done.complaint.status}, fine ${money(done.complaint.fine)} after ${done.day - d.day} game days; paused`;
    });
    await timed(branch, 'pay', WINDOW.pay, async () => {
      if (!caseId) throw new Error('no case');
      const r = await call('POST', '/api/worlds/pitch/action', { type: 'answer_notice', caseId, response: 'pay' }, tokens.viktor);
      if (!r.ok) throw new Error(r.error);
      const v = await call('GET', '/api/worlds/pitch/view', undefined, tokens.viktor);
      return `Viktor paid; cash ${money(v.business?.cash)}`;
    });
    console.log('');
  }
  await timed('city', 'reset', WINDOW.reset, async () => {
    const d = must(await call('POST', '/api/worlds/pitch/pitch', { command: 'reset' }), 'reset');
    return `back at day ${d.day} (${d.date}), paused ${d.paused}`;
  });
  return finish();
}

async function finish() {
  const slowest = [...rows].sort((a, b) => b.s / b.window - a.s / a.window)[0];
  console.log(`\n${red ? 'FAIL' : 'PASS'}: ${rows.filter((r) => r.ok).length}/${rows.length} steps in their windows${slowest ? `; tightest: ${slowest.branch} ${slowest.step} ${slowest.s.toFixed(2)} of ${slowest.window} s` : ''}`);
  await stop();
  process.exit(red ? 1 : 0);
}

process.on('SIGINT', () => { void stop().then(() => process.exit(130)); });
main().catch((e) => { console.error(`FAIL: ${e.stack ?? e}`); red = true; return finish(); });
