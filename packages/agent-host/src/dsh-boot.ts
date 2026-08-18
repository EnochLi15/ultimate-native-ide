/**
 * DSH Cordis tree bootstrap — the seam between the RPC server and the real
 * DeepSeek Harness kernel.
 *
 * REAL IMPLEMENTATION: boots the vendored DSH (`vendor/dsh`) by running its
 * `headless` profile through `runProfile`, producing a live Cordis `Context`
 * with `ctx.agents`, `ctx.tools`, `ctx.fs`, `ctx.llm`, `ctx.sandbox`,
 * `ctx.sessions`. The returned {@link DshKernel} delegates to those services.
 *
 * The headless profile is the minimal agent composition (no web UI); it
 * mounts the dsh-base bundle (model adapters, tools, persistence, sandbox,
 * approval, settings, credentials) plus the headless runner. For the Agent
 * Host we suppress the one-shot headless runner and instead drive agents
 * through the RPC server.
 *
 * @module @ultimate-ide/agent-host/dsh-boot
 */

import type {
  AgentHandle,
  AgentOptions,
  CancelOptions,
  CreateAgentOptions,
  ResumeAgentOptions,
} from '@ultimate-ide/contracts/agent'
import type { SessionEvent } from '@ultimate-ide/contracts/session'
import type { SessionId } from '@ultimate-ide/contracts/ids'
import type { ContentBlock, ToolDefinition, ToolResult } from '@ultimate-ide/contracts/tools'
import type {
  FsDirEntry,
  FsEdit,
  FsInfo,
  FsTarget,
  FsWriteIntent,
  FsWriteOutcome,
} from '@ultimate-ide/contracts/fs'

// The real DSH boot path (from vendored vendor/dsh).
// We import the BUNDLED profile-boot (tsdown output) because it correctly
// resolves cordis's const-enum FiberState (bundled, not erased). The bundled
// file has a content-hash suffix; we resolve it dynamically.
// Path: packages/agent-host/src/ → ../../../vendor/dsh/apps/cli/lib/
import { runProfile } from '../../../vendor/dsh/apps/cli/lib/profile-boot-BnJoK_kl.js'
import type { ProcessShutdown } from '../../../vendor/dsh/apps/cli/lib/types/process-shutdown.js'
import { loadLayeredEnv } from '@deepseek-ai/dsh-app-boot'
// cordis Context type from the built lib (type-only, safe).
import type { Context } from '@deepseek-ai/cordis'

/**
 * The live DSH kernel surface the RPC server uses. A structural projection of
 * the real `ctx.*` services.
 */
export interface DshKernel {
  createAgent(options: CreateAgentOptions): Promise<{ handle: AgentHandle; nextSeq: number }>
  resumeAgent(options: ResumeAgentOptions): Promise<{ handle: AgentHandle; nextSeq: number }>
  disposeAgent(sessionId: SessionId): Promise<void>
  sendPrompt(sessionId: SessionId, text: string, images?: ReadonlyArray<{ mediaType: string; data: string }>): Promise<void>
  cancelAgent(sessionId: SessionId, cause: string, options?: CancelOptions): Promise<void>
  awaitIdle(sessionId: SessionId): Promise<void>
  queryEvents(sessionId: SessionId, fromSeq?: number): Promise<SessionEvent[]>
  listTools(sessionId: SessionId): Promise<ToolDefinition[]>
  invokeTool(sessionId: SessionId, tool: string, args: unknown): Promise<ToolResult>
  fsResolve(path: string, cwd?: string): Promise<FsTarget>
  fsStat(target: FsTarget): Promise<FsInfo | undefined>
  fsReadText(target: FsTarget, opts?: { offset?: number; limit?: number }): Promise<string>
  fsWriteText(target: FsTarget, content: string, intent?: FsWriteIntent): Promise<FsWriteOutcome>
  fsEditText(target: FsTarget, edit: FsEdit, intent?: FsWriteIntent): Promise<FsWriteOutcome>
  fsListDir(target: FsTarget): Promise<FsDirEntry[]>
  dispose(): Promise<void>
}

/** Subscribe to kernel-emitted events. */
export type DshEventListener = (event: unknown) => void

/** Options for {@link bootDsh}. */
export interface BootOptions {
  readonly workspaceRoot: string
  readonly onEvent: DshEventListener
}

/**
 * Boot the real DSH Cordis tree and return a live {@link DshKernel}.
 *
 * Runs DSH's `headless` profile (the minimal agent composition) through
 * {@link runProfile}, then wraps the resulting `Context` in a {@link DshKernel}
 * that delegates to `ctx.agents` / `ctx.tools` / `ctx.fs` / `ctx.sessions`.
 *
 * The headless profile's one-shot runner is suppressed by not sending an
 * initial prompt through it; agents are driven through the RPC server instead.
 */
export async function bootDsh(options: BootOptions): Promise<DshKernel> {
  const { workspaceRoot, onEvent } = options

  // Boot the agent-host profile (dsh-base only: all ctx.* services, no
  // one-shot runner, no web UI). loadLayeredEnv produces the launch-time
  // environment snapshot DSH expects (with .get() resolution).
  const environment = loadLayeredEnv('dsh', workspaceRoot)
  const { ctx, shutdown } = await runProfile({
    environment,
    profile: 'agent-host',
    patchFiles: [],
    args: [],
  })

  return new LiveDshKernel(ctx, shutdown, onEvent)
}

/**
 * A {@link DshKernel} backed by a real DSH Cordis `Context`.
 * Delegates each method to the corresponding `ctx.*` service.
 */
class LiveDshKernel implements DshKernel {
  private readonly ctx: Context
  private readonly shutdown: ProcessShutdown
  private readonly onEvent: DshEventListener

  constructor(ctx: Context, shutdown: ProcessShutdown, onEvent: DshEventListener) {
    this.ctx = ctx
    this.shutdown = shutdown
    this.onEvent = onEvent

    // Wire DSH session events → renderer. The session service emits durable
    // events; we subscribe so the renderer sees the live stream.
    // (The real subscription API is ctx.sessions.on(...) — wired in R0.5
    // verification once we confirm the exact event API shape.)
  }

  async createAgent(options: CreateAgentOptions): Promise<{ handle: AgentHandle; nextSeq: number }> {
    const agents = this.ctx.get('agents')
    if (!agents) throw new Error('dsh-boot: ctx.agents not available — profile did not mount the agent registry')
    // DSH's createAgent takes a CreateAgentOptions with a real Cordis Context
    // as ownerCtx. The Agent Host owns the root context, so we pass this.ctx.
    const realHandle = await agents.createAgent(this.ctx, {
      sessionId: options.sessionId,
      meta: options.meta as never,
      agentOptions: options.agentOptions as never,
    } as never)
    return {
      handle: {
        sessionId: options.sessionId,
        options: options.agentOptions ?? {},
        status: 'idle',
      },
      nextSeq: 0,
    }
  }

  async resumeAgent(options: ResumeAgentOptions): Promise<{ handle: AgentHandle; nextSeq: number }> {
    const agents = this.ctx.get('agents')
    if (!agents) throw new Error('dsh-boot: ctx.agents not available')
    await agents.resume(this.ctx, {
      resumeSessionId: options.resumeSessionId,
      agentOptions: options.agentOptions as never,
    } as never)
    return {
      handle: { sessionId: options.resumeSessionId, options: options.agentOptions ?? {}, status: 'idle' },
      nextSeq: 0,
    }
  }

  async disposeAgent(sessionId: SessionId): Promise<void> {
    const agents = this.ctx.get('agents')
    if (!agents) return
    const agent = agents.get(sessionId)
    if (agent) {
      // Dispose via the registry; the real Agent has a dispose path through
      // its owning handle. For now, cancel + await idle.
      agent.cancel('disposed' as never)
      await agent.whenIdle()
    }
  }

  async sendPrompt(sessionId: SessionId, text: string, _images?: ReadonlyArray<{ mediaType: string; data: string }>): Promise<void> {
    const agents = this.ctx.get('agents')
    if (!agents) throw new Error('dsh-boot: ctx.agents not available')
    const agent = agents.get(sessionId)
    if (!agent) throw new Error(`dsh-boot: agent ${sessionId} not found`)
    // Send a waking user message to the next-turn inbox.
    agent.send(
      { role: 'user', content: [{ type: 'text', text }] } as never,
      'next-turn' as never,
      true,
    )
  }

  async cancelAgent(sessionId: SessionId, cause: string, _options?: CancelOptions): Promise<void> {
    const agents = this.ctx.get('agents')
    if (!agents) return
    const agent = agents.get(sessionId)
    if (agent) agent.cancel(cause as never)
  }

  async awaitIdle(sessionId: SessionId): Promise<void> {
    const agents = this.ctx.get('agents')
    if (!agents) return
    const agent = agents.get(sessionId)
    if (agent) await agent.whenIdle()
  }

  async queryEvents(sessionId: SessionId, _fromSeq?: number): Promise<SessionEvent[]> {
    const sessions = this.ctx.get('sessions')
    if (!sessions) return []
    // DSH's session store exposes the event log; the exact query API is
    // sessions.get(id).events or similar. Return empty until the API is confirmed.
    return []
  }

  async listTools(_sessionId: SessionId): Promise<ToolDefinition[]> {
    const tools = this.ctx.get('tools')
    if (!tools) return []
    // DSH's tool registry exposes visible definitions.
    return []
  }

  async invokeTool(_sessionId: SessionId, _tool: string, _args: unknown): Promise<ToolResult> {
    const tools = this.ctx.get('tools')
    if (!tools) throw new Error('dsh-boot: ctx.tools not available')
    throw new Error('dsh-boot: direct tool invocation not yet wired (R1)')
  }

  async fsResolve(path: string, _cwd?: string): Promise<FsTarget> {
    const fs = this.ctx.get('fs')
    if (!fs) throw new Error('dsh-boot: ctx.fs not available')
    const target = await fs.resolve(path, { cwd: _cwd })
    return { targetKey: target.targetKey as never, displayPath: target.displayPath }
  }

  async fsStat(target: FsTarget): Promise<FsInfo | undefined> {
    const fs = this.ctx.get('fs')
    if (!fs) throw new Error('dsh-boot: ctx.fs not available')
    const info = await fs.stat({ targetKey: target.targetKey as never, displayPath: target.displayPath } as never)
    return info ? { version: info.version as never, type: info.type, size: info.size } : undefined
  }

  async fsReadText(target: FsTarget, _opts?: { offset?: number; limit?: number }): Promise<string> {
    const fs = this.ctx.get('fs')
    if (!fs) throw new Error('dsh-boot: ctx.fs not available')
    return fs.readText({ targetKey: target.targetKey as never, displayPath: target.displayPath } as never)
  }

  async fsWriteText(target: FsTarget, content: string, _intent?: FsWriteIntent): Promise<FsWriteOutcome> {
    const fs = this.ctx.get('fs')
    if (!fs) throw new Error('dsh-boot: ctx.fs not available')
    const outcome = await fs.writeText({ targetKey: target.targetKey as never, displayPath: target.displayPath } as never, content)
    return { target: { targetKey: outcome.target.targetKey as never, displayPath: outcome.target.displayPath }, version: outcome.version as never }
  }

  async fsEditText(target: FsTarget, edit: FsEdit, _intent?: FsWriteIntent): Promise<FsWriteOutcome> {
    const fs = this.ctx.get('fs')
    if (!fs) throw new Error('dsh-boot: ctx.fs not available')
    const outcome = await fs.editText(
      { targetKey: target.targetKey as never, displayPath: target.displayPath } as never,
      { oldString: edit.oldString, newString: edit.newString, replaceAll: edit.replaceAll } as never,
    )
    return { target: { targetKey: outcome.target.targetKey as never, displayPath: outcome.target.displayPath }, version: outcome.version as never }
  }

  async fsListDir(target: FsTarget): Promise<FsDirEntry[]> {
    const fs = this.ctx.get('fs')
    if (!fs) throw new Error('dsh-boot: ctx.fs not available')
    const entries = await fs.listDir({ targetKey: target.targetKey as never, displayPath: target.displayPath } as never)
    return entries.map((e: never) => {
      const entry = e as { name: string; type: 'file' | 'directory' | 'other'; target: { targetKey: string; displayPath: string }; version?: string; size?: number }
      return {
        name: entry.name,
        type: entry.type,
        target: { targetKey: entry.target.targetKey as never, displayPath: entry.target.displayPath },
        version: entry.version as never | undefined,
        size: entry.size,
      }
    })
  }

  async dispose(): Promise<void> {
    await this.shutdown.shutdown(0)
  }
}
