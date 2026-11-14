// Точка входа: `npm run dev -w @ohh/server` или `npm start`. Порт — PORT (по умолчанию 8787).
import { startServer } from './index';

process.on('unhandledRejection', (e) => console.error('[server] unhandled rejection:', e));
process.on('uncaughtException', (e) => console.error('[server] uncaught exception:', e));

const server = await startServer();
const addr = server.address();
const port = typeof addr === 'object' && addr ? addr.port : addr;
for (const w of server.game.runtimes.values()) {
  const s = w.stats();
  console.log(`[server] world ${s.id}: day ${s.day}, ${s.businesses} businesses, ${s.dayMs} ms per day${s.paused ? ' (paused)' : ''}`);
}
console.log(`First Year server on http://localhost:${port} (health: /api/health)`);

const shutdown = (sig: string) => {
  console.log(`[server] ${sig}: saving snapshots`);
  server.game.stopAll();
  server.game.saveAllSync();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
