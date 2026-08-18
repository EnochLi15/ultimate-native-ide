/**
 * R0 tool-wiring verification: the real DSH kernel exposes its tool registry.
 *
 * After booting the real DSH kernel (agent-host profile = dsh-base), we verify
 * ctx.tools.schemas() returns the full tool set (bash, read, write, edit,
 * grep, glob, etc.) — proving the agent's "hands" are live behind the deep
 * contract, ready for the renderer to invoke.
 *
 * @module @ultimate-ide/agent-host/tests/dsh-tools.test
 */

import { describe, it, expect } from 'vitest'
import { bootDsh } from '../src/dsh-boot.ts'

describe('R0: real DSH kernel tool registry', () => {
  it('listTools returns the full tool set after boot', async () => {
    const dshHome = new URL('../../../.dsh-home', import.meta.url).pathname
    process.env.DSH_HOME = dshHome

    const kernel = await bootDsh({
      workspaceRoot: process.cwd(),
      onEvent: () => {},
    })

    try {
      const tools = await kernel.listTools('test-session' as never)
      expect(Array.isArray(tools)).toBe(true)
      // dsh-base mounts bash, read, write, edit, grep, glob, and more.
      expect(tools.length).toBeGreaterThan(0)

      const names = tools.map((t) => t.name)
      console.log(`  tools found (${tools.length}): ${names.slice(0, 10).join(', ')}...`)

      // The core filesystem + bash tools must be present.
      expect(names).toContain('bash')
      expect(names.some((n) => n.includes('read'))).toBe(true)
    } finally {
      await kernel.dispose()
    }
  })

  it('each tool has a name, description, and parameters schema', async () => {
    const dshHome = new URL('../../../.dsh-home', import.meta.url).pathname
    process.env.DSH_HOME = dshHome

    const kernel = await bootDsh({
      workspaceRoot: process.cwd(),
      onEvent: () => {},
    })

    try {
      const tools = await kernel.listTools('test-session' as never)
      for (const tool of tools) {
        expect(typeof tool.name).toBe('string')
        expect(tool.name.length).toBeGreaterThan(0)
        expect(typeof tool.description).toBe('string')
        expect(typeof tool.parameters).toBe('object')
      }
    } finally {
      await kernel.dispose()
    }
  })
})
