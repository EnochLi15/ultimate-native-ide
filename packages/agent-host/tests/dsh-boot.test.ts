/**
 * R0.5 verification: boot the REAL DSH kernel and prove ctx.fs works.
 *
 * The "brain comes alive" test: the Agent Host boots the vendored DSH Cordis
 * tree (agent-host profile = dsh-base only), and we verify ctx.fs can resolve,
 * stat, and list files in the workspace — proving the real agent kernel is
 * live behind the deep contract.
 *
 * @module @ultimate-ide/agent-host/tests/dsh-boot.test
 */

import { describe, it, expect } from 'vitest'
import { bootDsh } from '../src/dsh-boot.ts'

describe('R0.5: real DSH kernel boot', () => {
  it('boots the DSH headless profile and produces a live kernel', async () => {
    const dshHome = new URL('../../../.dsh-home', import.meta.url).pathname
    process.env.DSH_HOME = dshHome
    const workspaceRoot = process.cwd()

    const kernel = await bootDsh({
      workspaceRoot,
      onEvent: () => {},
    })

    expect(kernel).toBeDefined()
    await kernel.dispose()
  })

  it('ctx.fs resolves, stats, and lists the workspace root', async () => {
    const dshHome = new URL('../../../.dsh-home', import.meta.url).pathname
    process.env.DSH_HOME = dshHome
    const workspaceRoot = process.cwd()

    const kernel = await bootDsh({
      workspaceRoot,
      onEvent: () => {},
    })

    try {
      // Resolve the workspace root.
      const target = await kernel.fsResolve(workspaceRoot)
      expect(typeof target.targetKey).toBe('string')
      expect(target.displayPath).toBe(workspaceRoot)

      // Stat it — should be a directory.
      const info = await kernel.fsStat(target)
      expect(info).toBeDefined()
      expect(info?.type).toBe('directory')

      // List it — should contain entries.
      const entries = await kernel.fsListDir(target)
      expect(Array.isArray(entries)).toBe(true)
      expect(entries.length).toBeGreaterThan(0)
    } finally {
      await kernel.dispose()
    }
  })

  it('disposes cleanly without hanging', async () => {
    const dshHome = new URL('../../../.dsh-home', import.meta.url).pathname
    process.env.DSH_HOME = dshHome

    const kernel = await bootDsh({
      workspaceRoot: process.cwd(),
      onEvent: () => {},
    })

    // Should resolve within a reasonable time.
    await expect(kernel.dispose()).resolves.toBeUndefined()
  })
})
