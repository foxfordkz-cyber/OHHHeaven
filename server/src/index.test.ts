import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from './index';

let server: Server;
let base = '';

beforeAll(async () => {
  server = await startServer(0, '127.0.0.1', { dataDir: mkdtempSync(join(tmpdir(), 'ohh-')), tick: false });
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(() => new Promise<void>((ok) => server.close(() => ok())));

const post = async (path: string, body: unknown, token?: string) =>
  (await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })).json() as Promise<{ ok: boolean; data?: any; error?: string }>;

describe('server', () => {
  it('GET /api/health answers ok', async () => {
    const r = await fetch(`${base}/api/health`);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { ok: boolean }).ok).toBe(true);
  });
  it('starts with the live and the demo world, lets an owner join and see an owner view', async () => {
    const worlds = (await (await fetch(`${base}/api/worlds`)).json()) as { id: string }[];
    expect(worlds.map((w) => w.id)).toEqual(expect.arrayContaining(['nyc', 'demo']));
    const j = await post('/api/worlds/demo/join', { name: 'Ana', kind: 'owner' });
    expect(j.ok).toBe(true);
    const view = (await (await fetch(`${base}/api/worlds/demo/view`, { headers: { authorization: `Bearer ${j.data.token}` } })).json()) as { kind: string };
    expect(view.kind).toBe('owner');
    const v = (await (await fetch(`${base}/api/worlds/demo/view`)).json()) as { kind: string; world: { version: number } };
    expect(v.kind).toBe('city');
    expect(await (await fetch(`${base}/api/worlds/demo/view?v=${v.world.version}`)).json()).toEqual({ unchanged: true });
  });
});
