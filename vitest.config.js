import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/**/*.test.{js,ts}',
      'tests/robot3/test-*.js'
    ],
    setupFiles: ['tests/robot3/qunit-vitest.js']
  }
});
