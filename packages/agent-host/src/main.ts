/**
 * Agent Host process entry point.
 *
 * In production this runs inside an electron `UtilityProcess` spawned by
 * electron-main. electron-main creates a `MessageChannelMain`, sends one port
 * to this process (via `process.parentPort`) and the other to the renderer.
 *
 * Boot sequence:
 *  1. Acquire the MessagePort from the parent process.
 *  2. Wrap it in a {@link Transport}.
 *  3. Await the renderer's {@link BridgeHandshake} (carries the workspace root).
 *  4. {@link bootDsh} the DSH Cordis tree, confined to that workspace root,
 *     with kernel events forwarded to the renderer.
 *  5. Start the {@link AgentHostRpcServer} to serve {@link AgentHostApi}.
 *
 * @module @ultimate-ide/agent-host
 */

import type { BridgeHandshake, BridgeHandshakeResponse, AgentHostEvent } from '@ultimate-ide/contracts/rpc'
import { bootDsh } from './dsh-boot.ts'
import { AgentHostRpcServer } from './rpc-server.ts'
import { Transport, type WirePort } from './transport.ts'

/**
 * Boot the Agent Host on a given wire port. Extracted so tests can pass a
 * mock port without electron's process machinery.
 */
export async function bootAgentHost(port: WirePort): Promise<{ shutdown: () => Promise<void> }> {
  const transport = new Transport(port)

  // 1. Await the handshake (the renderer sends it as the first event).
  const handshake = await awaitHandshake(transport)
  console.log(`[agent-host] handshake ok: protocol=${handshake.protocol} v${handshake.version}`)

  // 2. Boot the DSH kernel, confined to the workspace root.
  const kernel = await bootDsh({
    workspaceRoot: handshake.workspaceRoot,
    onEvent: (event) => {
      transport.emit(event)
    },
  })

  // 3. Start serving RPC requests.
  const server = new AgentHostRpcServer(transport, kernel)
  server.start()

  // 4. Respond to the handshake.
  const response: BridgeHandshakeResponse = await server.handshake(handshake)
  transport.emit({ kind: 'handshake-response', response } as unknown as AgentHostEvent)

  console.log(`[agent-host] ready, serving AgentHostApi`)

  return {
    async shutdown() {
      transport.close()
      await kernel.dispose()
      console.log('[agent-host] shut down')
    },
  }
}

/** Await the renderer's first message (the handshake). */
function awaitHandshake(transport: Transport): Promise<BridgeHandshake> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('agent-host: handshake timeout')), 10_000)
    transport.onEvent((event) => {
      const e = event as { protocol?: string; workspaceRoot?: string }
      if (e?.protocol === 'ultimate-ide-agent-host') {
        clearTimeout(timeout)
        resolve(e as unknown as BridgeHandshake)
      }
    })
  })
}

/**
 * Production entry: electron UtilityProcess receives the MessagePort via
 * `process.parentPort`. This is wired when the fork's electron-main spawns the
 * Agent Host (R0.4). For now it is guarded so the module loads in plain node.
 */
if (typeof process !== 'undefined' && 'parentPort' in process) {
  const parentPort = (process as { parentPort?: WirePort }).parentPort
  if (parentPort) {
    void bootAgentHost(parentPort).catch((err) => {
      console.error('[agent-host] boot failed:', err)
      process.exit(1)
    })
  }
}
