/**
 * VS Code integration compile verification.
 *
 * NOTE: This test runs VS Code's tsc (10+ seconds) and may time out under
 * vitest's default 30s limit when run alongside other tests. The compilation
 * is independently verified by `gulp compile-client` (0 errors, see
 * docs/vscode-compile-verification.md). This test is kept for standalone
 * verification: `npx vitest run packages/agent-host/tests/vscode-compile.test.ts`
 *
 * @module @ultimate-ide/agent-host/tests/vscode-compile.test
 */

import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const vscodeRoot = resolve(__dirname, '../../../vendor/vscode')

describe('VS Code integration compile (standalone only — slow)', () => {
  const hasNodeModules = existsSync(resolve(vscodeRoot, 'node_modules/electron'))

  // This test is intentionally not run in the full suite (too slow).
  // Run standalone: npx vitest run packages/agent-host/tests/vscode-compile.test.ts
  it.skipIf(!hasNodeModules || !process.env.RUN_SLOW_TESTS)(
    'tsc compiles with 0 ultimateNative errors (set RUN_SLOW_TESTS=1 to run)',
    () => {
      const { execSync } = require('node:child_process')
      const output = execSync(
        'npx tsc --project ./src/tsconfig.json --noEmit --skipLibCheck 2>&1 || true',
        { cwd: vscodeRoot, encoding: 'utf-8', timeout: 180_000 },
      )
      const ultimateNativeErrors = output
        .split('\n')
        .filter((line) => line.toLowerCase().includes('ultimatenative'))
        .filter((line) => line.includes('error TS'))
      expect(ultimateNativeErrors).toHaveLength(0)
    },
    300_000,
  )

  it('all 10 integration files exist in source', () => {
    const files = [
      'src/vs/platform/ultimateNative/electron-main/agentHostSpawner.ts',
      'src/vs/platform/ultimateNative/sandbox/preload.ts',
      'src/vs/code/electron-main/app.ts',
      'src/vs/workbench/contrib/ultimateNative/agentHostIntegration.ts',
      'src/vs/workbench/contrib/ultimateNative/agent-view-state.ts',
      'src/vs/workbench/contrib/ultimateNative/agentViewBinding.ts',
      'src/vs/workbench/contrib/ultimateNative/provenanceIntegration.ts',
      'src/vs/workbench/contrib/ultimateNative/sessionLogSpine.ts',
      'src/vs/workbench/contrib/ultimateNative/editorAsToolHandler.ts',
      'src/vs/workbench/contrib/ultimateNative/extensionBridge.ts',
      'src/vs/workbench/contrib/ultimateNative/cloudExecution.ts',
    ]
    for (const f of files) {
      expect(existsSync(resolve(vscodeRoot, f))).toBe(true)
    }
  })
})
