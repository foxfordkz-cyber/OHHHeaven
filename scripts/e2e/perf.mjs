#!/usr/bin/env node
// How fast the first screen is usable: bytes over the wire, time until the idea field can be typed in, long tasks.
// Two profiles: a desktop on a fast line, and a phone the way Lighthouse tests mobile ("Slow 4G": 1.6 Mbit/s down,
// 750 kbit/s up, 150 ms round trip, CPU slowed 4×).
//
//   node scripts/e2e/perf.mjs                  # own server
//   node scripts/e2e/perf.mjs --url https://…   # a deployed game (the real numbers: compression and CDN are the host's)
//   options: --path /  --root <checkout>
import { HERE, chromium, opt, sleep, startServer } from './lib.mjs';

const ROOT = opt('root', HERE);
const PATH = opt('path', '/');
const base = { url: (opt('url', process.env.E2E_URL ?? '') || '').replace(/\/$/, '') };

const PROFILES = [
  { name: 'desktop, fast line', width: 1440, height: 900, mobile: false, net: null, cpu: 1 },
  { name: 'phone, Slow 4G, CPU ×4', width: 375, height: 812, mobile: true, net: { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }, cpu: 4 },
];

async function measure(browser, p) {
  const ctx = await browser.newContext({ viewport: { width: p.width, height: p.height }, isMobile: p.mobile, hasTouch: p.mobile });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (p.net) await cdp.send('Network.emulateNetworkConditions', p.net);
  if (p.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.cpu });
  const sizes = new Map();
  const urls = new Map();
  cdp.on('Network.responseReceived', (e) => urls.set(e.requestId, { url: e.response.url, enc: e.response.headers['content-encoding'] ?? e.response.headers['Content-Encoding'] ?? '' }));
  cdp.on('Network.loadingFinished', (e) => sizes.set(e.requestId, e.encodedDataLength));
  await page.addInitScript(() => {
    window.__lt = 0; window.__lcp = 0;
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt += e.duration - 50; }).observe({ type: 'longtask', buffered: true });
      new PerformanceObserver((l) => { const e = l.getEntries().at(-1); if (e) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch { /* older engines */ }
  });
  const t0 = Date.now();
  await page.goto(base.url + PATH, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const dcl = Date.now() - t0;
  let ready = null;
  try { await page.locator('#idea').waitFor({ state: 'visible', timeout: 120000 }); ready = Date.now() - t0; } catch { /* not on this page */ }
  await sleep(5000);
  const m = await page.evaluate(() => ({ lcp: Math.round(window.__lcp), longTasks: Math.round(window.__lt) }));
  let total = 0; const big = [];
  for (const [id, n] of sizes) { total += n; const u = urls.get(id); if (u && n > 150_000) big.push(`${u.url.replace(base.url, '').slice(0, 60)} ${Math.round(n / 1024)} KB${u.enc ? ` (${u.enc})` : ' (not compressed)'}`); }
  await ctx.close();
  return { profile: p.name, requests: sizes.size, kb: Math.round(total / 1024), dclMs: dcl, ideaReadyMs: ready, lcpMs: m.lcp, longTasksMs: m.longTasks, big };
}

(async () => {
  const server = base.url ? null : await startServer(ROOT);
  if (server) base.url = server.url;
  const browser = await chromium.launch();
  console.log(`${base.url}${PATH}`);
  for (const p of PROFILES) {
    const r = await measure(browser, p);
    console.log(`\n${r.profile}: ${r.requests} requests, ${r.kb} KB over the wire; DOM ready ${r.dclMs} ms; idea field ready ${r.ideaReadyMs ?? '—'} ms; LCP ${r.lcpMs} ms; long tasks ${r.longTasksMs} ms in the first seconds`);
    for (const b of r.big) console.log(`  ${b}`);
  }
  await browser.close();
  server?.stop();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(2); });
