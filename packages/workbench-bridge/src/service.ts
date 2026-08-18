/**
 * The workbench bridge service — the renderer-side integration point.
 *
 * In the VS Code fork, this is registered during `Workbench.startup()` as a
 * workbench service. It:
 *  1. Receives the MessagePort from electron-main (via preload/IPC).
 *  2. Creates an {@link IdeBridge} and connects it to the Agent Host.
 *  3. Exposes the bridge as `ctx.ideBridge` (or VS Code's instantiation service)
 *     so all workbench components can call `bridge.api.*` and subscribe to events.
 *
 * Production wiring (in the VS Code fork's `src/vs/workbench/browser/workbench.ts`):
 * ```ts
 * import { registerIdeBridge } from '@ultimate-ide/workbench-bridge'
 * // In Workbench.startup(), after the instantiation service is ready:
 * registerIdeBridge(instantiationService, workspaceRoot, messagePort)
 * ```
 *
 * @module @ultimate-ide/workbench-bridge/service
 */

import { IdeBridge, type WirePort } from '@ultimate-ide/ide-bridge-renderer'
import type { AgentHostEvent } from '@ultimate-ide/contracts/rpc'

/**
 * The workbench bridge — wraps an {@link IdeBridge} and exposes it as a
 * service. Workbench components inject this to reach the DSH agent kernel.
 */
export interface IIdeBridgeService {
  /** The typed proxy implementing AgentHostApi. Available after connect. */
  readonly api: IdeBridge['api']
  /** Whether the bridge is connected to the Agent Host. */
  readonly connected: boolean
  /** Subscribe to the Agent Host event stream. */
  onEvent(handler: (event: AgentHostEvent) => void): void
  /** Connect to the Agent Host (called during workbench startup). */
  connect(workspaceRoot: string): Promise<void>
  /** Disconnect (called during workbench shutdown). */
  disconnect(): void
}

/**
 * Create and register the IdeBridge service.
 *
 * @param port - the MessagePort from electron-main (wrapped as a WirePort).
 * @returns the bridge service interface.
 */
export function createIdeBridgeService(port: WirePort): IIdeBridgeService {
  const bridge = new IdeBridge(port)
  let connected = false
  const eventHandlers: ((event: AgentHostEvent) => void)[] = []

  bridge.onEvent((event) => {
    for (const h of eventHandlers) h(event)
  })

  return {
    get api() {
      return bridge.api
    },
    get connected() {
      return connected
    },
    onEvent(handler: (event: AgentHostEvent) => void): void {
      eventHandlers.push(handler)
    },
    async connect(workspaceRoot: string): Promise<void> {
      const handshake = await bridge.connect(workspaceRoot)
      if (!handshake.ready) {
        throw new Error(`workbench-bridge: Agent Host handshake failed`)
      }
      connected = true
    },
    disconnect(): void {
      bridge.close()
      connected = false
    },
  }
}

/**
 * A MessagePort-to-WirePort adapter.
 *
 * electron's renderer MessagePort (from MessageChannelMain) has
 * `postMessage`/`onmessage`; this wraps it in the WirePort interface the
 * IdeBridge expects.
 */
export function messagePortToWirePort(port: {
  postMessage(message: unknown): void
  onmessage: ((ev: MessageEvent) => void) | null
  close?(): void
}): WirePort {
  const handlers: ((m: unknown) => void)[] = []
  port.onmessage = (ev: MessageEvent) => {
    for (const h of handlers) h(ev.data)
  }
  return {
    postMessage(message: unknown): void {
      port.postMessage(message)
    },
    onMessage(handler: (message: unknown) => void): () => void {
      handlers.push(handler)
      return () => {
        const i = handlers.indexOf(handler)
        if (i >= 0) handlers.splice(i, 1)
      }
    },
    close(): void {
      port.close?.()
    },
  }
}
