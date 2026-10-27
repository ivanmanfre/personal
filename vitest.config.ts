import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    // board-app/ is the standalone board (own deps, own build): never part of this suite.
    exclude: [...configDefaults.exclude, 'board-app/**'],
  },
});
