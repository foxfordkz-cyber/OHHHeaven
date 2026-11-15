#!/usr/bin/env node
// Управление городом показа одной командой (docs/pitch/RUNBOOK.md):
//   node scripts/pitch-ctl.mjs status | pause | resume [мс на день] | speed <мс на день> | advance <дней> | reset
//   node scripts/pitch-ctl.mjs branch price|seats | complaint | build | codes
// Сервер — PITCH_URL (по умолчанию http://127.0.0.1:8787), ключ часов — CLOCK_KEY.
const BASE = (process.env.PITCH_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const KEY = process.env.CLOCK_KEY ?? '';
const [cmd = 'status', arg] = process.argv.slice(2);

const bodies = {
  status: () => ({ command: 'status' }),
  pause: () => ({ command: 'pause' }),
  resume: () => ({ command: 'resume', ...(arg ? { dayMs: Number(arg) } : { dayMs: 1000 }) }),
  speed: () => ({ command: 'speed', dayMs: Number(arg) }),
  advance: () => ({ command: 'advance', days: Number(arg ?? 1) }),
  reset: () => ({ command: 'reset' }),
  branch: () => ({ command: 'branch', branch: arg }),
  complaint: () => ({ command: 'complaint', run: true, ...(arg ? { dayMs: Number(arg) } : {}) }),
};

async function call(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(KEY ? { 'x-clock-key': KEY } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
  if (!j.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j.data;
}

function show(d) {
  const m = d.summary?.maya;
  const v = d.summary?.viktor;
  console.log(`${d.worldId}: day ${d.day} (${d.date}) ${d.paused ? 'PAUSED' : `RUNNING ${d.dayMs} ms/day`}${d.atStart ? ' — prepared moment' : ''}`);
  if (m) console.log(`  ${m.business}: cash $${m.cash.toLocaleString('en-US')}, price $${m.price.toFixed(2)}, ${m.seats} seats`);
  if (v) console.log(`  ${v.business}: cash $${v.cash.toLocaleString('en-US')}, shortcuts ${v.shortcuts.join(', ') || 'none'}`);
  if (d.complaint) console.log(`  complaint ${d.complaint.caseId}: ${d.complaint.status}${d.complaint.official ? ` (${d.complaint.official})` : ''}${d.complaint.found.length ? `, found ${d.complaint.found.join(', ')}` : ''}${d.complaint.fine ? `, fine $${Math.round(d.complaint.fine).toLocaleString('en-US')}` : ''}`);
  const bad = d.checks.filter((c) => !c.ok);
  console.log(`  checks: ${d.checks.length - bad.length}/${d.checks.length}${bad.length ? ` — ${bad.map((c) => `${c.level === 'must' ? 'FAIL' : 'WARN'} ${c.id}`).join(', ')}` : ''}`);
}

function codes(d) {
  const j = d.join;
  console.log(`Guest:  ${j.guest.url}   (code ${j.guest.code}, QR ${j.guest.qr})`);
  console.log(`Maya:   ${j.maya ? `${j.maya.url}   (code ${j.maya.code})` : 'hidden — set CLOCK_KEY'}`);
  console.log(`Viktor: ${j.viktor ? `${j.viktor.url}   (code ${j.viktor.code})` : 'hidden — set CLOCK_KEY'}`);
  console.log(`Enter a code: ${j.enter}   ·   Presenter desk: ${j.base}/pitch`);
}

try {
  if (cmd === 'build' || cmd === 'rebuild') {
    console.log('Building the pitch city (about 20–25 seconds)…');
    const d = await call('POST', '/api/worlds', { scenario: 'pitch', fresh: cmd === 'rebuild' });
    show(d.pitch);
    codes(d.pitch);
  } else if (cmd === 'codes') {
    codes(await call('GET', `/api/worlds/pitch/pitch${KEY ? `?key=${encodeURIComponent(KEY)}` : ''}`));
  } else if (bodies[cmd]) {
    show(await call('POST', '/api/worlds/pitch/pitch', bodies[cmd]()));
  } else {
    console.log('Commands: build | rebuild | status | codes | pause | resume [ms] | speed <ms> | advance <days> | reset | branch price|seats | complaint [ms]');
    process.exit(2);
  }
} catch (e) {
  console.error(`ERROR: ${e.message}`);
  process.exit(1);
}
