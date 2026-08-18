/**
 * R0 definitive verification: the FULL deep-contract path with the REAL DSH kernel.
 *
 * Unlike loop.integration.test.ts (which uses a mock kernel), this test boots
 * the real vendored DSH Cordis tree and drives it through the complete RPC
 * path: IdeBridge → Transport → AgentHostRpcServer → LiveDshKernel → DSH ctx.*
 *
 * This is the "brain + nervous system + hands" end-to-end test:
 *  - Boot real DSH kernel (agent-host profile = dsh-base)
 *  - Create a real agent through the RPC
 *  - List real tools through the RPC (expect 25+ tools)
 *  - Execute bash through the RPC (expect real stdout)
 *  - Query session events through the RPC
 *  - Dispose through the RPC
 *
 * @module @ultimate-ide/agent-host/tests/real-loop.e2e.test
 */

import { describe, it, expect } from 'vitest'
import { bootDsh } from '../src/dsh-boot.ts'
import { AgentHostRpcServer } from '../src/rpc-server.ts'
import { Transport, type WirePort } from '../src/transport.ts'
import { IdeBridge } from '@ultimate-ide/ide-bridge-renderer'
import type { AgentHostEvent } from '@ultimate-ide/contracts/rpc'

/** In-memory WirePort pair. */
function createPortPair(): [WirePort, WirePort] {
  const handlersA: ((m: unknown) => void)[] = []
  const handlersB: ((m: unknown) => void)[] = []
  return [
    { postMessage: (m) => handlersB.forEach((h) => h(m)), onMessage: (h) => { handlersA.push(h); return () => { const i = handlersA.indexOf(h); if (i >= 0) handlersA.splice(i, 1) } } },
    { postMessage: (m) => handlersA.forEach((h) => h(m)), onMessage: (h) => { handlersB.push(h); return () => { const i = handlersB.indexOf(h); if (i >= 0) handlersB.splice(i, 1) } } },
  ]
}

describe('R0 e2e: real DSH kernel through full RPC path', () => {
  it('boots DSH, creates agent, lists tools, runs bash, queries events — all via RPC', async () => {
    const dshHome = new URL('../../../.dsh-home', import.meta.url).pathname
    process.env.DSH_HOME = dshHome

    // 1. Boot the REAL DSH kernel.
    const kernel = await bootDsh({
      workspaceRoot: process.cwd(),
      onEvent: () => {},
    })

    // 2. Wire the full RPC path: renderer port ↔ host port.
    const [rendererPort, hostPort] = createPortPair()
    const hostTransport = new Transport(hostPort)
    const server = new AgentHostRpcServer(hostTransport, kernel)
    server.start()

    // 3. Renderer-side bridge.
    const bridge = new IdeBridge(rendererPort)
    const handshake = await bridge.connect(process.cwd())
    expect(handshake.ready).toBe(true)

    // 4. Create a real agent through the RPC. Use a unique session ID to
    //    avoid persistence collisions with other test runs.
    const sessionId = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` as never
    const createResult = await bridge.api.createAgent({
      sessionId,
      meta: { cwd: process.cwd() },
      agentOptions: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
    })
    expect(createResult.handle.sessionId).toBe(sessionId)
    expect(createResult.handle.status).toBe('idle')
    console.log(`  ✓ agent created via RPC: ${sessionId}`)

    // 5. List tools through the RPC — expect the real 25-tool set.
    const tools = await bridge.api.listTools(sessionId)
    expect(tools.length).toBeGreaterThan(20)
    const toolNames = tools.map((t) => t.name)
    expect(toolNames).toContain('bash')
    expect(toolNames).toContain('read')
    console.log(`  ✓ tools listed via RPC: ${tools.length} tools (bash, read, ...)`)

    // 6. Execute bash through the RPC — expect real stdout.
    const bashResult = await bridge.api.invokeTool(sessionId, 'bash', {
      command: 'echo e2e-rpc-success',
      description: 'test echo through full RPC path',
    })
    const bashText = bashResult.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
    if (bashResult.isError) {
      console.error(`  ✗ bash error: ${bashText}`)
    }
    expect(bashResult.isError).toBe(false)
    expect(bashText).toContain('e2e-rpc-success')
    console.log(`  ✓ bash executed via RPC: "${bashText.trim()}"`)

    // 7. Query session events through the RPC.
    const events = await bridge.api.queryEvents(sessionId)
    expect(events.length).toBeGreaterThan(0)
    console.log(`  ✓ events queried via RPC: ${events.length} events`)

    // 8. Dispose the agent through the RPC.
    await bridge.api.disposeAgent(sessionId)
    console.log('  ✓ agent disposed via RPC')

    // 9. Cleanup.
    bridge.close()
    await kernel.dispose()
    console.log('  ✓ full e2e path verified: renderer → RPC → real DSH kernel → bash execution')
  }, 30_000)
})
