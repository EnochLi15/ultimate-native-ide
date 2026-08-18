/**
 * R2: provenance types — edit attribution for the session log spine.
 *
 * Every edit to a document carries a {@link Provenance} record: who initiated
 * it (agent / human / extension), which agent step, and a stable id. This lets
 * the IDE answer "who changed this line, in which turn?" and makes the session
 * log the source of truth for the document's history (architecture invariant 2).
 *
 * @module @ultimate-ide/provenance/types
 */

import type { SessionId } from '@ultimate-ide/contracts/ids'

/** Who initiated an edit. */
export type EditInitiator = 'agent' | 'human' | 'extension'

/**
 * The attribution record for one edit. Attached to every WorkspaceEdit that
 * flows through BulkEditService, and logged to the session log.
 */
export interface Provenance {
  /** Who made this edit. */
  readonly initiator: EditInitiator
  /** The agent session id, when initiator is 'agent'. */
  readonly sessionId?: SessionId
  /** The agent turn number, when initiator is 'agent'. */
  readonly turn?: number
  /** The agent step number, when initiator is 'agent'. */
  readonly step?: number
  /** The tool call id, when the edit was made by a tool. */
  readonly callId?: string
  /** A stable unique id for this edit (for log correlation). */
  readonly editId: string
  /** Unix epoch milliseconds. */
  readonly timestamp: number
}

/**
 * A range of lines in a document, for provenance tracking.
 * Line numbers are 1-based (matching VS Code's Position.lineNumber).
 */
export interface LineRange {
  readonly startLine: number
  readonly endLine: number
}

/**
 * One document's provenance map: line ranges → the last edit that touched them.
 * This is the queryable structure that answers "who changed line N?"
 */
export interface DocumentProvenance {
  /** The document's file path. */
  readonly path: string
  /** The document's current version (monotonic). */
  readonly version: number
  /** Line-range → provenance, ordered by startLine. */
  readonly edits: ReadonlyArray<readonly [LineRange, Provenance]>
}

/**
 * A provenance event, logged to the session log and forwarded to the renderer.
 */
export interface ProvenanceEvent {
  readonly kind: 'provenance-edit'
  readonly path: string
  readonly version: number
  readonly range: LineRange
  readonly provenance: Provenance
}

/** Create a provenance record for an agent edit. */
export function agentProvenance(
  sessionId: SessionId,
  turn: number,
  step: number,
  callId?: string,
): Provenance {
  return {
    initiator: 'agent',
    sessionId,
    turn,
    step,
    callId,
    editId: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  }
}

/** Create a provenance record for a human edit. */
export function humanProvenance(): Provenance {
  return {
    initiator: 'human',
    editId: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  }
}

/** Create a provenance record for an extension edit. */
export function extensionProvenance(extensionId: string): Provenance {
  return {
    initiator: 'extension',
    callId: extensionId,
    editId: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  }
}
