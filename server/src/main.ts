import { startServer } from './index';

const server = await startServer();
const addr = server.address();
const port = typeof addr === 'object' && addr ? addr.port : addr;
console.log(`First Year server on http://localhost:${port} (health: /api/health)`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
