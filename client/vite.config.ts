import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Dev: /api goes to the server of agent 06 (default port 8787; API_URL overrides).
const api = process.env.API_URL ?? 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173, proxy: { '/api': { target: api, changeOrigin: true } } },
  preview: { host: true, port: 4173, proxy: { '/api': { target: api, changeOrigin: true } } },
  build: { outDir: 'dist', emptyOutDir: true },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], restoreMocks: true },
});
