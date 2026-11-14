// Real-server check of agent 12's screens: the Network tab of /biz and the official's /desk, clicked in a browser.
// Not part of `npm test` (it needs a running server and Playwright). How to run, from the repository root:
//   npm run build && npm start                 # the game on http://127.0.0.1:8787 (another terminal)
//   node client/src/screens/network/e2e/real-server.cjs [screenshots dir]
// Optional: OHH_URL=http://host:port. It pauses the demo clock, adds two owners (a cafe and a barbershop on one block)
// and an inspector through the API, then does everything agent 12 owns in the browser and checks the result in the view:
// propose_deal (cross-promo) → answer_deal (accept) → set_orders blockFund → report → take_case → inspection on /desk.
const os = require('node:os');
const { chromium } = require('playwright');

const BASE = process.env.OHH_URL ?? 'http://127.0.0.1:8787';
const W = 'demo';
const OUT = process.argv[2] ?? os.tmpdir();
const RUN = String(Date.now() % 10000);
const NAME_A = `Alex Cafe ${RUN}`;
const NAME_B = `Bea Cuts ${RUN}`;

async function call(method, path, body, token) {
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return r.json().catch(() => null);
}
const unwrap = (j) => (j && typeof j === 'object' && 'ok' in j && 'data' in j ? j.data : j);
const ack = (j, what) => { if (!j || !j.ok) throw new Error(`${what}: ${JSON.stringify(j).slice(0, 200)}`); return j.data; };
const view = async (t) => unwrap(await call('GET', `/api/worlds/${W}/view`, undefined, t));
const action = (t, a) => call('POST', `/api/worlds/${W}/action`, a, t);
const query = (t, q) => call('POST', `/api/worlds/${W}/query`, q, t);
const clock = (b) => call('POST', `/api/worlds/${W}/clock`, b);
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const meters = (a, b) => { const R = 6371000, r = (x) => (x * Math.PI) / 180; const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng); const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const log = (...a) => console.log(...a);

async function open(token, niche, place, name) {
  const rec = ack(await query(token, { type: 'recommend_opening', niche, placeId: place.id }), `recommend ${name}`);
  const kit = rec.find((k) => k.kitId === 'standard') ?? rec[0];
  ack(await action(token, { type: 'open_business', niche, placeId: place.id, name, kitId: kit.kitId, size: kit.size, items: kit.items }), `open ${name}`);
  ack(await action(token, { type: 'launch' }), `launch ${name}`);
  return (await view(token)).business;
}

/** A phone-sized browser signed in as this player (the session format of client/src/app/session.ts). */
async function pageFor(browser, session) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((s) => {
    localStorage.setItem('ohh.sessions.v1', JSON.stringify({ [`remote:${s.worldId}`]: s }));
    localStorage.setItem('ohh.mode.v1', 'remote');
  }, session);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('  PAGE ERROR', String(e)));
  return page;
}

/** Agent 10's «While you were away» card covers /biz after skipped days: close it like a player would. */
async function dismissAway(page) {
  const away = page.getByRole('dialog', { name: 'While you were away' });
  if (await away.count()) { await away.getByRole('button', { name: 'Got it' }).click(); await sleep(200); }
}

(async () => {
  const results = [];
  const step = (name, ok, note = '') => { results.push({ name, ok }); log(`${ok ? 'OK  ' : 'FAIL'} ${name}${note ? ' — ' + note : ''}`); };

  await clock({ paused: true });
  const a = ack(await call('POST', `/api/worlds/${W}/join`, { name: 'Alex Tester', kind: 'owner' }), 'join A');
  const b = ack(await call('POST', `/api/worlds/${W}/join`, { name: 'Bea Tester', kind: 'owner' }), 'join B');
  const places = unwrap(await call('GET', '/api/places'));
  const taken = new Set((await view()).businesses.map((x) => x.placeId));
  let pa = null; let pb = null;
  for (const p of places.filter((x) => x.suitableFor.includes('cafe') && !taken.has(x.id))) {
    const near = places.find((q) => q.id !== p.id && !taken.has(q.id) && q.suitableFor.includes('barbershop') && q.block === p.block && meters(p, q) < 350);
    if (near) { pa = p; pb = near; break; }
  }
  if (!pa) throw new Error('no free cafe + barbershop pair on one block');
  const bizA = await open(a.token, 'cafe', pa, NAME_A);
  const bizB = await open(b.token, 'barbershop', pb, NAME_B);
  log(`${bizA.name} at ${pa.address}; ${bizB.name} at ${pb.address}; ${Math.round(meters(pa, pb))} m apart`);
  await clock({ advanceDays: 2 });

  const browser = await chromium.launch();
  const pA = await pageFor(browser, { worldId: W, playerId: a.playerId, token: a.token, name: 'Alex Tester', kind: 'owner' });
  await pA.goto(`${BASE}/biz/network`, { waitUntil: 'networkidle' });
  await pA.getByRole('region', { name: 'Neighbors' }).waitFor({ timeout: 15000 });
  await dismissAway(pA);
  await pA.screenshot({ path: `${OUT}/network-owner-a.png`, fullPage: true });
  step('Network tab opens', true, `${await pA.getByRole('region', { name: 'Neighbors' }).locator('.list-row').count()} neighbor rows`);

  // 1. A proposes a cross-promo to B (different niche, same block)
  await pA.getByRole('button', { name: new RegExp(`^${NAME_B}`) }).click();
  await pA.getByRole('dialog', { name: NAME_B }).getByRole('button', { name: /Propose a deal/ }).click();
  const sheet = pA.getByRole('dialog', { name: `Deal with ${NAME_B}` });
  await sheet.getByRole('radio', { name: /^Cross-promo/ }).click();
  await sheet.getByRole('button', { name: 'Send offer' }).click();
  await sleep(800);
  const deal = (await view(a.token)).deals.find((d) => d.toBusinessId === bizB.id && d.status === 'proposed');
  step('propose_deal (cross_promo) reaches the engine', Boolean(deal), deal ? `${deal.id} ${JSON.stringify(deal.terms)}` : '');
  await sheet.getByRole('button', { name: 'Done' }).click();

  // 2. B accepts in its own browser
  const pB = await pageFor(browser, { worldId: W, playerId: b.playerId, token: b.token, name: 'Bea Tester', kind: 'owner' });
  await pB.goto(`${BASE}/biz/network`, { waitUntil: 'networkidle' });
  await pB.getByRole('region', { name: 'Neighbors' }).waitFor({ timeout: 15000 });
  await dismissAway(pB);
  const offers = pB.getByRole('region', { name: 'Offers for you' });
  await offers.waitFor({ timeout: 15000 });
  await offers.locator(`[data-deal="${deal.id}"]`).getByRole('button', { name: 'Accept' }).click();
  await sleep(800);
  step('answer_deal (accept) makes the deal active', (await view(b.token)).deals.find((d) => d.id === deal.id)?.status === 'active');

  // 3. A chips in to the block fund
  await pA.reload({ waitUntil: 'networkidle' });
  await dismissAway(pA);
  const fund = pA.getByRole('region', { name: 'Block fund' });
  if (await fund.count()) {
    await fund.locator('label.toggle').click();
    await sleep(800);
    step('set_orders blockFund from the toggle', (await view(a.token)).business.orders.blockFund === true);
  } else step('block fund card shown', false);

  // 4. A reports B to the city; the weekly limit follows
  await pA.getByRole('region', { name: 'Report to the city' }).getByRole('button', { name: /Report a business/ }).click();
  const rs = pA.getByRole('dialog', { name: 'Report to the city' });
  await rs.getByRole('combobox', { name: 'Business' }).selectOption(bizB.id);
  await rs.locator('input[type="radio"][value="report_unsanitary"]').check();
  await rs.getByRole('button', { name: /Send report/ }).click();
  await sleep(800);
  step('report sent from the sheet', (await rs.getByRole('status').count()) > 0);
  await rs.getByRole('button', { name: 'Done' }).click();
  await pA.reload({ waitUntil: 'networkidle' });
  await dismissAway(pA);
  const card = pA.getByRole('region', { name: 'Report to the city' });
  const text = (await card.textContent()).replace(/\s+/g, ' ');
  step('report in history, weekly limit with the next date', /Report filed/.test(text) && (await card.getByRole('button', { name: /Report a business/ }).isDisabled()) && /One report a week\. Your next report:/.test(text));
  await pA.screenshot({ path: `${OUT}/network-owner-a-after.png`, fullPage: true });

  // 5. An inspector takes the case at /desk and sees the inspection result
  const o = ack(await call('POST', `/api/worlds/${W}/join`, { name: 'Dana Tester', kind: 'official', role: 'inspector' }), 'join official');
  const myCase = (await view(o.token)).queue.find((c) => c.business.id === bizB.id);
  const pO = await pageFor(browser, { worldId: W, playerId: o.playerId, token: o.token, name: 'Dana Tester', kind: 'official', role: 'inspector' });
  await pO.goto(`${BASE}/desk`, { waitUntil: 'networkidle' });
  await pO.getByRole('region', { name: 'Case queue' }).waitFor({ timeout: 15000 });
  step('the report reached the inspector queue', Boolean(myCase));
  if (myCase) {
    await pO.locator(`[data-case="${myCase.caseId}"]`).getByRole('button', { name: /Take case/ }).click();
    await sleep(800);
    step('take_case from /desk', (await view(o.token)).mine.find((c) => c.caseId === myCase.caseId)?.status === 'taken');
    await clock({ advanceDays: 2 });
    await pO.reload({ waitUntil: 'networkidle' });
    await pO.getByRole('region', { name: 'My cases' }).waitFor();
    const after = (await view(o.token)).mine.find((c) => c.caseId === myCase.caseId);
    const row = (await pO.locator(`[data-case="${myCase.caseId}"]`).textContent()).replace(/\s+/g, ' ');
    step('inspection result on /desk', Boolean(after) && after.status !== 'taken' && (after.status === 'closed' || /Fine notice sent|offers you/.test(row)), `status ${after?.status}`);
    await pO.screenshot({ path: `${OUT}/desk-after.png`, fullPage: true });
  }

  await browser.close();
  log(`\n${results.filter((r) => r.ok).length} of ${results.length} steps OK; screenshots in ${OUT}`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})().catch((e) => { console.error('ERROR', e); process.exit(2); });
