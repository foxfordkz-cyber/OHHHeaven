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

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

// ───────────── options ─────────────
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt; };
const flag = (name) => argv.includes(`--${name}`);
// --root <checkout>: the game (server + client) from another checkout, e.g. a worktree of the integrator branch.
const ROOT = opt('root', HERE);
const STAMP = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '-');
const OUT = opt('out', join(HERE, 'docs/qa/runs', STAMP));
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
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url().replace(BASE, '').slice(0, 160)} (${r.failure()?.errorText ?? ''})`));
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url().replace(BASE, '')}`); });

  const results = [];
  let n = 0;
  let took = false;
  const shot = async (name) => {
    took = true;
    const file = join(dir, `${String(++n).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    // Pitch screenshots: what the player sees on the screen (no full page), retina, stable names.
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `${phone ? 'phone' : 'desktop'}-${name}.png`) }).catch(() => {});
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
    took = false;
    try {
      r.note = (await ui()) ?? '';
      r.ok = true;
    } catch (e) {
      r.note = String(e.message ?? e).split('\n')[0].slice(0, 300);
    }
    r.ms = Date.now() - t0;
    await sleep(700); // screens fade in: a shot taken at once is blank
    r.overflowPx = await overflow();
    // A step shoots its screen itself once it is ready (before the click that leaves it); a failed step also shoots where it stopped.
    if (!took || !r.ok) r.shot = relative(OUT, await shot(r.ok ? id : `${id}-FAIL`));
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
    await shot('home');
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
    await shot('idea');
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
    await sleep(500);
    await shot('place');
    await openHere.click();
    return `${m ? `${m[1]} of ${m[2]} affordable; ` : ''}${(sub.match(/Opening here costs[^.]*\./) ?? [''])[0]}`;
  });

  // 4. Plan
  await step('plan', 'Opening plan: steps with agency, fee, days and official links', async () => {
    const next = await visible(btn(/See what to buy/), 10000);
    const links = await page.getByRole('link', { name: /Official page/ }).count();
    const steps = await page.locator('main ol > li').count();
    const head = (await text()).match(/Longest wait \S+ \S+/)?.[0] ?? '';
    await sleep(500);
    await shot('plan');
    await next.click();
    return `${steps} steps, ${links} official links${steps && links < steps ? ` (${steps - links} without a link)` : ''}${head ? `; header "${head}"` : ''}`;
  });

  // 5. Join
  await step('join', 'Join: name and test payment after the plan', async () => {
    const name = await visible(page.getByPlaceholder('Jordan'), 10000);
    await name.fill(`QA Tester ${width}`);
    await shot('join');
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
    const verdict = (await text()).match(/Even with[^—]*—[^.]*|this loses \$[\d,]+\/month[^.]*/)?.[0] ?? '';
    await sleep(500);
    await shot('setup');
    await go.click();
    for (let i = 0; i < 40; i++) { const v = await view(); if (v?.business) { state.biz = v.business; break; } await sleep(250); }
    if (!state.biz) throw new Error('no business in the view after setup');
    return `${state.biz.name}: cash ${Math.round(state.biz.cash)}${verdict ? `; setup card says: "${verdict.slice(0, 120)}"` : ''}`;
  }, openApi);

  // 7. Permits → open. Days go by 5 at a time, like a player who comes back every few days.
  let signedDay = (await view())?.world?.day ?? 0;
  await step('permits', 'Waiting for permits: days pass, then "Open doors"', async () => {
    await page.goto(`${BASE}/start?world=${W}`, { waitUntil: 'domcontentloaded' });
    await visible(page.getByText(/Permits and licenses|Open doors|Open the doors|Ready to open/), 15000);
    await sleep(800);
    const waitText = await text();
    await shot('permits');
    let opened = false;
    for (let i = 0; i < 40 && !opened; i++) {
      const open = btn(/^Open doors$|^Open the doors$/);
      if (await open.count() && !(await open.first().isDisabled())) {
        await open.first().click();
        for (let k = 0; k < 20; k++) { const v = await view(); if (v.business?.status === 'open') { opened = true; break; } await sleep(250); }
        if (opened) break;
      }
      ack(await call('POST', `/api/worlds/${W}/clock`, { advanceDays: 5 }), 'advance');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sleep(600);
    }
    const v = await view();
    if (!opened) throw new Error(`not open after 200 days of waiting (day ${v.world.day})`);
    state.biz = v.business;
    const rentNote = (waitText.match(/Rent keeps running[^.]*\./) ?? [''])[0];
    return `signed day ${signedDay}, opened day ${v.world.day} (${v.world.day - signedDay} days of rent before the first sale); cash ${Math.round(v.business.cash)}${rentNote ? '' : '; no rent warning on screen'}`;
  }, async () => {
    for (let i = 0; i < 40; i++) { const r = await act({ type: 'launch' }); if (r.ok) return; ack(await call('POST', `/api/worlds/${W}/clock`, { advanceDays: 5 }), 'advance'); }
    throw new Error('launch failed');
  });

  ack(await call('POST', `/api/worlds/${W}/clock`, { advanceDays: 3 }), 'advance 3 days');

  // 8. Business tabs: each opens, has content, no horizontal scroll
  const dismissAway = async () => {
    const away = page.getByRole('dialog', { name: 'While you were away' });
    // The card comes a moment after the view loads; a click under it hangs until it is closed.
    for (let i = 0; i < 8 && !(await away.count()); i++) await sleep(250);
    if (await away.count()) { await away.getByRole('button', { name: /Got it/ }).click({ timeout: 5000 }).catch(() => {}); await sleep(250); }
  };
  await step('biz', 'My business opens after the doors open (first sales)', async () => {
    await page.goto(`${BASE}/biz?world=${W}`, { waitUntil: 'domcontentloaded' });
    await visible(page.getByRole('tablist', { name: 'My business' }), 15000);
    await sleep(500);
    const awayShown = await page.getByRole('dialog', { name: 'While you were away' }).count();
    if (awayShown) await shot('biz-away');
    await dismissAway();
    const tabs = await page.getByRole('tab').allInnerTexts();
    const v = await view();
    const sold = v.business?.today ?? v.business?.lastDay ?? null;
    return `tabs: ${tabs.map((t) => t.replace(/\s+/g, ' ').trim()).join(', ')}${awayShown ? '; "While you were away" shown' : ''}${sold ? `; last day ${JSON.stringify(sold).slice(0, 80)}` : ''}`;
  });
  for (const tab of ['Today', 'Manage', 'Books', 'Network', 'Insights']) {
    await step(`tab-${tab.toLowerCase()}`, `Tab ${tab}: opens and shows its content`, async () => {
      await dismissAway();
      const t = page.getByRole('tab', { name: new RegExp(`^${tab}`) });
      if (!(await t.count())) throw new Error(`no tab "${tab}"`);
      await t.first().click();
      await sleep(900);
      const panel = page.getByRole('tabpanel').first();
      const body = ((await panel.innerText().catch(() => '')) || (await text())).replace(/\s+/g, ' ');
      if (body.length < 40) throw new Error(`tab "${tab}" is almost empty: "${body}"`);
      if (/on its way|Coming soon/i.test(body)) throw new Error(`tab "${tab}" is a placeholder: "${body.slice(0, 120)}"`);
      const buttons = await panel.locator('button:not([disabled]), input:not([disabled]), select:not([disabled])').count();
      return `${body.length} chars, ${buttons} enabled controls; starts: "${body.slice(0, 110)}"`;
    });
  }

  // 9. Manage: change the price, see the forecast before saving, save, see it on the next day
  await step('whatif', 'Manage: price +$0.50 → forecast changes before saving → Save settings → next day uses it', async () => {
    await dismissAway();
    await page.getByRole('tab', { name: /^Manage/ }).first().click({ timeout: 8000 });
    // The business screen draws cards with its own copy of the kit (section.bz-card > h3), the rest of the app with client/src/ui (.card__title).
    const fc = page.locator('section.bz-card, div.card').filter({ has: page.locator('h3, .card__title', { hasText: /^Projected month/ }) }).last();
    await visible(fc, 10000);
    for (let i = 0; i < 20 && /Counting/.test(await fc.innerText()); i++) await sleep(300);
    const before = (await fc.innerText()).replace(/\s+/g, ' ');
    const priceBefore = (await view()).business.orders.price;
    const inc = page.getByRole('button', { name: /^(More|Increase) price$/ }).first(); // business stub kit says "More", client/src/ui says "Increase"
    for (let i = 0; i < 5; i++) await inc.click();
    await visible(page.getByText(/Projected month with your changes/), 5000);
    let after = before;
    for (let i = 0; i < 20; i++) { await sleep(300); after = (await fc.innerText()).replace(/\s+/g, ' '); if (after !== before && !/updating/.test(after)) break; }
    if (after === before) throw new Error('forecast did not change after +$0.50');
    await shot('whatif-before-save');
    await click(/Save settings/);
    await sleep(800);
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    const banner = body.match(/Saved\.[^.]*\./)?.[0] ?? '';
    const v1 = await view();
    const priceAfter = v1.business.orders.price;
    if (Math.abs(priceAfter - priceBefore - 0.5) > 0.01) throw new Error(`price in the engine ${priceBefore} → ${priceAfter}, expected +0.50`);
    ack(await call('POST', `/api/worlds/${W}/clock`, { advanceDays: 1 }), 'advance');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissAway();
    await page.getByRole('tab', { name: /^Today/ }).first().click({ timeout: 8000 }).catch(() => {});
    await sleep(800);
    const today = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    const shown = today.includes(priceAfter.toFixed(2));
    return `price ${priceBefore.toFixed(2)} → ${priceAfter.toFixed(2)}; forecast "${before.slice(0, 70)}" → "${after.slice(0, 70)}"; after save: "${banner.slice(0, 80)}"; next day Today ${shown ? 'shows' : 'does NOT show'} the new price`;
  }, async () => { await act({ type: 'set_orders', orders: { price: (await view()).business.orders.price + 0.5 } }); });

  // 10. A neighbour (through the API), a deal and a report from the Network tab
  const rival = { name: `Rival Cuts ${width}` };
  {
    const j = ack(await call('POST', `/api/worlds/${W}/join`, { name: `Rival ${width}`, kind: 'owner' }), 'join rival');
    rival.token = j.token;
    const places = unwrap(await call('GET', '/api/places'));
    const me = places.find((p) => p.id === state.biz.placeId);
    const taken = new Set(((await view()).businesses ?? []).map((b) => b.placeId));
    const dist = (a, b) => Math.hypot((a.lat - b.lat) * 111000, (a.lng - b.lng) * 84000);
    const near = places.filter((p) => !taken.has(p.id) && p.suitableFor.includes('barbershop')).sort((a, b) => dist(a, me) - dist(b, me));
    for (const p of near.slice(0, 15)) {
      const rec = unwrap(await call('POST', `/api/worlds/${W}/query`, { type: 'recommend_opening', niche: 'barbershop', placeId: p.id }, rival.token)) ?? [];
      const kit = rec.find((k) => k.cashLeft >= 0) ?? rec[0];
      if (!kit) continue;
      const r = await call('POST', `/api/worlds/${W}/action`, { type: 'open_business', niche: 'barbershop', placeId: p.id, name: rival.name, kitId: kit.kitId, size: kit.size, items: kit.items }, rival.token);
      if (r.ok) { rival.place = p; rival.m = Math.round(dist(p, me)); break; }
    }
    for (let i = 0; i < 40 && rival.place; i++) { const r = await call('POST', `/api/worlds/${W}/action`, { type: 'launch' }, rival.token); if (r.ok) break; await call('POST', `/api/worlds/${W}/clock`, { advanceDays: 5 }); }
    rival.biz = unwrap(await call('GET', `/api/worlds/${W}/view`, undefined, rival.token))?.business;
  }
  await step('deal', `Network: propose a cross-promo to a neighbour (${rival.m ?? '?'} m away), the neighbour accepts`, async () => {
    if (!rival.biz) throw new Error('no neighbour could open nearby (setup through the API)');
    await page.goto(`${BASE}/biz/network?world=${W}`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await dismissAway();
    await page.getByRole('button', { name: new RegExp(rival.name) }).first().click({ timeout: 10000 });
    await click(/Propose a deal|Team up/, 5000);
    const sheet = page.getByRole('dialog', { name: new RegExp(`Deal with ${rival.name}|${rival.name}`) }).last();
    await sheet.getByRole('radio', { name: /Cross-promo/ }).first().click({ timeout: 5000 });
    await shot('deal-sheet');
    await sheet.getByRole('button', { name: /Send offer|Send|Propose/ }).first().click();
    await sleep(800);
    const deal = ((await view()).deals ?? []).find((d) => d.toBusinessId === rival.biz.id && d.status === 'proposed');
    if (!deal) throw new Error('the offer did not reach the engine');
    const acc = await call('POST', `/api/worlds/${W}/action`, { type: 'answer_deal', dealId: deal.id, accept: true }, rival.token);
    await page.keyboard.press('Escape').catch(() => {});
    const st = ((await view()).deals ?? []).find((d) => d.id === deal.id)?.status;
    return `deal ${deal.id} ${JSON.stringify(deal.terms).slice(0, 80)}; neighbour answer ${acc.ok ? 'ok' : acc.error}; status ${st}`;
  });
  await step('report', 'Network: report the neighbour to the city, the case reaches an inspector', async () => {
    if (!rival.biz) throw new Error('no neighbour to report');
    await page.goto(`${BASE}/biz/network?world=${W}`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await dismissAway();
    const region = page.getByRole('region', { name: 'Report to the city' });
    if (await region.count()) await region.getByRole('button', { name: /Report/ }).first().click();
    else { await page.getByRole('button', { name: new RegExp(rival.name) }).first().click(); await click(/Report/, 5000); }
    const rs = page.getByRole('dialog', { name: /Report/ }).last();
    const combo = rs.getByRole('combobox', { name: 'Business' });
    if (await combo.count()) await combo.selectOption(rival.biz.id);
    const radio = rs.locator('input[type="radio"]');
    if (await radio.count()) await radio.first().check();
    await shot('report-sheet');
    await rs.getByRole('button', { name: /Send report|Send|Report/ }).last().click();
    await sleep(800);
    const o = ack(await call('POST', `/api/worlds/${W}/join`, { name: `Inspector ${width}`, kind: 'official', role: 'inspector' }), 'join official');
    const q = unwrap(await call('GET', `/api/worlds/${W}/view`, undefined, o.token))?.queue ?? [];
    const c = q.find((x) => x.business?.id === rival.biz.id);
    if (!c) throw new Error('report sent, but no case for the neighbour in the inspector queue');
    return `case in the inspector queue: ${String(c.id ?? '')} ${String(c.origin ?? '')} ${String(c.violationId ?? c.reportId ?? '')}`.trim();
  });

  // 11. A month passes: the month report shows in Books
  await step('month', 'A month passes: the month report appears in Books', async () => {
    ack(await call('POST', `/api/worlds/${W}/clock`, { advanceDays: 32 }), 'advance');
    await page.goto(`${BASE}/biz?world=${W}`, { waitUntil: 'domcontentloaded' });
    await visible(page.getByRole('tablist', { name: 'My business' }), 15000);
    await sleep(600);
    if (await page.getByRole('dialog', { name: 'While you were away' }).count()) await shot('month-away');
    await dismissAway();
    await page.getByRole('tab', { name: /^Books/ }).first().click();
    await sleep(800);
    const v = await view();
    const h = v.business?.history ?? [];
    if (!h.length) throw new Error('no month in business.history after 32 days');
    const last = h[h.length - 1];
    return `${h.length} month(s); last: revenue ${Math.round(last.revenue ?? 0)}, profit ${Math.round(last.profit ?? 0)}, cash ${Math.round(v.business.cash)}; status ${v.business.status}`;
  });

  // 12. End of season → debrief → personal plan
  if (WITH_END) {
    await step('end', 'Season ends: place, debrief and "Open my plan"', async () => {
      for (let i = 0; i < 10; i++) {
        const v = await view();
        if (v.world.phase !== 'running') break;
        ack(await call('POST', `/api/worlds/${W}/clock`, { advanceDays: 60 }), 'advance');
      }
      const v = await view();
      if (v.world.phase === 'running') throw new Error(`season still running on day ${v.world.day}`);
      await page.goto(`${BASE}/end?world=${W}`, { waitUntil: 'domcontentloaded' });
      await visible(btn(/Open my plan/), 15000);
      await sleep(600);
      const t = await text();
      return `phase ${v.world.phase}, day ${v.world.day}; business ${v.business?.status ?? 'none'}; "${t.slice(0, 120)}"`;
    });
    await step('plan-final', 'Personal plan: budget, monthly costs, documents with links, suppliers, print', async () => {
      await click(/Open my plan/);
      const art = await visible(page.getByRole('article', { name: 'Your real-world plan' }), 15000);
      await sleep(600);
      const t = (await art.innerText()).replace(/\s+/g, ' ');
      const links = await art.locator('a[href^="http"]').count();
      const print = await btn(/Print/).count();
      const generic = ['about 800 sq ft', '$22,000 in prime Manhattan'].filter((g) => t.includes(g));
      return `${t.length} chars, ${links} outside links, print button ${print ? 'yes' : 'NO'}${generic.length ? `; generic text: ${generic.join(', ')}` : ''}`;
    });
  }

  return { results, errors, state, page, ctx, dir, W };
}

// ───────────── main ─────────────
(async () => {
  mkdirSync(OUT, { recursive: true });
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  if (!BASE) await startServer();
  log(`E2E against ${BASE}${ROOT !== HERE ? ` (game from ${ROOT})` : ''}; out ${relative(HERE, OUT)}`);
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
  const failed = ALL.filter((r) => !r.ok).length;
  log(`\n${ALL.length - failed} of ${ALL.length} steps OK. ${relative(HERE, join(OUT, 'RUN.md'))}`);
  stopServer();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); stopServer(); process.exit(2); });
