/**
 * R7 cloud-execution + skill-market tests.
 *
 * @module @ultimate-ide/cloud-execution/tests/r7.test
 * @module @ultimate-ide/skill-market/tests/r7.test
 */

import { describe, it, expect, vi } from 'vitest'
import { ExecutionWorldSwitcher, requiresCloudCredentials, worldPatchYaml } from '../src/index.ts'

describe('R7: cloud execution switcher', () => {
  it('starts with local execution world', () => {
    const applyPatch = vi.fn().mockResolvedValue(undefined)
    const sw = new ExecutionWorldSwitcher(
      { kind: 'local', workspaceRoot: '/test' },
      applyPatch,
    )
    const info = sw.getInfo()
    expect(info.kind).toBe('local')
    expect(info.label).toBe('Local')
    expect(info.sandboxed).toBe(false)
  })

  it('switches to E2B cloud and notifies listeners', async () => {
    const applyPatch = vi.fn().mockResolvedValue(undefined)
    const sw = new ExecutionWorldSwitcher(
      { kind: 'local', workspaceRoot: '/test' },
      applyPatch,
    )
    const statuses: string[] = []
    sw.onStatusChange((info) => statuses.push(info.status.kind))

    await sw.switchToE2B('/test', 'my-template', 'api-key-ref')

    expect(applyPatch).toHaveBeenCalled()
    expect(sw.getInfo().kind).toBe('cloud-e2b')
    expect(sw.getInfo().label).toBe('Cloud (E2B)')
    expect(sw.getInfo().sandboxed).toBe(true)
    expect(statuses).toContain('connecting')
    expect(statuses).toContain('connected')
  })

  it('switches back to local', async () => {
    const applyPatch = vi.fn().mockResolvedValue(undefined)
    const sw = new ExecutionWorldSwitcher(
      { kind: 'local', workspaceRoot: '/test' },
      applyPatch,
    )
    await sw.switchToE2B('/test', 'tpl', 'key')
    await sw.switchToLocal('/test')
    expect(sw.getInfo().kind).toBe('local')
  })

  it('handles connection errors', async () => {
    const applyPatch = vi.fn().mockRejectedValue(new Error('E2B unavailable'))
    const sw = new ExecutionWorldSwitcher(
      { kind: 'local', workspaceRoot: '/test' },
      applyPatch,
    )
    await expect(sw.switchToE2B('/test', 'tpl', 'key')).rejects.toThrow('E2B unavailable')
    expect(sw.getInfo().status.kind).toBe('error')
  })

  it('requiresCloudCredentials detects missing E2B key', () => {
    expect(requiresCloudCredentials({ kind: 'cloud-e2b', workspaceRoot: '/test' })).toBe(true)
    expect(requiresCloudCredentials({ kind: 'cloud-e2b', workspaceRoot: '/test', e2bApiKeyRef: 'ref' })).toBe(false)
    expect(requiresCloudCredentials({ kind: 'local', workspaceRoot: '/test' })).toBe(false)
  })

  it('worldPatchYaml generates correct profile patches', () => {
    const localYaml = worldPatchYaml({ kind: 'local', workspaceRoot: '/test' })
    expect(localYaml).toContain('dsh-fs-local')
    expect(localYaml).toContain('dsh-subprocess-local')

    const e2bYaml = worldPatchYaml({ kind: 'cloud-e2b', workspaceRoot: '/test', e2bTemplateId: 'tpl' })
    expect(e2bYaml).toContain('dsh-e2b')
    expect(e2bYaml).toContain('dsh-fs-e2b')
    expect(e2bYaml).toContain('dsh-subprocess-e2b')
    expect(e2bYaml).toContain('templateId: tpl')
  })
})
