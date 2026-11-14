import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Standalone dev server and tests for /dev/network and /dev/desk until the client shell (agent 08) lands.
// The desk folder has no node_modules of its own: bare imports from it resolve as if they came from here.
const here = path.dirname(fileURLToPath(import.meta.url));
const deskDir = path.resolve(here, '../desk');

const deskDeps: Plugin = {
  name: 'desk-deps',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (!importer || !importer.startsWith(deskDir)) return null;
    if (source.startsWith('.') || source.startsWith('/') || source.startsWith('\0')) return null;
    return this.resolve(source, path.join(here, 'index.html'), { ...options, skipSelf: true });
  },
};

export default defineConfig({
  plugins: [deskDeps, react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { fs: { allow: [path.resolve(here, '../../../../')] } },
  test: {
    dir: path.resolve(here, '..'),
    include: ['network/**/*.test.{ts,tsx}', 'desk/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'jsdom',
  },
});
