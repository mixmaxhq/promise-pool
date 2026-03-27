import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    clearMocks: true,
    testTimeout: 15000,
    coverage: {
      include: ['src/**/*.js'],
      reportsDirectory: 'coverage',
    },
  },
});
