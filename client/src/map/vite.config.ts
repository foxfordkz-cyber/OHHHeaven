// Dev harness for agent 09 until the client shell (agent 08) exists.
// Pages: /dev/map/ and /dev/city/ on fixtures.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(here, '../../..');

export default defineConfig({
  root: here,
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { host: true, port: 5179, fs: { allow: [repo] } },
  preview: { host: true, port: 5179 },
  build: {
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
    rollupOptions: { input: { map: resolve(here, 'dev/map/index.html'), city: resolve(here, 'dev/city/index.html') } },
  },
  test: { environment: 'node', include: ['**/*.test.ts', '../screens/city/**/*.test.ts'], root: here },
});
