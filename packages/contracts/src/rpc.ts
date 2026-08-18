/**
 * The deep-contract RPC protocol — the single API surface between the VS Code
 * renderer and the DSH Agent Host.
 *
 * This is the "神经" the parasitic design replaces, but typed and shared
 * rather than guessed over JSON-RPC. Both sides import these types:
 *  - The Agent Host implements {@link AgentHostApi} (the renderer's proxy
 *    target) and emits {@link AgentHostEvent} (the renderer's subscription).
 *  - The renderer obtains a typed proxy via the bridge client and subscribes
 *    to the event stream.
 *
 * Transport: MessagePort + a structured clone–capable RPC protocol (reusing
 * VS Code's RPCProtocol machinery). Types are shared at compile time so drift
 * surfaces before runtime.
 *
 * @module @ultimate-ide/contracts/rpc
 */

import type {
  AgentHandle,
  AgentOptions,
  AgentStatusEvent,
  CancelOptions,
  CreateAgentOptions,
  ResumeAgentOptions,
} from './agent.ts'
import type { SessionEvent } from './session.ts'
import type { SessionId } from './ids.ts'
import type { ContentBlock, ToolDefinition, ToolResult } from './tools.ts'
import type {
  FsDirEntry,
  FsEdit,
  FsInfo,
  FsTarget,
  FsWriteIntent,
  FsWriteOutcome,
} from './fs.ts'

// ---------------------------------------------------------------------------
// Agent lifecycle
// ---------------------------------------------------------------------------

/** Result of creating an agent: a renderer-facing handle plus the initial event seq. */
export interface CreateAgentResult {
  readonly handle: AgentHandle
  /** The next session-event seq the renderer should expect (for stream catch-up). */
  readonly nextSeq: number
}

/** A prompt sent to an agent; the turn streams back over the event channel. */
export interface PromptRequest {
  readonly sessionId: SessionId
  readonly text: string
  /** Inline images attached to the prompt. */
  readonly images?: ReadonlyArray<{ readonly mediaType: string; readonly data: string }>
}

// ---------------------------------------------------------------------------
// Terminal (ctx.terminals projection)
// ---------------------------------------------------------------------------

/** A request to spawn a terminal session in the shared execution world. */
export interface TerminalSpawnRequest {
  /** The owning agent's session (scopes the terminal to the workspace). */
  readonly sessionId: SessionId
  readonly cwd?: string
  readonly command?: string
  readonly cols?: number
  readonly rows?: number
}

/** A live terminal session handle. */
export interface TerminalHandle {
  readonly id: string
  readonly sessionId: SessionId
}

/** Data emitted by a terminal session (stdout/stderr/PTY output). */
export interface TerminalDataEvent {
  readonly terminalId: string
  readonly data: string
}

/** A terminal session exited. */
export interface TerminalExitEvent {
  readonly terminalId: string
  readonly exitCode: number | null
}

// ---------------------------------------------------------------------------
// Approval (ctx.approval projection) — the human-in-the-loop contract
// ---------------------------------------------------------------------------

/** A request for human approval before a sandboxed action proceeds. */
export interface ApprovalRequest {
  readonly id: string
  readonly sessionId: SessionId
  readonly kind: 'bash' | 'fs-write' | 'fs-edit' | 'escalation'
  /** Human-readable description of the action. */
  readonly description: string
  /** The tool call id that triggered the approval, if any. */
  readonly callId?: string
}

/** The human's response to an approval request. */
export interface ApprovalResponse {
  readonly id: string
  readonly decision: 'allow' | 'reject'
}

// ---------------------------------------------------------------------------
// Editor-as-tool (fusion 4: agent drives the workbench)
// ---------------------------------------------------------------------------

/** The agent requests the renderer open a file and optionally reveal a range. */
export interface EditorOpenRequest {
  readonly path: string
  readonly startLine?: number
  readonly endLine?: number
}

/** The agent requests the renderer show a diff for review. */
export interface EditorShowDiffRequest {
  readonly path: string
  readonly before: string
  readonly after: string
  readonly label?: string
}

/** The agent requests a workbench layout change. */
export type WorkbenchLayoutMode = 'edit' | 'task' | 'review'

// ---------------------------------------------------------------------------
// The renderer→Agent-Host call surface
// ---------------------------------------------------------------------------

/**
 * The API the renderer calls on the Agent Host. Each method is one RPC
 * round-trip. Streaming results (session events, terminal data, approval
 * requests) arrive over the separate {@link AgentHostEvent} channel.
 *
 * The Agent Host implements this; the renderer holds a typed proxy.
 */
export interface AgentHostApi {
  // -- lifecycle --
  /** Create a fresh agent and optionally send an initial prompt. */
  createAgent(options: CreateAgentOptions): Promise<CreateAgentResult>
  /** Resume an agent on a persisted session. */
  resumeAgent(options: ResumeAgentOptions): Promise<CreateAgentResult>
  /** Dispose an agent (stop loop, drain, unregister, remove session). */
  disposeAgent(sessionId: SessionId): Promise<void>

  // -- driving --
  /** Send a prompt; the turn streams back over the event channel. */
  sendPrompt(request: PromptRequest): Promise<void>
  /** Cancel an agent's active turn or autonomous work. */
  cancelAgent(sessionId: SessionId, cause: string, options?: CancelOptions): Promise<void>
  /** Wait for an agent to reach quiescence. */
  awaitIdle(sessionId: SessionId): Promise<void>

  // -- session log --
  /** Replay session events from `fromSeq` (for catch-up or replay view). */
  queryEvents(sessionId: SessionId, fromSeq?: number): Promise<SessionEvent[]>
  /** List registered tools visible to an agent. */
  listTools(sessionId: SessionId): Promise<ToolDefinition[]>
  /** Invoke a tool directly (bypassing the model; for command-palette use). */
  invokeTool(
    sessionId: SessionId,
    tool: string,
    args: unknown,
  ): Promise<ToolResult>

  // -- ctx.fs (shared execution world) --
  fsResolve(path: string, cwd?: string): Promise<FsTarget>
  fsStat(target: FsTarget): Promise<FsInfo | undefined>
  fsReadText(target: FsTarget, opts?: { offset?: number; limit?: number }): Promise<string>
  fsWriteText(target: FsTarget, content: string, intent?: FsWriteIntent): Promise<FsWriteOutcome>
  fsEditText(target: FsTarget, edit: FsEdit, intent?: FsWriteIntent): Promise<FsWriteOutcome>
  fsListDir(target: FsTarget): Promise<FsDirEntry[]>

  // -- ctx.terminals (shared execution world) --
  terminalSpawn(request: TerminalSpawnRequest): Promise<TerminalHandle>
  terminalInput(terminalId: string, data: string): Promise<void>
  terminalResize(terminalId: string, cols: number, rows: number): Promise<void>
  terminalClose(terminalId: string): Promise<void>

  // -- approval --
  /** Respond to an {@link ApprovalRequest} pushed over the event channel. */
  respondApproval(response: ApprovalResponse): Promise<void>
}

// ---------------------------------------------------------------------------
// The Agent-Host→renderer event channel
// ---------------------------------------------------------------------------

/**
 * Events the Agent Host pushes to the renderer. The renderer subscribes to
 * this stream to update its UI (chat stream, terminal panels, approval
 * prompts) without polling.
 */
export type AgentHostEvent =
  | ({ readonly kind: 'session-event' } & { readonly sessionId: SessionId } & SessionEvent)
  | ({ readonly kind: 'agent-status' } & AgentStatusEvent)
  | ({ readonly kind: 'terminal-data' } & TerminalDataEvent)
  | ({ readonly kind: 'terminal-exit' } & TerminalExitEvent)
  | ({ readonly kind: 'approval-request' } & ApprovalRequest)
  | ({ readonly kind: 'editor-open' } & EditorOpenRequest)
  | ({ readonly kind: 'editor-show-diff' } & EditorShowDiffRequest)
  | ({ readonly kind: 'workbench-layout'; readonly mode: WorkbenchLayoutMode })
  | { readonly kind: 'error'; readonly message: string }

// ---------------------------------------------------------------------------
// The bridge handshake
// ---------------------------------------------------------------------------

/** The initial handshake the renderer sends when the MessagePort opens. */
export interface BridgeHandshake {
  readonly protocol: 'ultimate-ide-agent-host'
  readonly version: number
  /** The workspace root the Agent Host should confine execution to. */
  readonly workspaceRoot: string
}

/** The Agent Host's handshake response. */
export interface BridgeHandshakeResponse {
  readonly protocol: 'ultimate-ide-agent-host'
  readonly version: number
  readonly ready: true
  /** The DSH build version the Agent Host loaded. */
  readonly dshVersion: string
}
