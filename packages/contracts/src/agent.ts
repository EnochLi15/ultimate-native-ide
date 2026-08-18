/**
 * Agent-side contract types — the renderer's view of a live DSH agent.
 *
 * These mirror `@deepseek-ai/dsh-agent` (`packages/core/agent/src/index.ts`)
 * but are dependency-free: the renderer imports these types to speak to the
 * Agent Host over the deep-contract RPC, without pulling in Cordis. The Agent
 * Host's real `Agent`/`AgentHandle` satisfy these structural types.
 *
 * @module @ultimate-ide/contracts/agent
 */

import type { SessionId } from './ids.ts'

/** Merge-extensible agent creation options. Persona belongs to system-prompt sections. */
export interface AgentOptions {
  /** Provider route (must have a registered adapter at call time). */
  provider?: string
  /** Model id interpreted by the selected provider adapter. */
  model?: string
  /** Maximum output tokens for each conversation-model request. */
  maxTokens?: number
}

/** An agent's lifecycle state, emitted on every transition as `agent/status`. */
export type AgentStatus = 'idle' | 'running'

/** One of the two ordered pending-message lists owned by an agent. */
export type InboxTarget = 'next-turn' | 'next-step'

/** Options for {@link AgentHandle.cancel}. */
export interface CancelOptions {
  /** Preserve queued and steering inbox items instead of discarding them. */
  keepInbox?: boolean
}

/** The stable caller intent carried by the active operation signal. */
export type AgentCancelCause = string

/**
 * Session creation metadata for {@link CreateAgentOptions.meta}.
 * Mirrors the `cwd`/`parentSession`/`seedLength`/`origin`/`delegationDepth`
 * fields of `CreateSessionOptions.meta` in dsh-session.
 */
export interface AgentSessionMeta {
  readonly cwd?: string
  readonly parentSession?: SessionId
  readonly seedLength?: number
  readonly origin?: 'subagent'
  readonly delegationDepth?: number
  readonly agentPreset?: string
}

/**
 * Options for programmatically creating an agent through the registry factory.
 * Source: `@deepseek-ai/dsh-agent` `CreateAgentOptions`.
 */
export interface CreateAgentOptions {
  /** The live agent/session identity. */
  readonly sessionId: SessionId
  /** Session creation metadata (validated cwd, fork lineage, …). */
  readonly meta?: AgentSessionMeta
  /** Per-agent options (model, …). */
  readonly agentOptions?: AgentOptions
  /**
   * Initial prompt to wake the driver immediately after creation.
   * (DSH's factory does not take a prompt; the bridge adds this convenience
   * so the renderer can create-and-send in one RPC round-trip.)
   */
  readonly prompt?: string
}

/** Options for resuming an agent on a persisted session. */
export interface ResumeAgentOptions {
  /** The persisted session id to load and use as the live agent/session identity. */
  readonly resumeSessionId: SessionId
  /** Per-agent options (model, …). */
  readonly agentOptions?: AgentOptions
}

/**
 * A renderer-facing agent reference — the RPC projection of DSH's
 * `AgentHandle`. The renderer never holds the real `Agent` object (that lives
 * in the Agent Host process); it holds this id-based handle and drives the
 * agent through the bridge RPC.
 */
export interface AgentHandle {
  /** The session id this agent drives. */
  readonly sessionId: SessionId
  /** The provider route and model this agent's requests use. */
  readonly options: AgentOptions
  /** The current lifecycle state. */
  readonly status: AgentStatus
}

/**
 * A renderer-facing live-agent snapshot pushed on every `agent/status`
 * transition. The Agent Host emits this over the event stream so the renderer
 * can update its UI without polling.
 */
export interface AgentStatusEvent {
  readonly sessionId: SessionId
  readonly status: AgentStatus
}
