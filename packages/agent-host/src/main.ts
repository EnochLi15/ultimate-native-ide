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
 *  3. {@link bootDsh} the DSH Cordis tree, confined to the workspace root
 *     (passed by electron-main at spawn time), with kernel events forwarded
 *     to the renderer.
 *  4. Start the {@link AgentHostRpcServer} to serve {@link AgentHostApi}.
 *     The renderer's `connect()` sends a `__handshake` request; the server
 *     responds with ready=true.
 *
 * @module @ultimate-ide/agent-host
 */

import { bootDsh } from './dsh-boot.ts'
import { AgentHostRpcServer } from './rpc-server.ts'
import { Transport, type WirePort } from './transport.ts'

/**
 * Boot the Agent Host on a given wire port. Extracted so tests can pass a
 * mock port without electron's process machinery.
 *
 * @param port - the wire port connected to the renderer.
 * @param workspaceRoot - the workspace root (from electron-main at spawn time).
 */
export async function bootAgentHost(
  port: WirePort,
  workspaceRoot: string,
): Promise<{ shutdown: () => Promise<void> }> {
  const transport = new Transport(port)

  // 1. Boot the DSH kernel, confined to the workspace root.
  const kernel = await bootDsh({
    workspaceRoot,
    onEvent: (event) => {
      transport.emit(event)
    },
  })

  // 2. Start serving RPC requests (handshake is handled via dispatch).
  const server = new AgentHostRpcServer(transport, kernel)
  server.start()

  console.log(`[agent-host] ready, serving AgentHostApi (workspace: ${workspaceRoot})`)

  return {
    async shutdown() {
      transport.close()
      await kernel.dispose()
      console.log('[agent-host] shut down')
    },
  }
}

/**
 * Production entry: electron UtilityProcess receives the MessagePort via
 * `process.parentPort` and the workspace root via spawn env. This is wired
 * when the fork's electron-main spawns the Agent Host (R0.4). For now it is
 * guarded so the module loads in plain node.
 */
if (typeof process !== 'undefined' && 'parentPort' in process) {
  const parentPort = (process as { parentPort?: WirePort & { onMessage?: (cb: (m: unknown) => void) => void } }).parentPort
  const workspaceRoot = process.env.DSH_WORKSPACE_ROOT ?? process.cwd()
  if (parentPort) {
    void bootAgentHost(parentPort, workspaceRoot).catch((err) => {
      console.error('[agent-host] boot failed:', err)
      process.exit(1)
    })
  }
}
