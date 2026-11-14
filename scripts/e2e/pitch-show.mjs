#!/usr/bin/env node
// The five-minute stage show (docs/pitch/RUNBOOK.md, docs/pitch/LIVE-SHOW.md) played in real browsers:
// Maya's phone, Viktor's phone, the projector (guest code) and the presenter desk (/pitch).
// Maya raises her price on the phone, reports Viktor from the Network tab, the desk runs the city to the notice,
// Viktor pays the fine on his phone, the desk goes back to the start. Screenshots of every screen the audience sees.
//
//   node scripts/e2e/pitch-show.mjs                                  # own server with PITCH=1 and a clock key
//   node scripts/e2e/pitch-show.mjs --url https://… --key <CLOCK_KEY>  # the deployed pitch city (it is reset at the end)
//   options: --branch price|seats  --root <checkout>  --out <dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HERE, chromium, opt, sleep, stamp, startServer } from './lib.mjs';

const ROOT = opt('root', HERE);
const OUT = opt('out', join(HERE, 'docs/qa/runs', `${stamp()}-pitch`));
const KEY = opt('key', process.env.CLOCK_KEY ?? 'stage-key');
let base = (opt('url', process.env.PITCH_URL ?? '') || '').replace(/\/$/, '');
// The jury picks one of two branches on stage: "price" (about +10%) or "seats" (+6 seats).
const BRANCH = opt('branch', 'price');

const rows = [];
const t0 = Date.now();
const mark = (ok, what, note = '') => {
  rows.push({ s: Math.round((Date.now() - t0) / 100) / 10, ok, what, note });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${String(Math.round((Date.now() - t0) / 1000)).padStart(4)} s  ${what}${note ? ' — ' + note : ''}`);
};
async function pitch(method, body) {
  const r = await fetch(`${base}/api/worlds/pitch/pitch${method === 'GET' ? `?key=${encodeURIComponent(KEY)}` : ''}`, {
    method, headers: { 'content-type': 'application/json', 'x-clock-key': KEY }, body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
  return j;
}
const textOf = async (page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
/** The view the phone sees, with the token the phone keeps in localStorage after /p/<code>. */
async function phoneView(page) {
  const token = await page.evaluate(() => { const all = JSON.parse(localStorage.getItem('ohh.sessions.v1') ?? '{}'); return Object.values(all).find((x) => x?.worldId === 'pitch')?.token ?? null; });
  if (!token) return null;
  const r = await fetch(`${base}/api/worlds/pitch/view`, { headers: { authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => null);
  return j && 'ok' in j ? j.data : j;
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  const server = base ? null : await startServer(ROOT, () => {}, { PITCH: '1', CLOCK_KEY: KEY });
  if (server) base = server.url;
  console.log(`Pitch show against ${base}; out ${relative(HERE, OUT)}`);

  // 1. The pitch city is built (about 20–25 s of engine work) and its checks pass.
  let st = null;
  for (let i = 0; i < 120; i++) { const j = await pitch('GET'); if (j.ok && j.data?.join) { st = j.data; break; } await sleep(1000); }
  if (!st) { mark(false, 'pitch city ready', 'not built in 120 s'); return finish(server); }
  const bad = (st.checks ?? []).filter((c) => !c.ok);
  mark(!bad.some((c) => c.level === 'must'), 'pitch city ready', `day ${st.day} (${st.date}); checks ${st.checks.length - bad.length}/${st.checks.length}${bad.length ? ` — ${bad.map((c) => `${c.level === 'must' ? 'FAIL' : 'WARN'} ${c.id}`).join(', ')}` : ''}`);
  const j = st.join;
  // The codes carry the server's own address; the browser goes to the address the run uses.
  const local = (u) => u.replace(/^https?:\/\/[^/]+/, base);

  const browser = await chromium.launch();
  const phone = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
  const wide = { viewport: { width: 1440, height: 900 } };
  const errors = [];
  const open = async (opts, name) => {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${name}: ${String(e).slice(0, 160)}`));
    return { ctx, page };
  };
  const shot = (page, name) => page.screenshot({ path: join(OUT, `${name}.png`) }).catch(() => {});

  try {
    // 2. Phones and projector open by code.
    const maya = await open(phone, 'maya');
    await maya.page.goto(local(j.maya.url), { waitUntil: 'domcontentloaded' });
    await maya.page.getByRole('tablist', { name: 'My business' }).waitFor({ timeout: 20000 });
    await sleep(1200);
    const mt = await textOf(maya.page);
    await shot(maya.page, '01-maya-today');
    mark(/Maya/.test(mt), "Maya's phone: /p/<code> opens her cafe", (mt.match(/Packed[^.]*\./) ?? ['no "Packed" note on Today'])[0]);

    const viktor = await open(phone, 'viktor');
    await viktor.page.goto(local(j.viktor.url), { waitUntil: 'domcontentloaded' });
    await viktor.page.getByRole('tablist', { name: 'My business' }).waitFor({ timeout: 20000 });
    await sleep(800);
    mark(/Viktor/.test(await textOf(viktor.page)), "Viktor's phone: /p/<code> opens his cafe");

    const proj = await open(wide, 'projector');
    await proj.page.goto(local(j.guest.url), { waitUntil: 'domcontentloaded' });
    await sleep(3000);
    await shot(proj.page, '02-projector');
    const pt = await textOf(proj.page);
    mark(/Maya|Viktor/.test(pt) && !/Join|Pay \$/.test(pt.slice(0, 200)), 'projector: guest code shows the city without an owner', pt.slice(0, 100));

    const qr = await fetch(local(j.guest.qr));
    mark(qr.ok && /svg/.test(qr.headers.get('content-type') ?? ''), 'QR for the jury', `${qr.status} ${qr.headers.get('content-type')}`);

    const desk = await open(wide, 'desk');
    await desk.page.goto(`${base}/pitch`, { waitUntil: 'domcontentloaded' });
    const keyBox = desk.page.locator('#key');
    if (await keyBox.count()) { await keyBox.fill(KEY); await desk.page.locator('#savekey').click(); await sleep(800); }
    await shot(desk.page, '03-desk');
    const buttons = await desk.page.locator('button[data-cmd]').allInnerTexts();
    mark(buttons.length >= 6, 'presenter desk /pitch with the key', buttons.map((b) => b.trim()).join(' · ').slice(0, 160));

    // 3. 1:40–2:00 — the jury's branch on Maya's phone: about +10% price, or +6 seats; she sees the forecast and applies.
    const mp = maya.page;
    await mp.getByRole('tab', { name: /^Manage/ }).first().click();
    await sleep(1200);
    if (BRANCH === 'seats') {
      const s0 = st.summary?.maya?.seats ?? 0;
      await mp.getByRole('button', { name: /^Resize$/ }).first().click({ timeout: 5000 });
      const rz = mp.getByRole('dialog', { name: /Resize the room/ });
      const more = rz.getByRole('button', { name: /^(More|Increase) / }).first();
      for (let i = 0; i < 6; i++) await more.click();
      await sleep(1500);
      const said = (await rz.innerText()).replace(/\s+/g, ' ');
      await shot(mp, '04-maya-seats');
      await rz.getByRole('button', { name: /^Resize to/ }).click({ timeout: 5000 });
      await sleep(1500);
      const s1 = (await pitch('POST', { command: 'status' })).data?.summary?.maya?.seats;
      mark(s1 > s0, 'branch "more seats" from Maya\'s phone', `seats ${s0} → ${s1}; sheet: "${said.slice(0, 160)}"`);
    } else {
      const p0 = st.summary?.maya?.price ?? 0;
      const inc = mp.getByRole('button', { name: /^(More|Increase) price$/ }).first();
      for (let i = 0; i < Math.max(1, Math.round(p0)); i++) await inc.click(); // the stepper moves 10 cents: price × 10% / $0.10
      await sleep(1800);
      const fc = ((await textOf(mp)).match(/Next 30 days[^.]{0,200}|Projected month[^.]{0,160}/) ?? [''])[0];
      await shot(mp, '04-maya-forecast');
      await mp.locator('.bz-savebar').getByRole('button', { name: /Save settings|^Apply/ }).first().click({ timeout: 5000 });
      await sleep(1200);
      const p1 = (await pitch('POST', { command: 'status' })).data?.summary?.maya?.price;
      mark(p1 > p0, 'branch "higher price" from Maya\'s phone', `price $${p0.toFixed(2)} → $${(p1 ?? 0).toFixed(2)}; forecast "${fc.slice(0, 140)}"`);
    }

    // 4. 2:40 — Maya reports Viktor from the Network tab.
    await mp.getByRole('tab', { name: /^Network/ }).first().click();
    await sleep(1200);
    await mp.getByRole('button', { name: /Viktor/ }).first().click({ timeout: 8000 });
    const sheet = mp.getByRole('dialog', { name: /Viktor/ }).last();
    await sheet.getByRole('button', { name: /Report/ }).first().click({ timeout: 5000 });
    const rs = mp.getByRole('dialog').last();
    const reason = rs.getByRole('radio', { name: /off-the-books wages|unpaid taxes/ });
    if (await reason.count()) await reason.first().click(); else await rs.locator('input[type="radio"][value*="wage"], input[type="radio"]').first().check();
    await shot(mp, '05-maya-report');
    await rs.getByRole('button', { name: /^Send report/ }).last().click({ timeout: 5000 });
    await sleep(1500);
    const sent = ((await textOf(mp)).match(/Report filed[^.]*\.?|Report sent[^.]*\.?/) ?? [''])[0];
    const st3 = (await pitch('POST', { command: 'status' })).data;
    mark(Boolean(sent), 'Maya reports Viktor from her phone', `${sent || 'no "Report filed" on her screen'}; the desk ${st3?.complaint ? `tracks case ${st3.complaint.caseId}` : 'does NOT track a report filed from the phone (its status shows only the desk\'s own complaint)'}`);

    // 5. 2:40–3:00 — the desk runs the city at a day a second; the notice is watched on Viktor's side (his view), then pause.
    const vNotices = async () => ((await phoneView(viktor.page))?.notices ?? []).filter((n) => (n.fine ?? 0) > 0);
    const before = (await vNotices()).length;
    await pitch('POST', { command: 'resume', dayMs: 1000 });
    let notice = null; let waited = 0;
    for (let i = 0; i < 45 && !notice; i++) { await sleep(1000); waited++; const ns = await vNotices(); if (ns.length > before) notice = ns[ns.length - 1]; }
    const st4 = (await pitch('POST', { command: 'pause' })).data;
    mark(Boolean(notice), 'the inspection ends with a fine notice to Viktor', notice ? `after ${waited} s at a day a second; fine $${Math.round(notice.fine)}${notice.violations ? `; ${JSON.stringify(notice.violations).slice(0, 80)}` : ''}; desk auto-pause ${st4?.paused ? 'not needed (paused by the run)' : ''}` : `no notice in ${waited} s`);

    // 6. 3:00–3:20 — Viktor pays the fine on his phone.
    const vp = viktor.page;
    await vp.reload({ waitUntil: 'domcontentloaded' });
    await vp.getByRole('tablist', { name: 'My business' }).waitFor({ timeout: 20000 });
    await sleep(1200);
    const away = vp.getByRole('dialog', { name: 'While you were away' });
    if (await away.count()) await away.getByRole('button', { name: /Got it/ }).click().catch(() => {});
    const cash0 = (await phoneView(vp))?.business?.cash;
    const pay = vp.getByRole('button', { name: /^Pay \$/ }).first();
    await pay.waitFor({ timeout: 10000 });
    await shot(vp, '06-viktor-notice');
    await pay.click();
    await sleep(1200);
    const cash1 = (await phoneView(vp))?.business?.cash;
    mark(cash1 < cash0, "Viktor pays the fine on his phone", `cash $${Math.round(cash0)} → $${Math.round(cash1 ?? 0)}`);

    // 7. After the show — back to the start.
    const r = await pitch('POST', { command: 'reset' });
    mark(Boolean(r.ok && r.data?.atStart && r.data?.paused && !r.data?.complaint), 'Back to start', r.ok ? `day ${r.data.day}, ${r.data.paused ? 'paused' : 'RUNNING'}, complaint ${r.data.complaint ? 'still there' : 'gone'}` : r.error);
    await maya.page.reload({ waitUntil: 'domcontentloaded' });
    await maya.page.getByRole('tablist', { name: 'My business' }).waitFor({ timeout: 20000 }).then(() => mark(true, "after reset Maya's phone is still in her cafe")).catch(() => mark(false, "after reset Maya's phone is still in her cafe"));
  } catch (e) {
    mark(false, 'stopped', String(e.message ?? e).split('\n')[0].slice(0, 200));
  }
  if (errors.length) mark(false, 'page errors', errors.slice(0, 3).join(' | '));
  await browser.close();
  finish(server);
})().catch((e) => { console.error(e); process.exit(2); });

function finish(server) {
  const failed = rows.filter((r) => !r.ok).length;
  const md = [`# Pitch show in browsers — ${new Date().toISOString().slice(0, 16)} UTC`, '', `Server ${base}. Screenshots next to this file.`, '', `${rows.length - failed} of ${rows.length} OK.`, '',
    '| s | Result | Step | Note |', '|---|---|---|---|', ...rows.map((r) => `| ${r.s} | ${r.ok ? 'OK' : '**FAIL**'} | ${r.what} | ${r.note.replace(/\|/g, '/')} |`)];
  writeFileSync(join(OUT, 'PITCH.md'), md.join('\n') + '\n');
  console.log(`\n${rows.length - failed} of ${rows.length} OK. ${relative(HERE, join(OUT, 'PITCH.md'))}`);
  server?.stop();
  process.exit(failed ? 1 : 0);
}
