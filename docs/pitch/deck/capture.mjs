// Снимает экраны продукта для презентации — только с компьютера: окно 1440×900, deviceScaleFactor 2, светлая тема.
//
//   npm run build && npm start                  # в другом терминале (или CAPTURE_URL=https://<адрес>)
//   node docs/pitch/deck/capture.mjs            # → docs/pitch/deck/img/*.jpg и img/capture.json
//
// Скрипт создаёт свой демо-город (POST /api/worlds), проходит открытие как новый игрок (идея → место → план →
// вход → настройка → подпись аренды), доводит часы города до открытия, открывает двери, даёт городу прожить месяц
// и снимает: управление (цена до и после нажатий), соседей, возвращение, город, личный план с карточкой правила.
// На экранах ничего не правится. img/capture.json хранит коммит, город, числа с экранов и прямоугольники мест,
// на которые в презентации наезжает камера (в точках снимка 1440×900).
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

const log = { base: BASE, commit: '', takenAt: new Date().toISOString(), viewport: { ...WIDE, deviceScaleFactor: 2 }, world: '', steps: [], story: {}, rects: {}, frames: {} };
// CAPTURE_COMMIT называет сборку сервера, если она не из этого каталога (другая ветка, выложенный город).
try { log.commit = process.env.CAPTURE_COMMIT ?? execSync('git rev-parse --short HEAD', { cwd: here }).toString().trim(); } catch { /* не репозиторий */ }
const note = (s) => { log.steps.push(s); console.log(s); };
const save = () => writeFileSync(join(out, 'capture.json'), JSON.stringify(log, null, 2));
const dollars = (text, re) => { const m = text.match(re); return m ? Number(m[1].replace(/,/g, '')) : null; };

const created = await api('POST', '/api/worlds', { name: 'Pitch deck city' });
const worldId = created?.data?.id;
if (!worldId) throw new Error(`could not create a demo city: ${JSON.stringify(created)}`);
log.world = worldId;
const clock = (b) => api('POST', `/api/worlds/${worldId}/clock`, b);
await clock({ paused: true });
note(`city ${worldId}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: WIDE, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { try { localStorage.setItem('fy-theme-2', 'light'); } catch { /* закрытое хранилище */ } });
const page = await ctx.newPage();

const shot = async (name, wait = 1500) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 88 });
  log.frames[name] = (await page.innerText('body')).replace(/\s+/g, ' ').slice(0, 1400);
  note(`shot ${name}.jpg`);
};
const click = (text, exact = false) => page.getByText(text, { exact }).first().click({ timeout: 15000 });
const text = async () => (await page.innerText('body')).replace(/\s+/g, ' ');
// Прямоугольник вокруг текста: самый маленький блок, который держит этот текст и не ниже minHeight.
async function rect(name, needle, minHeight = 0) {
  const r = await page.evaluate(([t, min]) => {
    const leafs = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 || [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    let n = leafs.find((e) => (e.textContent || '').trim() === t) ?? leafs.find((e) => (e.textContent || '').includes(t));
    if (!n) return null;
    while (n.parentElement && n.getBoundingClientRect().height < min) n = n.parentElement;
    const b = n.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  }, [needle, minHeight]);
  if (r) log.rects[name] = r; else note(`no "${needle}" for rect ${name}`);
  return r;
}
async function rectOf(name, locator) {
  const b = await locator.first().boundingBox().catch(() => null);
  if (b) log.rects[name] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  else note(`no element for rect ${name}`);
}
const tab = async (name) => {
  const t = page.getByRole('tab', { name }).or(page.getByRole('link', { name })).or(page.getByRole('button', { name, exact: true }));
  if (!(await t.count())) { note(`no tab ${name}`); return false; }
  await t.first().click();
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.scrollTo(0, 0));
  return true;
};

try {
  // ── Главная: город до входа ──
  await page.goto(`${BASE}/?world=${worldId}`);
  await page.getByText('Coffee near the subway').first().waitFor({ timeout: 30000 });
  await shot('home', 3000);

  // ── Открытие ──
  await click('Coffee near the subway');
  await click('See my plan');
  await page.getByText('Step 1 of 6').waitFor();
  const nameBox = page.getByLabel(/Business name/i);
  if (await nameBox.count()) await nameBox.first().fill("Maya's Coffee");
  await click('Choose a place');
  await page.getByText('Step 2 of 6').waitFor();
  await page.waitForTimeout(2500);
  // Список отсортирован от самого дешёвого открытия; берём первую дверь, как осторожный новичок.
  const firstPlace = page.locator('button', { hasText: /sq ft/ }).first();
  log.place = (await firstPlace.innerText()).replace(/\s+/g, ' ');
  note(`place: ${log.place}`);
  await firstPlace.click();
  await page.getByText('Open here').first().waitFor();
  await shot('place');
  await click('Open here');
  await page.getByText('Step 3 of 6').waitFor();
  await page.getByRole('button', { name: /See what to buy|Go on with this address/i }).first().click({ timeout: 15000 });
  await page.getByText('Step 4 of 6').waitFor();
  await page.locator('input').first().fill('Maya');
  await page.getByRole('button', { name: /join/i }).first().click();
  await page.getByText('Step 5 of 6').waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: /Use recommended for all|Open with recommended setup|Sign the lease/i }).first().waitFor({ timeout: 20000 });
  const useRecommended = page.getByRole('button', { name: /Use recommended for all/i }).first();
  if (await useRecommended.count()) { await useRecommended.click(); await page.waitForTimeout(2500); }
  await shot('setup', 2000);
  const setup = await text();
  // Сквозной счётчик денег презентации: числа с экрана настройки, не из головы.
  log.story.start = dollars(setup, /You start with \$([\d,]+)/);
  log.story.signed = dollars(setup, /Cash left after signing \$([\d,]+)/);
  log.story.openingDay = dollars(setup, /In the bank on opening day \$([\d,]+)/);
  log.story.bills = dollars(setup, /Bills every month once the doors are open \$([\d,]+)/);
  note(`story: ${JSON.stringify(log.story)}`);

  await page.getByRole('button', { name: /Open with recommended setup|Sign the lease/i }).first().click({ timeout: 15000 });
  await page.getByText('Step 6 of 6').waitFor({ timeout: 20000 });

  // ── День открытия: двигаем часы города, двери открывает игрок ──
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('ohh.sessions.v1') ?? '{}'));
  const me = Object.values(session).find((s) => s.worldId === worldId);
  if (!me) throw new Error('no session for Maya');
  const view = (t) => api('GET', `/api/worlds/${worldId}/view`, undefined, t);
  const cash = async () => Math.round((await view(me.token)).business?.cash ?? 0);
  const v0 = await view(me.token);
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
  if ((await view(me.token)).business?.status !== 'open') {
    const r = await api('POST', `/api/worlds/${worldId}/action`, { type: 'launch' }, me.token);
    note(`UI did not open the doors; launch by API: ${JSON.stringify(r).slice(0, 160)}`);
  }

  // ── Месяц торговли ──
  const day1 = (await view()).world.day;
  await clock({ paused: false, dayMs: 60 });
  const month = await until(async () => {
    const v = await view(me.token);
    return v.world.day >= day1 + 32 && v.business?.history?.length ? v : null;
  }, 90000, 400);
  await clock({ paused: true });
  if (!month) throw new Error('no month report after 32 days');
  log.month = month.business.history.at(-1);
  log.story.month1 = Math.round(month.business.cash);
  note(`first month: revenue ${Math.round(log.month.revenue)}, profit ${Math.round(log.month.profit)}, cash ${log.story.month1}`);

  // ── Возвращение: игрок ушёл на неделю, город шёл без него ──
  await page.goto('about:blank');
  await clock({ paused: true, advanceDays: 7 });
  await sleep(1000);
  await page.goto(`${BASE}/brief?world=${worldId}`);
  await page.waitForTimeout(3000);
  if (/brief/.test(page.url())) {
    await shot('brief', 500);
    await rect('briefCash', 'Cash then', 110);
    log.brief = { line: (await text()).match(/(\d+ days since you were here[^$]*?)(?= Cash then)/)?.[1]?.trim() ?? null };
  } else note('no /brief screen in this build');
  await page.goto(`${BASE}/biz?world=${worldId}`);
  await page.waitForTimeout(3000);
  const away = page.getByRole('dialog', { name: /while you were away/i });
  if (await away.count()) {
    await away.getByRole('button', { name: /got it/i }).first().click();
  } else note('no "While you were away" card');

  // ── Управление: цена до нажатия, после двух и после пяти нажатий «+». Прогноз месяца меняется до Apply ──
  if (await tab('Manage')) {
    const plus = page.locator('button', { hasText: /^\+$/ }).first();
    const forecast = page.locator('.bz-forecast').first();
    const read = async (k) => {
      const t = (await forecast.innerText()).replace(/\s+/g, ' ');
      log.frames[k] = t;
      const price = await page.evaluate(() => { const e = [...document.querySelectorAll('body *')].find((n) => n.children.length === 0 && /^\$\d+\.\d\d$/.test(n.textContent.trim())); return e ? e.textContent.trim() : null; });
      return { text: t, price };
    };
    await shot('manage-1', 600);
    await rectOf('forecast1', forecast);
    await rectOf('plus', plus);
    await rect('priceCard', 'per order', 120);
    const a = await read('forecast-1');
    await plus.click(); await plus.click();
    await shot('manage-2', 900);
    const b = await read('forecast-2');
    await plus.click(); await plus.click(); await plus.click();
    await shot('manage-3', 900);
    const c = await read('forecast-3');
    await rectOf('forecast3', forecast);
    await rectOf('plus3', plus);
    await rect('priceCard3', 'per order', 120);
    await rect('profitTile', 'Profit, 30 days', 50);
    await rect('ordersTile', 'Orders a day', 50);
    log.manage = {
      price: [a.price, b.price, c.price],
      profitNow: dollars(c.text, /Profit, 30 days \+?\$([\d,]+)/),
      profitThen: dollars(c.text, /Profit, 30 days \+?\$[\d,]+ → \+?\$([\d,]+)/),
      ordersNow: dollars(c.text, /Orders a day ([\d,]+)/),
      ordersThen: dollars(c.text, /Orders a day [\d,]+ → ([\d,]+)/),
    };
    note(`manage: ${JSON.stringify(log.manage)}`);
    // возвращаем цену: в городе ничего не меняем, пока не нажато Apply
    const minus = page.locator('button', { hasText: /^[−-]$/ }).first();
    for (let i = 0; i < 5; i++) await minus.click();
  }
  // ── Соседи: соперник с ценой ниже нашей, кнопка жалобы, затем лестница призовых мест ──
  if (await tab('Network')) {
    await shot('network-1', 800);
    await rect('rivalCard', 'Your rival', 300);
    await rect('priceRow', 'Price', 30);
    await rectOf('priceRow', page.locator('tr', { hasText: 'Price' }));
    await rectOf('report', page.getByRole('button', { name: /^Report/ }));
    await rect('reportNote', 'If you are right', 40);
    const row = (await page.locator('tr', { hasText: 'Price' }).first().innerText().catch(() => '')).replace(/\s+/g, ' ');
    log.network = { priceRow: row, rival: (await text()).match(/Closest in the table (.+?) AI/)?.[1] ?? null };
    const place = page.getByText('Your place', { exact: true }).first();
    if (await place.count()) {
      await place.evaluate((e) => window.scrollTo(0, window.scrollY + e.getBoundingClientRect().top - 150));
      await shot('network-2', 800);
      await rect('placeCard', 'Your place', 220);
      await rect('prize', 'Prize today', 20);
      await rect('ladder', '(you)', 200);
      await rect('youRow', '(you)', 60);
      // лента «Next door»: жалоба на соседа и проверка инспектора, если город их уже прожил
      await rect('reported', 'reported', 70);
      await rect('inspected', 'inspector', 70);
      await rect('nextDoor', 'Next door', 200);
    }
    note(`network: ${JSON.stringify(log.network)}`);
  }
  save();

  // ── Общий город: живая карта с заведениями и событиями ──
  await page.goto(`${BASE}/city/${worldId}`);
  await shot('city', 4500);
  save();

  // ── Год до конца: касса каждые два месяца — шаги сквозного счётчика ──
  log.story.cash = [];
  for (let i = 0; i < 10; i++) {
    const v = await view(me.token);
    log.story.cash.push({ day: v.world.day, cash: Math.round(v.business?.cash ?? 0), status: v.business?.status });
    if (v.world.phase === 'ended') break;
    await clock({ paused: true, advanceDays: 60 });
    await sleep(600);
  }
  const vEnd = await view(me.token);
  log.story.yearEnd = Math.round(vEnd.business?.cash ?? 0);
  log.seasonEnd = { day: vEnd.world.day, phase: vEnd.world.phase, status: vEnd.business?.status, cash: vEnd.business?.cash, months: vEnd.business?.history?.map((h) => ({ month: h.month, revenue: Math.round(h.revenue), profit: Math.round(h.profit) })) };
  note(`season: day ${vEnd.world.day}, phase ${vEnd.world.phase}, business ${vEnd.business?.status}, cash ${log.story.yearEnd}`);

  // ── Конец сезона и личный план (Pro в тестовом режиме: ключа нет, ничего не списывается) ──
  await page.goto(`${BASE}/pro?world=${worldId}`);
  await page.waitForTimeout(2500);
  const getPro = page.getByRole('button', { name: /Get Pro/i }).first();
  if (await getPro.count()) { await getPro.click(); await page.waitForTimeout(2500); }
  await page.goto(`${BASE}/end?world=${worldId}`);
  await page.waitForTimeout(3500);
  const open = page.getByText('Open my plan').first();
  if (await open.count()) {
    await open.click();
    await shot('plan', 3500);
    const plan = await text();
    log.plan = {
      moneyYouNeed: dollars(plan, /MONEY YOU NEED \$([\d,]+)/i),
      reserve: dollars(plan, /KEEP IN RESERVE \$([\d,]+)/i),
      allIn: dollars(plan, /All in, have \$([\d,]+)/i),
      address: (plan.match(/Maya's Coffee at ([^—]+?) —/) ?? [])[1] ?? null,
    };
    note(`plan: ${JSON.stringify(log.plan)}`);
    await rect('allIn', 'All in, have', 30);
    // Карточка правила: разрешение департамента здравоохранения с ценой, сроком и ссылкой на официальную страницу.
    const rule = page.getByText('NYC Department of Health and Mental Hygiene (DOHMH)').first();
    if (await rule.count()) {
      await rule.evaluate((e) => {
        let n = e; while (n.parentElement && !n.querySelector('a[href^="http"]')) n = n.parentElement;
        n.setAttribute('data-deck-rule', '1');
        window.scrollTo(0, window.scrollY + n.getBoundingClientRect().top - 240);
      });
      const card = page.locator('[data-deck-rule]').first();
      await shot('rule', 900);
      await rectOf('ruleCard', card);
      const link = card.locator('a[href^="http"]').first();
      await rectOf('ruleLink', link);
      log.rule = { href: await link.getAttribute('href'), text: (await card.innerText()).replace(/\s+/g, ' ').slice(0, 500) };
      note(`rule: ${JSON.stringify(log.rule).slice(0, 400)}`);
    } else note('no permit card on the plan');
    await page.screenshot({ path: join(out, 'plan-full.jpg'), type: 'jpeg', quality: 60, fullPage: true });
    writeFileSync(join(out, 'plan.txt'), await page.innerText('body'));
  } else note('no "Open my plan" button');
} catch (e) {
  // что было на экране в момент сбоя — рядом со снимками, в репозиторий не идёт (.gitignore)
  await page.screenshot({ path: join(out, '_error.jpg'), type: 'jpeg', quality: 60 }).catch(() => {});
  note(`FAILED: ${String(e.message).slice(0, 300)}`);
  process.exitCode = 1;
} finally {
  save();
  await browser.close();
}
