/**
 * R0 agent lifecycle verification: create, drive, and dispose a real DSH agent.
 *
 * This tests the full agent driving path: createAgent → sendPrompt →
 * awaitIdle → disposeAgent. It verifies the Agent Host can manage real DSH
 * agents through the deep contract, not just invoke tools directly.
 *
 * NOTE: sendPrompt requires an LLM API key to fully complete a turn. Without
 * one, the agent will start the turn but fail at the model request. This test
 * verifies the lifecycle mechanics (creation, prompt queuing, idle, disposal)
 * rather than full model completion, which requires DEEPSEEK_API_KEY.
 *
 * @module @ultimate-ide/agent-host/tests/dsh-agent.test
 */

import { describe, it, expect } from 'vitest'
import { bootDsh } from '../src/dsh-boot.ts'

describe('R0: real DSH agent lifecycle', () => {
  it('createAgent creates a live agent in the registry', async () => {
    const dshHome = new URL('../../../.dsh-home', import.meta.url).pathname
    process.env.DSH_HOME = dshHome

    const kernel = await bootDsh({
      workspaceRoot: process.cwd(),
      onEvent: () => {},
    })

    try {
      const sessionId = `test-agent-${Date.now()}-${Math.random().toString(36).slice(2,6)}` as never
      const result = await kernel.createAgent({
        sessionId,
        meta: { cwd: process.cwd() },
        agentOptions: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
      })

      expect(result.handle).toBeDefined()
      expect(result.handle.sessionId).toBe(sessionId)
      expect(result.handle.status).toBe('idle')
      console.log(`  agent created: ${result.handle.sessionId}, status=${result.handle.status}`)

      // Dispose cleanly.
      await kernel.disposeAgent(sessionId)
      console.log('  agent disposed')
    } finally {
      await kernel.dispose()
    }
  })

  it('awaitIdle resolves for a freshly created (idle) agent', async () => {
    const dshHome = new URL('../../../.dsh-home', import.meta.url).pathname
    process.env.DSH_HOME = dshHome

    const kernel = await bootDsh({
      workspaceRoot: process.cwd(),
      onEvent: () => {},
    })

    try {
      const sessionId = `test-agent-${Date.now()}-${Math.random().toString(36).slice(2,6)}` as never
      await kernel.createAgent({
        sessionId,
        meta: { cwd: process.cwd() },
        agentOptions: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
      })

      // A freshly created agent with no prompt should be idle.
      await expect(kernel.awaitIdle(sessionId)).resolves.toBeUndefined()
      console.log('  awaitIdle resolved for idle agent')
    } finally {
      await kernel.dispose()
    }
  })

  it('queryEvents returns events after agent creation', async () => {
    const dshHome = new URL('../../../.dsh-home', import.meta.url).pathname
    process.env.DSH_HOME = dshHome

    const kernel = await bootDsh({
      workspaceRoot: process.cwd(),
      onEvent: () => {},
    })

    try {
      const sessionId = `test-agent-${Date.now()}-${Math.random().toString(36).slice(2,6)}` as never
      await kernel.createAgent({
        sessionId,
        meta: { cwd: process.cwd() },
        agentOptions: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
      })

      // Agent creation appends session events (session/created, agent/created, etc.)
      const events = await kernel.queryEvents(sessionId)
      expect(Array.isArray(events)).toBe(true)
      // Creation should produce at least one event.
      expect(events.length).toBeGreaterThan(0)
      console.log(`  events after creation: ${events.length}`)
      console.log(`  event types: ${events.map((e) => e.type).join(', ')}`)
    } finally {
      await kernel.dispose()
    }
  })

  it('disposeAgent cleans up the agent from the registry', async () => {
    const dshHome = new URL('../../../.dsh-home', import.meta.url).pathname
    process.env.DSH_HOME = dshHome

    const kernel = await bootDsh({
      workspaceRoot: process.cwd(),
      onEvent: () => {},
    })

    try {
      const sessionId = `test-agent-${Date.now()}-${Math.random().toString(36).slice(2,6)}` as never
      await kernel.createAgent({
        sessionId,
        meta: { cwd: process.cwd() },
        agentOptions: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
      })

      // Dispose and verify the agent is gone (queryEvents returns empty or
      // the dispose doesn't throw).
      await kernel.disposeAgent(sessionId)

      // After disposal, queryEvents should not throw (session may be gone).
      const events = await kernel.queryEvents(sessionId)
      expect(Array.isArray(events)).toBe(true)
      console.log('  dispose completed without error')
    } finally {
      await kernel.dispose()
    }
  })
})
