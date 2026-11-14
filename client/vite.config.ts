import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Shared types live outside the package until the workspace skeleton (agent 01) lands.
const shared = fileURLToPath(new URL('../shared/src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': shared } },
  server: {
    port: 5173,
    host: true,
    fs: { allow: ['..'] },
    proxy: { '/api': { target: process.env.OHH_API ?? 'http://localhost:3000', changeOrigin: true } },
  },
  preview: { port: 4173, host: true },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], restoreMocks: true },
});
