/**
 * The Agent Host RPC server — implements {@link AgentHostApi} by delegating to
 * the live {@link DshKernel}, and dispatches incoming renderer requests over
 * the {@link Transport}.
 *
 * This is the concrete "神经" endpoint: the renderer's typed proxy calls land
 * here, get routed to the DSH kernel, and responses flow back. Kernel-emitted
 * events (session events, agent status, terminal data, approvals) are pushed
 * to the renderer over the same transport's event channel.
 *
 * @module @ultimate-ide/agent-host/rpc-server
 */

import type {
  AgentHostApi,
  AgentHostEvent,
  ApprovalResponse,
  BridgeHandshake,
  BridgeHandshakeResponse,
  PromptRequest,
  TerminalSpawnRequest,
} from '@ultimate-ide/contracts/rpc'
import type { CreateAgentOptions, ResumeAgentOptions } from '@ultimate-ide/contracts/agent'
import type { SessionId } from '@ultimate-ide/contracts/ids'
import type { DshKernel } from './dsh-boot.ts'
import type { RpcRequest, Transport } from './transport.ts'

/**
 * The RPC server: binds a {@link Transport} to a {@link DshKernel} and serves
 * {@link AgentHostApi} calls. Kernel events are forwarded to the renderer as
 * {@link AgentHostEvent} envelopes.
 */
export class AgentHostRpcServer {
  private readonly transport: Transport
  private readonly kernel: DshKernel
  private readonly terminals = new Map<string, { sessionId: SessionId }>()
  private readonly pendingApprovals = new Map<string, ApprovalResponse>()

  constructor(transport: Transport, kernel: DshKernel) {
    this.transport = transport
    this.kernel = kernel
  }

  /** Start serving requests on the transport. */
  start(): void {
    this.transport.onRequest(async (req) => this.dispatch(req))
  }

  /** Push a kernel event to the renderer. */
  emitEvent(event: AgentHostEvent): void {
    this.transport.emit(event)
  }

  /** Perform the handshake and respond. */
  async handshake(req: BridgeHandshake): Promise<BridgeHandshakeResponse> {
    if (req.protocol !== 'ultimate-ide-agent-host') {
      throw new Error(`agent-host: unknown protocol "${req.protocol}"`)
    }
    return {
      protocol: 'ultimate-ide-agent-host',
      version: req.version,
      ready: true,
      dshVersion: 'skeleton-0.0.1',
    }
  }

  /** Route one request to the matching AgentHostApi method. */
  private async dispatch(req: RpcRequest): Promise<void> {
    try {
      const result = await this.invoke(req.method, req.args)
      this.transport.respond(req.id, true, result)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.transport.respond(req.id, false, undefined, message)
    }
  }

  /** The method dispatcher — a typed switch over AgentHostApi method names. */
  private async invoke(method: string, args: readonly unknown[]): Promise<unknown> {
    switch (method) {
      // -- lifecycle --
      case 'createAgent':
        return this.kernel.createAgent(args[0] as CreateAgentOptions)
      case 'resumeAgent':
        return this.kernel.resumeAgent(args[0] as ResumeAgentOptions)
      case 'disposeAgent':
        return this.kernel.disposeAgent(args[0] as SessionId)

      // -- driving --
      case 'sendPrompt':
        return this.kernel.sendPrompt(
          (args[0] as PromptRequest).sessionId,
          (args[0] as PromptRequest).text,
          (args[0] as PromptRequest).images,
        )
      case 'cancelAgent':
        return this.kernel.cancelAgent(args[0] as SessionId, args[1] as string, args[2] as undefined)
      case 'awaitIdle':
        return this.kernel.awaitIdle(args[0] as SessionId)

      // -- session log --
      case 'queryEvents':
        return this.kernel.queryEvents(args[0] as SessionId, args[1] as number | undefined)
      case 'listTools':
        return this.kernel.listTools(args[0] as SessionId)
      case 'invokeTool':
        return this.kernel.invokeTool(args[0] as SessionId, args[1] as string, args[2])

      // -- ctx.fs --
      case 'fsResolve':
        return this.kernel.fsResolve(args[0] as string, args[1] as string | undefined)
      case 'fsStat':
        return this.kernel.fsStat(args[0] as Parameters<AgentHostApi['fsStat']>[0])
      case 'fsReadText':
        return this.kernel.fsReadText(args[0] as Parameters<AgentHostApi['fsReadText']>[0], args[1] as { offset?: number; limit?: number } | undefined)
      case 'fsWriteText':
        return this.kernel.fsWriteText(
          args[0] as Parameters<AgentHostApi['fsWriteText']>[0],
          args[1] as string,
          args[2] as Parameters<AgentHostApi['fsWriteText']>[2],
        )
      case 'fsEditText':
        return this.kernel.fsEditText(
          args[0] as Parameters<AgentHostApi['fsEditText']>[0],
          args[1] as Parameters<AgentHostApi['fsEditText']>[1],
          args[2] as Parameters<AgentHostApi['fsEditText']>[2],
        )
      case 'fsListDir':
        return this.kernel.fsListDir(args[0] as Parameters<AgentHostApi['fsListDir']>[0])

      // -- ctx.terminals (stub — wires to ctx.terminals in R1) --
      case 'terminalSpawn':
        return this.terminalSpawn(args[0] as TerminalSpawnRequest)
      case 'terminalInput':
        return this.terminalInput(args[0] as string, args[1] as string)
      case 'terminalResize':
        return this.terminalResize(args[0] as string, args[1] as number, args[2] as number)
      case 'terminalClose':
        return this.terminalClose(args[0] as string)

      // -- ctx.approval (stub — wires to ctx.approval in R1) --
      case 'respondApproval':
        return this.respondApproval(args[0] as ApprovalResponse)

      default:
        throw new Error(`agent-host: unknown RPC method "${method}"`)
    }
  }

  // -- terminal stubs (R1 will wire to ctx.terminals) --
  private async terminalSpawn(req: TerminalSpawnRequest): Promise<{ id: string; sessionId: SessionId }> {
    const id = `term-${this._termCounter++}`
    this.terminals.set(id, { sessionId: req.sessionId })
    // TODO R1: ctx.terminals.spawn(owner, req) → real PTY; forward onData/exit as events.
    return { id, sessionId: req.sessionId }
  }
  private async terminalInput(_id: string, _data: string): Promise<void> {
    // TODO R1: ctx.terminals.write(id, data)
  }
  private async terminalResize(_id: string, _cols: number, _rows: number): Promise<void> {
    // TODO R1: ctx.terminals.resize(id, cols, rows)
  }
  private async terminalClose(id: string): Promise<void> {
    this.terminals.delete(id)
    // TODO R1: ctx.terminals.close(id)
  }

  // -- approval stub (R1 will wire to ctx.approval) --
  private async respondApproval(res: ApprovalResponse): Promise<void> {
    this.pendingApprovals.set(res.id, res)
    // TODO R1: ctx.approval.resolve(res.id, res.decision)
  }

  private _termCounter = 1
}
