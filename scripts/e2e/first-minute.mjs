#!/usr/bin/env node
// The first minutes of a new player on a phone, with the demo city running at its own speed (no paused clock):
// how many seconds until the first decision, the first number that answers it, signing the lease, opening and the first sale.
// It plays like a decisive newcomer: it reads each screen for --read ms (default 3000), takes the suggested option and moves on.
//
//   node scripts/e2e/first-minute.mjs                  # own server
//   node scripts/e2e/first-minute.mjs --url https://…   # a deployed game (creates its own demo city there)
//   options: --read 3000  --width 375  --out <dir>  --root <checkout>
//
// Prints a timeline and writes <out>/TIMELINE.md and timeline.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HERE, ack, api, chromium, opt, sleep, stamp, startServer, unwrap } from './lib.mjs';

const ROOT = opt('root', HERE);
const READ = Number(opt('read', 3000));
const WIDTH = Number(opt('width', 375));
const OUT = opt('out', join(HERE, 'docs/qa/runs', `${stamp()}-first-minute`));
const base = { url: (opt('url', process.env.E2E_URL ?? '') || '').replace(/\/$/, '') };
const { call } = api(base);

(async () => {
  mkdirSync(OUT, { recursive: true });
  const server = base.url ? null : await startServer(ROOT);
  if (server) base.url = server.url;
  const W = ack(await call('POST', '/api/worlds', { name: 'Demo City' }), 'create demo city').id;
  const dayMs = unwrap(await call('GET', `/api/worlds/${W}/view`))?.world?.config?.dayMs ?? null;

  const browser = await chromium.launch();
  const phone = WIDTH < 700;
  const page = await (await browser.newContext({ viewport: { width: WIDTH, height: phone ? 812 : 900 }, isMobile: phone, hasTouch: phone })).newPage();
  const t0 = Date.now();
  const rows = [];
  let decisions = 0;
  const gameDay = async () => unwrap(await call('GET', `/api/worlds/${W}/view`))?.world?.day ?? null;
  const mark = async (what, kind, note = '') => {
    const r = { s: Math.round((Date.now() - t0) / 100) / 10, day: await gameDay(), what, kind, decisions, note };
    rows.push(r);
    console.log(`${String(r.s).padStart(6)} s  day ${String(r.day).padStart(3)}  ${kind.padEnd(11)} ${what}${note ? ' — ' + note : ''}`);
  };
  const decide = async (what, fn, note) => { await sleep(READ); await fn(); decisions++; await mark(what, 'decision', note); };
  const btn = (re) => page.getByRole('button', { name: re }).first();
  const textOf = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');

  try {
    await page.goto(`${base.url}/?world=${W}&mode=remote`, { waitUntil: 'domcontentloaded' });
    await page.locator('#idea').waitFor({ timeout: 20000 });
    await mark('home: the idea field is on the page', 'screen', (await page.locator('#idea').isVisible()) && (await page.locator('#idea').boundingBox())?.y < (phone ? 812 : 900) ? 'visible without scrolling' : 'below the fold: the player has to scroll');

    await decide('typed an idea, "See my plan"', async () => {
      await page.locator('#idea').fill('A coffee shop near the subway');
      await btn(/See my plan/).click();
    });
    await page.getByText(/Looks like a/).first().waitFor({ timeout: 15000 }).catch(() => {});
    await mark('the game answers: the niche and the starting money', 'consequence', ((await textOf()).match(/Looks like a [^.]*\./) ?? [''])[0]);

    await decide('"Choose a place"', async () => { await btn(/Choose a place/).click(); });
    await page.getByText(/Where will it be\?/).waitFor({ timeout: 10000 });
    const row = page.locator('.list-row', { hasText: /opens from/ }).first();
    await decide('picked the first storefront in the list', async () => { await row.click(); });
    await page.getByText(/Opening here costs/).first().waitFor({ timeout: 5000 }).catch(() => {});
    await mark('the game answers: what opening here costs', 'consequence', ((await textOf()).match(/Opening here costs[^.]*\./) ?? [''])[0]);

    await decide('"Open here"', async () => { await btn(/Open here/).click(); });
    await btn(/See what to buy/).waitFor({ timeout: 10000 });
    await mark('the opening plan (steps, fees, waits)', 'screen');
    await decide('"See what to buy"', async () => { await btn(/See what to buy/).click(); });
    await page.getByPlaceholder('Jordan').waitFor({ timeout: 10000 });
    await decide('typed a name, joined (test payment)', async () => {
      await page.getByPlaceholder('Jordan').fill('Jordan');
      await btn(/and join|Join/).click();
    });
    const go = btn(/Use recommended for all|Open with recommended setup|Sign|Start construction/);
    await go.waitFor({ timeout: 15000 });
    await mark('the setup: what to buy and what is left', 'screen', ((await textOf()).match(/Cash left after opening \$[\d,]+/) ?? [''])[0]);
    await decide('bought the setup, signed the lease', async () => { await go.click(); });
    const session = await page.evaluate((w) => JSON.parse(localStorage.getItem('ohh.sessions.v1') ?? '{}')[`remote:${w}`] ?? null, W);
    const me = async () => unwrap(await call('GET', `/api/worlds/${W}/view`, undefined, session?.token));
    await page.getByText(/Waiting for permits|Everything is ready|Open doors/).first().waitFor({ timeout: 15000 });
    await mark('waiting for permits: rent runs, nothing to decide but "Open early"', 'wait', ((await textOf()).match(/the last permit arrives [^.]*\./) ?? [''])[0]);

    // Wait like a player who keeps the tab open; press "Open doors" the moment it is enabled.
    const open = btn(/^Open doors$/);
    for (let i = 0; i < 600; i++) {
      if (await open.count() && !(await open.isDisabled().catch(() => true))) break;
      await sleep(500);
    }
    await mark('"Open doors" is enabled', 'screen');
    await decide('"Open doors"', async () => { await open.click(); });
    for (let i = 0; i < 40 && (await me())?.business?.status !== 'open'; i++) await sleep(250);

    // The first day with sales on Today.
    if (!/\/biz/.test(page.url())) await page.goto(`${base.url}/biz?world=${W}`, { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 240; i++) {
      // A sale counts once the player can see it: "Orders sold N" on Today, N > 0 (business.days[] is what Today draws).
      const b = (await me())?.business;
      const served = (b?.days ?? []).reduce((n, d) => n + (d.servedUnits ?? 0), 0);
      const m = (await textOf()).match(/Orders sold (\d+)/);
      if (m && Number(m[1]) > 0) { await mark('first sales on Today', 'consequence', `Orders sold ${m[1]}; engine: ${served} served so far`); break; }
      await sleep(500);
    }
    const advice = await page.getByRole('button', { name: /^Apply$/ }).count();
    await mark('Today: advice waiting for an answer', 'screen', `${advice} "Apply" button(s)`);
  } catch (e) {
    await mark('stopped', 'error', String(e.message ?? e).split('\n')[0]);
  }

  await page.screenshot({ path: join(OUT, 'last.png'), fullPage: true }).catch(() => {});
  await browser.close();
  server?.stop();

  const first = (kind) => rows.find((r) => r.kind === kind);
  const sale = rows.find((r) => r.what === 'first sales on Today');
  const summary = [
    `First decision: ${first('decision')?.s ?? '—'} s.`,
    `First number that answers a decision: ${first('consequence')?.s ?? '—'} s.`,
    `Lease signed: ${rows.find((r) => /signed the lease/.test(r.what))?.s ?? '—'} s.`,
    `First sale on screen: ${sale ? `${sale.s} s (game day ${sale.day})` : 'not reached'}.`,
    `Decisions before the first sale: ${sale ? sale.decisions : decisions}.`,
    `Longest stretch with nothing to decide: ${(() => { let best = 0, from = 0; for (const r of rows) { if (r.kind === 'decision') { best = Math.max(best, r.s - from); from = r.s; } } return Math.round(best); })()} s.`,
  ];
  const md = [`# First minute — ${new Date().toISOString().slice(0, 16)} UTC`, '', `Server ${base.url}, city ${W}, ${dayMs ? `one game day every ${dayMs / 1000} s` : 'day length unknown'}, width ${WIDTH}, ${READ / 1000} s of reading per screen.`, '', ...summary.map((x) => `- ${x}`), '',
    '| s | Game day | Kind | What | Note |', '|---|---|---|---|---|', ...rows.map((r) => `| ${r.s} | ${r.day ?? ''} | ${r.kind} | ${r.what} | ${r.note.replace(/\|/g, '/')} |`)];
  writeFileSync(join(OUT, 'TIMELINE.md'), md.join('\n') + '\n');
  writeFileSync(join(OUT, 'timeline.json'), JSON.stringify({ base: base.url, world: W, dayMs, read: READ, width: WIDTH, rows }, null, 2));
  console.log('\n' + summary.join('\n') + `\n${relative(HERE, join(OUT, 'TIMELINE.md'))}`);
  process.exit(rows.some((r) => r.kind === 'error') ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
