import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [],
    testTimeout: 10000, // 10 seconds max per test
    hookTimeout: 5000,  // 5 seconds for setup/teardown
  },
})