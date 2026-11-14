// @ohh-stub — placeholder by agent 01 (HTTP from build/CONTRACT.md §6). Owner: agent 06 replaces this file.
import express from 'express';
import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const CLIENT_DIST = resolve(here, '../../client/dist');

export function createApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, name: 'First Year', stub: true });
  });
  if (existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(resolve(CLIENT_DIST, 'index.html')));
  }
  return app;
}

export function startServer(port = Number(process.env.PORT ?? 8787), host = process.env.HOST ?? '0.0.0.0'): Promise<Server> {
  const app = createApp();
  return new Promise((ok) => {
    const server = app.listen(port, host, () => ok(server));
  });
}
