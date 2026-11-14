#!/usr/bin/env node
// End-to-end check against a deployed First Year (round 3, B05): health → page → city → join → opening → a month.
//
//   node scripts/prod-check.mjs https://<your-app>.up.railway.app
//   node scripts/prod-check.mjs http://127.0.0.1:8787 --new-city          # own city, drives its clock: ~20 s
//   node scripts/prod-check.mjs <url> --quick                             # health, page, city, join only
//   node scripts/prod-check.mjs <url> --new-city --remember w.json        # then restart the server and:
//   node scripts/prod-check.mjs <url> --recall w.json                     # the world, the owner and the cafe came back
//
// By default it joins the shared `demo` city as one more owner and never touches that city's clock: people may be
// watching it. A demo day is 2 s, so the opening and the first month take a few minutes of real time.
// --new-city creates a city of its own (POST /api/worlds) and fast-forwards it; every created city keeps one of the
// server's 20 demo slots until the data volume is wiped, so use it on a local or staging server, not on every
// production check. If the server has CLOCK_KEY set, pass it with --clock-key or the CLOCK_KEY variable.
// Exit code 0 — every step passed; 1 — a step failed (the reason is printed under it).
import { readFileSync, writeFileSync } from 'node:fs';

// ───────────── arguments ─────────────
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback; };
const valued = new Set(['wait', 'remember', 'recall', 'clock-key', 'world', 'max-wait']);
const positional = argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1]?.replace(/^--/, '')));
if (flag('help') || flag('h')) {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 19).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}
const BASE = (positional[0] ?? process.env.PROD_URL ?? '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(BASE)) {
  console.error('Usage: node scripts/prod-check.mjs <https://address> [--quick] [--new-city] [--world <id>] [--wait <s>] [--max-wait <s>] [--clock-key <key>] [--remember <file>] [--recall <file>]');
  process.exit(2);
}
const QUICK = flag('quick');
const NEW_CITY = flag('new-city');
const WAIT_S = Number(opt('wait', 0));
const MAX_WAIT_S = Number(opt('max-wait', 480));
const CLOCK_KEY = opt('clock-key', process.env.CLOCK_KEY ?? '');
const REMEMBER = opt('remember', '');
const RECALL = opt('recall', '');
const WORLD = opt('world', 'demo');
const OWNER_NAME = 'Prod Check';

// ───────────── HTTP ─────────────
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function call(method, path, body, token, extra = {}) {
  for (let attempt = 0; ; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20_000);
    let r;
    try {
      r = await fetch(`${BASE}${path}`, {
        method, signal: ctl.signal,
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } finally { clearTimeout(timer); }
    // the server allows 8 requests a second per caller: wait and retry instead of failing the check
    if (r.status === 429 && attempt < 5 && path !== '/api/worlds') { await sleep(1_000 * (attempt + 1)); continue; }
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
    return { status: r.status, json };
  }
}
const get = async (path, token) => (await call('GET', path, undefined, token)).json;
const post = async (path, body, token) => (await call('POST', path, body, token)).json;
async function waitFor(fn, ms, every = 500) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(every);
  }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };
const ack = (r, what) => { must(r && r.ok, `${what}: ${r?.error ?? JSON.stringify(r).slice(0, 200)}`); return r.data; };
const money = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

// ───────────── scenario ─────────────
const ctx = { worldId: WORLD, ownClock: false };
const view = (t) => get(`/api/worlds/${ctx.worldId}/view`, t);
const action = (t, a) => post(`/api/worlds/${ctx.worldId}/action`, a, t);
const query = (t, q) => post(`/api/worlds/${ctx.worldId}/query`, q, t);
const clock = async (b) => (await call('POST', `/api/worlds/${ctx.worldId}/clock`, b, undefined, CLOCK_KEY ? { 'x-clock-key': CLOCK_KEY } : {})).json;
const days = (n) => n * (ctx.dayMs ?? 2_000);

const steps = {
  async health() {
    const h = await waitFor(async () => { try { const r = await get('/api/health'); return r?.ok ? r : null; } catch { return null; } }, WAIT_S * 1_000, 1_000);
    must(h, `GET /api/health did not answer ok${WAIT_S ? ` in ${WAIT_S} s` : ''}`);
    const broken = (h.worlds ?? []).filter((w) => w.errors > 0);
    const stubs = Object.entries(h.stubs ?? {}).filter(([, v]) => v).map(([k]) => k);
    return `up ${h.uptimeS ?? '?'} s; worlds: ${(h.worlds ?? []).map((w) => `${w.id} day ${w.day}`).join(', ')}`
      + (stubs.length ? `; stub modules: ${stubs.join(', ')}${stubs.includes('ai') ? ' (no AI key: AI text uses the offline path)' : ''}` : '')
      + (broken.length ? `; WARNING errors in ${broken.map((w) => `${w.id}: ${w.lastError}`).join('; ')}` : '');
  },
  async page() {
    const r = await fetch(`${BASE}/`);
    const html = await r.text();
    must(r.ok && /<html/i.test(html), `GET / → HTTP ${r.status}: the built client is not served (was npm run build part of the image?)`);
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    must(assets.length > 0, 'index.html links no /assets/ files');
    for (const a of assets.slice(0, 3)) {
      const ar = await fetch(`${BASE}${a}`);
      must(ar.ok, `${a} → HTTP ${ar.status}`);
      await ar.arrayBuffer();
    }
    const deep = await fetch(`${BASE}/city/${WORLD}`);
    must(deep.ok && /<html/i.test(await deep.text()), `a deep link (/city/${WORLD}) → HTTP ${deep.status}: the SPA fallback is missing`);
    return `index.html and ${Math.min(assets.length, 3)} asset(s) served; deep links fall back to the app`;
  },
  async city() {
    if (NEW_CITY) {
      const r = await call('POST', '/api/worlds', { name: 'Prod check' });
      must(r.status !== 429, 'POST /api/worlds → 429: the server already runs 20 demo cities; drop --new-city');
      ctx.worldId = r.json?.data?.id;
      must(ctx.worldId, `POST /api/worlds returned no id: ${JSON.stringify(r.json).slice(0, 160)}`);
      const c = await clock({ paused: true });
      ctx.ownClock = Boolean(c?.ok);
    }
    const list = await get('/api/worlds');
    must(Array.isArray(list) && list.some((w) => w.id === ctx.worldId), `world '${ctx.worldId}' is not in GET /api/worlds (${(list ?? []).map?.((w) => w.id).join(', ')})`);
    const v = await view();
    must(v.kind === 'city', `city view expected, got ${v.kind ?? JSON.stringify(v).slice(0, 120)}`);
    must(v.world?.phase === 'running', `world '${ctx.worldId}' is not running (phase ${v.world?.phase}); a finished demo season restarts within ~10 minutes`);
    ctx.dayMs = v.world.config?.dayMs ?? 2_000;
    ctx.businesses = (v.businesses ?? []).length;
    return `${ctx.worldId} "${v.world.config?.name ?? ''}", day ${v.world.day}, ${ctx.businesses} businesses on the map, a day is ${ctx.dayMs / 1000} s`
      + (NEW_CITY ? (ctx.ownClock ? ', clock under control' : ', clock locked (set --clock-key): real time') : ', clock untouched');
  },
  async join() {
    ctx.me = ack(await post(`/api/worlds/${ctx.worldId}/join`, { name: OWNER_NAME, kind: 'owner' }), 'join');
    must(ctx.me?.token, 'join returned no token');
    const v = await view(ctx.me.token);
    must(v.kind === 'owner', `owner view expected, got ${v.kind}`);
    return `${ctx.me.playerId} joined as "${v.me?.name ?? OWNER_NAME}"`;
  },
  async open() {
    const [places, city] = await Promise.all([get('/api/places'), view()]);
    const taken = new Set((city.businesses ?? []).map((b) => b.placeId));
    const free = places.filter((p) => p.suitableFor?.includes('cafe') && !taken.has(p.id));
    must(free.length > 0, 'no free door suits a cafe');
    // an operating shop for sale opens soonest; the rest need a build-out. Take the affordable kit that opens first.
    const options = [];
    for (const place of [...free.filter((p) => p.forSale), ...free.filter((p) => !p.forSale)].slice(0, 12)) {
      const rec = ack(await query(ctx.me.token, { type: 'recommend_opening', niche: 'cafe', placeId: place.id }), 'recommend_opening');
      must(Array.isArray(rec) && rec.length, 'no recommended kits');
      const kit = rec.find((k) => k.kitId === 'standard') ?? rec[0];
      if (kit.cashLeft >= 0) options.push({ place, kit });
    }
    must(options.length > 0, `none of ${Math.min(free.length, 12)} free doors is affordable with the starting cash`);
    options.sort((x, y) => x.kit.daysToOpen - y.kit.daysToOpen || y.kit.cashLeft - x.kit.cashLeft);
    const { place, kit } = options[0];
    ack(await action(ctx.me.token, { type: 'open_business', niche: 'cafe', placeId: place.id, name: 'Prod Check Coffee', kitId: kit.kitId, size: kit.size, items: kit.items }), 'open_business');
    const v = await view(ctx.me.token);
    must(v.business?.id, 'no business in the owner view after open_business');
    ctx.businessId = v.business.id;
    const wait = kit.daysToOpen;
    if (wait > 0) {
      const early = await action(ctx.me.token, { type: 'launch' });
      must(early?.ok === false, 'launch during the build-out must be refused');
      const day0 = (await view()).world.day;
      if (ctx.ownClock) await clock({ paused: true, advanceDays: wait });
      const ok = await waitFor(async () => (await view()).world.day >= day0 + wait, ctx.ownClock ? 20_000 : Math.min(MAX_WAIT_S * 1_000, days(wait) + 30_000), 1_000);
      must(ok, `the city did not reach day ${day0 + wait} (build-out of ${wait} days)`);
    }
    ack(await action(ctx.me.token, { type: 'launch' }), 'launch');
    const after = await view(ctx.me.token);
    must(after.business?.status === 'open', `business status after launch: ${after.business?.status}`);
    ctx.reportsAtLaunch = after.business.history?.length ?? 0;   // months of build-out already have (empty) reports
    return `"Prod Check Coffee" at ${place.address ?? place.id} (${kit.kitId}, ${kit.size}); ${money(kit.cashLeft)} left; opened after ${wait} day(s)`;
  },
  async month() {
    if (ctx.ownClock) await clock({ paused: false, dayMs: 40 });
    const got = await waitFor(async () => {
      const v = await view(ctx.me.token);
      return (v.business?.history?.length ?? 0) > ctx.reportsAtLaunch ? v : null;
    }, ctx.ownClock ? 90_000 : Math.min(MAX_WAIT_S * 1_000, days(32) + 30_000), 1_500);
    if (ctx.ownClock) await clock({ paused: true });
    must(got, 'no month report after a month of trading');
    const m = got.business.history.at(-1);
    must(Number.isFinite(m.revenue) && Number.isFinite(m.profit), `month report without revenue/profit: ${JSON.stringify(m).slice(0, 160)}`);
    must(m.revenue > 0 && m.servedUnits > 0, `an open cafe sold nothing in a month: revenue ${money(m.revenue)}, served ${m.servedUnits}`);
    must(got.analytics && Number.isFinite(got.analytics.netWorth), 'owner view carries no analytics');
    return `day ${got.world.day}, first month of trading: ${Math.round(m.servedUnits).toLocaleString('en-US')} orders, revenue ${money(m.revenue)}, profit ${money(m.profit)}, net worth ${money(got.analytics.netWorth)}`;
  },
  async recall() {
    const saved = JSON.parse(readFileSync(RECALL, 'utf8'));
    ctx.worldId = saved.worldId;
    const list = await get('/api/worlds');
    must(Array.isArray(list) && list.some((w) => w.id === saved.worldId), `world '${saved.worldId}' did not come back after the restart`);
    const v = await view(saved.token);
    must(v.kind === 'owner', `the owner's token no longer works after the restart (view kind ${v.kind ?? v.error})`);
    must(v.me?.id === saved.playerId, `the token now points at ${v.me?.id}, not ${saved.playerId}`);
    must(v.world.day >= saved.day, `the city went back in time: day ${v.world.day} < saved day ${saved.day}`);
    if (saved.businessId) must(v.business?.id === saved.businessId, `business ${saved.businessId} is gone after the restart`);
    return `world ${saved.worldId} restored at day ${v.world.day} (saved at ${saved.day}); owner token works${saved.businessId ? `; ${saved.businessId} still there` : ''}`;
  },
};

const plan = RECALL ? ['health', 'recall'] : QUICK ? ['health', 'page', 'city', 'join'] : ['health', 'page', 'city', 'join', 'open', 'month'];
const results = [];
let red = false;
const t0 = Date.now();
for (const id of plan) {
  if (red) { results.push({ id, status: 'skip' }); continue; }
  const s0 = Date.now();
  try {
    const detail = await steps[id]();
    results.push({ id, status: 'pass', detail, ms: Date.now() - s0 });
  } catch (e) {
    red = true;
    results.push({ id, status: 'FAIL', detail: e instanceof Error ? e.message : String(e), ms: Date.now() - s0 });
  }
}
if (!red && REMEMBER && ctx.me) {
  const v = await view(ctx.me.token);
  writeFileSync(REMEMBER, JSON.stringify({ base: BASE, worldId: ctx.worldId, token: ctx.me.token, playerId: ctx.me.playerId, businessId: ctx.businessId ?? null, day: v.world.day }, null, 2));
}

const titles = { health: 'GET /api/health', page: 'the game page and its assets', city: 'a city answers', join: 'an owner joins', open: 'opens a cafe and launches it', month: 'a month of play → a month report', recall: 'after a restart the world comes back' };
const icon = { pass: '✔', FAIL: '✖', skip: '·' };
console.log(`\nFirst Year prod check — ${BASE}\n`);
for (const r of results) console.log(`${icon[r.status]} ${titles[r.id].padEnd(40)}${r.ms !== undefined ? ` ${(r.ms / 1000).toFixed(1)} s` : ''}${r.detail ? `\n    ${r.detail}` : ''}`);
if (REMEMBER && !red) console.log(`\nsaved the world, the owner and the cafe to ${REMEMBER}: restart the server, then run with --recall ${REMEMBER}`);
console.log(`\nprod check: ${red ? 'RED' : 'GREEN'} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(red ? 1 : 0);
