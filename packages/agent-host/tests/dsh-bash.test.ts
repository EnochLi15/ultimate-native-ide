/**
 * R0 bash invocation verification: the real DSH kernel can execute bash.
 *
 * This is the "hands work" test: after booting the real DSH kernel, we invoke
 * the `bash` tool directly through ctx.tools.execute() and verify it runs a
 * command and returns output. This proves the full path from the deep contract
 * → DshKernel → ctx.tools → sandboxed bash execution is live.
 *
 * Combined with the boot + fs + tools tests, this completes the R0 verification:
 * the Agent Host can boot the real DSH brain AND drive its hands.
 *
 * @module @ultimate-ide/agent-host/tests/dsh-bash.test
 */

import { describe, it, expect } from 'vitest'
import { bootDsh } from '../src/dsh-boot.ts'

describe('R0: real DSH kernel bash execution', () => {
  it('invokeTool runs bash and returns stdout', async () => {
    const dshHome = new URL('../../../.dsh-home', import.meta.url).pathname
    process.env.DSH_HOME = dshHome

    const kernel = await bootDsh({
      workspaceRoot: process.cwd(),
      onEvent: () => {},
    })

    try {
      // Invoke the bash tool: echo a string. The bash tool requires both
      // `command` and `description` (a human-readable summary of the command).
      const result = await kernel.invokeTool(
        'test-session' as never,
        'bash',
        { command: 'echo hello-from-dsh', description: 'echo a test string' },
      )

      expect(result.isError).toBe(false)
      // The result content should contain the echoed string.
      const text = result.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
      expect(text).toContain('hello-from-dsh')
      console.log(`  bash output: ${text.slice(0, 80)}`)
    } finally {
      await kernel.dispose()
    }
  })

  it('bash can list files in the workspace', async () => {
    const dshHome = new URL('../../../.dsh-home', import.meta.url).pathname
    process.env.DSH_HOME = dshHome

    const kernel = await bootDsh({
      workspaceRoot: process.cwd(),
      onEvent: () => {},
    })

    try {
      const result = await kernel.invokeTool(
        'test-session' as never,
        'bash',
        { command: 'ls', description: 'list workspace files' },
      )

      expect(result.isError).toBe(false)
      const text = result.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
      // The workspace should contain the tests directory at least.
      expect(text.length).toBeGreaterThan(0)
      console.log(`  ls output (first 100 chars): ${text.slice(0, 100)}`)
    } finally {
      await kernel.dispose()
    }
  })
})
