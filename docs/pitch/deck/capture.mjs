// Takes the deck's screenshots from the running product — real screens, real engine numbers.
//
//   npm run build && npm start                  # in another terminal (or point CAPTURE_URL at a deployed city)
//   node docs/pitch/deck/capture.mjs            # → docs/pitch/deck/img/*.png and img/capture.json
//
// It creates its own demo city (POST /api/worlds), walks the opening as a new player would
// (idea → place → plan → join → setup → waiting for permits), moves the city clock to opening day,
// opens the doors and lets the city run one month, then photographs the business tabs and the city screen.
// Nothing on the screens is edited; img/capture.json records the commit, the city and the numbers seen.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'img');
mkdirSync(out, { recursive: true });
const BASE = (process.env.CAPTURE_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const PHONE = { width: 390, height: 844 };
const WIDE = { width: 1440, height: 900 };

async function api(method, path, body, token) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return r.json();
}
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(fn, ms, step = 300) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await sleep(step);
  }
  return null;
}

const log = { base: BASE, commit: '', takenAt: new Date().toISOString(), world: '', steps: [] };
// CAPTURE_COMMIT names the build the server runs when it is not this checkout (another branch, a deployed city).
try { log.commit = process.env.CAPTURE_COMMIT ?? execSync('git rev-parse --short HEAD', { cwd: here }).toString().trim(); } catch { /* not a checkout */ }
const note = (s) => { log.steps.push(s); console.log(s); };

const created = await api('POST', '/api/worlds', { name: 'Pitch deck city' });
const worldId = created?.data?.id;
if (!worldId) throw new Error(`could not create a demo city: ${JSON.stringify(created)}`);
log.world = worldId;
const clock = (b) => api('POST', `/api/worlds/${worldId}/clock`, b);
await clock({ paused: true });
note(`city ${worldId}`);

const browser = await chromium.launch();
// Wide map screens are photos: JPEG keeps them small. Phone screens are text: PNG keeps them sharp.
const shot = async (page, name, opts = {}) => {
  await page.waitForTimeout(opts.wait ?? 1500);
  const file = `${name}.${opts.jpeg ? 'jpg' : 'png'}`;
  await page.screenshot({ path: join(out, file), fullPage: Boolean(opts.full), ...(opts.jpeg ? { type: 'jpeg', quality: 82 } : {}) });
  note(`shot ${file}`);
};
const click = (page, text, exact = false) => page.getByText(text, { exact }).first().click({ timeout: 15000 });
// One card around a piece of text: the smallest box that holds the text and is at least `minHeight` tall.
// Used for the ad frames, so each ad shows a whole card, not a guessed crop of a screen.
async function shotAround(page, text, name, minHeight = 160) {
  const loc = page.getByText(text).first();
  if (!(await loc.count())) return note(`no "${text}" for ${name}`);
  await loc.scrollIntoViewIfNeeded();
  const box = await loc.evaluate((el, min) => {
    let n = el;
    while (n.parentElement && n.getBoundingClientRect().height < min) n = n.parentElement;
    const r = n.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, window.innerHeight - r.y) };
  }, minHeight);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, `${name}.png`), clip: box });
  // the text of the cut-out card, so the ad lines in the deck can be checked against the frame
  log.frames ??= {};
  log.frames[name] = await page.evaluate((b) => {
    const els = [...document.querySelectorAll('body *')].filter((e) => {
      const r = e.getBoundingClientRect();
      return e.children.length === 0 && r.top >= b.y - 1 && r.bottom <= b.y + b.height + 1 && (e.textContent || '').trim();
    });
    return els.map((e) => e.textContent.trim()).join(' · ').slice(0, 600);
  }, box);
  note(`shot ${name}.png (around "${text}")`);
}

try {
  // ── Home, wide: the city before anyone joins ──
  const wide = await browser.newPage({ viewport: WIDE, deviceScaleFactor: 2 });
  await wide.goto(`${BASE}/?world=${worldId}`);
  await wide.getByText('See my plan').first().waitFor({ timeout: 30000 });
  await shot(wide, 'home', { wait: 3000, jpeg: true });

  // ── Opening, phone ──
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?world=${worldId}`);
  await page.getByText('Coffee near the subway').first().waitFor({ timeout: 30000 });
  await click(page, 'Coffee near the subway');
  await click(page, 'See my plan');
  await page.getByText('Step 1 of 6').waitFor();
  const nameBox = page.getByLabel(/Business name/i);
  if (await nameBox.count()) await nameBox.first().fill("Maya's Coffee");
  await shot(page, 'start-idea');

  await click(page, 'Choose a place');
  await page.getByText('Step 2 of 6').waitFor();
  await page.waitForTimeout(2500);
  // The list is sorted cheapest-to-open first; take the first door, as a careful newcomer would.
  const firstPlace = page.locator('button', { hasText: /sq ft/ }).first();
  note(`place: ${(await firstPlace.innerText()).replace(/\s+/g, ' ')}`);
  await firstPlace.click();
  await page.getByText('Open here').first().waitFor();
  await page.getByText('Open here').first().scrollIntoViewIfNeeded();
  await shot(page, 'start-place');

  await click(page, 'Open here');
  await page.getByText('Step 3 of 6').waitFor();
  await shot(page, 'start-plan');

  // the button under the opening plan has been renamed between builds
  await page.getByRole('button', { name: /See what to buy|Go on with this address/i }).first().click({ timeout: 15000 });
  await page.getByText('Step 4 of 6').waitFor();
  await page.locator('input').first().fill('Maya');
  await page.getByRole('button', { name: /join/i }).first().click();
  await page.getByText('Step 5 of 6').waitFor({ timeout: 20000 });
  // Newer builds ask one decision at a time (team, pay, roaster, hours, price...), then show the whole bet.
  await page.getByRole('button', { name: /Use recommended for all|Open with recommended setup|Sign the lease/i }).first().waitFor({ timeout: 20000 });
  const useRecommended = page.getByRole('button', { name: /Use recommended for all/i }).first();
  if (await useRecommended.count()) {
    await shot(page, 'start-decision', { wait: 2500 });
    await useRecommended.click();
    await page.waitForTimeout(2500);
  }
  await shot(page, 'start-setup', { wait: 2500 });
  await shotAround(page, 'Your bet', 'ad-bet');
  note(`setup: ${(await page.innerText('main').catch(() => page.innerText('body'))).replace(/\s+/g, ' ').slice(0, 900)}`);

  await page.getByRole('button', { name: /Open with recommended setup|Sign the lease/i }).first().click({ timeout: 15000 });
  await page.getByText('Step 6 of 6').waitFor({ timeout: 20000 });
  await shot(page, 'start-waiting', { wait: 2500 });

  // ── Opening day: move the clock, open the doors in the UI ──
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('ohh.sessions.v1') ?? '{}'));
  const me = Object.values(session).find((s) => s.worldId === worldId);
  if (!me) throw new Error('no session for Maya');
  const view = (t) => api('GET', `/api/worlds/${worldId}/view`, undefined, t);
  const v0 = await view(me.token);
  // The doors open when the last permit (and the build-out, tracked the same way) is ready.
  const readyDays = (v0.business?.permits ?? []).map((p) => p.readyDay).filter((d) => typeof d === 'number');
  const waitDays = readyDays.length ? Math.max(0, Math.max(...readyDays) - v0.world.day) : 85;
  note(`day ${v0.world.day}, waiting ${waitDays} days for permits`);
  await clock({ paused: true, advanceDays: waitDays + 1 });
  await until(async () => (await view()).world.day >= v0.world.day + waitDays + 1, 30000);
  await page.reload();
  const openDoors = page.getByRole('button', { name: /Open (the )?doors/i }).first();
  await openDoors.waitFor({ timeout: 20000 });
  await openDoors.click();
  await page.waitForTimeout(2500);
  let v1 = await view(me.token);
  if (v1.business?.status !== 'open') {
    const r = await api('POST', `/api/worlds/${worldId}/action`, { type: 'launch' }, me.token);
    note(`UI did not open the doors; launch by API: ${JSON.stringify(r).slice(0, 160)}`);
  }

  // ── One month of trading ──
  const day1 = (await view()).world.day;
  await clock({ paused: false, dayMs: 60 });
  const month = await until(async () => {
    const v = await view(me.token);
    return v.world.day >= day1 + 32 && v.business?.history?.length ? v : null;
  }, 90000, 400);
  await clock({ paused: true });
  if (!month) throw new Error('no month report after 32 days');
  const m = month.business.history.at(-1);
  note(`month report: ${JSON.stringify({ revenue: m.revenue, profit: m.profit, cash: month.business.cash ?? month.me?.cash })}`);
  log.month = m;

  // The player steps away for a week: the page is closed while the city runs, so the return card has news.
  await page.goto('about:blank');
  await clock({ paused: true, advanceDays: 7 });
  await sleep(1000);
  // The return screen (/brief), where the build has one, then the business screen.
  await page.goto(`${BASE}/brief?world=${worldId}`);
  await page.waitForTimeout(3000);
  if (/brief/.test(page.url()) && (await page.locator('main, #root').first().innerText()).trim().length > 40) {
    await shot(page, 'brief');
    log.frames ??= {};
    log.frames.brief = (await page.innerText('body')).replace(/\s+/g, ' ').slice(0, 600);
  }
  else note('no /brief screen in this build');
  // What the free plan shows after the first month, and what Pro adds.
  await page.goto(`${BASE}/pro?world=${worldId}`);
  await page.waitForTimeout(3000);
  if (/pro/.test(page.url()) && (await page.getByText(/Get Pro|Pro/).count())) await shot(page, 'pro');
  else note('no /pro screen in this build');
  await page.goto(`${BASE}/biz?world=${worldId}`);
  await page.waitForTimeout(3000);
  // "While you were away" — the return card a player sees when the city has moved on.
  const away = page.getByRole('dialog', { name: /while you were away/i });
  if (await away.count()) {
    await shot(page, 'biz-away');
    await shotAround(page, 'While you were away', 'ad-away', 300);
    await away.getByRole('button', { name: /got it/i }).first().click();
  } else note('no "While you were away" card');
  await shot(page, 'biz-today');
  for (const [tab, name] of [['Manage', 'biz-manage'], ['Books', 'biz-books'], ['Insights', 'biz-insights'], ['Network', 'biz-network']]) {
    const t = page.getByRole('tab', { name: tab }).or(page.getByRole('link', { name: tab })).or(page.getByRole('button', { name: tab, exact: true }));
    if (await t.count()) {
      await t.first().click();
      await shot(page, name, { wait: 2500 });
    } else note(`no tab ${tab}`);
  }

  // ── The shared city, projector width ──
  const city = await browser.newPage({ viewport: WIDE, deviceScaleFactor: 2 });
  await city.goto(`${BASE}/city/${worldId}`);
  await shot(city, 'city', { wait: 4000, jpeg: true });

  // ── Season end: the personal plan the player takes home ──
  // The server moves a demo clock at most 60 days per call; the season is 12 months.
  for (let i = 0; i < 10; i++) {
    const v = await view(me.token);
    if (v.world.phase === 'ended') break;
    await clock({ paused: true, advanceDays: 60 });
    await sleep(500);
  }
  const vEnd = await view(me.token);
  note(`season: day ${vEnd.world.day}, phase ${vEnd.world.phase}, business ${vEnd.business?.status}, cash ${Math.round(vEnd.business?.cash ?? 0)}`);
  log.seasonEnd = { day: vEnd.world.day, phase: vEnd.world.phase, status: vEnd.business?.status, cash: vEnd.business?.cash, months: vEnd.business?.history?.map((h) => ({ month: h.month, revenue: Math.round(h.revenue), profit: Math.round(h.profit) })) };
  // The personal plan is a Pro feature where the build has a plan: take Pro in test mode (no key, nothing charged).
  await page.goto(`${BASE}/pro?world=${worldId}`);
  await page.waitForTimeout(2500);
  const getPro = page.getByRole('button', { name: /Get Pro/i }).first();
  if (await getPro.count()) {
    await getPro.click();
    await page.waitForTimeout(2500);
    note(`Pro taken in test mode: ${(await page.innerText('body')).replace(/\s+/g, ' ').slice(0, 200)}`);
  }
  await page.goto(`${BASE}/end?world=${worldId}`);
  await shot(page, 'end', { wait: 3500 });
  await shotAround(page, 'Rent above the norm', 'ad-loss', 140);
  await page.evaluate(() => window.scrollTo(0, 0));
  const openPhone = page.getByText('Open my plan').first();
  if (await openPhone.count()) {
    await openPhone.click();
    await shot(page, 'plan', { wait: 3500 });
  } else note('no "Open my plan" button on the phone');
  const plan = await browser.newPage({ viewport: WIDE, deviceScaleFactor: 2 });
  await plan.addInitScript((s) => localStorage.setItem('ohh.sessions.v1', s), JSON.stringify(session));
  await plan.goto(`${BASE}/end?world=${worldId}`);
  await shot(plan, 'end-wide', { wait: 3500 });
  const open = plan.getByText('Open my plan').first();
  if (await open.count()) {
    await open.click();
    await shot(plan, 'plan-wide', { wait: 3500 });
    note(`plan: ${(await plan.innerText('body')).replace(/\s+/g, ' ').slice(0, 1500)}`);
  } else note('no "Open my plan" button');
} finally {
  writeFileSync(join(out, 'capture.json'), JSON.stringify(log, null, 2));
  await browser.close();
}
