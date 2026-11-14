// Рабочая нагрузка: N владельцев опрашивают view раз в 2 секунды, у кого есть кафе — иногда меняют распоряжения.
// Запуск: `npx tsx server/scripts/load.ts [http://localhost:8787] [--owners 100] [--seconds 60]`.
// Без адреса поднимает сервер в этом же процессе на свободном порту.
import type { Server } from 'node:http';
import type { CityView, OpenRecommendation, Place } from '@ohh/shared';
import { startServer } from '../src/index';

const args = process.argv.slice(2);
const flag = (name: string, def: number) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : def; };
const OWNERS = flag('owners', 100);
const SECONDS = flag('seconds', 60);
const POLL_MS = flag('poll', 2000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Ack<T = unknown> { ok: boolean; error?: string; data?: T }

async function main(): Promise<void> {
  let base = args.find((a) => a.startsWith('http'));
  let server: (Server & { game: unknown }) | null = null;
  if (!base) {
    server = await startServer(0, '127.0.0.1', { snapshotDir: null, log: () => {} });
    const addr = server.address();
    base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
    console.log(`in-process server on ${base}`);
  }
  const call = async <T>(method: string, path: string, body?: unknown, token?: string) => {
    for (let i = 0; ; i++) {
      const t0 = performance.now();
      const r = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text();
      const ms = performance.now() - t0;
      if (r.status === 429 && i < 20 && !token) { await sleep(300); continue; }
      return { status: r.status, ms, bytes: text.length, body: JSON.parse(text) as T };
    }
  };

  const w = (await call<Ack<{ id: string }>>('POST', '/api/worlds', { name: 'Load test' })).body.data?.id ?? 'demo';
  const places = (await call<Place[]>('GET', '/api/places')).body;
  const city = (await call<CityView>('GET', `/api/worlds/${w}/view`)).body;
  const free = places.filter((p) => p.suitableFor.includes('cafe') && !city.businesses.some((b) => b.placeId === p.id));
  console.log(`world ${w}: ${city.businesses.length} AI businesses, ${free.length} free spaces; joining ${OWNERS} owners…`);

  const owners: { token: string; version?: number; hasBiz: boolean }[] = [];
  for (let i = 0; i < OWNERS; i++) {
    const j = await call<Ack<{ token: string }>>('POST', `/api/worlds/${w}/join`, { name: `Load ${i + 1}`, kind: 'owner' });
    if (!j.body.ok) { console.log(`join ${i + 1} failed: ${j.body.error}`); continue; }
    const token = j.body.data!.token;
    let hasBiz = false;
    const place = free[i];
    if (place) {
      const rec = (await call<Ack<OpenRecommendation[]>>('POST', `/api/worlds/${w}/query`, { type: 'recommend_opening', niche: 'cafe', placeId: place.id }, token)).body.data?.[0];
      if (rec) {
        const o = await call<Ack>('POST', `/api/worlds/${w}/action`, { type: 'open_business', niche: 'cafe', placeId: place.id, name: `Load Cafe ${i + 1}`, kitId: rec.kitId, size: rec.size, items: rec.items }, token);
        if (o.body.ok) { await call('POST', `/api/worlds/${w}/action`, { type: 'launch' }, token); hasBiz = true; }
      }
    }
    owners.push({ token, hasBiz });
  }
  console.log(`${owners.length} owners in, ${owners.filter((o) => o.hasBiz).length} with a cafe; polling every ${POLL_MS} ms for ${SECONDS} s…`);

  const lat: number[] = [];
  let full = 0, unchanged = 0, errors = 0, limited = 0, bytes = 0, actions = 0, actionErrors = 0;
  const statuses: Record<number, number> = {};
  const until = Date.now() + SECONDS * 1000;
  await Promise.all(owners.map(async (o, i) => {
    await sleep((i * POLL_MS) / owners.length);
    let n = 0;
    while (Date.now() < until) {
      const t = Date.now();
      try {
        const r = await call<{ unchanged?: boolean; world?: { version: number } }>('GET', `/api/worlds/${w}/view${o.version !== undefined ? `?v=${o.version}` : ''}`, undefined, o.token);
        statuses[r.status] = (statuses[r.status] ?? 0) + 1;
        if (r.status === 429) limited++;
        else if (r.status !== 200) errors++;
        else {
          lat.push(r.ms);
          bytes += r.bytes;
          if (r.body.unchanged) unchanged++;
          else { full++; o.version = r.body.world?.version; }
        }
        if (o.hasBiz && ++n % 15 === 0) {
          const a = await call<Ack>('POST', `/api/worlds/${w}/action`, { type: 'set_orders', orders: { price: 6.5 + (n % 4) * 0.5 } }, o.token);
          actions++;
          if (!a.body.ok) actionErrors++;
        }
      } catch {
        errors++;
      }
      await sleep(Math.max(0, POLL_MS - (Date.now() - t)));
    }
  }));

  lat.sort((a, b) => a - b);
  const q = (p: number) => lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : NaN;
  const health = (await call<{ worlds: { id: string; day: number; stepMsAvg: number; stepMsMax: number; errors: number }[] }>('GET', '/api/health')).body;
  const ws = health.worlds.find((x) => x.id === w)!;
  const total = full + unchanged;
  console.log('\n=== load result ===');
  console.log(`owners ${owners.length}, view requests ${total} (${(total / SECONDS).toFixed(1)}/s), full ${full}, unchanged ${unchanged}, avg size ${Math.round(bytes / Math.max(1, total) / 1024)} KB`);
  console.log(`latency ms: p50 ${q(0.5).toFixed(1)}, p95 ${q(0.95).toFixed(1)}, p99 ${q(0.99).toFixed(1)}, max ${(lat[lat.length - 1] ?? NaN).toFixed(1)}`);
  console.log(`errors ${errors}, rate-limited ${limited}, actions ${actions} (failed ${actionErrors}), statuses ${JSON.stringify(statuses)}`);
  console.log(`world ${w}: day ${ws.day}, step avg ${ws.stepMsAvg} ms, max ${ws.stepMsMax} ms, step errors ${ws.errors}`);
  const pass = errors === 0 && limited === 0 && q(0.95) < 100 && ws.errors === 0;
  console.log(pass ? 'PASS: p95 < 100 ms, no errors' : 'FAIL');
  if (server) { (server as unknown as { game: { stopAll(): void } }).game.stopAll(); server.close(); }
  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
