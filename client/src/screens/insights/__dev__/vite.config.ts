// Temporary harness for agent 11 (see agents/11.md). Remove when agent 08's client package lands:
// the screens are plain React components and need nothing from this folder.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const screens = path.resolve(here, '..', '..');            // client/src/screens
const repo = path.resolve(screens, '..', '..', '..');       // repository root

export default defineConfig({
  root: here,
  cacheDir: path.join(here, 'node_modules', '.vite'),
  plugins: [react()],
  server: { port: 5181, fs: { allow: [repo] } },
  preview: { port: 5181 },
  build: { outDir: path.join(here, 'dist'), emptyOutDir: true },
  test: {
    root: screens,
    include: ['insights/**/*.test.{ts,tsx}', 'end/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/__dev__/**'],
    environment: 'node',
  },
});
