// Dev harness for agent 09 until the client shell (agent 08) exists.
// Pages: /dev/map/ and /dev/city/ on fixtures.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(here, '../../..');

export default defineConfig({
  root: here,
  plugins: [react()],
  // screens/city lives outside this package: resolve its imports from here
  resolve: { dedupe: ['react', 'react-dom', 'maplibre-gl', 'qrcode-generator'] },
  server: { host: true, port: 5179, fs: { allow: [repo] } },
  preview: { host: true, port: 5179 },
  build: {
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
    rollupOptions: { input: { map: resolve(here, 'dev/map/index.html'), city: resolve(here, 'dev/city/index.html') } },
  },
  // tests of both folders this agent owns: client/src/map and client/src/screens/city
  test: { environment: 'node', root: resolve(here, '..'), include: ['map/**/*.test.ts', 'screens/city/**/*.test.ts'], exclude: ['**/node_modules/**'] },
});
