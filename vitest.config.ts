import { defineConfig } from 'vitest/config'

const pkg = (name: string) => new URL(`./packages/${name}/src/index.ts`, import.meta.url).pathname

export default defineConfig({
  test: {
    include: ['packages/**/tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@ultimate-ide/contracts': pkg('contracts'),
      '@ultimate-ide/ide-bridge-renderer': pkg('ide-bridge-renderer'),
      '@ultimate-ide/session-log-spine': pkg('session-log-spine'),
      '@ultimate-ide/provenance': pkg('provenance'),
      '@ultimate-ide/approval-service': pkg('approval-service'),
      '@ultimate-ide/agent-view': pkg('agent-view'),
      '@ultimate-ide/extension-bridge': pkg('extension-bridge'),
      '@ultimate-ide/cloud-execution': pkg('cloud-execution'),
      '@ultimate-ide/skill-market': pkg('skill-market'),
      '@ultimate-ide/editor-as-tool': pkg('editor-as-tool'),
    },
  },
})
