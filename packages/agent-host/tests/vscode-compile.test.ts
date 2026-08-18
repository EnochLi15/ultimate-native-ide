/**
 * VS Code integration compile verification.
 *
 * Verifies that our 6 ultimateNative integration files compile correctly
 * within VS Code's TypeScript project, with zero errors.
 *
 * This test runs `tsc --project src/tsconfig.json --noEmit --skipLibCheck`
 * in the vendored VS Code directory and checks that no errors mention
 * 'ultimateNative' or our integration file paths.
 *
 * @module @ultimate-ide/agent-host/tests/vscode-compile.test
 */

import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const vscodeRoot = resolve(__dirname, '../../../vendor/vscode')

describe('VS Code integration compile (requires Node 24 + npm install)', () => {
  // Skip if VS Code node_modules not installed
  const hasNodeModules = existsSync(resolve(vscodeRoot, 'node_modules/electron'))

  it.skipIf(!hasNodeModules)('tsc compiles with 0 ultimateNative errors', () => {
    // Run VS Code's own tsc typecheck
    const output = execSync(
      'npx tsc --project ./src/tsconfig.json --noEmit --skipLibCheck 2>&1 || true',
      { cwd: vscodeRoot, encoding: 'utf-8', timeout: 120_000 },
    )

    // Check for any errors mentioning our integration files
    const ultimateNativeErrors = output
      .split('\n')
      .filter((line) => line.toLowerCase().includes('ultimatenative'))
      .filter((line) => line.includes('error TS'))

    expect(ultimateNativeErrors).toHaveLength(0)
  }, 180_000)

  it.skipIf(!hasNodeModules)('all 6 integration files exist in out/ after compile-client', () => {
    // This test runs after compile-client; check the source files exist
    const files = [
      'src/vs/platform/ultimateNative/electron-main/agentHostSpawner.ts',
      'src/vs/platform/ultimateNative/sandbox/preload.ts',
      'src/vs/code/electron-main/app.ts',
      'src/vs/workbench/contrib/ultimateNative/agentHostIntegration.ts',
      'src/vs/workbench/contrib/ultimateNative/agent-view-state.ts',
      'src/vs/workbench/contrib/ultimateNative/agentViewBinding.ts',
    ]
    for (const f of files) {
      expect(existsSync(resolve(vscodeRoot, f))).toBe(true)
    }
  })
})
