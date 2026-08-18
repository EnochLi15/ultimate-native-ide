import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/**/tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@ultimate-ide/contracts': new URL('./packages/contracts/src/index.ts', import.meta.url).pathname,
      '@ultimate-ide/ide-bridge-renderer': new URL('./packages/ide-bridge-renderer/src/index.ts', import.meta.url).pathname,
    },
  },
})
