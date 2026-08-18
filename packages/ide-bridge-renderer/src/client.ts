/**
 * The renderer-side deep-contract client — the renderer's single door to the
 * DSH agent kernel.
 *
 * It holds a typed proxy implementing {@link AgentHostApi}: every method call
 * becomes one RPC round-trip over the MessagePort. It also subscribes to the
 * {@link AgentHostEvent} stream so the renderer can update its UI (chat
 * stream, terminal panels, approval prompts) without polling.
 *
 * The handshake carries the workspace root so the Agent Host confines
 * execution to it (architecture invariant 3: 单一执行世界).
 *
 * @module @ultimate-ide/ide-bridge-renderer/client
 */

import type {
  AgentHostApi,
  AgentHostEvent,
  BridgeHandshake,
  BridgeHandshakeResponse,
} from '@ultimate-ide/contracts/rpc'

/** The raw message-passing primitive (subset of MessagePort / MessagePortMain). */
export interface WirePort {
  postMessage(message: unknown): void
  onMessage(handler: (message: unknown) => void): () => void
  close?(): void
}

/** A request envelope on the wire. */
interface RpcRequest {
  readonly kind: 'request'
  readonly id: number
  readonly method: string
  readonly args: readonly unknown[]
}

/** A response envelope on the wire. */
interface RpcResponse {
  readonly kind: 'response'
  readonly id: number
  readonly ok: boolean
  readonly result?: unknown
  readonly error?: { readonly message: string }
}

/** An event envelope on the wire. */
interface RpcEvent {
  readonly kind: 'event'
  readonly payload: unknown
}

/**
 * The renderer's bridge to the Agent Host. Construct with a {@link WirePort},
 * call {@link connect} to handshake, then use {@link api} to make typed calls
 * and {@link onEvent} to subscribe to the event stream.
 */
export class IdeBridge {
  private readonly port: WirePort
  private readonly responseWaiters = new Map<number, (res: RpcResponse) => void>()
  private eventHandler: ((event: AgentHostEvent) => void) | null = null
  private _idCounter = 1
  private _connected = false

  /** The typed proxy implementing {@link AgentHostApi}. Available after {@link connect}. */
  readonly api: AgentHostApi

  constructor(port: WirePort) {
    this.port = port
    this.port.onMessage((raw) => this.handleRaw(raw))
    this.api = this.createProxy()
  }

  /** Send the handshake and await the Agent Host's ready signal. */
  async connect(workspaceRoot: string): Promise<BridgeHandshakeResponse> {
    const handshake: BridgeHandshake = {
      protocol: 'ultimate-ide-agent-host',
      version: 1,
      workspaceRoot,
    }
    // The handshake is a special RPC request (reuses the request/response path).
    const response = await this.call('__handshake', [handshake])
    this._connected = true
    return response as BridgeHandshakeResponse
  }

  /** Subscribe to the Agent Host event stream. */
  onEvent(handler: (event: AgentHostEvent) => void): void {
    this.eventHandler = handler
  }

  /** Whether {@link connect} succeeded. */
  get connected(): boolean {
    return this._connected
  }

  /** Close the bridge. */
  close(): void {
    this.port.close?.()
    this.responseWaiters.clear()
    this._connected = false
  }

  // -- internals --

  private createProxy(): AgentHostApi {
    // The proxy turns each AgentHostApi method call into an RPC request.
    // Method names match the AgentHostRpcServer dispatch switch exactly.
    const methods: ReadonlyArray<keyof AgentHostApi> = [
      'createAgent', 'resumeAgent', 'disposeAgent',
      'sendPrompt', 'cancelAgent', 'awaitIdle',
      'queryEvents', 'listTools', 'invokeTool',
      'fsResolve', 'fsStat', 'fsReadText', 'fsWriteText', 'fsEditText', 'fsListDir',
      'terminalSpawn', 'terminalInput', 'terminalResize', 'terminalClose',
      'respondApproval',
    ]

    const proxy = {} as Record<string, (...args: unknown[]) => Promise<unknown>>
    for (const method of methods) {
      proxy[method] = (...args: unknown[]) => this.call(method, args)
    }
    return proxy as unknown as AgentHostApi
  }

  private async call(method: string, args: readonly unknown[]): Promise<unknown> {
    if (!this._connected && method !== '__handshake') {
      throw new Error(`ide-bridge: not connected (call connect() first)`)
    }
    const id = this.nextId()
    return new Promise((resolve, reject) => {
      this.responseWaiters.set(id, (res) => {
        if (res.ok) {
          resolve(res.result)
        } else {
          reject(new Error(res.error?.message ?? `ide-bridge: RPC "${method}" failed`))
        }
      })
      this.send({ kind: 'request', id, method, args })
    })
  }

  private handleRaw(raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) return
    const msg = raw as RpcRequest | RpcResponse | RpcEvent
    switch (msg.kind) {
      case 'response':
        this.responseWaiters.get(msg.id)?.(msg)
        this.responseWaiters.delete(msg.id)
        break
      case 'event':
        this.eventHandler?.(msg.payload as AgentHostEvent)
        break
    }
  }

  private send(message: unknown): void {
    this.port.postMessage(message)
  }

  private nextId(): number {
    return this._idCounter++
  }
}
