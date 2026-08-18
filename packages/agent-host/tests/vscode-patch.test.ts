/**
 * R0.4 VS Code integration patch verification.
 *
 * Verifies the 3 integration files exist in the vendored VS Code fork and
 * contain the correct integration points, without requiring a full VS Code
 * build (which needs Node 24.18+ and electron types).
 *
 * @module @ultimate-ide/agent-host/tests/vscode-patch.test
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const vscodeRoot = resolve(__dirname, '../../../vendor/vscode')

describe('R0.4: VS Code fork integration patches', () => {
  it('agentHostSpawner.ts exists and imports from electron', () => {
    const file = resolve(vscodeRoot, 'src/vs/platform/ultimateNative/electron-main/agentHostSpawner.ts')
    expect(existsSync(file)).toBe(true)
    const content = readFileSync(file, 'utf-8')
    expect(content).toContain("from 'electron'")
    expect(content).toContain('MessageChannelMain')
    expect(content).toContain('utilityProcess')
    expect(content).toContain('spawnAgentHost')
  })

  it('preload.ts exists and sets the global port', () => {
    const file = resolve(vscodeRoot, 'src/vs/platform/ultimateNative/sandbox/preload.ts')
    expect(existsSync(file)).toBe(true)
    const content = readFileSync(file, 'utf-8')
    expect(content).toContain('__ultimateNativeAgentHostPort')
    expect(content).toContain('ipcRenderer')
  })

  it('agentHostIntegration.ts exists and registers a workbench contribution', () => {
    const file = resolve(vscodeRoot, 'src/vs/workbench/contrib/ultimateNative/agentHostIntegration.ts')
    expect(existsSync(file)).toBe(true)
    const content = readFileSync(file, 'utf-8')
    expect(content).toContain('IWorkbenchContribution')
    expect(content).toContain('LifecyclePhase.Restored')
    expect(content).toContain('registerWorkbenchContribution')
    expect(content).toContain('__ultimateNativeAgentHostPort')
  })

  it('app.ts has the spawnAgentHost hook before openFirstWindow', () => {
    const file = resolve(vscodeRoot, 'src/vs/code/electron-main/app.ts')
    expect(existsSync(file)).toBe(true)
    const content = readFileSync(file, 'utf-8')
    expect(content).toContain('spawnUltimateNativeAgentHost')
    expect(content).toContain('ultimate-native')

    // The hook must be before openFirstWindow
    const hookPos = content.indexOf('spawnUltimateNativeAgentHost')
    const windowPos = content.indexOf('openFirstWindow')
    expect(hookPos).toBeGreaterThan(-1)
    expect(windowPos).toBeGreaterThan(-1)
    expect(hookPos).toBeLessThan(windowPos)
  })

  it('app.ts imports homedir from os', () => {
    const file = resolve(vscodeRoot, 'src/vs/code/electron-main/app.ts')
    const content = readFileSync(file, 'utf-8')
    expect(content).toContain('homedir')
  })

  it('agentViewBinding.ts exists and provides a state service', () => {
    const file = resolve(vscodeRoot, 'src/vs/workbench/contrib/ultimateNative/agentViewBinding.ts')
    expect(existsSync(file)).toBe(true)
    const content = readFileSync(file, 'utf-8')
    expect(content).toContain('AgentViewService')
    expect(content).toContain('onDidChangeState')
    expect(content).toContain('processEvent')
  })

  it('agent-view-state.ts exists with the state reducer', () => {
    const file = resolve(vscodeRoot, 'src/vs/workbench/contrib/ultimateNative/agent-view-state.ts')
    expect(existsSync(file)).toBe(true)
    const content = readFileSync(file, 'utf-8')
    expect(content).toContain('reduceAgentView')
    expect(content).toContain('initialAgentViewState')
    expect(content).toContain('AgentViewMode')
  })

  it('all VS Code module imports point to existing files', () => {
    const imports = [
      'src/vs/base/common/lifecycle.ts',
      'src/vs/platform/instantiation/common/instantiation.ts',
      'src/vs/platform/registry/common/platform.ts',
      'src/vs/workbench/common/contributions.ts',
      'src/vs/workbench/services/lifecycle/common/lifecycle.ts',
    ]
    for (const imp of imports) {
      expect(existsSync(resolve(vscodeRoot, imp))).toBe(true)
    }
  })

  it('app.ts hook is before openFirstWindow (not after)', () => {
    const file = resolve(vscodeRoot, 'src/vs/code/electron-main/app.ts')
    const content = readFileSync(file, 'utf-8')
    const hookPos = content.indexOf('spawnUltimateNativeAgentHost')
    const windowPos = content.indexOf('this.openFirstWindow')
    expect(hookPos).toBeGreaterThan(-1)
    expect(windowPos).toBeGreaterThan(-1)
    // The hook call (not the method definition) must be before openFirstWindow call
    const hookCallPos = content.indexOf('this.spawnUltimateNativeAgentHost')
    expect(hookCallPos).toBeGreaterThan(-1)
    expect(hookCallPos).toBeLessThan(windowPos)
  })
})
