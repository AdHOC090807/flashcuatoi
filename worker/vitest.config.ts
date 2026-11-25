import { defineConfig } from 'vitest/config';

export default defineConfig({
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
