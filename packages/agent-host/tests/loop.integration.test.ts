/**
 * End-to-end integration test for the deep-contract loop:
 *   renderer (IdeBridge) ↔ transport ↔ AgentHostRpcServer ↔ mock DshKernel
 *
 * Verifies the RPC "神经" carries typed calls and events across the process
 * boundary (simulated by an in-memory WirePort pair).
 *
 * @module @ultimate-ide/agent-host/tests/loop.integration.test
 */

import { describe, it, expect } from 'vitest'
import type { AgentHostEvent, CreateAgentOptions } from '@ultimate-ide/contracts/rpc'
import type { DshKernel } from '../src/dsh-boot.ts'
import type { WirePort } from '../src/transport.ts'
import { AgentHostRpcServer } from '../src/rpc-server.ts'
import { Transport } from '../src/transport.ts'
import { IdeBridge } from '@ultimate-ide/ide-bridge-renderer'

/** In-memory WirePort pair: two ports that postMessage to each other. */
function createPortPair(): [WirePort, WirePort] {
  const handlersA: ((m: unknown) => void)[] = []
  const handlersB: ((m: unknown) => void)[] = []
  const portA: WirePort = {
    postMessage(m: unknown) { for (const h of handlersB) h(m) },
    onMessage(h) { handlersA.push(h); return () => { const i = handlersA.indexOf(h); if (i >= 0) handlersA.splice(i, 1) } },
  }
  const portB: WirePort = {
    postMessage(m: unknown) { for (const h of handlersA) h(m) },
    onMessage(h) { handlersB.push(h); return () => { const i = handlersB.indexOf(h); if (i >= 0) handlersB.splice(i, 1) } },
  }
  return [portA, portB]
}

/** Mock DshKernel that records calls and returns canned responses. */
function createMockKernel(emit: (event: unknown) => void): DshKernel {
  const kernel: DshKernel = {
    async createAgent(options: CreateAgentOptions) {
      return { handle: { sessionId: options.sessionId, options: options.agentOptions ?? {}, status: 'idle' }, nextSeq: 0 }
    },
    async resumeAgent() { return { handle: { sessionId: 'resumed' as never, options: {}, status: 'idle' }, nextSeq: 0 } },
    async disposeAgent() {},
    async sendPrompt() { emit({ kind: 'agent-status', sessionId: 's1' as never, status: 'running' } as AgentHostEvent) },
    async cancelAgent() {},
    async awaitIdle() {},
    async queryEvents() { return [] },
    async listTools() { return [] },
    async invokeTool() { return { content: [{ type: 'text', text: 'ok' }], isError: false } },
    async fsResolve(path: string) { return { targetKey: `key:${path}` as never, displayPath: path } },
    async fsStat() { return undefined },
    async fsReadText() { return 'file contents' },
    async fsWriteText() { return { target: { targetKey: 'k' as never, displayPath: 'p' }, version: 'v1' as never } },
    async fsEditText() { return { target: { targetKey: 'k' as never, displayPath: 'p' }, version: 'v2' as never } },
    async fsListDir() { return [] },
    async dispose() {},
  }
  return kernel
}

describe('deep-contract loop', () => {
  async function setup() {
    const [rendererPort, hostPort] = createPortPair()
    const hostTransport = new Transport(hostPort)
    const kernel = createMockKernel((event) => hostTransport.emit(event))
    const server = new AgentHostRpcServer(hostTransport, kernel)
    server.start()
    const bridge = new IdeBridge(rendererPort)
    await bridge.connect('/test/workspace')
    return { bridge, kernel, server, hostTransport }
  }

  it('handshake: Agent Host reports ready with matching protocol', async () => {
    const { bridge } = await setup()
    const handshake = await bridge.connect('/test/workspace')
    // Note: double connect works because __handshake is idempotent
    expect(handshake.ready).toBe(true)
    expect(handshake.protocol).toBe('ultimate-ide-agent-host')
    bridge.close()
  })

  it('fsResolve: displayPath and targetKey round-trip', async () => {
    const { bridge } = await setup()
    const target = await bridge.api.fsResolve('/test/workspace/foo.ts')
    expect(target.displayPath).toBe('/test/workspace/foo.ts')
    expect(typeof target.targetKey).toBe('string')
    bridge.close()
  })

  it('fsReadText: content round-trips', async () => {
    const { bridge } = await setup()
    const target = await bridge.api.fsResolve('/test/workspace/foo.ts')
    const content = await bridge.api.fsReadText(target)
    expect(content).toBe('file contents')
    bridge.close()
  })

  it('createAgent: returns handle with matching sessionId and idle status', async () => {
    const { bridge } = await setup()
    const sessionId = 'sess-1' as never
    const result = await bridge.api.createAgent({ sessionId })
    expect(result.handle.sessionId).toBe(sessionId)
    expect(result.handle.status).toBe('idle')
    bridge.close()
  })

  it('event stream: kernel events reach the renderer', async () => {
    const { bridge } = await setup()
    const received: AgentHostEvent[] = []
    bridge.onEvent((e) => received.push(e))
    const sessionId = 'sess-1' as never
    await bridge.api.sendPrompt({ sessionId, text: 'hello' })
    await new Promise((r) => setTimeout(r, 10))
    expect(received.some((e) => e.kind === 'agent-status')).toBe(true)
    bridge.close()
  })

  it('error path: kernel throw propagates as RPC error, server stays healthy', async () => {
    const { bridge, kernel } = await setup()
    const mockKernel = kernel as unknown as { cancelAgent: () => Promise<void> }
    mockKernel.cancelAgent = async () => { throw new Error('mock kernel failure') }
    const sessionId = 'sess-1' as never
    await expect(bridge.api.cancelAgent(sessionId, 'test-cause')).rejects.toThrow('mock kernel failure')
    // Server still serves after the error
    const repeat = await bridge.api.fsResolve('__test_path__')
    expect(repeat.displayPath).toBe('__test_path__')
    bridge.close()
  })

  it('invokeTool: returns tool result content', async () => {
    const { bridge } = await setup()
    const sessionId = 'sess-1' as never
    const result = await bridge.api.invokeTool(sessionId, 'bash', { command: 'echo hi' })
    expect(result.isError).toBe(false)
    expect(result.content[0]).toMatchObject({ type: 'text', text: 'ok' })
    bridge.close()
  })
})
