/**
 * DSH Cordis tree bootstrap — the seam between the RPC server and the real
 * DeepSeek Harness kernel.
 *
 * The Agent Host's job is to own a running DSH Cordis context (`ctx`) with the
 * base bundle loaded: `ctx.agents`, `ctx.tools`, `ctx.fs`, `ctx.lsp`,
 * `ctx.terminals`, `ctx.llm`, `ctx.sandbox`, `ctx.approval`, `ctx.sessions`.
 * This module defines the {@link DshKernel} interface the RPC server depends
 * on, plus the boot sequence that produces it.
 *
 * STATUS: skeleton. The real implementation will `import` from the vendored
 * `vendor/dsh` packages and load the `dsh-base` profile bundle. Until DSH is
 * vendored (R0.1 subtree step), {@link bootDsh} throws a clear "not yet
 * bootstrapped" error so the skeleton is structurally complete and
 * type-checks, but cannot yet drive a real agent.
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

/**
 * The live DSH kernel surface the RPC server uses. This is a structural
 * projection of the real `ctx.*` services — the Agent Host's `bootDsh`
 * produces an instance satisfying this, and the RPC server delegates to it.
 *
 * Each method maps 1:1 to a DSH capability seam:
 *  - agent lifecycle → `ctx.agents` (createAgent/resume/dispose)
 *  - driving          → `Agent.send`/`cancel`/`whenIdle`
 *  - session log      → `ctx.sessions` (query events)
 *  - tools            → `ctx.tools` (list/invoke)
 *  - fs               → `ctx.fs` (resolve/stat/read/write/edit/list)
 */
export interface DshKernel {
  // -- agent lifecycle --
  createAgent(options: CreateAgentOptions): Promise<{ handle: AgentHandle; nextSeq: number }>
  resumeAgent(options: ResumeAgentOptions): Promise<{ handle: AgentHandle; nextSeq: number }>
  disposeAgent(sessionId: SessionId): Promise<void>

  // -- driving --
  sendPrompt(sessionId: SessionId, text: string, images?: ReadonlyArray<{ mediaType: string; data: string }>): Promise<void>
  cancelAgent(sessionId: SessionId, cause: string, options?: CancelOptions): Promise<void>
  awaitIdle(sessionId: SessionId): Promise<void>

  // -- session log --
  queryEvents(sessionId: SessionId, fromSeq?: number): Promise<SessionEvent[]>

  // -- tools --
  listTools(sessionId: SessionId): Promise<ToolDefinition[]>
  invokeTool(sessionId: SessionId, tool: string, args: unknown): Promise<ToolResult>

  // -- fs --
  fsResolve(path: string, cwd?: string): Promise<FsTarget>
  fsStat(target: FsTarget): Promise<FsInfo | undefined>
  fsReadText(target: FsTarget, opts?: { offset?: number; limit?: number }): Promise<string>
  fsWriteText(target: FsTarget, content: string, intent?: FsWriteIntent): Promise<FsWriteOutcome>
  fsEditText(target: FsTarget, edit: FsEdit, intent?: FsWriteIntent): Promise<FsWriteOutcome>
  fsListDir(target: FsTarget): Promise<FsDirEntry[]>

  // -- kernel lifecycle --
  dispose(): Promise<void>
}

/**
 * Subscribe to kernel-emitted events (session events, agent status, terminal
 * data, approval requests). The RPC server forwards these to the renderer.
 */
export type DshEventListener = (event: unknown) => void

/** Options for {@link bootDsh}. */
export interface BootOptions {
  /** The workspace root the kernel confines execution to. */
  readonly workspaceRoot: string
  /** The listener that receives all kernel-emitted events. */
  readonly onEvent: DshEventListener
}

/**
 * Boot the DSH Cordis tree and return a live {@link DshKernel}.
 *
 * Real implementation (once `vendor/dsh` is present):
 *  1. Import `@deepseek-ai/cordis` and create a root context.
 *  2. Load the `dsh-base` bundle rows (model adapters, tools, persistence,
 *     sandbox, approval, settings, credentials).
 *  3. Mount `ctx.fs`/`ctx.subprocess` on the local (or e2b) backend, confined
 *     to `workspaceRoot`.
 *  4. Wire kernel events → `onEvent` (session events, agent status, terminal
 *     data, approval requests).
 *  5. Return the {@link DshKernel} projection.
 *
 * @throws Error until DSH is vendored.
 */
export async function bootDsh(_options: BootOptions): Promise<DshKernel> {
  throw new Error(
    'agent-host: DSH kernel not yet bootstrapped — vendor/dsh must be present. ' +
      'Run the R0.1 subtree step to add deepseek-harness, then implement bootDsh.',
  )
}
