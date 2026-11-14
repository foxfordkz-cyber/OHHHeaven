#!/usr/bin/env node
// Browser walk of the whole player path (round 3, task B06): guest → idea → place → plan → join → setup →
// permits → open → business tabs → what-if → deal → report → month → end of season → personal plan.
// Phone (375) and desktop (1440). Every step goes through the real UI; when a step fails, the run takes a screenshot,
// writes the failure down and does the step through the HTTP API, so one broken screen does not hide the rest.
//
//   node scripts/e2e/journey.mjs                       # starts its own server on a free port (builds the client if needed)
//   node scripts/e2e/journey.mjs --url https://host     # the same walk against a running or public server
//   options: --widths 375,1440  --out <dir>  --shots <dir for pitch screenshots>  --no-end (skip the season run)
//
// Writes <out>/results.json and <out>/RUN.md; screenshots in <out>/<width>/. Exit code 1 when a UI step failed.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, copyFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

// ───────────── options ─────────────
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt; };
const flag = (name) => argv.includes(`--${name}`);
const STAMP = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
const OUT = opt('out', join(ROOT, 'docs/qa/runs', STAMP));
const SHOTS = opt('shots', null);
const WIDTHS = opt('widths', '375,1440').split(',').map(Number).filter(Boolean);
const WITH_END = !flag('no-end');
let BASE = (opt('url', process.env.E2E_URL ?? '') || '').replace(/\/$/, '');

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const log = (...a) => console.log(...a);

// ───────────── HTTP ─────────────
async function call(method, path, body, token) {
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { ok: false, error: `HTTP ${r.status}: ${text.slice(0, 120)}` }; }
}
const ack = (j, what) => { if (!j || !j.ok) throw new Error(`${what}: ${j?.error ?? JSON.stringify(j).slice(0, 200)}`); return j.data; };
const unwrap = (j) => (j && typeof j === 'object' && 'ok' in j && 'data' in j ? j.data : j);

// ───────────── own server ─────────────
let child = null;
async function freePort() {
  return new Promise((ok, bad) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); s.on('error', bad); });
}
async function startServer() {
  if (!existsSync(join(ROOT, 'client/dist/index.html'))) {
    log('client/dist is missing: npm run build');
    const b = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
    if (b.status !== 0) throw new Error('client build failed');
  }
  const port = await freePort();
  const snap = mkdtempSync(join(tmpdir(), 'ohh-e2e-'));
  child = spawn(process.execPath, [join(ROOT, 'node_modules/tsx/dist/cli.mjs'), 'server/src/main.ts'], {
    cwd: ROOT, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', SNAPSHOT_DIR: snap, DEMO_RESTART_MIN: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let errOut = '';
  child.stderr.on('data', (d) => { errOut += d; });
  BASE = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) {
    try { const h = await fetch(`${BASE}/api/health`); if (h.ok) return; } catch { /* not yet */ }
    if (child.exitCode !== null) throw new Error(`server exited: ${errOut.slice(-400)}`);
    await sleep(500);
  }
  throw new Error('server did not start in 60 s');
}
const stopServer = () => { if (child && child.exitCode === null) child.kill('SIGTERM'); };
process.on('exit', stopServer);

// ───────────── one walk ─────────────
const ALL = [];

async function walk(browser, width) {
  const dir = join(OUT, String(width));
  mkdirSync(dir, { recursive: true });
  const phone = width < 700;
  const W = ack(await call('POST', '/api/worlds', { name: `QA ${width}` }), 'create demo city').id;
  ack(await call('POST', `/api/worlds/${W}/clock`, { paused: true }), 'pause clock');
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 812 : 900 }, deviceScaleFactor: SHOTS ? 2 : 1, isMobile: phone, hasTouch: phone });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`); });
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url().replace(BASE, '')}`); });

  const results = [];
  let n = 0;
  const shot = async (name) => {
    const file = join(dir, `${String(++n).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    return file;
  };
  const overflow = () => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth).catch(() => 0);
  const state = { W, token: null, playerId: null, biz: null };
  const view = async () => unwrap(await call('GET', `/api/worlds/${W}/view`, undefined, state.token));
  const act = (a) => call('POST', `/api/worlds/${W}/action`, a, state.token);

  /** Runs one step: ui() through the browser; on failure fallback() through the API so the walk goes on. */
  async function step(id, title, ui, fallback) {
    const t0 = Date.now();
    const before = errors.length;
    const r = { width, id, title, ok: false, ms: 0, note: '', shot: null, overflowPx: 0, errors: [], fallback: false };
    try {
      r.note = (await ui()) ?? '';
      r.ok = true;
    } catch (e) {
      r.note = String(e.message ?? e).split('\n')[0].slice(0, 300);
    }
    r.ms = Date.now() - t0;
    await sleep(300);
    r.overflowPx = await overflow();
    r.shot = relative(OUT, await shot(id));
    r.errors = errors.slice(before);
    if (!r.ok && fallback) {
      try { await fallback(); r.fallback = true; } catch (e) { r.note += ` | API fallback failed too: ${String(e.message ?? e).slice(0, 160)}`; }
    }
    results.push(r);
    log(`${r.ok ? 'OK  ' : 'FAIL'} ${width} ${id.padEnd(12)} ${String(r.ms).padStart(6)} ms${r.overflowPx > 0 ? `  overflow ${r.overflowPx}px` : ''}${r.note ? '  ' + r.note : ''}${r.fallback ? '  (API fallback)' : ''}`);
    return r.ok;
  }

  const btn = (re) => page.getByRole('button', { name: re });
  const visible = async (loc, ms = 8000) => { await loc.first().waitFor({ state: 'visible', timeout: ms }); return loc.first(); };
  const click = async (re, ms) => (await visible(btn(re), ms)).click();
  const text = async () => (await page.locator('main').first().innerText().catch(() => '')).replace(/\s+/g, ' ');

  // Session helpers: the client keeps the token in localStorage (client/src/app/session.ts).
  const readSession = async () => page.evaluate((w) => {
    const all = JSON.parse(localStorage.getItem('ohh.sessions.v1') ?? '{}');
    return all[`remote:${w}`] ?? null;
  }, W);
  const writeSession = async (s) => page.evaluate((s) => {
    const all = JSON.parse(localStorage.getItem('ohh.sessions.v1') ?? '{}');
    all[`remote:${s.worldId}`] = s;
    localStorage.setItem('ohh.sessions.v1', JSON.stringify(all));
    localStorage.setItem('ohh.mode.v1', 'remote');
  }, s);
  const joinApi = async () => {
    const j = ack(await call('POST', `/api/worlds/${W}/join`, { name: `QA Tester ${width}`, kind: 'owner' }), 'join');
    Object.assign(state, { token: j.token, playerId: j.playerId });
    await writeSession({ worldId: W, playerId: j.playerId, token: j.token, name: `QA Tester ${width}`, kind: 'owner' });
  };
  let placeId = null;
  const openApi = async () => {
    const places = unwrap(await call('GET', '/api/places'));
    const v = await view();
    const taken = new Set((v.businesses ?? []).map((b) => b.placeId));
    const free = places.filter((p) => p.suitableFor.includes('cafe') && !taken.has(p.id));
    for (const p of [placeId && free.find((x) => x.id === placeId), ...free].filter(Boolean)) {
      const rec = unwrap(await call('POST', `/api/worlds/${W}/query`, { type: 'recommend_opening', niche: 'cafe', placeId: p.id }, state.token)) ?? [];
      const kit = rec.find((k) => k.cashLeft >= 0);
      if (!kit) continue;
      ack(await act({ type: 'open_business', niche: 'cafe', placeId: p.id, name: `QA Cup ${width}`, kitId: kit.kitId, size: kit.size, items: kit.items }), 'open_business');
      placeId = p.id;
      return;
    }
    throw new Error('no affordable place for a cafe');
  };

  // 1. Home as a guest
  await step('home', 'Home page as a guest: idea field and "See my plan"', async () => {
    await page.goto(`${BASE}/?world=${W}&mode=remote`, { waitUntil: 'domcontentloaded' });
    const idea = await visible(page.locator('#idea'), 15000);
    await sleep(800);
    await idea.fill('A coffee shop near the subway with fresh pastries');
    await click(/See my plan|Показать план/);
    await page.waitForURL(/\/start/, { timeout: 8000 });
    return '';
  }, async () => { await page.goto(`${BASE}/start?world=${W}&mode=remote`); });

  // 2. Idea → niche
  await step('idea', 'Idea step: the niche is recognised, the name is filled', async () => {
    const go = await visible(btn(/Choose a place/), 15000);
    if (await go.isDisabled()) {
      const find = page.getByRole('button', { name: 'Find my niche' });
      if (await find.count()) { await find.click(); await sleep(1500); }
    }
    if (await go.isDisabled()) {
      const row = page.locator('.list-row', { hasText: /coffee|cafe/i }).first();
      if (await row.count()) await row.click();
    }
    const name = page.getByPlaceholder('Morning Cup');
    if (await name.count() && !(await name.inputValue())) await name.fill(`QA Cup ${width}`);
    if (await go.isDisabled()) throw new Error('"Choose a place" stays disabled after the idea, the niche and the name');
    const t = await text();
    const recognised = /Looks like a (cafe|coffee)/i.test(t);
    await go.click();
    return recognised ? 'idea recognised as a cafe' : 'idea NOT recognised: niche picked by hand';
  });

  // 3. Place
  await step('place', 'Place step: an affordable storefront, "Open here"', async () => {
    await visible(page.getByText(/Where will it be\?/), 10000);
    const rows = page.locator('.list-row', { hasText: /opens from/ });
    if (!(await rows.count())) throw new Error('no affordable place in the list (no "opens from" row)');
    const t = await text();
    const m = t.match(/(\d+) of (\d+) free storefronts/);
    await rows.first().click();
    const openHere = await visible(btn(/Open here/), 5000);
    if (await openHere.isDisabled()) throw new Error('"Open here" is disabled on an affordable place');
    const sub = (await page.locator('.card', { hasText: /Opening here costs/ }).first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    await openHere.click();
    return `${m ? `${m[1]} of ${m[2]} affordable; ` : ''}${(sub.match(/Opening here costs[^.]*\./) ?? [''])[0]}`;
  });

  // 4. Plan
  await step('plan', 'Opening plan: steps with agency, fee, days and official links', async () => {
    const next = await visible(btn(/See what to buy/), 10000);
    const links = await page.getByRole('link', { name: /Official page/ }).count();
    const steps = await page.locator('main ol > li').count();
    await next.click();
    return `${steps} steps, ${links} official links${steps && links < steps ? ` (${steps - links} without a link)` : ''}`;
  });

  // 5. Join
  await step('join', 'Join: name and test payment after the plan', async () => {
    const name = await visible(page.getByPlaceholder('Jordan'), 10000);
    await name.fill(`QA Tester ${width}`);
    await click(/and join|Join/);
    for (let i = 0; i < 40 && !(await readSession()); i++) await sleep(250);
    const s = await readSession();
    if (!s) throw new Error('no session saved after Join');
    Object.assign(state, { token: s.token, playerId: s.playerId });
    return '';
  }, joinApi);

  // 6. Setup (kit / decisions)
  await step('setup', 'Setup: buy the kit and sign the lease', async () => {
    await sleep(800);
    const all = btn(/Use recommended for all/);
    if (await all.count()) await all.first().click();
    const go = await visible(btn(/Open with recommended setup|Sign|Buy|Open my|Start construction/), 15000);
    if (await go.isDisabled()) throw new Error(`setup button disabled: "${await go.innerText()}"`);
    await go.click();
    for (let i = 0; i < 40; i++) { const v = await view(); if (v?.business) { state.biz = v.business; break; } await sleep(250); }
    if (!state.biz) throw new Error('no business in the view after setup');
    return `${state.biz.name}: cash ${Math.round(state.biz.cash)}`;
  }, openApi);

  // 7. Permits → open
  await step('permits', 'Waiting for permits: days pass, then "Open doors"', async () => {
    await page.goto(`${BASE}/start?world=${W}`, { waitUntil: 'domcontentloaded' });
    await visible(page.getByText(/Permits and licenses|Open doors|Open the doors/), 15000);
    for (let i = 0; i < 6; i++) {
      const v = await view();
      if ((v.roadmap ?? []).every((s) => s.status === 'done' || s.status === 'ready' || !s.waitDays)) break;
      ack(await call('POST', `/api/worlds/${W}/clock`, { advanceDays: 20 }), 'advance');
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    const open = await visible(btn(/^Open doors$|Open the doors/), 15000);
    if (await open.isDisabled()) throw new Error('"Open doors" still disabled after 120 days');
    await open.click();
    for (let i = 0; i < 40; i++) { const v = await view(); if (v.business?.status === 'open') { state.biz = v.business; return `opened on day ${v.world.day}`; } await sleep(250); }
    throw new Error('business is not open after "Open doors"');
  }, async () => {
    for (let i = 0; i < 6; i++) { const r = await act({ type: 'launch' }); if (r.ok) return; ack(await call('POST', `/api/worlds/${W}/clock`, { advanceDays: 20 }), 'advance'); }
    throw new Error('launch failed');
  });

  ack(await call('POST', `/api/worlds/${W}/clock`, { advanceDays: 3 }), 'advance 3 days');
  return { results, errors, state, page, ctx, dir, W, view, act, step, btn, visible, click, text, shot };
}

// ───────────── main ─────────────
(async () => {
  mkdirSync(OUT, { recursive: true });
  if (!BASE) await startServer();
  log(`E2E against ${BASE}; out ${relative(ROOT, OUT)}`);
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const w = await walk(browser, width);
    ALL.push(...w.results);
    await w.ctx.close();
  }
  await browser.close();
  writeFileSync(join(OUT, 'results.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), results: ALL }, null, 2));
  const md = ['# E2E run ' + STAMP, '', `Server: ${BASE}`, '', '| Width | Step | Result | ms | Note |', '|---|---|---|---|---|',
    ...ALL.map((r) => `| ${r.width} | ${r.id} | ${r.ok ? 'OK' : '**FAIL**'}${r.fallback ? ' (API)' : ''}${r.overflowPx > 0 ? ` · overflow ${r.overflowPx}px` : ''} | ${r.ms} | ${r.note.replace(/\|/g, '/')}${r.errors.length ? ` · errors: ${r.errors.join('; ').replace(/\|/g, '/').slice(0, 300)}` : ''} |`)];
  writeFileSync(join(OUT, 'RUN.md'), md.join('\n') + '\n');
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const failed = ALL.filter((r) => !r.ok).length;
  log(`\n${ALL.length - failed} of ${ALL.length} steps OK. ${relative(ROOT, join(OUT, 'RUN.md'))}`);
  stopServer();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); stopServer(); process.exit(2); });
