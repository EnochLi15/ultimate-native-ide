/**
 * R1 terminal verification: the real DSH kernel can spawn and drive a PTY.
 *
 * Tests that ctx.terminals is live after boot: spawn a bash terminal, send a
 * command, read output, and close it — all through the DshKernel interface.
 * This proves the "shared execution world" (architecture invariant 3) extends
 * to interactive terminals, not just one-shot bash tool calls.
 *
 * @module @ultimate-ide/agent-host/tests/dsh-terminal.test
 */

import { describe, it, expect } from 'vitest'
import { bootDsh } from '../src/dsh-boot.ts'

describe('R1: real DSH kernel terminal (PTY)', () => {
  it('spawns a terminal, sends a command, reads output, closes', async () => {
    const dshHome = new URL('../../../.dsh-home', import.meta.url).pathname
    process.env.DSH_HOME = dshHome

    const kernel = await bootDsh({
      workspaceRoot: process.cwd(),
      onEvent: () => {},
    })

    try {
      // Create an agent first (terminals are owner-scoped).
      const sessionId = `term-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` as never
      await kernel.createAgent({
        sessionId,
        meta: { cwd: process.cwd() },
        agentOptions: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
      })

      // Spawn a bash terminal (default backend type is 'shell').
      const spawnResult = await kernel.terminalSpawn(sessionId, {
        type: 'shell',
        cwd: process.cwd(),
        name: 'test-terminal',
      })
      expect(spawnResult.id).toBeDefined()
      expect(typeof spawnResult.motd).toBe('string')
      console.log(`  terminal spawned: ${spawnResult.id}, motd length=${spawnResult.motd.length}`)

      // Send a command (echo) and await settlement.
      const sendResult = await kernel.terminalSend(sessionId, spawnResult.id, 'echo terminal-test-success', true)
      expect(sendResult.viewport).toBeDefined()
      console.log(`  terminal send: waitReason=${sendResult.waitReason}`)

      // Read the terminal output.
      const readResult = await kernel.terminalRead(sessionId, spawnResult.id)
      expect(readResult.text).toBeDefined()
      expect(readResult.text).toContain('terminal-test-success')
      console.log(`  terminal read: ${readResult.text.slice(0, 80)}`)

      // Close the terminal.
      const closed = await kernel.terminalClose(sessionId, spawnResult.id)
      expect(closed).toBe(true)
      console.log('  terminal closed')
    } finally {
      await kernel.dispose()
    }
  }, 15_000)
})
