import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

export default defineConfig({
  root: repoRoot,
  test: { include: ['engine/test/law/**/*.test.ts'] },
});
