import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

export default defineConfig({
  root: repoRoot,
  cacheDir: fileURLToPath(new URL('./node_modules/.vite', import.meta.url)),
  test: { include: ['engine/test/law/**/*.test.ts'] },
});
