/**
 * End-to-end integration test for the deep-contract loop:
 *   renderer (IdeBridge) ↔ transport ↔ AgentHostRpcServer ↔ mock DshKernel
 *
 * This verifies that the RPC machinery — the "神经" — actually carries typed
 * calls and events across the process boundary (simulated by an in-memory
 * WirePort pair). It proves the deep contract is functionally sound before
 * the real DSH kernel and VS Code fork are wired (R0.4/R0.5).
 *
 * Run: npx tsx tests/loop.integration.ts
 *
 * @module @ultimate-ide/agent-host/tests/loop.integration
 */

import type {
  AgentHostEvent,
  CreateAgentOptions,
} from '@ultimate-ide/contracts/rpc'
import type { DshKernel } from '../src/dsh-boot.ts'
import type { WirePort } from '../src/transport.ts'
import { AgentHostRpcServer } from '../src/rpc-server.ts'
import { Transport } from '../src/transport.ts'
import { IdeBridge } from '@ultimate-ide/ide-bridge-renderer'

// ---------------------------------------------------------------------------
// In-memory WirePort pair: two ports that postMessage to each other.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mock DshKernel — records calls and returns canned responses.
// ---------------------------------------------------------------------------

function createMockKernel(emit: (event: unknown) => void): DshKernel {
  const calls: string[] = []
  const kernel: DshKernel = {
    async createAgent(options: CreateAgentOptions) {
      calls.push('createAgent')
      return {
        handle: { sessionId: options.sessionId, options: options.agentOptions ?? {}, status: 'idle' },
        nextSeq: 0,
      }
    },
    async resumeAgent() { calls.push('resumeAgent'); return { handle: { sessionId: 'resumed' as never, options: {}, status: 'idle' }, nextSeq: 0 } },
    async disposeAgent() { calls.push('disposeAgent') },
    async sendPrompt() { calls.push('sendPrompt'); emit({ kind: 'agent-status', sessionId: 's1' as never, status: 'running' } as AgentHostEvent) },
    async cancelAgent() { calls.push('cancelAgent') },
    async awaitIdle() { calls.push('awaitIdle') },
    async queryEvents() { calls.push('queryEvents'); return [] },
    async listTools() { calls.push('listTools'); return [] },
    async invokeTool() { calls.push('invokeTool'); return { content: [{ type: 'text', text: 'ok' }], isError: false } },
    async fsResolve(path: string) { calls.push(`fsResolve:${path}`); return { targetKey: `key:${path}` as never, displayPath: path } },
    async fsStat() { calls.push('fsStat'); return undefined },
    async fsReadText() { calls.push('fsReadText'); return 'file contents' },
    async fsWriteText() { calls.push('fsWriteText'); return { target: { targetKey: 'k' as never, displayPath: 'p' }, version: 'v1' as never } },
    async fsEditText() { calls.push('fsEditText'); return { target: { targetKey: 'k' as never, displayPath: 'p' }, version: 'v2' as never } },
    async fsListDir() { calls.push('fsListDir'); return [] },
    async dispose() { calls.push('dispose') },
  }
  return new Proxy(kernel, {
    get(target, prop) { return (target as Record<string, unknown>)[prop as string] },
  }) as DshKernel
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  let passed = 0
  let failed = 0
  function assert(cond: boolean, msg: string): void {
    if (cond) { passed++; console.log(`  ✓ ${msg}`) }
    else { failed++; console.error(`  ✗ ${msg}`) }
  }

  console.log('\n=== Deep-contract loop integration test ===\n')

  // 1. Create an in-memory port pair (simulates the MessagePort between processes).
  const [rendererPort, hostPort] = createPortPair()

  // 2. Host side: transport first, then mock kernel (emits via transport), then server.
  const hostTransport = new Transport(hostPort)
  const kernel = createMockKernel((event) => hostTransport.emit(event))
  const server = new AgentHostRpcServer(hostTransport, kernel)
  server.start()

  // 3. Renderer side: bridge client.
  const bridge = new IdeBridge(rendererPort)
  const handshake = await bridge.connect('/test/workspace')
  assert(handshake.ready === true, 'handshake: Agent Host reports ready')
  assert(handshake.protocol === 'ultimate-ide-agent-host', 'handshake: protocol matches')

  // 4. Typed call: fsResolve round-trips through the deep contract.
  const target = await bridge.api.fsResolve('/test/workspace/foo.ts')
  assert(target.displayPath === '/test/workspace/foo.ts', 'fsResolve: displayPath round-trips')
  assert(typeof target.targetKey === 'string', 'fsResolve: targetKey is a (branded) string')

  // 5. Typed call: fsReadText returns the kernel's canned content.
  const content = await bridge.api.fsReadText(target)
  assert(content === 'file contents', 'fsReadText: content round-trips')

  // 6. Typed call: createAgent returns a handle.
  const sessionId = 'sess-1' as never
  const result = await bridge.api.createAgent({ sessionId })
  assert(result.handle.sessionId === sessionId, 'createAgent: handle sessionId matches')
  assert(result.handle.status === 'idle', 'createAgent: initial status is idle')

  // 7. Event stream: sendPrompt triggers a kernel event; verify the renderer receives it.
  const receivedEvents: AgentHostEvent[] = []
  bridge.onEvent((e) => receivedEvents.push(e))
  await bridge.api.sendPrompt({ sessionId, text: 'hello' })
  // Give the event a tick to propagate through the port pair.
  await new Promise((r) => setTimeout(r, 10))
  assert(
    receivedEvents.some((e) => e.kind === 'agent-status'),
    'event stream: renderer received the agent-status event from the kernel',
  );

  // 8. Error path: a kernel throw propagates as an RPC error to the renderer.
  //    The mock kernel's cancelAgent throws; verify the renderer receives an error.
  const mockKernel = kernel as unknown as { cancelAgent: () => Promise<void> }
  mockKernel.cancelAgent = async () => {
    throw new Error('mock kernel failure')
  }
  try {
    await bridge.api.cancelAgent(sessionId, 'test-cause')
    assert(false, 'kernel error: should have propagated to renderer')
  } catch (err) {
    assert(err instanceof Error && err.message.includes('mock kernel failure'), 'kernel error: propagates as typed RPC error')
  }

  // 9. Repeat call still works after the error path (server is not broken).
  const repeat = await bridge.api.fsResolve('__test_path__')
  assert(repeat.displayPath === '__test_path__', 'repeat call: server still serves after error')

  bridge.close()
  await kernel.dispose()

  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Integration test crashed:', err)
  process.exit(1)
})
