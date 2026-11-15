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
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HERE, ack, api, chromium, flag, opt, sleep, stamp, startServer, unwrap } from './lib.mjs';

// ───────────── options ─────────────
// --root <checkout>: the game (server + client) from another checkout, e.g. a worktree of the integrator branch.
const ROOT = opt('root', HERE);
const STAMP = stamp();
const OUT = opt('out', join(HERE, 'docs/qa/runs', STAMP));
const SHOTS = opt('shots', null);
const WIDTHS = opt('widths', '375,1440').split(',').map(Number).filter(Boolean);
// Against a deployed server the season is not run to the end unless --end is given: an ended demo city is restarted by the
// server ten minutes later as a running one, with bots, and stays among the 20 allowed (BUGS.md, №15). A paused city costs nothing.
const REMOTE = Boolean(opt('url', process.env.E2E_URL ?? ''));
const WITH_END = REMOTE ? flag('end') : !flag('no-end');
// --scheme dark: the system theme of the browser (the app follows prefers-color-scheme).
const SCHEME = opt('scheme', 'light');
// Names a player would type: they show up in screenshots for the deck. Each run has its own city, so they never clash.
const PLAYER = opt('name', 'Jordan');
const RIVAL = 'Sam\'s Cuts';
const base = { url: (opt('url', process.env.E2E_URL ?? '') || '').replace(/\/$/, '') };
// A server started with CLOCK_KEY takes clock commands (pause, advance) only with the key.
const { call } = api(base, opt('key', process.env.CLOCK_KEY ?? ''));
const log = (...a) => console.log(...a);
let server = null;
const stopServer = () => server?.stop();

// ───────────── one walk ─────────────
const ALL = [];

async function walk(browser, width) {
  const dir = join(OUT, String(width));
  mkdirSync(dir, { recursive: true });
  const phone = width < 700;
  const W = ack(await call('POST', '/api/worlds', { name: 'Demo City' }), 'create demo city').id;
  ack(await call('POST', `/api/worlds/${W}/clock`, { paused: true }), 'pause clock');
  // Retina only on the phone: a full-page 2× shot of the desktop home stretches the WebGL map to ~2880×6000 and headless
  // Chromium (software GL) stops drawing the page. A test artifact, not a player's problem; desktop shots stay 1×.
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 812 : 900 }, deviceScaleFactor: SHOTS && phone ? 2 : 1, isMobile: phone, hasTouch: phone, colorScheme: SCHEME });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`); });
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url().replace(base.url, '').slice(0, 160)} (${r.failure()?.errorText ?? ''})`));
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url().replace(base.url, '')}`); });

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
    const j = ack(await call('POST', `/api/worlds/${W}/join`, { name: PLAYER, kind: 'owner' }), 'join');
    Object.assign(state, { token: j.token, playerId: j.playerId });
    await writeSession({ worldId: W, playerId: j.playerId, token: j.token, name: PLAYER, kind: 'owner' });
  };
  let placeId = null;
  const openApi = async () => {
    const places = unwrap(await call('GET', '/api/places'));
    const v = await view();
    const taken = new Set((v.businesses ?? []).map((b) => b.placeId));
    const free = places.filter((p) => p.suitableFor.includes('cafe') && !taken.has(p.id));
    for (const p of [placeId && free.find((x) => x.id === placeId), ...free].filter(Boolean)) {
      const rec = unwrap(await call('POST', `/api/worlds/${W}/query`, { type: 'recommend_opening', niche: 'cafe', placeId: p.id }, state.token)) ?? [];
      // The standard kit first: recommend_opening also offers kits that open_business refuses (BUGS.md, №12).
      const kit = [...rec].sort((a, b) => (a.kitId === 'standard' ? -1 : 0) - (b.kitId === 'standard' ? -1 : 0)).find((k) => k.cashLeft >= 0);
      if (!kit) continue;
      ack(await act({ type: 'open_business', niche: 'cafe', placeId: p.id, name: 'Morning Cup', kitId: kit.kitId, size: kit.size, items: kit.items }), 'open_business');
      placeId = p.id;
      return;
    }
    throw new Error('no affordable place for a cafe');
  };

  // 1. Home as a guest
  await step('home', 'Home page as a guest: idea field and "See my plan"', async () => {
    await page.goto(`${base.url}/?world=${W}&mode=remote`, { waitUntil: 'domcontentloaded' });
    const idea = await visible(page.locator('#idea'), 15000);
    await sleep(800);
    // --scheme dark also presses the app's own theme button: the app does not follow the system theme by itself.
    if (SCHEME === 'dark') { const t = page.getByRole('button', { name: /Switch to the dark theme/ }); if (await t.count()) { await t.first().click(); await sleep(500); } }
    await shot('home');
    await idea.fill('A coffee shop near the subway with fresh pastries');
    await click(/See my plan|Показать план/);
    await page.waitForURL(/\/start/, { timeout: 8000 });
    return '';
  }, async () => { await page.goto(`${base.url}/start?world=${W}&mode=remote`); });

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
    if (await name.count() && !(await name.inputValue())) await name.fill('Morning Cup');
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
    const rows = page.locator('.list-row').filter({ hasNotText: /Over budget/ });
    if (!(await rows.count())) throw new Error('no affordable place in the list (every row is "Over budget")');
    const t = await text();
    const m = t.match(/(\d+) of (\d+) free storefronts/);
    await rows.first().click();
    const openHere = await visible(btn(/Open here/), 5000);
    if (await openHere.isDisabled()) throw new Error('"Open here" is disabled on an affordable place');
    const rowText = (await rows.first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    const sub = (await page.locator('.card', { hasText: /Opening here costs/ }).first().innerText().catch(() => '')).replace(/\s+/g, ' ') || rowText;
    await sleep(500);
    await shot('place');
    await openHere.click();
    return `${m ? `${m[1]} of ${m[2]} affordable; ` : ''}${(sub.match(/Opening here costs[^.]*\./) ?? [sub.slice(0, 140)])[0]}`;
  });

  // 4. Plan
  await step('plan', 'Opening plan: steps with agency, fee, days and official links', async () => {
    const next = await visible(btn(/See what to buy|Go on with this address/), 10000);
    const t = await text();
    const links = await page.getByRole('link', { name: /Official page/ }).count();
    // The first plan is a list of steps; after B07 it is grouped by day and a day opens on a tap.
    const steps = Number(t.match(/Steps (\d+)/)?.[1] ?? 0) || await page.locator('main ol > li').count();
    const head = t.match(/Longest wait \S+ \S+|\d+ days from the lease to open doors/)?.[0] ?? '';
    await sleep(500);
    await shot('plan');
    await next.click();
    return `${steps} steps, ${links} official links on screen without a tap${head ? `; header "${head}"` : ''}`;
  });

  // 5. Join
  await step('join', 'Join: name and test payment after the plan', async () => {
    const name = await visible(page.getByPlaceholder('Jordan'), 10000);
    await name.fill(PLAYER);
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
    let walked = '';
    const cash = page.locator('[data-testid="dx-cash"]');
    if (await cash.count()) {
      // One card per decision: take a non-recommended, lawful option on the first card that has options and check that
      // the numbers on top move (decision → consequence); take the recommended option on the others.
      const monthly = page.locator('[data-testid="dx-monthly"]');
      let cards = 0; let moved = null; let firstShot = false; let nextOnScreen = null;
      for (let i = 0; i < 30; i++) {
        const card = page.locator('section.dx-card');
        if (!(await card.count())) break;
        cards++;
        const title = ((await card.first().locator('h1').first().innerText().catch(() => '')) || '').trim();
        const radios = card.first().getByRole('radio');
        const nr = await radios.count();
        if (nr) {
          let rec = -1; const lawful = [];
          for (let k = 0; k < nr; k++) {
            const t = await radios.nth(k).innerText();
            if (/Recommended/.test(t)) rec = k;
            if (!/Breaks the law/.test(t)) lawful.push(k);
          }
          const other = lawful.find((k) => k !== rec);
          const pick = moved === null && other !== undefined ? other : (rec >= 0 ? rec : lawful[0] ?? 0);
          const c0 = await cash.innerText(); const m0 = await monthly.innerText().catch(() => '');
          await radios.nth(pick).click();
          await sleep(350);
          const c1 = await cash.innerText(); const m1 = await monthly.innerText().catch(() => '');
          if (moved === null && pick !== rec) {
            moved = c1 !== c0 || m1 !== m0 ? `"${title}": cash left ${c0} → ${c1}, bills ${m0} → ${m1}` : `"${title}": NOTHING moved on top`;
            await shot('setup-choice'); firstShot = true;
            if (pick !== rec && rec >= 0) { await radios.nth(rec).click(); await sleep(200); } // back to the recommended one
          }
        } else {
          const chip = card.first().locator('.dx-recchip');
          if (await chip.count()) await chip.first().click();
        }
        const next = page.getByRole('button', { name: /^Next|See what it adds up to/ });
        if (!(await next.count())) break;
        // The action bar is meant to stick to the bottom of the screen (BUGS.md, №16): is "Next" on screen without scrolling?
        if (cards === 1) { const b = await next.first().boundingBox(); const vh = page.viewportSize().height; nextOnScreen = b ? b.y + b.height <= vh : null; }
        if (await next.first().isDisabled()) {
          const rest = btn(/Use recommended for/);
          if (await rest.count()) await rest.first().click(); else throw new Error(`stuck on decision "${title}": Next is disabled`);
          await sleep(250);
          continue;
        }
        await next.first().click();
        await sleep(250);
      }
      if (!firstShot) await shot('setup-choice');
      walked = `${cards} decision cards; first own choice: ${moved ?? 'none had options'}${nextOnScreen === false ? '; "Next" is BELOW THE FOLD (sticky bar does not stick)' : nextOnScreen ? '; "Next" on screen' : ''}`;
    } else {
      const all = btn(/Use recommended for all/);
      if (await all.count()) await all.first().click();
    }
    // Exact names: the review lists every decision as a button too ("Sign and decor"), so a loose /Sign/ clicks the wrong one.
    const go = await visible(btn(/^(Open with recommended setup|Sign the lease|Start construction)/), 15000);
    if (await go.isDisabled()) throw new Error(`setup button disabled: "${await go.innerText()}"`);
    const verdict = (await text()).match(/Even with[^—]*—[^.]*|this loses \$[\d,]+\/month[^.]*/)?.[0] ?? '';
    await sleep(500);
    await shot('setup');
    await go.click();
    for (let i = 0; i < 40; i++) { const v = await view(); if (v?.business) { state.biz = v.business; break; } await sleep(250); }
    if (!state.biz) throw new Error('no business in the view after setup');
    return `${state.biz.name}: cash ${Math.round(state.biz.cash)}${walked ? `; ${walked}` : ''}${verdict ? `; setup card says: "${verdict.slice(0, 120)}"` : ''}`;
  }, openApi);

  // 7. Permits → open. Days go by 5 at a time, like a player who comes back every few days.
  let signedDay = (await view())?.world?.day ?? 0;
  await step('permits', 'Waiting for permits: days pass, then "Open doors"', async () => {
    await page.goto(`${base.url}/start?world=${W}`, { waitUntil: 'domcontentloaded' });
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
    const rentNote = (waitText.match(/Rent (keeps running|takes \$[\d,]+ a day)[^.]*\./) ?? [''])[0];
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
    await page.goto(`${base.url}/biz?world=${W}`, { waitUntil: 'domcontentloaded' });
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
      // Advice that promises a loss (BUGS.md, №2): an amount like "−$902/mo" on a card with "Apply".
      const negative = tab === 'Today' ? (body.match(/[−-]\$[\d,]+\/mo/g) ?? []) : [];
      return `${body.length} chars, ${buttons} enabled controls${negative.length ? `; ADVICE WITH A LOSS: ${negative.join(', ')}` : ''}; starts: "${body.slice(0, 110)}"`;
    });
  }

  // 9. Manage: change the price, see the forecast before saving, save, see it on the next day
  // The save button is "Save settings" in the first version and "Apply" after B08; it lives in the bottom bar.
  const saveBtn = () => page.locator('.bz-savebar').getByRole('button', { name: /Save settings|^Apply/ }).first();
  await step('whatif', 'Manage: price +$0.50 → forecast changes before saving → save → next day Today reports on it', async () => {
    await dismissAway();
    await page.getByRole('tab', { name: /^Manage/ }).first().click({ timeout: 8000 });
    // The business screen draws cards with its own copy of the kit (section.bz-card > h3), the rest of the app with client/src/ui (.card__title).
    const fc = page.locator('section.bz-card, div.card').filter({ has: page.locator('h3, .card__title', { hasText: /Projected month|Next 30 days|forecast/i }) }).first();
    await visible(fc, 10000);
    for (let i = 0; i < 20 && /Counting/.test(await fc.innerText()); i++) await sleep(300);
    const before = (await fc.innerText()).replace(/\s+/g, ' ');
    const priceBefore = (await view()).business.orders.price;
    const inc = page.getByRole('button', { name: /^(More|Increase) price$/ }).first(); // business stub kit says "More", client/src/ui says "Increase"
    for (let i = 0; i < 5; i++) await inc.click();
    let after = before;
    for (let i = 0; i < 20; i++) { await sleep(300); after = (await fc.innerText()).replace(/\s+/g, ' '); if (after !== before && !/updating/.test(after)) break; }
    if (after === before) throw new Error('forecast did not change after +$0.50');
    await shot('whatif-before-save');
    await saveBtn().click({ timeout: 5000 });
    await sleep(1000);
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    const banner = body.match(/(Saved\.|Applied|Changes? (start|from)|From (Mon|Tue|Wed|Thu|Fri|Sat|Sun))[^.]*\./)?.[0] ?? '';
    const v1 = await view();
    const priceAfter = v1.business.orders.price;
    if (Math.abs(priceAfter - priceBefore - 0.5) > 0.01) throw new Error(`price in the engine ${priceBefore} → ${priceAfter}, expected +0.50`);
    ack(await call('POST', `/api/worlds/${W}/clock`, { advanceDays: 1 }), 'advance');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissAway();
    await page.getByRole('tab', { name: /^Today/ }).first().click({ timeout: 8000 }).catch(() => {});
    await sleep(800);
    const today = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    // Where Today mentions the new price (an advice that quotes it does not count as "the change is visible").
    const money = `$${priceAfter.toFixed(2)}`;
    const hits = today.split(/(?<=[.!?])\s+/).filter((x) => x.includes(money));
    const shown = hits.length > 0;
    const yours = today.match(/Your change.{0,160}/)?.[0] ?? '';
    return `${yours ? `Today has "${yours.slice(0, 160)}"; ` : 'Today has NO "Your change" card; '}price ${priceBefore.toFixed(2)} → ${priceAfter.toFixed(2)}; forecast "${before.slice(0, 70)}" → "${after.slice(0, 70)}"; after save: "${banner.slice(0, 80)}"; next day Today ${shown ? `mentions ${money}: "${hits[0].trim().slice(0, 100)}"` : 'does NOT mention the new price'}`;
  }, async () => { await act({ type: 'set_orders', orders: { price: (await view()).business.orders.price + 0.5 } }); });

  // 9b. Today: apply the first piece of advice — a decision with a promised effect in dollars
  await step('advice', 'Today: "Apply" on the first advice → it reaches the engine and the card says so', async () => {
    await page.goto(`${base.url}/biz?world=${W}`, { waitUntil: 'domcontentloaded' });
    await visible(page.getByRole('tablist', { name: 'My business' }), 15000);
    await dismissAway();
    await page.getByRole('tab', { name: /^Today/ }).first().click({ timeout: 8000 });
    const card = page.locator('section.bz-card, div.card').filter({ has: page.locator('h3, .card__title', { hasText: /^What to change/ }) }).last();
    await visible(card, 8000);
    // Pin the card by its position: once applied it has no "Apply" button and a filter would jump to the next card.
    const all = card.locator('.bz-card');
    let idx = -1;
    for (let i = 0; i < (await all.count()); i++) if (await all.nth(i).getByRole('button', { name: /^Apply$/ }).count()) { idx = i; break; }
    if (idx < 0) return 'no advice with Apply today';
    const advice = all.nth(idx);
    const title = ((await advice.locator('b').first().innerText().catch(() => '')) || '').trim();
    const impact = ((await advice.locator('.bz-amt').first().innerText().catch(() => '')) || '').trim();
    const before = JSON.stringify({ o: (await view()).business.orders, s: (await view()).business.size });
    await shot('advice');
    await advice.getByRole('button', { name: /^Apply$/ }).click();
    await sleep(1000);
    const v = await view();
    const after = JSON.stringify({ o: v.business.orders, s: v.business.size });
    const said = ((await advice.innerText().catch(() => '')) || '').replace(/\s+/g, ' ');
    if (before === after) throw new Error(`"${title}" applied but orders and size did not change`);
    return `"${title}" ${impact}: engine changed; card now: "${(said.match(/Applied[^.]*|[^.]*error[^.]*/i) ?? [said.slice(-60)])[0].trim()}"${impact.startsWith('−') || impact.startsWith('-') ? ' — NOTE: advice with a negative effect' : ''}`;
  });

  // 9c. The city runs (demo speed) while the player edits the price: the draft must survive incoming days
  await step('live-edit', 'Manage with the clock running: an unsaved price edit survives new days', async () => {
    ack(await call('POST', `/api/worlds/${W}/clock`, { paused: false, dayMs: 1500 }), 'unpause');
    try {
      const day0 = (await view()).world.day;
      await dismissAway();
      await page.getByRole('tab', { name: /^Manage/ }).first().click({ timeout: 8000 });
      const stepper = page.getByRole('group', { name: 'price' }).first();
      await visible(stepper, 8000);
      const val = async () => (await stepper.locator('output, .stepper__value, span').first().innerText().catch(() => '')).trim();
      const v0 = await val();
      const inc = page.getByRole('button', { name: /^(More|Increase) price$/ }).first();
      await inc.click(); await inc.click();
      const v1 = await val();
      await sleep(6000);
      await dismissAway();
      const v2 = await val();
      const day1 = (await view()).world.day;
      await shot('live-edit');
      const bar = await saveBtn().count();
      if (v2 !== v1) throw new Error(`draft reset while the city ran: ${v0} → ${v1} → ${v2} after ${day1 - day0} days`);
      if (!bar) throw new Error('the save bar disappeared while the city ran');
      await click(/Discard/, 3000).catch(() => {});
      return `${v0} → ${v1}, still ${v2} after ${day1 - day0} game days; save bar kept`;
    } finally {
      ack(await call('POST', `/api/worlds/${W}/clock`, { paused: true }), 'pause');
    }
  });

  // 10. A neighbour (through the API), a deal and a report from the Network tab
  const rival = { name: RIVAL };
  {
    const j = ack(await call('POST', `/api/worlds/${W}/join`, { name: 'Sam', kind: 'owner' }), 'join rival');
    rival.token = j.token;
    // After B14 a free player may open only a cafe; the rival takes Pro in test mode (no Stripe key: nothing is charged).
    await call('POST', `/api/worlds/${W}/billing/checkout`, { interval: 'month' }, rival.token);
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
    await page.goto(`${base.url}/biz/network?world=${W}`, { waitUntil: 'domcontentloaded' });
    await sleep(1000);
    await dismissAway();
    await page.getByRole('button', { name: new RegExp(rival.name) }).first().click({ timeout: 10000 });
    // The neighbour's sheet. Its own "Team up" / "Propose a deal": the list under the sheet has buttons with the same name.
    const nb = page.getByRole('dialog', { name: new RegExp(rival.name) }).last();
    await nb.waitFor({ timeout: 8000 });
    const offerLine = ((await nb.innerText()).replace(/\s+/g, ' ').match(/Cross-promo[^.]*?guests|Cross-promo[^.]{0,60}/) ?? [''])[0];
    await nb.getByRole('button', { name: /Propose a deal|Team up/ }).first().click({ timeout: 5000 });
    await sleep(800);
    const proposed = async () => ((await view()).deals ?? []).find((d) => d.toBusinessId === rival.biz.id && d.status === 'proposed');
    if (!(await proposed())) {
      // A sheet with the kinds of deal (agent 12's first version); after B18 "Team up" may send the suggested deal at once.
      const sheet = page.getByRole('dialog').last();
      const cross = sheet.getByRole('radio', { name: /Cross-promo/ });
      if (await cross.count()) await cross.first().click({ timeout: 5000 });
      await shot('deal-sheet');
      await sheet.getByRole('button', { name: /Send offer|Send|Propose|Team up/ }).last().click({ timeout: 5000 });
      await sleep(800);
    } else await shot('deal-sheet');
    const deal = await proposed();
    if (!deal) throw new Error('the offer did not reach the engine');
    const acc = await call('POST', `/api/worlds/${W}/action`, { type: 'answer_deal', dealId: deal.id, accept: true }, rival.token);
    await page.keyboard.press('Escape').catch(() => {});
    const st = ((await view()).deals ?? []).find((d) => d.id === deal.id)?.status;
    return `${offerLine ? `sheet says "${offerLine}"; ` : ''}deal ${deal.id} ${JSON.stringify(deal.terms).slice(0, 80)}; neighbour answer ${acc.ok ? 'ok' : acc.error}; status ${st}`;
  });
  await step('report', 'Network: report the neighbour to the city, the case reaches an inspector', async () => {
    if (!rival.biz) throw new Error('no neighbour to report');
    await page.goto(`${base.url}/biz/network?world=${W}`, { waitUntil: 'domcontentloaded' });
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
    const o = ack(await call('POST', `/api/worlds/${W}/join`, { name: 'Dana', kind: 'official', role: 'inspector' }), 'join official');
    state.official = { worldId: W, playerId: o.playerId, token: o.token, name: 'Dana', kind: 'official', role: 'inspector' };
    const q = unwrap(await call('GET', `/api/worlds/${W}/view`, undefined, o.token))?.queue ?? [];
    const c = q.find((x) => x.business?.id === rival.biz.id);
    if (!c) throw new Error('report sent, but no case for the neighbour in the inspector queue');
    return `case in the inspector queue: ${String(c.id ?? '')} ${String(c.origin ?? '')} ${String(c.violationId ?? c.reportId ?? '')}`.trim();
  });

  // 10b. The official's desk in its own browser: the case from the report is in the queue, the inspector takes it
  await step('desk', 'City official desk: the report is in the case queue; "Take" starts an inspection', async () => {
    if (!state.official) throw new Error('no official (the report step failed)');
    const octx = await browser.newContext({ viewport: { width, height: phone ? 812 : 900 }, deviceScaleFactor: SHOTS && phone ? 2 : 1, isMobile: phone, hasTouch: phone, colorScheme: SCHEME });
    try {
      await octx.addInitScript((s) => {
        localStorage.setItem('ohh.sessions.v1', JSON.stringify({ [`remote:${s.worldId}`]: s }));
        localStorage.setItem('ohh.mode.v1', 'remote');
      }, state.official);
      const op = await octx.newPage();
      op.on('pageerror', (e) => errors.push(`desk pageerror: ${String(e).slice(0, 200)}`));
      await op.goto(`${base.url}/desk?world=${W}`, { waitUntil: 'domcontentloaded' });
      const queue = op.getByRole('region', { name: 'Case queue' }).or(op.locator('[aria-label="Case queue"]'));
      await queue.first().waitFor({ timeout: 15000 });
      await sleep(800);
      const qText = (await queue.first().innerText()).replace(/\s+/g, ' ');
      if (!qText.includes(rival.name)) throw new Error(`the queue does not show ${rival.name}: "${qText.slice(0, 120)}"`);
      const file = join(dir, `${String(++n).padStart(2, '0')}-desk.png`);
      await op.screenshot({ path: file, fullPage: true });
      if (SHOTS) await op.screenshot({ path: join(SHOTS, `${phone ? 'phone' : 'desktop'}-desk.png`) });
      took = true;
      const take = queue.first().getByRole('button', { name: /Take|Inspect|Open/ }).first();
      if (!(await take.count())) return `queue shows the case; no "Take" button: "${qText.slice(0, 100)}"`;
      await take.click();
      await sleep(1000);
      const mine = unwrap(await call('GET', `/api/worlds/${W}/view`, undefined, state.official.token))?.mine ?? [];
      return `queue: "${qText.slice(0, 80)}"; after Take the official has ${mine.length} case(s)`;
    } finally { await octx.close(); }
  });

  // 10c. Coming back after three weeks (B13): /brief — cash then and now, one decision, the rival, the next report.
  // The server sends the "while you were away" summary once, in the first view after the gap: no API view() before the page.
  await step('brief', 'Back after 3 weeks: /brief shows cash then → now, one decision, the rival and the next report', async () => {
    ack(await call('POST', `/api/worlds/${W}/clock`, { advanceDays: 21 }), 'advance');
    await page.goto(`${base.url}/brief?world=${W}`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);
    const t = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    if (/page not found|on its way/i.test(t)) return 'no /brief on this build (before B13): skipped';
    const found = {
      cash: /\$[\d,]+\s*(→|->|to)\s*\$[\d,]+|Cash then \$[\d,]+.{0,20}Cash now \$[\d,]+/.test(t),
      decision: (await page.locator('main button:not([disabled])').count()) > 1,
      rival: /above you|ahead of you|behind you|rival/i.test(t),
      next: /next report|report (on|in|comes|arrives)|month closes|closes on/i.test(t),
    };
    await shot('brief');
    const missing = Object.entries(found).filter(([, v]) => !v).map(([k]) => k);
    return `${missing.length ? `MISSING on screen: ${missing.join(', ')}; ` : 'cash then → now, a decision, the rival and the next report are on screen; '}"${t.slice(0, 150)}"`;
  });

  // 11. A month passes: the month report shows in Books
  await step('month', 'A month passes: the month report appears in Books', async () => {
    ack(await call('POST', `/api/worlds/${W}/clock`, { advanceDays: 32 }), 'advance');
    await page.goto(`${base.url}/biz?world=${W}`, { waitUntil: 'domcontentloaded' });
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

  // 11b. The free month is over (B14): decisions are refused, /pro offers Pro, Get Pro (test mode) gives the controls back
  await step('pro', 'After the free month: a saved change is refused → /pro → "Get Pro" (test) → the change goes through', async () => {
    const billing = async () => unwrap(await call('GET', `/api/worlds/${W}/billing`, undefined, state.token));
    let st = await billing();
    if (!st || st.ok === false || st.canManage === undefined) return 'no billing on this build (before B14): skipped';
    for (let i = 0; i < 12 && st.canManage; i++) { ack(await call('POST', `/api/worlds/${W}/clock`, { advanceDays: 10 }), 'advance'); st = await billing(); }
    if (st.canManage) throw new Error(`still free to manage on day ${(await view()).world.day} (free ends ${st.freeEndsDay})`);
    const day = (await view()).world.day;
    // A player changes the price and presses the save button.
    await page.goto(`${base.url}/biz?world=${W}`, { waitUntil: 'domcontentloaded' });
    await visible(page.getByRole('tablist', { name: 'My business' }), 15000);
    await dismissAway();
    await page.getByRole('tab', { name: /^Manage/ }).first().click({ timeout: 8000 });
    const p0 = (await view()).business.orders.price;
    await page.getByRole('button', { name: /^(More|Increase) price$/ }).first().click({ timeout: 8000 });
    await saveBtn().click({ timeout: 5000 });
    await sleep(1200);
    const refusedText = ((await page.locator('body').innerText()).replace(/\s+/g, ' ').match(/[^.]*(free month|First Year Pro|subscription)[^.]*\.(?:[^.]*\/pro\.)?/i) ?? [''])[0];
    const seePro = await page.getByRole('button', { name: /Pro/ }).or(page.getByRole('link', { name: /Pro/ })).count();
    await shot('pro-refused');
    const p1 = (await view()).business.orders.price;
    if (p1 !== p0) throw new Error(`the change went through on day ${day} without Pro (${p0} → ${p1})`);
    // The personal plan as a free player after the free month (BUGS.md, №13): an offer of Pro, or "not ready yet"?
    await page.goto(`${base.url}/end/plan?world=${W}`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);
    const planFree = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    const planVerdict = /not ready yet/i.test(planFree) ? 'plan for a free player: "not ready yet" (BUGS №13)' : /Pro/.test(planFree) ? `plan for a free player offers Pro: "${(planFree.match(/[^.]*Pro[^.]*\./) ?? [''])[0].trim().slice(0, 90)}"` : `plan for a free player: "${planFree.slice(0, 90)}"`;
    await shot('plan-free');
    // The tariff screen.
    await page.goto(`${base.url}/pro?world=${W}`, { waitUntil: 'domcontentloaded' });
    const buy = await visible(btn(/^Get Pro/), 15000);
    await sleep(500);
    const offer = ((await page.locator('main').first().innerText()).replace(/\s+/g, ' ')).slice(0, 160);
    await shot('pro');
    await buy.click();
    for (let i = 0; i < 20 && !(await billing())?.pro; i++) await sleep(300);
    const after = await billing();
    if (!after?.pro) throw new Error('"Get Pro" did not give Pro');
    // The same change again.
    await page.goto(`${base.url}/biz?world=${W}`, { waitUntil: 'domcontentloaded' });
    await visible(page.getByRole('tablist', { name: 'My business' }), 15000);
    await dismissAway();
    await page.getByRole('tab', { name: /^Manage/ }).first().click({ timeout: 8000 });
    await page.getByRole('button', { name: /^(More|Increase) price$/ }).first().click({ timeout: 8000 });
    await saveBtn().click({ timeout: 5000 });
    await sleep(1000);
    const p2 = (await view()).business.orders.price;
    if (p2 === p0) throw new Error('Pro is on, but the change still does not go through');
    return `${planVerdict}; day ${day}: refused${refusedText ? ` ("${refusedText.trim().slice(0, 110)}")` : ' with no word about Pro on screen'}; ${seePro ? 'a Pro button/link next to it' : 'NO button to /pro next to the refusal'}; /pro: "${offer.slice(0, 90)}"; after Get Pro (${after.pro.via}) price ${p0} → ${p2}`;
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
      await page.goto(`${base.url}/end?world=${W}`, { waitUntil: 'domcontentloaded' });
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

  await call('POST', `/api/worlds/${W}/clock`, { paused: true }); // leave the city paused: no bots running for nobody
  return { results, errors, state, page, ctx, dir, W };
}

// ───────────── main ─────────────
(async () => {
  mkdirSync(OUT, { recursive: true });
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  if (!base.url) { server = await startServer(ROOT, log); base.url = server.url; }
  log(`E2E against ${base.url}${ROOT !== HERE ? ` (game from ${ROOT})` : ''}; out ${relative(HERE, OUT)}`);
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const w = await walk(browser, width);
    ALL.push(...w.results);
    await w.ctx.close();
  }
  await browser.close();
  writeFileSync(join(OUT, 'results.json'), JSON.stringify({ base: base.url, at: new Date().toISOString(), results: ALL }, null, 2));
  const md = ['# E2E run ' + STAMP, '', `Server: ${base.url}`, '', '| Width | Step | Result | ms | Note |', '|---|---|---|---|---|',
    ...ALL.map((r) => `| ${r.width} | ${r.id} | ${r.ok ? 'OK' : '**FAIL**'}${r.fallback ? ' (API)' : ''}${r.overflowPx > 0 ? ` · overflow ${r.overflowPx}px` : ''} | ${r.ms} | ${r.note.replace(/\|/g, '/')}${r.errors.length ? ` · errors: ${r.errors.join('; ').replace(/\|/g, '/').slice(0, 300)}` : ''} |`)];
  writeFileSync(join(OUT, 'RUN.md'), md.join('\n') + '\n');
  const failed = ALL.filter((r) => !r.ok).length;
  log(`\n${ALL.length - failed} of ${ALL.length} steps OK. ${relative(HERE, join(OUT, 'RUN.md'))}`);
  stopServer();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); stopServer(); process.exit(2); });
