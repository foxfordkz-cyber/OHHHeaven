#!/usr/bin/env node
// End-to-end check over HTTP — context/08-game-v5.md §10 (owner: agent 01).
// Starts the server (or uses SMOKE_URL), walks the scenario and prints, for every step,
// whether it ran on real code or on a stub (files whose first line has the `@ohh-stub` marker).
// Exit code 1 only when a step that runs entirely on real code fails; stub steps never turn it red.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MARKER = '@ohh-stub';

function fileStatus(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return 'missing';
  return readFileSync(p, 'utf8').includes(MARKER) ? 'stub' : 'real';
}

const files = {
  server: fileStatus('server/src/index.ts'),
  host: fileStatus('host/src/index.ts'),
  engine: fileStatus('engine/src/index.ts'),
  economy: fileStatus('engine/src/economy/index.ts'),
  law: fileStatus('engine/src/law/index.ts'),
  deals: fileStatus('engine/src/deals/index.ts'),
  analytics: fileStatus('engine/src/analytics/index.ts'),
  ai: fileStatus('ai/src/index.ts'),
  bots: fileStatus('bots/src/index.ts'),
  cafePack: existsSync(join(ROOT, 'packs/cafe.json')) ? 'real' : 'missing',
  commonPack: existsSync(join(ROOT, 'packs/_common.json')) ? 'real' : 'missing',
  places: existsSync(join(ROOT, 'data/places.json')) ? 'real' : 'missing',
};
// Engine modules count as real only when the real engine core composes them.
const isReal = (m) => (['economy', 'law', 'deals', 'analytics'].includes(m) ? files.engine === 'real' && files[m] === 'real' : files[m] === 'real');

const STEPS = [
  { id: 'health', title: 'Server starts, GET /api/health', deps: ['server'], needs: [] },
  { id: 'world', title: 'Create a demo city', deps: ['server', 'host'], needs: ['health'] },
  { id: 'join', title: 'Two owners join', deps: ['server', 'host'], needs: ['world'] },
  { id: 'open', title: 'Both open a cafe with the recommended kit', deps: ['server', 'host', 'engine', 'economy', 'analytics', 'cafePack', 'places'], needs: ['join'] },
  { id: 'month', title: 'City runs 35 days, both have a MonthReport', deps: ['server', 'host', 'engine', 'economy'], needs: ['open'] },
  { id: 'case', title: 'Owner 1 reports owner 2 → case, inspection, notice', deps: ['server', 'host', 'engine', 'law', 'cafePack'], needs: ['month'] },
  { id: 'deal', title: 'Cross-promo between them is accepted', deps: ['server', 'host', 'engine', 'deals'], needs: ['open'] },
  { id: 'analytics', title: 'Both views carry analytics', deps: ['server', 'host', 'engine', 'analytics'], needs: ['open'] },
];

// ───────────── HTTP ─────────────
let BASE = process.env.SMOKE_URL?.replace(/\/$/, '') ?? '';
async function call(method, path, body, token) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (r.status >= 400 && !('ok' in (json ?? {}))) throw new Error(`${method} ${path} → HTTP ${r.status}`);
  return json;
}
const get = (path, token) => call('GET', path, undefined, token);
const post = (path, body, token) => call('POST', path, body, token);
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function waitFor(fn, ms, every = 200) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(every);
  }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const ack = (r, what) => { must(r && r.ok, `${what}: ${r?.error ?? JSON.stringify(r).slice(0, 160)}`); return r.data; };

// ───────────── server process ─────────────
let child = null;
async function startServer() {
  if (BASE) return;
  const port = await new Promise((ok, fail) => {
    const srv = createServer().once('error', fail).listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => ok(p)); });
  });
  BASE = `http://127.0.0.1:${port}`;
  const dataDir = mkdtempSync(join(tmpdir(), 'ohh-smoke-'));
  // Start the server with node + tsx directly: `spawn('npm')` does not exist on Windows (npm is npm.cmd there).
  child = spawn(process.execPath, [join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join('server', 'src', 'main.ts')], {
    cwd: ROOT, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, NODE_ENV: 'test' },
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const up = await waitFor(async () => { try { return (await get('/api/health')).ok; } catch { return false; } }, 45_000, 300);
  if (!up) throw new Error(`server did not answer /api/health in 45 s\n${log.slice(-2000)}`);
}
function stopServer() {
  if (!child) return;
  if (process.platform === 'win32') { try { child.kill(); } catch { /* gone */ } return; }
  try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch { /* gone */ } }
}

// ───────────── scenario ─────────────
const ctx = {};
const results = [];
const view = (t) => get(`/api/worlds/${ctx.worldId}/view`, t);
const action = (t, a) => post(`/api/worlds/${ctx.worldId}/action`, a, t);
const query = (t, q) => post(`/api/worlds/${ctx.worldId}/query`, q, t);
const clock = (body) => post(`/api/worlds/${ctx.worldId}/clock`, body);

const run = {
  async health() {
    await startServer();
    const h = await get('/api/health');
    must(h.ok, 'health is not ok');
    return BASE;
  },
  async world() {
    const r = await post('/api/worlds', { name: 'Smoke city' });
    ctx.worldId = r?.data?.id ?? r?.id;
    must(ctx.worldId, `POST /api/worlds returned no id: ${JSON.stringify(r).slice(0, 120)}`);
    const c = await clock({ paused: true });
    ctx.clock = Boolean(c?.ok);
    const v = await view();
    must(v.kind === 'city', `city view expected, got ${v.kind}`);
    return `world ${ctx.worldId}, day ${v.world.day}`;
  },
  async join() {
    ctx.a = ack(await post(`/api/worlds/${ctx.worldId}/join`, { name: 'Ana Smoke', kind: 'owner' }), 'join A');
    ctx.b = ack(await post(`/api/worlds/${ctx.worldId}/join`, { name: 'Ben Smoke', kind: 'owner' }), 'join B');
    must(ctx.a.token && ctx.b.token, 'no tokens');
    const va = await view(ctx.a.token);
    must(va.kind === 'owner', `owner view expected, got ${va.kind}`);
    return `${ctx.a.playerId}, ${ctx.b.playerId}`;
  },
  async open() {
    const places = await get('/api/places');
    const city = await view();
    const taken = new Set((city.businesses ?? []).map((b) => b.placeId));
    const free = places.filter((p) => p.suitableFor?.includes('cafe') && !taken.has(p.id));
    must(free.length >= 2, `need 2 free cafe places, have ${free.length}`);
    const [pa, pb] = [free[0], free.find((p) => p.block === free[0].block && p.id !== free[0].id) ?? free[1]];
    for (const [who, place, name] of [[ctx.a, pa, 'Smoke Cafe A'], [ctx.b, pb, 'Smoke Cafe B']]) {
      const rec = ack(await query(who.token, { type: 'recommend_opening', niche: 'cafe', placeId: place.id }), 'recommend_opening');
      must(Array.isArray(rec) && rec.length, 'no recommended kits');
      const kit = rec.find((k) => k.kitId === 'standard') ?? rec[0];
      ack(await action(who.token, { type: 'open_business', niche: 'cafe', placeId: place.id, name, kitId: kit.kitId, size: kit.size, items: kit.items }), `open ${name}`);
      ack(await action(who.token, { type: 'launch' }), `launch ${name}`);
      const v = await view(who.token);
      must(v.business?.id, `${name}: no business in the owner view`);
      who.businessId = v.business.id;
    }
    // Owner B cuts a corner that an inspector can find, so the complaint has something to find.
    const packs = await get('/api/packs');
    const pack = packs.niches?.cafe;
    const all = (k) => [...(pack?.[k] ?? []), ...(packs.common?.[k] ?? [])];
    for (const rep of all('reports')) {
      const sc = all('shortcuts').find((s) => rep.checks?.includes(s.violation));
      if (sc) { ctx.report = rep; ctx.shortcut = sc; break; }
    }
    ctx.report ??= all('reports')[0];
    if (ctx.shortcut) ack(await action(ctx.b.token, { type: 'set_orders', orders: { shortcuts: [ctx.shortcut.id] } }), 'set_orders shortcut');
    return `A at ${pa.address}, B at ${pb.address}${ctx.shortcut ? `; B uses '${ctx.shortcut.id}'` : ''}`;
  },
  async month() {
    const start = (await view()).world.day;
    if (ctx.clock) await clock({ paused: false, dayMs: 25 });
    const ok = await waitFor(async () => {
      const [va, vb] = await Promise.all([view(ctx.a.token), view(ctx.b.token)]);
      return va.world.day >= start + 35 && va.business?.history?.length >= 1 && vb.business?.history?.length >= 1 ? [va, vb] : null;
    }, ctx.clock ? 60_000 : 35 * 2_000 + 20_000, 250);
    if (ctx.clock) await clock({ paused: true });
    must(ok, 'no MonthReport after 35 days');
    const [va, vb] = ok;
    const m = (v) => v.business.history.at(-1);
    return `day ${va.world.day}; A profit ${Math.round(m(va).profit)}, B profit ${Math.round(m(vb).profit)}`;
  },
  async case() {
    must(ctx.report, 'no report type in packs');
    const before = (await view(ctx.a.token)).me.inbox?.length ?? 0;
    ack(await action(ctx.a.token, { type: 'report', targetBusinessId: ctx.b.businessId, reportId: ctx.report.id }), 'report');
    const startDay = (await view()).world.day;
    if (ctx.clock) await clock({ paused: false, dayMs: 40 });
    // Grace days for the case, inspection days and the answer window, plus slack.
    const got = await waitFor(async () => {
      const [va, vb] = await Promise.all([view(ctx.a.token), view(ctx.b.token)]);
      const notice = vb.notices?.find((n) => n.found?.length);
      if (notice) return { notice, vb };
      const fresh = (va.me.inbox ?? []).slice(0, Math.max(0, (va.me.inbox?.length ?? 0) - before));
      const warned = fresh.find((m) => m.kind === 'case' && /warn|clean|nothing|no violation/i.test(`${m.title} ${m.text}`));
      return warned && va.world.day > startDay + 3 ? { warned, vb } : null;
    }, ctx.clock ? 40_000 : 30 * 2_000, 250);
    if (ctx.clock) await clock({ paused: true });
    must(got, 'no inspection result within the wait');
    if (got.notice && got.notice.status === 'notice') ack(await action(ctx.b.token, { type: 'answer_notice', caseId: got.notice.caseId, response: 'pay' }), 'answer_notice');
    const inboxB = (await view(ctx.b.token)).me.inbox ?? [];
    must(got.warned || inboxB.some((m) => m.kind === 'case'), 'owner 2 got no case notification');
    return got.notice ? `notice: fine ${Math.round(got.notice.fine)} for ${got.notice.found.length} violation(s) (${got.notice.found.map((f) => f.violationId).join(', ')})` : `clean inspection, reporter warned: "${got.warned.title}"`;
  },
  async deal() {
    let terms = { type: 'cross_promo', months: 3 };
    let r = await action(ctx.a.token, { type: 'propose_deal', toBusinessId: ctx.b.businessId, terms });
    let note = '';
    if (!r.ok) {
      note = ` (cross_promo refused: "${r.error}" — §10 of the game has two cafes, CONTRACT §4 wants different niches; used joint_purchase)`;
      terms = { type: 'joint_purchase', months: 3 };
      r = await action(ctx.a.token, { type: 'propose_deal', toBusinessId: ctx.b.businessId, terms });
    }
    ack(r, 'propose_deal');
    const vb = await view(ctx.b.token);
    const offer = vb.deals?.find((d) => d.status === 'proposed' && d.fromBusinessId === ctx.a.businessId);
    must(offer, 'B does not see the offer');
    ack(await action(ctx.b.token, { type: 'answer_deal', dealId: offer.id, accept: true }), 'answer_deal');
    const va = await view(ctx.a.token);
    must(va.deals?.some((d) => d.id === offer.id && d.status === 'active'), 'deal is not active for A');
    return `${terms.type} ${offer.id} active${note}`;
  },
  async analytics() {
    const [va, vb] = await Promise.all([view(ctx.a.token), view(ctx.b.token)]);
    for (const [n, v] of [['A', va], ['B', vb]]) must(v.analytics && Number.isFinite(v.analytics.netWorth), `${n} has no analytics`);
    return `A net worth ${Math.round(va.analytics.netWorth)}, B net worth ${Math.round(vb.analytics.netWorth)}`;
  },
};

let red = false;
const passed = new Set();
try {
  for (const s of STEPS) {
    const stubs = s.deps.filter((d) => !isReal(d));
    const mode = stubs.length ? `stub: ${stubs.join(', ')}` : 'REAL';
    const missing = s.needs.filter((n) => !passed.has(n));
    if (missing.length) { results.push({ s, status: 'skip', mode, detail: `needs '${missing.join("', '")}'` }); continue; }
    try {
      const detail = await run[s.id]();
      passed.add(s.id);
      results.push({ s, status: 'pass', mode, detail: String(detail ?? '') });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (stubs.length) results.push({ s, status: 'stub-fail', mode, detail: msg });
      else { red = true; results.push({ s, status: 'FAIL', mode, detail: msg }); }
    }
  }
} finally {
  stopServer();
}

const icon = { pass: '✔', FAIL: '✖', 'stub-fail': '–', skip: '·' };
console.log('\nFirst Year smoke — context/08-game-v5.md §10\n');
for (const r of results) console.log(`${icon[r.status]} ${r.s.title.padEnd(52)} [${r.mode}]${r.detail ? `\n    ${r.detail}` : ''}`);
const real = results.filter((r) => r.status === 'pass' && r.mode === 'REAL').length;
const onStub = results.filter((r) => r.status === 'pass' && r.mode !== 'REAL').length;
console.log(`\nmodules: ${Object.entries(files).map(([k, v]) => `${k}=${v}`).join(' ')}`);
console.log(`smoke: ${red ? 'RED' : 'GREEN'} — ${real} step(s) on real code, ${onStub} on stubs, ${results.filter((r) => r.status === 'stub-fail' || r.status === 'skip').length} waiting for real pieces`);
process.exit(red ? 1 : 0);
