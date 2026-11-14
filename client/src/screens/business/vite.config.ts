import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Standalone dev server for /dev/biz until the client shell (agent 08) mounts these screens.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['../../../../'] } },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules/**', 'dist/**'],
  },
});
