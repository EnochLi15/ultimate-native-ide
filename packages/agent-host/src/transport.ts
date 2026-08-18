/**
 * The bidirectional transport layer for the Agent Host ↔ renderer RPC.
 *
 * This abstracts the message-passing primitive so the same RPC server works
 * over electron's `MessagePortMain` (production) or a plain `MessagePort`
 * (tests). The deep contract types ride on top: each message is a typed
 * request or event envelope.
 *
 * Production wiring: electron-main creates a `MessageChannelMain`, sends one
 * port to the Agent Host UtilityProcess and the other to the renderer. Both
 * sides wrap their port in a {@link Transport} and speak the same protocol.
 *
 * @module @ultimate-ide/agent-host/transport
 */

/** A request envelope: the renderer asks the Agent Host to do something. */
export interface RpcRequest {
  readonly kind: 'request'
  /** Monotonic request id; the response carries the same id. */
  readonly id: number
  /** The {@link AgentHostApi} method name. */
  readonly method: string
  /** Serialized arguments array. */
  readonly args: readonly unknown[]
}

/** A response envelope: the Agent Host returns a result or error. */
export interface RpcResponse {
  readonly kind: 'response'
  readonly id: number
  readonly ok: boolean
  readonly result?: unknown
  readonly error?: { readonly message: string; readonly code?: string }
}

/** An event envelope: the Agent Host pushes a notification to the renderer. */
export interface RpcEvent {
  readonly kind: 'event'
  readonly payload: unknown
}

/** Any message on the wire. */
export type RpcMessage = RpcRequest | RpcResponse | RpcEvent

/**
 * The raw message-passing primitive both sides wrap. Matches the subset of
 * `MessagePort` / `MessagePortMain` that the RPC needs.
 */
export interface WirePort {
  postMessage(message: unknown): void
  onMessage(handler: (message: unknown) => void): () => void
  close?(): void
}

/**
 * A typed transport over a {@link WirePort}. Sends typed messages and
 * dispatches received messages to the right handler.
 */
export class Transport {
  private readonly port: WirePort
  private requestHandler: ((req: RpcRequest) => Promise<void>) | null = null
  private eventHandler: ((event: unknown) => void) | null = null
  private readonly responseWaiters = new Map<number, (res: RpcResponse) => void>()

  constructor(port: WirePort) {
    this.port = port
    port.onMessage((raw) => this.handleRaw(raw))
  }

  /** Register the handler for incoming requests (the Agent Host side). */
  onRequest(handler: (req: RpcRequest) => Promise<void>): void {
    this.requestHandler = handler
  }

  /** Register the handler for incoming events (the renderer side). */
  onEvent(handler: (event: unknown) => void): void {
    this.eventHandler = handler
  }

  /** Send a request and await the response (the renderer side). */
  request(method: string, args: readonly unknown[]): Promise<unknown> {
    const id = this.nextId()
    return new Promise((resolve, reject) => {
      this.responseWaiters.set(id, (res) => {
        if (res.ok) {
          resolve(res.result)
        } else {
          reject(new Error(res.error?.message ?? 'RPC error'))
        }
      })
      this.send({ kind: 'request', id, method, args })
    })
  }

  /** Send a response to a request (the Agent Host side). */
  respond(id: number, ok: boolean, result?: unknown, errorMessage?: string): void {
    this.send({ kind: 'response', id, ok, result, error: errorMessage ? { message: errorMessage } : undefined })
  }

  /** Push an event to the other side (the Agent Host side). */
  emit(event: unknown): void {
    this.send({ kind: 'event', payload: event })
  }

  close(): void {
    this.port.close?.()
    this.responseWaiters.clear()
  }

  private send(message: RpcMessage): void {
    this.port.postMessage(message)
  }

  private handleRaw(raw: unknown): void {
    if (typeof raw !== 'object' || raw === null) return
    const msg = raw as RpcMessage
    switch (msg.kind) {
      case 'request':
        this.requestHandler?.(msg)
        break
      case 'response':
        this.responseWaiters.get(msg.id)?.(msg)
        this.responseWaiters.delete(msg.id)
        break
      case 'event':
        this.eventHandler?.(msg.payload)
        break
    }
  }

  private nextId(): number {
    return this._idCounter++
  }
  private _idCounter = 1
}
