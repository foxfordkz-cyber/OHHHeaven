import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { startServer } from './index';

let server: Server;
let base = '';

beforeAll(async () => {
  server = await startServer(0, '127.0.0.1');
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(() => new Promise<void>((ok) => server.close(() => ok())));

describe('server', () => {
  it('GET /api/health answers ok', async () => {
    const r = await fetch(`${base}/api/health`);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { ok: boolean }).ok).toBe(true);
  });
});
