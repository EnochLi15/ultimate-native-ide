/**
 * R7: cloud execution types — the execution world abstraction.
 *
 * DSH's execution world (ctx.fs + ctx.subprocess + ctx.terminals) is a set
 * of replaceable provider seams. This module defines the abstraction for
 * switching between local and cloud (E2B) execution worlds at the profile
 * level — the architectural moat that lets the agent's hands reach the cloud.
 *
 * @module @ultimate-ide/cloud-execution/types
 */

/** The execution world location. */
export type ExecutionWorldKind = 'local' | 'cloud-e2b' | 'remote'

/** Configuration for one execution world. */
export interface ExecutionWorldConfig {
  readonly kind: ExecutionWorldKind
  /** The workspace root to confine execution to. */
  readonly workspaceRoot: string
  /** For cloud-e2b: the E2B sandbox template id. */
  readonly e2bTemplateId?: string
  /** For cloud-e2b: the E2B API key (resolved from credentials, not inlined). */
  readonly e2bApiKeyRef?: string
  /** For remote: the remote host URI. */
  readonly remoteUri?: string
  /** Whether to sync local workspace files to the execution world on connect. */
  readonly syncOnConnect?: boolean
}

/** The status of an execution world connection. */
export type ExecutionWorldStatus =
  | { kind: 'disconnected' }
  | { kind: 'connecting' }
  | { kind: 'connected'; sandboxId?: string }
  | { kind: 'error'; message: string }

/** One execution world's runtime info. */
export interface ExecutionWorldInfo {
  readonly kind: ExecutionWorldKind
  readonly status: ExecutionWorldStatus
  /** Human-readable label for UI. */
  readonly label: string
  /** Whether file writes are sandboxed. */
  readonly sandboxed: boolean
}
